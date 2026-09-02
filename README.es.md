<div align="center">

# dsh-mcp-panel
- **Canal 1024 store**: `npm i -g dsh1024` una vez, luego `dsh1024 plugin --profile web add dsh-mcp-panel` (cuenta para el ranking de instalaciones de [deepseek1024.com](https://deepseek1024.com)).

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
| Harness | DeepSeek Harness `0.1.1-rc.2`–`0.2.0` 0.1.2-alpha.5 (adaptado el 2026-09-02): el sobre de sesión conserva su campo ignorable solo para compatibilidad de lectura de logs almacenados - Session.append aún no puede estamparlo, por lo que el comportamiento de la puerta no cambia. |
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

## Console vs. hand-written cordis.yml

| | cordis.yml a mano | Consola dsh-mcp-panel |
|---|---|---|
| Añadir servidor | Editar YAML, cuidar indentación/comillas | Formulario → fragmento de parche → **copiar** o **escribir** (aprobación + copia de seguridad) |
| Editar servidor | Editar YAML, reiniciar/recarga en caliente | Formulario precargado de la fila en vivo; los secretos sin cambios conservan su valor en el host |
| Eliminar servidor | Borrar la fila | Operación `set disabled: true` (el vocabulario de parches no tiene remove) — re-habilitable |
| Ver estado | Leer logs | Insignias + reconexiones + último error, en vivo desde `mcp/status` |
| Probar una herramienta | Pedírselo al modelo | Banco de pruebas → pipeline oficial `ctx.tools.execute()` (permisos y aprobación en vigor) |
| Diagnosticar fallos | grep de logs | `/mcp <servidor> health` con sugerencias derivadas |
| Errores | Revertir a mano | Cada escritura es solo-anexar y deja una copia de seguridad con marca de tiempo |

La salida de la consola ES el vocabulario de `cordis.patch.yml` — las mismas líneas que escribirías a mano, generadas, previsualizadas y aplicadas con seguridad.

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
| `catalogEntries` | `[]` | Superposición de usuario para el directorio recomendado: anexa entradas; una entrada con el mismo `id` reemplaza la integrada |

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
- [@feiler0](https://github.com/feiler0) — contribuyó la sonda de servidores MCP stdio (un handshake MCP initialize sobre stdin/stdout) (PR #7, fusionada como PR #15).

## PerryLink DSH Plugin Family

Este proyecto es uno de los [33 complementos de DeepSeek Harness](https://github.com/PerryLink) mantenidos por [PerryLink](https://github.com/PerryLink). Si este te ayuda, probablemente los demás también:

| Plugin | One-liner |
|---|---|
| **[dsh-dsh-auto-review](https://github.com/PerryLink/dsh-dsh-auto-review)** | Auto-revisión de segundo modelo en la cadena de aprobación, con cierre en fallo por defecto | |
| **[dsh-dsh-background-agents](https://github.com/PerryLink/dsh-dsh-background-agents)** | Agentes hijos en segundo plano durables con barra lateral de UI web, mensajería e interrupción | |
| **[dsh-dsh-budget](https://github.com/PerryLink/dsh-dsh-budget)** | Gobernanza de costes para DeepSeek Harness: presupuestos, carbono y latencia en un panel. | |
| **[dsh-dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-dsh-checkpoint-rewind)** | Equivalente a /rewind de Claude Code: instantáneas, bifurcaciones de sesión, restauración de un solo uso | |
| **[dsh-dsh-claude-move](https://github.com/PerryLink/dsh-dsh-claude-move)** | Migra sesiones, memoria, habilidades y CLAUDE.md de Claude Code a DSH | |
| **[dsh-dsh-click](https://github.com/PerryLink/dsh-dsh-click)** | Control de escritorio nativo multiplataforma para DeepSeek Harness — Windows primero. | |
| **[dsh-dsh-composer-history](https://github.com/PerryLink/dsh-dsh-composer-history)** | Historial de entrada estilo terminal para el compositor web: flechas, búsqueda Ctrl+R | |
| **[dsh-dsh-data-quality](https://github.com/PerryLink/dsh-dsh-data-quality)** | Comprobaciones de calidad de datasets y verificación de citas (el puente numérico opcional consumido aquí) | |
| **[dsh-dsh-defend](https://github.com/PerryLink/dsh-dsh-defend)** | Defensa contra inyección de prompts, jailbreak y fuga de secretos para DeepSeek Harness. | |
| **[dsh-dsh-doublecheck](https://github.com/PerryLink/dsh-dsh-doublecheck)** | Guardián de disciplina de ingeniería: interrogatorio de requisitos, puertas de pruebas, revisión adversaria | |
| **[dsh-dsh-draw](https://github.com/PerryLink/dsh-dsh-draw)** | Enrutamiento unificado de generación de imágenes estáticas para DeepSeek Harness. | |
| **[dsh-dsh-fast](https://github.com/PerryLink/dsh-dsh-fast)** | Diagnóstico de rendimiento de solo lectura para DeepSeek Harness. | |
| **[dsh-dsh-fund-research](https://github.com/PerryLink/dsh-dsh-fund-research)** | Informes de investigación deterministas para fondos mutuos públicos chinos | |
| **[dsh-dsh-github](https://github.com/PerryLink/dsh-dsh-github)** | Integración de PR/issues de GitHub para DSH, cada escritura controlada por aprobación | |
| **[dsh-dsh-industry-research](https://github.com/PerryLink/dsh-dsh-industry-research)** | Orquestación de investigación sectorial que sella sus entregables mediante el `ctx.researchReport.assemble` de este plugin | |
| **[dsh-dsh-library](https://github.com/PerryLink/dsh-dsh-library)** | Base de conocimiento documental local para DeepSeek Harness. | |
| **[dsh-dsh-local-ai](https://github.com/PerryLink/dsh-dsh-local-ai)** | Integración de modelos locales (Ollama) para DeepSeek Harness. | |
| **[dsh-dsh-lsp-actions](https://github.com/PerryLink/dsh-dsh-lsp-actions)** | Diagnósticos, formato, autocompletado, acciones de código y renombrado LSP sobre servidores de lenguaje | |
| **[dsh-dsh-mask](https://github.com/PerryLink/dsh-dsh-mask)** | Middleware de enmascaramiento de PII: anonimiza en el límite del modelo, restaura en la capa de visualización | |
| **[dsh-dsh-memento](https://github.com/PerryLink/dsh-dsh-memento)** | Memoria entre sesiones controlada por aprobación: costura ctx.memory + SQLite + herramienta de memoria | |
| **[dsh-dsh-observe](https://github.com/PerryLink/dsh-dsh-observe)** | Exportador de observabilidad OpenTelemetry y Langfuse para DeepSeek Harness. | |
| **[dsh-dsh-output-styles](https://github.com/PerryLink/dsh-dsh-output-styles)** | Cambio de estilo en tiempo de ejecución equivalente a outputStyles de Claude Code | |
| **[dsh-dsh-permission-rules](https://github.com/PerryLink/dsh-dsh-permission-rules)** | Reglas de permisos declarativas allow/deny/ask estilo Claude Code con auditoría | |
| **[dsh-dsh-plugin-guide](https://github.com/PerryLink/dsh-dsh-plugin-guide)** | Base de conocimiento de desarrollo de plugins como habilidad de agente bajo demanda | |
| **[dsh-dsh-research-report](https://github.com/PerryLink/dsh-dsh-research-report)** | Motor de informes de investigación verificables con evidencia direccionada por contenido | |
| **[dsh-dsh-score](https://github.com/PerryLink/dsh-dsh-score)** | Puntuación de calidad multidimensional para plugins de DeepSeek Harness. | |
| **[dsh-dsh-session-pin](https://github.com/PerryLink/dsh-dsh-session-pin)** | Fija sesiones en la barra lateral web con orden durable | |
| **[dsh-dsh-session-sync](https://github.com/PerryLink/dsh-dsh-session-sync)** | Sincronización de sesiones entre dispositivos para DeepSeek Harness — un espejo git dedicado de tu almacén de sesiones. | |
| **[dsh-dsh-skill-pack-security](https://github.com/PerryLink/dsh-dsh-skill-pack-security)** | Paquete de habilidades de auditoría de seguridad: escaneo de secretos, revisión de dependencias y cadena de suministro | |
| **[dsh-dsh-talk](https://github.com/PerryLink/dsh-dsh-talk)** | Bucle de sesión con voz para DeepSeek Harness: háblale y escucha su respuesta. | |
| **[dsh-dsh-test-drive](https://github.com/PerryLink/dsh-dsh-test-drive)** | Pruebas de instalación y humo aisladas para plugins de DeepSeek Harness. | |
| **[dsh-dsh-translate](https://github.com/PerryLink/dsh-dsh-translate)** | Traducción de parámetros entre proveedores y reparación determinista de JSON para DeepSeek Harness. | |

## License

[Apache License 2.0](LICENSE) © 2026 colaboradores de dsh-mcp-panel
