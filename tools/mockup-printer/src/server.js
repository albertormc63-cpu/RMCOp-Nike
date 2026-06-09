#!/usr/bin/env node

const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const {
  DEFAULT_ALDRICH_FONT,
  DEFAULT_MOCKUPS,
  DEFAULT_OUT,
  generateMockups
} = require("./generate");

const PORT = Number(process.env.PORT || 3127);
const HOST = process.env.HOST || "127.0.0.1";

function sendHtml(res) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Nike Mockup Printer</title>
  <style>
    :root { --bg:#202124; --panel:#2b2d31; --line:#474b52; --text:#f4f4f2; --muted:#b8bcc4; --accent:#bd1f36; --focus:#f7c948; }
    * { box-sizing: border-box; }
    body { margin:0; padding:18px; background:var(--bg); color:var(--text); font:14px/1.4 Arial, sans-serif; }
    main { max-width: 860px; margin: 0 auto; }
    h1 { margin: 0 0 14px; font-size: 22px; }
    .panel { display:grid; gap:14px; padding:16px; border:1px solid var(--line); border-radius:6px; background:var(--panel); }
    label { display:grid; gap:6px; color:var(--muted); font-size:12px; }
    input { width:100%; min-height:38px; padding:8px; border:1px solid #555b64; border-radius:5px; background:#181a1d; color:var(--text); }
    button { min-height:40px; border:0; border-radius:5px; background:var(--accent); color:white; font-weight:700; cursor:pointer; }
    .field-row { display:grid; grid-template-columns: 1fr 120px; gap:8px; align-items:end; }
    .browse { background:#4a4f59; }
    button:disabled { opacity:.55; cursor:not-allowed; }
    pre { min-height:180px; margin:0; padding:12px; overflow:auto; border:1px solid #333842; border-radius:5px; background:#151719; color:#d7f7d4; white-space:pre-wrap; }
    .hint { margin:0; color:var(--muted); font-size:12px; }
  </style>
</head>
<body>
  <main>
    <h1>Nike Mockup Printer</h1>
    <form id="form" class="panel">
      <label>Excel
        <input id="excel" name="excel" type="file" accept=".xlsx,.xls" required>
      </label>
      <label>Carpeta base de mockups
        <span class="field-row">
          <input id="mockups" name="mockups" value="${escapeHtml(DEFAULT_MOCKUPS)}">
          <button class="browse" type="button" data-browse="folder" data-target="mockups">Examinar</button>
        </span>
      </label>
      <label>Carpeta donde guardar PDFs listos
        <span class="field-row">
          <input id="out" name="out" value="${escapeHtml(path.resolve(DEFAULT_OUT))}">
          <button class="browse" type="button" data-browse="folder" data-target="out">Examinar</button>
        </span>
      </label>
      <label>Fuente Aldrich
        <span class="field-row">
          <input id="font" name="font" value="${escapeHtml(DEFAULT_ALDRICH_FONT)}">
          <button class="browse" type="button" data-browse="file" data-target="font">Examinar</button>
        </span>
      </label>
      <p class="hint">Los botones de ruta abren el selector de macOS desde este servidor local.</p>
      <button id="submit" type="submit">Generar mockups listos</button>
      <pre id="log">Selecciona un Excel y genera los PDFs.</pre>
    </form>
  </main>
  <script>
    const form = document.getElementById("form");
    const log = document.getElementById("log");
    const button = document.getElementById("submit");

    document.querySelectorAll("[data-browse]").forEach((browseButton) => {
      browseButton.addEventListener("click", async () => {
        const target = document.getElementById(browseButton.dataset.target);
        const endpoint = browseButton.dataset.browse === "file" ? "/choose-file" : "/choose-folder";
        browseButton.disabled = true;

        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ current: target.value, target: browseButton.dataset.target })
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "No se pudo seleccionar ruta.");
          if (data.path) target.value = data.path;
        } catch (error) {
          log.textContent = "ERROR AL EXAMINAR:\\n" + error.message;
        } finally {
          browseButton.disabled = false;
        }
      });
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      button.disabled = true;
      log.textContent = "Procesando...";

      try {
        const response = await fetch("/generate", { method: "POST", body: new FormData(form) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Error desconocido");
        log.textContent = [
          "Terminado.",
          "Filas leidas: " + data.rows,
          "PDFs generados: " + data.ok,
          "Mockups faltantes: " + data.missing,
          "Fecha: " + data.dateText,
          "Salida: " + data.out,
          "",
          "Primeros archivos:",
          ...(data.outputs || []).slice(0, 20)
        ].join("\\n");
      } catch (error) {
        log.textContent = "ERROR:\\n" + error.message;
      } finally {
        button.disabled = false;
      }
    });
  </script>
</body>
</html>`);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readRequest(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function readJsonRequest(req) {
  return readRequest(req).then((buffer) => {
    if (!buffer.length) return {};
    return JSON.parse(buffer.toString("utf8"));
  });
}

function choosePath(kind, currentPath) {
  const resolvedPath = currentPath ? path.resolve(currentPath) : "";
  const defaultPath = getExistingDefaultPath(kind, resolvedPath);
  const prompt = kind === "file" ? "Selecciona la fuente Aldrich" : "Selecciona la carpeta";
  const script = kind === "file"
    ? [
        `set selectedPath to choose file with prompt "${prompt}"`,
        "POSIX path of selectedPath"
      ].join("\n")
    : [
        `set selectedPath to choose folder with prompt "${prompt}"`,
        "POSIX path of selectedPath"
      ].join("\n");
  const args = ["-e", script];

  if (defaultPath) {
    const defaultScript = kind === "file"
      ? `set selectedPath to choose file with prompt "${prompt}" default location POSIX file "${escapeAppleScript(defaultPath)}"`
      : `set selectedPath to choose folder with prompt "${prompt}" default location POSIX file "${escapeAppleScript(defaultPath)}"`;
    args[1] = [defaultScript, "POSIX path of selectedPath"].join("\n");
  }

  return new Promise((resolve, reject) => {
    execFile("osascript", args, (error, stdout, stderr) => {
      if (error) {
        const message = cleanAppleScriptError(stderr) || cleanAppleScriptError(error.message) || "Seleccion cancelada.";
        reject(new Error(message));
        return;
      }

      resolve(stdout.trim());
    });
  });
}

function getExistingDefaultPath(kind, selectedPath) {
  if (!selectedPath) return "";
  if (fs.existsSync(selectedPath)) {
    const stats = fs.statSync(selectedPath);
    if (kind === "file") return stats.isDirectory() ? selectedPath : path.dirname(selectedPath);
    return stats.isDirectory() ? selectedPath : path.dirname(selectedPath);
  }

  const parent = path.dirname(selectedPath);
  return fs.existsSync(parent) ? parent : "";
}

function escapeAppleScript(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function cleanAppleScriptError(value) {
  return String(value || "").replace(/^execution error:\s*/i, "").trim();
}

function parseMultipart(buffer, contentType) {
  const boundaryMatch = /boundary=(.+)$/i.exec(contentType || "");
  if (!boundaryMatch) {
    throw new Error("No se recibio multipart/form-data.");
  }

  const boundary = Buffer.from("--" + boundaryMatch[1]);
  const parts = [];
  let start = buffer.indexOf(boundary);

  while (start !== -1) {
    start += boundary.length;
    if (buffer[start] === 45 && buffer[start + 1] === 45) break;
    if (buffer[start] === 13 && buffer[start + 1] === 10) start += 2;

    const next = buffer.indexOf(boundary, start);
    if (next === -1) break;

    let part = buffer.slice(start, next);
    if (part[part.length - 2] === 13 && part[part.length - 1] === 10) {
      part = part.slice(0, -2);
    }
    parts.push(parsePart(part));
    start = next;
  }

  return parts.reduce((fields, part) => {
    fields[part.name] = part;
    return fields;
  }, {});
}

function parsePart(part) {
  const separator = Buffer.from("\r\n\r\n");
  const separatorIndex = part.indexOf(separator);
  const rawHeaders = part.slice(0, separatorIndex).toString("utf8");
  const data = part.slice(separatorIndex + separator.length);
  const nameMatch = /name="([^"]+)"/.exec(rawHeaders);
  const fileMatch = /filename="([^"]*)"/.exec(rawHeaders);

  return {
    name: nameMatch ? nameMatch[1] : "",
    filename: fileMatch ? fileMatch[1] : "",
    data,
    text: data.toString("utf8").trim()
  };
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/") {
      sendHtml(res);
      return;
    }

    if (req.method === "POST" && req.url === "/generate") {
      const body = await readRequest(req);
      const fields = parseMultipart(body, req.headers["content-type"]);
      const excel = fields.excel;

      if (!excel || !excel.data || excel.data.length === 0) {
        sendJson(res, 400, { error: "Selecciona un Excel." });
        return;
      }

      const out = fields.out && fields.out.text ? fields.out.text : DEFAULT_OUT;
      const result = await generateMockups({
        excelBuffer: excel.data,
        mockups: fields.mockups && fields.mockups.text ? fields.mockups.text : DEFAULT_MOCKUPS,
        out,
        font: fields.font && fields.font.text ? fields.font.text : DEFAULT_ALDRICH_FONT,
        limit: 0
      });

      sendJson(res, 200, Object.assign({ out: path.resolve(out) }, result));
      return;
    }

    if (req.method === "POST" && req.url === "/choose-folder") {
      const body = await readJsonRequest(req);
      const selectedPath = await choosePath("folder", body.current);
      sendJson(res, 200, { path: selectedPath });
      return;
    }

    if (req.method === "POST" && req.url === "/choose-file") {
      const body = await readJsonRequest(req);
      const selectedPath = await choosePath("file", body.current);
      sendJson(res, 200, { path: selectedPath });
      return;
    }

    sendJson(res, 404, { error: "Ruta no encontrada." });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Nike Mockup Printer listo en http://${HOST}:${PORT}`);
});
