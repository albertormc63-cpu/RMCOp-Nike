(function () {
    // Modulo encargado de resolver y pintar las imagenes preview del equipo.
    window.RMC = window.RMC || {};
    window.RMC.ui = window.RMC.ui || {};

    const catalog = window.RMC.productCatalog;

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
            `./previews/teams/${lineSlug}/${variantSlug}/${teamSlug}-${variantFileCode}-${versionSlug}.webp`,
            `./previews/teams/${lineSlug}/${variantSlug}/${teamSlug}-${versionSlug}.webp`,
            `./previews/teams/${lineSlug}/${variantSlug}/${teamSlug}-${variantSlug}-${versionSlug}.webp`,
            `./previews/teams/${lineSlug}-${teamSlug}-${variantSlug}-${versionSlug}.webp`
        ];

        if (lineName === "masculino") {
            paths.push(`./previews/teams/${teamSlug}-${variantSlug}-${versionSlug}.webp`);
        }

        if (lineName === "masculino" && variantSlug === "standard") {
            paths.push(`./previews/teams/${teamSlug}-${versionSlug}.webp`);
        }

        return paths;
    }

    function paintPreview(element, options) {
        // Prueba cada ruta hasta que una imagen cargue; si ninguna existe, muestra iniciales.
        const image = new Image();
        const previewPaths = getPreviewPaths(options.line, options.team, options.variant, options.version);
        let previewIndex = 0;

        function tryPreview() {
            const previewPath = previewPaths[previewIndex];

            element.style.backgroundImage = `url("${previewPath}")`;
            image.src = previewPath;
        }

        element.classList.remove("missing");
        element.textContent = "";

        image.onload = function () {
            element.classList.remove("missing");
        };

        image.onerror = function () {
            previewIndex += 1;

            if (previewIndex < previewPaths.length) {
                tryPreview();
                return;
            }

            element.classList.add("missing");
            element.style.backgroundImage = "";
            element.textContent = getInitials(options.team);
        };

        tryPreview();
    }

    window.RMC.ui.previewView = {
        paintPreview: paintPreview
    };
})();
