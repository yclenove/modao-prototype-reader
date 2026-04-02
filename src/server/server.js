import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReadOptions } from '../core/options.js';
import { errorToJson, wrapError } from '../core/errors.js';
import { readPrototype, writeReadArtifacts } from '../core/service.js';
import { generateVue3Artifacts, writeVue3Artifacts } from '../generators/vue3/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.join(__dirname, '../web');

function sendJson(response, statusCode, payload, method = 'GET') {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(method === 'HEAD' ? '' : JSON.stringify(payload, null, 2));
}

function sendHtml(response, filePath, method = 'GET') {
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(method === 'HEAD' ? '' : fs.readFileSync(filePath, 'utf8'));
}

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export function buildOptionsFromPayload(payload) {
  const options = createReadOptions();
  return {
    ...options,
    url: String(payload.url || '').trim(),
    file: String(payload.file || '').trim(),
    password: String(payload.password || ''),
    depth: payload.depth || options.depth,
    only: payload.only || options.only,
    screen: String(payload.screen || ''),
    screenName: String(payload.screenName || ''),
    timeoutMs: Number(payload.timeoutMs || options.timeoutMs),
    chromeUserDataDir: String(payload.chromeUserDataDir || ''),
    chromeProfileDirectory: String(payload.chromeProfileDirectory || ''),
    headless: payload.headless == null ? options.headless : Boolean(payload.headless),
    debug: Boolean(payload.debug),
    screenshot: Boolean(payload.screenshot) ? '1' : '',
    screenshotAll: Boolean(payload.screenshotAll),
    screenshotAllLimit: Number(payload.screenshotAllLimit || 0),
    probeOut: String(payload.probeOut || ''),
  };
}

function buildGenerateOptionsFromPayload(payload) {
  return {
    outDir: String(payload.outDir || ''),
    componentName: String(payload.componentName || ''),
    routeName: String(payload.routeName || ''),
  };
}

function sanitizePathSegment(value) {
  const raw = String(value || 'modao');
  const cleaned = raw.replace(/[^a-zA-Z0-9._-]+/g, '_');
  return cleaned.length > 80 ? cleaned.slice(0, 80) : cleaned;
}

export function createServer() {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/') {
        sendHtml(response, path.join(webRoot, 'index.html'), request.method);
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/read') {
        const payload = await readRequestBody(request);
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const key = sanitizePathSegment(payload.url || payload.file || 'modao');
        const runDir = path.join('tmp', 'web', key, ts);
        fs.mkdirSync(runDir, { recursive: true });

        const options = buildOptionsFromPayload(payload);
        const captureScreenshotRequested = Boolean(options.screenshot);
        options.screenshot = captureScreenshotRequested ? path.join(runDir, 'screenshot.png') : '';
        options.probeOut = options.debug ? path.join(runDir, 'probe.json') : '';
        if (options.screenshotAll) {
          options.screenshotAllDir = path.join(runDir, 'screens');
        }

        const result = await readPrototype(options);

        // Persist run artifacts on disk (export/summary/scaffold; screenshot optionally).
        // This keeps different projects isolated and makes it easier to re-open outputs later.
        const persisted = writeReadArtifacts(result, {
          ...options,
          out: path.join(runDir, 'export.json'),
          summaryOut: path.join(runDir, 'summary.json'),
          scaffoldOut: path.join(runDir, 'scaffold.json'),
          screenshot: options.screenshot,
          probeOut: options.probeOut,
        });

        sendJson(response, 200, {
          ok: true,
          output: result.output,
          summary: result.summary,
          scaffold: result.scaffold,
          screenshotBase64: result.screenshotBase64,
          debug: result.debug,
          meta: {
            ...result.meta,
            runDir,
            screenshotAllDir: options.screenshotAll ? options.screenshotAllDir : null,
            persisted,
          },
        });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/generate/vue3') {
        const payload = await readRequestBody(request);
        const options = buildGenerateOptionsFromPayload(payload);
        const artifacts = generateVue3Artifacts(payload.scaffold, options);
        const persisted = options.outDir
          ? writeVue3Artifacts(artifacts, options.outDir)
          : null;
        sendJson(response, 200, {
          ok: true,
          generated: artifacts,
          meta: {
            outDir: options.outDir,
            componentName: artifacts.model.meta.componentName,
            routeName: artifacts.model.meta.routeName,
            persisted,
          },
        });
        return;
      }

      sendJson(
        response,
        404,
        { ok: false, error: { code: 'NOT_FOUND', message: 'Route not found.' } },
        request.method,
      );
    } catch (error) {
      const wrapped = wrapError(error, 'SERVER_REQUEST_FAILED');
      sendJson(response, 500, {
        ok: false,
        error: errorToJson(wrapped),
      }, request.method);
    }
  });
}

export async function startServer(port) {
  const server = createServer();

  await new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      console.log(`Modao reader web UI: http://127.0.0.1:${port}`);
      resolve();
    });
  });

  return server;
}
