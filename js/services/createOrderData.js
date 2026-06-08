const XLSX = require("xlsx");
const variantRules = require("../config/variantRules");

const sizeMap = {
  XSM: "XS",
  "X-SM": "XS",
  SML: "SM",
  SM: "SM",
  MED: "MD",
  MD: "MD",
  LGE: "LG",
  LG: "LG",
  XLG: "XL",
  XL: "XL",
  "2XL": "2X",
  "2X": "2X",
  "3XL": "3X",
  "3X": "3X",
  XS: "XS"
};

const validSizes = ["XS", "SM", "MD", "LG", "XL", "2X", "3X"];

const colorTeamMap = [
  { token: "ARCHERS", team: "Utah" },
  { token: "ATLAS", team: "New York" },
  { token: "CANNONS", team: "Boston" },
  { token: "CHAOS", team: "Carolina" },
  { token: "OUTLAWS", team: "Denver" },
  { token: "WHIPSNAKES", team: "Maryland" },
  { token: "WATERDOGS", team: "Philadelphia" },
  { token: "REDWOODS", team: "California" },
  { token: "GUARD", team: "Boston" },
  { token: "PALMS", team: "California" },
  { token: "CHARM", team: "Maryland" },
  { token: "CHARGING", team: "New York" }
];

function cleanCell(value) {
  if (value == null) return "";
  return String(value).trim().replace(/\s+/g, " ");
}

function cleanUpper(value) {
  return cleanCell(value).toUpperCase();
}

function sanitizeNumber(value) {
  return cleanCell(value).replace(/[^0-9]/g, "");
}

function inferTeam(color) {
  const normalizedColor = cleanUpper(color);
  const match = colorTeamMap.find(function (entry) {
    return normalizedColor.indexOf(entry.token) !== -1;
  });

  return match ? match.team : "";
}

function inferLine(style) {
  const normalizedStyle = cleanUpper(style);

  if (/^[AY]1000/.test(normalizedStyle)) return "masculino";
  if (/^[AY]2000/.test(normalizedStyle)) return "femenino";
  return "";
}

function inferVariant(style) {
  return variantRules.inferVariantFromStyle(style).name;
}

function inferVersion(style) {
  const normalizedStyle = cleanUpper(style);

  if (/A$/.test(normalizedStyle)) return "Away";
  if (/H$/.test(normalizedStyle)) return "Home";
  return "Home";
}

function getStyleFamily(style) {
  return variantRules.stripVariantSuffix(cleanUpper(style));
}

function normalizeSize(size) {
  const normalizedSize = cleanUpper(size);
  return sizeMap[normalizedSize] || normalizedSize;
}

function readWorkbookRows(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("El Excel no tiene hojas para leer.");
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: ""
  });

  return {
    sheetName: sheetName,
    rawRows: rawRows
  };
}

function normalizeHeader(value) {
  return cleanUpper(value).replace(/[^A-Z0-9#]/g, "");
}

function rowHasData(cells) {
  return cells.some(function (cell) {
    return cleanCell(cell) !== "";
  });
}

function findColumnIndex(headers, aliases, fallbackIndex) {
  const normalizedAliases = aliases.map(normalizeHeader);

  for (let index = 0; index < headers.length; index++) {
    if (normalizedAliases.indexOf(normalizeHeader(headers[index])) !== -1) {
      return index;
    }
  }

  return fallbackIndex;
}

function getColumnIndexes(headerRow) {
  // Soporta el layout viejo y el nuevo. Si cambia el orden, mandan los encabezados.
  return {
    wo: findColumnIndex(headerRow, ["WO#", "WO", "Work Order"], 0),
    shipOrder: findColumnIndex(headerRow, ["Ship Order", "SHIP O", "SHIP O."], 1),
    style: findColumnIndex(headerRow, ["Style"], 2),
    color: findColumnIndex(headerRow, ["Color", "Team/Color", "Team Color", "Team / Color"], 3),
    size: findColumnIndex(headerRow, ["Size"], 4),
    qty: findColumnIndex(headerRow, ["Qty", "Quantity", "Pzs", "Pz"], 5),
    name: findColumnIndex(headerRow, ["Last Name", "Name"], 6),
    number: findColumnIndex(headerRow, ["#", "Player#", "Player Number", "Number"], 7)
  };
}

function findHeaderRowIndex(rawRows) {
  for (let index = 0; index < rawRows.length; index++) {
    const normalizedHeaders = rawRows[index].map(normalizeHeader);
    const hasStyle = normalizedHeaders.indexOf("STYLE") !== -1;
    const hasSize = normalizedHeaders.indexOf("SIZE") !== -1;
    const hasWo = normalizedHeaders.indexOf("WO#") !== -1 || normalizedHeaders.indexOf("WO") !== -1;

    if (hasStyle && hasSize && hasWo) {
      return index;
    }
  }

  return 0;
}

function normalizeRow(cells, index, columns) {
  const style = cleanUpper(cells[columns.style]);
  const sizeRaw = cleanUpper(cells[columns.size]);
  const number = sanitizeNumber(cells[columns.number]);
  const name = cleanUpper(cells[columns.name]);
  const color = cleanCell(cells[columns.color]);

  return {
    sourceRow: index + 1,
    wo: sanitizeNumber(cells[columns.wo]) || cleanCell(cells[columns.wo]),
    shipOrder: cleanCell(cells[columns.shipOrder]),
    style: style,
    color: color,
    line: inferLine(style),
    team: inferTeam(color),
    variant: inferVariant(style),
    version: inferVersion(style),
    styleFamily: getStyleFamily(style),
    sizeRaw: sizeRaw,
    size: normalizeSize(sizeRaw),
    qty: Number(cleanCell(cells[columns.qty]) || 1),
    name: name,
    number: number
  };
}

function validateOrderRow(row) {
  const errors = [];
  const warnings = [];

  if (!row.wo) errors.push("Falta Work Order");
  if (!row.style) errors.push("Falta Style");
  if (!row.line) errors.push("Style no reconocido");
  if (!row.team) errors.push("No se pudo detectar equipo desde Color");
  if (!row.size) errors.push("Falta Size");
  if (row.size && validSizes.indexOf(row.size) === -1) errors.push(`Size no reconocido: ${row.sizeRaw}`);
  if (!row.name && !row.number) warnings.push("Sin nombre ni numero; se limpiaran placeholders");

  return Object.assign({}, row, {
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings
  });
}

function groupBySize(rows) {
  return rows.reduce(function (groups, row) {
    const size = row.size || "SIN_TALLA";
    groups[size] = groups[size] || [];
    groups[size].push(row);
    return groups;
  }, {});
}

function groupByStyleFamilyAndSize(rows) {
  return rows.reduce(function (groups, row) {
    const styleFamily = row.styleFamily || "SIN_STYLE";
    const size = row.size || "SIN_TALLA";

    groups[styleFamily] = groups[styleFamily] || {};
    groups[styleFamily][size] = groups[styleFamily][size] || [];
    groups[styleFamily][size].push(row);

    return groups;
  }, {});
}

function countBy(rows, key) {
  return rows.reduce(function (counts, row) {
    const value = row[key] || "(vacio)";
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function createOrderDataFromExcel(filePath) {
  // Flujo por lote:
  // 1) leer primera hoja A:H, 2) normalizar datos al mismo shape que el pedido manual,
  // 3) validar sin bloquear blanks intencionales, 4) agrupar por talla para produccion.
  const workbookData = readWorkbookRows(filePath);
  const headerRowIndex = findHeaderRowIndex(workbookData.rawRows);
  const headerRow = workbookData.rawRows[headerRowIndex] || [];
  const columns = getColumnIndexes(headerRow);
  const rows = workbookData.rawRows
    .map(function (cells, index) {
      return normalizeRow(cells, index, columns);
    })
    .filter(function (row, index) {
      if (index <= headerRowIndex) return false;
      return rowHasData(workbookData.rawRows[index]);
    })
    .map(validateOrderRow);
  const validRows = rows.filter(function (row) { return row.valid; });
  const invalidRows = rows.filter(function (row) { return !row.valid; });

  return {
    sourcePath: filePath,
    sheetName: workbookData.sheetName,
    headerRow: headerRowIndex + 1,
    dataStartRow: headerRowIndex + 2,
    columns: columns,
    rows: rows,
    validRows: validRows,
    invalidRows: invalidRows,
    groupsBySize: groupBySize(validRows),
    groupsByStyleFamilyAndSize: groupByStyleFamilyAndSize(validRows),
    counts: {
      bySize: countBy(validRows, "size"),
      byStyleFamily: countBy(validRows, "styleFamily"),
      byStyle: countBy(validRows, "style"),
      byTeam: countBy(validRows, "team"),
      byVersion: countBy(validRows, "version")
    }
  };
}

module.exports = {
  createOrderDataFromExcel,
  getColumnIndexes,
  findHeaderRowIndex,
  getStyleFamily,
  normalizeSize,
  inferTeam
};
