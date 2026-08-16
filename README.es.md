# dsh-mcp-panel

**Consola de gestión MCP para el cliente MCP oficial de DeepSeek Harness: añade, edita, elimina y prueba servidores MCP desde una página de ajustes, con estado honesto, diagnósticos de salud y escrituras de perfil seguras y reversibles.**

[English](README.md) · [简体中文](README.zh.md) · [Español](README.es.md) · [Português](README.pt.md) · [हिन्दी](README.hi.md)

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/dsh-mcp-panel)](https://www.npmjs.com/package/dsh-mcp-panel)
[![CI](https://github.com/PerryLink/dsh-mcp-panel/actions/workflows/ci.yml/badge.svg)](https://github.com/PerryLink/dsh-mcp-panel/actions/workflows/ci.yml)
[![dsh-plugin](https://img.shields.io/badge/ecosystem-dsh--plugin-8b5cf6)](https://github.com/topics/dsh-plugin)

## Arquitectura: el cliente oficial es el puente; este plugin es la consola

[`@deepseek-ai/dsh-mcp-client`](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/mcp/mcp-client) es el **único puente**: una instancia por servidor MCP, configurada como fila escrita a mano en `cordis.yml`, que conecta el transporte, sincroniza herramientas y registra los nombres `mcp__<servidor>__<herramienta>`. Este plugin nunca lo sustituye: es la **capa de experiencia** encima:

```
 profile/composición            dsh-mcp-client (puente)      dsh-mcp-panel (consola)
 - id: mcp-github               • transporte                 • comando /mcp
   name: '@deepseek-ai/…'       • sincronización de tools    • Ajustes → Plugins → MCP:
   config: { serverName, … }    • herramientas mcp__*          CRUD, banco de pruebas,
 - id: mcp-panel                • seam mcp/status ◄─estado─►  diagnósticos, sondas
   name: dsh-mcp-panel
```

La consola **lee** a través del seam `mcp/status` (evento + servicio `mcpStatus`), el registro de herramientas y el loader; **escribe** solo en la capa de parches del perfil: solo anexa, con aprobación y copia de seguridad automática. Transporte, OAuth y protocolo permanecen intactos.

## Consola vs. cordis.yml escrito a mano

| | cordis.yml a mano | Consola dsh-mcp-panel |
|---|---|---|
| Añadir servidor | Editar YAML | Formulario → fragmento de parche → **copiar** o **escribir** (aprobación + copia de seguridad) |
| Editar servidor | Editar YAML y reiniciar | Formulario precargado; los secretos sin cambios conservan su valor en el host |
| Eliminar servidor | Borrar la fila | Operación `set disabled: true` (el vocabulario de parches no tiene remove); re-habilitable |
| Ver estado | Leer logs | Insignias + reconexiones + último error, en vivo desde `mcp/status` |
| Probar una herramienta | Pedírselo al modelo | Banco de pruebas → pipeline oficial `ctx.tools.execute()` (permisos y aprobación en vigor) |
| Diagnosticar | grep de logs | `/mcp <servidor> health` con sugerencias derivadas |

## Qué obtienes

- **`/mcp`**: fila por servidor — transporte, destino, número de herramientas, estado de conexión (honesto: `unknown` sin datos upstream), último error, reconexiones; legible por el modelo, reconstruible desde el log de sesión, cinco idiomas de salida.
- **`/mcp <servidor> tools | health | call <tool> [json] | disable | enable`**: lista de herramientas; diagnósticos derivados (ENOENT → dependencia faltante, ECONNREFUSED, timeouts, 401/403/404, DNS, rate limit, reconexión agotada); llamada de prueba por el **pipeline oficial** (permisos + aprobación en vigor); sugerencias de parche exactas.
- **Ajustes → Plugins → MCP**: tarjetas de estado con insignias y diagnósticos, **CRUD de servidores** (fragmentos `insert`/`set`/`set disabled`, copia al portapapeles o escritura con aprobación y copia de seguridad `cordis.patch.yml.bak-<ts>`), **banco de pruebas de herramientas** (resultado JSON canónico + contenido renderizado, limitado por `trialMaxResultChars`, solo panel), y el **tablero de capacidades**: Resources y Prompts marcados como *pendientes de soporte upstream* (el cliente oficial hoy solo puentea herramientas).
- **Sondas**: conectividad Streamable HTTP de un clic o pasiva (resultados solo del panel).

## Inicio rápido

```sh
dsh plugin --profile web add github:PerryLink/dsh-mcp-panel#v0.4.0
# o el canal npm:
dsh plugin --profile web add dsh-mcp-panel@0.4.0
```

Reinicia (o deja que la superficie web recargue `cordis.patch.yml`) y abre **Ajustes → Plugins → MCP**, o ejecuta `/mcp`.

## Honesto por contrato

- **El puente sigue siendo el puente**: sin cambios de transporte/OAuth/protocolo.
- **Sin estado falso**: `unknown` / `—` con `statusSource: 'derived'` sin datos upstream; códigos de salida y stderr nunca inventados (etiquetados *pendiente de soporte upstream*).
- **Visualización saneada**: credenciales en URLs, userinfo, valores de headers, tokens bearer y JWTs redactados; los **valores** de env/headers nunca salen del host (el editor ve solo claves).
- **Escrituras solo-anexar, con aprobación y respaldo**: la consola nunca reescribe `cordis.patch.yml`; con servicio de aprobación y un agente en turno abierto pregunta a `ctx.approval` (solo `allowed-once` procede); si no, la confirmación interactiva es el canal de aprobación. `writeEnabled: false` es el interruptor de seguridad.
- **Sin inyección de prompts**: la consola no registra secciones de prompt; solo las descripciones de sus dos herramientas/comandos, en el estilo minimalista del cliente oficial.

## Config

| Clave | Valor | Descripción |
|---|---|---|
| `probeEnabled` / `probeTimeoutMs` / `maxProbes` | `true` / `10000` / `10` | herramienta de sonda, tiempo límite, registros mostrados |
| `refreshIntervalMs` | `0` | refresco sugerido del panel (`0` = bajo demanda) |
| `outputLanguage` | `en` | idioma de `/mcp`: `en\|zh\|es\|pt\|hi` |
| `passiveProbeEnabled` / `passiveProbeIntervalMs` | `false` / `60000` | sondas pasivas y su intervalo |
| `trialEnabled` / `trialTimeoutMs` / `trialMaxResultChars` | `true` / `120000` / `60000` | banco de pruebas y sus límites |
| `writeEnabled` / `backupCount` | `true` / `5` | interruptor de escrituras; copias de seguridad retenidas |

## Resources y Prompts

El cliente oficial documenta "Tools are the only bridged MCP capability": ambos están diferidos. La consola detecta un seam de catálogo propuesto y mostrará listas de solo lectura cuando llegue; hasta entonces el tablero marca *pendiente de soporte upstream* (addendum en `docs/upstream-proposal.md` del harness).

## Contribuidores

Gracias a todos los que reportaron problemas, revisaron o contribuyeron código — en particular a [xiaoyuyu6420](https://github.com/xiaoyuyu6420), quien diagnosticó las devDependencies de client faltantes detrás de los fallos de build en checkouts limpios (PR #5).

## Licencia

Apache-2.0 — véase [LICENSE](LICENSE).
