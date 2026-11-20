sap.ui.define([], function () {
    "use strict";
    return {
        statusState: function (sEsito) {
            if (!sEsito) return "None";
            sEsito = sEsito.toLowerCase();

            if (sEsito.includes("processato")) return "Success";
            if (sEsito.includes("errore")) return "Error";
            if (sEsito.includes("da processare")) return "Warning";
            return "None";
        },

        statusIcon: function (sEsito) {
            if (!sEsito) return "sap-icon://question-mark";
            sEsito = sEsito.toLowerCase();

            if (sEsito.includes("processato")) return "sap-icon://accept";
            if (sEsito.includes("errore")) return "sap-icon://error";
            if (sEsito.includes("da processare")) return "sap-icon://pending";
            return "sap-icon://question-mark";
        },


        formatDate: function (sDate) {
            if (!sDate) return "";
            const oDate = new Date(sDate);
            const oFormat = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "dd/MM/yyyy" });
            return oFormat.format(oDate);
        },

        allegatoText: function (sValue) {
            switch (sValue) {
                case "0":
                    return "Nessuno";
                case "1":
                    return "PDF singolo";
                case "2":
                    return "PDF multiplo";
                case "3":
                    return "Allegato singolo";
                case "4":
                    return "Allegati multipli";
                default:
                    return "";
            }
        },
        supplierStatusIconSrc: function (sValue) {
            switch (sValue) {
                case "0": return "sap-icon://employee-rejections";
                case "1": return "sap-icon://person-placeholder";
                case "2": return "sap-icon://group";
                default: return "";
            }
        },

        supplierStatusTooltip: function (sValue) {
            switch (sValue) {
                case "0": return "Nessun fornitore";
                case "1": return "Fornitore trovato";
                case "2": return "Più fornitori";
                default: return "";
            }
        }

    };
});