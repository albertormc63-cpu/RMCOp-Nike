# RMCOp-Nike

Ultima actualizacion de contexto: 2026-06-11.

Palabra clave para retomar contexto: `RMCOP_NIKE_HANDOFF`.

Si eres otro Codex entrando al proyecto, busca `RMCOP_NIKE_HANDOFF` y lee primero `CODEX_HANDOFF.md`.

Panel CEP para Adobe Illustrator usado en pedidos Nike Lacrosse On Demand. El panel resuelve plantillas PDF, crea copias con nombre interno, abre la copia en Illustrator y aplica nombre/numero segun la variante.

Este repositorio es para el CEP `RMCOp-Nike`. El producto activo de mockups vive como CEP separado en `RMC MockupTool`.

Si eres otro Codex entrando al proyecto, primero lee:

1. `AGENTS.md`
2. `CODEX_HANDOFF.md`
3. este `README.md`
4. Si vas a tocar mockups/impresion, trabaja en el repo/carpeta `RMC MockupTool`.

## Limite Del Repo

`RMCOp-Nike` cubre:

- UI CEP dentro de Illustrator.
- Resolucion de plantillas Nike On Demand.
- Batch desde Excel para crear/aplicar PDFs en Illustrator.
- Reglas de variantes `Standard`, `Indigenous Heritage` y `Throwback`.

`RMC MockupTool` cubre otro producto:

- Leer listas On Demand.
- Encontrar mockups PDF base.
- Estampar WO/style/fecha/talla/piezas/firma.
- Generar PDFs listos para imprimir.

Por claridad de chats, historial y mantenimiento, los mockups se separaron a:

```text
/Users/rmlsub1/Library/Application Support/Adobe/CEP/extensions/RMC MockupTool
origin https://github.com/albertormc63-cpu/RMC-MockupTool.git
```

No importar UI, dependencias ni servidor de MockupTool desde el CEP principal.

La version CEP de mockups debe seguir siendo extension separada, con su propio `manifest.xml`, nombre de panel, dependencias y README. Puede compartir criterios de negocio con Nike On Demand, pero no debe vivir dentro del panel `RMC Nike Panel`.

## Estado Actual

- Flujo manual individual funcionando en el panel CEP.
- Flujo por lote desde Excel implementado como MVP dentro del panel.
- Lineas activas: `masculino` y `femenino`.
- Variantes activas en codigo:
  - `Standard`: reemplazo de nombre y numero como texto.
  - `Indigenous Heritage`: nombre como texto y numero armado desde arte expandido/rasterizado.
  - `Throwback`: variante de texto con sufijo `TB`; rutas adulto confirmadas en carpeta `THROWBACK/NIKE TB ...`.
- Validacion de muestras oficiales implementada: primero corre accion tipo `Add Used Colors` y despues compara contra `js/config/officialSwatches.json`.
- Mockups/impresion viven como producto separado en `RMC MockupTool`; no deben crecer dentro de este repo.
- Registro local de produccion conectado a SQLite compartido:
  - BD: `/Users/rmlsub1/Documents/RMC - CEP/RMC_BD/RMC_CEP.sqlite`.
  - Tablas propias: `rmcop_nike_runs`, `rmcop_nike_items`, `rmcop_nike_git_commits`.
  - `RMCOp-Nike Manual` y `RMCOp-Nike Por Lote` escriben rondas/items sin levantar server.
  - La diferencia entre metodos se guarda en el campo `herramienta`.
  - `rmcop_nike_runs.id` es texto legible: `AAAAMMDD-HHMMSS` para lote y `manual-AAAAMMDD-HHMMSS` para manual.
  - `created_at` guarda fecha `DD/MM/AAAA`; `started_at`, `finished_at` y `tiempo` guardan horas/duracion `HH:MM:SS`.
  - `rmcop_nike_items` guarda `archivo` y `clave`, no `output_path`.
- Validacion incremental implementada:
  - El mismo Excel alimenta RMCOp-Nike y RMC MockupTool.
  - Las listas se preparan jueves, se procesan viernes y pueden recibir agregados lunes.
  - Despues de importar Excel y elegir destino batch, el panel detecta archivos ya creados/faltantes para generar solo faltantes.
  - La validacion ayuda a evitar duplicados en archivos y en SQLite.
- Alertas visibles al usuario:
  - Los errores del panel deben mostrarse con alerta nativa de Illustrator via ExtendScript (`RMCNike_alert`) usando `illustratorBridge.showAlert`.
  - El `alert()` del navegador queda solo como fallback si CEP/Illustrator no esta disponible.

## Stack

- CEP / HTML / CSS / JavaScript para el panel.
- Node.js/CommonJS dentro de CEP para rutas, copias, Excel y JSON.
- ExtendScript `.jsx` para operaciones dentro de Illustrator.
- `fs-extra` para copias de archivos.
- `xlsx` para lectura de Excel.
- `/usr/bin/sqlite3` para registros locales sin servidor.
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
      variantRules.js
      textFitRules.json
      ihNumberRules.json
      officialSwatches.json
    illustrator/
      illustratorBridge.js
      textRules.js
    services/
      nodeServices.js
      copyTemplate.js
      createOrderData.js
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
```

## Instalacion Base

En la raiz del repo:

```bash
npm install
```

Dependencias actuales:

```text
fs-extra
xlsx
```

El panel debe vivir en la carpeta CEP de Adobe y abrirse desde Illustrator. El `manifest.xml` habilita Node dentro de CEP con `--enable-nodejs`, `--mixed-context` y acceso a archivos.

## Configuracion De Rutas

Archivo: `js/config/config.js`.

Cambiar `mode` segun entorno:

```js
mode: "local"  // pruebas
mode: "server" // produccion
```

No hardcodear rutas nuevas en `main.js`. Las rutas activas se muestran en la pagina `Rutas` del panel.

## Flujo Manual

1. Abrir Illustrator y el panel `RMC Nike Panel`.
2. En `1 Equipo`, seleccionar linea, variante y equipo.
3. En `2 Pedido`, capturar Work Order, Style, talla, numero, nombre y destino.
4. Presionar `Revisar pedido`.
5. Confirmar plantilla, nombre final y destino.
6. Presionar `Crear copia de plantilla`.
7. Presionar `Abrir y aplicar datos`.
8. Revisar visualmente el PDF abierto en Illustrator.

## Flujo Por Lote Desde Excel

El panel tiene pagina batch para importar Excel Nike On Demand, revisar filas validas/invalidas y procesar por familia de style y talla.

Validacion incremental: despues de importar el Excel y elegir destino batch, el panel compara contra archivos existentes y `RMC_CEP.sqlite`, y separa filas ya creadas, faltantes, con conflicto e invalidas. Solo los faltantes se procesan.

La validacion usa `rmcop_nike_items.clave` como base para detectar duplicados. La clave se compone con:

```text
WO + Ship Order + Style + Team/Color + Size + Nombre + Numero
```

El destino batch se elige manualmente. Dentro de esa carpeta, el CEP guarda por familia de style y talla:

```text
DESTINO_ELEGIDO/
  A1000/
    2X/
    XL/
```

Columnas soportadas por encabezado:

```text
WO# / WO / Work Order
Ship Order / SHIP O
Style
Color / Team Color / Team / Color
Size
Qty / Pzs
Last Name / Name
# / Player# / Number
```

Normalizaciones importantes:

```text
SML -> SM
MED -> MD
LGE -> LG
XLG -> XL
2XL -> 2X
3XL -> 3X
```

`Color` se usa para detectar equipo por nickname:

```text
Archers -> Utah
Atlas -> New York
Cannons -> Boston
Chaos -> Carolina
Outlaws -> Denver
Whipsnakes -> Maryland
Waterdogs -> Philadelphia
Redwoods -> California
Guard -> Boston
Palms -> California
Charm -> Maryland
Charging -> New York
```

Salida batch:

```text
DESTINO/
  A1000/
    SM/
    MD/
    ...
  Y1000/
  A2000/
  Y2000/
```

El batch completo hace:

1. Copiar plantilla.
2. Abrir copia en Illustrator.
3. Aplicar nombre/numero.
4. Guardar PDF sobre la misma ruta.
5. Cerrar documento.
6. Continuar con la siguiente fila.

## Variantes

Las reglas compartidas viven en `js/config/variantRules.js`.

| Variante | Sufijo | Version | Modo |
|---|---:|---|---|
| Standard | `H` / `A` | Home/Away | texto |
| Indigenous Heritage | `IH` | sin Home/Away | nombre texto + numero arte |
| Throwback | `TB` | sin Home/Away | texto |

Throwback ya esta modelado como variante de texto. Sus plantillas no usan Home/Away en ruta.

## Plantillas Y Nombres

`js/utils/pathBuilder.js` resuelve plantilla y nombre final.

Standard busca como flujo de texto con Home/Away:

```text
STANDARD/
  NIKE Mens and Youth|NIKE Girls and Ladies/
    MENS|YOUTH|Ladies|Girls/
      HOME|AWAY/
        Equipo Home|Equipo Away/
```

Throwback busca como variante especial sin Home/Away:

```text
THROWBACK/
  NIKE TB Mens and Youth|NIKE TB Girls and Ladies/
    MENS|YOUTH|Ladies|Girls/
      Equipo TB/
```

Nombre de plantilla TB adulto esperado:

```text
PLL Utah TB A1000 SM.pdf
```

Indigenous Heritage busca:

```text
INDIGENOUS HERITAGE/
  NIKE IH Mens and Youth|NIKE IH Girls and Ladies/
    MENS|YOUTH|Ladies|Girls/
      Equipo IH/
```

Nombre final:

```text
WO PLL-Boston Cannons A1000A SM 7.pdf
WO PLL-Boston Cannons A1000IH SM 7.pdf
WO PLL-Boston Cannons A1000TB SM 7.pdf
```

Si no hay nombre ni numero, se usa `SIN_DATOS` en el nombre final para evitar archivos ambiguos.

## Reemplazo En Illustrator

Archivos principales:

- `js/illustrator/textRules.js`
- `js/illustrator/illustratorBridge.js`
- `jsx/rmcNike.jsx`
- `jsx/standardText.jsx`
- `jsx/ihNumbers.jsx`

Placeholders actuales:

| Linea | Equipo | Numero | Nombre |
|---|---|---:|---|
| masculino | Boston | 1 | HOLMAN |
| masculino | California | 96 | KAVANAGH |
| masculino | Carolina | 0 | RIORDEN |
| masculino | Denver | 42 | O'NEILL |
| masculino | Maryland | 7 | MALONE |
| masculino | New York | 9 | BAPTISTE |
| masculino | Philadelphia | 22 | SOWERS |
| masculino | Utah | 26 | SCHREIBER |
| femenino | Boston | 8 | NORTH |
| femenino | California | 12 | MASTROIANNI |
| femenino | Maryland | 11 | BLACK |
| femenino | New York | 27 | SCANE |

Standard y Throwback reemplazan textFrames que coincidan con los placeholders normalizados.

Indigenous Heritage duplica grupos desde:

```text
NUMEROS F -> 0 F, 1 F, ...
NUMEROS B -> 0 B, 1 B, ...
```

Y posiciona sobre:

```text
N FRONT / BASE FRONT -> RMC FRONT NUMBER
N BACK / BASE BACK -> RMC BACK NUMBER
```

El gap IH de `0.25in` es obligatorio. La implementacion debe conservarlo aun con numeros de 3 digitos.

## Muestras Oficiales

Botones en `Rutas`:

- `Extraer muestras oficiales`: pide confirmacion nativa y reemplaza `js/config/officialSwatches.json` con las muestras del documento activo.
- `Validar muestras de documento`: corre `Add Used Colors`, extrae muestras y advierte las que no esten en la lista oficial.

No hay limpieza automatica de muestras no usadas. Si se agrega, debe ser boton separado con confirmacion.

## RMC MockupTool

Los mockups viven como CEP separado:

```text
/Users/rmlsub1/Library/Application Support/Adobe/CEP/extensions/RMC MockupTool
```

Objetivo: leer Excel de listas On Demand, encontrar mockup PDF correcto, estampar WO/style/fecha/talla/piezas y generar PDFs listos para imprimir.

Decision actual:

- Mantenerlo separado del panel `RMC Nike Panel`.
- No agregar dependencias de MockupTool al `package.json` raiz del CEP Nike.
- Hacer cambios nuevos de mockups en `RMC MockupTool`.
- No reintroducir el flujo de MockupTool en el CEP principal de RMCOp-Nike.

## Checks Utiles

No hay suite automatica formal. Antes de entregar cambios:

```bash
node --check js/main.js
node --check js/illustrator/illustratorBridge.js
node --check js/services/createOrderData.js
node --check js/utils/pathBuilder.js
node --check jsx/rmcNike.jsx
node -e "JSON.parse(require('fs').readFileSync('js/config/ihNumberRules.json','utf8')); console.log('ihNumberRules OK')"
```

## Notas Para Siguiente Sesion

- No revertir cambios no relacionados; este repo suele tener trabajo local en progreso.
- Leer `CODEX_HANDOFF.md` antes de tocar arquitectura.
- Mantener separada la linea de trabajo de mockups; el desarrollo nuevo va en `RMC MockupTool`.
- Cualquier cambio de rutas, Throwback o batch debe probarse contra Illustrator real.
- En batch, filas sin nombre/numero son validas: se limpian placeholders y se nombra con `SIN_DATOS`.
- `Qty/Pzs` no duplica PDFs en los flujos actuales; solo se respeta como dato operativo o visual segun herramienta.
- La proxima mejora importante es validacion incremental de Excel para evitar duplicados cuando una lista recibe agregados despues del primer procesamiento.
