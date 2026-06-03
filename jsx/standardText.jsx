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
    // Nombres Standard: mismo criterio que RMC Optimizador, usando tf.width y horizontalScale.
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

            tf.textRange.characterAttributes.horizontalScale = 100;
            app.redraw();

            var textWidth = getTextFramePropertyWidth(tf);

            if (textWidth > widthLimit) {
                var newScale = (widthLimit / textWidth) * 100 * buffer;

                if (newScale < minimumScale) {
                    newScale = minimumScale;
                }

                tf.textRange.characterAttributes.horizontalScale = newScale;
                app.redraw();
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

            if (getTextFramePropertyWidth(tf) > widthLimit) {
                resizeTextFrameToWidth(tf, widthLimit, buffer, minimumScale);
                fittedCount++;
            }
        } catch (error) {
            $.writeln("RMCNike fitTextFramesByObjectWidth omitio " + (label || "texto") + " #" + i + ": " + error.message);
        }
    }

    return fittedCount;
}

function resizeTextFrameToWidth(tf, widthLimit, buffer, minimumScale) {
    var tolerance = 0.02 * 72;

    for (var i = 0; i < 4; i++) {
        var currentWidth = getTextFramePropertyWidth(tf);

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
            var width = getTextFramePropertyWidth(frames[i]) / divisor;
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
            var width = getTextFramePropertyWidth(frames[i]);

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

function getTextFramesExceptLargest(frames) {
    // Complemento de getLargestTextFrames: normalmente son los numeros chicos/front.
    var largestFrames = getLargestTextFrames(frames);
    var largestFrame = largestFrames.length ? largestFrames[0] : null;
    var result = [];

    for (var i = 0; i < frames.length; i++) {
        if (frames[i] !== largestFrame) {
            result.push(frames[i]);
        }
    }

    return result;
}

function roundForLog(value) {
    return Math.round(Number(value || 0) * 100) / 100;
}

function getTextFramePropertyWidth(tf) {
    // Este valor corresponde al Ancho que normalmente se revisa en Propiedades/Transform.
    return Number(tf.width || 0);
}

// API publica del modulo Standard para rmcNike.jsx.
$.global.replaceExactText = replaceExactText;
$.global.fitTextFrames = fitTextFrames;
$.global.fitTextFramesByObjectWidth = fitTextFramesByObjectWidth;
$.global.summarizeTextFrames = summarizeTextFrames;
$.global.getLargestTextFrames = getLargestTextFrames;
$.global.getTextFramesExceptLargest = getTextFramesExceptLargest;
