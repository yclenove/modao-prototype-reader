# Modao Prototype Reader

[中文](#中文说明) | [English](#english)

## 中文说明

`Modao Prototype Reader` 是一个独立的本地工具，用来通过本机 Chrome + CDP 读取公开的墨刀分享原型。

它包含：

- 一个 Node CLI，用于导出原型、生成摘要、生成页面骨架
- 一个 Vue 3 页面骨架生成 CLI
- 一个轻量本地 Web 界面，复用同一套核心读取服务
- 一套可复用的核心模块，负责 Chrome 会话管理、运行时提取和输出转换

### 为什么单独拆仓

这个项目从原来的前端演示仓库中拆分出来，是为了让“读取墨刀原型”这项能力独立演进，不再和业务页面代码耦合在一起。

### 运行要求

- Node.js `>= 20`
- 本机安装了 Google Chrome、Chromium 或 Microsoft Edge
- 墨刀公开分享链接：`/app/...` 或 `/proto/<id>/sharing?...`（设备预览等分享形态）

### 安装

```bash
npm install
```

当前仓库主要使用 Node 内置能力，`npm install` 主要用于标准化项目安装流程和后续扩展。

### CLI 用法

读取一个原型：

```bash
npm run read -- "https://modao.cc/app/your-share-link#screen=xxxx" --depth rich --only current --out tmp/modao-current.json
```

常用参数：

- `--depth <basic|rich|full>`
- `--only <current|screen|module|all>`
- `--screen <cid>`
- `--screen-name <keyword>`
- `--password <value>`
- `--summary-out <file>`
- `--scaffold-out <file>`
- `--chrome-user-data-dir <path>`
- `--chrome-profile-directory <name>`

快捷脚本：

```bash
npm run read:rich -- "https://modao.cc/app/your-share-link#screen=xxxx"
npm run read:full -- "https://modao.cc/app/your-share-link#screen=xxxx"
```

基于已有导出生成摘要：

```bash
npm run summarize -- examples/sample-export.json --format md
```

基于已有导出生成页面骨架：

```bash
npm run scaffold -- examples/sample-export.json
```

生成 Vue 3 页面骨架：

```bash
npm run vue3:scaffold -- examples/sample-export.json --out-dir tmp/generated/vue3
```

### Web UI

启动本地服务：

```bash
npm run serve
```

然后打开：

[`http://127.0.0.1:3210`](http://127.0.0.1:3210)

Web 界面支持：

- 填写读取参数
- 调用本地 Node 服务执行读取
- 预览导出 JSON 与 scaffold
- 触发 Vue 3 骨架生成
- 下载 `export.json`、`summary.json`、`summary.md`、`scaffold.json`

### 调试与诊断

如果真实链接读取失败，建议开启调试：

```bash
npm run read -- "https://modao.cc/app/your-share-link#screen=xxxx" --depth rich --debug --probe-out tmp/probe.json --out tmp/export.json
```

这会额外输出运行时 probe、等待阶段和失败详情，便于判断是：

- Chrome 或调试端口问题
- 墨刀运行时对象未暴露
- 页面元信息未就绪
- 页面列表或运行时状态容器未就绪

Web UI 也支持开启调试诊断，并在页面中直接展示 probe 结果和错误细节。

### AI 协作

如果你想配合 AI 用这个工具读取墨刀后生成代码，推荐流程是：

1. 先导出当前页面或模块范围的 `summary.json` 和 `scaffold.json`
2. 先让 AI 基于 `summary + scaffold` 输出页面结构和组件拆分
3. 再把 scoped `export.json` 给 AI，补字段、交互和样式细节

详细说明见：

- [`docs/ai-workflow.md`](docs/ai-workflow.md)
- [`AGENTS.md`](AGENTS.md)
- [`docs/codegen-overview.md`](docs/codegen-overview.md)

如果你希望 AI agent 自己安装依赖、自己启动项目、自己执行读取命令并按阶段开发，请优先让它阅读 `AGENTS.md`。这份文档面向 AI 执行器，不是普通项目介绍。

### 导出结构

导出结果中可能包含：

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

### 项目结构

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

### 更新日志

- **2026-04-02**：Vue 3 骨架生成拆分为 `pages/`、`components/` 与 `types/` / `mock/` / `api/` / `router/`，页面层显式绑定子组件的 props 与事件；`waitForPrototype` 在 dump 的扁平 runtime 列表为空时可用深度扫描到的 runtime 容器计数作为兜底，并就绪判定与 probe summary 的 effective 元信息字段对齐（兼容仅返回 `hasProjectMeta` / `hasRootProject` 的旧探针形态）。读取入口同时接受 `/proto/.../sharing` 分享链接，并从 `?screen=` 或 `#screen=` 解析目标画板 CID。
- **2026-04-02（续）**：`/proto/.../sharing` 设备分享页常无 `ProjectExchange` 与项目 meta，但已有 `MB + rootProject + currentScreen`；此类场景现作为 **`proto_sharing_ready`** 结束等待，并在抽取阶段对 Redux `container` 做与 dump 同款的深度 runtime 遍历，以尽可能带出组件树。

### 验证情况

实现过程中已执行：

- `node --test "src/**/*.test.js"`：通过
- `node ./bin/modao-serve.js`：可正常启动本地 Web UI
- 使用旧仓库中的历史公开链接做真实读取：返回 `PROTOTYPE_TIMEOUT`

最后一项说明当前工具的接线和流程是通的，但真实抓取仍依赖目标墨刀页面是否继续暴露当前实现所需的运行时对象。

### 已知限制

- 这是一个本地工具，不是托管式爬虫服务
- 读取逻辑依赖墨刀运行时内部对象，未来可能失效
- 带密码的分享链接在某些场景下仍可能依赖本地浏览器登录态
- `full` 模式产物可能很大，不建议随意提交进仓库

### 许可证

MIT

## English

`Modao Prototype Reader` is a standalone local tool for reading public Modao share prototypes through Chrome + CDP.

It ships with:

- a Node CLI for export, summary, and scaffold generation
- a Vue 3 page skeleton generation CLI
- a lightweight local web UI that calls the same core reader service
- reusable core modules for Chrome session management, runtime extraction, and output transformation

### Why this repo exists

This project was split out of an internal frontend demo repo so the Modao-reading capability can evolve independently from unrelated Vue business pages.

### Requirements

- Node.js `>= 20`
- Google Chrome, Chromium, or Microsoft Edge installed locally
- a public Modao share link: `/app/...` or `/proto/<id>/sharing?...`

### Install

```bash
npm install
```

This repository currently uses only Node built-ins, so `npm install` is mainly for standard project setup and future extension.

### CLI usage

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

Generate a Vue 3 page skeleton:

```bash
npm run vue3:scaffold -- examples/sample-export.json --out-dir tmp/generated/vue3
```

### Web UI

Start the local server:

```bash
npm run serve
```

Then open:

[`http://127.0.0.1:3210`](http://127.0.0.1:3210)

The web UI:

- collects read parameters
- calls the local Node service
- previews export JSON and scaffold data
- triggers Vue 3 skeleton generation
- downloads `export.json`, `summary.json`, `summary.md`, and `scaffold.json`

### Debugging and diagnostics

If a real share link fails to load, use debug mode:

```bash
npm run read -- "https://modao.cc/app/your-share-link#screen=xxxx" --depth rich --debug --probe-out tmp/probe.json --out tmp/export.json
```

This writes extra probe snapshots and failure details so you can distinguish:

- Chrome or remote debugging issues
- missing Modao runtime objects
- project metadata not being ready
- screen or runtime state containers not being ready

The Web UI also supports a debug toggle and can display probe results directly.

### AI-assisted coding

If you want to pair this tool with an AI coding assistant, the recommended flow is:

1. Export scoped `summary.json` and `scaffold.json`
2. Ask the AI to derive page structure and component boundaries first
3. Feed scoped `export.json` later to refine fields, interactions, and visual details

See:

- [`docs/ai-workflow.md`](docs/ai-workflow.md)
- [`AGENTS.md`](AGENTS.md)
- [`docs/codegen-overview.md`](docs/codegen-overview.md)

If you want an AI agent to install dependencies, start the project, run read commands, and develop in phases by itself, have it read `AGENTS.md` first. That file is written as an execution manual for agents rather than a general project introduction.

### Changelog

- **2026-04-02**: Vue 3 codegen emits split `pages/`, `components/`, and shared `types/`, `mock/`, `api/`, `router/` files; the page wires props and events to children. `waitForPrototype` treats deep-scanned runtime containers as dump fallback when flat lists are empty, and the ready gate uses the same effective meta/root coalescing as probe summaries (so probes that only expose `hasProjectMeta` / `hasRootProject` still match). Read accepts `/proto/.../sharing` URLs and resolves target screen CID from `?screen=` or `#screen=`.
- **2026-04-02 (cont.)**: Proto device sharing pages often lack `ProjectExchange` and project meta while still exposing `MB`, `rootProject`, and a current screen CID. The waiter now exits as **`proto_sharing_ready`** and extraction deep-walks live Redux `container` for `dataMap`/`itemListMap` runtime buckets (same shape as dump), improving widget recovery. Extraction also fixes a `upperCid` reference bug in dump matching.

### Output structure

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

### Project structure

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

### Validation

Executed during implementation:

- `node --test "src/**/*.test.js"`: passed
- `node ./bin/modao-serve.js`: started successfully and served the local web UI
- real public Modao read against the historical sample URL from the original repo: failed with `PROTOTYPE_TIMEOUT`

The last point means the tool core is wired correctly, but real-world extraction still depends on whether the target Modao share page exposes the expected runtime state in current Chrome/Modao conditions.

### Known limitations

- This is a local tool, not a hosted crawler
- reading depends on Modao runtime internals that may change without notice
- password-protected links may still require local browser state depending on share settings
- large `full` exports can be very heavy and should not be committed casually

### License

MIT
