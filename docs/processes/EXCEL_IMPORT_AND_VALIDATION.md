# Importacion Y Validacion De Excel

Ultima actualizacion: 2026-06-22.

Este documento define el contrato actual de importacion de Excel del CEP. La implementacion vive en:

```text
js/services/createOrderData.js
```

El panel no genera `output.json`. Lee la primera hoja con `xlsx`, detecta el formato, normaliza cada fila al mismo modelo de pedido usado por el flujo manual y entrega filas validas/invalidas a `js/main.js`.

## Formatos Soportados

### Personalizadas / On Demand

Se detecta cuando la fila de encabezados contiene `Style`, `Size` y `WO`.

| Campo | Encabezados aceptados |
| --- | --- |
| WO | `WO#`, `WO`, `Work Order` |
| Ship Order | `Ship Order`, `SHIP O`, `SHIP O.` |
| Style | `Style` |
| Color | `Color`, `Team/Color`, `Team Color`, `Team / Color` |
| Qty | `Qty`, `Quantity`, `Pzs`, `Pz` |
| Size | `Size` |
| Nombre | `Last Name`, `Name` |
| Numero | `#`, `Player#`, `Player Number`, `Number` |
| Embarque | `Emb`, `Fecha Embarque`, `Fecha de Embarque`, `Ship Date` |

El layout Nike OD normalmente tiene encabezados en fila 3 y datos desde fila 4, pero el parser busca la fila por encabezados y no depende de una posicion fija.

### Genericas / Roster Detallado

Se detecta cuando una fila contiene `Style + Color + Qty + Last Name/Name + Player#/#`, no contiene WO y tambien existe `Size`.

Layout habitual:

```text
Fila 1:  nombre del roster
Fila 5:  Ship Order #, si existe
Fila 14: TOTAL PIECES
Fila 16: Style, Color, Qty, Size, First Name, Last Name, Player#, Position
Fila 17+: datos
```

La posicion es una referencia; la deteccion real se hace por encabezados.

## Archivos Resumen No Procesables

Archivos como `NIKE ST/IH/TB/AS 17 JUL.xlsx` con columnas `WO#`, `Estilo`, `Roster`, `Pzs`, `COLOR/EQUIPO`, `DivReq`, `Emb` son listas resumen. No contienen Size/Last Name/Player# por fila y no se procesan directamente en Illustrator. Sirven para MockupTool, reportes o contexto de embarque.

## Validacion Del Modo Seleccionado

`js/main.js` cruza modo activo, nombre y estructura antes de conservar el archivo.

- Token independiente `OD`: pista de Personalizadas.
- Token independiente `ST`, `IH`, `TB` o `AS`: pista de Genericas.
- Un nombre sin sigla se acepta si la estructura coincide.
- Un archivo OD no entra en Genericas.
- Un roster detallado o archivo ST/IH/TB/AS no entra en Personalizadas.
- Genericas exige `sourceFormat = generic-roster`.
- Una lista resumen con sigla generica se rechaza con mensaje de encabezados faltantes.

La carga es atomica: si falla, no se guardan parcialmente path, destino, filtros ni datos.

Al cambiar de modo se limpian:

```text
excelPath
destinationFolder
data
selectedStyleFamily
selectedSizes
lastResults
validation
```

## Lectura Del Workbook

Solo se lee la primera hoja:

```js
const workbook = XLSX.readFile(filePath, { cellDates: false });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rawRows = XLSX.utils.sheet_to_json(sheet, {
  header: 1,
  raw: false,
  defval: ""
});
```

Los encabezados se convierten a mayusculas y se eliminan caracteres que no sean letras, numeros o `#`. El orden de columnas no es obligatorio.

## Metadatos Del Roster

| Campo | Fuente |
| --- | --- |
| `rosterName` | `A1`; fallback al nombre del archivo. |
| `rosterNumber` | Patron `99999-99` en A1 o path. |
| `defaultWo` | Textos `WO 173830`; varios se unen con guion. |
| `defaultShipOrder` | Valor posterior a `Ship Order #`; `0` se trata como vacio. |
| `totalPieces` | Valor posterior a `TOTAL PIECES`. |
| `defaultShippingDate` | Campo Emb/Ship Date o fecha detectable en las primeras cinco filas. |

WO no es obligatorio en Genericas cuando existe `rosterNumber`. El Roster es el identificador principal para naming, SQLite y duplicados.

## Modelo Normalizado

Cada fila produce:

```text
sourceRow, wo, roster, shipOrder, style, color, line, team,
variant, version, styleFamily, sizeRaw, size, qty, firstName,
name, number, position, shippingDate, sourceFormat,
rosterName, rosterNumber, valid, errors, warnings
```

## Inferencias

### Linea Y Producto

```text
A1000 / Y1000 -> masculino / PLL
A2000 / Y2000 -> femenino / WLL
```

`A` selecciona categoria adulta; `Y` selecciona youth/girls.

### Variante

```text
Style terminado en IH -> Indigenous Heritage
Style terminado en TB -> Throwback
Otro style             -> Standard
```

Standard usa `H` como Home y `A` como Away. IH/TB no usan selector Home/Away.

### Equipo

Se busca nickname dentro de `Color`:

| Nickname | Equipo |
| --- | --- |
| Archers | Utah |
| Atlas | New York |
| Cannons | Boston |
| Chaos | Carolina |
| Outlaws | Denver |
| Whipsnakes | Maryland |
| Waterdogs | Philadelphia |
| Redwoods | California |
| Guard | Boston |
| Palms | California |
| Charm | Maryland |
| Charging | New York |

En Genericas, si `Color` solo contiene un codigo como `A002`, se intenta la deteccion sobre `rosterName`.

### Tallas

```text
XSM/X-SM -> XS
SML      -> SM
MED      -> MD
LGE      -> LG
XLG      -> XL
2XL      -> 2X
3XL      -> 3X
```

Tallas permitidas: `XS`, `SM`, `MD`, `LG`, `XL`, `2X`, `3X`.

### Nombre, Numero Y Cantidad

- Nombre y First Name se convierten a mayusculas.
- Numero conserva solo digitos.
- Qty usa el valor numerico; si falta, usa `1`.
- Qty registra piezas, pero no crea varias copias del mismo PDF.
- Nombre y numero pueden estar vacios; producen warning, no error.

## Condiciones De Validez

Errores bloqueantes:

- Falta WO en Personalizadas.
- En Genericas faltan tanto WO como Roster.
- Falta Style o no corresponde a familia 1000/2000.
- No se puede inferir equipo.
- El Style/variante/equipo/diseno no existe en `js/config/styleVariantReserve.json`.
- Falta Size o no pertenece a las tallas permitidas.

Warning no bloqueante:

```text
Sin nombre ni numero; se limpiaran placeholders
```

Las filas invalidas se muestran con numero de fila y razones. No se copian, no se abren en Illustrator y no se registran como produccion exitosa.

## Fecha De Embarque

`js/utils/shippingDate.js` normaliza a `DD/MM`.

- Personalizadas OD: puede extraerse de texto superior como `26 JUNIO`.
- Genericas: puede venir en Emb, Ship Date o texto superior.
- Si no existe, queda vacia.
- El ano de ejecucion permanece en `created_at`.

## Agrupaciones Para La UI

El resultado incluye:

```text
rows
validRows
invalidRows
groupsBySize
groupsByStyleFamilyAndSize
counts.bySize
counts.byStyleFamily
counts.byStyle
counts.byTeam
counts.byVersion
```

La UI filtra `validRows` por familia y talla; `invalidRows` permanece visible como diagnostico.
El filtro de variantes se calcula desde las filas ya filtradas por familia y talla, usando la variante base de cada fila. Las etiquetas prefieren `js/config/styleVariantReserve.json` y usan la variante normalizada del Excel como respaldo.

## Casos Reales Verificados

```text
NIKE OD 26 JUN.xlsx
-> on-demand; Personalizadas

NIKE ST 17 JUL.xlsx
-> lista resumen; no procesable como roster detallado

79235-26 Nike Atlas Shellenberger 1 WO 173830 WO 173836.xls
-> generic-roster; equipo New York desde Atlas; WO multiple

77357-26 WLL NY Charging Scane 27 Girls.xls
-> generic-roster; Color A002; equipo New York desde roster; Roster sustituye WO
```

## Limite De Responsabilidad

`createOrderData.js` solo lee, normaliza, valida y agrupa. Destino, copias, Illustrator, PDF y SQLite pertenecen a `js/main.js`, `copyTemplate.js`, `illustratorBridge.js` y `portfolioDb.js`.
