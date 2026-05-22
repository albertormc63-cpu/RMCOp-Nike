(function () {
    // RMC es el espacio global del panel. Cada archivo cuelga su modulo aqui para compartirlo sin usar bundlers.
    window.RMC = window.RMC || {};

    // Catalogo base: equipos visibles y codigo corto usado para nombres/rutas.
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

    // Cada linea decide que equipos aparecen y que styles se muestran en el pedido.
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

    // Nombre deportivo que aparece en rosters/pedidos. Depende de la linea.
    const teamNicknames = {
        masculino: {
            Boston: "Cannons",
            California: "Redwoods",
            Carolina: "Chaos",
            Denver: "Outlaws",
            Maryland: "Whipsnakes",
            "New York": "Atlas",
            Philadelphia: "Waterdogs",
            Utah: "Archers"
        },
        femenino: {
            Boston: "Guard",
            California: "Palms",
            Maryland: "Charm",
            "New York": "Charging"
        }
    };

    // replacementMode anticipa como se aplicaran datos en Illustrator para cada variante.
    const variants = [
        { name: "Standard", slug: "standard", code: "STD", replacementMode: "text" },
        { name: "Indigenous Heritage", slug: "indigenous-heritage", code: "IH", replacementMode: "raster" }
    ];

    // Convierte texto de UI a nombre seguro para archivos/carpetas.
    function slugify(value) {
        return String(value || "").toLowerCase().replace(/\s+/g, "-");
    }

    function getLineConfig(lineName) {
        return productLines[lineName] || productLines.masculino;
    }

    function getVisibleTeams(lineName) {
        const lineConfig = getLineConfig(lineName);

        return teams.filter(function (team) {
            return lineConfig.teams.indexOf(team.name) !== -1;
        });
    }

    function getTeamNickname(lineName, teamName) {
        const lineNicknames = teamNicknames[lineName] || {};
        return lineNicknames[teamName] || "";
    }

    function getVariant(variantName) {
        return variants.find(function (variant) {
            return variant.name === variantName;
        }) || variants[0];
    }

    function getVersionStyleSuffix(version) {
        return version === "Away" ? "A" : "H";
    }

    // Exportamos solo lo que otros modulos necesitan.
    window.RMC.productCatalog = {
        teams: teams,
        productLines: productLines,
        teamNicknames: teamNicknames,
        variants: variants,
        slugify: slugify,
        getLineConfig: getLineConfig,
        getVisibleTeams: getVisibleTeams,
        getTeamNickname: getTeamNickname,
        getVariant: getVariant,
        getVersionStyleSuffix: getVersionStyleSuffix
    };
})();
