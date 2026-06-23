# RMCOp-Nike - Instrucciones Para Codex

Ultima actualizacion: 2026-06-22.

## Orden De Lectura

1. `AGENTS.md`
2. `CURRENT_STATE.md`
3. `TASK_ROUTER.md`
4. La documentacion tematica que indique el router.

Usa `docs/archive/CODEX_HANDOFF_2026-06-22.md` solo para contexto historico. No dependas de chats ni inventes contexto.

## Limite Del Repo

Este repo es el panel CEP principal `RMCOp-Nike` para Adobe Illustrator. El producto de mockups vive como repo y CEP separado en:

```text
/Users/rmlsub1/Library/Application Support/Adobe/CEP/extensions/RMC MockupTool
```

No agregues features, UI, dependencias ni servidor de mockups dentro de `RMCOp-Nike`. Lee `docs/architecture/MOCKUPTOOL_BOUNDARY.md`.

## Reglas De Trabajo

- No hagas `git reset`, no reviertas cambios locales y no borres trabajo sin permiso.
- No rompas el flujo manual mientras trabajas batch.
- La validacion incremental ocurre antes de generar y se recalcula al procesar.
- Solo filas `FALTANTE` se procesan.
- Claves o rutas repetidas son `CONFLICTO`; batch no crea alternativas `DUP` ni `(1)`.
- `Personalizadas`: destino manual y subcarpetas por familia de style/talla.
- `Genericas`: destino automatico en la carpeta del Excel y PDFs en esa raiz.
- Cambiar entre modos limpia Excel, destino, filtros, resultados y validacion previos.
- `OD` identifica Personalizadas; `ST/IH/TB/AS` es pista de Genericas. La estructura interna siempre manda.
- Genericas exige roster detallado con `Style`, `Color`, `Qty`, `Size`, `Last Name` y `Player#`; no procesa listas resumen.
- En Genericas, Roster sustituye WO cuando WO no existe.
- `rmcop_nike_items.clave` es la base de duplicados.
- Clave: `(WO o Roster) + Ship Order + Style + Team + Size + Nombre + Numero`.
- Solo items `Completado` bloquean una clave; errores pueden reintentarse.
- BD compartida: `/Users/rmlsub1/Documents/RMC - CEP/RMC_BD/RMC_CEP.sqlite`.
- Tablas propias: `rmcop_nike_runs`, `rmcop_nike_items`, `rmcop_nike_git_commits`. No tocar tablas de otros CEP.
- Herramientas exactas: `RMCOp-Nike Manual`, `RMCOp-Nike Personalizadas`, `RMCOp-Nike Genericas`.
- `created_at`: `DD/MM/AAAA`. `started_at`, `finished_at` y `tiempo`: `HH:MM:SS`.
- No reintroducir `fecha`, `source_excel`, `destination_folder` ni `output_path`.
- Los ids de runs usan `AAAAMMDD-HHMMSS`, sin prefijo `manual-`.
- Throwback (`TB`) es variante de texto, no Indigenous Heritage.
- Indigenous Heritage conserva gap obligatorio de `0.25in` entre digitos.
- Alertas visibles via `illustratorBridge.showAlert`; `alert()` del navegador solo como fallback.
- Cambios importantes requieren checks Node y, cuando aplique, prueba en Illustrator real.

## Si El Usuario Dice "Que Tranza?"

Responde en espanol, corto y util, usando `CURRENT_STATE.md`: proyecto, estado del panel y batch, IH/TB, frontera con MockupTool, SQLite, pendientes y archivos clave.

## Checks Rapidos

```bash
node --check js/main.js
node --check js/illustrator/illustratorBridge.js
node --check js/services/createOrderData.js
node --check js/services/portfolioDb.js
node --check js/utils/pathBuilder.js
node -e "JSON.parse(require('fs').readFileSync('js/config/ihNumberRules.json','utf8')); console.log('ihNumberRules OK')"
```
