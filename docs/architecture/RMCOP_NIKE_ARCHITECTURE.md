# Arquitectura De RMCOp-Nike

Ultima actualizacion: 2026-06-22.

## Responsabilidad

`RMCOp-Nike` es el CEP principal de Adobe Illustrator para producir PDFs Nike Lacrosse On Demand. Mantiene separados el flujo manual, el batch y el producto externo de mockups.

## Capas

| Area | Archivos principales | Responsabilidad |
| --- | --- | --- |
| UI | `index.html`, `css/styles.css`, `js/ui/` | Navegacion, formularios, filtros, previews y estado. |
| Coordinacion | `js/main.js` | Estado del panel, manual, batch, validacion y persistencia. |
| Configuracion | `js/config/` | Rutas, catalogo, variantes y reglas. |
| Servicios | `js/services/` | Excel, copias, Node y SQLite. |
| Rutas | `js/utils/pathBuilder.js` | Plantillas, destino y nombre final. |
| Illustrator | `js/illustrator/`, `jsx/` | Puente CEP, reemplazos, muestras, guardado y cierre. |

## Flujos

```text
Manual: formulario -> resolver plantilla/ruta -> copiar -> abrir -> aplicar

Batch: importar Excel -> normalizar -> filtrar -> validar archivos + SQLite
       -> producir solo FALTANTE -> guardar/cerrar -> registrar run e items
```

El flujo manual se documenta en `../processes/MANUAL_FLOW.md`; batch en `../processes/BATCH_FLOW.md`.

## Fuentes De Verdad

- Variantes: `js/config/variantRules.js`.
- Ajustes de texto: `js/config/textFitRules.json` y `js/illustrator/textRules.js`.
- Numeros IH: `js/config/ihNumberRules.json` y `jsx/ihNumbers.jsx`.
- Importacion: `js/services/createOrderData.js`.
- Naming/rutas: `js/utils/pathBuilder.js`.
- Registro: `js/services/portfolioDb.js`.

## Restricciones

- No acoplar dependencias o UI de `RMC MockupTool`.
- No mezclar estados entre manual y batch ni entre Personalizadas y Genericas.
- No generar durante la validacion.
- Las alertas visibles salen por Illustrator/ExtendScript; navegador solo como fallback.
