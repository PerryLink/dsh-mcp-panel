# dsh-mcp-panel

**Painel de gerenciamento em tempo de execução, somente leitura, para o cliente MCP oficial do DeepSeek Harness: veja status, ferramentas, erros e contadores de reconexão de cada servidor MCP sem tocar na sua configuração.**

[English](README.md) · [简体中文](README.zh.md) · [Español](README.es.md) · [Português](README.pt.md) · [हिन्दी](README.hi.md)

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![dsh-plugin](https://img.shields.io/badge/ecosystem-dsh--plugin-8b5cf6)](https://github.com/topics/dsh-plugin)
[![deepseek-harness](https://img.shields.io/badge/runtime-deepseek--harness-4f46e5)](https://github.com/deepseek-ai/deepseek-harness)

> 🔭 **Observabilidade em primeiro lugar.** [`@deepseek-ai/dsh-mcp-client`](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/mcp/mcp-client) mantém seu estado de conexão privado — apenas logs. Este plugin mostra tudo o que *consegue* observar (configuração, registro de ferramentas, estado do Loader) e diz **"unknown"** para o que não consegue, em vez de adivinhar. Ele também propõe a costura mínima que tornaria o status real: veja a [proposta upstream](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/upstream-proposal.md).

## O que você ganha

| Superfície | O que mostra |
|---|---|
| **Comando `/mcp`** | transporte, alvo, contagem de ferramentas, status de conexão, último erro, contador de reconexões — legível pelo modelo e reconstruível pelo log |
| **Configurações → Plugins → aba MCP** | o mesmo snapshot somente leitura, com selos de status, listas expansíveis de ferramentas, erros sanitizados e resultados de sondas |
| **`/mcp <server> disable\|enable`** | a linha exata de `cordis.patch.yml` a aplicar — uma *sugestão*, nunca uma escrita |
| **Ferramenta `mcp_probe`** | sonda de conectividade de uso único para Streamable HTTP como tarefa em segundo plano; resultados são **somente do painel** |

## Início rápido

```sh
dsh plugin --profile web add github:PerryLink/dsh-mcp-panel#main
```

Reinicie (ou deixe a superfície web recarregar seu `cordis.patch.yml`) e execute:

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

Instalação manual: coloque `dsh-mcp-panel` no `node_modules` do perfil (ou no
respaldo compartilhado `$DSH_HOME/profiles/node_modules`) e adicione a linha a `cordis.patch.yml`:

```yaml
- insert:
    - id: mcp-panel
      name: dsh-mcp-panel
      config:
        probeEnabled: true
        probeTimeoutMs: 10000
```

## Honestidade por contrato

- **Somente leitura.** Nenhum arquivo de configuração é gravado. `disable`/`enable` imprime uma sugestão que você aplica.
- **Sem status falso.** Campos de conexão sem dados upstream mostram `unknown` / `—`, com `statusSource: derived`.
- **Exibição sanitizada.** Credenciais em query strings, senhas userinfo, valores de cabeçalhos, tokens bearer e JWTs são removidos antes da renderização; os `headers` configurados nunca entram em nenhum snapshot.
- **Resultados somente do painel.** Os detalhes das sondas ficam na aba de configurações, nunca no contexto do modelo; `/mcp` é a superfície legível pelo modelo e é totalmente reconstruível a partir do log da sessão.
- **Sem mudanças no mcp-client.** Transporte, OAuth e protocolo permanecem intactos — a lacuna de observabilidade é coberta pela [proposta upstream](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/upstream-proposal.md), que este plugin já consome (evento tipado `mcp/status` + serviço de consulta `mcpStatus`, detectados em tempo de execução).

## Configuração

| Campo | Padrão | Descrição |
|---|---|---|
| `probeEnabled` | `true` | Registra a ferramenta `mcp_probe` (requer `ctx.jobs` na composição) |
| `probeTimeoutMs` | `10000` | Tempo limite por sonda |

## Como funciona

- **Metade host** — um serviço Typert Remote `mcpPanel` monta o snapshot a partir de três fontes somente leitura: linhas do Loader (entradas `@deepseek-ai/dsh-mcp-client`), `ctx.tools.schemas()` agrupadas pelo namespace `mcp__<server>__`, e observações upstream `mcp/status`. O manifesto `./typert` escrito à mão registra `mcpPanel/status` no gateway; o `zod` é empacotado, então a metade host é autocontida.
- **Metade navegador** — um bundle `dsh.client` (servido em `/plugins/dsh-mcp-panel/client.js`) monta o mesmo descritor via `ctx.remote.$mount` e registra uma entrada `settings.plugins.tab` somente leitura (`id: mcp`). O apresentador é uma função pura; os estilos têm escopo e usam tokens de tema.
- **O comando `/mcp`** passa pelo registro de comandos padrão — cada linha cai nos eventos de sessão `command/run` + `command/done`.

## Desenvolvimento

```sh
pnpm install
pnpm run typecheck
pnpm test          # 58 testes: extremos do sanitizador, agrupamento, tolerância de agregação, saída do comando, apresentador
pnpm run build     # declarações tsc → lib/types; tsdown → lib/index.js + lib/typert.host.js + lib/client.js
pnpm run verify:self-contained
pnpm pack
```

Verificação contra um checkout real do harness:
`node --import tsx/esm scripts/verify-headless.mjs` inicializa o perfil web completo em processo (porta efêmera) e imprime a saída exata de `/mcp`, `/mcp <server> tools` e `/mcp <server> disable`.

## Licença

[Apache License 2.0](LICENSE) © 2026 colaboradores do dsh-mcp-panel
