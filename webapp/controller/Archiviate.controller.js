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
            this.getView().setModel(new sap.ui.model.json.JSONModel(), "fattureModel")
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("Archiviate").attachPatternMatched(this._onObjectMatched, this);

        },
        _onObjectMatched: function () {
            const filterArchiviato = [new sap.ui.model.Filter("Archiviato", "EQ", false)]
            this._loadFatture(true, filterArchiviato)
        },

        onFilterBarClear: function (oEvent) {
            const oFilterBar = oEvent.getSource();

            oFilterBar.getFilterGroupItems().forEach(function (oItem) {
                const oControl = oItem.getControl();

                if (oControl.isA("sap.m.MultiInput")) {
                    oControl.removeAllTokens();
                    oControl.setValue("");

                } else if (oControl.isA("sap.m.DateRangeSelection")) {
                    oControl.setDateValue(null);
                    oControl.setSecondDateValue(null);

                } else if (oControl.isA("sap.m.Select")) {
                    oControl.setSelectedKey("");

                } else if (oControl.isA("sap.m.Input")) {
                    oControl.setValue("");
                }
            });

            const oTable = this.byId("idTreeTable");
            if (oTable) {
                oTable.clearSelection();
            }
            this._onObjectMatched()
        },
        _loadFatture: async function (bReset = true, aFilters) {
            const oODataModel = this.getOwnerComponent().getModel("mainService");
            const oFattureModel = this.getView().getModel("fattureModel");

            if (Array.isArray(aFilters)) {
                this._currentFilters = aFilters;
            }

            const filterArray = this._currentFilters || [];
            const entity = "/zeim_lista_fatture_passive";

            // Nuova ricerca: svuoto i risultati precedenti
            if (bReset) {
                oFattureModel.setData({ results: [] });
            }

            try {
                sap.ui.core.BusyIndicator.show(0);

                const data = await API._getData({
                    model: oODataModel,
                    entity,
                    filterArray
                });

                const aOld = oFattureModel.getProperty("/results") || [];
                const aNew = data.results || [];

                if (bReset) {
                    // Sostituisco completamente i dati
                    oFattureModel.setProperty("/results", aNew);
                } else {
                    // Aggiungo i nuovi dati
                    oFattureModel.setProperty("/results", aOld.concat(aNew));
                }

                oFattureModel.refresh(true);

            } catch (error) {
                console.error("Errore caricamento fatture:", error);
                sap.m.MessageToast.show("Errore nel caricamento fatture.");
            } finally {
                sap.ui.core.BusyIndicator.hide();
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
                    const sManualValue = oControl.getValue();
                    if (sManualValue && sManualValue.trim()) {
                        aKeys.push(sManualValue.trim());
                    }
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

            const oTable = this.byId("idTreeTable");
            if (oTable) oTable.clearSelection();
            this._loadFatture(true, aFilters);
        },

    });
});
