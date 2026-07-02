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

    function isIhVariant(variantName) {
        return variantName === "Indigenous Heritage";
    }

    function isJrVariant(order) {
        const variantName = String(order && order.variant || "").trim().toLowerCase();
        return order && order.variantCode === "JR" ||
            variantName === "jr championship" ||
            variantName === "jr champ" ||
            variantName === "jr champ shorts";
    }

    function hasCatalogPlaceholders(order) {
        return Boolean(order.templateNamePlaceholder || order.templateNumberPlaceholder);
    }

    function getCatalogOrLocalPlaceholders(order, localPlaceholders) {
        if (!hasCatalogPlaceholders(order)) {
            return localPlaceholders;
        }

        return {
            numberPlaceholder: order.templateNumberPlaceholder || (localPlaceholders && localPlaceholders.numberPlaceholder) || "",
            namePlaceholder: order.templateNamePlaceholder || (localPlaceholders && localPlaceholders.namePlaceholder) || ""
        };
    }

    // Standard y Throwback reemplazan texto. IH reemplaza nombre y arma/apaga numero con arte.
    function getTextRule(order) {
        const lineRules = textRulesByLine[order.line] || {};
        const placeholders = lineRules[order.team] || null;

        if (order.catalogPlaceholderMissing) {
            return {
                mode: "blocked",
                placeholders: null,
                message: `${order.variant || "La variante"} ya existe en rmc_nike_style_variants, pero aun no tiene placeholders de nombre/numero configurados.`
            };
        }

        if (isIhVariant(order.variant)) {
            return {
                mode: "raster-number",
                placeholders: getCatalogOrLocalPlaceholders(order, placeholders),
                message: hasCatalogPlaceholders(order)
                    ? `Usando placeholder de nombre de rmc_nike_style_variants (${order.catalogVariantCode || order.variantCode || order.variant}); el numero IH se armara duplicando grupos de Illustrator.`
                    : "Esta variante usa numeros rasterizados; el numero se armara duplicando grupos de Illustrator."
            };
        }

        if (hasCatalogPlaceholders(order)) {
            return {
                mode: "text",
                placeholders: {
                    numberPlaceholder: order.templateNumberPlaceholder || "",
                    namePlaceholder: order.templateNamePlaceholder || ""
                },
                message: `Usando placeholders de rmc_nike_style_variants (${order.catalogVariantCode || order.variantCode || order.variant}).`
            };
        }

        if (isJrVariant(order)) {
            return {
                mode: "text",
                placeholders: { numberPlaceholder: "00", namePlaceholder: "" },
                message: `${order.variant || "JR Championship"} reemplaza numero de jugador usando placeholder 00.`
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
