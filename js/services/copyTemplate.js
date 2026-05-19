const path = require("path");
// Este módulo se encarga de copiar la plantilla desde la ruta construida hasta la carpeta de destino, asegurándose de que la plantilla exista y que el directorio de destino esté creado. Utiliza la función `fs.copy` para realizar la copia del archivo, y maneja errores en caso de que la plantilla no exista o si ocurre algún problema durante la copia.
const fs = require("fs-extra");

// Función principal que realiza la copia de la plantilla al destino especificado, verificando la existencia de la plantilla y asegurando que el directorio de destino esté creado.
async function copyTemplate({ templatePath, ordersBase, demandFolder, outputName }) {

    // Construimos la ruta completa del archivo de salida combinando la base de órdenes, la carpeta de demanda y el nombre del archivo de salida.
  const destinationFolder = path.join(ordersBase, demandFolder);
  const outputPath = path.join(destinationFolder, outputName);

  // Verificamos si la plantilla existe en la ruta especificada. Si no existe, lanzamos un error indicando que la plantilla no se encontró.
  const exists = await fs.pathExists(templatePath);
  // Si la plantilla no existe, lanzamos un error indicando que la plantilla no se encontró.
  if (!exists) {
    throw new Error(`No existe la plantilla:\n${templatePath}`);
  }
  // Aseguramos que el directorio de destino exista, y luego copiamos la plantilla al destino especificado sin sobrescribir archivos existentes.
  await fs.ensureDir(destinationFolder);
  await fs.copy(templatePath, outputPath, { overwrite: false });

  return outputPath;
}

// Exportamos la función `copyTemplate` para que pueda ser utilizada en otros módulos.
module.exports = copyTemplate;