<div align="center">

# dsh-mcp-panel
- **Canal 1024 store**: `npm i -g dsh1024` uma vez, depois `dsh1024 plugin --profile web add dsh-mcp-panel` (conta para o ranking de instalações do [deepseek1024.com](https://deepseek1024.com)).

**O console de gerenciamento MCP para o cliente MCP oficial do DeepSeek Harness: adicione, edite, remova e teste servidores MCP numa página de configurações, com status honesto, diagnósticos de saúde e gravações de perfil seguras e reversíveis.**

*Cliente oficial = ponte, este plugin = console: leia o status pelo seam `mcp/status`, escreva apenas patches de perfil somente-anexar e com aprovação.*

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

| Superfície | Status |
|---|---|
| Harness | DeepSeek Harness `0.1.1-rc.2`–`0.2.0` 0.1.2-alpha.3 (adaptado em 2026-09-01): o envelope de sessão mantém seu campo ignorable apenas para compatibilidade de leitura de logs armazenados - o Session.append ainda não consegue estampá-lo, então o comportamento da porta não muda. |
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
- **CRUD de servidores** — formulários de adicionar/editar/remover → fragmentos `insert`/`set`/`set disabled` → cópia para a área de transferência ou gravação com aprovação e backups automáticos.
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
| Remover servidor | Apagar a linha | Operação `set disabled: true` (o vocabulário de patches não tem remove) — re-habilitável |
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

O cliente oficial documenta que *"Tools are the only bridged MCP capability"* — Resources e Prompts estão adiados. O console detecta um seam de catálogo proposto e exibirá listas somente leitura no dia em que for enviado; até lá o painel de capacidades marca ambos **aguardando suporte upstream**.

## Permissions & data

- **Permissões**: o manifesto `dshWorkshop` declara `network:outbound` e `native-code:none`.
- **Dados**: o painel é somente leitura; grava apenas fragmentos de `cordis.patch.yml` somente-anexar (com aprovação, backup primeiro). Credenciais em URLs, senhas userinfo, valores de headers, tokens bearer e JWTs são redigidos antes de renderizar; os `headers` configurados nunca entram em nenhuma instantânea, e os **valores** de env/headers nunca saem do host (o editor vê apenas chaves).

## Security boundaries

- **A ponte continua sendo a ponte.** Sem mudanças de transporte, OAuth ou protocolo; uma linha mcp-client por servidor, exatamente como à mão.
- **Sem status falso.** Campos de conexão sem observações upstream leem `unknown` / `—` com `statusSource: 'derived'`; códigos de saída e stderr nunca são inventados.
- **Gravações somente-anexar, com aprovação e backup.** O console nunca reescreve o `cordis.patch.yml`; anexa operações geradas e conserva os `backupCount` backups mais recentes.
- **Sem injeção de prompts.** O painel não registra seções de prompt; seu único texto visível ao modelo são as duas descrições de ferramenta/comando.

## Known limitations

- **Resources e Prompts** aguardam suporte upstream — o cliente oficial só pontua ferramentas.
- **Códigos de saída / caudas de stderr** são rotulados *aguardando suporte upstream* até o cliente expô-los.
- **Painel somente leitura** — o console nunca falsifica um estado de conexão; campos não observáveis leem `unknown` / `-1` / `—`.

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

Este projeto é um dos [33 plugins de DeepSeek Harness](https://github.com/PerryLink) mantidos por [PerryLink](https://github.com/PerryLink). Se este ajuda você, os outros provavelmente também:

| Plugin | One-liner |
|---|---|
| **[dsh-dsh-auto-review](https://github.com/PerryLink/dsh-dsh-auto-review)** | Auto-revisão de segundo modelo na cadeia de aprovação, com falha fechada por padrão | |
| **[dsh-dsh-background-agents](https://github.com/PerryLink/dsh-dsh-background-agents)** | Agentes filhos em segundo plano duráveis com barra lateral de UI web, mensagens e interrupção | |
| **[dsh-dsh-budget](https://github.com/PerryLink/dsh-dsh-budget)** | Governança de custos para DeepSeek Harness: orçamentos, carbono e latência em um painel. | |
| **[dsh-dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-dsh-checkpoint-rewind)** | Equivalente ao /rewind do Claude Code: instantâneos, bifurcações de sessão, restauração de uso único | |
| **[dsh-dsh-claude-move](https://github.com/PerryLink/dsh-dsh-claude-move)** | Migre sessões, memória, habilidades e CLAUDE.md do Claude Code para o DSH | |
| **[dsh-dsh-click](https://github.com/PerryLink/dsh-dsh-click)** | Controle de desktop nativo multiplataforma para DeepSeek Harness — Windows primeiro. | |
| **[dsh-dsh-composer-history](https://github.com/PerryLink/dsh-dsh-composer-history)** | Histórico de entrada estilo terminal para o compositor web: setas, busca Ctrl+R | |
| **[dsh-dsh-data-quality](https://github.com/PerryLink/dsh-dsh-data-quality)** | Verificações de qualidade de datasets e verificação de citações (a ponte numérica opcional consumida aqui) | |
| **[dsh-dsh-defend](https://github.com/PerryLink/dsh-dsh-defend)** | Defesa contra injeção de prompt, jailbreak e vazamento de segredos para DeepSeek Harness. | |
| **[dsh-dsh-doublecheck](https://github.com/PerryLink/dsh-dsh-doublecheck)** | Guardião de disciplina de engenharia: sabatina de requisitos, portões de teste, revisão adversária | |
| **[dsh-dsh-draw](https://github.com/PerryLink/dsh-dsh-draw)** | Roteamento unificado de geração de imagens estáticas para DeepSeek Harness. | |
| **[dsh-dsh-fast](https://github.com/PerryLink/dsh-dsh-fast)** | Diagnóstico de desempenho só de leitura para DeepSeek Harness. | |
| **[dsh-dsh-fund-research](https://github.com/PerryLink/dsh-dsh-fund-research)** | Relatórios de pesquisa deterministas para fundos mútuos públicos chineses | |
| **[dsh-dsh-github](https://github.com/PerryLink/dsh-dsh-github)** | Integração de PR/issues do GitHub para o DSH, cada escrita controlada por aprovação | |
| **[dsh-dsh-industry-research](https://github.com/PerryLink/dsh-dsh-industry-research)** | Orquestração de pesquisa setorial que sela as suas entregas através do `ctx.researchReport.assemble` deste plugin | |
| **[dsh-dsh-library](https://github.com/PerryLink/dsh-dsh-library)** | Base de conhecimento documental local para DeepSeek Harness. | |
| **[dsh-dsh-local-ai](https://github.com/PerryLink/dsh-dsh-local-ai)** | Integração de modelos locais (Ollama) para DeepSeek Harness. | |
| **[dsh-dsh-lsp-actions](https://github.com/PerryLink/dsh-dsh-lsp-actions)** | Diagnósticos, formatação, autocompletar, ações de código e renomeação LSP sobre servidores de linguagem | |
| **[dsh-dsh-mask](https://github.com/PerryLink/dsh-dsh-mask)** | Middleware de mascaramento de PII: anonimiza no limite do modelo, restaura na camada de exibição | |
| **[dsh-dsh-memento](https://github.com/PerryLink/dsh-dsh-memento)** | Memória entre sessões controlada por aprovação: costura ctx.memory + SQLite + ferramenta de memória | |
| **[dsh-dsh-observe](https://github.com/PerryLink/dsh-dsh-observe)** | Exportador de observabilidade OpenTelemetry e Langfuse para DeepSeek Harness. | |
| **[dsh-dsh-output-styles](https://github.com/PerryLink/dsh-dsh-output-styles)** | Troca de estilo em tempo de execução equivalente ao outputStyles do Claude Code | |
| **[dsh-dsh-permission-rules](https://github.com/PerryLink/dsh-dsh-permission-rules)** | Regras de permissão declarativas allow/deny/ask estilo Claude Code com auditoria | |
| **[dsh-dsh-plugin-guide](https://github.com/PerryLink/dsh-dsh-plugin-guide)** | Base de conhecimento de desenvolvimento de plugins como habilidade de agente sob demanda | |
| **[dsh-dsh-research-report](https://github.com/PerryLink/dsh-dsh-research-report)** | Motor de relatórios de pesquisa verificáveis com evidência endereçada por conteúdo | |
| **[dsh-dsh-score](https://github.com/PerryLink/dsh-dsh-score)** | Pontuação de qualidade multidimensional para plugins de DeepSeek Harness. | |
| **[dsh-dsh-session-pin](https://github.com/PerryLink/dsh-dsh-session-pin)** | Fixe sessões na barra lateral web com ordenação durável | |
| **[dsh-dsh-session-sync](https://github.com/PerryLink/dsh-dsh-session-sync)** | Sincronização de sessões entre dispositivos para DeepSeek Harness — um espelho git dedicado do seu armazenamento de sessões. | |
| **[dsh-dsh-skill-pack-security](https://github.com/PerryLink/dsh-dsh-skill-pack-security)** | Pacote de habilidades de auditoria de segurança: varredura de segredos, revisão de dependências e cadeia de suprimentos | |
| **[dsh-dsh-talk](https://github.com/PerryLink/dsh-dsh-talk)** | Loop de sessão com voz para DeepSeek Harness: fale e ouça a resposta. | |
| **[dsh-dsh-test-drive](https://github.com/PerryLink/dsh-dsh-test-drive)** | Test drives isolados de instalação e smoke para plugins de DeepSeek Harness. | |
| **[dsh-dsh-translate](https://github.com/PerryLink/dsh-dsh-translate)** | Tradução de parâmetros entre fornecedores e reparo determinístico de JSON para DeepSeek Harness. | |

## License

[Apache License 2.0](LICENSE) © 2026 contribuidores do dsh-mcp-panel
