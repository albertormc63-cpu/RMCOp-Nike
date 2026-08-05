#!/usr/bin/env node

const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");
const config = require("../js/config/config");

const SQLITE_BIN = "/usr/bin/sqlite3";
const DEFAULT_OUTPUT = path.join(__dirname, "../js/config/styleVariantReserve.json");

function parseArgs(argv) {
  const options = {
    db: config.portfolio && config.portfolio.databasePath,
    output: DEFAULT_OUTPUT
  };

  argv.forEach(function (arg) {
    const match = arg.match(/^--([^=]+)=(.*)$/);

    if (!match) {
      throw new Error(`Argumento no reconocido: ${arg}`);
    }

    if (match[1] === "db") {
      options.db = match[2];
    } else if (match[1] === "output") {
      options.output = match[2];
    } else {
      throw new Error(`Opcion no reconocida: --${match[1]}`);
    }
  });

  return options;
}

function runSqlite(dbPath, sql) {
  const result = childProcess.spawnSync(SQLITE_BIN, [dbPath], {
    input: sql,
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "sqlite3 fallo").trim());
  }

  return result.stdout || "";
}

function parseTabRows(output) {
  return String(output || "")
    .split(/\r?\n/)
    .filter(function (line) { return line.trim() !== ""; })
    .map(function (line) { return line.split("\t"); });
}

function splitAliases(value) {
  return String(value || "")
    .split(/[,;|]/)
    .map(function (part) { return part.trim(); })
    .filter(Boolean);
}

function splitScope(value) {
  return splitAliases(value).map(function (part) { return part.toUpperCase(); });
}

function rowToEntry(row) {
  return {
    id: row[0] || "",
    variantCode: row[1] || "",
    variantName: row[2] || "",
    liga: row[3] || "",
    teamGender: row[4] || "",
    teamMarket: row[5] || "",
    teamMascot: row[6] || "",
    designCode: row[7] || "",
    designName: row[8] || "",
    templateNamePlaceholder: row[9] || "",
    templateNumberPlaceholder: row[10] || "",
    isActive: row[11] !== "0",
    isOfficialTeam: row[12] === "1",
    requiresDesignCode: row[13] === "1",
    aliases: splitAliases(row[14]),
    opnikeEnabled: row[15] === "1",
    opnikeRuleStatus: row[16] || "",
    opnikeStyleScope: splitScope(row[17]),
    opnikeLigaScope: splitScope(row[18]),
    opnikeVariantRootFolder: row[19] || "",
    opnikeDesignFolder: row[20] || "",
    opnikeTemplateCode: row[21] || "",
    opnikeResolutionStrategy: row[22] || ""
  };
}

function readVariants(dbPath) {
  const output = runSqlite(dbPath, `
.mode tabs
.headers off
SELECT id, variant_code, variant_name, liga, team_gender, team_market, team_mascot,
       design_code, design_name, template_name_placeholder, template_number_placeholder,
       is_active, is_official_team, requires_design_code, aliases, opnike_enabled,
       opnike_rule_status, opnike_style_scope, opnike_liga_scope, opnike_variant_root_folder,
       opnike_design_folder, opnike_template_code, opnike_resolution_strategy
FROM rmc_nike_style_variants
WHERE variant_code IS NOT NULL
  AND TRIM(variant_code) <> ''
ORDER BY variant_code, variant_name, team_market, design_code, id;
`);

  return parseTabRows(output).map(rowToEntry);
}

function writeReserve(outputPath, variants) {
  const payload = {
    schemaVersion: 1,
    source: {
      table: "rmc_nike_style_variants",
      syncedAt: new Date().toISOString()
    },
    variants: variants
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(SQLITE_BIN)) {
    throw new Error(`No se encontro sqlite3 en ${SQLITE_BIN}.`);
  }

  if (!options.db || !fs.existsSync(options.db)) {
    throw new Error(`No existe la BD fuente: ${options.db || "(vacia)"}`);
  }

  const variants = readVariants(options.db);
  writeReserve(options.output, variants);
  console.log(`styleVariantReserve actualizado: ${options.output}`);
  console.log(`Variantes exportadas: ${variants.length}`);
}

main();
