#!/usr/bin/env node

const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const {
  DEFAULT_ALDRICH_FONT,
  DEFAULT_MOCKUPS,
  DEFAULT_OUT,
  generateMockups,
  readExcelBuffer,
  summarizeExcel
} = require("./generate");

const PORT = Number(process.env.PORT || 3127);
const HOST = process.env.HOST || "127.0.0.1";

function sendHtml(res) {
  const htmlPath = path.join(__dirname, "..", "public", "index.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
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

function parseJsonField(field, fallback) {
  if (!field || !field.text) return fallback;

  try {
    return JSON.parse(field.text);
  } catch (error) {
    return fallback;
  }
}

function shutdownServer(res) {
  sendJson(res, 200, { ok: true, message: "Server apagandose." });

  setTimeout(() => {
    server.close(() => {
      process.exit(0);
    });
  }, 100);

  setTimeout(() => {
    process.exit(0);
  }, 1500);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/") {
      sendHtml(res);
      return;
    }

    if (req.method === "GET" && req.url === "/health") {
      sendJson(res, 200, { ok: true, status: "online" });
      return;
    }

    if (req.method === "POST" && req.url === "/shutdown") {
      shutdownServer(res);
      return;
    }

    if (req.method === "POST" && req.url === "/analyze-excel") {
      const body = await readRequest(req);
      const fields = parseMultipart(body, req.headers["content-type"]);
      const excel = fields.excel;

      if (!excel || !excel.data || excel.data.length === 0) {
        sendJson(res, 400, { error: "Selecciona un Excel." });
        return;
      }

      const mode = fields.mode && fields.mode.text ? fields.mode.text : "bulk";
      sendJson(res, 200, summarizeExcel(readExcelBuffer(excel.data, mode)));
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
      const filters = parseJsonField(fields.filters, {});
      const mode = fields.mode && fields.mode.text ? fields.mode.text : "bulk";
      const result = await generateMockups({
        excelBuffer: excel.data,
        excelName: excel.filename || "Excel.xlsx",
        mode,
        mockups: fields.mockups && fields.mockups.text ? fields.mockups.text : DEFAULT_MOCKUPS,
        out,
        font: fields.font && fields.font.text ? fields.font.text : DEFAULT_ALDRICH_FONT,
        styles: Array.isArray(filters.styles) ? filters.styles : [],
        sizes: Array.isArray(filters.sizes) ? filters.sizes : [],
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
