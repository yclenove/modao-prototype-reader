# Output Conventions

## Read artifacts

Recommended output paths:

- `tmp/*.json` for local experiments
- `tmp/generated/vue3/` for generated Vue 3 files
- avoid committing large raw `full` exports unless explicitly needed

## Naming

- prefer one page per output directory
- use PascalCase for generated Vue component names
- use kebab-case for route-like names

## Validation

After generation:

- inspect `manifest.json`
- inspect the generated `.vue` file first
- if needed, rerun generation with a narrower scaffold input

## Debugging

When reading fails, generate:

```bash
npm run read -- "https://modao.cc/app/your-share-link#screen=xxxx" --depth rich --debug --probe-out tmp/probe.json --out tmp/export.json
```

Use `probe.json` before attempting downstream generation.
