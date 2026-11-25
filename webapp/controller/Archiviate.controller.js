sap.ui.define([
    "./BaseController",
    "sap/m/VariantItem",
    "../model/API",
    "../model/formatter",
    "sap/m/p13n/MetadataHelper",
    "sap/m/p13n/Engine",
    "sap/m/p13n/SelectionController",
], (
    BaseController, VariantItem, API, formatter, MetadataHelper, Engine, SelectionController,
) => {
    "use strict"

    return BaseController.extend(
        "com.zeim.fatturazionepassiva.controller.Archiviate",
        {
            formatter: formatter,

            onInit: function () {
                this.getView().setModel(
                    new sap.ui.model.json.JSONModel(),
                    "fattureModel"
                )
                const oTable = this.byId("fattureArchiviate")
                if (oTable) {
                    this._aInitialColumnOrder = oTable.getColumns().slice()
                }

                this._registerForP13n(this.byId("fattureArchiviate"))


                const oRouter = this.getOwnerComponent().getRouter()
                oRouter
                    .getRoute("Archiviate")
                    .attachPatternMatched(this._onObjectMatched, this)
            },

            _onObjectMatched: async function () {
                this._initVariantManagement()
                await this._loadFatture(true)

                const oVM = this._getVariantManagementControl()
                const oData = this._getVariantData()
                const oTable = this.byId("fattureArchiviate")
                const sKey = oData.defaultVariantKey || oData.lastSelectedKey

                if (sKey && oData.variants[sKey]) {
                    oVM.setSelectedKey(sKey)
                    this._applyTableLayout(oData.variants[sKey].layout, oTable)
                } else {
                    this._resetToStandardTableLayout()
                }
            },
            _getVariantManagementControl: function () {
                return this.byId("idVariantManagement")
            },

            _initVariantManagement: function () {
                const oVM = this._getVariantManagementControl()
                if (!oVM) {
                    console.warn("sap.m.VariantManagement non trovato")
                    return
                }

                const oData = this._getVariantData()
                // const sStandardKey = oVM.getStandardVariantKey()

                oVM.removeAllItems()

                Object.keys(oData.variants || {}).forEach((sKey) => {
                    const oVariant = oData.variants[sKey]
                    oVM.addItem(
                        new VariantItem({
                            key: sKey,
                            title: oVariant.name,
                            remove: true,
                            rename: true,
                            changeable: true
                        })
                    )
                })

                const sSelected =
                    (oData.defaultVariantKey && oData.variants[oData.defaultVariantKey] && oData.defaultVariantKey) ||
                    (oData.lastSelectedKey && oData.variants[oData.lastSelectedKey] && oData.lastSelectedKey) ||
                    ""

                if (oData.defaultVariantKey && oData.variants[oData.defaultVariantKey]) {
                    oVM.setDefaultKey(oData.defaultVariantKey)
                }
                if (sSelected) {
                    oVM.setSelectedKey(sSelected)
                }
            },

            onVariantSave: function (oEvent) {
                const oVM = oEvent.getSource()
                const oData = this._getVariantData()
                const sName = oEvent.getParameter("name")
                let sKey = oEvent.getParameter("key")
                const bOverwrite = oEvent.getParameter("overwrite")
                const bDefault = oEvent.getParameter("def")
                // const sStandardKey = oVM.getStandardVariantKey()

                if (!sName) return

                if (!sKey && bOverwrite) {
                    sKey = Object.keys(oData.variants).find(
                        (sExistingKey) => oData.variants[sExistingKey].name === sName
                    )
                }

                if (!sKey) {
                    sKey =
                        "VARIANT_" +
                        Date.now() +
                        "_" +
                        Math.floor(Math.random() * 10000)
                }

                oData.variants[sKey] = {
                    key: sKey,
                    name: sName,
                    layout: this._getCurrentTableLayout(this.byId("fattureArchiviate"))
                }

                if (bDefault) {
                    oData.defaultVariantKey = sKey
                }
                oData.lastSelectedKey = sKey
                this._setVariantData(oData)

                const oExistingItem = oVM
                    .getItems()
                    .find((oItem) => oItem.getKey() === sKey)

                if (oExistingItem) {
                    oExistingItem.setTitle(sName)
                } else {
                    oVM.addItem(
                        new VariantItem({
                            key: sKey,
                            title: sName,
                            remove: true,
                            rename: true,
                            changeable: true
                        })
                    )
                }

                oVM.setSelectedKey(sKey)
                if (oData.defaultVariantKey) {
                    oVM.setDefaultKey(oData.defaultVariantKey)
                }

                sap.m.MessageToast.show("Layout salvato.")
            },

            onVariantSelect: function (oEvent) {
                const sKey = oEvent.getParameter("key")
                const oData = this._getVariantData()
                const oVariant = oData.variants[sKey]

                if (!sKey || !oVariant || !oVariant.layout) {
                    oData.lastSelectedKey = ""
                    this._setVariantData(oData)
                    this._resetToStandardTableLayout()
                    return
                }

                oData.lastSelectedKey = sKey
                this._setVariantData(oData)
                this._applyTableLayout(oVariant.layout, this.byId("fattureArchiviate"))
            },

            onVariantManage: function (oEvent) {
                const oVM = oEvent.getSource()
                const oData = this._getVariantData()
                // const sStandardKey = oVM.getStandardVariantKey()

                const aDeleted = oEvent.getParameter("deleted") || []
                const aRenamed = oEvent.getParameter("renamed") || []
                const sDefaultKey = oEvent.getParameter("def")

                aDeleted.forEach((sKey) => {
                    delete oData.variants[sKey]
                    if (oData.defaultVariantKey === sKey) {
                        oData.defaultVariantKey = ""
                    }
                    if (oData.lastSelectedKey === sKey) {
                        oData.lastSelectedKey = ""
                    }
                })

                aRenamed.forEach((oRenamed) => {
                    if (
                        typeof oRenamed === "object" &&
                        oRenamed.key &&
                        oData.variants[oRenamed.key]
                    ) {
                        oData.variants[oRenamed.key].name = oRenamed.name
                    }
                })

                if (sDefaultKey === false) {
                    oData.defaultVariantKey = ""
                } else if (
                    typeof sDefaultKey === "string" &&
                    oData.variants[sDefaultKey]
                ) {
                    oData.defaultVariantKey = sDefaultKey
                }

                this._setVariantData(oData)
                this._initVariantManagement()

                sap.m.MessageToast.show("Gestione layout aggiornata.")
            },

            //localestorage
            _getVariantStorageKey: function () {
                return "ZEIM_FATTURAZIONE_PASSIVA_ARCH_VARIANTS"
            },

            _getVariantData: function () {
                const sStorageKey = this._getVariantStorageKey()
                try {
                    const sValue = localStorage.getItem(sStorageKey)
                    if (!sValue) {
                        return {
                            variants: {},
                            defaultVariantKey: ""

                        }
                    }
                    const oData = JSON.parse(sValue)
                    return {
                        variants: oData.variants || {},
                        defaultVariantKey: oData.defaultVariantKey || "",
                        lastSelectedKey: oData.lastSelectedKey || ""
                    }
                } catch (error) {
                    console.error("Errore lettura varianti:", error)
                    return {
                        variants: {},
                        defaultVariantKey: ""
                    }
                }
            },

            _setVariantData: function (oData) {
                try {
                    localStorage.setItem(
                        this._getVariantStorageKey(),
                        JSON.stringify(oData)
                    )
                } catch (error) {
                    console.error("Errore salvataggio varianti:", error)
                    sap.m.MessageToast.show("Impossibile salvare il layout.")
                }
            },

            //filtri
            onFilterBarClear: function (oEvent) {
                const oFilterBar = oEvent.getSource()

                oFilterBar.getFilterGroupItems().forEach(function (oItem) {
                    const oControl = oItem.getControl()

                    if (oControl.isA("sap.m.MultiInput")) {
                        oControl.removeAllTokens()
                        oControl.setValue("")
                    } else if (oControl.isA("sap.m.DateRangeSelection")) {
                        oControl.setDateValue(null)
                        oControl.setSecondDateValue(null)
                    } else if (oControl.isA("sap.m.Select")) {
                        oControl.setSelectedKey("")
                    } else if (oControl.isA("sap.m.Input")) {
                        oControl.setValue("")
                    }
                })

                const oTable = this.byId("fattureArchiviate")
                if (oTable) {
                    oTable.clearSelection()
                }

                this._loadFatture(true, [])
            },

            _loadFatture: async function (bReset = true, aFilters = []) {
                const oODataModel = this.getOwnerComponent().getModel("mainService")
                const oFattureModel = this.getView().getModel("fattureModel")

                if (Array.isArray(aFilters)) {
                    this._currentFilters = aFilters
                }

                const aCurrentFilters = this._currentFilters || []
                const sEntity = "/zeim_lista_fatture_archiviate" //"/zeim_lista_fatture_passive"

                if (bReset) {
                    oFattureModel.setData({ results: [] })
                }

                try {
                    sap.ui.core.BusyIndicator.show(0)

                    const oData = await API._getData({
                        model: oODataModel,
                        entity: sEntity,
                        filterArray: aCurrentFilters
                    })
                    const aOld = oFattureModel.getProperty("/results") || []
                    const aNew = oData.results || []

                    if (bReset) {
                        oFattureModel.setProperty("/results", aNew)
                    } else {
                        oFattureModel.setProperty("/results", aOld.concat(aNew))
                    }

                    oFattureModel.refresh(true)
                } catch (error) {
                    console.error("Errore caricamento fatture:", error)
                    sap.m.MessageToast.show("Errore nel caricamento fatture.")
                } finally {
                    sap.ui.core.BusyIndicator.hide()
                }
            },

            onFilterBarSearch: function (oEvent) {
                const Filter = sap.ui.model.Filter
                const FO = sap.ui.model.FilterOperator
                const aFilters = []

                oEvent.getSource().getFilterGroupItems().forEach(function (oItem) {
                    const oControl = oItem.getControl()
                    const sPath = oItem.getName()

                    if (oControl.isA("sap.m.MultiInput")) {
                        const aKeys = oControl
                            .getTokens()
                            .map((oToken) => oToken.getKey())

                        const sManualValue = oControl.getValue()
                        if (sManualValue && sManualValue.trim()) {
                            aKeys.push(sManualValue.trim())
                        }

                        if (aKeys.length === 1) {
                            aFilters.push(new Filter(sPath, FO.EQ, aKeys[0]))
                        } else if (aKeys.length > 1) {
                            aFilters.push(
                                new Filter(
                                    aKeys.map(
                                        (sValue) => new Filter(sPath, FO.EQ, sValue)
                                    ),
                                    false
                                )
                            )
                        }
                    } else if (oControl.isA("sap.m.DateRangeSelection")) {
                        const dFrom = oControl.getDateValue()
                        const dTo = oControl.getSecondDateValue()

                        if (dFrom && dTo) {
                            const d1 = new Date(dFrom.getTime())
                            d1.setHours(0, 0, 0, 0)

                            const d2 = new Date(dTo.getTime())
                            d2.setHours(23, 59, 59, 999)

                            aFilters.push(new Filter(sPath, FO.BT, d1, d2))
                        }
                    } else if (oControl.isA("sap.m.Select")) {
                        const sKey = oControl.getSelectedKey()
                        if (sKey) {
                            aFilters.push(new Filter(sPath, FO.EQ, sKey))
                        }
                    } else if (oControl.isA("sap.m.Input")) {
                        let sValue = (oControl.getValue() || "").trim()
                        if (sValue) {
                            if (
                                sPath === "SupplierName" ||
                                sPath === "NumeroFattura"
                            ) {
                                sValue = sValue.toUpperCase()
                            }
                            aFilters.push(new Filter(sPath, FO.Contains, sValue))
                        }
                    }
                })

                const oTable = this.byId("fattureArchiviate")
                if (oTable) {
                    oTable.clearSelection()
                }

                this._loadFatture(true, aFilters)
            },

            //valuehelp
            onValueHelpFornitoreArch: function () {
                sap.ui.require(
                    [
                        "com/zeim/fatturazionepassiva/controller/helpers/ValueHelpHandler"
                    ],
                    function (VH) {
                        VH.openValueHelp(
                            this,
                            "com.zeim.fatturazionepassiva.view.fragments.ValueHelpDialogFilterbarFornitore",
                            "Fornitore",
                            "/zeim_search_supplier_data",
                            {
                                vhId: "ARCH_FORN",
                                key: "Supplier",
                                desc: "SupplierName",
                                columns: [
                                    { label: "Fornitore", path: "Supplier" },
                                    { label: "Descrizione", path: "SupplierName" },
                                    { label: "Country", path: "Country" }
                                ],
                                targetModelName: "archFilters",
                                tokensPath: "/SupplierTokens",
                                multiInputId: "archMultiInputFornitore"
                            }
                        )
                    }.bind(this)
                )
            },

            onValueHelpTipoDocAdeArch: function () {
                sap.ui.require(
                    [
                        "com/zeim/fatturazionepassiva/controller/helpers/ValueHelpHandler"
                    ],
                    function (VH) {
                        VH.openValueHelp(
                            this,
                            "com.zeim.fatturazionepassiva.view.fragments.ValueHelpDialogFilterbarTipoDocAde",
                            "TipoDocAde",
                            "/ZC_EIM_BLADE",
                            {
                                vhId: "ARCH_TIPO_ADE",
                                key: "BlartAde",
                                desc: "Descrizione",
                                keyProp: "BlartAde",
                                maxKeyLength: 10,
                                filterProps: ["BlartAde", "Descrizione"],
                                columns: [
                                    { label: "Tipo Doc. AdE", path: "BlartAde" },
                                    { label: "Descrizione", path: "Descrizione" }
                                ],
                                targetModelName: "archFilters",
                                tokensPath: "/TipoDocAdeTokens",
                                multiInputId: "archMultiInputTipoDocAdE"
                            }
                        )
                    }.bind(this)
                )
            }
        }
    )
})