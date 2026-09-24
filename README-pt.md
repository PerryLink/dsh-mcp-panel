<div align="center">

# dsh-mcp-panel
- **Canal 1024 store**: `npm i -g dsh1024` uma vez, depois `dsh1024 plugin --profile web add dsh-mcp-panel` (conta para o ranking de instalações do [deepseek1024.com](https://deepseek1024.com)).

**O console de gerenciamento MCP para o cliente MCP oficial do DeepSeek Harness: adicione, edite, remova e teste servidores MCP numa página de configurações, com status honesto, diagnósticos de saúde e gravações de perfil seguras e reversíveis.**

*Cliente oficial = ponte, este plugin = console: leia o status pelo seam `mcp/status`, escreva apenas patches de perfil somente-anexar e com aprovação.*

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Gitee](https://img.shields.io/badge/Gitee-mirror-c71d23?logo=gitee)](https://gitee.com/perrylink/dsh-mcp-panel)
[![DSH plugin](https://img.shields.io/badge/dsh--plugin-✅-green)](https://github.com/topics/dsh-plugin)
[![dsh-doctor](https://raw.githubusercontent.com/PerryLink/dsh-plugin-doctor/main/badges/PerryLink__dsh-mcp-panel.svg)](https://github.com/PerryLink/dsh-plugin-doctor#verified-徽章)
[![DSH Market](https://raw.githubusercontent.com/2BingLing/dsh-market/master/assets/readme/badge-top-rated.svg)](https://dsh.market/)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-brightgreen.svg)](#)
[![CI](https://img.shields.io/github/actions/workflow/status/PerryLink/dsh-mcp-panel/ci.yml?branch=main&label=CI)](https://github.com/PerryLink/dsh-mcp-panel/actions)
[![Version](https://img.shields.io/github/v/tag/PerryLink/dsh-mcp-panel?label=version)](https://github.com/PerryLink/dsh-mcp-panel/releases)
[![npm version](https://img.shields.io/npm/v/dsh-mcp-panel)](https://www.npmjs.com/package/dsh-mcp-panel)
[![npm downloads](https://img.shields.io/npm/dm/dsh-mcp-panel)](https://www.npmjs.com/package/dsh-mcp-panel)
[![dshfind](https://dshfind.com/api/badge/PerryLink/dsh-mcp-panel?metric=downloads&lang=pt)](https://dshfind.com/pt/plugins/PerryLink/dsh-mcp-panel?ref=badge)

[English](README.md) · [简体中文](README-zh.md) · [Español](README-es.md) · [Português](README-pt.md) · [हिन्दी](README-hi.md)

</div>

---

## Compatibility

| Superfície | Status |
|---|---|
| Harness | DeepSeek Harness `dsh-v0.1.7-rc.1` (verificado em 2026-09-24): as duas réguas de typecheck verdes na face `0.1.6-alpha.2` (este repositório é o canário da família: nenhum erro novo apareceu), 174 testes e a cadeia completa de portas (typecheck / typecheck:ci / test / build / verify / package). A re-verificação do `writePatch` vale nesta linha. Linha de base anterior: `dsh-v0.1.7-alpha.1` (verificado em 2026-09-16). |
| Node | `^22.19.0 \|\| >=24.0.0` |
| Plataformas | Web GUI (duas faces: host + navegador) |
| Modelo | Qualquer (o painel é somente leitura; só a saída de `/mcp` é legível pelo modelo) |

## What you get

O `dsh-mcp-panel` é a camada de experiência sobre o cliente MCP oficial: uma visão de runtime somente leitura mais gravações de perfil seguras e reversíveis.

- **Comando `/mcp`** — uma linha por servidor: transporte, destino, contagem de ferramentas, status de conexão (do seam upstream; `unknown` quando não observado), último erro, reconexões — legível pelo modelo, reconstruível do log da sessão, cinco idiomas de saída.
- **`/mcp <servidor> tools`** — nomes e descrições das ferramentas `mcp__*` visíveis para o modelo.
- **`/mcp <servidor> health`** — sugestões de autorreparo derivadas (ENOENT → dependência ausente, ECONNREFUSED, timeouts, 401/403/404, DNS, rate limit, reconexão esgotada…); código de saída / cauda de stderr rotulados honestamente como *aguardando suporte upstream*.
- **`/mcp <servidor> call <tool> [json]`** — chamada de teste pelo **pipeline oficial de ferramentas** (`ctx.tools.execute()`); política de permissão pré-execução, aprovação, guards e pós-execução, tudo em vigor.
- **Configurações → Plugins → MCP** — cartões de status com selos, diagnósticos e sondas, mais o CRUD de servidores e o banco de testes de ferramentas.
- **CRUD de servidores** — formulários de adicionar/editar/remover → `insert` para adicionar e anulações dirigidas por id (`- id:` + `name:` + `disabled:`/`config:`) para editar/remover → cópia para a área de transferência ou gravação com aprovação, backups automáticos e re-verificação contra o loader.
- **Navegação de Resources** — listagem de recursos, listagem de templates e leituras de URI somente leitura pelas ferramentas oficiais `list_mcp_resources` / `list_mcp_resource_templates` / `read_mcp_resource` (ponteadas pelo serviço `@deepseek-ai/dsh-mcp-resources`); os resultados aparecem apenas na aba, nunca no contexto do modelo.
- **Banco de testes de ferramentas** — servidor → ferramenta `mcp__*` → argumentos JSON → resultado JSON canônico + conteúdo renderizado; limitado por `trialMaxResultChars`; somente painel, nunca contexto do modelo.

## Architecture: official client = bridge, this plugin = console

O [`@deepseek-ai/dsh-mcp-client`](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/mcp/mcp-client) é a **única ponte**: uma instância por servidor MCP, configurada como linha escrita à mão no `cordis.yml`, que conecta o transporte, sincroniza ferramentas e registra os nomes `mcp__<servidor>__<ferramenta>`. Este plugin nunca a substitui: é a **camada de experiência** por cima:

```text
                    ┌────────────────────────────────────────────┐
 profile            │  cordis.yml / cordis.patch.yml             │
 composição         │   - id: mcp-github                          │
 (uma linha por     │     name: '@deepseek-ai/dsh-mcp-client'     │
  servidor, à mão)  │     config: { serverName, transport, … }    │
                    │   - id: mcp-panel                           │
                    │     name: dsh-mcp-panel   ◄── este plugin   │
                    └───────────────┬────────────────────────────┘
                                    │
        ┌───────────────────────────┴───────────────────────────┐
        │                                                        │
   ┌────▼──────────────┐        ┌───────────────────────────┐    │
   │ @deepseek-ai/dsh- │        │ dsh-mcp-panel (console)   │    │
   │ mcp-client        │        │                           │    │
   │ • transporte      │        │ • comando /mcp            │    │
   │ • sincronização   │        │ • Configurações → Plugins │    │
   │ • ferramentas     │◄──────►│   → MCP: CRUD, banco de   │    │
   │ • seam mcp/status │ status │ • diagnósticos de saúde   │    │
   └───────────────────┘        │ • sondas, capacidades     │    │
                                └───────────────────────────┘    │
```

O console **lê** o cliente pelo seu seam de observabilidade `mcp/status` (evento + serviço de consulta `mcpStatus`), pelo registro de ferramentas e pelo loader; **escreve** apenas na camada de patches do perfil — somente-anexar, com aprovação e sempre com backup. Transporte, OAuth e protocolo permanecem intocados.

## Console vs. hand-written cordis.yml

| | cordis.yml à mão | Console dsh-mcp-panel |
|---|---|---|
| Adicionar servidor | Editar YAML, cuidar indentação/aspas | Formulário → fragmento de patch → **copiar** ou **gravar** (aprovação + backup) |
| Editar servidor | Editar YAML, reiniciar/recarga a quente | Formulário pré-preenchido da linha ao vivo; segredos inalterados preservam o valor no host |
| Remover servidor | Apagar a linha | Anulação `- id:` + `disabled: true` (o vocabulário de patches não tem remove) — re-habilitável |
| Ver status | Ler logs | Selos + reconexões + último erro, ao vivo do `mcp/status` |
| Testar uma ferramenta | Pedir ao modelo | Banco de testes → pipeline oficial `ctx.tools.execute()` (permissões e aprovação em vigor) |
| Diagnosticar falhas | grep de logs | `/mcp <servidor> health` com sugestões derivadas |
| Erros | Reverter à mão | Cada gravação é somente-anexar e deixa um backup com marca de tempo |

A saída do console É o vocabulário do `cordis.patch.yml` — as mesmas linhas que você escreveria à mão, geradas, pré-visualizadas e aplicadas com segurança.

## Quick start

```sh
# 1. instale o bundle no seu perfil
dsh plugin --profile web add "github:PerryLink/dsh-mcp-panel#main"

# ou do npm (versões publicadas)
dsh plugin --profile web add dsh-mcp-panel

# 2. reinicie e verifique a linha
dsh --profile web --dump-config | grep -A3 'id: mcp-panel'
```

Depois abra **Configurações → Plugins → MCP**, ou execute:

```text
/mcp
/mcp everything tools
/mcp everything health
/mcp everything call echo '{"message": "hi"}'
```

## Install & uninstall

- **Canal git** (último `main`): `dsh plugin --profile web add "github:PerryLink/dsh-mcp-panel#main"` — o script `prepare` constrói apenas com dependências de produção.
- **Canal npm** (versões publicadas): `dsh plugin --profile web add dsh-mcp-panel`.
- **Canal tarball**: `pnpm pack` neste repo, depois `dsh plugin --profile web add ./dsh-mcp-panel-<version>.tgz`.
- **Desinstalar**: remova a linha `mcp-panel` do `cordis.patch.yml` (a superfície web a recarrega em quente), apague o pacote do `node_modules` do perfil e verifique com `dsh web --dump-config` que não reste nenhuma linha `mcp-panel`.

## Configuration

Todas as opções são campos Schemastery `Config` (modificáveis a partir do cordis.yml). O `cordis.patch.yml` documenta cada chave.

| Chave | Padrão | Significado |
|---|---|---|
| `probeEnabled` | `true` | Registra a ferramenta `mcp_probe` (resultados somente do painel) |
| `probeTimeoutMs` | `10000` | Prazo por sonda em ms |
| `maxProbes` | `10` | Registros de sonda mostrados no painel |
| `refreshIntervalMs` | `0` | Atualização sugerida do painel em ms; `0` = sob demanda |
| `outputLanguage` | `en` | Idioma de saída do `/mcp`: `en \| zh \| es \| pt \| hi` |
| `passiveProbeEnabled` | `false` | Sondear periodicamente servidores streamable-http |
| `passiveProbeIntervalMs` | `60000` | Intervalo de sonda passiva em ms |
| `trialEnabled` | `true` | Banco de testes de ferramentas (aba de configurações + `/mcp call`) |
| `trialTimeoutMs` | `120000` | Prazo do painel por chamada de teste em ms |
| `trialMaxResultChars` | `60000` | Teto do payload do resultado de teste em caracteres |
| `writeEnabled` | `true` | Interruptor de segurança: `false` rejeita toda gravação (copiar continua funcionando) |
| `writeVerifyEnabled` | `true` | Re-verifica cada gravação contra o estado re-aplicado do loader antes de reportar sucesso |
| `writeVerifyTimeoutMs` | `3000` | Orçamento de sondagem para a verificação de gravação em ms |
| `backupCount` | `5` | Backups de `cordis.patch.yml` retidos por gravação |
| `catalogEntries` | `[]` | Sobreposição do usuário para o diretório recomendado: anexa entradas; uma entrada com o mesmo `id` substitui a integrada |

## Tools & surfaces

| Superfície | Tipo | Notas |
|---|---|---|
| `/mcp` | command | Linha de status por servidor; legível pelo modelo e reconstruível do log |
| `/mcp <servidor> tools` | command | Nomes + descrições de `mcp__*` visíveis para o modelo |
| `/mcp <servidor> health` | command | Sugestões de autorreparo derivadas do texto de erro saneado |
| `/mcp <servidor> call <tool> [json]` | command | Chamada de teste pelo pipeline oficial de ferramentas |
| `mcp_probe` | tool | Sonda opcional de conectividade Streamable HTTP (trabalho em segundo plano) |
| Configurações → Plugins → MCP | Slot de UI | Cartões de status, CRUD de servidores e banco de testes |
| Remote Typert `mcpPanel` | service | Canal de instantâneas somente leitura (host → cliente) |

## Resources & Prompts

Resources JÁ são ponteados upstream: o bundle base monta `@deepseek-ai/dsh-mcp-resources`, o cliente oficial registra o provider de recursos de cada conexão em `ctx.mcpResources`, e esse pacote possui as três ferramentas compartilhadas (`list_mcp_resources`, `list_mcp_resource_templates`, `read_mcp_resource`). O console detecta o serviço e as ferramentas registradas, e oferece um navegador de Resources somente leitura (lista / templates / leitura de URI) em cada cartão de servidor — cada chamada passa pelo pipeline OFICIAL de ferramentas e os resultados nunca entram no contexto do modelo.

**Templates de prompts** e **assinaturas de recursos** permanecem adiados upstream; o painel de capacidades marca Prompts **aguardando suporte upstream**.

## Permissions & data

- **Permissões**: o manifesto `dshWorkshop` declara `network:outbound` e `native-code:none`.
- **Dados**: o painel é somente leitura; grava apenas fragmentos de `cordis.patch.yml` somente-anexar (com aprovação, backup primeiro). Credenciais em URLs, senhas userinfo, valores de headers, tokens bearer e JWTs são redigidos antes de renderizar; os `headers` configurados nunca entram em nenhuma instantânea, e os **valores** de env/headers nunca saem do host (o editor vê apenas chaves).

## Security boundaries

- **A ponte continua sendo a ponte.** Sem mudanças de transporte, OAuth ou protocolo; uma linha mcp-client por servidor, exatamente como à mão.
- **Sem status falso.** Campos de conexão sem observações upstream leem `unknown` / `—` com `statusSource: 'derived'`; códigos de saída e stderr nunca são inventados.
- **Gravações somente-anexar, com aprovação e backup.** O console nunca reescreve o `cordis.patch.yml`; anexa operações geradas, conserva os `backupCount` backups mais recentes e re-verifica cada gravação contra o estado re-aplicado do loader antes de reportar sucesso (um patch omitido nunca aparece como sucesso).
- **Sem injeção de prompts.** O painel não registra seções de prompt; seu único texto visível ao modelo são as duas descrições de ferramenta/comando.

## Known limitations

- **Templates de prompts e assinaturas de recursos** aguardam suporte upstream — o cliente oficial pontua ferramentas e recursos, mas não prompts nem assinaturas.
- **Códigos de saída / caudas de stderr** são rotulados *aguardando suporte upstream* até o cliente expô-los.
- **Painel somente leitura** — o console nunca falsifica um estado de conexão; campos não observáveis leem `unknown` / `-1` / `—`.
- **Gravações são verificadas, não garantidas** — o console re-verifica cada gravação contra o estado re-aplicado do loader e falha honestamente quando o loader não a aplicou (ex.: uma linha inserida por `$DSH_HOME/cordis.patch.yml`, que um patch de camada de perfil não alcança).

## Development

```sh
pnpm run typecheck && pnpm run typecheck:ci && pnpm test && pnpm run build && pnpm run verify:self-contained && pnpm run verify:artifacts && pnpm pack
```

O `scripts/verify-headless.mjs` inicia o perfil web real e imprime a saída exata de `/mcp`. Publicação: `node scripts/release.mjs <x.y.z>` executa a porta completa, faz commit e etiqueta `v<x.y.z>` localmente (nunca empurra).

## Topics

`dsh`, `dsh-plugin`, `deepseek-harness`, `deepseek`, `cordis`, `mcp`, `mcp-client`, `observability`, `panel`

## Contributors

- [@PerryLink](https://github.com/PerryLink) — criador e mantenedor.
- [@xiaoyuyu6420](https://github.com/xiaoyuyu6420) — diagnosticou as devDependencies de client ausentes por trás das falhas de build em checkouts limpos (PR #5).
- [@feiler0](https://github.com/feiler0) — contribuiu com a sonda de servidores MCP stdio (um handshake MCP initialize via stdin/stdout) (PR #7, mesclada como PR #15).

## PerryLink DSH Plugin Family

This project is one of the **45 DeepSeek Harness plugins** maintained by [PerryLink](https://github.com/PerryLink). If this one helps you, the others likely will too:

| Plugin | One-liner |
|---|---|
| **[dsh-auto-review](https://github.com/PerryLink/dsh-auto-review)** | Second-model auto-review on the approval chain, fail-closed by default | |
| **[dsh-autotier](https://github.com/PerryLink/dsh-autotier)** | Automatic strong/cheap model-tier routing with deterministic risk guards and a `/tier` command | |
| **[dsh-background-agents](https://github.com/PerryLink/dsh-background-agents)** | Durable background child agents with a Web UI sidebar, messaging and interrupt | |
| **[dsh-budget](https://github.com/PerryLink/dsh-budget)** | Cost governance for DeepSeek Harness: budgets, carbon, and latency in one panel. | |
| **[dsh-catalog](https://github.com/PerryLink/dsh-catalog)** | DSH Desktop Market standard catalog source for the PerryLink family | |
| **[dsh-cert-mcp](https://github.com/PerryLink/dsh-cert-mcp)** | Read-only MCP server exposing the certification registry: grades, snapshots and five-dimension evidence | |
| **[dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-checkpoint-rewind)** | Claude Code /rewind-equivalent: snapshots, session forks, one-shot restore | |
| **[dsh-claude-move](https://github.com/PerryLink/dsh-claude-move)** | Migrate Claude Code sessions, memory, skills and CLAUDE.md into DSH | |
| **[dsh-click](https://github.com/PerryLink/dsh-click)** | Cross-platform native desktop control for DeepSeek Harness — Windows first. | |
| **[dsh-composer-history](https://github.com/PerryLink/dsh-composer-history)** | Terminal-style input history for the web composer: arrows, Ctrl+R search | |
| **[dsh-data-quality](https://github.com/PerryLink/dsh-data-quality)** | Dataset quality checks and citation cross-checks (the optional numeric bridge consumed here) | |
| **[dsh-defend](https://github.com/PerryLink/dsh-defend)** | Prompt-injection, jailbreak, and secret-leak defense for DeepSeek Harness. | |
| **[dsh-doublecheck](https://github.com/PerryLink/dsh-doublecheck)** | Engineering-discipline guard: requirements grill, test gates, adversary review | |
| **[dsh-draw](https://github.com/PerryLink/dsh-draw)** | Unified static-image generation routing for DeepSeek Harness. | |
| **[dsh-fast](https://github.com/PerryLink/dsh-fast)** | Read-only performance diagnostics for DeepSeek Harness. | |
| **[dsh-fund-research](https://github.com/PerryLink/dsh-fund-research)** | Deterministic research reports for Chinese public mutual funds | |
| **[dsh-github](https://github.com/PerryLink/dsh-github)** | GitHub PR/issues integration for DSH, every write gated by approval | |
| **[dsh-industry-research](https://github.com/PerryLink/dsh-industry-research)** | Industry research orchestration that seals its deliverables through this plugin's `ctx.researchReport.assemble` | |
| **[dsh-laya](https://github.com/PerryLink/dsh-laya)** | Laya typed decisions (`noul`/`choice`/`score`) as a first-class Cordis service and model-visible tools | |
| **[dsh-library](https://github.com/PerryLink/dsh-library)** | Local document knowledge base for DeepSeek Harness. | |
| **[dsh-local-ai](https://github.com/PerryLink/dsh-local-ai)** | Local-model (Ollama) integration for DeepSeek Harness. | |
| **[dsh-lsp-actions](https://github.com/PerryLink/dsh-lsp-actions)** | LSP diagnostics, formatting, completion, code actions and rename over language servers | |
| **[dsh-mask](https://github.com/PerryLink/dsh-mask)** | PII masking middleware: anonymize at the model boundary, restore at the display layer | |
| **[dsh-mcp-panel](https://github.com/PerryLink/dsh-mcp-panel)** | Read-only MCP runtime panel: /mcp command + Settings tab with status, tools and errors | |
| **[dsh-memento](https://github.com/PerryLink/dsh-memento)** | Approval-gated cross-session memory: ctx.memory seam + SQLite + memory tool | |
| **[dsh-observe](https://github.com/PerryLink/dsh-observe)** | OpenTelemetry and Langfuse observability exporter for DeepSeek Harness. | |
| **[dsh-output-styles](https://github.com/PerryLink/dsh-output-styles)** | Claude Code outputStyles-equivalent runtime style switching | |
| **[dsh-permission-rules](https://github.com/PerryLink/dsh-permission-rules)** | Claude Code-style declarative allow/deny/ask permission rules with audit | |
| **[dsh-plugin-certification](https://github.com/PerryLink/dsh-plugin-certification)** | Community certification registry with repro-checkable grades and badges | |
| **[dsh-plugin-doctor](https://github.com/PerryLink/dsh-plugin-doctor)** | Zero-dependency static + sandbox smoke detector for DSH plugins | |
| **[dsh-plugin-guide](https://github.com/PerryLink/dsh-plugin-guide)** | Plugin-development knowledge base as an on-demand agent skill | |
| **[dsh-plugin-kit](https://github.com/PerryLink/dsh-plugin-kit)** | Shared zero-runtime-dependency toolkit for the PerryLink DSH plugins | |
| **[dsh-plugin-upgrade](https://github.com/PerryLink/dsh-plugin-upgrade)** | One-package, one-corridor-index plugin upgrade skill: routes a repository to the matching closed corridor card | |
| **[dsh-plugin-upgrade-015](https://github.com/PerryLink/dsh-plugin-upgrade-015)** | Merged `0.1.3-alpha.1` → `0.1.5-rc.1` upgrade corridor card plus a zero-dependency seam scanner | |
| **[dsh-reach](https://github.com/PerryLink/dsh-reach)** | Multi-channel approval/question bridge: WeChat/Telegram/Feishu, session console | |
| **[dsh-research-report](https://github.com/PerryLink/dsh-research-report)** | Verifiable research-report engine: content-addressed evidence ledger and sealed versions | |
| **[dsh-score](https://github.com/PerryLink/dsh-score)** | Multi-dimensional quality scoring for DeepSeek Harness plugins. | |
| **[dsh-session-pin](https://github.com/PerryLink/dsh-session-pin)** | Pin sessions in the Web sidebar with durable ordering | |
| **[dsh-session-sync](https://github.com/PerryLink/dsh-session-sync)** | Cross-device session sync for DeepSeek Harness — a dedicated git mirror of your session store. | |
| **[dsh-skill-pack-security](https://github.com/PerryLink/dsh-skill-pack-security)** | Security-audit skill pack: secret scan, dependency and supply-chain review | |
| **[dsh-talk](https://github.com/PerryLink/dsh-talk)** | Voice-first session loop for DeepSeek Harness: talk to it, hear it answer. | |
| **[dsh-team-rooms](https://github.com/PerryLink/dsh-team-rooms)** | Cross-session team rooms: shared message bus, task board and timeline | |
| **[dsh-test-drive](https://github.com/PerryLink/dsh-test-drive)** | Isolated install-and-smoke test drives for DeepSeek Harness plugins. | |
| **[dsh-ticktick](https://github.com/PerryLink/dsh-ticktick)** | TickTick/Dida365 task bridge: session-header panel + 11 tools | |
| **[dsh-translate](https://github.com/PerryLink/dsh-translate)** | Vendor parameter translation and deterministic JSON repair for DeepSeek Harness. | |


## License

[Apache License 2.0](LICENSE) © 2026 contribuidores do dsh-mcp-panel

### Instalar a partir do mercado do DSH Desktop

Todos os plugins PerryLink podem ser explorados no mercado integrado do DSH Desktop: **Market → Sources → add source → colar** `https://perrylink-dsh-catalog.perrylink.workers.dev/catalog-source.json` **→ selecionar**. A instalação continua passando pela verificação de identidade npm do mercado e pela sua confirmação.
