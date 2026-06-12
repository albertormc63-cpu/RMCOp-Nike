const SQLITE_BIN = "/usr/bin/sqlite3";
const SOURCE_APP = "RMCOp-Nike";
const RUNS_TABLE = "rmcop_nike_runs";
const ITEMS_TABLE = "rmcop_nike_items";
const COMMITS_TABLE = "rmcop_nike_git_commits";

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
  estado TEXT,
  error TEXT,
  tiempo TEXT,
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
}

function recordBatchRun(deps, dbPath, payload) {
  const run = payload.run || {};
  const results = payload.results || [];
  const now = new Date();
  const runId = run.id || `run-${Date.now()}`;
  const herramienta = run.herramienta || "RMCOp-Nike Por Lote";
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
  id, created_at, started_at, finished_at, tiempo, herramienta,
  pedidos, piezas, estilos, ok, errores, observaciones
) VALUES (
  ${sqlText(runId)},
  ${sqlText(formatDateOnly(run.finishedAt || run.startedAt || run.fecha || now))},
  ${sqlText(run.startedAt ? formatTimeOnly(run.startedAt) : "")},
  ${sqlText(run.finishedAt ? formatTimeOnly(run.finishedAt) : formatTimeOnly(now))},
  ${sqlText(formatDuration(elapsedSeconds))},
  ${sqlText(herramienta)},
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

    return `
INSERT INTO ${ITEMS_TABLE} (
  run_id, herramienta, fila_excel, wo, ship_order, style, style_family,
  equipo, variante, version, talla, piezas, nombre, numero, archivo,
  estado, error, tiempo
) VALUES (
  ${sqlText(runId)},
  ${sqlText(herramienta)},
  ${sqlNumber(result.sourceRow || order.sourceRow || 0)},
  ${sqlText(order.wo || "")},
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
  ${sqlText(result.ok ? "Completado" : "Error")},
  ${sqlText(result.ok ? "" : (result.message || "Error desconocido"))},
  ${sqlText(formatDuration(Math.max(1, Math.round((result.durationMs || 0) / 1000))))}
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

module.exports = {
  ensureSchema,
  recordBatchRun
};
