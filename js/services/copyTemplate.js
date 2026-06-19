const path = require("path");
// Copia una plantilla PDF al destino final. Puede hacer dryRun para detectar reemplazos.
const fs = require("fs-extra");

async function copyTemplate({ templatePath, ordersBase, demandFolder, destinationFolder, outputName, number, name, dryRun, strictOutputName }) {

  // Ruta final de la copia que abrira Illustrator.
  const finalDestinationFolder = normalizeFileUrlPath(destinationFolder) || path.join(ordersBase, demandFolder);

  // Fallamos temprano si la plantilla no existe; evita crear copias vacias o confusas.
  const exists = await fs.pathExists(templatePath);
  if (!exists) {
    throw new Error(`No existe la plantilla:\n${templatePath}`);
  }

  const destination = strictOutputName ? {
    outputPath: path.join(finalDestinationFolder, outputName),
    outputName,
    replaced: false
  } : await resolveOutputDestination(finalDestinationFolder, outputName, { number, name });

  if (strictOutputName && await fs.pathExists(destination.outputPath)) {
    throw new Error(`El archivo ya existe y batch no creara un duplicado:\n${destination.outputPath}`);
  }

  if (dryRun) {
    return {
      outputPath: destination.outputPath,
      outputName: destination.outputName,
      replaced: destination.replaced
    };
  }

  // Normalmente copiamos a un nombre unico; overwrite queda como defensa si el usuario confirmo reemplazo.
  await fs.ensureDir(finalDestinationFolder);
  await fs.copy(templatePath, destination.outputPath, strictOutputName
    ? { overwrite: false, errorOnExist: true }
    : { overwrite: true });

  return {
    outputPath: destination.outputPath,
    outputName: destination.outputName,
    replaced: destination.replaced
  };
}

async function resolveOutputDestination(destinationFolder, outputName, orderData) {
  // Regla tipo RMC Optimizador: numero manda; nombre solo desempata si el archivo ya existe.
  let candidateName = outputName;
  let outputPath = path.join(destinationFolder, candidateName);
  const originalExists = await fs.pathExists(outputPath);

  if (!originalExists) {
    return {
      outputPath,
      outputName: candidateName,
      replaced: false
    };
  }

  const extension = path.extname(outputName) || ".pdf";
  const baseName = outputName.replace(new RegExp(`${escapeRegExp(extension)}$`, "i"), "");
  const safeName = sanitizeFilePart(orderData && orderData.name);
  const safeNumber = sanitizeFilePart(orderData && orderData.number);

  if (safeNumber && safeName) {
    candidateName = `${baseName} ${safeName}${extension}`;
  } else {
    candidateName = `${baseName} DUP${extension}`;
  }

  outputPath = path.join(destinationFolder, candidateName);

  if (!await fs.pathExists(outputPath)) {
    return {
      outputPath,
      outputName: candidateName,
      replaced: false
    };
  }

  const duplicateBaseName = candidateName.replace(new RegExp(`${escapeRegExp(extension)}$`, "i"), "");
  let counter = 1;

  do {
    candidateName = `${duplicateBaseName} (${counter})${extension}`;
    outputPath = path.join(destinationFolder, candidateName);
    counter++;
  } while (await fs.pathExists(outputPath));

  return {
    outputPath,
    outputName: candidateName,
    replaced: false
  };
}

function sanitizeFilePart(value) {
  return String(value || "")
    .trim()
    .replace(/[\/\\:*?"<>|]/g, "")
    .replace(/\s+/g, " ");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
