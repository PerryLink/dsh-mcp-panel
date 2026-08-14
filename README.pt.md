# dsh-mcp-panel

**Painel de gerenciamento em tempo de execução, somente leitura, para o cliente MCP oficial do DeepSeek Harness: veja status, ferramentas, erros e contadores de reconexão de cada servidor MCP sem tocar na sua configuração.**

[English](README.md) · [简体中文](README.zh.md) · [Español](README.es.md) · [Português](README.pt.md) · [हिन्दी](README.hi.md)

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![dsh-plugin](https://img.shields.io/badge/ecosystem-dsh--plugin-8b5cf6)](https://github.com/topics/dsh-plugin)
[![deepseek-harness](https://img.shields.io/badge/runtime-deepseek--harness-4f46e5)](https://github.com/deepseek-ai/deepseek-harness)

> 🔭 **Observabilidade em primeiro lugar.** [`@deepseek-ai/dsh-mcp-client`](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/mcp/mcp-client) mantém seu estado de conexão privado — apenas logs. Este plugin mostra tudo o que *consegue* observar (configuração, registro de ferramentas, estado do Loader) e diz **"unknown"** para o que não consegue, em vez de adivinhar. Ele também propõe a costura mínima que tornaria o status real: veja a [proposta upstream](docs/upstream-proposal.md).

## Compatibilidade

- **Runtime**: DeepSeek Harness ≥ `0.1.0-rc.5` (as peerDependencies fixam a linha `0.1.0-rc.6`).
- **Última verificação**: 2026-08-14 contra um checkout do código-fonte do deepseek-harness (pacotes do workspace em `0.1.0-rc.5`, mainline `7b9644f`) — `/mcp` headless de ponta a ponta mais um perfil web ao vivo; evidências em [docs/research-notes.zh.md](docs/research-notes.zh.md). Reverificado no mesmo dia contra mainline `47f9438` com o ramo da costura `mcp/status` (`feat/mcp-client-status-observability-seam`): uma linha real de `server-everything` mostra `status: connected (source: upstream-event)` através do plugin empacotado, além do fluxo de compatibilidade fiel ao lançador; registro em [docs/optimization-plan-v2.zh.md](docs/optimization-plan-v2.zh.md).

## O que você ganha

| Superfície | O que mostra |
|---|---|
| **Comando `/mcp`** | transporte, alvo, contagem de ferramentas, status de conexão, último erro, contador de reconexões — legível pelo modelo e reconstruível pelo log, cinco idiomas de saída (`outputLanguage: en\|zh\|es\|pt\|hi`) |
| **Configurações → Plugins → aba MCP** | o mesmo snapshot somente leitura, com selos de status, listas expansíveis de ferramentas, erros sanitizados e resultados de sondas |
| **Botão de sonda do painel** | sonda de conectividade em um clique para um servidor streamable-http a partir da aba; os resultados continuam somente do painel |
| **Sondas passivas** | selos de alcançabilidade opcionais em segundo plano por servidor, separados do status de conexão |
| **Atualização automática** | o host sugere um intervalo de atualização (`refreshIntervalMs`); a aba consulta e pausa enquanto oculta |
| **`/mcp <server> disable\|enable`** | a linha exata de `cordis.patch.yml` a aplicar — uma *sugestão*, nunca uma escrita |
| **Ferramenta `mcp_probe`** | sonda de conectividade de uso único para Streamable HTTP como tarefa em segundo plano; resultados são **somente do painel** |

## Início rápido

```sh
# canal git (compila pelo script prepare do pacote)
dsh plugin --profile web add github:PerryLink/dsh-mcp-panel#v0.2.0
# canal npm (tarball publicado, sem aprovação de compilação)
dsh plugin --profile web add dsh-mcp-panel@0.2.0
```

Reinicie (ou deixe a superfície web recarregar seu `cordis.patch.yml`) e execute:

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

### Desinstalação

1. Remova a linha `mcp-panel` de `cordis.patch.yml` (a superfície web a recarrega em quente; outras superfícies reiniciam).
2. Apague o pacote do `node_modules` do perfil (ou do respaldo compartilhado `profiles/node_modules`).
3. Confirme com `dsh web --dump-config` que nenhuma linha `mcp-panel` restou.

## Honestidade por contrato

- **Somente leitura.** Nenhum arquivo de configuração é gravado. `disable`/`enable` imprime uma sugestão que você aplica.
- **Sem status falso.** Campos de conexão sem dados upstream mostram `unknown` / `—`, com `statusSource: derived`.
- **Exibição sanitizada.** Credenciais em query strings, senhas userinfo, valores de cabeçalhos, tokens bearer e JWTs são removidos antes da renderização; os `headers` configurados nunca entram em nenhum snapshot.
- **Resultados somente do painel.** Os detalhes das sondas ficam na aba de configurações, nunca no contexto do modelo; `/mcp` é a superfície legível pelo modelo e é totalmente reconstruível a partir do log da sessão.
- **Sem mudanças no mcp-client.** Transporte, OAuth e protocolo permanecem intactos — a lacuna de observabilidade é coberta pela [proposta upstream](docs/upstream-proposal.md), que este plugin já consome (evento tipado `mcp/status` + serviço de consulta `mcpStatus`, detectados em tempo de execução).

## Configuração

| Campo | Padrão | Descrição |
|---|---|---|
| `probeEnabled` | `true` | Registra a ferramenta `mcp_probe` (requer `ctx.jobs` na composição) |
| `probeTimeoutMs` | `10000` | Tempo limite por sonda |
| `maxProbes` | `10` | Limite de registros de sonda exibidos no painel |
| `refreshIntervalMs` | `0` | Intervalo de atualização sugerido para o painel em ms (`0` = somente sob demanda) |
| `outputLanguage` | `en` | Idioma de saída do comando `/mcp` (`en` \| `zh` \| `es` \| `pt` \| `hi`) |
| `passiveProbeEnabled` | `false` | Sondear periodicamente servidores streamable-http em segundo plano |
| `passiveProbeIntervalMs` | `60000` | Intervalo da sonda passiva em milissegundos |

## Permissões e dados

- **Lê**: linhas do Loader, o registro de ferramentas (nomes `mcp__<server>__`) e, quando o upstream implementar, eventos `mcp/status`.
- **Escreve**: nada. Nenhum arquivo de configuração é modificado.
- **Rede**: apenas a sonda de uso único `mcp_probe` (e a sonda passiva opcional) envia uma requisição MCP `initialize` para os endpoints que você configurou; os cabeçalhos configurados são usados na requisição e nunca são exibidos nem registrados.
- Sem telemetria, sem serviços externos, sem trabalho em segundo plano além dos temporizadores de sonda opcionais.

## Solução de problemas

- A linha não aparece? Rode `dsh web --dump-config` e confira se o insert `mcp-panel` foi aplicado com um id único.
- O painel mostra `status: unknown (source: derived)` — esperado até a costura upstream aterrissar; veja [docs/upstream-proposal.md](docs/upstream-proposal.md).
- O painel parece desatualizado? Defina `refreshIntervalMs` com um valor positivo (ex.: `5000`) na linha de configuração `mcp-panel` para consultar automaticamente.
- O log de boot mostra um fiber `mcp-panel` FAILED — o pacote precisa resolver a partir do perfil (o `name: dsh-mcp-panel` simples resolve via o `node_modules` do perfil ou o respaldo compartilhado).
- Rollback: remova a linha (ver Desinstalação).

## Segurança

Encontrou um problema de segurança? Abra uma issue no GitHub **sem** colar segredos, chaves ou tokens — redija tudo antes. Este plugin mantém as credenciais dos seus servidores MCP configurados apenas em memória para as requisições de sonda; elas nunca chegam a logs ou snapshots.

## Como funciona

- **Metade host** — um serviço Typert Remote `mcpPanel` monta o snapshot a partir de três fontes somente leitura: linhas do Loader (entradas `@deepseek-ai/dsh-mcp-client`), `ctx.tools.schemas()` agrupadas pelo namespace `mcp__<server>__`, e observações upstream `mcp/status`. O manifesto `./typert` escrito à mão registra `mcpPanel/status` no gateway; o `zod` é empacotado, então a metade host é autocontida.
- **Metade navegador** — um bundle `dsh.client` (servido em `/plugins/dsh-mcp-panel/client.js`) monta o mesmo descritor via `ctx.remote.$mount` e registra uma entrada `settings.plugins.tab` somente leitura (`id: mcp`). O apresentador é uma função pura; os estilos têm escopo e usam tokens de tema.
- **O comando `/mcp`** passa pelo registro de comandos padrão — cada linha cai nos eventos de sessão `command/run` + `command/done`.

## Desenvolvimento

```sh
pnpm install
pnpm run typecheck    # porta local: resolve as faces de tipo frescas do checkout do harness via caminhos tsconfig
pnpm run typecheck:ci # porta npm: resolve as faces de tipo publicadas 0.1.0-rc.6 (o que o CI executa)
pnpm test             # 105 testes: extremos do sanitizador, agrupamento, tolerância de agregação, saída do comando (5 idiomas), controle de sondas, fiação do cliente, apresentador
pnpm run build        # declarações tsc → lib/types; tsdown → lib/index.js + lib/typert.host.js + lib/client.js
pnpm run verify:self-contained
pnpm run verify:artifacts
pnpm pack
```

Verificação contra um checkout real do harness:
`node --import tsx/esm scripts/verify-headless.mjs` inicializa o perfil web completo em processo (porta efêmera) e imprime a saída exata de `/mcp`, `/mcp <server> tools` e `/mcp <server> disable`.

## Licença

[Apache License 2.0](LICENSE) © 2026 colaboradores do dsh-mcp-panel
