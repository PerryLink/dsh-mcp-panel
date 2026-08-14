# dsh-mcp-panel 完善与提升方案 v2

> 复核日期：2026-08-14。复核基线：本仓库当前工作区（含未提交的 Phase 2 改动）、本地 deepseek-harness checkout（workspace 包 `0.1.0-rc.5`，mainline `7b9644f`）、npm registry 实况、`dsh-plugin-guide` 知识库（§7 踩坑清单）。
> 本方案是对 `docs/optimization-plan-v2.zh.md` 的前一版 `docs/optimization-plan.zh.md` 的**续篇**：上版 22 项已基本实现（见 §1.1），本文档只列**尚未完成或新发现**的事项。
> 每项给出：现状证据、具体改动点（文件级）、验收标准、工作量（S <1h / M 1–3h / L >3h）、可行性结论。

## 0. 结论摘要

1. **当前工作区是红灯状态**：上一版 Phase 2 功能（面板轮询、探测按钮、被动探测、/mcp i18n、探测上限、事件陈旧度）已写入源码但**未收口**——`pnpm run typecheck` 有 7 个错误、`pnpm test` 84 例中 1 例失败、15 个文件未提交、文档（5 语言 README / cordis.patch.yml / CHANGELOG / AGENTS.md）未同步。**第一优先级是完成收口并提交**（§2），而不是叠加新功能。
2. **CI typecheck 可恢复**：上一版 A6 以"npm 类型包过旧"为由否决 CI typecheck；实测证据表明该前提已不成立——`@deepseek-ai/dsh-*` 全套 `0.1.0-rc.6` 已发布到 npm（`next` 标签），独立 spike 用纯 npm 类型闭包编译本仓库源码，错误输出与 checkout 版本**完全一致**（仅本仓库自身 7 错，无任何模块解析/类型闭包错误）。恢复 CI typecheck 可直接堵住当前这类"改一半"的回归（§3）。
3. **上游 `mcp/status` seam 仍未落地**：grep 本地 harness checkout 全部 `packages/` 与 `docs/`，`mcp/status` 事件、`McpStatusService` 均不存在，`docs/upstream-proposal.md` 也未出现在 harness 仓库。插件当前全部连接字段仍走 `unknown + statusSource: derived` 降级。提案文档已完备（本仓库 `docs/upstream-proposal.md`，含 PR contents 清单），**提交上游 PR 是让插件核心价值完整化的最高杠杆动作**（§6）。
4. **新增产品与工程机会**已逐项核查（§4/§5），均不触碰只读契约与诚实性约束。

### 可行性总览

| 编号 | 事项 | 可实施 | 关键前置/风险 | 工作量 |
|---|---|---|---|---|
| P0-1 | 修复 `CommandMessages.noTools` 接口签名（7 个 tsc 错误同源） | ✅ 直接修 | 无 | XS |
| P0-2 | 修复 2 个过时测试（aggregate probeStates / client-registration probe 类型） | ✅ 直接修 | 无 | XS |
| P0-3 | 全绿 + 提交 Phase 2 工作区 | ✅ | 依赖 P0-1/2 | S |
| P0-4 | 文档同步：5 语言 README、cordis.patch.yml、AGENTS.md | ✅ 内容现成 | 翻译量 | M |
| P0-5 | CHANGELOG [Unreleased] 条目化 + 版本号与 clientInfo 版本一致性 tripwire | ✅ | 依赖 P0-3 | S |
| P1-1 | CI typecheck 恢复（npm rc.6 类型闭包，已有 spike 证据） | ✅ | 需更新 pnpm-lock | M |
| P1-2 | CI 矩阵加 Node 24 | ✅ | 无 | XS |
| P1-3 | `.gitattributes` 固定 LF（消除 CRLF 警告） | ✅ | 无 | XS |
| P1-4 | harness checkout 兼容性 job（可选） | ✅ | 网络/仓库体积成本 | M |
| P2-1 | `/mcp <server> probe` 命令动作（与面板按钮/工具对称） | ✅ | jobs 缺失分支需文案 | S |
| P2-2 | `/mcp` 错误文案本地化（未知服务器提示目前硬编码英文） | ✅ | 无 | S |
| P2-3 | 工具过滤框改为按卡片独立状态（现为全局共享，跨卡片串扰） | ✅ | 无 | S |
| P2-4 | 轮询可见性感知（document.hidden 暂停/恢复） | ✅ | 无 | S |
| P2-5 | 探测按钮防重 + 探测行时间戳 | ✅ | 无 | S |
| P2-6 | 未配置命名空间徽标修正（leftover 行误标 "disabled"） | ✅ 零 wire 变更 | 无 | XS |
| P2-7 | sanitizeUrl 补 URL fragment 凭据键脱敏 | ✅ | 无 | XS |
| P2-8 | 配置事实展示（failOnStartupError / reconnect 策略，derived 标注） | ✅ | 需 locale 文案 | S |
| P3-1 | 面板/命令扩展到 es/pt/hi（对齐 5 语言 README） | ✅ | 翻译 + 校对 | M–L |
| P4-1 | 向 deepseek-harness 提交 mcp/status 上游 PR | ✅ 提案完备 | harness 仓库门禁（测试/Agent Note/双语） | L |
| P4-2 | 上游落地后回归 + tripwire 清理 | ✅ | 依赖 P4-1 合入 | S |

---

## 1. 现状核查（证据）

### 1.1 上一版方案落实状态

上一版 `docs/optimization-plan.zh.md`（2026-08-14，22 项）逐项核对源码：

| 项 | 状态 | 证据 |
|---|---|---|
| C1 entryId 修正 | ✅ 已做 | `src/service.ts:147` 用 `entry.options.id`；`tests/command.spec.ts:121` nestedMcpRow 用例 |
| C2 提案入库 | ✅ 已做 | `docs/upstream-proposal.md`（随包分发）；README 已改相对链接 |
| C3 README 五章×5 语言 | ✅ 已做 | README.md 含 Compatibility/Quick start/Uninstall/Honest by contract/Configuration/Permissions & data/Troubleshooting/Security；`README.zh.md` 章节结构一致 |
| A3 v0.1.0 发布 | ⚠️ 部分 | CHANGELOG 有 0.1.0 条目、README 引 `#v0.1.0`；但本机 clone **无 remote**，tag/Release 无法本地验证（见 §1.5） |
| A1 CI / A2 产物冒烟 / A4 probe 单测 / A5 客户端接线 / A7 dependabot | ✅ 已做 | `.github/workflows/ci.yml`、`scripts/verify-artifacts.mjs`、`tests/probe.spec.ts`（9 例）、`tests/client-registration.spec.ts`（6 例）、`.github/dependabot.yml` |
| B1 轮询 / B3 探测按钮 / B5 过滤框 / B4 命令 i18n / B6 探测上限 / B7 陈旧度 / B2 被动探测 | ⚠️ 已写未收口 | 源码全部就位（`refreshIntervalMs`、`mcpPanel/probe` 描述符、`toolQuery`、`outputLanguage`、`maxProbes`、`observedAt`、`passiveProbe*`），但见 §1.2 红灯 |
| C6–C9 打磨项 | ✅ 已做 | `styles.ts:83` focus-visible、attempt x/y、`THIRD_PARTY_NOTICES.md`、`probe.ts:43` 80 字符截断 |

### 1.2 工作区健康状态：红灯（本次实测）

```text
$ pnpm run typecheck   → 7 个错误（exit 2）
src/command.ts(70,12)/(94,12)  TS7006 + TS2322  noTools 字典是函数、接口是 string
src/command.ts(169,21)          TS2349           renderTools 调 messages.noTools(view.serverName)
tests/aggregate.spec.ts(104,82) TS2345           McpStatusFacts 缺 probeStates（B2 连带漏改）
tests/client-registration.spec.ts(93,32)         TS6133  serverName 未使用
tests/client-registration.spec.ts(99,46)         TS2353  probe 假实现返回类型过窄（ok:true 推断）
$ pnpm test             → 84 例中 1 例失败（exit 1）
tests/aggregate.spec.ts > projects upstream status facts
  TypeError: Cannot read properties of undefined (reading 'get')  ← facts.probeStates 未传
```

**根因**：上一版 Phase 2 是"多文件连带变更"，`src/command.ts` 的接口行（`noTools: string`）与字典/调用点（函数化）改了一半；两个测试文件的连带更新漏了一半。`git status` 显示 15 个修改文件 + 2 个未跟踪测试文件（`tests/command-i18n.spec.ts`、`tests/service.spec.ts`）全部未提交。

### 1.3 文档缺口

- 5 语言 README 的 **Configuration 表只有 `probeEnabled`/`probeTimeoutMs` 两行**；`maxProbes`、`refreshIntervalMs`、`outputLanguage`、`passiveProbeEnabled`、`passiveProbeIntervalMs` 均未记载（grep 全仓 0 命中）。
- README「What you get」未提：面板探测按钮、被动探测徽标、轮询刷新、/mcp 双语文案。
- README Development 仍写「58 tests」（现 84）。
- `cordis.patch.yml` 只注释了 probeEnabled/probeTimeoutMs 两个键。
- `AGENTS.md` 布局段未提 `service.probe()` 与新配置键；`CHANGELOG.md` [Unreleased] 只有一行占位。

### 1.4 上游与生态状态

- **mcp/status seam 未落地**：`grep -r "mcp/status\|mcpStatus\|McpStatus" D:\deepseek-harness\packages` 零命中；harness `docs/` 无 `upstream-proposal.md`（glob 零命中）。`packages/mcp/mcp-client/src/` 仍是 connection/index/invariant/tools/transport 五文件，连接状态全部闭包私有。
- **transport 词汇与上游一致**：mcp-client 仅 `stdio` + `streamable-http` 两种（`src/transport.ts`），与本插件 `McpTransport` 词汇完全对齐；OAuth/PKCE 属另一生态位（`hyqhyq3/dsh-mcp-manager`），本插件边界不变。
- **npm rc.6 已发布（A6 否决前提失效）**：实测 `@deepseek-ai/dsh-tools|dsh-commands|dsh-client-runtime|dsh-mcp-client` 的 `latest` 均为陈旧的 `0.0.1-rc.1`、`next` 均为 `0.1.0-rc.6`；`dsh-typert-protocol` 的 `latest` 已是 `0.1.0-rc.6`。**Spike 证据**（`.rc6-check/spike`，已 gitignore）：把 `src/` + `tests/` 复制到独立目录，devDeps 全用 npm `0.1.0-rc.6`（含 dsh-client-connection/runtime/locale/ui-settings/ui-slots）+ `react@18.3.1` + `@types/react@18.3.31`，tsconfig 去掉全部 `paths` 覆写后运行 tsc：输出与 checkout 版本**逐条一致**（仅上述 7 个自身错误，零模块解析错误）→ 纯 npm 类型闭包可完整解析本仓库源码。
- 对照 `dsh-plugin-guide` §7.3：本仓库已规避"cordis 双副本"（peer + dev 对齐 4.0.1）、"prepare 自包含"（`scripts/prepare.mjs` 只用 dependencies 内工具）、"latest 标签陈旧"（devDeps 显式 `0.1.0-rc.6`）、"noEmitOnError"（build 前 tsc 失败即 exit，`prepare.mjs:24` `result.status !== 0 → process.exit`）。

### 1.5 其他核查点

- **探测历史保留**：jobs 注册表对 unowned job 无属主清理路径（`packages/jobs/jobs/src/index.ts` 注释：清理仅发生在属主无法再收集其记录时），探测记录随进程存活，`maxProbes` 上限有效——无需改动。
- **发布状态无法本地验证**：本机 clone 无 `origin` remote（`git remote -v` 为空），tag/Release 检查需在带 remote 的环境执行；仓库根目录有一个 gitignored 的 `dsh-mcp-panel-0.1.0.tgz`（本地 pack 残留，可删除）。
- **诚实性约束复核**：`probeState` 与 `phase` 语义隔离（B2 按设计未覆盖 phase）；`statusSource` 只在有上游 payload 时变 `upstream-event`；面板内容只走 `mcpPanel` remote 命名空间；`/mcp` 输出经 commands 服务落 `command/run`+`command/done`——均符合只读契约，无需修正。

---

## 2. Phase 0 —— 收口与发布基线（必做，先行）

### P0-1 · 修复 `CommandMessages.noTools` 接口签名（清 7 个 tsc 错误）

- 现状：`src/command.ts:47` 接口声明 `noTools: string`；`EN_MESSAGES`/`ZH_MESSAGES`（:70/:94）实现为 `server => …`；`renderTools`（:169）以函数调用。
- 改动：`src/command.ts:47` 改为 `noTools: (server: string) => string`（接口行与字典/调用点对齐；EN 为源）。
- 验收：`pnpm run typecheck` 归零错误。

### P0-2 · 修复两个过时测试

- `tests/aggregate.spec.ts:104`：`McpStatusFacts` 实参补 `probeStates: new Map()`（B2 连带）。
- `tests/client-registration.spec.ts:93`：假 probe 实现把未用形参改为 `_serverName`（或显式联合返回类型）；`:99` 处假实现返回类型放宽为 `{ ok: false; error: { code: string; message: string } }` 可赋值的并集（mockResolvedValueOnce 的 error 分支目前撞窄类型）。
- 验收：`pnpm test` 84/84 全绿。

### P0-3 · 提交 Phase 2 工作区

- 提交拆分建议（同一 PR 内按主题分 commit）：① i18n（command.ts/config.ts/index.ts + command-i18n.spec）；② probe remote + 上限 + 陈旧度（wire/typert.host/remote/service + 相关测试）；③ 轮询 + 被动探测 + 打磨（McpPanelTab/styles/aggregate + 相关测试）。
- 验收：`git status` 干净；每个 commit 后 `typecheck + test` 保持绿。

### P0-4 · 文档同步

- 5 语言 README（EN 为源）：Configuration 表补 5 个新键（含义 + 默认值）；「What you get」表补面板探测按钮、被动探测徽标、轮询刷新、双语 /mcp；Development 段测试数 58 → 84。
- `cordis.patch.yml`：注释补齐新键（默认值即最佳实践的键不必显式写，注释说明即可）。
- `AGENTS.md`：Layout 段补 `service.probe()`（第二个 remote 方法）与新配置键清单。
- 验收：`grep -r "refreshIntervalMs" README* cordis.patch.yml` 有命中；五个语言版本配置表行数一致。

### P0-5 · CHANGELOG 条目化 + 版本一致性 tripwire

- `CHANGELOG.md` [Unreleased] 按 P0-3 的三个主题写条目。
- 版本漂移防护：`src/probe.ts:32` 的 `PROBE_CLIENT_INFO.version = '0.1.0'` 是硬编码；新增一个单测断言其与 `package.json` 的 `version` 一致（读 `../package.json`，vitest 可解析 JSON）。
- 发布准备（需带 remote 的环境执行，本机无 remote）：版本号决策（0.2.0 或 0.1.1）、`git tag`、Release notes 自 CHANGELOG。

---

## 3. Phase 1 —— 工程化门禁升级

### P1-1 · 恢复 CI typecheck（推翻 A6，基于 spike 证据）

- 现状：CI 无 tsc；上一版 A6 的否决理由是 npm 类型包过旧 + cordis 4.0.1 类型缺面。§1.4 证据表明两个前提均已失效：rc.6 全系已在 npm（`next` 标签），且 spike 证明纯 npm 类型闭包能完整编译本仓库源码（含 client 三面类型）。
- 改动：
  1. devDependencies 增补：`@deepseek-ai/dsh-client-connection`、`dsh-client-runtime`、`dsh-client-locale`、`dsh-client-ui-settings`、`dsh-client-ui-slots`（均 `0.1.0-rc.6`）、`react@18.3.1`、`@types/react@18.3.31`。
  2. 新增 `tsconfig.ci.json`：extends 主配置、清空 `paths`（npm 解析）；主 `tsconfig.json` 的 checkout paths 保留给本地"mainline 最新类型"门禁——**双轨**：本地用 checkout、CI 用 npm，两者都跑 typecheck。
  3. `pnpm-workspace.yaml` 的 `minimumReleaseAgeExclude` 增补新引入的 5 个 client 包。
  4. `.github/workflows/ci.yml`：在 test 前加 `pnpm run typecheck:ci`（新 script：`tsc -p tsconfig.ci.json --noEmit`）。
- 风险与对策：npm rc.6 类型快照可能落后于 harness mainline 改名（如 0812 批量服务改名）——本地 checkout 门禁保持"主线新鲜度"，CI 门禁保证"发布版本兼容性"，漂移时两套报告对照即可定位。
- 验收：CI 全绿；人为引入一个类型错误能同时被本地与 CI typecheck 拦下。

### P1-2 · CI 矩阵加 Node 24

- 现状：engines 声明 `^22.19.0 || >=24.0.0`，CI 只跑 node 22。
- 改动：matrix 加 `24`。
- 验收：CI 双 OS × 双 Node 全绿。

### P1-3 · 行尾稳定化

- 现状：git 反复告警 "LF will be replaced by CRLF"（Windows 检出）。
- 改动：新增 `.gitattributes`（`* text=auto eol=lf`）。
- 验收：`git status` 不再出现行尾告警；`git diff --cached --check` 通过。

### P1-4 · harness 兼容性 job（可选）

- 现状：`scripts/verify-headless.mjs` 只能在有 checkout 的本机手动跑（README 已说明）。
- 改动：CI 可选 job（`workflow_dispatch` + 每月 cron）：actions/checkout 本仓库 → 按 pin SHA checkout deepseek-harness → `pnpm install`（harness 侧）→ `node --import tsx/esm scripts/verify-headless.mjs`。
- 成本：harness 仓库体积大、安装耗时；收益：上游 mainline 漂移提前报警。标注为可选，不阻塞主 CI。

---

## 4. Phase 2 —— 产品完善

### P2-1 · `/mcp <server> probe` 命令动作

- 现状：面板有探测按钮、模型侧有 `mcp_probe` 工具，但 `/mcp` 命令没有对称动作；CLI 用户想从命令面板发起探测只能靠模型调用工具。
- 改动：`parseMcpArgs` 的动作白名单加 `probe`；`mcpCommand` handler 加分支调 `service.probe(server)`，输出保持 panel-only 契约（只回 job id + "结果在 Settings → Plugins → MCP"）；jobs 缺失/stdio 服务器分支复用 service 抛错文案；`usage` 行与 `input.hint` 同步更新；`EN_MESSAGES`/`ZH_MESSAGES` 加对应文案。
- 测试：`tests/command.spec.ts` 补 3 例（成功返回 job id、stdio 拒绝、jobs 缺失报错）。
- 验收：verify-headless 输出 `/mcp everything probe` 为「探测已启动（job …），结果仅面板可见」；单测全绿。

### P2-2 · 命令错误文案本地化

- 现状：`mcpCommand` 的 unknown-server 错误是硬编码英文（`Unknown MCP server "…" (configured: …)`），`outputLanguage: zh` 下仍是英文；机器可读字段（`status: unknown (source: derived)`）保留英文是有意设计（已有测试断言），不动。
- 改动：unknown-server 文案进 `CommandMessages`（en/zh 各一）；handler 用字典渲染。
- 验收：`command-i18n.spec.ts` 补 zh 断言。

### P2-3 · 工具过滤框按卡片独立

- 现状：`McpPanelTab.tsx` 的 `toolQuery` 是组件级单值 state，多个展开的服务器卡片共享同一过滤词——在卡片 A 输入会同时过滤卡片 B，且各卡片输入框显示相同文本。
- 改动：改为 `Map<serverName, string>`（`useState<Record<string, string>>`），每卡片读写自己的键；展开状态不受影响。
- 验收：jsdom 组件测试（若启用组件渲染测试）或手工验证两个卡片过滤互不影响。

### P2-4 · 轮询可见性感知

- 现状：`refreshIntervalMs > 0` 时 `setInterval` 无视页面可见性；后台标签页空转请求（浏览器虽会节流，但切回时快照可能是旧值）。
- 改动：`document.hidden` 时暂停计时器，`visibilitychange` 恢复时立即 `reload()`；组件卸载清理不变。
- 验收：手工：切后台 2 分钟切回，立即出现新快照；无可见性 API 的环境（jsdom）不报错。

### P2-5 · 探测按钮防重 + 探测行时间戳

- 现状：`dmcp-probe-now` 无禁用态，双击会并发启动两个同目标探测；探测列表只显示 detail 文本，无起止时间。
- 改动：从快照 `probes` 判断该服务器是否存在 `running` 探测，存在则禁用按钮并显示"探测中"；探测行加 `startedAt`/`finishedAt` 的本地化时间（locale 格式化或 `toLocaleTimeString`，无时钟进 presenter——时间格式在组件层做）。
- 验收：单测 presenter 不受影响；手工双击只产生一个 job。

### P2-6 · 未配置命名空间徽标修正

- 现状：`aggregate.ts` 对 leftover 命名空间（外来插件的 `mcp__` 工具，无 loader 行）产出 `enabled: false`，面板徽标显示"已停用"——误导（它根本不是配置项）。
- 改动：**零 wire 变更**——`entryId === ''` 即未配置标志；`present.ts` 的 `connectionBadge` 在 `view.entryId === ''` 时返回 `{ badge: 'unknown', tone: 'muted' }`；locale 无需新增（复用 `statusUnknown`）。
- 验收：`present.spec.ts` 补 leftover 行用例。

### P2-7 · sanitizeUrl 补 fragment 凭据键

- 现状：URL fragment（`#token=…`）不进请求但会进展示；`QUERY_CREDENTIAL` 只覆盖 `?`/`&` 对。
- 改动：`sanitize.ts` 对解析成功的 URL 同样扫描 `parsed.hash` 中的凭据键并替换；未解析回退路径的文本扫描正则同样覆盖 `#key=value`。
- 验收：`sanitize.spec.ts` 补 2 例（解析成功/未解析各一）。

### P2-8 · 配置事实展示（可选小项）

- 现状：重连预算等配置事实（`reconnect.enabled/maxAttempts`、`failOnStartupError`、`toolCallTimeoutMs`）用户完全不可见；上游 seam 未落地前 `maxAttempts` 一直是 `—`，但**配置意图**其实是可诚实展示的派生事实。
- 改动：面板 detail 区加"配置"行（从 loader 原始 config 读取，与 `deriveTarget` 同级的纯函数，标注 derived）；`/mcp` 行保持紧凑不加（避免模型侧膨胀）。不得触碰 `phase`/`statusSource` 语义（诚实性约束 §7）。
- 验收：aggregate 单测 + 手工面板核验。

---

## 5. Phase 3 —— 多语言扩展（可选）

### P3-1 · 面板/命令扩展到 es/pt/hi

- 现状：README 五语言，但面板字典只有 zh/en（`client/locales.ts`）、命令只有 en/zh（`outputLanguage` 联合类型）。
- 改动：① `outputLanguage` 联合类型加 `'es' | 'pt' | 'hi'` + 三套 `CommandMessages`；② client locale 注册三套新字典（面板自动跟随宿主 UI 语言，无需组件改动）。
- 前置：翻译需母语校对；建议 es/pt/hi 的 README 翻译者复责。
- 验收：`resolveConfig` 新值通过；`command-i18n.spec.ts` 各语言快照断言。

---

## 6. Phase 4 —— 上游联动（可选，价值最高）

### P4-1 · 向 deepseek-harness 提交 mcp/status PR

- 现状：提案完备（本仓库 `docs/upstream-proposal.md` 含动机、面定义、6 个发射点、PR contents 清单、非目标）；harness 侧零落地。
- 动作（在 harness 仓库执行，非本仓库）：
  1. `src/status.ts`（payload 类型、`McpStatusService`、事件声明）+ `src/connection.ts` 六个 `report()` 点 + `src/index.ts` 单例挂载 + README Observability 段 + `status.spec.ts`/`reconnect.spec.ts` 测试。
  2. 遵守 harness 仓库门禁：Agent Note（非平凡变更）、双语文档、`typecheck/test`、事件 JSDoc `@mode emit`。
  3. 本仓库的 `src/upstream.ts` 是**故意的 tripwire**：上游合入后，本地 checkout 门禁会立刻检验声明合并是否一致（冲突则编译失败）。
- 验收：harness PR 合入；本插件在 mainline checkout 上 `statusSource: upstream-event` 实转（verify-headless 输出变化）。

### P4-2 · 上游落地后回归

- 动作：verify-headless 重跑记录新输出；`docs/upstream-proposal.md` 头部状态改为 implemented 并指向合入 commit；`AGENTS.md`/README 的"expected until the upstream seam lands"表述更新。
- 验收：全绿 + 文档一致。

---

## 7. 边界与已否决项（沿用 + 新增）

- **只读契约不变**：任何新功能不得写配置文件、不得调 `Entry.update`（会持久化写回用户配置）、不得伪造运行时效果。§2–§5 全部满足。
- **诚实性约束**：探测可达性（probeState）永远与连接状态（phase）分离展示；`statusSource: derived` 不得伪装成 `upstream-event`。P2-8 只加"配置意图"事实并标注来源。
- **panel-only 契约**：探测细节永不进模型上下文；P2-1 的命令输出只回 job id + 面板指引（与 `mcp_probe` 工具一致）。
- **已否决：stdio 进程探测**。理由：mcp-client 经 SDK `StdioClientTransport` 持子进程句柄且对面板不可见；自行 spawn 第二实例有单实例锁/端口冲突/DB 独占风险，且需复刻 env scrub 语义。stdio 可达性只能等上游 seam。
- **已否决：OAuth/新传输支持**。mcp-client 目前只有 stdio + streamable-http，OAuth 属另一生态位；上游扩展后本插件再跟进词汇（watch item，无需现在写码）。
- **已否决：探测结果进入 `/mcp` 列表行**。probeState 已在面板行展示；模型侧输出保持现状（避免把 panel-only 数据升格为模型上下文）。
- **npm `latest` 标签陈旧**：devDeps 必须显式 `0.1.0-rc.6`（现状已如此），升级时核对 `next` 标签，防踩 0.0.1-rc.1。

---

## 8. 实施顺序与验收

```
Phase 0（P0-1 → P0-2 → P0-3 → P0-4 → P0-5）   ← 先救红灯再谈新功能
Phase 1（P1-1 → P1-2 → P1-3 → [P1-4 可选]）
Phase 2（P2-1 … P2-8，按列顺序）
Phase 3 / Phase 4（可选，各自独立可插队）
```

- P0 完成后打版本 tag（在带 remote 的环境）。
- 每个 Phase 的验收命令：
  `pnpm run typecheck && pnpm run typecheck:ci && pnpm test && pnpm run build && pnpm run verify:self-contained && pnpm run verify:artifacts`
- 命令输出变更（P2-1/P2-2）用 `scripts/verify-headless.mjs` 回归（需本机 checkout + 已装 profile）。
- 完成 P0–P2 后，本文档可归档；新想法继续在 v3 续篇记录。

## 9. 总结

17 项全部可实施，无一受阻。**最关键的是 P0**：当前工作区处于"功能已写、门禁红灯、文档滞后"的半完成状态，先把 7 个类型错误与 1 个失败测试修掉、把 Phase 2 收口提交并同步五语言文档，再谈提升。之后 P1-1（CI typecheck 恢复，有 spike 证据背书）能永久堵住同类回归；P2 八项把面板/命令打磨到与功能集相称的完整度；P4-1 上游 PR 则决定插件的终极价值上限。
