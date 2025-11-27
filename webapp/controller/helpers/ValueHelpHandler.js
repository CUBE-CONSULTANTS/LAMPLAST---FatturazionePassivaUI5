sap.ui.define([
  "sap/ui/core/Fragment",
  "sap/m/SearchField",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/table/Column",
  "sap/m/Label",
  "sap/m/Text"
], function (Fragment, SearchField, Filter, FilterOperator, UIColumn, Label, Text) {
  "use strict";

  // --- helper: applica filtro OR sui campi indicati
  function _applyFilter(oDialog, sQuery, aProps, oOptions) {
    oDialog.getTableAsync().then(function (oTable) {
      const oBinding = oTable.getBinding("rows") || oTable.getBinding("items");
      if (!oBinding) return;

      let aFilterProps = aProps.slice();
      if (oOptions?.maxKeyLength && sQuery && sQuery.length > oOptions.maxKeyLength && oOptions.keyProp) {
        aFilterProps = aFilterProps.filter(p => p !== oOptions.keyProp);
      }

      let aInner = [];
      if (sQuery && sQuery.trim()) {
        aInner = aFilterProps.map(p => new Filter(p, FilterOperator.Contains, sQuery));
      }

      // ⚠️ Importante: riseleziona dopo che i dati arrivano
      oBinding.attachDataReceived(function onDR() {
        oBinding.detachDataReceived(onDR);
        oOptions?.onAfterUpdate?.();
      });

      oBinding.filter(aInner.length ? new Filter(aInner, false) : []);
      oDialog.update();
    });
  }

  // --- helper: riseleziona in tabella le righe corrispondenti ai token
  function _reselectRows(oTable, aSelectedKeys, sKeyProp) {
    const oBinding = oTable.getBinding("rows") || oTable.getBinding("items");
    if (!oBinding) return;

    // prendi tutti i contesti disponibili (anche con server-side paging restituisce quelli caricati)
    const iLen = oBinding.getLength();
    const aCtxs = oBinding.getContexts(0, iLen);

    const setKeys = new Set(aSelectedKeys);
    if (oTable.clearSelection) oTable.clearSelection();

    aCtxs.forEach((oCtx, i) => {
      const oObj = oCtx.getObject && oCtx.getObject();
      if (oObj && setKeys.has(oObj[sKeyProp])) {
        // sap.ui.table.Table
        if (oTable.addSelectionInterval) {
          oTable.addSelectionInterval(i, i);
        }
        // (se un giorno userai sap.m.Table, qui potresti marcare gli items)
      }
    });
  }

  return {
    openValueHelp: function (oController, sFragmentName, sModelName, sEntityPath, oSettings) {
      Fragment.load({ name: sFragmentName, controller: oController }).then(function (oDialog) {



        oDialog.setKey(oSettings.key);
        oDialog.setDescriptionKey(oSettings.desc);
        oDialog.setRangeKeyFields([{ key: oSettings.key, label: oSettings.key, type: "string" }]);
        oDialog.setTokenDisplayBehaviour("descriptionAndId");



        // --- tabella
        oDialog.getTableAsync().then(function (oTable) {
          const oModel = oController.getOwnerComponent().getModel(sModelName);
          oTable.setModel(oModel);
          oTable.bindRows({ path: sEntityPath });

          oSettings.columns.forEach((c) => {
            oTable.addColumn(new UIColumn({
              label: new Label({ text: c.label }),
              template: new Text({ text: `{${c.path}}` })
            }));
          });

          // tokens correnti nel MultiInput
          const oMultiInput = oController.byId(oSettings.multiInputId);
          const aTokens = oMultiInput ? oMultiInput.getTokens() : [];
          let aSelectedKeys = aTokens.map(t => t.getKey());

          // --- funzione che riseleziona dopo ogni load/ricerca
          function fnReselect() {
            // delay minimo per essere *dopo* il rendering righe
            setTimeout(() => _reselectRows(oTable, aSelectedKeys, oSettings.key), 0);
          }

          // --- basic search
          const oBasicSearch = new SearchField({
            width: "100%",
            liveChange: (e) =>
              _applyFilter(oDialog, e.getParameter("newValue"), oSettings.filterProps, {
                maxKeyLength: oSettings.maxKeyLength,
                keyProp: oSettings.keyProp,
                onAfterUpdate: fnReselect // lo definiamo sotto
              })
          });

          const oFilterBar = oDialog.getFilterBar();
          oFilterBar.setFilterBarExpanded(false);
          oFilterBar.setBasicSearch(oBasicSearch);

          // 1) prima popolazione: quando arrivano i dati iniziali
          const oBinding = oTable.getBinding("rows");
          if (oBinding) {
            oBinding.attachDataReceived(function onFirstDR() {
              oBinding.detachDataReceived(onFirstDR);
              fnReselect();
            });
          }

          // 2) quando premi "Avvio" nella filterbar
          oFilterBar.attachSearch(function (ev) {
            const fb = ev.getSource();
            const sQuery =
              oBasicSearch.getValue().trim() ||
              oSettings.filterProps.map(p => fb.determineControlByName(p)?.getValue().trim())
                .find(Boolean) || "";

            // ricalcolo le chiavi (nel caso l’utente abbia tolto/aggiunto token nella vh)
            const aNowTokens = oController.byId(oSettings.multiInputId)?.getTokens() || [];
            aSelectedKeys = aNowTokens.map(t => t.getKey());

            _applyFilter(oDialog, sQuery, oSettings.filterProps, {
              maxKeyLength: oSettings.maxKeyLength,
              keyProp: oSettings.keyProp,
              onAfterUpdate: fnReselect
            });
          });

          oDialog.update();
        });

        // --- sincronizza i token visivi della VH con quelli del MultiInput
        const oMultiInput = oController.byId(oSettings.multiInputId);
        if (oMultiInput) {
          oDialog.setTokens(oMultiInput.getTokens());
        }

        oDialog.attachOk(function (oEvent) {
          if (oMultiInput) {
            oMultiInput.setTokens(oEvent.getParameter("tokens"));
          }
          oDialog.close();
        });

        oDialog.attachCancel(() => oDialog.close());
        oDialog.attachAfterClose(() => oDialog.destroy());

        // trigger popolamento iniziale
        oDialog.attachAfterOpen(() => oFilterBar.search());

        oDialog.open();
      });
    }
  };
});
