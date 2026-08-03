(function () {
    // Este modulo es el puente CEP -> ExtendScript. main.js llama aqui, y aqui llamamos a Illustrator.
    window.RMC = window.RMC || {};
    window.RMC.illustrator = window.RMC.illustrator || {};

    let csInterface = null;
    let jsxLoaded = false;

    // CSInterface solo existe cuando el panel corre dentro de Illustrator/CEP.
    function getCSInterface() {
        if (!csInterface && typeof CSInterface === "function") {
            csInterface = new CSInterface();
        }

        return csInterface;
    }

    function getExtensionRoot() {
        // Ruta real de la extension; se usa para cargar jsx/rmcNike.jsx desde Illustrator.
        const currentPath = window.location.pathname;
        const decodedPath = decodeURIComponent(currentPath);
        return decodedPath.replace(/^\/([A-Za-z]:\/)/, "$1").replace(/\/index\.html$/i, "");
    }

    // JSON.stringify escapa comillas/apostrofes para mandar texto seguro a evalScript.
    function toJsxString(value) {
        return JSON.stringify(String(value == null ? "" : value));
    }

    function toJsxNumber(value) {
        const numberValue = Number(value);
        return isFinite(numberValue) && numberValue > 0 ? String(numberValue) : "null";
    }

    function toJsxJson(value) {
        return JSON.stringify(JSON.stringify(value || null));
    }

    // Envuelve cs.evalScript en Promise para poder usar async/await en el panel.
    function evalScript(script) {
        return new Promise(function (resolve, reject) {
            const cs = getCSInterface();

            if (!cs) {
                reject(new Error("CSInterface no esta disponible. Abre el panel desde Illustrator."));
                return;
            }

            cs.evalScript(script, function (result) {
                if (result && result.indexOf("EvalScript error") === 0) {
                    reject(new Error(result));
                    return;
                }

                if (result && result.indexOf("ERROR:") === 0) {
                    reject(new Error(result.replace(/^ERROR:/, "")));
                    return;
                }

                resolve(result ? result.replace(/^OK:/, "") : "");
            });
        });
    }

    // Carga una sola vez las funciones JSX globales usadas por el panel.
    async function ensureJsxLoaded() {
        if (jsxLoaded) return;

        const jsxPath = `${getExtensionRoot()}/jsx/rmcNike.jsx`;
        await evalScript(`$.evalFile(${toJsxString(jsxPath)})`);
        jsxLoaded = true;
    }

    async function openFile(filePath) {
        await ensureJsxLoaded();
        return evalScript(`RMCNike_openFile(${toJsxString(filePath)})`);
    }

    async function confirmReplace(filePath) {
        await ensureJsxLoaded();
        const result = await evalScript(`RMCNike_confirmReplace(${toJsxString(filePath)})`);
        return result === "YES";
    }

    async function confirmOfficialSwatchesOverwrite(filePath) {
        await ensureJsxLoaded();
        const result = await evalScript(`RMCNike_confirmOfficialSwatchesOverwrite(${toJsxString(filePath)})`);
        return result === "YES";
    }

    async function showAlert(message) {
        await ensureJsxLoaded();
        return evalScript(`RMCNike_alert(${toJsxString(message)})`);
    }

    async function applyNameNumber(payload) {
        // Punto unico que manda textos, limites de ajuste e instrucciones IH
        // hacia ExtendScript para modificar el documento abierto.
        await ensureJsxLoaded();
        await evalScript(`$.evalFile(${toJsxString(`${getExtensionRoot()}/jsx/rmcNike.jsx`)})`);
        const fitRule = payload.fitRule || {};

        return evalScript([
            "RMCNike_applyNameNumber(",
            toJsxString(payload.namePlaceholder),
            ",",
            toJsxString(payload.numberPlaceholder),
            ",",
            toJsxString(payload.name),
            ",",
            toJsxString(payload.number),
            ",",
            payload.replaceNumber ? "true" : "false",
            ",",
            toJsxNumber(fitRule.nameMaxWidth),
            ",",
            toJsxNumber(fitRule.numberMaxWidth),
            ",",
            toJsxNumber(fitRule.smallNumberMaxWidth),
            ",",
            toJsxNumber(fitRule.buffer),
            ",",
            toJsxNumber(fitRule.minScale),
            ",",
            toJsxString(fitRule.unit || "in"),
            ",",
            toJsxNumber(fitRule.numberMiterLimit),
            ",",
            toJsxNumber(fitRule.smallNumberMiterLimit),
            ",",
            toJsxJson(payload.ihNumberRule),
            ")"
        ].join(""));
    }

    async function extractOfficialSwatches() {
        // Lee las muestras del documento activo y regresa JSON listo para guardarse.
        await ensureJsxLoaded();
        await evalScript(`$.evalFile(${toJsxString(`${getExtensionRoot()}/jsx/swatches.jsx`)})`);
        return evalScript("RMCNike_extractOfficialSwatches()");
    }

    async function addUsedColors() {
        // Corre la accion de Illustrator que agrega al panel Muestras los colores usados.
        await ensureJsxLoaded();
        await evalScript(`$.evalFile(${toJsxString(`${getExtensionRoot()}/jsx/swatches.jsx`)})`);
        return evalScript("RMCNike_addUsedColors()");
    }

    async function savePdfAndCloseActiveDocument(filePath) {
        // Ultimo paso del batch por fila: Illustrator guarda PDF en la ruta
        // esperada y cierra para dejar limpio el siguiente documento.
        await ensureJsxLoaded();
        return evalScript(`RMCNike_savePdfAndCloseActiveDocument(${toJsxString(filePath)})`);
    }

    window.RMC.illustrator.bridge = {
        openFile: openFile,
        confirmReplace: confirmReplace,
        confirmOfficialSwatchesOverwrite: confirmOfficialSwatchesOverwrite,
        showAlert: showAlert,
        applyNameNumber: applyNameNumber,
        extractOfficialSwatches: extractOfficialSwatches,
        addUsedColors: addUsedColors,
        savePdfAndCloseActiveDocument: savePdfAndCloseActiveDocument
    };
})();
