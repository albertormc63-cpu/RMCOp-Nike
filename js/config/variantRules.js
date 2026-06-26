// Reglas compartidas de variantes para Node/CEP.
// Si llega una variante nueva, primero se agrega aqui y luego se ajustan rutas reales si difieren.

const variants = [
  {
    name: "Standard",
    slug: "standard",
    code: "STD",
    styleSuffix: { Home: "H", Away: "A" },
    replacementMode: "text",
    usesVersion: true,
    templateFamily: "standard"
  },
  {
    name: "Indigenous Heritage",
    slug: "indigenous-heritage",
    code: "IH",
    styleSuffix: "IH",
    replacementMode: "ih-raster-number",
    usesVersion: false,
    templateFamily: "indigenous-heritage"
  },
  {
    name: "Throwback",
    slug: "throwback",
    code: "TB",
    styleSuffix: "TB",
    replacementMode: "text",
    usesVersion: false,
    templateFamily: "throwback"
  },
  {
    name: "JR Championship",
    slug: "jr-championship",
    code: "JR",
    styleSuffix: "JR",
    replacementMode: "text",
    usesVersion: false,
    templateFamily: "jr-championship"
  },
  {
    name: "All Stars",
    slug: "all-stars",
    code: "AS",
    styleSuffix: "AS",
    replacementMode: "text",
    usesVersion: true,
    templateFamily: "all-stars"
  },
  {
    name: "Stars & Stripes",
    slug: "stars-stripes",
    code: "SS",
    styleSuffix: "SS",
    replacementMode: "text",
    usesVersion: false,
    requiresDesignCode: true,
    templateFamily: "stars-stripes"
  }
];

function normalizeStyle(style) {
  return String(style || "").trim().toUpperCase();
}

function getVariant(variantName) {
  return variants.find(function (variant) {
    return variant.name === variantName;
  }) || variants[0];
}

function getVariantByCode(code) {
  const normalizedCode = String(code || "").trim().toUpperCase();
  return variants.find(function (variant) {
    return variant.code === normalizedCode;
  }) || null;
}

function getStyleSuffix(variantName, version) {
  const variant = getVariant(variantName);

  if (typeof variant.styleSuffix === "string") {
    return variant.styleSuffix;
  }

  return variant.styleSuffix[version] || variant.styleSuffix.Home || "";
}

function inferVariantFromStyle(style) {
  const normalizedStyle = normalizeStyle(style);
  const specialVariant = variants.find(function (variant) {
    return variant.code !== "STD" && normalizedStyle.endsWith(variant.code);
  });

  return specialVariant || variants[0];
}

function stripVariantSuffix(style) {
  const normalizedStyle = normalizeStyle(style);
  const variant = inferVariantFromStyle(normalizedStyle);

  if (variant.code !== "STD") {
    return normalizedStyle.replace(new RegExp(variant.code + "$", "i"), "");
  }

  return normalizedStyle.replace(/[HA]$/i, "");
}

function isTextReplacementVariant(variantName) {
  return getVariant(variantName).replacementMode === "text";
}

function isIhVariant(variantName) {
  return getVariant(variantName).replacementMode === "ih-raster-number";
}

module.exports = {
  variants,
  getVariant,
  getVariantByCode,
  getStyleSuffix,
  inferVariantFromStyle,
  stripVariantSuffix,
  isTextReplacementVariant,
  isIhVariant
};
