# Proceso `readExcel.js` - Extraccion de datos desde Excel

Este documento describe exclusivamente como `js/readExcel.js` lee el Excel del roster y que filas/columnas usa para generar `output.json`.

La finalidad es poder reutilizar esta idea en otro repo sin depender del resto del CEP.

## Uso en RMCOp-Nike

El panel `RMCOp-Nike` ya reutiliza esta estructura desde `js/services/createOrderData.js` como formato `generic-roster`.

En este repo no se genera `output.json`; el Excel se transforma directo al mismo shape de pedido que usa el batch:

```text
wo, shipOrder, style, color, line, team, variant, version, styleFamily,
size, qty, name, number, sourceFormat, rosterName
```

Reglas agregadas en `RMCOp-Nike`:

- Si no hay columna `WO`, se infiere desde `A1` o desde el nombre del archivo buscando textos tipo `WO 173830 WO 173836`.
- Si hay varios WO, se guardan unidos con guion, por ejemplo `173830-173836`.
- `Ship Order #` se toma del bloque superior del Excel y se usa como `shipOrder` fijo.
- `TOTAL PIECES` se toma como referencia del roster.
- `Qty` se guarda como piezas para la BD; no duplica PDFs.
- `Last Name` es el texto que se aplica en Illustrator.
- `Player#` es el numero que se aplica como texto en Standard/TB o como numero IH.

## Archivo responsable

```text
js/readExcel.js
```

## Dependencias

El script usa:

```js
const { execSync } = require("child_process");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
```

Dependencias externas:

```text
xlsx
```

El script esta pensado para ejecutarse con Node desde el panel CEP.

## Entrada

El usuario selecciona manualmente un archivo Excel mediante un selector de macOS:

```js
osascript -e 'POSIX path of (choose file with prompt "Selecciona el archivo Excel" of type {"org.openxmlformats.spreadsheetml.sheet", "com.microsoft.excel.xls"})'
```

Formatos aceptados:

- `.xlsx`
- `.xls`

Si el usuario cancela, el script imprime:

```text
CANCELLED
```

y termina con `process.exit(0)`.

## Salida

El script genera:

```text
output.json
```

en la raiz del repo/extension.

La ruta se calcula asi:

```js
const PANEL_ROOT = path.resolve(__dirname, "..");
const jsonPath = path.join(PANEL_ROOT, "output.json");
```

Antes de procesar, si ya existe un `output.json`, lo borra:

```js
if (fs.existsSync(jsonPath)) {
    fs.unlinkSync(jsonPath);
}
```

## Lectura del workbook

El script lee la primera hoja del archivo Excel:

```js
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
```

Luego convierte la hoja a matriz:

```js
const data = XLSX.utils.sheet_to_json(sheet, {
  header: 1,
  defval: ""
});
```

Con `header: 1`, `xlsx` devuelve un array de arrays:

```js
data[fila][columna]
```

Importante:

- En Excel las filas empiezan en `1`.
- En JavaScript los indices empiezan en `0`.
- Por eso `A1` se lee como `data[0][0]`.

## Celdas fijas usadas

| Dato | Celda Excel | Indice JS | Codigo |
| --- | --- | --- | --- |
| Nombre del roster | `A1` | `data[0][0]` | `const rosterName = data[0] ? data[0][0] : "";` |
| Total de piezas | `C14` | `data[13][2]` | `const totalUnits = data[13] ? data[13][2] : "";` |

## Fila de encabezados

Los encabezados se leen desde la fila 16 de Excel:

```text
Fila Excel: 16
Indice JS: 15
```

Codigo:

```js
const headers = data[15];
if (!headers) throw new Error("No se encontraron encabezados en la fila 16");
```

## Encabezados requeridos

El script busca estas columnas por nombre exacto:

| Campo interno | Encabezado esperado en Excel |
| --- | --- |
| `style` | `Style` |
| `firstName` | `First Name` |
| `lastName` | `Last Name` |
| `player` | `Player#` |
| `size` | `Size` |
| `position` | `Position` |

Codigo:

```js
const idxStyle = headers.indexOf("Style");
const idxFirstName = headers.indexOf("First Name");
const idxLastName = headers.indexOf("Last Name");
const idxPlayer = headers.indexOf("Player#");
const idxSize = headers.indexOf("Size");
const idxPosition = headers.indexOf("Position");
```

Nota importante: actualmente el script no detiene el proceso si alguno de estos encabezados devuelve `-1`. Si se porta a otro repo, conviene agregar validacion explicita para fallar con un mensaje claro cuando falte una columna.

## Filas de datos

Las filas reales de jugadores/piezas empiezan en la fila 17 de Excel:

```text
Fila Excel inicial: 17
Indice JS inicial: 16
```

Codigo:

```js
const rows = data.slice(16);
```

## Filtro de filas validas

Solo se procesan filas que tengan valor en la columna `Style`:

```js
.filter(row => row[idxStyle])
```

Si una fila no tiene `Style`, se ignora.

## Mapeo de columnas a JSON

Cada fila valida se transforma asi:

```js
{
  style: row[idxStyle],
  variant: row[idxStyle]
    ? obtenerVariant(row[idxStyle])
    : "",
  size: row[idxSize],
  firstName: row[idxFirstName],
  lastName: row[idxLastName],
  player: (row[idxPlayer] !== "" && row[idxPlayer] != null)
    ? String(row[idxPlayer]).replace(/\s+/g, "")
    : null,
  position: row[idxPosition]
}
```

## Tabla completa de extraccion

| JSON | Fuente en Excel | Regla |
| --- | --- | --- |
| `roster` | `A1` | Toma el valor directo. |
| `totalPieces` | `C14` | Toma el valor directo. |
| `players[].style` | Columna con header `Style` | Toma el valor directo. |
| `players[].variant` | Columna `Style` | Toma la ultima letra del style, excepto `TPACK`. |
| `players[].size` | Columna con header `Size` | Toma el valor directo. |
| `players[].firstName` | Columna con header `First Name` | Toma el valor directo. |
| `players[].lastName` | Columna con header `Last Name` | Toma el valor directo. |
| `players[].player` | Columna con header `Player#` | Convierte a string y quita espacios. Si esta vacio, usa `null`. |
| `players[].position` | Columna con header `Position` | Toma el valor directo. |

## Logica de `variant`

La variante se calcula desde el campo `Style`.

Funcion:

```js
function obtenerVariant(style) {
    style = String(style);
    if (style == "TPACK") {
        return "TPACK";
    }

    return style.slice(-1);
}
```

Ejemplos:

| Style | Variant |
| --- | --- |
| `T5000A` | `A` |
| `T1600Y` | `Y` |
| `A2000H` | `H` |
| `TPACK` | `TPACK` |

## Limpieza del numero de jugador

El campo `Player#` se limpia asi:

```js
String(row[idxPlayer]).replace(/\s+/g, "")
```

Esto elimina espacios internos, iniciales y finales.

Ejemplos:

| Valor Excel | Valor JSON |
| --- | --- |
| `7` | `"7"` |
| `07` | `"07"` |
| ` 12 ` | `"12"` |
| `1 2` | `"12"` |
| vacio | `null` |

## Estructura final de `output.json`

```json
{
  "roster": "79135-26 Timber Creek T5000 Reorder WO 173714",
  "totalPieces": "4",
  "players": [
    {
      "style": "T5000A",
      "variant": "A",
      "size": "MED",
      "firstName": "",
      "lastName": "HEDGEBETH Jr",
      "player": "1",
      "position": ""
    }
  ]
}
```

## Contrato minimo para portar a otro repo

Para implementar esta idea en otro repo, se necesita:

1. Instalar `xlsx`.
2. Ejecutar el script con Node.
3. Definir donde se guardara el JSON de salida.
4. Mantener o adaptar las celdas fijas:
   - `A1` para roster.
   - `C14` para total de piezas.
   - Fila 16 para encabezados.
   - Fila 17 en adelante para datos.
5. Mantener o adaptar los nombres exactos de encabezados:
   - `Style`
   - `First Name`
   - `Last Name`
   - `Player#`
   - `Size`
   - `Position`
6. Consumir el JSON con el mismo contrato:
   - `roster`
   - `totalPieces`
   - `players[]`

## Recomendacion para mejorar al portar

Al llevar este proceso a otro repo, conviene agregar validacion de columnas requeridas:

```js
const requiredHeaders = ["Style", "First Name", "Last Name", "Player#", "Size", "Position"];
const missing = requiredHeaders.filter(name => headers.indexOf(name) === -1);

if (missing.length > 0) {
  throw new Error("Faltan columnas requeridas: " + missing.join(", "));
}
```

Tambien conviene convertir las posiciones importantes a constantes:

```js
const ROSTER_CELL = { row: 0, col: 0 };      // A1
const TOTAL_CELL = { row: 13, col: 2 };      // C14
const HEADER_ROW_INDEX = 15;                 // Fila 16
const FIRST_DATA_ROW_INDEX = 16;             // Fila 17
```

Asi el extractor queda mas facil de adaptar si cambia el formato del Excel.
