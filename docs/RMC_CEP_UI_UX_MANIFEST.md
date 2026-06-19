# RMC CEP UI/UX Manifest

Ultima actualizacion: 2026-06-17.

Este archivo define la estetica, estructura, reglas de interfaz y metricas visuales para paneles CEP de RMC.

Origen: el patron visual viene de `RMCOp-Nike`, que actualmente es la referencia base para la familia de CEP.
Otros CEP pueden heredar esta identidad visual, pero deben mantener sus propios textos, rutas, README, historial y comportamiento.

## Objetivo De Diseno

Los paneles CEP de RMC deben sentirse como herramientas de produccion: compactas, claras, oscuras, rapidas y enfocadas en evitar errores.
No deben sentirse como landing pages, dashboards decorativos ni interfaces de marketing.

La prioridad es que el operador pueda:

- Seleccionar rapido.
- Revisar rutas y datos sin perderse.
- Detectar errores antes de procesar.
- Procesar lotes sin romper el flujo manual.
- Leer logs y estados dentro del panel.

## Paleta Base

Tomada de la familia visual de `RMCOp-Nike` y alineada con `css/styles.css`.

```css
:root {
  --bg: #1f2023;
  --panel: #292b30;
  --panel-2: #23252a;
  --field: #17191d;
  --line: #444952;
  --line-soft: #343941;
  --text: #f2f2ef;
  --muted: #aeb4bf;
  --muted-2: #7f8794;
  --accent: #b91f35;
  --accent-dark: #841727;
  --ok: #38c172;
  --danger: #c83f52;
  --focus: #f2c94c;
}
```

Uso recomendado:

- `--bg`: fondo general del panel.
- `--panel`: contenedores principales, tarjetas y bloques de revision.
- `--panel-2`: botones secundarios, tabs o superficies interactivas.
- `--field`: inputs, selects, filtros y superficies editables.
- `--line`: bordes discretos.
- `--line-soft`: bordes internos de baja jerarquia.
- `--text`: texto principal.
- `--muted`: etiquetas, ayudas y texto secundario.
- `--muted-2`: subtitulos y texto terciario.
- `--accent`: accion principal y paso activo.
- `--accent-dark`: hover de accion principal.
- `--ok`: estado listo, exito o corrida terminada.
- `--danger`: errores, estado offline o fallos.
- `--focus`: foco de teclado, advertencias suaves y timers importantes.

Colores auxiliares actuales:

- Exito/log corriendo: `#7ee787`.
- Error: `#ff6b6b`.
- Fondo consola: `#151719`.
- Inputs: `#181a1d`.

## Tipografia

- Fuente base: `Arial, Helvetica, sans-serif`.
- Fuente tecnica/rutas/logs: `Menlo, Monaco, Consolas, monospace`.
- Tamano base CEP: `12px`.
- Labels y ayudas: `9px` a `10px`.
- Titulos internos: `16px`, sin hero type.
- No usar letter spacing negativo.

## Layout General

El panel esta disenado para espacios pequenos dentro de Illustrator.

Reglas:

- `body` con padding compacto de `10px` a `14px`, segun ancho disponible.
- Ancho minimo operativo: `280px`.
- Navegacion por pasos, no sidebar pesada.
- Secciones con `display: none/block` para mostrar una pagina a la vez.
- Grids compactos de 2 o 3 columnas segun el contexto.
- Evitar cards anidadas.
- Usar paneles solo para agrupar informacion accionable.

Estructura recomendada:

```text
header marca/estado
nav pasos principales o tabs de modo
main
  page activa
log interno o panel de estado
footer credito
```

## Componentes Base

### Header

- Grid de 3 columnas cuando haya logos, titulo y accion rapida.
- Flex compacto cuando el panel solo necesite titulo y estado.
- Logos compactos.
- Accion rapida de reset como icon button.
- Borde inferior con `--line`.

### Navegacion

- Botones por paso.
- Paso activo con `--accent`.
- Texto corto: `1 Equipo`, `2 Pedido`, `3 Proceso`, `Por lote`, `Rutas`.

### Botones

- Radio de borde: `5px`.
- Altura minima: `30px` a `34px`.
- Boton primario: fondo `--accent`.
- Boton secundario: fondo oscuro `#24262a`, borde `#555b64`.
- Hover: cambiar borde, no hacer animaciones grandes.
- Focus: borde u outline visible con `--focus`.

### Inputs Y Selects

- Fondo `--field` o `#181a1d`.
- Borde `#555b64`.
- Radio `5px`.
- Altura minima `33px`.
- Texto principal `--text`.
- Labels en `--muted`, `10px`.

### Tarjetas

- Usar solo para equipos, resumenes repetidos o bloques accionables.
- Fondo `--panel`.
- Borde `--line`.
- Radio `5px` o `6px`.
- Seleccion activa con borde `--accent` o variante fuerte heredada.

### Previews

- Imagen como `background-image`.
- `background-size: cover`.
- Borde interno oscuro.
- Placeholder visual cuando falte imagen.

### Batch / Produccion

- Separar `Personalizadas` y `Genericas` con selector de modo visible.
- Cambiar de modo debe limpiar Excel, destino, filtros y resultados del modo anterior.
- Mostrar conteos visibles: validas, errores, tallas y faltantes.
- Timer con fuente monospace.
- Detalles largos en bloque con scroll.
- Filtros por style y talla como cards compactas.
- Mostrar el Excel y destino efectivos antes de habilitar procesamiento.
- Personalizadas usa destino manual y subcarpetas style/talla.
- Genericas autocompleta la carpeta del Excel y guarda en la raiz.
- El boton principal debe decir cuantos faltantes procesara o `Sin faltantes por procesar`.
- La validacion nunca debe iniciar copias ni Illustrator por si sola.

### Logs

- Consola interna fija debajo del flujo.
- Fondo `#151719`.
- Monospace `10px` a `11px`.
- Colores por estado:
  - Exito: `#7ee787`.
  - Error: `#ff6b6b`.
  - Warning: `#f7c948`.

## Tono De UI

El texto debe ser directo y operativo.

Usar:

- `Importar Excel`
- `Elegir destino por lote`
- `Crear, aplicar y cerrar talla seleccionada`
- `Validar muestras de documento`
- `Sin Excel seleccionado`
- `Pendiente`

Evitar:

- Textos largos explicando funcionalidades dentro de la UI.
- Copys tipo marketing.
- Mensajes ambiguos como `Continuar` cuando la accion real es especifica.

## Reglas UX Para CEP De Produccion

- El operador siempre debe ver que selecciono antes de procesar.
- Rutas largas deben usar monospace y permitir wrap.
- Los errores no deben tumbar el panel completo; deben aparecer en log.
- Las acciones destructivas o de sobreescritura deben pedir confirmacion.
- Los flujos manual y batch deben mantenerse separados.
- Los estados de batch deben incluir conteo de OK, errores y tiempo.
- Los cruces de Excel deben alertarse desde Illustrator: OD en Genericas, roster generico en Personalizadas o lista resumen no procesable.
- No hardcodear rutas nuevas en archivos de coordinacion UI como `js/main.js`; usar configuracion o helpers.

## Manual Vs Batch

El flujo manual existe para pedidos individuales y pruebas controladas.
El flujo batch existe para produccion desde Excel.

No mezclar comportamiento entre ambos sin una razon clara.

Dentro de batch tampoco deben mezclarse los estados de Personalizadas y Genericas. La estructura del Excel confirma el modo; el nombre solo funciona como pista operativa.

## Estados De Validacion Batch

La vista de detalle debe distinguir:

| Estado | Significado UX |
| --- | --- |
| `FALTANTE` | Listo para procesar. |
| `YA_CREADO` | Archivo y registro ya existen. |
| `ARCHIVO_SIN_REGISTRO` | Requiere revision; no regenerar automaticamente. |
| `REGISTRADO_SIN_ARCHIVO` | Requiere revision; no regenerar automaticamente. |
| `CONFLICTO` | Hay claves repetidas en la seleccion. |

Solo `FALTANTE` entra al proceso. Las filas invalidas del Excel se muestran aparte con su fila y errores.

Al presionar procesar se debe ejecutar una validacion fresca. Una clave o ruta de salida repetida es `CONFLICTO`; el batch no ofrece nombres alternos para evadirlo. Los items SQLite con error se muestran como historial, pero no cuentan como archivo ya generado.

## Variantes RMCOp-Nike

Reglas importantes que otros chats deben respetar:

- `Standard`: texto.
- `Throwback`: texto con sufijo `TB`; no es Indigenous Heritage.
- `Indigenous Heritage`: numero armado con arte/raster; conservar gap obligatorio de `0.25in` entre digitos.

## Prompt Para Otro Chat

Puedes pegar esto en otro chat:

```text
Analiza el archivo RMC_CEP_UI_UX_MANIFEST.md y crea una interfaz CEP con estetica RMC similar.
El patron visual viene de RMCOp-Nike, pero adapta nombres, rutas y comportamiento al repo actual:

- Tema oscuro compacto.
- Paleta basada en variables CSS del manifiesto.
- Interfaz de produccion, no landing page.
- Navegacion por pasos.
- Botones primarios rojos, foco amarillo, logs monospace.
- Inputs compactos y legibles.
- Cards solo para elementos repetidos o accionables.
- Respetar flujos separados: manual, batch, rutas/logs.
- Texto corto, operativo y claro.
- No usar heroes, gradientes decorativos ni UI de marketing.

Antes de implementar, revisa el CSS existente del proyecto y copia sus patrones de espaciado, radios, botones, formularios, timers, logs y tarjetas.
No mezcles repos: si el repo actual es otro CEP, conserva su identidad funcional aunque use la estetica heredada de RMCOp-Nike.
```

## Metricas Auditables

Estas metricas convierten el manifiesto en una revision objetiva antes de cerrar cambios de UI.

| Area | Criterio | Umbral |
| --- | --- | --- |
| Ancho compacto | El panel no debe desbordar horizontalmente. | Funcional desde `280px`. |
| Densidad | Controles principales deben mantenerse compactos. | Botones/inputs entre `30px` y `34px` de alto. |
| Foco | Todo control interactivo debe mostrar foco visible. | Borde u outline con `--focus`. |
| Accion principal | Cada pantalla debe tener una accion primaria clara. | Identificable en menos de 2 segundos. |
| Logs | El estado debe quedar dentro del panel. | Scroll interno, monospace, sin romper layout. |
| Rutas | Rutas largas deben seguir siendo legibles. | Wrap o scroll horizontal controlado; sin overflow de pagina. |
| Batch | El operador debe ver resultado y alcance. | OK, errores/faltantes, seleccionados y salida visibles. |
| Manual/Batch | Los flujos no deben mezclarse accidentalmente. | Tabs, pasos o secciones separadas. |
| Cards | No crear decoracion innecesaria. | 0 cards anidadas; cards solo para grupos accionables. |
| Texto UI | El copy debe ser operacional. | Sin marketing, sin parrafos explicativos largos. |

## Checklist Visual

Antes de cerrar cualquier nuevo CEP:

- Los textos caben en botones y cards.
- El foco de teclado se ve.
- El panel funciona en ancho compacto.
- Los logs se leen sin romper layout.
- Las rutas largas no desbordan.
- El paso activo es evidente.
- La accion principal de cada pantalla se identifica en menos de 2 segundos.
- No hay cards dentro de cards.
- No hay decoracion innecesaria.
