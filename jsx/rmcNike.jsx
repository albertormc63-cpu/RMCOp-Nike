// Funciones ExtendScript ejecutadas dentro de Illustrator.
// El panel las llama desde js/illustrator/illustratorBridge.js via CSInterface.evalScript.

function RMCNike_openFile(filePath) {
    // Abre el PDF copiado por el panel.
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

function RMCNike_confirmReplace(filePath) {
    try {
        var message = "Ya existe este archivo:\n\n" +
            filePath +
            "\n\nSi continuas, se reemplazara con una copia limpia de la plantilla.";

        return confirm(message) ? "OK:YES" : "OK:NO";
    } catch (error) {
        return "ERROR:" + error.message;
    }
}

function RMCNike_applyNameNumber(namePlaceholder, numberPlaceholder, newName, newNumber, shouldReplaceNumber, nameMaxWidth, numberMaxWidth, fitBuffer, minScale, fitUnit, ihNumberRuleJson) {
    // Reemplaza placeholders de texto. En IH, el numero se arma duplicando grupos de Illustrator.
    try {
        if (app.documents.length === 0) {
            return "ERROR:No hay documento abierto en Illustrator.";
        }

        var doc = app.activeDocument;
        var safeName = textOrBlank(newName);
        var safeNumber = textOrBlank(newNumber);
        var nameFrames = replaceExactText(doc, namePlaceholder, safeName);
        var numberFrames = [];
        var fittedName = fitTextFrames(nameFrames, nameMaxWidth, fitBuffer, minScale, fitUnit);
        var fittedNumber = 0;
        var ihNumberMessage = "";

        if (shouldReplaceNumber && numberPlaceholder !== "") {
            numberFrames = replaceExactText(doc, numberPlaceholder, safeNumber);
            fittedNumber = fitTextFrames(numberFrames, numberMaxWidth, fitBuffer, minScale, fitUnit);
        } else if (safeNumber !== " ") {
            ihNumberMessage = applyIhNumberRules(doc, safeNumber, ihNumberRuleJson, numberMaxWidth, fitBuffer, minScale, fitUnit);

            if (ihNumberMessage.indexOf("ERROR:") === 0) {
                return ihNumberMessage;
            }
        }

        app.redraw();
        return "OK:Nombre reemplazado: " + nameFrames.length +
            " (ajustado: " + fittedName + ")" +
            " | Numero reemplazado: " + numberFrames.length +
            " (ajustado: " + fittedNumber + ")" +
            ihNumberMessage;
    } catch (error) {
        return "ERROR:" + error.message;
    }
}

function replaceExactText(doc, placeholder, replacement) {
    // Busca textFrames cuyo contenido sea igual al placeholder, tolerando apostrofes/espacios raros.
    var replacedFrames = [];

    if (placeholder === null || placeholder === "") {
        return replacedFrames;
    }

    for (var i = 0; i < doc.textFrames.length; i++) {
        var tf = doc.textFrames[i];

        if (textMatches(tf.contents, placeholder)) {
            tf.contents = replacement;
            replacedFrames.push(tf);
        }
    }

    return replacedFrames;
}

function fitTextFrames(frames, maxWidth, fitBuffer, minScale, fitUnit) {
    // Ajusta solo si el texto ya reemplazado se pasa del ancho permitido.
    // El JSON se edita en pulgadas; aqui se traduce solo para compararlo contra tf.width.
    var fittedCount = 0;
    var widthLimit = toIllustratorPoints(maxWidth, fitUnit);
    var buffer = Number(fitBuffer);
    var minimumScale = Number(minScale);

    if (!widthLimit || widthLimit <= 0) {
        return fittedCount;
    }

    if (!buffer || buffer <= 0) {
        buffer = 0.99;
    }

    if (!minimumScale || minimumScale <= 0) {
        minimumScale = 50;
    }

    for (var i = 0; i < frames.length; i++) {
        var tf = frames[i];

        tf.textRange.characterAttributes.horizontalScale = 100;
        app.redraw();

        if (tf.width > widthLimit) {
            var newScale = (widthLimit / tf.width) * 100 * buffer;

            if (newScale < minimumScale) {
                newScale = minimumScale;
            }

            tf.textRange.characterAttributes.horizontalScale = newScale;
            fittedCount++;
        }
    }

    return fittedCount;
}

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

function applyIhNumberRules(doc, numberValue, ihNumberRuleJson, fallbackMaxWidth, fitBuffer, minScale, fitUnit) {
    // Aplica zonas activas de IH. Front y back comparten flujo, pero cada zona tiene su propia regla.
    var config = parseJsonSafe(ihNumberRuleJson) || getDefaultIhNumberRules();
    var numberText = String(numberValue).replace(/[^0-9]/g, "");

    if (numberText === "") {
        return "";
    }

    var activeZones = config.activeZones || [];
    var messages = [];
    var docGroupIndex = buildGroupIndex(doc.groupItems, 5000);
    var layerCache = {};

    if (activeZones.length === 0) {
        return "ERROR:ihNumberRules.json no tiene zonas activas para aplicar numeros IH.";
    }

    for (var i = 0; i < activeZones.length; i++) {
        var zoneName = activeZones[i];
        var zoneConfig = config.zones ? config.zones[zoneName] : null;

        if (!zoneConfig) {
            return "ERROR:La zona IH '" + zoneName + "' no existe en ihNumberRules.json.";
        }

        var zoneMessage = applyIhNumberZone(doc, numberText, zoneConfig, {
            unit: config.unit || "in",
            fallbackMaxWidth: fallbackMaxWidth,
            fitBuffer: fitBuffer,
            minScale: minScale,
            docGroupIndex: docGroupIndex,
            layerCache: layerCache
        });

        if (zoneMessage.indexOf("ERROR:") === 0) {
            return zoneMessage;
        }

        messages.push(zoneMessage);
    }

    return messages.length ? " | IH: " + messages.join(" | ") : "";
}

function applyIhNumberZone(doc, numberText, zoneConfig, context) {
    // IH usa arte expandido: buscamos solo capas/grupos por colecciones directas para no congelar Illustrator.
    var sourceContainer = getLayerFromCache(doc, zoneConfig.sourceContainer, context.layerCache);
    var targetGroup = context.docGroupIndex[zoneConfig.targetGroup] || null;
    var baseGroup = zoneConfig.baseGroup ? context.docGroupIndex[zoneConfig.baseGroup] : null;

    if (!sourceContainer) {
        return "ERROR:No encontre la capa " + zoneConfig.sourceContainer + " para armar el numero IH.";
    }

    if (!targetGroup) {
        return "ERROR:No encontre el grupo " + zoneConfig.targetGroup + " para posicionar el numero IH.";
    }

    removeExistingOutputGroup(doc, zoneConfig, context);

    var outputLayer = targetGroup.layer || doc.activeLayer;
    unlockLayerForWrite(outputLayer);

    var outputGroup = outputLayer.groupItems.add();
    outputGroup.name = zoneConfig.outputGroup;

    var gap = toIllustratorPoints(zoneConfig.gap || 0, context.unit);
    var digits = [];
    var sourceDigitIndex = buildGroupIndex(sourceContainer.groupItems, 500);

    for (var i = 0; i < numberText.length; i++) {
        var digitName = numberText.charAt(i) + zoneConfig.digitSuffix;
        var sourceDigit = sourceDigitIndex[digitName] || null;

        if (!sourceDigit) {
            outputGroup.remove();
            return "ERROR:No encontre el grupo " + digitName + " dentro de la capa " + zoneConfig.sourceContainer + ".";
        }

        var digitCopy = sourceDigit.duplicate(outputGroup, ElementPlacement.PLACEATEND);
        digitCopy.hidden = false;
        digitCopy.locked = false;
        digits.push(digitCopy);
    }

    arrangeDigits(digits, gap);
    centerGroupOnTarget(outputGroup, targetGroup);
    fitIhNumberGroup(outputGroup, zoneConfig, context);
    centerGroupOnTarget(outputGroup, targetGroup);
    centerGroupOnBaseIfAvailable(outputGroup, baseGroup);
    targetGroup.hidden = true;

    return zoneConfig.outputGroup + " aplicado";
}

function arrangeDigits(digits, gap) {
    // Alinea por centro vertical visual y deja separacion exacta entre bounds visibles.
    if (digits.length === 0) {
        return;
    }

    var centerY = getItemCenter(digits[0]).y;
    var nextLeft = 0;

    for (var i = 0; i < digits.length; i++) {
        var digitCenter = getItemCenter(digits[i]);
        digits[i].translate(0, centerY - digitCenter.y);

        var digitBounds = getItemBounds(digits[i]);
        digits[i].translate(nextLeft - digitBounds.left, 0);

        digitBounds = getItemBounds(digits[i]);
        nextLeft = digitBounds.right + gap;
    }
}

function centerGroupOnTarget(groupItem, targetItem) {
    // Centra el grupo nuevo sobre el centro visual del numero original de la plantilla.
    var groupCenter = getItemCenter(groupItem);
    var targetCenter = getItemCenter(targetItem);

    groupItem.translate(targetCenter.x - groupCenter.x, targetCenter.y - groupCenter.y);
}

function centerGroupOnBaseIfAvailable(groupItem, baseGroup) {
    // N FRONT/N BACK mandan la altura. BASE FRONT/BASE BACK solo afinan el centrado horizontal.
    if (!baseGroup) {
        return;
    }

    centerGroupHorizontallyOnTarget(groupItem, baseGroup);
}

function centerGroupHorizontallyOnTarget(groupItem, targetItem) {
    var groupCenter = getItemCenter(groupItem);
    var targetCenter = getItemCenter(targetItem);

    groupItem.translate(targetCenter.x - groupCenter.x, 0);
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

function fitIhNumberGroup(groupItem, zoneConfig, context) {
    // Para espalda IH se ajusta el grupo completo si rebasa el maximo permitido.
    if (!zoneConfig.fitToMaxWidth) {
        return false;
    }

    var maxWidth = zoneConfig.maxWidth || context.fallbackMaxWidth;
    var widthLimit = toIllustratorPoints(maxWidth, context.unit);
    var buffer = Number(context.fitBuffer);
    var minimumScale = Number(context.minScale);

    var groupBounds = getItemBounds(groupItem);

    if (!widthLimit || widthLimit <= 0 || groupBounds.width <= widthLimit) {
        return false;
    }

    if (!buffer || buffer <= 0) {
        buffer = 1;
    }

    if (!minimumScale || minimumScale <= 0) {
        minimumScale = 50;
    }

    var scale = (widthLimit / groupBounds.width) * 100 * buffer;

    if (scale < minimumScale) {
        scale = minimumScale;
    }

    groupItem.resize(scale, scale, true, true, true, true, scale, Transformation.CENTER);
    return true;
}

function getLayerFromCache(doc, layerName, layerCache) {
    if (layerCache[layerName]) {
        return layerCache[layerName];
    }

    layerCache[layerName] = findLayerByNameLimited(doc, layerName);
    return layerCache[layerName];
}

function findLayerByNameLimited(doc, layerName) {
    // Busqueda limitada a capas y subcapas. No entra a pageItems para evitar recorridos enormes.
    for (var i = 0; i < doc.layers.length; i++) {
        var found = findLayerInCollection(doc.layers[i], layerName, 0);

        if (found) {
            return found;
        }
    }

    return null;
}

function findLayerInCollection(layer, layerName, depth) {
    if (layer.name === layerName) {
        return layer;
    }

    if (depth >= 3) {
        return null;
    }

    for (var i = 0; i < layer.layers.length; i++) {
        var found = findLayerInCollection(layer.layers[i], layerName, depth + 1);

        if (found) {
            return found;
        }
    }

    return null;
}

function buildGroupIndex(groupItems, limit) {
    // Indexa grupos por nombre una sola vez. Acelera IH y evita escanear por cada digito.
    var index = {};
    var max = Math.min(groupItems.length, limit);

    for (var i = 0; i < max; i++) {
        if (groupItems[i].name && !index[groupItems[i].name]) {
            index[groupItems[i].name] = groupItems[i];
        }
    }

    return index;
}

function removeExistingOutputGroup(doc, zoneConfig, context) {
    // Limpia corridas anteriores usando el indice ya creado. Evita otro escaneo de grupos.
    var existingGroup = context.docGroupIndex[zoneConfig.outputGroup] || null;

    if (existingGroup) {
        existingGroup.remove();
        context.docGroupIndex[zoneConfig.outputGroup] = null;
    }
}

function unlockLayerForWrite(layer) {
    // Si la capa destino esta bloqueada, Illustrator no permite crear el grupo nuevo.
    if (layer && layer.locked) {
        layer.locked = false;
    }
}

function getDefaultIhNumberRules() {
    // Fallback local para que IH funcione aunque CEP cachee JS viejo y no mande ihNumberRules.json.
    return {
        unit: "in",
        activeZones: ["front", "back"],
        zones: {
            front: {
                sourceContainer: "NUMEROS F",
                targetGroup: "N FRONT",
                baseGroup: "BASE FRONT",
                digitSuffix: " F",
                outputGroup: "RMC FRONT NUMBER",
                gap: 0.25,
                fitToMaxWidth: false
            },
            back: {
                sourceContainer: "NUMEROS B",
                targetGroup: "N BACK",
                baseGroup: "BASE BACK",
                digitSuffix: " B",
                outputGroup: "RMC BACK NUMBER",
                gap: 0.25,
                fitToMaxWidth: true
            }
        }
    };
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
