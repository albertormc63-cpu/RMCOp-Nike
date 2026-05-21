(function () {
    window.RMC = window.RMC || {};

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

    const variants = [
        { name: "Standard", slug: "standard", code: "STD", replacementMode: "text" },
        { name: "Indigenous Heritage", slug: "indigenous-heritage", code: "IH", replacementMode: "raster" }
    ];

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

    function getVariant(variantName) {
        return variants.find(function (variant) {
            return variant.name === variantName;
        }) || variants[0];
    }

    function getVersionStyleSuffix(version) {
        return version === "Away" ? "A" : "H";
    }

    window.RMC.productCatalog = {
        teams: teams,
        productLines: productLines,
        variants: variants,
        slugify: slugify,
        getLineConfig: getLineConfig,
        getVisibleTeams: getVisibleTeams,
        getVariant: getVariant,
        getVersionStyleSuffix: getVersionStyleSuffix
    };
})();
