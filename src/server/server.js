import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReadOptions } from '../core/options.js';
import { errorToJson, wrapError } from '../core/errors.js';
import { readPrototype } from '../core/service.js';
import { generateVue3Artifacts } from '../generators/vue3/index.js';

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
    password: String(payload.password || ''),
    depth: payload.depth || options.depth,
    only: payload.only || options.only,
    screen: String(payload.screen || ''),
    screenName: String(payload.screenName || ''),
    timeoutMs: Number(payload.timeoutMs || options.timeoutMs),
    chromeUserDataDir: String(payload.chromeUserDataDir || ''),
    chromeProfileDirectory: String(payload.chromeProfileDirectory || ''),
    debug: Boolean(payload.debug),
    screenshot: String(payload.screenshot || ''),
    probeOut: String(payload.probeOut || ''),
  };
}

function buildGenerateOptionsFromPayload(payload) {
  return {
    outDir: String(payload.outDir || 'tmp/generated/vue3'),
    componentName: String(payload.componentName || ''),
    routeName: String(payload.routeName || ''),
  };
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
        const options = buildOptionsFromPayload(payload);
        const result = await readPrototype(options);
        sendJson(response, 200, {
          ok: true,
          output: result.output,
          summary: result.summary,
          scaffold: result.scaffold,
          screenshotBase64: result.screenshotBase64,
          debug: result.debug,
          meta: result.meta,
        });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/generate/vue3') {
        const payload = await readRequestBody(request);
        const options = buildGenerateOptionsFromPayload(payload);
        const artifacts = generateVue3Artifacts(payload.scaffold, options);
        sendJson(response, 200, {
          ok: true,
          generated: artifacts,
          meta: {
            outDir: options.outDir,
            componentName: artifacts.model.meta.componentName,
            routeName: artifacts.model.meta.routeName,
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
