# dsh-mcp-panel

**DeepSeek Harness 官方 MCP 客户端的只读运行时管理面板——一眼看清每个 MCP 服务器的状态、工具、错误与重连计数，绝不改动你的配置。**

[English](README.md) · [简体中文](README.zh.md) · [Español](README.es.md) · [Português](README.pt.md) · [हिन्दी](README.hi.md)

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![dsh-plugin](https://img.shields.io/badge/ecosystem-dsh--plugin-8b5cf6)](https://github.com/topics/dsh-plugin)
[![deepseek-harness](https://img.shields.io/badge/runtime-deepseek--harness-4f46e5)](https://github.com/deepseek-ai/deepseek-harness)

> 🔭 **可观测优先。** [`@deepseek-ai/dsh-mcp-client`](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/mcp/mcp-client) 的连接状态是私有的——只有日志。本插件展示一切**能**观测到的事实（配置、工具注册表、Loader 状态），对观测不到的字段如实显示 **"unknown"**，绝不猜测；同时给出让状态可观测的最小上游 seam 提案（见 [upstream proposal](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/upstream-proposal.md)）。

## 你能得到什么

| 界面 | 展示内容 |
|---|---|
| **`/mcp` 命令** | transport、目标、工具数、连接状态、最近错误、重连计数——模型可读、可日志重建 |
| **设置 → 插件 → MCP 页签** | 同一快照的只读视图：状态徽标、可展开工具清单、脱敏错误、探测结果 |
| **`/mcp <server> disable\|enable`** | 应应用的 `cordis.patch.yml` 确切行——只是**建议**，绝不写文件 |
| **`mcp_probe` 工具** | 对 Streamable HTTP 端点的一次性连通性探测（后台 job），结果**仅面板可见** |

## 快速上手

```sh
dsh plugin --profile web add github:PerryLink/dsh-mcp-panel#main
```

重启（或让 web 面板热重载 `cordis.patch.yml`），然后：

```text
/mcp
/mcp everything tools
/mcp everything disable
```

```text
MCP servers (1):
- everything [include:mcp-everything] stdio node …/server-everything/dist/index.js
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

## 诚实契约

- **只读。** 绝不写任何配置文件；`disable`/`enable` 只是打印建议，由你自行应用。
- **不伪造状态。** 无上游数据的连接字段显示 `unknown` / `—`，并标注 `statusSource: derived`。
- **展示脱敏。** URL 查询串凭据、userinfo 密码、header 值、Bearer token、JWT 在渲染前全部清洗；配置中的 `headers` 从不进入任何快照。
- **panel-only 结果。** 探测细节只进设置页签，不进模型上下文；`/mcp` 输出是模型可读面，且完全可从会话日志重建。
- **零 mcp-client 改动。** 传输 / OAuth / 协议不动——可观测缺口由[上游提案](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/upstream-proposal.md)覆盖，本插件已实现其消费侧（类型化的 `mcp/status` 事件 + `mcpStatus` 查询服务，运行时特性探测）。

## 配置

| 字段 | 默认 | 说明 |
|---|---|---|
| `probeEnabled` | `true` | 是否注册 `mcp_probe` 工具（需要组合里有 `ctx.jobs`） |
| `probeTimeoutMs` | `10000` | 单次探测超时 |

## 工作原理

- **Host 半部**——`mcpPanel` Typert Remote 服务从三个只读来源组装快照：Loader 行（`@deepseek-ai/dsh-mcp-client` 条目）、按 `mcp__<server>__` 名字空间分组的 `ctx.tools.schemas()`、以及上游 `mcp/status` 观测。手写的 `./typert` 清单把 `mcpPanel/status` 注册进网关；`zod` 被打包进产物，host bundle 自包含。
- **浏览器半部**——`dsh.client` bundle（由 `/plugins/dsh-mcp-panel/client.js` 提供）通过 `ctx.remote.$mount` 挂载同一描述符，并注册只读的 `settings.plugins.tab` 条目（`id: mcp`）。presenter 是纯函数；样式带作用域且使用主题 token。
- **`/mcp` 命令**走标准命令注册表——每一行都落入 `command/run` + `command/done` 会话事件。

## 开发

```sh
pnpm install
pnpm run typecheck
pnpm test          # 58 个测试：脱敏极端用例、分组、聚合容错、命令输出、presenter
pnpm run build     # tsc 声明 → lib/types；tsdown → lib/index.js + lib/typert.host.js + lib/client.js
pnpm run verify:self-contained
pnpm pack
```

对真实 harness checkout 的验证：
`node --import tsx/esm scripts/verify-headless.mjs` 在进程内启动完整 web profile（临时端口），打印真实的 `/mcp`、`/mcp <server> tools`、`/mcp <server> disable` 输出。

## License

[Apache License 2.0](LICENSE) © 2026 dsh-mcp-panel contributors
