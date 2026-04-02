# AI Workflow for Modao Reader

[中文](#中文说明) | [English](#english)

## 中文说明

这份文档说明如何把 `Modao Prototype Reader` 和 AI 编码助手配合起来使用，让流程从“读取墨刀”走到“生成页面代码”。

## 推荐总流程

1. 先用本工具读取墨刀页面，导出 `export.json`
2. 同时生成 `summary.json` 和 `scaffold.json`
3. 先把 `summary + scaffold` 提供给 AI，让 AI 输出页面结构方案
4. 再把局部 `export.json` 提供给 AI，让 AI 补全布局、字段和交互细节
5. 把 AI 输出落实到真实代码工程，再做人工校验和微调

## 如果要让 AI 自己执行命令

如果你不是只想把 JSON 喂给 AI，而是想让 AI agent 自己安装依赖、自己启动项目、自己执行读取命令、自己按阶段开发，建议这样做：

1. 先让 AI 阅读仓库根目录的 `AGENTS.md`
2. 再让 AI 阅读本文件，理解 `summary/scaffold/export` 的分工
3. 明确告诉 AI 目标技术栈、目标代码仓库和本次只开发哪一页或哪一个模块

推荐顺序：

- 第一步：`npm install`
- 第二步：`npm test`
- 第三步：按需执行 `npm run read` 或 `npm run serve`
- 第四步：先生成 `summary/scaffold`
- 第五步：如需代码骨架，可执行 `npm run vue3:scaffold`
- 第六步：先输出结构方案，再生成骨架代码，再补细节
- 第六步：修改后重新跑验证命令

如果你希望 AI 完全按阶段推进，不要只给一句“根据墨刀生成代码”，而是要给它明确阶段目标，例如：

- 阶段 1：只读原型并生成导出文件
- 阶段 2：只输出结构设计，不写最终实现
- 阶段 3：只生成页面骨架和组件边界
- 阶段 4：只补当前页面的细节和交互
- 阶段 5：运行测试并汇报风险

## 为什么不要一开始就把全量 JSON 全丢给 AI

全量导出通常太大，而且混合了很多对首轮编码不重要的信息。更稳的方式是：

- 第一轮给 `summary.json`
  适合让 AI 理解页面目标、页面层次、主要区域和核心文案
- 第二轮给 `scaffold.json`
  适合让 AI 先搭组件骨架、区域拆分和基本布局
- 第三轮再给当前页面的 `export.json`
  适合让 AI 补表单、表格、按钮、交互目标和样式细节

## 先生成哪些文件

推荐优先执行：

```bash
npm run read -- "https://modao.cc/app/your-share-link#screen=xxxx" --depth rich --only current --out tmp/current.json --summary-out tmp/current-summary.json --scaffold-out tmp/current-scaffold.json
```

如果页面很多，先缩小范围：

```bash
npm run read -- "https://modao.cc/app/your-share-link" --depth rich --screen-name 用户管理 --only module --out tmp/user-module.json --split-screens
```

适合缩小上下文的参数：

- `--only current`
- `--only screen`
- `--only module`
- `--screen <cid>`
- `--screen-name <keyword>`
- `--split-screens`

## 文件分别怎么喂给 AI

### 1. `summary.json`

适合做：

- 页面职责总结
- 业务意图提炼
- 路由和页面命名建议
- 组件拆分初稿
- 状态流和接口占位建议

### 2. `scaffold.json`

适合做：

- 页面骨架代码
- 区域布局代码
- 容器组件和展示组件拆分
- 表单区、表格区、弹窗区的初始结构
- Vue 3 页面骨架生成的直接输入

### 3. `export.json`

适合做：

- 细化具体文本、按钮、字段和交互
- 补控件属性、表格列、页面状态
- 做样式还原和边界情况补全

## 推荐 AI 使用顺序

### 阶段 1：规划

先给 AI：

- `summary.json`
- `scaffold.json`
- 你的目标技术栈说明，例如 `Vue 3 + TypeScript + Element Plus`

让 AI 输出：

- 页面结构
- 组件拆分
- 状态管理建议
- 接口占位设计

推荐提示词：

```text
我会给你一个由墨刀原型导出的 summary.json 和 scaffold.json。
请先不要直接写完整实现，而是先输出：
1. 页面职责总结
2. 推荐的组件拆分
3. 页面状态与数据流
4. 需要的接口占位
5. 适合的目录结构

技术栈：Vue 3 + TypeScript。
要求：优先高内聚、低耦合，页面组件只做组装，复杂规则抽到模块。
```

### 阶段 2：生成骨架代码

再给 AI：

- 阶段 1 的结构方案
- `scaffold.json`

让 AI 输出：

- 页面主组件
- 子组件骨架
- 基础 props / emits
- 初始 mock 数据接口

推荐提示词：

```text
基于这个 scaffold.json 和已经确定的页面结构，请生成页面骨架代码。
先实现布局和组件边界，不要过早写死复杂业务逻辑。
如果需要表单区、表格区、弹窗区，请优先拆为独立子组件。
```

如果你希望 AI 直接利用本仓库已经内置的生成器，可以先让它执行：

```bash
npm run vue3:scaffold -- tmp/current-scaffold.json --out-dir tmp/generated/vue3
```

然后再让 AI 基于生成结果和 `export.json` 做二次细化。

### 阶段 3：补细节

最后再给 AI：

- 当前页面对应的 `export.json`
- 已经生成的代码

让 AI 输出：

- 补文本内容
- 补字段和表格列
- 补交互跳转和状态切换
- 补样式细节

推荐提示词：

```text
下面是当前页面对应的 export.json，以及我已经生成的 Vue 页面代码。
请在不推翻现有组件边界的前提下：
1. 补全页面上的文本、控件和表格列
2. 推导合理的交互事件和状态字段
3. 只补当前页面需要的实现
4. 如果 JSON 中信息不完整，请明确标注为待确认
```

## 如何映射到真实代码工程

推荐映射方式：

- `summary.json` -> 页面说明、模块职责、接口定义草案
- `scaffold.json` -> 页面骨架、组件树、布局区块
- `export.json` -> 控件明细、表格列、字段、交互、文案

如果你要让 AI 直接往真实仓库里写代码，建议同时给它：

- 技术栈约束
- 代码规范
- 现有目录结构
- 类似页面参考实现

## 常见误区

- 不要一开始就把整份 `full` 导出给 AI
- 不要让 AI 在完全没有技术栈约束时直接生成最终代码
- 不要让 AI 一次生成整个模块的所有页面
- 不要把墨刀导出结果当成百分百准确的数据源，仍然需要人工校验
- 不要让 AI 在没有阅读 `AGENTS.md` 的情况下自己随意决定执行顺序
- 不要让 AI 在读取失败后直接跳过 probe 和诊断信息

## 建议的闭环

```text
Modao share link
-> reader export/summary/scaffold
-> AI produces structure
-> AI produces skeleton code
-> AI fills details with per-screen export
-> human review and refine
```

## English

This document explains how to combine `Modao Prototype Reader` with an AI coding assistant so the workflow can move from “read a Modao prototype” to “generate real page code”.

## Recommended flow

1. Use this tool to export `export.json`
2. Generate `summary.json` and `scaffold.json` at the same time
3. Feed `summary + scaffold` to the AI first so it can propose page structure
4. Feed a scoped `export.json` next so the AI can fill layout, fields, and interactions
5. Apply the output to the real codebase and refine manually

## If you want the AI to run commands by itself

If you want an AI agent to install dependencies, start the project, run the reader, and develop in stages on its own, use this sequence:

1. Have the AI read `AGENTS.md` first
2. Then have it read this file for export usage strategy
3. Tell it the target stack, target codebase, and exact page or module scope

Recommended order:

- `npm install`
- `npm test`
- `npm run read` or `npm run serve`
- generate `summary/scaffold`
- run `npm run vue3:scaffold` when a Vue 3 skeleton is needed
- propose structure before writing final code
- generate skeleton code before detailed refinement
- rerun validation after changes

## Why not feed the full JSON first

The full export is usually too large and mixes details that are not useful in the first pass. A better sequence is:

- `summary.json` for page intent and high-level meaning
- `scaffold.json` for layout and component skeleton
- scoped `export.json` for detailed widgets, text, and interactions

## Recommended export command

```bash
npm run read -- "https://modao.cc/app/your-share-link#screen=xxxx" --depth rich --only current --out tmp/current.json --summary-out tmp/current-summary.json --scaffold-out tmp/current-scaffold.json
```

To reduce context size:

```bash
npm run read -- "https://modao.cc/app/your-share-link" --depth rich --screen-name Users --only module --out tmp/user-module.json --split-screens
```

Useful scoping flags:

- `--only current`
- `--only screen`
- `--only module`
- `--screen <cid>`
- `--screen-name <keyword>`
- `--split-screens`

## What each file is best for

### `summary.json`

Best for:

- page responsibility summary
- business intent interpretation
- route and page naming suggestions
- first-pass component split
- state and API planning

### `scaffold.json`

Best for:

- page skeleton code
- regional layout
- container/presentation split
- first-pass form/table/dialog structure

### `export.json`

Best for:

- detailed text, fields, buttons, and interactions
- table columns and widget-specific data
- visual and interaction refinement

## Recommended AI sequence

### Phase 1: planning

Give the AI:

- `summary.json`
- `scaffold.json`
- your target stack, such as `Vue 3 + TypeScript + Element Plus`

Ask it to produce:

- page structure
- component split
- state flow
- API placeholders

### Phase 2: skeleton code

Then provide:

- the approved structure
- `scaffold.json`

Ask it to produce:

- main page component
- child component skeletons
- basic props / emits
- mock data placeholders

### Phase 3: detail fill

Finally provide:

- scoped `export.json`
- the generated code so far

Ask it to:

- fill text and fields
- derive interactions and state changes
- refine the current page only
- explicitly mark anything uncertain

## Mapping to a real codebase

Recommended mapping:

- `summary.json` -> page responsibility and API draft
- `scaffold.json` -> page skeleton and component tree
- `export.json` -> concrete controls, fields, copy, and interactions

## Common mistakes

- feeding the full `full` export too early
- asking the AI to generate final code without stack constraints
- generating an entire module in one shot
- treating the Modao export as perfectly accurate without review
- letting the AI improvise the execution order without reading `AGENTS.md`
- ignoring `probe.json` and diagnostics when the read step fails
