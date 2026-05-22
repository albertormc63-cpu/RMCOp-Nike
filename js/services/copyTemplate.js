const path = require("path");
// Copia una plantilla PDF al folder On Demand. Tambien puede hacer dryRun para detectar reemplazos.
const fs = require("fs-extra");

async function copyTemplate({ templatePath, ordersBase, demandFolder, outputName, dryRun }) {

  // Ruta final de la copia que abrira Illustrator.
  const destinationFolder = path.join(ordersBase, demandFolder);
  const outputPath = path.join(destinationFolder, outputName);

  // Fallamos temprano si la plantilla no existe; evita crear copias vacias o confusas.
  const exists = await fs.pathExists(templatePath);
  if (!exists) {
    throw new Error(`No existe la plantilla:\n${templatePath}`);
  }
  const willReplace = await fs.pathExists(outputPath);

  if (dryRun) {
    return {
      outputPath,
      replaced: willReplace
    };
  }

  // overwrite:true permite regenerar una copia limpia si el usuario confirma reemplazo.
  await fs.ensureDir(destinationFolder);
  await fs.copy(templatePath, outputPath, { overwrite: true });

  return {
    outputPath,
    replaced: willReplace
  };
}

// Exportamos la función `copyTemplate` para que pueda ser utilizada en otros módulos.
module.exports = copyTemplate;
