sap.ui.define([
    "./BaseController",
    "sap/m/MessageToast",
    "../model/API",
    'sap/ui/model/Filter',
    "../model/formatter"

], function (BaseController, MessageToast, API, Filter, formatter) {
    "use strict";

    return BaseController.extend("com.zeim.fatturazionepassiva.controller.Dettaglio", {
        formatter: formatter,
        onInit: function () {
            this.oRouter = sap.ui.core.UIComponent.getRouterFor(this);

            const oVM = new sap.ui.model.json.JSONModel({
                ui: { mode: "edit" } // default
            });
            this.getView().setModel(oVM, "viewModel");

            this.oRouter.getRoute("Dettaglio").attachPatternMatched(this._onObjectMatchedEdit, this);
            this.oRouter.getRoute("DettaglioDisplay").attachPatternMatched(this._onObjectMatchedDisplay, this);
        },

        _onObjectMatchedEdit: function (oEvent) {
            this.getView().getModel("viewModel").setProperty("/ui/mode", "edit");
            this.getView().getModel("viewModel").setProperty("/showSupplierInfo", true);

            this._handleRoute(oEvent);
        },

        _onObjectMatchedDisplay: function (oEvent) {
            this.getView().getModel("viewModel").setProperty("/ui/mode", "display");
            this.getView().getModel("viewModel").setProperty("/showSupplierInfo", false);
            this._handleRoute(oEvent);
        },

        _handleRoute: async function (oEvent) {
            const { invoiceId: sInvoiceId, supplierCode = '' } = oEvent.getParameter("arguments");
            const model = this.getOwnerComponent().getModel("mainService");
            let supplier = {}
            try {
                sap.ui.core.BusyIndicator.show(0);
                var entity = "/zeim_lista_fatture_passive";
                let filterArray = [
                    new Filter("Id", "EQ", sInvoiceId),
                ]

                const data = await API._getData({
                    model, entity, filterArray
                })
                const row = data?.results?.[0];

                if (supplierCode) {
                    const { PartitaIVAcee = "", CodiceFiscale = "", CompanyCode = "" } = row || {}
                    const entity = `/zeim_get_supplier_codeSet(CompanyCode='${CompanyCode}',PartitaIVA='${PartitaIVAcee}',CodiceFiscale='${CodiceFiscale}',SupplierCode='${supplierCode}')`;
                    supplier = await API._getData({
                        model, entity
                    })
                    row.SelectedSupplierCode = supplier.SupplierCode;
                    row.SupplierName = supplier.SupplierName;

                }

                this.getView().setModel(new sap.ui.model.json.JSONModel({ SelectedInvoice: data?.results?.[0], SupplierInfo: supplier }));
                this.getView().bindElement({ path: "/SelectedInvoice" });


                await this._loadDettaglioFattura(sInvoiceId);
                this._updateTotal();
            } catch (e) {
            } finally {
                sap.ui.core.BusyIndicator.hide(0);
            }

        },

        _loadDettaglioFattura: function (sFileName) {
            if (!sFileName) {
                MessageToast.show("FileName fattura mancante");
                return;
            }

            const oODataModel = this.getOwnerComponent().getModel("mainService");

            const sPath = oODataModel.createKey("/ZEIM_DettaglioFattura", {
                FileName: sFileName
            });

            return new Promise((resolve, reject) => {
                oODataModel.read(sPath, {
                    success: (oData) => {
                        this._bindFatturaData(oData.Data);
                        resolve(oData);
                    },
                    error: (oError) => {
                        MessageToast.show("Errore nel caricamento del dettaglio fattura");
                        reject(oError);
                    }
                });
            });
        },

        _bindFatturaData: function (sData) {
            let oFattura;

            try {
                oFattura = JSON.parse(sData);
            } catch (e) {
                MessageToast.show("Formato fattura non valido");
                return;
            }

            // === NORMALIZZAZIONE DETTAGLIO LINEE ===
            const oBody = oFattura.FatturaElettronicaBody;
            const oBeniServizi = oBody?.DatiBeniServizi;

            const ddt = !oBody?.DatiGenerali?.DatiDDT ? [] : Array.isArray(oBody?.DatiGenerali?.DatiDDT) ? oBody?.DatiGenerali?.DatiDDT : [oBody?.DatiGenerali?.DatiDDT]
            const toArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
            const DdtInfo = toArray(ddt).flatMap((ddt) => {
                const rif = toArray(ddt.RiferimentoNumeroLinea);

                // caso: numero linea assente -> un solo oggetto, senza riferimento
                if (rif.length === 0) {
                    return [{ ...ddt, RiferimentoNumeroLinea: null }];
                }

                // caso: 1 o più numeri linea -> un oggetto per ciascuno
                return rif.map((n) => ({ ...ddt, RiferimentoNumeroLinea: Number(n) }));
            });

            if (oBeniServizi?.DettaglioLinee) {
                oBeniServizi.DettaglioLinee = Array.isArray(oBeniServizi.DettaglioLinee)
                    ? oBeniServizi.DettaglioLinee
                    : [oBeniServizi.DettaglioLinee];

                oBeniServizi?.DettaglioLinee.forEach(x => {
                    x['OdaSap'] = ''
                    if (DdtInfo.length == 1 && !DdtInfo[0].hasOwnProperty("RiferimentoNumeroLinea")) {
                        x['NumeroDDT'] = DdtInfo[0].NumeroDDT
                        x['DataDDT'] = DdtInfo[0].DataDDT
                    } else {
                        const ddtForLine = DdtInfo.find(y => y.RiferimentoNumeroLinea == x.NumeroLinea)
                        x['NumeroDDT'] = ddtForLine?.NumeroDDT || ''
                        x['DataDDT'] = ddtForLine?.DataDDT || ''
                    }
                })

            }

            this._mapOrdineAcquisto(oFattura);
            const oJsonModel = new sap.ui.model.json.JSONModel(oFattura);
            this.getView().setModel(oJsonModel, "fattura");
            console.log('Modello:', oJsonModel);
        },

        _mapOrdineAcquisto: function (oFattura) {
            const oBody = oFattura?.FatturaElettronicaBody;
            if (!oBody) return;

            const oGenerali = oBody.DatiGenerali;
            const oBeni = oBody.DatiBeniServizi;

            if (!oGenerali?.DatiOrdineAcquisto || !oBeni?.DettaglioLinee) return;

            const aLinee = Array.isArray(oBeni.DettaglioLinee)
                ? oBeni.DettaglioLinee
                : [oBeni.DettaglioLinee];

            const aOrdini = Array.isArray(oGenerali.DatiOrdineAcquisto)
                ? oGenerali.DatiOrdineAcquisto
                : [oGenerali.DatiOrdineAcquisto];

            // Caso 1: per numero linea
            if (aOrdini[0].RiferimentoNumeroLinea) {
                aLinee.forEach(l => {
                    const oMatch = aOrdini.find(o =>
                        String(o.RiferimentoNumeroLinea) === String(l.NumeroLinea)
                    );

                    if (oMatch) {
                        l.odaIdDocumento = oMatch.IdDocumento || "";
                        l.odaDataDoc = oMatch.Data || "";
                    }
                });
                return;
            }

            // Caso 2: globale
            const o = aOrdini[0];
            aLinee.forEach(l => {
                l.odaIdDocumento = o.IdDocumento || "";
                l.odaDataDoc = o.Data || "";
                l.odaPosOda = o.NumItem || "";
            });
        },


        _updateTotal: function () {
            const oModel = this.getView().getModel();
            const oInvoice = oModel.getProperty("/SelectedInvoice") || {};

            const aItems = this._getInvoiceLines(oInvoice);

            const fTotale = aItems.length
                ? aItems.reduce((sum, item) => {
                    const val = parseFloat((item?.Totale ?? "0").toString().replace(",", ".")) || 0;
                    return sum + val;
                }, 0)
                : (parseFloat((oInvoice?.Totale ?? "0").toString().replace(",", ".")) || 0);

            oModel.setProperty("/SelectedInvoice/totalSum", fTotale);
        },

        _getInvoiceLines: function (oInvoice) {
            const v =
                oInvoice.items ||
                oInvoice.Items ||
                oInvoice.DettaglioLinee ||
                oInvoice.Lines ||
                oInvoice.Righe;

            if (!v) return [];
            return Array.isArray(v) ? v : [v];
        },

        onBackToHome: function () {

            sap.ui.getCore().getEventBus().publish("fatture", "clearSelection");

            const oHistory = sap.ui.core.routing.History.getInstance();
            const sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                this.oRouter.navTo("RouteHome", {}, true);
            }
        },
        navToOrdineAcquisto: async function (oEvent) {
            const objSelected = oEvent.getSource().getBindingContext().getObject()
            const infoFattura = this.getView().getModel("fattura").getData()
            const Supplier = infoFattura?.FatturaElettronicaHeader?.CedentePrestatore?.DatiAnagrafici?.IdFiscaleIVA?.IdCodice || ''
            const CompanyCode = infoFattura?.FatturaElettronicaHeader?.CessionarioCommittente?.DatiAnagrafici?.IdFiscaleIVA?.IdCodice || ''
            const PO = infoFattura?.FatturaElettronicaBody?.DatiGenerali?.DatiOrdineAcquisto?.IdDocumento || ''


            const oCrossAppNav = await sap.ushell.Container.getServiceAsync("CrossApplicationNavigation");

            const sHash = oCrossAppNav.hrefForExternal({
                target: {
                    semanticObject: "PurchaseOrder",
                    action: "manage"
                },
                params: {
                    Supplier,
                    CompanyCode,

                }

            });
            const sEntityPath =
                `/C_PurchaseOrderTP(PurchaseOrder='${PO}',DraftUUID=guid'00000000-0000-0000-0000-000000000000',IsActiveEntity=true)`;

            const sFullUrl = window.location.origin + "/ui" + sHash + "&sap-app-origin-hint=&" + sEntityPath;
            window.open(sFullUrl, "_blank");
        },
        onOpenDialogAssignSAPDocument: async function (oEvent) {
            const objSelectedFattura = oEvent.getSource().getBindingContext("fattura").getObject()
            const objSelected = oEvent.getSource().getBindingContext().getObject()
            if (!this._assegnaDocumentiSAP) {
                this._assegnaDocumentiSAP = await this.loadFragment({
                    name: "com.zeim.fatturazionepassiva.view.fragments.dialogAssegnaDocumentiSAP"
                });
                this.getView().addDependent(this._assegnaDocumentiSAP);
            }
            this.getView().setModel(new sap.ui.model.json.JSONModel({
                objSelectedFattura,
                objSelected,
                info: []
            }), "assignSAPDocument")
            this._assegnaDocumentiSAP.open();

        },
        onCloseUploadDialog: function () {
            this._assegnaDocumentiSAP.close();
        },
        onCreaFatturaDaSAP: async function (oEvent) {
            if (!this._creaFattura) {
                this._creaFattura = await this.loadFragment({
                    name: "com.zeim.fatturazionepassiva.view.fragments.dialogCreaFattura"
                });
                this.getView().addDependent(this._creaFattura);
            }
            this.getView().setModel(new sap.ui.model.json.JSONModel({
                info: []
            }), "createInvoice")
            this._creaFattura.open();

        }
    });
});
