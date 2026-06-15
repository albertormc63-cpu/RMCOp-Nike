# RMCOp-Nike - Handoff Para Otro Codex

Ultima actualizacion: 2026-06-15.

Palabra clave para retomar contexto: `RMCOP_NIKE_HANDOFF`.

Si otro Codex entra al proyecto, buscar `RMCOP_NIKE_HANDOFF` en el repo. Esta etiqueta marca los archivos que resumen el flujo actual del CEP y el antecedente historico del tool externo de mockups.

Este archivo es la memoria corta-larga del proyecto. La idea es que otro Codex pueda entrar al repo y, si el usuario pregunta "Que tranza?", lea esto junto con `AGENTS.md` y se ubique sin depender de los chats originales.

Decision de arquitectura del 2026-06-11: `RMCOp-Nike` debe quedar como repo del panel CEP Nike. El flujo de mockups vive como CEP separado `RMC MockupTool`. No mezclar dependencias, UI ni servidor del MockupTool con el CEP principal.

Repo/carpeta nueva para mockups:

```text
/Users/rmlsub1/Library/Application Support/Adobe/CEP/extensions/RMC MockupTool
origin https://github.com/albertormc63-cpu/RMC-MockupTool.git
```

Ese proyecto ya nacio como CEP separado `RMC MockupTool`.

## Que Tranza

RMCOp-Nike es un panel CEP para Adobe Illustrator usado en Nike Lacrosse On Demand. Nacio como flujo manual para copiar plantillas PDF, renombrarlas y aplicar nombre/numero en Illustrator. Despues se extendio hacia batch desde Excel.

El MockupTool es otro producto: una herramienta local para estampar datos sobre mockups PDF de produccion. Puede convivir operativamente con Nike On Demand, pero no debe crecer dentro del repo/CEP principal.

Hay tres frentes vivos:

1. Panel CEP principal: pedido individual y lote desde Excel.
2. Reglas Illustrator: Standard/Throwback como texto, Indigenous Heritage con arte expandido/rasterizado.
3. `RMC MockupTool`: CEP separado para PDFs de mockup listos para imprimir. No reintroducir ese flujo dentro de este repo.

## Registros Y Base De Datos

El portafolio consolidado de CEP vive en:

```text
/Users/rmlsub1/Documents/RMC - CEP
```

`RMCOp-Nike` usa su portafolio en:

```text
/Users/rmlsub1/Documents/RMC - CEP/RMCOp-Nike Portafolio interno
```

La BD local compartida para los CEP de RMC es:

```text
/Users/rmlsub1/Documents/RMC - CEP/RMC_BD/RMC_CEP.sqlite
```

No requiere server. Cada CEP debe tener sus propias tablas dentro de esa BD.

Tablas de RMCOp-Nike:

```text
rmcop_nike_runs
rmcop_nike_items
rmcop_nike_git_commits
```

Tablas detectadas de RMC MockupTool:

```text
rmc_mockuptool_runs
```

`cep_registry` registra que app escribe en que tabla. No mezclar datos de RMCOp-Nike con las tablas del MockupTool.

Cuando se corre `RMCOp-Nike Manual` o `RMCOp-Nike Por Lote`, `js/main.js` inserta rondas/items en SQLite via `js/services/portfolioDb.js`.
El batch tambien conserva CSV/JSONL en `06_Logs` como respaldo plano.

RMCOp-Nike tiene dos metodos de generacion:

```text
RMCOp-Nike Manual   -> 1 Equipo / 2 Pedido / 3 Proceso, usado tambien para Genericas.
RMCOp-Nike Por Lote -> Excel batch, usado para Personalizadas/lotes.
```

Ambos deben guardarse en las mismas tablas `rmcop_nike_runs` y `rmcop_nike_items`.
La diferencia se guarda en el campo `herramienta`.
No crear tablas separadas por metodo salvo que exista una necesidad real de datos incompatibles.

Formato actual de `rmcop_nike_runs`:

```text
id          -> TEXT PRIMARY KEY; lote usa AAAAMMDD-HHMMSS y manual usa manual-AAAAMMDD-HHMMSS
created_at  -> solo fecha DD/MM/AAAA
started_at  -> solo hora HH:MM:SS
finished_at -> solo hora HH:MM:SS
tiempo      -> duracion HH:MM:SS
herramienta -> RMCOp-Nike Manual | RMCOp-Nike Por Lote
```

No usar columna `fecha`, `source_excel` ni `destination_folder`.
No convertir `id` a autoincremental sin revisar `rmcop_nike_items.run_id`, porque los items enlazan contra ese texto.

Formato actual de `rmcop_nike_items`:

```text
run_id      -> enlaza con rmcop_nike_runs.id
herramienta -> permite leer Manual/Por Lote desde el item
archivo     -> nombre de archivo final
clave       -> clave estable para detectar duplicados
```

No guardar `output_path`.

## Validacion Incremental Pendiente

Contexto operativo:

- Las listas por lote se generan jueves.
- RMCOp-Nike procesa personalizadas normalmente viernes.
- RMC MockupTool genera mockups despues usando el mismo Excel.
- Los impresores inician lunes.
- A veces el lunes se agregan mas filas a la misma lista por lote.

Necesidad:

- Al cargar un Excel, validar contra archivos ya creados y contra `RMC_CEP.sqlite`.
- Identificar filas ya creadas, faltantes, con conflicto e invalidas.
- Permitir generar solo faltantes.
- Evitar duplicar PDFs y evitar duplicar registros SQLite.
- No romper flujo manual ni batch actual.

Clave candidata para duplicados en RMCOp-Nike:

```text
WO + Ship Order + Style + Team/Color + Size + Nombre + Numero
```

La clave se guarda en `rmcop_nike_items.clave`.
`js/services/portfolioDb.js` hace backfill de claves vacias desde los campos existentes al inicializar schema.

Para filas sin nombre/numero, usar el mismo criterio del panel (`SIN_DATOS`) para comparar nombres finales.

Regla de implementacion:

```text
Validar primero; generar despues.
```

La validacion debe ser visible antes de copiar/abrir/aplicar en Illustrator.
El boton principal de Por Lote debe procesar solo faltantes cuando exista validacion.

El destino batch se elige manualmente. Dentro de esa carpeta, RMCOp-Nike guarda por familia de style y talla:

```text
DESTINO_ELEGIDO/
  A1000/
    2X/
    XL/
```

## Alertas Nativas

Los avisos visibles al usuario deben salir desde Illustrator/ExtendScript para sentirse integrados al programa.

Implementacion actual:

```text
jsx/rmcNike.jsx                       -> RMCNike_alert(message)
js/illustrator/illustratorBridge.js   -> showAlert(message)
js/main.js                            -> showIllustratorAlert(message)
```

No usar `alert(error.message)` directo en handlers del panel salvo como fallback cuando `CSInterface` o Illustrator no esten disponibles.

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

Este repo suele tener trabajo local en progreso. Tratar cambios locales como trabajo del usuario/proyecto.
No hacer `git reset`, no revertir archivos sin permiso y revisar `git status --short` antes de editar.

`tools/mockup-printer` fue separado funcionalmente hacia `RMC MockupTool`; si aparece eliminado o ausente, no restaurarlo salvo pedido explicito.

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
js/services/portfolioDb.js
js/utils/pathBuilder.js
js/illustrator/illustratorBridge.js
js/illustrator/textRules.js
jsx/rmcNike.jsx
jsx/standardText.jsx
jsx/ihNumbers.jsx
jsx/swatches.jsx
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

## RMC MockupTool

Ubicacion CEP: `/Users/rmlsub1/Library/Application Support/Adobe/CEP/extensions/RMC MockupTool`.

Palabra clave relacionada: `RMCOP_NIKE_HANDOFF`.

No es parte del CEP `RMC Nike Panel`. El flujo ya se separo como CEP propio `RMC MockupTool`.

Si se toca el nuevo CEP, hacerlo en su repo/carpeta separada:

- Repo separado, por ejemplo `Nike-Mockup-Printer` o `RMCOp-Nike-Mockups`.
- `manifest.xml` propio.
- Panel, puerto/servidor y dependencias propias.
- Sin acoplarlo al `RMC Nike Panel`.

Motivo: evita que los chats, la memoria y el mantenimiento del CEP de plantillas se mezclen con el flujo de impresion/mockups.

Alcance actual:

- Lee Excel con layout de listas On Demand.
- Detecta mockup PDF correcto desde la carpeta base nueva:

```text
/Volumes/Fullsize/PATRONES ACOMODADOS PARA ROLLO/NIKE LACROSSE/RMCOp-NIKE/MOCKUPS
```

- Estructura de mockups:

```text
STANDARD/MASCULINO/PLL Boston Cannons Home.pdf
STANDARD/FEMENINO/WLL California Palms Away.pdf
INDIGENOUS HERITAGE/PLL California Redwoods IH.pdf
THROWBACK/PLL Boston Cannons TB.pdf
```

- Estampa fecha, WO, style, talla y piezas.
- Usa `pdf-lib`.
- Intenta incrustar Aldrich desde `/Users/rmlsub1/Library/Fonts/Aldrich-Regular.ttf`; si no existe, cae a Helvetica Bold.
- Salida por familia style y talla.
- UI web local con filtros por familia (`A1000`, `Y1000`, `A2000`, `Y2000`) y tallas disponibles segun familia.
- Los campos de ruta estan bloqueados; se llenan con botones `Examinar`.
- Consolida filas repetidas antes de generar:
  - mismo `WO#`, `SHIP O`, `Style` y `Team / Color` -> un solo PDF.
  - suma `Pzs`.
  - si hay varias tallas, imprime `Size: LGE-MED` y mueve el texto hacia la izquierda.
- No duplica paginas por `Pzs`; solo imprime el total visual.
- Textos actuales:
  - WO, Style y Size: 18 pt.
  - Fecha: 12 pt en rojo `#A91E2F`.
  - Numero grande de piezas: 70 pt.
  - Sufijo `pz`: 12 pt.

Para correr o modificar mockups, abrir el repo/carpeta `RMC MockupTool` y seguir su README propio.

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
4. Confirmar registros SQLite desde Illustrator real para `RMCOp-Nike Manual` y `RMCOp-Nike Por Lote`.
5. Confirmar si `Qty/Pzs` debe aparecer en algun reporte dentro del CEP o seguir ignorado por diseno.
6. Si se retoma dashboard LAN/admin, hacerlo separado del panel CEP.
7. Continuar `RMC MockupTool` en su repo/carpeta separada.
8. Evaluar si conviene agregar tests Node para:
   - `createOrderData.js`.
   - `pathBuilder.js`.
   - `variantRules.js`.
   - `portfolioDb.js`.

## Reglas Para Siguiente Codex

- No revertir cambios locales sin permiso.
- Antes de tocar logica, leer `README.md`, este archivo y `AGENTS.md`.
- Si el usuario dice "Que tranza?", responde con resumen de estado, pendientes y archivos clave.
- Si se toca batch, no romper el flujo manual.
- Si se toca Throwback, no meterlo al flujo IH.
- Si se toca IH, conservar gap `0.25in`.
- Si se toca mockups, no meter dependencias ni UI dentro del CEP Nike; trabajar en `RMC MockupTool`.
- Preferir cambios pequenos y probables; este repo depende mucho de validacion en Illustrator real.

## Checks Rapidos

```bash
node --check js/main.js
node --check js/illustrator/illustratorBridge.js
node --check js/services/createOrderData.js
node --check js/services/portfolioDb.js
node --check js/utils/pathBuilder.js
node -e "JSON.parse(require('fs').readFileSync('js/config/ihNumberRules.json','utf8')); console.log('ihNumberRules OK')"
```
