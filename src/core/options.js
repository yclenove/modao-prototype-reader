import { DEFAULT_SERVER_PORT, DEFAULT_TIMEOUT_MS, DEPTHS, EXPORT_MODES } from './constants.js';
import { ModaoReaderError } from './errors.js';

export function createReadOptions() {
  return {
    url: '',
    file: '',
    out: 'modao-export.json',
    screenshot: '',
    screenshotAll: false,
    screenshotAllLimit: 0,
    screenshotAllDir: '',
    screenshotAllForceReload: false,
    screenshotAllDelayMs: 1500,
    screenshotAllWaitRuntimeReady: true,
    screenshotAllRuntimeReadyTimeoutMs: 20_000,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    depth: 'basic',
    password: '',
    screen: '',
    screenName: '',
    only: 'all',
    splitScreens: false,
    chromeUserDataDir: '',
    chromeProfileDirectory: '',
    headless: true,
    summaryOut: '',
    scaffoldOut: '',
    debug: false,
    probeOut: '',
  };
}

export function parseReadArgs(argv) {
  const result = createReadOptions();

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (!arg.startsWith('--') && !result.url) {
      result.url = arg;
      continue;
    }

    if (arg === '--out') {
      result.out = argv[i + 1] ?? result.out;
      i += 1;
      continue;
    }

    if (arg === '--file') {
      result.file = argv[i + 1] ?? '';
      i += 1;
      continue;
    }

    if (arg === '--screenshot') {
      result.screenshot = argv[i + 1] ?? result.screenshot;
      i += 1;
      continue;
    }

    if (arg === '--screenshot-all') {
      result.screenshotAll = true;
      continue;
    }

    if (arg === '--screenshot-all-limit') {
      const next = Number(argv[i + 1]);
      if (!Number.isFinite(next) || next < 0) {
        throw new ModaoReaderError(
          'INVALID_SCREENSHOT_LIMIT',
          'The --screenshot-all-limit value must be a non-negative number.',
        );
      }
      result.screenshotAllLimit = next;
      i += 1;
      continue;
    }

    if (arg === '--screenshot-all-dir') {
      result.screenshotAllDir = argv[i + 1] ?? '';
      i += 1;
      continue;
    }

    if (arg === '--screenshot-all-force-reload') {
      result.screenshotAllForceReload = true;
      continue;
    }

    if (arg === '--screenshot-all-delay-ms') {
      const next = Number(argv[i + 1]);
      if (!Number.isFinite(next) || next < 0) {
        throw new ModaoReaderError(
          'INVALID_SCREENSHOT_DELAY',
          'The --screenshot-all-delay-ms value must be a non-negative number.',
        );
      }
      result.screenshotAllDelayMs = next;
      i += 1;
      continue;
    }

    if (arg === '--screenshot-all-wait-runtime-ready') {
      result.screenshotAllWaitRuntimeReady = true;
      continue;
    }

    if (arg === '--no-screenshot-all-wait-runtime-ready') {
      result.screenshotAllWaitRuntimeReady = false;
      continue;
    }

    if (arg === '--screenshot-all-runtime-ready-timeout-ms') {
      const next = Number(argv[i + 1]);
      if (!Number.isFinite(next) || next < 0) {
        throw new ModaoReaderError(
          'INVALID_SCREENSHOT_RUNTIME_TIMEOUT',
          'The --screenshot-all-runtime-ready-timeout-ms value must be a non-negative number.',
        );
      }
      result.screenshotAllRuntimeReadyTimeoutMs = next;
      i += 1;
      continue;
    }

    if (arg === '--timeout') {
      const next = Number(argv[i + 1]);
      if (!Number.isFinite(next) || next <= 0) {
        throw new ModaoReaderError('INVALID_TIMEOUT', 'The --timeout value must be a positive number.');
      }
      result.timeoutMs = next;
      i += 1;
      continue;
    }

    if (arg === '--depth') {
      const next = argv[i + 1] ?? result.depth;
      if (!DEPTHS.has(next)) {
        throw new ModaoReaderError(
          'INVALID_DEPTH',
          `Unsupported depth: ${next}. Use one of: basic, rich, full.`,
        );
      }
      result.depth = next;
      i += 1;
      continue;
    }

    if (arg === '--password') {
      result.password = argv[i + 1] ?? '';
      i += 1;
      continue;
    }

    if (arg === '--screen') {
      result.screen = argv[i + 1] ?? '';
      i += 1;
      continue;
    }

    if (arg === '--screen-name') {
      result.screenName = argv[i + 1] ?? '';
      i += 1;
      continue;
    }

    if (arg === '--only') {
      const next = argv[i + 1] ?? result.only;
      if (!EXPORT_MODES.has(next)) {
        throw new ModaoReaderError(
          'INVALID_SCOPE',
          `Unsupported only mode: ${next}. Use one of: current, screen, module, all.`,
        );
      }
      result.only = next;
      i += 1;
      continue;
    }

    if (arg === '--split-screens') {
      result.splitScreens = true;
      continue;
    }

    if (arg === '--chrome-user-data-dir') {
      result.chromeUserDataDir = argv[i + 1] ?? '';
      i += 1;
      continue;
    }

    if (arg === '--chrome-profile-directory') {
      result.chromeProfileDirectory = argv[i + 1] ?? '';
      i += 1;
      continue;
    }

    if (arg === '--headed') {
      result.headless = false;
      continue;
    }

    if (arg === '--summary-out') {
      result.summaryOut = argv[i + 1] ?? '';
      i += 1;
      continue;
    }

    if (arg === '--scaffold-out') {
      result.scaffoldOut = argv[i + 1] ?? '';
      i += 1;
      continue;
    }

    if (arg === '--debug') {
      result.debug = true;
      continue;
    }

    if (arg === '--probe-out') {
      result.probeOut = argv[i + 1] ?? '';
      i += 1;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      return { help: true, options: result };
    }

    throw new ModaoReaderError('UNKNOWN_ARGUMENT', `Unknown argument: ${arg}`);
  }

  if (!result.url && !result.file) {
    throw new ModaoReaderError('MISSING_URL', 'A Modao share URL (--url) or a local HTML file (--file) is required.');
  }

  return { help: false, options: result };
}

export function parseServeArgs(argv) {
  const result = { port: DEFAULT_SERVER_PORT };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--port') {
      const next = Number(argv[i + 1]);
      if (!Number.isFinite(next) || next <= 0) {
        throw new ModaoReaderError('INVALID_PORT', 'The --port value must be a positive number.');
      }
      result.port = next;
      i += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      return { help: true, options: result };
    }
    throw new ModaoReaderError('UNKNOWN_ARGUMENT', `Unknown argument: ${arg}`);
  }
  return { help: false, options: result };
}

export function printReadHelp() {
  console.log(`Usage:
  modao-reader <modao-url> [options]

Options:
  --out <file>                     Output JSON file
  --file <path>                   Read a local exported HTML file
  --screenshot <file>              Save screenshot PNG
  --screenshot-all                 Capture screenshots for each screen
  --screenshot-all-limit <n>       Limit number of screens (0=all)
  --screenshot-all-dir <dir>       Output directory for per-screen PNGs
  --screenshot-all-force-reload    Force reload between screens (slower, more reliable)
  --screenshot-all-delay-ms <ms>   Extra delay after switch before capture
  --screenshot-all-wait-runtime-ready
                                  Wait Modao runtime ready before capture
  --no-screenshot-all-wait-runtime-ready
                                  Disable runtime-ready wait
  --screenshot-all-runtime-ready-timeout-ms <ms>
                                  Runtime-ready wait timeout (0=skip)
  --timeout <ms>                   Wait timeout
  --depth <basic|rich|full>        Export depth
  --password <value>               Password for protected share links
  --screen <cid>                   Scope export to one screen CID
  --screen-name <keyword>          Scope export by screen name keyword
  --only <current|screen|module|all>
  --split-screens                  Emit one JSON file per selected screen
  --chrome-user-data-dir <path>    Reuse a local Chrome user data dir
  --chrome-profile-directory <id>  Reuse a named Chrome profile
  --headed                         Launch Chrome with a visible window (disable headless)
  --summary-out <file>             Write generated page summary JSON
  --scaffold-out <file>            Write generated page scaffold JSON
  --debug                          Include extra runtime diagnostics
  --probe-out <file>               Write probe snapshots and debug metadata
`);
}

export function printServeHelp() {
  console.log(`Usage:
  npm run serve -- [--port 3210]
`);
}
