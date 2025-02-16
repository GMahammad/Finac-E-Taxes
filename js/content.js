chrome.storage.local.get(['authenticated'], (result) => {
    if (result.authenticated) {
        const observeUrlChanges = () => {

            const handleUrlChange = () => {
                const currentUrl = window.location.href;
                if (currentUrl && currentUrl.includes('https://new.e-taxes.gov.az/eportal/az/invoice')) {
                    startObserving();
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
                handleUrlChange(); // Check URL after replaceState
            };

            window.onpopstate = function () {
                handleUrlChange();
            };

        };

        const initializeButton = () => {
            const container = document.querySelector(".vhf-page-list-controls-sort-right");
            if (container && (!document.querySelector("#fetch-tax-button") && !document.querySelector("#presentation-button"))) {
                fetchButton(container);
            }
        };

        const observePageChanges = () => {
            const observer = new MutationObserver(() => {
                initializeButton();
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
            });
            initializeButton();
        };

        const startObserving = () => {
            observePageChanges();
        };


        function fetchButton(container) {
            const btnTax = creatingFetchButton(container);
            const btnPresent = creatingPresentationButton(container);
            btnTax.addEventListener('click', async () => {
                const taxLinks = document.querySelectorAll('a[href^="/eportal/az/invoice/view/"]');
                if (taxLinks.length === 0) {
                    alert("Heç bir elektron qaimə fakturası tapılmadı.");
                    return;
                }

                const loadingTab = creatingLoadingTab(container);
                const extractedData = [];
                const batchSize = 1;
                const delay = 30

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
                container.removeChild(loadingTab);
                openDataInNewTab(extractedData)
            });
            btnPresent.addEventListener("click", async () => {

                openModal();

                // const listContainer = document.querySelector(".list-view");
                // if (listContainer && !document.querySelector("#presentation-table")) {

                // }
            });


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

        function checkSecondWordStartsWithT(html) {
            const trimmedString = html.textContent.trim()
            const words = trimmedString.split(' ');

            if (words.length > 1 && words[1].toLowerCase().startsWith('t')) {
                return true;
            } else {
                return false;
            }
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

        observeUrlChanges();
    } else {
        console.log("User signed out!")
    }
})

// ____EQF Collect Function Start____ //

function creatingFetchButton(container) {
    const btn = document.createElement('button');
    btn.id = "fetch-tax-button";
    btn.type = 'button';
    btn.className = 'mr-2 btn btn-outline-primary';
    btn.style.width = '100%';
    btn.textContent = 'Bütün qaimələri çap et';
    btn.style.display = 'block'
    container.prepend(btn);
    return btn;
}

function creatingLoadingTab(container) {
    const loadingTab = document.createElement('div');
    loadingTab.className = 'loading-tab'
    loadingTab.style.position = 'fixed';
    loadingTab.style.top = '0';
    loadingTab.style.left = '0';
    loadingTab.style.width = '100%';
    loadingTab.style.height = '100%';
    loadingTab.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    loadingTab.style.color = 'white';
    loadingTab.style.textAlign = 'center';
    loadingTab.style.display = 'flex';
    loadingTab.style.justifyContent = 'center';
    loadingTab.style.alignItems = 'center';
    loadingTab.style.fontSize = '1.5rem';
    loadingTab.style.zIndex = '1000';
    container.appendChild(loadingTab);
    return loadingTab;
}

// ____EQF Collect Function End____ //

function creatingPresentationButton(container) {
    const btn = document.createElement('button');
    btn.id = "presentation-button";
    btn.type = 'button';
    btn.className = 'mr-2 btn btn-outline-primary';
    btn.style.width = '100%';
    btn.textContent = 'Sürətli təqdim et';
    btn.style.display = 'block'
    container.prepend(btn);
    return btn;
}

function creatingTable(tableContainer) {
    const title = document.createElement("h6");
    title.textContent = "Təqdim etmə cədvəli";
    tableContainer.append(title);
    tableContainer.id = "presentation-container";
    const table = document.createElement("table");
    table.id = "presentation-table";
    table.style.border = "1px solid black";
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";

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

    createNewRowBtn(tableContainer, tbody, headers);

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

    tableContainer.appendChild(table);

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

function createNewRowBtn(tableContainer, tbody, headers) {
    const newRowBtn = document.createElement("button");
    newRowBtn.className = "mt-2 mb-2 btn btn-outline-primary";
    newRowBtn.textContent = "Yeni sətir əlavə et";
    newRowBtn.style.float = "right";
    newRowBtn.style.fontSize = "12px";

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

    tableContainer.append(newRowBtn);
}

function addDeleteButton(row) {
    const deleteCell = document.createElement("td");
    const deleteButton = document.createElement("button");
    deleteCell.style.border = "1px solid black"; 
    deleteCell.style.padding = "2px"; 
    deleteCell.style.textAlign = "center";
    deleteButton.textContent = "❌";
    deleteButton.style.border = "none";
    deleteButton.style.background = "red";
    deleteButton.style.color = "white";
    deleteButton.style.cursor = "pointer";
    deleteButton.style.width = "100%";
    deleteButton.style.height = "100%";
    deleteButton.onclick = () => row.remove();

    deleteCell.appendChild(deleteButton);
    row.appendChild(deleteCell);
}

function createProcessButton(tbody) {
    const processButton = document.createElement("button");
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

function parseNumber(value) {
    if (typeof value === "string") {
        value = value.replace(",", ".");
    }
    let num = parseFloat(value);
    return isNaN(num) ? 0 : num; 
}

const preciseMultiplier = (a, b) => {
    return parseFloat((parseNumber(a) * parseNumber(b)).toFixed(2));
};

function formatNumber(value) {
    if (typeof value === "string") {
        value = value.replace(",", "."); 
    }

    let num = Number(value);
    if (isNaN(num)) return "Invalid Number"; 

    return Number.isInteger(num) ? num.toString() : num.toFixed(2);
}

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
    
    const tbody = creatingTable(tableContainer);
    const processButton = createProcessButton(tbody);
    tableContainer.appendChild(processButton);
    modalBody.appendChild(tableContainer);

    modalBody.appendChild(closeButton);
    overlay.appendChild(modalBody);
    document.body.appendChild(overlay);

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
        display: flex;
        overflow:hidden
        flex-direction: column;
    }

    #presentation-container {
        margin-top:30px;
        flex-grow: 1;
        overflow-y: auto;
        max-height: 70vh;
        padding: 10px;
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
`;
    document.head.appendChild(style);

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