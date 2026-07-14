sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/export/Spreadsheet"
], function (
    Controller,
    Spreadsheet
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

        onPartitarioFornitoriButtonPress: async function () {
            try {
                const oCrossAppNav = await sap.ushell.Container.getServiceAsync("CrossApplicationNavigation");

                const sHash = oCrossAppNav.hrefForExternal({
                    target: {
                        semanticObject: "Supplier",
                        action: "manageLineItems"
                    }
                });

                if (!sHash) {
                    sap.m.MessageToast.show("Impossibile generare la navigazione verso Partitario Fornitori.");
                    return;
                }

                window.open(sHash, "_blank");

            } catch (err) {
                console.error("Errore navigazione Partitario Fornitori:", err);
                sap.m.MessageBox.error("Impossibile aprire l'app Partitario Fornitori.");
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

        onExportExcel: function () {
            const oModel = this.getView().getModel("fattureModel");
            const aRows = oModel.getProperty("/results") || [];

            if (!aRows.length) {
                sap.m.MessageToast.show("Nessun dato da esportare.");
                return;
            }

            const aColumns = [
                { label: "N. doc.", property: "DocumentNumber", type: "string" },
                { label: "Esercizio", property: "FiscalYear", type: "string" },
                { label: "Stato Fattura", property: "StatoFattura", type: "string" },
                { label: "Tipo Fattura", property: "TipoFattura", type: "string" },
                { label: "Società", property: "CompanyCode", type: "string" },
                { label: "Nome Società", property: "CompanyName", type: "string" },
                { label: "Fornitore", property: "SupplierCode", type: "string" },
                { label: "Nome Fornitore", property: "SupplierName", type: "string" },
                { label: "Tipo doc. AdE", property: "TipoDocAdE", type: "string" },
                { label: "Descrizione tipo doc.", property: "TipoDocText", type: "string" },
                { label: "N. Fat Fornitore", property: "NumeroFattura", type: "string" },
                { label: "Data Fattura", property: "DataFattura", type: "date" },
                { label: "Divisa", property: "Divisa", type: "string" },
                { label: "Causale", property: "Causale", type: "string" },
                { label: "Importo totale", property: "Totale", type: "number" },
                { label: "Imponibile", property: "Imponibile", type: "number" },
                { label: "Doc Contabile", property: "FinanceDocument", type: "string" },
                { label: "Data registrazione", property: "PostingDate", type: "date" },
                { label: "Tipo SAP", property: "DocumentType", type: "string" },
                { label: "Data Pagamento", property: "DataPagamento", type: "date" },
                { label: "Motivazione Blocco", property: "MotivoBlocco", type: "string" },
                { label: "Blocco", property: "CodBlocco", type: "boolean" }
            ];

            const oSettings = {
                workbook: {
                    columns: aColumns
                },
                dataSource: aRows,
                fileName: "Fatture_Passive.xlsx",
                worker: false
            };

            const oSheet = new Spreadsheet(oSettings);

            oSheet.build()
                .then(function () {
                    sap.m.MessageToast.show("Export completato.");
                })
                .finally(function () {
                    oSheet.destroy();
                });
        },


    });
});