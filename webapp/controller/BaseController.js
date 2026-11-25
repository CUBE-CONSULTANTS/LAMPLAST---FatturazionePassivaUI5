sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/export/Spreadsheet",
    "sap/ui/model/json/JSONModel",
    "sap/ui/codeeditor/CodeEditor",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/VBox",
    "sap/m/p13n/MetadataHelper",
    "sap/m/p13n/Engine",
    "sap/m/p13n/SelectionController",


], function (
    Controller,
    Spreadsheet,
    JSONModel,
    CodeEditor,
    Dialog, Button, VBox, MetadataHelper, Engine, SelectionController,
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
                oRouter.navTo("Dettaglio", { invoiceId: String(oSelected.Id), supplierCode: oSelected?.SelectedSupplierCode });
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
        // gestione allegati comune sia per archiviate che per fatturazione passiva
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
                this._oAllegatiModel = new sap.ui.model.json.JSONModel({ items: [] });

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

        //gestione xml
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
        //gestione visualizzazione fattura
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


        //gestione documento contabile



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
        //documento contabile
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

        //TEST P13N
        _registerForP13n: function (oTable) {

            if (!oTable) {
                console.error("Tabella fattureArchiviate non trovata")
                return
            }

            const aMetadata = []
            this._mInitialWidth = {}

            oTable.getColumns().forEach((oColumn) => {
                const sKey = this._getCustomDataValue(oColumn, "p13nKey")
                if (!sKey) return
                const sPath = this._getCustomDataValue(oColumn, "p13nPath")
                const oHeader = oColumn.getLabel()
                const sLabel = oHeader && oHeader.getText ? oHeader.getText() : sKey

                aMetadata.push({
                    key: sKey,
                    label: sLabel,
                    path: sPath
                })
                this._mInitialWidth[sKey] = oColumn.getWidth() || "11rem"
            })

            this.oMetadataHelper = new MetadataHelper(aMetadata)

            Engine.getInstance().register(oTable, {
                helper: this.oMetadataHelper,
                controller: {
                    Columns: new SelectionController({
                        targetAggregation: "columns",
                        control: oTable
                    })
                }
            })

            Engine.getInstance().attachStateChange(this.handleStateChange, this)
        },
        _getCustomDataValue: function (oControl, sKey) {
            const oData = oControl.getCustomData().find(
                (oItem) => oItem.getKey() === sKey
            )
            return oData ? oData.getValue() : undefined
        },
        openPersoDialog: function (oEvent) {
            const oTable = oEvent.getSource().getParent().getParent()
            if (!oTable) return

            Engine.getInstance().show(
                oTable,
                ["Columns"],
                {
                    contentHeight: "35rem",
                    contentWidth: "32rem",
                    source: oEvent.getSource()
                }
            )
        },
        handleStateChange: function (oEvent) {
            const oTable = oEvent.getParameter("control")
            const oState = oEvent.getParameter("state")
            if (!oState || !oState.Columns) return

            this._applyP13nColumnsState(oState.Columns, oTable)
        },

        _applyP13nColumnsState: function (aStateColumns, oTable) {
            if (!oTable) return

            const aCurrentColumns = oTable.getColumns().slice()
            const aVisibleKeys = aStateColumns.map((o) => o.key)

            aCurrentColumns.forEach((oColumn) => {
                const sKey = this._getCustomDataValue(oColumn, "p13nKey")
                if (sKey) {
                    oColumn.setVisible(aVisibleKeys.includes(sKey))
                }
            })

            const aOrderedColumns = []
            aStateColumns.forEach((oStateColumn) => {
                const oColumn = aCurrentColumns.find(
                    (oCol) =>
                        this._getCustomDataValue(oCol, "p13nKey") === oStateColumn.key
                )
                if (oColumn && !aOrderedColumns.includes(oColumn)) {
                    aOrderedColumns.push(oColumn)
                }
            })

            aCurrentColumns.forEach((oColumn) => {
                if (!aOrderedColumns.includes(oColumn)) {
                    aOrderedColumns.push(oColumn)
                }
            })

            this._reorderTableColumns(aOrderedColumns, oTable)
        },

        // Prime 3 colonne fisse
        _reorderTableColumns: function (aOrderedP13nColumns, oTable) {

            const aCurrentColumns = oTable.getColumns()

            const aFixedColumns = aCurrentColumns.slice(0, 3)
            const aReorderableColumns = aCurrentColumns.slice(3)

            const aNewColumns = [
                ...aFixedColumns,
                ...aOrderedP13nColumns.filter(function (oColumn) {
                    return aReorderableColumns.includes(oColumn)
                }),
                ...aReorderableColumns.filter(function (oColumn) {
                    return !aOrderedP13nColumns.includes(oColumn)
                })
            ]

            aNewColumns.forEach(function (oColumn, iIndex) {
                oTable.removeColumn(oColumn)
                oTable.insertColumn(oColumn, iIndex)
            })
        },

        _getCurrentTableLayout: function (oTable) {
            // const oTable = this.byId("fattureArchiviate")
            return {
                columns: oTable.getColumns().map((oColumn, iIndex) => ({
                    key: this._getColumnKey(oColumn),
                    visible: oColumn.getVisible(),
                    order: iIndex
                }))
            }
        },
        _applyTableLayout: function (oLayout, oTable) {
            if (!oTable || !oLayout || !oLayout.columns) return

            const aSavedColumns = oLayout.columns.map((oSaved) => ({
                ...oSaved,
                key: oSaved.key || "__column_" + oSaved.order
            }))

            const aCurrentColumns = oTable.getColumns().slice()
            const mColumns = {}
            aCurrentColumns.forEach((oColumn) => {
                mColumns[this._getColumnKey(oColumn)] = oColumn
            })

            oLayout.columns.forEach((oSaved) => {
                const oColumn = mColumns[oSaved.key]
                if (oColumn) oColumn.setVisible(!!oSaved.visible)
            })
            aSavedColumns.forEach((oSaved) => {
                const oColumn = mColumns[oSaved.key]
                if (oColumn) oColumn.setVisible(!!oSaved.visible)
            })

            const aOrdered = oLayout.columns
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((oSaved) => mColumns[oSaved.key])
                .filter(Boolean)

            aCurrentColumns.forEach((oColumn) => {
                if (!aOrdered.includes(oColumn)) aOrdered.push(oColumn)
            })

            aOrdered.forEach((oColumn, iIndex) => {
                oTable.removeColumn(oColumn)
                oTable.insertColumn(oColumn, iIndex)
            })

            oTable.invalidate()
        },

        _resetToStandardTableLayout: function () {

            const oTable = this.byId("fattureArchiviate")
            if (!oTable) return

            const aColumnsToRestore =
                this._aInitialColumnOrder || oTable.getColumns().slice()

            oTable.removeAllColumns()
            aColumnsToRestore.forEach((oColumn) => {
                const sKey = this._getCustomDataValue(oColumn, "p13nKey")
                if (sKey) {
                    oColumn.setVisible(true)
                }
                oTable.addColumn(oColumn)
            })
        },
        _getColumnKey: function (oColumn) {
            const sKey = this._getCustomDataValue(oColumn, "p13nKey")
            if (sKey) return sKey
            const aInitial = this._aInitialColumnOrder || oColumn.getParent().getColumns()
            return "__column_" + aInitial.indexOf(oColumn)
        },
    });
});