/* --- LETTER OF CREDIT (LC) & BANK LIMIT MANAGER --- */

// 1. CRITICAL FIX: Prevent ReferenceError crashes when file loads
if (typeof window.db === 'undefined') { window.db = {}; }

// Use window.db consistently to avoid scoping crashes
if (!window.db.lcs) { window.db.lcs = []; }

// escapeHTML is defined globally in ui.js — no local copy needed.

// Initializes the Global LC Limit from the Cloud config
function initLCLimitConfig() {
    if (!window.db.meta) window.db.meta = {};
    const globalLimitInput = document.getElementById('global-lc-limit');
    
    if (globalLimitInput) {
        globalLimitInput.value = window.db.meta.globalLcLimit || '';
    }
}

function updateLCLimit() {
    if (typeof Enterprise !== 'undefined' && !Enterprise.security.isAdmin(true)) return;

    const limit = parseFloat(document.getElementById('global-lc-limit').value);
    if (!window.db.meta) window.db.meta = {};
    
    if (!isNaN(limit)) {
        window.db.meta.globalLcLimit = limit;
        if (typeof saveData === 'function') saveData();
        renderLCList(); 
        if(typeof Enterprise !== 'undefined') Enterprise.notify("Bank Facility Limit Updated!", "success");
    }
}

function addLC(e) {
    e.preventDefault();
    
    if (typeof Enterprise !== 'undefined' && !Enterprise.security.isAdmin(true)) return;
    
    const entry = {
        id: typeof generateId === 'function' ? generateId() : 'LC_' + Date.now(),
        no: document.getElementById('lc-no').value,
        bank: document.getElementById('lc-bank').value,
        currency: document.getElementById('lc-currency').value,
        amount: parseFloat(document.getElementById('lc-amount').value) || 0,
        issueDate: document.getElementById('lc-issue').value,
        expDate: document.getElementById('lc-exp').value,
        applicant: document.getElementById('lc-applicant').value,
        shipDate: document.getElementById('lc-ship-date').value,
        tolerance: parseFloat(document.getElementById('lc-tolerance').value) || 0,
        status: document.getElementById('lc-status').value
    };
    
    if (!window.db.lcs) window.db.lcs = [];
    window.db.lcs.push(entry);
    if (typeof saveData === 'function') saveData();
    renderLCList();
    e.target.reset();
    
    if(typeof Enterprise !== 'undefined') Enterprise.notify("LC Saved Successfully", "success");
}

function renderLCList() {
    initLCLimitConfig(); // 2. REPAIRED: Always refresh limits on render to avoid 0 balance error

    const tbody = document.querySelector('#lc-table tbody');
    if (!tbody) return;

    const today = new Date();
    let totalUtilizedUsd = 0;

    if (!window.db.lcs) window.db.lcs = [];
    const sorted = [...window.db.lcs].sort((a, b) => new Date(a.expDate) - new Date(b.expDate));

    tbody.innerHTML = sorted.map(lc => {
        const exp = new Date(lc.expDate);
        const diffTime = exp - today;
        const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        let daysHtml = '';
        if (lc.status === 'Settled') daysHtml = '<span style="color:var(--success); font-weight:bold;">Closed</span>';
        else if (daysLeft < 0) daysHtml = `<span style="color:var(--danger); font-weight:bold;">Expired (${Math.abs(daysLeft)}d ago)</span>`;
        else if (daysLeft <= 15) daysHtml = `<span style="background:#fee2e2; color:#9f1239; padding:2px 6px; border-radius:4px; font-weight:bold;">${daysLeft} Days ⚠️</span>`;
        else daysHtml = `<span>${daysLeft} Days</span>`;

        let statusClass = 'Draft';
        if(lc.status === 'Accepted') statusClass = 'Paid';
        if(lc.status === 'Settled') statusClass = 'Shipped';
        if(lc.status === 'Discrepant' || lc.status === 'Expired') statusClass = 'Absent';

        if (lc.status !== 'Settled' && lc.status !== 'Expired') {
            let usdValue = parseFloat(lc.amount) || 0;
            if (lc.currency === 'EUR') usdValue = usdValue * 1.08;
            if (lc.currency === 'GBP') usdValue = usdValue * 1.25;
            totalUtilizedUsd += usdValue;
        }

        const amtDisplay = (parseFloat(lc.amount) || 0).toLocaleString('en-US', {minimumFractionDigits: 2});
        const safeId = escapeHTML(lc.id).replace(/&#039;/g, "\\'");

        return `<tr>
            <td><b>${escapeHTML(lc.no)}</b></td>
            <td>${escapeHTML(lc.applicant)}</td>
            <td>${escapeHTML(lc.bank)}</td>
            <td style="font-weight:bold; color:var(--primary);">${escapeHTML(lc.currency)} ${amtDisplay}</td>
            <td>${typeof formatDateIN === 'function' ? formatDateIN(lc.issueDate) : lc.issueDate}</td>
            <td>${typeof formatDateIN === 'function' ? formatDateIN(lc.expDate) : lc.expDate}</td>
            <td>${daysHtml}</td>
            <td><span class="status-badge status-${statusClass}">${escapeHTML(lc.status)}</span></td>
            <td><button class="danger" onclick="deleteLC('${safeId}')">Del</button></td>
        </tr>`;
    }).join('');

    updateFacilityTracker(totalUtilizedUsd);
}

function updateFacilityTracker(utilizedUsd) {
    const globalLimit = parseFloat(window.db.meta?.globalLcLimit) || 0;
    
    const utilizedEl = document.getElementById('lc-utilized-text');
    const availableEl = document.getElementById('lc-available-text');
    const barEl = document.getElementById('lc-limit-bar');
    
    if (!utilizedEl || !availableEl || !barEl) return;

    if (globalLimit === 0) {
        utilizedEl.innerText = "Limit Not Set";
        utilizedEl.style.color = "var(--text-muted)";
        availableEl.innerText = "Limit Not Set";
        availableEl.style.color = "var(--text-muted)";
        barEl.style.width = "0%";
        return;
    }

    const available = globalLimit - utilizedUsd;
    const utilizedPct = Math.min((utilizedUsd / globalLimit) * 100, 100); 

    utilizedEl.innerText = `$${utilizedUsd.toLocaleString('en-US', {maximumFractionDigits: 0})}`;
    availableEl.innerText = `$${available.toLocaleString('en-US', {maximumFractionDigits: 0})}`;

    barEl.style.width = `${utilizedPct}%`;

    if (utilizedPct >= 90) {
        barEl.style.background = 'var(--danger)';
        availableEl.style.color = 'var(--danger)';
    } else if (utilizedPct >= 75) {
        barEl.style.background = 'var(--warning)';
        availableEl.style.color = 'var(--warning)';
    } else {
        barEl.style.background = 'var(--success)';
        availableEl.style.color = 'var(--success)';
    }
}

function deleteLC(id) {
    if(typeof Enterprise !== 'undefined' && !Enterprise.security.canDelete()) return;
    if(!confirm("Are you sure you want to permanently delete this LC record?")) return;
    
    if (!window.db.lcs) return;
    window.db.lcs = window.db.lcs.filter(lc => lc.id !== id);
    if (typeof saveData === 'function') saveData();
    renderLCList();
    if(typeof Enterprise !== 'undefined') Enterprise.logAction(`Deleted Letter of Credit record`);
}

window.renderLCList = renderLCList;
window.updateLCLimit = updateLCLimit;
window.addLC = addLC;
window.deleteLC = deleteLC;