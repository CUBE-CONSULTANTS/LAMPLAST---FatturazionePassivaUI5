sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (
    Controller
) {
    "use strict";

    return Controller.extend("com.zeim.fatturazionepassiva.controller.BaseController", {



        //Navigazione ad app standard bottone partitario fornitore
        onPartitarioFornitoreButtonPress: async function () {
            try {

                const Navigation = await sap.ushell.Container.getServiceAsync("Navigation");

                const sHref = await Navigation.getHref({
                    target: {
                        semanticObject: "PurchaseOrderItem",
                        action: "reconcileGRIRAccounts"
                    }

                });

                console.log(" Navigazione FLP:", sHref);

                window.open(sHref, "_blank");
            } catch (err) {
                console.error("Errore nella navigazione Cross-App:", err);
            }
        },
        
    });
});