import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
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
import { sleep, toAbsolutePath, toJson } from './utils.js';

function buildScreenUrl(baseUrl, screenCid) {
  const next = new URL(baseUrl.toString());
  if (next.pathname.startsWith('/proto/') && next.pathname.includes('/sharing')) {
    next.searchParams.set('screen', screenCid);
    return next;
  }
  // Default /app/ style: drive by hash screen=..., but preserve other hash params.
  const rawHash = (next.hash || '').replace(/^#/, '');
  const hashParams = new URLSearchParams(rawHash);
  hashParams.set('screen', screenCid);
  next.hash = hashParams.toString();
  return next;
}

async function capturePngBase64(client) {
  let clip = null;
  try {
    const metrics = await client.send('Page.getLayoutMetrics');
    const contentSize = metrics?.contentSize;
    const width = Math.ceil(contentSize?.width ?? 0);
    const height = Math.ceil(contentSize?.height ?? 0);
    const maxW = 6000;
    const maxH = 6000;
    if (width > 0 && height > 0 && width <= maxW && height <= maxH) {
      clip = { x: 0, y: 0, width, height, scale: 1 };
    }
  } catch {
    clip = null;
  }

  if (clip) {
    const fullShot = await client.send('Page.captureScreenshot', {
      format: 'png',
      clip,
    });
    return fullShot.data;
  }

  const screenshot = await client.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
  });
  return screenshot.data;
}

async function waitForScreenPaint(client, expectedScreenCid) {
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    try {
      const probe = await client.evaluate(`(() => {
        const state = window.MB?.webpackInterface?.store?.getState?.() || {};
        const current = state.container?.current || {};
        return {
          readyState: document.readyState,
          hasMb: Boolean(window.MB),
          currentScreenCid: current.screenMeta?.cid || '',
          hash: location.hash || '',
        };
      })()`);
      if (
        probe.readyState === 'complete' &&
        (!expectedScreenCid ||
          probe.currentScreenCid === expectedScreenCid ||
          String(probe.hash).includes(`screen=${expectedScreenCid}`))
      ) {
        return true;
      }
    } catch {}
    await sleep(500);
  }
  return false;
}

async function setScreenCidInPage(client, baseUrl, screenCid) {
  const pathname = new URL(baseUrl.toString()).pathname;
  if (pathname.startsWith('/proto/') && pathname.includes('/sharing')) {
    const nextUrl = buildScreenUrl(baseUrl, screenCid);
    await client.send('Page.navigate', { url: nextUrl.toString() });
    return;
  }

  // /app/ pages are SPAs; updating hash in-page is more reliable than repeated navigations.
  const hash = (() => {
    const u = buildScreenUrl(baseUrl, screenCid);
    return u.hash || '';
  })();
  await client.evaluate(`(() => {
    const nextHash = ${JSON.stringify(hash)};
    if (location.hash === nextHash) return true;
    try {
      location.hash = nextHash;
    } catch (e) {
      try {
        history.pushState(null, '', location.pathname + location.search + nextHash);
      } catch (e2) {}
    }
    try { window.dispatchEvent(new Event('hashchange')); } catch (e3) {}
    try { window.dispatchEvent(new PopStateEvent('popstate')); } catch (e4) {}
    return true;
  })()`);
}

async function forceReloadToScreen(client, baseUrl, screenCid) {
  // For /app/ pages, changing only the hash is a same-document navigation and may not
  // trigger Modao to re-resolve the target screen. Force a real reload.
  const nextUrl = buildScreenUrl(baseUrl, screenCid);
  if (nextUrl.pathname.startsWith('/proto/') && nextUrl.pathname.includes('/sharing')) {
    await client.send('Page.navigate', { url: nextUrl.toString() });
    return;
  }

  // Add a cache-busting query param to force a new document navigation.
  nextUrl.searchParams.set('__mrts', String(Date.now()));

  // Update hash first (so the new document sees the desired screen), then hard reload.
  await client.evaluate(`(() => {
    try { location.hash = ${JSON.stringify(nextUrl.hash || '')}; } catch (e) {}
    return true;
  })()`);

  await client.send('Page.navigate', { url: nextUrl.toString() });
}

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
  let navigateUrl;
  let requestedUrl = options.url || '';
  let resolvedUrl;

  if (options.file) {
    // Support reading local exported Modao HTML.
    const abs = toAbsolutePath(options.file);
    navigateUrl = pathToFileURL(abs);
    resolvedUrl = navigateUrl.toString();
    requestedUrl = abs;
  } else {
    // Default: read a remote Modao share URL.
    const url = applyPasswordToUrl(assertModaoUrl(options.url), options.password);
    navigateUrl = url;
    resolvedUrl = url.toString();
  }

  const targetScreenCidFromInput = getTargetScreenCid(navigateUrl);
  const targetScreenCid = options.screen || targetScreenCidFromInput;
  const chromePath = findChromePath();
  const port = await getFreePort();
  const session = createChromeSession(chromePath, options);
  const debugState = {
    startedAt: new Date(startedAt).toISOString(),
    requestedUrl,
    resolvedUrl,
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
    await client.send('Page.navigate', { url: navigateUrl.toString() });
    const waitResult = await waitForPrototype(client, options.timeoutMs, options);
    debugState.probeHistory = waitResult.probes;
    debugState.waitSummary = waitResult.summary;

    const extracted = await client.evaluate(
      buildBrowserExtractionScript({ depth: options.depth, targetScreenCid }),
    );
    let output = buildOutput(extracted, options, navigateUrl, targetScreenCid);
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
      screenshotBase64 = await capturePngBase64(client);
    }

    if (options.screenshotAll && options.screenshotAllDir && Array.isArray(output.screens)) {
      const limit = Number(options.screenshotAllLimit || 0);
      const list = limit > 0 ? output.screens.slice(0, limit) : output.screens;
      const screensDir = toAbsolutePath(options.screenshotAllDir);
      fs.mkdirSync(screensDir, { recursive: true });
      const failures = [];
      const delayMs = Math.max(0, Number(options.screenshotAllDelayMs || 0));

      for (const screen of list) {
        const cid = screen?.cid;
        if (!cid) continue;
        try {
          let ok = false;
          for (let attempt = 0; attempt < 3; attempt += 1) {
            if (options.screenshotAllForceReload) {
              await forceReloadToScreen(client, navigateUrl, cid);
            } else {
              await setScreenCidInPage(client, navigateUrl, cid);
            }
            ok = await waitForScreenPaint(client, cid);
            if (ok) break;
            await sleep(750);
          }
          if (delayMs > 0) {
            await sleep(delayMs);
          }
          const pngBase64 = await capturePngBase64(client);
          const fileName = ok ? `${cid}.png` : `${cid}_failed.png`;
          fs.writeFileSync(path.join(screensDir, fileName), Buffer.from(pngBase64, 'base64'));
          if (!ok) {
            failures.push({ cid, message: `Screen did not confirm switch; wrote ${fileName}.` });
          }
        } catch (error) {
          const message = error?.message || String(error);
          failures.push({ cid, message });
          // If the target page is gone, continuing will fail for every remaining screen.
          if (String(message).includes('Not attached to an active page')) {
            break;
          }
        }
      }

      output.diagnostics.screenshots = {
        mode: 'per_screen',
        dir: screensDir,
        requested: list.length,
        failed: failures.length,
        failures: failures.slice(0, 10),
      };
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
