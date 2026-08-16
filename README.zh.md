# dsh-mcp-panel

**官方 DeepSeek Harness MCP client 的 MCP 管理控制台 —— 在设置页可视化增删改 MCP 服务器、试用工具调用，配以诚实的连接状态、健康诊断与安全可逆的 profile 写入。**

[English](README.md) · [简体中文](README.zh.md) · [Español](README.es.md) · [Português](README.pt.md) · [हिन्दी](README.hi.md)

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/dsh-mcp-panel)](https://www.npmjs.com/package/dsh-mcp-panel)
[![downloads](https://img.shields.io/npm/dm/dsh-mcp-panel)](https://www.npmjs.com/package/dsh-mcp-panel)
[![CI](https://github.com/PerryLink/dsh-mcp-panel/actions/workflows/ci.yml/badge.svg)](https://github.com/PerryLink/dsh-mcp-panel/actions/workflows/ci.yml)
[![dsh-plugin](https://img.shields.io/badge/ecosystem-dsh--plugin-8b5cf6)](https://github.com/topics/dsh-plugin)
[![deepseek-harness](https://img.shields.io/badge/runtime-deepseek--harness-4f46e5)](https://github.com/deepseek-ai/deepseek-harness)

## 架构：官方 client 负责桥接，本插件是完整体验层

[`@deepseek-ai/dsh-mcp-client`](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/mcp/mcp-client) 是**唯一的桥接层**：每个 MCP server 一个插件实例，以手写 `cordis.yml` 行的形式配置，负责连接传输、同步工具并注册 `mcp__<server>__<tool>` 工具名。本插件从不取代它 —— 而是构建其上的**体验层**：

```
                    ┌────────────────────────────────────────────┐
 profile            │  cordis.yml / cordis.patch.yml             │
 组合（每个         │   - id: mcp-github                          │
 server 一行，      │     name: '@deepseek-ai/dsh-mcp-client'     │
 手写）             │     config: { serverName, transport, … }    │
                    │   - id: mcp-panel                           │
                    │     name: dsh-mcp-panel   ◄── 本插件        │
                    └───────────────┬────────────────────────────┘
                                    │
        ┌───────────────────────────┴───────────────────────────┐
        │                                                        │
   ┌────▼──────────────┐        ┌───────────────────────────┐    │
   │ @deepseek-ai/dsh- │        │ dsh-mcp-panel（控制台）    │    │
   │ mcp-client        │        │                           │    │
   │ • 传输连接        │        │ • /mcp 命令               │    │
   │ • 工具同步        │        │ • 设置 → 插件 → MCP 页：  │    │
   │ • mcp__* 工具     │◄──────►│   CRUD、工具试用台        │    │
   │ • mcp/status seam │ 状态   │ • 健康诊断、探测、能力一览 │    │
   └───────────────────┘        └───────────────────────────┘    │
```

控制台通过官方 client 已落地的 `mcp/status` 可观测 seam（事件 + `mcpStatus` 查询服务）、工具注册表与 loader **读取**事实；**写入**只发生在 profile 的 patch 层 —— 只追加、走审批、自动备份。传输、OAuth 与协议完全不动。

## 控制台 vs. 手写 cordis.yml

| | 手写 cordis.yml | dsh-mcp-panel 控制台 |
|---|---|---|
| 添加服务器 | 改 YAML，注意缩进与引号 | 表单 → patch 片段 → **一键复制**或**写入**（审批 + 自动备份） |
| 修改服务器 | 改 YAML，重启/热重载 | 表单预填当前行；未改动的密钥在 host 侧保留原值 |
| 删除服务器 | 删掉该行 | 追加 `set disabled: true` 操作（patch 词汇表没有 remove）——可随时重新启用 |
| 查看状态 | 翻日志 | 徽章 + 重连次数 + 最近错误，来自 `mcp/status` seam 实时数据 |
| 试用工具 | 让模型调用 | 试用台 → 官方 `ctx.tools.execute()` 管线（权限与审批全程生效） |
| 排查故障 | grep 日志 | `/mcp <server> health` 派生自愈建议 |
| 误操作 | 手动回滚 | 每次写入只追加、留时间戳备份 |

控制台的输出就是 `cordis.patch.yml` 的词汇表 —— 你手写的那几行，由它生成、预览并安全落地。

## 功能一览

| 界面 | 功能 |
|---|---|
| **`/mcp` 命令** | 每 server 一行：transport、目标、工具数、连接状态（来自上游 seam；未观测时如实显示 `unknown`）、最近错误、重连计数——模型可读、会话日志可重建、五种输出语言 |
| **`/mcp <server> tools`** | 模型可见的 `mcp__*` 工具名与描述 |
| **`/mcp <server> health`** | 派生自愈建议（ENOENT → 依赖缺失、ECONNREFUSED、超时、401/403/404、DNS、限流、重连耗尽…）；退出码 / stderr 尾部如实标注"待官方支持" |
| **`/mcp <server> call <tool> [json]`** | 经**官方工具管线**试用调用——pre-execute 权限策略、审批（经命令所属 agent 路由）、guard、post-execute 全部生效 |
| **`/mcp <server> disable\|enable`** | 精确的 `set` patch 行（同旧版） |
| **设置 → 插件 → MCP 页** | 状态卡片（徽章、诊断、探测），加以下三块控制台 |
| **Server CRUD** | 增删改表单 → `insert`/`set`/`set disabled` 片段 → 剪贴板复制或审批写入，自动备份（`cordis.patch.yml.bak-<ts>`，保留最新 `backupCount` 份） |
| **工具试用台** | 选 server → 选 `mcp__*` 工具 → JSON 填参 → 规范 JSON 结果 + render 内容；按 `trialMaxResultChars` 截断；仅面板可见、永不进入模型上下文 |
| **能力一览** | Resources / Prompts 可用性（特征探测）；目前二者均如实标注"待官方支持"（官方 client 仅桥接工具） |
| **探测** | 一键 / 被动 Streamable HTTP 连通性探测（结果仅面板可见） |

## 快速开始

```sh
# git 渠道（由包的 prepare 脚本构建）
dsh plugin --profile web add github:PerryLink/dsh-mcp-panel#v0.4.0
# npm 渠道（已发布 tarball，无需构建审批）
dsh plugin --profile web add dsh-mcp-panel@0.4.0
```

随后重启（或让 web 面板热重载 `cordis.patch.yml`），打开 **设置 → 插件 → MCP**，或运行：

```text
/mcp
/mcp everything tools
/mcp everything health
/mcp everything call echo '{"message": "hi"}'
```

手动安装：把 `dsh-mcp-panel` 放进 profile 的 `node_modules`（或共享的 `$DSH_HOME/profiles/node_modules` 回退目录），并在 `cordis.patch.yml` 加一行：

```yaml
- insert:
    - id: mcp-panel
      name: dsh-mcp-panel
      config:
        probeEnabled: true
```

### 卸载

1. 从 `cordis.patch.yml` 移除 `mcp-panel` 行（web 面板热重载；其他面板重启生效）。
2. 从 profile 的 `node_modules`（或共享 `profiles/node_modules` 回退目录）删除本包。
3. 用 `dsh web --dump-config` 确认没有残留的 `mcp-panel` 行。

## 诚实契约

- **桥接层仍是桥接层。** 不改传输、OAuth、协议；每个 server 一行 mcp-client，与你手写完全一致。
- **不伪造状态。** 无上游观测时连接字段显示 `unknown` / `—`，并标注 `statusSource: 'derived'`；退出码与 stderr 尾部绝不臆造。
- **展示全程脱敏。** URL 查询凭据、userinfo 密码、header 值、Bearer token、JWT 在渲染前一律打码；配置的 `headers` 从不进入任何快照；env/header 的**值**绝不出 host（编辑器只见 key）。
- **写入只追加、走审批、先备份。** 控制台从不改写 `cordis.patch.yml`：只追加生成的操作。存在审批服务且调用方会话的 agent 处于开启轮次时，写入走 `ctx.approval`（仅 `allowed-once` 放行）；否则以界面显式确认为审批通道。`writeEnabled: false` 是硬性总开关。
- **零提示词注入。** 本插件不注册任何提示词段落；对模型可见的文本只有两个工具/命令描述，沿用官方 client 的 Minimal 风格。

## 配置

| 键 | 默认值 | 说明 |
|---|---|---|
| `probeEnabled` | `true` | 注册 `mcp_probe` 后台任务工具（结果仅面板可见） |
| `probeTimeoutMs` | `10000` | 单次探测超时（ms） |
| `maxProbes` | `10` | 面板展示的探测记录数 |
| `refreshIntervalMs` | `0` | 建议的面板刷新间隔（ms）；`0` = 按需 |
| `outputLanguage` | `en` | `/mcp` 输出语言：`en\|zh\|es\|pt\|hi` |
| `passiveProbeEnabled` | `false` | 周期性探测 streamable-http 服务器 |
| `passiveProbeIntervalMs` | `60000` | 被动探测间隔（ms） |
| `trialEnabled` | `true` | 工具试用台（设置页 + `/mcp call`） |
| `trialTimeoutMs` | `120000` | 每次试用调用的面板侧截止时间 |
| `trialMaxResultChars` | `60000` | 试用结果载荷上限（字符） |
| `writeEnabled` | `true` | 总开关：`false` 拒绝一切 profile 写入（仍可复制片段） |
| `backupCount` | `5` | 每次写入保留的 `cordis.patch.yml` 备份数 |

## Resources 与 Prompts

官方 client 明确记载"Tools 是当前唯一桥接的 MCP 能力"——Resources 与 Prompts 处于 deferred 状态。控制台特征探测了上游提案中的 catalog seam，一旦落地即可只读展示列表；在此之前，能力一览中二者均标注**待官方支持**（详见 deepseek-harness `docs/upstream-proposal.md` 的补充提案）。

## 开发

```sh
pnpm run typecheck && pnpm run typecheck:ci && pnpm test && pnpm run build && pnpm run verify:self-contained && pnpm run verify:artifacts && pnpm pack
```

- `src/patch.ts` — 校验、保留语义合并、YAML 片段渲染（纯函数）。
- `src/write.ts` — 备份 + 追加 + 保留策略（唯一写文件模块）。
- `src/trial.ts` — 经 `ctx.tools.execute()` 的官方管线试用调用。
- `src/diagnostics.ts` — 错误模式 → 建议映射（纯函数）。
- `src/client/` — 设置页控制台（服务器编辑器、试用台、诊断）。
- `scripts/verify-headless.mjs` 启动真实 web profile 并打印 `/mcp` 实际输出。

发布：`node scripts/release.mjs <x.y.z>` 跑全量门禁、提交并本地打 `v<x.y.z>` 标签（绝不推送）。

## 许可证

Apache-2.0 —— 见 [LICENSE](LICENSE)。
