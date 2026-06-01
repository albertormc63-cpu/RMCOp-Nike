// Utilidades compartidas por Standard e Indigenous Heritage.
// Mantener aqui conversiones, bounds y normalizacion evita duplicar detalles entre flujos.

function toIllustratorPoints(value, unit) {
    // Illustrator scripting compara anchos en puntos, aunque el documento se vea en pulgadas.
    var numericValue = Number(value);

    if (!numericValue || numericValue <= 0) {
        return 0;
    }

    if (String(unit).toLowerCase() === "in") {
        return numericValue * 72;
    }

    return numericValue;
}

function getItemBounds(item) {
    // visibleBounds usa el area visible real: [left, top, right, bottom].
    var bounds = item.visibleBounds || item.geometricBounds;

    return {
        left: bounds[0],
        top: bounds[1],
        right: bounds[2],
        bottom: bounds[3],
        width: bounds[2] - bounds[0],
        height: bounds[1] - bounds[3]
    };
}

function getItemCenter(item) {
    var bounds = getItemBounds(item);

    return {
        x: bounds.left + (bounds.width / 2),
        y: bounds.bottom + (bounds.height / 2)
    };
}

function textMatches(actual, expected) {
    return normalizeText(actual) === normalizeText(expected);
}

function normalizeText(value) {
    // Normaliza diferencias comunes al importar texto desde PDFs.
    return String(value)
        .replace(/[\u2018\u2019\u02BC]/g, "'")
        .replace(/[\r\n\t]+/g, " ")
        .replace(/\s+/g, " ")
        .replace(/^\s+|\s+$/g, "")
        .toUpperCase();
}

function textOrBlank(value) {
    // Si un dato viene vacio, usamos un espacio para que no quede el placeholder original.
    if (value === null || value === undefined || String(value) === "") {
        return " ";
    }

    return String(value);
}

function parseJsonSafe(jsonText) {
    if (!jsonText || jsonText === "null") {
        return null;
    }

    try {
        return JSON.parse(jsonText);
    } catch (error) {
        return null;
    }
}

// ExtendScript puede aislar funciones cargadas con $.evalFile; las exponemos de forma explicita.
$.global.toIllustratorPoints = toIllustratorPoints;
$.global.getItemBounds = getItemBounds;
$.global.getItemCenter = getItemCenter;
$.global.textMatches = textMatches;
$.global.normalizeText = normalizeText;
$.global.textOrBlank = textOrBlank;
$.global.parseJsonSafe = parseJsonSafe;
