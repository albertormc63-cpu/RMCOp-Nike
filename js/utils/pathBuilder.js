const fs = require("fs");
const path = require("path");
const teams = require("../data/teams");

// Codigo corto que se agrega al nombre final cuando la variante no es Standard.
const variantCodes = {
  "Indigenous Heritage": "IH"
};

const teamNicknames = {
  masculino: {
    Boston: "Cannons",
    California: "Redwoods",
    Carolina: "Chaos",
    Denver: "Outlaws",
    Maryland: "Whipsnakes",
    "New York": "Atlas",
    Philadelphia: "Waterdogs",
    Utah: "Archers"
  },
  femenino: {
    Boston: "Guard",
    California: "Palms",
    Maryland: "Charm",
    "New York": "Charging"
  }
};

function normalizeStyle(style) {
  return String(style || "").trim().toUpperCase();
}

function getNikeCode(style) {
  // 1000 = PLL, 2000 = WLL segun los styles de Nike Lacrosse.
  const normalizedStyle = normalizeStyle(style);

  if (normalizedStyle.includes("1000")) return "PLL";
  if (normalizedStyle.includes("2000")) return "WLL";
  throw new Error(`No se pudo detectar PLL/WLL desde el style: ${style}`);
}

function getProductConfig(style) {
  // Determina grupo/carpeta de plantilla a partir de A/Y y 1000/2000.
  const normalizedStyle = normalizeStyle(style);
  const audienceCode = normalizedStyle.charAt(0);
  const nikeCode = getNikeCode(normalizedStyle);

  if (nikeCode === "PLL" && audienceCode === "A") {
    return { nikeCode, lineName: "masculino", groupFolder: "NIKE Mens and Youth", productFolder: "MENS" };
  }

  if (nikeCode === "PLL" && audienceCode === "Y") {
    return { nikeCode, lineName: "masculino", groupFolder: "NIKE Mens and Youth", productFolder: "YOUTH" };
  }

  if (nikeCode === "WLL" && audienceCode === "A") {
    return { nikeCode, lineName: "femenino", groupFolder: "NIKE Girls and Ladies", productFolder: "Ladies" };
  }

  if (nikeCode === "WLL" && audienceCode === "Y") {
    return { nikeCode, lineName: "femenino", groupFolder: "NIKE Girls and Ladies", productFolder: "Girls" };
  }

  throw new Error(`No se pudo detectar categoria desde el style: ${style}`);
}

function findExistingPath(candidates) {
  return candidates.find(function (candidatePath) {
    return fs.existsSync(candidatePath);
  });
}

function findCaseInsensitiveChild(parentPath, childName) {
  if (!fs.existsSync(parentPath)) return null;

  const normalizedChildName = childName.toLowerCase();
  const entries = fs.readdirSync(parentPath);
  const match = entries.find(function (entry) {
    return entry.toLowerCase() === normalizedChildName;
  });

  return match ? path.join(parentPath, match) : null;
}

function resolvePathSegments(basePath, segments) {
  // Resuelve carpetas ignorando mayusculas/minusculas para tolerar MENS vs Mens.
  return segments.reduce(function (currentPath, segment) {
    return findCaseInsensitiveChild(currentPath, segment) || path.join(currentPath, segment);
  }, basePath);
}

function getTeamFolderCandidates(team, version) {
  const versionUpper = version.toUpperCase();

  return [
    `${team} ${version}`,
    `${team.toUpperCase()} ${versionUpper}`
  ];
}

function getTemplateFolderCandidates(basePath, productConfig, team, version) {
  const versionFolder = version.toUpperCase();
  const teamFolders = getTeamFolderCandidates(team, version);
  const candidates = [];

  teamFolders.forEach(function (teamFolder) {
    candidates.push(resolvePathSegments(basePath, [
      productConfig.groupFolder,
      productConfig.productFolder,
      versionFolder,
      teamFolder
    ]));
  });

  return candidates;
}

function getCanonicalTemplateName({ teamCode, productConfig, style, size }) {
  // Nuevo nombre objetivo de plantillas: PLL-BOS-A1000A MD.pdf
  return `${productConfig.nikeCode}-${teamCode}-${normalizeStyle(style)} ${size}.pdf`;
}

function findTemplateByStyleAndSize(folderPath, style, size) {
  // Fallback temporal: permite encontrar archivos viejos mientras terminan de renombrarlos.
  if (!fs.existsSync(folderPath)) return null;

  const normalizedStyle = normalizeStyle(style);
  const normalizedSize = String(size || "").trim().toUpperCase();
  const files = fs.readdirSync(folderPath);
  const match = files.find(function (fileName) {
    const normalizedFileName = fileName.toUpperCase();
    return normalizedFileName.endsWith(".PDF") &&
      normalizedFileName.indexOf(normalizedStyle) !== -1 &&
      normalizedFileName.indexOf(` ${normalizedSize}.PDF`) !== -1;
  });

  return match ? path.join(folderPath, match) : null;
}

function buildTemplatePath({ basePath, team, version, style, size }) {
  // Devuelve la plantilla exacta que se copiara para el pedido actual.
  const teamCode = teams[team];
  const productConfig = getProductConfig(style);

  if (!teamCode) {
    throw new Error(`Equipo no registrado: ${team}`);
  }

  const folderCandidates = getTemplateFolderCandidates(basePath, productConfig, team, version);
  const versionPath = resolvePathSegments(basePath, [
    productConfig.groupFolder,
    productConfig.productFolder,
    version.toUpperCase()
  ]);
  const existingFolder = findExistingPath(folderCandidates) ||
    findCaseInsensitiveChild(versionPath, `${team} ${version}`);
  const targetFolder = existingFolder || folderCandidates[0];
  const canonicalName = getCanonicalTemplateName({ teamCode, productConfig, style, size });
  const canonicalPath = path.join(targetFolder, canonicalName);

  if (fs.existsSync(canonicalPath)) {
    return canonicalPath;
  }

  return findTemplateByStyleAndSize(targetFolder, style, size) || canonicalPath;
}

function buildOutputName({ wo, team, variant, style, size, number }) {
  // Nombre de la copia de trabajo dentro de la carpeta On Demand.
  const productConfig = getProductConfig(style);
  const lineNicknames = teamNicknames[productConfig.lineName] || {};
  const nickname = lineNicknames[team] ? ` ${lineNicknames[team]}` : "";
  const variantPart = variant && variant !== "Standard" ? ` ${variantCodes[variant] || variant}` : "";
  const numberPart = number ? ` ${number}` : "";
  return `${wo} ${productConfig.nikeCode}-${team}${nickname}${variantPart} ${normalizeStyle(style)} ${size}${numberPart}.pdf`;
}

module.exports = {
  buildTemplatePath,
  buildOutputName
};
