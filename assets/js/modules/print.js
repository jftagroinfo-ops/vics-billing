/* --- PRINT QUEUE & HISTORY MODULE (UPGRADED) --- */

function initPrintSystem() {
    if (typeof db === 'undefined') {
        setTimeout(initPrintSystem, 50);
        return;
    }
    if (!db.docs) db.docs = [];
    startPrintWatchdog();
    initPrintFilters();
}
initPrintSystem();

window.escapeHTML = window.escapeHTML || function(str) {
    if (!str) return '';
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
};

window.printCurrentPage = 1;
let _lastHistoryFingerprint = "";

function startPrintWatchdog() {
    setInterval(() => {
        if (typeof db === 'undefined') return;
        if (!db.docs) db.docs = [];
        
        const currentFingerprint = db.docs.map(d => d.id).join('|');
        if (currentFingerprint !== _lastHistoryFingerprint) {
            _lastHistoryFingerprint = currentFingerprint;
            renderPrintQueue();
        }
    }, 1500);
}

function initPrintFilters() {
    Enterprise.initFYSelector('filter-fy-print');
}

function checkPrintDateFilter(dDateStr, filterFy) {
    return Enterprise.checkFY(dDateStr, filterFy);
}

window.resetPrintFilters = function() {
    ['fy-print', 'type-print', 'search-print'].forEach(id => {
        const el = document.getElementById(`filter-${id}`);
        if(el) el.value = '';
    });
    const limit = document.getElementById(`filter-limit-print`);
    if(limit) limit.value = '25';
    window.printCurrentPage = 1;
    renderPrintQueue();
};

window.renderPrintQueue = function() {
    const tbody = document.querySelector('#print-queue-table tbody');
    if (!tbody || !db.docs) return;

    const filterFy = document.getElementById('filter-fy-print')?.value || '';
    const filterType = document.getElementById('filter-type-print')?.value || '';
    const searchFilter = (document.getElementById('filter-search-print')?.value || '').toLowerCase();
    const limitStr = document.getElementById('filter-limit-print')?.value || '25';

    let filtered = db.docs.filter(d => {
        if (d.status === 'Cancelled') return false;
        if (!checkPrintDateFilter(d.date, filterFy)) return false;
        if (filterType && d.type !== filterType) return false;
        
        const docNo = String(d.no || '').toLowerCase();
        const buyer = String(d.buyer || '').toLowerCase();
        if (searchFilter && !docNo.includes(searchFilter) && !buyer.includes(searchFilter)) return false;
        return true;
    });

    filtered.sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0));

    const limit = limitStr === 'all' ? filtered.length : parseInt(limitStr, 10);
    const startIndex = (window.printCurrentPage - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    if (paginated.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color:var(--text-muted);">No documents match filters.</td></tr>`;
        return;
    }

    let html = paginated.map(d => {
        const displayDate = typeof formatDateIN === 'function' ? formatDateIN(d.date) : d.date;
        const shortBuyer = d.buyer ? d.buyer.split('\n')[0] : 'Unknown Client';
        const safeId = escapeHTML(d.id).replace(/&#039;/g, "\\'");

        return `<tr style="border-bottom: 1px solid var(--border);">
            <td style="padding: 10px; color: var(--text-muted);">${displayDate}</td>
            <td style="padding: 10px;"><b>${escapeHTML(d.no)}</b></td>
            <td style="padding: 10px; color: var(--primary);">${escapeHTML(d.type)}</td>
            <td style="padding: 10px;">${escapeHTML(shortBuyer)}</td>
            <td style="padding: 10px; text-align: right;">
                <button style="padding: 6px 12px; font-size: 0.85rem;" onclick="printFromQueue('${safeId}')">🖨️ Print</button>
            </td>
        </tr>`;
    }).join('');

    const totalPages = Math.ceil(filtered.length / limit) || 1;
    if (totalPages > 1) {
        html += `
        <tr><td colspan="5" style="text-align:center; padding: 10px; background: var(--surface) !important;">
            <button type="button" class="secondary" style="padding: 2px 8px; font-size:0.8rem;" onclick="window.printCurrentPage--; renderPrintQueue()" ${window.printCurrentPage <= 1 ? 'disabled' : ''}>◀ Prev</button>
            <span style="margin:0 15px; font-size:0.85rem; font-weight:bold;">Page ${window.printCurrentPage} of ${totalPages}</span>
            <button type="button" class="secondary" style="padding: 2px 8px; font-size:0.8rem;" onclick="window.printCurrentPage++; renderPrintQueue()" ${window.printCurrentPage >= totalPages ? 'disabled' : ''}>Next ▶</button>
        </td></tr>`;
    }

    tbody.innerHTML = html;
};

window.printFromQueue = function(docId) {
    if (typeof editDoc === 'function') {
        
        editDoc(docId);
        
        if (typeof showTab === 'function') {
            showTab('documents');
        }
        
        setTimeout(() => {
            if (typeof printCurrentDoc === 'function') {
                printCurrentDoc();
            } else {
                window.print();
            }
            
            // Release the security lock so other employees can still edit the document
            if (typeof closeEditor === 'function') {
                setTimeout(closeEditor, 1500); 
            }

        }, 500);

        if(typeof Enterprise !== 'undefined') Enterprise.notify("⚠️ Error: Document editor not loaded.", "danger");
    }
};

window.switchDocCenterTab = function(tabName) {
    const tabs = document.querySelectorAll('.doc-center-tab');
    const contents = document.querySelectorAll('.doc-center-content');
    if (!tabs.length || !contents.length) return;

    tabs.forEach(t => t.classList.remove('active'));
    contents.forEach(c => c.classList.remove('active'));
    
    // Find the clicked tab by its onclick attribute or text if no event is passed
    // But since it's called with 'tabName', we can just find by ID if we add them, 
    // or just iterate and match text or index.
    // Better: use querySelector with the onclick string match.
    const clickedTab = document.getElementById('tab-' + tabName);
    if (clickedTab) clickedTab.classList.add('active');
    
    const targetContent = document.getElementById('doc-center-' + tabName);
    if (targetContent) targetContent.classList.add('active');
    
    if (tabName === 'history') {
        if (typeof renderPrintQueue === 'function') renderPrintQueue();
    } else if (tabName === 'templates') {
        if (typeof renderDrafts === 'function') renderDrafts();
    }
};

