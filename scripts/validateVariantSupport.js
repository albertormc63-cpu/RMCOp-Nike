const fs = require("fs");
const path = require("path");
const { createOrderDataFromExcel } = require("../js/services/createOrderData");
const pathBuilder = require("../js/utils/pathBuilder");
const config = require("../js/config/config");

const fixtures = {
  standard: "/Volumes/Fullsize/TO PRINT/NIKE ORDERS/79229-26 PLL-Maryland-Whipsnakes-Home-Spallina-22/79229-26 Nike Whipsnakes Spallina 22 WO 173833 WO 173840.xls",
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

function validateAllStars() {
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
validateAllStars();
validateJrChampionship();

console.log("variant support OK");
