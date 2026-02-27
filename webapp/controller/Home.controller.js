sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/codeeditor/CodeEditor",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/VBox",


], (BaseController, JSONModel, Fragment, MessageBox, MessageToast, CodeEditor, Dialog, Button, VBox) => {
    "use strict";

    return BaseController.extend("com.zeim.fatturazionepassiva.controller.Home", {

        onInit() {
            sap.ui.getCore().getEventBus().subscribe("fatture", "clearSelection", this._onClearSelection, this);

            // ViewModel (flow + contatori)
            var oViewModel = new sap.ui.model.json.JSONModel({
                counts: {
                    All: 0,
                    NotAllowed: 0,   // stato 0
                    Working: 0,      // stato 1
                    Parked: 0,       // stato 2
                    Processed: 0,    // stato 3
                },
                ui: {
                    canOpenCreateApps: false,
                    canBlocca: false,
                    canArchivia: false,
                    canSblocca: false,
                    canStorno: false,
                    enableAssignCompany: false
                }

            });
            this.getView().setModel(oViewModel, "viewModel");

            const oHomeFilters = new sap.ui.model.json.JSONModel({
                SupplierTokens: [],
                TipoDocAdeTokens: [],
                NomeFornitoreTokens: []
            });
            this.getView().setModel(oHomeFilters, "homeFilters");


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

        _onClearSelection: function () {
            const oTable = this.byId("idTreeTable");
            if (oTable) oTable.clearSelection();
        },

        onExit: function () {
            sap.ui.getCore().getEventBus().unsubscribe(
                "fatture",
                "clearSelection",
                this._onClearSelection,
                this
            );
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

        onFilterBarSearch: function () {
            const aFilters = this._buildMainFiltersFromFilterBar();

            const oTable = this.byId("idTreeTable");
            if (oTable) oTable.clearSelection();

            this.getView().getModel("viewModel").setProperty("/ui/canOpenCreateApps", false);
            this.getView().getModel("viewModel").setProperty("/ui/canBlocca", false);
            this.getView().getModel("viewModel").setProperty("/ui/canArchivia", false);
            this.getView().getModel("viewModel").setProperty("/ui/canStorno", false);
            this.getView().getModel("viewModel").setProperty("/ui/enableAssignCompany", false);

            this._bindTable(true, aFilters);
        },

        _buildMainFiltersFromFilterBar: function () {
            const Filter = sap.ui.model.Filter;
            const FO = sap.ui.model.FilterOperator;
            const aFilters = [];

            const sSoc = this.byId("selectSocieta") && this.byId("selectSocieta").getSelectedKey();
            if (sSoc) aFilters.push(new Filter("CompanyCode", FO.EQ, sSoc));

            const aForn = this._getTokenKeys("multinputFornitore");
            if (aForn.length === 1) {
                aFilters.push(new Filter("SupplierCode", FO.EQ, aForn[0]));
            } else if (aForn.length > 1) {
                aFilters.push(new Filter(aForn.map(v => new Filter("SupplierCode", FO.EQ, v)), false));
            }

            const nomeFornitore = this.byId("inputNomeFornitore") && (this.byId("inputNomeFornitore").getValue() || "").trim();
            if (nomeFornitore) aFilters.push(new Filter("SupplierName", FO.Contains, nomeFornitore.toUpperCase()));


            const sCF = this.byId("inputCodFiscale") && (this.byId("inputCodFiscale").getValue() || "").trim();
            if (sCF) aFilters.push(new Filter("CodiceFiscale", FO.Contains, sCF));

            const sPiva = this.byId("inputPartitaIva") && (this.byId("inputPartitaIva").getValue() || "").trim();
            if (sPiva) aFilters.push(new Filter("PartitaIVAcee", FO.Contains, sPiva));

            const aTipoAde = this._getTokenKeys("multiInputTipoDocAdE");
            if (aTipoAde.length === 1) {
                aFilters.push(new Filter("TipoDocAdE", FO.EQ, aTipoAde[0]));
            } else if (aTipoAde.length > 1) {
                aFilters.push(new Filter(aTipoAde.map(v => new Filter("TipoDocAdE", FO.EQ, v)), false));
            }

            const sNrDoc = this.byId("inputNrDoc") && (this.byId("inputNrDoc").getValue() || "").trim();
            if (sNrDoc) aFilters.push(new Filter("NumeroFattura", FO.Contains, sNrDoc.toUpperCase()));

            const oDRDoc = this.byId("dateRangePicker2");
            if (oDRDoc) {
                const dFrom = oDRDoc.getDateValue();
                const dTo = oDRDoc.getSecondDateValue();
                if (dFrom && dTo) {
                    const d1 = new Date(dFrom.getTime()); d1.setHours(0, 0, 0, 0);
                    const d2 = new Date(dTo.getTime()); d2.setHours(23, 59, 59, 999);
                    aFilters.push(new Filter("DataFattura", FO.BT, d1, d2));
                }
            }

            const oDRRic = this.byId("dateRangePicker");
            if (oDRRic) {
                const dFrom = oDRRic.getDateValue();
                const dTo = oDRRic.getSecondDateValue();
                if (dFrom && dTo) {
                    const d1 = new Date(dFrom.getTime()); d1.setHours(0, 0, 0, 0);
                    const d2 = new Date(dTo.getTime()); d2.setHours(23, 59, 59, 999);
                    aFilters.push(new Filter("DataSDI", FO.BT, d1, d2));
                }
            }

            const sCodDest = this.byId("inputCodiceDestinatario") && (this.byId("inputCodiceDestinatario").getValue() || "").trim();
            if (sCodDest) aFilters.push(new Filter("CodDestinatario", FO.Contains, sCodDest));

            const sNrInvio = this.byId("inputNrInvioSdi") && (this.byId("inputNrInvioSdi").getValue() || "").trim();
            if (sNrInvio) aFilters.push(new Filter("NumeroSDI", FO.Contains, sNrInvio));

            // (opzionale ma consigliato) applica anche il filtro stato in base alla tab selezionata
            const oITB = this.byId("idIconTabBar");
            const sKey = oITB && oITB.getSelectedKey();
            if (sKey === "NotAllowed") aFilters.push(new Filter("StatoFattura", FO.EQ, "0"));
            if (sKey === "Working") aFilters.push(new Filter("StatoFattura", FO.EQ, "1"));
            if (sKey === "Parked") aFilters.push(new Filter("StatoFattura", FO.EQ, "2"));
            if (sKey === "Processed") aFilters.push(new Filter("StatoFattura", FO.EQ, "3"));

            return aFilters;
        },

        onFilterBarClear: function () {
            const oVM = this.getView().getModel("viewModel");

            // 1) reset UI state
            oVM.setProperty("/ui/canOpenCreateApps", false);
            oVM.setProperty("/ui/canBlocca", false);
            oVM.setProperty("/ui/canArchivia", false);
            oVM.setProperty("/ui/canSblocca", false);
            oVM.setProperty("/ui/canStorno", false);
            oVM.setProperty("/ui/enableAssignCompany", false);

            // 2) svuota davvero i campi della FilterBar
            const oSelSoc = this.byId("selectSocieta");
            if (oSelSoc) oSelSoc.setSelectedKey("");

            const oMIFor = this.byId("multiInputFornitore");
            if (oMIFor) oMIFor.removeAllTokens();

            const oMINomeFornitore = this.byId("inputNomeFornitore");
            if (oMINomeFornitore) oMINomeFornitore.setValue("");

            const oInpCF = this.byId("inputCodFiscale");
            if (oInpCF) oInpCF.setValue("");

            const oInpPiva = this.byId("inputPartitaIva");
            if (oInpPiva) oInpPiva.setValue("");

            const oMITipo = this.byId("multiInputTipoDocAdE");
            if (oMITipo) oMITipo.removeAllTokens();

            const oInpNrDoc = this.byId("inputNrDoc");
            if (oInpNrDoc) oInpNrDoc.setValue("");

            const oDRDoc = this.byId("dateRangePicker2");
            if (oDRDoc) {
                oDRDoc.setDateValue(null);
                oDRDoc.setSecondDateValue(null);
                oDRDoc.setValue("");
            }

            const oDRRic = this.byId("dateRangePicker");
            if (oDRRic) {
                oDRRic.setDateValue(null);
                oDRRic.setSecondDateValue(null);
                oDRRic.setValue("");
            }

            const oInpCodDest = this.byId("inputCodiceDestinatario");
            if (oInpCodDest) oInpCodDest.setValue("");

            const oInpNrInvio = this.byId("inputNrInvioSdi");
            if (oInpNrInvio) oInpNrInvio.setValue("");

            // 3) reset filtri “server-side”
            this._currentFilters = [];

            // 4) reset tab
            const oITB = this.byId("idIconTabBar");
            if (oITB) oITB.setSelectedKey("All");

            // 5) clear selezione tabella
            const oTable = this.byId("idTreeTable");
            if (oTable) oTable.clearSelection();

            // 6) ricarica senza filtri
            this._bindTable(true, []);
        },



        _bindTable: function (bReset = true, aFilters) {
            const oODataModel = this.getOwnerComponent().getModel("mainService");
            const oFattureModel = this.getView().getModel("fattureModel");

            if (Array.isArray(aFilters)) {
                this._currentFilters = aFilters;
            }
            const aUseFilters = this._currentFilters || [];

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
                filters: aUseFilters,
                urlParameters: {
                    "$top": this._pagination.top,
                    "$skip": this._pagination.skip
                },
                success: (oData) => {
                    const aOld = oFattureModel.getProperty("/results") || [];
                    const aNew = oData.results || [];

                    oFattureModel.setProperty("/results", aOld.concat(aNew));

                    const aRows = oFattureModel.getProperty("/results") || [];
                    this._updateCounts(aRows);

                    this._pagination.skip += aNew.length;
                    this._pagination.hasMore = aNew.length === this._pagination.top;
                    this._pagination.isLoading = false;

                    sap.ui.core.BusyIndicator.hide();

                    if (this._pagination.hasMore) {
                        setTimeout(() => this._bindTable(false), 50);
                    }
                },
                error: () => {
                    this._pagination.isLoading = false;
                    this._pagination.hasMore = false;
                    sap.ui.core.BusyIndicator.hide();
                    sap.m.MessageToast.show("Errore nel caricamento fatture.");
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




        onFatturaLogisticaButtonPress: function (oEvent) {
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
            sap.ui.require(["com/zeim/fatturazionepassiva/controller/helpers/ValueHelpHandler"], function (VH) {

                VH.openValueHelp(
                    this,
                    "com.zeim.fatturazionepassiva.view.fragments.ValueHelpDialogFilterbarFornitore",
                    "Fornitore",
                    "/zeim_search_supplier_data",
                    {
                        vhId: "HOME_FORN",
                        key: "Supplier",
                        desc: "SupplierName",
                        keyProp: "Supplier",
                        filterProps: ["Supplier", "SupplierName", "Country"],
                        columns: [
                            { label: "Fornitore", path: "Supplier" },
                            { label: "Nome Fornitore", path: "SupplierName" },
                            { label: "Paese", path: "Country" }
                        ],
                        targetModelName: "homeFilters",
                        tokensPath: "/SupplierTokens",
                        multiInputId: "multiInputFornitore",
                    }
                );

            }.bind(this));
        },

        onValueHelpNomeFornitore: function () {
            sap.ui.require(["com/zeim/fatturazionepassiva/controller/helpers/ValueHelpHandler"], function (VH) {

                VH.openValueHelp(
                    this,
                    "com.zeim.fatturazionepassiva.view.fragments.ValueHelpDialogFilterbarFornitore",
                    "Fornitore",
                    "/zeim_search_supplier_data",
                    {
                        vhId: "HOME_FORN",
                        key: "SupplierName",
                        desc: "SupplierName",
                        keyProp: "Supplier",
                        filterProps: ["Supplier", "SupplierName", "Country"],
                        columns: [
                            { label: "Fornitore", path: "Supplier" },
                            { label: "Nome Fornitore", path: "SupplierName" },
                            { label: "Paese", path: "Country" }
                        ],
                        targetModelName: "homeFilters",
                        tokensPath: "/NomeFornitoreTokens",
                        multiInputId: "multiInputNomeFornitore",
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
                        multiInputId: "multiInputTipoDocAdE"
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


        _getFileNameFromRow: function (oRow) {
            return oRow?.FileName || "";
        },
        onVisualizzaAllegato: function (oEvent) {
            const oCtx = oEvent.getSource().getBindingContext("fattureModel");
            if (!oCtx) {
                MessageToast.show("Context non trovato");
                return;
            }

            const oRow = oCtx.getObject();
            const sFileName = this._getFileNameFromRow(oRow);

            if (!sFileName) {
                MessageToast.show("FileName non presente sulla riga");
                return;
            }

            sap.ui.core.BusyIndicator.show(0);

            const oODataModel = this.getOwnerComponent().getModel("mainService");
            const aFilters = [new sap.ui.model.Filter("FileName", sap.ui.model.FilterOperator.EQ, sFileName)];

            oODataModel.read("/ZEIM_AllegatiFattura", {
                filters: aFilters,
                success: (oData) => {
                    sap.ui.core.BusyIndicator.hide();
                    const aItems = oData?.results || [];
                    this._openAllegatiDialog(aItems, sFileName);
                },
                error: (err) => {
                    sap.ui.core.BusyIndicator.hide();
                    console.error(err);
                    MessageBox.error("Errore nel recupero allegati");
                }
            });
        },

        _openAllegatiDialog: function (aItems, sFileName) {
            if (!this._oAllegatiDialog) {
                this._oAllegatiModel = new JSONModel({ items: [] });

                const oTable = new sap.m.Table({
                    width: "100%",
                    inset: false,
                    columns: [
                        new sap.m.Column({
                            header: new sap.m.Label({ text: "Nome file" })
                        }),
                        new sap.m.Column({
                            width: "10rem",
                            hAlign: "End",
                            header: new sap.m.Label({ text: "" })
                        })
                    ],
                    items: {
                        path: "/items",
                        template: new sap.m.ColumnListItem({
                            cells: [
                                new sap.m.VBox({
                                    items: [
                                        new sap.m.Text({ text: "{NomeAttachment}" }),
                                        new sap.m.Text({
                                            text: "{DescrizioneAttachment}",
                                            wrapping: false
                                        }).addStyleClass("sapUiTinyMarginTop")
                                    ]
                                }),
                                new sap.m.HBox({
                                    justifyContent: "End",
                                    items: [
                                        new sap.m.Button({
                                            text: {
                                                parts: [
                                                    { path: "FormatoAttachment" },
                                                    { path: "NomeAttachment" }
                                                ],
                                                formatter: function (sFmt, sName) {
                                                    const fmt = (sFmt || "").toUpperCase();
                                                    const name = (sName || "").toUpperCase();
                                                    const isPdf = fmt === "PDF" || name.endsWith(".PDF");
                                                    return isPdf ? "Visualizza" : "Scarica";
                                                }
                                            },
                                            type: "Emphasized",
                                            press: this._onAttachmentAction.bind(this)
                                        })
                                    ]
                                })
                            ]
                        })
                    }
                });

                oTable.setModel(this._oAllegatiModel);

                const oContent = new sap.m.VBox({
                    width: "100%",
                    items: [oTable]
                }).addStyleClass("sapUiContentPadding");

                this._oAllegatiDialog = new sap.m.Dialog({
                    title: "Allegati",
                    contentWidth: "700px",
                    contentHeight: "420px",
                    resizable: true,
                    draggable: true,
                    content: [oContent],
                    endButton: new sap.m.Button({
                        text: "Chiudi",
                        press: () => this._oAllegatiDialog.close(),
                        type: "Emphasized"
                    })
                });

                this.getView().addDependent(this._oAllegatiDialog);
            }

            this._oAllegatiDialog.setTitle(`Allegati - ${sFileName || ""}`);
            this._oAllegatiModel.setData({ items: aItems || [] });
            this._oAllegatiDialog.open();
        },


        _onAttachmentAction: function (oEvent) {
            const oCtx = oEvent.getSource().getBindingContext();
            const oAtt = oCtx && oCtx.getObject();

            const sBase64Raw = oAtt && oAtt.Attachment;
            if (!sBase64Raw) {
                MessageToast.show("Attachment vuoto");
                return;
            }

            const sName = (oAtt.NomeAttachment || "allegato").trim();

            if (this._isPdfBase64(sBase64Raw)) {
                this._openPdfInApp(sBase64Raw, sName);
            } else {
                this._downloadAttachment(sBase64Raw, sName);
            }
        },
        _isPdfBase64: function (sBase64) {
            const clean = String(sBase64 || "").trim().split(",").pop().replace(/\s/g, "");
            if (!clean) return false;

            try {
                const head = atob(clean.slice(0, 80)).slice(0, 5);
                return head === "%PDF-";
            } catch (e) {
                return false;
            }
        },


        _openPdfInApp: function (sBase64, sFileName) {
            const clean = String(sBase64 || "").trim().split(",").pop().replace(/\s/g, "");
            const sDataUrl = "data:application/pdf;base64," + clean;

            const oIframe = new sap.ui.core.HTML({
                content: `<iframe src="${sDataUrl}" width="100%" height="700px" style="border:none;"></iframe>`
            });

            const oDialog = new sap.m.Dialog({
                title: `Anteprima - ${sFileName}`,
                contentWidth: "90%",
                contentHeight: "100%",
                resizable: true,
                draggable: true,
                content: [oIframe],
                beginButton: new sap.m.Button({ text: "Chiudi", press: () => oDialog.close(), type: "Emphasized" }),
                afterClose: () => oDialog.destroy()
            });

            oDialog.open();
        },




        _base64ToObjectUrl: function (sBase64, sMime) {
            const clean = String(sBase64 || "").trim().split(",").pop().replace(/\s/g, "");
            const bin = atob(clean);

            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

            return URL.createObjectURL(new Blob([bytes], { type: sMime }));
        },

        _downloadAttachment: function (sBase64, sFileName) {
            const url = this._base64ToObjectUrl(sBase64, "application/octet-stream");

            const a = document.createElement("a");
            a.href = url;
            a.download = sFileName || "allegato";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            setTimeout(() => URL.revokeObjectURL(url), 30000);
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
        },


        onVisualizzaXML: function (oEvent) {
            const oCtx = oEvent.getSource().getBindingContext("fattureModel");
            if (!oCtx) {
                MessageToast.show("Impossibile determinare la riga selezionata.");
                return;
            }

            const oRow = oCtx.getObject() || {};
            const sFileName = oRow.FileName;

            if (!sFileName) {
                MessageToast.show("FileName mancante sulla riga.");
                return;
            }

            this._openXmlDialog();
            this._loadXmlIntoDialog(sFileName);
        },

        _openXmlDialog: function () {
            if (this._oXmlDialog) {
                this._oXmlDialog.open();
                return;
            }

            this._oXmlEditor = new CodeEditor({
                type: "xml",
                height: "70vh",
                width: "100%",
                editable: false,
                showLineNumbers: true,
                value: ""
            });

            this._oXmlDialog = new Dialog({
                title: "XML Fattura",
                contentWidth: "80vw",
                contentHeight: "80vh",
                resizable: true,
                draggable: true,
                content: [
                    new VBox({
                        width: "100%",
                        height: "100%",
                        items: [this._oXmlEditor]
                    })
                ],
                beginButton: new Button({
                    text: "Chiudi",
                    press: () => this._oXmlDialog.close(),
                    type: "Emphasized"
                })
            });

            this.getView().addDependent(this._oXmlDialog);
            this._oXmlDialog.open();
        },

        _loadXmlIntoDialog: function (sFileName) {
            const oModel = this.getOwnerComponent().getModel("mainService");

            const sPath = oModel.createKey("/ZEIM_DettaglioFattura", { FileName: sFileName });

            this._oXmlEditor.setValue("Caricamento...");

            oModel.read(sPath, {
                success: (oData) => this._setDialogXmlFromJsonString(oData.Data),
                error: () => {
                    this._oXmlEditor.setValue("");
                    MessageToast.show("Errore nel caricamento XML fattura");
                }
            });
        },

        _setDialogXmlFromJsonString: function (sData) {
            let oJson;
            try {
                oJson = JSON.parse(sData);
            } catch (e) {
                this._oXmlEditor.setValue("");
                MessageToast.show("Formato fattura non valido");
                return;
            }

            const sXml = this._jsonToPrettyXml(oJson);
            this._oXmlEditor.setValue(sXml);
        },

        _jsonToPrettyXml: function (oJson) {
            const escapeXml = (v) => String(v)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&apos;");

            const indentStr = (n) => "  ".repeat(n);

            const nodeToXml = (name, value, level) => {
                if (value === null || value === undefined) return `${indentStr(level)}<${name}/>\n`;
                if (Array.isArray(value)) return value.map(v => nodeToXml(name, v, level)).join("");
                if (typeof value !== "object") return `${indentStr(level)}<${name}>${escapeXml(value)}</${name}>\n`;

                const attrsObj = value.$ || null;
                const attrText = attrsObj
                    ? " " + Object.keys(attrsObj).map(k => `${k}="${escapeXml(attrsObj[k])}"`).join(" ")
                    : "";

                const keys = Object.keys(value).filter(k => k !== "$");
                if (keys.length === 0) return `${indentStr(level)}<${name}${attrText}/>\n`;

                let inner = "";
                for (const k of keys) inner += nodeToXml(k, value[k], level + 1);

                return `${indentStr(level)}<${name}${attrText}>\n${inner}${indentStr(level)}</${name}>\n`;
            };

            const versione = oJson["@versione"];
            const payload = { ...oJson };
            delete payload["@versione"];

            const root = {};
            if (versione) root.$ = { versione };
            Object.keys(payload).forEach(k => root[k] = payload[k]);

            return nodeToXml("FatturaElettronica", root, 0).trim() + "\n";
        },

        onBloccaFatturaButtonPress: async function () {

            const oTable = this.byId("idTreeTable");
            const aSel = oTable.getSelectedIndices() || [];

            if (aSel.length === 0) {
                sap.m.MessageToast.show("Seleziona una fattura da bloccare.");
                return;
            }

            if (aSel.length > 1) {
                sap.m.MessageToast.show("Puoi bloccare una sola fattura alla volta.");
                return;
            }

            const iIndex = aSel[0];
            const oCtx = oTable.getContextByIndex(iIndex);
            if (!oCtx) {
                sap.m.MessageToast.show("Impossibile determinare la riga selezionata.");
                return;
            }

            const oJson = this.getView().getModel("fattureModel");
            this._sBloccaRowPath = oCtx.getPath();

            const oRow = oCtx.getObject() || {};
            if (!oRow.Id) {
                sap.m.MessageToast.show("ID mancante sulla riga selezionata.");
                return;
            }

            const oODataModel = this.getOwnerComponent().getModel("mainService");

            sap.ui.core.BusyIndicator.show(0);

            try {

                const oServer = await this._readRicercaFatturaPassiva(oODataModel, oRow);

                if (!oServer) {
                    sap.ui.core.BusyIndicator.hide();
                    sap.m.MessageBox.warning("Fattura non trovata sul backend.");
                    return;
                }

                if (oServer.CodBlocco === true) {

                    // allineo UI
                    oJson.setProperty(this._sBloccaRowPath + "/CodBlocco", true);
                    oJson.setProperty(this._sBloccaRowPath + "/MotivoBlocco", oServer.MotivoBlocco || "");
                    oJson.updateBindings(true);

                    sap.ui.core.BusyIndicator.hide();

                    sap.m.MessageBox.warning(
                        "La fattura risulta già bloccata da un altro utente.",
                        {
                            title: "Dati aggiornati",
                            onClose: function () {
                                oTable.clearSelection();
                            }
                        }
                    );

                    return;
                }

                sap.ui.core.BusyIndicator.hide();

            } catch (e) {
                sap.ui.core.BusyIndicator.hide();
                sap.m.MessageBox.error("Errore durante la verifica del blocco.");
                return;
            }

            this._openBloccaDialogSingle(oRow.Id);
        },

        _openBloccaDialogSingle: function (sId) {
            if (!this._oBloccaDialog) {

                this._oMotivoInput = new sap.m.TextArea({
                    width: "100%",
                    rows: 4,
                    maxLength: 60,
                    placeholder: "Inserisci la motivazione del blocco...",
                    liveChange: (oEvent) => {
                        const sValRaw = oEvent.getParameter("value") || "";

                        // Il bottone si abilita solo se c'è contenuto reale (non solo spazi)
                        this._oBloccaConfirmBtn.setEnabled(sValRaw.trim().length > 0);
                    }
                });

                this._oBloccaConfirmBtn = new sap.m.Button({
                    text: "Conferma blocco",
                    type: "Emphasized",
                    enabled: false,
                    press: async () => {
                        const sValRaw = this._oMotivoInput.getValue() || ""; // NO trim (spazi inclusi)
                        const sMotivoToSave = sValRaw.trim();                // trim solo per salvataggio

                        if (!sMotivoToSave) {
                            sap.m.MessageToast.show("Inserisci una motivazione.");
                            return;
                        }

                        // Anche se maxLength blocca già, manteniamo comunque la validazione
                        if (sValRaw.length > 60) {
                            sap.m.MessageBox.warning("Motivo troppo lungo (max 60 caratteri, spazi inclusi).");
                            return;
                        }

                        this._oBloccaDialog.close();
                        await this._bloccaFatturaSingola(this._sBloccaId, sMotivoToSave);
                    }
                });

                this._oBloccaDialog = new sap.m.Dialog({
                    title: "Blocca fattura",
                    contentWidth: "560px",
                    resizable: true,
                    draggable: true,
                    horizontalScrolling: false,
                    content: [
                        new sap.m.VBox({
                            width: "100%",
                            items: [
                                new sap.m.Text({ text: "Motivazione blocco (max 60 caratteri)" })
                                    .addStyleClass("sapUiTinyMarginBottom"),
                                this._oMotivoInput
                            ]
                        })
                    ],
                    beginButton: this._oBloccaConfirmBtn,
                    endButton: new sap.m.Button({
                        text: "Annulla",
                        press: () => this._oBloccaDialog.close()
                    }),
                    afterClose: () => {
                        this._oMotivoInput.setValue("");
                        this._oBloccaConfirmBtn.setEnabled(false);
                    }
                });

                // Padding vero (come da test)
                this._oBloccaDialog.addStyleClass("sapUiContentPadding");

                this.getView().addDependent(this._oBloccaDialog);
            }

            this._sBloccaId = sId;
            this._oBloccaDialog.open();
        },


        _bloccaFatturaSingola: async function (sId, sMotivo) {
            const oODataModel = this.getOwnerComponent().getModel("mainService");
            sap.ui.core.BusyIndicator.show(0);

            try {
                await this._putBloccoMotivo(oODataModel, sId, sMotivo);
            } catch (e) {
                sap.m.MessageBox.error("Errore nel blocco fattura (PUT).");
                return;
            } finally {
                sap.ui.core.BusyIndicator.hide();
            }

            try {

                const oJson = this.getView().getModel("fattureModel");
                if (this._sBloccaRowPath) {
                    oJson.setProperty(this._sBloccaRowPath + "/CodBlocco", true);

                    oJson.setProperty(this._sBloccaRowPath + "/MotivoBlocco", sMotivo);

                    oJson.refresh(true);
                }

                this.byId("idTreeTable").clearSelection();

                sap.m.MessageToast.show("Fattura bloccata con successo.");
            } catch {
                sap.m.MessageToast.show("Blocco eseguito, ma aggiornamento UI parziale.");
            }
        },

        _putBloccoMotivo: function (oODataModel, sId, sMotivo) {
            const sPath = oODataModel.createKey("/ZC_EIM_FPXML", { ID: sId });

            const oPayload = {
                Blocco: true,
                Motivo: sMotivo
            };

            return new Promise((resolve, reject) => {
                oODataModel.update(sPath, oPayload, {
                    merge: true,
                    success: resolve,
                    error: reject
                });
            });
        },

        onSbloccaFatturaButtonPress: function () {
            const oTable = this.byId("idTreeTable");
            const aSelectedIndices = oTable.getSelectedIndices();

            if (aSelectedIndices.length === 0) {
                sap.m.MessageToast.show("Seleziona una fattura da sbloccare.");
                return;
            }
            if (aSelectedIndices.length > 1) {
                sap.m.MessageToast.show("Puoi sbloccare una sola fattura alla volta.");
                return;
            }

            const iIndex = aSelectedIndices[0];
            const oJson = this.getView().getModel("fattureModel");
            this._sSbloccaRowPath = `/results/${iIndex}`;

            const oRow = oJson.getProperty(this._sSbloccaRowPath);
            console.log(oRow);
            if (!oRow || !oRow.Id) {
                sap.m.MessageToast.show("ID mancante sulla riga selezionata.");
                return;
            }

            if (!oRow.CodBlocco) {
                sap.m.MessageToast.show("La fattura selezionata non risulta bloccata.");
                return;
            }

            this._openSbloccaDialogSingle(oRow.Id);
        },

        _openSbloccaDialogSingle: function (sId) {
            if (!this._oSbloccaDialog) {
                this._oSbloccaConfirmBtn = new sap.m.Button({
                    text: "Conferma sblocco",
                    type: "Emphasized",
                    press: async () => {
                        this._oSbloccaDialog.close();
                        await this._sbloccaFatturaSingola(this._sSbloccaId);
                    }
                });

                this._oSbloccaDialog = new sap.m.Dialog({
                    title: "Sblocca fattura",
                    contentWidth: "560px",
                    resizable: true,
                    draggable: true,
                    horizontalScrolling: false,
                    content: [
                        new sap.m.VBox({
                            width: "100%",
                            items: [
                                new sap.m.Text({
                                    text: "Confermi lo sblocco della fattura selezionata?"
                                })
                            ]
                        })
                    ],
                    beginButton: this._oSbloccaConfirmBtn,
                    endButton: new sap.m.Button({
                        text: "Annulla",
                        press: () => this._oSbloccaDialog.close()
                    })
                });

                this._oSbloccaDialog.addStyleClass("sapUiContentPadding");
                this.getView().addDependent(this._oSbloccaDialog);
            }

            this._sSbloccaId = sId;
            this._oSbloccaDialog.open();
        },

        _sbloccaFatturaSingola: async function (sId) {
            const oODataModel = this.getOwnerComponent().getModel("mainService");
            sap.ui.core.BusyIndicator.show(0);

            try {
                await this._putSblocca(oODataModel, sId);

                const oJson = this.getView().getModel("fattureModel");
                if (this._sSbloccaRowPath) {
                    oJson.setProperty(this._sSbloccaRowPath + "/CodBlocco", false);
                    oJson.setProperty(this._sSbloccaRowPath + "/MotivoBlocco", "");
                    oJson.refresh(true);
                }

                this.byId("idTreeTable").clearSelection();
                sap.m.MessageToast.show("Fattura sbloccata con successo.");
            } catch (e) {
                console.error(e);
                sap.m.MessageBox.error("Errore nello sblocco fattura.");
            } finally {
                sap.ui.core.BusyIndicator.hide();
            }
        },

        _putSblocca: function (oODataModel, sId) {
            const sPath = oODataModel.createKey("/ZC_EIM_FPXML", { ID: sId });

            const oPayload = {
                Blocco: false,
                Motivo: ""
            };

            return new Promise((resolve, reject) => {
                oODataModel.update(sPath, oPayload, {
                    merge: true,
                    success: resolve,
                    error: reject
                });
            });
        },



        onExit: function () {
            if (this._oXmlDialog) {
                this._oXmlDialog.destroy();
                this._oXmlDialog = null;
                this._oXmlEditor = null;
            }
            if (this._oBloccaDialog) {
                this._oBloccaDialog.destroy();
                this._oBloccaDialog = null;
                this._oMotivoInput = null;
                this._oBloccaConfirmBtn = null;
                this._sBloccaId = null;
            }

            if (this._oSbloccaDialog) {
                this._oSbloccaDialog.destroy();
                this._oSbloccaDialog = null;
                this._oSbloccaConfirmBtn = null;
                this._sSbloccaId = null;
            }
        },

        //Navigazione verso app standard di creazione

        onFatturaContabileButtonPress: async function () {
            try {


                const oCrossAppNav = await sap.ushell.Container.getServiceAsync("CrossApplicationNavigation");

                const sHash = oCrossAppNav.hrefForExternal({
                    target: {
                        semanticObject: "Supplier",
                        action: "createIncomingInvoice"
                    }
                });

                const sFullUrl = window.location.origin + "/ui" + sHash

                window.open(sFullUrl, "_blank");

            } catch (err) {
                console.error("Errore nella navigazione Cross-App:", err);
                sap.m.MessageBox.error("Impossibile aprire l'app Customer - Manage.");
            }
        },

        onFatturaLogisticaMiroButtonPress: async function () {
            try {
                const oCrossAppNav = await sap.ushell.Container.getServiceAsync("CrossApplicationNavigation");

                const sHash = oCrossAppNav.hrefForExternal({
                    target: {
                        semanticObject: "SupplierInvoice",
                        action: "createAdvanced"
                    }
                });

                const sFullUrl = window.location.origin + "/ui" + sHash

                window.open(sFullUrl, "_blank")
            } catch (err) {
                console.error("Errore nella navigazione Cross-App:", err);
                sap.m.MessageBox.error("Impossibile aprire l'app Create Invoice - Advanced.")
            }
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

        onDocumentNumberLinkPressConditional: function (oEvent) {
            const oCtx = oEvent.getSource().getBindingContext("fattureModel");
            if (!oCtx) {
                sap.m.MessageToast.show("Impossibile determinare la riga selezionata.");
                return;
            }

            const oRow = oCtx.getObject() || {};
            const sTipo = oRow.TipoFattura; // 'M' = logistica, altrimenti contabile
            const sDocNumber = oRow.DocumentNumber;

            if (!sDocNumber) {
                sap.m.MessageToast.show("DocumentNumber mancante.");
                return;
            }

            if (sTipo === "M") {
                this._onApriDocumentoLogistico(sDocNumber, oRow);
                return;
            }

            this._onApriDocumentoContabile(sDocNumber, oRow);
        },


        _onApriDocumentoLogistico: async function (sDocNumber, oRow) {
            try {
                const belnr = sDocNumber;
                const gjahr = oRow?.FiscalYear;

                if (!belnr || !gjahr) {
                    sap.m.MessageToast.show("Dati mancanti: DocumentNumber o FiscalYear.");
                    return;
                }

                const oCrossAppNav = await sap.ushell.Container.getServiceAsync("CrossApplicationNavigation");

                const sHash = oCrossAppNav.hrefForExternal({
                    target: {
                        semanticObject: "SupplierInvoice",
                        action: "changeAdvanced"
                    },
                    params: {
                        SupplierInvoice: belnr,
                        FiscalYear: gjahr
                    }
                });

                if (!sHash) {
                    sap.m.MessageToast.show("Impossibile generare la navigazione (inbound mancante).");
                    return;
                }

                window.open(sHash, "_blank");
            } catch (err) {
                console.error("Errore navigazione logistica:", err);
                sap.m.MessageToast.show("Errore nella navigazione verso app standard (logistica).");
            }
        },

        _onApriDocumentoContabile: async function (sDocNumber, oRow) {
            try {
                const belnr = oRow?.FinanceDocument || sDocNumber;
                const bukrs = oRow?.CompanyCode;
                const gjahr = oRow?.FiscalYear;

                if (!belnr || !bukrs || !gjahr) {
                    sap.m.MessageToast.show("Dati mancanti: FinanceDocument, CompanyCode o FiscalYear.");
                    return;
                }

                const Navigation = await sap.ushell.Container.getServiceAsync("Navigation");

                const sHref = await Navigation.getHref({
                    target: {
                        semanticObject: "AccountingDocument",
                        action: "manageV2"
                    },
                    params: {
                        AccountingDocument: belnr,
                        CompanyCode: bukrs,
                        FiscalYear: gjahr
                    }
                });

                if (!sHref) {
                    sap.m.MessageToast.show("Impossibile generare la navigazione contabile.");
                    return;
                }

                window.open(sHref, "_blank");
            } catch (err) {
                console.error("Errore navigazione contabile:", err);
                sap.m.MessageToast.show("Errore nella navigazione verso app standard (contabile).");
            }
        },

        onFinanceDocumentLinkPress: async function (oEvent) {
            try {
                const oContext = oEvent.getSource().getBindingContext("fattureModel");
                if (!oContext) {
                    sap.m.MessageToast.show("Impossibile determinare il cliente selezionato.");
                    return;
                }

                const oData = oContext.getObject();
                const belnr = oData.FinanceDocument;
                const bukrs = oData.CompanyCode;
                const gjahr = oData.FiscalYear;

                const Navigation = await sap.ushell.Container.getServiceAsync("Navigation");

                const sHref = await Navigation.getHref({
                    target: {
                        semanticObject: "AccountingDocument",
                        action: "manageV2"
                    },
                    params: {
                        AccountingDocument: belnr,
                        CompanyCode: bukrs,
                        FiscalYear: gjahr

                    }
                });

                console.log(" Navigazione FLP:", sHref);

                window.open(sHref, "_blank");
            } catch (err) {
                console.error("Errore nella navigazione Cross-App:", err);
            }
        },


        onVisualizzaPDF: async function (oEvent) {
            const oCtx = oEvent.getSource().getBindingContext("fattureModel");
            const oDataModel = this.getOwnerComponent().getModel("mainService");

            if (!oCtx) {
                sap.m.MessageToast.show("Impossibile determinare la riga selezionata.");
                return;
            }

            const oRow = oCtx.getObject() || {};
            const sFileName = oRow.FileName;

            if (!sFileName) {
                sap.m.MessageToast.show("FileName mancante sulla riga.");
                return;
            }

            const sPath = oDataModel.createKey("/ZEIM_PDFFATTURA", { FileName: sFileName });

            sap.ui.core.BusyIndicator.show(0);

            try {
                const oResponse = await new Promise((resolve, reject) => {
                    oDataModel.read(sPath, {
                        success: resolve,
                        error: reject
                    });
                });

                sap.ui.core.BusyIndicator.hide();

                if (!oResponse || !oResponse.Data) {
                    sap.m.MessageToast.show("Nessun PDF disponibile per questo documento");
                    return;
                }

                const pdfDataUrl = "data:application/pdf;base64," + oResponse.Data;

                const oIframe = new sap.ui.core.HTML({
                    content: `<iframe src="${pdfDataUrl}" width="100%" height="700px" style="border:none;"></iframe>`
                });

                const oDialog = new sap.m.Dialog({
                    title: "Visualizza Fattura (PDF)",
                    contentWidth: "90%",
                    contentHeight: "100%",
                    resizable: true,
                    draggable: true,
                    content: [oIframe],
                    beginButton: new sap.m.Button({
                        text: "Chiudi",
                        press: function () { oDialog.close(); }
                    }),
                    afterClose: function () { oDialog.destroy(); }
                });

                oDialog.open();

            } catch (err) {
                sap.ui.core.BusyIndicator.hide();
                console.error("Errore durante la lettura del PDF:", err);

                const sMsg = err?.message || err?.responseText || "Errore nel recupero del PDF dal backend.";
                sap.m.MessageBox.error(sMsg);
            }
        },

        onStornoFatturaButtonPress: async function () {
            const oTable = this.byId("idTreeTable");
            const aSelected = oTable.getSelectedIndices();

            if (!aSelected || aSelected.length === 0) {
                sap.m.MessageToast.show("Seleziona una fattura.");
                return;
            }
            if (aSelected.length > 1) {
                sap.m.MessageToast.show("Seleziona una sola fattura.");
                return;
            }

            const oCtx = oTable.getContextByIndex(aSelected[0]);
            if (!oCtx) {
                sap.m.MessageToast.show("Impossibile determinare la riga selezionata.");
                return;
            }

            const oRow = oCtx.getObject() || {};
            const sTipo = oRow.TipoFattura; // "M" = logistica, altrimenti contabile


            const openAndClear = (url) => {
                oTable.clearSelection();
                this.getView().getModel("viewModel").setProperty("/ui/canOpenCreateApps", false);
                window.open(url, "_blank");
            };

            try {
                // LOGISTICA -> SupplierInvoice-changeAdvanced
                if (sTipo === "M") {
                    const sSupplierInvoice = oRow.DocumentNumber;
                    const sFiscalYear = oRow.FiscalYear;

                    if (!sSupplierInvoice || !sFiscalYear) {
                        sap.m.MessageToast.show("Dati mancanti: SupplierInvoice / FiscalYear.");
                        return;
                    }

                    const oCrossAppNav = await sap.ushell.Container.getServiceAsync("CrossApplicationNavigation");

                    const sHash = oCrossAppNav.hrefForExternal({
                        target: { semanticObject: "SupplierInvoice", action: "changeAdvanced" },
                        params: {
                            SupplierInvoice: sSupplierInvoice,
                            FiscalYear: sFiscalYear,
                            FCLLayout: "MidColumnFullScreen"
                        }
                    });

                    if (!sHash) {
                        sap.m.MessageToast.show("Inbound SupplierInvoice-changeAdvanced non trovato.");
                        return;
                    }

                    openAndClear(sHash);
                    return;
                }

                // CONTABILE -> AccountingDocument-manageV2 con entity path
                const belnr = oRow.FinanceDocument || oRow.DocumentNumber;
                const bukrs = oRow.CompanyCode;
                const gjahr = oRow.FiscalYear;

                if (!belnr || !bukrs || !gjahr) {
                    sap.m.MessageToast.show("Dati mancanti: AccountingDocument / CompanyCode / FiscalYear.");
                    return;
                }

                const oCrossAppNav = await sap.ushell.Container.getServiceAsync("CrossApplicationNavigation");
                const sHash = oCrossAppNav.hrefForExternal({
                    target: { semanticObject: "AccountingDocument", action: "manageV2" },
                    params: {
                        AccountingDocument: belnr,
                        CompanyCode: bukrs,
                        FiscalYear: gjahr,
                        "sap-app-origin-hint": "",
                        FCLLayout: "MidColumnFullScreen"
                    }
                });

                if (!sHash) {
                    sap.m.MessageToast.show("Inbound AccountingDocument-manageV2 non trovato.");
                    return;
                }

                openAndClear(sHash);

            } catch (e) {
                console.error(e);
                sap.m.MessageBox.error("Errore nella navigazione verso l'app di storno.");
            }
        },


        onRowSelectionChange: function () {
            const oTable = this.byId("idTreeTable");
            const aSel = oTable.getSelectedIndices() || [];
            const oVM = this.getView().getModel("viewModel");

            const aRows = aSel
                .map(i => oTable.getContextByIndex(i))
                .filter(Boolean)
                .map(ctx => ctx.getObject() || {});

            const iCount = aRows.length;
            const oSingle = iCount === 1 ? aRows[0] : null;

            const bCanStorno = !!(oSingle && oSingle.StatoFattura === "3");

            const bCanBlocca = !!(oSingle && oSingle.StatoFattura && oSingle.StatoFattura !== "3");

            const bCanArchivia = iCount > 0 && aRows.every(r => r.Archiviato === true);

            const bCanOpenCreateApps = !!(oSingle && oSingle.StatoFattura === "1");

            const bCanAssegnaSocieta = iCount === 1 && !(oSingle.CompanyCode);

            oVM.setProperty("/ui/canStorno", bCanStorno);
            oVM.setProperty("/ui/canBlocca", bCanBlocca);
            oVM.setProperty("/ui/canArchivia", bCanArchivia);
            oVM.setProperty("/ui/canOpenCreateApps", bCanOpenCreateApps);
            oVM.setProperty("/ui/enableAssignCompany", bCanAssegnaSocieta);
        },


        onArchiviaFatturaButtonPress: async function () {

            const oTable = this.byId("idTreeTable");
            const aSelectedIndices = oTable.getSelectedIndices() || [];

            if (!aSelectedIndices.length) {
                sap.m.MessageToast.show("Seleziona almeno una fattura.");
                return;
            }

            const aContexts = aSelectedIndices.map(i => oTable.getContextByIndex(i)).filter(Boolean);
            const aRows = aContexts.map(ctx => ctx.getObject() || {});

            const oODataModel = this.getOwnerComponent().getModel("mainService");

            sap.ui.core.BusyIndicator.show(0);

            try {

                const aAlreadyArchivedIds = [];

                for (let i = 0; i < aRows.length; i++) {
                    const oServer = await this._readRicercaFatturaPassiva(oODataModel, aRows[i]);
                    if (!oServer) continue;

                    if (String(oServer.StatoFattura) === "4") {
                        aAlreadyArchivedIds.push(aRows[i].Id);
                    }
                }

                sap.ui.core.BusyIndicator.hide();

                if (aAlreadyArchivedIds.length) {

                    this._removeRowsByIds(aAlreadyArchivedIds);

                    oTable.clearSelection();
                    this.getView().getModel("viewModel").setProperty("/ui/canArchivia", false);

                    sap.m.MessageBox.warning(
                        "Una o più fatture risultano già archiviate da un altro utente e sono state rimosse dalla lista.",
                        { title: "Dati aggiornati" }
                    );

                    return;
                }

            } catch (e) {
                sap.ui.core.BusyIndicator.hide();
                sap.m.MessageBox.error("Errore durante la verifica archiviazione.");
                return;
            }

            sap.m.MessageBox.confirm(
                `Confermi l'archiviazione di ${aRows.length} fattura/e?`,
                {
                    actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
                    emphasizedAction: sap.m.MessageBox.Action.OK,
                    onClose: async (sAction) => {
                        if (sAction !== sap.m.MessageBox.Action.OK) return;

                        try {
                            await this._archiviaFattureMassive(aRows);
                            oTable.clearSelection();
                            this.getView().getModel("viewModel").setProperty("/ui/canArchivia", false);
                            sap.m.MessageToast.show("Archiviazione completata.");
                        } catch (e) {
                            sap.m.MessageBox.error("Errore durante l'archiviazione.");
                        }
                    }
                }
            );
        },


        _removeRowsByIds: function (aIds) {
            const oJson = this.getView().getModel("fattureModel");
            const aAll = oJson.getProperty("/results") || [];
            const aIdSet = new Set((aIds || []).filter(Boolean).map(String));

            const aNew = aAll.filter(r => !aIdSet.has(String(r.Id)));

            oJson.setProperty("/results", aNew);
            this._updateCounts(aNew);
            oJson.refresh(true);
        },

        _archiviaFattureMassive: async function (aRows) {

            const oODataModel = this.getOwnerComponent().getModel("mainService");
            sap.ui.core.BusyIndicator.show(0);

            try {

                await Promise.all(aRows.map(r => this._putArchivia(oODataModel, r.Id)));

                const aIds = aRows.map(r => r.Id);
                this._removeRowsByIds(aIds);

            } finally {
                sap.ui.core.BusyIndicator.hide();
            }
        },

        _putArchivia: function (oODataModel, sId) {
            const sPath = oODataModel.createKey("/ZC_EIM_FPXML", { ID: sId });

            const oPayload = {
                Archv: true
            };

            return new Promise((resolve, reject) => {
                oODataModel.update(sPath, oPayload, {
                    merge: true,
                    success: resolve,
                    error: reject
                });
            });
        },

        onAnnullaArchiviazioneButtonPress: function () {
            const oArchModel = new sap.ui.model.json.JSONModel({ results: [] });
            this.getView().setModel(oArchModel, "archModel");
            const oArchFilters = new sap.ui.model.json.JSONModel({
                CompanyCode: "",
                SupplierTokens: [],
                TipoDocAdeTokens: [],
                NumeroFattura: "",
                DataFatturaFrom: null,
                DataFatturaTo: null
            });
            this.getView().setModel(oArchFilters, "archFilters");
            sap.ui.core.Fragment.load({
                id: this.getView().getId(),
                name: "com.zeim.fatturazionepassiva.view.fragments.AnnullaArchiviazioneDialog",
                controller: this
            }).then(function (oDialog) {
                this._oAnnullaArchiviaDialog = oDialog;
                this.getView().addDependent(oDialog);

                oDialog.open();
                this._loadArchiviatiOnce();
            }.bind(this));
        },


        onClearArchiviati: function () {
            const oFB = this.byId("fbAnnullaArchiviazione");
            if (oFB) oFB.fireClear();

            const oModel = this.getView().getModel("archModel");
            if (oModel) oModel.setData({ results: [] }, true);

            const oTable = this.byId("archTable");
            if (oTable) oTable.clearSelection();
        },

        onUnarchiveSelected: function () {
            const oTable = this.byId("archTable");
            if (!oTable) return;

            const aSel = oTable.getSelectedIndices() || [];
            if (!aSel.length) {
                sap.m.MessageToast.show("Seleziona almeno una fattura.");
                return;
            }

            const oArchModel = this.getView().getModel("archModel");
            const aIds = aSel.map((i) => {
                const oCtx = oTable.getContextByIndex(i);
                const sPath = oCtx && oCtx.getPath();
                const oRow = sPath ? oArchModel.getProperty(sPath) : null;
                return oRow && oRow.Id;
            }).filter(Boolean);

            if (!aIds.length) {
                sap.m.MessageToast.show("ID mancanti sulle righe selezionate.");
                return;
            }

            sap.m.MessageBox.confirm(`Confermi l'annullamento archiviazione per ${aIds.length} fattura/e?`, {
                actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
                emphasizedAction: sap.m.MessageBox.Action.OK,
                onClose: function (sAction) {
                    if (sAction !== sap.m.MessageBox.Action.OK) return;

                    sap.ui.core.BusyIndicator.show(0);

                    this._unarchiveByIds(aIds).then((res) => {
                        const aOk = res.ok || [];
                        const aKo = res.ko || [];

                        const aAll = oArchModel.getProperty("/results") || [];
                        oArchModel.setProperty("/results", aAll.filter(r => !aOk.includes(r.Id)));
                        oArchModel.refresh(true);

                        oTable.clearSelection();

                        this._bindTable(true);

                        if (aKo.length) {
                            sap.m.MessageBox.warning(`Annullate ${aOk.length} fatture, ${aKo.length} in errore.`);
                        } else {
                            sap.m.MessageToast.show("Archiviazione annullata.");
                        }
                    }).catch(() => {
                        sap.m.MessageBox.error("Errore durante annullamento archiviazione.");
                    }).finally(() => {
                        sap.ui.core.BusyIndicator.hide();
                    });

                }.bind(this)
            });
        },


        _loadArchiviatiOnce: function () {
            const oODataModel = this.getOwnerComponent().getModel("mainService");
            const oArchModel = this.getView().getModel("archModel");
            if (!oODataModel || !oArchModel) return Promise.resolve();

            sap.ui.core.BusyIndicator.show(0);

            const aFilters = this._buildArchiviatiFilters();

            return new Promise((resolve, reject) => {
                oODataModel.read("/zeim_lista_fatture_archiviate", {
                    filters: aFilters,
                    urlParameters: { "$top": 5000, "$skip": 0 },
                    success: (oData) => {
                        oArchModel.setData({ results: (oData && oData.results) ? oData.results : [] }, true);
                        sap.ui.core.BusyIndicator.hide();
                        resolve();
                    },
                    error: () => {
                        sap.ui.core.BusyIndicator.hide();
                        reject();
                    }
                });
            });
        },




        _buildArchiviatiFilters: function () {
            const Filter = sap.ui.model.Filter;
            const FO = sap.ui.model.FilterOperator;
            const aFilters = [];

            const sCompany = this.byId("archSelectSocieta") && this.byId("archSelectSocieta").getSelectedKey();
            if (sCompany) aFilters.push(new Filter("CompanyCode", FO.EQ, sCompany));

            const aSuppliers = this._getTokenKeys("archMultiInputFornitore");
            if (aSuppliers.length === 1) {
                aFilters.push(new Filter("SupplierCode", FO.EQ, aSuppliers[0]));
            } else if (aSuppliers.length > 1) {
                aFilters.push(new Filter(aSuppliers.map(v => new Filter("SupplierCode", FO.EQ, v)), false));
            }

            const aTipoAde = this._getTokenKeys("archMultiInputTipoDocAdE");
            if (aTipoAde.length === 1) {
                aFilters.push(new Filter("TipoDocAdE", FO.EQ, aTipoAde[0]));
            } else if (aTipoAde.length > 1) {
                aFilters.push(new Filter(aTipoAde.map(v => new Filter("TipoDocAdE", FO.EQ, v)), false));
            }

            const sNumero = this.byId("archInputNumeroFattura") && this.byId("archInputNumeroFattura").getValue();
            if (sNumero) aFilters.push(new Filter("NumeroFattura", FO.Contains, sNumero));

            const oDRS = this.byId("archDrsDataFattura");
            if (oDRS) {
                const dFrom = oDRS.getDateValue();
                const dTo = oDRS.getSecondDateValue();
                if (dFrom && dTo) {
                    const d1 = new Date(dFrom.getTime()); d1.setHours(0, 0, 0, 0);
                    const d2 = new Date(dTo.getTime()); d2.setHours(23, 59, 59, 999);
                    aFilters.push(new Filter("DataFattura", FO.BT, d1, d2));
                }
            }

            return aFilters;
        },

        _getTokenKeys: function (sId) {
            const oMI = this.byId(sId);
            if (!oMI) return [];
            return (oMI.getTokens() || []).map(t => (t.getKey && t.getKey()) || t.getText()).filter(Boolean);
        },


        _unarchiveByIds: async function (aIds) {
            const oODataModel = this.getOwnerComponent().getModel("mainService");

            const runOne = (sId) => {
                const sPath = oODataModel.createKey("/ZC_EIM_FPXML", { ID: sId });
                return new Promise((resolve, reject) => {
                    oODataModel.update(sPath, { Archv: false }, {
                        merge: true,
                        success: () => resolve(sId),
                        error: (err) => reject({ id: sId, err })
                    });
                });
            };

            const aRes = await Promise.allSettled(aIds.map(runOne));
            const ok = aRes.filter(r => r.status === "fulfilled").map(r_1 => r_1.value);
            const ko = aRes.filter(r_2 => r_2.status === "rejected").map(r_3 => r_3.reason.id);
            if (ok.length === 0) throw new Error("ALL_FAILED");
            return { ok, ko };
        },



        onValueHelpFornitoreArch: function () {
            sap.ui.require(["com/zeim/fatturazionepassiva/controller/helpers/ValueHelpHandler"], function (VH) {

                VH.openValueHelp(
                    this,
                    "com.zeim.fatturazionepassiva.view.fragments.ValueHelpDialogFilterbarFornitore",
                    "Fornitore",
                    "/zeim_search_supplier_data",
                    {
                        vhId: "ARCH_FORN",
                        key: "Supplier",
                        desc: "SupplierName",
                        columns: [
                            { label: "Fornitore", path: "Supplier" },
                            { label: "Descrizione", path: "SupplierName" },
                            { label: "Country", path: "Country" }
                        ],
                        targetModelName: "archFilters",
                        tokensPath: "/SupplierTokens"
                    }
                );

            }.bind(this));
        },



        onValueHelpTipoDocAdeArch: function () {
            this.onValueHelpTipoDocAde();
        },

        onCloseAnnullaArchiviazione: function () {
            if (this._oAnnullaArchiviaDialog) {
                this._oAnnullaArchiviaDialog.close();
                this._oAnnullaArchiviaDialog.destroy();
                this._oAnnullaArchiviaDialog = null;
            }

            const oArchModel = this.getView().getModel("archModel");
            if (oArchModel) this.getView().setModel(null, "archModel");
        },

        onAssegnaSocietaButtonPress: async function () {

            const oTable = this.byId("idTreeTable");
            const aSel = oTable.getSelectedIndices() || [];

            if (aSel.length !== 1) {
                sap.m.MessageToast.show("Seleziona una sola fattura.");
                return;
            }

            const iIndex = aSel[0];
            const oCtx = oTable.getContextByIndex(iIndex);
            if (!oCtx) {
                sap.m.MessageToast.show("Impossibile determinare la riga selezionata.");
                return;
            }

            const oJson = this.getView().getModel("fattureModel");
            const sRowPath = oCtx.getPath();
            const oRow = oCtx.getObject() || {};

            if (!oRow.Id) {
                sap.m.MessageToast.show("ID mancante sulla riga selezionata.");
                return;
            }

            const oODataModel = this.getOwnerComponent().getModel("mainService");

            sap.ui.core.BusyIndicator.show(0);

            try {

                const oFresh = await this._readFPXMLById(oODataModel, oRow.Id);
                const sBukrsServer = (oFresh?.Bukrs || "").toString().trim();

                // 🔎 Controllo reale su Bukrs backend
                if (sBukrsServer) {

                    // Allineo la UI
                    oJson.setProperty(sRowPath + "/CompanyCode", sBukrsServer);
                    oJson.updateBindings(true);

                    sap.ui.core.BusyIndicator.hide();

                    sap.m.MessageBox.warning(
                        "La fattura risulta già assegnata ad una società da un altro utente.",
                        {
                            title: "Dati aggiornati",
                            onClose: function () {
                                oTable.clearSelection();
                                this.getView()
                                    .getModel("viewModel")
                                    .setProperty("/ui/enableAssignCompany", false);
                            }.bind(this)
                        }
                    );

                    return;
                }

                sap.ui.core.BusyIndicator.hide();

            } catch (e) {
                sap.ui.core.BusyIndicator.hide();
                sap.m.MessageBox.error("Errore durante la verifica della società.");
                return;
            }

            // Se arrivo qui, Bukrs è ancora vuoto → posso assegnare

            sap.ui.require(
                ["com/zeim/fatturazionepassiva/controller/helpers/ValueHelpHandler"],
                function (VH) {

                    VH.openValueHelp(
                        this,
                        "com.zeim.fatturazionepassiva.view.fragments.ValueHelpDialogFilterbarSocieta",
                        "mainService",
                        "/ZR_EIM_COMPANY",
                        {
                            key: "CompanyCode",
                            desc: "CompanyCodeName",
                            keyProp: "CompanyCode",
                            filterProps: ["CompanyCode", "CompanyCodeName"],
                            columns: [
                                { label: "Società", path: "CompanyCode" },
                                { label: "Descrizione", path: "CompanyCodeName" }
                            ],
                            onOk: async function (oSel) {

                                const sCompany = (oSel?.key || "").toString().trim();

                                if (!sCompany) {
                                    sap.m.MessageToast.show("Seleziona una società.");
                                    return;
                                }

                                await this._putAssegnaSocieta(oODataModel, oRow.Id, sCompany);

                                // Aggiorno la UI coerentemente
                                oJson.setProperty(sRowPath + "/CompanyCode", sCompany);
                                oJson.updateBindings(true);

                                oTable.clearSelection();
                                this.getView()
                                    .getModel("viewModel")
                                    .setProperty("/ui/enableAssignCompany", false);

                                sap.m.MessageToast.show("Società assegnata correttamente.");
                            }.bind(this)
                        }
                    );

                }.bind(this)
            );
        },

        _readRicercaFatturaPassiva: function (oODataModel, oRow) {
            const sCompanyCode = this._odataStr(oRow.CompanyCode);
            const sNumero = this._odataStr(oRow.NumeroFattura);
            const sTipoDocAdE = this._odataStr(oRow.TipoDocAdE);
            const sPartitaIVA = this._odataStr(oRow.PartitaIVA || oRow.PartitaIVAcee);
            const sCodFisc = this._odataStr(oRow.CodiceFiscale); // può essere ""

            const sDataLiteral = this._toODataDateTimeLiteral(oRow.DataFattura);
            if (!sCompanyCode || !sNumero || !sTipoDocAdE || !sPartitaIVA || !sDataLiteral) {
                return Promise.resolve(null);
            }

            const sPath =
                `/zeim_ricerca_fattura_passiva(` +
                `CompanyCode='${sCompanyCode}',` +
                `NumeroFattura='${sNumero}',` +
                `DataFattura=${sDataLiteral},` +
                `TipoDocAdE='${sTipoDocAdE}',` +
                `PartitaIVA='${sPartitaIVA}',` +
                `CodiceFiscale='${sCodFisc}'` +
                `)/Set`;

            return new Promise((resolve, reject) => {
                oODataModel.read(sPath, {
                    success: function (oData) {
                        resolve((oData && oData.results && oData.results[0]) || null);
                    },
                    error: reject
                });
            });
        },

        _odataStr: function (v) {
            return (v == null ? "" : String(v)).trim().replace(/'/g, "''");
        },

        _toODataDateTimeLiteral: function (v) {
            if (!v) return "";

            const oDate = (v instanceof Date) ? v : new Date(v);
            if (isNaN(oDate.getTime())) return "";

            const yyyy = oDate.getFullYear();
            const mm = String(oDate.getMonth() + 1).padStart(2, "0");
            const dd = String(oDate.getDate()).padStart(2, "0");

            // Nota: i ":" vanno encodati per evitare "Invalid URI segment" in batch
            return `datetime'${yyyy}-${mm}-${dd}T00%3A00%3A00'`;
        },


        _readFPXMLById: function (oODataModel, sId) {

            const sPath = oODataModel.createKey("/ZC_EIM_FPXML", { ID: sId });

            return new Promise((resolve, reject) => {
                oODataModel.read(sPath, {
                    success: function (oData) {
                        resolve(oData || {});
                    },
                    error: function (e) {
                        reject(e);
                    }
                });
            });
        },

        _putAssegnaSocieta: function (oODataModel, sId, sBukrs) {

            const sPath = oODataModel.createKey("/ZC_EIM_FPXML", { ID: sId });

            sap.ui.core.BusyIndicator.show(0);

            return new Promise((resolve, reject) => {
                oODataModel.update(
                    sPath,
                    { Bukrs: sBukrs },
                    {
                        merge: true,
                        success: function (oData) {
                            sap.ui.core.BusyIndicator.hide();
                            resolve(oData);
                        },
                        error: function (e) {
                            sap.ui.core.BusyIndicator.hide();
                            sap.m.MessageBox.error("Errore durante l'assegnazione della società.");
                            reject(e);
                        }
                    }
                );
            });
        }






    });
});
