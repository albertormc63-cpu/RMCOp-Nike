# Estado Actual

Ultima actualizacion: 2026-07-10.

`RMCOp-Nike` es el panel CEP principal de Illustrator para Nike Lacrosse On Demand. El flujo manual individual funciona y el batch desde Excel opera en modos `Personalizadas` y `Genericas` con validacion incremental.

## Operativo

- Lineas activas: masculino y femenino.
- `Standard`: nombre y numero como texto.
- `Indigenous Heritage`: nombre como texto y numero desde arte; gap obligatorio de `0.25in`.
- `Throwback`: variante de texto `TB`; no pertenece al flujo IH.
- JR Championship busca shorts `A1500JR` y `Y1500JR` dentro de las subcarpetas `A1500` y `Y1500` de cada equipo; jerseys 1000 permanecen en la raiz del equipo.
- Standard 1500 (`A1500A/H`, `Y1500A/H`) busca plantillas en subcarpetas `A1500` o `Y1500` dentro de cada carpeta Home/Away de equipo.
- Los styles 1500 sin nombre ni numero no agregan `SIN_DATOS` al nombre final del PDF.
- Batch valida archivos y SQLite antes de producir, y vuelve a validar al procesar.
- Solo `FALTANTE` se genera; inconsistencias y duplicados quedan fuera.
- Personalizadas usa destino manual con subcarpetas style/talla.
- Genericas usa la carpeta del roster y guarda PDFs en la raiz.
- Manual, Personalizadas y Genericas registran runs/items en la SQLite compartida.
- Alertas operativas se muestran desde Illustrator/ExtendScript.

## Separado

`RMC MockupTool` es otro CEP y otro repo. Su desarrollo no pertenece a este arbol.

## Pendientes Principales

1. Probar el batch completo y los registros SQLite desde Illustrator real.
2. Validar Throwback con plantillas reales y confirmar placeholders.
3. Probar IH con numeros de 1, 2 y 3 digitos.
4. Resolver la posible colision de `run_id` entre ejecuciones del mismo segundo antes de soportar concurrencia.
5. Mantener All Stars fuera del catalogo activo hasta autorizacion expresa.

Las propuestas de reestructura de persistencia no estan implementadas. El contexto historico completo esta en `docs/archive/CODEX_HANDOFF_2026-06-22.md`.

## Pendiente UX / Performance

La seccion `Por lote` se siente lenta/pesada al interactuar con el panel. No optimizar dentro de tareas documentales ni cambiar comportamiento batch sin retomar el tema de forma explicita.

Cuando se retome, revisar primero sin romper el flujo actual:

- Renderizado de listas/resumenes de filas del Excel.
- Re-render al cambiar filtros de style/talla.
- Validacion incremental contra archivos y SQLite.
- Eventos que puedan recalcular demasiado en cada interaccion.
- Operaciones sincronas de filesystem/SQLite que bloqueen la UI CEP.
- Separar lectura, validacion y procesamiento para que la UI no se congele.

Reglas para cualquier mejora futura: validar primero y generar despues; mantener separados `Personalizadas` y `Genericas`; hacer cambios pequenos; probar en Illustrator real.
