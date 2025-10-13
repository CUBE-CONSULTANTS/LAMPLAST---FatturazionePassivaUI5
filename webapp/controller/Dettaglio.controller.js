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

            if (!oSelected || oSelected.docNumber !== sInvoiceId) {
                sap.m.MessageToast.show("La fattura selezionata non è valida.");
                this.oRouter.navTo("RouteHome");
                return;
            }

            this.getView().setModel(oModel);
            this.getView().bindElement({
                path: "/SelectedInvoice"
            });

            this._updateTotal();
        },

        _updateTotal: function () {
            const oModel = this.getView().getModel();
            const aItems = oModel.getProperty("/SelectedInvoice/items") || [];

            const fTotale = aItems.reduce((sum, item) => {
                const val = parseFloat(item.totalPrice?.toString().replace(",", ".")) || 0;
                return sum + val;
            }, 0);

            oModel.setProperty("/SelectedInvoice/totalSum", fTotale);
        },


        formatCurrency: function (v) {
            return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" })
                .format(Number(v) || 0);
        },


        onBackToHome: function () {
            const oModel = this.getOwnerComponent().getModel();

            oModel.setProperty("/SelectedInvoice", null);

            this.oRouter.navTo("RouteHome");
        }
    });
});
