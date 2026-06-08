(function () {
    // Servicio central para cargar modulos Node/CommonJS desde CEP.
    window.RMC = window.RMC || {};

    function create(logFlow) {
        // Objeto compartido: main.js lo usa para acceder a config, fs, path y servicios.
        const services = {
            config: null,
            path: null,
            fs: null,
            buildTemplatePath: null,
            buildOutputName: null,
            copyTemplate: null,
            createOrderDataFromExcel: null,
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
                services.path = require("path");
                services.fs = require("fs");
                services.config = requireFromExtension("js/config/config.js");
                // Reglas editables para ajustar ancho de nombre/numero segun equipo, estilo y talla.
                services.textFitRules = requireFromExtension("js/config/textFitRules.json");
                // Reglas editables para armar numeros rasterizados de Indigenous Heritage.
                services.ihNumberRules = requireFromExtension("js/config/ihNumberRules.json");

                const pathBuilder = requireFromExtension("js/utils/pathBuilder.js");
                services.buildTemplatePath = pathBuilder.buildTemplatePath;
                services.buildOutputName = pathBuilder.buildOutputName;
                services.copyTemplate = requireFromExtension("js/services/copyTemplate.js");
                services.createOrderDataFromExcel = requireFromExtension("js/services/createOrderData.js").createOrderDataFromExcel;

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
