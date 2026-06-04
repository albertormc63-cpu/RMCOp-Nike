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

function RMCNike_hexEncode(value) {
    var hex = "";

    for (var i = 0; i < value.length; i++) {
        hex += value.charCodeAt(i).toString(16);
    }

    return hex;
}

function RMCNike_createActionString(actionSetName, actionName) {
    return "/version 3\n" +
        "/name [ " + actionSetName.length + "\n" +
        RMCNike_hexEncode(actionSetName) + "\n" +
        "]\n" +
        "/isOpen 0\n" +
        "/actionCount 1\n" +
        "/action-1 {\n" +
        " /name [ " + actionName.length + "\n" +
        RMCNike_hexEncode(actionName) + "\n" +
        " ]\n" +
        " /keyIndex 0\n" +
        " /colorIndex 0\n" +
        " /isOpen 1\n" +
        " /eventCount 1\n" +
        " /event-1 {\n" +
        " /useRulersIn1stQuadrant 0\n" +
        " /internalName (ai_plugin_swatches)\n" +
        " /localizedName [ 8\n" +
        " 5377617463686573\n" +
        " ]\n" +
        " /isOpen 0\n" +
        " /isOn 1\n" +
        " /hasDialog 0\n" +
        " /parameterCount 2\n" +
        " /parameter-1 {\n" +
        " /key 1835363957\n" +
        " /showInPalette 4294967295\n" +
        " /type (enumerated)\n" +
        " /name [ 15\n" +
        " 416464205573656420436f6c6f7273\n" +
        " ]\n" +
        " /value 9\n" +
        " }\n" +
        " /parameter-2 {\n" +
        " /key 1634495605\n" +
        " /showInPalette 4294967295\n" +
        " /type (boolean)\n" +
        " /value 1\n" +
        " }\n" +
        " }\n" +
        "}";
}

function RMCNike_addUsedColors() {
    // Ejecuta la accion del panel Muestras: "Add Used Colors".
    var actionSetName = "RMC Add Used Colors";
    var actionName = "Add Used Colors";
    var actionFile = new File(Folder.temp + "/rmc_add_used_colors.aia");
    var actionLoaded = false;

    try {
        if (!app.documents.length) {
            return "ERROR:No hay documento abierto en Illustrator.";
        }

        var doc = app.activeDocument;

        try {
            doc.selection = null;
        } catch (selectionError) {
            // La accion funciona aunque no podamos limpiar la seleccion.
        }

        actionFile.open("w");
        actionFile.write(RMCNike_createActionString(actionSetName, actionName));
        actionFile.close();

        app.loadAction(actionFile);
        actionLoaded = true;
        app.doScript(actionName, actionSetName, false);

        return "OK:Colores usados agregados a Muestras.";
    } catch (error) {
        return "ERROR:" + error.message;
    } finally {
        if (actionLoaded) {
            try {
                app.unloadAction(actionSetName, "");
            } catch (unloadError) {
            }
        }

        if (actionFile.exists) {
            try {
                actionFile.remove();
            } catch (removeError) {
            }
        }
    }
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
