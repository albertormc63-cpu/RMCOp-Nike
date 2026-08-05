const fs = require("fs");
const path = require("path");
const teams = require("../data/teams");
const variantRules = require("../config/variantRules");
const pathVariantRules = require("../config/pathVariantRules");

function normalizeStyle(style) {
  return String(style || "").trim().toUpperCase();
}

function sanitizeOutputPart(value) {
  return String(value || "")
    .trim()
    .replace(/[\/\\:*?"<>|]/g, "")
    .replace(/\s+/g, " ");
}

function buildOutputIdentifierPart({ style, number, name }) {
  // Si hay numero se usa como identificador principal; si no, usa nombre.
  // Los shorts/1500 sin datos no agregan SIN_DATOS por regla operativa.
  const rawIdentifier = number || name;

  if (!rawIdentifier && variantRules.getBaseStyleCode(style) === "1500") {
    return "";
  }

  const orderIdentifier = sanitizeOutputPart(rawIdentifier || "SIN_DATOS");
  return orderIdentifier ? ` ${orderIdentifier}` : "";
}

function getStyleSearchFamily(style) {
  // A1000H/A1000A/A1000IH/A1000TB buscan reglas/plantillas como familia A1000.
  return variantRules.stripVariantSuffix(style);
}

function getNikeCode(style) {
  // 1000/1500 = PLL, 2000 = WLL segun los styles de Nike Lacrosse.
  const normalizedStyle = normalizeStyle(style);

  if (normalizedStyle.includes("1000") || normalizedStyle.includes("1500")) return "PLL";
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

function getVariantRootFolder(variant) {
  return pathVariantRules.getVariantRootFolder(variant);
}

function getVariantProductConfig(style, variant) {
  // Cada variante cambia el grupo raiz dentro de plantillas Nike. El producto
  // MENS/YOUTH/Ladies/Girls se conserva desde el style.
  const productConfig = getProductConfig(style);

  return Object.assign({}, productConfig, {
    groupFolder: pathVariantRules.getVariantGroupFolder(variant, productConfig.nikeCode, productConfig.groupFolder)
  });
}

function findExistingPath(candidates) {
  return candidates.find(function (candidatePath) {
    return fs.existsSync(candidatePath);
  });
}

function findCaseInsensitiveChild(parentPath, childName) {
  // El volumen trae carpetas con mayusculas inconsistentes. Esta busqueda
  // mantiene rutas tolerantes sin renombrar archivos reales.
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

function getIhTeamFolderCandidates(basePath, variant, productConfig, team) {
  const ihRoot = resolvePathSegments(basePath, [
    getVariantRootFolder(variant),
    productConfig.groupFolder,
    productConfig.productFolder
  ]);

  return [
    path.join(ihRoot, `${team.toUpperCase()} IH`),
    path.join(ihRoot, `${team} IH`)
  ];
}

function getVariantTeamFolderCandidates(basePath, variant, productConfig, team, variantCode) {
  const variantRoot = resolvePathSegments(basePath, [
    getVariantRootFolder(variant),
    productConfig.groupFolder,
    productConfig.productFolder
  ]);

  return [
    path.join(variantRoot, `${team.toUpperCase()} ${variantCode}`),
    path.join(variantRoot, `${team} ${variantCode}`)
  ];
}

function getCanonicalTemplateName({ teamCode, productConfig, style, size }) {
  // Nuevo nombre objetivo de plantillas: PLL-BOS-A1000A MD.pdf
  return `${productConfig.nikeCode}-${teamCode}-${normalizeStyle(style)} ${size}.pdf`;
}

function getStandardTemplateName({ productConfig, team, style, size }) {
  if (variantRules.getBaseStyleCode(style) === "1500") {
    return `${productConfig.nikeCode} ${team.toUpperCase()} ${normalizeStyle(style)} ${size}.pdf`;
  }

  return "";
}

function getSizeAliases(size) {
  const normalizedSize = String(size || "").trim().toUpperCase();
  const aliases = {
    SM: ["SM", "SML"],
    SML: ["SM", "SML"],
    MD: ["MD", "MED"],
    MED: ["MD", "MED"],
    LG: ["LG", "LGE"],
    LGE: ["LG", "LGE"],
    XL: ["XL", "XLG"],
    XLG: ["XL", "XLG"],
    "2X": ["2X", "2XL"],
    "2XL": ["2X", "2XL"],
    "3X": ["3X", "3XL"],
    "3XL": ["3X", "3XL"]
  };

  return aliases[normalizedSize] || [normalizedSize];
}

function findTemplateByStyleAndSize(folderPath, style, size) {
  // Fallback temporal: permite encontrar archivos viejos mientras terminan de renombrarlos.
  if (!fs.existsSync(folderPath)) return null;

  const normalizedStyle = normalizeStyle(style);
  const styleFamily = getStyleSearchFamily(normalizedStyle);
  const sizeAliases = getSizeAliases(size);
  const files = fs.readdirSync(folderPath);
  const match = files.find(function (fileName) {
    const normalizedFileName = fileName.toUpperCase();
    const hasSize = sizeAliases.some(function (sizeAlias) {
      return normalizedFileName.indexOf(` ${sizeAlias}.PDF`) !== -1 ||
        normalizedFileName.indexOf(` ${sizeAlias} `) !== -1;
    });

    return normalizedFileName.endsWith(".PDF") &&
      (normalizedFileName.indexOf(normalizedStyle) !== -1 || normalizedFileName.indexOf(styleFamily) !== -1) &&
      hasSize;
  });

  return match ? path.join(folderPath, match) : null;
}

function findIhTeamFolder(basePath, variant, productConfig, team) {
  const candidates = getIhTeamFolderCandidates(basePath, variant, productConfig, team);
  const existingCandidate = findExistingPath(candidates);

  if (existingCandidate) {
    return existingCandidate;
  }

  const ihProductPath = resolvePathSegments(basePath, [
    getVariantRootFolder(variant),
    productConfig.groupFolder,
    productConfig.productFolder
  ]);

  if (!fs.existsSync(ihProductPath)) {
    return candidates[0];
  }

  const teamWords = team.toUpperCase().split(/\s+/);
  const entries = fs.readdirSync(ihProductPath);
  const match = entries.find(function (entryName) {
    const normalizedEntry = entryName.toUpperCase();
    return teamWords.every(function (word) { return normalizedEntry.indexOf(word) !== -1; }) &&
      normalizedEntry.indexOf("IH") !== -1;
  });

  return match ? path.join(ihProductPath, match) : candidates[0];
}

function findVariantTeamFolder(basePath, variant, productConfig, team, variantCode) {
  const candidates = getVariantTeamFolderCandidates(basePath, variant, productConfig, team, variantCode);
  const existingCandidate = findExistingPath(candidates);

  if (existingCandidate) {
    return existingCandidate;
  }

  const variantProductPath = resolvePathSegments(basePath, [
    getVariantRootFolder(variant),
    productConfig.groupFolder,
    productConfig.productFolder
  ]);

  if (!fs.existsSync(variantProductPath)) {
    return candidates[0];
  }

  const teamWords = team.toUpperCase().split(/\s+/);
  const entries = fs.readdirSync(variantProductPath);
  const match = entries.find(function (entryName) {
    const normalizedEntry = entryName.toUpperCase();
    return teamWords.every(function (word) { return normalizedEntry.indexOf(word) !== -1; }) &&
      normalizedEntry.indexOf(variantCode) !== -1;
  });

  return match ? path.join(variantProductPath, match) : candidates[0];
}

function buildTextTemplatePath({ basePath, team, variant, version, style, size, teamCode }) {
  // Standard busca un PDF editable por Home/Away y reemplaza textos.
  const productConfig = getVariantProductConfig(style, variant);
  const variantBasePath = resolvePathSegments(basePath, [getVariantRootFolder(variant)]);
  const folderCandidates = getTemplateFolderCandidates(variantBasePath, productConfig, team, version);
  const versionPath = resolvePathSegments(variantBasePath, [
    productConfig.groupFolder,
    productConfig.productFolder,
    version.toUpperCase()
  ]);
  const existingFolder = findExistingPath(folderCandidates) ||
    findCaseInsensitiveChild(versionPath, `${team} ${version}`);
  const teamFolder = existingFolder || folderCandidates[0];
  const styleFamily = getStyleSearchFamily(style);
  const targetFolder = variantRules.getBaseStyleCode(style) === "1500"
    ? (findCaseInsensitiveChild(teamFolder, styleFamily) || path.join(teamFolder, styleFamily))
    : teamFolder;
  const standardTemplateName = getStandardTemplateName({ productConfig, team, style, size });
  const canonicalName = standardTemplateName || getCanonicalTemplateName({ teamCode, productConfig, style, size });
  const canonicalPath = path.join(targetFolder, canonicalName);

  if (fs.existsSync(canonicalPath)) {
    return canonicalPath;
  }

  return findTemplateByStyleAndSize(targetFolder, style, size) || canonicalPath;
}

function buildThrowbackTemplatePath({ basePath, team, variant, style, size }) {
  const productConfig = getVariantProductConfig(style, variant);
  const targetFolder = findVariantTeamFolder(basePath, variant, productConfig, team, pathVariantRules.getOutputVariantCode(variant));
  const foundTemplate = findTemplateByStyleAndSize(targetFolder, style, size);

  if (foundTemplate) {
    return foundTemplate;
  }

  return path.join(targetFolder, `${productConfig.nikeCode} ${team} TB ${getStyleSearchFamily(style)} ${size}.pdf`);
}

function buildIhTemplatePath({ basePath, team, variant, style, size }) {
  // IH no usa Home/Away; busca equipo directo bajo INDIGENOUS HERITAGE y
  // tolera carpetas historicas con nombres cercanos.
  const productConfig = getVariantProductConfig(style, variant);
  const targetFolder = findIhTeamFolder(basePath, variant, productConfig, team);
  const foundTemplate = findTemplateByStyleAndSize(targetFolder, style, size);

  if (foundTemplate) {
    return foundTemplate;
  }

  return path.join(targetFolder, `${productConfig.nikeCode}-${team.toUpperCase()} IH ${getStyleSearchFamily(style)} ${size}.pdf`);
}

function buildAllStarsTemplatePath({ basePath, variant, version, style, size }) {
  const productConfig = getVariantProductConfig(style, variant);
  const versionFolder = String(version || "Home").toUpperCase();
  const targetFolder = resolvePathSegments(basePath, [
    getVariantRootFolder(variant),
    productConfig.groupFolder,
    productConfig.productFolder,
    versionFolder
  ]);

  return path.join(targetFolder, `${productConfig.nikeCode} ALL STAR ${versionFolder} AS ${getStyleSearchFamily(style)} ${size}.pdf`);
}

function findTemplateByExactStyleAndSize(folderPath, style, size) {
  if (!fs.existsSync(folderPath)) return null;

  const normalizedStyle = normalizeStyle(style);
  const sizeAliases = getSizeAliases(size);
  const files = fs.readdirSync(folderPath);
  const match = files.find(function (fileName) {
    const normalizedFileName = fileName.toUpperCase();
    const hasSize = sizeAliases.some(function (sizeAlias) {
      return normalizedFileName.indexOf(` ${sizeAlias}.PDF`) !== -1 ||
        normalizedFileName.indexOf(` ${sizeAlias} `) !== -1;
    });

    return normalizedFileName.endsWith(".PDF") &&
      normalizedFileName.indexOf(normalizedStyle) !== -1 &&
      hasSize;
  });

  return match ? path.join(folderPath, match) : null;
}

function getJrTeamFolderCandidates(basePath, variant, productConfig, team) {
  const jrProductPath = resolvePathSegments(basePath, [
    getVariantRootFolder(variant),
    productConfig.groupFolder,
    productConfig.productFolder
  ]);

  return [
    path.join(jrProductPath, `${team} JR`),
    path.join(jrProductPath, `${team.toUpperCase()} JR`),
    path.join(jrProductPath, `${team} Home`),
    path.join(jrProductPath, `${team.toUpperCase()} HOME`)
  ];
}

function findJrTeamFolder(basePath, variant, productConfig, team) {
  const candidates = getJrTeamFolderCandidates(basePath, variant, productConfig, team);
  const existingCandidate = findExistingPath(candidates);

  if (existingCandidate) {
    return existingCandidate;
  }

  const jrProductPath = resolvePathSegments(basePath, [
    getVariantRootFolder(variant),
    productConfig.groupFolder,
    productConfig.productFolder
  ]);

  if (!fs.existsSync(jrProductPath)) {
    return candidates[0];
  }

  const teamWords = team.toUpperCase().split(/\s+/);
  const entries = fs.readdirSync(jrProductPath);
  const match = entries.find(function (entryName) {
    const normalizedEntry = entryName.toUpperCase();
    return teamWords.every(function (word) { return normalizedEntry.indexOf(word) !== -1; }) &&
      (normalizedEntry.indexOf("JR") !== -1 || normalizedEntry.indexOf("HOME") !== -1);
  });

  return match ? path.join(jrProductPath, match) : candidates[0];
}

function buildJrTemplatePath({ basePath, team, variant, style, size }) {
  const productConfig = getVariantProductConfig(style, variant);
  const teamFolder = findJrTeamFolder(basePath, variant, productConfig, team);
  const styleFamily = getStyleSearchFamily(style);
  // Los shorts JR 1500 viven dentro de una subcarpeta por audiencia:
  // A1500 para adulto y Y1500 para youth. Los jerseys 1000 siguen en la raiz del equipo.
  const targetFolder = variantRules.getBaseStyleCode(style) === "1500"
    ? (findCaseInsensitiveChild(teamFolder, styleFamily) || path.join(teamFolder, styleFamily))
    : teamFolder;
  const canonicalName = `${productConfig.nikeCode} ${team} ${normalizeStyle(style)} ${size}.pdf`;
  const canonicalPath = path.join(targetFolder, canonicalName);

  if (fs.existsSync(canonicalPath)) {
    return canonicalPath;
  }

  return findTemplateByExactStyleAndSize(targetFolder, style, size) || canonicalPath;
}

function buildStarsStripesTemplatePath({ basePath, variant, designCode, style, size }) {
  // SS usa designCode para escoger subcarpeta y codigo de plantilla. Los
  // placeholders de texto SS vienen de la reserva local, no de este archivo.
  const normalizedDesignCode = String(designCode || "").trim().toUpperCase();
  const design = pathVariantRules.getStarsStripesDesign(normalizedDesignCode, style);

  if (!design) {
    throw new Error(`Stars & Stripes requiere design_code valido: ${designCode || "(vacio)"}`);
  }

  const productConfig = getVariantProductConfig(style, variant);
  const targetFolder = resolvePathSegments(basePath, [
    getVariantRootFolder(variant),
    productConfig.groupFolder,
    productConfig.productFolder,
    design.folderName
  ]);

  return path.join(targetFolder, `${productConfig.nikeCode} ${design.templateCode} SS ${getStyleSearchFamily(style)} ${size}.pdf`);
}

const templateBuilders = {
  jr: buildJrTemplatePath,
  "all-stars": buildAllStarsTemplatePath,
  "stars-stripes": buildStarsStripesTemplatePath,
  ih: buildIhTemplatePath,
  throwback: buildThrowbackTemplatePath,
  text: buildTextTemplatePath
};

function buildTemplatePath({ basePath, team, variant, version, style, size, designCode }) {
  // Devuelve la plantilla exacta que se copiara para el pedido actual.
  // La variante decide estrategia en pathVariantRules; aqui solo se ejecuta.
  const strategy = pathVariantRules.getTemplateStrategy(variant);
  const builder = templateBuilders[strategy] || templateBuilders.text;
  const teamCode = teams[team];

  if (builder === buildTextTemplatePath && !teamCode) {
    throw new Error(`Equipo no registrado: ${team}`);
  }

  return builder({ basePath, team, variant, version, style, size, designCode, teamCode });
}

function buildStarsStripesOutputName({ wo, designCode, style, size, number, name }) {
  const identifierPart = buildOutputIdentifierPart({ style, number, name });
  const normalizedDesignCode = sanitizeOutputPart(String(designCode || "").trim().toUpperCase());

  if (!normalizedDesignCode) {
    throw new Error("Stars & Stripes requiere design_code para nombrar el PDF.");
  }

  return `${wo} ${normalizedDesignCode} ${normalizeStyle(style)} ${size}${identifierPart}.pdf`;
}

function buildAllStarsOutputName({ wo, variant, version, style, size, number, name }) {
  const productConfig = getProductConfig(style);
  const variantCode = pathVariantRules.getOutputVariantCode(variant) || "AS";
  const identifierPart = buildOutputIdentifierPart({ style, number, name });
  const versionPart = sanitizeOutputPart(version || "Home").toUpperCase();

  return `${wo} ${productConfig.nikeCode}-All Stars ${versionPart} ${normalizeStyle(style)}${variantCode && normalizeStyle(style).indexOf(variantCode) === -1 ? variantCode : ""} ${size}${identifierPart}.pdf`;
}

function buildTeamOutputName({ wo, team, variant, version, style, size, number, name }) {
  const productConfig = getProductConfig(style);
  const teamMascot = pathVariantRules.getTeamMascot({ team, variant, version, style });
  const nickname = teamMascot ? ` ${teamMascot}` : "";
  const variantCode = pathVariantRules.getOutputVariantCode(variant);
  const normalizedStyle = normalizeStyle(style);
  const stylePart = variantCode && normalizedStyle.indexOf(variantCode) === -1 ? `${normalizedStyle}${variantCode}` : normalizedStyle;
  const identifierPart = buildOutputIdentifierPart({ style, number, name });
  return `${wo} ${productConfig.nikeCode}-${team}${nickname} ${stylePart} ${size}${identifierPart}.pdf`;
}

const outputNameBuilders = {
  "stars-stripes": buildStarsStripesOutputName,
  "all-stars": buildAllStarsOutputName,
  team: buildTeamOutputName
};

function buildOutputName({ wo, team, variant, version, style, size, number, name, designCode }) {
  // Nombre de la copia de trabajo dentro de la carpeta On Demand.
  // Debe mantenerse alineado con la validacion incremental para que path
  // esperado y archivo final sean el mismo.
  const strategy = pathVariantRules.getOutputStrategy(variant);
  const builder = outputNameBuilders[strategy] || outputNameBuilders.team;

  return builder({ wo, team, variant, version, style, size, number, name, designCode });
}

module.exports = {
  buildTemplatePath,
  buildOutputName
};
