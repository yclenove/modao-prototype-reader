import { runVue3CodegenPipeline } from '../pipelines/vue3-codegen.js';

function parseArgs(argv) {
  const result = {
    input: '',
    outDir: 'tmp/generated/vue3',
    componentName: '',
    routeName: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--') && !result.input) {
      result.input = arg;
      continue;
    }
    if (arg === '--out-dir') {
      result.outDir = argv[i + 1] ?? result.outDir;
      i += 1;
      continue;
    }
    if (arg === '--component-name') {
      result.componentName = argv[i + 1] ?? '';
      i += 1;
      continue;
    }
    if (arg === '--route-name') {
      result.routeName = argv[i + 1] ?? '';
      i += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      return { help: true, options: result };
    }
  }

  if (!result.input) {
    throw new Error(
      'Usage: modao-vue3-scaffold <scaffold-or-export.json> [--out-dir dir] [--component-name Name] [--route-name route-name]',
    );
  }

  return { help: false, options: result };
}

function printHelp() {
  console.log(`Usage:
  modao-vue3-scaffold <scaffold-or-export.json> [options]

Options:
  --out-dir <dir>            Output directory, defaults to tmp/generated/vue3
  --component-name <name>    Override generated Vue component name
  --route-name <name>        Override generated route name
`);
}

export function runVue3ScaffoldCli(argv = process.argv.slice(2)) {
  const parsed = parseArgs(argv);
  if (parsed.help) {
    printHelp();
    return;
  }
  const result = runVue3CodegenPipeline(parsed.options);
  console.log(JSON.stringify(result, null, 2));
}
