import { parseReadArgs, printReadHelp } from '../core/options.js';
import { readPrototype, writeReadArtifacts } from '../core/service.js';
import { wrapError } from '../core/errors.js';

export async function runReadCli(argv = process.argv.slice(2)) {
  try {
    const parsed = parseReadArgs(argv);
    if (parsed.help) {
      printReadHelp();
      return;
    }
    const result = await readPrototype(parsed.options);
    const written = await writeReadArtifacts(result, parsed.options);
    console.log(JSON.stringify(written, null, 2));
  } catch (error) {
    const wrapped = wrapError(error, 'CLI_FAILED');
    console.error(`${wrapped.code}: ${wrapped.message}`);
    process.exitCode = 1;
  }
}
