sap.ui.define([], function () {
  "use strict";

  return {
    getInvoicesData: function () {
      return {
        Invoices: [
          // ====== 1 ======
          {
            docNumber: "0003829203",
            fiscalYear: "2024",
            status: "R",
            statusText: "Da registrare",
            tipoFattura: "MM",
            companyName: "DEMO S.p.A.",
            supplier: "11000118",
            supplierName: "Alfasigma S.p.A.",
            hasWarning: true,
            warningText: "Controllo in sospeso",
            docType: "ZP01 TD01 Fattura",
            reference: "0003829203",
            currency: "EUR",
            date: "2024-12-06",
            reason: "Destinatario Merci: HUMANITAS MIRASOLE SPA",
            totalPrice: "16.523,13",

            items: [
              {
                docType: "TD01",
                posizione: "10",
                udmXml: "Confezione",
                DscTpDoc: "Fattura",
                soc: "MM",
                fornitore: "11000118",
                nome1: "Alfasigma S.p.A.",
                riferimento: "0003829203",
                data: "2024-12-06",
                divisa: "EUR",
                importo: "16.523,13",
                posizione: "10",
                materialCode: "",
                materialDesc: "BENTALAN 5MG/2ML Conf.",
                quantity: "10,000",
                unitPrice: "1,86",
                totalPrice: 18.60,
                vatCode: "10",
                matFornCcac: "MF001",
                codMat: "CODE01",
                docAcq: "4500012345",
                posizioneDocAcq: "10",
                dataDocAcq: "2024-11-20",
                docMat: "5000098765",
                posizioneDocMat: "10",
                esDocMat: "2025",
                bolla: "BOL12345"
              },
              {
                docType: "TD01",
                posizione: "20",
                udmXml: "Confezione",
                DscTpDoc: "Fattura",
                soc: "S100",
                fornitore: "11000118",
                nome1: "Alfasigma S.p.A.",
                riferimento: "0003829203",
                data: "2024-12-06",
                divisa: "EUR",
                importo: "16.523,13",
                posizione: "20",
                materialCode: "027350273",
                materialDesc: "LAVORFLEX 25 MG PO Conf.",
                quantity: "20,000",
                unitPrice: "2,66",
                totalPrice: 53.20,
                vatCode: "10",
                matFornCcac: "MF002",
                codMat: "CODE02",
                docAcq: "4500012346",
                posizioneDocAcq: "20",
                dataDocAcq: "2024-11-20",
                docMat: "5000098766",
                posizioneDocMat: "20",
                esDocMat: "2025",
                bolla: "BOL12346"
              }
            ]
          },

          // ====== 2 ======
          {
            docNumber: "0003829204",
            fiscalYear: "2024",
            status: "Y",
            statusText: "In lavorazione",
            tipoFattura: "FI",
            companyName: "BETA Pharma S.r.l.",
            supplier: "12000245",
            supplierName: "Angelini S.p.A.",
            hasWarning: false,
            warningText: "",
            docType: "ZP02 TD01 Fattura",

            reference: "0003829204",
            currency: "EUR",
            date: "2024-12-07",
            reason: "Destinatario Merci: OSPEDALE SAN RAFFAELE",
            totalPrice: "8.920,45",

            items: [
              {
                docType: "TD02",
                posizione: "10",
                udmXml: "Confezione",
                DscTpDoc: "Fattura",
                soc: "S200",
                fornitore: "12000245",
                nome1: "Angelini S.p.A.",
                riferimento: "0003829204",
                data: "2024-12-07",
                divisa: "EUR",
                importo: "8.920,45",
                posizione: "10",
                materialCode: "045221009",
                materialDesc: "Tachipirina 500mg 20 cpr",
                quantity: "50,000",
                unitPrice: "1,10",
                totalPrice: "55,00",
                vatCode: "22",
                matFornCcac: "MF003",
                codMat: "CODE03",
                docAcq: "4500012347",
                posizioneDocAcq: "10",
                dataDocAcq: "2024-11-21",
                docMat: "5000098767",
                posizioneDocMat: "10",
                esDocMat: "2025",
                bolla: "BOL12347"
              },
              {
                docType: "TD02",
                posizione: "20",
                udmXml: "Confezione",
                DscTpDoc: "Fattura",
                soc: "S200",
                fornitore: "13000178",
                nome1: "Recordati Industria Chimica",
                riferimento: "0003829204",
                data: "2024-12-07",
                importo: "8.920,45",
                divisa: "EUR",
                posizione: "20",
                materialCode: "071145998",
                materialDesc: "Moment 400mg 24 cpr",
                quantity: "30,000",
                unitPrice: "1,20",
                totalPrice: "36,00",
                vatCode: "22",
                matFornCcac: "MF004",
                codMat: "CODE04",
                docAcq: "4500012348",
                posizioneDocAcq: "20",
                dataDocAcq: "2024-11-21",
                docMat: "5000098768",
                posizioneDocMat: "20",
                esDocMat: "2025",
                bolla: "BOL12348"
              }
            ]
          },

          // ====== 3 ======
          {
            docNumber: "0003829205",
            fiscalYear: "2025",
            status: "G",
            statusText: "Registrata",
            tipoFattura: "MM",
            companyName: "OMEGA Distribuzioni S.p.A.",
            supplier: "13000178",
            supplierName: "Recordati Industria Chimica",
            hasWarning: false,
            warningText: "",
            docType: "ZP03 TD01 Fattura",

            reference: "0003829205",
            currency: "EUR",
            date: "2025-01-10",
            reason: "Destinatario Merci: CLINICA HUMANITAS",
            totalPrice: "12.430,00",

            items: [
              {
                docType: "TD03",
                posizione: "10",
                DscTpDoc: "Fattura",
                udmXml: "Confezione",
                soc: "S300",
                fornitore: "13000178",
                nome1: "Recordati Industria Chimica",
                riferimento: "0003829205",
                data: "2025-01-10",
                importo: "12.430,00",
                divisa: "EUR",
                posizione: "10",
                materialCode: "078945612",
                materialDesc: "Ibuprofene 600mg 30 cpr",
                quantity: "200,000",
                unitPrice: "0,85",
                totalPrice: "170,00",
                vatCode: "22",
                matFornCcac: "MF005",
                codMat: "CODE05",
                docAcq: "4500012349",
                posizioneDocAcq: "10",
                dataDocAcq: "2024-12-01",
                docMat: "5000098769",
                posizioneDocMat: "10",
                esDocMat: "2025",
                bolla: "BOL12349"
              },
              {
                docType: "TD03",
                posizione: "20",
                DscTpDoc: "Fattura",
                udmXml: "Confezione",
                soc: "S300",
                fornitore: "13000178",
                nome1: "Recordati Industria Chimica",
                riferimento: "0003829205",
                data: "2025-01-10",
                divisa: "EUR",
                importo: "12.430,00",
                posizione: "20",
                materialCode: "091158234",
                materialDesc: "Voltadvance 25mg 10 bustine",
                quantity: "100,000",
                unitPrice: "2,00",
                totalPrice: "200,00",
                vatCode: "22",
                matFornCcac: "MF006",
                codMat: "CODE06",
                docAcq: "4500012350",
                posizioneDocAcq: "20",
                dataDocAcq: "2024-12-01",
                docMat: "5000098770",
                posizioneDocMat: "20",
                esDocMat: "2025",
                bolla: "BOL12350"
              }
            ]
          }
        ]
      };
    },
    getMockDataCreateInvoiceSap: function () {
      return {
        "request": {
          "invoice": {
            "number": "454/26",
            "date": "2026-04-17",
            "companyCode": "S001",
            "supplierCode": "603482",
            "supplierName": "MD PLAST S.P.A.",
            "taxableAmount": 36000.00,
            "totalAmount": 43920.00,
            "currency": "EUR",
            "xmlPurchaseOrderRefs": ["438/000"]
          }
        },
        "meta": {
          "source": "SAP",
          "totalOrders": 4,
          "totalSelectable": 3
        },
        "purchaseOrders": [
          {
            "purchaseOrder": "438/000",
            "orderDate": "2026-03-10",
            "supplierCode": "603482",
            "supplierName": "MD PLAST S.P.A.",
            "description": "ESSICCANTE MD512156D MASTER",
            "positionsCount": 3,
            "orderAmount": 36000.00,
            "amountToInvoice": 36000.00,
            "currency": "EUR",
            "status": "OPEN",
            "statusText": "Aperto",
            "selectable": true,
            "preselected": true,
            "matchesXml": true,
            "matchNote": "Importo coincidente con la fattura",
            "paymentTerms": {
              "code": "Z060",
              "description": "60 gg data fattura"
            },
            "items": [
              {
                "position": "10",
                "material": "MAT-512156",
                "description": "ESSICCANTE MD512156D MASTER",
                "unit": "KG",
                "qtyOrdered": 9000.00,
                "qtyReceived": 9000.00,
                "qtyInvoiced": 0.00,
                "qtyOpen": 9000.00,
                "unitPrice": 1.20,
                "amountOpen": 10800.00,
                "taxCode": "22",
                "matchedXmlPosition": "1"
              },
              {
                "position": "20",
                "material": "MAT-512156",
                "description": "ESSICCANTE MD512156 D PE 3/41/140426",
                "unit": "KG",
                "qtyOrdered": 12000.00,
                "qtyReceived": 12000.00,
                "qtyInvoiced": 0.00,
                "qtyOpen": 12000.00,
                "unitPrice": 1.20,
                "amountOpen": 14400.00,
                "taxCode": "22",
                "matchedXmlPosition": "2"
              },
              {
                "position": "30",
                "material": "MAT-512157",
                "description": "ESSICCANTE MD512157D MASTER",
                "unit": "KG",
                "qtyOrdered": 9000.00,
                "qtyReceived": 9000.00,
                "qtyInvoiced": 0.00,
                "qtyOpen": 9000.00,
                "unitPrice": 1.20,
                "amountOpen": 10800.00,
                "taxCode": "22",
                "matchedXmlPosition": "3"
              }
            ]
          },
          {
            "purchaseOrder": "412/000",
            "orderDate": "2026-02-20",
            "supplierCode": "603482",
            "supplierName": "MD PLAST S.P.A.",
            "description": "ADDITIVO ANTIURTO / COLORANTE",
            "positionsCount": 2,
            "orderAmount": 15350.00,
            "amountToInvoice": 9450.00,
            "currency": "EUR",
            "status": "PARTIALLY_INVOICED",
            "statusText": "Parzialmente fatturato",
            "selectable": true,
            "preselected": false,
            "matchesXml": false,
            "matchNote": "Importo diverso dalla fattura",
            "paymentTerms": {
              "code": "Z060",
              "description": "60 gg data fattura"
            },
            "items": [
              {
                "position": "10",
                "material": "MAT-330010",
                "description": "ADDITIVO ANTIURTO",
                "unit": "KG",
                "qtyOrdered": 5000.00,
                "qtyReceived": 5000.00,
                "qtyInvoiced": 2000.00,
                "qtyOpen": 3000.00,
                "unitPrice": 1.15,
                "amountOpen": 3450.00,
                "taxCode": "22",
                "matchedXmlPosition": null
              },
              {
                "position": "20",
                "material": "MAT-330020",
                "description": "COLORANTE BLU MASTER",
                "unit": "KG",
                "qtyOrdered": 4000.00,
                "qtyReceived": 2500.00,
                "qtyInvoiced": 0.00,
                "qtyOpen": 2500.00,
                "unitPrice": 2.40,
                "amountOpen": 6000.00,
                "taxCode": "22",
                "matchedXmlPosition": null
              }
            ]
          },
          {
            "purchaseOrder": "501/000",
            "orderDate": "2026-04-02",
            "supplierCode": "603482",
            "supplierName": "MD PLAST S.P.A.",
            "description": "ESSICCANTE MD600100 MASTER",
            "positionsCount": 1,
            "orderAmount": 12500.00,
            "amountToInvoice": 12500.00,
            "currency": "EUR",
            "status": "OPEN",
            "statusText": "Aperto",
            "selectable": true,
            "preselected": false,
            "matchesXml": false,
            "matchNote": "Importo diverso dalla fattura",
            "paymentTerms": {
              "code": "Z060",
              "description": "60 gg data fattura"
            },
            "items": [
              {
                "position": "10",
                "material": "MAT-600100",
                "description": "ESSICCANTE MD600100 MASTER",
                "unit": "KG",
                "qtyOrdered": 10000.00,
                "qtyReceived": 10000.00,
                "qtyInvoiced": 0.00,
                "qtyOpen": 10000.00,
                "unitPrice": 1.25,
                "amountOpen": 12500.00,
                "taxCode": "22",
                "matchedXmlPosition": null
              }
            ]
          },
          {
            "purchaseOrder": "455/000",
            "orderDate": "2026-03-25",
            "supplierCode": "603482",
            "supplierName": "MD PLAST S.P.A.",
            "description": "STABILIZZANTE UV",
            "positionsCount": 1,
            "orderAmount": 12300.00,
            "amountToInvoice": 12300.00,
            "currency": "EUR",
            "status": "BLOCKED",
            "statusText": "Bloccato",
            "selectable": false,
            "blockReason": "Ordine bloccato dall'ufficio acquisti",
            "preselected": false,
            "matchesXml": false,
            "matchNote": "Non selezionabile",
            "paymentTerms": {
              "code": "Z060",
              "description": "60 gg data fattura"
            },
            "items": [
              {
                "position": "10",
                "material": "MAT-770010",
                "description": "STABILIZZANTE UV",
                "unit": "KG",
                "qtyOrdered": 3000.00,
                "qtyReceived": 3000.00,
                "qtyInvoiced": 0.00,
                "qtyOpen": 3000.00,
                "unitPrice": 4.10,
                "amountOpen": 12300.00,
                "taxCode": "22",
                "matchedXmlPosition": null
              }
            ]
          }
        ]

      }
    }
  };
});
