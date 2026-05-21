(function () {
    window.RMC = window.RMC || {};
    window.RMC.ui = window.RMC.ui || {};

    const catalog = window.RMC.productCatalog;
    const previewView = window.RMC.ui.previewView;

    function getVersion() {
        const checked = document.querySelector("input[name='version']:checked");
        return checked ? checked.value : "Home";
    }

    function getProductLine(fallback) {
        const select = document.getElementById("productLineSelect");
        return select && select.value ? select.value : fallback;
    }

    function getVariant(fallback) {
        const select = document.getElementById("variantSelect");
        return select && select.value ? select.value : fallback;
    }

    function renderVariants(state) {
        const select = document.getElementById("variantSelect");

        if (!select) return;

        select.innerHTML = "";

        catalog.variants.forEach(function (variant) {
            const option = document.createElement("option");
            option.value = variant.name;
            option.textContent = variant.name;
            select.appendChild(option);
        });

        select.value = state.selectedVariant;
    }

    function renderStyleOptions(state) {
        const select = document.getElementById("styleCode");
        const lineConfig = catalog.getLineConfig(state.selectedLine);
        const currentAudience = select && select.value ? select.value.charAt(0) : "A";
        const suffix = catalog.getVersionStyleSuffix(getVersion());

        if (!select) return;

        select.innerHTML = "";

        lineConfig.styles.forEach(function (style) {
            const styleCode = `${style.base}${suffix}`;
            const option = document.createElement("option");
            option.value = styleCode;
            option.textContent = `${styleCode} · ${style.label}`;
            select.appendChild(option);
        });

        const matchingOption = Array.prototype.find.call(select.options, function (option) {
            return option.value.charAt(0) === currentAudience;
        });

        if (matchingOption) {
            select.value = matchingOption.value;
        }
    }

    function updateSelectedSummary(state) {
        const selectedTeamName = document.getElementById("selectedTeamName");
        const selectedPreview = document.getElementById("selectedPreview");

        selectedTeamName.textContent = state.selectedTeam;
        previewView.paintPreview(selectedPreview, {
            line: state.selectedLine,
            team: state.selectedTeam,
            variant: getVariant(state.selectedVariant),
            version: getVersion()
        });
    }

    function collectOrder(state) {
        return {
            wo: document.getElementById("wo").value.trim(),
            line: getProductLine(state.selectedLine),
            team: state.selectedTeam,
            variant: getVariant(state.selectedVariant),
            version: getVersion(),
            style: document.getElementById("styleCode").value.trim().toUpperCase(),
            size: document.getElementById("size").value,
            number: document.getElementById("playerNumber").value.trim(),
            name: document.getElementById("playerName").value.trim().toUpperCase(),
            demandFolder: document.getElementById("demandFolder").value
        };
    }

    function validateOrder(order) {
        const missing = [];

        if (!order.wo) missing.push("Work Order");
        if (!order.style) missing.push("Style");
        if (!order.number) missing.push("Numero");
        if (!order.demandFolder) missing.push("Carpeta On Demand");

        if (missing.length) {
            throw new Error(`Faltan datos: ${missing.join(", ")}`);
        }
    }

    function resetOrderFields(state) {
        const homeInput = document.querySelector("input[name='version'][value='Home']");
        const sizeSelect = document.getElementById("size");

        document.getElementById("wo").value = "";
        document.getElementById("playerNumber").value = "";
        document.getElementById("playerName").value = "";

        if (sizeSelect) {
            sizeSelect.value = "LG";
        }

        if (homeInput) {
            homeInput.checked = true;
        }

        renderStyleOptions(state);
        updateSelectedSummary(state);
        resetProcessPreview();
    }

    function resetProcessPreview() {
        document.getElementById("templatePathPreview").textContent = "Pendiente";
        document.getElementById("outputNamePreview").textContent = "Pendiente";
        document.getElementById("destinationPreview").textContent = "Pendiente";
    }

    function fillDemandFolderOptions(folderNames, placeholder) {
        const select = document.getElementById("demandFolder");

        select.innerHTML = "";

        if (placeholder) {
            const option = document.createElement("option");
            option.value = "";
            option.textContent = placeholder;
            select.appendChild(option);
            return;
        }

        folderNames.forEach(function (folderName) {
            const option = document.createElement("option");
            option.value = folderName;
            option.textContent = folderName;
            select.appendChild(option);
        });
    }

    function loadDemandFolders(nodeRuntime, logFlow) {
        const services = nodeRuntime.services;
        const paths = nodeRuntime.getCurrentPaths();

        if (!services.fs || !services.path || !paths) {
            logFlow("Usando carpetas On Demand de ejemplo porque Node no esta listo.");
            return;
        }

        try {
            logFlow("Buscando carpetas reales que contengan NIKE ON DEMAND.");

            const entries = services.fs.readdirSync(paths.ordersBase);
            const folderNames = entries
                .filter(function (entryName) {
                    const entryPath = services.path.join(paths.ordersBase, entryName);
                    return services.fs.statSync(entryPath).isDirectory() && entryName.toUpperCase().indexOf("NIKE ON DEMAND") !== -1;
                })
                .sort(function (a, b) { return a.localeCompare(b, undefined, { numeric: true }); });

            if (!folderNames.length) {
                fillDemandFolderOptions([], "No se encontraron carpetas NIKE ON DEMAND");
                console.warn(`No encontre carpetas NIKE ON DEMAND en: ${paths.ordersBase}`);
                return;
            }

            fillDemandFolderOptions(folderNames);
            logFlow(`Carpetas On Demand cargadas: ${folderNames.length}.`);
        } catch (error) {
            console.error("No se pudieron leer las carpetas On Demand:");
            console.error(error.message);
        }
    }

    window.RMC.ui.orderView = {
        getVersion: getVersion,
        renderVariants: renderVariants,
        renderStyleOptions: renderStyleOptions,
        updateSelectedSummary: updateSelectedSummary,
        collectOrder: collectOrder,
        validateOrder: validateOrder,
        resetOrderFields: resetOrderFields,
        resetProcessPreview: resetProcessPreview,
        loadDemandFolders: loadDemandFolders
    };
})();
