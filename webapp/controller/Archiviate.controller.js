
sap.ui.define([
    "./BaseController",
    "sap/ui/core/Fragment",
    "sap/ui/comp/variants/VariantItem",
    "../model/API",
    "../model/formatter",
    "sap/ui/model/Filter",
    "sap/m/p13n/MetadataHelper",
    "sap/m/p13n/Engine",
    "sap/m/p13n/SelectionController",
    "sap/m/p13n/SortController",
    "sap/m/p13n/GroupController"
], (
    BaseController,
    Fragment,
    VariantItem,
    API,
    formatter,
    Filter,
    MetadataHelper,
    Engine,
    SelectionController,
    SortController,
    GroupController
) => {
    "use strict"

    return BaseController.extend(
        "com.zeim.fatturazionepassiva.controller.Archiviate",
        {
            formatter: formatter,

            /* =========================================================== */
            /* INIT                                                        */
            /* =========================================================== */

            onInit: function () {
                this.getView().setModel(
                    new sap.ui.model.json.JSONModel(),
                    "fattureModel"
                )
                const oRouter = this.getOwnerComponent().getRouter()
                oRouter
                    .getRoute("Archiviate")
                    .attachPatternMatched(this._onObjectMatched, this)

                this._registerForP13n()
                this._initVariantManagement()
            },

            _onObjectMatched: function () {
                this._loadFatture(true)
                const oData = this._getVariantData()
                if (oData.defaultVariantKey) {
                    const oVariant =
                        oData.variants[oData.defaultVariantKey]

                    if (oVariant && oVariant.layout) {
                        this._applyTableLayout(oVariant.layout)
                    }
                }
            },
            //p13n
            _registerForP13n: function () {
                const oTable = this.byId("fattureArchiviate")

                if (!oTable) {
                    console.error("Tabella fattureArchiviate non trovata")
                    return
                }

                const aMetadata = []
                this._mInitialWidth = {}

                oTable.getColumns().forEach((oColumn) => {
                    const sKey = this._getCustomDataValue(
                        oColumn,
                        "p13nKey"
                    )
                    if (!sKey) {
                        return
                    }
                    const sPath = this._getCustomDataValue(
                        oColumn,
                        "p13nPath"
                    )

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

            openPersoDialog: function (oEvent) {
                const oTable = this.byId("fattureArchiviate")
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

            _getCustomDataValue: function (oControl, sKey) {
                const oData = oControl.getCustomData().find(
                    (oItem) => oItem.getKey() === sKey
                )
                return oData ? oData.getValue() : undefined
            },

            handleStateChange: function (oEvent) {
                const oState = oEvent.getParameter("state")
                if (!oState || !oState.Columns) return

                this._applyP13nColumnsState(oState.Columns)
            },
            _applyP13nColumnsState: function (aStateColumns) {
                const oTable = this.byId("fattureArchiviate")
                if (!oTable) return
                const aCurrentColumns = oTable.getColumns().slice()
                const aVisibleKeys = aStateColumns.map(o => o.key)
                aCurrentColumns.forEach((oColumn) => {
                    const sKey = this._getCustomDataValue(
                        oColumn,
                        "p13nKey"
                    )
                    if (sKey) {
                        oColumn.setVisible(aVisibleKeys.includes(sKey))
                    }
                })
                const aOrderedColumns = []
                aStateColumns.forEach((oStateColumn) => {
                    const oColumn = aCurrentColumns.find(
                        (oCol) =>
                            this._getCustomDataValue(oCol, "p13nKey") ===
                            oStateColumn.key
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

                this._reorderTableColumns(aOrderedColumns)
            },
            //prime 3 colonne fisse
            _reorderTableColumns: function (aOrderedP13nColumns) {
                const oTable = this.byId("fattureArchiviate")
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
            //Layout colonne
            _getCurrentTableLayout: function () {
                const oTable = this.byId("fattureArchiviate")
                return {
                    columns: oTable.getColumns().map((oColumn, iIndex) => ({
                        key: this._getCustomDataValue(
                            oColumn,
                            "p13nKey"
                        ),
                        visible: oColumn.getVisible(),
                        order: iIndex
                    }))
                }
            },

            _applyTableLayout: function (oLayout) {
                const oTable = this.byId("fattureArchiviate")

                if (!oTable || !oLayout || !oLayout.columns) return

                const aCurrentColumns = oTable.getColumns().slice()
                const mColumns = {}

                aCurrentColumns.forEach((oColumn, iIndex) => {
                    const sKey =
                        this._getCustomDataValue(oColumn, "p13nKey") ||
                        "__column_" + iIndex

                    mColumns[sKey] = oColumn
                })

                // Ripristina la visibilità
                oLayout.columns.forEach((oSavedColumn) => {
                    const oColumn = mColumns[oSavedColumn.key]
                    if (oColumn) {
                        oColumn.setVisible(!!oSavedColumn.visible)
                    }
                })

                let aOrderedColumns = []
                oLayout.columns
                    .slice()
                    .sort((a, b) => a.order - b.order)
                    .forEach((oSavedColumn) => {
                        const oColumn = mColumns[oSavedColumn.key]

                        if (oColumn) {
                            aOrderedColumns.push(oColumn)
                        }
                    })
                aCurrentColumns.forEach((oColumn) => {
                    if (!aOrderedColumns.includes(oColumn)) {
                        aOrderedColumns.push(oColumn)
                    }
                })

                oTable.removeAllColumns()
                aOrderedColumns.forEach((oColumn) => {
                    oTable.addColumn(oColumn)
                })
            },

            _resetToStandardTableLayout: function () {
                const oTable = this.byId("fattureArchiviate")
                if (!oTable) return

                oTable.getColumns().forEach((oColumn) => {
                    const sKey = this._getCustomDataValue(
                        oColumn,
                        "p13nKey"
                    )
                    if (sKey) {
                        oColumn.setVisible(true)
                    }
                })
            },
            //gestione varianti
            _getVariantManagementControl: function () {
                const aControls = this.getView().findAggregatedObjects(
                    true,
                    function (oControl) {
                        return oControl.isA("sap.m.VariantManagement")
                    }
                )
                return aControls.length ? aControls[0] : null
            },
            _initVariantManagement: function () {
                debugger
                const oVM = this._getVariantManagementControl()
                if (!oVM) {
                    console.warn("sap.m.VariantManagement non trovato")
                    return
                }
                const oData = this._getVariantData()
                console.log("Varianti lette dal localStorage:", oData)

                oVM.destroyItems()
                Object.keys(oData.variants || {}).forEach((sKey) => {
                    const oVariant = oData.variants[sKey]

                    oVM.addItem(
                        new VariantItem({
                            key: sKey,
                            title: oVariant.name
                        })
                    )
                })

                if (
                    oData.defaultVariantKey &&
                    oData.variants[oData.defaultVariantKey]
                ) {
                    oVM.setSelectedKey(oData.defaultVariantKey)
                }
            },
            onVariantSave: function (oEvent) {
                const oVM = oEvent.getSource()
                const oData = this._getVariantData()
                const sName = oEvent.getParameter("name")
                let sKey = oEvent.getParameter("key")
                const bOverwrite = oEvent.getParameter("overwrite")
                const bDefault = oEvent.getParameter("def")

                if (!sName) return

                if (!sKey && bOverwrite) {
                    sKey = Object.keys(oData.variants).find(
                        (sExistingKey) =>
                            oData.variants[sExistingKey].name === sName
                    )
                }
                if (!sKey) {
                    sKey =
                        "VARIANT_" +
                        Date.now() +
                        "_" +
                        Math.floor(Math.random() * 10000)
                }

                const oVariant = {
                    key: sKey,
                    name: sName,
                    layout: this._getCurrentTableLayout()
                }

                oData.variants[sKey] = oVariant

                if (bDefault) {
                    oData.defaultVariantKey = sKey
                }

                this._setVariantData(oData)

                const oExistingItem = oVM.getItems().find(
                    (oItem) => oItem.getKey() === sKey
                )

                if (oExistingItem) {
                    oExistingItem.setText(sName)
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
                if (oData.defaultVariantKey) {
                    oVM.setDefaultKey(oData.defaultVariantKey)
                }
                sap.m.MessageToast.show("Layout salvato.")
            },

            onVariantSelect: function (oEvent) {
                const sKey = oEvent.getParameter("key")
                if (!sKey) {
                    this._resetToStandardTableLayout()
                    return
                }

                const oData = this._getVariantData()
                const oVariant = oData.variants[sKey]

                if (!oVariant || !oVariant.layout) {
                    this._resetToStandardTableLayout()
                    return
                }

                this._applyTableLayout(oVariant.layout)
            },

            onVariantManage: function (oEvent) {
                const oVM = oEvent.getSource()
                const oData = this._getVariantData()

                const aDeleted =
                    oEvent.getParameter("deleted") || []

                const aRenamed =
                    oEvent.getParameter("renamed") || []

                const sDefaultKey =
                    oEvent.getParameter("def")

                aDeleted.forEach((sKey) => {
                    delete oData.variants[sKey]

                    if (oData.defaultVariantKey === sKey) {
                        oData.defaultVariantKey = ""
                    }
                })

                aRenamed.forEach((oRenamed) => {
                    if (
                        typeof oRenamed === "object" &&
                        oRenamed.key &&
                        oData.variants[oRenamed.key]
                    ) {
                        oData.variants[oRenamed.key].name =
                            oRenamed.name
                    }
                })

                if (
                    typeof sDefaultKey === "string" &&
                    oData.variants[sDefaultKey]
                ) {
                    oData.defaultVariantKey = sDefaultKey
                } else if (sDefaultKey === false) {
                    oData.defaultVariantKey = ""
                }

                this._setVariantData(oData)
                this._initVariantManagement()

                sap.m.MessageToast.show(
                    "Gestione layout aggiornata."
                )
            },
            //gestione localstorage
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
                        defaultVariantKey: oData.defaultVariantKey || ""
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
                    sap.m.MessageToast.show(
                        "Impossibile salvare il layout."
                    )
                }
            },

            onFilterBarClear: function (oEvent) {
                const oFilterBar = oEvent.getSource()

                oFilterBar.getFilterGroupItems().forEach(
                    function (oItem) {
                        const oControl = oItem.getControl()

                        if (oControl.isA("sap.m.MultiInput")) {
                            oControl.removeAllTokens()
                            oControl.setValue("")

                        } else if (
                            oControl.isA("sap.m.DateRangeSelection")
                        ) {
                            oControl.setDateValue(null)
                            oControl.setSecondDateValue(null)

                        } else if (oControl.isA("sap.m.Select")) {
                            oControl.setSelectedKey("")

                        } else if (oControl.isA("sap.m.Input")) {
                            oControl.setValue("")
                        }
                    }
                )

                const oTable = this.byId("idTreeTable")

                if (oTable) {
                    oTable.clearSelection()
                }

                this._onObjectMatched()
            },

            _loadFatture: async function (
                bReset = true,
                aFilters = []
            ) {
                const oODataModel = this.getOwnerComponent().getModel("mainService")

                const oFattureModel = this.getView().getModel("fattureModel")

                if (Array.isArray(aFilters)) {
                    this._currentFilters = aFilters
                }

                const aCurrentFilters = this._currentFilters || []

                const sEntity = "/zeim_lista_fatture_passive"

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

                oEvent.getSource()
                    .getFilterGroupItems()
                    .forEach(function (oItem) {
                        const oControl = oItem.getControl()
                        const sPath = oItem.getName()

                        if (oControl.isA("sap.m.MultiInput")) {
                            const aKeys = oControl
                                .getTokens()
                                .map((oToken) => oToken.getKey())

                            const sManualValue =
                                oControl.getValue()

                            if (
                                sManualValue &&
                                sManualValue.trim()
                            ) {
                                aKeys.push(sManualValue.trim())
                            }

                            if (aKeys.length === 1) {
                                aFilters.push(
                                    new Filter(
                                        sPath,
                                        FO.EQ,
                                        aKeys[0]
                                    )
                                )
                            } else if (aKeys.length > 1) {
                                aFilters.push(
                                    new Filter(
                                        aKeys.map(
                                            (sValue) =>
                                                new Filter(
                                                    sPath,
                                                    FO.EQ,
                                                    sValue
                                                )
                                        ),
                                        false
                                    )
                                )
                            }

                        } else if (
                            oControl.isA("sap.m.DateRangeSelection")
                        ) {
                            const dFrom = oControl.getDateValue()
                            const dTo =
                                oControl.getSecondDateValue()

                            if (dFrom && dTo) {
                                const d1 = new Date(dFrom.getTime())
                                d1.setHours(0, 0, 0, 0)

                                const d2 = new Date(dTo.getTime())
                                d2.setHours(23, 59, 59, 999)

                                aFilters.push(
                                    new Filter(
                                        sPath,
                                        FO.BT,
                                        d1,
                                        d2
                                    )
                                )
                            }

                        } else if (
                            oControl.isA("sap.m.Select")
                        ) {
                            const sKey =
                                oControl.getSelectedKey()

                            if (sKey) {
                                aFilters.push(
                                    new Filter(
                                        sPath,
                                        FO.EQ,
                                        sKey
                                    )
                                )
                            }

                        } else if (
                            oControl.isA("sap.m.Input")
                        ) {
                            let sValue =
                                (oControl.getValue() || "").trim()

                            if (sValue) {
                                if (
                                    sPath === "SupplierName" ||
                                    sPath === "NumeroFattura"
                                ) {
                                    sValue = sValue.toUpperCase()
                                }

                                aFilters.push(
                                    new Filter(
                                        sPath,
                                        FO.Contains,
                                        sValue
                                    )
                                )
                            }
                        }
                    })

                const oTable = this.byId("idTreeTable")

                if (oTable) {
                    oTable.clearSelection()
                }

                this._loadFatture(true, aFilters)
            },

            //value help
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
                                    {
                                        label: "Fornitore",
                                        path: "Supplier"
                                    },
                                    {
                                        label: "Descrizione",
                                        path: "SupplierName"
                                    },
                                    {
                                        label: "Country",
                                        path: "Country"
                                    }
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
                                filterProps: [
                                    "BlartAde",
                                    "Descrizione"
                                ],
                                columns: [
                                    {
                                        label: "Tipo Doc. AdE",
                                        path: "BlartAde"
                                    },
                                    {
                                        label: "Descrizione",
                                        path: "Descrizione"
                                    }
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
