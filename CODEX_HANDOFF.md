# RMCOp-Nike - Handoff Para Otro Codex

Ultima actualizacion: 2026-06-09.

Este archivo es la memoria corta-larga del proyecto. La idea es que otro Codex pueda entrar al repo y, si el usuario pregunta "Que tranza?", lea esto junto con `AGENTS.md` y se ubique sin depender de los chats originales.

## Que Tranza

RMCOp-Nike es un panel CEP para Adobe Illustrator usado en Nike Lacrosse On Demand. Nacio como flujo manual para copiar plantillas PDF, renombrarlas y aplicar nombre/numero en Illustrator. Despues se extendio hacia batch desde Excel y, por separado, hacia una herramienta local para estampar datos sobre mockups PDF de produccion.

Hay tres frentes vivos:

1. Panel CEP principal: pedido individual y lote desde Excel.
2. Reglas Illustrator: Standard/Throwback como texto, Indigenous Heritage con arte expandido/rasterizado.
3. `tools/mockup-printer`: herramienta web/local externa al CEP para PDFs de mockup listos para imprimir.

## Chats/Lineas De Trabajo Detectadas

No se pudo leer el cuerpo completo de todos los chats desde la herramienta de threads, pero si se detectaron estos hilos del proyecto y el repo ya contiene el resultado de varios:

| Thread | Tema | Estado resumido |
|---|---|---|
| `NIKE Standard` | Arreglos del panel inicial, rutas Node/CEP, dropdown de carpetas On Demand, comentarios de flujo | Incorporado en el panel actual. |
| `NIKE IH` | Indigenous Heritage, numeros de 3 digitos, gap obligatorio de `0.25in`, evitar back gigante | Incorporado en `ihNumbers.jsx` y `ihNumberRules.json`; probar siempre en Illustrator real. |
| `Analiza flujo Excel por tallas` | Lectura de Excel Nike On Demand, normalizacion, batch por tallas/familia de style | MVP implementado en `createOrderData.js`, `main.js`, UI batch y guardado PDF/cierre. |
| `Crear dashboard NIKE OP` | Idea de dashboard LAN/admin para ver trabajo, detalles, estados | No mezclar con CEP todavia; si se retoma, hacerlo como modulo separado o app propia. |
| `Crear manual de operacion` | Manual DOCX del panel | Se genero `docs/RMC_NIKE_PANEL_MANUAL_OPERACION_v1.0.docx` y su script. |

## Estado Del Repo

Archivos modificados/no limpios al momento de este handoff:

- `.gitignore`
- `css/styles.css`
- `index.html`
- `js/config/textFitRules.json`
- `js/main.js`
- `tools/`

Tratar cambios locales como trabajo del usuario/proyecto. No hacer `git reset`, no revertir archivos sin permiso.

## Arquitectura Principal

```text
index.html              UI CEP por paginas
css/styles.css          tema visual y layout
js/main.js              coordinador de todo el flujo
js/config/config.js     rutas local/server
js/config/productCatalog.js
js/config/variantRules.js
js/config/textFitRules.json
js/config/ihNumberRules.json
js/services/nodeServices.js
js/services/copyTemplate.js
js/services/createOrderData.js
js/utils/pathBuilder.js
js/illustrator/illustratorBridge.js
js/illustrator/textRules.js
jsx/rmcNike.jsx
jsx/standardText.jsx
jsx/ihNumbers.jsx
jsx/swatches.jsx
tools/mockup-printer/
```

## Flujo Manual Actual

1. Usuario abre Illustrator y panel CEP.
2. Selecciona linea, variante y equipo.
3. Captura WO, style, talla, numero, nombre y destino.
4. El panel resuelve plantilla y nombre final con `pathBuilder.js`.
5. `copyTemplate.js` copia la plantilla al destino.
6. `illustratorBridge.js` carga `jsx/rmcNike.jsx`.
7. Illustrator abre el PDF copiado y aplica datos.

## Flujo Batch Actual

Implementado como MVP en el panel.

Entrada: Excel Nike On Demand.

`js/services/createOrderData.js`:

- Lee primera hoja con `xlsx`.
- Detecta fila de encabezados por `WO`, `Style`, `Size`.
- Normaliza filas.
- Detecta equipo desde `Color`.
- Detecta linea desde `Style`.
- Detecta variante desde sufijo de style (`IH`, `TB`, o Standard).
- Convierte tallas del Excel a tallas del panel.
- Agrupa por talla y por familia de style.

UI batch en `index.html` + `main.js`:

- Seleccionar Excel.
- Seleccionar destino batch.
- Filtrar por familia de style.
- Filtrar por una o varias tallas.
- Ver resumen de filas validas/invalidas.
- Ejecutar batch completo.

Salida batch:

```text
DESTINO/
  A1000/
    SM/
    MD/
    LG/
    XL/
    2X/
```

El batch completo copia, abre, aplica, guarda PDF y cierra documento para cada fila. La funcion JSX usada para guardar/cerrar es `RMCNike_savePdfAndCloseActiveDocument(filePath)`.

## Excel Nike On Demand

Columnas esperadas por encabezado:

```text
WO# / WO / Work Order
Ship Order / SHIP O / SHIP O.
Style
Color / Team Color / Team / Color
Size
Qty / Quantity / Pzs / Pz
Last Name / Name
# / Player# / Player Number / Number
```

El Excel real analizado antes tenia datos desde fila 2 en un caso y otro layout con titulo en A2, encabezados en fila 3 y datos desde fila 4 para mockups. Por eso el importador del CEP detecta encabezados; la herramienta mockup-printer usa su propio layout.

Mapeo de tallas:

```text
XSM, X-SM, XS -> XS
SML, SM -> SM
MED, MD -> MD
LGE, LG -> LG
XLG, XL -> XL
2XL, 2X -> 2X
3XL, 3X -> 3X
```

Casos operativos:

- Nombre y numero vacios no invalidan la fila. Se limpian placeholders con espacios.
- Si no hay nombre ni numero, el nombre final usa `SIN_DATOS`.
- `Qty/Pzs` no duplica PDFs dentro del CEP batch.
- Work Orders repetidas pueden ser validas si cambian talla/nombre/numero.

## Variantes

Fuente de verdad: `js/config/variantRules.js`.

```text
Standard:
  styleSuffix: H/A
  replacementMode: text
  usesVersion: true
  templateFamily: standard

Indigenous Heritage:
  styleSuffix: IH
  replacementMode: ih-raster-number
  usesVersion: false
  templateFamily: indigenous-heritage

Throwback:
  styleSuffix: TB
  replacementMode: text
  usesVersion: false
  templateFamily: throwback
```

Throwback esta modelado, pero falta validacion final con plantillas reales. Cuidado: no tratar TB como IH.

## Rutas Y Plantillas

`js/utils/pathBuilder.js`:

- Standard y Throwback usan `buildTextTemplatePath`.
- IH usa `buildIhTemplatePath`.
- Busca carpetas sin depender de mayusculas/minusculas exactas.
- Tiene fallback por familia de style y talla.
- Acepta aliases de talla tipo `SML`, `MED`, `LGE`, `XLG`, `2XL`.

Raices por variante:

```text
Standard -> STANDARD
Indigenous Heritage -> INDIGENOUS HERITAGE
Throwback -> THROWBACK
```

Nombre final:

```text
WO PLL-Boston Cannons A1000A SM 7.pdf
WO PLL-Boston Cannons A1000IH SM 7.pdf
WO PLL-Boston Cannons A1000TB SM SIN_DATOS.pdf
```

`copyTemplate.js` tambien puede resolver colisiones de nombre agregando identificadores si hace falta. Revisar ese archivo antes de cambiar naming.

## Reglas De Illustrator

`js/illustrator/textRules.js` decide placeholders por linea/equipo.

Standard/TB:

- Reemplazan textFrames exactos con normalizacion de espacios/apostrofes/mayusculas.
- Ajustan nombre por ancho maximo.
- Ajustan numero grande y numero chico por anchos separados.

IH:

- Nombre se reemplaza como texto.
- Numero se arma duplicando grupos desde `NUMEROS F` y `NUMEROS B`.
- Debe conservar gap `0.25in`.
- Si el numero viene vacio en batch, debe ocultar/limpiar targets `N FRONT` y `N BACK`, no dejar placeholders visibles.

## Muestras Oficiales

`jsx/swatches.jsx` y `js/main.js`:

- `Extraer muestras oficiales` pide confirmacion antes de sobreescribir `officialSwatches.json`.
- `Validar muestras` primero ejecuta accion tipo `Add Used Colors` para que entren colores usados al panel de muestras.
- Luego compara contra lista oficial.
- No limpiar muestras automaticamente sin boton dedicado y confirmacion.

## Mockup Printer

Ubicacion: `tools/mockup-printer`.

No es parte del CEP. Es una herramienta web/local para generar mockups PDF listos para imprimir:

- Lee Excel con layout de listas On Demand.
- Detecta mockup PDF correcto.
- Estampa fecha, WO, style, talla y piezas.
- Usa `pdf-lib`.
- Intenta incrustar Aldrich desde `/Users/rmlsub1/Library/Fonts/Aldrich-Regular.ttf`; si no existe, cae a Helvetica Bold.
- Salida por familia style y talla.

Comandos:

```bash
cd tools/mockup-printer
npm install
npm start
```

URL:

```text
http://127.0.0.1:3127
```

## Manual DOCX

Se genero:

```text
docs/RMC_NIKE_PANEL_MANUAL_OPERACION_v1.0.docx
docs/build_rmc_nike_manual.py
```

Nota: en la sesion del manual, el render formal con LibreOffice fallo por libreria faltante `liblcms2.2.dylib`, pero se hizo auditoria estructural y previsualizacion Quick Look de portada.

## Pendientes Concretos

1. Probar batch completo dentro de Illustrator real:
   - selector CEP de Excel.
   - selector CEP de destino.
   - `saveAs` PDF sobre la misma ruta sin dialogos.
   - cierre de documento por cada fila.
2. Confirmar Throwback con plantillas reales:
   - estructura de carpetas.
   - nombres canonicos.
   - previews.
   - placeholders de texto.
3. Probar IH con 1, 2 y 3 digitos en documentos reales.
4. Confirmar si `Qty/Pzs` debe aparecer en algun reporte dentro del CEP o seguir ignorado por diseno.
5. Si se retoma dashboard LAN/admin, hacerlo separado del panel CEP.
6. Evaluar si conviene agregar tests Node para:
   - `createOrderData.js`.
   - `pathBuilder.js`.
   - `variantRules.js`.

## Reglas Para Siguiente Codex

- No revertir cambios locales sin permiso.
- Antes de tocar logica, leer `README.md`, este archivo y `AGENTS.md`.
- Si el usuario dice "Que tranza?", responde con resumen de estado, pendientes y archivos clave.
- Si se toca batch, no romper el flujo manual.
- Si se toca Throwback, no meterlo al flujo IH.
- Si se toca IH, conservar gap `0.25in`.
- Si se toca mockup-printer, no meter dependencias ni UI dentro del CEP.
- Preferir cambios pequenos y probables; este repo depende mucho de validacion en Illustrator real.

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
