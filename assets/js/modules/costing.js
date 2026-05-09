/* --- ADVANCED COSTING & PROFITABILITY CALCULATOR MODULE --- */

// 1. SAFE NATIVE BOOTLOADER: Waits for your main app to load 'db' from the cloud
function initCostingSystem() {
    if (typeof db === 'undefined') {
        setTimeout(initCostingSystem, 50); 
        return;
    }
    if (!db.costings) db.costings = [];
}
initCostingSystem();

// escapeHTML is defined globally in ui.js — no local copy needed.

// UI State & Tracking
window.currentCostFilteredData = [];
window.costCurrentPage = 1;
let _lastCostingCount = -1;

window.livePriceList = []; 

// 2. WATCHDOG ENGINE
// Watchdog removed: Replaced by Enterprise Sync Hub in ui.js

document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('cost-date');
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
    
    // Initialize Poster Date to today
    const posterDateInput = document.getElementById('live-poster-date-input');
    if (posterDateInput) {
        posterDateInput.value = new Date().toISOString().split('T')[0];
        updatePosterDate();
    }

    initCostFilters();
});

window.switchInvTab = window.switchInvTab || function() {}; 

window.switchCostTab = function(tabId) {
    document.querySelectorAll('#costing .sub-tab-btn').forEach(btn => btn.classList.remove('active'));
    ['cost-calc-tab', 'cost-live-tab', 'cost-quote-tab'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    
    const activeBtn = document.getElementById(`btn-cost-${tabId}`);
    if (activeBtn) activeBtn.classList.add('active');
    
    if (tabId === 'calc') {
        document.getElementById('cost-calc-tab').style.display = 'block';
        if (typeof calculateCosting === 'function') calculateCosting();
        if (typeof calcReversePrice === 'function') calcReversePrice();
    } else if (tabId === 'live') {
        document.getElementById('cost-live-tab').style.display = 'block';
        populateLiveHistoryDropdown();
    } else if (tabId === 'quote') {
        document.getElementById('cost-quote-tab').style.display = 'block';
        // Auto-populate rate from current db meta rate
        const rateInput = document.getElementById('qq-rate');
        if (rateInput && !rateInput.value) {
            const rate = (typeof getUsdInrRate === 'function') ? getUsdInrRate() : 84.50;
            rateInput.value = rate.toFixed(2);
        }
        if (typeof qqCalculate === 'function') qqCalculate();
    }
};
};

function initCostFilters() {
    const fySelect = document.getElementById(`filter-fy-cost`);
    if (fySelect && fySelect.options.length <= 1) {
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth(); 
        let startYear = currentMonth >= 3 ? currentYear : currentYear - 1;
        let html = '<option value="">All Years</option>';
        for(let i = 0; i < 5; i++) {
            let y1 = startYear - i;
            let y2 = y1 + 1;
            html += `<option value="${y1}-${y2}">${y1}-${y2}</option>`;
        }
        fySelect.innerHTML = html;
        fySelect.value = ""; 
    }
}

function checkDateFilter(dDateStr, filterFy, dateFrom, dateTo) {
    if (!dDateStr) return true;
    const dDate = new Date(dDateStr);
    if (isNaN(dDate.getTime())) return true; 
    if (dateFrom && dDate < new Date(dateFrom)) return false;
    if (dateTo) {
        const dtTo = new Date(dateTo);
        dtTo.setHours(23, 59, 59, 999);
        if (dDate > dtTo) return false;
    }
    if (filterFy) {
        const parts = filterFy.split('-');
        const fyStart = new Date(`${parts[0]}-04-01`);
        const fyEnd = new Date(`${parts[1]}-03-31T23:59:59`);
        if (dDate < fyStart || dDate > fyEnd) return false;
    }
    return true;
}

window.resetCostFilters = function() {
    ['fy-cost', 'date-from-cost', 'date-to-cost', 'search-cost', 'status-cost'].forEach(id => {
        const el = document.getElementById(`filter-${id}`);
        if(el) el.value = '';
    });
    const limit = document.getElementById(`filter-limit-cost`);
    if(limit) limit.value = '25';
    window.costCurrentPage = 1;
    renderCostingTable();
};

async function fetchLiveExchangeRate() {
    const fwdInput = document.getElementById('cost-forex');
    const revInput = document.getElementById('rcost-forex');
    if (!fwdInput && !revInput) return;

    if(typeof Enterprise !== 'undefined') Enterprise.notify("Refetching live global rates (with buffer)...", "info");
    
    try {
        const response = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await response.json();
        if (data && data.rates && data.rates.INR) {
            const baseRate = data.rates.INR;
            // Apply 0.50 buffer for bank spread / stability
            const safeRate = (baseRate - 0.50).toFixed(2); 
            
            if (fwdInput) fwdInput.value = safeRate;
            if (revInput) revInput.value = safeRate;
            
            calculateCosting(); // Triggers Forward calculation
            calcReversePrice();  // Triggers Reverse calculation
            
            if(typeof Enterprise !== 'undefined') Enterprise.notify(`✅ Rates Updated: ₹${safeRate}/$ (Buffer Incl.)`, "success");
        }
    } catch(err) {
        console.error("Forex API Error:", err);
        if(typeof Enterprise !== 'undefined') Enterprise.notify("❌ Connection to Forex Market failed.", "danger");
    }
}

window.currentForwardReceipt = {};

window.calculateCosting = function() {
    const getVal = (id) => parseFloat(document.getElementById(id)?.value) || 0;

    const unit = document.getElementById('cost-unit')?.value || 'MT';
    const purPrice = getVal('cost-rate-inr');
    const localOps = getVal('cost-packing') + getVal('cost-fumigation') + getVal('cost-surveyor') + getVal('cost-thc') + getVal('cost-cha');
    
    const totalOpInr = purPrice + localOps;

    const forex = getVal('cost-forex') || getUsdInrRate();
    const margin = getVal('cost-margin-usd');
    const otherDoc = getVal('cost-other-doc');

    let rawFob = 0;
    let baseUsdMt = 0;
    
    if (unit === 'KG') {
        baseUsdMt = (totalOpInr / forex) * 1000;
        rawFob = baseUsdMt + margin + otherDoc;
    } else {
        baseUsdMt = (totalOpInr / forex);
        rawFob = baseUsdMt + margin + otherDoc;
    }

    // Auto Ceiling to upper value
    const fobUsd = Math.ceil(rawFob);

    const contFreight = getVal('cost-cont-freight');
    const contMt = getVal('cost-cont-mt') || 27;
    let oceanFreightPerMt = 0;
    if (contFreight > 0 && contMt > 0) {
        oceanFreightPerMt = Math.ceil(contFreight / contMt); 
    }
    
    const freightInput = document.getElementById('cost-freight-usd');
    if (freightInput) freightInput.value = oceanFreightPerMt.toFixed(2);

    // Auto Ceiling to upper value
    const cifUsd = Math.ceil(fobUsd + oceanFreightPerMt);

    const elTotalInr = document.getElementById('display-total-inr');
    const elFobUsd = document.getElementById('display-fob-usd');
    const elQuoteUsd = document.getElementById('display-quote-usd');

    if (elTotalInr) elTotalInr.innerText = `₹ ${totalOpInr.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})} / ${unit}`;
    if (elFobUsd) elFobUsd.innerText = `$ ${fobUsd.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    if (elQuoteUsd) elQuoteUsd.innerText = `$ ${cifUsd.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

    window.currentForwardReceipt = {
        unit, purPrice, localOps, totalOpInr, baseUsdMt, margin, otherDoc, fobUsd, oceanFreightPerMt, cifUsd
    };

    calcReversePrice();
};

window.showCostingReceipt = function() {
    const rec = window.currentForwardReceipt;
    if (!rec || !rec.unit) return alert("Please fill out the costing form to calculate.");
    
    document.getElementById('rec-pur').innerText = `₹ ${rec.purPrice.toFixed(2)} / ${rec.unit}`;
    document.getElementById('rec-loc').innerText = `₹ ${rec.localOps.toFixed(2)} / ${rec.unit}`;
    document.getElementById('rec-tot-inr').innerText = `₹ ${rec.totalOpInr.toFixed(2)} / ${rec.unit}`;
    
    if (rec.unit === 'KG') {
        document.getElementById('rec-scale-mt').innerText = `Converted from KG (x 1000)`;
    } else {
        document.getElementById('rec-scale-mt').innerText = `Already MT Base (x 1)`;
    }

    document.getElementById('rec-base-usd').innerText = `$ ${rec.baseUsdMt.toFixed(2)} / MT`;
    document.getElementById('rec-docs').innerText = `$ ${rec.otherDoc.toFixed(2)}`;
    document.getElementById('rec-margin').innerText = `$ ${rec.margin.toFixed(2)}`;
    document.getElementById('rec-fob').innerText = `$ ${rec.fobUsd.toFixed(2)} / MT`;
    
    document.getElementById('rec-frt').innerText = `$ ${rec.oceanFreightPerMt.toFixed(2)}`;
    document.getElementById('rec-cif').innerText = `$ ${rec.cifUsd.toFixed(2)} / MT`;

    console.log("Showing Costing Receipt Modal", rec);
    const modal = document.getElementById('costing-receipt-modal');
    if (modal) {
        modal.style.display = 'flex';
        if(typeof Enterprise !== 'undefined') Enterprise.notify("Forward Costing Analysis generated.", "info");
    } else {
        console.error("Modal 'costing-receipt-modal' not found!");
    }
};

window.closeCostingReceipt = function() {
    const modal = document.getElementById('costing-receipt-modal');
    if (modal) {
        modal.style.display = 'none';
    }
};

window.saveCostingProfile = function(e) {
    e.preventDefault();
    if (typeof Enterprise !== 'undefined' && !Enterprise.security.isAdmin(true)) return;

    if (!db.costings) db.costings = []; 

    const getVal = (id) => parseFloat(document.getElementById(id)?.value) || 0;
    const getStr = (id) => document.getElementById(id)?.value.trim() || '';

    const unit = getStr('cost-unit');
    let rateInr = getVal('cost-rate-inr');
    
    if (unit === 'KG') rateInr = rateInr * 1000; 

    const forex = getVal('cost-forex') || 1;
    const packing = getVal('cost-packing');
    const fumigation = getVal('cost-fumigation');
    const surveyor = getVal('cost-surveyor');
    const thc = getVal('cost-thc');
    const cha = getVal('cost-cha');
    
    let localOpsMt = packing + fumigation + surveyor + thc + cha;
    if (unit === 'KG') localOpsMt = localOpsMt * 1000;

    const totalOpInrMt = rateInr + localOpsMt;
    
    const rawFob = (totalOpInrMt / forex) + getVal('cost-other-doc') + getVal('cost-margin-usd');
    const fobUsd = Math.ceil(rawFob);
    const oceanFrt = getVal('cost-freight-usd');
    const cifUsd = Math.ceil(fobUsd + oceanFrt);

    const profile = {
        id: document.getElementById('cost-id').value || 'CST_' + Date.now(),
        status: 'Pending', 
        date: getStr('cost-date') || new Date().toISOString().split('T')[0],
        quoteTo: getStr('cost-quote-to'),
        country: getStr('cost-country'),
        product: getStr('cost-product'),
        unit: unit,
        qty: getVal('cost-qty'),
        rateInrRaw: getVal('cost-rate-inr'), 
        
        ref: `${getStr('cost-quote-to')} - ${getStr('cost-product')}`, 
        rm: rateInr, 
        pack: unit === 'KG' ? packing*1000 : packing,
        proc: unit === 'KG' ? (fumigation + surveyor)*1000 : (fumigation + surveyor), 
        insp: unit === 'KG' ? surveyor*1000 : surveyor, 
        trans: unit === 'KG' ? thc*1000 : thc,
        cha: unit === 'KG' ? cha*1000 : cha,
        forex: forex,
        
        freight: oceanFrt,
        contFreight: getVal('cost-cont-freight'),
        contMt: getVal('cost-cont-mt'),
        otherDoc: getVal('cost-other-doc'),
        margin: getVal('cost-margin-usd'),

        targetFobUsd: fobUsd,
        targetCifUsd: cifUsd
    };

    const idx = db.costings.findIndex(c => c.id === profile.id);
    if (idx > -1) {
        profile.status = db.costings[idx].status || 'Pending';
        db.costings[idx] = profile;
    } else {
        db.costings.unshift(profile);
    }
    
    if(typeof saveData === 'function') saveData(true);
    else if(typeof window.saveData === 'function') window.saveData(true);
    
    _lastCostingCount = db.costings.length; 
    
    resetCostingForm();
    renderCostingTable();
    populateLiveHistoryDropdown(); 
    
    if(typeof Enterprise !== 'undefined') Enterprise.notify("Costing Profile Saved & Synced Successfully!", "success");
};

window.renderCostingTable = function() {
    const tbody = document.querySelector('#costing-table tbody');
    if (!tbody) return;

    if (!db.costings || db.costings.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 30px; color: var(--text-muted);">No saved quotations found.</td></tr>`;
        return;
    }

    const filterFy = document.getElementById('filter-fy-cost')?.value || '';
    const dateFrom = document.getElementById('filter-date-from-cost')?.value || '';
    const dateTo = document.getElementById('filter-date-to-cost')?.value || '';
    const searchFilter = (document.getElementById('filter-search-cost')?.value || '').toLowerCase();
    const statusFilter = document.getElementById('filter-status-cost')?.value || '';
    const limitStr = document.getElementById('filter-limit-cost')?.value || '25';

    let filtered = db.costings.filter(c => {
        if (!checkDateFilter(c.date, filterFy, dateFrom, dateTo)) return false;
        if (statusFilter && c.status !== statusFilter) return false;
        if (searchFilter) {
            const str = `${c.quoteTo} ${c.product} ${c.country} ${c.status}`.toLowerCase();
            if (!str.includes(searchFilter)) return false;
        }
        return true;
    });

    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    window.currentCostFilteredData = filtered;

    const limit = limitStr === 'all' ? filtered.length : parseInt(limitStr, 10);
    const startIndex = (window.costCurrentPage - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    if (paginated.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px; color:var(--text-muted);">No quotations match filters.</td></tr>`;
        return;
    }

    let html = paginated.map(c => {
        const safeId = escapeHTML(c.id).replace(/&#039;/g, "\\'");
        const displayDate = typeof formatDateIN === 'function' ? formatDateIN(c.date) : c.date;
        
        let acceptBtn = c.status === 'Accepted'
            ? `<button class="success" style="padding: 4px 8px; font-size: 0.8rem; opacity:0.8; border:none;" disabled>✔ Accepted</button>`
            : `<button class="secondary" style="padding: 4px 8px; font-size: 0.8rem; border:1px solid var(--success); color:var(--success); background: var(--surface);" onclick="acceptCosting('${safeId}')">✔ Accept</button>`;

        return `
        <tr style="transition: background 0.2s;">
            <td style="white-space: nowrap; color: var(--text-muted); font-size: 0.85rem;">${displayDate}</td>
            <td>
                <strong style="color: var(--primary); font-size: 1.05rem;">${escapeHTML(c.quoteTo)}</strong><br>
                <span style="font-size: 0.8rem; color: var(--text-muted);">
                    📦 ${escapeHTML(c.product)} | 📍 ${escapeHTML(c.country)}
                </span>
            </td>
            <td>
                <div style="font-size: 0.9rem;">
                    <span style="color: var(--primary); font-weight: bold;">FOB: $${(c.targetFobUsd || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span><br>
                    <span style="color: var(--success); font-weight: bold;">CIF: $${(c.targetCifUsd || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
            </td>
            <td style="text-align: right; white-space: nowrap;">
                <div style="display:flex; gap:5px; justify-content: flex-end; align-items:center;">
                    ${acceptBtn}
                    <button class="secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="loadCosting('${safeId}')">Load</button>
                    <button class="danger" style="padding: 4px 8px; font-size: 0.8rem;" onclick="deleteCosting('${safeId}')">Del</button>
                </div>
            </td>
        </tr>`;
    }).join('');

    const totalPages = Math.ceil(filtered.length / limit) || 1;
    if (totalPages > 1) {
        html += `
        <tr><td colspan="4" style="text-align:center; padding: 10px; background: var(--surface) !important;">
            <button type="button" class="secondary" style="padding: 2px 8px; font-size:0.8rem;" onclick="window.costCurrentPage--; renderCostingTable()" ${window.costCurrentPage <= 1 ? 'disabled' : ''}>◀ Prev</button>
            <span style="margin:0 15px; font-size:0.85rem; font-weight:bold;">Page ${window.costCurrentPage} of ${totalPages}</span>
            <button type="button" class="secondary" style="padding: 2px 8px; font-size:0.8rem;" onclick="window.costCurrentPage++; renderCostingTable()" ${window.costCurrentPage >= totalPages ? 'disabled' : ''}>Next ▶</button>
        </td></tr>`;
    }

    tbody.innerHTML = html;
};

window.acceptCosting = function(id) {
    if (typeof Enterprise !== 'undefined' && !Enterprise.security.isAdmin(true)) return;
    const c = db.costings.find(x => x.id === id);
    if (c) {
        c.status = 'Accepted';
        if(typeof saveData === 'function') saveData(true);
        else if(typeof window.saveData === 'function') window.saveData(true);
        renderCostingTable();
        if(typeof Enterprise !== 'undefined') Enterprise.notify(`Quotation for ${c.quoteTo} marked as Accepted!`, "success");
    }
};

window.loadCosting = function(id) {
    const c = db.costings.find(x => x.id === id);
    if (!c) return;

    const setVal = (elementId, value) => {
        const el = document.getElementById(elementId);
        if(el) el.value = value;
    };

    setVal('cost-id', c.id);
    setVal('cost-date', c.date);
    setVal('cost-quote-to', c.quoteTo);
    setVal('cost-country', c.country);
    setVal('cost-product', c.product);
    setVal('cost-unit', c.unit || 'MT');
    setVal('cost-qty', c.qty);
    setVal('cost-rate-inr', c.rateInrRaw || c.rm);
    
    let packing = c.pack || 0;
    let proc = c.proc || 0;
    let insp = c.insp || 0;
    let trans = c.trans || 0;
    let cha = c.cha || 0;

    if (c.unit === 'KG') {
        packing /= 1000;
        proc /= 1000;
        insp /= 1000;
        trans /= 1000;
        cha /= 1000;
    }

    setVal('cost-packing', packing);
    setVal('cost-surveyor', insp);
    setVal('cost-fumigation', proc - insp); 
    setVal('cost-thc', trans);
    setVal('cost-cha', cha);
    
    setVal('cost-forex', c.forex || getUsdInrRate());
    setVal('cost-cont-freight', c.contFreight || 0);
    setVal('cost-cont-mt', c.contMt || 27);
    setVal('cost-freight-usd', c.freight || 0);
    setVal('cost-other-doc', c.otherDoc || 0);
    setVal('cost-margin-usd', c.margin || 0);

    calculateCosting();
    window.scrollTo({top: 0, behavior: 'smooth'});
    if(typeof Enterprise !== 'undefined') Enterprise.notify(`Loaded Profile: ${c.quoteTo}`, "info");
};

window.deleteCosting = function(id) {
    if (typeof Enterprise !== 'undefined' && !Enterprise.security.isAdmin(true)) return;
    if (!confirm("Are you sure you want to delete this quotation permanently? Finance Variance links will be broken.")) return;
    
    db.costings = db.costings.filter(c => c.id !== id);
    if(typeof saveData === 'function') saveData(true);
    else if(typeof window.saveData === 'function') window.saveData(true);
    
    _lastCostingCount = db.costings.length;
    renderCostingTable();
    populateLiveHistoryDropdown();
    
    if(document.getElementById('cost-id').value === id) {
        resetCostingForm();
    }
};

window.resetCostingForm = function() {
    const form = document.getElementById('costing-form');
    if (form) form.reset();
    document.getElementById('cost-id').value = '';
    document.getElementById('cost-date').value = new Date().toISOString().split('T')[0];
    
    document.getElementById('display-total-inr').innerText = '₹ 0.00';
    document.getElementById('display-fob-usd').innerText = '$ 0.00';
    document.getElementById('display-quote-usd').innerText = '$ 0.00';
};

// --- REVERSE COSTING CALCULATOR ---

window.currentReverseReceipt = {};

window.calcReversePrice = function() {
    const getVal = (id) => parseFloat(document.getElementById(id)?.value) || 0;
    
    const targetUsd = getVal('rcost-target');
    const type = document.getElementById('rcost-type')?.value || 'FOB';
    const unit = document.getElementById('rcost-unit')?.value || 'MT';
    
    const frt = getVal('rcost-freight');
    const margin = getVal('rcost-margin');
    const docs = getVal('rcost-docs');
    const forex = getVal('rcost-forex') || getUsdInrRate();
    const localOpsUnit = getVal('rcost-local'); 
    
    let fobTarget = targetUsd;
    if (type === 'CIF') {
        fobTarget = targetUsd - frt;
    }
    
    const baseUsdMt = fobTarget - margin - docs;
    const baseInrMt = baseUsdMt * forex;
    
    let baseInrUnit = baseInrMt;
    if (unit === 'KG') {
        baseInrUnit = baseInrMt / 1000;
    }

    const maxRmInr = baseInrUnit - localOpsUnit;

    const el = document.getElementById('rcost-max-rm');
    if (el) {
        el.innerText = `₹ ${maxRmInr.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})} / ${unit}`;
    }

    window.currentReverseReceipt = {
        targetUsd, type, unit, frt, margin, docs, forex, localOpsUnit, fobTarget, baseUsdMt, baseInrMt, baseInrUnit, maxRmInr
    };
};

window.showReverseReceipt = function() {
    const rec = window.currentReverseReceipt;
    if (!rec || !rec.unit) return alert("Please fill out the reverse costing form to calculate.");
    
    document.getElementById('rrec-target').innerText = `$ ${rec.targetUsd.toFixed(2)}`;
    document.getElementById('rrec-frt').innerText = `-$ ${rec.frt.toFixed(2)}`;
    document.getElementById('rrec-fob').innerText = `$ ${rec.fobTarget.toFixed(2)}`;
    
    document.getElementById('rrec-margin').innerText = `-$ ${rec.margin.toFixed(2)}`;
    document.getElementById('rrec-docs').innerText = `-$ ${rec.docs.toFixed(2)}`;
    document.getElementById('rrec-base-usd').innerText = `$ ${rec.baseUsdMt.toFixed(2)}`;

    document.getElementById('rrec-base-inr').innerText = `₹ ${rec.baseInrMt.toFixed(2)}`;
    
    if (rec.unit === 'KG') {
        document.getElementById('rrec-scale-unit').innerText = `Divided to KG Base (/ 1000)`;
    } else {
        document.getElementById('rrec-scale-unit').innerText = `Already MT Base (/ 1)`;
    }

    document.getElementById('rrec-loc').innerText = `-₹ ${rec.localOpsUnit.toFixed(2)}`;
    document.getElementById('rrec-max').innerText = `₹ ${rec.maxRmInr.toFixed(2)} / ${rec.unit}`;

    console.log("Showing Reverse Receipt Modal", rec);
    const modal = document.getElementById('rcosting-receipt-modal');
    if (modal) {
        modal.style.display = 'flex';
        if(typeof Enterprise !== 'undefined') Enterprise.notify("Reverse Calculation Steps generated.", "info");
    } else {
        console.error("Modal 'rcosting-receipt-modal' not found!");
    }
};

window.closeReverseReceipt = function() {
    const modal = document.getElementById('rcosting-receipt-modal');
    if (modal) {
        modal.style.display = 'none';
    }
};

// --- TAB 2: LIVE PRICE LIST GENERATOR ENGINE ---

window.toggleLiveSource = function() {
    const src = document.getElementById('live-source-type').value;
    if (src === 'history') {
        document.getElementById('live-form-history').style.display = 'block';
        document.getElementById('live-form-manual').style.display = 'none';
        populateLiveHistoryDropdown();
    } else {
        document.getElementById('live-form-history').style.display = 'none';
        document.getElementById('live-form-manual').style.display = 'block';
    }
};

window.updatePosterDate = function() {
    const dateVal = document.getElementById('live-poster-date-input')?.value;
    const posterDateEl = document.getElementById('live-poster-date');
    if (posterDateEl && dateVal) {
        const formatted = typeof formatDateIN === 'function' ? formatDateIN(dateVal) : new Date(dateVal).toLocaleDateString();
        posterDateEl.innerText = `Date: ${formatted}`;
    }
};

window.populateLiveHistoryDropdown = function() {
    const select = document.getElementById('live-history-select');
    if (!select || !db.costings) return;
    
    // Using all history
    const sorted = [...db.costings].sort((a,b) => new Date(b.date) - new Date(a.date));
    let html = '<option value="">-- Select Quotation --</option>';
    
    sorted.forEach(c => {
        html += `<option value="${escapeHTML(c.id)}">${c.date} | ${escapeHTML(c.quoteTo)} | ${escapeHTML(c.product)}</option>`;
    });
    
    select.innerHTML = html;
    updateLiveHistoryPreview();
};

window.updateLiveHistoryPreview = function() {
    const id = document.getElementById('live-history-select').value;
    const term = document.getElementById('live-history-terms').value;
    const preview = document.getElementById('live-history-preview');
    
    if (!id) {
        preview.innerText = "Select a quote to preview price";
        return;
    }
    
    const c = db.costings.find(x => x.id === id);
    if (c) {
        const val = term === 'FOB' ? c.targetFobUsd : c.targetCifUsd;
        preview.innerText = `${term} Value: $${(val || 0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})} / MT`;
    }
};

document.getElementById('live-history-terms')?.addEventListener('change', updateLiveHistoryPreview);

window.addLiveItemFromHistory = function(e) {
    e.preventDefault();
    const id = document.getElementById('live-history-select').value;
    if(!id) return alert("Please select a quotation from history.");
    
    const c = db.costings.find(x => x.id === id);
    if(!c) return;

    const termType = document.getElementById('live-history-terms').value;
    const port = document.getElementById('live-history-port').value;
    const val = termType === 'FOB' ? c.targetFobUsd : c.targetCifUsd;

    window.livePriceList.push({
        id: 'LPI_' + Date.now(),
        product: c.product,
        term: `${termType} ${port}`,
        price: val
    });

    renderLivePoster();
    e.target.reset();
    document.getElementById('live-history-preview').innerText = "Select a quote to preview price";
};

window.addLiveItemManual = function(e) {
    e.preventDefault();
    
    const product = document.getElementById('live-manual-product').value;
    const price = Math.ceil(parseFloat(document.getElementById('live-manual-price').value) || 0);
    const type = document.getElementById('live-manual-term').value;
    const port = document.getElementById('live-manual-port').value;

    window.livePriceList.push({
        id: 'LPI_' + Date.now(),
        product: product,
        term: `${type} ${port}`,
        price: price
    });

    renderLivePoster();
    e.target.reset();
};

window.clearLiveList = function() {
    if(!confirm("Clear the live price list?")) return;
    window.livePriceList = [];
    renderLivePoster();
};

window.renderLivePoster = function() {
    const container = document.getElementById('live-poster-items');
    if (!container) return;

    if (window.livePriceList.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: rgba(255,255,255,0.5); font-style: italic; padding: 20px 0;">No items added yet...</div>`;
        return;
    }

    container.innerHTML = window.livePriceList.map(item => `
        <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); position: relative;">
            <button onclick="removeLiveItem('${item.id}')" style="position:absolute; top:5px; right:5px; background:transparent; border:none; color:#f87171; cursor:pointer;" title="Remove">✕</button>
            <div style="font-size: 1.1rem; font-weight: bold; color: white; margin-bottom: 5px;">📦 ${escapeHTML(item.product)}</div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 0.85rem; color: var(--border);">Terms: ${escapeHTML(item.term)}</span>
                <span style="font-size: 1.3rem; font-weight: bold; color: #34d399;">$${item.price.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})} / MT</span>
            </div>
        </div>
    `).join('');
};

window.removeLiveItem = function(id) {
    window.livePriceList = window.livePriceList.filter(i => i.id !== id);
    renderLivePoster();
};

window.shareLiveListWhatsApp = function() {
    if (window.livePriceList.length === 0) return alert("Add items to the list first.");
    
    const dateVal = document.getElementById('live-poster-date-input')?.value;
    const displayDate = dateVal 
        ? (typeof formatDateIN === 'function' ? formatDateIN(dateVal) : new Date(dateVal).toLocaleDateString())
        : (typeof formatDateIN === 'function' ? formatDateIN(new Date().toISOString()) : new Date().toLocaleDateString());

    let text = `🌟 *JFT AGRO OVERSEAS - LIVE EXPORT OFFERS* 🌟\nDate: ${displayDate}\n\n`;
    
    window.livePriceList.forEach(item => {
        text += `📦 *${item.product}*\n💰 Price: $${item.price.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})} / MT\n📍 Terms: ${item.term}\n\n`;
    });
    
    text += `Contact us directly on WhatsApp for specifications and booking.\n* All prices are subject to final confirmation.\n* PRICE VALIDITY IS FOR 24HRS.`;
    
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
};

window.downloadLiveListImage = function() {
    if (window.livePriceList.length === 0) return alert("Add items to the list first.");
    
    if(typeof Enterprise !== 'undefined') Enterprise.notify("Preparing Image for Download...", "info");

    if (typeof html2canvas === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        script.onload = () => executeImageCapture();
        document.head.appendChild(script);
    } else {
        executeImageCapture();
    }
};

function executeImageCapture() {
    const buttons = document.querySelectorAll('#live-poster-items button');
    buttons.forEach(b => b.style.display = 'none');

    const target = document.getElementById('price-list-poster');
    html2canvas(target, { 
        backgroundColor: null, 
        scale: 2, 
        useCORS: true 
    }).then(canvas => {
        buttons.forEach(b => b.style.display = 'block');

        const link = document.createElement('a');
        link.download = `JFT_Live_Prices_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        if(typeof Enterprise !== 'undefined') Enterprise.notify("Image Exported Successfully!", "success");
    }).catch(err => {
        buttons.forEach(b => b.style.display = 'block');
        console.error(err);
        alert("Failed to export image. Please try taking a screenshot.");
    });
}

// Global initialization hook for navigation controller
window.renderCostingTable = renderCostingTable;


// ============================================================
// QUICK QUOTE CALCULATOR (moved from standalone Pricelist module)
// Converts base INR cost → export price in any currency with live rate
// ============================================================

window.qqCalculate = function() {
    const baseInr = parseFloat(document.getElementById('qq-base-inr')?.value) || 0;
    const rate    = parseFloat(document.getElementById('qq-rate')?.value) || 1;
    const curr    = (document.getElementById('qq-currency')?.value || 'USD').replace(/[^A-Za-z]/g,'').substring(0,3).toUpperCase();
    const margin  = parseFloat(document.getElementById('qq-margin')?.value) || 0;
    const product = document.getElementById('qq-product')?.value || 'Product';
    const unit    = document.getElementById('qq-unit')?.value || 'MT';

    const baseWithMargin = baseInr * (1 + margin / 100);
    const exportPrice = curr === 'INR' ? baseWithMargin : (rate > 0 ? baseWithMargin / rate : 0);

    const setV = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
    setV('qq-out-product', product);
    setV('qq-out-price', exportPrice.toFixed(2));
    setV('qq-out-curr', curr);
    setV('qq-out-unit', unit);
    setV('qq-out-base', '₹' + baseInr.toFixed(2));
    setV('qq-out-margin', margin + '%');
    setV('qq-out-rate', curr !== 'INR' ? '₹' + rate.toFixed(2) + '/' + curr : '—');
    setV('qq-out-date', new Date().toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'}));

    const card = document.getElementById('qq-result-card');
    if (card) card.style.display = 'block';
};

window.qqFetchLiveRate = async function() {
    const currRaw = document.getElementById('qq-currency')?.value || 'USD';
    const curr = currRaw.replace(/[^A-Z]/g,'').substring(0,3);
    const btn = document.getElementById('qq-fetch-btn');
    const rateInput = document.getElementById('qq-rate');
    if (curr === 'INR') { if (rateInput) rateInput.value = 1; qqCalculate(); return; }
    if (btn) { btn.innerText = '⏳ Fetching…'; btn.disabled = true; }
    try {
        const res = await fetch('https://open.er-api.com/v6/latest/' + curr);
        const data = await res.json();
        if (data?.rates?.INR) {
            if (rateInput) rateInput.value = data.rates.INR.toFixed(2);
            if (typeof Enterprise !== 'undefined') Enterprise.notify('Live rate: 1 ' + curr + ' = ₹' + data.rates.INR.toFixed(2), 'success');
            qqCalculate();
        }
    } catch(e) {
        if (typeof Enterprise !== 'undefined') Enterprise.notify('Live rate fetch failed. Enter manually.', 'warning');
    } finally {
        if (btn) { btn.innerText = '🔄 Fetch Live Rate'; btn.disabled = false; }
    }
};

window.qqPrint = function() {
    const area = document.getElementById('qq-print-area');
    if (!area) return;
    const w = window.open('','_blank','width=600,height=500');
    w.document.write('<html><head><title>Export Price Quote</title><style>body{font-family:sans-serif;padding:30px;}table{width:100%;border-collapse:collapse;}td{padding:8px 0;border-bottom:1px dashed #ddd;}.price{font-size:2rem;font-weight:900;color:#1d4ed8;}</style></head><body>' + area.innerHTML + '</body></html>');
    w.document.close(); w.print();
};
