(function () {
    // RMC.illustrator agrupa todo lo que habla con Illustrator o define reglas para Illustrator.
    window.RMC = window.RMC || {};
    window.RMC.illustrator = window.RMC.illustrator || {};

    // Placeholders reales que vienen en las plantillas base por linea/equipo.
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

    // Standard reemplaza nombre y numero como texto. IH reemplaza nombre y arma numero con arte duplicado.
    function getTextRule(order) {
        const lineRules = textRulesByLine[order.line] || {};
        const placeholders = lineRules[order.team] || null;

        if (order.variant !== "Standard") {
            return {
                mode: "raster-number",
                placeholders: placeholders,
                message: "Esta variante usa numeros rasterizados; el numero se armara duplicando grupos de Illustrator."
            };
        }

        return {
            mode: "text",
            placeholders: placeholders
        };
    }

    // API publica para que main.js pida la regla correcta del pedido actual.
    window.RMC.illustrator.textRules = {
        getTextRule: getTextRule
    };
})();
