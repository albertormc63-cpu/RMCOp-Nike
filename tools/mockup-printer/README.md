# Nike Mockup Printer MVP

Herramienta externa al CEP para leer listas Nike On Demand, encontrar el mockup PDF correcto, estampar datos de produccion en la parte superior izquierda y generar PDFs listos para imprimir.

Este flujo no debe mezclarse con el panel CEP de Illustrator. Vive aqui como utileria web/local independiente.

## Objetivo

Evitar escribir a mano datos de impresion sobre mockups PDF.

Entrada:

- Excel de lista On Demand.
- Carpeta de mockups PDF.

Salida:

- Un PDF anotado por fila del Excel.
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
```

Linea desde `Style`:

```text
A1000 / Y1000 -> PLL masculino
A2000 / Y2000 -> WLL femenino
```

Mockups:

```text
PLL Boston Cannons Home X003.pdf
PLL Boston Cannons Away X003.pdf
WLL Boston Guard Home.pdf
WLL Boston Guard Away.pdf
```

Nota: femenino/WLL no usa numero `X###` en el nombre del mockup.

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
  Font: 20 pt
  X: 0.58 in
  Y: 7.10 in
  Mayusculas

STYLE:
  Texto: Style
  Font: 20 pt
  X: 0.58 in
  Y: 6.78 in
  Mayusculas

FECHA:
  Texto: fecha de A2 normalizada
  Font: 14 pt
  X: 0.58 in
  Y: 7.38 in
  Mayusculas
  Color: #A91E2F

SIZE:
  Texto: "Size: " + Size
  Font: 20 pt
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
    Font: 14 pt
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
- Confirmar carpeta de mockups.
- Escribir carpeta donde guardar PDFs listos.
- Generar.

Comando local alterno:

```bash
node src/generate.js \
  --excel "/Volumes/Fullsize/TO PRINT/LISTAS ON DEMAND/NIKE OD 12 JUNIO.xlsx" \
  --mockups "/Volumes/Fullsize/Nike Lacrosse" \
  --font "/Users/rmlsub1/Library/Fonts/Aldrich-Regular.ttf" \
  --out "./output"
```

Pendiente para siguiente iteracion:

- Selector de impresora.
- Envio a cola usando `lp`.
- Selector nativo de carpeta de salida. Por seguridad del navegador, en este MVP la ruta de salida se escribe como texto.
