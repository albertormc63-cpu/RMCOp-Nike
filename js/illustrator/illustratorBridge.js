(function () {
    window.RMC = window.RMC || {};
    window.RMC.illustrator = window.RMC.illustrator || {};

    let csInterface = null;
    let jsxLoaded = false;

    function getCSInterface() {
        if (!csInterface && typeof CSInterface === "function") {
            csInterface = new CSInterface();
        }

        return csInterface;
    }

    function getExtensionRoot() {
        const currentPath = window.location.pathname;
        const decodedPath = decodeURIComponent(currentPath);
        return decodedPath.replace(/^\/([A-Za-z]:\/)/, "$1").replace(/\/index\.html$/i, "");
    }

    function toJsxString(value) {
        return JSON.stringify(String(value == null ? "" : value));
    }

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

    async function applyNameNumber(payload) {
        await ensureJsxLoaded();

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
            ")"
        ].join(""));
    }

    window.RMC.illustrator.bridge = {
        openFile: openFile,
        applyNameNumber: applyNameNumber
    };
})();
