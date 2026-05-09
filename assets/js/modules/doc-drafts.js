/* --- DOCUMENT DRAFTS & BULK CLONING MODULE (UPGRADED) --- */

function initDraftsSystem() {
    if (typeof db === 'undefined') {
        setTimeout(initDraftsSystem, 50);
        return;
    }
    if (!db.docs) db.docs = [];
    startDraftsWatchdog();
    initDraftFilters();
}
initDraftsSystem();

window.escapeHTML = window.escapeHTML || function(str) {
    if (!str) return '';
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
};

window.draftsCurrentPage = 1;
let _lastDraftsFingerprint = "";

function startDraftsWatchdog() {
    setInterval(() => {
        if (typeof db === 'undefined') return;
        if (!db.docs) db.docs = [];
        
        // FINGERPRINT TEST: IDs joined is way more accurate than just .length
        const currentFingerprint = db.docs.map(d => d.id).join('|');
        if (currentFingerprint !== _lastDraftsFingerprint) {
            _lastDraftsFingerprint = currentFingerprint;
            renderDrafts();
        }
    }, 1500);
}

function initDraftFilters() {
    const fySelect = document.getElementById('filter-fy-drafts');
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
    }
}

function checkDraftDateFilter(dDateStr, filterFy) {
    if (!filterFy || !dDateStr) return true;
    const dDate = new Date(dDateStr);
    if (isNaN(dDate.getTime())) return true; 
    const parts = filterFy.split('-');
    const fyStart = new Date(`${parts[0]}-04-01`);
    const fyEnd = new Date(`${parts[1]}-03-31T23:59:59`);
    if (dDate < fyStart || dDate > fyEnd) return false;
    return true;
}

window.resetDraftFilters = function() {
    ['fy-drafts', 'type-drafts', 'search-drafts'].forEach(id => {
        const el = document.getElementById(`filter-${id}`);
        if(el) el.value = '';
    });
    const limit = document.getElementById(`filter-limit-drafts`);
    if(limit) limit.value = '25';
    window.draftsCurrentPage = 1;
    renderDrafts();
};

window.renderDrafts = function() {
    const tbody = document.querySelector('#drafts-table tbody');
    if (!tbody || !db.docs) return;

    const filterFy = document.getElementById('filter-fy-drafts')?.value || '';
    const filterType = document.getElementById('filter-type-drafts')?.value || '';
    const searchFilter = (document.getElementById('filter-search-drafts')?.value || '').toLowerCase();
    const limitStr = document.getElementById('filter-limit-drafts')?.value || '25';

    let invoices = db.docs.filter(d => d.type.includes('Invoice') && d.status !== 'Cancelled');

    let filtered = invoices.filter(d => {
        if (!checkDraftDateFilter(d.date, filterFy)) return false;
        if (filterType && d.type !== filterType) return false;
        
        const docNo = String(d.no || '').toLowerCase();
        const buyer = String(d.buyer || '').toLowerCase();
        if (searchFilter && !docNo.includes(searchFilter) && !buyer.includes(searchFilter)) return false;
        return true;
    });

    filtered.sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0));

    const limit = limitStr === 'all' ? filtered.length : parseInt(limitStr, 10);
    const startIndex = (window.draftsCurrentPage - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    if (paginated.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px; color:var(--text-muted);">No invoices match filters.</td></tr>`;
        return;
    }

    let html = paginated.map(d => {
        const displayDate = typeof formatDateIN === 'function' ? formatDateIN(d.date) : d.date;
        const buyerLine = d.buyer ? escapeHTML(d.buyer.split('\n')[0]) : 'Unknown Buyer';
        const safeId = escapeHTML(d.id).replace(/&#039;/g, "\\'");

        return `<tr style="border-bottom: 1px solid var(--border);">
            <td style="padding: 10px; color: var(--text-muted);">${displayDate}</td>
            <td style="padding: 10px;">
                <strong style="color: var(--text);">${escapeHTML(d.no)}</strong><br>
                <span style="font-size: 0.75rem; color: var(--primary);">${escapeHTML(d.type)}</span>
            </td>
            <td style="padding: 10px;">${buyerLine}</td>
            <td style="padding: 10px; text-align: right;">
                <div style="display:flex; gap:5px; justify-content: flex-end;">
                    <button class="draft-clone-btn btn-ci" onclick="createDraftFromTemplate('Commercial Invoice', '${safeId}')">CI</button>
                    <button class="draft-clone-btn btn-pi" onclick="createDraftFromTemplate('Proforma Invoice', '${safeId}')">PI</button>
                    <button class="draft-clone-btn btn-pl" onclick="createDraftFromTemplate('Packing List', '${safeId}')">PL</button>
                </div>
            </td>
        </tr>`;
    }).join('');

    const totalPages = Math.ceil(filtered.length / limit) || 1;
    if (totalPages > 1) {
        html += `
        <tr><td colspan="4" style="text-align:center; padding: 10px; background: var(--surface) !important;">
            <button type="button" class="secondary" style="padding: 2px 8px; font-size:0.8rem;" onclick="window.draftsCurrentPage--; renderDrafts()" ${window.draftsCurrentPage <= 1 ? 'disabled' : ''}>◀ Prev</button>
            <span style="margin:0 15px; font-size:0.85rem; font-weight:bold;">Page ${window.draftsCurrentPage} of ${totalPages}</span>
            <button type="button" class="secondary" style="padding: 2px 8px; font-size:0.8rem;" onclick="window.draftsCurrentPage++; renderDrafts()" ${window.draftsCurrentPage >= totalPages ? 'disabled' : ''}>Next ▶</button>
        </td></tr>`;
    }

    tbody.innerHTML = html;
};

window.createDraftFromTemplate = function(templateType, sourceId = null) {
    if (sessionStorage.getItem('jft_role') === 'buyer') {
        if(typeof Enterprise !== 'undefined') Enterprise.notify("Access Denied: Action restricted.", "danger");
        return;
    }
    
    let sourceDoc = null;
    if (sourceId) {
        sourceDoc = db.docs.find(d => d.id === sourceId);
    }
    
    if (typeof createNewDoc === 'function') {
        createNewDoc(templateType);
    } else {
        if(typeof Enterprise !== 'undefined') Enterprise.notify("⚠️ Error: Document editor module not loaded.", "danger");
        return;
    }
    
    if (sourceDoc) {
        const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };

        setVal('doc-buyer', sourceDoc.buyer);
        setVal('doc-currency', sourceDoc.currency);
        setVal('doc-pol', sourceDoc.pol);
        setVal('doc-pod', sourceDoc.pod);
        setVal('doc-pod-final', sourceDoc.podFinal);
        setVal('doc-terms', sourceDoc.terms);
        
        if(sourceDoc.dittoData) {
            setVal('data-preCarriage', sourceDoc.dittoData.preCarriage);
            setVal('data-receipt', sourceDoc.dittoData.receipt);
            setVal('data-vessel', sourceDoc.dittoData.vessel);
            setVal('data-notify1', sourceDoc.dittoData.notify1);
            setVal('data-notify2', sourceDoc.dittoData.notify2);
        }
        
        const tbody = document.getElementById('items-body');
        if (tbody) {
            tbody.innerHTML = ''; 
            (sourceDoc.items || []).forEach(item => {
                const tr = document.createElement('tr'); 
                tr.innerHTML = `
                    <td><textarea class="i-marks" rows="2" style="width:100%; min-width:120px;">${escapeHTML(item.marks || '')}</textarea></td>
                    <td><input type="text" class="i-pkgs" value="${escapeHTML(item.pkgs || '')}"></td>
                    <td><textarea class="i-desc" rows="2" style="width:100%; min-width:150px;">${escapeHTML(item.desc || '')}</textarea></td>
                    <td><input type="text" class="i-hsn" value="${escapeHTML(item.hsn || '')}"></td>
                    <td><input type="text" class="i-origin" value="${escapeHTML(item.origin || 'India')}"></td>
                    <td><input type="number" step="0.001" class="i-qty" value="${escapeHTML(item.qty || '')}" oninput="calcDocTotals()"></td>
                    <td class="rate-col"><input type="number" step="0.01" class="i-rate" value="${escapeHTML(item.rate || '')}" oninput="calcDocTotals()"></td>
                    <td><input type="text" class="i-unit" value="${escapeHTML(item.unit || 'MT')}"></td>
                    <td class="rate-col"><input type="number" step="0.01" class="i-amt" readonly value="${escapeHTML(item.amount || '')}"></td>
                    <td><button type="button" class="danger" onclick="this.closest('tr').remove(); calcDocTotals();">X</button></td>
                `; 
                tbody.appendChild(tr);
            });
            if(typeof calcDocTotals === 'function') calcDocTotals();
        }
        
        if(typeof Enterprise !== 'undefined') Enterprise.notify(`✅ Draft Deep-Copied from ${sourceDoc.no}`, "success");
    } else {
        if(typeof Enterprise !== 'undefined') Enterprise.notify(`📝 Blank ${escapeHTML(templateType)} created.`, "info");
    }
    
    if (typeof showTab === 'function') {
        showTab('documents');
    }
};

