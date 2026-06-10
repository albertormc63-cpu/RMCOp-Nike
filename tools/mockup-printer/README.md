# Nike Mockup Printer MVP

Palabra clave para retomar contexto: `RMCOP_NIKE_HANDOFF`.

Herramienta externa al CEP para leer listas Nike On Demand, encontrar el mockup PDF correcto, estampar datos de produccion en la parte superior izquierda y generar PDFs listos para imprimir.

Este flujo no debe mezclarse con el panel CEP de Illustrator. Vive aqui como utileria web/local independiente.

## Objetivo

Evitar escribir a mano datos de impresion sobre mockups PDF.

Entrada:

- Excel de lista On Demand.
- Carpeta de mockups PDF:

```text
/Volumes/Fullsize/PATRONES ACOMODADOS PARA ROLLO/NIKE LACROSSE/RMCOp-NIKE/MOCKUPS
```

Salida:

- Un PDF anotado por fila del Excel.
- Si varias filas comparten `WO#`, `SHIP O`, `Style` y `Team / Color`, se consolidan en un solo PDF.
- En filas consolidadas se suma `Pzs`; si hay varias tallas se imprime como `Size: LGE-MED` y se recorre el texto hacia la izquierda.
- El nombre de salida no lleva prefijo `WO`; ejemplo: `173194 - PLL Maryland Whipsnakes - Y1000H - 1pz.pdf`.
- La salida se separa por familia y talla: `A1000/2XL`, `Y1000/SML`, `A2000/MED`, etc.
- No se duplican paginas si `Pzs` es mayor a 1; `Pzs` solo se imprime como dato visual.

## Excel Esperado

Archivo ejemplo:

```text
/Volumes/Fullsize/TO PRINT/LISTAS ON DEMAND/NIKE OD 12 JUNIO.xlsx
```

Formato observado:

- Fecha/titulo en `A2`, ejemplo `12 JUNIO        N I K E ON DEMAND      12 JUNIO`.
- Encabezados en fila 3.
- Datos desde fila 4.

Columnas:

```text
A = SHIP O
B = WO#
C = Style
D = Team / Color
E = Size
F = Pzs
G = Last Name
H = #
```

## Reglas De Mockup

El equipo se detecta desde `Team / Color` usando nicknames:

```text
Masculino / PLL:
X001 OD Archers     -> Utah Archers
X002 OD Atlas       -> New York Atlas
X003 OD Cannons     -> Boston Cannons
X004 OD Chaos       -> Carolina Chaos
X005 OD Outlaws     -> Denver Outlaws
X006 OD Whipsnakes  -> Maryland Whipsnakes
X007 OD Waterdogs   -> Philadelphia Waterdogs
X008 OD Redwoods    -> California Redwoods

Femenino / WLL:
Guard     -> Boston Guard
Palms     -> California Palms
Charm     -> Maryland Charm
Charging  -> New York Charging
```

Version desde `Style`:

```text
...H -> Home
...A -> Away
...IH -> Indigenous Heritage
...TB -> Throwback
```

Linea desde `Style`:

```text
A1000 / Y1000 -> PLL masculino
A2000 / Y2000 -> WLL femenino
```

Mockups:

```text
/Volumes/Fullsize/PATRONES ACOMODADOS PARA ROLLO/NIKE LACROSSE/RMCOp-NIKE/MOCKUPS

STANDARD/MASCULINO/PLL Boston Cannons Home.pdf
STANDARD/MASCULINO/PLL Boston Cannons Away.pdf
STANDARD/FEMENINO/WLL Boston Guard Home.pdf
STANDARD/FEMENINO/WLL Boston Guard Away.pdf
INDIGENOUS HERITAGE/PLL California Redwoods IH.pdf
THROWBACK/PLL Boston Cannons TB.pdf
```

Nota: Standard usa Home/Away. IH y TB no usan Home/Away en el nombre del mockup.

## Datos A Estampar

Todos van en la parte superior/izquierda de la pagina. Coordenadas en pulgadas.

PDF base observado: 792 x 612 pt, horizontal. `pdf-lib` usa origen abajo-izquierda, asi que las alturas dadas por el usuario se usan directamente como `y`.

Color general:

```text
#312783
```

Color fecha:

```text
#A91E2F
```

Fuente:

```text
Aldrich
```

Si Aldrich no esta disponible para incrustar, el MVP debe caer a Helvetica mientras se agrega el archivo `.ttf`.

Fuente detectada en esta maquina:

```text
/Users/rmlsub1/Library/Fonts/Aldrich-Regular.ttf
```

Campos:

```text
WO:
  Texto: "WO# " + WO#
  Font: 18 pt
  X: 0.58 in
  Y: 7.10 in
  Mayusculas

STYLE:
  Texto: Style
  Font: 18 pt
  X: 0.58 in
  Y: 6.78 in
  Mayusculas

FECHA:
  Texto: fecha de A2 normalizada
  Font: 12 pt
  X: 0.58 in
  Y: 7.38 in
  Mayusculas
  Color: #A91E2F

SIZE:
  Texto: "Size: " + Size
  Font: 18 pt
  X: 2.30 in
  Y: 2.50 in
  Mayusculas

PZS:
  Texto: numero grande + "pz" pequeno
  Numero:
    Font: 70 pt
    X: 0.80 in
    Y: 4.04 in
  "pz":
    Font: 12 pt
    Va concatenado visualmente despues del numero
```

## MVP

Panel web local:

```bash
npm start
```

Abrir:

```text
http://localhost:3127
```

Desde el navegador:

- Seleccionar Excel.
- Confirmar carpeta de mockups con `Examinar`.
- Confirmar carpeta donde guardar PDFs listos con `Examinar`.
- Confirmar fuente Aldrich con `Examinar`.
- Elegir familias de style: `A1000`, `Y1000`, `A2000`, `Y2000`; cada familia procesa Home/Away si existen en el Excel.
- Elegir `Tallas`: todas, una o varias. La lista se ajusta a las familias seleccionadas.
- Generar.

Comando local alterno:

```bash
node src/generate.js \
  --excel "/Volumes/Fullsize/TO PRINT/LISTAS ON DEMAND/NIKE OD 12 JUNIO.xlsx" \
  --mockups "/Volumes/Fullsize/PATRONES ACOMODADOS PARA ROLLO/NIKE LACROSSE/RMCOp-NIKE/MOCKUPS" \
  --font "/Users/rmlsub1/Library/Fonts/Aldrich-Regular.ttf" \
  --out "./output" \
  --styles "A1000,Y1000" \
  --sizes "MED,SML"
```

Pendiente para siguiente iteracion:

- Selector de impresora.
- Envio a cola usando `lp`.
