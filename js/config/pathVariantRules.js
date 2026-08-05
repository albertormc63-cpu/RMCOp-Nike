const styleVariantReserveData = require("./styleVariantReserve.json");
const variantRules = require("./variantRules");
const styleVariantReserve = require("../services/styleVariantReserve");

const fallbackOutputCodes = {
  "Indigenous Heritage": "IH",
  Throwback: "TB",
  "JR Championship": "JR",
  "JR Champ": "JR",
  "JR Champ Shorts": "JR",
  "All Stars": "AS",
  "Stars & Stripes": "SS"
};

const pathRulesByCode = {
  STD: {
    rootFolder: "STANDARD",
    templateStrategy: "text",
    outputStrategy: "team"
  },
  IH: {
    rootFolder: "INDIGENOUS HERITAGE",
    templateStrategy: "ih",
    outputStrategy: "team",
    groupFolders: {
      PLL: "NIKE IH Mens and Youth",
      WLL: "NIKE IH Girls and Ladies"
    }
  },
  TB: {
    rootFolder: "THROWBACK",
    templateStrategy: "throwback",
    outputStrategy: "team",
    groupFolders: {
      PLL: "NIKE TB Mens and Youth",
      WLL: "NIKE TB Girls and Ladies"
    }
  },
  JR: {
    rootFolder: "JR CHAMPIONSHIP",
    templateStrategy: "jr",
    outputStrategy: "team",
    groupFolders: {
      PLL: "NIKE JR Mens and Youth",
      WLL: "NIKE JR Girls and Ladies"
    }
  },
  AS: {
    rootFolder: "ALL STARS",
    templateStrategy: "all-stars",
    outputStrategy: "all-stars",
    groupFolders: {
      PLL: "NIKE AS Mens and Youth",
      WLL: "NIKE AS Girls and Ladies"
    }
  },
  SS: {
    rootFolder: "STARS STRIPES",
    templateStrategy: "stars-stripes",
    outputStrategy: "stars-stripes",
    groupFolders: {
      PLL: "NIKE SS Mens and Youth",
      WLL: "NIKE SS Girls and Ladies"
    }
  }
};

const starsStripesDesignFallbacks = {
  GNB1: { templateCode: "GBF", folderName: "GREEN BERET FUNDATION" },
  NYS1: { templateCode: "NSF", folderName: "NAVY SEALS FUNDATION" }
};

function normalizeVariantCode(variant) {
  if (variantRules.isJrVariantName(variant)) return "JR";

  const catalogVariant = variantRules.getVariant(variant);
  return catalogVariant && catalogVariant.code ? catalogVariant.code : "STD";
}

function getPathRule(variant) {
  return pathRulesByCode[normalizeVariantCode(variant)] || pathRulesByCode.STD;
}

function getOutputVariantCode(variant) {
  const variantCode = normalizeVariantCode(variant);

  if (variantCode === "STD") {
    return "";
  }

  return fallbackOutputCodes[variant] || variantCode;
}

function getVariantRootFolder(variant) {
  return getPathRule(variant).rootFolder;
}

function getTemplateStrategy(variant) {
  return getPathRule(variant).templateStrategy || "text";
}

function getOutputStrategy(variant) {
  return getPathRule(variant).outputStrategy || "team";
}

function getVariantGroupFolder(variant, nikeCode, fallbackGroupFolder) {
  const pathRule = getPathRule(variant);
  return pathRule.groupFolders && pathRule.groupFolders[nikeCode] ? pathRule.groupFolders[nikeCode] : fallbackGroupFolder;
}

function getStarsStripesDesign(designCode, style) {
  const normalizedDesignCode = String(designCode || "").trim().toUpperCase();
  const reserveEntry = styleVariantReserve.findEntry(styleVariantReserveData, {
    variant: "Stars & Stripes",
    variantCode: "SS",
    designCode: normalizedDesignCode,
    style: style
  });

  if (reserveEntry && reserveEntry.opnikeTemplateCode && reserveEntry.opnikeDesignFolder) {
    return {
      templateCode: reserveEntry.opnikeTemplateCode,
      folderName: reserveEntry.opnikeDesignFolder
    };
  }

  return starsStripesDesignFallbacks[normalizedDesignCode] || null;
}

function getTeamMascot({ team, variant, version, style }) {
  const directEntry = styleVariantReserve.findEntry(styleVariantReserveData, {
    team: team,
    variant: variant,
    version: version,
    style: style
  });

  if (directEntry && directEntry.teamMascot) {
    return directEntry.teamMascot;
  }

  const standardEntry = styleVariantReserve.findEntry(styleVariantReserveData, {
    team: team,
    variant: "Standard",
    version: version || "Home",
    style: style
  });

  return standardEntry && standardEntry.teamMascot ? standardEntry.teamMascot : "";
}

module.exports = {
  getOutputVariantCode,
  getOutputStrategy,
  getStarsStripesDesign,
  getTeamMascot,
  getTemplateStrategy,
  getVariantGroupFolder,
  getVariantRootFolder,
  normalizeVariantCode
};
