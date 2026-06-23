# Frontera Con RMC MockupTool

Ultima actualizacion: 2026-06-22.

## Decision

`RMCOp-Nike` es el CEP principal de Illustrator para plantillas y personalizacion. `RMC MockupTool` es un producto separado para generar PDFs de mockup listos para imprimir.

```text
/Users/rmlsub1/Library/Application Support/Adobe/CEP/extensions/RMC MockupTool
```

## No Mezclar

- No agregar features de mockups dentro de `RMCOp-Nike`.
- No importar su UI, servidor, dependencias ni `manifest.xml`.
- No restaurar herramientas antiguas de mockup dentro de este repo.
- Cualquier cambio de mockups se realiza en el repo/carpeta de `RMC MockupTool` y siguiendo su README.

## Convivencia Permitida

- Ambos pueden leer insumos operativos relacionados.
- Ambos pueden usar la misma SQLite local, pero solo mediante tablas propias.
- `RMCOp-Nike` usa `rmcop_nike_*`; nunca modifica tablas `rmc_mockuptool_*`.

Compartir proceso de negocio no convierte a los dos CEP en un solo producto.
