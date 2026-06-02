const path = require("path");
// Copia una plantilla PDF al destino final. Puede hacer dryRun para detectar reemplazos.
const fs = require("fs-extra");

async function copyTemplate({ templatePath, ordersBase, demandFolder, destinationFolder, outputName, dryRun }) {

  // Ruta final de la copia que abrira Illustrator.
  const finalDestinationFolder = normalizeFileUrlPath(destinationFolder) || path.join(ordersBase, demandFolder);
  const outputPath = path.join(finalDestinationFolder, outputName);

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
  await fs.ensureDir(finalDestinationFolder);
  await fs.copy(templatePath, outputPath, { overwrite: true });

  return {
    outputPath,
    replaced: willReplace
  };
}

function normalizeFileUrlPath(folderPath) {
  const value = String(folderPath || "").trim();

  if (value.indexOf("file://") !== 0) {
    return value;
  }

  try {
    return decodeURIComponent(value.replace(/^file:\/\//, ""));
  } catch (error) {
    return value.replace(/^file:\/\//, "");
  }
}

// Exportamos la función `copyTemplate` para que pueda ser utilizada en otros módulos.
module.exports = copyTemplate;
