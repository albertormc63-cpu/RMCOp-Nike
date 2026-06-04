(function () {
    // Modulo encargado de resolver y pintar las imagenes preview del equipo.
    window.RMC = window.RMC || {};
    window.RMC.ui = window.RMC.ui || {};

    const catalog = window.RMC.productCatalog;
    const previewCache = {};
    let previewRequestId = 0;

    function getInitials(teamName) {
        return teamName
            .split(" ")
            .map(function (word) { return word.charAt(0); })
            .join("");
    }

    function getPreviewPaths(lineName, teamName, variantName, version) {
        // Orden de busqueda: nueva arquitectura por carpetas y luego fallbacks antiguos.
        const lineSlug = catalog.slugify(lineName);
        const teamSlug = catalog.slugify(teamName);
        const variant = catalog.getVariant(variantName);
        const variantSlug = variant.slug;
        const variantFileCode = variant.code === "IH" ? "ih" : variantSlug;
        const versionSlug = version.toLowerCase();
        const paths = [
            `./previews/teams/${lineSlug}/${variantSlug}/${teamSlug}-${variantSlug}-${versionSlug}.webp`,
            `./previews/teams/${lineSlug}/${variantSlug}/${teamSlug}-${versionSlug}.webp`,
            `./previews/teams/${lineSlug}-${teamSlug}-${variantSlug}-${versionSlug}.webp`
        ];

        if (variantFileCode !== variantSlug) {
            paths.push(`./previews/teams/${lineSlug}/${variantSlug}/${teamSlug}-${variantFileCode}-${versionSlug}.webp`);
        }

        if (lineName === "masculino") {
            paths.push(`./previews/teams/${teamSlug}-${variantSlug}-${versionSlug}.webp`);
        }

        if (lineName === "masculino" && variantSlug === "standard") {
            paths.push(`./previews/teams/${teamSlug}-${versionSlug}.webp`);
        }

        return paths;
    }

    function getPreviewKey(options) {
        return [
            options.line,
            options.team,
            options.variant,
            options.version
        ].join("|");
    }

    function paintPreview(element, options) {
        // Prueba cada ruta hasta que una imagen cargue; si ninguna existe, muestra iniciales.
        const previewKey = getPreviewKey(options);
        const cachedPath = previewCache[previewKey];
        const requestId = ++previewRequestId;
        const image = new Image();
        const previewPaths = getPreviewPaths(options.line, options.team, options.variant, options.version);
        let previewIndex = 0;

        if (element.getAttribute("data-preview-key") === previewKey) {
            return;
        }

        element.setAttribute("data-preview-key", previewKey);
        element.setAttribute("data-preview-request", String(requestId));

        function isCurrentRequest() {
            return element.getAttribute("data-preview-request") === String(requestId);
        }

        function paintMissing() {
            if (!isCurrentRequest()) return;

            element.classList.add("missing");
            element.style.backgroundImage = "";
            element.textContent = getInitials(options.team);
        }

        if (cachedPath !== undefined) {
            if (cachedPath) {
                element.classList.remove("missing");
                element.textContent = "";
                element.style.backgroundImage = `url("${cachedPath}")`;
            } else {
                paintMissing();
            }

            return;
        }

        function tryPreview() {
            const previewPath = previewPaths[previewIndex];

            if (!isCurrentRequest()) return;

            element.style.backgroundImage = `url("${previewPath}")`;
            image.src = previewPath;
        }

        element.classList.remove("missing");
        element.textContent = "";

        image.onload = function () {
            if (!isCurrentRequest()) return;

            previewCache[previewKey] = previewPaths[previewIndex];
            element.classList.remove("missing");
        };

        image.onerror = function () {
            if (!isCurrentRequest()) return;

            previewIndex += 1;

            if (previewIndex < previewPaths.length) {
                tryPreview();
                return;
            }

            previewCache[previewKey] = "";
            paintMissing();
        };

        tryPreview();
    }

    window.RMC.ui.previewView = {
        paintPreview: paintPreview
    };
})();
