# dsh-mcp-panel

**DeepSeek Harness 官方 MCP 客户端的只读运行时管理面板——一眼看清每个 MCP 服务器的状态、工具、错误与重连计数，绝不改动你的配置。**

[English](README.md) · [简体中文](README.zh.md) · [Español](README.es.md) · [Português](README.pt.md) · [हिन्दी](README.hi.md)

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/dsh-mcp-panel)](https://www.npmjs.com/package/dsh-mcp-panel)
[![downloads](https://img.shields.io/npm/dm/dsh-mcp-panel)](https://www.npmjs.com/package/dsh-mcp-panel)
[![CI](https://github.com/PerryLink/dsh-mcp-panel/actions/workflows/ci.yml/badge.svg)](https://github.com/PerryLink/dsh-mcp-panel/actions/workflows/ci.yml)
[![dsh-plugin](https://img.shields.io/badge/ecosystem-dsh--plugin-8b5cf6)](https://github.com/topics/dsh-plugin)
[![deepseek-harness](https://img.shields.io/badge/runtime-deepseek--harness-4f46e5)](https://github.com/deepseek-ai/deepseek-harness)

> 🔭 **可观测优先。** [`@deepseek-ai/dsh-mcp-client`](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/mcp/mcp-client) 的连接状态是私有的——只有日志。本插件展示一切**能**观测到的事实（配置、工具注册表、Loader 状态），对观测不到的字段如实显示 **"unknown"**，绝不猜测；同时给出让状态可观测的最小上游 seam 提案（见 [upstream proposal](docs/upstream-proposal.md)）。

## 兼容性

- **运行时**：DeepSeek Harness ≥ `0.1.0-rc.5`（peerDependencies 固定 `0.1.0-rc.6` 包线）。
- **最新版本**：v0.3.0（2026-08-15）——TypeScript 7 / Vitest 4 / jsdom 30 工具链下全门禁通过，109 个测试。
- **最后验证**：2026-08-14，针对 deepseek-harness 源码 checkout（workspace 包 `0.1.0-rc.5`，mainline `7b9644f`）——headless `/mcp` 端到端 + 实时 web profile；证据见 [docs/research-notes.zh.md](docs/research-notes.zh.md)。同日对 mainline `47f9438` + `mcp/status` seam 分支（`feat/mcp-client-status-observability-seam`）复验：真实 `server-everything` 行经打包插件渲染 `status: connected (source: upstream-event)`，并跑通与启动器一致的全流程；记录见 [docs/optimization-plan-v2.zh.md](docs/optimization-plan-v2.zh.md)。

## 你能得到什么

| 界面 | 展示内容 |
|---|---|
| **`/mcp` 命令** | transport、目标、工具数、连接状态、最近错误、重连计数——模型可读、可日志重建，支持五种输出语言（`outputLanguage: en\|zh\|es\|pt\|hi`） |
| **设置 → 插件 → MCP 页签** | 同一快照的只读视图：状态徽标、可展开工具清单、脱敏错误、探测结果 |
| **一览即得** | 卡片上方的统计汇总、服务器搜索框、全部展开/折叠按钮 |
| **面板探测按钮** | 从页签对单个 streamable-http 服务器一键发起连通性探测；结果仍仅面板可见 |
| **被动探测** | 可选的每服务器后台可达性徽标，与连接状态严格分离展示 |
| **自动刷新** | 宿主建议刷新间隔（`refreshIntervalMs`）；页签轮询并在后台隐藏时暂停 |
| **`/mcp <server> disable\|enable`** | 应应用的 `cordis.patch.yml` 确切行——只是**建议**，绝不写文件 |
| **`mcp_probe` 工具** | 对 Streamable HTTP 端点的一次性连通性探测（后台 job），结果**仅面板可见** |

## 快速上手

```sh
# git 通道（经包的 prepare 脚本构建）
dsh plugin --profile web add github:PerryLink/dsh-mcp-panel#v0.3.0
# npm 通道（已发布产物，免构建放行）
dsh plugin --profile web add dsh-mcp-panel@0.3.0
```

重启（或让 web 面板热重载 `cordis.patch.yml`），然后：

```text
/mcp
/mcp everything tools
/mcp everything disable
```

```text
MCP servers (1):
- everything [mcp-everything] stdio node …/server-everything/dist/index.js
  | 13 tools | enabled | status: unknown (source: derived) | reconnects: — | last error: —
```

手动安装：把 `dsh-mcp-panel` 放进 profile 的 `node_modules`（或共享的
`$DSH_HOME/profiles/node_modules` 回退目录），并在 `cordis.patch.yml` 添加：

```yaml
- insert:
    - id: mcp-panel
      name: dsh-mcp-panel
      config:
        probeEnabled: true
        probeTimeoutMs: 10000
```

### 卸载

1. 从 `cordis.patch.yml` 移除 `mcp-panel` 行（web 面板会热重载；其他面板重启）。
2. 从 profile 的 `node_modules`（或共享的 `profiles/node_modules` 回退目录）删除该包。
3. 用 `dsh web --dump-config` 确认没有残留的 `mcp-panel` 行。

## 诚实契约

- **只读。** 绝不写任何配置文件；`disable`/`enable` 只是打印建议，由你自行应用。
- **不伪造状态。** 无上游数据的连接字段显示 `unknown` / `—`，并标注 `statusSource: derived`。
- **展示脱敏。** URL 查询串凭据、userinfo 密码、header 值、Bearer token、JWT 在渲染前全部清洗；配置中的 `headers` 从不进入任何快照。
- **panel-only 结果。** 探测细节只进设置页签，不进模型上下文；`/mcp` 输出是模型可读面，且完全可从会话日志重建。
- **零 mcp-client 改动。** 传输 / OAuth / 协议不动——可观测缺口由[上游提案](docs/upstream-proposal.md)覆盖，本插件已实现其消费侧（类型化的 `mcp/status` 事件 + `mcpStatus` 查询服务，运行时特性探测）。

## 配置

| 字段 | 默认 | 说明 |
|---|---|---|
| `probeEnabled` | `true` | 是否注册 `mcp_probe` 工具（需要组合里有 `ctx.jobs`） |
| `probeTimeoutMs` | `10000` | 单次探测超时 |
| `maxProbes` | `10` | 面板展示的探测记录上限 |
| `refreshIntervalMs` | `0` | 建议的面板刷新间隔（毫秒；`0` = 仅手动刷新） |
| `outputLanguage` | `en` | `/mcp` 命令输出语言（`en` \| `zh` \| `es` \| `pt` \| `hi`） |
| `passiveProbeEnabled` | `false` | 是否周期性后台探测 streamable-http 服务器 |
| `passiveProbeIntervalMs` | `60000` | 被动探测间隔（毫秒） |

## 权限与数据

- **读取**：Loader 条目、工具注册表（`mcp__<server>__` 名字）以及上游落地后的 `mcp/status` 事件。
- **写入**：无。绝不修改任何配置文件。
- **网络**：仅一次性 `mcp_probe`（及可选被动探测）向你**已配置**的端点 POST 一次 MCP `initialize` 请求；已配置 headers 仅用于该请求，从不展示或记录。
- 无遥测、无外部服务，除可选探测定时器外无后台任务。

## 故障排查

- 行不见了？运行 `dsh web --dump-config`，检查 `mcp-panel` insert 是否生效且 id 唯一。
- 面板显示 `status: unknown (source: derived)`——在上游 seam 落地前属预期；见 [docs/upstream-proposal.md](docs/upstream-proposal.md)。
- 面板数据不更新？把 `mcp-panel` 配置行的 `refreshIntervalMs` 设为正值（如 `5000`）自动轮询。
- 启动日志出现 FAILED 的 `mcp-panel` fiber——确认包能从 profile 解析（裸 `name: dsh-mcp-panel` 经 profile 的 `node_modules` 或共享回退目录解析）。
- 回滚：移除该行（见「卸载」）。

## 安全

发现安全问题？请在 GitHub 提 issue，但**不要**粘贴密钥、key 或 token——先脱敏。本插件仅在内存中持有你所配置 MCP 服务器的凭据用于探测请求；它们从不进入日志或快照。

## 工作原理

- **Host 半部**——`mcpPanel` Typert Remote 服务从三个只读来源组装快照：Loader 行（`@deepseek-ai/dsh-mcp-client` 条目）、按 `mcp__<server>__` 名字空间分组的 `ctx.tools.schemas()`、以及上游 `mcp/status` 观测。手写的 `./typert` 清单把 `mcpPanel/status` 注册进网关；`zod` 被打包进产物，host bundle 自包含。
- **浏览器半部**——`dsh.client` bundle（由 `/plugins/dsh-mcp-panel/client.js` 提供）通过 `ctx.remote.$mount` 挂载同一描述符，并注册只读的 `settings.plugins.tab` 条目（`id: mcp`）。presenter 是纯函数；样式带作用域且使用主题 token。
- **`/mcp` 命令**走标准命令注册表——每一行都落入 `command/run` + `command/done` 会话事件。

## 开发

```sh
pnpm install
pnpm run typecheck    # 本地门禁：经 tsconfig paths 解析 harness checkout 的最新类型面
pnpm run typecheck:ci # npm 门禁：解析已发布的 0.1.0-rc.6 类型面（CI 实际执行）
pnpm test             # 109 个测试：脱敏极端用例、分组、聚合容错、命令输出（五语言）、探测门控、客户端接线、presenter（徽标/汇总/过滤）
pnpm run build        # tsc 声明 → lib/types；tsdown → lib/index.js + lib/typert.host.js + lib/client.js
pnpm run verify:self-contained
pnpm run verify:artifacts
pnpm pack
```

发布：`node scripts/release.mjs <x.y.z>` 会改版本号、盖章 CHANGELOG、重跑门禁并提交打 tag；推送 tag 后自动发布 npm 与 GitHub Release（见 [CONTRIBUTING.md](CONTRIBUTING.md)）。

对真实 harness checkout 的验证：
`node --import tsx/esm scripts/verify-headless.mjs` 在进程内启动完整 web profile（临时端口），打印真实的 `/mcp`、`/mcp <server> tools`、`/mcp <server> disable` 输出。

## License

[Apache License 2.0](LICENSE) © 2026 dsh-mcp-panel contributors
