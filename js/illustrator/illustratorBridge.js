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

    async function applyNameNumber(payload) {
        await ensureJsxLoaded();
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
            toJsxNumber(fitRule.buffer),
            ",",
            toJsxNumber(fitRule.minScale),
            ",",
            toJsxString(fitRule.unit || "in"),
            ",",
            toJsxJson(payload.ihNumberRule),
            ")"
        ].join(""));
    }

    window.RMC.illustrator.bridge = {
        openFile: openFile,
        confirmReplace: confirmReplace,
        applyNameNumber: applyNameNumber
    };
})();
