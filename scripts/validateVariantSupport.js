const fs = require("fs");
const path = require("path");
const { createOrderDataFromExcel } = require("../js/services/createOrderData");
const pathBuilder = require("../js/utils/pathBuilder");
const config = require("../js/config/config");

const fixtures = {
  standard: "/Volumes/Fullsize/TO PRINT/NIKE ORDERS/79229-26 PLL-Maryland-Whipsnakes-Home-Spallina-22/79229-26 Nike Whipsnakes Spallina 22 WO 173833 WO 173840.xls",
  standardOd: "/Volumes/Fullsize/TO PRINT/NIKE ORDERS/LISTAS ON DEMAND/NIKE OD 3 JUL.xlsx",
  allStarsOd: "/Volumes/Fullsize/TO PRINT/NIKE ORDERS/LISTAS ON DEMAND/Copia de NIKE OD 3 JUL.xlsx",
  wllCharging: "/Volumes/Fullsize/TO PRINT/NIKE ORDERS/NIKE JUNIO/78326-26 WLL-New-York-Charging-Home-Scane-27/78326-26 WLL NY Scane 27.xls",
  starsStripes: "/Volumes/Fullsize/New Art/79405-26 PLL-GBF/79405-26 Nike Stars and Stripes Green Beret WO 174212 WO 17.xls",
  jrJersey: "/Volumes/Fullsize/New Art/79426-26 PLL-Maryland-Whipsnakes-Jr.Champ/79426-26 JR Championship Whipsnakes Jersey WO 174316.xls",
  jrShorts: "/Volumes/Fullsize/New Art/79438-26 PLL-Carolina-Chaos-Jr.Champ-Shorts/79438-26 Jr Championship Chaos Shorts WO 174296 WO 174304.xls"
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function buildGenericOutputName(order) {
  return pathBuilder.buildOutputName(Object.assign({}, order, {
    wo: order.roster || order.rosterNumber || order.rosterName || order.wo
  }));
}

function buildTemplatePath(order) {
  return pathBuilder.buildTemplatePath({
    basePath: config.paths[config.mode].templatesBase,
    team: order.team,
    variant: order.variant,
    version: order.version,
    style: order.style,
    size: order.size,
    designCode: order.designCode
  });
}

function validateStandard() {
  const data = createOrderDataFromExcel(fixtures.standard);
  assert(data.sourceFormat === "generic-roster", "Standard debe detectarse como generic-roster.");
  assert(data.validRows.length === 8, "Standard debe conservar 8 filas validas.");
  assert(data.invalidRows.length === 0, "Standard no debe producir filas invalidas.");
  assert(data.validRows[0].variant === "Standard", "Standard debe conservar variante Standard.");
  assert(data.validRows[0].styleFamily === "A1000", "A1000H debe agruparse como A1000.");
  assert(buildGenericOutputName(data.validRows[0]) === "79229-26 PLL-Maryland Whipsnakes A1000H SM 22.pdf", "Naming Standard cambio inesperadamente.");

  const odData = createOrderDataFromExcel(fixtures.standardOd);
  assert(odData.sourceFormat === "on-demand", "Standard OD debe detectarse como on-demand.");
  assert(odData.validRows.length === 145, "Standard OD debe conservar 145 filas validas.");
  assert(odData.invalidRows.length === 0, "Standard OD no debe producir filas invalidas.");
  assert(odData.validRows[0].wo === "174137", "Standard OD debe conservar WO en la columna esperada.");
  assert(odData.validRows[0].shipOrder === "5500155", "Standard OD debe conservar Ship Order en la columna esperada.");
}

function validateStarsStripes() {
  const data = createOrderDataFromExcel(fixtures.starsStripes);
  assert(data.sourceFormat === "generic-roster", "SS debe detectarse como generic-roster.");
  assert(data.validRows.length === 8, "SS Green Beret debe quedar reconocible como 8 filas validas.");
  assert(data.invalidRows.length === 0, "SS Green Beret no debe fallar por falta de equipo.");

  const first = data.validRows[0];
  assert(first.variant === "Stars & Stripes", "A1000SS debe mapear a Stars & Stripes.");
  assert(first.variantCode === "SS", "A1000SS debe guardar variantCode SS.");
  assert(first.designCode === "GNB1", "GNB1 Green Beret debe resolver designCode GNB1.");
  assert(first.designName === "Green Beret Foundation", "GNB1 debe resolver nombre visible.");
  assert(first.styleFamily === "A1000", "A1000SS debe agruparse como A1000.");
  assert(buildGenericOutputName(first) === "79405-26 GNB1 A1000SS SM SIN_DATOS.pdf", "Naming SS no coincide.");

  const smTemplate = buildTemplatePath(first);
  assert(fs.existsSync(smTemplate), `Debe existir plantilla SS SM: ${smTemplate}`);

  data.validRows.forEach(function (row) {
    const templatePath = buildTemplatePath(row);
    assert(fs.existsSync(templatePath), `Debe existir plantilla SS para fila ${row.sourceRow}: ${templatePath}`);
  });
}

function validateWllCharging() {
  const data = createOrderDataFromExcel(fixtures.wllCharging);
  assert(data.sourceFormat === "generic-roster", "WLL Charging debe detectarse como generic-roster.");
  assert(data.validRows.length === 9, "WLL Charging debe conservar 9 filas validas.");
  assert(data.invalidRows.length === 0, "WLL Charging no debe fallar cuando Color trae solo A002.");
  assert(data.validRows[0].team === "New York", "WLL Charging debe resolver equipo desde la ruta del roster.");
  assert(data.counts.byStyleFamily.A2000 === 6, "WLL Charging debe reconocer 6 filas A2000.");
  assert(data.counts.byStyleFamily.Y2000 === 3, "WLL Charging debe reconocer 3 filas Y2000.");
}

function validateAllStars() {
  const data = createOrderDataFromExcel(fixtures.allStarsOd);
  const designCounts = data.validRows.reduce(function (counts, row) {
    counts[row.designCode] = (counts[row.designCode] || 0) + 1;
    return counts;
  }, {});
  const versionCounts = data.validRows.reduce(function (counts, row) {
    counts[row.version] = (counts[row.version] || 0) + 1;
    return counts;
  }, {});

  assert(data.sourceFormat === "on-demand", "AS OD debe detectarse como on-demand.");
  assert(data.validRows.length === 37, "AS OD debe conservar 37 filas validas.");
  assert(data.invalidRows.length === 0, "AS OD no debe producir filas invalidas.");
  assert(data.validRows[0].wo === "174254", "AS OD debe corregir WO cuando viene invertido con Ship Order.");
  assert(data.validRows[0].shipOrder === "5506198", "AS OD debe corregir Ship Order cuando viene invertido con WO.");
  assert(designCounts["AS-M-TA"] === 26, "AS OD TeamA debe mapear 26 filas a AS-M-TA.");
  assert(designCounts["AS-M-TB"] === 11, "AS OD TeamB debe mapear 11 filas a AS-M-TB.");
  assert(versionCounts.Home === 26, "AS OD TeamA debe quedar como Home.");
  assert(versionCounts.Away === 11, "AS OD TeamB debe quedar como Away.");

  const homeOrder = {
    team: "",
    variant: "All Stars",
    variantCode: "AS",
    version: "Home",
    style: "Y1000AS",
    size: "LG",
    number: "",
    name: "",
    wo: "AS-TEST"
  };
  const homeTemplate = buildTemplatePath(homeOrder);
  assert(fs.existsSync(homeTemplate), `Debe existir plantilla AS Home confirmada: ${homeTemplate}`);

  const awayOrder = Object.assign({}, homeOrder, { version: "Away" });
  const awayTemplate = buildTemplatePath(awayOrder);
  assert(!fs.existsSync(awayTemplate), `AS Away debe quedar bloqueado hasta agregar plantilla: ${awayTemplate}`);

  assert(buildGenericOutputName(homeOrder) === "AS-TEST PLL-All Stars HOME Y1000AS LG SIN_DATOS.pdf", "Naming AS Home no coincide.");
}

function validateJrChampionship() {
  const jerseyData = createOrderDataFromExcel(fixtures.jrJersey);
  assert(jerseyData.validRows.length === 48, "JR jersey debe conservar 48 filas validas.");
  assert(jerseyData.invalidRows.length === 0, "JR jersey no debe producir filas invalidas.");
  assert(jerseyData.validRows[0].variant === "JR Championship", "A1000JR debe mapear a JR Championship.");
  assert(jerseyData.validRows[0].variantCode === "JR", "A1000JR debe guardar variantCode JR.");
  assert(jerseyData.validRows[0].styleFamily === "A1000", "A1000JR debe agruparse como A1000.");

  const shortsData = createOrderDataFromExcel(fixtures.jrShorts);
  assert(shortsData.validRows.length === 6, "JR shorts debe reconocer 6 filas validas.");
  assert(shortsData.invalidRows.length === 0, "JR shorts no debe fallar por familia 1500.");
  assert(shortsData.validRows[0].variant === "JR Championship", "A1500JR debe mapear a JR Championship.");
  assert(shortsData.validRows[0].styleFamily === "A1500", "A1500JR debe agruparse como A1500.");
  assert(buildGenericOutputName(shortsData.validRows[0]) === "79438-26 PLL-Carolina Chaos A1500JR SM SIN_DATOS.pdf", "Naming JR shorts no coincide.");

  const carolinaTemplate = buildTemplatePath(shortsData.validRows[0]);
  assert(!fs.existsSync(carolinaTemplate), `Carolina A1500JR debe quedar bloqueado hasta agregar plantilla: ${carolinaTemplate}`);

  const bostonShorts = Object.assign({}, shortsData.validRows[0], {
    team: "Boston",
    style: "A1500JR",
    size: "SM"
  });
  const bostonTemplate = buildTemplatePath(bostonShorts);
  assert(fs.existsSync(bostonTemplate), `Boston A1500JR debe resolver plantilla existente: ${bostonTemplate}`);
}

validateStandard();
validateStarsStripes();
validateWllCharging();
validateAllStars();
validateJrChampionship();

console.log("variant support OK");
