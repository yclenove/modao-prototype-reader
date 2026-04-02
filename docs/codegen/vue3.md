# Vue 3 Codegen

## Goal

Generate a Vue 3 page skeleton from `scaffold.json` or `export.json`.

## Command

```bash
npm run vue3:scaffold -- examples/sample-export.json --out-dir tmp/generated/vue3
```

## Generated files

- `<ComponentName>.vue`
- `<ComponentName>.types.ts`
- `<ComponentName>.mock.ts`
- `<ComponentName>.api.ts`
- `manifest.json`

## Recommended usage

1. Generate `summary.json` and `scaffold.json`
2. Generate the Vue 3 skeleton
3. Ask AI or a developer to refine the generated files with scoped `export.json`

## Output quality expectations

The current generator is meant to produce:

- page shell
- basic layout regions
- placeholder state typing
- mock and API files

It is not yet meant to infer complete design-system components or final production styling.
