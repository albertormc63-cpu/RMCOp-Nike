# RMCOp-Nike - Registros, SQLite Y Portafolio

Ultima actualizacion: 2026-06-17.

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
estado
error
tiempo
clave
```

`roster` guarda el numero de roster usado para nombrar los PDFs de `RMCOp-Nike Genericas` (por ejemplo `79135-26`). En `RMCOp-Nike Personalizadas` y `RMCOp-Nike Manual` queda vacio porque esos flujos se identifican con `wo`.

No se guarda `output_path`.
No se guardan `source_excel` ni `destination_folder`.

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

Si una fila no tiene nombre ni numero, usar el mismo criterio de nombre final que el panel (`SIN_DATOS`) para comparar contra archivos existentes.

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

Manual usa el mismo escritor con un resultado. Los ids manuales no llevan `manual-`; el metodo se identifica con `herramienta`.

Riesgo conocido: el id usa precision de segundos. Dos ejecuciones que produzcan el mismo `AAAAMMDD-HHMMSS` pueden reemplazarse; debe resolverse antes de soportar concurrencia real.

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
