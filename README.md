# RMCOp-Nike

Panel CEP para Adobe Illustrator usado para preparar pedidos Nike Lacrosse On Demand. El panel copia plantillas PDF, genera nombres de salida, abre la copia en Illustrator y aplica nombre/numero segun la variante seleccionada.

Ultima actualizacion de contexto: 2026-06-04.

## Estado Actual

- Lineas activas: `masculino` y `femenino`.
- Variantes activas en codigo: `Standard` e `Indigenous Heritage`.
- Variante nueva anunciada: `Throwback` / `TB`. Todavia no esta implementada; solo se debe agregar despues de analizar rutas, previews, nombres de archivo y modo de reemplazo.
- Standard usa textos editables para nombre y numero.
- Indigenous Heritage usa texto editable para nombre, pero arma numeros duplicando arte expandido/rasterizado desde capas `NUMEROS F` y `NUMEROS B`.
- El selector de Variante aparece en `1 Equipo` y `2 Pedido`; ambos dropdowns se sincronizan.
- La validacion de muestras primero ejecuta una accion equivalente a `Add Used Colors` / `Anadir colores usados`, y luego compara contra `js/config/officialSwatches.json`.

## Stack

- CEP / HTML / CSS / JavaScript para el panel.
- Node.js/CommonJS dentro de CEP para rutas, copias y lectura de JSON.
- ExtendScript `.jsx` para operaciones dentro de Illustrator.
- `fs-extra` para copiar archivos.
- macOS como entorno principal.

## Estructura Principal

```text
RMCOp-Nike/
  CSXS/manifest.xml
  index.html
  css/styles.css
  js/
    main.js
    config/
      config.js
      productCatalog.js
      textFitRules.json
      ihNumberRules.json
      officialSwatches.json
    illustrator/
      illustratorBridge.js
      textRules.js
    services/
      nodeServices.js
      copyTemplate.js
    ui/
      orderView.js
      previewView.js
      teamsView.js
    utils/pathBuilder.js
  jsx/
    rmcNike.jsx
    rmcNikeUtils.jsx
    standardText.jsx
    ihNumbers.jsx
    swatches.jsx
  previews/
  temp/
```

## Flujo Operativo

1. El usuario selecciona Linea, Variante y Equipo.
2. En Pedido captura Work Order, Style, Talla, Numero, Nombre y destino.
3. `js/main.js` construye la vista previa con:
   - `js/utils/pathBuilder.js` para plantilla y nombre final.
   - `js/services/copyTemplate.js` para detectar duplicados y copiar.
4. El panel abre la copia en Illustrator via `js/illustrator/illustratorBridge.js`.
5. `jsx/rmcNike.jsx` aplica nombre/numero:
   - Standard: `jsx/standardText.jsx`.
   - Indigenous Heritage: `jsx/ihNumbers.jsx`.
6. La consola del panel muestra diagnosticos de copia, reemplazo y ajuste.

## Configuracion De Rutas

Archivo: `js/config/config.js`.

```js
module.exports = {
  mode: "server",
  paths: {
    local: {
      templatesBase: "/Users/rmlsub1/Documents/pruebas/PATRONES PARA ROLLO/NIKE LACROSSE",
      ordersBase: "/Users/rmlsub1/Documents/pruebas/TO PRINT/NIKE ORDERS"
    },
    server: {
      templatesBase: "/Volumes/Fullsize/PATRONES ACOMODADOS PARA ROLLO/NIKE LACROSSE/RMCOp-NIKE",
      ordersBase: "/Volumes/Fullsize/TO PRINT/NIKE ORDERS"
    }
  }
};
```

Cambiar `mode` entre `local` y `server` segun el entorno. No hardcodear rutas nuevas en `main.js`.

## Catalogo: Lineas, Equipos Y Variantes

Archivo: `js/config/productCatalog.js`.

Actualmente contiene:

- Equipos masculinos: Boston, California, Carolina, Denver, Maryland, New York, Philadelphia, Utah.
- Equipos femeninos: Boston, California, Maryland, New York.
- Styles base:
  - Masculino: `A1000`, `Y1000`.
  - Femenino: `A2000`, `Y2000`.
- Variantes:
  - `Standard`, slug `standard`, code `STD`, replacementMode `text`.
  - `Indigenous Heritage`, slug `indigenous-heritage`, code `IH`, replacementMode `raster`.

Para agregar Throwback/TB mas adelante, revisar como minimo:

- `js/config/productCatalog.js`: agregar variante `Throwback`, slug probable `throwback`, code `TB`, replacementMode probable `text`.
- `js/utils/pathBuilder.js`: agregar codigo `TB`, carpeta raiz y reglas de busqueda de plantilla.
- `js/illustrator/textRules.js`: asegurar que TB sea tratado como texto editable, no como raster.
- `js/ui/previewView.js`: confirmar nombres esperados de previews.
- `js/config/textFitRules.json`: si usa mismas medidas que Standard, no deberia requerir reglas nuevas, pero el parser de style debe reconocer sufijo `TB`.
- Plantillas reales: confirmar estructura de carpetas y nombre final esperado antes de tocar codigo.

## Rutas Y Nombres De Plantilla

Archivo: `js/utils/pathBuilder.js`.

Standard busca dentro de:

```text
STANDARD/
  NIKE Mens and Youth|NIKE Girls and Ladies/
    MENS|YOUTH|Ladies|Girls/
      HOME|AWAY/
        Equipo Home|Equipo Away/
```

El nombre canonico esperado para Standard es:

```text
PLL-BOS-A1000A MD.pdf
```

Indigenous Heritage busca dentro de:

```text
INDIGENOUS HERITAGE/
  NIKE IH Mens and Youth|NIKE IH Girls and Ladies/
    MENS|YOUTH|Ladies|Girls/
      BOSTON IH/
```

Tiene fallback para encontrar archivos viejos por familia de style y talla.

El nombre final del pedido se arma en `buildOutputName` con:

```text
WO PLL-Boston Cannons A1000A SM 7.pdf
WO PLL-Boston Cannons A1000IH SM 7.pdf
```

Nota: para variantes no Standard se agrega el codigo de variante al style si no existe ya. Revisar esto al implementar TB para evitar sufijos duplicados.

## Reemplazo Standard

Archivos:

- `js/illustrator/textRules.js`
- `jsx/rmcNike.jsx`
- `jsx/standardText.jsx`

Placeholders actuales por equipo:

- Masculino:
  - Boston: numero `1`, nombre `HOLMAN`
  - California: `96`, `KAVANAGH`
  - Carolina: `0`, `RIORDEN`
  - Denver: `42`, `O'NEILL`
  - Maryland: `7`, `MALONE`
  - New York: `9`, `BAPTISTE`
  - Philadelphia: `22`, `SOWERS`
  - Utah: `26`, `SCHREIBER`
- Femenino:
  - Boston: `8`, `NORTH`
  - California: `12`, `MASTROIANNI`
  - Maryland: `11`, `BLACK`
  - New York: `27`, `SCANE`

Standard reemplaza textFrames cuyo contenido coincida con el placeholder normalizado. El numero grande se detecta como el textFrame mas ancho; los demas se tratan como numeros chicos/front.

## Ajustes De Ancho

Archivo: `js/config/textFitRules.json`.

Unidad: pulgadas.

Campos por style family:

- `nameMaxWidth`: limite de nombre.
- `numberMaxWidth`: limite de numero grande/back.
- `smallNumberMaxWidth`: limite de numero chico/front.

Valores base actuales:

```text
A1000/A2000: name 11, number 13, small 12
Y1000/Y2000: name 8, number 11, small 10
```

`minScale` global actual: `50`.

Para Standard, los numeros se ajustan por ancho de objeto, parecido al campo Ancho de Illustrator.

## Indigenous Heritage

Archivos:

- `js/config/ihNumberRules.json`
- `jsx/ihNumbers.jsx`

IH no escribe el numero como texto. Duplica grupos desde:

- Front: capa `NUMEROS F`, grupos `0 F`, `1 F`, etc.
- Back: capa `NUMEROS B`, grupos `0 B`, `1 B`, etc.

Los grupos destino/base esperados:

- Front: `N FRONT`, `BASE FRONT`, salida `RMC FRONT NUMBER`.
- Back: `N BACK`, `BASE BACK`, salida `RMC BACK NUMBER`.

Regla importante: el gap entre digitos es `0.25in` y es obligatorio. La implementacion actual no escala el grupo completo cuando hay 3 digitos; reserva los gaps, escala cada digito si hace falta y luego reacomoda con gap fijo. Esto evita que el gap baje a valores como `.23in` y evita que el back quede gigante por culpa de `minScale`.

## Previews

Modulo: `js/ui/previewView.js`.

Formato recomendado:

```text
previews/teams/{linea}/{variant-slug}/{team-slug}-{variant-code-or-slug}-{version}.webp
```

Ejemplos:

```text
previews/teams/masculino/standard/boston-standard-home.webp
previews/teams/masculino/standard/boston-standard-away.webp
previews/teams/masculino/indigenous-heritage/boston-ih-overview.webp
previews/teams/masculino/indigenous-heritage/boston-indigenous-heritage-overview.webp
```

El modulo prueba varias rutas fallback. Para IH, `version` normalmente se pinta como `overview` porque no usa Home/Away en ruta por ahora.

## Muestras Oficiales

Archivos:

- `jsx/swatches.jsx`
- `js/config/officialSwatches.json`
- `js/main.js`

Botones actuales:

- `Extraer muestras oficiales`: guarda la lista del documento activo en `officialSwatches.json`. Usar solo con una plantilla autorizada.
- `Validar muestras de documento`: antes de validar, corre una accion temporal equivalente a `Add Used Colors` / `Anadir colores usados`, para que colores usados pero no listados en Muestras entren a la paleta. Despues compara contra la lista oficial.

Esto ayuda a detectar colores RGB accidentales o muestras no autorizadas que esten aplicadas en el arte.

No se implemento limpieza automatica de muestras no usadas. Recomendacion pendiente: si se agrega, hacerlo como boton separado con confirmacion, no como parte automatica de validar.

## UI Reciente

- Paso `1 Equipo` tiene Linea y Variante junto al grid de equipos.
- Paso `2 Pedido` conserva Variante junto al resumen del equipo.
- Ambos selects de Variante usan clase `.variant-select` y se sincronizan desde `orderView.syncVariantSelects`.
- La cabecera de Paso 1 es responsive: en panel angosto el titulo ocupa una fila y los dropdowns bajan a la siguiente para evitar empalmes.

## Como Probar Cambios

No hay suite automatica formal. Checks utiles:

```bash
node --check js/main.js
node --check js/illustrator/illustratorBridge.js
node -e "JSON.parse(require('fs').readFileSync('js/config/ihNumberRules.json','utf8')); console.log('ihNumberRules OK')"
```

Prueba manual recomendada en Illustrator:

1. Abrir el panel CEP.
2. Seleccionar Linea, Variante y Equipo.
3. Capturar pedido.
4. Revisar que la ruta de plantilla exista en Paso 3.
5. Crear copia.
6. Abrir y aplicar datos.
7. Para Standard: probar nombre largo, numero de 1, 2 y 3 digitos.
8. Para IH: probar numero de 1, 2 y 3 digitos, confirmando gap visual de `0.25in`.
9. Validar muestras en un documento con un color no autorizado para confirmar que aparece en consola.

## Notas Para Otra Sesion De Codex

- No revertir cambios no relacionados: el repo suele tener archivos modificados y previews nuevos sin trackear.
- Antes de tocar Throwback/TB, confirmar estructura real de carpetas y nombres de plantilla.
- TB fue reportada como variante con numeros editables como Standard y mismas medidas, pero esto aun no esta codificado.
- Si TB usa texto editable, evitar meterlo al flujo IH/raster.
- Revisar `textRules.js`: hoy cualquier variante que no sea `Standard` se manda a `raster-number`. Eso debe cambiar antes de implementar TB.
- Revisar `getStyleFamily` en `main.js` y `getStyleSearchFamily` en `pathBuilder.js`: hoy reconocen `IH` y `H/A`, pero no `TB`.
- Revisar `variantCodes` y `getVariantRootFolder` en `pathBuilder.js`: hoy solo conocen IH.
- Si se agregan previews TB, usar `.webp`, minusculas y guiones.
