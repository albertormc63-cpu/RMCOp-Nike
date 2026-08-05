const GENERATED_PDF_COMMENT = "Procesado y generado con RMCOp-Nike/RMC Control System. Developed by: Ing. Alberto Garcia";

function escapePlistText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildStringPlist(value) {
  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">",
    "<plist version=\"1.0\">",
    `<string>${escapePlistText(value)}</string>`,
    "</plist>"
  ].join("");
}

function setFinderComment({ fs, childProcess }, filePath, comment) {
  if (!fs || !childProcess) {
    return { ok: false, skipped: true, reason: "Node FS/child_process no disponible." };
  }

  if (process.platform !== "darwin") {
    return { ok: false, skipped: true, reason: "Comentarios Finder solo aplican en macOS." };
  }

  if (!filePath || !fs.existsSync(filePath)) {
    return { ok: false, skipped: true, reason: "El archivo no existe." };
  }

  try {
    const plist = buildStringPlist(comment);
    const binaryPlist = childProcess.execFileSync("/usr/bin/plutil", ["-convert", "binary1", "-o", "-", "-"], {
      input: plist
    });

    childProcess.execFileSync("/usr/bin/xattr", [
      "-wx",
      "com.apple.metadata:kMDItemFinderComment",
      binaryPlist.toString("hex"),
      filePath
    ]);

    return { ok: true, comment };
  } catch (error) {
    return { ok: false, skipped: false, reason: error.message };
  }
}

function markGeneratedPdf(deps, filePath) {
  return setFinderComment(deps, filePath, GENERATED_PDF_COMMENT);
}

module.exports = {
  GENERATED_PDF_COMMENT,
  markGeneratedPdf,
  setFinderComment
};
