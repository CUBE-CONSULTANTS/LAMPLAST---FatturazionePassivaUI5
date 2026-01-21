sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/codeeditor/CodeEditor",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/VBox"

], (Controller, JSONModel, Fragment, MessageBox, MessageToast, CodeEditor, Dialog, Button, VBox) => {
    "use strict";

    return Controller.extend("com.zeim.fatturazionepassiva.controller.Home", {

        onInit() {

            // ViewModel (flow + contatori)
            var oViewModel = new sap.ui.model.json.JSONModel({
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

        onBloccaFattura: function () {
            const oTable = this.byId("idTreeTable");
            const aSelectedIndices = oTable.getSelectedIndices();

            if (aSelectedIndices.length === 0) {
                sap.m.MessageToast.show("Seleziona una fattura da bloccare.");
                return;
            }
            if (aSelectedIndices.length > 1) {
                sap.m.MessageToast.show("Puoi bloccare una sola fattura alla volta.");
                return;
            }

            const iIndex = aSelectedIndices[0];
            const oJson = this.getView().getModel("fattureModel");

            this._sBloccaRowPath = `/results/${iIndex}`;

            const oRow = oJson.getProperty(this._sBloccaRowPath);
            if (!oRow || !oRow.Id) {
                sap.m.MessageToast.show("ID mancante sulla riga selezionata.");
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

        onSbloccaFattura: function () {
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

        //Aprire una dialog per popolare i dati di logistica della fattura
        onFatturaLogistica: function () {
            const oTable = this.byId("idTreeTable");
            const aSelectedIndices = oTable.getSelectedIndices();

            if (aSelectedIndices.length === 0) {
                sap.m.MessageToast.show("Seleziona una fattura.");
                return;
            }
            if (aSelectedIndices.length > 1) {
                sap.m.MessageToast.show("Puoi compilare i dati di logistica di una sola fattura alla volta.");
                return;
            }

            const iIndex = aSelectedIndices[0];
            const oJson = this.getView().getModel("fattureModel");

            const oRow = oJson.getProperty(`/results/${iIndex}`);
            if (!oRow || !oRow.Id) {
                sap.m.MessageToast.show("ID mancante sulla riga selezionata.");
                return;
            }

            this._openFatturaLogisticaDialog(oRow.Id);

        },

        _openFatturaLogisticaDialog: function (sId) {

            if (!this._oFatturaLogisticaDialog) {

                this._oFatturaLogisticaModel = new sap.ui.model.json.JSONModel({
                    GruppoCM: "",
                    DescrizioneGruppoCM: "",
                    Campo3: "",
                    Campo4: ""
                });

                this._oFatturaLogisticaDialog = new sap.m.Dialog({
                    title: "Dati Fattura Logistica",
                    contentWidth: "600px",
                    resizable: true,
                    draggable: true,
                    horizontalScrolling: false,
                    content: [
                        new sap.m.VBox({
                            width: "100%",
                            items: [
                                new sap.m.Label({ text: "Gruppo CM" }),
                                new sap.m.Input({
                                    width: "100%",
                                    value: "{logModel>/GruppoCM}"
                                }).addStyleClass("sapUiSmallMarginBottom"),

                                new sap.m.Label({ text: "Descrizione Gruppo CM" }),
                                new sap.m.Input({
                                    width: "100%",
                                    value: "{logModel>/DescrizioneGruppoCM}"
                                }).addStyleClass("sapUiSmallMarginBottom"),

                                new sap.m.Label({ text: "Campo 3" }),
                                new sap.m.Input({
                                    width: "100%",
                                    value: "{logModel>/Campo3}"
                                }).addStyleClass("sapUiSmallMarginBottom"),

                                new sap.m.Label({ text: "Campo 4" }),
                                new sap.m.Input({
                                    width: "100%",
                                    value: "{logModel>/Campo4}"
                                }).addStyleClass("sapUiSmallMarginBottom")
                            ]
                        })
                    ],
                    beginButton: new sap.m.Button({
                        text: "Salva",
                        type: "Emphasized",
                        press: () => {
                            const oPayload = this._oFatturaLogisticaModel.getData();


                            sap.m.MessageToast.show("Dati di logistica salvati con successo.");
                            this._oFatturaLogisticaDialog.close();
                        }
                    }),
                    endButton: new sap.m.Button({
                        text: "Chiudi",
                        type: "Emphasized",
                        press: () => this._oFatturaLogisticaDialog.close()
                    }),
                    afterClose: () => {


                        this._oFatturaLogisticaModel.setData({
                            GruppoCM: "",
                            DescrizioneGruppoCM: "",
                            Campo3: "",
                            Campo4: ""
                        }, true);


                        const oTable = this.byId("idTreeTable");
                        if (oTable) oTable.clearSelection();
                    }
                });

                this._oFatturaLogisticaDialog.addStyleClass("sapUiContentPadding");
                this._oFatturaLogisticaDialog.setModel(this._oFatturaLogisticaModel, "logModel");

                this.getView().addDependent(this._oFatturaLogisticaDialog);
            }

            //Chiamata per salvare...

            this._oFatturaLogisticaDialog.open();
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
                        semanticObject: "Customer",
                        action: "manage"
                    },
                    params: {
                        Customer: SupplierCode
                    }
                });

                const sEntityPath = `/C_BusinessPartnerCustomer(BusinessPartner='${SupplierCode}',DraftUUID=guid'00000000-0000-0000-0000-000000000000',IsActiveEntity=true)`;

                const sFullUrl = window.location.origin + "/ui" + sHash + "&sap-app-origin-hint=&" + sEntityPath;

                window.open(sFullUrl, "_blank");

            } catch (err) {
                console.error("Errore nella navigazione Cross-App:", err);
                sap.m.MessageBox.error("Impossibile aprire l'app Customer - Manage.");
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
                        action: "displayV2"
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

        onDocumentNumberLinkPress: async function (oEvent) {
            try {
                const oContext = oEvent.getSource().getBindingContext("fattureModel");
                if (!oContext) {
                    sap.m.MessageToast.show("Impossibile determinare la riga selezionata.");
                    return;
                }

                const oData = oContext.getObject();

                const belnr = oData.DocumentNumber;
                const gjahr = oData.FiscalYear;

                if (!belnr || !gjahr) {
                    sap.m.MessageToast.show("Dati mancanti: FinanceDocument o FiscalYear.");
                    return;
                }

                const oCrossAppNav = await sap.ushell.Container.getServiceAsync("CrossApplicationNavigation");

                const sHash = oCrossAppNav.hrefForExternal({
                    target: {
                        semanticObject: "SupplierInvoice",
                        action: "displayAdvanced"
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
                console.error("Errore nella navigazione Cross-App:", err);
                sap.m.MessageToast.show("Errore nella navigazione verso app standard.");
            }
        }



    });
});
