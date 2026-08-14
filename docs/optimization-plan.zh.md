# dsh-mcp-panel 优化提升方案

> 依据：2026-08-14 对仓库现状的逐项核查（CI、README 章节、entryId 数据源、probe 测试覆盖、产物冒烟、依赖闭包）。每项给出：现状证据、具体改动点、验收标准、工作量（S <1h / M 1–3h / L >3h）、可行性结论。

## 0. 可行性总览

| 编号 | 事项 | 可实施 | 关键前置/风险 | 工作量 |
|---|---|---|---|---|
| C1 | entryId 修正（disable/enable 建议行不可用） | ✅ 直接修 | 无 | S |
| C2 | 上游提案文档入库（README 死链） | ✅ 直接修 | 无 | S |
| C3 | README 补齐 5 章 × 5 语言 | ✅ 内容现成 | 翻译量 | M |
| A3 | v0.1.0 tag + CHANGELOG + Release | ✅ | 依赖 C1 先修 | S |
| A1 | CI（test+build+verify，无 tsc） | ✅ | 需 A2 脚本 | S–M |
| A2 | 构建产物冒烟（防 decorator 泄漏回归） | ✅ 直接加 | 无 | S |
| A6 | typecheck 进 CI | ⚠️ 不推荐 | 依赖闭包跨 ~6 包（证据见 §5.1），漂移成本 > 收益 | — |
| A4 | probe 网络路径单测 | ✅ | 无 | M |
| A5 | 客户端注册接线测试 | ✅ | 加 jsdom devDep | M |
| A7 | dependabot | ✅ | 无 | XS |
| B1 | 面板轮询刷新 | ✅ | 无 | M |
| B3 | 面板「探测」按钮（remote probe 方法） | ✅ | 复用 typert 双描述符模式 | M |
| B5 | 工具列表过滤框 | ✅ | 无 | S |
| B6 | 探测记录上限 | ✅ | 无 | XS |
| B7 | 上游事件陈旧度（observedAt） | ✅ | wire 变更需一次连带 | S |
| B4 | /mcp 输出 i18n | ✅ | 无 | M |
| B2 | 被动周期探测 | ✅（默认关） | 语义隔离：新增 probeState，不覆盖 phase | M |
| C4–C9 | 打磨小项 | ✅ | 无 | XS–S |

---

## Phase 0 —— 正确性与发布基线（先行）

### C1 · 修复 entryId：建议行必须用用户可写的裸 id
- 现状：`src/service.ts` 用 `entry.id`（Loader 嵌套拼接，实测输出 `include:mcp-everything`）；`cordis.patch.yml` 的 patch 按裸 id 匹配 → `/mcp <server> disable|enable` 给出的 `- set: { id: include:mcp-everything, … }` 会被 "entry not found" 跳过。
- 改动：
  1. `src/service.ts`：`entryId: entry.options.id`（`options` 是序列化原配置，裸 id）。
  2. `tests/harness.ts`：`FakeEntry.options` 增加 `id` 字段（与顶层 `id` 一致）。
  3. 新增用例：`renderPatchSuggestion` 输出的 `id:` 与 loader 行的 `options.id` 一致（模拟嵌套 id：顶层 `id: 'include:mcp-everything'`、`options.id: 'mcp-everything'`）。
  4. `scripts/verify-headless.mjs` 回归：`/mcp everything disable` 输出应为 `id: mcp-everything`。
- 验收：headless 输出 + 新单测全绿；live 快照 `entryId` 变为裸 id。

### C2 · 上游提案入库，消除死链
- 现状：README（5 语言）链接指向 `deepseek-ai/deepseek-harness/blob/master/docs/upstream-proposal.md`，该文件仅存在于本地 checkout（master 尚无）→ 死链；插件仓库 `docs/` 只有 research-notes。
- 改动：复制 `D:\deepseek-harness\docs\upstream-proposal.md` → `docs/upstream-proposal.md`（头部注明"权威提案目标为 deepseek-harness 仓库，本副本随插件分发"）；5 个 README 与 `docs/research-notes.zh.md` 的相关链接改为相对路径 `docs/upstream-proposal.md`。
- 验收：`grep -r 'deepseek-ai/deepseek-harness/blob/master/docs' .` 无遗留外部死链。

### C3 · README 补齐五章（对齐 awesome 目录 L2 判定）
- 现状：README 缺 Compatibility / Install & Uninstall / Permissions & data / Troubleshooting / License & security。
- 内容规格（全部事实现成，不新增承诺）：
  - **Compatibility**：peers 固定 `0.1.0-rc.6`；实测环境 = deepseek-harness checkout（rc.5，mainline `7b9644f`），最后验证日期 2026-08-14。
  - **Install / Uninstall**：`dsh plugin add github:PerryLink/dsh-mcp-panel#v0.1.0` + 手动 patch 行；卸载 = 删 patch 行 + 删包（附 `--dump-config` 自检）。
  - **Permissions & data**：只读 Loader/工具注册表/上游事件；不写任何文件；探测仅向**已配置的**端点发一次 initialize 请求（携带已配置 headers，值永不展示）；无遥测。
  - **Troubleshooting**：`dsh web --dump-config` 检查行；启动日志 FAILED 定位；面板"未知状态"属预期（见提案）；回滚 = 移除行。
  - **License & security**：Apache-2.0；问题请提 GitHub Issue（勿在 issue 中贴密钥）。
- 改动：5 个 README 同步（EN 为源，其余忠实翻译）。
- 验收：README 目录含上述 5 节；五个语言版本章节结构一致。

### A3 · 发布基线
- 改动：`CHANGELOG.md`（0.1.0 条目：功能清单 + 已验证环境）；`git tag v0.1.0` + GitHub Release（Release Notes 从 CHANGELOG 生成）；README 安装示例改用 `#v0.1.0`（5 语言）。
- 验收：tag 存在、Release 页可访问、README 无 `#main` 安装引用。

---

## Phase 1 —— 工程化门禁

### A2 · 构建产物冒烟（`scripts/verify-artifacts.mjs`）
- 背景：曾真实踩坑（stage-3 装饰器残留进 `lib/index.js` → ESM 语法错误），当前零防回归。
- 改动：
  1. `node --check` 检查 `lib/index.js`、`lib/typert.host.js`、`lib/client.js`（语法层）。
  2. 动态 `import()` 前两者并断言导出（`apply` / `TYPERT`）。
  3. 断言 `lib/client.js` 含 `window.__ModuleLoader__.load({ id: "dsh-mcp-panel"`（banner 与 bundle id 契约）。
- 接线：`package.json` 增加 `verify:artifacts`；CI 在 build 后执行；`verify:self-contained` 保持不变。

### A1 · CI（`.github/workflows/ci.yml`）
- 矩阵：ubuntu-latest + windows-latest，node 22。
- 步骤：`pnpm/action-setup` → `pnpm install --frozen-lockfile` → `pnpm test` → `pnpm run build` → `pnpm run verify:self-contained` → `pnpm run verify:artifacts`。
- **不含 `tsc`**：typecheck 依赖 harness checkout 相对路径（见 A6 决策），在 CI 环境不可解析；此为显式记录而非遗漏。

### A6 · typecheck 边界（决策文档化，不做 vendoring）
- 证据：client 类型面的传递闭包跨 `dsh-api-remotes/client`（再导出 ~60 个跨包类型）、`dsh-client-connection/client`、`dsh-session/surface`、`react@18`、vendor cordis——手工同步的漂移成本超过收益；npm 发布版（0.0.1-rc.1）过旧且 cordis 4.0.1 类型缺 `Context.inject/plugin/get`。
- 改动：新增 `CONTRIBUTING.md`：说明 typecheck 是本地门禁、需 checkout 在固定相对位置；给出仅跑 `pnpm test && pnpm run build` 的 CI 等价路径。

### A4 · probe 网络路径单测（`tests/probe.spec.ts`）
- `vi.stubGlobal('fetch', …)` 六例：2xx+合法 initialize JSON（detail 含 server name/version 且脱敏）；2xx+非 JSON（连通成功降级）；非 2xx（`HTTP 404 …`）；网络 reject（sanitizeError 路径）；signal 已中止 → `timeout after … or cancelled`；长 serverInfo 截断（配合 C9）。
- 同时补 `probeJob`：`cancel()` 触发 abort；`done` 永不 reject。

### A5 · 客户端注册接线测试（`tests/client-registration.spec.ts`）
- 环境：加 `jsdom` devDep + `environment: 'jsdom'`（单文件级 `// @vitest-environment jsdom`）。
- fake `slots`/`locale`/`remote`（`$mount` 记录参数并 resolve）；断言：`$mount` 收到与宿主 `TYPERT` 同源的 `MCP_PANEL_REMOTE`；`slots.inject('settings.plugins.tab')` 注册 `{ id: 'mcp', locale: NS }`；注入面 `status()` 解包 `RemoteResult`（ok / error 两分支）。
- 组件级渲染测试列 P2 可选（jsdom + react-dom/client + act）。

### A7 · dependabot（`.github/dependabot.yml`）
- weekly；`zod`、`tsdown`、`typescript`、`vitest`、`@types/node`；open-pull-requests-limit 5。

### B6 · 探测记录上限
- `src/config.ts` 增加 `maxProbes: number`（默认 10）；`McpPanelService.probeViews()` 只取最近 N 条；`resolveConfig` 同步校验。

### B7 · 上游事件陈旧度
- `src/wire.ts`：`McpServerView` 增加 `observedAt: number | null`（事件接收时刻，service 在 `observe()` 记 `Date.now()`）；zod schema、`aggregate.ts`、`tests/aggregate.spec.ts`、`present.ts`（注入 `now` 参数保持纯函数）、面板「最后事件 N 秒前」与测试一次性连带变更。

### C6/C7/C8/C9 · 打磨小项（与 Phase 1 同批）
- C6：`styles.ts` 增加 `.dmcp-card-content:focus-visible` 可见焦点。
- C7：面板 detail 行增加 `attempt x/y`（复用 `view.attempt/maxAttempts`，`-1` 显示 `—`）。
- C8：`THIRD_PARTY_NOTICES.md`（zod v4，MIT，内联于 host/client bundle 的归属声明）。
- C9：probe detail 的 serverInfo name/version 截断（如 80 字符）。

---

## Phase 2 —— 产品能力

### B1 · 面板轮询刷新
- `src/config.ts` 增加 `refreshIntervalMs`（默认 0 = 关闭，>0 轮询）；`cordis.patch.yml` 与 README Config 表同步。
- `McpPanelTab.tsx`：`useEffect` 按 interval 重取；保持 presenter 纯函数不动；locale 无需新增。

### B3 · 面板「探测」按钮
- Host：`McpPanelService` 增加第二个 remote 方法 `probe(serverName)`（复用 `rawEndpoint` + `probeJob`；`ctx.get('jobs')` 缺失时抛明确错误）；`src/wire.ts` 增加第二个 `InvocationDescriptor`（参数 `serverName: string`，strict codec；结果 `{ jobId, note }`）；`src/typert.host.ts` 与 `src/client/remote.ts` 同步登记 + `TypertRemoteMap` 合并。
- Client：tab 中 streamable-http 行加「探测」按钮 → 调 remote → 立即重取快照（结果仍 panel-only）；`mcp_probe` 工具保持不动。
- 测试：descriptor 双登记一致性断言；probe remote 的 jobs 缺失分支。

### B5 · 工具过滤框
- `McpPanelTab.tsx`：工具区加 `<input type="search">`（plugin-inventory 模式），过滤 public name/description；locale 加 `filterTools` 键（zh/en）。

### B4 · /mcp 输出 i18n
- `src/config.ts` 增加 `outputLanguage: 'en' | 'zh'`（默认 en）；`src/command.ts` 的 renderers 改为接受消息字典参数；新增 `tests/command-i18n.spec.ts`（同一快照两种语言输出断言）。

### B2 · 被动周期探测（可选，默认关）
- `src/config.ts`：`passiveProbe: { enabled: false, intervalMs: 60000 }`。
- 语义隔离：wire 增加 `probeState: 'reachable' | 'unreachable' | null` + `probeCheckedAt: number | null`（**不覆盖** `phase`——探测可达性 ≠ 客户端自身连接状态）；zod/aggregate/presenter/locale 连带；host 侧 effect-scoped `setInterval`（`timer.unref`）。
- 验收：默认关闭时行为零变化；开启后 http 行新增独立 probe 徽标。

---

## 5. 风险与已否决项

### 5.1 已否决：typecheck 类型面 vendoring（A6）
闭包证据（2026-08-14 实测）：`dsh-client-runtime/client` 直接依赖 `dsh-api-remotes/client`、`dsh-client-connection/client`、`dsh-session/surface`，其中 `dsh-api-remotes/client` 再导出约 60 个跨包类型——完整同步需要逐文件跟进 harness 版本，漂移风险与维护成本远超收益。CI 采用「test + build + 产物冒烟」门禁；typecheck 保留为 checkout 侧本地门禁并写入 CONTRIBUTING。

### 5.2 诚实性约束（所有探测类改动共用）
任何新增状态观测（B2/B3）都只添加**独立字段/来源标注**，绝不改写 `phase` 或把 `statusSource` 从 `derived` 伪装成 `upstream-event`。

---

## 6. 实施顺序与依赖

```
Phase 0（C1 → C2 → C3 → A3）          ← 先修 bug 再发 tag
Phase 1（A2 → A1 → A4/A5/A7 + B6/B7 + C6–C9）
Phase 2（B1 → B3 → B5 → B4 → B2）
```

- C1 必须早于 A3（tag 不应包含已知 bug）。
- A1 依赖 A2（workflow 引用 verify:artifacts）。
- B7 是一次 wire 连带变更（zod/aggregate/presenter/tests 一个 commit 内完成）。
- 每项完成后跑：`pnpm run typecheck && pnpm test && pnpm run build && pnpm run verify:self-contained && pnpm run verify:artifacts`；命令输出变更用 `scripts/verify-headless.mjs` 回归。

## 7. 总体结论

22 项中 21 项可直接实施；唯一受阻项（A6 typecheck 进 CI）已给出明确否决理由与替代方案。建议按 Phase 0 → 1 → 2 顺序推进，每阶段一个 PR、一条 CHANGELOG 条目；Phase 0 合并后打 `v0.1.0`。
