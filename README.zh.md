<div align="center">

# dsh-mcp-panel

**官方 DeepSeek Harness MCP client 的 MCP 管理控制台 —— 在设置页可视化增删改 MCP 服务器、试用工具调用，配以诚实的连接状态、健康诊断与安全可逆的 profile 写入。**

*官方 client = 桥接，本插件 = 控制台：经 `mcp/status` seam 读取状态，只写入只追加、走审批的 profile patch。*

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![DSH plugin](https://img.shields.io/badge/dsh-plugin-✅-green)](https://github.com/topics/dsh-plugin)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-brightgreen.svg)](#)
[![CI](https://img.shields.io/github/actions/workflow/status/PerryLink/dsh-mcp-panel/ci.yml?branch=main&label=CI)](https://github.com/PerryLink/dsh-mcp-panel/actions)
[![Version](https://img.shields.io/github/v/tag/PerryLink/dsh-mcp-panel?label=version)](https://github.com/PerryLink/dsh-mcp-panel/releases)
[![npm version](https://img.shields.io/npm/v/dsh-mcp-panel)](https://www.npmjs.com/package/dsh-mcp-panel)
[![npm downloads](https://img.shields.io/npm/dm/dsh-mcp-panel)](https://www.npmjs.com/package/dsh-mcp-panel)

[English](README.md) · [简体中文](README.zh.md) · [Español](README.es.md) · [Português](README.pt.md) · [हिन्दी](README.hi.md)

</div>

---

## Compatibility

| 维度 | 状态 |
|---|---|
| Harness | DeepSeek Harness `0.1.0-rc.5`–`0.1.0-rc.6` |
| Node | `^22.19.0 \|\| >=24.0.0` |
| 平台 | Web GUI（双面：Host + 浏览器） |
| 模型 | 任意（面板只读；仅 `/mcp` 输出对模型可见） |

## What you get

`dsh-mcp-panel` 是官方 MCP client 之上的体验层：只读运行时视图加上安全可逆的 profile 写入。

- **`/mcp` 命令** —— 每 server 一行：transport、目标、工具数、连接状态（来自上游 seam；未观测时如实显示 `unknown`）、最近错误、重连计数——模型可读、会话日志可重建、五种输出语言。
- **`/mcp <server> tools`** —— 模型可见的 `mcp__*` 工具名与描述。
- **`/mcp <server> health`** —— 派生自愈建议（ENOENT → 依赖缺失、ECONNREFUSED、超时、401/403/404、DNS、限流、重连耗尽…）；退出码 / stderr 尾部如实标注*待官方支持*。
- **`/mcp <server> call <tool> [json]`** —— 经**官方工具管线**（`ctx.tools.execute()`）试用调用；pre-execute 权限策略、审批、guard、post-execute 全部生效。
- **设置 → 插件 → MCP 页** —— 状态卡片（徽章、诊断、探测），加 server CRUD 与工具试用台。
- **Server CRUD** —— 增删改表单 → `insert`/`set`/`set disabled` 片段 → 剪贴板复制或审批写入，自动备份。
- **工具试用台** —— 选 server → 选 `mcp__*` 工具 → JSON 填参 → 规范 JSON 结果 + render 内容；按 `trialMaxResultChars` 截断；仅面板可见、永不进入模型上下文。

## Architecture: official client = bridge, this plugin = console

[`@deepseek-ai/dsh-mcp-client`](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/mcp/mcp-client) 是**唯一的桥接层**：每个 MCP server 一个插件实例，以手写 `cordis.yml` 行的形式配置，负责连接传输、同步工具并注册 `mcp__<server>__<tool>` 工具名。本插件从不取代它——而是构建其上的**体验层**：

```text
                    ┌────────────────────────────────────────────┐
 profile            │  cordis.yml / cordis.patch.yml             │
 组合（每个         │   - id: mcp-github                          │
  server 一行，     │     name: '@deepseek-ai/dsh-mcp-client'     │
  手写）            │     config: { serverName, transport, … }    │
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
   │ • mcp/status seam │ 状态   │ • 健康诊断                │    │
   └───────────────────┘        │ • 探测、能力一览          │    │
                                └───────────────────────────┘    │
```

控制台通过官方 client 已落地的 `mcp/status` 可观测 seam（事件 + `mcpStatus` 查询服务）、工具注册表与 loader **读取**事实；**写入**只发生在 profile 的 patch 层——只追加、走审批、自动备份。传输、OAuth 与协议完全不动。

## Quick start

```sh
# 1. 把 bundle 安装进 profile
dsh plugin --profile web add "github:PerryLink/dsh-mcp-panel#main"

# 或从 npm（发布版本）
dsh plugin --profile web add dsh-mcp-panel

# 2. 重启并校验该行
dsh --profile web --dump-config | grep -A3 'id: mcp-panel'
```

随后打开 **设置 → 插件 → MCP**，或运行：

```text
/mcp
/mcp everything tools
/mcp everything health
/mcp everything call echo '{"message": "hi"}'
```

## Install & uninstall

- **git 通道**（最新 `main`）：`dsh plugin --profile web add "github:PerryLink/dsh-mcp-panel#main"` —— `prepare` 脚本只用生产依赖构建。
- **npm 通道**（发布版本）：`dsh plugin --profile web add dsh-mcp-panel`。
- **tarball 通道**：在本仓库 `pnpm pack`，再 `dsh plugin --profile web add ./dsh-mcp-panel-<version>.tgz`。
- **卸载**：从 `cordis.patch.yml` 移除 `mcp-panel` 行（web 面板热重载），从 profile 的 `node_modules` 删除本包，并用 `dsh web --dump-config` 确认没有残留的 `mcp-panel` 行。

## Configuration

所有可调项都是 Schemastery `Config` 字段（可从 cordis.yml 覆盖）。`cordis.patch.yml` 逐键内联注释。

| 键 | 默认值 | 含义 |
|---|---|---|
| `probeEnabled` | `true` | 注册 `mcp_probe` 后台任务工具（结果仅面板可见） |
| `probeTimeoutMs` | `10000` | 单次探测超时（ms） |
| `maxProbes` | `10` | 面板展示的探测记录数 |
| `refreshIntervalMs` | `0` | 建议的面板刷新间隔（ms）；`0` = 按需 |
| `outputLanguage` | `en` | `/mcp` 输出语言：`en \| zh \| es \| pt \| hi` |
| `passiveProbeEnabled` | `false` | 周期性探测 streamable-http 服务器 |
| `passiveProbeIntervalMs` | `60000` | 被动探测间隔（ms） |
| `trialEnabled` | `true` | 工具试用台（设置页 + `/mcp call`） |
| `trialTimeoutMs` | `120000` | 每次试用调用的面板侧截止时间（ms） |
| `trialMaxResultChars` | `60000` | 试用结果载荷上限（字符） |
| `writeEnabled` | `true` | 总开关：`false` 拒绝一切 profile 写入（仍可复制片段） |
| `backupCount` | `5` | 每次写入保留的 `cordis.patch.yml` 备份数 |

## Tools & surfaces

| 表面 | 类型 | 说明 |
|---|---|---|
| `/mcp` | command | 每 server 状态行；模型可读、日志可重建 |
| `/mcp <server> tools` | command | 模型可见的 `mcp__*` 工具名与描述 |
| `/mcp <server> health` | command | 由脱敏错误文本派生的自愈建议 |
| `/mcp <server> call <tool> [json]` | command | 经官方工具管线试用调用 |
| `mcp_probe` | tool | 可选 Streamable HTTP 连通性探测（后台任务） |
| 设置 → 插件 → MCP 页 | UI 槽位 | 状态卡片、server CRUD 与工具试用台 |
| `mcpPanel` Typert Remote | service | 只读快照通道（Host → client） |

## Resources & Prompts

官方 client 明确记载 *"Tools 是当前唯一桥接的 MCP 能力"*——Resources 与 Prompts 处于 deferred 状态。控制台特征探测了上游提案中的 catalog seam，一旦落地即可只读展示列表；在此之前，能力一览中二者均标注**待官方支持**。

## Permissions & data

- **权限**：`dshWorkshop` manifest 声明 `network:outbound` 与 `native-code:none`。
- **数据**：面板只读；只写入只追加的 `cordis.patch.yml` 片段（走审批、先备份）。URL 查询凭据、userinfo 密码、header 值、Bearer token、JWT 在渲染前一律打码；配置的 `headers` 从不进入任何快照，env/header 的**值**绝不出 Host（编辑器只见 key）。

## Security boundaries

- **桥接层仍是桥接层。** 不改传输、OAuth、协议；每个 server 一行 mcp-client，与你手写完全一致。
- **不伪造状态。** 无上游观测时连接字段显示 `unknown` / `—` 并标注 `statusSource: 'derived'`；退出码与 stderr 尾部绝不臆造。
- **写入只追加、走审批、先备份。** 控制台从不改写 `cordis.patch.yml`：只追加生成的操作，并保留最新 `backupCount` 份备份。
- **零提示词注入。** 本插件不注册任何提示词段落；对模型可见的文本只有两个工具/命令描述。

## Known limitations

- **Resources 与 Prompts** 待官方支持——官方 client 仅桥接工具。
- **退出码 / stderr 尾部** 在 client 暴露前如实标注*待官方支持*。
- **只读面板** —— 控制台从不伪造连接状态；不可观测字段显示 `unknown` / `-1` / `—`。

## Development

```sh
pnpm run typecheck && pnpm run typecheck:ci && pnpm test && pnpm run build && pnpm run verify:self-contained && pnpm run verify:artifacts && pnpm pack
```

`scripts/verify-headless.mjs` 启动真实 web profile 并打印 `/mcp` 实际输出。发布：`node scripts/release.mjs <x.y.z>` 跑全量门禁、提交并本地打 `v<x.y.z>` 标签（绝不推送）。

## Topics

`dsh`, `dsh-plugin`, `deepseek-harness`, `deepseek`, `cordis`, `mcp`, `mcp-client`, `observability`, `panel`

## Contributors

- [@PerryLink](https://github.com/PerryLink) —— 创建者与维护者。
- [@xiaoyuyu6420](https://github.com/xiaoyuyu6420) —— 诊断出干净 checkout 构建失败背后缺失的 client devDependencies（PR #5）。

## License

[Apache License 2.0](LICENSE) © 2026 dsh-mcp-panel contributors
