sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
], function (Controller, MessageToast) {
    "use strict";

    return Controller.extend("com.zeim.fatturazionepassiva.controller.Dettaglio", {

        onInit: function () {
            this.oRouter = sap.ui.core.UIComponent.getRouterFor(this);

            this.oRouter.getRoute("Dettaglio").attachPatternMatched(this._onObjectMatched, this);
        },

        _onObjectMatched: function (oEvent) {
            const sInvoiceId = oEvent.getParameter("arguments").invoiceId;
            const oModel = sap.ui.getCore().getModel("SelectedInvoiceModel");

            if (!oModel) {
                sap.m.MessageToast.show("Nessuna fattura selezionata, ritorno alla Home.");
                this.oRouter.navTo("RouteHome");
                return;
            }

            const oSelected = oModel.getProperty("/SelectedInvoice");

            if (!oSelected || oSelected.Id !== sInvoiceId) {
                sap.m.MessageToast.show("La fattura selezionata non è valida.");
                this.oRouter.navTo("RouteHome");
                return;
            }

            this.getView().setModel(oModel);
            this.getView().bindElement({ path: "/SelectedInvoice" });

            this._loadDettaglioFattura(oSelected.FileName);

            this._updateTotal();
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

            oODataModel.read(sPath, {
                success: (oData) => {
                    this._bindFatturaData(oData.Data);
                },
                error: () => {
                    MessageToast.show("Errore nel caricamento del dettaglio fattura");
                }
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

            if (oBeniServizi?.DettaglioLinee) {
                oBeniServizi.DettaglioLinee = Array.isArray(oBeniServizi.DettaglioLinee)
                    ? oBeniServizi.DettaglioLinee
                    : [oBeniServizi.DettaglioLinee];
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




        formatCurrency: function (v) {
            return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" })
                .format(Number(v) || 0);
        },


        formatter: {
            formatDate: function (sDate) {
                if (!sDate) return "";
                const oDate = new Date(sDate);
                const oFormat = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "dd/MM/yyyy" });
                return oFormat.format(oDate);
            }
        },

        onBackToHome: function () {
            const oModel = this.getOwnerComponent().getModel();

            oModel.setProperty("/SelectedInvoice", null);

            this.oRouter.navTo("RouteHome");
        },



        
    });
});
