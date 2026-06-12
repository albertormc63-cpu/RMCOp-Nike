# RMCOp-Nike - Instrucciones Para Codex

Si entras a este repo como Codex, empieza leyendo:

1. `CODEX_HANDOFF.md`
2. `README.md`
3. `docs/RMC_REGISTROS_SQLITE_Y_PORTAFOLIO.md` si el usuario pregunta por metricas, bitacoras, SQLite o reportes.

Este repositorio debe tratarse como el proyecto del panel CEP `RMCOp-Nike`.
El producto activo de mockups vive como repo/herramienta hermana en:

```text
/Users/rmlsub1/Library/Application Support/Adobe/CEP/extensions/RMC MockupTool
```

## Si El Usuario Dice "Que Tranza?"

Responde en espanol, corto pero util, con:

- Que es el proyecto.
- Estado actual del panel CEP.
- Estado del batch desde Excel.
- Estado de Indigenous Heritage y Throwback.
- Estado de `RMC MockupTool` como CEP separado.
- Estado de registros SQLite compartidos.
- Pendientes principales.
- Archivos clave para continuar.

No inventes contexto de chats. Usa `CODEX_HANDOFF.md` como memoria principal.

## Reglas De Trabajo

- No hagas `git reset`, no reviertas cambios locales y no borres trabajo sin permiso.
- Este repo suele tener cambios en progreso. Si ves archivos modificados, tratalos como trabajo del usuario/proyecto.
- No mezcles mockups con el panel CEP Nike; son flujos separados.
- No agregues nuevas features de mockups dentro del CEP Nike principal. Si el
  usuario pide integrar mockups a Illustrator, trabaja en el CEP separado
  `RMC MockupTool`.
- No rompas el flujo manual mientras trabajas batch.
- RMCOp-Nike registra produccion en la BD compartida `/Users/rmlsub1/Documents/RMC - CEP/RMC_BD/RMC_CEP.sqlite`.
- Las tablas propias de este CEP son `rmcop_nike_runs`, `rmcop_nike_items` y `rmcop_nike_git_commits`; no tocar tablas de otros CEP.
- `rmcop_nike_runs.created_at` guarda solo fecha `DD/MM/AAAA`; `started_at`, `finished_at` y `tiempo` guardan `HH:MM:SS`.
- No reintroducir columnas `fecha`, `source_excel`, `destination_folder` ni `output_path` en las tablas de RMCOp-Nike.
- Throwback (`TB`) es variante de texto, no de Indigenous Heritage.
- Indigenous Heritage debe conservar gap obligatorio de `0.25in` entre digitos.
- Cualquier cambio importante debe probarse con checks Node y, si aplica, en Illustrator real.

## Checks Rapidos

```bash
node --check js/main.js
node --check js/illustrator/illustratorBridge.js
node --check js/services/createOrderData.js
node --check js/services/portfolioDb.js
node --check js/utils/pathBuilder.js
node -e "JSON.parse(require('fs').readFileSync('js/config/ihNumberRules.json','utf8')); console.log('ihNumberRules OK')"
```

## Mapa Mental

- `index.html`, `css/styles.css`, `js/main.js`: UI y coordinacion CEP.
- `js/services/createOrderData.js`: Excel batch.
- `js/services/portfolioDb.js`: SQLite compartido para registros de produccion.
- `js/utils/pathBuilder.js`: plantillas y nombres finales.
- `js/config/variantRules.js`: Standard, Indigenous Heritage, Throwback.
- `jsx/rmcNike.jsx`, `jsx/standardText.jsx`, `jsx/ihNumbers.jsx`: Illustrator.
- `RMC MockupTool`: CEP separado para mockups PDF; no desarrollarlo dentro de este repo.
