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


        onOpenLegendaPopover: function (oEvent) {
            if (!this._oLegendaPopover) {

                const oModel = new sap.ui.model.json.JSONModel({
                    items: [
                        { icon: "sap-icon://attachment", title: "Allegato", text: "Presenza allegati per la fattura" },
                        { icon: "sap-icon://show", title: "XML", text: "Apri / visualizza il file XML" },
                        { icon: "sap-icon://pdf-attachment", title: "PDF", text: "Apri / visualizza il PDF" },

                        { icon: "sap-icon://employee", title: "Stato fornitore", text: "Fornitore assegnato" },
                        { icon: "sap-icon://group", title: "Stato fornitore", text: "Fornitore multiplo / gestione speciale" },
                        { icon: "sap-icon://employee-rejections", title: "Stato fornitore", text: "Fornitore non assegnato / non valido" },

                        { icon: "sap-icon://navigation-right-arrow", title: "Dettaglio", text: "Apri dettaglio fattura (solo lettura)" }
                    ],
                    semaforo: [
                        { state: "Arancio", text: "Parcheggiata" },
                        { state: "Rosso", text: "Da registrare" },
                        { state: "Verde", text: "Contabilizzata" },
                        { state: "Nero", text: "Non registrabile" }
                    ]
                });

                const oList = new sap.m.List({
                    showSeparators: "Inner",
                    items: {
                        path: "/items",
                        template: new sap.m.StandardListItem({
                            icon: "{icon}",
                            title: "{title}",
                            description: "{text}",
                            iconInset: false,
                            wrapping: true
                        })
                    }
                });
                oList.setModel(oModel);

                const oSemaforoList = new sap.m.List({
                    headerText: "Semaforo stato (colonna Stato)",
                    showSeparators: "Inner",
                    items: {
                        path: "/semaforo",
                        template: new sap.m.StandardListItem({
                            title: "{state}",
                            description: "{text}"
                        })
                    }
                });
                oSemaforoList.setModel(oModel);

                this._oLegendaPopover = new sap.m.Popover({
                    title: "Legenda icone",
                    placement: sap.m.PlacementType.Top,
                    contentWidth: "380px",
                    content: [
                        new sap.m.VBox({
                            items: [
                                oList,
                                new sap.m.Toolbar({ content: [new sap.m.Title({ text: "" })] }),
                                oSemaforoList
                            ]
                        }).addStyleClass("sapUiSmallMargin")
                    ]
                });

                this.getView().addDependent(this._oLegendaPopover);
            }

            this._oLegendaPopover.openBy(oEvent.getSource());
        },

        onNavToFornitore: async function (oEvent) {
            try {
                const oContext = oEvent.getSource().getBindingContext("fattureModel");
                if (!oContext) {
                    sap.m.MessageToast.show("Impossibile determinare il cliente selezionato.");
                    return;
                }

                const oData = oContext.getObject();
                const SupplierCode = oData.SupplierCode;
                if (!SupplierCode) {
                    sap.m.MessageToast.show("Cliente (SupplierCode) non disponibile.");
                    return;
                }

                const oCrossAppNav = await sap.ushell.Container.getServiceAsync("CrossApplicationNavigation");

                const sHash = oCrossAppNav.hrefForExternal({
                    target: {
                        semanticObject: "Supplier",
                        action: "displayFactSheet"
                    },
                    params: {
                        Customer: SupplierCode
                    }
                });

                const sEntityPath = `/C_SupplierFs('${SupplierCode}')`;

                const sFullUrl = window.location.origin + "/ui" + sHash + "&sap-app-origin-hint=&" + sEntityPath;

                window.open(sFullUrl, "_blank");

            } catch (err) {
                console.error("Errore nella navigazione Cross-App:", err);
                sap.m.MessageBox.error("Impossibile aprire l'app Customer - Manage.");
            }
        },

        onVisualizzaDati: function (oEvent) {
            let oCtx = null;

            // Caso 1: RowAction (table row action)
            const oRow = oEvent?.getParameter && oEvent.getParameter("row");
            if (oRow) {
                oCtx = oRow.getBindingContext("fattureModel");
            }

            // Caso 2: bottone footer (nessun row param) -> prendo selezione tabella
            if (!oCtx) {
                const oTable = this.byId("idTreeTable");
                const aSel = oTable.getSelectedIndices();

                if (!aSel || aSel.length === 0) {
                    sap.m.MessageToast.show("Seleziona una fattura.");
                    return;
                }
                if (aSel.length > 1) {
                    sap.m.MessageToast.show("Seleziona una sola fattura.");
                    return;
                }

                oCtx = oTable.getContextByIndex(aSel[0]);
            }

            if (!oCtx) {
                sap.m.MessageToast.show("Context non trovato");
                return;
            }

            const oSelected = oCtx.getObject() || {};
            if (!oSelected.Id) {
                sap.m.MessageToast.show("ID mancante sulla riga selezionata.");
                return;
            }

            // Se vuoi limitarlo SOLO alle logistiche:
            // if (oSelected.TipoFattura !== "M") {
            //     sap.m.MessageToast.show("La fattura selezionata non è logistica.");
            //     return;
            // }

            sap.ui.getCore().setModel(
                new sap.ui.model.json.JSONModel({ SelectedInvoice: oSelected }),
                "SelectedInvoiceModel"
            );

            const oRouter = sap.ui.core.UIComponent.getRouterFor(this);

            if (oRow) {
                oRouter.navTo("DettaglioDisplay", { invoiceId: String(oSelected.Id) });
            } else {
                oRouter.navTo("Dettaglio", { invoiceId: String(oSelected.Id) });
            }
        },




    });
});