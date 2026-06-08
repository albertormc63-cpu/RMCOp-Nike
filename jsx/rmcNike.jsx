// Entrada principal ExtendScript para Illustrator.
// Este archivo expone las funciones llamadas por CEP y delega Standard/IH a modulos separados.

RMCNike_loadModules();

function RMCNike_loadModules() {
    // Carga ordenada: utilidades compartidas, Standard/texto, IH/numeros y herramientas.
    var root = File($.fileName).parent.fsName;

    $.evalFile(new File(root + "/rmcNikeUtils.jsx"));
    $.evalFile(new File(root + "/standardText.jsx"));
    $.evalFile(new File(root + "/ihNumbers.jsx"));
    $.evalFile(new File(root + "/swatches.jsx"));
}

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

function RMCNike_confirmOfficialSwatchesOverwrite(filePath) {
    try {
        var docName = app.documents.length ? app.activeDocument.name : "Sin documento abierto";
        var message = "Se va a reemplazar la lista de muestras oficiales:\n\n" +
            filePath +
            "\n\nDocumento activo:\n" +
            docName +
            "\n\nContinua solo si este documento tiene las muestras oficiales autorizadas.";

        return confirm(message) ? "OK:YES" : "OK:NO";
    } catch (error) {
        return "ERROR:" + error.message;
    }
}

function RMCNike_savePdfAndCloseActiveDocument(filePath) {
    try {
        if (app.documents.length === 0) {
            return "ERROR:No hay documento abierto en Illustrator.";
        }

        var doc = app.activeDocument;
        var pdfFile = new File(filePath);
        var pdfOptions = new PDFSaveOptions();

        pdfOptions.preserveEditability = true;
        doc.saveAs(pdfFile, pdfOptions);
        doc.close(SaveOptions.DONOTSAVECHANGES);

        return "OK:PDF guardado y cerrado: " + pdfFile.fsName;
    } catch (error) {
        return "ERROR:" + error.message;
    }
}

function RMCNike_applyNameNumber(namePlaceholder, numberPlaceholder, newName, newNumber, shouldReplaceNumber, nameMaxWidth, numberMaxWidth, smallNumberMaxWidth, fitBuffer, minScale, fitUnit, ihNumberRuleJson) {
    // Coordinador general: nombre siempre es texto; numero puede ser Standard(texto) o IH(arte).
    try {
        if (app.documents.length === 0) {
            return "ERROR:No hay documento abierto en Illustrator.";
        }

        var doc = app.activeDocument;
        var safeName = textOrBlank(newName);
        var safeNumber = textOrBlank(newNumber);
        var nameFrames = replaceExactText(doc, namePlaceholder, safeName, "nombre");
        var numberFrames = [];
        var fittedName = fitTextFrames(nameFrames, nameMaxWidth, fitBuffer, minScale, fitUnit, "nombre");
        var fittedNumber = 0;
        var numberSummary = "";
        var ihNumberMessage = "";

        if (shouldReplaceNumber && numberPlaceholder !== "") {
            // Standard: el numero es texto editable en la plantilla.
            numberFrames = replaceExactText(doc, numberPlaceholder, safeNumber, "numero");
            var numberFramesToFit = getLargestTextFrames(numberFrames);
            var smallNumberFramesToFit = getTextFramesExceptLargest(numberFrames);
            fittedNumber = fitTextFramesByObjectWidth(numberFramesToFit, numberMaxWidth, fitBuffer, minScale, fitUnit, "numero");
            fittedNumber += fitTextFramesByObjectWidth(smallNumberFramesToFit, smallNumberMaxWidth, fitBuffer, minScale, fitUnit, "numero pequeno");
            numberSummary = " | Medidas numero: " + summarizeTextFrames(numberFrames, fitUnit);
        } else if (safeNumber !== " ") {
            // Indigenous Heritage: el numero se arma duplicando grupos raster/expandidos.
            ihNumberMessage = applyIhNumberRules(doc, safeNumber, ihNumberRuleJson, numberMaxWidth, smallNumberMaxWidth, fitBuffer, minScale, fitUnit);

            if (ihNumberMessage.indexOf("ERROR:") === 0) {
                return ihNumberMessage;
            }
        } else if (typeof hideIhNumberTargets === "function") {
            // IH blank desde Excel: no se duplica ningun digito, se apagan N FRONT/N BACK.
            ihNumberMessage = hideIhNumberTargets(doc, ihNumberRuleJson);
        }

        app.redraw();
        return "OK:Nombre reemplazado: " + nameFrames.length +
            " (ajustado: " + fittedName + ")" +
            " | Numero reemplazado: " + numberFrames.length +
            " (ajustado: " + fittedNumber + ")" +
            numberSummary +
            ihNumberMessage;
    } catch (error) {
        return "ERROR:" + error.message;
    }
}
