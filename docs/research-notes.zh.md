# dsh-mcp-panel 可观测面调研笔记

调研对象：`D:\deepseek-harness\packages\mcp\mcp-client`（README、`src/index.ts`、
`src/connection.ts`、`src/transport.ts`、`src/tools.ts`、`src/invariant.ts`）、
`docs/config-catalog.zh.md` 的 `dsh-mcp-client` 段、`docs/subsystems/tools.zh.md`。
交付日期与上游提案 `docs/upstream-proposal.md` 同步（位于 harness 仓库）。

## ① dsh-mcp-client 是否暴露连接状态服务 / 事件 / 健康回调

**结论：不暴露。** 证据：

- `connection.ts` 的 `startConnection()` 把所有状态放在闭包局部变量里：
  `client`、`clientClosed`、`disposers`、`reconnectTimer`、`failedAttempts`、
  `connectedAt`、`firstAttemptError`、`syncChain`。返回值只有
  `{ ready, dispose() }`，没有任何查询面。
- 全文件没有任何 `ctx.emit(...)` / `ctx.on(...)` 调用；唯一对外信号是
  `ctx.logger` 文本（warn/error/info：reconnecting 含 attempt 数与 delay、
  recovered、give-up、disabled-loss、re-sync 失败等，见 README "Behavior"）。
- 该包自带的 invariant 伴随插件明说：
  *"the bridge exposes no independent server-to-tool snapshot after an
  asynchronous resync"*（`src/invariant.ts`）。
- 未注册任何 Cordis 服务；README "Services consumed" 只有 `ctx.tools`。

**推论**：连接状态、最近错误、重连计数在机制上不可观测；从
`ctx.tools.schemas()` 反推"已连接"会撒谎（断线期间最后一次成功
generation 仍注册着工具；`reconnect.enabled: false` 时同样如此）。

**是否提上游 PR：是。** 理由：状态本来就存在于 supervisor 里，外部无法
合法重建；最小 seam（`mcp/status` 事件 + `mcpStatus` 查询服务）不动
transport/OAuth/协议，成本低而所有面板类消费者都能受益。提案全文见
harness 仓库 `docs/upstream-proposal.md`；本插件同时实现了**消费该提案**
的一半（事件订阅 + 服务特性探测 + 诚实降级），上游落地后无需改本插件。

## ② 已注册工具名空间能否从 `ctx.tools.schemas()` 枚举

**能。** `ToolRuntime.schemas(scope?)`（`packages/core/tools/src/index.ts`）
返回面向模型的 `ToolSchema[]`（name / description / parameters 白名单，
不含 execute/output 等宿主字段）。MCP 工具的公开名是
`mcp__<serverName>__<rawName>`（超长/非法字符时经确定性归一化 + 12 位 hash，
纯函数 `publicToolName(serverName, rawName)`），因此按 `mcp__<server>__` 前缀
分组即可还原每个服务器的工具清单与描述。

注意事项：

- `schemas()` 无 scope 参数时是全局视图；面板要展示的是全局注册集。
- **不能用工具注册与否推断服务器在线**（见 ①）。
- 无工具注册的服务器（启动失败 + `failOnStartupError: false`、重连预算耗尽）
  在 `schemas()` 里没有名字空间，行数据必须来自 Loader 配置，工具数记为 0。
- `tools/change`（emit）事件可用于实时刷新，但本插件用 Typert remote 的
  `status()` 拉取快照，不需要在 Host 侧做推送。

## ③ 启停是否只能通过 patch 行 disabled

- mcp-client 自身没有运行时启停接口。
- Cordis Loader 其实有运行时通道：`Entry.update({ disabled })`
  （`vendor/cordis/…/cordis-plugin-loader/src/config/entry.ts`）可以热卸载/
  重挂载，但它会把改动**持久化写回**用户配置树——这正是本任务禁止的
  "静默改动用户配置"。
- 因此按任务要求实现为**受控的 patch 建议**：`/mcp <server> disable|enable`
  只输出建议的 `cordis.patch.yml` 行（`- set: { id, name, disabled }`）并说明
  生效路径，绝不写文件、绝不伪造运行时效果。
- 生效路径已核实：web 长驻面板对 profile 级与 home 级 `cordis.patch.yml`
  挂 `watchUserPatches` 热重载（`packages/boot/app-boot`）；其他面板需重启。
  Loader patch 语法核实自 `cordis-plugin-include` 的 `applyEntryPatches`。

## 冲突排查（GitHub topic mcp-manager / mcp-panel）

- **`1a125/dsh-mcp-manager`**（"DSH global MCP manager"，2026-08-13 push）：
  向 `~/.dsh/cordis.patch.yml` 写 mcp-client 行的配置编辑器；自称
  "运行期即时连接/断开"（实际依赖配置热重载，且它直接改写用户全局配置）；
  状态仅"通过宿主工具注册表实时检测"（即 ① 里说明的不可靠推断）；无错误
  摘要、无重连计数、无脱敏。质量偏雏形。
- **`hyqhyq3/dsh-mcp-manager`**（2026-08-13 push）：OAuth PKCE + 动态客户端
  注册 + 自研 stdio/HTTP 传输——属于"扩展 mcp-client 能力"的另一生态位，
  恰好落在本任务边界之外（不做 OAuth/远程传输、不重写 mcp-client）。
- **差异化定位（本插件）**：只读的运行时管理面，服务于**官方**
  `dsh-mcp-client`：loader 配置事实（transport/target/enabled/fiber 状态）
  + `schemas()` 工具清单 + 上游提案落地后的真实连接状态/错误/重连计数 +
  脱敏 + 受控 patch 建议 + 可选连通性探测。两个雏形均未做"错误 + 重连计数
  + 官方客户端只读观测"这一组合，无需合作，不重叠。

## 面板数据通道决策

- 任务要求 "client 插件 + session/投影"。逐条核对后**采用 Typert remote
  服务**（Host 侧 `mcpPanel` 命名空间，客户端 `$mount` 手写
  `TypertRemoteContribution`，模式同 `ui-settings-plugin-inventory` →
  `remote.pluginInventory`）：
  - session 投影是**按会话**的持久值，由会话日志折叠而来；MCP 连接状态是
    **应用级、运行期变化**的状态。apiproxy 里 `imageLimits` 用 `view` 读
    活服务是被"boot-constant（进程生命周期内不变）"特批的，MCP 状态不满足；
    硬塞进投影会污染每个会话日志且跨会话重复。
  - 任务同时要求遵守 client 插件契约（`window.__DSH_BOOT__` 模块表、
    presenter 纯函数）——remote 命名空间正是该契约下的宿主状态读取通道。
- 客户端 bundle：CJS + `window.__ModuleLoader__.load({ id, factory })` 包裹，
  平台模块（react / cordis / dsh-client-ui-slots / dsh-client-runtime/client 等）
  外部化，其余内联；`dsh.client` 元数据 + `exports["./client"]` 让
  `client-modules` 自动挂到 `/plugins/dsh-mcp-panel/client.js`。
- Host 侧 typert：`exports["./typert"]` 手写 `TYPERT` 清单（与生成物同构，
  逐条通过 `typert-loader` 校验：strict codec 必须带 zod v4 schema 等），
  typert-loader 随 Loader 条目自动注册；`TypertRemoteService` 的
  `typertRemote` 绑定由 gateway 自动发现导出。

## 硬性契约落实点

- **只读**：不改任何配置文件；disable/enable 只输出建议文本；面板无任何
  写入口；连接状态在无上游数据时标 `unknown` + `statusSource: 'derived'`。
- **脱敏**：URL 查询串凭据键、userinfo、`Authorization: Bearer …`、JWT、
  `key=value` 凭据键值全部在展示前清洗（`src/sanitize.ts`，纯函数，含极端
  case 测试）；config.headers 永不进快照。
- **面板内容不进模型上下文**：快照只走 remote RPC；`mcp_probe` 结果只进
  面板（unowned 后台 job，无完成通知注入），工具返回值只有 job id。
- **`/mcp` 输出模型可读且可重建**：标准 `CommandResult` 文本，走官方
  `commands` 服务（自动落 `command/run` + `command/done` 会话事件）。
- **不动 mcp-client**：传输/OAuth/协议零改动；上游 PR 提案单独成文。
