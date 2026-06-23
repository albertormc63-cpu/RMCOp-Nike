# Flujo Manual

Ultima actualizacion: 2026-06-22.

El flujo manual atiende pedidos individuales y pruebas controladas. Debe permanecer independiente del batch.

## Recorrido

1. Abrir Illustrator y el panel CEP.
2. Seleccionar linea, variante y equipo.
3. Capturar WO, style, talla, numero, nombre y destino.
4. Resolver plantilla y nombre final con `js/utils/pathBuilder.js`.
5. Copiar la plantilla con `js/services/copyTemplate.js`.
6. Cargar `jsx/rmcNike.jsx` mediante `js/illustrator/illustratorBridge.js`.
7. Abrir el PDF copiado y aplicar los datos.
8. Registrar el resultado en SQLite como `RMCOp-Nike Manual`.

## Persistencia

- Usa las mismas tablas `rmcop_nike_runs` y `rmcop_nike_items` que batch.
- El metodo se distingue por `herramienta`, no por tabla ni prefijo del id.
- El run usa `AAAAMMDD-HHMMSS`; no usar `manual-`.
- `excel_path` es `NULL`; `output_root` conserva el destino.

## Restricciones

- No trasladar filtros o estados batch al flujo individual.
- No romper manual al modificar batch.
- Respetar las reglas de variante en `../architecture/ILLUSTRATOR_RULES.md`.
- Mostrar errores mediante alerta nativa de Illustrator.
