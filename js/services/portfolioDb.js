const SQLITE_BIN = "/usr/bin/sqlite3";
const SOURCE_APP = "RMCOp-Nike";
const RUNS_TABLE = "rmcop_nike_runs";
const ITEMS_TABLE = "rmcop_nike_items";
const COMMITS_TABLE = "rmcop_nike_git_commits";
const { normalizeShippingDate } = require("../utils/shippingDate");

function sqlText(value) {
  if (value == null) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : "0";
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function parseDate(value) {
  if (!value) return new Date();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function formatDateOnly(value) {
  const date = parseDate(value);
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function formatTimeOnly(value) {
  const date = parseDate(value);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function formatDuration(secondsValue) {
  const totalSeconds = Math.max(0, Math.round(Number(secondsValue) || 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

function resolveStoredPath(deps, value) {
  const pathValue = String(value || "").trim();
  return pathValue ? deps.path.resolve(pathValue) : null;
}

function normalizeKeyPart(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function buildOrderKey(order) {
  const hasName = normalizeKeyPart(order && order.name) !== "";
  const hasNumber = normalizeKeyPart(order && order.number) !== "";
  const keyName = hasName || hasNumber ? order && order.name : "SIN_DATOS";
  const isGeneric = order && (
    order.sourceFormat === "generic-roster" ||
    order.namingSource === "roster" ||
    order.herramienta === "RMCOp-Nike Genericas"
  );
  const orderIdentifier = isGeneric ? (order.roster || order.rosterNumber || order.wo) : order && order.wo;

  return [
    orderIdentifier,
    order && order.shipOrder,
    order && order.style,
    order && order.team,
    order && order.size,
    keyName,
    order && order.number
  ].map(normalizeKeyPart).join("|");
}

function execSql(deps, dbPath, sql) {
  if (!deps.childProcess || !deps.fs || !deps.path) {
    throw new Error("Dependencias Node incompletas para SQLite.");
  }

  if (!deps.fs.existsSync(SQLITE_BIN)) {
    throw new Error(`No se encontro sqlite3 en ${SQLITE_BIN}.`);
  }

  deps.fs.mkdirSync(deps.path.dirname(dbPath), { recursive: true });
  deps.childProcess.execFileSync(SQLITE_BIN, [dbPath], {
    input: sql,
    encoding: "utf8"
  });
}

function columnExists(deps, dbPath, tableName, columnName) {
  const output = deps.childProcess.execFileSync(SQLITE_BIN, [dbPath, `PRAGMA table_info(${tableName});`], {
    encoding: "utf8"
  });

  return output.split(/\r?\n/).some(function (line) {
    const parts = line.split("|");
    return parts[1] === columnName;
  });
}

function ensureColumn(deps, dbPath, tableName, columnName, definition) {
  if (columnExists(deps, dbPath, tableName, columnName)) {
    return;
  }

  execSql(deps, dbPath, `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`);
}

function parseTabRows(output) {
  return String(output || "")
    .split(/\r?\n/)
    .filter(function (line) { return line.trim() !== ""; })
    .map(function (line) { return line.split("\t"); });
}

function backfillMissingItemKeys(deps, dbPath) {
  const output = deps.childProcess.execFileSync(SQLITE_BIN, [dbPath], {
    input: `
.mode tabs
.headers off
SELECT id, herramienta, wo, roster, ship_order, style, equipo, talla, nombre, numero, clave
FROM ${ITEMS_TABLE}
WHERE clave IS NULL OR clave = '' OR herramienta = 'RMCOp-Nike Genericas';
`,
    encoding: "utf8"
  });
  const rows = parseTabRows(output);

  if (!rows.length) {
    return 0;
  }

  const updates = rows.map(function (row) {
    const id = row[0];
    const clave = buildOrderKey({
      herramienta: row[1],
      wo: row[2],
      roster: row[3],
      shipOrder: row[4],
      style: row[5],
      team: row[6],
      size: row[7],
      name: row[8],
      number: row[9]
    });

    if (clave === row[10]) {
      return "";
    }

    return `UPDATE ${ITEMS_TABLE} SET clave = ${sqlText(clave)} WHERE id = ${sqlNumber(id)};`;
  }).filter(Boolean);

  if (!updates.length) {
    return 0;
  }

  execSql(deps, dbPath, `
BEGIN TRANSACTION;
${updates.join("\n")}
COMMIT;
`);

  return updates.length;
}

function normalizeExistingShippingDates(deps, dbPath) {
  const targets = [
    { table: RUNS_TABLE, idColumn: "id", numericId: false },
    { table: ITEMS_TABLE, idColumn: "id", numericId: true }
  ];
  const updates = [];

  targets.forEach(function (target) {
    const output = deps.childProcess.execFileSync(SQLITE_BIN, [dbPath], {
      input: `
.mode tabs
.headers off
SELECT ${target.idColumn}, fecha_embarque
FROM ${target.table}
WHERE TRIM(COALESCE(fecha_embarque, '')) <> '';
`,
      encoding: "utf8"
    });

    parseTabRows(output).forEach(function (row) {
      const currentValue = row[1];
      const normalizedValue = normalizeShippingDate(currentValue);

      if (normalizedValue && normalizedValue !== currentValue) {
        const sqlId = target.numericId ? sqlNumber(row[0]) : sqlText(row[0]);
        updates.push(`UPDATE ${target.table} SET fecha_embarque = ${sqlText(normalizedValue)} WHERE ${target.idColumn} = ${sqlId};`);
      }
    });
  });

  if (updates.length) {
    execSql(deps, dbPath, `BEGIN TRANSACTION;\n${updates.join("\n")}\nCOMMIT;`);
  }

  execSql(deps, dbPath, `
UPDATE ${ITEMS_TABLE}
SET fecha_embarque = (
  SELECT ${RUNS_TABLE}.fecha_embarque
  FROM ${RUNS_TABLE}
  WHERE ${RUNS_TABLE}.id = ${ITEMS_TABLE}.run_id
)
WHERE TRIM(COALESCE(${ITEMS_TABLE}.fecha_embarque, '')) = ''
  AND ${ITEMS_TABLE}.herramienta IN ('RMCOp-Nike Personalizadas', 'RMCOp-Nike Genericas')
  AND EXISTS (
    SELECT 1
    FROM ${RUNS_TABLE}
    WHERE ${RUNS_TABLE}.id = ${ITEMS_TABLE}.run_id
      AND TRIM(COALESCE(${RUNS_TABLE}.fecha_embarque, '')) <> ''
  );
`);

  return updates.length;
}

function ensureSchema(deps, dbPath) {
  execSql(deps, dbPath, `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS cep_registry (
  source_app TEXT PRIMARY KEY,
  runs_table TEXT NOT NULL,
  app_version TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS ${RUNS_TABLE} (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  tiempo TEXT,
  herramienta TEXT,
  fecha_embarque TEXT,
  excel_path TEXT,
  output_root TEXT,
  pedidos INTEGER DEFAULT 0,
  piezas INTEGER DEFAULT 0,
  estilos INTEGER DEFAULT 0,
  ok INTEGER DEFAULT 0,
  errores INTEGER DEFAULT 0,
  observaciones TEXT
);

CREATE TABLE IF NOT EXISTS ${ITEMS_TABLE} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  herramienta TEXT,
  fila_excel INTEGER,
  wo TEXT,
  roster TEXT,
  ship_order TEXT,
  style TEXT,
  style_family TEXT,
  equipo TEXT,
  variante TEXT,
  version TEXT,
  talla TEXT,
  piezas INTEGER DEFAULT 1,
  nombre TEXT,
  numero TEXT,
  archivo TEXT,
  path TEXT,
  estado TEXT,
  error TEXT,
  tiempo TEXT,
  fecha_embarque TEXT,
  clave TEXT,
  FOREIGN KEY (run_id) REFERENCES ${RUNS_TABLE}(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ${COMMITS_TABLE} (
  hash TEXT PRIMARY KEY,
  branch TEXT,
  author TEXT,
  fecha TEXT,
  message TEXT,
  files TEXT,
  change_type TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rmcop_nike_items_run_id ON rmcop_nike_items(run_id);
CREATE INDEX IF NOT EXISTS idx_rmcop_nike_items_wo ON rmcop_nike_items(wo);
CREATE INDEX IF NOT EXISTS idx_rmcop_nike_items_style ON rmcop_nike_items(style);
CREATE INDEX IF NOT EXISTS idx_rmcop_nike_runs_created_at ON rmcop_nike_runs(created_at);
CREATE INDEX IF NOT EXISTS idx_rmcop_nike_runs_herramienta ON rmcop_nike_runs(herramienta);

INSERT INTO cep_registry (source_app, runs_table, app_version, updated_at)
VALUES (${sqlText(SOURCE_APP)}, ${sqlText(RUNS_TABLE)}, '1.0.0', datetime('now', 'localtime'))
ON CONFLICT(source_app) DO UPDATE SET
  runs_table = excluded.runs_table,
  app_version = excluded.app_version,
  updated_at = datetime('now', 'localtime');
`);

  ensureColumn(deps, dbPath, ITEMS_TABLE, "clave", "TEXT");
  ensureColumn(deps, dbPath, ITEMS_TABLE, "roster", "TEXT");
  ensureColumn(deps, dbPath, RUNS_TABLE, "fecha_embarque", "TEXT");
  ensureColumn(deps, dbPath, RUNS_TABLE, "excel_path", "TEXT");
  ensureColumn(deps, dbPath, RUNS_TABLE, "output_root", "TEXT");
  ensureColumn(deps, dbPath, ITEMS_TABLE, "fecha_embarque", "TEXT");
  ensureColumn(deps, dbPath, ITEMS_TABLE, "path", "TEXT");
  backfillMissingItemKeys(deps, dbPath);
  normalizeExistingShippingDates(deps, dbPath);
  execSql(deps, dbPath, `CREATE INDEX IF NOT EXISTS idx_rmcop_nike_items_clave ON ${ITEMS_TABLE}(clave);`);
  execSql(deps, dbPath, `CREATE UNIQUE INDEX IF NOT EXISTS idx_rmcop_nike_items_clave_completada
    ON ${ITEMS_TABLE}(clave)
    WHERE TRIM(COALESCE(clave, '')) <> '' AND estado = 'Completado';`);
  execSql(deps, dbPath, `CREATE UNIQUE INDEX IF NOT EXISTS idx_rmcop_nike_items_path_completado
    ON ${ITEMS_TABLE}(path)
    WHERE TRIM(COALESCE(path, '')) <> '' AND estado = 'Completado';`);
  execSql(deps, dbPath, `CREATE INDEX IF NOT EXISTS idx_rmcop_nike_items_roster ON ${ITEMS_TABLE}(roster);`);
  execSql(deps, dbPath, `CREATE INDEX IF NOT EXISTS idx_rmcop_nike_runs_fecha_embarque ON ${RUNS_TABLE}(fecha_embarque);`);
  execSql(deps, dbPath, `CREATE INDEX IF NOT EXISTS idx_rmcop_nike_items_fecha_embarque ON ${ITEMS_TABLE}(fecha_embarque);`);
}

function recordBatchRun(deps, dbPath, payload) {
  const run = payload.run || {};
  const results = payload.results || [];
  const now = new Date();
  const runId = run.id || `run-${Date.now()}`;
  const herramienta = run.herramienta || "RMCOp-Nike Personalizadas";
  const fechaEmbarque = normalizeShippingDate(run.fechaEmbarque || "");
  const excelPath = resolveStoredPath(deps, run.sourceExcel);
  const outputRoot = resolveStoredPath(deps, run.destinationFolder);
  const elapsedSeconds = Math.max(0, Math.round(Number(run.elapsedSeconds) || 0));
  const totalPieces = results.reduce(function (total, result) {
    const order = result.order || {};
    return total + (Number(order.qty) || 1);
  }, 0);
  const styles = results.reduce(function (set, result) {
    const order = result.order || {};
    if (order.style) set[order.style] = true;
    return set;
  }, {});
  const okCount = results.filter(function (result) { return result.ok; }).length;
  const errorCount = results.length - okCount;

  ensureSchema(deps, dbPath);

  const runSql = `
INSERT OR REPLACE INTO ${RUNS_TABLE} (
  id, created_at, started_at, finished_at, tiempo, herramienta, fecha_embarque, excel_path, output_root,
  pedidos, piezas, estilos, ok, errores, observaciones
) VALUES (
  ${sqlText(runId)},
  ${sqlText(formatDateOnly(run.finishedAt || run.startedAt || run.fecha || now))},
  ${sqlText(run.startedAt ? formatTimeOnly(run.startedAt) : "")},
  ${sqlText(run.finishedAt ? formatTimeOnly(run.finishedAt) : formatTimeOnly(now))},
  ${sqlText(formatDuration(elapsedSeconds))},
  ${sqlText(herramienta)},
  ${sqlText(fechaEmbarque)},
  ${sqlText(excelPath)},
  ${sqlText(outputRoot)},
  ${sqlNumber(results.length)},
  ${sqlNumber(totalPieces)},
  ${sqlNumber(Object.keys(styles).length)},
  ${sqlNumber(okCount)},
  ${sqlNumber(errorCount)},
  ${sqlText(run.notes || "")}
);

DELETE FROM ${ITEMS_TABLE} WHERE run_id = ${sqlText(runId)};
`;

  const itemSql = results.map(function (result) {
    const order = result.order || {};
    const clave = result.clave || buildOrderKey(order);
    const outputPath = result.ok ? resolveStoredPath(deps, result.outputPath) : null;

    return `
INSERT OR IGNORE INTO ${ITEMS_TABLE} (
  run_id, herramienta, fila_excel, wo, roster, ship_order, style, style_family,
  equipo, variante, version, talla, piezas, nombre, numero, archivo, path,
  estado, error, tiempo, fecha_embarque, clave
) VALUES (
  ${sqlText(runId)},
  ${sqlText(herramienta)},
  ${sqlNumber(result.sourceRow || order.sourceRow || 0)},
  ${sqlText(order.wo || "")},
  ${sqlText(order.roster || order.rosterNumber || "")},
  ${sqlText(order.shipOrder || "")},
  ${sqlText(order.style || "")},
  ${sqlText(order.styleFamily || "")},
  ${sqlText(order.team || "")},
  ${sqlText(order.variant || "")},
  ${sqlText(order.version || "")},
  ${sqlText(order.size || result.size || "")},
  ${sqlNumber(order.qty || 1)},
  ${sqlText(order.name || "")},
  ${sqlText(order.number || "")},
  ${sqlText(result.outputName || "")},
  ${sqlText(outputPath)},
  ${sqlText(result.ok ? "Completado" : "Error")},
  ${sqlText(result.ok ? "" : (result.message || "Error desconocido"))},
  ${sqlText(formatDuration(Math.max(1, Math.round((result.durationMs || 0) / 1000))))},
  ${sqlText(normalizeShippingDate(order.shippingDate || fechaEmbarque))},
  ${sqlText(clave)}
);
`;
  }).join("\n");

  execSql(deps, dbPath, `
PRAGMA foreign_keys = ON;
BEGIN TRANSACTION;
${runSql}
${itemSql}
COMMIT;
`);

  return {
    dbPath: dbPath,
    runId: runId,
    okCount: okCount,
    errorCount: errorCount,
    totalPieces: totalPieces,
    totalStyles: Object.keys(styles).length
  };
}

function listExistingItemKeys(deps, dbPath, keys) {
  const uniqueKeys = Array.from(new Set((keys || []).filter(Boolean)));

  ensureSchema(deps, dbPath);

  if (!uniqueKeys.length) {
    return {};
  }

  const sql = `
.mode tabs
.headers off
SELECT clave, COUNT(*)
FROM ${ITEMS_TABLE}
WHERE clave IN (${uniqueKeys.map(sqlText).join(",")})
  AND estado = 'Completado'
GROUP BY clave;
`;
  const output = deps.childProcess.execFileSync(SQLITE_BIN, [dbPath], {
    input: sql,
    encoding: "utf8"
  });
  const lookup = {};

  output.split(/\r?\n/).forEach(function (line) {
    if (!line.trim()) return;
    const parts = line.split("\t");
    lookup[parts[0]] = Number(parts[1] || 0);
  });

  return lookup;
}

module.exports = {
  backfillMissingItemKeys,
  buildOrderKey,
  ensureSchema,
  listExistingItemKeys,
  normalizeExistingShippingDates,
  recordBatchRun
};
