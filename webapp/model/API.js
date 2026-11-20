
sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/Device", "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
],
    function (JSONModel, Device, Filter, FilterOperator) {
        "use strict";

        return {
            _getData: function ({ model, entity, filterArray = [], params = {} }) {

                console.log("entity", entity)
                return new Promise(
                    function (resolve, reject) {
                        model.read(entity, {
                            filters: filterArray,
                            urlParameters: params,
                            success: function (oDataIn, oResponse) {
                                console.log("Success [] -", JSON.stringify(oDataIn))
                                resolve(oDataIn);

                            },
                            error: function (error) {
                                console.log("Error [] -", JSON.stringify(error))
                                reject(error)
                            }

                        })
                    }
                )
            },


        };

    });