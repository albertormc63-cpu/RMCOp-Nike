// Herramientas de muestras: extraen la lista autorizada desde el documento activo.

function RMCNike_jsonEscape(value) {
    return String(value)
        .replace(/\\/g, "\\\\")
        .replace(/"/g, "\\\"")
        .replace(/\r/g, "\\r")
        .replace(/\n/g, "\\n")
        .replace(/\t/g, "\\t");
}

function RMCNike_swatchesToJson(documentName, swatches) {
    var json = "{\n";

    json += "  \"document\": \"" + RMCNike_jsonEscape(documentName) + "\",\n";
    json += "  \"swatches\": [\n";

    for (var i = 0; i < swatches.length; i++) {
        json += "    { \"name\": \"" + RMCNike_jsonEscape(swatches[i]) + "\" }";

        if (i < swatches.length - 1) {
            json += ",";
        }

        json += "\n";
    }

    json += "  ]\n";
    json += "}";

    return json;
}

function RMCNike_extractOfficialSwatches() {
    // Devuelve JSON listo para guardarse como js/config/officialSwatches.json.
    try {
        if (!app.documents.length) {
            return "ERROR:No hay documento abierto en Illustrator.";
        }

        var doc = app.activeDocument;
        var swatches = [];
        var ignored = {
            "[None]": true,
            "[Registration]": true,
            "[Paper]": true,
            "[Ninguno]": true,
            "[Registro]": true,
            "[Papel]": true,
            "[Negro]": true
        };

        for (var i = 0; i < doc.swatches.length; i++) {
            var swatch = doc.swatches[i];
            var swatchName = String(swatch.name || "");
            var lowerName = swatchName.toLowerCase();
            var colorType = "";

            if (ignored[swatchName]) {
                continue;
            }

            try {
                colorType = swatch.color && swatch.color.typename ? swatch.color.typename : "";
            } catch (error) {
                colorType = "";
            }

            if (
                colorType !== "PatternColor" &&
                lowerName.indexOf("pattern") === -1 &&
                lowerName.indexOf("pattren") === -1
            ) {
                swatches.push(swatchName);
            }
        }

        return "OK:" + RMCNike_swatchesToJson(doc.name, swatches);
    } catch (error) {
        return "ERROR:" + error.message;
    }
}
