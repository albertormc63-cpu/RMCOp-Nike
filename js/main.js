(function () {
    // main.js coordina los modulos: UI, servicios Node e Illustrator.
    const catalog = window.RMC.productCatalog;
    const nodeRuntime = window.RMC.nodeServices.create(logFlow);
    const orderView = window.RMC.ui.orderView;
    const teamsView = window.RMC.ui.teamsView;
    const textRules = window.RMC.illustrator.textRules;
    const illustratorBridge = window.RMC.illustrator.bridge;

    // Estado vivo del panel. Se actualiza cuando el usuario cambia linea/equipo/variante.
    const state = {
        selectedLine: "masculino",
        selectedTeam: catalog.teams[0].name,
        selectedVariant: catalog.variants[0].name,
        lastOutputPath: ""
    };

    function logFlow(message) {
        console.log(`[Flujo] ${message}`);
    }

    function getCurrentPaths() {
        return nodeRuntime.getCurrentPaths();
    }

    function getExtensionRootPath() {
        // Ruta local de la extension; se usa para escribir archivos de configuracion.
        const services = nodeRuntime.services;
        const decodedPath = decodeURIComponent(window.location.pathname).replace(/^\/([A-Za-z]:\/)/, "$1");

        return services.path.dirname(decodedPath);
    }

    function getOfficialSwatchesPath() {
        const services = nodeRuntime.services;

        return services.path.join(getExtensionRootPath(), "js/config/officialSwatches.json");
    }

    function showPage(pageId) {
        document.querySelectorAll(".page").forEach(function (page) {
            page.classList.toggle("active", page.id === pageId);
        });

        document.querySelectorAll(".step-button").forEach(function (button) {
            button.classList.toggle("active", button.getAttribute("data-page") === pageId);
        });
    }

    function renderSettings() {
        const paths = getCurrentPaths();
        const config = nodeRuntime.services.config;

        document.getElementById("modePreview").textContent = config ? config.mode : "Sin Node";
        document.getElementById("templatesBasePreview").textContent = paths ? paths.templatesBase : "No disponible";
        document.getElementById("ordersBasePreview").textContent = paths ? paths.ordersBase : "No disponible";
    }

    function renderTeams() {
        logFlow("Pintando equipos disponibles.");
        teamsView.render(state, { onTeamSelected: selectTeamAndOpenOrder });
        teamsView.markSelected(state.selectedTeam);
    }

    function selectTeam(teamName, shouldUpdateSummary) {
        state.selectedTeam = teamName;
        logFlow(`Equipo seleccionado: ${teamName}.`);
        teamsView.markSelected(teamName);

        if (shouldUpdateSummary !== false) {
            orderView.updateSelectedSummary(state);
        }
    }

    function selectTeamAndOpenOrder(teamName) {
        const changedTeam = state.selectedTeam !== teamName;

        selectTeam(teamName, !changedTeam);

        if (changedTeam) {
            state.lastOutputPath = "";
            orderView.resetOrderFields(state);
            logFlow("Datos del pedido reiniciados por cambio de equipo.");
        }

        showPage("pageOrder");
    }

    function changeVariant(variantName) {
        state.selectedVariant = variantName;
        logFlow(`Variante seleccionada: ${variantName}.`);
        state.lastOutputPath = "";
        orderView.syncVariantSelects(state);
        orderView.renderVersionControls(state);
        orderView.renderStyleOptions(state);
        renderTeams();
        orderView.updateSelectedSummary(state);
        orderView.resetProcessPreview();
    }

    function changeProductLine(lineName) {
        const visibleTeams = catalog.productLines[lineName] ? catalog.productLines[lineName].teams : catalog.productLines.masculino.teams;

        state.selectedLine = catalog.productLines[lineName] ? lineName : "masculino";

        if (visibleTeams.indexOf(state.selectedTeam) === -1) {
            state.selectedTeam = visibleTeams[0];
        }

        logFlow(`Linea seleccionada: ${catalog.getLineConfig(state.selectedLine).label}.`);
        state.lastOutputPath = "";
        renderTeams();
        orderView.resetOrderFields(state);
    }

    // Arma rutas/nombres del pedido y pinta la seccion 3 antes de copiar.
    function buildOrderPreview() {
        const services = nodeRuntime.services;

        if (!services.buildTemplatePath || !services.buildOutputName || !services.path) {
            throw new Error("Los servicios Node no estan cargados.");
        }

        logFlow("Construyendo vista previa del pedido.");

        const paths = getCurrentPaths();
        const order = orderView.collectOrder(state);
        orderView.validateOrder(order);

        const templatePath = services.buildTemplatePath({
            basePath: paths.templatesBase,
            line: order.line,
            team: order.team,
            variant: order.variant,
            version: order.version,
            style: order.style,
            size: order.size
        });
        const outputName = services.buildOutputName(order);
        const destinationFolder = order.customDestinationFolder || services.path.join(paths.ordersBase, order.demandFolder);

        document.getElementById("templatePathPreview").textContent = templatePath;
        document.getElementById("outputNamePreview").textContent = outputName;
        document.getElementById("destinationPreview").textContent = destinationFolder;

        return {
            order: order,
            paths: paths,
            templatePath: templatePath,
            outputName: outputName,
            destinationFolder: destinationFolder
        };
    }

    function getStyleFamily(styleCode) {
        // Convierte A1000H/A1000A/A1000IH -> A1000 y Y1000H/Y1000A/Y1000IH -> Y1000.
        return String(styleCode || "").replace(/IH$/i, "").replace(/[HA]$/i, "");
    }

    function getTextFitRule(order) {
        // Busca regla por equipo/style. Si algun dia hay tallas especiales, acepta overrides por talla.
        const rules = nodeRuntime.services.textFitRules;

        if (!rules) {
            return null;
        }

        const styleFamily = getStyleFamily(order.style);
        const teamRules = rules.teams && rules.teams[order.team];
        const styleRules = teamRules && teamRules[styleFamily];
        const sizeRule = styleRules && styleRules.sizes && styleRules.sizes[order.size];
        const defaultRule = rules.defaults && rules.defaults[styleFamily];
        const resolved = sizeRule || styleRules || defaultRule;

        if (!resolved) {
            logFlow(`Sin regla de ajuste para ${order.team} ${styleFamily} ${order.size}.`);
            return null;
        }

        return {
            unit: rules.unit || "in",
            buffer: Number(rules.buffer || 1),
            minScale: Number(rules.minScale || 50),
            nameMaxWidth: Number(resolved.nameMaxWidth || 0),
            numberMaxWidth: Number(resolved.numberMaxWidth || 0),
            smallNumberMaxWidth: Number(resolved.smallNumberMaxWidth || 0)
        };
    }

    function getIhNumberRule() {
        // Regla para duplicar numeros expandidos/rasterizados de Indigenous Heritage.
        const services = nodeRuntime.services;

        if (services.ihNumberRules) {
            return services.ihNumberRules;
        }

        if (services.path && typeof require === "function") {
            try {
                const extensionRoot = services.path.dirname(decodeURIComponent(window.location.pathname).replace(/^\/([A-Za-z]:\/)/, "$1"));
                services.ihNumberRules = require(services.path.join(extensionRoot, "js/config/ihNumberRules.json"));
                return services.ihNumberRules;
            } catch (error) {
                console.error("No se pudo cargar ihNumberRules.json como fallback:");
                console.error(error.message);
            }
        }

        return null;
    }

    // Copia la plantilla al destino resuelto: On Demand o carpeta elegida manualmente.
    async function createCopy() {
        const services = nodeRuntime.services;

        if (!services.copyTemplate) {
            throw new Error("El servicio de copia no esta cargado.");
        }

        logFlow("Preparando copia de plantilla.");

        const preview = buildOrderPreview();
        const copyCheck = await services.copyTemplate({
            templatePath: preview.templatePath,
            destinationFolder: preview.destinationFolder,
            outputName: preview.outputName,
            number: preview.order.number,
            name: preview.order.name,
            dryRun: true
        });

        if (copyCheck.outputName && copyCheck.outputName !== preview.outputName) {
            preview.outputName = copyCheck.outputName;
            document.getElementById("outputNamePreview").textContent = preview.outputName;
            console.warn(`Ya existia el nombre base; se usara: ${preview.outputName}`);
        }

        if (copyCheck.replaced) {
            const shouldReplace = await confirmTemplateReplace(copyCheck.outputPath);

            if (!shouldReplace) {
                console.warn("Copia cancelada para evitar reemplazar el archivo existente.");
                return;
            }
        }

        const copyResult = await services.copyTemplate({
            templatePath: preview.templatePath,
            destinationFolder: preview.destinationFolder,
            outputName: preview.outputName,
            number: preview.order.number,
            name: preview.order.name
        });
        const outputPath = typeof copyResult === "string" ? copyResult : copyResult.outputPath;
        const replaced = typeof copyResult === "object" && copyResult.replaced;

        state.lastOutputPath = outputPath;
        logFlow(replaced ? "Copia existente reemplazada con la plantilla limpia." : "Copia creada y lista para abrir en Illustrator.");
        console.log(replaced ? "Plantilla reemplazada correctamente:" : "Plantilla copiada correctamente:");
        console.log(outputPath);
    }

    async function confirmTemplateReplace(outputPath) {
        try {
            return await illustratorBridge.confirmReplace(outputPath);
        } catch (error) {
            console.warn("No se pudo mostrar confirmacion nativa de Illustrator; usando confirmacion del panel.");
            return confirm(`Ya existe este archivo:\n\n${outputPath}\n\nSi continuas, se reemplazara con una copia limpia de la plantilla.`);
        }
    }

    async function openCurrentFileInIllustrator() {
        if (!state.lastOutputPath) {
            throw new Error("Primero crea la copia de plantilla para abrirla en Illustrator.");
        }

        const message = await illustratorBridge.openFile(state.lastOutputPath);
        console.log(message);
    }

    async function applyOrderDataToIllustrator() {
        const order = orderView.collectOrder(state);
        const rule = textRules.getTextRule(order);
        const hasName = order.name !== "";
        const hasNumber = order.number !== "";

        if (!hasName && !hasNumber) {
            console.warn("Sin nombre ni numero: se deja la plantilla tal como viene.");
            return;
        }

        if (!rule.placeholders) {
            throw new Error(`No hay reglas de texto registradas para ${order.team}.`);
        }

        if (rule.mode === "text-only") {
            console.warn(rule.message);
        }
        if (rule.mode === "raster-number") {
            console.warn(rule.message);
        }

        const isIhVariant = order.variant !== "Standard";
        const shouldReplaceNumber = rule.mode === "text" && !isIhVariant;
        const fitRule = getTextFitRule(order);
        const ihNumberRule = isIhVariant ? getIhNumberRule() : null;

        if (isIhVariant && hasNumber && !ihNumberRule) {
            console.warn("No se cargaron reglas IH desde JSON; Illustrator usara reglas IH internas de respaldo.");
        }

        const message = await illustratorBridge.applyNameNumber({
            namePlaceholder: rule.placeholders.namePlaceholder,
            numberPlaceholder: rule.placeholders.numberPlaceholder,
            name: order.name || " ",
            number: order.number || " ",
            replaceNumber: shouldReplaceNumber,
            fitRule: fitRule,
            ihNumberRule: ihNumberRule
        });

        console.log(message);
    }

    // Flujo del boton final: abre el PDF copiado y aplica datos si existen.
    async function openAndApplyOrderData() {
        await openCurrentFileInIllustrator();
        await applyOrderDataToIllustrator();
    }

    function formatOfficialSwatchesJson(swatchData) {
        // Formato compacto para revisar a mano: una muestra por linea.
        const lines = [
            "{",
            `  "document": ${JSON.stringify(swatchData.document || "")},`,
            "  \"swatches\": ["
        ];
        const swatches = Array.isArray(swatchData.swatches) ? swatchData.swatches : [];

        swatches.forEach(function (swatch, index) {
            const suffix = index < swatches.length - 1 ? "," : "";
            lines.push(`    { "name": ${JSON.stringify(swatch.name || "")} }${suffix}`);
        });

        lines.push("  ]");
        lines.push("}");

        return lines.join("\n");
    }

    async function extractOfficialSwatches() {
        // Herramienta manual: genera la lista maestra desde una plantilla abierta y autorizada.
        const services = nodeRuntime.services;

        if (!services.fs || !services.path) {
            throw new Error("Node no esta cargado; no se puede guardar officialSwatches.json.");
        }

        const outputPath = getOfficialSwatchesPath();
        const shouldOverwrite = await illustratorBridge.confirmOfficialSwatchesOverwrite(outputPath);

        if (!shouldOverwrite) {
            console.warn("Extraccion de muestras oficiales cancelada; officialSwatches.json no se modifico.");
            return;
        }

        const rawJson = await illustratorBridge.extractOfficialSwatches();
        const swatchData = parseSwatchesJson(rawJson);
        const formattedJson = formatOfficialSwatchesJson(swatchData);

        services.fs.writeFileSync(outputPath, formattedJson + "\n", "utf8");

        console.log(`Muestras oficiales extraidas desde: ${swatchData.document || "Documento sin nombre"}`);
        console.log(`Total de muestras oficiales: ${(swatchData.swatches || []).length}`);
        console.log(`JSON actualizado: ${outputPath}`);
    }

    function parseSwatchesJson(rawJson) {
        const trimmedJson = String(rawJson || "").trim();

        if (trimmedJson.charAt(0) !== "{") {
            throw new Error(`Illustrator no regreso JSON de muestras. Respuesta recibida: ${trimmedJson || "vacia"}`);
        }

        return JSON.parse(trimmedJson);
    }

    async function validateOfficialSwatches() {
        // Compara el documento abierto contra la lista oficial guardada en config.
        const services = nodeRuntime.services;

        if (!services.fs || !services.path) {
            throw new Error("Node no esta cargado; no se puede leer officialSwatches.json.");
        }

        const officialPath = getOfficialSwatchesPath();

        if (!services.fs.existsSync(officialPath)) {
            throw new Error(`No existe la lista oficial de muestras:\n${officialPath}`);
        }

        const officialData = JSON.parse(services.fs.readFileSync(officialPath, "utf8"));
        const officialNames = (officialData.swatches || [])
            .map(function (swatch) { return swatch.name; })
            .filter(Boolean);
        const officialLookup = {};

        officialNames.forEach(function (name) {
            officialLookup[name] = true;
        });

        const addUsedMessage = await illustratorBridge.addUsedColors();
        console.log(addUsedMessage);

        const currentData = parseSwatchesJson(await illustratorBridge.extractOfficialSwatches());
        const currentNames = (currentData.swatches || [])
            .map(function (swatch) { return swatch.name; })
            .filter(Boolean);
        const outsideList = [];

        currentNames.forEach(function (name) {
            if (!officialLookup[name] && outsideList.indexOf(name) === -1) {
                outsideList.push(name);
            }
        });

        console.log(`Validando muestras de: ${currentData.document || "Documento sin nombre"}`);
        console.log(`Lista oficial: ${officialPath}`);

        if (!outsideList.length) {
            console.log("Muestras OK: el documento no tiene muestras fuera de la lista oficial.");
            return;
        }

        console.warn(`Muestras fuera de lista oficial: ${outsideList.length}`);
        outsideList.forEach(function (name) {
            console.warn(`  - ${name}`);
        });
    }

    function bindEvents() {
        document.querySelectorAll(".step-button").forEach(function (button) {
            button.addEventListener("click", function () {
                showPage(button.getAttribute("data-page"));
            });
        });

        document.querySelectorAll("input[name='version']").forEach(function (input) {
            input.addEventListener("change", function () {
                state.lastOutputPath = "";
                orderView.renderStyleOptions(state);
                orderView.updateSelectedSummary(state);
                orderView.resetProcessPreview();
            });
        });

        document.querySelectorAll(".variant-select").forEach(function (select) {
            select.addEventListener("change", function (event) {
                changeVariant(event.target.value);
            });
        });

        document.getElementById("productLineSelect").addEventListener("change", function (event) {
            changeProductLine(event.target.value);
        });

        ["wo", "styleCode", "size", "playerNumber", "playerName", "demandFolder"].forEach(function (id) {
            const element = document.getElementById(id);

            if (!element) return;

            element.addEventListener("change", function () {
                state.lastOutputPath = "";
                orderView.resetProcessPreview();
            });
        });

        document.getElementById("btnChooseDestination").addEventListener("click", function () {
            try {
                const paths = getCurrentPaths();
                const selectedFolder = orderView.chooseCustomDestinationFolder(paths ? paths.ordersBase : "");

                if (selectedFolder) {
                    state.lastOutputPath = "";
                    orderView.resetProcessPreview();
                    logFlow(`Destino manual seleccionado: ${selectedFolder}.`);
                }
            } catch (error) {
                console.error("No se pudo elegir carpeta destino:");
                console.error(error.message);
            }
        });

        document.getElementById("btnClearDestination").addEventListener("click", function () {
            state.lastOutputPath = "";
            orderView.clearCustomDestinationFolder();
            orderView.resetProcessPreview();
            logFlow("Destino manual limpiado; se usara la carpeta On Demand seleccionada.");
        });

        document.getElementById("btnReviewOrder").addEventListener("click", function () {
            try {
                const preview = buildOrderPreview();
                const rule = textRules.getTextRule(preview.order);

                if (rule.mode === "text-only" || rule.mode === "raster-number") {
                    console.warn(rule.message);
                }

                showPage("pageProcess");
                console.log("Pedido listo para procesar.");
            } catch (error) {
                console.error(error.message);
            }
        });

        document.getElementById("btnCrearCopia").addEventListener("click", function () {
            createCopy().catch(function (error) {
                console.error("No se pudo crear la copia:");
                console.error(error.message);
            });
        });

        document.getElementById("btnAbrirAplicar").addEventListener("click", function () {
            openAndApplyOrderData().catch(function (error) {
                console.error("No se pudo abrir y aplicar datos:");
                console.error(error.message);
                alert(error.message);
            });
        });

        document.getElementById("btnExtractOfficialSwatches").addEventListener("click", function () {
            extractOfficialSwatches().catch(function (error) {
                console.error("No se pudieron extraer las muestras oficiales:");
                console.error(error.message);
                alert(error.message);
            });
        });

        document.getElementById("btnValidateOfficialSwatches").addEventListener("click", function () {
            validateOfficialSwatches().catch(function (error) {
                console.error("No se pudieron validar las muestras:");
                console.error(error.message);
                alert(error.message);
            });
        });

        document.getElementById("btnResetPanel").addEventListener("click", function () {
            location.reload();
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        nodeRuntime.load();
        orderView.renderVariants(state);
        orderView.renderVersionControls(state);
        orderView.renderStyleOptions(state);
        orderView.bindInputFilters();
        orderView.renderCustomDestinationFolder();
        renderTeams();
        orderView.updateSelectedSummary(state);
        renderSettings();
        bindEvents();
        orderView.loadDemandFolders(nodeRuntime, logFlow);

        console.log("RMC Nike Panel cargado correctamente.");
    });
})();
