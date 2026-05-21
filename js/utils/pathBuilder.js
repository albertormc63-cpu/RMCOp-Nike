const fs = require("fs");
const path = require("path");
const teams = require("../data/teams");

function normalizeStyle(style) {
  return String(style || "").trim().toUpperCase();
}

function getNikeCode(style) {
  const normalizedStyle = normalizeStyle(style);

  if (normalizedStyle.includes("1000")) return "PLL";
  if (normalizedStyle.includes("2000")) return "WLL";
  throw new Error(`No se pudo detectar PLL/WLL desde el style: ${style}`);
}

function getProductConfig(style) {
  const normalizedStyle = normalizeStyle(style);
  const audienceCode = normalizedStyle.charAt(0);
  const nikeCode = getNikeCode(normalizedStyle);

  if (nikeCode === "PLL" && audienceCode === "A") {
    return { nikeCode, groupFolder: "NIKE Mens and Youth", productFolder: "MENS" };
  }

  if (nikeCode === "PLL" && audienceCode === "Y") {
    return { nikeCode, groupFolder: "NIKE Mens and Youth", productFolder: "YOUTH" };
  }

  if (nikeCode === "WLL" && audienceCode === "A") {
    return { nikeCode, groupFolder: "NIKE Girls and Ladies", productFolder: "Ladies" };
  }

  if (nikeCode === "WLL" && audienceCode === "Y") {
    return { nikeCode, groupFolder: "NIKE Girls and Ladies", productFolder: "Girls" };
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
  return `${productConfig.nikeCode}-${teamCode}-${normalizeStyle(style)} ${size}.pdf`;
}

function findTemplateByStyleAndSize(folderPath, style, size) {
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
  const productConfig = getProductConfig(style);
  const variantPart = variant && variant !== "Standard" ? ` ${variant}` : "";
  return `${wo} ${productConfig.nikeCode}-${team}${variantPart} ${normalizeStyle(style)} ${size} ${number}.pdf`;
}

module.exports = {
  buildTemplatePath,
  buildOutputName
};
