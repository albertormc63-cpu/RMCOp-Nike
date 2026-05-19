# RMCOp-Nike
Version de RMC Optmizador para Nike

Panel CEP para Adobe Illustrator enfocado en automatizar pedidos Nike On Demand.

Objetivo

Automatizar el flujo de trabajo de pedidos personalizados Nike:

Selección de plantilla Nike
Copia automática de PDFs
Renombrado de archivos según formato interno
Apertura automática en Illustrator
Reemplazo de nombres y números mediante ExtendScript
Integración visual dentro de Illustrator mediante CEP
Tecnologías
HTML
CSS
JavaScript
Node.js
CEP (Common Extensibility Platform)
ExtendScript (.jsx)
Adobe Illustrator
Estructura del proyecto
RMC-Op-Nike/
│
├── CSXS/
│   └── manifest.xml
│
├── client/
│   ├── index.html
│   ├── css/
│   └── js/
│
├── jsx/
│
├── temp/
│
├── previews/
│
└── README.md
Flujo del sistema
CEP Panel
    ↓
Captura de datos del pedido
    ↓
Node.js localiza plantilla Nike
    ↓
Se crea copia en carpeta ON DEMAND
    ↓
Se genera archivo temporal .jsxinc
    ↓
Illustrator ejecuta JSX
    ↓
Se reemplazan nombres y números
Formato de plantillas Nike

Ejemplo:

5LM-PLL-BOS-A-ALD LG.pdf
Significado
Código	Descripción
5LM	Sin uso actual
PLL	Hombre / Niño
WLL	Mujer / Niña
BOS	Boston
CAR	Carolina
A	Away
H	Home
ALD	Sin uso actual
LG	Talla
Formato de salida

Ejemplo:

172539 PLL-Boston A1000A LG 7.pdf
Significado
Valor	Descripción
172539	Work Order
PLL	Categoría Nike
Boston	Equipo
A1000A	Style
LG	Talla
7	Número
Rutas locales de desarrollo
Plantillas
/Users/rmlsub1/Documents/pruebas/Nike Lacrosse/Mens
Carpeta de salida
/Users/rmlsub1/Documents/pruebas/TO PRINT/NIKE ORDERS
Rutas de producción
Plantillas
/Volumes/Fullsize/Nike Lacrosse/Mens
Carpeta de salida
/Volumes/Fullsize/TO PRINT/NIKE ORDERS
Comunicación Node ↔ Illustrator

Node.js NO modifica Illustrator directamente.

La comunicación se realiza mediante:

temp/orderData.jsxinc

Ejemplo:

var ORDER_DATA = {
  wo: "172539",
  team: "Boston",
  style: "A1000A",
  size: "LG",
  number: "7",
  name: "MARTINEZ"
};

El archivo es leído desde ExtendScript (.jsx).

Objetivos actuales
 Copia automática de plantillas
 Validación de rutas
 Renombrado automático
 Integración CEP
 Apertura automática en Illustrator
 Reemplazo de textos
 Interfaz visual de equipos
 Automatización masiva
Notas importantes
El proyecto está optimizado para macOS.
Illustrator utiliza ExtendScript (.jsx).
CEP permite usar HTML/CSS/JS dentro de Illustrator.
El proyecto trabaja primero en entorno local antes de producción.
