(function () {
    // Modulo de UI para la seccion Pedido: lee/limpia campos y pinta resumen/previews.
    window.RMC = window.RMC || {};
    window.RMC.ui = window.RMC.ui || {};

    const catalog = window.RMC.productCatalog;
    const previewView = window.RMC.ui.previewView;
    let customDestinationFolder = "";

    function getVersion() {
        // Home es el default operativo si por alguna razon no hay radio seleccionado.
        const checked = document.querySelector("input[name='version']:checked");
        return checked ? checked.value : "Home";
    }

    function variantUsesVersion(state) {
        return catalog.variantUsesVersion(getVariant(state.selectedVariant));
    }

    function getProductLine(fallback) {
        const select = document.getElementById("productLineSelect");
        return select && select.value ? select.value : fallback;
    }

    function getVariant(fallback) {
        const select = document.getElementById("variantSelect") || document.getElementById("teamVariantSelect");
        return select && select.value ? select.value : fallback;
    }

    function renderVariants(state) {
        const selects = document.querySelectorAll(".variant-select");

        if (!selects.length) return;

        selects.forEach(function (select) {
            select.innerHTML = "";

            catalog.variants.forEach(function (variant) {
                const option = document.createElement("option");
                option.value = variant.name;
                option.textContent = variant.name;
                select.appendChild(option);
            });

            select.value = state.selectedVariant;
        });
    }

    function syncVariantSelects(state) {
        document.querySelectorAll(".variant-select").forEach(function (select) {
            select.value = state.selectedVariant;
        });
    }

    function renderStyleOptions(state) {
        // El style depende de linea/variante. Standard usa Home/Away; IH/TB usan sufijo fijo.
        const select = document.getElementById("styleCode");
        const lineConfig = catalog.getLineConfig(state.selectedLine);
        const currentAudience = select && select.value ? select.value.charAt(0) : "A";
        const variantName = getVariant(state.selectedVariant);
        const suffix = catalog.getVariantStyleSuffix(variantName, getVersion());

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

    function renderVersionControls(state) {
        // Solo las variantes que lo declaran usan Home/Away; las demas bloquean esos radios.
        const usesVersion = variantUsesVersion(state);

        document.querySelectorAll("input[name='version']").forEach(function (input) {
            input.disabled = !usesVersion;
        });

        document.querySelectorAll(".version-toggle label").forEach(function (label) {
            label.classList.toggle("disabled", !usesVersion);
        });
    }

    function updateSelectedSummary(state) {
        const selectedTeamName = document.getElementById("selectedTeamName");
        const selectedPreview = document.getElementById("selectedPreview");
        const nickname = catalog.getTeamNickname(state.selectedLine, state.selectedTeam);

        selectedTeamName.innerHTML = "";
        selectedTeamName.appendChild(document.createTextNode(state.selectedTeam));

        if (nickname) {
            const nicknameElement = document.createElement("span");
            nicknameElement.className = "selected-team-nickname";
            nicknameElement.textContent = ` - ${nickname}`;
            selectedTeamName.appendChild(nicknameElement);
        }

        previewView.paintPreview(selectedPreview, {
            line: state.selectedLine,
            team: state.selectedTeam,
            variant: getVariant(state.selectedVariant),
            version: variantUsesVersion(state) ? getVersion() : "Overview"
        });
    }

    function collectOrder(state) {
        // Punto unico donde convertimos el formulario HTML en un objeto de pedido.
        return {
            wo: sanitizeWorkOrder(document.getElementById("wo").value),
            line: getProductLine(state.selectedLine),
            team: state.selectedTeam,
            variant: getVariant(state.selectedVariant),
            version: getVersion(),
            style: document.getElementById("styleCode").value.trim().toUpperCase(),
            size: document.getElementById("size").value,
            number: sanitizeNumber(document.getElementById("playerNumber").value),
            name: document.getElementById("playerName").value.trim().toUpperCase(),
            demandFolder: document.getElementById("demandFolder").value,
            customDestinationFolder: customDestinationFolder
        };
    }

    function sanitizeWorkOrder(value) {
        // WO acepta numeros y guiones porque a veces viene compuesto.
        return String(value || "").replace(/[^0-9-]/g, "").trim();
    }

    function sanitizeNumber(value) {
        // Numero de jugador: solo digitos.
        return String(value || "").replace(/[^0-9]/g, "").trim();
    }

    function bindInputFilters() {
        const woInput = document.getElementById("wo");
        const numberInput = document.getElementById("playerNumber");

        if (woInput) {
            woInput.addEventListener("input", function () {
                woInput.value = sanitizeWorkOrder(woInput.value);
            });
        }

        if (numberInput) {
            numberInput.addEventListener("input", function () {
                numberInput.value = sanitizeNumber(numberInput.value);
            });
        }
    }

    function validateOrder(order) {
        const missing = [];

        if (!order.wo) missing.push("Work Order");
        if (!order.style) missing.push("Style");
        if (!order.demandFolder && !order.customDestinationFolder) missing.push("Destino");

        if (missing.length) {
            throw new Error(`Faltan datos: ${missing.join(", ")}`);
        }
    }

    function resetOrderFields(state) {
        // Se usa cuando cambia equipo/linea para evitar arrastrar datos de otra orden.
        const homeInput = document.querySelector("input[name='version'][value='Home']");
        const sizeSelect = document.getElementById("size");

        document.getElementById("wo").value = "";
        document.getElementById("playerNumber").value = "";
        document.getElementById("playerName").value = "";
        clearCustomDestinationFolder();

        if (sizeSelect) {
            sizeSelect.value = "SM";
        }

        if (homeInput) {
            homeInput.checked = true;
        }

        renderStyleOptions(state);
        renderVersionControls(state);
        updateSelectedSummary(state);
        resetProcessPreview();
    }

    function resetProcessPreview() {
        // Limpia la seccion 3 cuando el pedido deja de coincidir con lo revisado.
        document.getElementById("templatePathPreview").textContent = "Pendiente";
        document.getElementById("outputNamePreview").textContent = "Pendiente";
        document.getElementById("destinationPreview").textContent = "Pendiente";
    }

    function renderCustomDestinationFolder() {
        // Senal visual para saber si se usara el dropdown On Demand o una carpeta elegida a mano.
        const preview = document.getElementById("customDestinationPreview");
        const clearButton = document.getElementById("btnClearDestination");
        const demandFolderSelect = document.getElementById("demandFolder");

        if (!preview) return;

        if (customDestinationFolder) {
            preview.textContent = `Destino manual: ${customDestinationFolder}`;
            preview.classList.add("manual");
        } else {
            preview.textContent = "Usando carpeta On Demand seleccionada.";
            preview.classList.remove("manual");
        }

        if (clearButton) {
            clearButton.classList.toggle("hidden", !customDestinationFolder);
        }

        if (demandFolderSelect) {
            demandFolderSelect.disabled = Boolean(customDestinationFolder);
        }
    }

    function pickFolderFromCep(initialPath) {
        // CEP abre un dialogo nativo de carpeta dentro del panel de Illustrator.
        if (!window.cep || !window.cep.fs || !window.cep.fs.showOpenDialog) {
            throw new Error("El selector de carpeta CEP no esta disponible en este panel.");
        }

        const result = window.cep.fs.showOpenDialog(false, true, "Elegir carpeta destino", initialPath || "", null);

        if (!result || result.err) {
            return "";
        }

        if (Array.isArray(result.data)) {
            return normalizeCepFolderPath(result.data[0] || "");
        }

        return normalizeCepFolderPath(result.data || "");
    }

    function normalizeCepFolderPath(folderPath) {
        // showOpenDialog puede regresar file:///Users/...; Node necesita /Users/... para copiar.
        const value = String(folderPath || "").trim();

        if (value.indexOf("file://") !== 0) {
            return value;
        }

        try {
            return decodeURIComponent(value.replace(/^file:\/\//, ""));
        } catch (error) {
            return value.replace(/^file:\/\//, "");
        }
    }

    function chooseCustomDestinationFolder(initialPath) {
        const selectedFolder = pickFolderFromCep(initialPath);

        if (!selectedFolder) {
            return "";
        }

        customDestinationFolder = selectedFolder;
        renderCustomDestinationFolder();

        return customDestinationFolder;
    }

    function clearCustomDestinationFolder() {
        customDestinationFolder = "";
        renderCustomDestinationFolder();
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
        // Lee carpetas reales que contengan NIKE ON DEMAND desde ordersBase.
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
        syncVariantSelects: syncVariantSelects,
        renderStyleOptions: renderStyleOptions,
        renderVersionControls: renderVersionControls,
        bindInputFilters: bindInputFilters,
        updateSelectedSummary: updateSelectedSummary,
        collectOrder: collectOrder,
        validateOrder: validateOrder,
        resetOrderFields: resetOrderFields,
        resetProcessPreview: resetProcessPreview,
        chooseCustomDestinationFolder: chooseCustomDestinationFolder,
        clearCustomDestinationFolder: clearCustomDestinationFolder,
        renderCustomDestinationFolder: renderCustomDestinationFolder,
        loadDemandFolders: loadDemandFolders
    };
})();
