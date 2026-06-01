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
    // Usamos visibleBounds porque algunos PDFs reportan tf.width diferente al ancho que se ve.
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

            var textWidth = getTextFrameWidth(tf);

            if (textWidth > widthLimit) {
                var newScale = (widthLimit / textWidth) * 100 * buffer;

                if (newScale < minimumScale) {
                    newScale = minimumScale;
                }

                tf.textRange.characterAttributes.horizontalScale = newScale;
                app.redraw();

                var adjustedWidth = getTextFrameWidth(tf);

                if (adjustedWidth > widthLimit) {
                    var secondScale = newScale * (widthLimit / adjustedWidth) * buffer;

                    if (secondScale < minimumScale) {
                        secondScale = minimumScale;
                    }

                    tf.textRange.characterAttributes.horizontalScale = secondScale;
                    app.redraw();
                    adjustedWidth = getTextFrameWidth(tf);
                }

                if (adjustedWidth > widthLimit) {
                    var objectScale = (widthLimit / adjustedWidth) * 100 * buffer;

                    if (objectScale < minimumScale) {
                        objectScale = minimumScale;
                    }

                    // Respaldo para textFrames importados desde PDF que ignoran horizontalScale.
                    tf.resize(objectScale, 100, true, true, true, true, objectScale, Transformation.CENTER);
                }

                fittedCount++;
            }
        } catch (error) {
            $.writeln("RMCNike fitTextFrames omitio " + (label || "texto") + " #" + i + ": " + error.message);
        }
    }

    return fittedCount;
}

function getTextFrameWidth(tf) {
    // Algunos PDFs reportan mejor visibleBounds y otros mejor tf.width; tomamos el mayor.
    var boundsWidth = getItemBounds(tf).width;
    var frameWidth = Number(tf.width || 0);

    return Math.max(boundsWidth, frameWidth);
}

// API publica del modulo Standard para rmcNike.jsx.
$.global.replaceExactText = replaceExactText;
$.global.fitTextFrames = fitTextFrames;
