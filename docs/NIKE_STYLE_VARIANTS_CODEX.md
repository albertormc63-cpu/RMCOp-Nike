# NIKE_STYLE_VARIANTS_CODEX.md

Contexto para Codex cuando trabaje en cualquiera de estos repos:

- `RMCOp-Nike`
- `RMC MockupTool`
- `RMC Control Center`

Este documento define una regla de negocio nueva para estilos Nike, variantes especiales y diseños que no pertenecen a equipos/estados oficiales.

---

## 1. Resumen de la situación

En la línea Nike, las plantillas/cortes base son iguales para el armado de los `Styles`.

Lo que normalmente cambia es la variante del estilo, por ejemplo:

- `A1000H`
- `A1000A`
- `A2000H`
- `A2000A`
- `Y1000H`
- `Y1000A`
- `Y2000H`
- `Y2000A`

En los casos normales, estas variantes están ligadas a equipos oficiales, estados o equipos con local/visita.

También existen variantes especiales que siguen perteneciendo a equipos oficiales, pero no usan local/visita:

- `IH` = `Indigenous Heritage`
- `TB` = `Throwback`

Ejemplos:

- `A1000IH`
- `A1000TB`
- `A2000IH`
- `A2000TB`
- `Y1000IH`
- `Y1000TB`
- `Y2000IH`
- `Y2000TB`

La misma lógica aplica para las familias:

- `A1000`
- `A2000`
- `Y1000`
- `Y2000`

---

## 2. Nueva regla: variante `SS`

Ahora existen nuevos diseños que no pertenecen a ningún equipo oficial ni estado.

Ejemplos actuales:

- `Green Beret Foundation`
- `Navy SEAL Foundation`

Estos diseños se identifican dentro de una variante especial llamada `SS`.

Ejemplo:

```text
A1000SS
```

Punto importante:

```text
A1000SS no identifica por sí solo un diseño único.
```

`SS` debe tratarse como una variante/contenedor. Dentro de `SS` pueden existir diferentes diseños o fundaciones.

Ejemplos de subdiseños dentro de `SS`:

| Código interno | Diseño / Fundación |
|---|---|
| `GNB1` | Green Beret / Green Beret Foundation |
| `NYS1` | Navy SEALs / Navy SEAL Foundation |

Por lo tanto, la identidad completa de un diseño `SS` debe considerar:

```text
familia + variante + subcodigo_diseno
```

Ejemplos:

```text
A1000 + SS + GNB1
A1000 + SS + NYS1
A2000 + SS + GNB1
Y1000 + SS + NYS1
```

---

## 3. Modelo mental correcto

No asumir que todo `Style` Nike pertenece a equipo oficial.

### Antes

```text
Style = familia + variante ligada a equipo/local/visita
```

Ejemplo:

```text
A1000H Boston Cannons
A1000A Boston Cannons
A1000IH Boston Cannons
A1000TB Boston Cannons
```

### Ahora

```text
Style = familia + variante
```

Y opcionalmente:

```text
subcodigo_diseno = requerido cuando variante = SS
```

Ejemplo:

```text
A1000SS + GNB1 = Green Beret Foundation
A1000SS + NYS1 = Navy SEAL Foundation
```

---

## 4. Regla de parseo recomendada

Cuando Codex encuentre un estilo Nike como:

```text
A1000SS
```

Debe separarlo así:

```text
family = A1000
variant = SS
```

Pero debe buscar otro campo, carpeta, metadata o configuración que indique el diseño específico:

```text
design_code = GNB1 | NYS1 | otro futuro
```

No debe inferir que `SS` es un equipo.

No debe guardar `SS` como si fuera el nombre del diseño final.

No debe mezclar `GNB1` y `NYS1` solo porque ambos usan `A1000SS`.

---

## 5. Reglas globales para cualquier repo

Codex debe seguir estas reglas en cualquier repositorio:

1. No romper la lógica existente de `H`, `A`, `IH` o `TB`.
2. Agregar soporte para `SS` como variante válida.
3. Tratar `SS` como variante/contenedor, no como equipo.
4. Permitir que dentro de `SS` existan múltiples diseños.
5. Usar `design_code` o equivalente para distinguir diseños como `GNB1` y `NYS1`.
6. Si no existe todavía un nombre final para los PDFs, dejar la lógica preparada con TODOs claros y no inventar un naming definitivo.
7. Mantener compatibilidad con los estilos existentes.
8. No hacer refactors grandes si la tarea pide un cambio puntual.

---

## 6. Estructura conceptual recomendada

Cuando sea necesario persistir o normalizar esta información, usar una estructura similar a esta:

```js
{
  family: "A1000",
  variant: "SS",
  designCode: "GNB1",
  designName: "Green Beret Foundation",
  teamCode: null,
  teamName: null,
  isOfficialTeam: false
}
```

Para un equipo oficial normal:

```js
{
  family: "A1000",
  variant: "H",
  designCode: null,
  designName: null,
  teamCode: "BOS",
  teamName: "Boston Cannons",
  isOfficialTeam: true
}
```

Para una variante especial de equipo:

```js
{
  family: "A1000",
  variant: "IH",
  designCode: null,
  designName: "Indigenous Heritage",
  teamCode: "BOS",
  teamName: "Boston Cannons",
  isOfficialTeam: true
}
```

---

# 7. Instrucciones por repositorio

## 7.1 Si estás en `RMCOp-Nike`

Objetivo del repo:

- Procesar, registrar o estructurar información de órdenes Nike.
- Alimentar datos que después pueden usarse por RMC MockupTool o RMC Control Center.

Codex debe:

1. Revisar dónde se parsean o validan los styles Nike.
2. Agregar `SS` como variante válida.
3. No clasificar `SS` como equipo.
4. Permitir almacenar o transportar un `design_code` para distinguir diseños dentro de `SS`.
5. Considerar que `A1000SS`, `A2000SS`, `Y1000SS` y `Y2000SS` pueden existir.
6. Preservar la lógica existente de `H`, `A`, `IH` y `TB`.
7. Si la fuente actual no trae `design_code`, dejar el flujo preparado para recibirlo después.

Campos recomendados si aplica base de datos, JSON, CSV o metadata:

```text
style_family
style_variant
design_code
design_name
team_code
team_name
is_official_team
```

Regla crítica:

```text
Para variante SS, design_code es necesario para distinguir el diseño real.
```

Ejemplos esperados:

```text
A1000SS + GNB1 -> Green Beret Foundation
A1000SS + NYS1 -> Navy SEAL Foundation
```

---

## 7.2 Si estás en `RMC MockupTool`

Objetivo del repo:

- Generar mockups, PDFs, layouts o salidas visuales usando plantillas/cortes.
- Resolver rutas de plantillas por familia, variante, talla y diseño.

Codex debe:

1. Agregar soporte para `SS` en la resolución de plantillas.
2. Considerar que `SS` tendrá subcarpetas o niveles internos por diseño.
3. No asumir que una carpeta `A1000SS` contiene un único diseño final.
4. Resolver plantillas usando `family`, `variant`, `design_code` y `size` cuando aplique.
5. Mantener el soporte actual para equipos oficiales y variantes `H`, `A`, `IH`, `TB`.
6. No definir todavía un naming final de PDFs si no existe una regla confirmada.

Estructura de carpetas sugerida, no definitiva:

```text
templates/
  A1000/
    H/
    A/
    IH/
    TB/
    SS/
      GNB1/
        SM.pdf
        MD.pdf
        LG.pdf
      NYS1/
        SM.pdf
        MD.pdf
        LG.pdf
```

Alternativa válida si el repo ya usa otra estructura:

```text
A1000SS/
  GNB1/
    <SIZE>.pdf
  NYS1/
    <SIZE>.pdf
```

Regla crítica:

```text
La ruta de plantilla para SS debe incluir el subcodigo de diseño.
```

Ejemplo conceptual:

```js
resolveTemplate({
  family: "A1000",
  variant: "SS",
  designCode: "GNB1",
  size: "MD"
})
```

Debe resolver a una plantilla de Green Beret, no a una plantilla genérica de `SS`.

### Sobre nombres de PDF

El naming final de PDFs para `SS` aún no está definido.

Codex no debe inventar una convención definitiva.

Puede dejar TODOs como:

```text
TODO: confirmar naming final para PDFs SS.
TODO: definir si el PDF debe incluir design_code, design_name o ambos.
```

Naming provisional sugerido solo para pruebas internas:

```text
<WO> <DESIGN_CODE> <STYLE> <SIZE>.pdf
```

Ejemplo provisional:

```text
173884 GNB1 A1000SS MD.pdf
173884 NYS1 A1000SS MD.pdf
```

No usar este naming como definitivo sin confirmación.

---

## 7.3 Si estás en `RMC Control Center`

Objetivo del repo:

- Mostrar información operativa interna de planta.
- Cruzar datos de RMCOp-Nike, RMC MockupTool, impresión, sublimado y otras áreas.
- Dar trazabilidad interna sin reemplazar Lansa.

Codex debe:

1. Mostrar `SS` como variante válida en UI.
2. Mostrar el subdiseño dentro de `SS`, por ejemplo `GNB1 - Green Beret Foundation` o `NYS1 - Navy SEAL Foundation`.
3. No mostrar `SS` como si fuera equipo.
4. Permitir filtrar o agrupar por variante `SS`.
5. Permitir filtrar o agrupar por `design_code` dentro de `SS`.
6. Mantener compatibilidad con vistas actuales de equipos oficiales.
7. No modificar reglas de sincronización sin revisar `database-sync.md` o el documento equivalente del repo.

Ejemplo de UI deseada:

```text
Style: A1000SS
Variante: SS
Diseño: GNB1 - Green Beret Foundation
Equipo oficial: No aplica
```

Otro ejemplo:

```text
Style: A1000SS
Variante: SS
Diseño: NYS1 - Navy SEAL Foundation
Equipo oficial: No aplica
```

Para estilos normales:

```text
Style: A1000H
Variante: Home
Equipo: Boston Cannons
```

Para variantes especiales de equipo:

```text
Style: A1000IH
Variante: Indigenous Heritage
Equipo: Boston Cannons
```

---

# 8. Relación con tracking y sublimado

En RMC Control Center, esta lógica puede afectar el detalle de registros Nike, especialmente cuando se crucen datos de:

- `rmcop_nike_items`
- `rmc_print_sublimation_log`
- otros Exceles o tablas espejo de áreas/departamentos

Cuando se muestre el detalle de un registro, el sistema debería poder decir si el item pertenece a:

1. Equipo oficial con local/visita.
2. Equipo oficial con variante especial `IH` o `TB`.
3. Diseño/fundación no ligado a equipo, dentro de `SS`.

Para `SS`, el cruce no debe depender únicamente de `style`.

Ejemplo problemático:

```text
A1000SS
```

Puede representar:

```text
GNB1 - Green Beret Foundation
NYS1 - Navy SEAL Foundation
```

Por eso se necesita otro identificador:

```text
design_code
```

O una equivalencia definida desde carpeta, metadata, archivo fuente o tabla de configuración.

---

# 9. Tabla de variantes Nike conocidas

| Variante | Significado | Pertenece a equipo oficial | Requiere subcodigo de diseño |
|---|---|---:|---:|
| `H` | Home / Local | Sí | No |
| `A` | Away / Visita | Sí | No |
| `IH` | Indigenous Heritage | Sí | No |
| `TB` | Throwback | Sí | No |
| `SS` | Special / Foundation Designs | No necesariamente | Sí |

Nota:

`SS` puede representar diseños especiales que no están ligados a equipos oficiales.

---

# 10. Tabla inicial de diseños `SS`

| design_code | Nombre preferido | Aliases posibles |
|---|---|---|
| `GNB1` | Green Beret Foundation | Green Beret, Green Beret Fundation |
| `NYS1` | Navy SEAL Foundation | Navy SEALs, Navy Seal Foundation, Navy SEALs Foundation |

Nota:

Se conserva `Fundation` como alias porque puede aparecer escrito así en archivos, carpetas o datos capturados manualmente, pero el nombre recomendado para UI/documentación es `Foundation`.

---

# 11. Prompt base para Codex

---

# 11. Propuesta futura: catalogo compartido en SQLite

Para evitar modificar codigo cada vez que Nike agregue una variante, equipo, evento o diseño especial, la regla de negocio deberia moverse gradualmente a una tabla compartida en la BD central.

La administracion ideal seria desde `RMC Control Center`, no desde `RMCOp-Nike` ni desde `RMC MockupTool`.

Objetivo:

- Dar de alta variantes, equipos y disenos nuevos una sola vez.
- Permitir que `RMCOp-Nike` valide y registre usando datos compartidos.
- Permitir que `RMC MockupTool` resuelva plantillas/mockups usando el mismo catalogo.
- Evitar listas hardcodeadas duplicadas en cada repo.
- Mantener compatibilidad con la logica actual de `H`, `A`, `IH` y `TB`.

## Tabla conceptual sugerida

Nombre tentativo:

```text
rmc_nike_style_variants
```

Campos conceptuales:

```text
id
style_family          -- A1000, A2000, Y1000, Y2000; opcional si la regla aplica globalmente
variant_code          -- H, A, IH, TB, SS, AS, etc.
variant_name          -- Home, Away, Indigenous Heritage, Throwback, Special Series, All Star Game
design_code           -- GNB1, NYS1, AAS1, HAS1, etc. Null si no aplica
design_name           -- Green Beret Foundation, Navy SEAL Foundation, All Star Team A, etc.
team_code             -- BOS, UTA, etc. Null si no pertenece a equipo oficial
team_name
is_official_team
is_active
aliases               -- texto o JSON con aliases de color/carpeta/nombre
notes
created_at
updated_at
```

Notas:

- `style_family` podria ser `NULL` cuando una variante aplica a todas las familias.
- `design_code` es obligatorio para variantes contenedor como `SS` cuando hay mas de un diseno posible.
- `variant_code` no debe usarse solo para identificar el diseno final en variantes contenedor.
- No cambiar schema real sin plan de migracion claro.

## Reglas de consumo por repo

`RMC Control Center`:

- Debe ser el lugar natural para altas, bajas y edicion del catalogo.
- Debe validar duplicados antes de guardar.
- Debe mostrar aliases y estado activo/inactivo.
- Debe poder desactivar una variante sin borrar historial.

`RMCOp-Nike`:

- Debe poder consultar el catalogo para reconocer variantes nuevas.
- Debe mantener fallback actual para `H`, `A`, `IH` y `TB`.
- Debe seguir validando primero y generando despues.
- No debe mezclar `Personalizadas` y `Genericas`.
- No debe cambiar naming/rutas/claves hasta que cada variante tenga regla confirmada.

`RMC MockupTool`:

- Debe usar el mismo catalogo para resolver mockups/plantillas.
- No debe asumir que toda variante representa un equipo oficial.
- Para `SS`, debe resolver con `family + variant + design_code + size`.

## Huecos a resolver antes de implementar

1. Fuente oficial del `design_code`: Excel, columna `Color`, carpeta, archivo, captura manual o tabla.
2. Si `style_family` debe ser obligatorio o puede quedar global por variante.
3. Como representar aliases: JSON, tabla hija o texto normalizado.
4. Reglas de naming por variante nueva.
5. Reglas de ruta/carpeta por variante nueva.
6. Como manejar historico si un alias cambia.
7. Quien puede editar el catalogo desde `RMC Control Center`.
8. Si la lectura debe cachearse por sesion en los CEP para no bloquear UI.

## Estado inicial de impresion para items nuevos

Pendiente relacionado en `RMCOp-Nike`:

Cuando se genere un item desde flujo manual, `Personalizadas` o `Genericas`, evaluar que el estado inicial visible sea:

```text
Imprimiendo
```

o:

```text
En proceso de impresion
```

Puntos a cuidar:

- No cambiar todavia el significado historico de `Completado` en `rmcop_nike_items`.
- No romper la regla de duplicados: actualmente solo items `Completado` bloquean una clave.
- Definir si este estado vive en `rmcop_nike_items.estado`, en un campo nuevo futuro, o solo en una vista calculada de `RMC Control Center`.
- Si se cambia el estado persistido, revisar como afecta duplicados, metricas y tracking de sublimado.
- Coordinarlo con el futuro estado por area.

## All Star Game y color `TeamA` / `TeamB`

Nueva observacion:

All Star Game puede venir en la columna `Color` como:

```text
TeamA
TeamB
```

Antes podia venir con codigos como:

```text
AAS1
HAS1
```

Esto sugiere que All Star Game debe modelarse como variante/diseno con aliases, no como equipo oficial normal.

Pendientes:

- Confirmar si `TeamA` equivale a Away y `TeamB` a Home, o si son lados/equipos del evento sin relacion directa con `A/H`.
- Confirmar si `AAS1` y `HAS1` siguen vigentes como `design_code`, aliases o nombres de carpeta.
- Confirmar si la variante debe ser `AS`, `SS` con design_code All Star, u otra categoria.
- No activar All Star Game en catalogo productivo sin autorizacion expresa.

Regla provisional:

```text
TeamA/TeamB y AAS1/HAS1 deben tratarse como aliases/datos de diseno hasta confirmar la regla oficial.
```

---

# 12. Prompt base para Codex

Usar este prompt cuando la tarea esté relacionada con variantes Nike, plantillas, rutas, mockups, UI o sincronización de datos.

```text
Trabaja únicamente en el repo actual.

Contexto de negocio:
En Nike existen familias de style como A1000, A2000, Y1000 y Y2000. Las variantes normales H/A pertenecen a equipos oficiales con local/visita. Las variantes IH y TB también pertenecen a equipos oficiales, pero no usan local/visita.

Nueva regla:
SS es una variante/contenedor especial para diseños que pueden no pertenecer a equipos oficiales. Ejemplos actuales: GNB1 = Green Beret Foundation y NYS1 = Navy SEAL Foundation. Por eso A1000SS no identifica por sí solo un diseño único; debe distinguirse con design_code o una equivalencia equivalente.

No rompas la lógica existente de H, A, IH o TB.
No trates SS como equipo.
No mezcles GNB1 y NYS1 solo porque ambos usan A1000SS.
No inventes naming definitivo de PDFs SS; deja TODO claro si hace falta.

Si estás en RMCOp-Nike:
- agrega soporte para parsear/persistir/transportar SS y design_code.
- conserva compatibilidad con styles existentes.

Si estás en RMC MockupTool:
- resuelve plantillas SS usando family + variant + design_code + size.
- permite subcarpetas por diseño dentro de SS.

Si estás en RMC Control Center:
- muestra SS como variante y design_code/design_name como diseño.
- no muestres SS como equipo.
- revisa database-sync.md antes de cambiar sincronización.

Haz cambios mínimos, puntuales y compatibles.
Explica qué archivos tocaste y por qué.
```

---

# 13. Checklist para Codex antes de modificar código

Antes de tocar código, Codex debe responder internamente:

- ¿Estoy en `RMCOp-Nike`, `RMC MockupTool` o `RMC Control Center`?
- ¿La tarea requiere parsear styles, resolver plantillas, mostrar UI o sincronizar datos?
- ¿Existe ya una función que separa `family` y `variant`?
- ¿Existe ya una lista hardcodeada de variantes permitidas?
- ¿Dónde se asume que todos los styles pertenecen a equipos?
- ¿Dónde se debería agregar `design_code` sin romper datos anteriores?
- ¿Hay pruebas, fixtures o ejemplos que deban actualizarse?
- ¿El naming de PDFs está confirmado o debe quedar como TODO?

---

# 14. Casos de prueba mínimos

Codex debe intentar cubrir estos casos si existen tests o fixtures:

```text
A1000H  -> family A1000, variant H, official team sí
A1000A  -> family A1000, variant A, official team sí
A1000IH -> family A1000, variant IH, official team sí
A1000TB -> family A1000, variant TB, official team sí
A1000SS + GNB1 -> family A1000, variant SS, official team no, design Green Beret Foundation
A1000SS + NYS1 -> family A1000, variant SS, official team no, design Navy SEAL Foundation
A2000SS + GNB1 -> family A2000, variant SS, official team no, design Green Beret Foundation
Y1000SS + NYS1 -> family Y1000, variant SS, official team no, design Navy SEAL Foundation
```

---

# 15. No hacer todavía

Codex no debe hacer esto sin instrucción explícita:

- No renombrar carpetas reales de producción.
- No migrar base de datos sin plan/migración clara.
- No borrar lógica de equipos oficiales.
- No reemplazar `H`, `A`, `IH`, `TB` por una lógica nueva incompatible.
- No asumir que `SS` siempre será solo Green Beret.
- No asumir que `SS` siempre será solo Navy SEAL.
- No cerrar el diseño del naming de PDFs si todavía no está definido.

---

# 16. Pendientes por definir

Estos puntos siguen abiertos y deben quedar como TODO si la tarea los toca:

1. Naming final de PDFs para diseños `SS`.
2. Ubicación final de carpetas de plantillas `SS`.
3. Fuente oficial del `design_code`.
4. Si `design_code` vendrá desde Excel, carpeta, nombre de archivo, SQLite, configuración o captura manual.
5. Si `SS` significa formalmente `Special`, `Special Series`, `Service/Special Support` u otro nombre interno.
6. Lista futura de más diseños dentro de `SS`.
7. Tabla final compartida para variantes/disenos Nike.
8. Estado inicial correcto para items recien generados: `Imprimiendo` vs `En proceso de impresion`.
9. Interpretacion oficial de All Star Game: `TeamA`, `TeamB`, `AAS1`, `HAS1`.

---

# 17. Frase clave para recordar

```text
SS es variante/contenedor; GNB1 y NYS1 son diseños dentro de SS.
```
