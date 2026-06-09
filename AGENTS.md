# RMCOp-Nike - Instrucciones Para Codex

Si entras a este repo como Codex, empieza leyendo:

1. `CODEX_HANDOFF.md`
2. `README.md`
3. `tools/mockup-printer/README.md` solo si el usuario pregunta por mockups, impresion o PDFs listos.

## Si El Usuario Dice "Que Tranza?"

Responde en espanol, corto pero util, con:

- Que es el proyecto.
- Estado actual del panel CEP.
- Estado del batch desde Excel.
- Estado de Indigenous Heritage y Throwback.
- Estado de `tools/mockup-printer`.
- Pendientes principales.
- Archivos clave para continuar.

No inventes contexto de chats. Usa `CODEX_HANDOFF.md` como memoria principal.

## Reglas De Trabajo

- No hagas `git reset`, no reviertas cambios locales y no borres trabajo sin permiso.
- Este repo suele tener cambios en progreso. Si ves archivos modificados, tratalos como trabajo del usuario/proyecto.
- No mezcles `tools/mockup-printer` con el panel CEP; son flujos separados.
- No rompas el flujo manual mientras trabajas batch.
- Throwback (`TB`) es variante de texto, no de Indigenous Heritage.
- Indigenous Heritage debe conservar gap obligatorio de `0.25in` entre digitos.
- Cualquier cambio importante debe probarse con checks Node y, si aplica, en Illustrator real.

## Checks Rapidos

```bash
node --check js/main.js
node --check js/illustrator/illustratorBridge.js
node --check js/services/createOrderData.js
node --check js/utils/pathBuilder.js
node --check tools/mockup-printer/src/generate.js
node --check tools/mockup-printer/src/server.js
node -e "JSON.parse(require('fs').readFileSync('js/config/ihNumberRules.json','utf8')); console.log('ihNumberRules OK')"
```

## Mapa Mental

- `index.html`, `css/styles.css`, `js/main.js`: UI y coordinacion CEP.
- `js/services/createOrderData.js`: Excel batch.
- `js/utils/pathBuilder.js`: plantillas y nombres finales.
- `js/config/variantRules.js`: Standard, Indigenous Heritage, Throwback.
- `jsx/rmcNike.jsx`, `jsx/standardText.jsx`, `jsx/ihNumbers.jsx`: Illustrator.
- `tools/mockup-printer`: herramienta externa para mockups PDF.
