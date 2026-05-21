(function () {
    window.RMC = window.RMC || {};

    function create(logFlow) {
        const services = {
            config: null,
            path: null,
            fs: null,
            buildTemplatePath: null,
            buildOutputName: null,
            copyTemplate: null
        };

        function getExtensionRoot() {
            const currentPath = window.location.pathname;
            const decodedPath = decodeURIComponent(currentPath);
            const normalizedPath = decodedPath.replace(/^\/([A-Za-z]:\/)/, "$1");

            return services.path.dirname(normalizedPath);
        }

        function requireFromExtension(relativePath) {
            return require(services.path.join(getExtensionRoot(), relativePath));
        }

        function load() {
            logFlow("Cargando servicios Node del panel.");

            if (typeof require !== "function") {
                console.warn("Node no esta disponible. Abre el panel desde CEP para copiar archivos.");
                return;
            }

            try {
                services.path = require("path");
                services.fs = require("fs");
                services.config = requireFromExtension("js/config/config.js");

                const pathBuilder = requireFromExtension("js/utils/pathBuilder.js");
                services.buildTemplatePath = pathBuilder.buildTemplatePath;
                services.buildOutputName = pathBuilder.buildOutputName;
                services.copyTemplate = requireFromExtension("js/services/copyTemplate.js");

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
