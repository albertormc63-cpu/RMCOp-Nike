const XLSX = require("xlsx");
const variantRules = require("../config/variantRules");

const sizeMap = {
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

function normalizeRow(cells, index) {
  const style = cleanUpper(cells[2]);
  const sizeRaw = cleanUpper(cells[4]);
  const number = sanitizeNumber(cells[7]);
  const name = cleanUpper(cells[6]);
  const color = cleanCell(cells[3]);

  return {
    sourceRow: index + 1,
    wo: sanitizeNumber(cells[0]) || cleanCell(cells[0]),
    shipOrder: cleanCell(cells[1]),
    style: style,
    color: color,
    line: inferLine(style),
    team: inferTeam(color),
    variant: inferVariant(style),
    version: inferVersion(style),
    sizeRaw: sizeRaw,
    size: normalizeSize(sizeRaw),
    qty: Number(cleanCell(cells[5]) || 1),
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
  const rows = workbookData.rawRows
    .map(function (cells, index) {
      return normalizeRow(cells, index);
    })
    .filter(function (row, index) {
      if (index === 0) return false;
      return row.wo || row.shipOrder || row.style || row.color || row.sizeRaw || row.name || row.number;
    })
    .map(validateOrderRow);
  const validRows = rows.filter(function (row) { return row.valid; });
  const invalidRows = rows.filter(function (row) { return !row.valid; });

  return {
    sourcePath: filePath,
    sheetName: workbookData.sheetName,
    rows: rows,
    validRows: validRows,
    invalidRows: invalidRows,
    groupsBySize: groupBySize(validRows),
    counts: {
      bySize: countBy(validRows, "size"),
      byStyle: countBy(validRows, "style"),
      byTeam: countBy(validRows, "team"),
      byVersion: countBy(validRows, "version")
    }
  };
}

module.exports = {
  createOrderDataFromExcel,
  normalizeSize,
  inferTeam
};
