# Vue 3 Codegen

## Goal

Generate a Vue 3 page skeleton from `scaffold.json` or `export.json`.

## Command

```bash
npm run vue3:scaffold -- examples/sample-export.json --out-dir tmp/generated/vue3
```

## Generated layout

Under the chosen `--out-dir`:

- `pages/<Name>Page.vue` — page shell, imports mock/api and wires child components (`v-model`, `:rows`, `@search`, etc.)
- `components/<Name>Page*Section.vue` — one file per scaffold region (header, filters, table, dialog, media) with typed props/emits
- `types/<route>.types.ts` — shared interfaces for filters, rows, dialog form, API, page state
- `mock/<route>.mock.ts` — filter defaults and mock state/rows
- `api/<route>.api.ts` — placeholder list/detail/save functions
- `router/<route>.route.ts` — route record stub
- `manifest.json` — file list for tooling

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
