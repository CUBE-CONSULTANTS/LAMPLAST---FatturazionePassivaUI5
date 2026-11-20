sap.ui.define([
    "./BaseController",
    "sap/ui/core/Fragment",
    "sap/m/VariantItem",
    "../model/API",
    "../model/formatter",
    'sap/ui/model/Filter',

], (BaseController, Fragment, VariantItem, API, formatter, Filter) => {
    "use strict";

    return BaseController.extend("com.zeim.fatturazionepassiva.controller.Archiviate", {
        formatter: formatter,
        onInit() {
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("Archiviate").attachPatternMatched(this._onObjectMatched, this);
        },
        _onObjectMatched: function () {
            this.getView().setModel(new sap.ui.model.json.JSONModel({
                ui: {
                    canOpenCreateApps: false,
                    canBlocca: false,
                    canArchivia: false,
                    canSblocca: false,
                    canStorno: false,
                    enableAssignCompany: false
                }

            }), "viewModel");
            this.getView().setModel(new sap.ui.model.json.JSONModel(), "fattureModel")

            const filterArchiviato = [new sap.ui.model.Filter("Archiviato", "EQ", false)]
            this._bindTable(true, filterArchiviato)
        },

        _bindTable: async function (bReset = true, aFilters) {
            const oODataModel = this.getOwnerComponent().getModel("mainService");
            const oFattureModel = this.getView().getModel("fattureModel");

            if (Array.isArray(aFilters)) {
                this._currentFilters = aFilters;
            }
            const filterArray = this._currentFilters || [];
            const entity = "/zeim_lista_fatture_passive";
            try {
                sap.ui.core.BusyIndicator.show(0);
                const data = await API._getData({ model: oODataModel, entity, filterArray })
                //
                const aOld = oFattureModel.getProperty("/results") || [];
                const aNew = data.results || [];

                oFattureModel.setProperty("/results", aOld.concat(aNew));
                // this._pagination.skip += aNew.length;
                // this._pagination.hasMore = aNew.length === this._pagination.top;
                // this._pagination.isLoading = false;


                // if (this._pagination.hasMore) {
                //     setTimeout(() => this._bindTable(false), 50);
                // }
                //
            } catch (error) {
                // this._pagination.isLoading = false;
                // this._pagination.hasMore = false;
                sap.m.MessageToast.show("Errore nel caricamento fatture.");
            } finally {
                sap.ui.core.BusyIndicator.hide(0);
            }

        },
        onFilterBarSearch: function (oEvent) {
            const Filter = sap.ui.model.Filter;
            const FO = sap.ui.model.FilterOperator;
            const aFilters = [];

            oEvent.getSource().getFilterGroupItems().forEach(function (oItem) {
                const oControl = oItem.getControl();
                const sPath = oItem.getName();

                if (oControl.isA("sap.m.MultiInput")) {
                    // MultiInput prima di Input, perché lo estende
                    const aKeys = oControl.getTokens().map(t => t.getKey());
                    if (aKeys.length === 1) {
                        aFilters.push(new Filter(sPath, FO.EQ, aKeys[0]));
                    } else if (aKeys.length > 1) {
                        aFilters.push(new Filter(aKeys.map(v => new Filter(sPath, FO.EQ, v)), false));
                    }

                } else if (oControl.isA("sap.m.DateRangeSelection")) {
                    const dFrom = oControl.getDateValue();
                    const dTo = oControl.getSecondDateValue();
                    if (dFrom && dTo) {
                        const d1 = new Date(dFrom.getTime()); d1.setHours(0, 0, 0, 0);
                        const d2 = new Date(dTo.getTime()); d2.setHours(23, 59, 59, 999);
                        aFilters.push(new Filter(sPath, FO.BT, d1, d2));
                    }

                } else if (oControl.isA("sap.m.Select")) {
                    const sKey = oControl.getSelectedKey();
                    if (sKey) aFilters.push(new Filter(sPath, FO.EQ, sKey));

                } else if (oControl.isA("sap.m.Input")) {
                    let sValue = (oControl.getValue() || "").trim();
                    if (sValue) {
                        if (sPath === "SupplierName" || sPath === "NumeroFattura") {
                            sValue = sValue.toUpperCase();
                        }
                        aFilters.push(new Filter(sPath, FO.Contains, sValue));
                    }
                }
            });

            debugger
            // this._loadFatture(aFilters); 
        },

    });
});
