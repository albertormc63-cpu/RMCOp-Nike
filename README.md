# RMCOp-Nike

Panel CEP para Adobe Illustrator usado en pedidos Nike Lacrosse On Demand. Resuelve plantillas PDF, crea la copia de produccion y aplica nombre/numero mediante JavaScript CEP y ExtendScript.

## Alcance

- Flujo manual para pedidos individuales.
- Batch Excel en modos `Personalizadas` y `Genericas`.
- Variantes `Standard`, `Indigenous Heritage` y `Throwback`.
- Registro de produccion en SQLite compartida.

Los mockups PDF pertenecen al CEP separado `RMC MockupTool`; no se desarrollan en este repo.

## Inicio Rapido De Contexto

1. `AGENTS.md`: reglas obligatorias y checks.
2. `CURRENT_STATE.md`: estado vigente y pendientes.
3. `TASK_ROUTER.md`: documento tematico segun la tarea.

## Mapa Ejecutivo

```text
index.html, css/styles.css       UI CEP
js/main.js                      coordinacion manual y batch
js/services/createOrderData.js  importacion Excel
js/services/portfolioDb.js      registro SQLite
js/utils/pathBuilder.js         plantillas, rutas y nombres
js/config/variantRules.js       Standard, IH y Throwback
js/illustrator/                 puente y reglas de texto
jsx/                            operaciones en Illustrator
```

## Documentacion

- `docs/architecture/RMCOP_NIKE_ARCHITECTURE.md`
- `docs/architecture/ILLUSTRATOR_RULES.md`
- `docs/architecture/MOCKUPTOOL_BOUNDARY.md`
- `docs/processes/EXCEL_IMPORT_AND_VALIDATION.md`
- `docs/processes/MANUAL_FLOW.md`
- `docs/processes/BATCH_FLOW.md`
- `docs/sqlite/SQLITE_PORTFOLIO_AND_REGISTRY.md`
- `docs/ui/RMC_CEP_UI_UX_MANIFEST.md`
- `docs/archive/CODEX_HANDOFF_2026-06-22.md`

## Stack

CEP, HTML/CSS/JavaScript, Node.js/CommonJS, ExtendScript, `fs-extra`, `xlsx`, `/usr/bin/sqlite3` y macOS.

No hay suite automatica formal. Los checks de sintaxis vigentes estan en `AGENTS.md`; las operaciones Illustrator deben validarse en Illustrator real.
