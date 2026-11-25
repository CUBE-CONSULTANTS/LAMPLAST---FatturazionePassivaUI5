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
            this._handleRoute(oEvent)
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

    });
});