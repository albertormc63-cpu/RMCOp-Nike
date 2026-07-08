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

function fitTextFramesByObjectWidth(frames, maxWidth, fitBuffer, minScale, fitUnit, label, miterLimit) {
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

            applyTextFrameMiterLimit(tf, miterLimit, label);
            app.redraw();

            if (getTextFramePropertyWidth(tf) > widthLimit) {
                resizeTextFrameToWidth(tf, widthLimit, buffer, minimumScale, miterLimit, label);
                fittedCount++;
            }
        } catch (error) {
            $.writeln("RMCNike fitTextFramesByObjectWidth omitio " + (label || "texto") + " #" + i + ": " + error.message);
        }
    }

    return fittedCount;
}

function resizeTextFrameToWidth(tf, widthLimit, buffer, minimumScale, miterLimit, label) {
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

        // Mantener el grosor de contornos/efectos al ajustar ancho; solo cambia el ancho visual del objeto.
        tf.resize(scaleX, 100, true, true, true, true, 100, Transformation.CENTER);
        applyTextFrameMiterLimit(tf, miterLimit, label);
        app.redraw();
    }
}

function applyTextFrameMiterLimit(tf, miterLimit, label) {
    // Algunas plantillas importadas exponen el limite de trazo en el textFrame;
    // otras lo exponen en textPath o characterAttributes. Probamos todos sin bloquear la orden.
    var limit = Number(miterLimit);
    var applied = false;

    if (!limit || limit <= 0) {
        return false;
    }

    try {
        tf.strokeMiterLimit = limit;
        applied = true;
    } catch (error) {
    }

    try {
        tf.strokeJoin = StrokeJoin.MITERENDJOIN;
    } catch (error) {
    }

    try {
        if (tf.textPath) {
            tf.textPath.strokeMiterLimit = limit;
            try {
                tf.textPath.strokeJoin = StrokeJoin.MITERENDJOIN;
            } catch (textPathJoinError) {
            }
            applied = true;
        }
    } catch (error) {
    }

    try {
        var attributes = tf.textRange && tf.textRange.characterAttributes;

        if (attributes) {
            attributes.strokeMiterLimit = limit;
            try {
                attributes.strokeJoin = StrokeJoin.MITERENDJOIN;
            } catch (joinError) {
            }
            applied = true;
        }
    } catch (error) {
    }

    try {
        var ranges = tf.textRanges || [];

        for (var i = 0; i < ranges.length; i++) {
            ranges[i].characterAttributes.strokeMiterLimit = limit;
            try {
                ranges[i].characterAttributes.strokeJoin = StrokeJoin.MITERENDJOIN;
            } catch (rangeJoinError) {
            }
            applied = true;
        }
    } catch (error) {
    }

    if (!applied) {
        $.writeln("RMCNike no pudo aplicar limite de trazo " + limit + " en " + (label || "texto") + ".");
    }

    return applied;
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
$.global.applyTextFrameMiterLimit = applyTextFrameMiterLimit;
$.global.summarizeTextFrames = summarizeTextFrames;
$.global.getLargestTextFrames = getLargestTextFrames;
$.global.getTextFramesExceptLargest = getTextFramesExceptLargest;
