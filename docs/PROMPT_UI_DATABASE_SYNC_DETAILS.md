# PROMPT_UI_DATABASE_SYNC_DETAILS — RMC Control Center

Trabaja sólo en RMC Control Center.

Tipo de tarea: UI con datos de `database-sync.md`.

## Objetivo

Agregar o ajustar la UI de detalle para cada registro de `rmcop_nike_items`, mostrando información cruzada con `rmc_print_sublimation_log` mediante `wo`.

La meta operativa es saber qué cosas ya están “bajadas” al departamento de Sublimado por parte de Diseño.

## Contexto de negocio

RMC Control Center no reemplaza Lansa. Lansa sigue siendo el sistema conectado a USA para listas y reportes oficiales. RMC CC debe servir como control interno de planta para visualizar trazabilidad entre áreas.

Este cambio se enfoca en el flujo:
Diseño → Sublimado

## Datos esperados

Tabla base:
- `rmcop_nike_items`
- campo clave: `wo`

Tabla espejo/sync:
- `rmc_print_sublimation_log`
- campo clave: `wo`

Cruce:
- `rmcop_nike_items.wo = rmc_print_sublimation_log.wo`

## Importante sobre los datos

- Una fila en `rmc_print_sublimation_log` puede representar un registro/lote agrupado, no una pieza individual.
- Puede haber varias filas relacionadas con el mismo `wo`.
- Puede haber parciales.
- `*PARCIAL` en fecha de embarque significa que no bajó un corte completo, sólo cierta cantidad de piezas.
- No deduplicar a ciegas filas parciales.
- No asumir que “bajado a Sublimado” significa producción terminada.
- La ausencia de coincidencia no necesariamente es error; puede indicar que aún no ha sido bajado o que no se sincronizó información.

## Lee únicamente

Primero:
- `AGENTS.md`
- `CURRENT_STATE.md`
- `TASK_ROUTER.md`
- `database-sync.md` o `docs/database-sync.md`

Después, sólo si son necesarios:
- archivo de rutas/API que expone datos de Nike items
- archivo de rutas/API de sync si ya existe
- vista/componente donde se renderiza el detalle de cada item
- CSS específico de esa vista

No hagas búsqueda global salvo que estos archivos no indiquen dónde está la vista o endpoint.

## No leer / no tocar

- No abras `README.md` completo.
- No explores todo `docs/`.
- No toques lógica interna de RMCOp-Nike.
- No toques lógica interna de RMC MockupTool.
- No cambies schema SQLite.
- No agregues migraciones.
- No cambies generación PDF.
- No cambies navegación global salvo que sea necesario.
- No rediseñes toda la UI.
- No actualices todos los documentos.

## Requerimiento UI

En la sección de detalle de cada registro/item, mostrar un bloque de tracking Diseño → Sublimado con información como:

- Estado calculado:
  - `Bajado a Sublimado`
  - `Parcial`
  - `Sin coincidencia en Sublimado`
  - `Pendiente / no sincronizado`
- WO usado para el cruce.
- Cantidad o total relacionado si existe en la tabla sync.
- Fecha de embarque o bajada si existe.
- Roster / Style / Process si existen.
- Lista de coincidencias si hay más de una fila relacionada.
- Indicador claro cuando la información viene de tabla espejo/sync.

No depender sólo de colores. Usar texto claro.

## Requerimiento backend/API

Antes de crear endpoint nuevo, revisar si ya existe uno que entregue:
- datos de `rmcop_nike_items`
- datos relacionados de `rmc_print_sublimation_log`
- endpoint `/api/sync` o similar documentado en `database-sync.md`

Si falta información, extender lo mínimo posible el endpoint existente o crear uno específico sólo si es necesario.

No cambiar contratos actuales sin mantener compatibilidad.

## Reglas de cálculo sugeridas

Si hay coincidencias por `wo` en `rmc_print_sublimation_log`:
- mostrar como `Bajado a Sublimado`
- si alguna fila contiene `*PARCIAL` o indicador parcial, mostrar también `Parcial`
- si hay varias coincidencias, mostrar resumen + lista expandible

Si no hay coincidencias:
- mostrar `Sin coincidencia en Sublimado`
- no mostrarlo como error fatal

Si faltan columnas:
- no inventar datos
- mostrar sólo lo confirmado por schema/documentación existente

## Proceso de trabajo

1. Resume en máximo 5 líneas qué archivos vas a leer y por qué.
2. Confirma desde `database-sync.md` los nombres reales de tablas/columnas.
3. Identifica dónde se renderiza el detalle del item.
4. Identifica si el endpoint actual ya puede traer el dato cruzado.
5. Haz el cambio mínimo en backend si falta dato.
6. Haz el cambio mínimo en UI para mostrar el bloque de tracking.
7. No refactorices áreas no relacionadas.
8. No actualices docs salvo que cambie contrato o comportamiento real.

## Verificación esperada

Probar con:
- un `wo` que sí tenga coincidencias en `rmc_print_sublimation_log`
- un `wo` sin coincidencias
- un `wo` con múltiples coincidencias
- un caso parcial si existe

## Documentación

- Actualiza `database-sync.md` sólo si cambió el contrato de datos, endpoint o interpretación.
- Actualiza `CURRENT_STATE.md` sólo si cambió una invariante.
- No actualices `README.md` salvo cambio crítico.
- No actualices docs no relacionados.

## Respuesta final esperada

Incluye:
- Archivos modificados
- Endpoint/API usado o modificado
- Columnas/tablas usadas
- Cómo se calcula el estado mostrado
- Cómo verificar con ejemplos reales
- Qué NO tocaste
- Riesgos o supuestos pendientes
