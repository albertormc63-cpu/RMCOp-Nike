#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

let fontkit = null;

try {
  fontkit = require("@pdf-lib/fontkit");
} catch (error) {
  fontkit = null;
}

const INCH = 72;
const FONT_COLOR = rgb(0x31 / 255, 0x27 / 255, 0x83 / 255);
const DATE_COLOR = rgb(0xa9 / 255, 0x1e / 255, 0x2f / 255);

const DEFAULT_EXCEL = "/Volumes/Fullsize/TO PRINT/LISTAS ON DEMAND/NIKE OD 12 JUNIO.xlsx";
const DEFAULT_MOCKUPS = "/Volumes/Fullsize/PATRONES ACOMODADOS PARA ROLLO/NIKE LACROSSE/RMCOp-NIKE/MOCKUPS";
const DEFAULT_OUT = "/Volumes/Fullsize/TO PRINT/LISTAS ON DEMAND";
const DEFAULT_ALDRICH_FONT = "/Users/rmlsub1/Library/Fonts/Aldrich-Regular.ttf";
const MODE_BULK = "bulk";
const MODE_SAMPLES = "samples";

const maleTeams = {
  ARCHERS: { team: "Utah", nickname: "Archers", code: "X001" },
  ATLAS: { team: "New York", nickname: "Atlas", code: "X002" },
  CANNONS: { team: "Boston", nickname: "Cannons", code: "X003" },
  CHAOS: { team: "Carolina", nickname: "Chaos", code: "X004" },
  OUTLAWS: { team: "Denver", nickname: "Outlaws", code: "X005" },
  WHIPSNAKES: { team: "Maryland", nickname: "Whipsnakes", code: "X006" },
  WATERDOGS: { team: "Philadelphia", nickname: "Waterdogs", code: "X007" },
  REDWOODS: { team: "California", nickname: "Redwoods", code: "X008" }
};

const femaleTeams = {
  GUARD: { team: "Boston", nickname: "Guard" },
  PALMS: { team: "California", nickname: "Palms" },
  CHARM: { team: "Maryland", nickname: "Charm" },
  CHARGING: { team: "New York", nickname: "Charging" }
};

function parseArgs(argv) {
  const args = {
    excel: DEFAULT_EXCEL,
    mockups: DEFAULT_MOCKUPS,
    out: DEFAULT_OUT,
    font: DEFAULT_ALDRICH_FONT,
    mode: MODE_BULK,
    limit: 0
  };

  for (let index = 2; index < argv.length; index++) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--excel") {
      args.excel = next;
      index++;
    } else if (arg === "--mockups") {
      args.mockups = next;
      index++;
    } else if (arg === "--out") {
      args.out = next;
      index++;
    } else if (arg === "--font") {
      args.font = next;
      index++;
    } else if (arg === "--mode") {
      args.mode = normalizeMode(next);
      index++;
    } else if (arg === "--styles") {
      args.styles = parseFilterList(next);
      index++;
    } else if (arg === "--sizes") {
      args.sizes = parseFilterList(next);
      index++;
    } else if (arg === "--limit") {
      args.limit = Number(next || 0);
      index++;
    }
  }

  return args;
}

function clean(value) {
  if (value == null) return "";
  return String(value).trim().replace(/\s+/g, " ");
}

function cleanUpper(value) {
  return clean(value).toUpperCase();
}

function parseFilterList(value) {
  return clean(value)
    .split(",")
    .map(cleanUpper)
    .filter(Boolean);
}

function sanitizeFilePart(value) {
  return clean(value)
    .replace(/[\/\\:*?"<>|]/g, "")
    .replace(/\s+/g, " ");
}

function normalizeMode(value) {
  const mode = cleanUpper(value);
  return mode === "SAMPLES" || mode === "GENERICAS" || mode === "GENERICAS/MUESTRAS" ? MODE_SAMPLES : MODE_BULK;
}

function summarizeExcel(excel) {
  return {
    sheetName: excel.sheetName,
    title: excel.title,
    dateText: excel.dateText,
    rows: excel.rows.length,
    mode: excel.mode || MODE_BULK,
    styles: uniqueSorted(excel.rows.map(function (row) { return getStyleFamily(row.style); })),
    sizes: uniqueSorted(excel.rows.map(function (row) { return row.size; })),
    teams: uniqueSorted(excel.rows.map(function (row) {
      return row.teamInfo ? `${row.line} ${row.teamInfo.team} ${row.teamInfo.nickname}` : "";
    })),
    sizesByStyle: buildSizesByStyle(excel.rows)
  };
}

function uniqueSorted(values) {
  return Array.from(new Set(values.map(cleanUpper).filter(Boolean))).sort();
}

function buildSizesByStyle(rows) {
  const sizesByStyle = {};

  rows.forEach(function (row) {
    const family = getStyleFamily(row.style);
    if (!family || family === "SIN_STYLE" || !row.size) return;
    if (!sizesByStyle[family]) sizesByStyle[family] = [];
    sizesByStyle[family].push(row.size);
  });

  Object.keys(sizesByStyle).forEach(function (family) {
    sizesByStyle[family] = uniqueSorted(sizesByStyle[family]);
  });

  return sizesByStyle;
}

function readExcel(excelPath, mode) {
  const workbook = XLSX.readFile(excelPath, { cellDates: false });
  return readWorkbook(workbook, mode);
}

function readExcelBuffer(buffer, mode) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  return readWorkbook(workbook, mode);
}

function readWorkbook(workbook, mode) {
  if (normalizeMode(mode) === MODE_SAMPLES) {
    return readSamplesWorkbook(workbook);
  }

  return readBulkWorkbook(workbook);
}

function readBulkWorkbook(workbook) {
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: ""
  });
  const title = clean(rows[1] && rows[1][0]);
  const dateText = extractDate(title);
  const dataRows = rows.slice(3)
    .map(function (cells, index) {
      return normalizeOrderRow(cells, index + 4);
    })
    .filter(function (row) {
      return row.shipOrder || row.wo || row.style || row.color;
    });

  return {
    mode: MODE_BULK,
    sheetName,
    title,
    dateText,
    rows: dataRows
  };
}

function readSamplesWorkbook(workbook) {
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: ""
  });
  const headerRowIndex = findSamplesHeaderRow(rows);
  const headerCells = rows[headerRowIndex] || [];
  const columns = buildSamplesColumns(headerCells);
  const dataRows = rows.slice(headerRowIndex + 1)
    .map(function (cells, index) {
      return normalizeSampleRow(cells, headerRowIndex + index + 2, columns);
    })
    .filter(function (row) {
      return row.wo || row.style || row.roster || row.color;
    });

  return {
    mode: MODE_SAMPLES,
    sheetName,
    title: "",
    dateText: "",
    rows: dataRows
  };
}

function findSamplesHeaderRow(rows) {
  for (let index = 0; index < Math.min(rows.length, 25); index++) {
    const normalized = (rows[index] || []).map(normalizeHeader);
    const hasWo = normalized.some(function (value) { return value === "WO" || value === "WO#"; });
    const hasStyle = normalized.some(function (value) { return value === "STYLE" || value === "ESTILO"; });
    const hasRoster = normalized.some(function (value) { return value.indexOf("ROSTER") !== -1; });
    const hasQty = normalized.some(function (value) { return value === "QTY" || value === "PZS" || value === "PZ"; });

    if (hasWo && hasStyle && hasRoster && hasQty) return index;
  }

  return 1;
}

function buildSamplesColumns(headerCells) {
  return {
    wo: findColumn(headerCells, ["WO", "WO#", "WORK ORDER"]),
    style: findColumn(headerCells, ["STYLE", "ESTILO"]),
    roster: findColumn(headerCells, ["ROSTER", "ROSTER#"]),
    qty: findColumn(headerCells, ["QTY", "PZS", "PZ", "QTY/PZS"]),
    color: findColumn(headerCells, ["COLOR", "COLOR / EQUIPO", "EQUIPO", "TEAM"]),
    shipDate: findColumn(headerCells, ["FECHA EMBARQUE", "EMBARQUE", "EMB", "SHIP DATE"])
  };
}

function findColumn(headerCells, aliases) {
  const normalizedAliases = aliases.map(normalizeHeader);
  const index = headerCells.findIndex(function (cell) {
    const header = normalizeHeader(cell);
    return normalizedAliases.some(function (alias) {
      return header === alias || header.indexOf(alias) !== -1;
    });
  });

  return index === -1 ? null : index;
}

function normalizeHeader(value) {
  return cleanUpper(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function readCell(cells, index) {
  return index == null || index < 0 ? "" : cells[index];
}

function normalizeSampleRow(cells, sourceRow, columns) {
  const style = cleanUpper(readCell(cells, columns.style));
  const color = clean(readCell(cells, columns.color));
  const line = inferLine(style) || inferLineFromColor(color);
  const variant = inferVariant(style) || inferVariantFromColor(color);
  const version = inferVersion(style);
  const teamInfo = inferTeam(color, line);

  return {
    sourceRow,
    shipOrder: "",
    wo: clean(readCell(cells, columns.wo)).replace(/[^0-9-]/g, ""),
    style,
    color,
    size: "",
    qty: Number(clean(readCell(cells, columns.qty)) || 1),
    roster: cleanUpper(readCell(cells, columns.roster)),
    shipDate: cleanUpper(readCell(cells, columns.shipDate)),
    lastName: "",
    playerNumber: "",
    line,
    variant,
    version,
    teamInfo
  };
}

function extractDate(title) {
  const normalized = cleanUpper(title);
  const match = normalized.match(/\b(\d{1,2}\s+[A-ZÁÉÍÓÚÑ]+)\b/);
  return match ? match[1] : normalized;
}

function normalizeOrderRow(cells, sourceRow) {
  const style = cleanUpper(cells[2]);
  const color = clean(cells[3]);
  const line = inferLine(style);
  const variant = inferVariant(style);
  const version = inferVersion(style);
  const teamInfo = inferTeam(color, line);

  return {
    sourceRow,
    shipOrder: clean(cells[0]),
    wo: clean(cells[1]).replace(/[^0-9-]/g, ""),
    style,
    color,
    size: cleanUpper(cells[4]),
    qty: Number(clean(cells[5]) || 1),
    lastName: cleanUpper(cells[6]),
    playerNumber: clean(cells[7]).replace(/[^0-9]/g, ""),
    line,
    variant,
    version,
    teamInfo
  };
}

function inferLine(style) {
  if (/^[AY]1000/.test(style)) return "PLL";
  if (/^[AY]2000/.test(style)) return "WLL";
  return "";
}

function inferVariant(style) {
  if (/IH$/.test(style)) return "IH";
  if (/TB$/.test(style)) return "TB";
  return "STANDARD";
}

function inferVersion(style) {
  if (/(IH|TB)$/.test(style)) return "";
  if (/A$/.test(style)) return "Away";
  if (/H$/.test(style)) return "Home";
  return "";
}

function inferLineFromColor(color) {
  const normalized = cleanUpper(color);
  if (normalized.indexOf("WLL") !== -1) return "WLL";
  if (normalized.indexOf("PLL") !== -1) return "PLL";
  return "";
}

function inferVariantFromColor(color) {
  const normalized = cleanUpper(color);
  if (normalized.indexOf("INDIGENOUS") !== -1 || normalized.indexOf(" IH") !== -1) return "IH";
  if (normalized.indexOf("THROWBACK") !== -1) return "TB";
  return "STANDARD";
}

function inferTeam(color, line) {
  const normalized = cleanUpper(color);
  const source = line === "WLL" ? femaleTeams : maleTeams;
  const key = Object.keys(source).find(function (token) {
    return normalized.indexOf(token) !== -1;
  });

  return key ? source[key] : null;
}

function buildMockupPath(mockupsRoot, order) {
  if (!order.teamInfo || !order.line) {
    return "";
  }

  if (order.variant === "IH") {
    return path.join(
      mockupsRoot,
      "INDIGENOUS HERITAGE",
      `${order.line} ${order.teamInfo.team} ${order.teamInfo.nickname} IH.pdf`
    );
  }

  if (order.variant === "TB") {
    return path.join(
      mockupsRoot,
      "THROWBACK",
      `${order.line} ${order.teamInfo.team} ${order.teamInfo.nickname} TB.pdf`
    );
  }

  if (!order.version) {
    return "";
  }

  return path.join(
    mockupsRoot,
    "STANDARD",
    order.line === "PLL" ? "MASCULINO" : "FEMENINO",
    `${order.line} ${order.teamInfo.team} ${order.teamInfo.nickname} ${order.version}.pdf`
  );
}

async function annotatePdf({ mockupPath, outputPath, order, dateText, fontPath }) {
  // Las coordenadas llegan en pulgadas desde abajo/izquierda. PDF usa puntos.
  const bytes = fs.readFileSync(mockupPath);
  const pdf = await PDFDocument.load(bytes);
  const page = pdf.getPages()[0];
  const font = await loadPreferredFont(pdf, fontPath);
  const boldFont = font;

  drawText(page, `WO# ${order.wo}`.toUpperCase(), {
    x: 0.58,
    y: 7.10,
    size: 18,
    font: boldFont
  });

  drawText(page, order.style.toUpperCase(), {
    x: 0.58,
    y: 6.78,
    size: 18,
    font: boldFont
  });

  drawText(page, dateText.toUpperCase(), {
    x: 0.58,
    y: 7.38,
    size: 12,
    font,
    color: DATE_COLOR
  });

  drawQty(page, String(order.qty || 1), {
    x: 0.80,
    y: 4.04,
    numberFont: boldFont,
    suffixFont: font
  });

  drawText(page, `Size: ${order.size}`.toUpperCase(), {
    x: getSizeTextX(order),
    y: 2.50,
    size: 18,
    font: boldFont
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, await pdf.save());
}

async function annotateSamplesPdf({ mockupPath, outputPath, order, fontPath }) {
  const bytes = fs.readFileSync(mockupPath);
  const pdf = await PDFDocument.load(bytes);
  const page = pdf.getPages()[0];
  const font = await loadPreferredFont(pdf, fontPath);
  const boldFont = font;

  drawText(page, `WO# ${order.wo}`.toUpperCase(), {
    x: 0.58,
    y: 7.10,
    size: 18,
    font: boldFont
  });

  drawText(page, order.style.toUpperCase(), {
    x: 0.58,
    y: 6.78,
    size: 18,
    font: boldFont
  });

  if (order.shipDate) {
    drawText(page, order.shipDate.toUpperCase(), {
      x: 0.58,
      y: 7.38,
      size: 12,
      font,
      color: DATE_COLOR
    });
  }

  drawQty(page, String(order.qty || 1), {
    x: 0.80,
    y: 4.04,
    numberFont: boldFont,
    suffixFont: font
  });

  drawText(page, `Roster: ${order.roster || "SIN ROSTER"}`.toUpperCase(), {
    x: 1.80,
    y: 2.50,
    size: 18,
    font: boldFont
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, await pdf.save());
}

function getSizeTextX(order) {
  if (!order.sizes || order.sizes.length <= 1) return 2.30;
  return order.sizes.length > 2 ? 1.55 : 1.80;
}

async function loadPreferredFont(pdf, fontPath) {
  if (fontkit && fontPath && fs.existsSync(fontPath)) {
    pdf.registerFontkit(fontkit);
    return pdf.embedFont(fs.readFileSync(fontPath));
  }

  return pdf.embedFont(StandardFonts.HelveticaBold);
}

function drawText(page, text, options) {
  page.drawText(text, {
    x: options.x * INCH,
    y: options.y * INCH,
    size: options.size,
    font: options.font,
    color: options.color || FONT_COLOR
  });
}

function drawQty(page, qtyText, options) {
  const x = options.x * INCH;
  const y = options.y * INCH;
  const numberSize = 70;
  const suffixSize = 12;
  const numberWidth = options.numberFont.widthOfTextAtSize(qtyText, numberSize);

  page.drawText(qtyText, {
    x,
    y,
    size: numberSize,
    font: options.numberFont,
    color: FONT_COLOR
  });

  page.drawText("pz", {
    x: x + numberWidth + 3,
    y: y + 7,
    size: suffixSize,
    font: options.suffixFont,
    color: FONT_COLOR
  });
}

function buildOutputPath(outDir, order) {
  const teamPart = order.teamInfo ? `${order.line} ${order.teamInfo.team} ${order.teamInfo.nickname}` : order.line || "SIN_EQUIPO";
  const styleFamily = getStyleFamily(order.style);
  const fileName = [
    order.wo || `FILA ${String(order.sourceRow).padStart(3, "0")}`,
    teamPart,
    order.style,
    order.qty ? `${order.qty}pz` : "1pz"
  ].filter(Boolean).map(sanitizeFilePart).join(" - ");

  return path.join(outDir, styleFamily, order.size || "SIN_TALLA", `${fileName}.pdf`);
}

function buildSamplesOutputPath(outDir, order) {
  const teamPart = order.teamInfo ? `${order.line} ${order.teamInfo.team} ${order.teamInfo.nickname}` : order.line || "SIN_EQUIPO";
  const dateFolder = sanitizeFilePart(order.shipDate || "SIN_FECHA");
  const fileName = [
    order.wo || `FILA ${String(order.sourceRow).padStart(3, "0")}`,
    order.roster || "SIN_ROSTER",
    teamPart,
    order.style,
    order.qty ? `${order.qty}pz` : "1pz"
  ].filter(Boolean).map(sanitizeFilePart).join(" - ");

  return path.join(outDir, dateFolder, `${fileName}.pdf`);
}

function getSectionOutputRoot(outDir, sectionName, excelName) {
  const baseName = sanitizeFilePart(path.basename(clean(excelName) || "Excel", path.extname(clean(excelName) || ""))) || "Excel";
  return path.join(outDir, sectionName, baseName);
}

function getStyleFamily(style) {
  const match = cleanUpper(style).match(/^[AY][0-9]{4}/);
  return match ? match[0] : "SIN_STYLE";
}

async function generateMockups(options) {
  const mode = normalizeMode(options.mode);
  const excelName = options.excelName || options.excel || "Excel";
  const excel = options.excelBuffer ? readExcelBuffer(options.excelBuffer, mode) : readExcel(options.excel, mode);
  const filteredRows = filterRows(excel.rows, options);
  const consolidatedRows = mode === MODE_SAMPLES ? consolidateSampleRows(filteredRows) : consolidateRows(filteredRows);
  const rows = options.limit > 0 ? consolidatedRows.slice(0, options.limit) : consolidatedRows;
  const sectionName = mode === MODE_SAMPLES ? "Genericas Muestras" : "Por lote";
  const outputRoot = getSectionOutputRoot(options.out, sectionName, excelName);
  let ok = 0;
  let missing = 0;
  const outputs = [];
  const missingRows = [];

  console.log(`Excel: ${options.excel || excelName || "upload"}`);
  console.log(`Modo: ${mode}`);
  console.log(`Hoja: ${excel.sheetName}`);
  console.log(`Fecha: ${excel.dateText}`);
  console.log(`Filas Excel: ${excel.rows.length}`);
  console.log(`Filas seleccionadas: ${filteredRows.length}`);
  console.log(`Grupos consolidados: ${rows.length}`);

  for (const order of rows) {
    const mockupPath = buildMockupPath(options.mockups, order);

    if (!mockupPath || !fs.existsSync(mockupPath)) {
      missing++;
      missingRows.push({ sourceRow: order.sourceRow, style: order.style, color: order.color, mockupPath });
      console.warn(`Mockup faltante fila ${order.sourceRow}: ${order.style} | ${order.color} | ${mockupPath || "sin ruta"}`);
      continue;
    }

    const outputPath = mode === MODE_SAMPLES ? buildSamplesOutputPath(outputRoot, order) : buildOutputPath(outputRoot, order);
    const annotate = mode === MODE_SAMPLES ? annotateSamplesPdf : annotatePdf;
    await annotate({
      mockupPath,
      outputPath,
      order,
      dateText: excel.dateText,
      fontPath: options.font
    });
    ok++;
    outputs.push(outputPath);
    console.log(`OK fila ${order.sourceRow}: ${outputPath}`);
  }

  console.log(`Terminado. OK: ${ok} | Faltantes: ${missing}`);
  return {
    ok,
    missing,
    outputs,
    missingRows,
    dateText: excel.dateText,
    mode,
    out: outputRoot,
    rows: rows.length,
    selectedRows: filteredRows.length,
    totalRows: excel.rows.length,
    styles: uniqueSorted(rows.map(function (row) { return getStyleFamily(row.style); })),
    sizes: uniqueSorted(rows.map(function (row) { return row.size; }))
  };
}

function consolidateSampleRows(rows) {
  const groups = new Map();

  rows.forEach(function (row) {
    const key = [
      row.wo,
      row.roster,
      row.style,
      cleanUpper(row.color)
    ].join("||");
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, Object.assign({}, row, {
        qty: normalizeQty(row.qty),
        sourceRows: [row.sourceRow]
      }));
      return;
    }

    existing.qty += normalizeQty(row.qty);
    existing.sourceRows.push(row.sourceRow);
  });

  return Array.from(groups.values());
}

function consolidateRows(rows) {
  const groups = new Map();

  rows.forEach(function (row) {
    const key = [
      row.shipOrder,
      row.wo,
      row.style,
      cleanUpper(row.color)
    ].join("||");
    const existing = groups.get(key);

    if (!existing) {
      const first = Object.assign({}, row, {
        qty: normalizeQty(row.qty),
        sizes: row.size ? [row.size] : [],
        sourceRows: [row.sourceRow]
      });
      groups.set(key, first);
      return;
    }

    existing.qty += normalizeQty(row.qty);
    existing.sourceRows.push(row.sourceRow);
    if (row.size && existing.sizes.indexOf(row.size) === -1) {
      existing.sizes.push(row.size);
      existing.size = existing.sizes.join("-");
    }
  });

  return Array.from(groups.values()).map(function (row) {
    if (row.sizes && row.sizes.length > 1) {
      row.size = row.sizes.join("-");
    }

    return row;
  });
}

function normalizeQty(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 1;
}

function filterRows(rows, options) {
  const selectedStyles = new Set((options.styles || []).map(cleanUpper).filter(Boolean));
  const selectedSizes = new Set((options.sizes || []).map(cleanUpper).filter(Boolean));

  return rows.filter(function (row) {
    const rowFamily = getStyleFamily(row.style);
    const matchesStyle = selectedStyles.size === 0 || selectedStyles.has(rowFamily) || selectedStyles.has(row.style);
    const matchesSize = selectedSizes.size === 0 || selectedSizes.has(row.size);
    return matchesStyle && matchesSize;
  });
}

async function main() {
  const args = parseArgs(process.argv);
  await generateMockups(args);
}

if (require.main === module) {
  main().catch(function (error) {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_EXCEL,
  DEFAULT_MOCKUPS,
  DEFAULT_OUT,
  DEFAULT_ALDRICH_FONT,
  MODE_BULK,
  MODE_SAMPLES,
  buildMockupPath,
  buildOutputPath,
  buildSamplesOutputPath,
  generateMockups,
  readExcel,
  readExcelBuffer,
  summarizeExcel
};
