sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "../model/mockData",
    "sap/ui/core/Fragment",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], (Controller, JSONModel, mockData, Fragment, MessageBox, MessageToast) => {
    "use strict";

    return Controller.extend("com.zeim.fatturazionepassiva.controller.Home", {

        onInit() {

            // ViewModel (flow + contatori)
            var oViewModel = new sap.ui.model.json.JSONModel({
                currentFlow: "sd",
                counts: {
                    All: 0,
                    NotAllowed: 0,   // stato 0
                    Working: 0,      // stato 1
                    Parked: 0,       // stato 2
                    Processed: 0,    // stato 3
                }
            });
            this.getView().setModel(oViewModel, "viewModel");


            // Modello locale per la tabella
            var oFattureModel = new sap.ui.model.json.JSONModel({ results: [] });
            this.getView().setModel(oFattureModel, "fattureModel");

            this.oFilterBar = this.byId("filterBar");

            // Inizializza paginazione
            this._pagination = {
                top: 200,
                skip: 0,
                hasMore: true,
                isLoading: false
            };

            // Primo caricamento
            this._bindTable();
        },




        getHighlight: function (sStatus) {
            switch (sStatus) {
                case "G": // Verde
                    return "Success";
                case "Y": // Giallo
                    return "Warning";
                case "R": // Rosso
                    return "Error";
                default:
                    return "None";
            }
        },

        _calculateTotals(oData) {
            if (!oData?.Invoices) return;

            oData.Invoices.forEach(inv => {
                let docTotal = 0;

                if (inv.items?.length) {
                    inv.items.forEach(item => {
                        const qty = parseFloat((item.quantity || "0").replace(",", "."));
                        const price = parseFloat((item.unitPrice || "0").replace(",", "."));

                        const total = qty * price;
                        item.totalPrice = total.toFixed(2).replace(".", ",");
                        docTotal += total;
                    });
                }

                inv.totalPrice = docTotal.toFixed(2).replace(".", ",");
            });
        },

        _bindTable: function (bReset = true) {

            const oODataModel = this.getOwnerComponent().getModel("mainService");
            const oFattureModel = this.getView().getModel("fattureModel");

            if (bReset) {
                this._pagination.skip = 0;
                this._pagination.hasMore = true;
                oFattureModel.setData({ results: [] });
            }

            if (!this._pagination.hasMore || this._pagination.isLoading) return;
            this._pagination.isLoading = true;
            sap.ui.core.BusyIndicator.show(0);

            const sPath = "/zeim_lista_fatture_passive";

            oODataModel.read(sPath, {
                urlParameters: {
                    "$top": this._pagination.top,
                    "$skip": this._pagination.skip
                },
                success: (oData) => {

                    const aOld = oFattureModel.getProperty("/results");
                    const aNew = oData.results || [];

                    oFattureModel.setProperty("/results", aOld.concat(aNew));

                    const aRows = oFattureModel.getProperty("/results");
                    this._updateCounts(aRows);

                    this._pagination.skip += aNew.length;
                    this._pagination.hasMore = aNew.length === this._pagination.top;
                    this._pagination.isLoading = false;

                    sap.ui.core.BusyIndicator.hide();

                    if (this._pagination.hasMore) {
                        setTimeout(() => this._bindTable(false), 50);
                    }
                },
                error: (err) => {
                    console.error(err);
                    this._pagination.isLoading = false;
                    this._pagination.hasMore = false;
                    sap.ui.core.BusyIndicator.hide();
                }
            });
        },


        _updateCounts: function (aRows) {
            const counts = {
                All: aRows.length,
                NotAllowed: 0,
                Working: 0,
                Parked: 0,
                Processed: 0,
                Error: 0
            };

            aRows.forEach(item => {
                switch (item.StatoFattura) {
                    case "0":
                        counts.NotAllowed++;
                        break;
                    case "1":
                        counts.Working++;
                        break;
                    case "2":
                        counts.Parked++;
                        break;
                    case "3":
                        counts.Processed++;
                        break;
                }
            });

            this.getView().getModel("viewModel").setProperty("/counts", counts);
        },



        _onBeforeShow() {

            const oModel = this.getView().getModel();

            oModel.setProperty("/SelectedInvoice", null);

            const aInvoices = oModel.getProperty("/Invoices") || [];
            aInvoices.forEach(inv => inv.selected = false);
            oModel.setProperty("/Invoices", aInvoices);

            // reset visuale
            this.byId("idTreeTable").clearSelection();
        },

        onAfterRendering() {
            const oFilter = this.getView().byId("filterBar");
            if (oFilter && oFilter._btnSearch) oFilter._btnSearch.setText("Avvio");
        },

        onShowErrorDialog(oEvent) {
            const oContext = oEvent.getSource().getBindingContext();
            const oInvoice = oContext.getObject();

            if (!oInvoice.multiSuppliers || oInvoice.multiSuppliers.length <= 1) {
                sap.m.MessageBox.warning(oInvoice.warningText || "Errore generico nella fattura.");
                return;
            }

            if (!this._oSupplierDialog) {
                sap.ui.core.Fragment.load({
                    id: this.getView().getId(),
                    name: "fatturazione.elettronica.passiva.view.fragments.scegliFornitore",
                    controller: this
                }).then(oDialog => {
                    this._oSupplierDialog = oDialog;
                    this.getView().addDependent(oDialog);

                    const oModel = new sap.ui.model.json.JSONModel(oInvoice.multiSuppliers);
                    oDialog.setModel(oModel);
                    oDialog.open();
                });
            } else {
                const oModel = new sap.ui.model.json.JSONModel(oInvoice.multiSuppliers);
                this._oSupplierDialog.setModel(oModel);
                this._oSupplierDialog.open();
            }

            this._oSelectedInvoiceForSupplier = oInvoice;
        },




        onVisualizzaDati: function (oEvent) {
            const oRow = oEvent.getParameter("row");
            const oContext = oRow.getBindingContext("fattureModel");

            if (!oContext) {
                sap.m.MessageToast.show("Context non trovato");
                return;
            }

            const oSelected = oContext.getObject();

            sap.ui.getCore().setModel(
                new sap.ui.model.json.JSONModel({
                    SelectedInvoice: oSelected
                }),
                "SelectedInvoiceModel"
            );

            const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("Dettaglio", {
                invoiceId: oSelected.Id
            });
        },


        onValueHelpSocieta: function () {
            sap.ui.require([
                "com/zeim/fatturazionepassiva/controller/helpers/ValueHelpHandler"
            ], function (VH) {
                VH.openValueHelp(
                    this,
                    "com.zeim.fatturazionepassiva.view.fragments.ValueHelpDialogFilterbarSocieta",
                    "Societa",
                    "/ZR_EIM_COMPANY",
                    {
                        key: "CompanyCode",
                        desc: "CompanyName",
                        keyProp: "CompanyCode",
                        maxKeyLength: 10, // regola: oltre 10 char non filtrare su Customer
                        filterProps: ["Customer", "OrganizationBPName1", "CityName"],
                        columns: [
                            { label: "Cliente", path: "Customer" },
                            { label: "Descrizione", path: "OrganizationBPName1" },
                            { label: "Città", path: "CityName" }
                        ],
                        multiInputId: "multiInput"
                    }
                );
            }.bind(this));
        },
        onValueHelpFornitore: function () {
            sap.ui.require([
                "com/zeim/fatturazionepassiva/controller/helpers/ValueHelpHandler"
            ], function (VH) {
                VH.openValueHelp(
                    this,
                    "com.zeim.fatturazionepassiva.view.fragments.ValueHelpDialogFilterbarFornitore",
                    "Fornitore",
                    "/zeim_search_supplier_data",
                    {
                        key: "CompanyCode",
                        desc: "CompanyName",
                        keyProp: "CompanyCode",
                        maxKeyLength: 10, // regola: oltre 10 char non filtrare su Customer
                        filterProps: ["Customer", "OrganizationBPName1", "CityName"],
                        columns: [
                            { label: "Fornitore", path: "Supplier" },
                            { label: "Descrizione", path: "SupplierName" },
                            { label: "Country", path: "Country" }
                        ],
                        multiInputId: "multiInput"
                    }
                );
            }.bind(this));
        },

        onValueHelpTipoDocAde: function () {
            sap.ui.require([
                "com/zeim/fatturazionepassiva/controller/helpers/ValueHelpHandler"
            ], function (VH) {
                VH.openValueHelp(
                    this,
                    "com.zeim.fatturazionepassiva.view.fragments.ValueHelpDialogFilterbarTipoDocAde",
                    "TipoDocAde",
                    "/ZC_EIM_BLADE",
                    {
                        key: "BlartAde",
                        desc: "Descrizione",
                        keyProp: "BlartAde",
                        maxKeyLength: 10,
                        filterProps: ["BlartAde", "Descrizione"],
                        columns: [
                            { label: "Tipo Doc. AdE", path: "BlartAde" },
                            { label: "Descrizione", path: "Descrizione" }
                        ],
                        multiInputId: "multiInput"
                    }
                );
            }.bind(this));
        },

        onIconTabSelect: function (oEvent) {
            const sKey = oEvent.getParameter("key");
            const oTable = this.byId("idTreeTable");
            const oBinding = oTable.getBinding("rows");
            if (!oBinding) return;

            const Filter = sap.ui.model.Filter;
            let aFilters = [];

            switch (sKey) {
                case "NotAllowed":   // stato 0
                    aFilters = [new Filter("StatoFattura", "EQ", "0")];
                    break;

                case "Working":      // stato 1
                    aFilters = [new Filter("StatoFattura", "EQ", "1")];
                    break;

                case "Parked":       // stato 2
                    aFilters = [new Filter("StatoFattura", "EQ", "2")];
                    break;

                case "Processed":    // stato 3
                    aFilters = [new Filter("StatoFattura", "EQ", "3")];
                    break;

                case "All":
                default:
                    aFilters = []; // Nessun filtro
                    break;
            }

            // Applica filtro sulla tabella
            oBinding.filter(aFilters);
        },

        onVisualizzaAllegato: function (oEvent) {
            const oCtx = oEvent.getSource().getBindingContext("fattureModel");
            if (!oCtx) {
                MessageToast.show("Context non trovato");
                return;
            }

            const oRow = oCtx.getObject();

            const aItems = this._getMockAllegatiForRow(oRow);
            this._openAllegatiDialogMock(aItems);
        },

        _getMockAllegatiForRow: function (oRow) {
            const sDoc = oRow?.DocumentNumber || oRow?.NumeroFattura || "SenzaNumero";

            return [
                {
                    NomeAttachment: `Fattura_${sDoc}.pdf`,
                    FormatoAttachment: "PDF",
                    DescrizioneAttachment: "Fattura di cortesia",
                    Attachment: ""
                },
                {
                    NomeAttachment: `Dettaglio_${sDoc}.pdf`,
                    FormatoAttachment: "PDF",
                    DescrizioneAttachment: "Dettaglio righe fattura",
                    Attachment: ""
                }
            ];
        },

        _openAllegatiDialogMock: function (aItems) {
            if (!this._oAllegatiDialog) {
                this._oAllegatiModel = new JSONModel({ items: [] });

                const oList = new sap.m.List({
                    items: {
                        path: "/items",
                        template: new sap.m.StandardListItem({
                            title: "{NomeAttachment}",
                            description: "{DescrizioneAttachment}",
                            info: "{FormatoAttachment}",
                            type: "Active",
                            press: function () {
                                MessageToast.show("Mock: apertura allegato");
                            }
                        })
                    }
                });

                oList.setModel(this._oAllegatiModel);

                this._oAllegatiDialog = new sap.m.Dialog({
                    title: "Allegati",
                    contentWidth: "650px",
                    contentHeight: "420px",
                    resizable: true,
                    draggable: true,
                    content: [oList],
                    endButton: new sap.m.Button({
                        text: "Chiudi",
                        press: () => this._oAllegatiDialog.close()
                    })
                });

                this.getView().addDependent(this._oAllegatiDialog);
            }

            this._oAllegatiModel.setData({ items: aItems || [] });
            this._oAllegatiDialog.open();
        },


        _onOpenAttachment: function (oEvent) {
            const oItem = oEvent.getSource();
            const oCtx = oItem.getBindingContext();
            const oAtt = oCtx.getObject();
            
            const sBase64 = oAtt && oAtt.Attachment;
            if (!sBase64) {
                MessageToast.show("Attachment vuoto");
                return;
            }

            const sFmt = (oAtt.FormatoAttachment || "").toUpperCase();
            const sMime = sFmt === "PDF" ? "application/pdf" : "application/octet-stream";

            const sBinary = atob(sBase64);
            const aBytes = new Uint8Array(sBinary.length);
            for (let i = 0; i < sBinary.length; i++) aBytes[i] = sBinary.charCodeAt(i);

            const oBlob = new Blob([aBytes], { type: sMime });
            const sUrl = URL.createObjectURL(oBlob);

            window.open(sUrl, "_blank");
            setTimeout(() => URL.revokeObjectURL(sUrl), 30000);
        },


        formatter: {
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
            supplierStatusText: function (sValue) {
                switch (sValue) {
                    case "0":
                        return "Nessun Fornitore";
                    case "1":
                        return "Fornitore trovato";
                    case "2":
                        return "Più fornitori";
                    default:
                        return "";
                }
            }
        },


    });
});
