// Flujo Indigenous Heritage: arma numeros duplicando arte expandido desde NUMEROS F/B.
// No recorre pageItems profundamente para evitar congelar Illustrator.

function applyIhNumberRules(doc, numberValue, ihNumberRuleJson, fallbackMaxWidth, fallbackSmallMaxWidth, fitBuffer, minScale, fitUnit) {
    // Front y back comparten flujo, pero cada zona tiene su propia regla en ihNumberRules.json.
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
            fallbackSmallMaxWidth: fallbackSmallMaxWidth,
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
    var sourceContainer = null;
    var sourceVisibility = null;

    try {
        // N FRONT/N BACK dan posicion/altura; BASE FRONT/BACK solo ajustan centrado horizontal.
        sourceContainer = getLayerFromCache(doc, zoneConfig.sourceContainer, context.layerCache);
        var targetGroup = context.docGroupIndex[zoneConfig.targetGroup] || null;
        var baseGroup = zoneConfig.baseGroup ? context.docGroupIndex[zoneConfig.baseGroup] : null;

        if (!sourceContainer) {
            return "ERROR:No encontre la capa " + zoneConfig.sourceContainer + " para armar el numero IH.";
        }

        if (!targetGroup) {
            return "ERROR:No encontre el grupo " + zoneConfig.targetGroup + " para posicionar el numero IH.";
        }

        sourceVisibility = captureLayerVisibility(sourceContainer);
        showLayerForDuplication(sourceContainer);

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
        fitIhNumberDigits(outputGroup, digits, gap, zoneConfig, context);
        centerGroupOnTarget(outputGroup, targetGroup);
        centerGroupOnBaseIfAvailable(outputGroup, baseGroup);
        targetGroup.hidden = true;

        return zoneConfig.outputGroup + " aplicado";
    } catch (error) {
        return "ERROR:IH " + zoneConfig.outputGroup + ": " + error.message;
    } finally {
        if (sourceContainer && sourceVisibility) {
            restoreLayerVisibility(sourceContainer, sourceVisibility);
        }
    }
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

function fitIhNumberDigits(groupItem, digits, gap, zoneConfig, context) {
    // Ajusta cada digito y reacomoda con gap fijo; el gap de .25in no debe escalarse.
    if (!zoneConfig.fitToMaxWidth) {
        return false;
    }

    var maxWidth = getIhZoneMaxWidth(zoneConfig, context);
    var widthLimit = toIllustratorPoints(maxWidth, context.unit);
    var buffer = Number(context.fitBuffer);
    var groupBounds = getItemBounds(groupItem);

    if (!widthLimit || widthLimit <= 0 || groupBounds.width <= widthLimit) {
        return false;
    }

    if (!buffer || buffer <= 0) {
        buffer = 1;
    }

    if (!digits || digits.length === 0) {
        return false;
    }

    var totalGap = gap * Math.max(0, digits.length - 1);
    var availableDigitWidth = widthLimit - totalGap;
    var totalDigitWidth = 0;

    if (availableDigitWidth <= 0) {
        return false;
    }

    for (var i = 0; i < digits.length; i++) {
        totalDigitWidth += getItemBounds(digits[i]).width;
    }

    if (totalDigitWidth <= 0) {
        return false;
    }

    var scale = (availableDigitWidth / totalDigitWidth) * 100 * buffer;

    if (scale >= 100) {
        return false;
    }

    for (var j = 0; j < digits.length; j++) {
        digits[j].resize(scale, scale, true, true, true, true, scale, Transformation.CENTER);
    }

    arrangeDigits(digits, gap);
    return true;
}

function getIhZoneMaxWidth(zoneConfig, context) {
    if (zoneConfig.maxWidth) {
        return zoneConfig.maxWidth;
    }

    if (zoneConfig.maxWidthRole === "small") {
        return context.fallbackSmallMaxWidth || context.fallbackMaxWidth;
    }

    return context.fallbackMaxWidth;
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

function captureLayerVisibility(layer) {
    // Guardamos estado original para que NUMEROS F/B puedan vivir ocultos en la plantilla.
    return {
        visible: layer.visible,
        locked: layer.locked
    };
}

function showLayerForDuplication(layer) {
    // Illustrator duplica arte oculto con mas confiabilidad si la capa fuente se prende temporalmente.
    layer.locked = false;
    layer.visible = true;
}

function restoreLayerVisibility(layer, state) {
    layer.visible = state.visible;
    layer.locked = state.locked;
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
                fitToMaxWidth: true,
                maxWidthRole: "small"
            },
            back: {
                sourceContainer: "NUMEROS B",
                targetGroup: "N BACK",
                baseGroup: "BASE BACK",
                digitSuffix: " B",
                outputGroup: "RMC BACK NUMBER",
                gap: 0.25,
                fitToMaxWidth: true,
                maxWidthRole: "large"
            }
        }
    };
}

// API publica del modulo IH para rmcNike.jsx.
$.global.applyIhNumberRules = applyIhNumberRules;
