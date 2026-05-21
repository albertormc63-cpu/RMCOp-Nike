(function () {
    // Lista de equipos disponibles para selección
    const teams = [
        { name: "Boston", code: "BOS" },
        { name: "California", code: "CAL" },
        { name: "Carolina", code: "CAR" },
        { name: "Denver", code: "DEN" },
        { name: "Maryland", code: "MDW" },
        { name: "New York", code: "NY" },
        { name: "Philadelphia", code: "PHL" },
        { name: "Utah", code: "UTA" }
    ];

    const productLines = {
        masculino: {
            label: "Masculino",
            teams: ["Boston", "California", "Carolina", "Denver", "Maryland", "New York", "Philadelphia", "Utah"],
            styles: [
                { base: "A1000", label: "Hombre" },
                { base: "Y1000", label: "Nino" }
            ]
        },
        femenino: {
            label: "Femenino",
            teams: ["Boston", "California", "Maryland", "New York"],
            styles: [
                { base: "A2000", label: "Mujer" },
                { base: "Y2000", label: "Nina" }
            ]
        }
    };

    // Variantes disponibles. Standard conserva el flujo que ya esta operando.
    const variants = [
        { name: "Standard", slug: "standard" },
        { name: "Indigena Asc", slug: "indigena-asc" }
    ];

    // Estado global de la aplicación
    const state = {
        selectedLine: "masculino",
        selectedTeam: teams[0].name,
        selectedVariant: variants[0].name,
        lastOutputPath: ""
    };
    // Variables para servicios Node, se asignan al cargar los servicios
    let config = null;
    let buildTemplatePath = null;
    let buildOutputName = null;
    let copyTemplate = null;
    let path = null;
    let fs = null;
    // Función para loguear mensajes de flujo de la aplicación
    function logFlow(message) {
        console.log(`[Flujo] ${message}`);
    }
    // Función para obtener la raíz de la extensión, necesaria para cargar archivos con require
    function getExtensionRoot() {
        const currentPath = window.location.pathname;
        const decodedPath = decodeURIComponent(currentPath);
        const normalizedPath = decodedPath.replace(/^\/([A-Za-z]:\/)/, "$1");

        return path.dirname(normalizedPath);
    }

    // Función para cargar archivos usando require desde la raíz de la extensión
    function requireFromExtension(relativePath) {
        return require(path.join(getExtensionRoot(), relativePath));
    }
    //
    function loadNodeServices() {
        logFlow("Cargando servicios Node del panel.");
        // Verificamos si require esta disponible, lo cual indica que estamos en un entorno con Node (CEP)
        if (typeof require !== "function") {
            console.warn("Node no esta disponible. Abre el panel desde CEP para copiar archivos.");
            return;
        }

        try {
            path = require("path");
            fs = require("fs");
            // Cargamos los servicios específicos de la extensión usando nuestra función personalizada
            config = requireFromExtension("js/config/config.js");
            //
            const pathBuilder = requireFromExtension("js/utils/pathBuilder.js");
            buildTemplatePath = pathBuilder.buildTemplatePath;
            buildOutputName = pathBuilder.buildOutputName;
            copyTemplate = requireFromExtension("js/services/copyTemplate.js");

            logFlow("Servicios Node cargados correctamente.");
        } catch (error) {
            console.error("No se pudieron cargar los servicios Node:");
            console.error(error.message);
        }
    }

    function getCurrentPaths() {
        if (!config) return null;
        return config.paths[config.mode];
    }

    function getVersion() {
        const checked = document.querySelector("input[name='version']:checked");
        return checked ? checked.value : "Home";
    }

    function getVersionStyleSuffix() {
        return getVersion() === "Away" ? "A" : "H";
    }

    function getProductLine() {
        const select = document.getElementById("productLineSelect");
        return select && select.value ? select.value : state.selectedLine;
    }

    function getVariant() {
        const select = document.getElementById("variantSelect");
        return select && select.value ? select.value : variants[0].name;
    }

    function getVariantSlug(variantName) {
        const variant = variants.find(function (item) {
            return item.name === variantName;
        });

        return variant ? variant.slug : slugify(variantName);
    }

    function slugify(value) {
        return value.toLowerCase().replace(/\s+/g, "-");
    }

    function getCurrentLineConfig() {
        return productLines[state.selectedLine] || productLines.masculino;
    }

    function getVisibleTeams() {
        const lineConfig = getCurrentLineConfig();
        return teams.filter(function (team) {
            return lineConfig.teams.indexOf(team.name) !== -1;
        });
    }

    // Previews nuevos: linea-equipo-variante-version.webp. Hay fallbacks para archivos ya existentes.
    function getPreviewPaths(teamName, variantName, version) {
        const lineSlug = slugify(state.selectedLine);
        const teamSlug = slugify(teamName);
        const variantSlug = getVariantSlug(variantName);
        const versionSlug = version.toLowerCase();
        const paths = [`./previews/teams/${lineSlug}-${teamSlug}-${variantSlug}-${versionSlug}.webp`];

        if (state.selectedLine === "masculino") {
            paths.push(`./previews/teams/${teamSlug}-${variantSlug}-${versionSlug}.webp`);
        }

        if (state.selectedLine === "masculino" && variantSlug === "standard") {
            paths.push(`./previews/teams/${teamSlug}-${versionSlug}.webp`);
        }

        return paths;
    }

    // Función para obtener las iniciales del nombre del equipo.
    // Se utiliza para mostrar las iniciales en caso de que la imagen de vista previa no se pueda cargar.
    function getInitials(teamName) {
        return teamName
            .split(" ")
            .map(function (word) { return word.charAt(0); })
            .join("");
    }
    // Función para llenar las opciones del select de carpetas On Demand, basada en los nombres de las carpetas encontradas.
    // Si no se encuentran carpetas, se muestra una opción de placeholder indicando que no se encontraron carpetas.
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
    // Función para cargar las carpetas On Demand disponibles, leyendo el directorio de órdenes y filtrando por carpetas que contengan "NIKE ON DEMAND".
    async function loadDemandFolders() {
        const paths = getCurrentPaths();

        if (!fs || !paths) {
            logFlow("Usando carpetas On Demand de ejemplo porque Node no esta listo.");
            return;
        }

        try {
            logFlow("Buscando carpetas reales que contengan NIKE ON DEMAND.");

            const entries = fs.readdirSync(paths.ordersBase);
            const folderNames = entries
                .filter(function (entryName) {
                    const entryPath = path.join(paths.ordersBase, entryName);
                    return fs.statSync(entryPath).isDirectory() && entryName.toUpperCase().indexOf("NIKE ON DEMAND") !== -1;
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

    function renderVariants() {
        const select = document.getElementById("variantSelect");

        if (!select) return;

        select.innerHTML = "";

        variants.forEach(function (variant) {
            const option = document.createElement("option");
            option.value = variant.name;
            option.textContent = variant.name;
            select.appendChild(option);
        });

        select.value = state.selectedVariant;
    }

    function renderStyleOptions() {
        const select = document.getElementById("styleCode");
        const lineConfig = getCurrentLineConfig();
        const currentAudience = select && select.value ? select.value.charAt(0) : "A";
        const suffix = getVersionStyleSuffix();

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

    function paintPreview(element, teamName, variantName, version) {
        const image = new Image();
        const previewPaths = getPreviewPaths(teamName, variantName, version);
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
            element.textContent = getInitials(teamName);
        };

        tryPreview();
    }

    function showPage(pageId) {
        document.querySelectorAll(".page").forEach(function (page) {
            page.classList.toggle("active", page.id === pageId);
        });

        document.querySelectorAll(".step-button").forEach(function (button) {
            button.classList.toggle("active", button.getAttribute("data-page") === pageId);
        });
    }

    function renderTeams() {
        logFlow("Pintando equipos disponibles.");

        const teamGrid = document.getElementById("teamGrid");
        teamGrid.innerHTML = "";

        getVisibleTeams().forEach(function (team) {
            const button = document.createElement("button");
            const preview = document.createElement("div");
            const name = document.createElement("div");
            const meta = document.createElement("div");

            button.type = "button";
            button.className = "team-card";
            button.setAttribute("data-team", team.name);

            preview.className = "team-preview";
            name.className = "team-name";
            meta.className = "team-meta";

            name.textContent = team.name;
            meta.textContent = `${team.code} · ${getCurrentLineConfig().label}`;
            paintPreview(preview, team.name, state.selectedVariant, "Overview");

            button.appendChild(preview);
            button.appendChild(name);
            button.appendChild(meta);

            button.addEventListener("click", function () {
                selectTeam(team.name);
                showPage("pageOrder");
            });

            teamGrid.appendChild(button);
        });
    }

    function selectTeam(teamName) {
        state.selectedTeam = teamName;
        logFlow(`Equipo seleccionado: ${teamName}.`);

        document.querySelectorAll(".team-card").forEach(function (card) {
            card.classList.toggle("active", card.getAttribute("data-team") === teamName);
        });

        updateSelectedSummary();
    }

    function updateSelectedSummary() {
        const selectedTeamName = document.getElementById("selectedTeamName");
        const selectedPreview = document.getElementById("selectedPreview");

        selectedTeamName.textContent = state.selectedTeam;
        paintPreview(selectedPreview, state.selectedTeam, getVariant(), getVersion());
    }

    function changeVariant(variantName) {
        state.selectedVariant = variantName;
        logFlow(`Variante seleccionada: ${variantName}.`);
        renderTeams();
        selectTeam(state.selectedTeam);
    }

    function changeProductLine(lineName) {
        const visibleTeams = productLines[lineName] ? productLines[lineName].teams : productLines.masculino.teams;

        state.selectedLine = productLines[lineName] ? lineName : "masculino";

        if (visibleTeams.indexOf(state.selectedTeam) === -1) {
            state.selectedTeam = visibleTeams[0];
        }

        logFlow(`Linea seleccionada: ${getCurrentLineConfig().label}.`);
        renderStyleOptions();
        renderTeams();
        selectTeam(state.selectedTeam);
    }

    function collectOrder() {
        return {
            wo: document.getElementById("wo").value.trim(),
            line: getProductLine(),
            team: state.selectedTeam,
            variant: getVariant(),
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

    function buildOrderPreview() {
        if (!buildTemplatePath || !buildOutputName) {
            throw new Error("Los servicios Node no estan cargados.");
        }

        logFlow("Construyendo vista previa del pedido.");

        const paths = getCurrentPaths();
        const order = collectOrder();
        validateOrder(order);

        const templatePath = buildTemplatePath({
            basePath: paths.templatesBase,
            line: order.line,
            team: order.team,
            variant: order.variant,
            version: order.version,
            style: order.style,
            size: order.size
        });
        const outputName = buildOutputName(order);
        const destinationFolder = path.join(paths.ordersBase, order.demandFolder);

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

    function renderSettings() {
        const paths = getCurrentPaths();

        document.getElementById("modePreview").textContent = config ? config.mode : "Sin Node";
        document.getElementById("templatesBasePreview").textContent = paths ? paths.templatesBase : "No disponible";
        document.getElementById("ordersBasePreview").textContent = paths ? paths.ordersBase : "No disponible";
    }

    async function createCopy() {
        if (!copyTemplate) {
            throw new Error("El servicio de copia no esta cargado.");
        }

        logFlow("Preparando copia de plantilla.");

        const preview = buildOrderPreview();

        const outputPath = await copyTemplate({
            templatePath: preview.templatePath,
            ordersBase: preview.paths.ordersBase,
            demandFolder: preview.order.demandFolder,
            outputName: preview.outputName
        });

        state.lastOutputPath = outputPath;
        logFlow("Copia creada y lista para abrir en Illustrator.");
        console.log("Plantilla copiada correctamente:");
        console.log(outputPath);
    }

    function bindEvents() {
        document.querySelectorAll(".step-button").forEach(function (button) {
            button.addEventListener("click", function () {
                showPage(button.getAttribute("data-page"));
            });
        });

        document.querySelectorAll("input[name='version']").forEach(function (input) {
            input.addEventListener("change", function () {
                renderStyleOptions();
                updateSelectedSummary();
            });
        });

        document.getElementById("variantSelect").addEventListener("change", function (event) {
            changeVariant(event.target.value);
        });

        document.getElementById("productLineSelect").addEventListener("change", function (event) {
            changeProductLine(event.target.value);
        });

        document.getElementById("btnReviewOrder").addEventListener("click", function () {
            try {
                buildOrderPreview();
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

        document.getElementById("btnAbrirIllustrator").addEventListener("click", function () {
            console.warn("Abrir en Illustrator queda pendiente de conectar con CSInterface/ExtendScript.");
        });

        document.getElementById("btnAplicarDatos").addEventListener("click", function () {
            console.warn("Aplicar nombre / numero queda pendiente de conectar con JSX.");
        });

        document.getElementById("btnResetPanel").addEventListener("click", function () {
            location.reload();
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        loadNodeServices();
        renderVariants();
        renderStyleOptions();
        renderTeams();
        selectTeam(state.selectedTeam);
        renderSettings();
        bindEvents();
        loadDemandFolders();

        console.log("RMC Nike Panel cargado correctamente.");
    });
})();
