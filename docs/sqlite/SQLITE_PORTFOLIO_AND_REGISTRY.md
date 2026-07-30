# SQLite, Portafolio Y Registro

Ultima actualizacion: 2026-06-22.

## Portafolio Interno

Ruta principal:

```text
/Users/rmlsub1/Documents/RMC - CEP/RMCOp-Nike Portafolio interno
```

Estructura esperada:

```text
01_Capturas/
02_Videos/
03_Manuales/
04_Metricas/
05_Casos_Reales/
06_Logs/
07_GitHub/
08_Reportes/
```

Cada CEP deberia tener su propio portafolio interno con esta misma estructura.

## SQLite Local Compartido

Archivo principal:

```text
/Users/rmlsub1/Documents/RMC - CEP/RMC_BD/RMC_CEP.sqlite
```

Este archivo funciona como base de datos local compartida para los CEP de RMC. No requiere servidor.
Cada CEP debe tener sus propias tablas para no mezclar datos.

Cuando se procesa desde `RMCOp-Nike`, el panel guarda:

- Resumen de la ronda/proceso en `rmcop_nike_runs`.
- Detalle por fila/pieza en `rmcop_nike_items`.
- La estructura para commits en `rmcop_nike_git_commits`, lista para conectar despues con un hook de Git.
- Registro del CEP en `cep_registry`.

Tablas de otros CEP detectadas:

```text
rmc_mockuptool_runs
```

No modificar tablas de otros CEP desde RMCOp-Nike.

## Manual, Personalizadas Y Genericas

RMCOp-Nike registra tres herramientas:

- `RMCOp-Nike Manual`: flujo `1 Equipo` -> `2 Pedido` -> `3 Proceso`.
- `RMCOp-Nike Personalizadas`: flujo OD / On Demand desde Excel para personalizadas.
- `RMCOp-Nike Genericas`: flujo desde Excel roster generico.

Todas usan las mismas tablas:

- `rmcop_nike_runs`: una operacion completa.
- `rmcop_nike_items`: los PDFs/piezas generadas dentro de esa operacion.

La diferencia se identifica con el campo `herramienta`.

Cada ejecucion crea un run y uno o varios items. Genericas puede contener varias filas/tallas; `Qty` suma piezas pero no multiplica PDFs.

Esto evita duplicar tablas y mantiene los reportes simples.

## Columnas Actuales

`rmcop_nike_runs` guarda una ronda/proceso:

```text
id              TEXT PRIMARY KEY
created_at      DD/MM/AAAA
started_at      HH:MM:SS
finished_at     HH:MM:SS
tiempo          HH:MM:SS
herramienta     RMCOp-Nike Manual | RMCOp-Nike Personalizadas | RMCOp-Nike Genericas
fecha_embarque  Fecha de embarque del Excel, cuando aplica
excel_path      Ruta absoluta del Excel fuente; NULL en Manual
output_root     Carpeta base elegida o resuelta para la ejecucion
pedidos
piezas
estilos
ok
errores
observaciones
```

`fecha_embarque` se normaliza como `DD/MM` al leer y registrar el Excel. Por ejemplo, `17 JUNIO` y `17-Jun` se guardan como `17/06`; el ano del proceso permanece disponible en `created_at`.

Formato de `id`:

```text
Por lote:  AAAAMMDD-HHMMSS
Manual:    AAAAMMDD-HHMMSS
Fallback:  run-<timestamp> si no se manda id desde el panel
```

`rmcop_nike_items.run_id` guarda ese mismo texto para enlazar cada PDF/pieza con su ronda.
El metodo no se codifica en el `id`; se lee desde `herramienta`.

`rmcop_nike_items` guarda los PDFs/piezas generadas y se enlaza por `run_id`:

```text
id
run_id
herramienta
fila_excel
wo
roster
ship_order
fecha_embarque
style
style_family
equipo
variante
version
talla
piezas
nombre
numero
archivo
path
estado
error
tiempo
clave
```

`roster` guarda el numero de roster usado para nombrar los PDFs de `RMCOp-Nike Genericas` (por ejemplo `79135-26`). En `RMCOp-Nike Personalizadas` y `RMCOp-Nike Manual` queda vacio porque esos flujos se identifican con `wo`.

`archivo` guarda solo el nombre del PDF. `path` guarda la ruta absoluta exacta cuando el resultado esta `Completado`; si el PDF no se creo, queda `NULL`.

`excel_path` y `output_root` viven en el run porque describen toda la ejecucion. No reintroducir los nombres anteriores `source_excel`, `destination_folder` ni `output_path`.

Los registros historicos con fuentes verificables fueron conciliados usando JSONL y existencia fisica. Las rutas nuevas se registran directamente desde `state.batch.excelPath`, `destinationFolder` y `result.outputPath`.

## Logs

El panel tambien conserva logs simples para respaldo:

```text
06_Logs/rmcop_nike_batch_log.csv
06_Logs/rmcop_nike_batch_log.jsonl
```

CSV/JSONL sirven como bitacora plana.
SQLite sirve como fuente principal para consultas, reportes y futuras pantallas.

## Excel

Los Excel quedan como reportes o plantillas de lectura:

```text
04_Metricas/RMC_Bitacora_Produccion.xlsx
04_Metricas/RMC_Desarrollo.xlsx
04_Metricas/RMC_Metricas_Produccion.xlsx
04_Metricas/RMC_Errores_Calidad.xlsx
```

La meta no es llenar Excel manualmente todos los dias.
La meta es guardar datos en SQLite y despues exportar/resumir a Excel cuando haga falta.

## Validacion Incremental Activa

Contexto operativo actual:

- Las listas por lote se generan jueves.
- RMCOp-Nike procesa PDFs de personalizadas normalmente viernes.
- RMC MockupTool genera PDFs de mockup despues.
- Los impresores inician trabajo lunes.
- A veces el lunes se agregan mas filas a la misma lista por lote.
- El mismo Excel se usa como fuente para RMCOp-Nike y RMC MockupTool.

Flujo de la validacion:

- Leer el Excel cargado.
- En Personalizadas, usar el destino elegido manualmente.
- En Genericas, usar automaticamente la carpeta raiz del Excel.
- Comparar simultaneamente contra la carpeta destino y la BD `RMC_CEP.sqlite`.
- Generar una `clave` estable por fila para consultar duplicados.
- Separar filas en:
  - ya creadas,
  - faltantes,
  - con conflicto,
  - invalidas.
- Permitir generar solo faltantes.
- Evitar duplicar PDFs.
- Evitar duplicar registros en SQLite.

Regla importante:

```text
Validar primero; generar despues.
```

La validacion debe mostrar resumen antes de crear archivos o escribir registros.

En Personalizadas se guarda por familia de style y talla:

```text
DESTINO_ELEGIDO/
  A1000/
    2X/
    XL/
```

En Genericas se guarda directamente en la carpeta del Excel, sin subcarpetas por style/talla.

Clave para detectar duplicados; Personalizadas usa WO y Genericas usa Roster:

```text
(WO o Roster) + Ship Order + Style + Team/Color + Size + Nombre + Numero
```

Esta clave se guarda en `rmcop_nike_items.clave`.
`js/services/portfolioDb.js` rellena claves vacias y recalcula claves de Genericas para usar `roster`. Solo escribe cuando el valor calculado cambia.
Una restriccion unica parcial protege claves con `estado = Completado`. Los items con error no bloquean un reintento.

Si una fila no tiene nombre ni numero, usar el mismo criterio de nombre final que el panel para comparar contra archivos existentes. En general se usa `SIN_DATOS`; para styles 1500 se omite ese sufijo del nombre final.

La validacion debe respetar que:

- `Qty/Pzs` no duplica PDFs en RMCOp-Nike.
- RMC MockupTool consolida por `WO# + SHIP O + Style + Team / Color`.
- RMCOp-Nike y RMC MockupTool tienen tablas separadas, pero comparten la misma BD.
- El boton principal de Por Lote debe procesar solo faltantes cuando exista validacion.

Estados actuales:

| Estado | Archivo | Registro | Se procesa |
| --- | --- | --- | --- |
| `FALTANTE` | No | No | Si |
| `YA_CREADO` | Si | Si | No |
| `ARCHIVO_SIN_REGISTRO` | Si | No | No |
| `REGISTRADO_SIN_ARCHIVO` | No | Si | No |
| `CONFLICTO` | Clave repetida en la seleccion | Variable | No |

Tambien es conflicto cuando dos filas producen la misma ruta esperada. Antes de procesar se ejecuta una validacion fresca; la copia batch rechaza archivos existentes y no genera nombres alternos.

## Escritura De Runs E Items

Al terminar Manual o batch, `recordBatchRun`:

1. Ejecuta `ensureSchema` y migraciones idempotentes.
2. Inserta/reemplaza el run.
3. Elimina items anteriores con el mismo `run_id`.
4. Inserta un item por resultado, incluyendo errores.
5. Calcula `pedidos`, `piezas`, `estilos`, `ok` y `errores`.
6. Guarda `excel_path`, `output_root` y el `path` final de cada PDF completado.

Manual usa el mismo escritor con un resultado. Los ids manuales no llevan `manual-`; el metodo se identifica con `herramienta`.

Riesgo conocido: el id usa precision de segundos. Dos ejecuciones que produzcan el mismo `AAAAMMDD-HHMMSS` pueden reemplazarse; debe resolverse antes de soportar concurrencia real.

## Analisis Del Flujo Actual

El recorrido operativo tiene una base correcta:

```text
Importar Excel -> normalizar filas -> validar archivos + clave -> producir faltantes
-> guardar/cerrar PDF -> escribir logs -> registrar run e items
```

Fortalezas actuales:

- La validacion es visible y no genera mientras analiza.
- Se consulta nuevamente antes de producir.
- `clave` evita duplicados logicos y `path` evita duplicar una salida fisica completada.
- Errores no bloquean reintentos porque el indice unico parcial protege solo `Completado`.
- Run e items separan correctamente el resumen de la ejecucion y el detalle por PDF.

Puntos que hacen pesado el sistema:

- `js/main.js` coordina UI, produccion, logs y armado de persistencia.
- `portfolioDb.js` mezcla schema, migraciones, backfills, consultas y comandos.
- El run y todos sus items se escriben al terminar; un cierre inesperado puede dejar PDFs sin registro.
- `recordBatchRun` reemplaza el run y elimina/reinserta items con el mismo ID.
- `ensureSchema` se ejecuta tambien desde consultas de validacion.
- El ID con precision de segundos no esta preparado para varias estaciones concurrentes.
- Escribir directamente una SQLite ubicada en otra computadora no es una arquitectura segura para varios operadores.

## Reestructura Propuesta, No Implementada

La recomendacion es gradual y conserva el flujo visible actual.

### BD Por Operador En Volumen Compartido

Como paso intermedio antes de una API central, cada operador puede tener su propia SQLite en el volumen de red:

```text
/Volumes/Fullsize/PATRONES ACOMODADOS PARA ROLLO/NIKE LACROSSE/RMCOp-NIKE/ASSETS/BD/THANIA/RMC_CEP.sqlite
/Volumes/Fullsize/PATRONES ACOMODADOS PARA ROLLO/NIKE LACROSSE/RMCOp-NIKE/ASSETS/BD/ANTONIO/RMC_CEP.sqlite
```

Regla operativa:

- Cada CEP escribe solo en la BD de su operador.
- RMC Control Center consolida hacia la BD central.
- No usar una sola SQLite compartida como escritor simultaneo de varias estaciones.
- El sync debe leer desde una copia o backup seguro de la BD fuente.
- Al consolidar, prefijar o mapear `run_id` por operador para evitar colisiones.

Herramienta inicial:

```bash
npm run db:create-operator
```

Por defecto crea BDs semilla para `THANIA` y `ANTONIO` con estructura completa y catalogos/base, pero sin runs/items/ordenes operativas.

RMCOp-Nike permite elegir la BD activa desde la pantalla `Rutas`:

- `Central`: usa la ruta por defecto de `js/config/config.js`.
- `Thania` y `Antonio`: apuntan a las BDs por operador del volumen compartido.
- `Examinar BD SQLite`: permite seleccionar otra SQLite compatible.

La seleccion se guarda localmente en `js/config/localSettings.json`, archivo ignorado por Git para que cada instalacion conserve su propia preferencia al cerrar Illustrator.

### 1. Separar Responsabilidades

```text
Importacion      createOrderData: leer y normalizar Excel
Validacion       servicio puro: clave, ruta esperada y estado incremental
Produccion       orquestador: copiar, abrir, aplicar, guardar y cerrar
Persistencia     repositorio: runs, items y consultas por clave/path
Migraciones      bootstrap ejecutado una vez al iniciar
Sincronizacion   adaptador local ahora; API + cola local en una fase posterior
```

### 2. Registrar Por Ciclo De Vida

```text
Inicio       crear run con estado En progreso
Cada fila    guardar item Completado o Error inmediatamente
Cierre       recalcular totales y marcar run Completado/Parcial/Error
Recuperacion detectar runs interrumpidos sin borrar evidencia
```

Esto reduce la ventana en la que existe un PDF sin registro y evita reconstruir toda la corrida al final.

### 3. Mantener Identidades Claras

- `clave`: identidad estable del trabajo; no depende de la carpeta.
- `path`: ubicacion actual del PDF.
- `run_id`: identificador unico de ejecucion, con milisegundos o UUID.
- No usar `path` como sustituto de `clave`.
- No borrar items de una ejecucion ya registrada para volver a insertarlos.

### 4. Preparar Varios Equipos

Cuando otros operadores ejecuten los CEP desde sus computadoras, no deben escribir directamente el archivo SQLite por red. La fase recomendada es:

```text
CEP -> API de RMC Control Center -> SQLite local al servidor
  \-> cola local si no hay red -> reintento idempotente por clave/run_id
```

RMC Control Center seria el unico escritor de la BD central. Esta fase requiere un contrato de API y no debe mezclarse con la primera limpieza interna.

### Orden Sugerido

1. Extraer un repositorio SQLite sin cambiar tablas ni UI.
2. Separar migraciones del camino de validacion.
3. Introducir estados de run y persistencia item por item.
4. Cambiar `run_id` con una migracion compatible.
5. Agregar cola local y API central.

No implementar estas fases juntas. Cada paso debe conservar validacion incremental, flujo Manual e integridad de `clave`.

## Pendientes De Reporteria

- Exportar metricas desde SQLite a Excel bajo demanda.
- Conectar `rmcop_nike_git_commits` a un hook de Git si se autoriza.
- Crear una vista de control solo si aporta operacion real; SQLite ya es la fuente principal.

## Alertas En Illustrator

Los errores visibles para el usuario se muestran como alerta nativa de Illustrator mediante ExtendScript:

```text
jsx/rmcNike.jsx                       RMCNike_alert(message)
js/illustrator/illustratorBridge.js   showAlert(message)
js/main.js                            showIllustratorAlert(message)
```

El `alert()` del navegador queda solo como fallback cuando el panel no puede hablar con Illustrator/CEP.

## Git Hook

Git puede disparar un hook despues de cada commit:

```text
.git/hooks/post-commit
```

Ese hook puede ejecutar un script que lea el ultimo commit y lo guarde en `rmcop_nike_git_commits`.
Asi `RMC_Desarrollo.xlsx` puede dejar de ser captura manual y convertirse en reporte exportado desde la BD.
