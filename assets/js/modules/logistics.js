/* --- PRO LOGISTICS, DEMURRAGE ENGINE & COURIER TRACKER (WITH PAGINATION) --- */

if (!db.log_trucks) db.log_trucks = [];
if (!db.log_containers) db.log_containers = [];
if (!db.log_vessels) db.log_vessels = [];
if (!db.log_couriers) db.log_couriers = [];
if (!db.po) db.po = [];

window.escapeHTML = window.escapeHTML || function(str) {
    if (!str) return '';
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
};

let logisticsMap = null;
let mapMarkers = [];

let currentPageTruck = 1;
let currentPageCont = 1;
let currentPageVess = 1;
let currentPageCour = 1;
const itemsPerPageLogistics = 15;

window.logFilterInvoice = '';

window.currentFilteredData = {
    trucks: [],
    containers: [],
    vessels: [],
    couriers: []
};

// ==========================================
// ASYNC DB LOAD WATCHDOG (FIX FOR INITIAL EMPTY TABLES)
// ==========================================
// Watchdog removed: Replaced by Enterprise Sync Hub in ui.js

// ==========================================
// CORE INITIALIZATION & TAB SWITCHING
// ==========================================

window.switchLogisticsTab = function(tabId) {
    document.querySelectorAll('#logistics .sub-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.logistics-container').forEach(c => c.classList.add('hidden'));
    
    const activeBtn = document.getElementById(`btn-log-${tabId}`);
    if (activeBtn) activeBtn.classList.add('active');
    
    const tabEl = document.getElementById(`log-${tabId}-tab`);
    if (tabEl) tabEl.classList.remove('hidden');
    
    if (tabId === 'vessel') {
        setTimeout(() => {
            initLogisticsMap();
            if (logisticsMap) logisticsMap.invalidateSize(); 
        }, 300); 
    }
    
    if (tabId === 'truck') renderTruckTable();
    if (tabId === 'container') renderContainerTable();
    if (tabId === 'vessel') renderVesselTable();
    if (tabId === 'courier') renderCourierTable();
    if (tabId === 'freight') renderFreightLedger();
};

window.renderLogistics = function() {
    initLogisticsFYDropdowns();
    populateLogisticsInvoiceDropdowns(); 
    populateGlobalDropdowns(); 
    
    renderTruckTable();
    renderContainerTable();
    renderVesselTable();
    renderCourierTable();
    renderFreightLedger();
};

function initLogisticsFYDropdowns() {
    const selects = ['truck-filter-fy', 'cont-filter-fy', 'vess-filter-fy', 'cour-filter-fy'];
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth(); 
    let startYear = currentMonth >= 3 ? currentYear : currentYear - 1;
    
    let html = '<option value="">All Years</option>';
    for(let i = 0; i < 5; i++) {
        let y1 = startYear - i;
        let y2 = y1 + 1;
        let val = `${y1}-${y2}`;
        html += `<option value="${val}">${val}</option>`;
    }
    
    selects.forEach(id => {
        const el = document.getElementById(id);
        if (el && el.options.length <= 1) {
            el.innerHTML = html;
        }
    });
}

function populateGlobalDropdowns() {
    const shipLines = ["MAERSK", "MSC", "CMA CGM", "COSCO", "Hapag-Lloyd", "ONE", "Evergreen", "HMM", "Yang Ming", "ZIM", "PIL", "Wan Hai", "SITC", "TS Lines", "SM Line", "Safmarine", "OOCL", "Hamburg Sud", "NYK", "APL", "Oman Shipping", "Emirates Shipping"];
    const couriers = ["DHL", "FedEx", "UPS", "Aramex", "BlueDart", "TNT", "DTDC", "EMS", "India Post", "USPS", "Royal Mail", "Skynet", "Delhivery", "Professional Couriers", "Trackon", "First Flight", "Ecom Express"];

    const vessLine = document.getElementById('vess-line');
    const contLine = document.getElementById('cont-line');
    const courCo = document.getElementById('cour-co');

    const generateOptions = (list, currentVal) => {
        return '<option value="">-- Select --</option>' + list.map(l => `<option value="${l}" ${l===currentVal?'selected':''}>${l}</option>`).join('');
    };

    if(vessLine && vessLine.tagName === 'SELECT' && vessLine.options.length <= 1) vessLine.innerHTML = generateOptions(shipLines, vessLine.value);
    if(contLine && contLine.tagName === 'SELECT' && contLine.options.length <= 1) contLine.innerHTML = generateOptions(shipLines, contLine.value);
    if(courCo && courCo.tagName === 'SELECT' && courCo.options.length <= 1) courCo.innerHTML = generateOptions(couriers, courCo.value);
}

function populateLogisticsInvoiceDropdowns() {
    const filterSelects = document.querySelectorAll('.log-filter-inv-select');
    const inputSelects = document.querySelectorAll('.log-inv-select:not(.log-filter-inv-select)');
    const poSelects = document.querySelectorAll('.log-po-select');
    const scSelects = document.querySelectorAll('.log-sc-select');

    if (!db.docs) return;

    let filterOptions = '<option value="">All Invoices</option>';
    let inputOptions = '<option value="">-- No Link --</option>';
    
    // COMMERCIAL INVOICES
    const sortedDocs = [...db.docs].filter(d => d.type === 'Commercial Invoice').sort((a,b) => new Date(b.date) - new Date(a.date));
    sortedDocs.forEach(d => {
        const opt = `<option value="${escapeHTML(d.id)}">${escapeHTML(d.no)} | ${escapeHTML(d.buyer.split('\n')[0])}</option>`;
        filterOptions += opt;
        inputOptions += opt;
    });

    filterSelects.forEach(s => { const val = s.value; s.innerHTML = filterOptions; if(val) s.value = val; });
    inputSelects.forEach(s => { const val = s.value; s.innerHTML = inputOptions; if(val) s.value = val; });

    // PURCHASE ORDERS
    if (db.po) {
        let poOptions = '<option value="">-- Select PO --</option>';
        db.po.sort((a,b)=>new Date(b.date)-new Date(a.date)).forEach(p => {
            poOptions += `<option value="${p.id}">${escapeHTML(p.no)} | ${escapeHTML(p.vendor.split('\n')[0])}</option>`;
        });
        poSelects.forEach(s => { const val = s.value; s.innerHTML = poOptions; if(val) s.value = val; });
    }

    // SALES CONTRACTS
    let scOptions = '<option value="">-- Select SC --</option>';
    db.docs.filter(d => d.type === 'Sales Contract').sort((a,b)=>new Date(b.date)-new Date(a.date)).forEach(sc => {
        scOptions += `<option value="${sc.id}">${escapeHTML(sc.no)} | ${escapeHTML(sc.buyer.split('\n')[0])}</option>`;
    });
    scSelects.forEach(s => { const val = s.value; s.innerHTML = scOptions; if(val) s.value = val; });
}

window.resetLogisticsFilters = function(tab) {
    const ids = ['fy', 'date-from', 'date-to', 'invoice', 'search'];
    ids.forEach(id => {
        const el = document.getElementById(`${tab}-filter-${id}`);
        if(el) el.value = '';
    });
    
    const limit = document.getElementById(`${tab}-filter-limit`);
    if(limit) limit.value = '25';

    if (tab === 'truck') { currentPageTruck = 1; renderTruckTable(); }
    if (tab === 'cont') { currentPageCont = 1; renderContainerTable(); }
    if (tab === 'vess') { currentPageVess = 1; renderVesselTable(); }
    if (tab === 'cour') { currentPageCour = 1; renderCourierTable(); }
    
    if(typeof Enterprise !== 'undefined') Enterprise.notify("Filters Reset", "info");
};

/* ================== TRUCKS ================== */

window.addTruckEntry = function(e) {
    e.preventDefault();
    const entry = {
        id: generateId(),
        date: document.getElementById('truck-date').value,
        no: document.getElementById('truck-no').value,
        seller: document.getElementById('truck-seller').value,
        driver: document.getElementById('truck-driver').value,
        item: document.getElementById('truck-item').value,
        bags: document.getElementById('truck-bags').value,
        weight: document.getElementById('truck-weight').value,
        kata: document.getElementById('truck-kata').value,
        type: document.getElementById('truck-type').value,
        status: document.getElementById('truck-status').value,
        remark: document.getElementById('truck-remark').value,
        poId: document.getElementById('truck-po-id').value, 
        docId: document.getElementById('truck-doc-id').value, 
        location: document.getElementById('truck-location')?.value || 'Main Godown', 
        customData: typeof DynamicUI !== 'undefined' ? DynamicUI.extractData('log_trucks') : {}
    };
    db.log_trucks.unshift(entry); 
    if(typeof saveData === 'function') saveData(true); 
    
    // Force immediate sync count update to prevent double rendering
    renderTruckTable(); 
    if(typeof renderInventoryLedger === 'function') renderInventoryLedger();
    if(typeof renderPOTable === 'function') renderPOTable();
    e.target.reset();
    if(typeof DynamicUI !== 'undefined') DynamicUI.resetForm('log_trucks');
};

window.dispatchTruckWhatsApp = function(id) {
    const t = db.log_trucks.find(x => x.id === id);
    if (!t) return;
    
    const text = `*🚛 TRANSPORT DISPATCH*\n\n*Date:* ${t.date}\n*Truck No:* ${t.no}\n*Driver Info:* ${t.driver || 'N/A'}\n*Commodity:* ${t.item}\n*Weight:* ${t.weight} MT\n\n_Please confirm loading/unloading._`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
};

window.renderTruckTable = function() {
    const table = document.querySelector('#truck-table');
    if (!table) return;

    if(typeof DynamicUI !== 'undefined') DynamicUI.injectForm('truck-form', 'log_trucks');
    
    const theadHTML = `
        <tr>
            <th>Date</th><th>Truck No</th><th>Location/Godown</th><th>Seller</th><th>Driver</th><th>Item</th><th>Bags</th>
            <th>Weight (MT)</th><th>Kata Wt (MT)</th><th>Type</th><th>Status</th><th>Remark</th><th>PO</th><th>Invoice</th>
            ${typeof DynamicUI !== 'undefined' ? DynamicUI.getHeaders('log_trucks') : ''}
            <th>Action</th>
        </tr>
    `;
    table.querySelector('thead').innerHTML = theadHTML;

    const fyFilter = document.getElementById('truck-filter-fy')?.value || '';
    const dateFrom = document.getElementById('truck-filter-date-from')?.value || '';
    const dateTo = document.getElementById('truck-filter-date-to')?.value || '';
    const invFilter = document.getElementById('truck-filter-invoice')?.value || '';
    const searchFilter = (document.getElementById('truck-filter-search')?.value || '').toLowerCase();
    const limitStr = document.getElementById('truck-filter-limit')?.value || '25';

    let filtered = db.log_trucks.filter(t => {
        const tDate = new Date(t.date);
        
        if (dateFrom && tDate < new Date(dateFrom)) return false;
        if (dateTo && tDate > new Date(dateTo)) return false;
        if (fyFilter) {
            const [y1, y2] = fyFilter.split('-');
            const fyStart = new Date(`${y1}-04-01`);
            const fyEnd = new Date(`${y2}-03-31`);
            if (tDate < fyStart || tDate > fyEnd) return false;
        }
        if (invFilter && t.docId !== invFilter) return false;

        const linkedPO = t.poId ? db.po.find(p => p.id === t.poId) : (t.docId ? db.po.find(p => p.id === t.docId) : null);
        const poText = linkedPO ? linkedPO.no.toLowerCase() : '';

        const linkedDoc = t.docId ? db.docs.find(d => d.id === t.docId) : null;
        const invText = linkedDoc ? linkedDoc.no.toLowerCase() : '';

        if (searchFilter) {
            const searchString = `${t.date} ${t.no} ${t.seller} ${t.driver} ${t.item} ${t.bags} ${t.weight} ${t.kata} ${t.type} ${t.status} ${t.remark} ${poText} ${invText}`.toLowerCase();
            if (!searchString.includes(searchFilter)) return false;
        }

        return true;
    });

    filtered.sort((a,b)=>new Date(b.date)-new Date(a.date));
    window.currentFilteredData.trucks = filtered;

    let totalBags = 0, totalWeight = 0, totalKata = 0;
    filtered.forEach(t => {
        totalBags += parseInt(t.bags) || 0;
        totalWeight += parseFloat(t.weight) || 0;
        totalKata += parseFloat(t.kata) || 0;
    });

    const elBags = document.getElementById('truck-total-bags');
    const elWt = document.getElementById('truck-total-weight');
    const elKw = document.getElementById('truck-total-kata');
    if(elBags) elBags.innerText = totalBags;
    if(elWt) elWt.innerText = totalWeight.toFixed(3) + ' MT';
    if(elKw) elKw.innerText = totalKata.toFixed(3) + ' MT';

    const limit = limitStr === 'all' ? filtered.length : parseInt(limitStr, 10);
    const totalPages = Math.ceil(filtered.length / limit) || 1;
    if (currentPageTruck > totalPages) currentPageTruck = totalPages || 1;
    if (currentPageTruck < 1) currentPageTruck = 1;
    const startIndex = (currentPageTruck - 1) * limit;
    const paginated = limitStr === 'all' ? filtered : filtered.slice(startIndex, startIndex + limit);

    let html = paginated.map(t => {
        const displayDate = typeof formatDateIN === 'function' ? formatDateIN(t.date) : t.date;
        const linkedPO = t.poId ? db.po.find(p => p.id === t.poId) : (t.docId ? db.po.find(p => p.id === t.docId) : null);
        const poHtml = linkedPO ? `<b>${escapeHTML(linkedPO.no)}</b>` : '-';

        const linkedDoc = t.docId ? db.docs.find(d => d.id === t.docId) : null;
        const invHtml = linkedDoc ? escapeHTML(linkedDoc.no) : '-';
        const safeId = escapeHTML(t.id).replace(/&#039;/g, "\\'"); 

        return `<tr>
            <td>${displayDate}</td>
            <td><b>${escapeHTML(t.no)}</b></td>
            <td><span style="font-size:0.75rem; color:var(--primary); font-weight:600;">📍 ${escapeHTML(t.location || 'Main Godown')}</span></td>
            <td>${escapeHTML(t.seller)}</td>
            <td>${escapeHTML(t.driver)}</td>
            <td>${escapeHTML(t.item)}</td>
            <td>${escapeHTML(t.bags)}</td>
            <td>${escapeHTML(t.weight)} MT</td>
            <td>${escapeHTML(t.kata)} MT</td>
            <td>${escapeHTML(t.type)}</td>
            <td>${escapeHTML(t.status)}</td>
            <td>${escapeHTML(t.remark)}</td>
            <td>${poHtml}</td>
            <td>${invHtml}</td>
            ${typeof DynamicUI !== 'undefined' ? DynamicUI.getCells('log_trucks', t.customData) : ''}
            <td>
                <div style="display:flex; gap:5px;">
                    <button class="secondary" style="padding: 4px 8px; font-size: 0.75rem; background: #25D366; color: white; border: none;" onclick="dispatchTruckWhatsApp('${safeId}')">📱 WA</button>
                    <button class="danger" style="padding: 4px 8px; font-size: 0.75rem;" onclick="deleteLogEntry('log_trucks', '${safeId}')">Del</button>
                </div>
            </td>
        </tr>`;
    }).join('');

    if (paginated.length === 0) {
        html = `<tr><td colspan="15" style="text-align:center; padding: 20px; color:var(--text-muted);">No trucks matched your filter.</td></tr>`;
    } else if (totalPages > 1) {
        html += `
        <tr style="background:var(--surface);">
            <td colspan="15" style="text-align:center; padding: 10px;">
                <button class="secondary" style="padding: 2px 8px; font-size:0.8rem;" onclick="currentPageTruck--; renderTruckTable()" ${currentPageTruck <= 1 ? 'disabled' : ''}>◀ Prev</button>
                <span style="margin:0 15px; font-size:0.85rem; font-weight:bold;">Page ${currentPageTruck} of ${totalPages}</span>
                <button class="secondary" style="padding: 2px 8px; font-size:0.8rem;" onclick="currentPageTruck++; renderTruckTable()" ${currentPageTruck >= totalPages ? 'disabled' : ''}>Next ▶</button>
            </td>
        </tr>`;
    }
    table.querySelector('tbody').innerHTML = html;
};

/* ================== CONTAINERS ================== */

window.addContainerEntry = function(e) {
    e.preventDefault();
    const entry = {
        id: generateId(), 
        date: document.getElementById('cont-date').value,
        no: document.getElementById('cont-no').value, 
        seal: document.getElementById('cont-seal').value,
        size: document.getElementById('cont-size').value, 
        bags: document.getElementById('cont-bags').value,
        nw: document.getElementById('cont-nw').value, 
        kw: document.getElementById('cont-kw').value,
        line: document.getElementById('cont-line').value,
        pickupDate: document.getElementById('cont-pickup').value,
        freeDays: document.getElementById('cont-freedays').value,
        scId: document.getElementById('cont-sc-id').value,
        docId: document.getElementById('cont-doc-id').value,
        gatedIn: false,
        customData: typeof DynamicUI !== 'undefined' ? DynamicUI.extractData('log_containers') : {}
    };
    db.log_containers.unshift(entry); 
    if(typeof saveData === 'function') saveData(true); 
    
    renderContainerTable(); 
    if(typeof renderInventoryLedger === 'function') renderInventoryLedger();
    if(typeof renderSCTable === 'function') renderSCTable();
    e.target.reset();
    if(typeof DynamicUI !== 'undefined') DynamicUI.resetForm('log_containers');
};

window.toggleGateIn = function(id) {
    const c = db.log_containers.find(x => x.id === id);
    if (!c) return;
    c.gatedIn = !c.gatedIn;
    if(typeof saveData === 'function') saveData(true);
    renderContainerTable();
};

window.dispatchContainerWhatsApp = function(id) {
    const c = db.log_containers.find(x => x.id === id);
    if (!c) return;
    const safeBags = c.bags || '0';
    const text = `*📦 CONTAINER DISPATCH*\n\n*Date:* ${c.date}\n*Container No:* ${c.no}\n*Seal No:* ${c.seal}\n*Size:* ${c.size}\n*Net Wt:* ${c.nw} MT (${safeBags} Bags)\n*Shipping Line:* ${c.line || 'N/A'}\n\n_Please verify stuffing details._`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
};

window.renderContainerTable = function() {
    const table = document.querySelector('#container-table');
    if (!table) return;

    if(typeof DynamicUI !== 'undefined') DynamicUI.injectForm('cont-form', 'log_containers');
    
    const theadHTML = `
        <tr>
            <th>Date</th><th>Container No</th><th>Seal No</th><th>Size</th><th>Bags</th>
            <th>Net Wt</th><th>Gross Wt</th><th>Line</th><th>Pickup Date</th><th>Free Days</th><th>Demurrage</th><th>SC</th><th>Invoice</th>
            ${typeof DynamicUI !== 'undefined' ? DynamicUI.getHeaders('log_containers') : ''}
            <th>Action</th>
        </tr>
    `;
    table.querySelector('thead').innerHTML = theadHTML;

    const fyFilter = document.getElementById('cont-filter-fy')?.value || '';
    const dateFrom = document.getElementById('cont-filter-date-from')?.value || '';
    const dateTo = document.getElementById('cont-filter-date-to')?.value || '';
    const invFilter = document.getElementById('cont-filter-invoice')?.value || '';
    const searchFilter = (document.getElementById('cont-filter-search')?.value || '').toLowerCase();
    const limitStr = document.getElementById('cont-filter-limit')?.value || '25';

    let filtered = db.log_containers.filter(c => {
        const cDate = new Date(c.date);
        
        if (dateFrom && cDate < new Date(dateFrom)) return false;
        if (dateTo && cDate > new Date(dateTo)) return false;
        if (fyFilter) {
            const [y1, y2] = fyFilter.split('-');
            const fyStart = new Date(`${y1}-04-01`);
            const fyEnd = new Date(`${y2}-03-31`);
            if (cDate < fyStart || cDate > fyEnd) return false;
        }
        if (invFilter && c.docId !== invFilter) return false;

        const linkedSC = c.scId ? db.docs.find(d => d.id === c.scId) : (c.docId ? db.docs.find(d => d.id === c.docId) : null);
        const scText = linkedSC ? linkedSC.no.toLowerCase() : '';

        const linkedDoc = c.docId ? db.docs.find(d => d.id === c.docId) : null;
        const invText = linkedDoc ? linkedDoc.no.toLowerCase() : '';
        
        let demText = 'No Data';
        if (c.gatedIn) demText = 'gated in';
        else if (c.pickupDate && c.freeDays) {
            const pickup = new Date(c.pickupDate);
            const lastFreeDay = new Date(pickup);
            lastFreeDay.setDate(lastFreeDay.getDate() + parseInt(c.freeDays));
            const diffDays = Math.ceil((new Date() - lastFreeDay) / (1000 * 60 * 60 * 24));
            demText = diffDays > 0 ? 'overdue' : 'free';
        }

        if (searchFilter) {
            const searchString = `${c.date} ${c.no} ${c.seal} ${c.size} ${c.bags} ${c.nw} ${c.kw} ${c.line} ${c.pickupDate} ${c.freeDays} ${demText} ${scText} ${invText}`.toLowerCase();
            if (!searchString.includes(searchFilter)) return false;
        }

        return true;
    });

    filtered.sort((a,b)=>new Date(b.date)-new Date(a.date));
    window.currentFilteredData.containers = filtered;

    // --- OPTION 2: DEMURRAGE CRISIS AUDITOR ---
    let overdueCount = 0; let criticalCount = 0; let estDailyLoss = 0;
    const ratePerDay = 8500; 

    (db.log_containers || []).forEach(c => {
        if (c.gatedIn || !c.pickupDate || !c.freeDays) return;
        const lastDay = new Date(c.pickupDate);
        lastDay.setDate(lastDay.getDate() + parseInt(c.freeDays));
        const diff = Math.ceil((new Date() - lastDay) / (1000 * 60*60*24));
        if (diff > 0) { overdueCount++; estDailyLoss += ratePerDay; }
        else if (diff >= -3) { criticalCount++; }
    });

    const crisisBox = document.getElementById('demurrage-crisis-box');
    if (crisisBox) {
        if (overdueCount > 0 || criticalCount > 0) {
            crisisBox.style.display = 'block';
            crisisBox.innerHTML = `
                <div style="background: linear-gradient(135deg, #7f1d1d, #450a0a); border-radius: 12px; padding: 20px; color: white; display: flex; align-items: center; gap: 20px; margin-bottom: 25px; box-shadow: 0 10px 25px rgba(127, 29, 29, 0.3);">
                    <div style="font-size: 2.5rem; animation: pulse 2s infinite;">🚢</div>
                    <div style="flex: 1;">
                        <h4 style="margin: 0; color: #fecaca; text-transform: uppercase; letter-spacing: 1px;">Logistics Financial Risk Alert</h4>
                        <p style="margin: 5px 0 0 0; font-size: 0.95rem;">
                            <b>${overdueCount}</b> containers in Demurrage. 
                            <b>${criticalCount}</b> units expiring within 72 hours.
                        </p>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 0.7rem; color: #f87171; font-weight: bold;">PROJECTED DAILY LOSS</div>
                        <div style="font-size: 1.5rem; font-weight: 800;">₹${estDailyLoss.toLocaleString()}</div>
                    </div>
                </div>`;
        } else { crisisBox.style.display = 'none'; }
    }

    let totalBags = 0, totalNw = 0, totalKw = 0;
    filtered.forEach(c => {
        totalBags += parseInt(c.bags) || 0;
        totalNw += parseFloat(c.nw) || 0;
        totalKw += parseFloat(c.kw) || 0;
    });

    const elBags = document.getElementById('cont-total-bags');
    const elNw = document.getElementById('cont-total-nw');
    const elKw = document.getElementById('cont-total-kw');
    if(elBags) elBags.innerText = totalBags;
    if(elNw) elNw.innerText = totalNw.toFixed(3) + ' MT';
    if(elKw) elKw.innerText = totalKw.toFixed(3) + ' MT';

    const limit = limitStr === 'all' ? filtered.length : parseInt(limitStr, 10);
    const totalPages = Math.ceil(filtered.length / limit) || 1;
    if (currentPageCont > totalPages) currentPageCont = totalPages || 1;
    if (currentPageCont < 1) currentPageCont = 1;
    const startIndex = (currentPageCont - 1) * limit;
    const paginated = limitStr === 'all' ? filtered : filtered.slice(startIndex, startIndex + limit);

    let html = paginated.map(c => {
        const displayDate = typeof formatDateIN === 'function' ? formatDateIN(c.date) : c.date;
        const linkedSC = c.scId ? db.docs.find(d => d.id === c.scId) : (c.docId ? db.docs.find(d => d.id === c.docId) : null);
        const scHtml = linkedSC ? `<b>${escapeHTML(linkedSC.no)}</b>` : '-';

        const linkedDoc = c.docId ? db.docs.find(d => d.id === c.docId) : null;
        const invHtml = linkedDoc ? escapeHTML(linkedDoc.no) : '-';

        let demurrageHtml = '<span style="color:var(--text-muted); font-size:0.75rem;">No Data</span>';
        if (c.gatedIn) {
            demurrageHtml = `<span class="status-badge" style="background:var(--bg); color:#475569; border:1px solid var(--border);">✅ Gated In</span>`;
        } else if (c.pickupDate && c.freeDays) {
            const pickup = new Date(c.pickupDate);
            const lastFreeDay = new Date(pickup);
            lastFreeDay.setDate(lastFreeDay.getDate() + parseInt(c.freeDays));
            const diffDays = Math.ceil((new Date() - lastFreeDay) / (1000 * 60 * 60 * 24));
            
            if (diffDays > 0) {
                // RED ALERT: Currently costing money
                demurrageHtml = `<span class="status-badge" style="background:#fee2e2; color:#9f1239; border:1px solid #fecaca; animation: pulse 2s infinite;">🚨 ${diffDays} Days Overdue</span>`;
            } else if (diffDays >= -3) {
                // ORANGE WARNING: Expiring in 72 hours
                demurrageHtml = `<span class="status-badge" style="background:#ffedd5; color:#9a3412; border:1px solid #fed7aa;">⚠️ Expiring Soon (${Math.abs(diffDays)}d)</span>`;
            } else {
                // GREEN: Safe
                demurrageHtml = `<span class="status-badge" style="background:rgba(34, 197, 94, 0.1); color:#166534; border:1px solid #bbf7d0;">${Math.abs(diffDays)} Days Free</span>`;
            }
        }

        const safeId = escapeHTML(c.id).replace(/&#039;/g, "\\'"); 
        const gateBtnColor = c.gatedIn ? '#10b981' : 'var(--surface)';
        const gateBtnTextC = c.gatedIn ? 'white' : 'var(--text)';

        return `<tr>
            <td>${displayDate}</td>
            <td><b>${escapeHTML(c.no)}</b></td>
            <td>${escapeHTML(c.seal)}</td>
            <td>${escapeHTML(c.size)}</td>
            <td>${escapeHTML(c.bags)}</td>
            <td>${escapeHTML(c.nw)} MT</td>
            <td>${escapeHTML(c.kw)} MT</td>
            <td>${escapeHTML(c.line)}</td>
            <td>${escapeHTML(c.pickupDate)}</td>
            <td>${escapeHTML(c.freeDays)}</td>
            <td>${demurrageHtml}</td>
            <td>${scHtml}</td>
            <td>${invHtml}</td>
            ${typeof DynamicUI !== 'undefined' ? DynamicUI.getCells('log_containers', c.customData) : ''}
            <td>
                <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                    <button class="secondary" style="padding: 4px 8px; font-size: 0.75rem; background: ${gateBtnColor}; color: ${gateBtnTextC}; border: 1px solid var(--border);" onclick="toggleGateIn('${safeId}')">🏁 Gate In</button>
                    <button class="secondary" style="padding: 4px 8px; font-size: 0.75rem; background: #25D366; color: white; border: none;" onclick="dispatchContainerWhatsApp('${safeId}')">📱 WA</button>
                    <button class="danger" style="padding: 4px 8px; font-size: 0.75rem;" onclick="deleteLogEntry('log_containers', '${safeId}')">Del</button>
                </div>
            </td>
        </tr>`;
    }).join('');

    if (paginated.length === 0) html = `<tr><td colspan="14" style="text-align:center; padding: 20px; color:var(--text-muted);">No containers matched your filter.</td></tr>`;
    else if (totalPages > 1) {
        html += `
        <tr style="background:var(--surface);">
            <td colspan="14" style="text-align:center; padding: 10px;">
                <button class="secondary" style="padding: 2px 8px; font-size:0.8rem;" onclick="currentPageCont--; renderContainerTable()" ${currentPageCont <= 1 ? 'disabled' : ''}>◀ Prev</button>
                <span style="margin:0 15px; font-size:0.85rem; font-weight:bold;">Page ${currentPageCont} of ${totalPages}</span>
                <button class="secondary" style="padding: 2px 8px; font-size:0.8rem;" onclick="currentPageCont++; renderContainerTable()" ${currentPageCont >= totalPages ? 'disabled' : ''}>Next ▶</button>
            </td>
        </tr>`;
    }
    table.querySelector('tbody').innerHTML = html;
};

/* ================== VESSELS ================== */

window.addVesselEntry = async function(e) {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if(submitBtn) { submitBtn.innerText = "⏳ Saving..."; submitBtn.disabled = true; }

    const editingId = e.target.dataset.editing;
    const pol = document.getElementById('vess-pol').value || 'Nhava Sheva, India';
    const pod = document.getElementById('vess-pod').value;
    const newEta = document.getElementById('vess-eta').value;
    
    let polLat = null, polLon = null, podLat = null, podLon = null;

    // Only geocode if it's a new entry or port changed (simplified for now)
    try {
        if(pol) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout failover
            
            const resPol = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(pol)}`, { 
                headers: { 'User-Agent': 'JFT-Agro-Enterprise-ERP/8.2' },
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            const dataPol = await resPol.json();
            if (dataPol && dataPol[0]) { polLat = parseFloat(dataPol[0].lat); polLon = parseFloat(dataPol[0].lon); }
            
            // SHIELD: Nominatim rate limit requires 1 second between requests
            await new Promise(r => setTimeout(r, 1100)); 
        }
        if(pod) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const resPod = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(pod)}`, { 
                headers: { 'User-Agent': 'JFT-Agro-Enterprise-ERP/8.2' },
                signal: controller.signal 
            });
            clearTimeout(timeoutId);
            const dataPod = await resPod.json();
            if (dataPod && dataPod[0]) { podLat = parseFloat(dataPod[0].lat); podLon = parseFloat(dataPod[0].lon); }
        }
    } catch(err) { 
        console.warn("Geocoding API Bypassed (Offline/Timed-out):", err);
        if(err.name === 'AbortError') Enterprise.notify("⚠️ Map API timed out. Saving without new port coordinates.", "warning");
    } finally {
        if(submitBtn) { submitBtn.innerText = "Save Record"; submitBtn.disabled = false; }
    }

    const docIdEl = document.getElementById('vess-doc-id');
    const existing = editingId ? db.log_vessels.find(v => v.id === editingId) : null;

    const entry = {
        id: editingId || generateId(), 
        name: document.getElementById('vess-name').value,
        bl: document.getElementById('vess-bl').value, 
        line: document.getElementById('vess-line').value,
        docId: docIdEl ? docIdEl.value : '', 
        pol: pol, 
        polLat: polLat || (existing ? existing.polLat : null), 
        polLon: polLon || (existing ? existing.polLon : null),
        pod: pod, 
        lat: podLat || (existing ? existing.lat : null), 
        lon: podLon || (existing ? existing.lon : null), 
        etd: document.getElementById('vess-etd').value, 
        eta: newEta,
        etaHistory: existing ? (existing.etaHistory || []) : [],
        customData: typeof DynamicUI !== 'undefined' ? DynamicUI.extractData('log_vessels') : {}
    };

    // TRACK ETA DRIFT (ROLLING HISTORY GUARD)
    if (!existing || existing.eta !== newEta) {
        entry.etaHistory.unshift({ // Newest first
            eta: newEta,
            timestamp: Date.now(),
            user: sessionStorage.getItem('jft_user') || 'System'
        });
        
        // Prune history to keep document size optimal
        if (entry.etaHistory.length > 20) {
            entry.etaHistory = entry.etaHistory.slice(0, 20);
        }
    }
    
    if (editingId) {
        const idx = db.log_vessels.findIndex(v => v.id === editingId);
        if (idx > -1) db.log_vessels[idx] = entry;
        delete e.target.dataset.editing;
    } else {
        db.log_vessels.unshift(entry);
    }

    if(typeof saveData === 'function') saveData(true);
    
    _lastDataCounts.vess = db.log_vessels.length;
    renderVesselTable();
    plotVesselsOnMap(); 
    e.target.reset();
    
    document.getElementById('vess-pol').value = 'Nhava Sheva, India'; 
    if(submitBtn) { submitBtn.innerText = "🚢 Add Vessel to Map"; submitBtn.disabled = false; }
    if(typeof DynamicUI !== 'undefined') DynamicUI.resetForm('log_vessels');
};

window.editVesselEntry = function(id) {
    const v = db.log_vessels.find(x => x.id === id);
    if (!v) return;
    document.getElementById('vess-name').value = v.name;
    document.getElementById('vess-bl').value = v.bl;
    document.getElementById('vess-line').value = v.line;
    document.getElementById('vess-pol').value = v.pol || 'Nhava Sheva, India';
    document.getElementById('vess-pod').value = v.pod;
    document.getElementById('vess-etd').value = v.etd;
    document.getElementById('vess-eta').value = v.eta;
    const docIdEl = document.getElementById('vess-doc-id');
    if (docIdEl) docIdEl.value = v.docId || '';
    
    document.getElementById('vess-form').dataset.editing = id;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if(typeof Enterprise !== 'undefined') Enterprise.notify("Loaded Vessel for Editing", "info");
};

window.showEtaTimeline = function(id) {
    const v = db.log_vessels.find(x => x.id === id);
    if (!v || !v.etaHistory) return;

    let html = `<div style="padding:20px; font-family:sans-serif;">
        <h3 style="margin-top:0; color:var(--primary);">📅 ETA Drift History: ${v.bl}</h3>
        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:20px;">Vessel: ${v.name} | Carrier: ${v.line}</p>
        <div style="border-left: 2px solid var(--border); padding-left: 20px; margin-left: 10px;">
    `;

    v.etaHistory.forEach((h, i) => {
        const dateStr = new Date(h.timestamp).toLocaleString();
        const etaDate = h.eta;
        let driftIcon = '📍';
        let driftText = 'Original Schedule';
        
        if (i > 0) {
            const prev = new Date(v.etaHistory[i-1].eta);
            const curr = new Date(h.eta);
            const diff = Math.ceil((curr - prev) / (1000 * 60 * 60 * 24));
            if (diff > 0) { driftIcon = '🔴'; driftText = `Delayed by ${diff} days`; }
            else if (diff < 0) { driftIcon = '🟢'; driftText = `Advanced by ${Math.abs(diff)} days`; }
            else { driftIcon = '⚪'; driftText = 'Updated (no change in days)'; }
        }

        html += `
            <div style="margin-bottom:15px; position:relative;">
                <div style="position:absolute; left:-27px; top:3px; background:white; font-size:1.2rem;">${driftIcon}</div>
                <div style="font-weight:bold; font-size:0.9rem;">${etaDate}</div>
                <div style="font-size:0.75rem; color:var(--text-muted);">${driftText}</div>
                <div style="font-size:0.65rem; color:var(--primary); opacity:0.7;">Logged at ${dateStr}</div>
            </div>
        `;
    });

    html += `</div></div>`;
    
    if (window.Enterprise && window.Enterprise.showModal) {
        window.Enterprise.showModal(html);
    } else {
        alert("ETA History for " + v.bl + ":\n" + v.etaHistory.map(h => h.eta).join(" -> "));
    }
};

function initLogisticsMap() {
    const mapDiv = document.getElementById('shipment-map');
    if (!mapDiv || logisticsMap) return;

    logisticsMap = L.map('shipment-map').setView([15, 75], 3);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        crossOrigin: true 
    }).addTo(logisticsMap);
    
    plotVesselsOnMap();
}

window.plotVesselsOnMap = async function() {
    if (!logisticsMap) return;
    
    mapMarkers.forEach(m => logisticsMap.removeLayer(m));
    mapMarkers = [];

    for (let i = 0; i < db.log_vessels.length; i++) {
        const v = db.log_vessels[i];
        if (!v.pod) continue;
        if (!v.pol) v.pol = 'Nhava Sheva, India';
        
        // Ensure coordinates are cached
        if (!v.polLat || !v.polLon || !v.lat || !v.lon) {
            try {
                if(!v.polLat) {
                    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(v.pol)}`, { headers: { 'User-Agent': 'JFT-Agro-Enterprise-ERP/8.2' }});
                    const data = await res.json();
                    if (data && data[0]) { v.polLat = parseFloat(data[0].lat); v.polLon = parseFloat(data[0].lon); }
                    await new Promise(r => setTimeout(r, 600)); 
                }
                if(!v.lat) {
                    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(v.pod)}`, { headers: { 'User-Agent': 'JFT-Agro-Enterprise-ERP/8.2' }});
                    const data = await res.json();
                    if (data && data[0]) { v.lat = parseFloat(data[0].lat); v.lon = parseFloat(data[0].lon); }
                    await new Promise(r => setTimeout(r, 600));
                }
                if(typeof saveData === 'function') saveData(true);
            } catch(e) {}
        }

        if (v.polLat && v.polLon && v.lat && v.lon) {
            const originMarker = L.circleMarker([v.polLat, v.polLon], { color: 'var(--primary)', radius: 5, fillOpacity: 0.8 }).addTo(logisticsMap).bindPopup(`<b>POL: ${escapeHTML(v.pol)}</b>`);
            const destMarker = L.circleMarker([v.lat, v.lon], { color: '#10b981', radius: 5, fillOpacity: 0.8 }).addTo(logisticsMap).bindPopup(`<b>POD: ${escapeHTML(v.pod)}</b>`);
            const polyline = L.polyline([[v.polLat, v.polLon], [v.lat, v.lon]], {color: '#94a3b8', weight: 1.5, dashArray: '4, 8', opacity: 0.5}).addTo(logisticsMap);
            
            mapMarkers.push(originMarker, destMarker, polyline);

            let progress = 0.5; 
            if (v.etd && v.eta) {
                const startTime = new Date(v.etd).getTime();
                const endTime = new Date(v.eta).getTime();
                const nowTime = new Date().getTime();
                if (nowTime >= endTime) progress = 1; 
                else if (nowTime <= startTime) progress = 0; 
                else progress = (nowTime - startTime) / (endTime - startTime);
            }

            const currentLat = v.polLat + ((v.lat - v.polLat) * progress);
            const currentLon = v.polLon + ((v.lon - v.polLon) * progress);

            const shipIcon = L.divIcon({ className: 'live-ship-marker', html: `<div>🚢</div>`, iconSize: [28, 28], iconAnchor: [14, 14] });
            const liveMarker = L.marker([currentLat, currentLon], {icon: shipIcon}).addTo(logisticsMap)
                .bindPopup(`
                    <div style="text-align:center; min-width: 140px;">
                        <b style="color:var(--primary); font-size:1rem;">${escapeHTML(v.name)}</b><br>
                        <span style="color:var(--text-muted); font-size:0.75rem;">Deep AIS Simulation</span><br>
                        <div style="background:var(--border); width:100%; height:6px; border-radius:3px; margin:8px 0; overflow:hidden;">
                            <div style="background:linear-gradient(90deg, #3b82f6, #6366f1); height:100%; width:${(progress * 100).toFixed(0)}%;"></div>
                        </div>
                        <div style="font-size:0.75rem; margin-bottom:10px;"><b>${(progress * 100).toFixed(1)}%</b> Journey Completed</div>
                        <a href="https://www.vesselfinder.com/vessels?name=${encodeURIComponent(v.name)}" target="_blank" style="background:var(--primary); color:white; text-decoration:none; padding:4px 8px; border-radius:4px; font-size:0.7rem; display:block;">🛰️ Live AIS Radar</a>
                    </div>
                `);
            mapMarkers.push(liveMarker);
        }
    }
}

window.dispatchVesselETAWhatsApp = function(id) {
    const v = db.log_vessels.find(x => x.id === id);
    if (!v) return;
    const myCompany = (db.profile && db.profile.name) ? db.profile.name : 'JFT Agro Overseas';
    const text = `*🚢 SHIPMENT ETA UPDATE - ${myCompany}*\n\n*Vessel/Voyage:* ${v.name}\n*BL Number:* ${v.bl}\n*Port of Loading:* ${v.pol || 'India'}\n*Port of Discharge:* ${v.pod}\n*Expected Arrival (ETA):* ${v.eta}\n\n_Please note this ETA is subject to shipping line schedules. Kindly arrange for clearance._`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
};

window.renderVesselTable = function() {
    const table = document.querySelector('#vessel-table');
    if (!table) return;

    if(typeof DynamicUI !== 'undefined') DynamicUI.injectForm('vess-form', 'log_vessels');
    
    table.querySelector('thead').innerHTML = `
        <tr>
            <th>Vessel Name</th><th>BL No</th><th>Line</th><th>POL</th><th>POD</th><th>ETD</th><th>ETA</th><th>Invoice</th>
            ${typeof DynamicUI !== 'undefined' ? DynamicUI.getHeaders('log_vessels') : ''}
            <th>Action</th>
        </tr>
    `;

    const fyFilter = document.getElementById('vess-filter-fy')?.value || '';
    const dateFrom = document.getElementById('vess-filter-date-from')?.value || '';
    const dateTo = document.getElementById('vess-filter-date-to')?.value || '';
    const invFilter = document.getElementById('vess-filter-invoice')?.value || '';
    const searchFilter = (document.getElementById('vess-filter-search')?.value || '').toLowerCase();
    const limitStr = document.getElementById('vess-filter-limit')?.value || '25';

    let filtered = db.log_vessels.filter(v => {
        const vDate = new Date(v.etd || v.eta || 0);
        
        if (dateFrom && vDate < new Date(dateFrom)) return false;
        if (dateTo && vDate > new Date(dateTo)) return false;
        if (fyFilter) {
            const [y1, y2] = fyFilter.split('-');
            const fyStart = new Date(`${y1}-04-01`);
            const fyEnd = new Date(`${y2}-03-31`);
            if (vDate < fyStart || vDate > fyEnd) return false;
        }
        if (invFilter && v.docId !== invFilter) return false;

        const linkedDoc = v.docId ? db.docs.find(d => d.id === v.docId) : null;
        const invText = linkedDoc ? linkedDoc.no.toLowerCase() : '';

        if (searchFilter) {
            const searchString = `${v.name} ${v.bl} ${v.line} ${v.pol} ${v.pod} ${v.etd} ${v.eta} ${invText}`.toLowerCase();
            if (!searchString.includes(searchFilter)) return false;
        }

        return true;
    });

    filtered.sort((a,b) => new Date(b.etd || 0) - new Date(a.etd || 0));
    window.currentFilteredData.vessels = filtered;

    const limit = limitStr === 'all' ? filtered.length : parseInt(limitStr, 10);
    const totalPages = Math.ceil(filtered.length / limit) || 1;
    if (currentPageVess > totalPages) currentPageVess = totalPages || 1;
    if (currentPageVess < 1) currentPageVess = 1;
    const startIndex = (currentPageVess - 1) * limit;
    const paginated = limitStr === 'all' ? filtered : filtered.slice(startIndex, startIndex + limit);

    let html = paginated.map(v => {
        let trackUrl = `https://www.google.com/search?q=${encodeURIComponent(v.line + ' tracking ' + v.bl)}`;
        const lineUpper = (v.line || '').toUpperCase();
        if(lineUpper.includes("MAERSK")) trackUrl = `https://www.maersk.com/tracking/${encodeURIComponent(v.bl)}`;
        if(lineUpper.includes("MSC")) trackUrl = `https://www.msc.com/en/track-a-shipment?trackingNumber=${encodeURIComponent(v.bl)}`;
        if(lineUpper.includes("CMA")) trackUrl = `https://www.cma-cgm.com/ebusiness/tracking/search?SearchBy=BL&SearchText=${encodeURIComponent(v.bl)}`;
        if(lineUpper.includes("HAPAG")) trackUrl = `https://www.hapag-lloyd.com/en/online-business/track/track-by-booking-solution.html?blno=${encodeURIComponent(v.bl)}`;

        const linkedDoc = v.docId ? db.docs.find(d => d.id === v.docId) : null;
        const invHtml = linkedDoc ? escapeHTML(linkedDoc.no) : '-';
        const safeId = escapeHTML(v.id).replace(/&#039;/g, "\\'");

        // ETA DRIFT LOGIC
        let driftHtml = '';
        if (v.etaHistory && v.etaHistory.length > 1) {
            const initial = new Date(v.etaHistory[0].eta);
            const current = new Date(v.eta);
            const diffDays = Math.ceil((current - initial) / (1000 * 60 * 60 * 24));
            if (diffDays > 0) driftHtml = `<br><span style="color:#ef4444; font-size:0.65rem; font-weight:bold;">⚠️ +${diffDays}d Drift</span>`;
            else if (diffDays < 0) driftHtml = `<br><span style="color:#10b981; font-size:0.65rem; font-weight:bold;">🚀 ${diffDays}d Early</span>`;
        }

        // LINE RELIABILITY ENGINE
        const lineName = (v.line || '').toUpperCase();
        let reliabilityBadge = '';
        if (lineName) {
            const lineShipments = db.log_vessels.filter(x => (x.line || '').toUpperCase() === lineName && x.etaHistory && x.etaHistory.length > 1);
            let totalDrift = 0;
            lineShipments.forEach(s => {
                const sInit = new Date(s.etaHistory[0].eta);
                const sCurr = new Date(s.eta);
                totalDrift += Math.ceil((sCurr - sInit) / (1000 * 60 * 60 * 24));
            });
            const avgDrift = lineShipments.length > 0 ? totalDrift / lineShipments.length : 0;
            let grade = 'A', color = '#10b981';
            if (avgDrift > 7) { grade = 'F'; color = '#ef4444'; }
            else if (avgDrift > 4) { grade = 'D'; color = '#f59e0b'; }
            else if (avgDrift > 2) { grade = 'C'; color = '#3b82f6'; }
            else if (avgDrift > 0.5) { grade = 'B'; color = '#6366f1'; }
            
            reliabilityBadge = `<span title="Line Reliability Grade: ${grade} (Avg Drift: ${avgDrift.toFixed(1)} days)" style="font-size:0.6rem; background:${color}; color:white; padding:1px 4px; border-radius:3px; margin-left:5px; vertical-align:middle; cursor:help;">${grade}</span>`;
        }

        return `<tr>
            <td><b>${escapeHTML(v.name)}</b></td>
            <td>${escapeHTML(v.bl)}</td>
            <td>${escapeHTML(v.line)}${reliabilityBadge}</td>
            <td>${escapeHTML(v.pol || 'Nhava Sheva, India')}</td>
            <td>${escapeHTML(v.pod)}</td>
            <td>${escapeHTML(v.etd)}</td>
            <td style="position:relative;">
                <b>${escapeHTML(v.eta)}</b>${driftHtml}
                ${v.etaHistory ? `<button onclick="showEtaTimeline('${safeId}')" style="background:none; border:none; padding:0; cursor:pointer; font-size:0.7rem; color:var(--primary); text-decoration:underline; display:block; margin-top:2px;">View Log</button>` : ''}
            </td>
            <td>${invHtml}</td>
            ${typeof DynamicUI !== 'undefined' ? DynamicUI.getCells('log_vessels', v.customData) : ''}
            <td>
                <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                    <button class="secondary" style="padding: 4px 8px; font-size: 0.75rem;" onclick="editVesselEntry('${safeId}')">✏️ Edit</button>
                    <a href="${trackUrl}" target="_blank" class="secondary" style="padding: 4px 8px; font-size: 0.75rem; text-decoration:none;">🌐 Track</a>
                    <button class="secondary" style="padding: 4px 8px; font-size: 0.75rem; background: #25D366; color: white; border: none;" onclick="dispatchVesselETAWhatsApp('${safeId}')">📱 WA</button>
                    <button class="danger" style="padding: 4px 8px; font-size: 0.75rem;" onclick="deleteLogEntry('log_vessels', '${safeId}')">Del</button>
                </div>
            </td>
        </tr>`;
    }).join('');

    if (paginated.length === 0) html = `<tr><td colspan="9" style="text-align:center; padding: 20px; color:var(--text-muted);">No vessels matched your filter.</td></tr>`;
    else if (totalPages > 1) {
        html += `
        <tr style="background:var(--surface);">
            <td colspan="9" style="text-align:center; padding: 10px;">
                <button class="secondary" style="padding: 2px 8px; font-size:0.8rem;" onclick="currentPageVess--; renderVesselTable()" ${currentPageVess <= 1 ? 'disabled' : ''}>◀ Prev</button>
                <span style="margin:0 15px; font-size:0.85rem; font-weight:bold;">Page ${currentPageVess} of ${totalPages}</span>
                <button class="secondary" style="padding: 2px 8px; font-size:0.8rem;" onclick="currentPageVess++; renderVesselTable()" ${currentPageVess >= totalPages ? 'disabled' : ''}>Next ▶</button>
            </td>
        </tr>`;
    }
    table.querySelector('tbody').innerHTML = html;
};

/* ================== COURIERS ================== */

window.addCourierEntry = function(e) {
    e.preventDefault();
    const docIdEl = document.getElementById('cour-doc-id');
    const entry = {
        id: generateId(), 
        date: document.getElementById('cour-date').value,
        co: document.getElementById('cour-co').value, 
        awb: document.getElementById('cour-awb').value, 
        to: document.getElementById('cour-to').value,
        docId: docIdEl ? docIdEl.value : '',
        customData: typeof DynamicUI !== 'undefined' ? DynamicUI.extractData('log_couriers') : {}
    };
    db.log_couriers.unshift(entry); 
    if(typeof saveData === 'function') saveData(true); 
    
    _lastDataCounts.cour = db.log_couriers.length;
    renderCourierTable(); 
    e.target.reset();
    if(typeof DynamicUI !== 'undefined') DynamicUI.resetForm('log_couriers');
};

window.renderCourierTable = function() {
    const table = document.querySelector('#courier-table');
    if (!table) return;

    if(typeof DynamicUI !== 'undefined') DynamicUI.injectForm('cour-form', 'log_couriers');
    
    table.querySelector('thead').innerHTML = `
        <tr>
            <th>Date</th><th>Company</th><th>AWB No.</th><th>Destination</th><th>Invoice</th>
            ${typeof DynamicUI !== 'undefined' ? DynamicUI.getHeaders('log_couriers') : ''}
            <th>Action</th>
        </tr>
    `;

    const fyFilter = document.getElementById('cour-filter-fy')?.value || '';
    const dateFrom = document.getElementById('cour-filter-date-from')?.value || '';
    const dateTo = document.getElementById('cour-filter-date-to')?.value || '';
    const invFilter = document.getElementById('cour-filter-invoice')?.value || '';
    const searchFilter = (document.getElementById('cour-filter-search')?.value || '').toLowerCase();
    const limitStr = document.getElementById('cour-filter-limit')?.value || '25';

    let filtered = db.log_couriers.filter(c => {
        const cDate = new Date(c.date);
        
        if (dateFrom && cDate < new Date(dateFrom)) return false;
        if (dateTo && cDate > new Date(dateTo)) return false;
        if (fyFilter) {
            const [y1, y2] = fyFilter.split('-');
            const fyStart = new Date(`${y1}-04-01`);
            const fyEnd = new Date(`${y2}-03-31`);
            if (cDate < fyStart || cDate > fyEnd) return false;
        }
        if (invFilter && c.docId !== invFilter) return false;

        const linkedDoc = c.docId ? db.docs.find(d => d.id === c.docId) : null;
        const invText = linkedDoc ? linkedDoc.no.toLowerCase() : '';

        if (searchFilter) {
            const searchString = `${c.date} ${c.co} ${c.awb} ${c.to} ${invText}`.toLowerCase();
            if (!searchString.includes(searchFilter)) return false;
        }

        return true;
    });

    filtered.sort((a,b)=>new Date(b.date)-new Date(a.date));
    window.currentFilteredData.couriers = filtered;

    const limit = limitStr === 'all' ? filtered.length : parseInt(limitStr, 10);
    const totalPages = Math.ceil(filtered.length / limit) || 1;
    if (currentPageCour > totalPages) currentPageCour = totalPages || 1;
    if (currentPageCour < 1) currentPageCour = 1;
    const startIndex = (currentPageCour - 1) * limit;
    const paginated = limitStr === 'all' ? filtered : filtered.slice(startIndex, startIndex + limit);

    let html = paginated.map(c => {
        const displayDate = typeof formatDateIN === 'function' ? formatDateIN(c.date) : c.date;
        const linkedDoc = c.docId ? db.docs.find(d => d.id === c.docId) : null;
        const invHtml = linkedDoc ? escapeHTML(linkedDoc.no) : '-';
        
        const coMatch = (c.co || '').toUpperCase();
        let trackUrl = `https://www.google.com/search?q=${encodeURIComponent(c.co + ' tracking ' + c.awb)}`;
        if(coMatch.includes("DHL")) trackUrl = `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(c.awb)}`;
        else if(coMatch.includes("FEDEX")) trackUrl = `https://www.fedex.com/fedextrack/?tracknumbers=${encodeURIComponent(c.awb)}`;
        else if(coMatch.includes("UPS")) trackUrl = `https://www.ups.com/track?tracknum=${encodeURIComponent(c.awb)}`;
        else if(coMatch.includes("ARAMEX")) trackUrl = `https://www.aramex.com/us/en/track/results?mode=0&ShipmentNumber=${encodeURIComponent(c.awb)}`;
        else if(coMatch.includes("BLUEDART")) trackUrl = `https://www.bluedart.com/tracking`;
        else if(coMatch.includes("DTDC")) trackUrl = `https://www.dtdc.in/tracking/tracking_results.asp`;

        const safeId = escapeHTML(c.id).replace(/&#039;/g, "\\'"); 
        
        return `<tr>
            <td>${displayDate}</td>
            <td>${escapeHTML(c.co)}</td>
            <td><b>${escapeHTML(c.awb)}</b></td>
            <td>${escapeHTML(c.to)}</td>
            <td>${invHtml}</td>
            ${typeof DynamicUI !== 'undefined' ? DynamicUI.getCells('log_couriers', c.customData) : ''}
            <td>
                <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                    <a href="${trackUrl}" target="_blank" class="secondary" style="padding: 4px 8px; font-size: 0.75rem; text-decoration:none;">🌐 Track</a>
                    <button class="danger" style="padding: 4px 8px; font-size: 0.75rem;" onclick="deleteLogEntry('log_couriers', '${safeId}')">Del</button>
                </div>
            </td>
        </tr>`;
    }).join('');

    if (paginated.length === 0) html = `<tr><td colspan="10" style="text-align:center; padding: 20px; color:var(--text-muted);">No couriers matched your filter.</td></tr>`;
    else if (totalPages > 1) {
        html += `
        <tr style="background:var(--surface);">
            <td colspan="10" style="text-align:center; padding: 10px;">
                <button class="secondary" style="padding: 2px 8px; font-size:0.8rem;" onclick="currentPageCour--; renderCourierTable()" ${currentPageCour <= 1 ? 'disabled' : ''}>◀ Prev</button>
                <span style="margin:0 15px; font-size:0.85rem; font-weight:bold;">Page ${currentPageCour} of ${totalPages}</span>
                <button class="secondary" style="padding: 2px 8px; font-size:0.8rem;" onclick="currentPageCour++; renderCourierTable()" ${currentPageCour >= totalPages ? 'disabled' : ''}>Next ▶</button>
            </td>
        </tr>`;
    }
    table.querySelector('tbody').innerHTML = html;
};

// ==========================================
// FIXED IN-PLACE DELETE FUNCTION
// ==========================================
window.deleteLogEntry = function(arrayName, id) {
    if(typeof Enterprise !== 'undefined' && Enterprise.security && !Enterprise.security.canDelete()) return;
    if (!confirm(`Are you sure you want to completely delete this record?`)) return;
    
    // Explicitly mutate the active array via splice to preserve Firebase references
    const targetArray = db[arrayName];
    if (targetArray) {
        const idx = targetArray.findIndex(x => x.id === id);
        if (idx > -1) {
            targetArray.splice(idx, 1);
        }
    }
    
    // Force sync immediately
    if(typeof saveData === 'function') saveData(true); 
    
    // Decrease the expected length so the watchdog doesn't get confused
    if (arrayName === 'log_trucks') _lastDataCounts.truck--;
    if (arrayName === 'log_containers') _lastDataCounts.cont--;
    if (arrayName === 'log_vessels') _lastDataCounts.vess--;
    if (arrayName === 'log_couriers') _lastDataCounts.cour--;
    if (arrayName === 'log_inventory') _lastDataCounts.inv--;

    // Re-render ONLY the specific active table
    if (arrayName === 'log_trucks') { 
        renderTruckTable(); 
        if(typeof renderInventoryLedger === 'function') renderInventoryLedger(); 
        if(typeof renderPOTable === 'function') renderPOTable();
    }
    else if (arrayName === 'log_containers') { 
        renderContainerTable(); 
        if(typeof renderInventoryLedger === 'function') renderInventoryLedger(); 
        if(typeof renderSCTable === 'function') renderSCTable();
    }
    else if (arrayName === 'log_vessels') { renderVesselTable(); plotVesselsOnMap(); }
    else if (arrayName === 'log_couriers') renderCourierTable();
    else if (arrayName === 'log_inventory') renderInventoryLedger();
    
    if(typeof Enterprise !== 'undefined') Enterprise.notify("Record Deleted Successfully", "info");
};

window.exportLogisticsFiltered = function(type) {
    let data = window.currentFilteredData[type.replace('log_', '')];
    if (!data || data.length === 0) {
        if(typeof Enterprise !== 'undefined') Enterprise.notify("No data available to export.", "warning");
        return;
    }
    
    let csv = `JFT ENTERPRISE - LOGISTICS EXPORT (${type.toUpperCase()})\nDate Generated: ${new Date().toLocaleString()}\n\n`;

    if (type === 'log_trucks') {
        csv += `Date,Truck No,Seller,Driver,Item,Bags,Weight (MT),Kata Wt (MT),Type,Status,Remark\n`;
        data.forEach(t => csv += `"${t.date}","${t.no}","${t.seller || ''}","${t.driver || ''}","${t.item}","${t.bags || 0}","${t.weight || 0}","${t.kata || 0}","${t.type || ''}","${t.status || ''}","${t.remark || ''}"\n`);
    } else if (type === 'log_containers') {
        csv += `Date,Container No,Seal No,Size,Bags,Net Wt (MT),Gross Wt (MT),Line,Pickup Date,Free Days\n`;
        data.forEach(c => csv += `"${c.date}","${c.no}","${c.seal}","${c.size}","${c.bags}","${c.nw}","${c.kw || ''}","${c.line || ''}","${c.pickupDate || ''}","${c.freeDays || ''}"\n`);
    } else if (type === 'log_vessels') {
        csv += `Vessel Name,BL No,Line,POL,POD,ETD,ETA\n`;
        data.forEach(v => csv += `"${v.name}","${v.bl}","${v.line}","${v.pol}","${v.pod}","${v.etd}","${v.eta}"\n`);
    } else if (type === 'log_couriers') {
        csv += `Date,Company,AWB No,Destination\n`;
        data.forEach(c => csv += `"${c.date}","${c.co}","${c.awb}","${c.to}"\n`);
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Filtered_${type}_${Date.now()}.csv`;
    link.click();

    if(typeof Enterprise !== 'undefined') Enterprise.logAction(`Exported Filtered Logistics Data: ${type}`);
};


// ==========================================
// ELITE FREIGHT OPTIMIZER & ROUTE INTELLIGENCE
// ==========================================

window.addFreightRate = function(e) {
    e.preventDefault();
    if (!db.freight_rates) db.freight_rates = [];

    const newRate = {
        id: 'FRT_' + Date.now(),
        date: document.getElementById('fr-date').value,
        pol: document.getElementById('fr-pol').value.trim(),
        pod: document.getElementById('fr-pod').value.trim(),
        liner: document.getElementById('fr-liner').value.trim(),
        type: document.getElementById('fr-type').value,
        ocean: parseFloat(document.getElementById('fr-ocean').value) || 0,
        transit: parseInt(document.getElementById('fr-transit').value) || 0,
        reliability: parseInt(document.getElementById('fr-reli').value) || 95,
        timestamp: new Date().toISOString()
    };

    db.freight_rates.unshift(newRate);
    saveData(true);
    e.target.reset();
    renderFreightLedger();
    if(typeof Enterprise !== 'undefined') Enterprise.notify("Competitive market rate logged successfully!", "success");
};

window.renderFreightLedger = function() {
    const tbody = document.querySelector('#freight-ledger-table tbody');
    if (!tbody) return;

    if (!db.freight_rates) db.freight_rates = [];
    const query = document.getElementById('fr-search')?.value.toLowerCase() || '';

    let filtered = db.freight_rates.filter(f => {
        return (f.pol.toLowerCase().includes(query) || 
                f.pod.toLowerCase().includes(query) || 
                f.liner.toLowerCase().includes(query));
    });

    tbody.innerHTML = filtered.map(f => `
        <tr style="border-bottom: 1px solid var(--border); transition:0.2s;" onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background='transparent'">
            <td style="padding:12px;">${f.date || '---'}</td>
            <td style="padding:12px;"><b>${f.pol}</b> ➜ <b>${f.pod}</b></td>
            <td style="padding:12px; color:var(--primary); font-weight:bold;">${f.liner}</td>
            <td style="padding:12px; text-align:center;"><span style="background:var(--bg); padding:2px 6px; border-radius:4px; font-size:0.75rem;">${f.type}</span></td>
            <td style="padding:12px; text-align:right; font-weight:bold; color:var(--success);">$ ${f.ocean.toLocaleString()}</td>
            <td style="padding:12px; text-align:center;">${f.transit} Days</td>
            <td style="padding:12px; text-align:center;">
                <div style="width:100%; height:8px; background:var(--border); border-radius:4px; overflow:hidden;">
                    <div style="width:${f.reliability}%; height:100%; background:${f.reliability > 90 ? 'var(--success)' : 'var(--warning)'};"></div>
                </div>
                <div style="font-size:0.6rem; color:var(--text-muted); margin-top:2px;">${f.reliability}% Score</div>
            </td>
            <td style="padding:12px; text-align:right;">
                <button class="secondary" style="padding:4px 8px; font-size:0.75rem; color:var(--danger); border-color:var(--danger);" onclick="deleteFreightRate('${f.id}')">Delete</button>
            </td>
        </tr>
    `).join('') || `<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">No freight records found. Start logging rates to build intelligence.</td></tr>`;
};

window.deleteFreightRate = function(id) {
    if (!confirm("Remove this freight record from historical ledger?")) return;
    db.freight_rates = db.freight_rates.filter(f => f.id !== id);
    saveData(true);
    renderFreightLedger();
};

window.renderFreightOptimizer = function() {
    const pol = document.getElementById('fr-top-pol').value.trim().toLowerCase();
    const pod = document.getElementById('fr-top-pod').value.trim().toLowerCase();
    const type = document.getElementById('fr-top-type').value;
    const box = document.getElementById('freight-recommendation-box');

    if (!pol || !pod) return;

    const matches = db.freight_rates.filter(f => 
        f.pol.toLowerCase() === pol && 
        f.pod.toLowerCase() === pod && 
        f.type === type
    );

    if (matches.length === 0) {
        box.innerHTML = `<div style="padding:40px; text-align:center; color:var(--danger); background:rgba(239,68,68,0.05); border-radius:8px; border:1px solid rgba(239,68,68,0.2);">
            <div style="font-size:2rem; margin-bottom:10px;">📉</div>
            <b>No Data Point Found</b><br>Insufficient historical data for ${pol.toUpperCase()} ➜ ${pod.toUpperCase()} (${type}).
        </div>`;
        return;
    }

    // ELITE SORTING: Weighted Score (Price 70%, Reliability 20%, Speed 10%)
    matches.sort((a,b) => a.ocean - b.ocean);
    const bestPrice = matches[0];
    
    matches.sort((a,b) => a.transit - b.transit);
    const bestSpeed = matches[0];

    matches.sort((a,b) => b.reliability - a.reliability);
    const bestReliable = matches[0];

    box.innerHTML = `
        <div style="background:var(--bg); border-radius:8px; padding:20px; border:1px solid var(--border);">
            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:20px;">
                <div style="background:var(--surface); padding:15px; border-radius:8px; border-top:4px solid var(--success); box-shadow:0 4px 6px rgba(0,0,0,0.02);">
                    <div style="color:var(--success); font-weight:bold; font-size:0.7rem; text-transform:uppercase; margin-bottom:8px;">💰 MOST ECONOMICAL</div>
                    <div style="font-size:1.4rem; font-weight:bold; color:var(--primary);">$ ${bestPrice.ocean.toLocaleString()}</div>
                    <div style="font-weight:bold; margin-top:5px;">${bestPrice.liner}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">${bestPrice.transit} Days Transit</div>
                </div>

                <div style="background:var(--surface); padding:15px; border-radius:8px; border-top:4px solid var(--info); box-shadow:0 4px 6px rgba(0,0,0,0.02);">
                    <div style="color:var(--info); font-weight:bold; font-size:0.7rem; text-transform:uppercase; margin-bottom:8px;">⚡ FASTEST TRANSIT</div>
                    <div style="font-size:1.4rem; font-weight:bold; color:var(--primary);">${bestSpeed.transit} Days</div>
                    <div style="font-weight:bold; margin-top:5px;">${bestSpeed.liner}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">$ ${bestSpeed.ocean.toLocaleString()} O-Freight</div>
                </div>

                <div style="background:var(--surface); padding:15px; border-radius:8px; border-top:4px solid var(--warning); box-shadow:0 4px 6px rgba(0,0,0,0.02);">
                    <div style="color:var(--warning); font-weight:bold; font-size:0.7rem; text-transform:uppercase; margin-bottom:8px;">🛡️ BEST RELIABILITY</div>
                    <div style="font-size:1.4rem; font-weight:bold; color:var(--primary);">${bestReliable.reliability}%</div>
                    <div style="font-weight:bold; margin-top:5px;">${bestReliable.liner}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">Weighted Success Score</div>
                </div>
            </div>
            
            <div style="margin-top:20px; padding:12px; background:rgba(59, 130, 246, 0.05); border:1px solid rgba(59, 130, 246, 0.1); border-radius:6px; font-size:0.85rem; color:var(--text); text-align:center;">
                💡 <b>Strategic Recommendation:</b> ${bestPrice.id === bestReliable.id ? `Select <b>${bestPrice.liner}</b> for the perfect balance of cost and reliability.` : `Consider <b>${bestPrice.liner}</b> for cost savings ($ ${bestPrice.ocean.toLocaleString()}) or <b>${bestReliable.liner}</b> for higher security.`}
            </div>
        </div>
    `;
};
