(function () {
    window.RMC = window.RMC || {};
    window.RMC.illustrator = window.RMC.illustrator || {};

    const textRulesByLine = {
        masculino: {
            Boston: { numberPlaceholder: "1", namePlaceholder: "HOLMAN" },
            California: { numberPlaceholder: "96", namePlaceholder: "KAVANAGH" },
            Carolina: { numberPlaceholder: "0", namePlaceholder: "RIORDEN" },
            Denver: { numberPlaceholder: "42", namePlaceholder: "O'NEILL" },
            Maryland: { numberPlaceholder: "7", namePlaceholder: "MALONE" },
            "New York": { numberPlaceholder: "9", namePlaceholder: "BAPTISTE" },
            Philadelphia: { numberPlaceholder: "22", namePlaceholder: "SOWERS" },
            Utah: { numberPlaceholder: "26", namePlaceholder: "SCHREIBER" }
        },
        femenino: {
            Boston: { numberPlaceholder: "8", namePlaceholder: "NORTH" },
            California: { numberPlaceholder: "12", namePlaceholder: "MASTROIANNI" },
            Maryland: { numberPlaceholder: "11", namePlaceholder: "BLACK" },
            "New York": { numberPlaceholder: "27", namePlaceholder: "SCANE" }
        }
    };

    function getTextRule(order) {
        const lineRules = textRulesByLine[order.line] || {};
        const placeholders = lineRules[order.team] || null;

        if (order.variant !== "Standard") {
            return {
                mode: "text-only",
                placeholders: placeholders,
                message: "Esta variante usa numeros rasterizados; por ahora solo se aplicara el nombre."
            };
        }

        return {
            mode: "text",
            placeholders: placeholders
        };
    }

    window.RMC.illustrator.textRules = {
        getTextRule: getTextRule
    };
})();
