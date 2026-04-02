import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { sleep } from './utils.js';
import { ModaoReaderError } from './errors.js';

function isAllowedModaoSharePath(pathname) {
  if (pathname.startsWith('/app/')) return true;
  // e.g. /proto/<token>/sharing — device / public share view (query may carry ?screen=...)
  if (pathname.startsWith('/proto/') && pathname.includes('/sharing')) return true;
  return false;
}

export function assertModaoUrl(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new ModaoReaderError('INVALID_URL', 'The provided value is not a valid URL.');
  }
  if (!/modao\.cc$/i.test(url.hostname)) {
    throw new ModaoReaderError('INVALID_HOST', `Unsupported host: ${url.hostname}`);
  }
  if (!isAllowedModaoSharePath(url.pathname)) {
    throw new ModaoReaderError(
      'INVALID_PATH',
      'Only Modao share URLs under /app/ or /proto/.../sharing are supported.',
    );
  }
  return url;
}

export function getTargetScreenCid(url) {
  const fromHash = url.hash.match(/screen=([^&]+)/)?.[1];
  if (fromHash) return fromHash;
  const fromQuery = url.searchParams.get('screen');
  return fromQuery ?? '';
}

export function applyPasswordToUrl(url, password) {
  if (!password) {
    return url;
  }
  const next = new URL(url.toString());
  if (!next.searchParams.get('password')) {
    next.searchParams.set('password', password);
  }
  return next;
}

export async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new ModaoReaderError('PORT_ALLOCATE_FAILED', 'Unable to allocate a debugging port.'));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

export function findChromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome 2.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ].filter(Boolean);

  const matched = candidates.find((candidate) => fs.existsSync(candidate));
  if (!matched) {
    throw new ModaoReaderError(
      'CHROME_NOT_FOUND',
      'Chrome was not found. Set CHROME_PATH to your local Chrome executable.',
    );
  }

  return matched;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new ModaoReaderError('HTTP_ERROR', `HTTP ${response.status} for ${url}`);
  }
  return await response.json();
}

export async function waitForDebugger(port) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      return await fetchJson(`http://127.0.0.1:${port}/json/version`);
    } catch {
      await sleep(200);
    }
  }
  throw new ModaoReaderError(
    'DEBUGGER_TIMEOUT',
    'Chrome remote debugger did not become ready in time.',
  );
}

export async function openDebugPage(port) {
  await fetchJson(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
  const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`);
  const page = targets.find((target) => target.type === 'page');
  if (!page?.webSocketDebuggerUrl) {
    throw new ModaoReaderError('PAGE_NOT_FOUND', 'Unable to find a debuggable Chrome page.');
  }
  return page;
}

export class CdpClient {
  constructor(webSocketUrl) {
    this.ws = new WebSocket(webSocketUrl);
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });

    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) {
        return;
      }
      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new ModaoReaderError('CDP_ERROR', JSON.stringify(message.error)));
        return;
      }
      pending.resolve(message.result);
    });
  }

  async send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    return await new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new ModaoReaderError(
        'RUNTIME_EVALUATION_FAILED',
        result.exceptionDetails.text || 'Runtime evaluation failed.',
      );
    }
    return result.result.value;
  }

  close() {
    this.ws.close();
  }
}

export function createChromeSession(chromePath, options) {
  const usingExternalUserDataDir = Boolean(options.chromeUserDataDir);
  const userDataDir =
    options.chromeUserDataDir || fs.mkdtempSync(path.join(os.tmpdir(), 'modao-reader-'));

  return {
    userDataDir,
    usingExternalUserDataDir,
    spawn(port) {
      const args = [
        ...(options.headless === false ? [] : ['--headless=new']),
        '--disable-gpu',
        // Make headless viewport stable so screenshot/layout matches the real browser better.
        '--window-size=1920,1080',
        '--no-first-run',
        '--no-default-browser-check',
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${userDataDir}`,
      ];

      if (options.chromeProfileDirectory) {
        args.push(`--profile-directory=${options.chromeProfileDirectory}`);
      }

      args.push('about:blank');
      return spawn(chromePath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    },
    async cleanup(processHandle) {
      processHandle?.kill('SIGTERM');
      await sleep(500);
      if (!usingExternalUserDataDir) {
        try {
          fs.rmSync(userDataDir, { recursive: true, force: true });
        } catch {
          // Ignore temp cleanup failures while Chrome is still releasing files.
        }
      }
    },
  };
}
