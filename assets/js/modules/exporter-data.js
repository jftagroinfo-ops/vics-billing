/* --- COMPLIANCE VAULT & EXPIRY RADAR MODULE (UPGRADED) --- */

function initExporterSystem() {
    if (typeof db === 'undefined') {
        setTimeout(initExporterSystem, 50);
        return;
    }
    if (!db.exporter_data) db.exporter_data = [];
    startExporterWatchdog();
}
initExporterSystem();

// escapeHTML is defined globally in ui.js — no local copy needed.

// State
window.exporterCurrentPage = 1;
let _lastExporterCount = -1;

function startExporterWatchdog() {
    setInterval(() => {
        if (typeof db === 'undefined') return;
        // PERF: Skip re-render when this tab is not visible
        if (document.getElementById('exporter-data')?.style.display === 'none') return;
        if (!db.exporter_data) db.exporter_data = [];
        
        if (db.exporter_data.length !== _lastExporterCount) {
            _lastExporterCount = db.exporter_data.length;
            renderExporterData();
        }
    }, 5000); // Slowed from 1500ms → 5000ms. Re-renders on demand via saveData() triggers.
}

window.resetExporterFilters = function() {
    document.getElementById('filter-search-exp').value = '';
    document.getElementById('filter-status-exp').value = '';
    document.getElementById('filter-limit-exp').value = '25';
    window.exporterCurrentPage = 1;
    renderExporterData();
};

function addExporterDoc(e) {
    e.preventDefault();
    if (typeof Enterprise !== 'undefined' && !Enterprise.security.isAdmin(true)) return; 
    
    const entry = {
        id: typeof generateId === 'function' ? generateId() : 'EXP_' + Date.now(),
        name: document.getElementById('ed-name').value,
        no: document.getElementById('ed-no').value,
        issueDate: document.getElementById('ed-issue').value,
        expiryDate: document.getElementById('ed-expiry').value,
        link: document.getElementById('ed-link').value
    };
    
    db.exporter_data.push(entry);
    db.exporter_data = [...db.exporter_data]; // Force reactivity
    
    if (typeof window.saveData === 'function') window.saveData(true);
    else if(typeof saveData === 'function') saveData(true);
    
    _lastExporterCount = db.exporter_data.length;
    renderExporterData();
    e.target.reset();
    
    if(typeof Enterprise !== 'undefined') Enterprise.notify("Document safely stored in Vault.", "success");
}

function renderExporterData() {
    const tbody = document.querySelector('#exporter-table tbody');
    if (!tbody || !db.exporter_data) return;

    const today = new Date();
    today.setHours(0,0,0,0);

    const searchFilter = (document.getElementById('filter-search-exp')?.value || '').toLowerCase();
    const statusFilter = document.getElementById('filter-status-exp')?.value || '';
    const limitStr = document.getElementById('filter-limit-exp')?.value || '25';

    let processed = db.exporter_data.map(d => {
        let status = 'Valid';
        let statusHtml = '<span style="color:var(--text-muted); font-size:0.8rem; font-weight:bold;">Lifetime</span>';
        
        if (d.expiryDate) {
            const expDate = new Date(d.expiryDate);
            const diffTime = expDate - today;
            const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (daysLeft < 0) {
                status = 'Expired';
                statusHtml = `<span style="background:#fee2e2; color:#9f1239; padding:2px 6px; border-radius:4px; font-size:0.75rem; border:1px solid #fecaca; font-weight:bold;">🚨 EXPIRED</span>`;
            } else if (daysLeft <= 30) {
                status = 'Expiring';
                statusHtml = `<span style="background:#fef3c7; color:#a16207; padding:2px 6px; border-radius:4px; font-size:0.75rem; border:1px solid #fde047; font-weight:bold;">⚠️ ${daysLeft} Days Left</span>`;
            } else {
                status = 'Valid';
                statusHtml = `<span style="background:rgba(34, 197, 94, 0.1); color:#166534; padding:2px 6px; border-radius:4px; font-size:0.75rem; border:1px solid #bbf7d0; font-weight:bold;">✓ Valid</span>`;
            }
        }
        return { ...d, _status: status, _statusHtml: statusHtml };
    });

    let filtered = processed.filter(d => {
        if (statusFilter && d._status !== statusFilter && !(statusFilter === 'Valid' && !d.expiryDate)) return false;
        if (searchFilter) {
            const str = `${d.name} ${d.no}`.toLowerCase();
            if (!str.includes(searchFilter)) return false;
        }
        return true;
    });

    filtered.sort((a, b) => {
        if (!a.expiryDate) return 1;
        if (!b.expiryDate) return -1;
        return new Date(a.expiryDate) - new Date(b.expiryDate);
    });

    const limit = limitStr === 'all' ? filtered.length : parseInt(limitStr, 10);
    const startIndex = (window.exporterCurrentPage - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    if (paginated.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px; color:var(--text-muted);">No documents found matching filters.</td></tr>`;
        return;
    }

    let html = paginated.map(d => {
        let safeLink = '#';
        if (d.link) {
            try {
                const parsed = new URL(d.link);
                if (parsed.protocol === 'http:' || parsed.protocol === 'https:') safeLink = escapeHTML(parsed.href);
            } catch(e) {}
        }

        const linkHtml = (d.link && safeLink !== '#') ? `<a href="${safeLink}" target="_blank" style="color:var(--primary); font-size:1.1rem; text-decoration:none; padding:4px;" title="Open File">🔗</a>` : '';
        const safeId = escapeHTML(d.id).replace(/&#039;/g, "\\'");

        return `<tr style="border-bottom: 1px solid var(--border);">
            <td style="padding: 10px;">
                <b style="color:var(--text);">${escapeHTML(d.name)}</b>
                <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Issued: ${d.issueDate ? (typeof formatDateIN === 'function' ? formatDateIN(d.issueDate) : d.issueDate) : 'N/A'}</div>
            </td>
            <td style="font-family: monospace; font-size:0.9rem; padding: 10px;">${escapeHTML(d.no)}</td>
            <td style="padding: 10px;">${d._statusHtml}</td>
            <td style="padding: 10px; text-align:right;">
                <div style="display:flex; gap:5px; justify-content: flex-end; align-items:center;">
                    ${linkHtml}
                    <button class="danger" style="padding:4px 8px; font-size:0.75rem;" onclick="deleteExporterDoc('${safeId}')">Del</button>
                </div>
            </td>
        </tr>`;
    }).join('');

    const totalPages = Math.ceil(filtered.length / limit) || 1;
    if (totalPages > 1) {
        html += `
        <tr><td colspan="4" style="text-align:center; padding: 10px; background: var(--surface) !important;">
            <button type="button" class="secondary" style="padding: 2px 8px; font-size:0.8rem;" onclick="window.exporterCurrentPage--; renderExporterData()" ${window.exporterCurrentPage <= 1 ? 'disabled' : ''}>◀ Prev</button>
            <span style="margin:0 15px; font-size:0.85rem; font-weight:bold;">Page ${window.exporterCurrentPage} of ${totalPages}</span>
            <button type="button" class="secondary" style="padding: 2px 8px; font-size:0.8rem;" onclick="window.exporterCurrentPage++; renderExporterData()" ${window.exporterCurrentPage >= totalPages ? 'disabled' : ''}>Next ▶</button>
        </td></tr>`;
    }

    tbody.innerHTML = html;
}

window.deleteExporterDoc = function(id) {
    if(typeof Enterprise !== 'undefined' && !Enterprise.security.canDelete()) return;
    if(!confirm("Are you sure you want to permanently delete this compliance record?")) return;
    
    db.exporter_data = db.exporter_data.filter(d => d.id !== id);
    
    if (typeof window.saveData === 'function') window.saveData(true);
    else if(typeof saveData === 'function') saveData(true);
    
    _lastExporterCount = db.exporter_data.length;
    renderExporterData();
    if(typeof Enterprise !== 'undefined') Enterprise.logAction(`Deleted record from Compliance Vault.`);
};

// Global initialization hook for navigation controller
window.renderExporterData = renderExporterData;


