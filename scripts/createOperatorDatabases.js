#!/usr/bin/env node

const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const SQLITE_BIN = "/usr/bin/sqlite3";
const DEFAULT_SOURCE = "/Users/rmlsub1/Documents/RMC - CEP/RMC_BD/RMC_CEP.sqlite";
const DEFAULT_TARGET_ROOT = "/Volumes/Fullsize/PATRONES ACOMODADOS PARA ROLLO/NIKE LACROSSE/RMCOp-NIKE/ASSETS/BD";
const DEFAULT_OPERATORS = ["THANIA", "ANTONIO"];
const DEFAULT_CATALOG_TABLES = [
  "cep_registry",
  "rmc_nike_style_families",
  "rmc_nike_style_variants",
  "rmc_opt_schema_meta"
];

function parseArgs(argv) {
  const options = {
    source: DEFAULT_SOURCE,
    targetRoot: DEFAULT_TARGET_ROOT,
    operators: DEFAULT_OPERATORS.slice(),
    catalogTables: DEFAULT_CATALOG_TABLES.slice(),
    mode: "seed",
    force: false,
    dryRun: false
  };

  argv.forEach(function (arg) {
    if (arg === "--force") {
      options.force = true;
      return;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      return;
    }

    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (!match) {
      throw new Error(`Argumento no reconocido: ${arg}`);
    }

    const key = match[1];
    const value = match[2];

    if (key === "source") {
      options.source = value;
    } else if (key === "target-root") {
      options.targetRoot = value;
    } else if (key === "operators") {
      options.operators = splitList(value);
    } else if (key === "catalog-tables") {
      options.catalogTables = splitList(value);
    } else if (key === "mode") {
      options.mode = value;
    } else {
      throw new Error(`Opcion no reconocida: --${key}`);
    }
  });

  if (options.mode !== "seed" && options.mode !== "backup") {
    throw new Error("--mode debe ser seed o backup.");
  }

  if (!options.operators.length) {
    throw new Error("Debes indicar al menos un operador.");
  }

  return options;
}

function splitList(value) {
  return String(value || "")
    .split(",")
    .map(function (item) { return item.trim(); })
    .filter(Boolean);
}

function sqlText(value) {
  if (value == null) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function runSqlite(args, input) {
  const result = childProcess.spawnSync(SQLITE_BIN, args, {
    input: input || "",
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "sqlite3 fallo").trim());
  }

  return result.stdout || "";
}

function assertReady(options) {
  if (!fs.existsSync(SQLITE_BIN)) {
    throw new Error(`No se encontro sqlite3 en ${SQLITE_BIN}.`);
  }

  if (!fs.existsSync(options.source)) {
    throw new Error(`No existe la BD fuente: ${options.source}`);
  }

  const integrity = runSqlite([options.source, "PRAGMA integrity_check;"]).trim();
  if (integrity !== "ok") {
    throw new Error(`La BD fuente no paso integrity_check: ${integrity}`);
  }
}

function getSchema(sourcePath) {
  const schema = runSqlite([sourcePath, ".schema"]);
  return schema
    .split(/\r?\n/)
    .filter(function (line) {
      return !/^CREATE TABLE sqlite_sequence/i.test(line);
    })
    .join("\n");
}

function resetTarget(targetPath, force) {
  const relatedFiles = [targetPath, `${targetPath}-wal`, `${targetPath}-shm`];
  const existing = relatedFiles.filter(function (filePath) { return fs.existsSync(filePath); });

  if (!existing.length) {
    return;
  }

  if (!force) {
    throw new Error(`Ya existe ${targetPath}. Usa --force para reemplazarlo.`);
  }

  existing.forEach(function (filePath) {
    fs.rmSync(filePath, { force: true });
  });
}

function createSeedDatabase(options, operator, targetPath) {
  const schema = getSchema(options.source);
  const copyCatalogSql = options.catalogTables.map(function (tableName) {
    return `
DELETE FROM ${tableName};
INSERT INTO ${tableName}
SELECT *
FROM source.${tableName};
`;
  }).join("\n");

  runSqlite([targetPath], `
PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;
${schema}
COMMIT;
`);

  runSqlite([targetPath], `
PRAGMA foreign_keys = OFF;
ATTACH DATABASE ${sqlText(options.source)} AS source;
BEGIN TRANSACTION;
${copyCatalogSql}
COMMIT;
DETACH DATABASE source;
`);

  writeOperatorMetadata(options, operator, targetPath);
}

function createBackupDatabase(options, operator, targetPath) {
  runSqlite([options.source], `.backup ${sqlText(targetPath)}\n`);
  writeOperatorMetadata(options, operator, targetPath);
}

function writeOperatorMetadata(options, operator, targetPath) {
  runSqlite([targetPath], `
CREATE TABLE IF NOT EXISTS rmc_operator_db_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

INSERT INTO rmc_operator_db_meta (key, value, updated_at)
VALUES
  ('operator_code', ${sqlText(operator)}, datetime('now', 'localtime')),
  ('seed_mode', ${sqlText(options.mode)}, datetime('now', 'localtime')),
  ('seed_source_path', ${sqlText(options.source)}, datetime('now', 'localtime')),
  ('seed_created_at', datetime('now', 'localtime'), datetime('now', 'localtime'))
ON CONFLICT(key) DO UPDATE SET
  value = excluded.value,
  updated_at = datetime('now', 'localtime');

PRAGMA user_version = 1;
PRAGMA journal_mode = WAL;
`);
}

function countRows(dbPath, tableName) {
  return Number(runSqlite([dbPath, `SELECT COUNT(*) FROM ${tableName};`]).trim()) || 0;
}

function summarize(dbPath) {
  return {
    tables: Number(runSqlite([dbPath, "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%';"]).trim()) || 0,
    nikeRuns: countRows(dbPath, "rmcop_nike_runs"),
    nikeItems: countRows(dbPath, "rmcop_nike_items"),
    mockupRuns: countRows(dbPath, "rmc_mockuptool_runs"),
    mockupItems: countRows(dbPath, "rmc_mockuptool_items"),
    optOrders: countRows(dbPath, "rmc_opt_orders"),
    optOutputs: countRows(dbPath, "rmc_opt_roster_outputs"),
    styleFamilies: countRows(dbPath, "rmc_nike_style_families"),
    styleVariants: countRows(dbPath, "rmc_nike_style_variants")
  };
}

function createForOperator(options, operator) {
  const operatorCode = operator.trim().toUpperCase();
  const targetDir = path.join(options.targetRoot, operatorCode);
  const targetPath = path.join(targetDir, "RMC_CEP.sqlite");

  if (options.dryRun) {
    return {
      operator: operatorCode,
      targetPath: targetPath,
      skipped: true
    };
  }

  fs.mkdirSync(targetDir, { recursive: true });
  resetTarget(targetPath, options.force);

  if (options.mode === "seed") {
    createSeedDatabase(options, operatorCode, targetPath);
  } else {
    createBackupDatabase(options, operatorCode, targetPath);
  }

  return {
    operator: operatorCode,
    targetPath: targetPath,
    summary: summarize(targetPath)
  };
}

function printUsage() {
  console.log(`Uso:
  node scripts/createOperatorDatabases.js [opciones]

Opciones:
  --source=/ruta/RMC_CEP.sqlite
  --target-root=/ruta/BD
  --operators=THANIA,ANTONIO
  --mode=seed|backup
  --catalog-tables=cep_registry,rmc_nike_style_families,rmc_nike_style_variants,rmc_opt_schema_meta
  --force
  --dry-run

Modo recomendado:
  --mode=seed crea BDs con estructura completa y catalogos/base, pero sin historial operativo.
`);
}

function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printUsage();
    return;
  }

  const options = parseArgs(process.argv.slice(2));
  assertReady(options);

  const results = options.operators.map(function (operator) {
    return createForOperator(options, operator);
  });

  results.forEach(function (result) {
    console.log(`${result.operator}: ${result.targetPath}`);
    if (result.skipped) {
      console.log("  dry-run: no se escribio ningun archivo.");
      return;
    }

    console.log(`  tablas: ${result.summary.tables}`);
    console.log(`  catalogos: familias=${result.summary.styleFamilies}, variantes=${result.summary.styleVariants}`);
    console.log(`  operativo: nike_runs=${result.summary.nikeRuns}, nike_items=${result.summary.nikeItems}, mockup_runs=${result.summary.mockupRuns}, mockup_items=${result.summary.mockupItems}, opt_orders=${result.summary.optOrders}, opt_outputs=${result.summary.optOutputs}`);
  });
}

try {
  main();
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
