const fs = require("fs");
const path = require("path");
const teams = require("../data/teams");
const variantRules = require("../config/variantRules");

// Codigo corto que se agrega al nombre final cuando la variante no es Standard.
const variantCodes = {
  "Indigenous Heritage": "IH",
  Throwback: "TB",
  "JR Championship": "JR",
  "JR Champ": "JR",
  "JR Champ Shorts": "JR",
  "All Stars": "AS",
  "Stars & Stripes": "SS"
};

const starsStripesDesigns = {
  GNB1: { templateCode: "GBF", folderName: "GREEN BERET FUNDATION" },
  NYS1: { templateCode: "NSF", folderName: "NAVY SEALS FUNDATION" }
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

const defaultTemplateNumbers = {
  masculino: {
    Boston: "1",
    California: "96",
    Carolina: "0",
    Denver: "42",
    Maryland: "7",
    "New York": "9",
    Philadelphia: "22",
    Utah: "26"
  },
  femenino: {
    Boston: "8",
    California: "12",
    Maryland: "11",
    "New York": "27"
  }
};

function normalizeStyle(style) {
  return String(style || "").trim().toUpperCase();
}

function sanitizeOutputPart(value) {
  return String(value || "")
    .trim()
    .replace(/[\/\\:*?"<>|]/g, "")
    .replace(/\s+/g, " ");
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
  if (variant === "Indigenous Heritage") return "INDIGENOUS HERITAGE";
  if (variant === "Throwback") return "THROWBACK";
  if (variantRules.isJrVariantName(variant)) return "JR CHAMPIONSHIP";
  if (variant === "All Stars") return "ALL STARS";
  if (variant === "Stars & Stripes") return "STARS STRIPES";
  return "STANDARD";
}

function getVariantProductConfig(style, variant) {
  const productConfig = getProductConfig(style);

  if (variant === "Indigenous Heritage") {
    return Object.assign({}, productConfig, {
      groupFolder: productConfig.nikeCode === "PLL" ? "NIKE IH Mens and Youth" : "NIKE IH Girls and Ladies"
    });
  }

  if (variant === "Throwback") {
    return Object.assign({}, productConfig, {
      groupFolder: productConfig.nikeCode === "PLL" ? "NIKE TB Mens and Youth" : "NIKE TB Girls and Ladies"
    });
  }

  if (variantRules.isJrVariantName(variant)) {
    return Object.assign({}, productConfig, {
      groupFolder: productConfig.nikeCode === "PLL" ? "NIKE JR Mens and Youth" : "NIKE JR Girls and Ladies"
    });
  }

  if (variant === "All Stars") {
    return Object.assign({}, productConfig, {
      groupFolder: productConfig.nikeCode === "PLL" ? "NIKE AS Mens and Youth" : "NIKE AS Girls and Ladies"
    });
  }

  if (variant === "Stars & Stripes") {
    return Object.assign({}, productConfig, {
      groupFolder: productConfig.nikeCode === "PLL" ? "NIKE SS Mens and Youth" : "NIKE SS Girls and Ladies"
    });
  }

  return productConfig;
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

function getIhTeamFolderCandidates(basePath, productConfig, team) {
  const ihRoot = resolvePathSegments(basePath, [
    "INDIGENOUS HERITAGE",
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

function findIhTeamFolder(basePath, productConfig, team) {
  const candidates = getIhTeamFolderCandidates(basePath, productConfig, team);
  const existingCandidate = findExistingPath(candidates);

  if (existingCandidate) {
    return existingCandidate;
  }

  const ihProductPath = resolvePathSegments(basePath, [
    "INDIGENOUS HERITAGE",
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
  const targetFolder = existingFolder || folderCandidates[0];
  const canonicalName = getCanonicalTemplateName({ teamCode, productConfig, style, size });
  const canonicalPath = path.join(targetFolder, canonicalName);

  if (fs.existsSync(canonicalPath)) {
    return canonicalPath;
  }

  return findTemplateByStyleAndSize(targetFolder, style, size) || canonicalPath;
}

function buildThrowbackTemplatePath({ basePath, team, style, size }) {
  const productConfig = getVariantProductConfig(style, "Throwback");
  const targetFolder = findVariantTeamFolder(basePath, "Throwback", productConfig, team, "TB");
  const foundTemplate = findTemplateByStyleAndSize(targetFolder, style, size);

  if (foundTemplate) {
    return foundTemplate;
  }

  return path.join(targetFolder, `${productConfig.nikeCode} ${team} TB ${getStyleSearchFamily(style)} ${size}.pdf`);
}

function buildIhTemplatePath({ basePath, team, style, size }) {
  const productConfig = getVariantProductConfig(style, "Indigenous Heritage");
  const targetFolder = findIhTeamFolder(basePath, productConfig, team);
  const foundTemplate = findTemplateByStyleAndSize(targetFolder, style, size);

  if (foundTemplate) {
    return foundTemplate;
  }

  return path.join(targetFolder, `${productConfig.nikeCode}-${team.toUpperCase()} IH ${getStyleSearchFamily(style)} ${size}.pdf`);
}

function buildAllStarsTemplatePath({ basePath, version, style, size }) {
  const productConfig = getVariantProductConfig(style, "All Stars");
  const versionFolder = String(version || "Home").toUpperCase();
  const targetFolder = resolvePathSegments(basePath, [
    "ALL STARS",
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

function getJrTeamFolderCandidates(basePath, productConfig, team) {
  const jrProductPath = resolvePathSegments(basePath, [
    "JR CHAMPIONSHIP",
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

function findJrTeamFolder(basePath, productConfig, team) {
  const candidates = getJrTeamFolderCandidates(basePath, productConfig, team);
  const existingCandidate = findExistingPath(candidates);

  if (existingCandidate) {
    return existingCandidate;
  }

  const jrProductPath = resolvePathSegments(basePath, [
    "JR CHAMPIONSHIP",
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

function buildJrTemplatePath({ basePath, team, style, size }) {
  const productConfig = getVariantProductConfig(style, "JR Championship");
  const targetFolder = findJrTeamFolder(basePath, productConfig, team);
  const canonicalName = `${productConfig.nikeCode} ${team} ${normalizeStyle(style)} ${size}.pdf`;
  const canonicalPath = path.join(targetFolder, canonicalName);

  if (fs.existsSync(canonicalPath)) {
    return canonicalPath;
  }

  return findTemplateByExactStyleAndSize(targetFolder, style, size) || canonicalPath;
}

function buildStarsStripesTemplatePath({ basePath, designCode, style, size }) {
  const normalizedDesignCode = String(designCode || "").trim().toUpperCase();
  const design = starsStripesDesigns[normalizedDesignCode];

  if (!design) {
    throw new Error(`Stars & Stripes requiere design_code valido: ${designCode || "(vacio)"}`);
  }

  const productConfig = getVariantProductConfig(style, "Stars & Stripes");
  const targetFolder = resolvePathSegments(basePath, [
    "STARS STRIPES",
    productConfig.groupFolder,
    productConfig.productFolder,
    design.folderName
  ]);

  return path.join(targetFolder, `${productConfig.nikeCode} ${design.templateCode} SS ${getStyleSearchFamily(style)} ${size}.pdf`);
}

function buildTemplatePath({ basePath, team, variant, version, style, size, designCode }) {
  // Devuelve la plantilla exacta que se copiara para el pedido actual.
  if (variantRules.isJrVariantName(variant)) {
    return buildJrTemplatePath({ basePath, team, style, size });
  }

  if (variant === "All Stars") {
    return buildAllStarsTemplatePath({ basePath, version, style, size });
  }

  if (variant === "Stars & Stripes") {
    return buildStarsStripesTemplatePath({ basePath, designCode, style, size });
  }

  if (variant === "Indigenous Heritage") {
    return buildIhTemplatePath({ basePath, team, style, size });
  }

  if (variant === "Throwback") {
    return buildThrowbackTemplatePath({ basePath, team, style, size });
  }

  const teamCode = teams[team];

  if (!teamCode) {
    throw new Error(`Equipo no registrado: ${team}`);
  }

  return buildTextTemplatePath({ basePath, team, variant, version, style, size, teamCode });
}

function buildStarsStripesOutputName({ wo, designCode, style, size, number, name }) {
  const orderIdentifier = sanitizeOutputPart(number || name || "SIN_DATOS");
  const identifierPart = orderIdentifier ? ` ${orderIdentifier}` : "";
  const normalizedDesignCode = sanitizeOutputPart(String(designCode || "").trim().toUpperCase());

  if (!normalizedDesignCode) {
    throw new Error("Stars & Stripes requiere design_code para nombrar el PDF.");
  }

  return `${wo} ${normalizedDesignCode} ${normalizeStyle(style)} ${size}${identifierPart}.pdf`;
}

function buildAllStarsOutputName({ wo, variant, version, style, size, number, name }) {
  const productConfig = getProductConfig(style);
  const variantCode = variantCodes[variant] || "AS";
  const orderIdentifier = sanitizeOutputPart(number || name || "SIN_DATOS");
  const identifierPart = orderIdentifier ? ` ${orderIdentifier}` : "";
  const versionPart = sanitizeOutputPart(version || "Home").toUpperCase();

  return `${wo} ${productConfig.nikeCode}-All Stars ${versionPart} ${normalizeStyle(style)}${variantCode && normalizeStyle(style).indexOf(variantCode) === -1 ? variantCode : ""} ${size}${identifierPart}.pdf`;
}

function buildOutputName({ wo, team, variant, version, style, size, number, name, designCode }) {
  // Nombre de la copia de trabajo dentro de la carpeta On Demand.
  if (variant === "Stars & Stripes") {
    return buildStarsStripesOutputName({ wo, designCode, style, size, number, name });
  }

  if (variant === "All Stars") {
    return buildAllStarsOutputName({ wo, variant, version, style, size, number, name });
  }

  const productConfig = getProductConfig(style);
  const lineNicknames = teamNicknames[productConfig.lineName] || {};
  const lineDefaultNumbers = defaultTemplateNumbers[productConfig.lineName] || {};
  const nickname = lineNicknames[team] ? ` ${lineNicknames[team]}` : "";
  const variantCode = variant && variant !== "Standard" ? (variantCodes[variant] || variant) : "";
  const normalizedStyle = normalizeStyle(style);
  const stylePart = variantCode && normalizedStyle.indexOf(variantCode) === -1 ? `${normalizedStyle}${variantCode}` : normalizedStyle;
  const orderIdentifier = sanitizeOutputPart(number || name || "SIN_DATOS");
  const identifierPart = orderIdentifier ? ` ${orderIdentifier}` : "";
  return `${wo} ${productConfig.nikeCode}-${team}${nickname} ${stylePart} ${size}${identifierPart}.pdf`;
}

module.exports = {
  buildTemplatePath,
  buildOutputName
};
