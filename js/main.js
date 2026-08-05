(function () {
    // main.js coordina los modulos: UI, servicios Node e Illustrator.
    const catalog = window.RMC.productCatalog;
    const nodeRuntime = window.RMC.nodeServices.create(logFlow);
    const orderView = window.RMC.ui.orderView;
    const teamsView = window.RMC.ui.teamsView;
    const textRules = window.RMC.illustrator.textRules;
    const illustratorBridge = window.RMC.illustrator.bridge;
    const DEBUG_BATCH_PERF = false;
    const OPERATOR_DB_ROOT = "/Volumes/Fullsize/PATRONES ACOMODADOS PARA ROLLO/NIKE LACROSSE/RMCOp-NIKE/ASSETS/BD";

    // Estado vivo del panel. Se actualiza cuando el usuario cambia linea/equipo/variante.
    const state = {
        selectedLine: "masculino",
        selectedTeam: catalog.teams[0].name,
        selectedVariant: catalog.variants[0].name,
        lastOutputPath: "",
        settings: {
            databasePath: "",
            databaseLabel: "Central"
        },
        variantReserveWarnings: {},
        batch: {
            mode: "personalized",
            excelPath: "",
            destinationFolder: "",
            data: null,
            selectedStyleFamily: "",
            selectedSizes: [],
            selectedVariantCodes: [],
            variantCatalogLabels: null,
            shippingDateInput: "",
            lastResults: [],
            validation: null
        }
    };

    function logFlow(message) {
        console.log(`[Flujo] ${message}`);
    }

    function markGeneratedPdfFile(outputPath) {
        const services = nodeRuntime.services;

        if (!outputPath || !services.fileComments) {
            return;
        }

        const result = services.fileComments.markGeneratedPdf({
            fs: services.fs,
            childProcess: services.childProcess
        }, outputPath);

        if (result.ok) {
            console.log(`Comentario Finder aplicado: ${outputPath}`);
            return;
        }

        console.warn(`No se pudo aplicar comentario Finder al PDF: ${result.reason || "sin detalle"}`);
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

    function getLocalSettingsPath() {
        const services = nodeRuntime.services;

        if (!services.path) {
            return "";
        }

        return services.path.join(getExtensionRootPath(), "js/config/localSettings.json");
    }

    // La BD activa tiene dos niveles: config.js define la central por defecto,
    // y localSettings.json permite que cada maquina apunte a su BD de operador.
    function getDefaultPortfolioDbPath() {
        const services = nodeRuntime.services;
        const homePath = typeof process !== "undefined" && process.env ? process.env.HOME : "";
        const configPath = services.config && services.config.portfolio ? services.config.portfolio.databasePath : "";

        if (configPath) {
            return configPath;
        }

        if (!homePath || !services.path) {
            return "";
        }

        return services.path.join(homePath, "Documents/RMC - CEP/RMC_BD/RMC_CEP.sqlite");
    }

    function getOperatorDbPath(operatorCode) {
        const services = nodeRuntime.services;

        if (!services.path) {
            return "";
        }

        return services.path.join(OPERATOR_DB_ROOT, String(operatorCode || "").toUpperCase(), "RMC_CEP.sqlite");
    }

    // Se carga al iniciar el panel; por eso Thania/Antonio conservan su BD
    // aun cuando cierran Illustrator o se reinicia el CEP.
    function loadLocalSettings() {
        const services = nodeRuntime.services;
        const settingsPath = getLocalSettingsPath();

        state.settings.databasePath = "";
        state.settings.databaseLabel = "Central";

        if (!services.fs || !settingsPath || !services.fs.existsSync(settingsPath)) {
            return;
        }

        try {
            const saved = JSON.parse(services.fs.readFileSync(settingsPath, "utf8"));
            state.settings.databasePath = String(saved.databasePath || "").trim();
            state.settings.databaseLabel = String(saved.databaseLabel || "").trim() || "Personalizada";
        } catch (error) {
            console.warn(`No se pudo leer configuracion local: ${error.message}`);
        }
    }

    function saveLocalSettings(nextSettings) {
        const services = nodeRuntime.services;
        const settingsPath = getLocalSettingsPath();

        if (!services.fs || !services.path || !settingsPath) {
            throw new Error("No se puede guardar configuracion local sin Node/FS.");
        }

        const payload = {
            databasePath: nextSettings.databasePath || "",
            databaseLabel: nextSettings.databaseLabel || "Central",
            updatedAt: new Date().toISOString()
        };

        services.fs.mkdirSync(services.path.dirname(settingsPath), { recursive: true });
        services.fs.writeFileSync(settingsPath, JSON.stringify(payload, null, 2), "utf8");
        state.settings.databasePath = payload.databasePath;
        state.settings.databaseLabel = payload.databaseLabel;
        resetVariantCatalogCache();
    }

    function resetVariantCatalogCache() {
        state.variantReserveWarnings = {};
        state.batch.variantCatalogLabels = null;
    }

    function getPortfolioBaseFolder() {
        const services = nodeRuntime.services;
        const homePath = typeof process !== "undefined" && process.env ? process.env.HOME : "";
        const configPath = services.config && services.config.portfolio ? services.config.portfolio.basePath : "";

        if (configPath) {
            return configPath;
        }

        if (!homePath || !services.path) {
            return "";
        }

        return services.path.join(homePath, "Documents/RMC - CEP/RMCOp-Nike Portafolio interno");
    }

    function getPortfolioLogsFolder() {
        const services = nodeRuntime.services;
        const portfolioBase = getPortfolioBaseFolder();

        if (!portfolioBase) {
            return "";
        }

        return services.path.join(portfolioBase, "06_Logs");
    }

    function getPortfolioDbPath() {
        return state.settings.databasePath || getDefaultPortfolioDbPath();
    }

    function escapeCsvValue(value) {
        const text = value == null ? "" : String(value);

        if (/[",\r\n]/.test(text)) {
            return `"${text.replace(/"/g, '""')}"`;
        }

        return text;
    }

    function appendBatchProcessLog(selectedRows, results, elapsedMs) {
        const services = nodeRuntime.services;

        if (!services.fs || !services.path) {
            return;
        }

        const logsFolder = getPortfolioLogsFolder();

        if (!logsFolder) {
            return;
        }

        const now = new Date();
        const dateText = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, "0"),
            String(now.getDate()).padStart(2, "0")
        ].join("-");
        const timeText = now.toTimeString().slice(0, 8);
        const batchId = `${dateText.replace(/-/g, "")}-${timeText.replace(/:/g, "")}`;
        const herramienta = getBatchToolName();
        const fechaEmbarque = getBatchShippingDate(selectedRows);
        const finishedAt = now.toISOString();
        const startedAt = new Date(now.getTime() - elapsedMs).toISOString();
        const csvPath = services.path.join(logsFolder, "rmcop_nike_batch_log.csv");
        const jsonlPath = services.path.join(logsFolder, "rmcop_nike_batch_log.jsonl");
        const rowsBySource = selectedRows.reduce(function (map, order) {
            map[String(order.sourceRow)] = order;
            return map;
        }, {});
        const csvHeader = [
            "fecha",
            "hora",
            "herramienta",
            "batch_id",
            "wo",
            "style",
            "equipo",
            "variante",
            "size",
            "piezas",
            "tiempo_segundos",
            "ruta_destino",
            "estado",
            "errores"
        ];
        const csvRows = results.map(function (result) {
            const order = result.order || rowsBySource[String(result.sourceRow)] || {};
            const durationSeconds = Math.max(1, Math.round((result.durationMs || 0) / 1000));

            return [
                dateText,
                timeText,
                herramienta,
                batchId,
                order.wo || "",
                order.style || "",
                order.team || "",
                order.variant || "",
                order.size || result.size || "",
                order.qty || 1,
                durationSeconds,
                result.outputPath || "",
                result.ok ? "Completado" : "Error",
                result.ok ? 0 : (result.message || "Error desconocido")
            ].map(escapeCsvValue).join(",");
        });
        const jsonEntries = results.map(function (result) {
            const order = result.order || rowsBySource[String(result.sourceRow)] || {};

            return JSON.stringify({
                fecha: dateText,
                hora: timeText,
                herramienta: herramienta,
                batchId: batchId,
                fechaEmbarque: fechaEmbarque,
                sourceRow: result.sourceRow,
                wo: order.wo || "",
                shipOrder: order.shipOrder || "",
                style: order.style || "",
                equipo: order.team || "",
                variante: order.variant || "",
                size: order.size || result.size || "",
                piezas: order.qty || 1,
                tiempoSegundos: Math.max(1, Math.round((result.durationMs || 0) / 1000)),
                tiempoLoteSegundos: Math.round(elapsedMs / 1000),
                rutaDestino: result.outputPath || "",
                estado: result.ok ? "Completado" : "Error",
                errores: result.ok ? [] : [result.message || "Error desconocido"]
            });
        });

        if (!csvRows.length) {
            return;
        }

        // Bitacora plana para respaldo humano; SQLite sigue siendo la fuente
        // principal para RMC Control Center, duplicados y reportes.
        services.fs.mkdirSync(logsFolder, { recursive: true });

        if (!services.fs.existsSync(csvPath)) {
            services.fs.writeFileSync(csvPath, `${csvHeader.join(",")}\n`, "utf8");
        }

        services.fs.appendFileSync(csvPath, `${csvRows.join("\n")}\n`, "utf8");
        services.fs.appendFileSync(jsonlPath, `${jsonEntries.join("\n")}\n`, "utf8");
        console.log(`Log batch guardado: ${csvPath}`);

        // Este es el unico punto de escritura SQLite para el batch completo.
        // getPortfolioDbPath() decide si va a central o a la BD del operador.
        if (services.portfolioDb) {
            const dbResult = services.portfolioDb.recordBatchRun({
                fs: services.fs,
                path: services.path,
                childProcess: services.childProcess
            }, getPortfolioDbPath(), {
                run: {
                    id: batchId,
                    startedAt: startedAt,
                    finishedAt: finishedAt,
                    fecha: dateText,
                    herramienta: herramienta,
                    fechaEmbarque: fechaEmbarque,
                    sourceExcel: state.batch.excelPath || "",
                    destinationFolder: state.batch.destinationFolder || "",
                    styleFilter: getSelectedBatchStyleFamilyLabel(),
                    sizeFilter: getSelectedBatchSizeLabel(),
                    elapsedSeconds: Math.round(elapsedMs / 1000),
                    notes: "Registro automatico desde panel CEP."
                },
                results: results
            });

            console.log(`BD produccion actualizada: ${dbResult.dbPath} (${dbResult.storedItems || 0} items).`);
        }
    }

    function recordManualProcessLog(order, outputPath, elapsedMs) {
        const services = nodeRuntime.services;

        if (!services.portfolioDb || !services.fs || !services.path) {
            return;
        }

        // Manual usa el mismo escritor que batch para que Control Center lea
        // una sola familia de tablas: rmcop_nike_runs + rmcop_nike_items.
        const now = new Date();
        const dateText = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, "0"),
            String(now.getDate()).padStart(2, "0")
        ].join("-");
        const timeText = now.toTimeString().slice(0, 8);
        const runId = `${dateText.replace(/-/g, "")}-${timeText.replace(/:/g, "")}`;
        const outputName = outputPath ? services.path.basename(outputPath) : "";
        const dbResult = services.portfolioDb.recordBatchRun({
            fs: services.fs,
            path: services.path,
            childProcess: services.childProcess
        }, getPortfolioDbPath(), {
            run: {
                id: runId,
                startedAt: new Date(now.getTime() - elapsedMs).toISOString(),
                finishedAt: now.toISOString(),
                fecha: dateText,
                herramienta: "RMCOp-Nike Manual",
                fechaEmbarque: order.shippingDate || "",
                destinationFolder: outputPath ? services.path.dirname(outputPath) : "",
                styleFilter: order.style || "",
                sizeFilter: order.size || "",
                elapsedSeconds: Math.max(1, Math.round(elapsedMs / 1000)),
                notes: "Registro automatico desde flujo manual."
            },
            results: [{
                ok: true,
                sourceRow: 0,
                outputPath: outputPath,
                outputName: outputName,
                size: order.size,
                durationMs: elapsedMs,
                order: order
            }]
        });

        console.log(`BD produccion actualizada: ${dbResult.dbPath}`);
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
        const activeDbPath = getPortfolioDbPath();

        document.getElementById("modePreview").textContent = config ? config.mode : "Sin Node";
        document.getElementById("templatesBasePreview").textContent = paths ? paths.templatesBase : "No disponible";
        document.getElementById("ordersBasePreview").textContent = paths ? paths.ordersBase : "No disponible";
        renderDatabaseSettings(activeDbPath);
    }

    function getDatabaseStatus(dbPath) {
        const services = nodeRuntime.services;

        if (!services.fs || !services.path || !dbPath) {
            return {
                ok: false,
                message: "No disponible."
            };
        }

        if (!services.fs.existsSync(dbPath)) {
            return {
                ok: false,
                message: "No existe el archivo seleccionado."
            };
        }

        if (!services.portfolioDb || !services.portfolioDb.ensureSchema) {
            return {
                ok: false,
                message: "Servicio SQLite no disponible."
            };
        }

        try {
            // ensureSchema tambien migra indices/columnas faltantes. Validar aqui
            // evita guardar una ruta que luego falle al producir.
            services.portfolioDb.ensureSchema({
                fs: services.fs,
                path: services.path,
                childProcess: services.childProcess
            }, dbPath);

            return {
                ok: true,
                message: `Lista para RMCOp-Nike (${state.settings.databaseLabel || "Central"}).`
            };
        } catch (error) {
            return {
                ok: false,
                message: error.message
            };
        }
    }

    function assertUsableDatabasePath(dbPath) {
        const status = getDatabaseStatus(dbPath);

        if (!status.ok) {
            throw new Error(status.message);
        }
    }

    function renderDatabaseSettings(activeDbPath) {
        const dbPreview = document.getElementById("databasePathPreview");
        const statusPreview = document.getElementById("databaseStatusPreview");
        const status = getDatabaseStatus(activeDbPath);

        if (dbPreview) {
            dbPreview.textContent = activeDbPath || "No disponible";
        }

        if (statusPreview) {
            statusPreview.textContent = status.message;
            statusPreview.classList.toggle("manual", status.ok);
        }

        document.querySelectorAll("[data-db-preset]").forEach(function (button) {
            const preset = button.getAttribute("data-db-preset");
            const expectedPath = preset === "central" ? getDefaultPortfolioDbPath() : getOperatorDbPath(preset);

            button.classList.toggle("active", activeDbPath === expectedPath);
        });
    }

    function setPortfolioDatabasePath(databasePath, databaseLabel) {
        assertUsableDatabasePath(databasePath);
        saveLocalSettings({
            databasePath: databasePath,
            databaseLabel: databaseLabel
        });
        renderSettings();
        renderBatchSummary();
        logFlow(`BD activa: ${databaseLabel} -> ${databasePath}`);
    }

    function resetPortfolioDatabasePath() {
        assertUsableDatabasePath(getDefaultPortfolioDbPath());
        saveLocalSettings({
            databasePath: "",
            databaseLabel: "Central"
        });
        renderSettings();
        renderBatchSummary();
        logFlow(`BD activa restaurada a central: ${getDefaultPortfolioDbPath()}`);
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

    const excelFileTypes = ["xls", "xlsx", "xlsm", "xlsb"];

    function isExcelFilePath(filePath) {
        return /\.(xls|xlsx|xlsm|xlsb)$/i.test(String(filePath || "").trim());
    }

    function pickFileFromCep(title, initialPath, fileTypes) {
        if (!window.cep || !window.cep.fs || !window.cep.fs.showOpenDialog) {
            throw new Error("El selector CEP no esta disponible. Abre el panel desde Illustrator.");
        }

        const result = window.cep.fs.showOpenDialog(false, false, title, initialPath || "", fileTypes || null);

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
        assertOrderInStyleReserve(order);

        const templatePath = services.buildTemplatePath({
            basePath: paths.templatesBase,
            line: order.line,
            team: order.team,
            variant: order.variant,
            version: order.version,
            style: order.style,
            size: order.size,
            designCode: order.designCode
        });
        const fileIdentifier = order.namingSource === "roster" ? order.roster : order.wo;
        const outputName = services.buildOutputName(Object.assign({}, order, { wo: fileIdentifier }));
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
        // Convierte A1000H/A1000A/A1000IH/A1000TB/A1000JR/A1000AS -> A1000.
        return String(styleCode || "").replace(/IH$/i, "").replace(/TB$/i, "").replace(/JR$/i, "").replace(/AS$/i, "").replace(/SS$/i, "").replace(/[HA]$/i, "");
    }

    function getTextFitRule(order) {
        // Busca regla por variante/diseno/equipo/style. SS no siempre tiene equipo,
        // por eso tambien puede vivir en textFitRules.variants.
        const rules = nodeRuntime.services.textFitRules;

        if (!rules) {
            return null;
        }

        const styleFamily = getStyleFamily(order.style);
        const variantCode = getOrderVariantCode(order);
        const designCode = String((order && (order.catalogDesignCode || order.designCode)) || "").trim().toUpperCase();
        const variantRules = rules.variants && rules.variants[variantCode];
        const designRules = variantRules && variantRules.designs && variantRules.designs[designCode];
        const variantDesignRules = resolveTextFitStyleRule(designRules && designRules[styleFamily], order.size);
        const variantStyleRules = resolveTextFitStyleRule(variantRules && variantRules[styleFamily], order.size);
        const teamRules = rules.teams && rules.teams[order.team];
        const styleRules = resolveTextFitStyleRule(teamRules && teamRules[styleFamily], order.size);
        const defaultRule = rules.defaults && rules.defaults[styleFamily];
        const resolved = variantDesignRules || variantStyleRules || styleRules || defaultRule;

        if (!resolved) {
            logFlow(`Sin regla de ajuste para ${variantCode || "STD"} ${order.team || "sin equipo"} ${styleFamily} ${order.size}.`);
            return null;
        }

        return {
            unit: rules.unit || "in",
            buffer: Number(rules.buffer || 1),
            minScale: Number(rules.minScale || 50),
            nameMaxWidth: Number(resolved.nameMaxWidth || 0),
            numberMaxWidth: Number(resolved.numberMaxWidth || 0),
            smallNumberMaxWidth: Number(resolved.smallNumberMaxWidth || 0),
            numberMiterLimit: Number(resolved.numberMiterLimit || 0),
            smallNumberMiterLimit: Number(resolved.smallNumberMiterLimit || resolved.numberMiterLimit || 0)
        };
    }

    function resolveTextFitStyleRule(styleRules, size) {
        if (!styleRules) {
            return null;
        }

        return styleRules.sizes && styleRules.sizes[size] ? styleRules.sizes[size] : styleRules;
    }

    function getOrderVariantCode(order) {
        const explicitCode = String((order && (order.catalogVariantCode || order.variantCode)) || "").trim().toUpperCase();

        if (explicitCode) {
            return explicitCode;
        }

        const variantName = String((order && order.variant) || "").trim().toLowerCase();

        if (variantName === "stars & stripes") return "SS";
        if (variantName === "all stars") return "AS";
        if (variantName === "jr championship" || variantName === "jr champ" || variantName === "jr champ shorts") return "JR";
        if (variantName === "indigenous heritage") return "IH";
        if (variantName === "throwback") return "TB";

        return "";
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
        const renderStartedAt = DEBUG_BATCH_PERF && window.performance ? window.performance.now() : 0;
        const batchData = state.batch.data;
        const selectedStyleFamily = state.batch.selectedStyleFamily;
        const filteredRows = batchData ? getRowsByStyleFamily(batchData.validRows, selectedStyleFamily) : [];
        const validCount = batchData ? filteredRows.length : 0;
        const invalidCount = batchData ? batchData.invalidRows.length : 0;
        const sizeCounts = countBatchRowsBy(filteredRows, "size");
        const sizes = Object.keys(sizeCounts).sort();

        state.batch.selectedSizes = state.batch.selectedSizes.filter(function (size) {
            return sizes.indexOf(size) !== -1;
        });

        const filteredRowsBySize = getRowsBySizes(filteredRows, state.batch.selectedSizes);
        const variantCounts = countBatchRowsBy(filteredRowsBySize, getBatchVariantKey);
        const variantCodes = Object.keys(variantCounts).sort(function (left, right) {
            return getBatchVariantLabel(left).localeCompare(getBatchVariantLabel(right));
        });
        const styleFamilyCounts = batchData ? batchData.counts.byStyleFamily || {} : {};
        const styleFamilies = Object.keys(styleFamilyCounts).sort();
        const rowsPreview = document.getElementById("batchRowsPreview");
        const styleFamilyList = document.getElementById("batchStyleFamilyList");
        const sizeList = document.getElementById("batchSizeList");
        const variantList = document.getElementById("batchVariantList");

        state.batch.selectedVariantCodes = state.batch.selectedVariantCodes.filter(function (variantCode) {
            return variantCodes.indexOf(variantCode) !== -1;
        });
        const selectedRows = batchData ? getSelectedBatchRows() : [];

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

        if (variantList) {
            variantList.innerHTML = "";
            renderVariantCheckbox(variantList, "", "Todas", filteredRowsBySize.length, state.batch.selectedVariantCodes.length === 0);
            variantCodes.forEach(function (variantCode) {
                renderVariantCheckbox(
                    variantList,
                    variantCode,
                    getBatchVariantLabel(variantCode),
                    variantCounts[variantCode],
                    state.batch.selectedVariantCodes.indexOf(variantCode) !== -1
                );
            });
        }

        if (!batchData) {
            rowsPreview.textContent = "Importa un Excel para revisar filas.";
            updateBatchProcessButton();
            return;
        }

        let validation = null;
        let validationError = "";

        try {
            const validationStartedAt = DEBUG_BATCH_PERF && window.performance ? window.performance.now() : 0;
            validation = validateBatchSelection(selectedRows);
            if (DEBUG_BATCH_PERF && window.performance) {
                console.log(`[BatchPerf] validateBatchSelection: ${(window.performance.now() - validationStartedAt).toFixed(1)}ms`);
            }
        } catch (error) {
            clearBatchValidation();
            validationError = error.message;
        }

        const lines = [];
        lines.push(`Modo lote: ${getBatchModeLabel()}`);
        lines.push(`Hoja: ${batchData.sheetName}`);
        if (batchData.sourceFormat) {
            lines.push(`Formato: ${batchData.sourceFormat}`);
        }
        if (batchData.rosterName) {
            lines.push(`Roster: ${batchData.rosterName}`);
        }
        if (batchData.rosterNumber) {
            lines.push(`Numero roster: ${batchData.rosterNumber}`);
        }
        if (batchData.defaultWo || batchData.defaultShipOrder) {
            lines.push(`WO/Ship: ${batchData.defaultWo || "sin WO"} / ${batchData.defaultShipOrder || "sin Ship Order"}`);
        }
        if (batchData.totalPieces) {
            lines.push(`Piezas roster: ${batchData.totalPieces}`);
        }
        if (batchData.defaultShippingDate) {
            lines.push(`Fecha embarque: ${batchData.defaultShippingDate}`);
        }
        if (state.batch.mode === "generic") {
            lines.push(`Fecha embarque seleccionada: ${getBatchShippingDate([]) || "pendiente"}`);
        }
        lines.push(`Encabezados: fila ${batchData.headerRow || 1} | Datos desde fila ${batchData.dataStartRow || 2}`);
        lines.push(`Filtro style: ${getSelectedBatchStyleFamilyLabel()} | Filtro talla: ${getSelectedBatchSizeLabel()} | Filtro variante: ${getSelectedBatchVariantLabel()}`);
        lines.push(`Validas en seleccion: ${selectedRows.length} | Errores del Excel: ${invalidCount}`);
        lines.push("");

        if (state.batch.mode === "generic" && batchData.sourceFormat !== "generic-roster") {
            lines.push("Aviso: modo Genericas espera roster con encabezados en fila 16.");
            lines.push("");
        }

        if (!state.batch.destinationFolder) {
            lines.push("Validacion: elige destino batch para revisar existentes/faltantes.");
        } else if (validationError) {
            lines.push(`Validacion: error - ${validationError}`);
        } else if (validation) {
            lines.push("Validacion:");
            lines.push(`  Faltantes: ${validation.counts.FALTANTE || 0}`);
            lines.push(`  Ya creados: ${validation.counts.YA_CREADO || 0}`);
            lines.push(`  Archivo sin registro: ${validation.counts.ARCHIVO_SIN_REGISTRO || 0}`);
            lines.push(`  Registrado sin archivo: ${validation.counts.REGISTRADO_SIN_ARCHIVO || 0}`);
            lines.push(`  Conflictos: ${validation.counts.CONFLICTO || 0}`);
        }

        if (invalidCount) {
            lines.push("");
            lines.push("Errores:");
            batchData.invalidRows.slice(0, 12).forEach(function (row) {
                lines.push(`Fila ${row.sourceRow}: ${row.errors.join(", ")} | WO ${row.wo || "?"}`);
            });
        }

        lines.push("");
        lines.push("Primeras filas validas:");
        selectedRows.slice(0, 14).forEach(function (row) {
            const outputInfo = state.batch.destinationFolder ? buildBatchOutputInfo(row) : { outputName: buildBatchOutputName(row) };
            const shippingDate = state.batch.mode === "generic" ? getBatchShippingDate([]) : row.shippingDate;
            lines.push(`Fila ${row.sourceRow} | ${row.styleFamily}/${row.size} | ${row.team} | ${row.style} | ${row.name} #${row.number} | Emb ${shippingDate || "-"} | ${outputInfo.outputName}`);
        });

        if (validation) {
            const skippedRows = validation.rows.filter(function (row) {
                return row.status !== "FALTANTE";
            });

            if (skippedRows.length) {
                lines.push("");
                lines.push("Primeras filas omitidas por validacion:");
                skippedRows.slice(0, 12).forEach(function (row) {
                    lines.push(`Fila ${row.order.sourceRow} | ${row.status} | ${row.outputName}`);
                });
            }
        }

        rowsPreview.textContent = lines.join("\n");
        updateBatchProcessButton();
        if (DEBUG_BATCH_PERF && window.performance) {
            console.log(`[BatchPerf] renderBatchSummary: ${(window.performance.now() - renderStartedAt).toFixed(1)}ms`);
        }
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
            state.batch.selectedVariantCodes = [];
            clearBatchValidation();
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

            clearBatchValidation();
            renderBatchSummary();
            console.log(`Tallas batch seleccionadas: ${getSelectedBatchSizeLabel()} (${getSelectedBatchRows().length} filas).`);
        });

        option.appendChild(input);
        option.appendChild(text);
        container.appendChild(option);
    }

    function renderVariantCheckbox(container, value, label, count, checked) {
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
                state.batch.selectedVariantCodes = [];
            } else if (input.checked) {
                if (state.batch.selectedVariantCodes.indexOf(value) === -1) {
                    state.batch.selectedVariantCodes.push(value);
                }
            } else {
                state.batch.selectedVariantCodes = state.batch.selectedVariantCodes.filter(function (variantCode) {
                    return variantCode !== value;
                });
            }

            clearBatchValidation();
            renderBatchSummary();
            console.log(`Variantes batch seleccionadas: ${getSelectedBatchVariantLabel()} (${getSelectedBatchRows().length} filas).`);
        });

        option.appendChild(input);
        option.appendChild(text);
        container.appendChild(option);
    }

    function countBatchRowsBy(rows, key) {
        return rows.reduce(function (counts, row) {
            const value = typeof key === "function" ? key(row) : row[key];
            const normalizedValue = value || "(vacio)";
            counts[normalizedValue] = (counts[normalizedValue] || 0) + 1;
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

    function getRowsBySizes(rows, sizes) {
        if (!sizes || sizes.length === 0) {
            return rows;
        }

        return rows.filter(function (row) {
            return sizes.indexOf(row.size) !== -1;
        });
    }

    function getBatchVariantKey(row) {
        const variantCode = String(row && row.variantCode || "").trim().toUpperCase();

        return variantCode || String(row && row.variant || "STD").trim().toUpperCase();
    }

    function getBatchVariantCatalogLabels() {
        const services = nodeRuntime.services;

        if (state.batch.variantCatalogLabels) {
            return state.batch.variantCatalogLabels;
        }

        state.batch.variantCatalogLabels = { STD: "Standard" };

        if (services.styleVariantReserve && services.styleVariantReserveData) {
            state.batch.variantCatalogLabels = services.styleVariantReserve.listLabels(services.styleVariantReserveData);
            return state.batch.variantCatalogLabels;
        }

        return state.batch.variantCatalogLabels;
    }

    function warnMissingVariantReserve(order) {
        const services = nodeRuntime.services;

        if (!services.styleVariantReserveData || !services.styleVariantReserveData.variants || !services.styleVariantReserveData.variants.length) {
            return;
        }

        const warningKey = [
            order && order.style,
            order && order.variantCode,
            order && order.variant,
            order && order.team,
            order && order.designCode
        ].join("|");

        if (state.variantReserveWarnings[warningKey]) {
            return;
        }

        state.variantReserveWarnings[warningKey] = true;
        console.warn(`Style/variante no encontrado en reservas: ${order.style || "-"} ${order.variant || order.variantCode || "-"} ${order.team || order.designCode || "-"}. Se usaran reglas locales; actualiza js/config/styleVariantReserve.json desde SQLite si es una variante nueva.`);
    }

    function validateBatchRowsAgainstStyleReserve(batchData) {
        const services = nodeRuntime.services;

        if (!batchData || !services.styleVariantReserve || !services.styleVariantReserveData) {
            return batchData;
        }

        return services.styleVariantReserve.validateBatchData(services.styleVariantReserveData, batchData);
    }

    function assertOrderInStyleReserve(order) {
        const services = nodeRuntime.services;

        if (!order || !services.styleVariantReserve || !services.styleVariantReserveData) {
            return;
        }

        const reserveEntries = services.styleVariantReserve.getEntries(services.styleVariantReserveData);

        if (!reserveEntries.length || services.styleVariantReserve.findEntry(reserveEntries, order)) {
            return;
        }

        throw new Error(`Style/variante no esta en reservas locales: ${order.style || "-"} ${order.team || order.designCode || "-"}. Actualiza js/config/styleVariantReserve.json desde SQLite o da de alta la variante antes de procesar.`);
    }

    function getBatchVariantFallbackLabel(variantCode) {
        const batchData = state.batch.data;

        if (!batchData) {
            return variantCode || "Standard";
        }

        const match = batchData.validRows.find(function (row) {
            return getBatchVariantKey(row) === variantCode;
        });

        return match && match.variant ? match.variant : (variantCode || "Standard");
    }

    function getBatchVariantLabel(variantCode) {
        const normalizedCode = String(variantCode || "").trim().toUpperCase();
        const catalogLabels = getBatchVariantCatalogLabels();

        return catalogLabels[normalizedCode] || getBatchVariantFallbackLabel(normalizedCode);
    }

    function getSelectedBatchRows() {
        const batchData = state.batch.data;
        const selectedStyleFamily = state.batch.selectedStyleFamily;
        const selectedSizes = state.batch.selectedSizes;
        const selectedVariantCodes = state.batch.selectedVariantCodes;

        if (!batchData) {
            return [];
        }

        return batchData.validRows.filter(function (row) {
            const matchesStyleFamily = !selectedStyleFamily || row.styleFamily === selectedStyleFamily;
            const matchesSize = selectedSizes.length === 0 || selectedSizes.indexOf(row.size) !== -1;
            const matchesVariant = selectedVariantCodes.length === 0 || selectedVariantCodes.indexOf(getBatchVariantKey(row)) !== -1;
            return matchesStyleFamily && matchesSize && matchesVariant;
        });
    }

    function getSelectedBatchStyleFamilyLabel() {
        return state.batch.selectedStyleFamily || "todas";
    }

    function getSelectedBatchSizeLabel() {
        return state.batch.selectedSizes.length ? state.batch.selectedSizes.join(", ") : "todas";
    }

    function getSelectedBatchVariantLabel() {
        return state.batch.selectedVariantCodes.length
            ? state.batch.selectedVariantCodes.map(getBatchVariantLabel).join(", ")
            : "todas";
    }

    function getBatchModeLabel() {
        return state.batch.mode === "generic" ? "Genericas" : "Personalizadas";
    }

    function getBatchToolName() {
        return state.batch.mode === "generic" ? "RMCOp-Nike Genericas" : "RMCOp-Nike Personalizadas";
    }

    function getBatchShippingDate(rows) {
        if (state.batch.mode === "generic") {
            return formatDateInputAsShippingDate(state.batch.shippingDateInput);
        }

        const rowWithDate = (rows || []).find(function (row) {
            return row && row.shippingDate;
        });

        return rowWithDate ? rowWithDate.shippingDate : (state.batch.data && state.batch.data.defaultShippingDate) || "";
    }

    function formatDateInputAsShippingDate(value) {
        const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
        return match ? `${match[3]}/${match[2]}` : "";
    }

    function renderBatchModeButtons() {
        document.querySelectorAll("[data-batch-mode]").forEach(function (button) {
            button.classList.toggle("active", button.getAttribute("data-batch-mode") === state.batch.mode);
        });

        const importButton = document.getElementById("btnChooseBatchExcel");
        const shippingDateField = document.getElementById("batchGenericShippingDateField");

        if (importButton) {
            importButton.textContent = state.batch.mode === "generic" ? "Importar Roster Excel" : "Importar Excel";
        }

        if (shippingDateField) {
            shippingDateField.classList.toggle("hidden", state.batch.mode !== "generic");
        }
    }

    function resetBatchImportState() {
        state.batch.excelPath = "";
        state.batch.destinationFolder = "";
        state.batch.data = null;
        state.batch.selectedStyleFamily = "";
        state.batch.selectedSizes = [];
        state.batch.selectedVariantCodes = [];
        state.batch.shippingDateInput = "";
        state.batch.lastResults = [];
        const shippingDateInput = document.getElementById("batchGenericShippingDate");

        if (shippingDateInput) {
            shippingDateInput.value = "";
        }
        clearBatchValidation();
    }

    function getBatchExcelNameType(excelPath) {
        const services = nodeRuntime.services;
        const fileName = services.path ? services.path.basename(excelPath, services.path.extname(excelPath)) : excelPath;
        const normalizedName = String(fileName || "").toUpperCase();
        const hasToken = function (token) {
            return new RegExp(`(^|[^A-Z0-9])${token}([^A-Z0-9]|$)`).test(normalizedName);
        };

        if (hasToken("OD")) {
            return "personalized";
        }

        if (["ST", "IH", "TB", "AS", "JR"].some(hasToken)) {
            return "generic";
        }

        return "unknown";
    }

    function validateBatchExcelMode(excelPath, batchData, selectedMode) {
        const nameType = getBatchExcelNameType(excelPath);
        const isGenericRoster = batchData && batchData.sourceFormat === "generic-roster";

        // El modo elegido en UI manda: OD y Genericas comparten muchos campos,
        // asi que se valida nombre + estructura antes de permitir produccion.
        if (selectedMode === "personalized") {
            if (nameType === "generic" || isGenericRoster) {
                throw new Error("Este Excel parece ser de Genericas (ST/IH/TB/AS/JR o roster detallado). Selecciona la seccion Genericas antes de cargarlo.");
            }

            if (nameType === "unknown") {
                console.warn("El nombre del Excel no incluye OD; se acepto porque su estructura corresponde a Personalizadas.");
            }

            return;
        }

        if (nameType === "personalized") {
            throw new Error("Este Excel contiene OD y corresponde a Personalizadas. Selecciona la seccion Personalizadas antes de cargarlo.");
        }

        if (!isGenericRoster) {
            if (nameType === "generic") {
                throw new Error("El nombre corresponde a Genericas, pero el archivo no es un roster detallado. Debe incluir Style, Color, Qty, Size, Last Name y Player#.");
            }

            throw new Error("El Excel no tiene la estructura de roster detallado requerida por Genericas.");
        }

        if (nameType === "unknown") {
            console.warn("El nombre del Excel no incluye ST/IH/TB/AS/JR; se acepto porque su estructura corresponde a Genericas.");
        }
    }

    function setBatchMode(mode) {
        const nextMode = mode === "generic" ? "generic" : "personalized";

        if (state.batch.mode === nextMode) {
            return;
        }

        state.batch.mode = nextMode;
        resetBatchImportState();
        renderBatchModeButtons();
        renderBatchSummary();
        console.log(`Modo lote: ${getBatchModeLabel()}`);
    }

    function clearBatchValidation() {
        state.batch.validation = null;
    }

    function getPortfolioDbDeps() {
        const services = nodeRuntime.services;

        return {
            fs: services.fs,
            path: services.path,
            childProcess: services.childProcess
        };
    }

    function enrichOrderWithVariantCatalog(order) {
        const services = nodeRuntime.services;

        if (!order || !services.styleVariantReserve || !services.styleVariantReserveData) {
            return order;
        }

        try {
            // El CEP cruza cada pedido contra la reserva local versionada.
            // SQLite se usa solo para regenerar styleVariantReserve.json fuera del
            // proceso normal; asi evitamos bloquear la UI durante batch.
            const entry = services.styleVariantReserve.findEntry(services.styleVariantReserveData, order);

            if (!entry) {
                warnMissingVariantReserve(order);
                return order;
            }

            return Object.assign({}, order, {
                catalogVariantId: entry.id,
                catalogVariantCode: entry.variantCode,
                catalogVariantName: entry.variantName,
                catalogLiga: entry.liga,
                catalogDesignCode: entry.designCode,
                catalogDesignName: entry.designName,
                catalogOpNikeEnabled: entry.opnikeEnabled,
                catalogOpNikeRuleStatus: entry.opnikeRuleStatus,
                templateNamePlaceholder: entry.templateNamePlaceholder,
                templateNumberPlaceholder: entry.templateNumberPlaceholder,
                catalogPlaceholderMissing: ["AS", "SS", "JR"].indexOf(entry.variantCode) !== -1 &&
                    Boolean(order.name || order.number) &&
                    !entry.templateNamePlaceholder &&
                    !entry.templateNumberPlaceholder
            });
        } catch (error) {
            console.warn(`No se pudo leer rmc_nike_style_variants; se usaran reglas locales: ${error.message}`);
            return order;
        }
    }

    function buildBatchValidationKey(order) {
        const services = nodeRuntime.services;

        if (services.portfolioDb && services.portfolioDb.buildOrderKey) {
            return services.portfolioDb.buildOrderKey(order);
        }

        // Fallback defensivo: debe coincidir con portfolioDb.buildOrderKey
        // para que la validacion pre-batch y SQLite hablen la misma identidad.
        return [
            order.wo,
            order.shipOrder,
            order.style,
            order.team,
            order.size,
            order.name || (!order.name && !order.number ? "SIN_DATOS" : ""),
            order.number
        ].map(function (value) {
            return String(value || "").trim().toUpperCase().replace(/\s+/g, " ");
        }).join("|");
    }

    function assertCatalogTextRuleReady(order) {
        if (!order || (!order.name && !order.number)) {
            return;
        }

        const rule = textRules.getTextRule(order);

        if (rule.mode === "blocked") {
            throw new Error(rule.message);
        }
    }

    function buildBatchOutputInfo(order) {
        const services = nodeRuntime.services;
        const destinationFolder = getBatchDestinationFolderForOrder(order);
        const outputName = buildBatchOutputName(order);

        return {
            outputName: outputName,
            outputPath: services.path.join(destinationFolder, outputName)
        };
    }

    function sanitizeBatchOutputPart(value) {
        return String(value || "")
            .trim()
            .replace(/[\/\\:*?"<>|]/g, "")
            .replace(/\s+/g, " ");
    }

    function buildNameNumberOutputName(outputName, order) {
        const numberPart = sanitizeBatchOutputPart(order.number);
        const namePart = sanitizeBatchOutputPart(order.name);

        if (!numberPart || !namePart) {
            return outputName;
        }

        return String(outputName || "").replace(new RegExp(` ${numberPart}\\.pdf$`, "i"), ` ${numberPart} ${namePart}.pdf`);
    }

    function resolveBatchOutputNameCollisions(rows) {
        const services = nodeRuntime.services;
        const pathCounts = rows.reduce(function (counts, row) {
            counts[row.outputPath] = (counts[row.outputPath] || 0) + 1;
            return counts;
        }, {});

        // Si dos filas iban al mismo PDF pero una trae nombre/numero extra,
        // intenta usar un nombre mas especifico antes de marcar conflicto.
        return rows.map(function (row) {
            if (pathCounts[row.outputPath] <= 1) {
                return row;
            }

            const outputName = buildNameNumberOutputName(row.outputName, row.order);

            if (outputName === row.outputName) {
                return row;
            }

            return Object.assign({}, row, {
                outputName: outputName,
                outputPath: services.path.join(getBatchDestinationFolderForOrder(row.order), outputName)
            });
        });
    }

    function getBatchDestinationFolderForOrder(order) {
        const services = nodeRuntime.services;

        if (state.batch.mode === "generic") {
            return state.batch.destinationFolder;
        }

        const styleFamilyFolder = order.styleFamily || getStyleFamily(order.style);
        return services.path.join(state.batch.destinationFolder, styleFamilyFolder, order.size);
    }

    function buildBatchOutputName(order) {
        if (order.expectedOutputName) {
            return order.expectedOutputName;
        }

        const services = nodeRuntime.services;

        if (state.batch.mode !== "generic") {
            return services.buildOutputName(order);
        }

        return services.buildOutputName(Object.assign({}, order, {
            wo: order.roster || order.rosterNumber || order.rosterName || order.wo
        }));
    }

    function validateBatchSelection(selectedRowsOverride) {
        const services = nodeRuntime.services;
        const selectedRows = selectedRowsOverride || getSelectedBatchRows();
        const selectedSignature = getBatchSelectionSignature(selectedRows);

        if (!state.batch.data || !state.batch.destinationFolder) {
            clearBatchValidation();
            return null;
        }

        if (!services.fs || !services.path || !services.portfolioDb) {
            clearBatchValidation();
            return null;
        }

        const keyedRows = resolveBatchOutputNameCollisions(selectedRows.map(function (order) {
            const outputInfo = buildBatchOutputInfo(order);

            return {
                order: order,
                clave: buildBatchValidationKey(order),
                outputName: outputInfo.outputName,
                outputPath: outputInfo.outputPath
            };
        }));
        const keyCounts = keyedRows.reduce(function (counts, row) {
            counts[row.clave] = (counts[row.clave] || 0) + 1;
            return counts;
        }, {});
        const pathCounts = keyedRows.reduce(function (counts, row) {
            counts[row.outputPath] = (counts[row.outputPath] || 0) + 1;
            return counts;
        }, {});
        const dbLookup = services.portfolioDb.listExistingItemKeys(getPortfolioDbDeps(), getPortfolioDbPath(), keyedRows.map(function (row) {
            return row.clave;
        }));
        const rows = keyedRows.map(function (row) {
            const fileExists = services.fs.existsSync(row.outputPath);
            const registered = Boolean(dbLookup[row.clave]);
            let status = "FALTANTE";

            // La validacion incremental decide que entra a produccion.
            // Solo FALTANTE pasa; archivos/registros existentes y conflictos se bloquean.
            if (keyCounts[row.clave] > 1 || pathCounts[row.outputPath] > 1) {
                status = "CONFLICTO";
            } else if (fileExists && registered) {
                status = "YA_CREADO";
            } else if (fileExists && !registered) {
                status = "ARCHIVO_SIN_REGISTRO";
            } else if (!fileExists && registered) {
                status = "REGISTRADO_SIN_ARCHIVO";
            }

            return Object.assign({}, row, {
                fileExists: fileExists,
                registered: registered,
                status: status
            });
        });
        const counts = rows.reduce(function (summary, row) {
            summary[row.status] = (summary[row.status] || 0) + 1;
            return summary;
        }, {});

        state.batch.validation = {
            rows: rows,
            counts: counts,
            selectedCount: selectedRows.length,
            selectedSignature: selectedSignature
        };

        return state.batch.validation;
    }

    function getBatchSelectionSignature(rows) {
        return (rows || []).map(function (row) {
            return [
                row.sourceRow,
                row.style,
                row.size,
                getBatchVariantKey(row),
                row.name,
                row.number
            ].join(":");
        }).join("|");
    }

    function getBatchValidationForSelectedRows() {
        const selectedRows = getSelectedBatchRows();
        const validation = state.batch.validation;
        const selectedSignature = getBatchSelectionSignature(selectedRows);

        if (!validation || validation.selectedCount !== selectedRows.length || validation.selectedSignature !== selectedSignature) {
            return validateBatchSelection();
        }

        return validation;
    }

    function getBatchRowsForProcessing() {
        const validation = getBatchValidationForSelectedRows();

        if (!validation) {
            return getSelectedBatchRows();
        }

        // El boton de proceso nunca usa "todas las filas" si ya hay validacion:
        // reduce la seleccion a FALTANTE para no duplicar PDFs ni SQLite.
        return validation.rows.filter(function (row) {
            return row.status === "FALTANTE";
        }).map(function (row) {
            return Object.assign({}, row.order, {
                validationKey: row.clave,
                expectedOutputName: row.outputName
            });
        });
    }

    function updateBatchProcessButton() {
        const button = document.getElementById("btnProcessBatchFull");
        const validation = state.batch.validation;

        if (!button) {
            return;
        }

        if (!validation) {
            button.textContent = state.batch.mode === "generic" ? "Crear genericas, aplicar y cerrar" : "Crear, aplicar y cerrar talla seleccionada";
            return;
        }

        const missingCount = validation.counts.FALTANTE || 0;
        button.textContent = missingCount ? `Procesar faltantes ${getBatchModeLabel().toLowerCase()} (${missingCount})` : "Sin faltantes por procesar";
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
        const selectedMode = state.batch.mode;

        if (!services.createOrderDataFromExcel) {
            throw new Error("El importador de Excel no esta cargado.");
        }

        const excelPath = pickFileFromCep(
            state.batch.mode === "generic" ? "Elegir Roster Excel Nike" : "Elegir Excel Nike On Demand",
            paths && paths.ordersBase ? paths.ordersBase : "",
            excelFileTypes
        );

        if (!excelPath) {
            return;
        }

        if (!isExcelFilePath(excelPath)) {
            throw new Error("Selecciona un archivo de Excel valido (.xls, .xlsx, .xlsm o .xlsb).");
        }

        let batchData = services.createOrderDataFromExcel(excelPath);
        validateBatchExcelMode(excelPath, batchData, selectedMode);
        batchData = validateBatchRowsAgainstStyleReserve(batchData);

        // Al aceptar Excel se reinicia validacion/filtros dependientes del archivo.
        // Genericas fija destino automaticamente a la carpeta del roster.
        state.batch.excelPath = excelPath;
        state.batch.data = batchData;
        state.batch.mode = selectedMode;
        if (state.batch.mode === "generic" && services.path) {
            state.batch.destinationFolder = services.path.dirname(excelPath);
        }
        state.batch.selectedStyleFamily = "";
        state.batch.selectedSizes = [];
        state.batch.selectedVariantCodes = [];
        state.batch.shippingDateInput = "";
        document.getElementById("batchGenericShippingDate").value = "";
        state.batch.lastResults = [];
        clearBatchValidation();
        renderBatchModeButtons();
        renderBatchSummary();

        console.log(`Excel importado: ${excelPath}`);
        console.log(`Encabezados detectados en fila ${state.batch.data.headerRow}; datos desde fila ${state.batch.data.dataStartRow}.`);
        console.log(`Filas validas: ${state.batch.data.validRows.length}`);
        console.warn(`Filas con error: ${state.batch.data.invalidRows.length}`);
    }

    function chooseBatchDestination() {
        const paths = getCurrentPaths();
        const folderPath = pickFolderFromCep("Elegir destino batch", state.batch.destinationFolder || (paths ? paths.ordersBase : ""));

        if (!folderPath) {
            return;
        }

        state.batch.destinationFolder = folderPath;
        clearBatchValidation();
        renderBatchSummary();
        console.log(`Destino batch: ${folderPath}`);
    }

    function isJrOrder(order) {
        const variantName = String(order && order.variant || "").trim().toLowerCase();
        return order && (order.variantCode === "JR" ||
            variantName === "jr championship" ||
            variantName === "jr champ" ||
            variantName === "jr champ shorts");
    }

    function getJrGarmentType(order) {
        if (order && order.garmentType) {
            return order.garmentType;
        }

        return /1500/i.test(String(order && order.style || "")) ? "shorts" : "jersey";
    }

    function logJrBatchDetection(order, templatePath) {
        if (!isJrOrder(order)) {
            return;
        }

        console.log([
            "JR detectado",
            `fila ${order.sourceRow || "-"}`,
            `style ${order.style || "-"}`,
            `tipo ${getJrGarmentType(order)}`,
            `variante ${order.variant || "-"}`,
            `ruta ${templatePath || "-"}`
        ].join(" | "));
    }

    function logJrBatchResult(order, result) {
        if (!isJrOrder(order)) {
            return;
        }

        const ok = result && result.ok;
        console[ok ? "log" : "warn"]([
            "JR resultado",
            `fila ${order.sourceRow || "-"}`,
            `style ${order.style || "-"}`,
            `tipo ${getJrGarmentType(order)}`,
            `variante ${order.variant || "-"}`,
            ok ? "Completado" : "Error",
            ok ? `salida ${result.outputPath || result.outputName || "-"}` : `mensaje ${result.message || "Error desconocido"}`
        ].join(" | "));
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
            size: order.size,
            designCode: order.designCode
        });
        const outputName = buildBatchOutputName(order);

        logJrBatchDetection(order, templatePath);

        return {
            order: order,
            templatePath: templatePath,
            outputName: outputName,
            destinationFolder: sizeDestinationFolder
        };
    }

    async function createBatchCopyForOrder(order) {
        const services = nodeRuntime.services;
        const preview = buildBatchPreview(order, getBatchDestinationFolderForOrder(order));

        return services.copyTemplate({
            templatePath: preview.templatePath,
            destinationFolder: preview.destinationFolder,
            outputName: preview.outputName,
            number: preview.order.number,
            name: preview.order.name,
            strictOutputName: true
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

        const selectedShippingDate = getBatchShippingDate([]);

        if (state.batch.mode === "generic" && !selectedShippingDate) {
            throw new Error("Selecciona la fecha de embarque para Genericas.");
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
                const result = {
                    ok: true,
                    sourceRow: order.sourceRow,
                    outputPath: copyResult.outputPath,
                    outputName: copyResult.outputName,
                    size: order.size,
                    order: order
                };

                okCount++;
                results.push(result);
                console.log(`OK fila ${order.sourceRow}: ${copyResult.outputPath}`);
                logJrBatchResult(order, result);
            } catch (error) {
                const result = {
                    ok: false,
                    sourceRow: order.sourceRow,
                    size: order.size,
                    message: error.message,
                    order: order
                };

                errorCount++;
                results.push(result);
                console.error(`Error fila ${order.sourceRow}: ${error.message}`);
                logJrBatchResult(order, result);
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

        const selectedShippingDate = getBatchShippingDate([]);

        if (state.batch.mode === "generic" && !selectedShippingDate) {
            throw new Error("Selecciona la fecha de embarque para Genericas.");
        }

        if (batchData.invalidRows.length) {
            console.warn(`Se saltaran ${batchData.invalidRows.length} filas invalidas.`);
        }

        const timerState = startBatchTimer();
        let okCount = 0;
        let errorCount = 0;
        const results = [];
        let selectedRows = [];

        try {
            const validation = validateBatchSelection();
            const blockedCount = validation ? validation.selectedCount - (validation.counts.FALTANTE || 0) : 0;
            selectedRows = validation ? validation.rows.filter(function (row) {
                return row.status === "FALTANTE";
            }).map(function (row) {
                return Object.assign({}, row.order, {
                    validationKey: row.clave,
                    expectedOutputName: row.outputName,
                    shippingDate: state.batch.mode === "generic" ? selectedShippingDate : row.order.shippingDate
                });
            }) : [];

            if (!selectedRows.length) {
                throw new Error("No hay faltantes por procesar en la seleccion actual.");
            }

            if (blockedCount > 0) {
                console.warn(`Validacion omitio ${blockedCount} filas ya creadas, registradas o con conflicto.`);
            }

            logFlow(`Procesando faltantes batch (${getSelectedBatchStyleFamilyLabel()} / ${getSelectedBatchSizeLabel()}): ${selectedRows.length} filas.`);

            for (let index = 0; index < selectedRows.length; index++) {
                const order = enrichOrderWithVariantCatalog(selectedRows[index]);
                const rowStartedAt = Date.now();

                try {
                    // Orden por fila: validar catalogo -> copiar plantilla limpia ->
                    // abrir en Illustrator -> reemplazar textos/arte -> guardar PDF y cerrar.
                    assertCatalogTextRuleReady(order);
                    const copyResult = await createBatchCopyForOrder(order);

                    console.log(`Abriendo fila ${order.sourceRow}: ${copyResult.outputPath}`);
                    await openFileInIllustrator(copyResult.outputPath);
                    await applyOrderDataToIllustrator(order);
                    console.log(await illustratorBridge.savePdfAndCloseActiveDocument(copyResult.outputPath));
                    markGeneratedPdfFile(copyResult.outputPath);

                    okCount++;
                    const result = {
                        ok: true,
                        sourceRow: order.sourceRow,
                        outputPath: copyResult.outputPath,
                        outputName: copyResult.outputName,
                        size: order.size,
                        durationMs: Date.now() - rowStartedAt,
                        clave: order.validationKey,
                        order: order
                    };
                    results.push(result);
                    console.log(`Procesada fila ${order.sourceRow}: ${copyResult.outputName}`);
                    logJrBatchResult(order, result);
                } catch (error) {
                    errorCount++;
                    const result = {
                        ok: false,
                        sourceRow: order.sourceRow,
                        size: order.size,
                        message: error.message,
                        durationMs: Date.now() - rowStartedAt,
                        clave: order.validationKey,
                        order: order
                    };
                    results.push(result);
                    console.error(`Error batch fila ${order.sourceRow}: ${error.message}`);
                    logJrBatchResult(order, result);
                }
            }

            state.batch.lastResults = results;
            clearBatchValidation();
            renderBatchSummary();
        } finally {
            const elapsed = stopBatchTimer(timerState);
            console.log(`Batch completo terminado. OK: ${okCount} | Errores: ${errorCount} | Tiempo: ${formatElapsedTime(elapsed)}`);
            try {
                // Se registra al final para mantener compatibilidad actual:
                // un run con todos sus items y totales calculados.
                appendBatchProcessLog(selectedRows, results, elapsed);
            } catch (error) {
                console.warn(`No se pudo guardar el log batch: ${error.message}`);
            }
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

    async function showIllustratorAlert(message) {
        try {
            await illustratorBridge.showAlert(message);
        } catch (error) {
            console.warn("No se pudo mostrar alerta nativa de Illustrator; usando alerta del panel.");
            alert(message);
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
        const order = enrichOrderWithVariantCatalog(orderOverride || orderView.collectOrder(state));
        const isBatchOrder = Boolean(orderOverride);
        const hasName = order.name !== "";
        const hasNumber = order.number !== "";

        if (!hasName && !hasNumber && !isBatchOrder) {
            console.warn("Sin nombre ni numero: se deja la plantilla tal como viene.");
            return;
        }

        if (!hasName && !hasNumber && isBatchOrder && (order.variantCode === "SS" || order.variant === "Stars & Stripes")) {
            console.warn(`Fila ${order.sourceRow || "batch"} Stars & Stripes sin nombre/numero: se deja la plantilla sin reemplazo de texto.`);
            return;
        }

        if (!hasName && !hasNumber && isBatchOrder && (order.variantCode === "JR" || order.variant === "JR Championship")) {
            console.warn(`Fila ${order.sourceRow || "batch"} JR Championship sin nombre/numero: se deja la plantilla sin reemplazo de texto.`);
            return;
        }

        const rule = textRules.getTextRule(order);

        if (rule.mode === "blocked") {
            throw new Error(rule.message);
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
        if (rule.mode === "text" && rule.message) {
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
        const startedAt = Date.now();
        const order = enrichOrderWithVariantCatalog(orderView.collectOrder(state));

        await openCurrentFileInIllustrator();
        await applyOrderDataToIllustrator(order);
        console.log(await illustratorBridge.markActiveDocumentProcessInfo());
        markGeneratedPdfFile(state.lastOutputPath);

        try {
            recordManualProcessLog(order, state.lastOutputPath, Date.now() - startedAt);
        } catch (error) {
            console.warn(`No se pudo guardar el registro manual: ${error.message}`);
        }
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

        ["wo", "manualRoster", "manualNamingSource", "manualShippingDate", "styleCode", "size", "playerNumber", "playerName", "demandFolder"].forEach(function (id) {
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
                const rule = textRules.getTextRule(enrichOrderWithVariantCatalog(preview.order));

                if (rule.mode === "blocked") {
                    throw new Error(rule.message);
                }

                if ((rule.mode === "text" || rule.mode === "text-only" || rule.mode === "raster-number") && rule.message) {
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
                showIllustratorAlert(error.message);
            });
        });

        document.querySelectorAll("[data-batch-mode]").forEach(function (button) {
            button.addEventListener("click", function () {
                setBatchMode(button.getAttribute("data-batch-mode"));
            });
        });
        renderBatchModeButtons();

        document.getElementById("btnChooseBatchExcel").addEventListener("click", function () {
            try {
                chooseBatchExcel();
            } catch (error) {
                console.error("No se pudo importar el Excel:");
                console.error(error.message);
                showIllustratorAlert(error.message);
            }
        });

        document.getElementById("batchGenericShippingDate").addEventListener("change", function (event) {
            state.batch.shippingDateInput = event.target.value || "";
            renderBatchSummary();
        });

        document.getElementById("btnChooseBatchDestination").addEventListener("click", function () {
            try {
                chooseBatchDestination();
            } catch (error) {
                console.error("No se pudo elegir el destino batch:");
                console.error(error.message);
                showIllustratorAlert(error.message);
            }
        });

        document.getElementById("btnProcessBatchFull").addEventListener("click", function () {
            processBatchFull().catch(function (error) {
                console.error("No se pudo aplicar el batch completo:");
                console.error(error.message);
                showIllustratorAlert(error.message);
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
                showIllustratorAlert(error.message);
            });
        });

        document.getElementById("btnValidateOfficialSwatches").addEventListener("click", function () {
            validateOfficialSwatches().catch(function (error) {
                console.error("No se pudieron validar las muestras:");
                console.error(error.message);
                showIllustratorAlert(error.message);
            });
        });

        document.querySelectorAll("[data-db-preset]").forEach(function (button) {
            button.addEventListener("click", function () {
                try {
                    const preset = button.getAttribute("data-db-preset");

                    if (preset === "central") {
                        resetPortfolioDatabasePath();
                        return;
                    }

                    setPortfolioDatabasePath(getOperatorDbPath(preset), preset);
                } catch (error) {
                    console.error("No se pudo cambiar la BD activa:");
                    console.error(error.message);
                    showIllustratorAlert(error.message);
                }
            });
        });

        document.getElementById("btnChooseDatabasePath").addEventListener("click", function () {
            try {
                const selectedPath = pickFileFromCep("Selecciona BD SQLite para RMCOp-Nike", OPERATOR_DB_ROOT, ["sqlite", "db"]);

                if (selectedPath) {
                    setPortfolioDatabasePath(selectedPath, "Personalizada");
                }
            } catch (error) {
                console.error("No se pudo seleccionar la BD:");
                console.error(error.message);
                showIllustratorAlert(error.message);
            }
        });

        document.getElementById("btnResetDatabasePath").addEventListener("click", function () {
            try {
                resetPortfolioDatabasePath();
            } catch (error) {
                console.error("No se pudo restaurar la BD central:");
                console.error(error.message);
                showIllustratorAlert(error.message);
            }
        });

        document.getElementById("btnResetPanel").addEventListener("click", function () {
            location.reload();
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        nodeRuntime.load();
        loadLocalSettings();
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
