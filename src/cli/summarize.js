import fs from 'node:fs';
import path from 'node:path';
import { buildSummary } from '../core/transform.js';
import { toAbsolutePath, toJson } from '../core/utils.js';

function parseArgs(argv) {
  const result = { input: '', out: '', format: 'json' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--') && !result.input) {
      result.input = arg;
      continue;
    }
    if (arg === '--out') {
      result.out = argv[i + 1] ?? '';
      i += 1;
      continue;
    }
    if (arg === '--format') {
      result.format = argv[i + 1] ?? 'json';
      i += 1;
    }
  }
  if (!result.input) {
    throw new Error('Usage: modao-summarize <export.json> [--out file] [--format json|md]');
  }
  return result;
}

export function runSummarizeCli(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const inputPath = toAbsolutePath(options.input);
  const output = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const summary = buildSummary(output);
  const content = options.format === 'md' ? summary.markdown : toJson(summary);

  if (options.out) {
    const outPath = toAbsolutePath(options.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, content, 'utf8');
  } else {
    console.log(content);
  }
}
