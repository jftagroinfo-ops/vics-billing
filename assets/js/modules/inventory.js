/* --- ADVANCED INVENTORY, PO, SALES CONTRACT & LOGISTICS SYNC MODULE --- */

// Native db definition safeguard to prevent crash on early load
window.db = window.db || {};

if (!db.inventory) db.inventory = [];
if (!db.inventory_log) db.inventory_log = [];
if (!db.po) db.po = [];
if (!db.stock_loss) db.stock_loss = [];
if (!db.log_trucks) db.log_trucks = [];
if (!db.log_containers) db.log_containers = [];
if (!db.docs) db.docs = [];

window.escapeHTML = window.escapeHTML || function(str) {
    if (!str) return '';
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
};

// State for active filters and pagination
window.currentInvFilteredData = { inv: [], po: [], loss: [], sc: [] };
window.invCurrentPage = { inv: 1, po: 1, loss: 1, sc: 1 };
let _lastInvDataCounts = { inv: -1, po: -1, loss: -1, truck: -1, cont: -1, docs: -1 };
window.currentPrintPOId = null;

// Helper: Convert Number to Words (INR) - Supports up to 13 digits (99 Kharab)
function amountToWordsINR(num) {
    if (!num || isNaN(num) || num === 0) return "ZERO";
    let a = ['','ONE ','TWO ','THREE ','FOUR ', 'FIVE ','SIX ','SEVEN ','EIGHT ','NINE ','TEN ','ELEVEN ','TWELVE ','THIRTEEN ','FOURTEEN ','FIFTEEN ','SIXTEEN ','SEVENTEEN ','EIGHTEEN ','NINETEEN '];
    let b = ['', '', 'TWENTY','THIRTY','FORTY','FIFTY', 'SIXTY','SEVENTY','EIGHTY','NINETY'];
    
    let wholeStr = Math.floor(num).toString();
    let decStr = (num % 1).toFixed(2).split('.')[1];
    
    function convert(nStr) {
        if (nStr.length > 13) return 'AMOUNT EXCEEDS LIMIT'; 
        let n = ('0000000000000' + nStr).slice(-13).match(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
        if (!n) return ''; 
        let str = '';
        str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'KHARAB ' : '';
        str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'ARAB ' : '';
        str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'CRORE ' : '';
        str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'LAKH ' : '';
        str += (n[5] != 0) ? (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + 'THOUSAND ' : '';
        str += (n[6] != 0) ? (a[Number(n[6])] || b[n[6][0]] + ' ' + a[n[6][1]]) + 'HUNDRED ' : '';
        str += (n[7] != 0) ? ((str != '') ? 'AND ' : '') + (a[Number(n[7])] || b[n[7][0]] + ' ' + a[n[7][1]]) : '';
        return str.trim();
    }
    
    let result = convert(wholeStr) + ' RUPEES';
    if (decStr && parseInt(decStr) > 0) {
        result += ' AND ' + convert(decStr) + ' PAISE';
    }
    return result + ' ONLY';
}

// Interceptor Helpers for Persistence Safety Net
const saveLocalPO = () => { try { localStorage.setItem('jft_erp_po', JSON.stringify(db.po)); } catch(e){} };
const saveLocalLoss = () => { try { localStorage.setItem('jft_erp_loss', JSON.stringify(db.stock_loss)); } catch(e){} };

// Watchdog Sync Engine
// Watchdog removed: Replaced by Enterprise Sync Hub in ui.js

// ==========================================
// CORE TAB LOGIC & FILTERS
// ==========================================

window.switchInvTab = function(tabId) {
    document.querySelectorAll('#inventory .sub-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.inv-container').forEach(c => c.classList.add('hidden'));
    
    const activeBtn = document.getElementById(`btn-inv-${tabId}`);
    if (activeBtn) activeBtn.classList.add('active');
    
    const tabEl = document.getElementById(`inv-${tabId}-tab`);
    if (tabEl) tabEl.classList.remove('hidden');
    
    if (tabId === 'dash') {
        initInvFilters('inv');
        populatePODropdowns();
        updateGlobalStockKPIs();
        renderInventoryLedger();
    }
    if (tabId === 'po') {
        initInvFilters('po');
        initInvFilters('sc');
        renderPOTable();
        renderSCTable();
    }
    if (tabId === 'loss') {
        initInvFilters('loss');
        populatePODropdowns();
        renderLossTable();
    }
};

function initInvFilters(type) {
    Enterprise.initFYSelector(`filter-fy-${type}`);
}

function checkDateFilter(dDateStr, filterFy, dateFrom, dateTo) {
    if (!dDateStr) return true;
    const dDate = new Date(dDateStr);
    if (isNaN(dDate.getTime())) return true; 

    if (dateFrom && dDate < new Date(dateFrom)) return false;
    if (dateTo && dDate > new Date(dateTo)) return false;

    return Enterprise.checkFY(dDateStr, filterFy);
}

window.resetInvFilters = function(tab) {
    const ids = ['fy', 'date-from', 'date-to', 'po', 'search'];
    ids.forEach(id => {
        const el = document.getElementById(`filter-${id}-${tab}`);
        if(el) el.value = '';
    });
    const limit = document.getElementById(`filter-limit-${tab}`);
    if(limit) limit.value = '10'; 
    window.invCurrentPage[tab] = 1;

    if (tab === 'inv') renderInventoryLedger();
    if (tab === 'po') renderPOTable();
    if (tab === 'sc') renderSCTable();
    if (tab === 'loss') renderLossTable();
};

function getPaginatedData(filteredArray, tab, limitStr) {
    const limit = limitStr === 'all' ? filteredArray.length : parseInt(limitStr, 10);
    
    const totalPages = Math.ceil(filteredArray.length / limit) || 1;
    if (window.invCurrentPage[tab] > totalPages) {
        window.invCurrentPage[tab] = totalPages;
    }
    if (window.invCurrentPage[tab] < 1) {
        window.invCurrentPage[tab] = 1;
    }
    
    const startIndex = (window.invCurrentPage[tab] - 1) * limit;
    return filteredArray.slice(startIndex, startIndex + limit);
}

function renderPaginationFooter(tab, totalItems, limitStr, callback) {
    const limit = limitStr === 'all' ? totalItems : parseInt(limitStr, 10);
    const totalPages = Math.ceil(totalItems / limit) || 1;
    let curr = window.invCurrentPage[tab] || 1;
    if (curr > totalPages) curr = totalPages;
    if (curr < 1) curr = 1;
    window.invCurrentPage[tab] = curr;

    if (totalItems === 0) return '';
    
    if (totalPages > 1) {
        return `
            <tr><td colspan="100" style="text-align:center; padding: 10px; background-color: var(--surface) !important;">
                <button type="button" class="secondary" style="padding: 2px 8px; font-size:0.8rem;" onclick="window.invCurrentPage.${tab}--; ${callback}()" ${curr <= 1 ? 'disabled' : ''}>◀ Prev</button>
                <span style="margin:0 15px; font-size:0.85rem; font-weight:bold;">Page ${curr} of ${totalPages} (Filtered: ${totalItems})</span>
                <button type="button" class="secondary" style="padding: 2px 8px; font-size:0.8rem;" onclick="window.invCurrentPage.${tab}++; ${callback}()" ${curr >= totalPages ? 'disabled' : ''}>Next ▶</button>
            </td></tr>`;
    }
    return '';
}

function populateItemDropdown() {
    const select = document.getElementById('inv-tx-item');
    if (!select || !db.inventory) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="">-- General Commodity / Choose Item --</option>';
    [...db.inventory].sort((a,b) => a.name.localeCompare(b.name)).forEach(i => {
        select.innerHTML += `<option value="${escapeHTML(i.id)}">${escapeHTML(i.name)} (${escapeHTML(i.unit)})</option>`;
    });
    if (currentVal) select.value = currentVal;
}

function populatePODropdowns() {
    const selects = document.querySelectorAll('.inv-po-select');
    if (!selects.length || !db.po) return;
    let options = '<option value="">-- No Reference / All --</option>';
    const sorted = [...db.po].sort((a,b) => new Date(b.date) - new Date(a.date));
    sorted.forEach(p => {
        options += `<option value="${escapeHTML(p.id)}">${escapeHTML(p.no)} | ${escapeHTML(p.vendor.split('\n')[0])}</option>`;
    });
    selects.forEach(select => {
        const currentVal = select.value;
        select.innerHTML = options;
        if (currentVal) select.value = currentVal;
    });
}

// ==========================================
// UNIFIED LOGISTICS SYNC ENGINE
// ==========================================

function getUnifiedLedger() {
    let ledger = [];
    
    (db.log_trucks || []).forEach(t => {
        ledger.push({
            id: t.id, date: t.date, type: 'IN', source: 'Truck Entry',
            item: t.item, ref: `Truck: ${t.no}`, bags: parseInt(t.bags || 0),
            weight: parseFloat(t.weight || 0), poId: t.poId || t.docId 
        });
    });

    (db.log_containers || []).forEach(c => {
        // AUDIT FIX: Skip weight if the linked document is CANCELLED
        if (c.docId) {
            const linkedDoc = (db.docs || []).find(d => d.id === c.docId);
            if (linkedDoc && linkedDoc.status === 'Cancelled') return;
        }
        
        ledger.push({
            id: c.id, date: c.date, type: 'OUT', source: 'Container Stuffing',
            item: c.product || c.item || 'Export Cargo', 
            ref: `Cont: ${c.no} / Seal: ${c.seal}`, 
            bags: parseInt(c.bags || 0), weight: parseFloat(c.nw || c.weight || 0), poId: c.scId || c.docId 
        });
    });

    (db.inventory_log || []).forEach(tx => {
        ledger.push({
            id: tx.id, date: tx.date, type: tx.type, source: 'Manual Adjustment',
            item: tx.itemName, ref: tx.ref || '-', bags: parseInt(tx.bags || 0),
            weight: parseFloat(tx.qty || 0), poId: tx.poId || null
        });
    });

    (db.stock_loss || []).forEach(l => {
        ledger.push({
            id: l.id, date: l.date, type: 'LOSS', source: 'Stock Reconciliation',
            item: l.item, ref: `Reason: ${l.reason}`, bags: parseInt(l.bags || 0),
            weight: parseFloat(l.weight || 0), poId: l.poId || null
        });
    });

    ledger.sort((a,b) => new Date(b.date) - new Date(a.date));
    return ledger;
}

window.updateGlobalStockKPIs = function() {
    let inWt = 0, inBags = 0, outWt = 0, outBags = 0, lossWt = 0, lossVal = 0;
    const ledger = getUnifiedLedger();
    ledger.forEach(row => {
        if (row.type === 'IN') { inWt += row.weight; inBags += row.bags; } 
        else if (row.type === 'OUT') { outWt += row.weight; outBags += row.bags; }
    });
    (db.stock_loss || []).forEach(l => {
        lossWt += parseFloat(l.weight || 0); lossVal += parseFloat(l.lossValue || 0);
    });

    const balWt = inWt - outWt - lossWt;
    const balBags = inBags - outBags - ((db.stock_loss || []).reduce((sum, l) => sum + parseInt(l.bags||0), 0));

    const eInWt = document.getElementById('inv-kpi-in-wt');
    const eInBags = document.getElementById('inv-kpi-in-bags');
    const eOutWt = document.getElementById('inv-kpi-out-wt');
    const eOutBags = document.getElementById('inv-kpi-out-bags');
    const eBalWt = document.getElementById('inv-kpi-bal-wt');
    const eBalBags = document.getElementById('inv-kpi-bal-bags');
    const eLossWt = document.getElementById('inv-kpi-loss-wt');
    const eLossVal = document.getElementById('inv-kpi-loss-val');

    if(eInWt) eInWt.innerText = `${inWt.toLocaleString('en-US', {minimumFractionDigits:3, maximumFractionDigits:3})} MT`;
    if(eInBags) eInBags.innerText = `${inBags.toLocaleString()} Bags`;
    if(eOutWt) eOutWt.innerText = `${outWt.toLocaleString('en-US', {minimumFractionDigits:3, maximumFractionDigits:3})} MT`;
    if(eOutBags) eOutBags.innerText = `${outBags.toLocaleString()} Bags`;
    if(eBalWt) eBalWt.innerText = `${balWt.toLocaleString('en-US', {minimumFractionDigits:3, maximumFractionDigits:3})} MT`;
    if(eBalBags) eBalBags.innerText = `${balBags.toLocaleString()} Bags`;
    if(eLossWt) eLossWt.innerText = `${lossWt.toLocaleString('en-US', {minimumFractionDigits:3, maximumFractionDigits:3})} MT`;
    if(eLossVal) eLossVal.innerText = `₹${lossVal.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
};

// ==========================================
// MASTER STOCK DASHBOARD & LINKING
// ==========================================

window.renderInventoryLedger = function() {
    updateGlobalStockKPIs();
    const tbody = document.querySelector('#inv-ledger-table tbody');
    if (!tbody) return;

    const filterFy = document.getElementById('filter-fy-inv')?.value || '';
    const dateFrom = document.getElementById('filter-date-from-inv')?.value || '';
    const dateTo = document.getElementById('filter-date-to-inv')?.value || '';
    const poFilter = document.getElementById('filter-po-inv')?.value || '';
    const searchFilter = (document.getElementById('filter-search-inv')?.value || '').toLowerCase();
    const limitStr = document.getElementById('filter-limit-inv')?.value || '10';

    let ledger = getUnifiedLedger();

    ledger = ledger.filter(row => {
        if (!checkDateFilter(row.date, filterFy, dateFrom, dateTo)) return false;
        if (poFilter && row.poId !== poFilter) return false;
        if (searchFilter) {
            const str = `${row.date} ${row.type} ${row.item} ${row.ref} ${row.source}`.toLowerCase();
            if (!str.includes(searchFilter)) return false;
        }
        return true;
    });

    window.currentInvFilteredData.inv = ledger;
    const paginated = getPaginatedData(ledger, 'inv', limitStr);

    if (paginated.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 20px; color:var(--text-muted);">No stock movements found.</td></tr>`;
        return;
    }

    tbody.innerHTML = paginated.map(tx => {
        const displayDate = typeof formatDateIN === 'function' ? formatDateIN(tx.date) : tx.date;
        
        let typeBadge = '';
        if (tx.type === 'IN') typeBadge = `<span class="status-badge" style="background:rgba(34, 197, 94, 0.1); color:#166534; border:1px solid #bbf7d0;">⬇️ IN</span>`;
        else if (tx.type === 'OUT') typeBadge = `<span class="status-badge" style="background:#fee2e2; color:#9f1239; border:1px solid #fca5a5;">⬆️ OUT</span>`;
        else if (tx.type === 'LOSS') typeBadge = `<span class="status-badge" style="background: var(--surface)beb; color:#b45309; border:1px solid #fde047;">📉 LOSS</span>`;

        let actionBtn = '-';
        if (tx.source === 'Truck Entry') {
             if (tx.poId) {
                 actionBtn = `<button class="secondary" style="padding:2px 6px; font-size:0.75rem; background:rgba(34, 197, 94, 0.1); color:#166534; border:1px solid #bbf7d0;" onclick="openLinkRefModal('${tx.id}', 'Truck Entry')">✅ Linked</button>`;
             } else {
                 actionBtn = `<button class="secondary" style="padding:2px 6px; font-size:0.75rem; border:1px solid var(--primary); color:var(--primary);" onclick="openLinkRefModal('${tx.id}', 'Truck Entry')">🔗 Link PO</button>`;
             }
        } else if (tx.source === 'Container Stuffing') {
             if (tx.poId) {
                 actionBtn = `<button class="secondary" style="padding:2px 6px; font-size:0.75rem; background:rgba(34, 197, 94, 0.1); color:#166534; border:1px solid #bbf7d0;" onclick="openLinkRefModal('${tx.id}', 'Container Stuffing')">✅ Linked</button>`;
             } else {
                 actionBtn = `<button class="secondary" style="padding:2px 6px; font-size:0.75rem; border:1px solid var(--primary); color:var(--primary);" onclick="openLinkRefModal('${tx.id}', 'Container Stuffing')">🔗 Link SC</button>`;
             }
        } else {
             actionBtn = `<span style="font-size:0.7rem; color:var(--text-muted);">Via Loss Tab</span>`;
        }
        
        let linkedText = '';
        if (tx.poId) {
             if (tx.source === 'Container Stuffing') {
                 const sc = (db.docs||[]).find(d => d.id === tx.poId);
                 if(sc) linkedText = `<br><span style="font-size:0.7rem; color:var(--primary);">🔗 SC: ${escapeHTML(sc.no)}</span>`;
             } else {
                 const po = (db.po||[]).find(p => p.id === tx.poId);
                 if(po) linkedText = `<br><span style="font-size:0.7rem; color:var(--primary);">🔗 PO: ${escapeHTML(po.no)}</span>`;
             }
        }

        return `<tr>
            <td>${displayDate}</td>
            <td>${typeBadge}</td>
            <td><b>${escapeHTML(tx.item)}</b></td>
            <td>${escapeHTML(tx.ref)}${linkedText}</td>
            <td>${tx.bags.toLocaleString()}</td>
            <td style="font-weight:bold;">${tx.weight.toLocaleString('en-US', {minimumFractionDigits:3})} MT</td>
            <td><span style="font-size:0.75rem; color:var(--text-muted);">${tx.source}</span></td>
            <td>${actionBtn}</td>
        </tr>`;
    }).join('') + renderPaginationFooter('inv', ledger.length, limitStr, 'renderInventoryLedger');
};

window.openLinkRefModal = function(id, source) {
    document.getElementById('link-tx-id').value = id;
    document.getElementById('link-tx-source').value = source;
    const select = document.getElementById('link-ref-select');
    select.innerHTML = '<option value="">-- Remove Link / None --</option>';
    
    if (source === 'Truck Entry') {
        document.getElementById('link-ref-label').innerText = "Link to Purchase Order (PO)";
        (db.po || []).forEach(p => {
            select.innerHTML += `<option value="${p.id}">${escapeHTML(p.no)} - ${escapeHTML(p.vendor.split('\n')[0])}</option>`;
        });
    } else if (source === 'Container Stuffing') {
        document.getElementById('link-ref-label').innerText = "Link to Sales Contract";
        (db.docs || []).filter(d => d.type === 'Sales Contract').forEach(d => {
            select.innerHTML += `<option value="${d.id}">${escapeHTML(d.no)} - ${escapeHTML(d.buyer.split('\n')[0])}</option>`;
        });
    }
    
    document.getElementById('link-ref-modal').classList.remove('hidden');
    document.getElementById('link-ref-modal').style.display = 'flex';
};

window.closeLinkRefModal = function() {
    const m = document.getElementById('link-ref-modal');
    if(m) { m.classList.add('hidden'); m.style.display = 'none'; }
};

window.saveLinkRef = function() {
    const id = document.getElementById('link-tx-id').value;
    const source = document.getElementById('link-tx-source').value;
    const refId = document.getElementById('link-ref-select').value;
    
    if (source === 'Truck Entry') {
        const t = db.log_trucks.find(x => x.id === id);
        if (t) { 
            t.poId = refId; 
            if(typeof saveData === 'function') saveData(true); 
        }
    } else if (source === 'Container Stuffing') {
        const c = db.log_containers.find(x => x.id === id);
        if (c) { 
            c.scId = refId; 
            if(typeof saveData === 'function') saveData(true); 
        }
    }
    
    closeLinkRefModal();
    renderInventoryLedger();
    renderPOTable();
    renderSCTable();
    if(typeof Enterprise !== 'undefined') Enterprise.notify("Reference Linked Successfully!", "success");
};

// ==========================================
// ADVANCED PURCHASE ORDERS & SALES CONTRACTS
// ==========================================

window.togglePOCreate = function() {
    const section = document.getElementById('po-create-section');
    if(section.classList.contains('hidden')) {
        section.classList.remove('hidden');
    } else {
        section.classList.add('hidden');
    }
};

window.createPurchaseOrder = function(e) {
    if(e) e.preventDefault(); 
    
    const form = document.getElementById('po-form');
    if (!form.checkValidity()) { form.reportValidity(); return; }

    if (typeof Enterprise !== 'undefined' && !Enterprise.security.isAdmin(true)) return;

    const poNo = document.getElementById('po-no').value;
    if (db.po.some(p => p.no === poNo)) {
        if(typeof Enterprise !== 'undefined') Enterprise.notify(`Duplicate PO Number (${poNo})! This order already exists.`, "danger");
        return;
    }

    const po = {
        id: 'PO_' + Date.now(),
        no: poNo,
        date: document.getElementById('po-date').value,
        ref: document.getElementById('po-ref').value,
        broker: document.getElementById('po-broker').value,
        
        // Seller Details
        sellerName: document.getElementById('po-seller-name').value,
        sellerAddress: document.getElementById('po-seller-address').value,
        sellerMobile: document.getElementById('po-seller-mobile').value,
        sellerEmail: document.getElementById('po-seller-email').value,
        sellerFssai: document.getElementById('po-seller-fssai').value,
        sellerGstin: document.getElementById('po-seller-gstin').value,

        // Buyer Details
        buyerName: document.getElementById('po-buyer-name').value,
        buyerAddress: document.getElementById('po-buyer-address').value,
        buyerMobile: document.getElementById('po-buyer-mobile').value,
        buyerEmail: document.getElementById('po-buyer-email').value,
        buyerGstin: document.getElementById('po-buyer-gstin').value,

        // Item Detail
        item: document.getElementById('po-item').value,
        orderedWt: parseFloat(document.getElementById('po-qty').value) || 0,
        rateLabel: document.getElementById('po-rate-label').value,
        rate: parseFloat(document.getElementById('po-rate').value) || 0,
        
        // Quality Specs
        specs: document.getElementById('po-specs').value,
        
        // Conditions
        impNote: document.getElementById('po-imp-note').value,
        remarks: document.getElementById('po-terms').value,

        // Legacy compatibility
        vendor: `${document.getElementById('po-seller-name').value}\n${document.getElementById('po-seller-address').value}`,
        tax: 0
    };

    db.po.unshift(po);
    saveLocalPO(); 
    
    if(typeof saveData === 'function') saveData(true);
    
    _lastInvDataCounts.po = db.po.length;
    
    form.reset();
    populatePODropdowns();
    renderPOTable();
    togglePOCreate(); 
    
    if(typeof Enterprise !== 'undefined') Enterprise.notify("Purchase Order Generated Successfully", "success");
};

window.renderPOTable = function() {
    const table = document.querySelector('#po-table');
    const tbody = table.querySelector('tbody');
    if (!tbody || !db.po) return;

    const filterFy = document.getElementById('filter-fy-po')?.value || '';
    const dateFrom = document.getElementById('filter-date-from-po')?.value || '';
    const dateTo = document.getElementById('filter-date-to-po')?.value || '';
    const searchFilter = (document.getElementById('filter-search-po')?.value || '').toLowerCase();
    const limitStr = document.getElementById('filter-limit-po')?.value || '10';

    let filtered = db.po.filter(p => {
        if (!checkDateFilter(p.date, filterFy, dateFrom, dateTo)) return false;
        if (searchFilter) {
            const str = `${p.no} ${p.date} ${p.vendor} ${p.item}`.toLowerCase();
            if (!str.includes(searchFilter)) return false;
        }
        return true;
    });

    let processedPOs = filtered.map(p => {
        let receivedWt = 0;
        (db.log_trucks || []).forEach(t => {
            const isMatch = (t.poId === p.id || t.docId === p.id);
            if (isMatch) {
                // If it's linked via a generic document (invoice), skip if that invoice is cancelled
                if (t.docId && t.docId !== p.id) {
                    const linkedDoc = (db.docs || []).find(d => d.id === t.docId);
                    if (linkedDoc && linkedDoc.status === 'Cancelled') return;
                }
                receivedWt += parseFloat(t.weight || 0);
            }
        });
        const balWt = p.orderedWt - receivedWt;
        const isCompleted = p.orderedWt > 0 && balWt <= (p.orderedWt * 0.02);
        return { ...p, receivedWt, balWt, isCompleted };
    });

    processedPOs.sort((a,b) => {
        if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
        return new Date(b.date) - new Date(a.date);
    });

    window.currentInvFilteredData.po = processedPOs;
    const paginated = getPaginatedData(processedPOs, 'po', limitStr);

    if (paginated.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 20px; color:var(--text-muted);">No Purchase Orders found.</td></tr>`;
        return;
    }

    tbody.innerHTML = paginated.map(p => {
        const totalVal = p.orderedWt * p.rate * (1 + ((p.tax||0)/100));
        
        let statusBadge = p.isCompleted ? `<span class="status-badge status-Paid">Completed</span>` : 
            (p.receivedWt > 0 ? `<span class="status-badge" style="background:#fef3c7; color:#a16207; border:1px solid #fde047;">Partial</span>` : `<span class="status-badge status-Pending">Pending</span>`);

        const safeId = escapeHTML(p.id).replace(/&#039;/g, "\\'");

        return `<tr>
            <td>${typeof formatDateIN === 'function' ? formatDateIN(p.date) : p.date}</td>
            <td><b>${escapeHTML(p.no)}</b></td>
            <td>${escapeHTML(p.vendor.split('\n')[0])}</td>
            <td>${escapeHTML(p.item)}</td>
            <td>${p.orderedWt.toLocaleString('en-US', {minimumFractionDigits:2})} MT</td>
            <td style="color:var(--success); font-weight:bold;">${p.receivedWt.toLocaleString('en-US', {minimumFractionDigits:2})} MT</td>
            <td style="color:var(--danger); font-weight:bold;">${p.balWt.toLocaleString('en-US', {minimumFractionDigits:2})} MT</td>
            <td>₹${totalVal.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
            <td>${statusBadge}</td>
            <td>
                <div style="display:flex; gap:5px;">
                    <button class="secondary" style="padding:2px 6px; font-size:0.75rem;" onclick="openPOPreviewModal('${safeId}')">🖨️ Print</button>
                    <button class="danger" style="padding:2px 6px; font-size:0.75rem;" onclick="deletePurchaseOrder('${safeId}')">Del</button>
                </div>
            </td>
        </tr>`;
    }).join('') + renderPaginationFooter('po', processedPOs.length, limitStr, 'renderPOTable');
};

window.renderSCTable = function() {
    const table = document.querySelector('#sc-table');
    const tbody = table.querySelector('tbody');
    if (!tbody || !db.docs) return;

    const filterFy = document.getElementById('filter-fy-sc')?.value || '';
    const dateFrom = document.getElementById('filter-date-from-sc')?.value || '';
    const dateTo = document.getElementById('filter-date-to-sc')?.value || '';
    const searchFilter = (document.getElementById('filter-search-sc')?.value || '').toLowerCase();
    const limitStr = document.getElementById('filter-limit-sc')?.value || '10';

    let scDocs = db.docs.filter(d => d.type === 'Sales Contract' && d.status !== 'Cancelled');

    scDocs = scDocs.filter(sc => {
        if (!checkDateFilter(sc.date, filterFy, dateFrom, dateTo)) return false;
        if (searchFilter) {
            const str = `${sc.no} ${sc.date} ${sc.buyer}`.toLowerCase();
            if (!str.includes(searchFilter)) return false;
        }
        return true;
    });

    let processedSCs = scDocs.map(sc => {
        let shippedWt = 0;
        (db.log_containers || []).forEach(c => {
            // Check direct link (scId or docId) OR check if the linked doc's parent matches the SC
            let isLinked = (c.scId === sc.id || c.docId === sc.id);
            if (!isLinked && c.docId) {
                const linkedDoc = (db.docs || []).find(d => d.id === c.docId);
                if (linkedDoc && (linkedDoc.parent_doc_id === sc.id || linkedDoc.master_shipment_id === sc.id)) {
                    isLinked = true;
                }
            }
            
            if (isLinked) {
                // Skip if the specific linked document is cancelled
                if (c.docId) {
                    const linkedDoc = (db.docs || []).find(d => d.id === c.docId);
                    if (linkedDoc && linkedDoc.status === 'Cancelled') return;
                }
                shippedWt += parseFloat(c.nw || c.weight || 0);
            }
        });
        
        const contractWt = parseFloat(sc.qty || sc.quantity || sc.totalQty || 0); 
        const balWt = contractWt - shippedWt;
        const isCompleted = contractWt > 0 && balWt <= (contractWt * 0.02);
        
        return { ...sc, shippedWt, balWt, contractWt, isCompleted };
    });

    processedSCs.sort((a,b) => {
        if(a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
        return new Date(b.date) - new Date(a.date);
    });

    window.currentInvFilteredData.sc = processedSCs;
    const paginated = getPaginatedData(processedSCs, 'sc', limitStr);

    if (paginated.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color:var(--text-muted);">No Sales Contracts found.</td></tr>`;
        return;
    }

    tbody.innerHTML = paginated.map(sc => {
        let statusBadge = sc.isCompleted ? `<span class="status-badge status-Paid">Completed</span>` : 
            (sc.shippedWt > 0 ? `<span class="status-badge" style="background:#fef3c7; color:#a16207; border:1px solid #fde047;">Partial Loading</span>` : `<span class="status-badge status-Pending">Pending Cargo</span>`);

        let qtyDisplay = sc.contractWt > 0 ? `${sc.contractWt.toLocaleString('en-US', {minimumFractionDigits:2})} MT` : '<span style="color:var(--border); font-size:0.7rem;">Not Provided</span>';

        return `<tr>
            <td>${typeof formatDateIN === 'function' ? formatDateIN(sc.date) : sc.date}</td>
            <td><b>${escapeHTML(sc.no)}</b></td>
            <td>${escapeHTML(sc.buyer.split('\n')[0])}</td>
            <td>${qtyDisplay}</td>
            <td style="color:var(--success); font-weight:bold;">${sc.shippedWt.toLocaleString('en-US', {minimumFractionDigits:2})} MT</td>
            <td style="color:var(--danger); font-weight:bold;">${sc.balWt.toLocaleString('en-US', {minimumFractionDigits:2})} MT</td>
            <td>${statusBadge}</td>
        </tr>`;
    }).join('') + renderPaginationFooter('sc', processedSCs.length, limitStr, 'renderSCTable');
};

window.deletePurchaseOrder = function(id) {
    if(typeof Enterprise !== 'undefined' && !Enterprise.security.canDelete()) return;
    if(!confirm(`Are you sure you want to delete this PO? Linked receipts will remain in logistics.`)) return;
    
    const idx = db.po.findIndex(p => p.id === id);
    if (idx > -1) {
        db.po.splice(idx, 1);
        saveLocalPO(); 
        if(typeof saveData === 'function') saveData(true);
        _lastInvDataCounts.po = db.po.length;
        populatePODropdowns();
        renderPOTable();
    }
};

function buildPOPreviewModal() {
    if(document.getElementById('po-preview-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'po-preview-modal';
    modal.className = 'modal-overlay hidden';
    modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:10000; align-items:center; justify-content:center; padding: 20px;';
    modal.innerHTML = `
        <div class="card" style="width: 100%; max-width: 1300px; height: 95vh; display: flex; flex-direction: column; padding: 20px; margin:0; background:var(--surface);">
            
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 15px; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
                <h2 style="margin:0; font-size:1.5rem;">📄 Purchase Order Preview</h2>
                <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                    <button onclick="executeActualPOPrint()" style="background:#10b981; color:white;">🖨️ Print</button>
                    <button onclick="executeActualPODownload()" style="background:#3b82f6; color:white;">💾 Download PDF</button>
                    <button class="danger" style="margin-left: 15px; border-radius: 50%; width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center;" onclick="closePOPreviewModal()" title="Close Preview">✕</button>
                </div>
            </div>

            <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap; font-size: 0.85rem; background: var(--bg); padding: 10px 15px; border-radius: 6px; border: 1px solid var(--border); margin-bottom: 15px;">
                <label style="display:flex; align-items:center; gap:5px; cursor:pointer; font-weight:bold;"><input type="checkbox" id="po-preview-use-lh" onchange="refreshPOPreview()"> Include Letterhead</label>
                <div style="border-left: 1px solid var(--border); height: 20px;"></div>
                <label style="display:flex; align-items:center; gap:5px; cursor:pointer; font-weight:bold;"><input type="checkbox" id="po-preview-use-sig" onchange="refreshPOPreview()"> Include Signature</label>
                <div style="border-left: 1px solid var(--border); height: 20px;"></div>
                
                <label style="display:flex; align-items:center; gap:5px;">Top Margin: <input type="number" id="po-preview-hm" value="45" style="width: 50px; padding: 4px; border: 1px solid var(--border); border-radius:4px;" onchange="refreshPOPreview()"></label>
                <label style="display:flex; align-items:center; gap:5px;">Bottom Margin: <input type="number" id="po-preview-fm" value="27" style="width: 50px; padding: 4px; border: 1px solid var(--border); border-radius:4px;" onchange="refreshPOPreview()"></label>
                <label style="display:flex; align-items:center; gap:5px;">Sig Width: <input type="number" id="po-preview-sw" value="200" style="width: 50px; padding: 4px; border: 1px solid var(--border); border-radius:4px;" onchange="refreshPOPreview()"></label>
                <label style="display:flex; align-items:center; gap:5px;">Sig Height: <input type="number" id="po-preview-sh" value="200" style="width: 50px; padding: 4px; border: 1px solid var(--border); border-radius:4px;" onchange="refreshPOPreview()"></label>

                <button class="secondary" onclick="savePOPreviewSettings()" style="padding: 6px 12px; margin-left: auto; font-size: 0.8rem;">💾 Save Layout</button>
            </div>

            <iframe id="po-preview-frame" style="flex-grow: 1; border: 1px solid var(--border); background: var(--surface); border-radius: 8px; width:100%;"></iframe>
        </div>
    `;
    document.body.appendChild(modal);
}

window.closePOPreviewModal = function() {
    const m = document.getElementById('po-preview-modal');
    if(m) { m.classList.add('hidden'); m.style.display = 'none'; }
};

window.openPOPreviewModal = function(id) {
    window.currentPrintPOId = id;
    const p = db.po.find(x => x.id === id);
    if (!p) return;

    let initLh = p.useLetterhead !== undefined ? p.useLetterhead : true;
    let initSig = p.useSignature !== undefined ? p.useSignature : true;
    let initHm = p.printLayout ? p.printLayout.hm : 45;
    let initFm = p.printLayout ? p.printLayout.fm : 27;
    let initSh = p.printLayout ? p.printLayout.sh : 200;
    let initSw = p.printLayout ? p.printLayout.sw : 200;

    buildPOPreviewModal();
    const modal = document.getElementById('po-preview-modal');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    document.getElementById('po-preview-use-lh').checked = initLh;
    document.getElementById('po-preview-use-sig').checked = initSig;
    document.getElementById('po-preview-hm').value = initHm;
    document.getElementById('po-preview-fm').value = initFm;
    document.getElementById('po-preview-sh').value = initSh;
    document.getElementById('po-preview-sw').value = initSw;

    refreshPOPreview();
};

window.savePOPreviewSettings = function() {
    if(window.currentPrintPOId) {
        const p = db.po.find(d => d.id === window.currentPrintPOId);
        if(p) {
            p.useLetterhead = document.getElementById('po-preview-use-lh').checked;
            p.useSignature = document.getElementById('po-preview-use-sig').checked;
            p.printLayout = {
                hm: document.getElementById('po-preview-hm').value,
                fm: document.getElementById('po-preview-fm').value,
                sh: document.getElementById('po-preview-sh').value,
                sw: document.getElementById('po-preview-sw').value
            };
            if (typeof saveData === 'function') saveData(true);
            if(typeof Enterprise !== 'undefined') Enterprise.notify(`Print settings saved for PO ${p.no}`, "success");
        }
    }
};

function getPrintBaseConfig(docType, useLetterhead, useSignature, hm = 45, fm = 27, sh = 200, sw = 200) {
    let activeComp = null;
    if (typeof getActiveCompany === 'function') activeComp = getActiveCompany();
    if (!activeComp) activeComp = (db.profile || {});
    
    const dynamicStyles = `
        * { box-sizing: border-box; }
        @media screen {
            body { margin: 0; padding: 20px 0; background: #525659; display: flex; flex-direction: column; align-items: center; gap: 20px; font-family: 'Times New Roman', Times, serif; }
            .page { position: relative; background: var(--surface); width: 210mm; height: 297mm; box-shadow: 0 10px 25px rgba(0,0,0,0.5); overflow: hidden; }
        }
        @media print {
            @page { size: A4; margin: 0 !important; }
            body { margin: 0; padding: 0; background: transparent; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .page { position: relative; width: 210mm; height: 296.5mm; margin: 0; box-shadow: none; overflow: hidden; page-break-after: always; }
            .page:last-child { page-break-after: auto; }
        }
        
        .print-letterhead { position: absolute; top: 0; left: 0; width: 210mm; height: 297mm; z-index: 0; object-fit: fill; pointer-events: none; }
        
        .page-content { position: relative; z-index: 1; width: 100%; height: 100%; padding: ${hm}mm 10mm 0 10mm; display: block; box-sizing: border-box; }
        
        .doc-body { width: 100%; transform-origin: top left; display: block; }
        
        .signature-section { position: absolute; bottom: ${fm}mm; left: 10mm; right: 10mm; width: calc(100% - 20mm); display: flex; justify-content: space-between; align-items: flex-end; }

        .text-line { font-size: 11px; line-height: 1.5; margin-bottom: 5px; color: #000; }
        .bold { font-weight: bold; }
        
        .signature-img { 
            position: absolute; 
            top: 50%; 
            left: 50%; 
            transform: translate(-50%, -50%);
            height: ${sh}px !important; 
            width: ${sw}px !important; 
            max-width: none !important;
            object-fit: contain; 
            z-index: 2; 
            mix-blend-mode: multiply; 
            pointer-events: none;
        }
    `;

    const autoFitScript = `<script>
        window.addEventListener('load', function() {
            var pages = document.querySelectorAll('.page');
            pages.forEach(function(page) {
                var body = page.querySelector('.doc-body');
                var sig = page.querySelector('.signature-section');
                if(!body || !sig) return;

                var safety = 500;
                var zoomLevel = 1.0;
                
                function getGap() {
                    return sig.getBoundingClientRect().top - body.getBoundingClientRect().bottom;
                }

                while (getGap() < 0 && zoomLevel > 0.25 && safety > 0) {
                    zoomLevel -= 0.01;
                    body.style.transform = 'scale(' + zoomLevel + ')';
                    body.style.width = (100 / zoomLevel) + '%';
                    safety--;
                }
                
                safety = 500;
                while (getGap() > 2 && zoomLevel < 3.0 && safety > 0) {
                    zoomLevel += 0.01;
                    body.style.transform = 'scale(' + zoomLevel + ')';
                    body.style.width = (100 / zoomLevel) + '%';
                    if (getGap() <= 0) {
                        zoomLevel -= 0.01;
                        body.style.transform = 'scale(' + zoomLevel + ')';
                        body.style.width = (100 / zoomLevel) + '%';
                        break;
                    }
                    safety--;
                }
            });
        });
    <\/script>`;
    
    const letterheadHtml = (useLetterhead && activeComp.letterheadImg) ? `<img src="${activeComp.letterheadImg}" class="print-letterhead">` : '';
    const signatureHtml = (useSignature && activeComp.signatureImg) ? `<img src="${activeComp.signatureImg}" class="signature-img">` : '';

    return { activeComp, dynamicStyles, letterheadHtml, signatureHtml, autoFitScript };
}

window.refreshPOPreview = function() {
    const useLh = document.getElementById('po-preview-use-lh').checked;
    const useSig = document.getElementById('po-preview-use-sig').checked;
    const hm = document.getElementById('po-preview-hm').value;
    const fm = document.getElementById('po-preview-fm').value;
    const sh = document.getElementById('po-preview-sh').value;
    const sw = document.getElementById('po-preview-sw').value;

    const html = getPurchaseOrderHTML(window.currentPrintPOId, useLh, useSig, hm, fm, sh, sw);
    
    const frame = document.getElementById('po-preview-frame');
    frame.srcdoc = html;
    window.currentPOHTML = html;
};

window.executeActualPOPrint = function() {
    const frame = document.getElementById('po-preview-frame');
    if (frame && frame.contentWindow) {
        try {
            frame.contentWindow.focus();
            frame.contentWindow.print();
        } catch(e) {
            console.warn("Iframe print blocked. Using fallback.");
            const printWin = window.open('', '_blank');
            printWin.document.write(window.currentPOHTML);
            printWin.document.close();
            printWin.focus();
            setTimeout(() => { printWin.print(); }, 500);
        }
    }
};

window.executeActualPODownload = function() {
    const ipc = window.ipcRenderer;
    if (ipc) {
        if(typeof Enterprise !== 'undefined') Enterprise.notify(`Generating PO PDF...`, "info");
        ipc.send('generate-pdf', window.currentPOHTML, `PO_${window.currentPODocNo.replace(/[\/\\]/g, '-')}`);
    } else {
        window.executeActualPOPrint();
    }
};

// =========================================================================
function getPurchaseOrderHTML(id, useLh, useSig, hm, fm, sh, sw) {
    const p = db.po.find(x => x.id === id);
    if (!p) return '';

    window.currentPODocNo = p.no;
    const { activeComp, dynamicStyles: baseStyles, letterheadHtml, signatureHtml, autoFitScript } = getPrintBaseConfig('Purchase Order', useLh, useSig, hm, fm, sh, sw);

    const totalAmt = (p.orderedWt * p.rate).toFixed(2);
    const amountWords = amountToWordsINR(parseFloat(totalAmt));

    // Default Buyer (JFT Agro)
    let bName = p.buyerName || (activeComp.name || 'JFT AGRO OVERSEAS LLP');
    let bAddr = p.buyerAddress || `Office : N2, APMC Market-2, Sector 19/B, Vashi, Navi Mumbai - 400703`;
    let bMob = p.buyerMobile || (activeComp.phone || '8425000100');
    let bEmail = p.buyerEmail || (activeComp.email || 'jftagro.info@gmail.com');
    let bGstin = p.buyerGstin || (activeComp.gstin || '27AARFJ5046L1ZR');

    // Seller Info
    let sName = p.sellerName || 'SRI NARASIMHA RICE MILL';
    let sAddr = p.sellerAddress || '';
    let sMob = p.sellerMobile || '';
    let sEmail = p.sellerEmail || '';
    let sFssai = p.sellerFssai || '';
    let sGstin = p.sellerGstin || '';

    const poStyles = `
        ${baseStyles}
        body { font-family: 'Outfit', sans-serif, 'Times New Roman'; color: #000; }
        .page-content { padding: ${hm}mm 15mm ${fm}mm 15mm; }
        
        .watermark {
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg);
            font-size: 80px; color: rgba(132, 204, 22, 0.08); font-weight: 900; pointer-events: none; z-index: 0;
            white-space: nowrap; text-align: center; line-height: 1;
        }

        .meta-line { display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; margin-bottom: 20px; text-transform: uppercase; }
        
        .parties-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; table-layout: fixed; }
        .parties-table td { border: 1px solid black; padding: 12px; vertical-align: top; font-size: 12px; }
        
        .po-title { text-align: center; font-weight: 800; font-size: 15px; margin: 15px 0; text-decoration: underline; text-transform: uppercase; }
        .intro-text { text-align: center; font-size: 13px; margin-bottom: 20px; font-weight: 500; }
        
        .main-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; table-layout: fixed; }
        .main-table th { border: 1px solid black; padding: 10px; background: #f8fafc; font-size: 12px; text-transform: uppercase; }
        .main-table td { border: 1px solid black; padding: 10px; vertical-align: top; font-size: 12px; }
        
        .spec-item { display: flex; justify-content: space-between; margin-bottom: 4px; }
        .spec-label { color: #334155; }
        .spec-value { font-weight: bold; }

        .total-row td { font-weight: 800; font-size: 13px; background: #f8fafc; }
        
        .amount-words { margin: 15px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
        .imp-note { margin: 15px 0; font-size: 13px; color: #000; font-weight: 800; font-style: italic; }
        .imp-note span { color: #000; text-shadow: 0.5px 0.5px 1px rgba(0,0,0,0.1); }

        .conditions-section { margin-top: 20px; font-size: 11.5px; line-height: 1.5; }
        .condition-item { margin-bottom: 8px; display: flex; gap: 12px; }
        .cond-no { font-weight: bold; min-width: 25px; }

        .signature-zone { display: flex; justify-content: space-between; margin-top: 60px; font-size: 12px; font-weight: 800; text-align: center; }
        .sig-box { width: 33%; position: relative; display: flex; flex-direction: column; align-items: center; }
        .sig-line { border-top: 2px solid #000; width: 80%; margin-bottom: 8px; }
        .sig-stamp { position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%); z-index: 5; }
    `;

    const specs = (p.specs || "").split('\n').filter(s => s.trim()).map(s => {
        const parts = s.split(':');
        return `<div class="spec-item">
            <span class="spec-label">${escapeHTML(parts[0] || '').trim()}</span>
            <span class="spec-value">${escapeHTML(parts[1] || '').trim()}</span>
        </div>`;
    }).join('');

    const conditionsList = (p.remarks || `Delivery will be at Nhava Sheva Port.\nThe contract is governed by an LUT (Letter of Undertaking) if required.\nDelivery condition – Delivery at Nhava Sheva Port Before ${new Date(new Date(p.date).getTime() + 7*24*60*60*1000).toLocaleDateString()}.\nPayment condition: 1% discount after unloading at nhava sheva port within 2-3 days\nA signed copy of this contract will be sent to the Seller/Agent via email/fax. The Seller must return the signed copy to the Buyer within forty-eight (48) hours of transmission by the Buyer via fax or email. Failure to return the signed copy or provide any comments within forty-eight (48) hours will deem the contract accepted by the Seller. This contract supersedes all prior written or verbal agreements between the Buyer and Seller regarding the sale described herein.\nIf the Seller fails to fulfill any conditions of this contract, the Buyer reserves the right to immediately cancel the contract and seek reimbursement for all costs, damages, and consequences, including Mark to Market differences, if applicable.\nIf the Seller fails to deliver the goods within the specified period mentioned above, the Buyer reserves the right to purchase the cargo from the open market and claim the price difference from the Seller.\nAny amendments to this contract will be valid only if mutually agreed upon in writing and signed by both the Buyer and Seller.\nThe Seller warrants, represents, and undertakes to M/s JFT AGRO OVERSEAS LLP that it will comply with all applicable laws, rules, and regulations, including sanctions.\nThe Seller shall bear all local taxes, market cess/fees, or any other statutory levies/charges and expenses, whether present or future.\nThe Buyer shall not be held responsible for any delays in taking delivery due to Acts of God, Strikes, Lock-outs, civil commotion, Fire, or any other causes considered as "Force Majeure."\nAny disputes shall be settled through mutual discussion between both parties.\nThis Contract shall be governed by the laws of India, and the courts of Navi Mumbai (Maharashtra) shall have exclusive jurisdiction.`).split('\n').filter(c => c.trim());

    // Group conditions into Pages
    const page1Conds = conditionsList.slice(0, 5);
    const page2Conds = conditionsList.slice(5);

    const getPageContent = (pageNum, conds, isFinal) => `
        <div class="page">
            ${letterheadHtml}
            <div class="watermark">JFT AGRO OVERSEAS LLP</div>
            <div class="page-content">
                <div class="doc-body">
                    ${pageNum === 1 ? `
                        <div class="meta-line">
                            <div>DATE: ${typeof formatDateIN === 'function' ? formatDateIN(p.date) : p.date}</div>
                            <div>REF: ${escapeHTML(p.ref || 'Telephonic / Whatsapp')}</div>
                        </div>

                        <div class="meta-line" style="margin-bottom:10px;">
                            <div style="font-size: 15px;">PURCHASE ORDER : ${escapeHTML(p.no)}</div>
                            <div style="font-size: 15px;">BROKER : ${escapeHTML(p.broker || 'VICKY / VISHAL')}</div>
                        </div>

                        <table class="parties-table">
                            <tr>
                                <td>
                                    <b>SELLER: ${escapeHTML(sName)}</b><br><br>
                                    Address : ${escapeHTML(sAddr)}<br>
                                    Mobile No.: ${escapeHTML(sMob)}<br>
                                    Email ID: ${escapeHTML(sEmail)}<br>
                                    FSSAI No: ${escapeHTML(sFssai)}<br><br>
                                    GSTIN: ${escapeHTML(sGstin)}
                                </td>
                                <td>
                                    <b>BUYER: ${escapeHTML(bName)}</b><br><br>
                                    ${escapeHTML(bAddr).replace(/\n/g, '<br>')}<br>
                                    Mobile No: ${escapeHTML(bMob)}<br>
                                    Email- ${escapeHTML(bEmail)}<br><br><br>
                                    GSTIN: ${escapeHTML(bGstin)}
                                </td>
                            </tr>
                        </table>

                        <div class="po-title">PURCHASE ORDER</div>
                        <div class="intro-text">We are pleased to issue this Purchase Order towards our requirement listed below:-</div>

                        <table class="main-table">
                            <thead>
                                <tr>
                                    <th style="width: 50px;">SR. NO.</th>
                                    <th>ITEM</th>
                                    <th style="width: 120px;">QTY</th>
                                    <th style="width: 140px;">RATE (${escapeHTML(p.rateLabel || 'NET 25KG')})</th>
                                    <th style="width: 150px;">VALUE</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style="text-align:center;">1</td>
                                    <td>
                                        <div style="font-weight: 800; margin-bottom: 10px;">${escapeHTML(p.item)}</div>
                                        ${specs}
                                    </td>
                                    <td style="text-align:center;">
                                        <div style="font-weight:bold; font-size:14px;">${p.orderedWt.toLocaleString('en-US', {minimumFractionDigits:2})} MT</div>
                                    </td>
                                    <td style="text-align:center;">
                                        <div style="font-weight:bold;">${p.rate.toLocaleString('en-IN')}</div>
                                        <div style="font-size: 10px; margin-top:5px;">PER MT</div>
                                    </td>
                                    <td style="text-align:right;">
                                        <div style="font-weight:bold;">RS ${parseFloat(totalAmt).toLocaleString('en-IN', {minimumFractionDigits:2})}</div>
                                    </td>
                                </tr>
                                <tr class="total-row">
                                    <td colspan="3" style="border:none; background:transparent;"></td>
                                    <td style="text-align:center;">TOTAL</td>
                                    <td style="text-align:right;">RS ${parseFloat(totalAmt).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                                </tr>
                            </tbody>
                        </table>

                        <div class="amount-words">RUPEES: ${amountWords}</div>
                        ${p.impNote ? `<div class="imp-note">Note: Payment Condition: <span>${escapeHTML(p.impNote)}</span></div>` : ''}
                        
                        <div class="conditions-section">
                            <div style="font-weight: 800; text-decoration: underline; margin-bottom: 15px; background: #eee; padding: 5px;">Other Conditions:</div>
                    ` : `
                        <div class="conditions-section" style="margin-top: 0;">
                    `}

                    ${conds.map((c, i) => `
                        <div class="condition-item">
                            <div class="cond-no">${pageNum === 1 ? i + 1 : i + 6}.</div>
                            <div>${escapeHTML(c.replace(/^\d+\.\s*/, ''))}</div>
                        </div>
                    `).join('')}

                    ${isFinal ? `
                        <div style="margin-top: 30px; font-weight: 500;">We appreciate doing business with your organization also in future.</div>

                        <div class="signature-zone">
                            <div class="sig-box">
                                <div class="sig-stamp">${signatureHtml}</div>
                                <div class="sig-line"></div>
                                For ${escapeHTML(bName)}
                                <div style="font-size: 10px; margin-top: 5px; color: #64748b;">SIGNED</div>
                            </div>
                            <div class="sig-box">
                                <div class="sig-line"></div>
                                For ${escapeHTML(sName)}
                                <div style="font-size: 10px; margin-top: 5px; color: #64748b;">SIGNED</div>
                            </div>
                            <div class="sig-box">
                                <div class="sig-line"></div>
                                For ${escapeHTML(p.broker || 'BROKER')}
                                <div style="font-size: 10px; margin-top: 5px; color: #64748b;">SIGNED</div>
                            </div>
                        </div>
                    ` : `<div style="text-align:right; font-size:10px; color:#94a3b8; margin-top: 20px;">... continued on next page</div>`}
                </div>
            </div>
        </div>
    </div>`;

    let finalHtml = `<html><head><title>PO - ${escapeHTML(p.no)}</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>${poStyles}</style></head><body>
        ${getPageContent(1, page1Conds, false)}
        ${getPageContent(2, page2Conds, true)}
        ${autoFitScript}
    </body></html>`;

    return finalHtml;
}

// ==========================================
// STOCK LOSS / RECONCILIATION
// ==========================================

window.addStockLoss = function(e) {
    if(e) e.preventDefault(); 
    
    const form = document.getElementById('loss-form');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    if (typeof Enterprise !== 'undefined' && !Enterprise.security.isAdmin(true)) return;

    const dt = document.getElementById('loss-date').value;
    const itm = document.getElementById('loss-item').value;
    const wt = parseFloat(document.getElementById('loss-wt').value) || 0;
    const rate = parseFloat(document.getElementById('loss-rate').value) || 0;
    
    const lossValue = wt * rate;

    const entry = {
        id: 'LSS_' + Date.now(),
        date: dt,
        item: itm,
        weight: wt,
        bags: parseInt(document.getElementById('loss-bags').value) || 0,
        rate: rate,
        lossValue: lossValue,
        reason: document.getElementById('loss-reason').value,
        poId: document.getElementById('loss-po-ref').value,
        remarks: document.getElementById('loss-remarks').value
    };

    db.stock_loss.unshift(entry);
    saveLocalLoss(); 
    
    if(typeof window.saveData === 'function') window.saveData(true);
    else if(typeof saveData === 'function') saveData(true);
    
    _lastInvDataCounts.loss = db.stock_loss.length;
    
    form.reset();
    updateGlobalStockKPIs();
    renderLossTable();
    if(typeof Enterprise !== 'undefined') Enterprise.notify(`Stock Loss Logged: ₹${lossValue.toLocaleString('en-IN')}`, "warning");
};

window.renderLossTable = function() {
    const table = document.querySelector('#loss-table');
    const tbody = table.querySelector('tbody');
    if (!tbody || !db.stock_loss) return;

    const filterFy = document.getElementById('filter-fy-loss')?.value || '';
    const dateFrom = document.getElementById('filter-date-from-loss')?.value || '';
    const dateTo = document.getElementById('filter-date-to-loss')?.value || '';
    const searchFilter = (document.getElementById('filter-search-loss')?.value || '').toLowerCase();
    const limitStr = document.getElementById('filter-limit-loss')?.value || '10';

    let filtered = db.stock_loss.filter(l => {
        if (!checkDateFilter(l.date, filterFy, dateFrom, dateTo)) return false;
        if (searchFilter) {
            const str = `${l.item} ${l.reason} ${l.remarks}`.toLowerCase();
            if (!str.includes(searchFilter)) return false;
        }
        return true;
    });

    filtered.sort((a,b)=>new Date(b.date)-new Date(a.date));
    window.currentInvFilteredData.loss = filtered;
    
    let totVal = 0;
    filtered.forEach(l => totVal += parseFloat(l.lossValue || 0));
    totVal = Math.round(totVal * 100) / 100;
    
    const anBox = document.getElementById('loss-analytics-val');
    if(anBox) anBox.innerText = `₹${totVal.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}`;

    const paginated = getPaginatedData(filtered, 'loss', limitStr);

    if (paginated.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 20px; color:var(--text-muted);">No stock loss recorded.</td></tr>`;
        return;
    }

    tbody.innerHTML = paginated.map(l => {
        const displayDate = typeof formatDateIN === 'function' ? formatDateIN(l.date) : l.date;
        const linkedPO = l.poId ? db.po.find(p => p.id === l.poId) : null;
        const refHtml = linkedPO ? `PO: <b>${escapeHTML(linkedPO.no)}</b>` : '-';
        const safeId = escapeHTML(l.id).replace(/&#039;/g, "\\'");

        return `<tr>
            <td>${displayDate}</td>
            <td><b>${escapeHTML(l.item)}</b></td>
            <td style="color:var(--danger); font-weight:bold;">${l.weight.toLocaleString('en-US', {minimumFractionDigits:3})}</td>
            <td>${l.bags}</td>
            <td>₹${l.rate.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
            <td style="color:#b45309; font-weight:bold;">₹${l.lossValue.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
            <td><span class="status-badge" style="background: var(--surface)beb; color:#b45309; border:1px solid #fde047;">${escapeHTML(l.reason)}</span></td>
            <td>${refHtml}<br><small>${escapeHTML(l.remarks)}</small></td>
            <td>
                <button class="danger" style="padding:2px 6px; font-size:0.75rem;" onclick="deleteLossEntry('${safeId}')">Del</button>
            </td>
        </tr>`;
    }).join('') + renderPaginationFooter('loss', filtered.length, limitStr, 'renderLossTable');
};

window.deleteLossEntry = function(id) {
    if(typeof Enterprise !== 'undefined' && !Enterprise.security.canDelete()) return;
    if(!confirm(`Delete this stock loss entry? It will restore the balance back to the master stock.`)) return;
    
    const idx = db.stock_loss.findIndex(l => l.id === id);
    if (idx > -1) {
        db.stock_loss.splice(idx, 1);
        saveLocalLoss(); 
        if(typeof saveData === 'function') saveData(true);
        _lastInvDataCounts.loss = db.stock_loss.length;
        updateGlobalStockKPIs();
        renderLossTable();
    }
};

window.exportInvFiltered = function(type) {
    let data = window.currentInvFilteredData[type];
    if (!data || data.length === 0) {
        if(typeof Enterprise !== 'undefined') Enterprise.notify("No data to export.", "warning");
        return;
    }
    
    let csv = `JFT ENTERPRISE - INVENTORY EXPORT\nDate Generated: ${new Date().toLocaleString()}\n\n`;

    if (type === 'inv') {
        csv += `Date,Type,Item,Reference,Bags,Weight,Source\n`;
        data.forEach(r => csv += `"${r.date}","${r.type}","${r.item}","${r.ref}","${r.bags}","${r.weight}","${r.source}"\n`);
    } else if (type === 'po') {
        csv += `PO Date,PO No,Vendor,Item,Ordered Wt,Rate,Tax,Remarks\n`;
        data.forEach(p => csv += `"${p.date}","${p.no}","${p.vendor}","${p.item}","${p.orderedWt}","${p.rate}","${p.tax}","${p.remarks}"\n`);
    } else if (type === 'sc') {
        csv += `SC Date,SC No,Buyer,Contract Wt,Shipped Wt,Balance Wt\n`;
        data.forEach(s => csv += `"${s.date}","${s.no}","${s.buyer.split('\n')[0]}","${s.contractWt}","${s.shippedWt}","${s.balWt}"\n`);
    } else if (type === 'loss') {
        csv += `Date,Item,Lost Wt,Bags,Rate,Loss Value,Reason,Remarks\n`;
        data.forEach(l => csv += `"${l.date}","${l.item}","${l.weight}","${l.bags}","${l.rate}","${l.lossValue}","${l.reason}","${l.remarks}"\n`);
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Inventory_${type}_${Date.now()}.csv`;
    link.click();
};


