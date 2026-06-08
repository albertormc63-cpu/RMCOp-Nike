# RMCOp-Nike - Contexto Para Siguiente Codex

Ultima actualizacion: 2026-06-08.

Este archivo existe para que otro Codex pueda abrir este repo y entender el hilo del trabajo sin depender del chat original. Leer tambien `README.md`, porque ahi esta el contexto tecnico general del panel.

## Resumen Del Proyecto

RMCOp-Nike es un panel CEP para Adobe Illustrator. Su flujo actual prepara pedidos Nike Lacrosse On Demand:

1. El usuario selecciona linea, variante y equipo.
2. Captura manualmente Work Order, Style, Talla, Numero, Nombre y destino.
3. El panel resuelve la plantilla PDF, crea una copia con nombre final y la abre en Illustrator.
4. Illustrator aplica nombre y numero sobre la copia.

Archivos clave:

- `index.html`: estructura de pantallas/secciones.
- `js/main.js`: coordinador principal del flujo.
- `js/config/variantRules.js`: reglas compartidas de variantes para batch/rutas (`Standard`, `Indigenous Heritage`, `Throwback`).
- `js/ui/orderView.js`: captura manual del pedido y validaciones.
- `js/services/nodeServices.js`: carga servicios CommonJS dentro de CEP.
- `js/services/copyTemplate.js`: copia de plantilla y resolucion de duplicados.
- `js/services/createOrderData.js`: reservado para lectura/normalizacion desde Excel. Este es el mejor lugar para la proxima etapa.
- `js/utils/pathBuilder.js`: resuelve plantilla y nombre final.
- `js/config/productCatalog.js`: lineas, equipos, nicknames, styles y variantes.
- `js/illustrator/illustratorBridge.js`: puente CEP -> ExtendScript.
- `jsx/rmcNike.jsx`: entrada ExtendScript para abrir archivo y aplicar nombre/numero.

## Cambio Nuevo Que Se Esta Analizando

El proceso ya no deberia depender solo de captura manual. La empresa entrego un Excel con pedidos Nike On Demand para acelerar trabajo entre areas.

Archivo analizado en chat:

```text
/Volumes/Fullsize/NIKE ON DEMAND 12 JUN.XLSX
```

Columnas esperadas:

- A: `Work Order`
- B: `Ship Order` (diseno no lo usa directamente, pero otros procesos si)
- C: `Style`
- D: `Color`
- E: `Size`
- F: `Qty`
- G: `Last Name`
- H: `Player#`

Importante: aunque inicialmente se penso que los datos venian despues de la fila 2, el Excel real trae encabezados en fila 1 y datos reales desde fila 2. El importador debe iniciar en fila 2.

## Hallazgos Del Excel Real

Resumen del archivo `NIKE ON DEMAND 12 JUN.XLSX`:

- Hoja: `Sheet1`.
- Filas de datos: 138 si se incluye la fila 2.
- Styles:
  - `A1000H`: 103 filas.
  - `A1000A`: 35 filas.
- Variantes detectadas:
  - Todo el archivo es `Standard`.
  - No hay `IH`, `A2000`, `Y1000`, `Y2000` en este archivo.
- Version:
  - `H` = Home.
  - `A` = Away.
- Linea:
  - `A1000...` = masculino / PLL.

Tallas del Excel:

```text
XLG: 35
LGE: 32
SML: 29
MED: 27
2XL: 15
```

El panel actual usa codigos de talla distintos:

```text
SML -> SM
MED -> MD
LGE -> LG
XLG -> XL
2XL -> 2X
```

El campo `Color` sirve para inferir equipo por nickname:

```text
X001 OD Archers     -> Utah
X002 OD Atlas       -> New York
X003 OD Cannons     -> Boston
X004 OD Chaos       -> Carolina
X005 OD Outlaws     -> Denver
X006 OD Whipsnakes  -> Maryland
X007 OD Waterdogs   -> Philadelphia
X008 OD Redwoods    -> California
```

Casos especiales detectados:

- Fila 14: WO `173341`, `A1000H`, `X006 OD Whipsnakes`, `2XL`, viene sin nombre y sin numero por decision del cliente. Es valida, debe limpiar placeholders de nombre/numero con espacios y el nombre final debe usar `SIN_DATOS`.
- Filas con `Qty = 2` no afectan diseno. Se genera una sola copia; produccion/imprenta imprime la cantidad indicada:
  - Fila 21: WO `173248`, `A1000A`, Cannons, `LGE`, REGNERY, `13`.
  - Fila 32: WO `173200`, `A1000A`, Whipsnakes, `LGE`, SPALLINA, `22`.
- Hay Work Orders repetidas, pero no necesariamente son errores. Algunas cambian talla o nombre:
  - `173251`: `2XL` y `XLG`.
  - `173475`: mismo numero, distinto nombre.
  - `173229`: `LGE` y `SML`.
  - `173507`: `SML` y `XLG`.

## Propuesta De Implementacion

No se han hecho cambios aun para esta etapa. La propuesta es implementar en fases.

### Fase 1: Importador Excel A JSON

Crear/llenar `js/services/createOrderData.js` con una funcion que lea Excel y normalice filas a objetos del panel.

Dependencia probable:

```text
xlsx
```

El repo hermano `albertormc63-cpu/RMC-Panel` usa `xlsx` en `package.json`, asi que se puede seguir ese patron.

Objeto normalizado sugerido:

```json
{
  "sourceRow": 2,
  "wo": "173203",
  "shipOrder": "5444812",
  "style": "A1000H",
  "color": "X003 OD Cannons",
  "team": "Boston",
  "line": "masculino",
  "variant": "Standard",
  "version": "Home",
  "sizeRaw": "2XL",
  "size": "2X",
  "qty": 1,
  "name": "NOLTING",
  "number": "32"
}
```

Validaciones minimas:

- `wo` requerido.
- `style` requerido y reconocible.
- `color` debe mapear a equipo.
- `size` debe mapear a talla del panel.
- `name` y `number` pueden venir vacios. Si ambos estan vacios, la fila es valida, se reemplazan los placeholders con espacios y el archivo final usa `SIN_DATOS`.
- `qty > 1` debe mostrarse como advertencia hasta confirmar regla operativa.

### Fase 2: UI De Revision Por Tallas

La UI actual tiene:

- Paso 1: Equipo.
- Paso 2: Pedido manual.
- Paso 3: Revisar y procesar.

Para batch desde Excel conviene agregar un modo nuevo en lugar de destruir el manual:

- Modo `Pedido individual`: conserva flujo actual.
- Modo `Por lote`: importa Excel y muestra resumen.

Pantalla batch sugerida:

- Boton para seleccionar `.xlsx`.
- Selector de destino general.
- Resumen:
  - total de filas.
  - filas validas.
  - errores.
  - tallas encontradas.
- Vista agrupada por talla: `SM`, `MD`, `LG`, `XL`, `2X`.
- Tabla con: fila origen, WO, Ship Order, Team, Style, Size, Qty, Name, Number, estado.

### Fase 3: Exportar Por Tallas

Para entregar a otras lineas, se recomienda crear subcarpetas dentro del destino:

```text
Destino/
  SM/
  MD/
  LG/
  XL/
  2X/
```

Cada PDF debe caer en la carpeta de su talla normalizada.

Se puede reutilizar:

- `buildTemplatePath(...)`
- `buildOutputName(...)`
- `copyTemplate(...)`

Probable ajuste: permitir que `destinationFolder` sea `destinoBase/talla`.

### Fase 4: Batch Completo En Illustrator

El flujo actual abre y aplica datos a una orden manual, pero no esta orientado a muchas filas seguidas.

Para automatizar de verdad cada fila:

1. Copiar plantilla.
2. Abrir copia en Illustrator.
3. Aplicar nombre/numero.
4. Guardar como PDF sobre la misma ruta.
5. Cerrar.
6. Continuar con la siguiente fila.

Funcion ExtendScript actual:

```js
RMCNike_savePdfAndCloseActiveDocument(filePath)
```

Y exponerla en:

```text
js/illustrator/illustratorBridge.js
```

Debe usar `PDFSaveOptions`, `doc.saveAs(new File(filePath), pdfOptions)` y cerrar con `SaveOptions.DONOTSAVECHANGES`. No usar `doc.save()` para batch PDF, porque Illustrator puede crear un `.ai` adicional.

## Preguntas Abiertas

Antes de implementar procesamiento final, confirmar con el usuario:

1. El destino por talla debe ser exactamente `SM/MD/LG/XL/2X` o conservar nombres del Excel `SML/MED/LGE/XLG/2XL`?
2. El `Ship Order` debe aparecer en algun reporte/log aunque no se use en el nombre del PDF?
3. El modo manual debe quedarse visible como respaldo? Recomendacion actual: si.

## Reglas De Implementacion A Cuidar

- No romper el flujo manual actual.
- No hardcodear rutas nuevas en `main.js`.
- Reusar `pathBuilder.js` para nombres/rutas de plantilla.
- Mantener `Color -> team` dentro de una funcion clara y testeable.
- Mantener `sizeRaw` y `size` para auditoria.
- Reportar errores por fila antes de procesar.
- No procesar batch si hay filas invalidas reales, salvo que el usuario apruebe saltarlas. Nombre y numero vacios no son invalidos si ambos vienen vacios.
- Para nombres de archivo, seguir usando `buildOutputName` para evitar inconsistencias con lo ya probado.

## Estado De Trabajo

Ya se empezo implementacion MVP en rama `Nike-Op`.

Implementado:

- Dependencia `xlsx` agregada para leer `.XLSX`.
- `js/services/createOrderData.js` lee Excel, normaliza filas, detecta equipo desde `Color`, convierte tallas del Excel a tallas del panel y marca errores por fila.
- `js/config/variantRules.js` centraliza sufijos y modo de reemplazo: `A1000H/A1000A` = Standard, `A1000IH` = IH, `A1000TB` = Throwback.
- `js/services/nodeServices.js` expone `createOrderDataFromExcel`.
- `js/utils/pathBuilder.js` acepta aliases de tallas `SML/MED/LGE/XLG/2XL`.
- `index.html` y `css/styles.css` agregan pagina `Por lote` con selector de talla (`Todas` o una talla especifica).
- `js/main.js` permite importar Excel, elegir destino batch, ver resumen y ejecutar batch completo por talla seleccionada.
- `jsx/rmcNike.jsx` y `js/illustrator/illustratorBridge.js` agregan guardado PDF/cierre sobre la misma ruta de salida.

Verificado localmente con `/Volumes/Fullsize/NIKE ON DEMAND 12 JUN.XLSX`:

- 138 filas leidas.
- 138 filas validas.
- 0 filas invalidas.
- Fila 14 se trata como blank intencional, limpia placeholders de nombre/numero y se guarda con `SIN_DATOS`.
- `Qty > 1` no genera copias duplicadas ni advertencias; no afecta al area de diseno.
- 0 plantillas faltantes contra rutas `server`.

Notas de variantes:

- Standard y Throwback usan reemplazo de texto para nombre y numero.
- Indigenous Heritage usa texto para nombre y arte expandido/rasterizado para numero.
- IH sin numero debe ocultar `N FRONT` y `N BACK`; no debe dejar placeholders visibles.
- Throwback ya aparece en dropdowns porque `productCatalog.js` incluye la variante, pero falta confirmar estructura real de carpetas/plantillas/previews antes de darlo por listo en produccion.

Pendiente de probar dentro de Illustrator:

- Selector CEP de archivo/carpeta en la pagina `Por lote`.
- Boton `Crear, aplicar y cerrar talla seleccionada`.
- Confirmar que `saveAs` con `PDFSaveOptions` reemplaza el PDF modificado sin dialogos en el entorno real.
