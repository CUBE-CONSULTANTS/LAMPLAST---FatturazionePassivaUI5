sap.ui.define([
    "./BaseController",
    "sap/m/MessageToast",
    "../model/API",
    "sap/ui/model/Filter",
    "../model/formatter",
    "../model/mockData",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/routing/History"
], function (BaseController, MessageToast, API, Filter, formatter, mockData, JSONModel, History) {
    "use strict";

    return BaseController.extend("com.zeim.fatturazionepassiva.controller.OrdineAcquistoDettaglio", {
        formatter: formatter,

        onInit: function () {
            this.oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            this.oRouter.getRoute("OrdineAcquistoDettaglio").attachPatternMatched(this._onObjectMatched, this);
        },

        _onObjectMatched: function (oEvent) {
            const { purchaseOrder } = oEvent.getParameter("arguments");
            const sPO = decodeURIComponent(purchaseOrder);

            const oData = mockData.getMockDataCreateInvoiceSap();
            const oOrdine = oData.purchaseOrders.find(x => x.purchaseOrder === sPO);

            if (!oOrdine) {
                MessageToast.show("Ordine d'acquisto " + sPO + " non trovato");
                return;
            }

            const oOrdineCopia = JSON.parse(JSON.stringify(oOrdine));
            this._arricchisciRighe(oOrdineCopia);

            this.getView().setModel(new JSONModel(oOrdineCopia), "ordine");

            this.getView().setModel(new JSONModel({
                companyCode: oData.request.invoice.companyCode
            }), "viewModel");
        },

        _getRigheXml: function () {
            const oModelloXml = this.getOwnerComponent().getModel("modello");
            return (oModelloXml &&
                oModelloXml.getProperty("/FatturaElettronicaBody/DatiBeniServizi/DettaglioLinee")) || [];
        },

        _arricchisciRighe: function (oOrdine) {
            const aXml = this._getRigheXml();

            oOrdine.items.forEach(function (oItem) {
                const oRigaXml = aXml.find(function (l) {
                    return String(l.NumeroLinea) === String(oItem.matchedXmlPosition);
                });

                if (oRigaXml) {
                    oItem.prezzoXml = parseFloat(oRigaXml.PrezzoUnitario);
                    oItem.deltaPrezzo = Math.round((oItem.prezzoXml - oItem.unitPrice) * 100) / 100;
                } else {
                    oItem.prezzoXml = null;
                    oItem.deltaPrezzo = null;
                }
            });
        },

        /**
         * "Seleziona questo ordine": avvisa la popup tramite EventBus e torna indietro.
         * La popup (o la pagina che la apre) deve sottoscrivere:
         *   getEventBus().subscribe("creaFatturaSap", "ordineSelezionato", handler)
         */
        onSelezionaOrdine: function () {
            const sPO = this.getView().getModel("ordine").getProperty("/purchaseOrder");
            this.getOwnerComponent().getEventBus().publish("creaFatturaSap", "ordineSelezionato", {
                purchaseOrder: sPO
            });
            this.onNavBack();
        },

        onNavBack: function () {
            const sPreviousHash = History.getInstance().getPreviousHash();
            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                MessageToast.show("Nessuna pagina precedente");
            }
        },

        onNavToFornitore: function () {
            MessageToast.show("Navigazione al fornitore da implementare");
        }

    });
});