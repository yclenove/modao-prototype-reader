import fs from 'node:fs';
import path from 'node:path';
import { parseReadArgs, printReadHelp } from '../core/options.js';
import { readPrototype, writeReadArtifacts } from '../core/service.js';
import { errorToJson, wrapError } from '../core/errors.js';
import { toAbsolutePath } from '../core/utils.js';

export async function runReadCli(argv = process.argv.slice(2)) {
  let parsed;
  try {
    parsed = parseReadArgs(argv);
    if (parsed.help) {
      printReadHelp();
      return;
    }
    const result = await readPrototype(parsed.options);
    const written = await writeReadArtifacts(result, parsed.options);
    console.log(JSON.stringify(written, null, 2));
  } catch (error) {
    const wrapped = wrapError(error, 'CLI_FAILED');
    if (parsed?.options?.probeOut && wrapped.details?.debug) {
      const probePath = toAbsolutePath(parsed.options.probeOut);
      fs.mkdirSync(path.dirname(probePath), { recursive: true });
      fs.writeFileSync(probePath, JSON.stringify(wrapped.details.debug, null, 2), 'utf8');
    }
    console.error(`${wrapped.code}: ${wrapped.message}`);
    if (wrapped.details) {
      console.error(JSON.stringify(errorToJson(wrapped), null, 2));
    }
    process.exitCode = 1;
  }
}
