# Prompt Para RMC Optimizador: BD Por Operador Y Sync Central

Estamos preparando una arquitectura de sincronizacion para las BDs locales de RMC.

## Contexto

La BD central actual es:

```text
/Users/rmlsub1/Documents/RMC - CEP/RMC_BD/RMC_CEP.sqlite
```

La BD ya contiene tablas para:

- RMCOp-Nike: `rmcop_nike_runs`, `rmcop_nike_items`, `rmcop_nike_git_commits`.
- RMC MockupTool: `rmc_mockuptool_runs`, `rmc_mockuptool_items`.
- RMC Optimizador: `rmc_opt_orders`, `rmc_opt_order_lines`, `rmc_opt_roster_outputs`, `rmc_opt_assets`, `rmc_opt_schema_meta`.
- Sync externo: `rmc_external_sources`, `rmc_sync_runs`.

La idea es que cada operador tenga su propia SQLite en el volumen de red:

```text
/Volumes/Fullsize/PATRONES ACOMODADOS PARA ROLLO/NIKE LACROSSE/RMCOp-NIKE/ASSETS/BD/THANIA/RMC_CEP.sqlite
/Volumes/Fullsize/PATRONES ACOMODADOS PARA ROLLO/NIKE LACROSSE/RMCOp-NIKE/ASSETS/BD/ANTONIO/RMC_CEP.sqlite
```

RMC Control Center sera quien sincronice esas BDs hacia la BD central. No queremos que varios operadores escriban en una sola SQLite compartida.

## Solicitud Para RMC Optimizador

Analiza RMC Optimizador con esta arquitectura en mente y entrega diagnostico antes de implementar:

1. Que tablas de RMC Optimizador deben vivir en la BD por operador.
2. Que campos hacen falta para identificar origen: `operator_code`, `source_id`, `source_record_id`, `synced_at`.
3. Como evitar duplicados usando `tracking_key`, `roster`, `wo`, `style`, `path` u otra clave natural.
4. Que ajustes requiere RMC Optimizador para poder escribir a una BD configurable por operador.
5. Que datos deben copiarse como catalogo/base y que datos operativos deben iniciar vacios.
6. Como deberia importar RMC Control Center los datos de RMC Optimizador sin romper relaciones entre `orders`, `order_lines`, `roster_outputs` y `assets`.

## Reglas

- No implementar todavia.
- No escribir directamente varias estaciones sobre una misma SQLite.
- Control Center debe consolidar desde copias o backups seguros de cada BD de operador.
- La importacion debe ser idempotente.
- Preservar relaciones internas de RMC Optimizador.
