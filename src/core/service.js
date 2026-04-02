import fs from 'node:fs';
import path from 'node:path';
import {
  applyPasswordToUrl,
  assertModaoUrl,
  CdpClient,
  createChromeSession,
  findChromePath,
  getFreePort,
  getTargetScreenCid,
  openDebugPage,
  waitForDebugger,
} from './chrome.js';
import { wrapError } from './errors.js';
import { buildBrowserExtractionScript, waitForPrototype } from './extract.js';
import { buildOutput, applyScopedSelection, buildSummary, buildScaffold } from './transform.js';
import { toAbsolutePath, toJson } from './utils.js';

function finalizeDiagnostics(output, startedAt) {
  const json = toJson(output);
  output.diagnostics.timings = {
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
  };
  output.diagnostics.output = {
    byteLength: Buffer.byteLength(json),
  };
  if (output.diagnostics.output.byteLength > output.diagnostics.thresholds.sizeWarnBytes) {
    output.diagnostics.warnings.push(
      `Output size ${output.diagnostics.output.byteLength} bytes exceeds the warning threshold ${output.diagnostics.thresholds.sizeWarnBytes}.`,
    );
  }
  return output;
}

export function buildArtifacts(output) {
  return {
    output,
    summary: buildSummary(output),
    scaffold: buildScaffold(output),
  };
}

export async function readPrototype(options) {
  const startedAt = Date.now();
  const url = applyPasswordToUrl(assertModaoUrl(options.url), options.password);
  const targetScreenCid = getTargetScreenCid(url);
  const chromePath = findChromePath();
  const port = await getFreePort();
  const session = createChromeSession(chromePath, options);
  const debugState = {
    startedAt: new Date(startedAt).toISOString(),
    requestedUrl: options.url,
    resolvedUrl: url.toString(),
    targetScreenCid,
    chromePath,
    debugEnabled: Boolean(options.debug),
    probeHistory: [],
    waitSummary: null,
    failure: null,
  };

  let chromeProcess;
  let client;
  try {
    chromeProcess = session.spawn(port);
    chromeProcess.stderr.on('data', () => {});

    await waitForDebugger(port);
    const page = await openDebugPage(port);
    client = new CdpClient(page.webSocketDebuggerUrl);
    await client.connect();
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Page.navigate', { url: url.toString() });
    const waitResult = await waitForPrototype(client, options.timeoutMs, options);
    debugState.probeHistory = waitResult.probes;
    debugState.waitSummary = waitResult.summary;

    const extracted = await client.evaluate(
      buildBrowserExtractionScript({ depth: options.depth, targetScreenCid }),
    );
    let output = buildOutput(extracted, options, url, targetScreenCid);
    output = applyScopedSelection(output, options);
    output.diagnostics.auth = {
      passwordProvided: Boolean(options.password),
      chromeUserDataDirProvided: Boolean(options.chromeUserDataDir),
      chromeProfileDirectoryProvided: Boolean(options.chromeProfileDirectory),
      mode: options.chromeUserDataDir ? 'reuse_local_profile' : 'ephemeral_profile',
    };
    output.diagnostics.debug = {
      targetScreenCid,
      probeCount: debugState.probeHistory.length,
      latestProbeSummary: debugState.waitSummary,
    };
    output = finalizeDiagnostics(output, startedAt);

    let screenshotBase64 = null;
    if (options.screenshot) {
      const screenshot = await client.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
      });
      screenshotBase64 = screenshot.data;
    }

    return {
      ...buildArtifacts(output),
      screenshotBase64,
      debug: debugState,
      meta: {
        depth: options.depth,
        scope: output.scope ?? { only: 'all' },
        projectTitle: output.projectTitle,
        totalScreens: output.totalScreens,
        totalStates: output.totalStates,
        totalWidgets: output.totalWidgets ?? 0,
        totalInteractions: output.totalInteractions ?? 0,
        currentScreen: output.currentScreen?.name || null,
      },
    };
  } catch (error) {
    const wrapped = wrapError(error, 'READ_FAILED');
    const failureDebug = wrapped.details?.debug ?? null;
    if (failureDebug?.probeHistory?.length) {
      debugState.probeHistory = failureDebug.probeHistory;
    }
    if (failureDebug?.waitSummary) {
      debugState.waitSummary = failureDebug.waitSummary;
    } else if (wrapped.details?.latestProbe?.summary) {
      debugState.waitSummary = wrapped.details.latestProbe.summary;
    }
    debugState.failure = {
      code: wrapped.code,
      message: wrapped.message,
      details: wrapped.details,
    };
    wrapped.details = {
      ...(wrapped.details ?? {}),
      debug: debugState,
    };
    throw wrapped;
  } finally {
    client?.close();
    await session.cleanup(chromeProcess);
  }
}

export async function writeReadArtifacts(result, options) {
  const outputPath = toAbsolutePath(options.out);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, toJson(result.output), 'utf8');

  if (options.splitScreens) {
    await writeSplitScreens(result.output, outputPath);
  }

  if (options.summaryOut) {
    const summaryPath = toAbsolutePath(options.summaryOut);
    fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
    fs.writeFileSync(summaryPath, toJson(result.summary), 'utf8');
  }

  if (options.scaffoldOut) {
    const scaffoldPath = toAbsolutePath(options.scaffoldOut);
    fs.mkdirSync(path.dirname(scaffoldPath), { recursive: true });
    fs.writeFileSync(scaffoldPath, toJson(result.scaffold), 'utf8');
  }

  if (options.screenshot && result.screenshotBase64) {
    const screenshotPath = toAbsolutePath(options.screenshot);
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    fs.writeFileSync(screenshotPath, Buffer.from(result.screenshotBase64, 'base64'));
  }

  if (options.probeOut) {
    const probePath = toAbsolutePath(options.probeOut);
    fs.mkdirSync(path.dirname(probePath), { recursive: true });
    fs.writeFileSync(probePath, toJson(result.debug ?? {}), 'utf8');
  }

  return {
    out: outputPath,
    screenshot: options.screenshot ? toAbsolutePath(options.screenshot) : null,
    probeOut: options.probeOut ? toAbsolutePath(options.probeOut) : null,
    ...result.meta,
  };
}

async function writeSplitScreens(output, outPath) {
  const baseDir = outPath.replace(/\.json$/i, '');
  const screensDir = `${baseDir}-screens`;
  fs.mkdirSync(screensDir, { recursive: true });
  const index = [];
  for (const screen of output.screens) {
    const perScreen = applyScopedSelection(output, {
      only: 'screen',
      screen: screen.cid,
      screenName: '',
    });
    const filePath = `${screensDir}/${screen.cid}.json`;
    fs.writeFileSync(filePath, toJson(perScreen), 'utf8');
    index.push({ cid: screen.cid, name: screen.name, file: filePath });
  }
  fs.writeFileSync(`${screensDir}/index.json`, toJson(index), 'utf8');
}
