const variantRules = require("../config/variantRules");

function normalizeValue(value) {
  return String(value || "").trim();
}

function normalizeUpper(value) {
  return normalizeValue(value).toUpperCase();
}

function normalizeLiga(value) {
  const normalized = normalizeUpper(value);
  if (normalized === "PLL" || normalized === "WLL") return normalized;
  return "";
}

function splitList(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeUpper).filter(Boolean);
  }

  return String(value || "")
    .split(/[,;|]/)
    .map(normalizeUpper)
    .filter(Boolean);
}

function inferLigaFromOrder(order) {
  const explicitLiga = normalizeLiga(order && order.liga);
  if (explicitLiga) return explicitLiga;

  const line = normalizeValue(order && order.line).toLowerCase();
  if (line === "femenino") return "WLL";
  if (line === "masculino") return "PLL";

  const style = normalizeUpper(order && order.style);
  if (/^[AY]2[0-9]{3}/.test(style)) return "WLL";
  if (/^[AY]1[0-9]{3}/.test(style)) return "PLL";
  return "";
}

function getCatalogVariantCode(order) {
  const variantCode = normalizeUpper(order && order.variantCode);
  if (variantCode && variantCode !== "STD") return variantCode;

  const variantName = normalizeValue(order && order.variant).toLowerCase();
  if (variantName === "all stars") return "AS";
  if (variantName === "stars & stripes") return "SS";
  if (variantName === "jr championship" || variantName === "jr champ" || variantName === "jr champ shorts") return "JR";
  if (variantName === "indigenous heritage") return "IH";
  if (variantName === "throwback") return "TB";

  const version = normalizeValue(order && order.version).toLowerCase();
  return version === "away" ? "A" : "H";
}

function inferStyleFamilyFromOrder(order) {
  const explicitFamily = normalizeUpper(order && order.styleFamily);
  if (explicitFamily) return explicitFamily;

  return variantRules.stripVariantSuffix(order && order.style);
}

function normalizeEntry(entry) {
  return {
    id: normalizeValue(entry && entry.id),
    variantCode: normalizeUpper(entry && (entry.variantCode || entry.variant_code)),
    variantName: normalizeValue(entry && (entry.variantName || entry.variant_name)),
    liga: normalizeLiga(entry && entry.liga),
    teamGender: normalizeValue(entry && (entry.teamGender || entry.team_gender)),
    teamMarket: normalizeValue(entry && (entry.teamMarket || entry.team_market)),
    teamMascot: normalizeValue(entry && (entry.teamMascot || entry.team_mascot)),
    designCode: normalizeValue(entry && (entry.designCode || entry.design_code)),
    designName: normalizeValue(entry && (entry.designName || entry.design_name)),
    templateNamePlaceholder: normalizeValue(entry && (entry.templateNamePlaceholder || entry.template_name_placeholder)),
    templateNumberPlaceholder: normalizeValue(entry && (entry.templateNumberPlaceholder || entry.template_number_placeholder)),
    isActive: entry && entry.isActive !== false && entry && entry.is_active !== 0,
    isOfficialTeam: Boolean(entry && (entry.isOfficialTeam || entry.is_official_team)),
    requiresDesignCode: Boolean(entry && (entry.requiresDesignCode || entry.requires_design_code)),
    aliases: splitList(entry && entry.aliases),
    opnikeEnabled: Boolean(entry && (entry.opnikeEnabled || entry.opnike_enabled)),
    opnikeRuleStatus: normalizeValue(entry && (entry.opnikeRuleStatus || entry.opnike_rule_status)),
    opnikeStyleScope: splitList(entry && (entry.opnikeStyleScope || entry.opnike_style_scope)),
    opnikeLigaScope: splitList(entry && (entry.opnikeLigaScope || entry.opnike_liga_scope)),
    opnikeVariantRootFolder: normalizeValue(entry && (entry.opnikeVariantRootFolder || entry.opnike_variant_root_folder)),
    opnikeDesignFolder: normalizeValue(entry && (entry.opnikeDesignFolder || entry.opnike_design_folder)),
    opnikeTemplateCode: normalizeValue(entry && (entry.opnikeTemplateCode || entry.opnike_template_code)),
    opnikeResolutionStrategy: normalizeValue(entry && (entry.opnikeResolutionStrategy || entry.opnike_resolution_strategy))
  };
}

function getEntries(reserveData) {
  const rawEntries = Array.isArray(reserveData && reserveData.variants) ? reserveData.variants : [];
  return rawEntries.map(normalizeEntry).filter(function (entry) {
    return entry.variantCode && entry.variantName;
  });
}

function entryMatchesLiga(entry, liga) {
  const normalizedLiga = normalizeLiga(liga);

  if (!normalizedLiga) return true;
  if (entry.liga) return entry.liga === normalizedLiga;
  if (entry.opnikeLigaScope.length) return entry.opnikeLigaScope.indexOf(normalizedLiga) !== -1;
  return true;
}

function entryMatchesStyleScope(entry, styleFamily) {
  if (!entry.opnikeStyleScope.length || !styleFamily) return true;
  return entry.opnikeStyleScope.indexOf(styleFamily) !== -1;
}

function scoreEntry(entry, order) {
  const liga = inferLigaFromOrder(order);
  const team = normalizeValue(order && order.team);
  const designCode = normalizeValue(order && order.designCode);
  const styleFamily = inferStyleFamilyFromOrder(order);
  let score = 0;

  if (entry.liga && entry.liga === normalizeLiga(liga)) score -= 20;
  if (entry.teamMarket && entry.teamMarket === team) score -= 10;
  if (entry.designCode && entry.designCode === designCode) score -= 10;
  if (entry.opnikeStyleScope.indexOf(styleFamily) !== -1) score -= 5;
  if (entry.opnikeEnabled) score -= 1;

  return score;
}

function findEntry(reserveData, order) {
  const entries = Array.isArray(reserveData) ? reserveData : getEntries(reserveData);
  const variantCode = getCatalogVariantCode(order);
  const liga = inferLigaFromOrder(order);
  const team = normalizeValue(order && order.team);
  const designCode = normalizeValue(order && order.designCode);
  const styleFamily = inferStyleFamilyFromOrder(order);
  const candidates = entries.filter(function (entry) {
    if (!entry.isActive) return false;
    if (entry.variantCode !== variantCode) return false;
    if (!entryMatchesLiga(entry, liga)) return false;
    if (!entryMatchesStyleScope(entry, styleFamily)) return false;

    if ((variantCode === "H" || variantCode === "A") && team) {
      return entry.teamMarket === team;
    }

    if (designCode && entry.designCode) {
      return entry.designCode === designCode;
    }

    return true;
  });

  candidates.sort(function (left, right) {
    return scoreEntry(left, order) - scoreEntry(right, order) ||
      Number(left.id || 0) - Number(right.id || 0);
  });

  return candidates[0] || null;
}

function listLabels(reserveData) {
  const labels = { STD: "Standard" };

  getEntries(reserveData).forEach(function (entry) {
    if (entry.variantCode === "H" || entry.variantCode === "A") {
      labels.STD = "Standard";
      return;
    }

    if (!labels[entry.variantCode]) {
      labels[entry.variantCode] = entry.variantName;
    }
  });

  return labels;
}

function countRowsByField(rows, fieldName) {
  return (rows || []).reduce(function (counts, row) {
    const key = row[fieldName] || "SIN_DATO";
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function groupRowsBySize(rows) {
  return (rows || []).reduce(function (groups, row) {
    const size = row.size || "SIN_TALLA";
    groups[size] = groups[size] || [];
    groups[size].push(row);
    return groups;
  }, {});
}

function groupRowsByStyleFamilyAndSize(rows) {
  return (rows || []).reduce(function (groups, row) {
    const styleFamily = row.styleFamily || variantRules.stripVariantSuffix(row.style) || "SIN_STYLE";
    const size = row.size || "SIN_TALLA";

    groups[styleFamily] = groups[styleFamily] || {};
    groups[styleFamily][size] = groups[styleFamily][size] || [];
    groups[styleFamily][size].push(row);
    return groups;
  }, {});
}

function rebuildBatchDataWithRows(batchData, rows) {
  const validRows = rows.filter(function (row) { return row.valid; });
  const invalidRows = rows.filter(function (row) { return !row.valid; });

  return Object.assign({}, batchData, {
    rows: rows,
    validRows: validRows,
    invalidRows: invalidRows,
    groupsBySize: groupRowsBySize(validRows),
    groupsByStyleFamilyAndSize: groupRowsByStyleFamilyAndSize(validRows),
    counts: {
      bySize: countRowsByField(validRows, "size"),
      byStyleFamily: countRowsByField(validRows, "styleFamily"),
      byStyle: countRowsByField(validRows, "style"),
      byTeam: countRowsByField(validRows, "team"),
      byVersion: countRowsByField(validRows, "version")
    }
  });
}

function validateBatchData(reserveData, batchData) {
  const entries = getEntries(reserveData);

  if (!batchData || !entries.length) {
    return batchData;
  }

  const rows = batchData.rows.map(function (row) {
    if (!row.valid) {
      return row;
    }

    if (findEntry(entries, row)) {
      return row;
    }

    return Object.assign({}, row, {
      valid: false,
      errors: (row.errors || []).concat([
        `Style/variante no esta en reservas locales: ${row.style || "-"} ${row.team || row.designCode || row.color || "-"}`
      ]),
      warnings: (row.warnings || []).concat([
        "Actualiza js/config/styleVariantReserve.json desde SQLite o da de alta la variante antes de procesar."
      ])
    });
  });

  return rebuildBatchDataWithRows(batchData, rows);
}

module.exports = {
  findEntry,
  getEntries,
  listLabels,
  normalizeEntry,
  validateBatchData
};
