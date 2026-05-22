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

    function selectTeam(teamName) {
        state.selectedTeam = teamName;
        logFlow(`Equipo seleccionado: ${teamName}.`);
        teamsView.markSelected(teamName);
        orderView.updateSelectedSummary(state);
    }

    function selectTeamAndOpenOrder(teamName) {
        const changedTeam = state.selectedTeam !== teamName;

        selectTeam(teamName);

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
        renderTeams();
        selectTeam(state.selectedTeam);
    }

    function changeProductLine(lineName) {
        const visibleTeams = catalog.productLines[lineName] ? catalog.productLines[lineName].teams : catalog.productLines.masculino.teams;

        state.selectedLine = catalog.productLines[lineName] ? lineName : "masculino";

        if (visibleTeams.indexOf(state.selectedTeam) === -1) {
            state.selectedTeam = visibleTeams[0];
        }

        logFlow(`Linea seleccionada: ${catalog.getLineConfig(state.selectedLine).label}.`);
        state.lastOutputPath = "";
        orderView.renderStyleOptions(state);
        renderTeams();
        selectTeam(state.selectedTeam);
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
        const destinationFolder = services.path.join(paths.ordersBase, order.demandFolder);

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

    // Copia la plantilla al folder On Demand. Si ya existe, pide confirmacion antes de reemplazar.
    async function createCopy() {
        const services = nodeRuntime.services;

        if (!services.copyTemplate) {
            throw new Error("El servicio de copia no esta cargado.");
        }

        logFlow("Preparando copia de plantilla.");

        const preview = buildOrderPreview();
        const copyCheck = await services.copyTemplate({
            templatePath: preview.templatePath,
            ordersBase: preview.paths.ordersBase,
            demandFolder: preview.order.demandFolder,
            outputName: preview.outputName,
            dryRun: true
        });

        if (copyCheck.replaced) {
            const shouldReplace = await confirmTemplateReplace(copyCheck.outputPath);

            if (!shouldReplace) {
                console.warn("Copia cancelada para evitar reemplazar el archivo existente.");
                return;
            }
        }

        const copyResult = await services.copyTemplate({
            templatePath: preview.templatePath,
            ordersBase: preview.paths.ordersBase,
            demandFolder: preview.order.demandFolder,
            outputName: preview.outputName
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

        const message = await illustratorBridge.applyNameNumber({
            namePlaceholder: rule.placeholders.namePlaceholder,
            numberPlaceholder: rule.placeholders.numberPlaceholder,
            name: order.name || " ",
            number: order.number || " ",
            replaceNumber: rule.mode === "text"
        });

        console.log(message);
    }

    // Flujo del boton final: abre el PDF copiado y aplica datos si existen.
    async function openAndApplyOrderData() {
        await openCurrentFileInIllustrator();
        await applyOrderDataToIllustrator();
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

        document.getElementById("variantSelect").addEventListener("change", function (event) {
            state.lastOutputPath = "";
            changeVariant(event.target.value);
            orderView.resetProcessPreview();
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

        document.getElementById("btnReviewOrder").addEventListener("click", function () {
            try {
                const preview = buildOrderPreview();
                const rule = textRules.getTextRule(preview.order);

                if (rule.mode === "text-only") {
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
            });
        });

        document.getElementById("btnResetPanel").addEventListener("click", function () {
            location.reload();
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        nodeRuntime.load();
        orderView.renderVariants(state);
        orderView.renderStyleOptions(state);
        orderView.bindInputFilters();
        renderTeams();
        selectTeam(state.selectedTeam);
        renderSettings();
        bindEvents();
        orderView.loadDemandFolders(nodeRuntime, logFlow);

        console.log("RMC Nike Panel cargado correctamente.");
    });
})();
