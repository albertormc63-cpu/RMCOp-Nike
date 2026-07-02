# Manual de RMCOp-Nike

## Parte del RMC Control System

**Sistema paraguas:** RMC Control System  
**Herramienta:** RMCOp-Nike  
**Fecha de generación:** 1 de julio de 2026  
**Desarrollado y documentado por:** Alberto Villarreal

---

## Portada

**Manual de RMCOp-Nike**  
Herramienta interna para apoyo operativo de Nike On Demand.

RMCOp-Nike forma parte del RMC Control System como panel interno de producción para Adobe Illustrator. Su función es apoyar la preparación de piezas Nike On Demand dentro de planta, usando Rosters enviados por USA y datos relacionados con pedidos consultados en Lansa.

Este documento resume el propósito, alcance, flujo general, ventajas y estado actual de la herramienta para una junta interna de RMC.

---

## 1. Descripción general

RMCOp-Nike es un panel CEP para Adobe Illustrator que ayuda a preparar piezas Nike Lacrosse On Demand. La herramienta resuelve plantillas PDF, crea copias de trabajo, aplica nombres y números, procesa pedidos por lote desde Excel y registra resultados en una base SQLite compartida de RMC.

El repositorio corresponde únicamente a RMCOp-Nike. El producto de mockups vive como CEP separado en RMC MockupTool y no forma parte de este manual.

| Herramienta | Uso principal | Estado |
|---|---|---|
| RMCOp-Nike Manual | Pedidos individuales y pruebas controladas. | Implementado. |
| RMCOp-Nike Personalizadas | Producción por lote desde Excel OD / On Demand. | Implementado. |
| RMCOp-Nike Genericas | Producción por lote desde roster detallado. | Implementado. |

[INSERTAR IMAGEN: Panel principal del CEP RMCOp-Nike]

## 2. Objetivo de la herramienta

El objetivo es reducir el tiempo de preparación de piezas Nike On Demand, disminuir errores humanos y dejar trazabilidad del proceso. Un flujo que antes podía tomar alrededor de 1 día y medio de trabajo manual puede resolverse en unos cuantos minutos cuando la información y plantillas están listas.

La herramienta busca:

- Automatizar tareas repetitivas de preparación.
- Validar datos antes de generar archivos.
- Procesar solo piezas faltantes.
- Estandarizar nombres, rutas, tallas, styles y variantes.
- Registrar runs e items para consulta interna.

## 3. Relación con Lansa

Lansa sigue siendo el sistema oficial conectado con USA. RMCOp-Nike no reemplaza Lansa.

RMCOp-Nike y el RMC Control System funcionan como herramientas internas complementarias para controlar y optimizar el flujo dentro de planta. La información operativa puede venir de Rosters, Excel y datos consultados en Lansa, pero Lansa conserva su rol como fuente oficial.

## 4. Problema operativo que resuelve

RMCOp-Nike ataca problemas comunes del flujo manual:

- Captura repetitiva de nombres, números, tallas, styles y equipos.
- Riesgo de elegir plantillas incorrectas o duplicar archivos.
- Tiempo alto de preparación antes de liberar producción.
- Dificultad para saber qué ya se generó y qué falta.
- Falta de una bitácora central para revisar resultados y errores.

## 5. Qué hace actualmente

| Función real | Descripción breve |
|---|---|
| Panel CEP | Interfaz por pasos dentro de Illustrator. |
| Flujo Manual | Captura un pedido, crea copia de plantilla y aplica datos. |
| Personalizadas | Lee Excel OD / On Demand y procesa por style/talla. |
| Genericas | Lee roster detallado y genera PDFs en la carpeta del Excel. |
| Validación incremental | Detecta faltantes, ya creados, conflictos y registros incompletos. |
| Generación controlada | Solo procesa filas `FALTANTE`; no crea nombres alternos en batch. |
| Reglas de variantes | Soporta Standard, Indigenous Heritage y Throwback como flujo principal. |
| Illustrator | Abre PDF, aplica nombre/número, guarda y cierra. |
| SQLite | Registra runs e items en tablas propias de RMCOp-Nike. |
| Logs | Guarda bitácoras CSV/JSONL como respaldo operativo. |
| Muestras oficiales | Extrae y valida swatches desde Illustrator. |

[INSERTAR IMAGEN: Carga de Roster]

## 6. Flujo general de trabajo

1. El operador recibe o consulta información del pedido.
2. Carga Excel/Roster o captura datos manuales.
3. Selecciona línea, equipo, variante, style, talla y destino.
4. La herramienta valida estructura, archivos existentes, SQLite y conflictos.
5. Se procesan únicamente las filas faltantes.
6. Illustrator abre, aplica datos, guarda y cierra cada PDF.
7. El resultado queda registrado para trazabilidad interna.

Regla principal:

> Validar primero; generar después.

[INSERTAR IMAGEN: Generación de piezas]

## 7. Entradas de información

| Entrada | Uso | Fuente |
|---|---|---|
| Roster enviado desde USA | Genericas; contiene filas por jugador/talla/style. | Roster operativo. |
| Excel OD / On Demand | Personalizadas; contiene WO, style, talla, nombre y número. | Archivo Nike On Demand. |
| Datos de Lansa | Referencia oficial de pedidos y datos operativos. | Lansa. |
| Plantillas base PDF | Archivo que se copia y personaliza. | Volumen de plantillas. |
| Configuración de rutas | Plantillas, órdenes y SQLite. | `js/config/config.js` |
| Reglas de variantes/texto | Inferencia de style y reemplazos en Illustrator. | Archivos de configuración del repo. |

## 8. Salidas generadas

| Salida | Descripción | Uso |
|---|---|---|
| PDFs generados | Archivos personalizados o genéricos listos para el flujo interno. | Producción. |
| Runs en SQLite | Resumen de cada ejecución. | Trazabilidad. |
| Items en SQLite | Detalle por fila/pieza generada. | Consulta y duplicados. |
| Logs CSV/JSONL | Bitácora plana de resultados. | Revisión rápida. |
| Datos consultables | Información base para RMC Control Center o reportes futuros. | Control interno. |

[INSERTAR IMAGEN: Registro generado en base de datos]

## 9. Ventajas operativas

- Reduce tiempos de preparación de aproximadamente 1 día y medio a minutos.
- Disminuye errores humanos de captura y selección.
- Estandariza rutas, nombres y reglas de salida.
- Evita duplicados mediante validación previa.
- Permite reintentar errores sin bloquear el flujo completo.
- Mejora trazabilidad con SQLite y logs.
- Separa Manual, Personalizadas y Genericas para operar con orden.

## 10. Áreas de oportunidad que ataca

| Área | Cómo ayuda |
|---|---|
| Trabajo repetitivo | Automatiza copia, apertura, aplicación de datos y guardado. |
| Errores de captura | Normaliza datos desde Excel/Roster. |
| Duplicados | Usa claves y rutas esperadas para validar antes de generar. |
| Falta de visibilidad | Muestra válidas, inválidas, faltantes y conflictos. |
| Trazabilidad | Guarda runs, items, rutas, estados y tiempos. |
| Variantes complejas | Centraliza reglas de Standard, IH y TB. |

## 11. Variantes y escalabilidad

| Variante/Familia | Estado actual |
|---|---|
| `A1000`, `Y1000` | Masculino / PLL; implementado. |
| `A2000`, `Y2000` | Femenino / WLL; implementado. |
| Standard `H/A` | Nombre y número como texto; implementado. |
| Indigenous Heritage `IH` | Nombre como texto y número desde arte; implementado, pendiente prueba completa en Illustrator real. |
| Throwback `TB` | Variante de texto; implementado, pendiente validar con plantillas reales. |
| JR Championship `JR` | Soporte parcial en código; pendiente de validar. |
| All Stars `AS` | Soporte parcial; pendiente de autorización y validación. |
| Stars & Stripes `SS` | Soporte parcial con `design_code`; pendiente de validar reglas finales. |

La dirección futura es mover variantes, diseños y aliases a un catálogo compartido administrado desde RMC Control Center. En este repo existe lectura parcial/fallback local, pero no una administración completa desde el CEP.

## 12. Estado actual

### Funciona actualmente

- Flujo Manual.
- Batch Personalizadas.
- Batch Genericas.
- Validación incremental.
- Generación solo de faltantes.
- Registro en SQLite.
- Logs CSV/JSONL.
- Standard, IH y TB como variantes principales.

### Pendiente de validar

- Batch completo desde Illustrator real.
- Registros SQLite generados desde operación real.
- Throwback con plantillas finales.
- IH con números de 1, 2 y 3 dígitos.
- Colisión potencial de `run_id` si dos ejecuciones ocurren en el mismo segundo.
- Variantes JR, AS y SS antes de considerarlas productivas.

## 13. Limitaciones actuales

| Limitación | Impacto |
|---|---|
| Depende de Illustrator/CEP | La generación real requiere Illustrator abierto. |
| Depende de rutas locales/servidor | Plantillas, órdenes y SQLite deben estar disponibles. |
| SQLite compartida | Funciona sin servidor, pero no es ideal para múltiples operadores escribiendo por red. |
| `run_id` por segundo | Puede colisionar en ejecuciones simultáneas. |
| Sin suite formal de pruebas | Cambios importantes requieren checks Node y prueba real en Illustrator. |
| Variantes especiales parciales | JR, AS y SS necesitan confirmación de reglas, plantillas y naming. |

## 14. Mejoras futuras / Roadmap

| Mejora | Prioridad | Estado |
|---|---|---|
| Validar batch completo en Illustrator real | Alta | Pendiente. |
| Resolver colisión de `run_id` | Alta | Pendiente. |
| Registrar items durante el proceso | Alta | Propuesto. |
| Mejorar performance de Por lote | Media | Pendiente UX/performance. |
| Catálogo compartido de variantes | Media | Propuesto / parcial. |
| RMC Control Center como consulta/API central | Media | Propuesto fuera de este repo. |
| Reportería desde SQLite | Media | Pendiente. |
| All Stars y Stars & Stripes | Alta antes de activar | Pendiente de validar/autorización. |

## 15. Manual rápido de uso

### Manual

1. Abrir Illustrator y el panel RMCOp-Nike.
2. Seleccionar línea, equipo y variante.
3. Capturar WO o Roster, fecha, style, talla, número, nombre y destino.
4. Revisar plantilla, archivo final y destino.
5. Crear copia de plantilla.
6. Abrir y aplicar datos.

### Personalizadas

1. Entrar a `Por lote`.
2. Elegir `Personalizadas`.
3. Importar Excel OD.
4. Elegir destino.
5. Revisar validación y filtros.
6. Procesar faltantes.

### Genericas

1. Entrar a `Por lote`.
2. Elegir `Genericas`.
3. Importar roster detallado.
4. Capturar fecha de embarque.
5. Confirmar destino automático.
6. Procesar faltantes.

[INSERTAR IMAGEN: Selección de pedido]
[INSERTAR IMAGEN: Archivos generados]

## 16. Mantenimiento técnico

| Área | Archivos principales |
|---|---|
| UI | `index.html`, `css/styles.css`, `js/ui/` |
| Coordinación | `js/main.js` |
| Configuración | `js/config/` |
| Excel | `js/services/createOrderData.js` |
| Rutas y naming | `js/utils/pathBuilder.js` |
| SQLite | `js/services/portfolioDb.js` |
| Illustrator | `js/illustrator/illustratorBridge.js`, `jsx/` |

Rutas importantes:

- Plantillas server: `/Volumes/Fullsize/PATRONES ACOMODADOS PARA ROLLO/NIKE LACROSSE/RMCOp-NIKE`
- Órdenes server: `/Volumes/Fullsize/TO PRINT/NIKE ORDERS`
- SQLite: `/Users/rmlsub1/Documents/RMC - CEP/RMC_BD/RMC_CEP.sqlite`
- Portafolio interno: `/Users/rmlsub1/Documents/RMC - CEP/RMCOp-Nike Portafolio interno`

Tablas propias:

- `rmcop_nike_runs`
- `rmcop_nike_items`
- `rmcop_nike_git_commits`

No deben tocarse tablas de otros CEP como `rmc_mockuptool_*`.

## 17. Espacios para imágenes

[INSERTAR IMAGEN: Panel principal del CEP RMCOp-Nike]

[INSERTAR IMAGEN: Carga de Roster]

[INSERTAR IMAGEN: Selección de pedido]

[INSERTAR IMAGEN: Generación de piezas]

[INSERTAR IMAGEN: Archivos generados]

[INSERTAR IMAGEN: Registro generado en base de datos]

[INSERTAR IMAGEN: Error/validación]

[INSERTAR IMAGEN: Consulta desde RMC Control Center]

## Apéndice. Pendientes marcados como pendiente de validar

- Prueba batch completa desde Illustrator real.
- Confirmación de registros SQLite desde operación real.
- Throwback con plantillas reales.
- Indigenous Heritage con números de 1, 2 y 3 dígitos.
- Resolución de colisión potencial de `run_id`.
- All Stars fuera del catálogo activo hasta autorización expresa.
- Stars & Stripes con naming, carpetas y fuente oficial de `design_code`.
- JR Championship con plantillas, placeholders y flujo autorizado.
- RMC Control Center como consulta/API central, no implementado como endpoint activo en este repo.
