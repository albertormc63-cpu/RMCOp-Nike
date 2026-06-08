# RMCOp-Nike - Contexto Para Siguiente Codex

Ultima actualizacion: 2026-06-05.

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

- Fila 14: WO `173341`, `A1000H`, `X006 OD Whipsnakes`, `2XL`, pero sin nombre y sin numero. Debe marcarse como error o advertencia antes de procesar.
- Filas con `Qty = 2`:
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
- `name` y `number` requeridos para personalizacion.
- `qty > 1` debe mostrarse como advertencia hasta confirmar regla operativa.

### Fase 2: UI De Revision Por Tallas

La UI actual tiene:

- Paso 1: Equipo.
- Paso 2: Pedido manual.
- Paso 3: Revisar y procesar.

Para batch desde Excel conviene agregar un modo nuevo en lugar de destruir el manual:

- Modo `Pedido individual`: conserva flujo actual.
- Modo `Excel / Batch`: importa Excel y muestra resumen.

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
4. Guardar.
5. Cerrar.
6. Continuar con la siguiente fila.

Falta agregar una funcion ExtendScript segura, por ejemplo:

```js
RMCNike_saveAndCloseActiveDocument()
```

Y exponerla en:

```text
js/illustrator/illustratorBridge.js
```

Sin guardar/cerrar automatico, el batch se puede quedar abriendo documentos sin control.

## Preguntas Abiertas

Antes de implementar procesamiento final, confirmar con el usuario:

1. Si `Qty = 2`, se genera un solo PDF o se duplican salidas?
2. La fila sin nombre/numero debe omitirse, detener todo el proceso o producir plantilla sin personalizacion?
3. El destino por talla debe ser exactamente `SM/MD/LG/XL/2X` o conservar nombres del Excel `SML/MED/LGE/XLG/2XL`?
4. El `Ship Order` debe aparecer en algun reporte/log aunque no se use en el nombre del PDF?
5. El modo manual debe quedarse visible como respaldo? Recomendacion actual: si.

## Reglas De Implementacion A Cuidar

- No romper el flujo manual actual.
- No hardcodear rutas nuevas en `main.js`.
- Reusar `pathBuilder.js` para nombres/rutas de plantilla.
- Mantener `Color -> team` dentro de una funcion clara y testeable.
- Mantener `sizeRaw` y `size` para auditoria.
- Reportar errores por fila antes de procesar.
- No procesar batch si hay filas invalidas, salvo que el usuario apruebe saltarlas.
- Para nombres de archivo, seguir usando `buildOutputName` para evitar inconsistencias con lo ya probado.

## Estado De Trabajo

Hasta este punto solo se analizo el proyecto y el Excel. No hay cambios implementados en el flujo batch.

El siguiente paso recomendado es implementar la Fase 1: lector Excel -> JSON normalizado, con una pequena vista de resumen o un comando temporal de prueba antes de tocar el procesamiento de Illustrator.
