# dsh-mcp-panel

**Console de gerenciamento MCP para o cliente MCP oficial do DeepSeek Harness: adicione, edite, remova e teste servidores MCP numa página de configurações, com status honesto, diagnósticos de saúde e gravações de perfil seguras e reversíveis.**

[English](README.md) · [简体中文](README.zh.md) · [Español](README.es.md) · [Português](README.pt.md) · [हिन्दी](README.hi.md)

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/dsh-mcp-panel)](https://www.npmjs.com/package/dsh-mcp-panel)
[![CI](https://github.com/PerryLink/dsh-mcp-panel/actions/workflows/ci.yml/badge.svg)](https://github.com/PerryLink/dsh-mcp-panel/actions/workflows/ci.yml)
[![dsh-plugin](https://img.shields.io/badge/ecosystem-dsh--plugin-8b5cf6)](https://github.com/topics/dsh-plugin)

## Arquitetura: o cliente oficial é a ponte; este plugin é o console

[`@deepseek-ai/dsh-mcp-client`](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/mcp/mcp-client) é a **única ponte**: uma instância por servidor MCP, configurada como linha escrita à mão no `cordis.yml`, que conecta o transporte, sincroniza ferramentas e registra os nomes `mcp__<servidor>__<ferramenta>`. Este plugin nunca a substitui: é a **camada de experiência** por cima:

```
 profile/composição            dsh-mcp-client (ponte)       dsh-mcp-panel (console)
 - id: mcp-github              • transporte                 • comando /mcp
   name: '@deepseek-ai/…'      • sincronização de tools     • Configurações → Plugins →
   config: { serverName, … }   • ferramentas mcp__*           MCP: CRUD, banco de testes,
 - id: mcp-panel               • seam mcp/status ◄─status─►  diagnósticos, sondas
   name: dsh-mcp-panel
```

O console **lê** pelo seam `mcp/status` (evento + serviço `mcpStatus`), pelo registro de ferramentas e pelo loader; **escreve** apenas na camada de patches do perfil: somente anexa, com aprovação e backup automático. Transporte, OAuth e protocolo permanecem intocados.

## Console vs. cordis.yml escrito à mão

| | cordis.yml à mão | Console dsh-mcp-panel |
|---|---|---|
| Adicionar servidor | Editar YAML | Formulário → fragmento de patch → **copiar** ou **gravar** (aprovação + backup) |
| Editar servidor | Editar YAML e reiniciar | Formulário pré-preenchido; segredos inalterados preservam o valor no host |
| Remover servidor | Apagar a linha | Operação `set disabled: true` (o vocabulário de patches não tem remove); re-habilitável |
| Ver status | Ler logs | Selos + reconexões + último erro, ao vivo do `mcp/status` |
| Testar uma ferramenta | Pedir ao modelo | Banco de testes → pipeline oficial `ctx.tools.execute()` (permissões e aprovação em vigor) |
| Diagnosticar | grep de logs | `/mcp <servidor> health` com sugestões derivadas |

## O que você ganha

- **`/mcp`**: uma linha por servidor — transporte, destino, contagem de ferramentas, status de conexão (honesto: `unknown` sem dados upstream), último erro, reconexões; legível pelo modelo, reconstruível do log da sessão, cinco idiomas de saída.
- **`/mcp <servidor> tools | health | call <tool> [json] | disable | enable`**: lista de ferramentas; diagnósticos derivados (ENOENT → dependência ausente, ECONNREFUSED, timeouts, 401/403/404, DNS, rate limit, reconexão esgotada); chamada de teste pelo **pipeline oficial** (permissões + aprovação em vigor); sugestões de patch exatas.
- **Configurações → Plugins → MCP**: cartões de status com selos e diagnósticos, **CRUD de servidores** (fragmentos `insert`/`set`/`set disabled`, cópia para a área de transferência ou gravação com aprovação e backup `cordis.patch.yml.bak-<ts>`), **banco de testes de ferramentas** (JSON canônico + conteúdo renderizado, limitado por `trialMaxResultChars`, somente painel) e o **painel de capacidades**: Resources e Prompts marcados como *aguardando suporte upstream* (hoje o cliente oficial só pontua ferramentas).
- **Sondas**: conectividade Streamable HTTP com um clique ou passiva (resultados somente do painel).

## Início rápido

```sh
dsh plugin --profile web add github:PerryLink/dsh-mcp-panel#v0.4.0
# ou pelo canal npm:
dsh plugin --profile web add dsh-mcp-panel@0.4.0
```

Reinicie (ou deixe a superfície web recarregar o `cordis.patch.yml`) e abra **Configurações → Plugins → MCP**, ou execute `/mcp`.

## Honesto por contrato

- **A ponte continua sendo a ponte**: nenhuma mudança de transporte/OAuth/protocolo.
- **Sem status falso**: `unknown` / `—` com `statusSource: 'derived'` sem dados upstream; códigos de saída e stderr nunca inventados (marcados *aguardando suporte upstream*).
- **Exibição saneada**: credenciais em URLs, userinfo, valores de headers, tokens bearer e JWTs redigidos; os **valores** de env/headers nunca saem do host (o editor vê apenas chaves).
- **Gravações somente-anexar, com aprovação e backup**: o console nunca reescreve o `cordis.patch.yml`; havendo serviço de aprovação e um agente em turno aberto, pergunta ao `ctx.approval` (apenas `allowed-once` prossegue); caso contrário, a confirmação interativa é o canal de aprovação. `writeEnabled: false` é o interruptor de segurança.
- **Sem injeção de prompts**: o console não registra seções de prompt; apenas as descrições de suas duas ferramentas/comandos, no estilo minimalista do cliente oficial.

## Config

| Chave | Valor | Descrição |
|---|---|---|
| `probeEnabled` / `probeTimeoutMs` / `maxProbes` | `true` / `10000` / `10` | ferramenta de sonda, prazo, registros exibidos |
| `refreshIntervalMs` | `0` | atualização sugerida do painel (`0` = sob demanda) |
| `outputLanguage` | `en` | idioma do `/mcp`: `en\|zh\|es\|pt\|hi` |
| `passiveProbeEnabled` / `passiveProbeIntervalMs` | `false` / `60000` | sondas passivas e seu intervalo |
| `trialEnabled` / `trialTimeoutMs` / `trialMaxResultChars` | `true` / `120000` / `60000` | banco de testes e seus limites |
| `writeEnabled` / `backupCount` | `true` / `5` | interruptor de gravações; backups retidos |

## Resources e Prompts

O cliente oficial documenta "Tools are the only bridged MCP capability": ambos estão adiados. O console detecta um seam de catálogo proposto e exibirá listas somente-leitura quando chegar; até lá o painel marca *aguardando suporte upstream* (adendo em `docs/upstream-proposal.md` do harness).

## Contribuidores

Obrigado a todos que reportaram problemas, revisaram ou contribuíram código — em particular [xiaoyuyu6420](https://github.com/xiaoyuyu6420), que diagnosticou as devDependencies de client ausentes por trás das falhas de build em checkouts limpos (PR #5).

## Licença

Apache-2.0 — veja [LICENSE](LICENSE).
