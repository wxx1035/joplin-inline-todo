# Joplin Inline TODO 项目解读（思路 / 在做什么 / 运行流程）

> 面向读者：想快速看懂这个插件整体设计、核心数据流、以及关键模块关系的开发者。

## 1. 这个项目在做什么？

`joplin-inline-todo` 是一个 **Joplin 插件**，目标是把分散在各笔记里的 TODO（行内任务）统一抽取出来，汇总到一个“汇总笔记”中，并支持两种使用方式：

1. **传统 Markdown 汇总视图**：插件按规则扫描所有笔记，自动生成汇总内容（Plain / Table / Diary）。
2. **自定义可视化编辑器**：在汇总笔记中用 React UI 展示任务，支持筛选、保存筛选条件、点击跳转源笔记、勾选完成等。

核心场景是：
- 平时继续在任意笔记里写 TODO（不打断你的笔记流）；
- 需要集中管理时打开汇总笔记，一次性查看与处理。

---

## 2. 整体思路（架构思想）

项目是典型的“**扫描器 + 规则解析 + 多格式输出 + UI 交互层**”架构：

- **扫描器（SummaryBuilder）**负责从 Joplin 数据层批量拉取笔记并解析 TODO；
- **规则层（settings_tables）**定义“TODO 长什么样（regex）”和“汇总怎么渲染（formatter）”；
- **汇总写回层（summary / summary_note）**把扫描结果注入“特殊标记注释”所在笔记；
- **交互层（editor + panel + gui）**在 custom editor 模式下提供 GUI 与过滤能力；
- **回写层（mark_todo）**支持从汇总反向修改源笔记里的完成状态。

换句话说：

> 输入：散落在任意笔记中的 TODO 文本行。  
> 处理：匹配规则、结构化、过滤、排序、格式化。  
> 输出：汇总笔记（Markdown 或 GUI），并可回写源任务状态。

---

## 3. 核心概念与数据模型

项目围绕 `Todo` 结构组织：

- 任务来源：`note` / `note_title` / `parent_id` / `parent_title`
- 内容属性：`msg` / `category` / `date` / `tags` / `description`
- 状态属性：`completed`
- 定位属性：`scrollTo`（用于跳转源笔记时定位）

扫描后，数据先形成 `SummaryMap`（`noteId -> Todo[]`），再组合成 `Summary`（带 `lastRefresh` 元信息）。

过滤系统用 `Filters` 描述：
- `saved`：已保存筛选方案
- `active`：当前筛选条件
- `checked`：在 GUI 中勾选完成过的 TODO 记录

这让插件同时支持：
- 面向“全局汇总”的批处理生成；
- 面向“个性视角”的本地筛选看板。

---

## 4. 启动流程（插件入口生命周期）

插件入口在 `src/index.ts`，启动时会按如下顺序工作：

1. 注册设置项（TODO 解析风格、汇总风格、自动刷新、是否启用自定义编辑器等）。
2. 创建 `SummaryBuilder` 实例并注册 custom editor。
3. 注册命令：
   - 创建汇总笔记
   - 在汇总里“Toggle TODO”
   - 手动“Refresh Summary Note”
4. 注册菜单、上下文菜单、工具栏按钮。
5. 监听设置变化，动态刷新 builder 设置。
6. 监听笔记切换：当选中的是汇总笔记时自动重扫并更新。
7. 按设置决定是否注册 Markdown-It 渲染增强脚本（用于 metalist 风格视觉样式）。

这部分体现了插件的“事件驱动”设计：主要由命令触发和 workspace 事件触发，不是常驻循环任务。

---

## 5. 扫描与解析流程（SummaryBuilder）

`SummaryBuilder` 是核心扫描引擎：

### 5.1 全量扫描

`search_in_all()`：
- 清空旧缓存 `_summary`；
- 用当前 TODO 规则的 `query` 搜索“可能包含 todo 的笔记”；
- 如果开启“显示已完成项”，额外跑一次 `completed_query`；
- 扫描结束后标记 `_initialized` 并更新时间 `_lastRefresh`。

### 5.2 分页与限速

`search_with_query(query)` 使用分页调用 Joplin 搜索接口，并按设置值做节流：
- 每处理 `scan_period_c` 页暂停 `scan_period_s` 秒；
- 目的是避免大量笔记时卡住 Joplin。

### 5.3 单笔记解析

`search_in_note(note)` 会：
- 跳过冲突笔记；
- 用当前 `todo_type.regex` 扫 note body；
- 通过规则函数提取 `msg/category/date/tags/completed/description/scrollTo`；
- 将结果放入 `_summary[note.id]`。

注意点：
- 解析前会重置正则 `lastIndex`，避免跨次执行状态污染。
- folder 名称有缓存 `_folders`，降低重复 API 调用。

---

## 6. TODO 规则系统（三种输入语法）

项目把 TODO 识别规则集中在 `settings_tables.ts`：

1. **Metalist Style（list）**
   - 形式：`- [ ] @category //date +tags 任务内容`
   - 功能最强：可分类、日期、标签、多标签。
2. **Link Style（link）**
   - 形式：`[TODO](2025-01-01) 任务内容`
3. **List Style（plain）**
   - 形式：普通 markdown checkbox
   - 语义最轻，适合已有 checklist 用户。

每种规则都提供：
- `regex/query/completed_query`
- 字段提取函数
- 完成状态切换标记 `toggle.open/closed`
- 跳转定位信息生成函数 `scrollToText`

这让插件实现“同一套扫描框架 + 可替换规则定义”。

---

## 7. 汇总笔记机制（特殊注释驱动）

汇总笔记靠注释 `<!-- inline-todo-plugin -->` 识别。

### 7.1 创建汇总笔记

`createSummaryNote()` 会在当前文件夹建一条名为 `Todo Summary` 的笔记，并写入特殊注释。

### 7.2 更新汇总

`update_summary(summary, settings, summary_id, old_body)`：
1. 根据 `summary_type` 选 formatter 生成正文；
2. 根据汇总注释参数做 notebook 过滤；
3. 用 `insertNewSummary` 把新正文注入旧 body；
4. 仅在内容变化时写回，必要时触发同步。

### 7.3 注释里的过滤参数

你可以写成：

```md
<!-- inline-todo-plugin Work "Special Project" -->
```

插件会只汇总指定 notebook；含空格名支持引号解析。

---

## 8. 输出格式流程（Summary Formatter）

目前支持三种汇总风格：
- `plain`（按类别/笔记分段）
- `table`（表格化，方便二次排序）
- `diary`（按笔记组织）

格式器模块位于 `src/summaryFormatters/`，设计是可扩展的：
- 新增 formatter 文件；
- 在 `settings_tables.ts` 注册 title + func + format 即可接入。

其中 `format` 还有一个关键用途：
- 当你在汇总中用“Toggle TODO”时，插件会把当前行反向映射回 `Todo` 对象，靠的就是 `formatTodo` 一致性匹配。

---

## 9. 从汇总反向修改源任务（mark_todo）

插件支持两条路径：

1. **Markdown 汇总里切换状态（命令）**
   - 读取当前光标行；
   - 在 summary 数据里找对应 todo；
   - 打开源笔记，定位并替换 open/closed 标记；
   - 重新扫描并刷新汇总。

2. **GUI 卡片勾选状态（custom editor）**
   - 用 `scrollTo.text` 构造 old/new checkbox 文本；
   - 直接替换源笔记 body 中对应文本；
   - 回推 `updateSummary` 消息给前端刷新列表。

这部分是插件“可操作”而不只是“只读报表”的关键。

---

## 10. 自定义编辑器（React GUI）流程

### 10.1 激活条件

`registerEditor()` 中 `onActivationCheck` 会检查：
- 当前笔记是否包含汇总注释；
- 设置里是否开启 `enableCustomEditor`。

满足条件就启用 webview 编辑器。

### 10.2 前后端通信（IPC）

通过 `postMessage` 交互，核心消息包括：
- `getSettings`
- `getSummary`
- `markDone`
- `jumpTo`
- `getFilters` / `setFilters`

前端 `usePluginData` 初次加载时拉取 summary + settings，后续监听 `updateSummary` 增量刷新。

### 10.3 过滤与保存筛选

`useFilters` + `gui/lib/filters.ts` 完成：
- 当前筛选变更
- 保存/切换/重命名筛选
- 日期范围（Today/This Week/End of Month/...）
- 完成项显示策略（Today/All Time/None）

并把 filter 状态写入 note userData（和具体汇总笔记绑定）。

---

## 11. 一条完整业务链路（端到端）

以“打开汇总笔记自动刷新”为例：

1. 用户选中某笔记。
2. `onNoteSelectionChange` 判断它是 summary note。
3. `builder.search_in_all()` 全量扫描并结构化 todo。
4. `update_summary(...)` 生成新汇总 markdown。
5. `setSummaryBody(...)` 写回笔记并可选触发同步。
6. 若启用 custom editor，GUI 里可进一步按筛选条件查看并操作。

再以“在 GUI 勾选完成”为例：

1. TodoCard 触发 `markDone` IPC。
2. 插件端 `mark_done_scrollto(todo)` 修改源笔记 checkbox。
3. 重新扫描 summary。
4. `editors.postMessage(updateSummary)` 推送前端。
5. React 列表实时更新。

---

## 12. 工程结构速览

- `src/index.ts`：插件入口、设置、命令、事件注册
- `src/builder.ts`：扫描引擎（搜索、解析、缓存）
- `src/settings_tables.ts`：TODO 规则 + 汇总格式注册表
- `src/summary.ts`：汇总生成与写回
- `src/summary_note.ts`：汇总注释解析、笔记识别与过滤
- `src/mark_todo.ts`：从汇总回写源 TODO 状态
- `src/editor.ts`：custom editor 注册与 IPC
- `src/panel.tsx` + `src/gui/*`：React 前端与筛选系统

---

## 13. 这个项目的“产品取向”总结

这个插件的定位非常明确：

- **不是** 重新发明一个任务系统；
- **而是** 把“你本来就写在笔记里的 TODO”抽出来集中管理；
- 在“尽量不改变原工作流”的前提下，加上汇总、过滤和可视化交互。

所以它的成功点不在复杂数据库模型，而在：
- 对 Markdown TODO 语法的兼容与提取；
- 与 Joplin API 的事件化整合；
- 汇总与源笔记之间的双向可追溯/可回写。

---

## 14. 给二次开发者的扩展建议

1. **加新 TODO 语法**：在 `settings_tables.ts` 新增 regex entry 即可接入扫描主链路。  
2. **加新汇总格式**：在 `summaryFormatters/` 新增 formatter，并注册到 `summaries`。  
3. **加筛选维度**：扩展 `Filter` 类型 + `calcFiltered` 流程 + Sidebar UI。  
4. **加自动化能力**：可在扫描后挂钩通知、标签同步、日历导出等。  

如果你要把它改造成团队任务中枢，建议先抽象三层：
- 解析层（Parser）
- 索引层（Task Index）
- 展示层（Markdown/UI 多实现）

这样会更容易演进。
