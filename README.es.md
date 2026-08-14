# dsh-mcp-panel

**Panel de gestión en tiempo de ejecución, de solo lectura, para el cliente MCP oficial de DeepSeek Harness: consulta el estado, las herramientas, los errores y los contadores de reconexión de cada servidor MCP sin tocar tu configuración.**

[English](README.md) · [简体中文](README.zh.md) · [Español](README.es.md) · [Português](README.pt.md) · [हिन्दी](README.hi.md)

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![dsh-plugin](https://img.shields.io/badge/ecosystem-dsh--plugin-8b5cf6)](https://github.com/topics/dsh-plugin)
[![deepseek-harness](https://img.shields.io/badge/runtime-deepseek--harness-4f46e5)](https://github.com/deepseek-ai/deepseek-harness)

> 🔭 **La observabilidad primero.** [`@deepseek-ai/dsh-mcp-client`](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/mcp/mcp-client) mantiene privado su estado de conexión: solo registra logs. Este plugin muestra todo lo que *sí* puede observar (configuración, registro de herramientas, estado del Loader) y dice **"unknown"** para lo que no puede, en lugar de adivinar. También propone la costura mínima que haría el estado real: consulta la [propuesta upstream](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/upstream-proposal.md).

## Qué obtienes

| Superficie | Qué muestra |
|---|---|
| **Comando `/mcp`** | transporte, destino, número de herramientas, estado de conexión, último error, contador de reconexiones — legible por el modelo y reconstruible desde el log |
| **Ajustes → Plugins → pestaña MCP** | la misma instantánea en solo lectura, con insignias de estado, listas de herramientas expandibles, errores saneados y resultados de sondas |
| **`/mcp <server> disable\|enable`** | la línea exacta de `cordis.patch.yml` a aplicar — una *sugerencia*, nunca una escritura |
| **Herramienta `mcp_probe`** | sonda de conectividad de un solo uso para Streamable HTTP como tarea en segundo plano; los resultados son **solo del panel** |

## Inicio rápido

```sh
dsh plugin --profile web add github:PerryLink/dsh-mcp-panel#main
```

Reinicia (o deja que la superficie web recargue su `cordis.patch.yml`) y ejecuta:

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

Instalación manual: coloca `dsh-mcp-panel` en el `node_modules` del perfil (o en el
respaldo compartido `$DSH_HOME/profiles/node_modules`) y añade la fila a `cordis.patch.yml`:

```yaml
- insert:
    - id: mcp-panel
      name: dsh-mcp-panel
      config:
        probeEnabled: true
        probeTimeoutMs: 10000
```

## Honestidad por contrato

- **Solo lectura.** Nunca se escribe ningún archivo de configuración. `disable`/`enable` imprime una sugerencia que tú aplicas.
- **Sin estado falso.** Los campos de conexión sin datos upstream muestran `unknown` / `—`, con `statusSource: derived`.
- **Visualización saneada.** Las credenciales en query strings, contraseñas userinfo, valores de cabeceras, tokens bearer y JWT se redactan antes de renderizar; las `headers` configuradas nunca entran en ninguna instantánea.
- **Resultados solo del panel.** Los detalles de las sondas viven en la pestaña de ajustes, nunca en el contexto del modelo; `/mcp` es la superficie legible por el modelo y es totalmente reconstruible desde el log de sesión.
- **Sin cambios en mcp-client.** Transporte, OAuth y protocolo quedan intactos — la brecha de observabilidad la cubre la [propuesta upstream](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/upstream-proposal.md), que este plugin ya consume (evento tipado `mcp/status` + servicio de consulta `mcpStatus`, detectados en tiempo de ejecución).

## Configuración

| Campo | Por defecto | Descripción |
|---|---|---|
| `probeEnabled` | `true` | Registra la herramienta `mcp_probe` (requiere `ctx.jobs` en la composición) |
| `probeTimeoutMs` | `10000` | Tiempo límite por sonda |

## Cómo funciona

- **Mitad host** — un servicio Typert Remote `mcpPanel` ensambla la instantánea desde tres fuentes de solo lectura: filas del Loader (entradas `@deepseek-ai/dsh-mcp-client`), `ctx.tools.schemas()` agrupadas por el espacio de nombres `mcp__<server>__`, y observaciones upstream `mcp/status`. El manifiesto `./typert` escrito a mano registra `mcpPanel/status` en el gateway; `zod` se incluye en el bundle, de modo que la mitad host es autocontenida.
- **Mitad navegador** — un bundle `dsh.client` (servido en `/plugins/dsh-mcp-panel/client.js`) monta el mismo descriptor mediante `ctx.remote.$mount` y registra una entrada `settings.plugins.tab` de solo lectura (`id: mcp`). El presentador es una función pura; los estilos tienen alcance y usan tokens de tema.
- **El comando `/mcp`** pasa por el registro de comandos estándar — cada línea aterriza en los eventos de sesión `command/run` + `command/done`.

## Desarrollo

```sh
pnpm install
pnpm run typecheck
pnpm test          # 58 pruebas: extremos del saneador, agrupación, tolerancia de agregación, salida del comando, presentador
pnpm run build     # declaraciones tsc → lib/types; tsdown → lib/index.js + lib/typert.host.js + lib/client.js
pnpm run verify:self-contained
pnpm pack
```

Verificación contra un checkout real del harness:
`node --import tsx/esm scripts/verify-headless.mjs` arranca el perfil web completo en proceso (puerto efímero) e imprime la salida exacta de `/mcp`, `/mcp <server> tools` y `/mcp <server> disable`.

## Licencia

[Apache License 2.0](LICENSE) © 2026 colaboradores de dsh-mcp-panel
