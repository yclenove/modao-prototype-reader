# Modao Prototype Reader

`Modao Prototype Reader` is a standalone local tool for reading public Modao share prototypes through Chrome + CDP.

It ships with:

- a Node CLI for export, summary, and scaffold generation
- a lightweight local web UI that calls the same core reader service
- reusable core modules for Chrome session management, runtime extraction, and output transformation

## Why this repo exists

This project was split out of an internal frontend demo repo so the Modao-reading capability can evolve independently from unrelated Vue business pages.

## Requirements

- Node.js `>= 20`
- Google Chrome, Chromium, or Microsoft Edge installed locally
- a public Modao share link under `/app/`

## Install

```bash
npm install
```

This repository currently uses only Node built-ins, so `npm install` is mainly for standard project setup and future extension.

## CLI usage

Read a prototype:

```bash
npm run read -- "https://modao.cc/app/your-share-link#screen=xxxx" --depth rich --only current --out tmp/modao-current.json
```

Common options:

- `--depth <basic|rich|full>`
- `--only <current|screen|module|all>`
- `--screen <cid>`
- `--screen-name <keyword>`
- `--password <value>`
- `--summary-out <file>`
- `--scaffold-out <file>`
- `--chrome-user-data-dir <path>`
- `--chrome-profile-directory <name>`

Quick shortcuts:

```bash
npm run read:rich -- "https://modao.cc/app/your-share-link#screen=xxxx"
npm run read:full -- "https://modao.cc/app/your-share-link#screen=xxxx"
```

Generate a summary from an existing export:

```bash
npm run summarize -- examples/sample-export.json --format md
```

Generate a scaffold from an existing export:

```bash
npm run scaffold -- examples/sample-export.json
```

## Web UI

Start the local server:

```bash
npm run serve
```

Then open:

[`http://127.0.0.1:3210`](http://127.0.0.1:3210)

The web UI:

- collects read parameters
- calls the local Node service
- previews the export JSON
- downloads `export.json`, `summary.json`, `summary.md`, and `scaffold.json`

## Output structure

The export can include:

- `project`
- `screenTree`
- `screens`
- `states`
- `widgets`
- `interactions`
- `assets`
- `comments`
- `visibility`
- `diagnostics`
- `scope`

## Project structure

```text
.
├── bin
├── examples
├── src
│   ├── cli
│   ├── core
│   ├── server
│   └── web
├── LICENSE
├── README.md
└── package.json
```

## Validation

Executed during implementation:

- `node --test "src/**/*.test.js"`: passed
- `node ./bin/modao-serve.js`: started successfully and served the local web UI
- real public Modao read against the historical sample URL from the original repo: failed with `PROTOTYPE_TIMEOUT`

The last point means the tool core is wired correctly, but real-world extraction still depends on whether the target Modao share page exposes the expected runtime state in current Chrome/Modao conditions.

## Known limitations

- This is a local tool, not a hosted crawler
- reading depends on Modao runtime internals that may change without notice
- password-protected links may still require local browser state depending on share settings
- large `full` exports can be very heavy and should not be committed casually

## License

MIT
