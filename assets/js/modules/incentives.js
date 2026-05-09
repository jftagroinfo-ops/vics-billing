/* --- GOVERNMENT EXPORT INCENTIVES & DRAWBACK TRACKER --- */

if (!db.incentives) db.incentives = [];

window.escapeHTML = window.escapeHTML || function(str) {
    if (!str) return '';
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
};

function renderIncentives() {
    populateIncentiveDropdown();
    renderIncentivesTable();
}

function populateIncentiveDropdown() {
    const select = document.getElementById('inc-doc-id');
    if (!select || !db.docs) return;

    let options = '<option value="">-- Select Commercial Invoice --</option>';
    const sortedDocs = [...db.docs].filter(d => d.type === 'Commercial Invoice').sort((a,b) => new Date(b.date) - new Date(a.date));
    
    sortedDocs.forEach(d => {
        // SECURED: Escaped document ID to prevent attribute injection
        options += `<option value="${escapeHTML(d.id)}">${escapeHTML(d.no)} | ${escapeHTML(d.buyer.split('\n')[0])}</option>`;
    });

    const currentVal = select.value;
    select.innerHTML = options;
    if (currentVal) select.value = currentVal;
}

// Automatically calculates the INR claim based on the Document's FOB value
function autoCalculateIncentive() {
    const docId = document.getElementById('inc-doc-id').value;
    const pct = parseFloat(document.getElementById('inc-pct').value) || 0;
    const amtInput = document.getElementById('inc-amount');
    
    if (!docId || pct === 0) {
        amtInput.value = '';
        return;
    }

    const doc = db.docs.find(d => d.id === docId);
    if (doc) {
        // Extract FOB. If it's a CIF invoice, fobTotal was saved by the document editor.
        let fobValue = parseFloat(doc.fobTotal || doc.total || 0);
        
        // Convert to INR roughly if invoice is in USD/EUR (assumes standard rate if no exact forex is mapped)
        let fobInr = fobValue;
        if (doc.currency === 'USD') fobInr = fobValue * getUsdInrRate();
        if (doc.currency === 'EUR') fobInr = fobValue * 90.0;

        const expectedClaim = (fobInr * (pct / 100)).toFixed(2);
        amtInput.value = expectedClaim;
    }
}

function addIncentiveRecord(e) {
    e.preventDefault();
    const docId = document.getElementById('inc-doc-id').value;
    const doc = db.docs.find(d => d.id === docId);
    
    if (!doc) {
        alert("Please select a valid invoice.");
        return;
    }

    if (doc.isLocked && typeof Enterprise !== 'undefined' && !Enterprise.security.isAdmin(false)) {
        Enterprise.notify(`Invoice ${doc.no} is locked. Only Admins can modify financial tracking.`, "danger");
        return;
    }

    const rawClaimAmt = parseFloat(document.getElementById('inc-amount').value) || 0;

    const entry = {
        id: generateId(),
        docId: docId,
        docNo: doc.no,
        type: document.getElementById('inc-type').value,
        pct: parseFloat(document.getElementById('inc-pct').value) || 0,
        // SECURED: Explicit mathematical rounding to prevent PnL float corruption
        claimAmt: Math.round(rawClaimAmt * 100) / 100,
        status: document.getElementById('inc-status').value,
        timestamp: new Date().toISOString()
    };

    db.incentives.push(entry);
    saveData();
    e.target.reset();
    renderIncentivesTable();
    
    if(typeof Enterprise !== 'undefined') Enterprise.notify("Incentive Tracking Logged!", "success");
}

function renderIncentivesTable() {
    const tbody = document.querySelector('#incentives-table tbody');
    if (!tbody) return;

    let total = 0;
    let pending = 0;
    let realized = 0;

    const sorted = [...db.incentives].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));

    tbody.innerHTML = sorted.map(inc => {
        total += inc.claimAmt;
        if (inc.status === 'Realized') realized += inc.claimAmt;
        else pending += inc.claimAmt;

        let statusHtml = '';
        if (inc.status === 'Realized') statusHtml = `<span class="status-badge status-Paid">💰 Realized</span>`;
        else if (inc.status === 'Applied / Processing') statusHtml = `<span class="status-badge status-Shipped">⏳ Applied</span>`;
        else statusHtml = `<span class="status-badge status-Draft">📋 Pending</span>`;

        // SECURED: Escaping ID for inline JS context
        const safeId = escapeHTML(inc.id).replace(/&#039;/g, "\\'");

        return `<tr>
            <td><b>${escapeHTML(inc.docNo)}</b></td>
            <td>${escapeHTML(inc.type)} <br><small style="color:var(--text-muted);">${inc.pct}%</small></td>
            <td style="font-weight:bold; color:var(--primary);">₹${inc.claimAmt.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
            <td>${statusHtml}</td>
            <td>
                <div style="display:flex; gap:5px;">
                    ${inc.status !== 'Realized' ? `<button class="secondary" style="padding:4px 8px; font-size:0.75rem; background:rgba(34, 197, 94, 0.1); border:1px solid #86efac; color:#166534;" onclick="markIncentiveRealized('${safeId}')">✓ Mark Paid</button>` : ''}
                    <button class="danger" style="padding:4px 8px; font-size:0.75rem;" onclick="deleteIncentive('${safeId}')">Del</button>
                </div>
            </td>
        </tr>`;
    }).join('');

    if (sorted.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color:var(--text-muted);">No incentives tracked yet.</td></tr>`;
    }

    document.getElementById('inc-kpi-total').innerText = `₹${total.toLocaleString('en-IN', {maximumFractionDigits: 0})}`;
    document.getElementById('inc-kpi-pending').innerText = `₹${pending.toLocaleString('en-IN', {maximumFractionDigits: 0})}`;
    document.getElementById('inc-kpi-realized').innerText = `₹${realized.toLocaleString('en-IN', {maximumFractionDigits: 0})}`;
}

function markIncentiveRealized(id) {
    // SECURED: Prevent standard users from artificially inflating PnL realizations
    if (typeof Enterprise !== 'undefined' && !Enterprise.security.isAdmin(true)) return;

    const inc = db.incentives.find(x => x.id === id);
    if (!inc) return;
    
    inc.status = 'Realized';
    saveData();
    renderIncentivesTable();
    
    if(typeof Enterprise !== 'undefined') Enterprise.notify(`🎉 ₹${inc.claimAmt} credited to PnL!`, "success");
}

function deleteIncentive(id) {
    if(typeof Enterprise !== 'undefined' && !Enterprise.security.canDelete()) return;
    if(!confirm("Are you sure you want to delete this claim? It will be removed from your Profit & Loss calculation.")) return;
    
    db.incentives = db.incentives.filter(x => x.id !== id);
    saveData();
    renderIncentivesTable();
}

// Global initialization hook for navigation controller
window.renderIncentives = renderIncentives;
window.autoCalculateIncentive = autoCalculateIncentive;
window.addIncentiveRecord = addIncentiveRecord;
window.markIncentiveRealized = markIncentiveRealized;
window.deleteIncentive = deleteIncentive;


