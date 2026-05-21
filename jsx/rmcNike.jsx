function RMCNike_openFile(filePath) {
    try {
        var file = new File(filePath);

        if (!file.exists) {
            return "ERROR:No existe el archivo: " + file.fsName;
        }

        app.open(file);
        return "OK:Archivo abierto en Illustrator.";
    } catch (error) {
        return "ERROR:" + error.message;
    }
}

function RMCNike_applyNameNumber(namePlaceholder, numberPlaceholder, newName, newNumber, shouldReplaceNumber) {
    try {
        if (app.documents.length === 0) {
            return "ERROR:No hay documento abierto en Illustrator.";
        }

        var doc = app.activeDocument;
        var safeName = textOrBlank(newName);
        var safeNumber = textOrBlank(newNumber);
        var replacedName = replaceExactText(doc, namePlaceholder, safeName);
        var replacedNumber = 0;

        if (shouldReplaceNumber && numberPlaceholder !== "") {
            replacedNumber = replaceExactText(doc, numberPlaceholder, safeNumber);
        }

        app.redraw();
        return "OK:Nombre reemplazado: " + replacedName + " | Numero reemplazado: " + replacedNumber;
    } catch (error) {
        return "ERROR:" + error.message;
    }
}

function replaceExactText(doc, placeholder, replacement) {
    var count = 0;

    if (placeholder === null || placeholder === "") {
        return count;
    }

    for (var i = 0; i < doc.textFrames.length; i++) {
        var tf = doc.textFrames[i];

        if (textMatches(tf.contents, placeholder)) {
            tf.contents = replacement;
            count++;
        }
    }

    return count;
}

function textMatches(actual, expected) {
    return normalizeText(actual) === normalizeText(expected);
}

function normalizeText(value) {
    return String(value)
        .replace(/[\u2018\u2019\u02BC]/g, "'")
        .replace(/[\r\n\t]+/g, " ")
        .replace(/\s+/g, " ")
        .replace(/^\s+|\s+$/g, "");
}

function textOrBlank(value) {
    if (value === null || value === undefined || String(value) === "") {
        return " ";
    }

    return String(value);
}
