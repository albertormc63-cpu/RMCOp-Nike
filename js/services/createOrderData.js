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

function normalizeDateText(value) {
  return cleanUpper(value)
    .replace(/\bENERO\b/g, "ENE")
    .replace(/\bFEBRERO\b/g, "FEB")
    .replace(/\bMARZO\b/g, "MAR")
    .replace(/\bABRIL\b/g, "ABR")
    .replace(/\bMAYO\b/g, "MAY")
    .replace(/\bJUNIO\b/g, "JUN")
    .replace(/\bJULIO\b/g, "JUL")
    .replace(/\bAGOSTO\b/g, "AGO")
    .replace(/\bSEPTIEMBRE\b/g, "SEP")
    .replace(/\bSETIEMBRE\b/g, "SEP")
    .replace(/\bOCTUBRE\b/g, "OCT")
    .replace(/\bNOVIEMBRE\b/g, "NOV")
    .replace(/\bDICIEMBRE\b/g, "DIC");
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
    filePath: filePath,
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
  const isGenericRoster = isGenericRosterHeader(headerRow);

  // Soporta el layout On Demand y el roster generico. Si cambia el orden, mandan los encabezados.
  return {
    wo: findColumnIndex(headerRow, ["WO#", "WO", "Work Order"], isGenericRoster ? null : 0),
    shipOrder: findColumnIndex(headerRow, ["Ship Order", "SHIP O", "SHIP O."], isGenericRoster ? null : 1),
    style: findColumnIndex(headerRow, ["Style"], isGenericRoster ? 0 : 2),
    color: findColumnIndex(headerRow, ["Color", "Team/Color", "Team Color", "Team / Color"], isGenericRoster ? 1 : 3),
    qty: findColumnIndex(headerRow, ["Qty", "Quantity", "Pzs", "Pz"], isGenericRoster ? 2 : 5),
    size: findColumnIndex(headerRow, ["Size"], isGenericRoster ? 3 : 4),
    firstName: findColumnIndex(headerRow, ["First Name"], isGenericRoster ? 4 : null),
    name: findColumnIndex(headerRow, ["Last Name", "Name"], isGenericRoster ? 5 : 6),
    number: findColumnIndex(headerRow, ["#", "Player#", "Player Number", "Number"], isGenericRoster ? 6 : 7),
    position: findColumnIndex(headerRow, ["Position"], isGenericRoster ? 7 : null),
    shippingDate: findColumnIndex(headerRow, ["Emb", "Fecha Embarque", "Fecha de Embarque", "Ship Date"], null),
    format: isGenericRoster ? "generic-roster" : "on-demand"
  };
}

function isGenericRosterHeader(headerRow) {
  const normalizedHeaders = headerRow.map(normalizeHeader);
  const hasStyle = normalizedHeaders.indexOf("STYLE") !== -1;
  const hasColor = normalizedHeaders.indexOf("COLOR") !== -1 || normalizedHeaders.indexOf("TEAMCOLOR") !== -1;
  const hasQty = normalizedHeaders.indexOf("QTY") !== -1 || normalizedHeaders.indexOf("QUANTITY") !== -1;
  const hasLastName = normalizedHeaders.indexOf("LASTNAME") !== -1 || normalizedHeaders.indexOf("NAME") !== -1;
  const hasPlayer = normalizedHeaders.indexOf("PLAYER#") !== -1 || normalizedHeaders.indexOf("#") !== -1;
  const hasWo = normalizedHeaders.indexOf("WO#") !== -1 || normalizedHeaders.indexOf("WO") !== -1;

  return !hasWo && hasStyle && hasColor && hasQty && hasLastName && hasPlayer;
}

function findHeaderRowIndex(rawRows) {
  for (let index = 0; index < rawRows.length; index++) {
    const normalizedHeaders = rawRows[index].map(normalizeHeader);
    const hasStyle = normalizedHeaders.indexOf("STYLE") !== -1;
    const hasSize = normalizedHeaders.indexOf("SIZE") !== -1;
    const hasWo = normalizedHeaders.indexOf("WO#") !== -1 || normalizedHeaders.indexOf("WO") !== -1;
    const hasGenericRosterColumns = isGenericRosterHeader(rawRows[index]);

    if (hasStyle && hasSize && (hasWo || hasGenericRosterColumns)) {
      return index;
    }
  }

  return 0;
}

function getCell(cells, index) {
  return index == null || index < 0 ? "" : cells[index];
}

function extractFixedValue(rawRows, labelAliases) {
  const aliases = labelAliases.map(normalizeHeader);

  for (let rowIndex = 0; rowIndex < rawRows.length; rowIndex++) {
    const row = rawRows[rowIndex] || [];

    for (let cellIndex = 0; cellIndex < row.length; cellIndex++) {
      if (aliases.indexOf(normalizeHeader(row[cellIndex])) === -1) {
        continue;
      }

      for (let nextIndex = cellIndex + 1; nextIndex < row.length; nextIndex++) {
        const value = cleanCell(row[nextIndex]);

        if (value) {
          return value;
        }
      }
    }
  }

  return "";
}

function extractRosterName(rawRows, filePath) {
  const firstCell = cleanCell(rawRows[0] && rawRows[0][0]);

  if (firstCell) {
    return firstCell;
  }

  return filePath ? cleanCell(require("path").basename(filePath, require("path").extname(filePath))) : "";
}

function extractWoFromText(value) {
  const text = cleanCell(value);
  const matches = [];
  let match;
  const pattern = /\bWO\s*#?\s*([0-9-]+)\b/gi;

  while ((match = pattern.exec(text)) !== null) {
    matches.push(match[1]);
  }

  if (matches.length) {
    return Array.from(new Set(matches)).join("-");
  }

  const loose = text.match(/\b(1[0-9]{5})\b/);
  return loose ? loose[1] : "";
}

function extractShippingDateFromText(value) {
  const text = normalizeDateText(value);
  const match = text.match(/\b(\d{1,2}[\s-]+[A-Z]{3})\b/);
  return match ? match[1].replace(/\s+/g, "-") : "";
}

function extractDefaultShippingDate(rawRows) {
  const fixedValue = extractFixedValue(rawRows, ["Emb", "Fecha Embarque", "Fecha de Embarque", "Ship Date"]);

  if (fixedValue) {
    return normalizeDateText(fixedValue);
  }

  for (let index = 0; index < Math.min(rawRows.length, 5); index++) {
    const row = rawRows[index] || [];

    for (let cellIndex = 0; cellIndex < row.length; cellIndex++) {
      const dateText = extractShippingDateFromText(row[cellIndex]);

      if (dateText) {
        return dateText;
      }
    }
  }

  return "";
}

function getWorkbookMetadata(workbookData) {
  const rosterName = extractRosterName(workbookData.rawRows, workbookData.filePath);
  const rosterNumberMatch = rosterName.match(/\b[0-9]{4,}-[0-9]{2,}\b/) ||
    String(workbookData.filePath || "").match(/\b[0-9]{4,}-[0-9]{2,}\b/);

  return {
    rosterName: rosterName,
    rosterNumber: rosterNumberMatch ? rosterNumberMatch[0] : "",
    sourceFormat: "",
    defaultWo: extractWoFromText(rosterName) || extractWoFromText(workbookData.filePath),
    defaultShipOrder: extractFixedValue(workbookData.rawRows, ["Ship Order #", "Ship Order", "SHIP O", "SHIP O."]),
    defaultShippingDate: extractDefaultShippingDate(workbookData.rawRows),
    totalPieces: Number(cleanCell(extractFixedValue(workbookData.rawRows, ["TOTAL PIECES"])) || 0)
  };
}

function normalizeRow(cells, index, columns, metadata) {
  const style = cleanUpper(getCell(cells, columns.style));
  const sizeRaw = cleanUpper(getCell(cells, columns.size));
  const number = sanitizeNumber(getCell(cells, columns.number));
  const name = cleanUpper(getCell(cells, columns.name));
  const color = cleanCell(getCell(cells, columns.color));

  return {
    sourceRow: index + 1,
    wo: sanitizeNumber(getCell(cells, columns.wo)) || cleanCell(getCell(cells, columns.wo)) || metadata.defaultWo,
    shipOrder: cleanCell(getCell(cells, columns.shipOrder)) || metadata.defaultShipOrder,
    style: style,
    color: color,
    line: inferLine(style),
    team: inferTeam(color),
    variant: inferVariant(style),
    version: inferVersion(style),
    styleFamily: getStyleFamily(style),
    sizeRaw: sizeRaw,
    size: normalizeSize(sizeRaw),
    qty: Number(cleanCell(getCell(cells, columns.qty)) || 1),
    name: name,
    number: number,
    firstName: cleanUpper(getCell(cells, columns.firstName)),
    position: cleanUpper(getCell(cells, columns.position)),
    shippingDate: normalizeDateText(getCell(cells, columns.shippingDate)) || metadata.defaultShippingDate,
    sourceFormat: columns.format || "on-demand",
    rosterName: metadata.rosterName,
    rosterNumber: metadata.rosterNumber
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
  const metadata = getWorkbookMetadata(workbookData);

  metadata.sourceFormat = columns.format;

  const rows = workbookData.rawRows
    .map(function (cells, index) {
      return normalizeRow(cells, index, columns, metadata);
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
    sourceFormat: columns.format,
    rosterName: metadata.rosterName,
    rosterNumber: metadata.rosterNumber,
    defaultWo: metadata.defaultWo,
    defaultShipOrder: metadata.defaultShipOrder,
    defaultShippingDate: metadata.defaultShippingDate,
    totalPieces: metadata.totalPieces,
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
