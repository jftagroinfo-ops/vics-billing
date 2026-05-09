/* --- UNIVERSAL CUSTOM EXCEL REPORT BUILDER --- */

window.REPORT_SCHEMAS = {
    'docs': [
        { id: 'no', label: 'Invoice No.' },
        { id: 'date', label: 'Date', type: 'date' },
        { id: 'status', label: 'Status' },
        { id: 'type', label: 'Doc Type' },
        { id: 'buyer', label: 'Buyer Name' },
        { id: 'destination', label: 'Destination' },
        { id: 'currency', label: 'Currency' },
        { id: 'grandTotal', label: 'Grand Total', type: 'number' }
    ],
    'expenses': [
        { id: 'date', label: 'Date', type: 'date' },
        { id: 'category', label: 'Category' },
        { id: 'party', label: 'Party / Vendor' },
        { id: 'amount', label: 'Amount', type: 'number' },
        { id: 'paymentMethod', label: 'Payment Method' },
        { id: 'remarks', label: 'Remarks' }
    ],
    'inventory': [
        { id: 'name', label: 'Item Name' },
        { id: 'cat', label: 'Category' },
        { id: 'currentQty', label: 'Total Stock Qty', type: 'number' },
        { id: 'unit', label: 'UOM' },
        { id: 'avgCost', label: 'Average Cost', type: 'number' },
        { id: 'totalValue', label: 'Total Valuation', type: 'number' }
    ],
    'log_containers': [
        { id: 'no', label: 'Container No.' },
        { id: 'size', label: 'Size/Type' },
        { id: 'status', label: 'Status' },
        { id: 'pol', label: 'Port of Loading' },
        { id: 'pod', label: 'Port of Discharge' },
        { id: 'eta', label: 'ETA', type: 'date' },
        { id: 'seal', label: 'Seal Number' }
    ]
};

window.renderReportBuilder = function() {
    console.log("Report Builder initialized.");
    setReportDateRange('this_month');
};

window.setReportDateRange = function(range) {
    const startEl = document.getElementById('report-date-start');
    const endEl = document.getElementById('report-date-end');
    if (!startEl || !endEl) return;

    const today = new Date();
    let start, end;

    if (range === 'this_month') {
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else if (range === 'last_month') {
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
    } else if (range === 'ytd') {
        start = new Date(today.getFullYear(), 0, 1);
        end = today;
    }

    startEl.value = start.toISOString().split('T')[0];
    endEl.value = end.toISOString().split('T')[0];
};

window.populateReportFields = function() {
    const src = document.getElementById('report-source-select').value;
    const container = document.getElementById('report-fields-container');
    if (!src || !window.REPORT_SCHEMAS[src]) return;

    const schema = window.REPORT_SCHEMAS[src];
    
    container.innerHTML = schema.map(field => `
        <label style="display:flex; align-items:center; gap:8px; background:var(--surface); padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border); cursor:pointer; width: calc(50% - 6px);">
            <input type="checkbox" class="report-field-cb" value="${escapeHTML(field.id)}" data-label="${escapeHTML(field.label)}" checked>
            <span style="font-size:0.9rem; font-weight:bold; color:var(--text);">${escapeHTML(field.label)}</span>
        </label>
    `).join('');
};

window.toggleAllReportFields = function(state) {
    document.querySelectorAll('.report-field-cb').forEach(cb => cb.checked = state);
};

window.executeReportGeneration = function() {
    if (typeof XLSX === 'undefined') {
        alert("Excel engine (XLSX.js) not loaded. Are you offline without cache?");
        return;
    }

    const src = document.getElementById('report-source-select').value;
    if (!src) {
        alert("Please select a Data Source first.");
        return;
    }

    const startDateStr = document.getElementById('report-date-start').value;
    const endDateStr = document.getElementById('report-date-end').value;

    const cbs = document.querySelectorAll('.report-field-cb:checked');
    if (cbs.length === 0) {
        alert("Please select at least one column to export.");
        return;
    }

    let columns = [];
    cbs.forEach(cb => {
        columns.push({ id: cb.value, label: cb.getAttribute('data-label') });
    });

    if (!window.db || !window.db[src]) {
        alert("No data found for this module in the database.");
        return;
    }

    let rawData = window.db[src];

    // --- APPLY DATE FILTER IF APPLICABLE ---
    let startTimestamp = 0;
    let endTimestamp = Number.MAX_SAFE_INTEGER;
    
    if (startDateStr) startTimestamp = new Date(startDateStr).getTime();
    if (endDateStr) {
        const d = new Date(endDateStr);
        d.setHours(23, 59, 59, 999);
        endTimestamp = d.getTime();
    }

    let filteredData = rawData.filter(row => {
        let rowDateStr = row.date || row.eta || row.createdAt || null;
        if (!rowDateStr) return true; // Include if no date field
        
        let rowTime = new Date(rowDateStr).getTime();
        if (isNaN(rowTime)) return true;
        
        return rowTime >= startTimestamp && rowTime <= endTimestamp;
    });

    if (filteredData.length === 0) {
        alert("No records found matching the specified date range.");
        return;
    }

    // --- BUILD EXCEL ROWS ---
    const excelRows = [];
    
    filteredData.forEach(row => {
        let exportRow = {};
        columns.forEach(col => {
            let val = row[col.id];
            
            // Format arrays or objects safely
            if (Array.isArray(val)) val = val.join(', ');
            else if (typeof val === 'object' && val !== null) val = JSON.stringify(val);
            
            if (src === 'inventory' && col.id === 'totalValue') {
                val = (parseFloat(row.currentQty) || 0) * (parseFloat(row.avgCost) || 0);
            }
            
            exportRow[col.label] = (val !== undefined && val !== null) ? val : '';
        });
        excelRows.push(exportRow);
    });

    // --- GENERATE WORKBOOK ---
    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report Data");

    // Enhance Column Widths
    const colWidths = columns.map(() => ({ wch: 18 }));
    worksheet["!cols"] = colWidths;

    const companyPrefix = (window.db && window.db.profile && window.db.profile.name) ? window.db.profile.name.replace(/[^a-z0-9]/gi, '_') : 'Company';
    const fileName = `${companyPrefix}_${src.toUpperCase()}_Report_${new Date().toISOString().split('T')[0]}.xlsx`;

    XLSX.writeFile(workbook, fileName);
    if(typeof Enterprise !== 'undefined') Enterprise.notify("Excel Report Compiled & Downloaded!", "success");
};
