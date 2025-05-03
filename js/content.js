chrome.storage.local.get(['authenticated'], (result) => {
    if (result.authenticated) {

        const observeUrlChanges = () => {

            const handleUrlChange = () => {
                const currentUrl = window.location.href;

                if (currentUrl && currentUrl.includes('https://new.e-taxes.gov.az/eportal/az/invoice')) {
                    startObservingInvoice();
                }
                 if (currentUrl && currentUrl.includes('https://new.e-taxes.gov.az/eportal/az/declarations')) {
                    startObservingDeclaration();
                }
            };

            handleUrlChange();

            const originalPushState = history.pushState;
            const originalReplaceState = history.replaceState;

            history.pushState = function () {
                originalPushState.apply(this, arguments);
                handleUrlChange();
            };

            history.replaceState = function () {
                originalReplaceState.apply(this, arguments);
                handleUrlChange();
            };

            window.onpopstate = function () {
                handleUrlChange();
            };

        };

        const observePageChanges = (startObserving) => {
            const observer = new MutationObserver(() => {
                startObserving();
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
            });
            startObserving();
        };

        const startObservingInvoice = () => {
            observePageChanges(initializeInvoiceButtons);
        };

        const startObservingDeclaration = () => {
            observePageChanges(initializeDeclarationButtons);
        };

        const initializeInvoiceButtons = () => {
            injectingCss();
            const container = document.querySelector(".vhf-page-list-controls-sort-right");
            if (container && (!document.querySelector("#fetch-tax-button") && !document.querySelector("#presentation-button"))) {
                eqfInitializer(container);
            }
        };

        const initializeDeclarationButtons = () => {
            injectingCss();
            const container = document.querySelector(".root-declarations-page-list-controls-sort");
            if (container && !document.querySelector("#fetch-declaration-button")) {
                declarationPageInitializer(container);
            }
        };

        function eqfInitializer(container) {
            const btnFetchTax = creatingFetchButton(container);
            const btnPresent = creatingPresentationButton(container);
            btnFetchTax.addEventListener('click', async () => {
                const taxLinks = document.querySelectorAll('a[href^="/eportal/az/invoice/view/"]');
                if (taxLinks.length === 0) {
                    alert("Heç bir elektron qaimə fakturası tapılmadı.");
                    return;
                }
                const loadingTab = creatingLoadingTab(container);
                const extractedData = await extractingData(taxLinks, loadingTab, fetchIframeContent);
                container.removeChild(loadingTab);
                openDataInNewTab(extractedData)
            });
            btnPresent.addEventListener("click", async () => {
                openModal();
            });
        }

        function declarationPageInitializer(container) {
            creatingDeclarationButton(container);
        }

        observeUrlChanges();
    } else {
        console.log("User signed out!")
    }
});


// ___Declaration Fetch Functions Start___//

function creatingDeclarationButton(container) {
    const declarationFetchBtn = document.createElement('button');
    declarationFetchBtn.id = "fetch-declaration-button";
    declarationFetchBtn.className = 'mr-2 btn btn-outline-primary';
    declarationFetchBtn.type = 'button';
    declarationFetchBtn.textContent = 'Bütün bəyannamələri çap et';
    container.prepend(declarationFetchBtn);
    
    declarationFetchBtn.addEventListener('click',async()=>{
        fetchDeclarationProcess();
    })
}

async function fetchDeclarationProcess() {
    const vatTable = findVatDeclarationTable();
    const vatDeclarationElements = vatTable.querySelectorAll("td.table-col-4 > div > div.root-declarations-page-list-table-payload__subtitle.mt-2 > div");
    const vatDeclarationMonthAndYear = vatTable.querySelectorAll("td.table-col-4 > div > div.d-flex.align-items-center > span")     
    const vatDeclarationInnerHTML = Array.from(vatDeclarationElements).map(el => el.innerHTML.trim());
    const vatDeclarationMonthAndYearInnerHTML = Array.from(vatDeclarationMonthAndYear).map(el=>el.innerHTML.trim())
    const documentInfos = [];

    extractDocumentNumbers (vatDeclarationInnerHTML,vatDeclarationMonthAndYearInnerHTML, documentInfos);
   
    function extractDataFromIframe(iframeDocument, menuSelectors) {
        return new Promise((resolve, reject) => {
            try {

                let results = [];
                let currentIndex = 0;

                function processMenu() {
                    if (currentIndex >= menuSelectors.length) {
                        resolve(results);
                        return;
                    }
                   
                    const menuItem = iframeDocument.querySelector(menuSelectors[currentIndex]);

                    if (menuItem) {
                        menuItem.click();
                        setTimeout(() => {

                            let data;
                            let vatContent;
                          
                            if(menuItem.innerText.includes("Əlavə 2")){
                                vatContent = iframeDocument.querySelector("#app > div > div.vis-col.pr-16-md.pl-16-md.d-flex.d-flex-direction-column.pt-100-md.pb-22-md > div.vis-box > form > div > div:nth-child(3) > div > div.vis-collapse-content.vis-collapse-content-active > div > div > div > div > div > div > div")?.innerHTML || "Məlumat tapılmadı"; 
                            }
                            else{
                                vatContent = iframeDocument.querySelector(".vis-table-container")?.innerHTML || "Məlumat tapılmadı";
                            }
                             
                            const parser = new DOMParser();
                            const doc = parser.parseFromString(vatContent, "text/html");

                            if(menuItem.innerText.includes("Əlavə 9") || menuItem.innerText.includes("Əldə edilmiş Yük gömrük bəyannamələri və bu bəyannamələr üzrə aparılmış ödənişlər")){                              
                                data = doc.querySelectorAll("table > tfoot > tr");
                            }else{
                                data = doc.querySelectorAll("table > tbody > tr");
                            }

                            let rows = Array.from(data).map(tr => {
                                let columns = tr.querySelectorAll("td");
                                
                                if(menuItem.innerText.includes("Əlavə 3") && columns[0].innerText==="301.1"){
                                    specialRow = {
                                        code: "301.1S",
                                        title: "Special 301.1",
                                        value1: columns[2]?.innerText.trim() || "0,00",
                                        value2: columns[3]?.innerText.trim() || "0,00",
                                        value3: columns[4]?.innerText.trim() || "0,00",
                                        value4: columns[5]?.innerText.trim() || "0,00"
                                    };
                                    return specialRow;
                                }

                                if (columns[0].innerText.trim() === "Büdcəyə ödənilmiş dəyərin (ƏDV-siz) və ƏDV məbləğinin CƏMİ") {
                                    specialRow = {
                                        code: "900",
                                        title: "Büdcəyə ödənilmiş dəyərin (ƏDV-siz) və ƏDV məbləğinin CƏMİ",
                                        value1: columns[2]?.innerText.trim() || "0,00",
                                        value2: columns[3]?.innerText.trim() || "0,00",
                                        value3: columns[4]?.innerText.trim() || "0,00",
                                        value4: columns[5]?.innerText.trim() || "0,00"
                                    };
                                    return specialRow;
                                }

                                if(menuItem.innerText.includes("Əldə edilmiş Yük gömrük bəyannamələri və bu bəyannamələr üzrə aparılmış ödənişlər")){
                                    specialRow = {
                                        code: "903",
                                        title: "Cari hesabat dövründə əldə edilmiş Yük Gömrük Bəyannamələri üzrə alınmış malların ƏDV-siz ümumi dəyəri və ƏDV məbləğlərinin cəmi, manatla",
                                        value1: columns[1]?.innerText.trim() || "0,00",
                                        value2: columns[2]?.innerText.trim() || "0,00",
                                        value3: "0,00",
                                        value4: "0,00"
                                    };
                                    return specialRow;
                                }

                                if(menuItem.innerText.includes("Əlavə 2")){
                                    specialRow={
                                        code:"901",
                                        title: columns[0]?.innerText.trim() || "0,00",
                                        value1: columns[1]?.innerText.trim() || "0,00",
                                        value2: columns[2]?.innerText.trim() || "0,00",
                                        value3: columns[3]?.innerText.trim() || "0,00",
                                        value4: columns[4]?.innerText.trim() || "0,00"
                                    }
                                    return specialRow;
                                }


                                if(menuItem.innerText.includes("Əlavə 9")){
                                    specialRow = {
                                        code: "902",
                                        title: columns[0].innerText.trim(),
                                        value1: columns[1]?.innerText.trim() || "0,00",
                                        value2: columns[2]?.innerText.trim() || "0,00",
                                        value3: "0,00",
                                        value4: "0,00"
                                    };
                                    return specialRow;
                                }

                                
                                return {
                                    code: columns[0]?.innerText.trim() || "0,00", 
                                    title: columns[1]?.innerText.trim() || "0,00", 
                                    value1: columns[2]?.innerText.trim() || "0,00",  
                                    value2: columns[3]?.innerText.trim() || "0,00",  
                                    value3: columns[4]?.innerText.trim() || "0,00",
                                    value4: columns[5]?.innerText.trim() || "0,00"  
                                };
                            });

                            results.push({ menu: currentIndex + 1, data: rows });

                            currentIndex++;
                            processMenu();
                        }, 1000); 
                    } else {
                        currentIndex++;
                        processMenu();
                    }
                }

                processMenu();
            } catch (error) {
                console.error("Cross-Origin Restriction: Cannot access iframe content", error);
                reject(error);
            }
        });
    }    

    function getMenuSelectors(iframeDocument) {
        let listItems = iframeDocument.querySelectorAll("#app > div > div.vis-col.default-width.collapse-width > ul > li");
        const menuSelectors = [];
        for (let i = 4; i < listItems.length + 4; i++) {
            menuSelectors.push(`#app > div > div.vis-col.default-width.collapse-width > ul > li:nth-child(${i}) > span > a`);
        }
        return menuSelectors;
    }
   
    async function processDocument(declaration, loadingTab, declarationCount, index) {
        return new Promise((resolve) => {
            loadingTab.innerText = `Zəhmət olmasa gözləyin. \n Bəyannamələr Yüklənir... ${index} / ${declarationCount}`;
    
            const iframe = document.createElement("iframe");
            iframe.style.display = "none";
            iframe.src = `https://new.e-taxes.gov.az/eportal/declaration/type/vat/2024.1/confirmation?reg-number=${declaration.documentNumber}`;
            document.body.appendChild(iframe);
    
            iframe.onload = async () => {
                setTimeout(async () => {
                const iframeDocument = iframe.contentWindow.document;

                const menuSelectors = getMenuSelectors(iframeDocument);
                const result = await extractDataFromIframe(iframeDocument, menuSelectors);
    
                const docNum = declaration.documentNumber;
                const docMonth = declaration.month;
                const docYear = declaration.year;
                const docDate = declaration.date;
                const docType = declaration.type;
    
                document.body.removeChild(iframe);
                resolve({ docNum, docMonth, docYear, docDate, docType, result });
            }, 2000);
            };
        });
    }
    try {
        const container = document.querySelector("div.root-view.container-fluid");
        const loadingTab = creatingLoadingTab(container);
        const allResults = [];
    
        for (let i = 0; i < documentInfos.length; i++) {
            const declaration = documentInfos[i];
            const result = await processDocument(declaration, loadingTab, documentInfos.length, i + 1);
            allResults.push(result);
        }
    
        container.removeChild(loadingTab);
        const menus = transformResultsToMenus(allResults);        
        createDeclarationTable(allResults);
    } catch (error) {
        console.error("Xəta baş verdi:", error);
    }
    
}

function transformResultsToMenus(allResults) {
    const menus = {};

    allResults.forEach(({ result }) => {
        result.forEach(({ menu, data }) => {
            const menuName = `Menu ${menu}`;

            if (!menus[menuName]) {
                menus[menuName] = [];
            }

            menus[menuName] = menus[menuName].concat(data);
        });
    });

    return menus;
}



function createDeclarationTable(allResults) {
    
    let formattedResults = [];
    const monthNames = {
        YANVAR: 1,
        FEVRAL: 2,
        MART: 3,
        APREL: 4,
        MAY: 5,
        İYUN: 6,
        İYUL: 7,
        AVQUST: 8,
        SENTYABR: 9,
        OKTYABR: 10,
        NOYABR: 11,
        DEKABR: 12
    };
    
    const sortedAllResults = allResults.sort((a, b) => {
        const monthA = monthNames[a.docMonth.trim().toUpperCase()];
        const monthB = monthNames[b.docMonth.trim().toUpperCase()];
        return monthA - monthB;
    });
    
    sortedAllResults.forEach(r => {
        let result = {
            docNum: r.docNum,
            docYear: r.docYear,
            docMonthNum: monthNames[r.docMonth.toLowerCase()],
            docMonth: r.docMonth,
            docDate: r.docDate,
            docType: r.docType,
        };
    
        r.result.forEach(menu => {
            menu.data.forEach(row => {
                const normalizedCode = 'code' + row.code.replace(/[.\-]/g, match => {
                    return match === '.' ? 'd' : 't';
                });
    
                let cleanedRow = { ...row };
                ['title','value1', 'value2', 'value3', 'value4'].forEach(key => {
                    if (typeof cleanedRow[key] === 'string') {
                        cleanedRow[key] = cleanedRow[key].replace(/\s/g, '').replace('₼', '').replace('%','');
                    }
                });
    
                result[normalizedCode] = cleanedRow;
            });
        });
    
        formattedResults.push(result);
    });
    console.log(formattedResults)

    const newTab = window.open("", "_blank");

    if (!newTab) {
        alert("Popup blocked! Please allow popups for this site.");
        return;
    }

    const tableHTML = `
<!DOCTYPE html>
<html lang="az">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Excel Data Table</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 20px;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin-bottom: 20px;
      
    }
    th, td {
      border: 2px solid rgb(150, 150, 150);
      padding: 8px;
      text-align: center;
    }
    th {
      background-color: #f2f2f2;
      position: sticky;
      top: 0;
    }
    .parent-header {
      background-color: #e6e6e6;
      text-align: center;
      font-size: 22px;
      font-weight: bold;
    }
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    .container {
      max-width: 100%;
      overflow-x: auto;
    }
  </style>
</head>
<body>
  <div class="container">
    <h2>Hesabat Cədvəli</h2>
    <table id="dataTable">
      <thead>
        <!-- Parent headers row -->
        <tr>
        <th rowspan="3" class="info-col">Sənəd №</th>
        <th rowspan="3" class="info-col">İl</th>
        <th rowspan="3" class="info-col">Ay</th>
        <th rowspan="3" class="info-col">Tarix</th>
        <th rowspan="3" class="info-col">Növ</th>
        <th colspan=2" class="parent-header">Hesabat dövrü üzrə hesablaşmalar	</th>
          <th colspan="36" class="parent-header">Hesabat dövrü üzrə vergiyə cəlb olunan əməliyyatlar üzrə əlavə dəyər vergisinin hesablanması</th>
          <th colspan="32" class="parent-header">Hesabat dövrü üzrə debitor borclarının (ƏDV nəzərə alınmadan) hərəkəti barədə məlumat</th>
          <th colspan="24" class="parent-header">Hesabat dövründəki ödənilmiş məbləğ üzrə əvəzləşdirilən əlavə dəyər vergisinin hesablanması</th>
          <th colspan="36" class="parent-header">Hesabat dövründə dəqiqləşdirilən (163-cü maddəsinə əsasən) əməliyyatlar üzrə ƏDV-nin hesablanması</th>
          <th colspan="2" class="parent-header">Əlavə 1</th>
          <th colspan="5" class="parent-header">Əlavə 2</th>
          <th colspan="72" class="parent-header">Əlavə 3</th>
          <th colspan=9" class="parent-header">Əlavə 3 2-ci hissə</th>
          <th colspan="36" class="parent-header">Əlavə 4</th>
          <th colspan="112" class="parent-header">Əlavə 5</th>
          <th colspan=2" class="parent-header">Əlavə 7</th>
          <th colspan=2" class="parent-header">Əlavə 9</th>
        </tr>
        <tr>
          
          <!-- Hesabat dövrü üzrə hesablaşmalar -->
          <th colspan="1" class="sub-header">326</th>
          <th colspan="1" class="sub-header">327</th>

          <!-- Hesabat dövrü üzrə vergiyə cəlb olunan əməliyyatlar üzrə əlavə dəyər vergisinin hesablanması -->

          <th colspan="3" class="sub-header">301</th>  
          <th colspan="3" class="sub-header">301.1</th>  
          <th colspan="3" class="sub-header">301.2</th>  
          <th colspan="3" class="sub-header">301-2</th>  
          <th colspan="3" class="sub-header">302</th>  
          <th colspan="3" class="sub-header">303</th>  
          <th colspan="3" class="sub-header">304</th>  
          <th colspan="3" class="sub-header">305</th>  
          <th colspan="3" class="sub-header">306</th>  
          <th colspan="3" class="sub-header">306.1</th>  
          <th colspan="3" class="sub-header">306.2</th>  
          <th colspan="3" class="sub-header">306.3</th> 
          
          <!-- Hesabat dövrü üzrə debitor borclarının (ƏDV nəzərə alınmadan) hərəkəti barədə məlumat -->
          <th colspan="4" class="sub-header">307</th>  
          <th colspan="4" class="sub-header">307.1</th>  
          <th colspan="4" class="sub-header">307.2</th>  
          <th colspan="4" class="sub-header">307.3</th>  
          <th colspan="4" class="sub-header">307-1</th>  
          <th colspan="4" class="sub-header">307-1.1</th>  
          <th colspan="4" class="sub-header">307-1.2</th>  
          <th colspan="4" class="sub-header">307-1.3</th>  
          
          <!-- Hesabat dövründəki ödənilmiş məbləğ üzrə əvəzləşdirilən əlavə dəyər vergisinin hesablanması -->
          <th colspan="2" class="sub-header">308</th>
          <th colspan="2" class="sub-header">308.1</th>
          <th colspan="2" class="sub-header">309</th>
          <th colspan="2" class="sub-header">310</th>
          <th colspan="2" class="sub-header">310.1</th>
          <th colspan="2" class="sub-header">311</th>
          <th colspan="2" class="sub-header">312</th>
          <th colspan="2" class="sub-header">313</th>
          <th colspan="2" class="sub-header">314</th>
          <th colspan="2" class="sub-header">315</th>
          <th colspan="2" class="sub-header">316</th>
          <th colspan="2" class="sub-header">317</th>

          <!-- Hesabat dövründə dəqiqləşdirilən (163-cü maddəsinə əsasən) əməliyyatlar üzrə ƏDV-nin hesablanması -->

          <th colspan="3" class="sub-header">318</th>
          <th colspan="3" class="sub-header">319</th>
          <th colspan="3" class="sub-header">319.1</th>
          <th colspan="3" class="sub-header">319.2</th>
          <th colspan="3" class="sub-header">319.3</th>
          <th colspan="3" class="sub-header">319.4</th>
          <th colspan="3" class="sub-header">320</th>
          <th colspan="3" class="sub-header">321</th>
          <th colspan="3" class="sub-header">322</th>
          <th colspan="3" class="sub-header">323</th>
          <th colspan="3" class="sub-header">324</th>
          <th colspan="3" class="sub-header">325</th>
          
          <!-- Əlavə 1 -->
          <th  colspan="2" class="sub-header">Cari hesabat dövründə əldə edilmiş Yük Gömrük Bəyannamələri üzrə alınmış malların ƏDV-siz ümumi dəyəri və ƏDV məbləğlərinin cəmi, manatla</th>

          <!-- Əlavə 2 -->
          <th rowspan="2" class="sub-header">Hesabat dövrünün əvvəlinə satılmamış malların (alış qiyməti ilə) məbləği</th>
          <th rowspan="2" class="sub-header">Hesabat dövrü ərzində alınmış malların (alış qiyməti ilə) məbləği (manatla)</th>
          <th rowspan="2" class="sub-header">Dövr ərzində satılmış malların (satış qiyməti ilə) məbləği</th>
          <th rowspan="2" class="sub-header">Dövrün sonuna malların (alış qiyməti ilə) qalıq məbləği</th>
          <th rowspan="2" class="sub-header">Cari hesabat dövründə satılmış mallara görə ticarət əlavəsi</th>

          
          <!-- Ətraflı kodlar (301.x) -->
          <th colspan="2" class="sub-header">301.1</th>
          <th colspan="2" class="sub-header">301.1.1</th>
          <th colspan="2" class="sub-header">301.1.1.1</th>
          <th colspan="2" class="sub-header">301.1.1.2</th>
          <th colspan="2" class="sub-header">301.1.1.3</th>
          <th colspan="2" class="sub-header">301.1.1.4</th>
          <th colspan="2" class="sub-header">301.1.1.5</th>
          <th colspan="2" class="sub-header">301.1.1.6</th>
          <th colspan="2" class="sub-header">301.1.1.7</th>
          <th colspan="2" class="sub-header">301.1.1.8</th>
          <th colspan="2" class="sub-header">301.1.1.9</th>
          <th colspan="2" class="sub-header">301.1.1.10</th>
          <th colspan="2" class="sub-header">301.1.1.11</th>
          <th colspan="2" class="sub-header">301.1.1.12</th>
          <th colspan="2" class="sub-header">301.1.1.13</th>
          <th colspan="2" class="sub-header">301.1.1.14</th>
          <th colspan="2" class="sub-header">301.1.2</th>
          <th colspan="2" class="sub-header">301.1.2.1</th>
          <th colspan="2" class="sub-header">301.1.2.2</th>
          <th colspan="2" class="sub-header">301.1.2.3</th>
          <th colspan="2" class="sub-header">301.1.2.4</th>
          <th colspan="2" class="sub-header">301.1.2.5</th>
          <th colspan="2" class="sub-header">301.1.2.6</th>
          <th colspan="2" class="sub-header">301.1.2.7</th>
          <th colspan="2" class="sub-header">301.1.2.8</th>
          <th colspan="2" class="sub-header">301.1.2.9</th>
          <th colspan="2" class="sub-header">301.1.2.10</th>
          <th colspan="2" class="sub-header">301.1.2.11</th>
          <th colspan="2" class="sub-header">301.1.2.12</th>
          <th colspan="2" class="sub-header">301.1.2.13</th>
          <th colspan="2" class="sub-header">301.1.3</th>
          <th colspan="2" class="sub-header">301.1.4</th>
          <th colspan="2" class="sub-header">301-1</th>
          <th colspan="2" class="sub-header">301-2</th>
          <th colspan="2" class="sub-header">301-3</th>
          <th colspan="2" class="sub-header">301-4</th>

          <!-- Əlavə 3 2-ci hissə -->
          <th colspan="1" class="sub-header">328</th>
          <th colspan="1" class="sub-header">329</th>
          <th colspan="1" class="sub-header">330</th>
          <th colspan="1" class="sub-header">331</th>
          <th colspan="1" class="sub-header">332</th>
          <th colspan="1" class="sub-header">333</th>
          <th colspan="1" class="sub-header">334</th>
          <th colspan="1" class="sub-header">335</th>
          <th colspan="1" class="sub-header">336</th>
          
          <!-- 302 seriyalı kodlar -->
          <th colspan="2" class="sub-header">302.1</th>
          <th colspan="2" class="sub-header">302.2</th>
          <th colspan="2" class="sub-header">302.3</th>
          <th colspan="2" class="sub-header">302.3.1</th>
          <th colspan="2" class="sub-header">302.3.2</th>
          <th colspan="2" class="sub-header">302.4</th>
          <th colspan="2" class="sub-header">302.5</th>
          <th colspan="2" class="sub-header">302.6</th>
          <th colspan="2" class="sub-header">302.6.1</th>
          <th colspan="2" class="sub-header">302.7</th>
          <th colspan="2" class="sub-header">302.8</th>
          <th colspan="2" class="sub-header">302.9</th>
          <th colspan="2" class="sub-header">302.10</th>
          <th colspan="2" class="sub-header">302.11</th>
          <th colspan="2" class="sub-header">302.12</th>
          <th colspan="2" class="sub-header">302-1</th>
          <th colspan="2" class="sub-header">302-2</th>
          <th colspan="2" class="sub-header">302-3</th>
          
          <!-- 303 seriyalı kodlar -->
          <th colspan="2" class="sub-header">303.1</th>
          <th colspan="2" class="sub-header">303.2</th>
          <th colspan="2" class="sub-header">303.3</th>
          <th colspan="2" class="sub-header">303.4</th>
          <th colspan="2" class="sub-header">303.5</th>
          <th colspan="2" class="sub-header">303.6</th>
          <th colspan="2" class="sub-header">303.7</th>
          <th colspan="2" class="sub-header">303.8</th>
          <th colspan="2" class="sub-header">303.9</th>
          <th colspan="2" class="sub-header">303.10</th>
          <th colspan="2" class="sub-header">303.11</th>
          <th colspan="2" class="sub-header">303.12</th>
          <th colspan="2" class="sub-header">303.13</th>
          <th colspan="2" class="sub-header">303.14</th>
          <th colspan="2" class="sub-header">303.15</th>
          <th colspan="2" class="sub-header">303.16</th>
          <th colspan="2" class="sub-header">303.17</th>
          <th colspan="2" class="sub-header">303.18</th>
          <th colspan="2" class="sub-header">303.19</th>
          <th colspan="2" class="sub-header">303.20</th>
          <th colspan="2" class="sub-header">303.21</th>
          <th colspan="2" class="sub-header">303.22</th>
          <th colspan="2" class="sub-header">303.23</th>
          <th colspan="2" class="sub-header">303.24</th>
          <th colspan="2" class="sub-header">303.25</th>
          <th colspan="2" class="sub-header">303.26</th>
          <th colspan="2" class="sub-header">303.27</th>
          <th colspan="2" class="sub-header">303.28</th>
          <th colspan="2" class="sub-header">303.29</th>
          <th colspan="2" class="sub-header">303.30</th>
          <th colspan="2" class="sub-header">303.31</th>
          <th colspan="2" class="sub-header">303.32</th>
          <th colspan="2" class="sub-header">303.33</th>
          <th colspan="2" class="sub-header">303.34</th>
          <th colspan="2" class="sub-header">303.35</th>
          <th colspan="2" class="sub-header">303.36</th>
          <th colspan="2" class="sub-header">303.37</th>
          <th colspan="2" class="sub-header">303.38</th>
          <th colspan="2" class="sub-header">303.39</th>
          <th colspan="2" class="sub-header">303.40</th>
          <th colspan="2" class="sub-header">303.41</th>
          <th colspan="2" class="sub-header">303.42</th>
          <th colspan="2" class="sub-header">303.43</th>
          <th colspan="2" class="sub-header">303.44</th>
          <th colspan="2" class="sub-header">303.45</th>
          <th colspan="2" class="sub-header">303.46</th>
          <th colspan="2" class="sub-header">303.47</th>
          <th colspan="2" class="sub-header">303.48</th>
          <th colspan="2" class="sub-header">303.49</th>
          <th colspan="2" class="sub-header">303.50</th>
          <th colspan="2" class="sub-header">303.51</th>
          <th colspan="2" class="sub-header">303.52</th>
          <th colspan="2" class="sub-header">303.53</th>
          <th colspan="2" class="sub-header">303-1</th>
          <th colspan="2" class="sub-header">303-2</th>
          <th colspan="2" class="sub-header">303-3</th>


          <!-- Əlavə 7 -->
          <th colspan="2" class="sub-header">Büdcəyə ödənilmiş dəyərin (ƏDV-siz) və ƏDV məbləğinin CƏMİ</th>
          
          <!-- Əlavə 9 -->
          <th colspan="2" class="sub-header">CƏMİ, manatla</th>
       
        </tr>
        <tr>
            <!-- Hesabat dövrü üzrə hesablaşmalar -->
            <th>Büdcəyə ödənilməlidir</th>
            <th>Büdcədən qaytarılır</th>


            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>
            <th>ƏDV məbləği</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>
            <th>ƏDV məbləği</th>

             <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>
            <th>ƏDV məbləği</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>
            <th>ƏDV məbləği</th>

             <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>
            <th>ƏDV məbləği</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>
            <th>ƏDV məbləği</th>

             <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>
            <th>ƏDV məbləği</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>
            <th>ƏDV məbləği</th>

             <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>
            <th>ƏDV məbləği</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>
            <th>ƏDV məbləği</th>

             <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>
            <th>ƏDV məbləği</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>
            <th>ƏDV məbləği</th>

            <th>Hesabat dövrünün əvvəlinə debitor borc məbləği</th>
            <th>Hesabat dövrü (ay) üzrə yaranan debitor borc məbləği</th>
            <th>Hesabat dövrü (ay) ərzində silinən debitor borc məbləği</th>
            <th>Hesabat dövrünün sonuna debitor borc məbləği</th>

            <th>Hesabat dövrünün əvvəlinə debitor borc məbləği</th>
            <th>Hesabat dövrü (ay) üzrə yaranan debitor borc məbləği</th>
            <th>Hesabat dövrü (ay) ərzində silinən debitor borc məbləği</th>
            <th>Hesabat dövrünün sonuna debitor borc məbləği</th>            

            <th>Hesabat dövrünün əvvəlinə debitor borc məbləği</th>
            <th>Hesabat dövrü (ay) üzrə yaranan debitor borc məbləği</th>
            <th>Hesabat dövrü (ay) ərzində silinən debitor borc məbləği</th>
            <th>Hesabat dövrünün sonuna debitor borc məbləği</th>

            <th>Hesabat dövrünün əvvəlinə debitor borc məbləği</th>
            <th>Hesabat dövrü (ay) üzrə yaranan debitor borc məbləği</th>
            <th>Hesabat dövrü (ay) ərzində silinən debitor borc məbləği</th>
            <th>Hesabat dövrünün sonuna debitor borc məbləği</th>

            <th>Hesabat dövrünün əvvəlinə debitor borc məbləği</th>
            <th>Hesabat dövrü (ay) üzrə yaranan debitor borc məbləği</th>
            <th>Hesabat dövrü (ay) ərzində silinən debitor borc məbləği</th>
            <th>Hesabat dövrünün sonuna debitor borc məbləği</th>

            <th>Hesabat dövrünün əvvəlinə debitor borc məbləği</th>
            <th>Hesabat dövrü (ay) üzrə yaranan debitor borc məbləği</th>
            <th>Hesabat dövrü (ay) ərzində silinən debitor borc məbləği</th>
            <th>Hesabat dövrünün sonuna debitor borc məbləği</th>

            <th>Hesabat dövrünün əvvəlinə debitor borc məbləği</th>
            <th>Hesabat dövrü (ay) üzrə yaranan debitor borc məbləği</th>
            <th>Hesabat dövrü (ay) ərzində silinən debitor borc məbləği</th>
            <th>Hesabat dövrünün sonuna debitor borc məbləği</th>

            <th>Hesabat dövrünün əvvəlinə debitor borc məbləği</th>
            <th>Hesabat dövrü (ay) üzrə yaranan debitor borc məbləği</th>
            <th>Hesabat dövrü (ay) ərzində silinən debitor borc məbləği</th>
            <th>Hesabat dövrünün sonuna debitor borc məbləği</th>

            <th>Ödənilmiş məbləğ (ƏDV nəzərə alınmadan)</th>
            <th>ƏDV məbləği</th>

            <th>Ödənilmiş məbləğ (ƏDV nəzərə alınmadan)</th>
            <th>ƏDV məbləği</th>

            <th>Ödənilmiş məbləğ (ƏDV nəzərə alınmadan)</th>
            <th>ƏDV məbləği</th>

            <th>Ödənilmiş məbləğ (ƏDV nəzərə alınmadan)</th>
            <th>ƏDV məbləği</th>

            <th>Ödənilmiş məbləğ (ƏDV nəzərə alınmadan)</th>
            <th>ƏDV məbləği</th>

            <th>Ödənilmiş məbləğ (ƏDV nəzərə alınmadan)</th>
            <th>ƏDV məbləği</th>

            <th>Ödənilmiş məbləğ (ƏDV nəzərə alınmadan)</th>
            <th>ƏDV məbləği</th>

            <th>Ödənilmiş məbləğ (ƏDV nəzərə alınmadan)</th>
            <th>ƏDV məbləği</th>

            <th>Ödənilmiş məbləğ (ƏDV nəzərə alınmadan)</th>
            <th>ƏDV məbləği</th>

            <th>Ödənilmiş məbləğ (ƏDV nəzərə alınmadan)</th>
            <th>ƏDV məbləği</th>

            <th>Ödənilmiş məbləğ (ƏDV nəzərə alınmadan)</th>
            <th>ƏDV məbləği</th>

            <th>Ödənilmiş məbləğ (ƏDV nəzərə alınmadan)</th>
            <th>ƏDV məbləği</th>


            <th>Dövriyyə məbləği (ƏDV nəzərə alınmadan)</th>
            <th>Ödənilmiş məbləğ (ƏDV nəzərə alınmadan)</th>
            <th>ƏDV məbləği</th>

            <th>Dövriyyə məbləği (ƏDV nəzərə alınmadan)</th>
            <th>Ödənilmiş məbləğ (ƏDV nəzərə alınmadan)</th>
            <th>ƏDV məbləği</th>

            <th>Dövriyyə məbləği (ƏDV nəzərə alınmadan)</th>
            <th>Ödənilmiş məbləğ (ƏDV nəzərə alınmadan)</th>
            <th>ƏDV məbləği</th>

            <th>Dövriyyə məbləği (ƏDV nəzərə alınmadan)</th>
            <th>Ödənilmiş məbləğ (ƏDV nəzərə alınmadan)</th>
            <th>ƏDV məbləği</th>

            <th>Dövriyyə məbləği (ƏDV nəzərə alınmadan)</th>
            <th>Ödənilmiş məbləğ (ƏDV nəzərə alınmadan)</th>
            <th>ƏDV məbləği</th>

            <th>Dövriyyə məbləği (ƏDV nəzərə alınmadan)</th>
            <th>Ödənilmiş məbləğ (ƏDV nəzərə alınmadan)</th>
            <th>ƏDV məbləği</th>

            <th>Dövriyyə məbləği (ƏDV nəzərə alınmadan)</th>
            <th>Ödənilmiş məbləğ (ƏDV nəzərə alınmadan)</th>
            <th>ƏDV məbləği</th>

            <th>Dövriyyə məbləği (ƏDV nəzərə alınmadan)</th>
            <th>Ödənilmiş məbləğ (ƏDV nəzərə alınmadan)</th>
            <th>ƏDV məbləği</th>

            <th>Dövriyyə məbləği (ƏDV nəzərə alınmadan)</th>
            <th>Ödənilmiş məbləğ (ƏDV nəzərə alınmadan)</th>
            <th>ƏDV məbləği</th>

            <th>Dövriyyə məbləği (ƏDV nəzərə alınmadan)</th>
            <th>Ödənilmiş məbləğ (ƏDV nəzərə alınmadan)</th>
            <th>ƏDV məbləği</th>

            <th>Dövriyyə məbləği (ƏDV nəzərə alınmadan)</th>
            <th>Ödənilmiş məbləğ (ƏDV nəzərə alınmadan)</th>
            <th>ƏDV məbləği</th>

            <th>Dövriyyə məbləği (ƏDV nəzərə alınmadan)</th>
            <th>Ödənilmiş məbləğ (ƏDV nəzərə alınmadan)</th>
            <th>ƏDV məbləği</th>




            <th>YGB üzrə alınmış malın ƏDV- siz dəyəri, manatla</th>
            <th>YGB üzrə alınmış malın ƏDV məbləği, manatla</th>

            

            <!--  301 codes   -->

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>
       
            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>
       
            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>
       
            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>
       
            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>VM-nin 159.2-ci maddəsinə əsasən bu Məcəllənin 167-ci və 168-ci maddələrinə uyğun olaraq Azərbaycan Respublikasınını hüdudlarından kənarda malların təqdim edilməsi, xidmətlərin göstərilməsi və işlər görülməsi üzrə əməliyyatlar</th>
            <th>VM-nin 159.5-ci maddəsinə əsasən fövqəladə hallarda, qanunvericiliklə müəyyən edilmiş təbii itki normaları daxilində zayolmadan əmələ gələn itkilər, təbii itki normaları daxilində xarabolmalar və bu kimi əskikgəlmələr üzrə məbləğ</th>
            <th>VM-nin 159.7-ci maddəsinə əsasən vergiyə cəlb olunmayan əməliyyatlar</th>
            <th>Vergi Məcəlləsinin 160-cı maddəsinə əsasən müəssisənin təqdim edilməsi</th>
            <th>Müstəqil sahibkarlıq fəaliyyəti çərçivəsində malların göndərilməsi, işlərin görülməsi və xidmətlərin göstərilməsi sayılmayan əməliyyatlar üzrə</th>
            <th>Rüsumsuz ticarət mağazalarında (Duty-Free) malların təqdim edilməsi və xidmətlərin göstərilməsi üzrə əməliyyatlar</th>
            <th>Qeyri-sahibkarlıq fəaliyyəti üzrə əməliyyatlar</th>
            <th>Pul vəsaitləri üzrə əməliyyatlar (maliyyə xidmətləri istisna olmaqla)</th>
            <th>Torpaq sahələrinin təqdim edilməsi, torpaqdan istifadə hüququnun başqasına verilməsi və torpağın icarəyə verilməsi</th>



            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>
       
            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>
       
            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>
       
            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>
       
            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>
       
            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>
       
            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>
       
            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

            <th>Təqdim edilmiş mal, iş və xidmətlərin dəyəri (ƏDV nəzərə alınmadan)</th>
            <th>Daxil olmuş məbləğ (ƏDV nəzərə alınmadan)</th>

         
            <th>Ödənilmiş ümumi dəyər (ƏDV-siz), manatla</th>
            <th>Ödənilmiş ümumi ƏDV məbləği, manatla</th>

            <th>Obyekt üzrə təqdim edilmiş malların (işlərin, xidmətlərin) dəyəri (manatla)</th>
            <th>Obyekt üzrə təqdim edilmiş mallara (işlərin, xidmətlərin) görə əldə edilmiş hasilat məbləği (manatla)</th>


        </tr>
      </thead>
        <tbody>
            ${sortedAllResults.map((r, index) => {
                        return `
                            <tr>
                                <td>${r.docNum || ''}</td>
                                <td>${r.docYear || ''}</td>
                                <td>${r.docMonth || ''}</td>
                                <td>${r.docDate || ''}</td>
                                <td>${r.docType || ''}</td>

                                <!-- Hesabat dövrü üzrə hesablaşmalar -->

                                <td>${formattedResults[index].code326?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code327?.value1 || '0,00'}</td>

                                <!-- Hesabat dövrü üzrə vergiyə cəlb olunan əməliyyatlar üzrə əlavə dəyər vergisinin hesablanması -->

                                <td>${formattedResults[index].code301?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301?.value2 || '0,00'}</td>
                                <td>${formattedResults[index].code301?.value3 || '0,00'}</td>

                                <td>${formattedResults[index].code301d1?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301d1?.value2 || '0,00'}</td>
                                <td>${formattedResults[index].code301d1?.value3 || '0,00'}</td>

                                <td>${formattedResults[index].code301d2?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301d2?.value2 || '0,00'}</td>
                                <td>${formattedResults[index].code301d2?.value3 || '0,00'}</td>

                                <td>${formattedResults[index].code301t2?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301t2?.value2 || '0,00'}</td>
                                <td>${formattedResults[index].code301t2?.value3 || '0,00'}</td>

                                <td>${formattedResults[index].code302?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code302?.value2 || '0,00'}</td>
                                <td>${formattedResults[index].code302?.value3 || '0,00'}</td>

                                <td>${formattedResults[index].code303?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303?.value2 || '0,00'}</td>
                                <td>${formattedResults[index].code303?.value3 || '0,00'}</td>

                                <td>${formattedResults[index].code304?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code304?.value2 || '0,00'}</td>
                                <td>${formattedResults[index].code304?.value3 || '0,00'}</td>

                                <td>${formattedResults[index].code305?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code305?.value2 || '0,00'}</td>
                                <td>${formattedResults[index].code305?.value3 || '0,00'}</td>

                                <td>${formattedResults[index].code306?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code306?.value2 || '0,00'}</td>
                                <td>${formattedResults[index].code306?.value3 || '0,00'}</td>

                                <td>${formattedResults[index].code306d1?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code306d1?.value2 || '0,00'}</td>
                                <td>${formattedResults[index].code306d1?.value3 || '0,00'}</td>
                                
                                <td>${formattedResults[index].code306d2?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code306d2?.value2 || '0,00'}</td>
                                <td>${formattedResults[index].code306d2?.value3 || '0,00'}</td>
                                
                                <td>${formattedResults[index].code306d3?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code306d3?.value2 || '0,00'}</td>
                                <td>${formattedResults[index].code306d3?.value3 || '0,00'}</td>
                                

                                <!-- Hesabat dövrü üzrə debitor borclarının (ƏDV nəzərə alınmadan) hərəkəti barədə məlumat -->

                                <td>${formattedResults[index].code307?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code307?.value2 || '0,00'}</td>
                                <td>${formattedResults[index].code307?.value3 || '0,00'}</td>
                                <td>${formattedResults[index].code307?.value4 || '0,00'}</td>

                                <td>${formattedResults[index].code307d1?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code307d1?.value2 || '0,00'}</td>
                                <td>${formattedResults[index].code307d1?.value3 || '0,00'}</td>
                                <td>${formattedResults[index].code307d1?.value4 || '0,00'}</td>

                                <td>${formattedResults[index].code307d2?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code307d2?.value2 || '0,00'}</td>
                                <td>${formattedResults[index].code307d2?.value3 || '0,00'}</td>
                                <td>${formattedResults[index].code307d2?.value4 || '0,00'}</td>

                                <td>${formattedResults[index].code307d3?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code307d3?.value2 || '0,00'}</td>
                                <td>${formattedResults[index].code307d3?.value3 || '0,00'}</td>
                                <td>${formattedResults[index].code307d3?.value4 || '0,00'}</td>

                                <td>${formattedResults[index].code307t1?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code307t1?.value2 || '0,00'}</td>
                                <td>${formattedResults[index].code307t1?.value3 || '0,00'}</td>
                                <td>${formattedResults[index].code307t1?.value4 || '0,00'}</td>

                                <td>${formattedResults[index].code307t1d1?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code307t1d1?.value2 || '0,00'}</td>
                                <td>${formattedResults[index].code307t1d1?.value3 || '0,00'}</td>
                                <td>${formattedResults[index].code307t1d1?.value4 || '0,00'}</td>

                                <td>${formattedResults[index].code307t1d2?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code307t1d2?.value2 || '0,00'}</td>
                                <td>${formattedResults[index].code307t1d2?.value3 || '0,00'}</td>
                                <td>${formattedResults[index].code307t1d2?.value4 || '0,00'}</td>

                                <td>${formattedResults[index].code307t1d3?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code307t1d3?.value2 || '0,00'}</td>
                                <td>${formattedResults[index].code307t1d3?.value3 || '0,00'}</td>
                                <td>${formattedResults[index].code307t1d3?.value4 || '0,00'}</td>


                                <!-- Hesabat dövründəki ödənilmiş məbləğ üzrə əvəzləşdirilən əlavə dəyər vergisinin hesablanması -->


                                <td>${formattedResults[index].code308?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code308?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code308d1?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code308d1?.value2 || '0,00'}</td>
                                
                                <td>${formattedResults[index].code309?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code309?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code310?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code310?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code310d1?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code310d1?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code311?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code311?.value2 || '0,00'}</td>
                                
                                <td>${formattedResults[index].code312?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code312?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code313?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code313?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code314?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code314?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code315?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code315?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code316?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code316?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code317?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code317?.value2 || '0,00'}</td>


                                <!-- Hesabat dövründə dəqiqləşdirilən (163-cü maddəsinə əsasən) əməliyyatlar üzrə ƏDV-nin hesablanması -->

                                <td>${formattedResults[index].code318?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code318?.value2 || '0,00'}</td>
                                <td>${formattedResults[index].code318?.value3 || '0,00'}</td>

                                <td>${formattedResults[index].code319?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code319?.value2 || '0,00'}</td>
                                <td>${formattedResults[index].code319?.value3 || '0,00'}</td>

                                <td>${formattedResults[index].code319d1?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code319d1?.value2 || '0,00'}</td>
                                <td>${formattedResults[index].code319d1?.value3 || '0,00'}</td>
                                
                                <td>${formattedResults[index].code319d2?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code319d2?.value2 || '0,00'}</td>
                                <td>${formattedResults[index].code319d2?.value3 || '0,00'}</td>
                                
                                <td>${formattedResults[index].code319d3?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code319d3?.value2 || '0,00'}</td>
                                <td>${formattedResults[index].code319d3?.value3 || '0,00'}</td>

                                <td>${formattedResults[index].code319d4?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code319d4?.value2 || '0,00'}</td>
                                <td>${formattedResults[index].code319d4?.value3 || '0,00'}</td>

                                <td>${formattedResults[index].code320?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code320?.value2 || '0,00'}</td>
                                <td>${formattedResults[index].code320?.value3 || '0,00'}</td>

                                <td>${formattedResults[index].code321?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code321?.value2 || '0,00'}</td>
                                <td>${formattedResults[index].code321?.value3 || '0,00'}</td>

                                <td>${formattedResults[index].code322?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code322?.value2 || '0,00'}</td>
                                <td>${formattedResults[index].code322?.value3 || '0,00'}</td>

                                <td>${formattedResults[index].code323?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code323?.value2 || '0,00'}</td>
                                <td>${formattedResults[index].code323?.value3 || '0,00'}</td>

                                <td>${formattedResults[index].code324?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code324?.value2 || '0,00'}</td>
                                <td>${formattedResults[index].code324?.value3 || '0,00'}</td>

                                <td>${formattedResults[index].code325?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code325?.value2 || '0,00'}</td>
                                <td>${formattedResults[index].code325?.value3 || '0,00'}</td>

                                <!-- Əlavə 1 -->
                                <td>${formattedResults[index].code903?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code903?.value2 || '0,00'}</td>


                                <!-- Əlavə 2 -->
                                <td> ${formattedResults[index].code901?.title || '0,00'}</td>
                                <td> ${formattedResults[index].code901?.value1 || '0,00'}</td>
                                <td> ${formattedResults[index].code901?.value2 || '0,00'}</td>
                                <td> ${formattedResults[index].code901?.value3 || '0,00'}</td>
                                <td> ${formattedResults[index].code901?.value4 || '0,00'}</td>



                                <!-- Əlavə 3 -->

                                <td>${formattedResults[index].code301d1S?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301d1S?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code301d1d1?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301d1d1?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code301d1d1d1?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301d1d1d1?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code301d1d1d2?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301d1d1d2?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code301d1d1d3?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301d1d1d3?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code301d1d1d4?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301d1d1d4?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code301d1d1d5?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301d1d1d5?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code301d1d1d6?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301d1d1d6?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code301d1d1d7?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301d1d1d7?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code301d1d1d8?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301d1d1d8?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code301d1d1d9?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301d1d1d9?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code301d1d1d10?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301d1d1d10?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code301d1d1d11?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301d1d1d11?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code301d1d1d12?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301d1d1d12?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code301d1d1d13?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301d1d1d13?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code301d1d1d14?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301d1d1d14?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code301d1d2?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301d1d2?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code301d1d2d1?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301d1d2d1?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code301d1d2d2?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301d1d2d2?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code301d1d2d3?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301d1d2d3?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code301d1d2d4?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301d1d2d4?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code301d1d2d5?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301d1d2d5?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code301d1d2d6?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301d1d2d6?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code301d1d2d7?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301d1d2d7?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code301d1d2d8?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301d1d2d8?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code301d1d2d9?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301d1d2d9?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code301d1d2d10?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301d1d2d10?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code301d1d2d11?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301d1d2d11?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code301d1d2d12?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301d1d2d12?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code301d1d2d13?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301d1d2d13?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code301d1d3?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301d1d3?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code301d1d4?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301d1d4?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code301t1?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301t1?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code301t2?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301t2?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code301t3?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301t3?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code301t4?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code301t4?.value2 || '0,00'}</td>


                                <!-- Əlavə 3 2-ci hissə	 -->

                                <td>${formattedResults[index].code328?.value1 || '0,00'}</td>

                                <td>${formattedResults[index].code329?.value1 || '0,00'}</td>

                                <td>${formattedResults[index].code330?.value1 || '0,00'}</td>

                                <td>${formattedResults[index].code331?.value1 || '0,00'}</td>

                                <td>${formattedResults[index].code332?.value1 || '0,00'}</td>
                                
                                <td>${formattedResults[index].code333?.value1 || '0,00'}</td>
                            
                                <td>${formattedResults[index].code334?.value1 || '0,00'}</td>
                                
                                <td>${formattedResults[index].code335?.value1 || '0,00'}</td>
                                
                                <td>${formattedResults[index].code336?.value1 || '0,00'}</td>
                                
                                <!-- Əlavə 4 -->

                                <td>${formattedResults[index].code302d1?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code302d1?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code302d2?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code302d2?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code302d3?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code302d3?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code302d3d1?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code302d3d1?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code302d3d2?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code302d3d2?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code302d4?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code302d4?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code302d5?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code302d5?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code302d6?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code302d6?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code302d6d1?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code302d6d1?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code302d7?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code302d7?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code302d8?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code302d8?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code302d9?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code302d9?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code302d10?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code302d10?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code302d11?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code302d11?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code302d12?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code302d12?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code302t1?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code302t1?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code302t2?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code302t2?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code302t3?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code302t3?.value2 || '0,00'}</td>

                                <!-- Əlavə 5 -->

                                <td>${formattedResults[index].code303d1?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d1?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d2?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d2?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d3?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d3?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d4?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d4?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d5?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d5?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d6?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d6?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d7?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d7?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d8?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d8?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d9?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d9?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d10?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d10?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d11?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d11?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d12?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d12?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d13?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d13?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d14?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d14?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d15?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d15?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d16?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d16?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d17?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d17?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d18?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d18?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d19?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d19?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d20?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d20?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d21?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d21?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d22?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d22?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d23?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d23?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d24?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d24?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d25?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d25?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d26?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d26?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d27?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d27?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d28?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d28?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d29?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d29?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d30?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d30?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d31?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d31?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d32?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d32?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d33?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d33?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d34?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d34?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d35?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d35?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d36?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d36?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d37?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d37?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d38?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d38?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d39?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d39?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d40?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d40?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d41?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d41?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d42?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d42?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d43?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d43?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d44?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d44?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d45?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d45?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d46?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d46?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d47?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d47?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d48?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d48?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d49?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d49?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d50?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d50?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d51?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d51?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d52?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d52?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303d53?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303d53?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303t1?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303t1?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303t2?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303t2?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code303t3?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code303t3?.value2 || '0,00'}</td>
                                
                                
                                <td>${formattedResults[index].code900?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code900?.value2 || '0,00'}</td>

                                <td>${formattedResults[index].code902?.value1 || '0,00'}</td>
                                <td>${formattedResults[index].code902?.value2 || '0,00'}</td>
                            </tr>
                        `;
            }).join("")}
        </tbody>
    </table>
  </div>
</body>
</html>
`

    newTab.document.write(tableHTML);
    newTab.document.close(); 

}




// Sənəd nömrələrini, tarixi və bəyannamə tipini çıxaran funksiya
function extractDocumentNumbers(vatDeclarationInnerHTML, vatDeclarationMonthAndYearInnerHTML, documentInfos) {
    vatDeclarationInnerHTML.forEach((text, index) => {
        const docMatch = text.match(/Sənəd nömrəsi:\s*(\d+)/);
        const lastUpdateDate = text.match(/Son yenilənmə tarixi:\s*(\d{2}\.\d{2}\.\d{4})/);
        const dateText = vatDeclarationMonthAndYearInnerHTML[index];
        const parts = dateText.split(/\/\s*/);

        if (docMatch && lastUpdateDate && parts.length === 2) {
            const [monthName, yearStr] = parts[0].split(" ");
            const month = monthName;
            const year = parseInt(yearStr, 10);
            const type = parts[1];
            const documentNumber = docMatch[1];
            const date = lastUpdateDate[1];

            if (month && year && type) {
                documentInfos.push({
                    year,
                    month,
                    date,
                    type,
                    documentNumber
                });
            }
        }
    });
}



function findVatDeclarationTable() {
    const h6Element = Array.from(document.querySelectorAll('h6')).find(h6 => h6.textContent.trim() === 'Əlavə dəyər vergisi');
    if (h6Element) {
        const tableTaxesName = h6Element.closest('.table-taxes-name');
        if (tableTaxesName) {
            return tableTaxesName;
        } else {
            console.error('The table-taxes-name element could not be found.');
        }
    } else {
        alert("Əlavə dəyər vergisi cədvəli tapılmadı!");
        console.error('The mentioned element with the specified text was not found.');
    }
}

// ___Declaration Fetch Functions End___//




// ___Injecting CSS Start___ 
function injectingCss(){
    
const style = document.createElement("style");
style.innerHTML = `
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    visibility: hidden;
    opacity: 0;
    transition: opacity 0.3s ease, visibility 0.3s ease;
}

.presentation-modal-body {
    background: white;
    padding: 10px;
    width: 90%;
    max-width: 95%;
    height: 80vh;
    border-radius: 8px;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
    position: relative;
    text-align: center;
    overflow:hidden
    flex-direction: column;
}

#presentation-container {
    margin-top:30px;
    max-height: 70vh;
    padding: 10px;
}
#table-outer{
    max-height:30vh;
    width:100%;
    overflow-y:auto;
}

.close-btn {
    position: absolute;
    top: 10px;
    right: 15px;
    background: #ff4d4d;
    color: white;
    border: none;
    padding: 5px 10px;
    cursor: pointer;
    border-radius: 4px;
    font-size: 14px;
}

.modal-overlay.show {
    z-index: 100000;
    visibility: visible;
    opacity: 1;
}

#presentation-header{
    display:block;
}

#fetch-tax-button{
    width: 100%;
    display:block;
}

.loading-tab {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    text-align: center;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 1.5rem;
    z-index: 1000;
}

#presentation-button{
    width: 100%;
    display: block;
}

#presentation-table {
    border: 1px solid black;
    width: 100%;
    border-collapse: collapse;
}

.example-button{
    float: left;
    font-size: 12px;
}
.newrow-button{
    float: right;
    font-size: 12px;
}

.delete-cell {
    border: 1px solid black;
    padding: 2px;
    text-align: center;
}

.delete-button-table {
    border: none;
    background: red;
    color: white;
    cursor: pointer;
    width: 100%;
    height: 100%;
}

`;
document.head.appendChild(style);
}
// ___Injecting CSS End___ //


// ____EQF Collect Function Start____ //
async function extractingData(taxLinks, loadingTab, fetchIframeContent) {
    const extractedData = [];
    const batchSize = 1;
    const delay = 30;

    for (let i = 0; i < taxLinks.length; i += batchSize) {
        loadingTab.innerText = 'Zəhmət olmasa gözləyin. \n Qaimələr Yüklənir...  ' + i + ' / ' + taxLinks.length;
        const batch = Array.from(taxLinks).slice(i, i + batchSize);
        const batchPromises = batch.map(link => {
            return fetchIframeContent(link.href)
                .then(content => {
                    extractedData.push({
                        link: link.href,
                        content
                    });
                })
                .catch(error => {
                    alert('Məlumatlar yüklənərkən xəta baş verdi! Link:', link.href, error);
                });
        });

        await Promise.all(batchPromises);
        if (i + batchSize < taxLinks.length) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    return extractedData;
}

function openDataInNewTab(data) {
    const newTab = window.open('EQF Table', '_blank');
    if (!newTab) {
        alert("Yeni tab açmaq mümkün olmadı. Zəhmət olmasa brauzerin pop-up blocker ayarlarını yoxlayın.");
        return;
    }

    const style = `
<style>
    table {
        width: 100%;
        border-collapse: collapse;
        margin: 5px 0;
        font-size: 12px;
        text-align: left;
    }
    th, td {
        padding: 4px;
        border: 1px solid #ddd;
    }
    th {
        background-color: #f4f4f4;
    }
</style>
`;

    const tableHeader = `
<tr>
    <th>№</th>
    <th>Tipi</th>
    <th>Növü</th>
    <th>EQF Statusu</th>
    <th>Təqdim/Əldə edənin VÖEN-i</th>
    <th>Təqdim/Əldə edənin adı</th>
    <th>EQF Tarixi</th>
    <th>EQF Seriyası</th>
    <th>Malın adı</th>
    <th>Malın Kodu</th>
    <th>Əmtəənin qlobal identifikasiya nömrəsi (GTIN)</th>
    <th>Ölçü Vahidi</th>
    <th>Malın miqdarı</th>
    <th>Malın buraxılış qiyməti</th>
    <th>Cəmi qiyməti</th>
    <th>Aksiz dərəcəsi(%)</th>
    <th>Aksiz məbləği(AZN)</th>
    <th>Cəmi</th>
    <th>ƏDV-yə 18 faiz dərəcə ilə cəlb edilən</th>
    <th>ƏDV-yə "0" dərəcə ilə cəlb edilən</th>
    <th>ƏDV-dən azad olunan</th>
    <th>ƏDV-yə cəlb edilməyən</th>
    <th>ƏDV məbləği</th>
    <th>Yol vergisi (manatla)</th>
    <th>Yekun məbləğ</th>
    <th>Mal/Xidmət</th>
    <th>Emala verilən mallardan istifadə edilən(silinən) malların dəyəri</th>
</tr>
`;

    let rowCounter = 1;
    let totals = Array(13).fill(0.0);

    const tableRows = data.map(entry => {
        const entryCounter = rowCounter++;
        let isProcessEqf = entry.content.eqfMainType.startsWith("Emal prosesi keçmiş");
        return entry.content.tableRows.map(row => {
            for (let i = 5; i <= 17; i++) {
                const value = row[i];
                if (value !== undefined && value !== null) {
                    const cleanedValue = value.replace(/\s/g, '').replace(',', '.');
                    totals[i - 5] += parseFloat(cleanedValue) || 0;
                }
                if ((entry.content.eqfMainType == "Malların emala yaxud saxlamaya verilməsi barədə elektron qaimə-faktura" || "Malların, işlərin və xidmətlərin təqdim edilməsi barədə elektron qaimə-faktura") && row.length < 10 && (i == 10 || i == 17)) {
                    const cleanedValue = row[7].replace(/\s/g, '').replace(',', '.');
                    totals[i - 5] += parseFloat(cleanedValue) || 0;
                }
                if ((entry.content.eqfMainType == "Malların emala yaxud saxlamaya verilməsi barədə elektron qaimə-faktura" || "Malların, işlərin və xidmətlərin təqdim edilməsi barədə elektron qaimə-faktura") && row.length > 10 && (i == 10 || i == 17)) {
                    const cleanedValue = row[8].replace(/\s/g, '').replace(',', '.');
                    totals[i - 5] += parseFloat(cleanedValue) || 0;
                }
                if (isProcessEqf) {
                    totals[3] = 0;
                } else {
                    totals[i - 5] += 0;
                }
            }

            return `
    <tr>
        <td>${entryCounter}</td>
        <td>${entry.content.eqfType || 'N/A'}</td>
        <td>${entry.content.eqfMainType || 'N/A'}</td>
        <td>${entry.content.eqfStatus || 'N/A'}</td>
        <td>${entry.content.eqfSenderVOEN || 'N/A'}</td>
        <td>${entry.content.eqfSenderName || 'N/A'}</td>
        <td>${entry.content.eqfDate || 'N/A'}</td>
        <td>${entry.content.eqfSerial || 'N/A'}</td>
        <td>${row[1]}</td>
        <td>${row[2]}</td>
        <td>${row[3] || '0'}</td>
        <td>${row[4]}</td>
        <td>${row[5]}</td>
        <td>${row[6]}</td>
        <td>${isProcessEqf ? '0' : row[7] || '0'}</td>
        <td>${isProcessEqf ? '0' : row[8] || '0'}</td>
        <td>${row[9] || '0'}</td>
        ${entry.content.eqfMainType == "Malların emala yaxud saxlamaya verilməsi barədə elektron qaimə-faktura" || "Malların, işlərin və xidmətlərin təqdim edilməsi barədə elektron qaimə-faktura" ? `<td>${row[7]}</td>` : `<td>${row[10] || '0'}</td>`}
        <td>${row[11] || '0'}</td>
        <td>${row[12] || '0'}</td>
        <td>${row[13] || '0'}</td>
        <td>${row[14] || '0'}</td>
        <td>${row[15] || '0'}</td>
        <td>${row[16] || '0'}</td>
        ${row.length < 10 ? `<td>${row[7]}</td>` : `<td>${row[17] || '0'}</td>`}
        <td>${row[2].substring(0, 2) === "99" ? "Xidmət" : "Mal"}</td>
        ${isProcessEqf ? `<td>${row[8] || '0'}</td>` : '<td>0<td>'}
    </tr>
`;
        }).join('')
    }).join('');


    const totalsRow = `
<tr>
<td colspan="12"><strong>Сəmi</strong></td>
${totals.map(total => `<td>${total.toFixed(2)}</td>`).join('')}
<td colspan="13"></td>
</tr>
`;

    const htmlContent = `
<html>
<head>
<title>EQF Table</title>
${style}
</head>
<body>
<table>
    <thead>
        ${tableHeader}
    </thead>
    <tbody>
        ${tableRows}
        ${totalsRow}
    </tbody>
</table>
</body>
</html>
`;

    newTab.document.open();
    newTab.document.write(htmlContent);
    newTab.document.close();

}

function fetchIframeContent(link) {
    return new Promise((resolve, reject) => {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = link;

        document.body.appendChild(iframe);

        const checkInterval = 200;
        const timeout = 10000;
        let elapsedTime = 0;

        const interval = setInterval(() => {
            try {
                var tableChildNum = 3;
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

                const eqfStatus = iframeDoc.querySelector('#root > div.root-view.container-fluid > div > div.wizard-content_idCHojiIPgobhUlvG70cj.wizard-content-additional > div > div > div > div.tablelist-view.pt-0.mt-4 > div > div > div > div.d-flex.align-items-center > span')
                const eqfSerial = iframeDoc.querySelector('#root > div.root-view.container-fluid > div > div.wizard-content_idCHojiIPgobhUlvG70cj.wizard-content-additional > div > div > div > div.tablelist-view.pt-0.mt-4 > div > div > h3');
                const eqfMainType = iframeDoc.querySelector('#root > div.root-view.container-fluid > div > div.wizard-content_idCHojiIPgobhUlvG70cj.wizard-content-additional > div > div > div > div.tablelist-view.pt-0.mt-4 > div > div > h6');
                const eqfType = iframeDoc.querySelector('#root > div.root-view.container-fluid > div > div.wizard-content_idCHojiIPgobhUlvG70cj.wizard-content-additional > div > div > div > div.tablelist-view.pt-0.mt-4 > div > div > div > div.d-flex.align-items-center > div')

                if (eqfMainType && eqfMainType.textContent.trim() == "Alınmış avans ödənişləri barədə elektron qaimə-faktura") {
                    tableChildNum = 5;
                }

                const eqfTable = iframeDoc.querySelector(`#simple-tabpanel-0 > div > div > table > tbody:nth-child(${tableChildNum})`)
                const isOptional = iframeDoc.querySelector('#root > div.root-view.container-fluid > div > div.wizard-content_idCHojiIPgobhUlvG70cj.wizard-content-additional > div > div > div > div:nth-child(2) > div > div.button-pack.p-3.my-3')
                var eqfSenderVoenAndName;
                var eqfDate;
                var isEqfSender;
                if (eqfTable && eqfSerial && eqfTable && eqfMainType && eqfType) {
                    if (isOptional) {
                        isEqfSender = iframeDoc.querySelector('#root > div.root-view.container-fluid > div > div.wizard-content_idCHojiIPgobhUlvG70cj.wizard-content-additional > div > div > div > div:nth-child(2) > div > div:nth-child(2) > div.w-50.text-left > div.typography.caption')
                        eqfSenderVoenAndName = iframeDoc.querySelector('#root > div.root-view.container-fluid > div > div.wizard-content_idCHojiIPgobhUlvG70cj.wizard-content-additional > div > div > div > div:nth-child(2) > div > div:nth-child(2) > div.w-50.text-left > div.mb-4.font-weight-bold.mt-2')
                        eqfDate = iframeDoc.querySelector('#root > div.root-view.container-fluid > div > div.wizard-content_idCHojiIPgobhUlvG70cj.wizard-content-additional > div > div > div > div:nth-child(2) > div > div:nth-child(3) > div:nth-child(3) > div.mb-4.font-weight-bold.mt-2')
                    } else {
                        isEqfSender = iframeDoc.querySelector('#root > div.root-view.container-fluid > div > div.wizard-content_idCHojiIPgobhUlvG70cj.wizard-content-additional > div > div > div > div:nth-child(2) > div > div:nth-child(1) > div.w-50.text-left > div.typography.caption')
                        eqfSenderVoenAndName = iframeDoc.querySelector('#root > div.root-view.container-fluid > div > div.wizard-content_idCHojiIPgobhUlvG70cj.wizard-content-additional > div > div > div > div:nth-child(2) > div > div:nth-child(1) > div.w-50.text-left > div.mb-4.font-weight-bold.mt-2')
                        eqfDate = iframeDoc.querySelector('#root > div.root-view.container-fluid > div > div.wizard-content_idCHojiIPgobhUlvG70cj.wizard-content-additional > div > div > div > div:nth-child(2) > div > div:nth-child(2) > div:nth-child(3) > div.mb-4.font-weight-bold.mt-2')
                    }
                    clearInterval(interval); // Stop polling
                    document.body.removeChild(iframe); // Clean up the iframe
                    const rows = eqfTable.querySelectorAll('tr');
                    const rowData = [];
                    rows.forEach(row => {
                        const cells = row.querySelectorAll('td');
                        const cellValues = Array.from(cells).map(cell => cell.textContent.trim());
                        rowData.push(cellValues);
                    });



                    const extractedData = {
                        isEqfSender: checkSecondWordStartsWithT(isEqfSender),
                        eqfMainType: eqfMainType.textContent.trim(),
                        eqfType: eqfType.textContent.trim(),
                        eqfStatus: eqfStatus.textContent.trim(),
                        eqfSenderVOEN: eqfSenderVoenAndName.textContent.trim().split(' / ')[0],
                        eqfSerial: eqfSerial.textContent.trim().substring(23, eqfSerial.textContent.trim().length),
                        eqfSenderName: eqfSenderVoenAndName.textContent.trim().split(' / ')[1],
                        eqfDate: eqfDate.textContent.trim().split(' ')[0],
                        tableRows: rowData
                    };




                    resolve(extractedData);
                } else if (elapsedTime >= timeout) {
                    clearInterval(interval);
                    document.body.removeChild(iframe);
                    reject(new Error('Məlumat verilmiş vaxt limitində yüklənə bilmədi'));
                }

                elapsedTime += checkInterval;
            } catch (error) {
                clearInterval(interval);
                document.body.removeChild(iframe);
                reject(new Error('Xəta baş verdi: ' + error.message));
            }
        }, checkInterval);


    });
}

function creatingFetchButton(container) {
    const btn = document.createElement('button');
    btn.id = "fetch-tax-button";
    btn.className = 'mr-2 btn btn-outline-primary';
    btn.type = 'button';
    btn.textContent = 'Bütün qaimələri çap et';
    container.prepend(btn);
    return btn;
}

function creatingLoadingTab(container) {
    const loadingTab = document.createElement('div');
    loadingTab.className = 'loading-tab'
    container.appendChild(loadingTab);
    return loadingTab;
}
// ____EQF Collect Function End___ //



// ____EQF Presentation Modal Start____ //
function creatingPresentationButton(container) {
    const btn = document.createElement('button');
    btn.id = "presentation-button";
    btn.type = 'button';
    btn.className = 'mr-2 btn btn-outline-primary';
    btn.textContent = 'Sürətli təqdim et';
    container.prepend(btn);
    return btn;
}

function creatingTable(tableContainer) {
    const headerPresentation = createHeaderPresentation(tableContainer)
   
    const tableOuter = document.createElement("div")
    tableOuter.id = "table-outer"

    const table = document.createElement("table");


    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    const headers = [
        "№", "Alıcının VÖEN-i", "Alıcının adı", "Malın kodu", "Malın adı", "ƏQİN",
        "Ölçü vahidi", "Malın miqdarı", "Malın buraxılış qiyməti", "Aksiz dərəcəsi(%)",
        "Aksiz məbləği", "Yol vergisi məbləği", "ƏDV-yə 18 faiz dərəcə ilə cəlb edilən",
        "ƏDV-yə 0 dərəcə ilə cəlb edilən məbləğ", "ƏDV-dən azad olunan", "ƏDV-yə cəlb edilməyən məbləğ", "Əlavə"
    ];

    headers.push("Sil"); // Add delete column

    headers.forEach(headerText => {
        const th = document.createElement("th");
        th.textContent = headerText;
        th.style.padding = "8px";
        th.style.fontSize = "13px";
        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    table.appendChild(tbody);

    createNewRowBtn(headerPresentation, tbody, headers);
    createExampleBtn(headerPresentation)

    function addDefaultRow() {
        const row = document.createElement("tr");
        row.style.padding = "2px";

        for (let j = 0; j < headers.length - 1; j++) {
            const cell = document.createElement("td");
            cell.contentEditable = "true";
            cell.style.border = "1px solid black";
            cell.style.padding = "2px";
            row.appendChild(cell);
        }

        addDeleteButton(row);

        tbody.appendChild(row);
    }

    addDefaultRow();
    tableOuter.append(table)
    tableContainer.appendChild(tableOuter);

    table.addEventListener("paste", (event) => {
        event.preventDefault();

        const clipboardData = event.clipboardData || window.clipboardData;
        const pastedData = clipboardData.getData("text");

        const rows = pastedData
            .split("\n")
            .filter(row => row.trim() !== "")
            .map(row => row.split("\t"));

        let activeCell = document.activeElement;
        let activeRow = activeCell?.parentElement;
        let activeRowIndex = Array.from(tbody.children).indexOf(activeRow);
        let activeColIndex = Array.from(activeRow?.children || []).indexOf(activeCell);

        if (!activeCell || activeRowIndex === -1 || activeColIndex === -1) return;

        let existingRows = Array.from(tbody.children);

        rows.forEach((rowData, rowIndex) => {
            let row;
            let targetRowIndex = activeRowIndex + rowIndex; // Start from selected row

            if (existingRows[targetRowIndex]) {
                row = existingRows[targetRowIndex];
            } else {
                addDefaultRow();
                row = tbody.lastChild;
                existingRows.push(row);
            }

            rowData.forEach((cellData, colIndex) => {
                let targetColIndex = activeColIndex + colIndex;
                if (targetColIndex < headers.length - 1) { // Prevent overflow
                    row.children[targetColIndex].textContent = cellData;
                }
            });
        });
    });

    return tbody;
}

function createHeaderPresentation(tableContainer){
    const headerPresentation = document.createElement("div");
    headerPresentation.id = "presentation-header"
    const title = document.createElement("h6");
    title.textContent = "Təqdim etmə cədvəli";
    headerPresentation.append(title);

    tableContainer.append(headerPresentation);
    return headerPresentation;
}

function createNewRowBtn(headerPresentation, tbody, headers) {
    const newRowBtn = document.createElement("button");
    newRowBtn.className = "mt-2 mb-2 btn btn-outline-primary newrow-button";
    newRowBtn.textContent = "Yeni sətir əlavə et";

    newRowBtn.addEventListener("click", () => {
        const row = document.createElement("tr");
        row.style.padding = "2px";

        for (let j = 0; j < headers.length -1; j++) {
            const cell = document.createElement("td");
            cell.contentEditable = "true";
            cell.style.border = "1px solid black";
            cell.style.padding = "2px";
            row.appendChild(cell);
        }

        addDeleteButton(row);

        tbody.appendChild(row);
    });

    headerPresentation.append(newRowBtn);
}

function createExampleBtn(headerPresentation){
    const exampleBtn = document.createElement("button");
    exampleBtn.className = "mt-2 mb-2 btn btn-outline-primary example-button";
    exampleBtn.textContent = "Nümunəni yükləyin";

    exampleBtn.addEventListener("click", function() {
        const fileUrl = chrome.runtime.getURL("assets/files/example.xlsx");
        const link = document.createElement("a");
        link.href = fileUrl;
        link.download = "example.xlsx"; 
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
    

    headerPresentation.appendChild(exampleBtn)
}

function addDeleteButton(row) {
    const deleteCell = document.createElement("td");
    const deleteButton = document.createElement("button");
    deleteCell.className = "delete-cell"
    deleteButton.className = "delete-button-table"
    deleteButton.textContent = "❌";

    deleteButton.onclick = () => row.remove();

    deleteCell.appendChild(deleteButton);
    row.appendChild(deleteCell);
}

function createProcessButton(tbody) {
    const processButton = document.createElement("button");
    processButton.id = 'process-btn'
    processButton.className = 'mt-4 btn btn-outline-primary';
    processButton.textContent = "Qaimələri paketlə";

    processButton.addEventListener("click", async () => {
        const table = tbody.closest("table");
        const rows = Array.from(table.querySelectorAll("tbody tr"));

        const tableData = rows.map(row => {
            const cells = Array.from(row.querySelectorAll("td"));
            const rowData = cells.map(cell => cell.textContent.trim());
            if (rowData.some(cell => cell === "")) {
                alert("Cədvəldə boş xana var! Zəhmət olmasa, bütün xanaları doldurun.");
                throw new Error("Boş xana aşkarlandı");
            }
            return rowData;
        });
        

        const groupRowsByInvoice = (tableData) => {
            const invoices = [];
            let currentInvoice = [];
            let currentInvoiceNumber = null;

            tableData.forEach(row => {
                const invoiceNumber = row[0];
                if (invoiceNumber !== currentInvoiceNumber) {
                    if (currentInvoice.length > 0) {
                        invoices.push(currentInvoice);
                    }
                    currentInvoice = [row];
                    currentInvoiceNumber = invoiceNumber;
                } else {
                    currentInvoice.push(row);
                }
            });

            if (currentInvoice.length > 0) {
                invoices.push(currentInvoice);
            }
            return invoices;
        };

        const generateNewXML = (invoiceData) => `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="#stylesheet"?>
<!DOCTYPE root [ <!ATTLIST xsl:stylesheet id ID #REQUIRED>
]>
<root xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="304" kod="QAIME_1"
	xsi:noNamespaceSchemaLocation="QAIME_1.xsd">
	<xsl:stylesheet id="stylesheet" version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
		<xsl:template match="xsl:stylesheet" />
		<xsl:template match="/root">
			<html>

			<head>
				<style>
					body {
						background-color: white;
						font-family: Arial, sans-serif;
					}

					.paper {
						padding: 5px;
					}

					table {
						width: 100%;
						font-size: 16px;
					}

					table tr td {
						padding: 10px 15px;
						text-align: left;
						width: 50%;
					}

					.products table {
						border-collapse: collapse;
						font-size: 14px;
					}

					.products table th,
					#products table td {
						border: 1px solid #000;
						padding: 10px;
					}

					.products table td {
						width: auto;
						border: 1px solid #000;
						text-align: center;
					}

					.products table th {
						text-align: center;
					}

					.noPadding {
						padding: 40px 0px;
					}

					.total tr :nth-child(odd) {
						width: 40%;
					}

					.total tr :nth-child(even) {
						width: 10%;
					}
				</style>
			</head>

			<body>
				<table class="paper">
					<tr>
						<td>Alan tərəfin VÖEN-i:</td>
						<td>
							<xsl:value-of select="qaimeKime" />
						</td>
					</tr>
					<tr>
						<td>Alan tərəfin adı:</td>
						<td>
							<xsl:value-of select="qaimeKimeAd" />
						</td>
					</tr>
					<tr>
						<td>Satan tərəfin VÖEN-i:</td>
						<td>
							<xsl:value-of select="qaimeKimden" />
						</td>
					</tr>
					<tr>
						<td>Qeyd</td>
						<td>
							<xsl:value-of select="des" />
						</td>
					</tr>
					<tr>
						<td>Əlavə qeyd</td>
						<td>
							<xsl:value-of select="des2" />
						</td>
					</tr>
					<tr>
						<td>Obyektin adı</td>
						<td>
							<xsl:value-of select="ma" />
						</td>
					</tr>
					<tr>
						<td>Obyektin kodu</td>
						<td>
							<xsl:value-of select="mk" />
						</td>
					</tr>
					<tr>
						<td class="products noPadding" colspan="2">
							<table>
								<thead>
									<th>Mal kodu</th>
									<th>Mal adı</th>
									<th>Bar kod</th>
									<th>Ölçü vahidi</th>
									<th>Malın miqdarı</th>
									<th>Malın buraxılış qiyməti</th>
									<th>Cəmi qiyməti</th>
									<th>Aksiz dərəcəsi</th>
									<th>Aksiz məbləği</th>
									<th>Cəmi məbləğ</th>
									<th>ƏDV-yə cəlb edilən məbləğ</th>
									<th>ƏDV-yə cəlb edilməyən məbləğ</th>
									<th>ƏDV-dən azad olunan</th>
									<th>ƏDV-yə 0 dərəcə ilə cəlb edilən məbləğ</th>
									<th>Ödənilməli ƏDV</th>
									<th>Yol vergisi məbləği</th>
									<th>Yekun məbləğ</th>
								</thead>
								<tbody class="productTable">
									<xsl:for-each select="product/qaimeTable/row">
										<tr>
											<td>
												<xsl:value-of select="c1" />
											</td>
											<td>
												<xsl:value-of select="c2" />
											</td>
											<td>
												<xsl:value-of select="c17" />
											</td>
											<td>
												<xsl:value-of select="c3" />
											</td>
											<td>
												<xsl:value-of select="c4" />
											</td>
											<td>
												<xsl:value-of select="c5" />
											</td>
											<td>
												<xsl:value-of select="c6" />
											</td>
											<td>
												<xsl:value-of select="c7" />
											</td>
											<td>
												<xsl:value-of select="c8" />
											</td>
											<td>
												<xsl:value-of select="c9" />
											</td>
											<td>
												<xsl:value-of select="c10" />
											</td>
											<td>
												<xsl:value-of select="c11" />
											</td>
											<td>
												<xsl:value-of select="c12" />
											</td>
											<td>
												<xsl:value-of select="c13" />
											</td>
											<td>
												<xsl:value-of select="c14" />
											</td>
											<td>
												<xsl:value-of select="c15" />
											</td>
											<td>
												<xsl:value-of select="c16" />
											</td>
										</tr>
									</xsl:for-each>
								</tbody>
							</table>
						</td>
					</tr>
				</table>
				<table class="total">
					<tr>
						<td>Malların cəmi qiyməti</td>
						<td>
							<xsl:value-of select="product/qaimeYekunTable/row/c1" />
						</td>
						<td>Malların cəmi məbləği</td>
						<td>
							<xsl:value-of select="product/qaimeYekunTable/row/c3" />
						</td>
					</tr>
					<tr>
						<td>Malların aksiz cəmi məbləği</td>
						<td>
							<xsl:value-of select="product/qaimeYekunTable/row/c2" />
						</td>
						<td>Malların ƏDV-yə cəlb edilən cəmi məbləği</td>
						<td>
							<xsl:value-of select="product/qaimeYekunTable/row/c4" />
						</td>
					</tr>
					<tr>
						<td>Malların cəmi ödənilməli ƏDV məbləği</td>
						<td>
							<xsl:value-of select="product/qaimeYekunTable/row/c8" />
						</td>
						<td>Malların ƏDV-yə cəlb edilməyən cəmi məbləği </td>
						<td>
							<xsl:value-of select="product/qaimeYekunTable/row/c5" />
						</td>
					</tr>
					<tr>
						<td>ƏDV-dən azad olunan</td>
						<td>
							<xsl:value-of select="product/qaimeYekunTable/row/c6" />
						</td>
						<td>Malların ƏDV-yə 0 dərəcə ilə cəlb edilən cəmi məbləği</td>
						<td>
							<xsl:value-of select="product/qaimeYekunTable/row/c7" />
						</td>
					</tr>
					<tr>
						<td>Yekun məbləğ</td>
						<td>
							<xsl:value-of select="product/qaimeYekunTable/row/c9" />
						</td>
						<td></td>
						<td></td>
					</tr>
				</table>
			</body>

			</html>
		</xsl:template>
	</xsl:stylesheet>
	<qaimeKime>${invoiceData.buyerTaxId}</qaimeKime>
	<qaimeKimden>${senderVoen}</qaimeKimden>
	<ds />
	<dn />
	<des>Müqaviləyə əsasən</des>
	<des2>${invoiceData.additionalNote}</des2>
	<ma>${invoiceData.buyerName}</ma>
	<mk />
	<product>
		<qaimeTable>
        ${invoiceData.products.map(product => `
            <row no="0">
                <c1>${product.code}</c1>
                <c2>${product.name}</c2>
          	    <c3>${product.unit}</c3>
				<c4>${product.quantity}</c4>
				<c5>${product.price}</c5>
				<c6>${(parseFloat(product.quantity) * parseFloat(product.price)).toFixed(2)}</c6>
				<c7>${product.exciseRate}</c7>
				<c8>${product.exciseTotal}</c8>
				<c9>${((parseFloat(product.quantity) * parseFloat(product.price)) + parseFloat(product.exciseTotal)).toFixed(2) }</c9>
				<c10>${product.edv18}</c10>
				<c11>${product.edvNot}</c11>
				<c12>${product.edvFree}</c12>
				<c13>${product.edv0}</c13>
				<c14>${(parseFloat(product.edv18) * 0.18).toFixed(2)}</c14>
				<c15>${product.roadTax}</c15>
				<c16>${(preciseMultiplier(product.quantity,product.price) + parseFloat(product.exciseTotal) + parseFloat((parseFloat(product.edv18) * 0.18).toFixed(2)) + parseFloat(product.roadTax)).toFixed(2)}</c16>
				<c17>${product.barCode}</c17>
				<productId>0</productId>
            </row>
            `).join('')}
        
		</qaimeTable>
		<qaimeYekunTable>
			<row>
				<c1>${invoiceData.allTotal}</c1>
				<c2>${invoiceData.exciseAllTotal}</c2>
				<c3>${invoiceData.allTotalWithExcise}</c3>
				<c4>${invoiceData.edv18Total}</c4>
				<c5>${invoiceData.edvNotTotal}</c5>
				<c6>${invoiceData.edvFreeTotal}</c6>
				<c7>${invoiceData.edv0Total}</c7>
				<c8>${invoiceData.edvPayAllTotal}</c8>
				<c9>${invoiceData.lastTotal}</c9>
				<c10>0.0000</c10>
			</row>
		</qaimeYekunTable>
	</product>
</root>`;

        const groupedInvoices = groupRowsByInvoice(tableData);
        const xmlFiles = [];
        const senderVoen = getVoenOfSender();
        const today = new Date();
        const formattedDate = today.toISOString().slice(0, 10).replace(/-/g, '');
        for (let index = 0; index < groupedInvoices.length; index++) {
            const invoiceRows = groupedInvoices[index];

            const allTotal = invoiceRows.reduce((acc, row) => acc + parseFloat(formatNumber(row[7])) * parseFloat(formatNumber(row[8])), 0);
            const exciseAllTotal = invoiceRows.reduce((acc, row) => acc + parseFloat(formatNumber(row[10])), 0);
            const allTotalWithExcise = allTotal + exciseAllTotal;
            const roadTaxTotal = invoiceRows.reduce((acc, row) => acc + parseFloat(formatNumber(row[7])) * parseFloat(formatNumber(row[11])), 0);
            const edv0Total = invoiceRows.reduce((acc, row) => acc + parseFloat(formatNumber(row[13])), 0);
            const edvFreeTotal = invoiceRows.reduce((acc, row) => acc + parseFloat(formatNumber(row[14])), 0);
            const edvNotTotal = invoiceRows.reduce((acc, row) => acc + parseFloat(formatNumber(row[15])), 0);

            const edv18Total = invoiceRows.reduce((acc, row) => acc + parseFloat(formatNumber(row[12])), 0) /* - edvFreeTotal - edv0Total */;
            const edvPayAllTotal = (edv18Total * 0.18).toFixed(2);
            const lastTotal = (allTotalWithExcise + roadTaxTotal + parseFloat(edvPayAllTotal)).toFixed(2);

            const invoiceData = {
                buyerTaxId: invoiceRows[0][1],
                buyerName: invoiceRows[0][2],
                sellerTaxId: senderVoen,
                note: "Alqı-satqı müqaviləsi",
                additionalNote: invoiceRows[0][16],
                products: invoiceRows.map(row => ({
                    code: row[3],
                    name: row[4],
                    barCode: row[5],
                    unit: row[6],
                    quantity:  formatNumber(row[7]), 
                    price: formatNumber(row[8]),
                    exciseRate: formatNumber(row[9]),
                    exciseTotal: formatNumber(row[10]),   
                    roadTax: formatNumber(row[11]),
                    edv18: formatNumber(row[12]),
                    edv0: formatNumber(row[13]),
                    edvFree: formatNumber(row[14]),
                    edvNot: formatNumber(row[15]),
                    productTotal: preciseMultiplier(row[7],row[8])
                })),
                allTotal: allTotal.toFixed(2),
                exciseAllTotal: exciseAllTotal.toFixed(2),
                allTotalWithExcise: allTotalWithExcise.toFixed(2),
                edvFreeTotal: edvFreeTotal.toFixed(2),
                edvNotTotal: edvNotTotal.toFixed(2),
                edv0Total: edv0Total.toFixed(2),
                edv18Total: edv18Total.toFixed(2),
                edvPayAllTotal: edvPayAllTotal,
                lastTotal: lastTotal
            };

            const xmlContent = generateNewXML(invoiceData);
            xmlFiles.push({
                filename: `C_QAIME_${index + 1}_${senderVoen}_${invoiceData.buyerTaxId}_${formattedDate}_v_304.xml`,
                content: xmlContent
            });
        }


        chrome.storage.local.set({
            xmlContent: xmlFiles
        }, () => {});
    });

    return processButton;
}

function createModalForPresentation() {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";

    const modalBody = document.createElement("div");
    modalBody.className = "presentation-modal-body";

    const closeButton = document.createElement("button");
    closeButton.className = "close-btn";
    closeButton.innerHTML = "✖";
    closeButton.onclick = closeModal;

    const tableContainer = document.createElement("div");
    tableContainer.id = "presentation-container";
    
    const tbody = creatingTable(tableContainer);
    const processButton = createProcessButton(tbody);

    tableContainer.appendChild(processButton);
    modalBody.appendChild(tableContainer);
    modalBody.appendChild(closeButton);
    overlay.appendChild(modalBody);
    document.body.appendChild(overlay);

    setTimeout(() => overlay.classList.add("show"), 10);
}

function openModal() {
    if (!document.querySelector(".modal-overlay")) {
        createModalForPresentation();
    }
    getVoenOfSender()
}

function closeModal() {
    const overlay = document.querySelector(".modal-overlay");
    if (overlay) {
        overlay.classList.remove("show");
        setTimeout(() => overlay.remove(), 300);
    }
}

// ____EQF Presentation Modal End____ //


// ____Helper functions Start____ //
function getVoenOfSender() {
    const jwtToken = localStorage.getItem('aztax-jwt');
    const voen = getVoenFromJwt(jwtToken);

    if (voen) {
        return voen;
    } else {
        console.warn('VOEN not found in the JWT payload');
        return null;
    }

    function base64UrlDecode(base64Url) {
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const decodedData = atob(base64);
        return decodedData;
    }

    function getVoenFromJwt(jwt) {
        if (!jwt) {
            console.error('JWT is missing');
            return null;
        }

        const parts = jwt.split('.');
        if (parts.length !== 3) {
            console.error('Invalid JWT structure');
            return null;
        }

        const payload = parts[1];
        const decodedPayload = base64UrlDecode(payload);

        try {
            const parsedPayload = JSON.parse(decodedPayload);
            return parsedPayload.voen;
        } catch (error) {
            console.error('Failed to parse JWT payload:', error);
            return null;
        }
    }

}

function formatNumber(value) {
    if (typeof value === "string") {
        value = value.replace(",", "."); 
    }

    let num = Number(value);
    if (isNaN(num)) return "Invalid Number"; 

    return Number.isInteger(num) ? num.toString() : num.toFixed(2);
}

function preciseMultiplier(a, b) {
    return parseFloat((parseNumber(a) * parseNumber(b)).toFixed(2));
};

function parseNumber(value) {
    if (typeof value === "string") {
        value = value.replace(",", ".");
    }
    let num = parseFloat(value);
    return isNaN(num) ? 0 : num; 
}

function checkSecondWordStartsWithT(html) {
    const trimmedString = html.textContent.trim()
    const words = trimmedString.split(' ');

    if (words.length > 1 && words[1].toLowerCase().startsWith('t')) {
        return true;
    } else {
        return false;
    }
}
// ____Helper functions End____ //
