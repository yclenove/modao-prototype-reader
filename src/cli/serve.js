import { parseServeArgs, printServeHelp } from '../core/options.js';
import { startServer } from '../server/server.js';
import { wrapError } from '../core/errors.js';

export async function runServeCli(argv = process.argv.slice(2)) {
  try {
    const parsed = parseServeArgs(argv);
    if (parsed.help) {
      printServeHelp();
      return;
    }
    await startServer(parsed.options.port);
  } catch (error) {
    const wrapped = wrapError(error, 'SERVER_FAILED');
    console.error(`${wrapped.code}: ${wrapped.message}`);
    process.exitCode = 1;
  }
}
