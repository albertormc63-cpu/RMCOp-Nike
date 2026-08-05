(function () {
    // Servicio central para cargar modulos Node/CommonJS desde CEP.
    window.RMC = window.RMC || {};

    function create(logFlow) {
        // Objeto compartido: main.js lo usa para acceder a config, fs, path y servicios.
        const services = {
            config: null,
            path: null,
            fs: null,
            childProcess: null,
            buildTemplatePath: null,
            buildOutputName: null,
            copyTemplate: null,
            createOrderDataFromExcel: null,
            portfolioDb: null,
            fileComments: null,
            styleVariantReserve: null,
            styleVariantReserveData: null,
            textFitRules: null,
            ihNumberRules: null
        };

        function getExtensionRoot() {
            // CEP entrega la ruta como URL; decodeURIComponent arregla espacios tipo Application%20Support.
            const currentPath = window.location.pathname;
            const decodedPath = decodeURIComponent(currentPath);
            const normalizedPath = decodedPath.replace(/^\/([A-Za-z]:\/)/, "$1");

            return services.path.dirname(normalizedPath);
        }

        function requireFromExtension(relativePath) {
            // Evita require("./...") relativo al contexto raro de index.html en CEP.
            return require(services.path.join(getExtensionRoot(), relativePath));
        }

        function load() {
            // Carga diferida: si el panel se abre fuera de Illustrator, no truena toda la UI.
            logFlow("Cargando servicios Node del panel.");

            if (typeof require !== "function") {
                console.warn("Node no esta disponible. Abre el panel desde CEP para copiar archivos.");
                return;
            }

            try {
                // Todo lo que toca filesystem, Excel o SQLite se centraliza aqui
                // para que main.js no use require relativo al contexto raro de CEP.
                services.path = require("path");
                services.fs = require("fs");
                services.childProcess = require("child_process");
                services.config = requireFromExtension("js/config/config.js");
                // Reglas editables para ajustar ancho de nombre/numero segun equipo, estilo y talla.
                services.textFitRules = requireFromExtension("js/config/textFitRules.json");
                // Reglas editables para armar numeros rasterizados de Indigenous Heritage.
                services.ihNumberRules = requireFromExtension("js/config/ihNumberRules.json");
                // Reserva local versionada de variantes Nike. Evita consultar SQLite
                // durante importacion/proceso batch.
                try {
                    services.styleVariantReserveData = requireFromExtension("js/config/styleVariantReserve.json");
                } catch (reserveError) {
                    console.warn(`No se pudo cargar styleVariantReserve.json; se usaran reglas locales: ${reserveError.message}`);
                    services.styleVariantReserveData = { variants: [] };
                }

                const pathBuilder = requireFromExtension("js/utils/pathBuilder.js");
                services.buildTemplatePath = pathBuilder.buildTemplatePath;
                services.buildOutputName = pathBuilder.buildOutputName;
                services.copyTemplate = requireFromExtension("js/services/copyTemplate.js");
                services.createOrderDataFromExcel = requireFromExtension("js/services/createOrderData.js").createOrderDataFromExcel;
                services.portfolioDb = requireFromExtension("js/services/portfolioDb.js");
                services.fileComments = requireFromExtension("js/services/fileComments.js");
                services.styleVariantReserve = requireFromExtension("js/services/styleVariantReserve.js");

                logFlow("Servicios Node cargados correctamente.");
            } catch (error) {
                console.error("No se pudieron cargar los servicios Node:");
                console.error(error.message);
            }
        }

        function getCurrentPaths() {
            if (!services.config) return null;
            return services.config.paths[services.config.mode];
        }

        return {
            services: services,
            load: load,
            getCurrentPaths: getCurrentPaths
        };
    }

    window.RMC.nodeServices = {
        create: create
    };
})();
