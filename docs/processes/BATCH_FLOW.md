# Flujo Batch

Ultima actualizacion: 2026-06-22.

## Recorrido

```text
elegir modo -> importar Excel -> normalizar -> filtrar -> validar
-> recalcular validacion -> producir FALTANTE -> guardar/cerrar -> registrar
```

La validacion es visible y no copia, abre ni modifica documentos. Al procesar se consulta de nuevo el estado de archivos y SQLite.

## Modos

| Modo | Entrada | Destino |
| --- | --- | --- |
| `Personalizadas` | Excel OD | Carpeta elegida manualmente; subcarpetas `style/talla`. |
| `Genericas` | Roster detallado | Carpeta del Excel; PDFs directamente en la raiz. |

Cambiar de modo limpia Excel, destino, filtros, resultados y validacion anteriores.

`OD` es pista de Personalizadas. `ST/IH/TB/AS` es pista de Genericas, pero la estructura interna manda. Genericas requiere `Style`, `Color`, `Qty`, `Size`, `Last Name` y `Player#`; las listas resumen no son procesables en Illustrator.

## Validacion Incremental

| Estado | Se procesa |
| --- | --- |
| `FALTANTE` | Si |
| `YA_CREADO` | No |
| `ARCHIVO_SIN_REGISTRO` | No |
| `REGISTRADO_SIN_ARCHIVO` | No |
| `CONFLICTO` | No |

Solo `FALTANTE` entra a produccion. Claves o rutas repetidas son `CONFLICTO`; batch no crea nombres `DUP`, `(1)` ni otra salida alternativa.

La identidad se guarda en `rmcop_nike_items.clave`:

```text
(WO o Roster) + Ship Order + Style + Team + Size + Nombre + Numero
```

Solo items `Completado` bloquean la clave; errores pueden reintentarse.

## Produccion

- Filtrar por familia de style, una o varias tallas y variante global.
- El filtro de variante agrupa por variante base (`Standard`, `Indigenous Heritage`, `All Star`, etc.), no por `Home/Away`.
- Copiar, abrir, aplicar, guardar PDF y cerrar por cada fila faltante.
- `Qty/Pzs` registra piezas, pero no multiplica PDFs.
- En Genericas, Roster sustituye WO cuando no existe y participa en naming/clave.
- Filas sin nombre/numero pueden ser validas y usan `SIN_DATOS` para comparar el nombre final.
- Registrar el run como `RMCOp-Nike Personalizadas` o `RMCOp-Nike Genericas`.

## Plantillas 1500

Standard `A1500A`, `A1500H`, `Y1500A` y `Y1500H` usa las carpetas normales Home/Away por equipo y entra a una subcarpeta `1500`.

Ejemplo adulto Away Boston:

```text
STANDARD/
  NIKE Mens and Youth/
    MENS/
      AWAY/
        Boston Away/
          1500/
            PLL BOSTON A1500A LG.pdf
```

JR Championship conserva la regla separada de shorts: `A1500JR` busca subcarpeta `A1500` y `Y1500JR` busca subcarpeta `Y1500` dentro de la carpeta `JR` del equipo.

Detalles del contrato Excel: `EXCEL_IMPORT_AND_VALIDATION.md`. Persistencia: `../sqlite/SQLITE_PORTFOLIO_AND_REGISTRY.md`.
