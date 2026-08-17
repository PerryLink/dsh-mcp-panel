<div align="center">

# dsh-mcp-panel

**La consola de gestión MCP para el cliente MCP oficial de DeepSeek Harness: añade, edita, elimina y prueba servidores MCP desde una página de ajustes, con estado honesto, diagnósticos de salud y escrituras de perfil seguras y reversibles.**

*Cliente oficial = puente, este plugin = consola: lee el estado por el seam `mcp/status`, escribe solo parches de perfil de solo-anexar y con aprobación.*

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

| Superficie | Estado |
|---|---|
| Harness | DeepSeek Harness `0.1.0-rc.5`–`0.1.0-rc.6` |
| Node | `^22.19.0 \|\| >=24.0.0` |
| Plataformas | Web GUI (doble cara: host + navegador) |
| Modelo | Cualquiera (el panel es de solo lectura; solo la salida de `/mcp` es legible por el modelo) |

## What you get

`dsh-mcp-panel` es la capa de experiencia sobre el cliente MCP oficial: una vista de runtime de solo lectura más escrituras de perfil seguras y reversibles.

- **Comando `/mcp`** — una fila por servidor: transporte, destino, número de herramientas, estado de conexión (desde el seam upstream; `unknown` cuando no hay observación), último error, reconexiones — legible por el modelo, reconstruible del log de sesión, cinco idiomas de salida.
- **`/mcp <servidor> tools`** — nombres y descripciones de las herramientas `mcp__*` visibles para el modelo.
- **`/mcp <servidor> health`** — sugerencias de autorreparación derivadas (ENOENT → dependencia faltante, ECONNREFUSED, timeouts, 401/403/404, DNS, rate limit, reconexión agotada…); código de salida / stderr etiquetados honestamente como *pendiente de soporte upstream*.
- **`/mcp <servidor> call <tool> [json]`** — llamada de prueba por el **pipeline oficial de herramientas** (`ctx.tools.execute()`); política de permisos pre-ejecución, aprobación, guards y post-ejecución, todo en vigor.
- **Ajustes → Plugins → MCP** — tarjetas de estado con insignias, diagnósticos y sondas, más el CRUD de servidores y el banco de pruebas de herramientas.
- **CRUD de servidores** — formularios de alta/edición/borrado → fragmentos `insert`/`set`/`set disabled` → copia al portapapeles o escritura con aprobación y copias de seguridad automáticas.
- **Banco de pruebas de herramientas** — servidor → herramienta `mcp__*` → argumentos JSON → resultado JSON canónico + contenido renderizado; limitado por `trialMaxResultChars`; solo panel, nunca contexto del modelo.

## Architecture: official client = bridge, this plugin = console

[`@deepseek-ai/dsh-mcp-client`](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/mcp/mcp-client) es el **único puente**: una instancia por servidor MCP, configurada como fila escrita a mano en `cordis.yml`, que conecta el transporte, sincroniza herramientas y registra los nombres `mcp__<servidor>__<herramienta>`. Este plugin nunca lo sustituye: es la **capa de experiencia** encima:

```text
                    ┌────────────────────────────────────────────┐
 profile            │  cordis.yml / cordis.patch.yml             │
 composición        │   - id: mcp-github                          │
 (una fila por      │     name: '@deepseek-ai/dsh-mcp-client'     │
  servidor, a mano) │     config: { serverName, transport, … }    │
                    │   - id: mcp-panel                           │
                    │     name: dsh-mcp-panel   ◄── este plugin   │
                    └───────────────┬────────────────────────────┘
                                    │
        ┌───────────────────────────┴───────────────────────────┐
        │                                                        │
   ┌────▼──────────────┐        ┌───────────────────────────┐    │
   │ @deepseek-ai/dsh- │        │ dsh-mcp-panel (consola)   │    │
   │ mcp-client        │        │                           │    │
   │ • transporte      │        │ • comando /mcp            │    │
   │ • sincronización  │        │ • Ajustes → Plugins →     │    │
   │ • herramientas    │◄──────►│   MCP: CRUD, banco de     │    │
   │ • seam mcp/status │ estado │ • diagnósticos de salud   │    │
   └───────────────────┘        │ • sondas, capacidades     │    │
                                └───────────────────────────┘    │
```

La consola **lee** el cliente por su seam de observabilidad `mcp/status` (evento + servicio de consulta `mcpStatus`), el registro de herramientas y el loader; **escribe** solo en la capa de parches del perfil — solo-anexar, con aprobación y siempre con copia de seguridad. Transporte, OAuth y protocolo permanecen intactos.

## Quick start

```sh
# 1. instala el bundle en tu perfil
dsh plugin --profile web add "github:PerryLink/dsh-mcp-panel#main"

# o desde npm (versiones publicadas)
dsh plugin --profile web add dsh-mcp-panel

# 2. reinicia y verifica la fila
dsh --profile web --dump-config | grep -A3 'id: mcp-panel'
```

Luego abre **Ajustes → Plugins → MCP**, o ejecuta:

```text
/mcp
/mcp everything tools
/mcp everything health
/mcp everything call echo '{"message": "hi"}'
```

## Install & uninstall

- **Canal git** (último `main`): `dsh plugin --profile web add "github:PerryLink/dsh-mcp-panel#main"` — el script `prepare` construye solo con dependencias de producción.
- **Canal npm** (versiones publicadas): `dsh plugin --profile web add dsh-mcp-panel`.
- **Canal tarball**: `pnpm pack` en este repo, luego `dsh plugin --profile web add ./dsh-mcp-panel-<version>.tgz`.
- **Desinstalar**: elimina la fila `mcp-panel` de `cordis.patch.yml` (la superficie web la recarga en caliente), borra el paquete del `node_modules` del perfil y verifica con `dsh web --dump-config` que no quede ninguna fila `mcp-panel`.

## Configuration

Todas las opciones son campos Schemastery `Config` (modificables desde cordis.yml). `cordis.patch.yml` documenta cada clave.

| Clave | Por defecto | Significado |
|---|---|---|
| `probeEnabled` | `true` | Registra la herramienta `mcp_probe` (resultados solo del panel) |
| `probeTimeoutMs` | `10000` | Tiempo límite por sonda en ms |
| `maxProbes` | `10` | Registros de sonda mostrados en el panel |
| `refreshIntervalMs` | `0` | Refresco sugerido del panel en ms; `0` = bajo demanda |
| `outputLanguage` | `en` | Idioma de salida de `/mcp`: `en \| zh \| es \| pt \| hi` |
| `passiveProbeEnabled` | `false` | Sondear periódicamente servidores streamable-http |
| `passiveProbeIntervalMs` | `60000` | Intervalo de sonda pasiva en ms |
| `trialEnabled` | `true` | Banco de pruebas de herramientas (pestaña de ajustes + `/mcp call`) |
| `trialTimeoutMs` | `120000` | Plazo del panel por llamada de prueba en ms |
| `trialMaxResultChars` | `60000` | Tope del payload de resultado de prueba en caracteres |
| `writeEnabled` | `true` | Interruptor de seguridad: `false` rechaza toda escritura (copiar sigue funcionando) |
| `backupCount` | `5` | Copias de `cordis.patch.yml` retenidas por escritura |

## Tools & surfaces

| Superficie | Tipo | Notas |
|---|---|---|
| `/mcp` | command | Fila de estado por servidor; legible por el modelo y reconstruible del log |
| `/mcp <servidor> tools` | command | Nombres + descripciones de `mcp__*` visibles para el modelo |
| `/mcp <servidor> health` | command | Sugerencias de autorreparación derivadas del texto de error saneado |
| `/mcp <servidor> call <tool> [json]` | command | Llamada de prueba por el pipeline oficial de herramientas |
| `mcp_probe` | tool | Sonda opcional de conectividad Streamable HTTP (trabajo en segundo plano) |
| Ajustes → Plugins → MCP | Slot de UI | Tarjetas de estado, CRUD de servidores y banco de pruebas |
| Remote Typert `mcpPanel` | service | Canal de instantáneas de solo lectura (host → cliente) |

## Resources & Prompts

El cliente oficial documenta que *"Tools are the only bridged MCP capability"* — Resources y Prompts están diferidos. La consola detecta un seam de catálogo propuesto y mostrará listas de solo lectura el día que se envíe; hasta entonces el tablero de capacidades marca ambos **pendientes de soporte upstream**.

## Permissions & data

- **Permisos**: el manifiesto `dshWorkshop` declara `network:outbound` y `native-code:none`.
- **Datos**: el panel es de solo lectura; escribe solo fragmentos de `cordis.patch.yml` de solo-anexar (con aprobación, respaldo primero). Credenciales en URLs, contraseñas userinfo, valores de headers, tokens bearer y JWTs se redactan antes de renderizar; los `headers` configurados nunca entran en ninguna instantánea, y los **valores** de env/headers nunca salen del host (el editor ve solo claves).

## Security boundaries

- **El puente sigue siendo el puente.** Sin cambios de transporte, OAuth o protocolo; una fila mcp-client por servidor, exactamente como a mano.
- **Sin estado falso.** Los campos de conexión sin observaciones upstream leen `unknown` / `—` con `statusSource: 'derived'`; códigos de salida y stderr nunca se inventan.
- **Escrituras solo-anexar, con aprobación y respaldo.** La consola nunca reescribe `cordis.patch.yml`; anexa operaciones generadas y conserva las `backupCount` copias más recientes.
- **Sin inyección de prompts.** El panel no registra secciones de prompt; su único texto visible al modelo son las dos descripciones de herramienta/comando.

## Known limitations

- **Resources y Prompts** están pendientes de soporte upstream — el cliente oficial solo puentea herramientas.
- **Códigos de salida / stderr** se etiquetan *pendiente de soporte upstream* hasta que el cliente los exponga.
- **Panel de solo lectura** — la consola nunca falsifica un estado de conexión; los campos no observables leen `unknown` / `-1` / `—`.

## Development

```sh
pnpm run typecheck && pnpm run typecheck:ci && pnpm test && pnpm run build && pnpm run verify:self-contained && pnpm run verify:artifacts && pnpm pack
```

`scripts/verify-headless.mjs` arranca el perfil web real e imprime la salida exacta de `/mcp`. Publicación: `node scripts/release.mjs <x.y.z>` ejecuta la puerta completa, hace commit y etiqueta `v<x.y.z>` localmente (nunca empuja).

## Topics

`dsh`, `dsh-plugin`, `deepseek-harness`, `deepseek`, `cordis`, `mcp`, `mcp-client`, `observability`, `panel`

## Contributors

- [@PerryLink](https://github.com/PerryLink) — creador y mantenedor.
- [@xiaoyuyu6420](https://github.com/xiaoyuyu6420) — diagnosticó las devDependencies de client faltantes detrás de los fallos de build en checkouts limpios (PR #5).

## License

[Apache License 2.0](LICENSE) © 2026 colaboradores de dsh-mcp-panel
