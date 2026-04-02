# Code Generation Overview

The project now includes a first-pass Vue 3 code generation path.

## Current scope

- input: `scaffold.json` or `export.json`
- internal conversion: scaffold -> page model
- output: Vue 3 SFC skeleton, types file, mock file, API placeholder, manifest

## Command

```bash
npm run vue3:scaffold -- examples/sample-export.json --out-dir tmp/generated/vue3
```

## Design goal

The generator does not try to produce final business-ready code in one step.

It is intentionally optimized for:

- stable page shell generation
- clear component names
- obvious placeholders for future AI or manual refinement
- compatibility with the `summary/scaffold/export` workflow already documented
