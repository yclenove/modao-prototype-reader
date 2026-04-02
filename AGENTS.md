# AGENTS.md

## Purpose

This repository is a local tool for reading Modao share prototypes and turning them into structured artifacts for human or AI-assisted implementation.

It is not a business frontend application. Its primary outputs are:

- `export.json`
- `summary.json`
- `scaffold.json`
- optional `probe.json`

If you are an AI agent working in this repository, use this file as the execution manual.

## Read This First

Before doing substantial work, read:

1. `README.md`
2. `docs/ai-workflow.md`
3. this `AGENTS.md`

Use `README.md` for project entry, `docs/ai-workflow.md` for artifact usage, and this file for execution order and guardrails.

## Setup Commands

Run these first when needed:

```bash
npm install
npm test
```

Start the local web UI only if needed:

```bash
npm run serve
```

## Reader Commands

Read one page:

```bash
npm run read -- "https://modao.cc/app/your-share-link#screen=xxxx" --depth rich --only current --out tmp/current.json --summary-out tmp/current-summary.json --scaffold-out tmp/current-scaffold.json
```

Read a module by keyword:

```bash
npm run read -- "https://modao.cc/app/your-share-link" --depth rich --screen-name Users --only module --out tmp/users-module.json --split-screens
```

Read with diagnostics:

```bash
npm run read -- "https://modao.cc/app/your-share-link#screen=xxxx" --depth rich --debug --probe-out tmp/probe.json --out tmp/export.json
```

## Recommended AI Working Sequence

### Phase 1: generate artifacts

Your first goal is not to write code. Your first goal is to generate or inspect:

- `summary.json`
- `scaffold.json`
- scoped `export.json`

Prefer `rich` depth and a narrow scope first.

### Phase 2: propose structure

Before writing final code, produce:

- page responsibility summary
- component split
- state/data flow
- API placeholders

Prefer `summary.json` and `scaffold.json` here.

### Phase 3: generate skeleton code

Once the structure is accepted, generate:

- page shell
- child component boundaries
- props / emits
- placeholder mock data or interfaces

Prefer `scaffold.json` here.

### Phase 4: refine with scoped export

Only after the skeleton is in place, use the scoped `export.json` to refine:

- text
- fields
- table columns
- interactions
- style details

Do not jump directly to full-module generation unless explicitly requested.

### Phase 5: verify and report

After changes, run the relevant checks and report:

- what changed
- what was verified
- what remains uncertain

## Constraints

- Prefer `rich` depth before `full`
- Prefer `--only current` or `--only screen` before `--only module`
- If output is too large, use `--split-screens`
- Do not process an entire module in one pass unless explicitly requested
- Do not assume the Modao export is perfectly accurate
- If technical stack or target repository is unclear, stop and ask
- If the export lacks enough detail, mark uncertain parts explicitly

## Validation Checklist

For changes in this repository, usually run:

```bash
npm test
```

For read debugging, inspect:

- CLI error output
- `probe.json`
- diagnostics in the Web UI

Interpret probe stages like this:

- `runtime_missing`: page runtime not exposed yet
- `project_loading`: MB exists but project metadata is still unavailable
- `store_unavailable`: project store not ready
- `screens_unavailable`: screen list missing
- `state_containers_unavailable`: runtime state containers missing
- `ready`: extraction can continue

## Stop And Ask Rules

Stop and ask the user when:

- the target codebase or stack is not specified
- the desired page or module scope is unclear
- a real Modao link fails and diagnostics are still inconclusive
- the requested implementation would require broad refactors across unrelated areas
- the generated output is too large to handle safely in one pass

## Recommended Output Discipline

When working in phases, keep outputs separate:

- planning output
- skeleton code output
- detail refinement output
- validation output

Do not merge all concerns into a single giant generation step.

## Practical Rule

Use this loop:

1. scope down
2. export artifacts
3. plan with `summary/scaffold`
4. build with scoped `export`
5. verify
6. report risks
