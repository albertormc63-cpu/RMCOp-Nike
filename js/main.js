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
        lastOutputPath: "",
        batch: {
            excelPath: "",
            destinationFolder: "",
            data: null,
            selectedStyleFamily: "",
            selectedSizes: [],
            lastResults: []
        }
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

    function normalizeCepPath(value) {
        const pathValue = String(value || "").trim();

        if (pathValue.indexOf("file://") !== 0) {
            return pathValue;
        }

        try {
            return decodeURIComponent(pathValue.replace(/^file:\/\//, ""));
        } catch (error) {
            return pathValue.replace(/^file:\/\//, "");
        }
    }

    function pickFileFromCep(title, initialPath) {
        if (!window.cep || !window.cep.fs || !window.cep.fs.showOpenDialog) {
            throw new Error("El selector CEP no esta disponible. Abre el panel desde Illustrator.");
        }

        const result = window.cep.fs.showOpenDialog(false, false, title, initialPath || "", null);

        if (!result || result.err) {
            return "";
        }

        if (Array.isArray(result.data)) {
            return normalizeCepPath(result.data[0] || "");
        }

        return normalizeCepPath(result.data || "");
    }

    function pickFolderFromCep(title, initialPath) {
        if (!window.cep || !window.cep.fs || !window.cep.fs.showOpenDialog) {
            throw new Error("El selector CEP no esta disponible. Abre el panel desde Illustrator.");
        }

        const result = window.cep.fs.showOpenDialog(false, true, title, initialPath || "", null);

        if (!result || result.err) {
            return "";
        }

        if (Array.isArray(result.data)) {
            return normalizeCepPath(result.data[0] || "");
        }

        return normalizeCepPath(result.data || "");
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
        // Convierte A1000H/A1000A/A1000IH/A1000TB -> A1000.
        return String(styleCode || "").replace(/IH$/i, "").replace(/TB$/i, "").replace(/[HA]$/i, "");
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

    function renderBatchSummary() {
        const batchData = state.batch.data;
        const selectedStyleFamily = state.batch.selectedStyleFamily;
        const filteredRows = batchData ? getRowsByStyleFamily(batchData.validRows, selectedStyleFamily) : [];
        const validCount = batchData ? filteredRows.length : 0;
        const invalidCount = batchData ? batchData.invalidRows.length : 0;
        const sizeCounts = countBatchRowsBy(filteredRows, "size");
        const sizes = Object.keys(sizeCounts).sort();
        const styleFamilyCounts = batchData ? batchData.counts.byStyleFamily || {} : {};
        const styleFamilies = Object.keys(styleFamilyCounts).sort();
        const rowsPreview = document.getElementById("batchRowsPreview");
        const styleFamilyList = document.getElementById("batchStyleFamilyList");
        const sizeList = document.getElementById("batchSizeList");

        state.batch.selectedSizes = state.batch.selectedSizes.filter(function (size) {
            return sizes.indexOf(size) !== -1;
        });

        document.getElementById("batchExcelPreview").textContent = state.batch.excelPath || "Sin Excel seleccionado";
        document.getElementById("batchDestinationPreview").textContent = state.batch.destinationFolder || "Sin destino seleccionado";
        document.getElementById("batchValidCount").textContent = String(validCount);
        document.getElementById("batchInvalidCount").textContent = String(invalidCount);
        document.getElementById("batchSizeCount").textContent = String(sizes.length);

        styleFamilyList.innerHTML = "";
        renderStyleFamilyCard(styleFamilyList, "", "Todas", batchData ? batchData.validRows.length : 0);
        styleFamilies.forEach(function (styleFamily) {
            renderStyleFamilyCard(styleFamilyList, styleFamily, styleFamily, styleFamilyCounts[styleFamily]);
        });

        sizeList.innerHTML = "";
        renderSizeCheckbox(sizeList, "", "Todas", filteredRows.length, state.batch.selectedSizes.length === 0);
        sizes.forEach(function (size) {
            renderSizeCheckbox(sizeList, size, size, sizeCounts[size], state.batch.selectedSizes.indexOf(size) !== -1);
        });

        if (!batchData) {
            rowsPreview.textContent = "Importa un Excel para revisar filas.";
            return;
        }

        const lines = [];
        lines.push(`Hoja: ${batchData.sheetName}`);
        lines.push(`Encabezados: fila ${batchData.headerRow || 1} | Datos desde fila ${batchData.dataStartRow || 2}`);
        lines.push(`Filtro style: ${getSelectedBatchStyleFamilyLabel()} | Filtro talla: ${getSelectedBatchSizeLabel()}`);
        lines.push(`Validas en seleccion: ${getSelectedBatchRows().length} | Errores del Excel: ${invalidCount}`);

        if (invalidCount) {
            lines.push("");
            lines.push("Errores:");
            batchData.invalidRows.slice(0, 12).forEach(function (row) {
                lines.push(`Fila ${row.sourceRow}: ${row.errors.join(", ")} | WO ${row.wo || "?"}`);
            });
        }

        lines.push("");
        lines.push("Primeras filas validas:");
        getSelectedBatchRows().slice(0, 14).forEach(function (row) {
            lines.push(`Fila ${row.sourceRow} | ${row.styleFamily}/${row.size} | ${row.wo} | ${row.team} | ${row.style} | ${row.name} #${row.number}`);
        });

        rowsPreview.textContent = lines.join("\n");
    }

    function renderStyleFamilyCard(container, value, label, count) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "batch-choice-card";
        button.classList.toggle("active", state.batch.selectedStyleFamily === value);
        button.textContent = `${label}: ${count}`;
        button.addEventListener("click", function () {
            state.batch.selectedStyleFamily = value;
            state.batch.selectedSizes = [];
            renderBatchSummary();
            console.log(`Familia style seleccionada: ${getSelectedBatchStyleFamilyLabel()} (${getSelectedBatchRows().length} filas).`);
        });
        container.appendChild(button);
    }

    function renderSizeCheckbox(container, value, label, count, checked) {
        const option = document.createElement("label");
        const input = document.createElement("input");
        const text = document.createElement("span");

        option.className = "batch-size-option";
        option.classList.toggle("active", checked);
        input.type = "checkbox";
        input.checked = checked;
        text.textContent = `${label}: ${count}`;

        input.addEventListener("change", function () {
            if (!value) {
                state.batch.selectedSizes = [];
            } else if (input.checked) {
                if (state.batch.selectedSizes.indexOf(value) === -1) {
                    state.batch.selectedSizes.push(value);
                }
            } else {
                state.batch.selectedSizes = state.batch.selectedSizes.filter(function (size) {
                    return size !== value;
                });
            }

            renderBatchSummary();
            console.log(`Tallas batch seleccionadas: ${getSelectedBatchSizeLabel()} (${getSelectedBatchRows().length} filas).`);
        });

        option.appendChild(input);
        option.appendChild(text);
        container.appendChild(option);
    }

    function countBatchRowsBy(rows, key) {
        return rows.reduce(function (counts, row) {
            const value = row[key] || "(vacio)";
            counts[value] = (counts[value] || 0) + 1;
            return counts;
        }, {});
    }

    function getRowsByStyleFamily(rows, styleFamily) {
        if (!styleFamily) {
            return rows;
        }

        return rows.filter(function (row) {
            return row.styleFamily === styleFamily;
        });
    }

    function getSelectedBatchRows() {
        const batchData = state.batch.data;
        const selectedStyleFamily = state.batch.selectedStyleFamily;
        const selectedSizes = state.batch.selectedSizes;

        if (!batchData) {
            return [];
        }

        return batchData.validRows.filter(function (row) {
            const matchesStyleFamily = !selectedStyleFamily || row.styleFamily === selectedStyleFamily;
            const matchesSize = selectedSizes.length === 0 || selectedSizes.indexOf(row.size) !== -1;
            return matchesStyleFamily && matchesSize;
        });
    }

    function getSelectedBatchStyleFamilyLabel() {
        return state.batch.selectedStyleFamily || "todas";
    }

    function getSelectedBatchSizeLabel() {
        return state.batch.selectedSizes.length ? state.batch.selectedSizes.join(", ") : "todas";
    }

    function formatElapsedTime(milliseconds) {
        const totalMilliseconds = Math.max(0, Math.floor(milliseconds));
        const minutes = Math.floor(totalMilliseconds / 60000);
        const seconds = Math.floor((totalMilliseconds % 60000) / 1000);
        const ms = totalMilliseconds % 1000;

        return [
            String(minutes).padStart(2, "0"),
            ":",
            String(seconds).padStart(2, "0"),
            ".",
            String(ms).padStart(3, "0")
        ].join("");
    }

    function renderBatchTimer(milliseconds, isRunning) {
        const timer = document.getElementById("batchTimerPreview");
        const timerBox = timer && timer.parentNode;

        if (!timer) {
            return;
        }

        timer.textContent = formatElapsedTime(milliseconds);

        if (timerBox) {
            timerBox.classList.toggle("running", Boolean(isRunning));
        }
    }

    function startBatchTimer() {
        const startedAt = Date.now();
        const intervalId = setInterval(function () {
            renderBatchTimer(Date.now() - startedAt, true);
        }, 100);

        renderBatchTimer(0, true);

        return {
            startedAt: startedAt,
            intervalId: intervalId
        };
    }

    function stopBatchTimer(timerState) {
        const elapsed = Date.now() - timerState.startedAt;

        clearInterval(timerState.intervalId);
        renderBatchTimer(elapsed, false);

        return elapsed;
    }

    function chooseBatchExcel() {
        const services = nodeRuntime.services;
        const paths = getCurrentPaths();

        if (!services.createOrderDataFromExcel) {
            throw new Error("El importador de Excel no esta cargado.");
        }

        const excelPath = pickFileFromCep("Elegir Excel Nike On Demand", paths ? paths.ordersBase : "");

        if (!excelPath) {
            return;
        }

        state.batch.excelPath = excelPath;
        state.batch.data = services.createOrderDataFromExcel(excelPath);
        state.batch.selectedStyleFamily = "";
        state.batch.selectedSizes = [];
        state.batch.lastResults = [];
        renderBatchSummary();

        console.log(`Excel importado: ${excelPath}`);
        console.log(`Encabezados detectados en fila ${state.batch.data.headerRow}; datos desde fila ${state.batch.data.dataStartRow}.`);
        console.log(`Filas validas: ${state.batch.data.validRows.length}`);
        console.warn(`Filas con error: ${state.batch.data.invalidRows.length}`);
    }

    function chooseBatchDestination() {
        const paths = getCurrentPaths();
        const folderPath = pickFolderFromCep("Elegir destino batch", paths ? paths.ordersBase : "");

        if (!folderPath) {
            return;
        }

        state.batch.destinationFolder = folderPath;
        renderBatchSummary();
        console.log(`Destino batch: ${folderPath}`);
    }

    function buildBatchPreview(order, sizeDestinationFolder) {
        const services = nodeRuntime.services;
        const paths = getCurrentPaths();
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

        return {
            order: order,
            templatePath: templatePath,
            outputName: outputName,
            destinationFolder: sizeDestinationFolder
        };
    }

    async function createBatchCopyForOrder(order) {
        const services = nodeRuntime.services;
        const styleFamilyFolder = order.styleFamily || getStyleFamily(order.style);
        const sizeDestinationFolder = services.path.join(state.batch.destinationFolder, styleFamilyFolder, order.size);
        const preview = buildBatchPreview(order, sizeDestinationFolder);

        return services.copyTemplate({
            templatePath: preview.templatePath,
            destinationFolder: preview.destinationFolder,
            outputName: preview.outputName,
            number: preview.order.number,
            name: preview.order.name
        });
    }

    async function createBatchCopies() {
        const services = nodeRuntime.services;
        const batchData = state.batch.data;

        if (!batchData) {
            throw new Error("Primero importa un Excel.");
        }

        if (!state.batch.destinationFolder) {
            throw new Error("Primero elige un destino batch.");
        }

        if (!services.copyTemplate || !services.buildTemplatePath || !services.buildOutputName || !services.path) {
            throw new Error("Servicios Node incompletos para batch.");
        }

        const validRows = getSelectedBatchRows();
        const results = [];
        let okCount = 0;
        let errorCount = 0;

        if (batchData.invalidRows.length) {
            console.warn(`Se saltaran ${batchData.invalidRows.length} filas invalidas.`);
        }

        logFlow(`Creando copias batch (${getSelectedBatchStyleFamilyLabel()} / ${getSelectedBatchSizeLabel()}): ${validRows.length} filas validas.`);

        for (let index = 0; index < validRows.length; index++) {
            const order = validRows[index];

            try {
                const copyResult = await createBatchCopyForOrder(order);

                okCount++;
                results.push({
                    ok: true,
                    sourceRow: order.sourceRow,
                    outputPath: copyResult.outputPath,
                    outputName: copyResult.outputName,
                    size: order.size
                });
                console.log(`OK fila ${order.sourceRow}: ${copyResult.outputPath}`);
            } catch (error) {
                errorCount++;
                results.push({
                    ok: false,
                    sourceRow: order.sourceRow,
                    size: order.size,
                    message: error.message
                });
                console.error(`Error fila ${order.sourceRow}: ${error.message}`);
            }
        }

        state.batch.lastResults = results;
        console.log(`Batch terminado. OK: ${okCount} | Errores: ${errorCount}`);
    }

    async function processBatchFull() {
        const batchData = state.batch.data;

        if (!batchData) {
            throw new Error("Primero importa un Excel.");
        }

        if (!state.batch.destinationFolder) {
            throw new Error("Primero elige un destino batch.");
        }

        if (batchData.invalidRows.length) {
            console.warn(`Se saltaran ${batchData.invalidRows.length} filas invalidas.`);
        }

        const timerState = startBatchTimer();
        let okCount = 0;
        let errorCount = 0;
        const results = [];

        try {
            const selectedRows = getSelectedBatchRows();

            logFlow(`Procesando batch completo (${getSelectedBatchStyleFamilyLabel()} / ${getSelectedBatchSizeLabel()}): ${selectedRows.length} filas validas.`);

            for (let index = 0; index < selectedRows.length; index++) {
                const order = selectedRows[index];

                try {
                    const copyResult = await createBatchCopyForOrder(order);

                    console.log(`Abriendo fila ${order.sourceRow}: ${copyResult.outputPath}`);
                    await openFileInIllustrator(copyResult.outputPath);
                    await applyOrderDataToIllustrator(order);
                    console.log(await illustratorBridge.savePdfAndCloseActiveDocument(copyResult.outputPath));

                    okCount++;
                    results.push({
                        ok: true,
                        sourceRow: order.sourceRow,
                        outputPath: copyResult.outputPath,
                        outputName: copyResult.outputName,
                        size: order.size
                    });
                    console.log(`Procesada fila ${order.sourceRow}: ${copyResult.outputName}`);
                } catch (error) {
                    errorCount++;
                    results.push({
                        ok: false,
                        sourceRow: order.sourceRow,
                        size: order.size,
                        message: error.message
                    });
                    console.error(`Error batch fila ${order.sourceRow}: ${error.message}`);
                }
            }

            state.batch.lastResults = results;
        } finally {
            const elapsed = stopBatchTimer(timerState);
            console.log(`Batch completo terminado. OK: ${okCount} | Errores: ${errorCount} | Tiempo: ${formatElapsedTime(elapsed)}`);
        }
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

    async function openFileInIllustrator(filePath) {
        if (!filePath) {
            throw new Error("No hay archivo listo para abrir en Illustrator.");
        }

        const message = await illustratorBridge.openFile(filePath);
        console.log(message);
    }

    async function openCurrentFileInIllustrator() {
        if (!state.lastOutputPath) {
            throw new Error("Primero crea la copia de plantilla para abrirla en Illustrator.");
        }

        await openFileInIllustrator(state.lastOutputPath);
    }

    async function applyOrderDataToIllustrator(orderOverride) {
        const order = orderOverride || orderView.collectOrder(state);
        const isBatchOrder = Boolean(orderOverride);
        const rule = textRules.getTextRule(order);
        const hasName = order.name !== "";
        const hasNumber = order.number !== "";

        if (!hasName && !hasNumber && !isBatchOrder) {
            console.warn("Sin nombre ni numero: se deja la plantilla tal como viene.");
            return;
        }

        if (!hasName && !hasNumber && isBatchOrder) {
            console.warn(`Fila ${order.sourceRow || "batch"} sin nombre/numero: se limpiaran placeholders con espacios.`);
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

        // La regla decide el motor: Standard/TB reemplazan texto; IH delega numero a arte expandido.
        const isIhVariant = rule.mode === "raster-number";
        const shouldReplaceNumber = rule.mode === "text";
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

        document.getElementById("btnChooseBatchExcel").addEventListener("click", function () {
            try {
                chooseBatchExcel();
            } catch (error) {
                console.error("No se pudo importar el Excel:");
                console.error(error.message);
                alert(error.message);
            }
        });

        document.getElementById("btnChooseBatchDestination").addEventListener("click", function () {
            try {
                chooseBatchDestination();
            } catch (error) {
                console.error("No se pudo elegir el destino batch:");
                console.error(error.message);
                alert(error.message);
            }
        });

        document.getElementById("btnProcessBatchFull").addEventListener("click", function () {
            processBatchFull().catch(function (error) {
                console.error("No se pudo aplicar el batch completo:");
                console.error(error.message);
                alert(error.message);
            });
        });

        document.getElementById("btnToggleBatchDetails").addEventListener("click", function () {
            const details = document.getElementById("batchRowsPreview");
            const isHidden = details.classList.toggle("hidden");

            this.textContent = isHidden ? "Ver mas detalles" : "Ocultar detalles";
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
        renderBatchSummary();
        bindEvents();
        orderView.loadDemandFolders(nodeRuntime, logFlow);

        console.log("RMC Nike Panel cargado correctamente.");
    });
})();
