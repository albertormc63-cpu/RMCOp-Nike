const config = require("./js/config/config");
// Este es el punto de entrada principal de la aplicación. Aquí se importan las funciones necesarias para construir las rutas de los templates y copiar los archivos, y se define la función `main` que ejecuta el proceso completo. La función `main` construye la ruta del template y el nombre del archivo de salida utilizando los parámetros definidos en el objeto `order`, y luego llama a la función `copyTemplate` para realizar la copia del archivo. Si ocurre algún error durante el proceso, se captura y se muestra un mensaje de error en la consola.
const { buildTemplatePath, buildOutputName } = require("./js/utils/pathBuilder");
// Importamos la función `copyTemplate` que se encarga de copiar la plantilla al destino especificado.
const copyTemplate = require("./js/services/copyTemplate");

// Función principal que ejecuta el proceso completo de construcción de rutas y copia de archivos.
async function main() {
    // Obtenemos la configuración actual y las rutas correspondientes basadas en el modo de operación definido en la configuración.
  const currentMode = config.mode;
  const paths = config.paths[currentMode];

    // Definimos un objeto `order` con los parámetros necesarios para construir las rutas y nombres de archivos, como el número de orden, el equipo, la versión, el estilo, el tamaño, el número y la carpeta de demanda.
  const order = {
    wo: "172540",
    team: "Utah",
    version: "Home",
    style: "A1000A",
    size: "SM",
    number: "18",
    demandFolder: "NIKE ON DEMAND 22 MAYO"
  };

  //Construimos la ruta del template y el nombre del archivo de salida utilizando las funciones importadas, pasando los parámetros necesarios desde el objeto `order` y las rutas obtenidas de la configuración.
  const templatePath = buildTemplatePath({
    basePath: paths.templatesBase,
    team: order.team,
    version: order.version,
    style: order.style,
    size: order.size
  });
  // Construimos el nombre del archivo de salida utilizando los parámetros del objeto `order`.
  const outputName = buildOutputName(order);

  // Llamamos a la función `copyTemplate` para copiar la plantilla desde la ruta construida hasta la carpeta de destino, pasando los parámetros necesarios. Si la copia es exitosa, se muestra un mensaje indicando que la plantilla se copió correctamente junto con la ruta del archivo de salida.
  const outputPath = await copyTemplate({
    templatePath,
    ordersBase: paths.ordersBase,
    demandFolder: order.demandFolder,
    outputName
  });
  // Si la copia es exitosa, se muestra un mensaje indicando que la plantilla se copió correctamente junto con la ruta del archivo de salida.
  console.log("Plantilla copiada correctamente:");
  console.log(outputPath);
}

// Ejecutamos la función `main` y capturamos cualquier error que ocurra durante el proceso, mostrando un mensaje de error en la consola.
main().catch(error => {
  console.error("ERROR:");
  console.error(error.message);
});