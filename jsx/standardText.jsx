// Flujo Standard: reemplaza texto real de Illustrator y ajusta ancho del texto si se pasa.

function replaceExactText(doc, placeholder, replacement, label) {
    // Busca textFrames cuyo contenido sea igual al placeholder, tolerando apostrofes/espacios raros.
    var replacedFrames = [];

    if (placeholder === null || placeholder === "") {
        return replacedFrames;
    }

    for (var i = 0; i < doc.textFrames.length; i++) {
        try {
            var tf = doc.textFrames[i];

            if (tf.locked || (tf.layer && tf.layer.locked)) {
                continue;
            }

            if (textMatches(tf.contents, placeholder)) {
                tf.contents = replacement;
                replacedFrames.push(tf);
            }
        } catch (error) {
            // Algunos PDFs exponen textFrames raros; los saltamos para no romper toda la orden.
            $.writeln("RMCNike replaceExactText omitio " + (label || "texto") + " #" + i + ": " + error.message);
        }
    }

    return replacedFrames;
}

function fitTextFrames(frames, maxWidth, fitBuffer, minScale, fitUnit, label) {
    // Ajusta solo si el texto ya reemplazado se pasa del ancho permitido.
    // Conservamos el scale base del PDF; resetear a 100 puede achicar numeros importados.
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
        try {
            var tf = frames[i];

            if (tf.locked || (tf.layer && tf.layer.locked)) {
                continue;
            }

            app.redraw();

            var textWidth = getTextFrameWidth(tf);

            if (textWidth > widthLimit) {
                var currentScale = Number(tf.textRange.characterAttributes.horizontalScale || 100);
                var newScale = currentScale * (widthLimit / textWidth) * buffer;

                if (newScale < minimumScale) {
                    newScale = minimumScale;
                }

                tf.textRange.characterAttributes.horizontalScale = newScale;
                app.redraw();
                correctTextFrameWidth(tf, widthLimit, buffer, minimumScale);
                fittedCount++;
            }
        } catch (error) {
            $.writeln("RMCNike fitTextFrames omitio " + (label || "texto") + " #" + i + ": " + error.message);
        }
    }

    return fittedCount;
}

function fitTextFramesByObjectWidth(frames, maxWidth, fitBuffer, minScale, fitUnit, label) {
    // Para numeros Standard ajustamos el ancho del objeto, similar al campo Ancho de Propiedades.
    var fittedCount = 0;
    var widthLimit = toIllustratorPoints(maxWidth, fitUnit);
    var buffer = Number(fitBuffer);
    var minimumScale = Number(minScale);

    if (!widthLimit || widthLimit <= 0) {
        return fittedCount;
    }

    if (!buffer || buffer <= 0) {
        buffer = 1;
    }

    if (!minimumScale || minimumScale <= 0) {
        minimumScale = 50;
    }

    for (var i = 0; i < frames.length; i++) {
        try {
            var tf = frames[i];

            if (tf.locked || (tf.layer && tf.layer.locked)) {
                continue;
            }

            app.redraw();

            if (getTextFrameWidth(tf) > widthLimit) {
                resizeTextFrameToWidth(tf, widthLimit, buffer, minimumScale);
                fittedCount++;
            }
        } catch (error) {
            $.writeln("RMCNike fitTextFramesByObjectWidth omitio " + (label || "texto") + " #" + i + ": " + error.message);
        }
    }

    return fittedCount;
}

function correctTextFrameWidth(tf, widthLimit, buffer, minimumScale) {
    // Illustrator a veces no cae exacto en el primer pase; corregimos suave hacia el limite.
    var tolerance = 0.02 * 72;

    for (var i = 0; i < 3; i++) {
        var currentWidth = getTextFrameWidth(tf);
        var delta = Math.abs(widthLimit - currentWidth);

        if (delta <= tolerance || !currentWidth || currentWidth <= 0) {
            return;
        }

        var currentScale = Number(tf.textRange.characterAttributes.horizontalScale || 100);
        var correctedScale = currentScale * (widthLimit / currentWidth) * buffer;

        if (correctedScale < minimumScale) {
            correctedScale = minimumScale;
        }

        tf.textRange.characterAttributes.horizontalScale = correctedScale;
        app.redraw();
    }
}

function resizeTextFrameToWidth(tf, widthLimit, buffer, minimumScale) {
    var tolerance = 0.02 * 72;

    for (var i = 0; i < 4; i++) {
        var currentWidth = getTextFrameWidth(tf);

        if (!currentWidth || currentWidth <= 0 || Math.abs(widthLimit - currentWidth) <= tolerance) {
            return;
        }

        var scaleX = (widthLimit / currentWidth) * 100 * buffer;

        if (scaleX < minimumScale) {
            scaleX = minimumScale;
        }

        tf.resize(scaleX, 100, true, true, true, true, scaleX, Transformation.CENTER);
        app.redraw();
    }
}

function summarizeTextFrames(frames, fitUnit) {
    // Resumen corto para diagnosticar medidas en consola del panel.
    var unit = String(fitUnit || "in").toLowerCase();
    var divisor = unit === "in" ? 72 : 1;
    var summary = [];

    for (var i = 0; i < frames.length; i++) {
        try {
            var width = getTextFrameWidth(frames[i]) / divisor;
            var scale = Number(frames[i].textRange.characterAttributes.horizontalScale || 100);

            summary.push(roundForLog(width) + unit + "@" + roundForLog(scale) + "%");
        } catch (error) {
            summary.push("?");
        }
    }

    return summary.join(", ");
}

function getLargestTextFrames(frames) {
    // Para numeros Standard hay frente y espalda; solo ajustamos el mas ancho.
    var largestFrame = null;
    var largestWidth = 0;

    for (var i = 0; i < frames.length; i++) {
        try {
            var width = getTextFrameWidth(frames[i]);

            if (width > largestWidth) {
                largestWidth = width;
                largestFrame = frames[i];
            }
        } catch (error) {
            $.writeln("RMCNike getLargestTextFrames omitio frame #" + i + ": " + error.message);
        }
    }

    return largestFrame ? [largestFrame] : [];
}

function roundForLog(value) {
    return Math.round(Number(value || 0) * 100) / 100;
}

function getTextFrameWidth(tf) {
    // Medimos lo visible. En algunos PDFs tf.width no cambia tras horizontalScale
    // y eso provocaba un segundo ajuste que dejaba los numeros demasiado pequenos.
    return getItemBounds(tf).width;
}

// API publica del modulo Standard para rmcNike.jsx.
$.global.replaceExactText = replaceExactText;
$.global.fitTextFrames = fitTextFrames;
$.global.fitTextFramesByObjectWidth = fitTextFramesByObjectWidth;
$.global.summarizeTextFrames = summarizeTextFrames;
$.global.getLargestTextFrames = getLargestTextFrames;
