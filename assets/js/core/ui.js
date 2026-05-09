/* --- UI, NAVIGATION & MULTI-COMPANY MASTER CONTROLLER --- */

window.escapeHTML = function(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>'"]/g, match => {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[match];
    });
};

window.jsSafeId = function(id) {
    if (!id) return '';
    return String(id).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
};

window.getFinancialYear = function(date = new Date()) {
    const d = new Date(date);
    const m = d.getMonth();
    const yYear = d.getFullYear();
    // FY follows April (month 3) to March (month 2 next year)
    return (m >= 3) ? yYear : yYear - 1;
};

window.getFYLabel = function(date = new Date()) {
    const startY = window.getFinancialYear(date);
    return `FY ${startY}-${(startY + 1).toString().slice(2)}`;
};

window.safeMultiline = function(str) {
    if (!str) return '';
    return window.escapeHTML(str).replace(/\n/g, '<br>');
};

window.showToast = function(message, type = 'info', duration = 4000) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = '🔔';
    if (type === 'success') icon = '✅';
    if (type === 'warning') icon = '⚠️';
    if (type === 'danger' || type === 'error') icon = '❌';
    if (type === 'info') icon = 'ℹ️';

    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-content">${window.escapeHTML(message)}</div>
        <div class="toast-close" onclick="this.parentElement.remove()">✕</div>
    `;

    container.appendChild(toast);

    // Auto-remove
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('hiding');
            setTimeout(() => { if (toast.parentElement) toast.remove(); }, 300);
        }
    }, duration);
};

window.getUsdInrRate = function() {
    if (typeof window.db !== 'undefined' && window.db.meta && window.db.meta.usdInrRate) {
        const rate = parseFloat(window.db.meta.usdInrRate);
        if (rate && rate > 0) {
            window._usingFallbackRate = false;
            return rate;
        }
    }
    // FALLBACK: Live fetch unavailable. Flag UI so dashboard shows "Estimated Rate" badge.
    window._usingFallbackRate = true;
    return 84.50; // Updated from stale 83.50 — still an estimate; always prefer live fetch.
};

/**
 * CORE PERFORMANCE UTILITIES
 * ==========================
 */
window.debounce = function(func, wait, immediate) {
    let timeout;
    return function() {
        const context = this, args = arguments;
        const later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
};

window.throttle = function(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

/**
 * MASTER VIEW CONFIGURATION
 * =========================
 */
window.APP_VIEWS = [
    'dashboard.html',
    'documents.html',
    'inventory.html',
    'logistics.html',
    'finance.html',
    'costing.html',
    'attendance.html',
    'tasks.html',
    'settings.html',
    'pricelist.html',
    'lc-manager.html',
    'incentives.html',
    'exporter-data.html',
    'print.html',
    'crm.html',
    'import.html',
    'reports.html'
];

let _globalSyncHashes = {};

window.startEnterpriseWatchdog = function() {
    setInterval(() => {
        if (typeof window.db === 'undefined') return;
        
        const currentHashes = {
            docs: (window.db.docs || []).length,
            expenses: (window.db.expenses || []).length,
            tasks: (window.db.tasks || []).length,
            inventory: (window.db.inventory || []).length + (window.db.inventory_log || []).length,
            po: (window.db.po || []).length,
            trucks: (window.db.log_trucks || []).length,
            containers: (window.db.log_containers || []).length,
            vessels: (window.db.log_vessels || []).length,
            costings: (window.db.costings || []).length,
            profile: `${window.db.profile?.name || ''}-${window.db.bankProfiles?.length || 0}`
        };

        let hasChanged = false;
        for (const key in currentHashes) {
            if (_globalSyncHashes[key] !== currentHashes[key]) {
                _globalSyncHashes[key] = currentHashes[key];
                hasChanged = true;
            }
        }

        if (hasChanged && typeof _debouncedRefreshActiveUI === 'function') {
            _debouncedRefreshActiveUI();
        }

        if (typeof checkFXRateAlerts === 'function') checkFXRateAlerts();

        // FISCAL YEAR BOUNDARY WATCHDOG (Method 14)
        const currentFY = window.getFinancialYear();
        if (window._lastDetectedFY && window._lastDetectedFY !== currentFY) {
            window.showToast(`📅 NEW FISCAL YEAR DETECTED: System set to ${currentFY}. Resetting P&L views...`, "info", 6000);
            if(typeof renderDashboard === 'function') renderDashboard();
        }
        window._lastDetectedFY = currentFY;

        // STORAGE QUOTA STRESS ALERT
        const dbSize = JSON.stringify(window.db || {}).length * 2;
        if (dbSize > 4 * 1024 * 1024) { // 4MB Warning
            window.showToast("🚨 STORAGE NEAR CAPACITY: Clear old logs or export data to prevent loss.", "warning", 8000);
        }
    }, 4000); 
};

setTimeout(window.startEnterpriseWatchdog, 2000);

const NAV_TREE = [
    { id: 'dashboard',    label: 'Dashboard',          icon: '📊', module: 'core',     initFn: 'renderDashboard' },
    { id: 'documents',    label: 'Trade Documents',    icon: '📄', module: 'core',     initFn: 'renderDocTabsUI' },
    { id: 'finance',      label: 'Finance & PnL',      icon: '💰', module: 'finance',  initFn: 'renderPnL' },
    { id: 'logistics',    label: 'Logistics Tracker',  icon: '🚚', module: 'logistics',initFn: 'renderLogistics' },
    { id: 'inventory',    label: 'Inventory (Stock)',   icon: '📦', module: 'inventory',initFn: 'renderInventoryLedger' },
    { id: 'costing',      label: 'Costing Calc',       icon: '🧮', module: 'costing',  initFn: 'renderCostingTable' },
    { id: 'import-mgmt',  label: 'Import Management',  icon: '🛳️', module: 'core',     initFn: 'renderImportTable', file: 'import.html' },
    { id: 'reports',      label: 'Report Builder',     icon: '📈', module: 'core',     initFn: 'renderReportBuilder' },
    { id: 'tasks',        label: 'Task Board',         icon: '✅', module: 'core',     initFn: 'renderTasksWorkspace' },
    { id: 'crm',          label: 'CRM',                icon: '🤝', module: 'core',     initFn: 'renderNetworkCRM' },
    { id: 'print',        label: 'Print History',      icon: '🖨️', module: 'core',     initFn: 'initPrintAndDrafts' },
    { id: 'exporter-data',label: 'Document Vault',     icon: '🛡️', module: 'core',     initFn: 'renderExporterData' },
    { id: 'attendance',   label: 'Attendance',         icon: '📅', module: 'hr',       initFn: 'renderAttendanceWorkspace' },
    { id: 'settings',     label: 'Settings',           icon: '⚙️', module: 'core',     initFn: 'initSettingsSystem' }
    // NOTE: LC Manager and Govt Incentives are now Finance sub-tabs (see finance.html btn-fin-lc, btn-fin-incentives)
    // They redirect via showTab() guard below. No longer standalone nav entries.
];

window.initPrintAndDrafts = function() {
    if (typeof renderPrintQueue === 'function') renderPrintQueue();
    if (typeof renderDrafts === 'function') renderDrafts();
};

const APP_COMMANDS = [
    { keywords: ['new invoice', 'create invoice', 'commercial invoice'], title: '📄 Create Commercial Invoice', action: () => { showTab('documents'); setTimeout(() => createNewDoc('Commercial Invoice'), 200); } },
    { keywords: ['new proforma', 'create proforma'], title: '📄 Create Proforma Invoice', action: () => { showTab('documents'); setTimeout(() => createNewDoc('Proforma Invoice'), 200); } },
    { keywords: ['new packing list', 'create packing list'], title: '📦 Create Packing List', action: () => { showTab('documents'); setTimeout(() => createNewDoc('Packing List'), 200); } },
    { keywords: ['lc', 'letter of credit', 'lc manager', 'bank lc', 'lc expiry'], title: '🏦 LC Manager', action: () => { showTab('finance'); setTimeout(() => switchFinanceTab('lc'), 250); } },
    { keywords: ['incentives', 'rodtep', 'meis', 'drawback', 'govt incentive', 'export incentive'], title: '💸 Govt Export Incentives', action: () => { showTab('finance'); setTimeout(() => switchFinanceTab('incentives'), 250); } },
    { keywords: ['quick quote', 'price quote', 'export price', 'pricelist', 'price list', 'quote buyer', 'usd price'], title: '💱 Quick Quote (INR → Export)', action: () => { showTab('costing'); setTimeout(() => { if(typeof switchCostTab==='function') switchCostTab('quote'); }, 250); } },
    { keywords: ['add expense', 'new expense', 'log expense', 'pnl'], title: '💰 Log New Expense', action: () => { showTab('finance'); setTimeout(() => switchFinanceTab('exp'), 100); } },
    { keywords: ['add forex', 'log forex', 'realization', 'bank'], title: '💱 Log Forex Realization', action: () => { showTab('finance'); setTimeout(() => switchFinanceTab('forex'), 100); } },
    { keywords: ['brc', 'compliance', 'shipping bill', 'egm', 'icegate'], title: '🛡️ Open Compliance & e-BRC Registry', action: () => { showTab('finance'); setTimeout(() => switchFinanceTab('compliance'), 100); } },
    { keywords: ['mafae', 'forex ai', 'hedge advise', 'market', 'advisory'], title: '🌍 Open MAFAE Forex Advisory', action: () => { showTab('finance'); setTimeout(() => { switchFinanceTab('hedge'); switchHedgeSubTab('advisor'); }, 200); } },
    { keywords: ['add vessel', 'track vessel', 'new ship', 'map'], title: '🚢 Track New Vessel', action: () => { showTab('logistics'); setTimeout(() => switchLogisticsTab('vessel'), 100); } },
    { keywords: ['add truck', 'new truck'], title: '🚚 Log Truck Entry', action: () => { showTab('logistics'); setTimeout(() => switchLogisticsTab('truck'), 100); } },
    { keywords: ['add container', 'new container', 'stuffing'], title: '📦 Log Container', action: () => { showTab('logistics'); setTimeout(() => switchLogisticsTab('container'), 100); } },
    { keywords: ['vault', 'compliance', 'document', 'iec', 'gst'], title: '🛡️ Open Document Vault', action: () => { showTab('exporter-data'); } },
    { keywords: ['updates', 'system check', 'version', 'maintenance'], title: '🚀 System & Updates Center', action: () => { showTab('settings'); setTimeout(() => { if(typeof switchSettingsTab === 'function') switchSettingsTab('updates'); }, 200); } },
    { keywords: ['settings', 'profile', 'company info', 'theme'], title: '⚙️ Open Settings', action: () => { showTab('settings'); } },
    { keywords: ['dashboard', 'home', 'kpi'], title: '📊 Go to Dashboard', action: () => { showTab('dashboard'); } }
];

window.getActiveCompany = function() {
    if (!window.db || !window.db.companies || window.db.companies.length === 0) {
        return window.db?.profile || { name: 'JFT Agro Overseas', prefix: 'JFT/' };
    }
    const activeId = localStorage.getItem('jft_active_company') || window.db.companies[0].id;
    const comp = window.db.companies.find(c => c.id === activeId) || window.db.companies[0];
    if (comp && !comp.prefix) comp.prefix = 'JFT/';
    return comp;
};

function renderCompanySwitcher() {
    if(sessionStorage.getItem('jft_role') === 'buyer') {
        const hs = document.getElementById('header-workspace-switcher');
        if (hs) hs.parentElement.style.display = 'none';
        return;
    }

    const headerSwitcher = document.getElementById('header-workspace-switcher');
    const profileSwitcher = document.getElementById('co-switch-select');
    
    let list = [];
    if (typeof window.getManagedCompanies === 'function') {
        list = window.getManagedCompanies();
    }
    
    if (!list.some(c => c.id === 'JFT_MAIN')) {
        list.unshift({ id: 'JFT_MAIN', name: 'Primary Branch (HQ)' });
    }

    const activeId = localStorage.getItem('jft_active_cid') || 'JFT_MAIN';
    
    let options = list.map(c => `<option value="${escapeHTML(c.id)}" ${c.id === activeId ? 'selected' : ''}>🏢 ${escapeHTML(c.name || 'JFT Agro')}</option>`).join('');
    options += `<option disabled>──────────</option><option value="NEW">➕ Create Workspace</option>`;
    
    if (headerSwitcher) headerSwitcher.innerHTML = options;
    if (profileSwitcher) profileSwitcher.innerHTML = options;
}

window.switchActiveCompany = function(id) {
    if (typeof window.switchCompany === 'function') window.switchCompany(id);
};

window.DynamicUI = {
    getFields: function(target) {
        if (!window.db || !window.db.customFields) return [];
        return window.db.customFields.filter(f => f.target === target || f.target === 'all_' + target.split('_')[0]);
    },
    injectForm: function(formId, target) {
        const form = document.getElementById(formId);
        if (!form) return;
        let container = document.getElementById(`dyn-form-${target}`);
        if (!container) {
            container = document.createElement('div');
            container.id = `dyn-form-${target}`;
            container.className = 'grid-2'; 
            container.style.marginBottom = '15px';
            container.style.borderTop = '1px dashed var(--border)';
            container.style.paddingTop = '15px';
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) form.insertBefore(container, submitBtn);
            else form.appendChild(container);
        }
        const fields = this.getFields(target);
        if (fields.length === 0) { container.innerHTML = ''; return; }
        
        container.innerHTML = fields.map(f => `
            <div>
                <label style="color:var(--text-muted); font-weight:600; font-size:0.85rem; text-transform:uppercase; letter-spacing:0.5px;">${escapeHTML(f.name)} (Custom)</label>
                <input type="text" id="dyn_${escapeHTML(target)}_${escapeHTML(f.id)}" placeholder="Enter ${escapeHTML(f.name)}..." style="width:100%; padding:8px 12px; border:1px solid var(--border); border-radius:4px; font-size:0.95rem; margin-top:5px; margin-bottom:15px; background:transparent; color:var(--text); transition:border 0.2s, box-shadow 0.2s;">
            </div>
        `).join('');
    },
    extractData: function(target) {
        const data = {};
        this.getFields(target).forEach(f => {
            const el = document.getElementById(`dyn_${target}_${f.id}`);
            if (el) data[f.id] = el.value;
        });
        return data;
    },
    resetForm: function(target) {
        this.getFields(target).forEach(f => {
            const el = document.getElementById(`dyn_${target}_${f.id}`);
            if (el) el.value = '';
        });
    },
    fillForm: function(target, dataObj) {
        if (!dataObj) return;
        this.getFields(target).forEach(f => {
            const el = document.getElementById(`dyn_${target}_${f.id}`);
            if (el && dataObj[f.id] !== undefined) el.value = dataObj[f.id];
        });
    },
    getHeaders: function(target) {
        return this.getFields(target).map(f => `<th style="color:var(--text-muted); font-weight:bold; text-transform:uppercase; font-size:0.8rem;">${escapeHTML(f.name)}</th>`).join('');
    },
    getCells: function(target, dataObj) {
        return this.getFields(target).map(f => `<td>${(dataObj && dataObj[f.id]) ? `<b>${escapeHTML(dataObj[f.id])}</b>` : '-'}</td>`).join('');
    }
};

// ==========================================
// CRASH-PROOF APPLICATION INITIALIZATION
// ==========================================
function initApp() {
    try {
        console.log("[CORE] Booting Application Logic...");
        
        // 1. SAFEGUARD THE DATABASE OBJECT
        if (typeof window.db === 'undefined' || !window.db) {
            window.db = { 
                docs: [], profile: {}, meta: {}, companies: [], customFields: [], 
                features: { finance: true, logistics: true, inventory: true, costing: true, hr: true } 
            };
            console.warn("[CORE] Critical db missing! Initializing fallback structure.");
        }
        if (!window.db.features) window.db.features = { finance: true, logistics: true, inventory: true, costing: true, hr: true };
        if (!window.db.notes) window.db.notes = [];
        if (!window.db.events) window.db.events = [];
        if (!window.db.clocks) window.db.clocks = ['Asia/Kolkata', 'Europe/London', 'America/New_York', 'Asia/Dubai'];
        
        window.snoozedAlerts = JSON.parse(localStorage.getItem('jft_snoozed_alerts') || '{}');
        window.dismissedAlerts = JSON.parse(localStorage.getItem('jft_dismissed_alerts') || '{}');

        const currentRole = sessionStorage.getItem('jft_role') || 'Viewer';
        const currentUser = sessionStorage.getItem('jft_user') || 'User';

        if (typeof Enterprise !== 'undefined' && Enterprise.AI && Enterprise.AI.updateStatusUI) {
            Enterprise.AI.updateStatusUI();
        }

        if (currentRole === 'buyer') {
            const sidebar = document.getElementById('sidebar');
            if(sidebar) sidebar.style.display = 'none';
            const mainContent = document.querySelector('.main-content');
            if(mainContent) mainContent.style.marginLeft = '0';
            
            document.querySelectorAll('.utility-btn').forEach(b => b.style.display = 'none');
            const searchBar = document.querySelector('.search-bar');
            if(searchBar) searchBar.style.display = 'none';
            
            const pageTitle = document.getElementById('page-title');
            if(pageTitle) pageTitle.innerText = "CLIENT PORTAL";
        } else {
            renderSidebar();
            renderCompanySwitcher();
            if (typeof enforceRoleUI === 'function') enforceRoleUI(currentRole);
            if (typeof startEnterpriseSync === 'function') startEnterpriseSync();
        }
        
        const tabs = document.querySelectorAll('.main-tab');
        tabs.forEach(tab => { if(tab) tab.style.setProperty('display', 'none', 'important'); });
        
        const userDisplay = document.getElementById('current-user-display');
        if (userDisplay) userDisplay.innerText = `👤 ${escapeHTML(currentUser)}`;
        
        const headerAvatar = document.getElementById('header-avatar');
        if (headerAvatar) headerAvatar.innerText = currentUser.charAt(0).toUpperCase();
        
        const ddUser = document.getElementById('dd-username');
        const ddRole = document.getElementById('dd-role');
        if (ddUser) ddUser.innerText = currentUser;
        if (ddRole) ddRole.innerText = currentRole.toUpperCase();

        if (typeof checkSession === 'function') checkSession();
        
        applyTheme();
        
        checkCalendarAlerts();
        setInterval(checkCalendarAlerts, 60000);
        initGoogleAPI();

    } catch (error) {
        console.error("[CRITICAL] initApp encountered an error, forcing UI recovery:", error);
    } finally {
        // 2. GUARANTEE UI RENDERS EVEN IF A BACKGROUND SCRIPT FAILS
        setTimeout(() => showTab('dashboard'), 100); 
    }
}

function renderSidebar() {
    const nav = document.getElementById('sidebar-nav');
    if (!nav) return;
    
    // Crash prevention fix: fetch ID from storage safely instead of undefined variable
    const activeId = localStorage.getItem('jft_active_company') || '';
    const activeCompanies = window.getManagedCompanies ? window.getManagedCompanies() : [];
    const currentCo = activeCompanies.find(c => c.id === activeId) || { name: 'JFT Agro Overseas', logo: '🌐' };

    setTimeout(() => {
        const welcomeSpan = document.getElementById('header-company-welcome');
        if (welcomeSpan) welcomeSpan.innerText = `Welcome, ${currentCo.name}`;
    }, 50);

    let html = ''; 

    setTimeout(() => {
        const ddSelect = document.getElementById('co-switch-select');
        if (ddSelect) {
            ddSelect.innerHTML = `
                ${activeCompanies.map(c => `<option value="${c.id}" ${c.id === activeId ? 'selected' : ''}>${c.name}</option>`).join('')}
                <option value="" disabled>---</option>
                <option value="NEW">+ Add Business</option>
            `;
        }
    }, 100);

    const activeFeatures = (window.db && window.db.features) ? window.db.features : { finance: true, logistics: true, inventory: true, costing: true, hr: true };
    
    html += NAV_TREE.filter(item => {
        if (item.module === 'core') return true; 
        return activeFeatures[item.module] === true; 
    }).map(item => `
        <a href="#" class="nav-item" id="nav-${escapeHTML(item.id)}" onclick="showTab('${escapeHTML(item.id)}')">
            <span class="nav-icon">${item.icon}</span>
            <span class="nav-text">${escapeHTML(item.label)}</span>
        </a>
    `).join('');

    if (window.db && window.db.customTabs && window.db.customTabs.length > 0) {
        html += `<div style="padding: 15px 15px 5px; font-size: 0.7rem; font-weight: bold; color: var(--text-muted); letter-spacing: 1px;">CUSTOM APPS</div>`;
        html += window.db.customTabs.map(tab => `
            <a href="#" class="nav-item" id="nav-${escapeHTML(tab.id)}" onclick="showTab('${escapeHTML(tab.id)}')">
                <span class="nav-icon">${escapeHTML(tab.icon)}</span>
                <span class="nav-text">${escapeHTML(tab.name)}</span>
            </a>
        `).join('');
    }

    nav.innerHTML = html;
}

window.OPEN_TABS = [];

window.closeMultiTaskTab = function(tabId, event) {
    if (event) event.stopPropagation();
    window.OPEN_TABS = window.OPEN_TABS.filter(t => t.id !== tabId);
    if (window.OPEN_TABS.length === 0) {
        showTab('dashboard'); // Fallback to dashboard
    } else {
        // Switch to the last open tab
        showTab(window.OPEN_TABS[window.OPEN_TABS.length - 1].id);
    }
};

function _renderHorizontalTabs(activeTabId) {
    const bar = document.getElementById('multi-task-tab-bar');
    if (!bar) return;
    
    if (window.OPEN_TABS.length === 0) {
        bar.style.display = 'none';
        return;
    } else {
        bar.style.display = 'flex';
    }

    bar.innerHTML = window.OPEN_TABS.map(tab => `
        <div onclick="showTab('${escapeHTML(tab.id)}')" 
             style="cursor:pointer; display:flex; align-items:center; gap:8px; padding:8px 15px; border-radius: 8px 8px 0 0; font-size:0.8rem; font-weight:bold; 
             ${tab.id === activeTabId 
                ? 'background: var(--surface); color: var(--primary); border: 1px solid var(--border); border-bottom: 2px solid var(--surface); margin-bottom:-1px; box-shadow: 0 -2px 10px rgba(0,0,0,0.05);' 
                : 'background: transparent; color: var(--text-muted); border: 1px solid transparent; hover:background:rgba(0,0,0,0.02);'}">
            <span>${tab.icon} ${escapeHTML(tab.name)}</span>
            ${tab.id !== 'dashboard' ? `<span onclick="window.closeMultiTaskTab('${escapeHTML(tab.id)}', event)" style="font-size:0.9rem; margin-left:5px; opacity:0.5; hover:opacity:1;">✕</span>` : ''}
        </div>
    `).join('');
}

function showTab(tabId) {
    if (!tabId) return;
    
    // Redirect Legacy Module to Settings Sub-tab
    if (tabId === 'system-updates') {
        showTab('settings');
        setTimeout(() => { if (typeof switchSettingsTab === 'function') switchSettingsTab('updates'); }, 200);
        return;
    }

    // Redirect: LC Manager and Govt Incentives moved into Finance sub-tabs
    if (tabId === 'lc-manager') {
        showTab('finance');
        setTimeout(() => { if (typeof switchFinanceTab === 'function') switchFinanceTab('lc'); }, 250);
        return;
    }
    if (tabId === 'incentives') {
        showTab('finance');
        setTimeout(() => { if (typeof switchFinanceTab === 'function') switchFinanceTab('incentives'); }, 250);
        return;
    }
    // Redirect: Pricelist consolidated into Costing → Quick Quote tab
    if (tabId === 'pricelist') {
        showTab('costing');
        setTimeout(() => { if (typeof switchCostTab === 'function') switchCostTab('quote'); }, 250);
        return;
    }

    console.debug(`[UI] Switching to tab: ${tabId}`);

    // Close mobile sidebar after clicking a nav item (UX improvement)
    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('mobile-open')) {
            sidebar.classList.remove('mobile-open');
        }
    }
    let tabData = NAV_TREE.find(n => n.id === tabId);
    if (!tabData && window.db && window.db.customTabs) tabData = window.db.customTabs.find(t => t.id === tabId);
    const tabName = tabData ? (tabData.label || tabData.name) : tabId.replace(/-/g, ' ').toUpperCase();
    const tabIcon = tabData ? tabData.icon : '📄';

    if (!window.OPEN_TABS.find(t => t.id === tabId)) {
        window.OPEN_TABS.push({ id: tabId, name: tabName, icon: tabIcon });
    }
    _renderHorizontalTabs(tabId);

    const tabs = document.querySelectorAll('.main-tab');
    tabs.forEach(tab => {
        if (tab) {
            tab.style.setProperty('display', 'none', 'important');
            tab.classList.remove('active');
        }
    });

    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(nav => nav.classList.remove('active'));

    const overlays = document.querySelectorAll('.modal-overlay, #command-palette-overlay');
    overlays.forEach(overlay => {
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.style.display = 'none';
        }
    });

    document.body.classList.remove('admin-edit-mode');

    if (tabId.startsWith('custom_')) {
        let customTabEl = document.getElementById(tabId);
        const tabData = window.db && window.db.customTabs ? window.db.customTabs.find(t => t.id === tabId) : null;
        
        if (!customTabEl && tabData) {
            const container = document.getElementById('views-container');
            customTabEl = document.createElement('div');
            customTabEl.id = tabId;
            customTabEl.className = 'main-tab';
            
            if (tabData.type === 'iframe') {
                let safeUrl = 'about:blank';
                try {
                    const parsed = new URL(tabData.content);
                    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                        safeUrl = parsed.href;
                    }
                } catch(e) {}

                customTabEl.innerHTML = `<div class="card" style="height:calc(100vh - 140px); padding:0; overflow:hidden;"><iframe src="${escapeHTML(safeUrl)}" style="width:100%; height:100%; border:none;"></iframe></div>`;
            } else if (tabData.type === 'notes') {
                customTabEl.innerHTML = `<div class="card" style="height:calc(100vh - 140px); display:flex; flex-direction:column;"><h3 style="margin-bottom:15px; border-bottom:1px solid var(--border); padding-bottom:10px;">📝 ${escapeHTML(tabData.name)} Workspace</h3><textarea style="flex-grow:1; border:none; resize:none; font-family:inherit; font-size:1.1rem; outline:none; background:transparent; color:var(--text);" placeholder="Start typing here... Auto-saves to cloud." oninput="saveCustomTabNote('${escapeHTML(tabData.id)}', this.value)">${escapeHTML(tabData.content || '')}</textarea></div>`;
            }
            if(container) container.appendChild(customTabEl);
        }
        
        if (customTabEl) {
            customTabEl.style.setProperty('display', 'block', 'important');
            customTabEl.classList.add('active');
        }
        
        const pageTitle = document.getElementById('page-title');
        if (pageTitle && tabData) pageTitle.innerText = tabData.name.toUpperCase();

    } else {
        let targetTab = document.getElementById(tabId);
        
        // --- LAZY-LOAD ENGINE ---
        if (!targetTab) {
            console.log(`[UI] Lazy-loading module: ${tabId}`);
            
            // Resolve filename routing
            let fileName = tabId + '.html';
            const navNode = window.NAV_TREE ? window.NAV_TREE.find(n => n.id === tabId) : NAV_TREE.find(n => n.id === tabId);
            if (navNode && navNode.file) fileName = navNode.file;

            const container = document.getElementById('views-container');
            if (container) {
                const tempId = tabId + '-loading';
                container.insertAdjacentHTML('beforeend', `
                    <div id="${tempId}" class="main-tab active" style="display:block !important; padding:20px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 25px;">
                            <div class="skeleton" style="width:250px; height:32px; border-radius:8px;"></div>
                            <div class="skeleton skeleton-circle" style="width:40px; height:40px;"></div>
                        </div>
                        <div class="grid-4" style="margin-bottom:25px;">
                            <div class="skeleton skeleton-card"></div>
                            <div class="skeleton skeleton-card"></div>
                            <div class="skeleton skeleton-card"></div>
                            <div class="skeleton skeleton-card"></div>
                        </div>
                        <div class="card" style="padding:20px;">
                            <div class="skeleton skeleton-text"></div>
                            <div class="skeleton skeleton-text" style="width:80%;"></div>
                            <div class="skeleton skeleton-text" style="width:90%;"></div>
                            <div class="skeleton skeleton-text" style="width:70%;"></div>
                            <div style="height:200px; margin:20px 0;" class="skeleton"></div>
                            <div class="skeleton skeleton-text"></div>
                        </div>
                    </div>
                `);
                
                const isDesktop = typeof window.electron !== 'undefined';
                const { fs: fsObj, path: pathObj } = window.electron || {};
                const dirname = window.electron?.process?.__dirname || '';

                if (isDesktop && fsObj && pathObj) {
                    try {
                        const viewPath = pathObj.join(dirname, 'views', fileName);
                        if (fsObj.exists(viewPath)) {
                            const html = fsObj.read(viewPath, 'utf8');
                            const loader = document.getElementById(tempId);
                            if(loader) loader.remove();
                            container.insertAdjacentHTML('beforeend', html);
                            showTab(tabId); 
                            return;
                        }
                    } catch(e) { console.error('Electron FS read fail:', e); }
                }

                fetch(`views/${fileName}`)
                    .then(res => {
                        if(!res.ok) throw new Error("File not found on disk/cache");
                        return res.text();
                    })
                    .then(html => {
                        const loader = document.getElementById(tempId);
                        if(loader) loader.remove();
                        container.insertAdjacentHTML('beforeend', html);
                        showTab(tabId); // Recursive reboot to initialize the DOM hooks
                    })
                    .catch(err => {
                        const loader = document.getElementById(tempId);
                        if(loader) {
                            const isLocalFile = window.location.protocol === 'file:';
                            loader.innerHTML = `
                                <div class="card" style="text-align:center; padding: 40px; border: 2px dashed var(--danger);">
                                    <div style="font-size:3.5rem; margin-bottom:20px;">🔒</div>
                                    <h2 style="color:var(--danger); margin-bottom:10px;">Local Security Barrier</h2>
                                    <p style="color:var(--text); font-size:1.1rem; margin-bottom:20px;">
                                        Module <b>"${fileName}"</b> cannot be loaded because you are opening the file directly (file://).<br>
                                        Modern browsers block module loading for security.
                                    </p>
                                    <div style="background:var(--bg); padding:15px; border-radius:8px; display:inline-block; text-align:left; font-family:monospace;">
                                        <b>FIX:</b> Open your terminal in this folder and run:<br>
                                        <code style="color:var(--primary); font-weight:bold;">npm run dev</code>
                                    </div>
                                    <p style="margin-top:20px; font-size:0.85rem; color:var(--text-muted);">After starting the server, click the link provided in the terminal (usually http://localhost:5173).</p>
                                </div>
                            `;
                        }
                    });
                return; // Suspend execution until dom is ready
            }
        }
        
        if (targetTab) { 
            // FORCE BROWSER TO SHOW DIV VIA OVERRIDE
            targetTab.classList.add('active'); 
            targetTab.style.setProperty('display', 'block', 'important');
            targetTab.style.setProperty('opacity', '1', 'important');
            targetTab.style.setProperty('visibility', 'visible', 'important');
            console.log(`[UI] Showing Module: ${tabId}`);
            
            // 3. Ergonomic Scroll Reset: Always start from top when switching tabs
            resetViewScroll();
        }
        
        const tabConfig = NAV_TREE.find(t => t.id === tabId);
        const pageTitle = document.getElementById('page-title');
        
        if (sessionStorage.getItem('jft_role') !== 'buyer') {
            if (pageTitle && tabConfig) pageTitle.innerText = tabConfig.label.toUpperCase();
        }

        if (tabConfig && tabConfig.initFn && typeof window[tabConfig.initFn] === 'function') {
            window[tabConfig.initFn]();
        }
    }
    
    const targetNav = document.getElementById(`nav-${tabId}`);
    if (targetNav) targetNav.classList.add('active');
}

function saveCustomTabNote(id, value) {
    if (!window.db || !window.db.customTabs) return;
    const tab = window.db.customTabs.find(t => t.id === id);
    if (tab) {
        tab.content = value;
        if(window.noteSaveTimeout) clearTimeout(window.noteSaveTimeout);
        window.noteSaveTimeout = setTimeout(() => { if(typeof saveData === 'function') saveData(true); }, 1500);
    }
}

function resetViewScroll() {
    // 1. Reset Global Container
    const container = document.getElementById('views-container');
    if (container) container.scrollTop = 0;
    
    // 2. Reset Individual Tab Scroll (Crucial because .main-tab has overflow-y: auto)
    const activeTab = document.querySelector('.main-tab.active');
    if (activeTab) {
        activeTab.scrollTop = 0;
    }
    
    // 3. Fallback to window for mobile/iOS edge cases
    window.scrollTo(0, 0);
    
    // 4. Final safety tick for async layout reflows
    requestAnimationFrame(() => {
        if (container) container.scrollTop = 0;
        const subTab = document.querySelector('.main-tab.active');
        if (subTab) subTab.scrollTop = 0;
    });
}

window.resetViewScroll = resetViewScroll;

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    
    // Check if we are on mobile (CSS breakpoint is 768px)
    if (window.innerWidth <= 768) {
        sidebar.classList.toggle('mobile-open');
    } else {
        sidebar.classList.toggle('minimized');
    }
}

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('jft_theme', isDark ? 'dark' : 'light');
    
    const icon = document.getElementById('theme-icon');
    if (icon) icon.innerText = isDark ? '☀️' : '🌙';
    
    if (typeof Enterprise !== 'undefined') Enterprise.notify(isDark ? "Dark Mode Enabled" : "Light Mode Enabled", "info");
}

function applyTheme() {
    if (typeof window.db !== 'undefined' && window.db.theme && window.db.theme.primary) {
        document.documentElement.style.setProperty('--primary', window.db.theme.primary);
        document.documentElement.style.setProperty('--secondary', window.db.theme.secondary);
        document.documentElement.style.setProperty('--accent', window.db.theme.accent);
    }
    
    const savedTheme = localStorage.getItem('jft_theme');
    const icon = document.getElementById('theme-icon');
    
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        if (icon) icon.innerText = '☀️';
    } else {
        document.body.classList.remove('dark-mode');
        if (icon) icon.innerText = '🌙';
    }
}

function toggleProfileMenu() {
    const menu = document.getElementById('profile-dropdown');
    if(menu) menu.classList.toggle('hidden');
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.user-profile-btn') && !e.target.closest('#profile-dropdown')) {
        const menu = document.getElementById('profile-dropdown');
        if (menu && !menu.classList.contains('hidden')) { menu.classList.add('hidden'); }
    }
});

// GLOBAL SYNC ENGINE BINDING
window.forceSync = function() {
    if(typeof saveData === 'function') saveData(false);
    if(typeof refreshActiveUI === 'function') refreshActiveUI();
    if(typeof Enterprise !== 'undefined') {
        Enterprise.notify("Global Sync Complete! All data securely updated.", "success");
    } else {
        alert("Global Sync Complete!");
    }
};


/* ==========================================
   REAL GMAIL API INTEGRATION (OAUTH2)
========================================== */

function getGmailClientId() {
    if (typeof window.db !== 'undefined' && window.db.meta && window.db.meta.apiKeys && window.db.meta.apiKeys.gmailClientId) {
        return window.db.meta.apiKeys.gmailClientId;
    }
    return 'YOUR_GOOGLE_CLIENT_ID_HERE.apps.googleusercontent.com';
}
const GMAIL_SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';

let tokenClient;
let gapiInited = false;
let gisInited = false;

function initGoogleAPI() {
    if (typeof gapi === 'undefined' || typeof google === 'undefined' || !google.accounts) {
        setTimeout(initGoogleAPI, 500);
        return;
    }

    gapi.load('client', async () => {
        await gapi.client.init({ discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest'] });
        gapiInited = true;
    });

    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: getGmailClientId(),
        scope: GMAIL_SCOPES,
        callback: (tokenResponse) => {
            if(tokenResponse.error !== undefined) { 
                console.error("Auth Error", tokenResponse);
                if(typeof Enterprise !== 'undefined') Enterprise.notify("Authentication Failed", "danger");
                return; 
            }
            fetchGmailInbox();
        }
    });
    gisInited = true;
}

window.handleAuthClick = function() {
    if (!gapiInited || !gisInited) {
        if(typeof Enterprise !== 'undefined') Enterprise.notify("Google SDK is still loading...", "warning");
        return;
    }
    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
        tokenClient.requestAccessToken({prompt: ''});
    }
}

window.handleSignoutClick = function() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token, () => {
            gapi.client.setToken('');
            document.getElementById('mail-login-view').classList.remove('hidden');
            document.getElementById('mail-inbox-view').classList.add('hidden');
            if(typeof Enterprise !== 'undefined') Enterprise.notify("Disconnected from Gmail", "info");
        });
    }
}

async function fetchGmailInbox() {
    document.getElementById('mail-login-view').classList.add('hidden');
    document.getElementById('mail-inbox-view').classList.remove('hidden');
    document.getElementById('mail-status-text').innerText = "Loading live emails...";
    
    try {
        const response = await gapi.client.gmail.users.messages.list({
            'userId': 'me',
            'maxResults': 10,
            'labelIds': ['INBOX']
        });
        
        const messages = response.result.messages;
        if (!messages || messages.length === 0) {
            document.getElementById('real-mail-list').innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-muted);">Inbox is empty.</div>';
            document.getElementById('mail-status-text').innerText = "Live Inbox (0)";
            return;
        }

        let mailHtml = '';
        for (const msg of messages) {
            const msgDetail = await gapi.client.gmail.users.messages.get({
                'userId': 'me',
                'id': msg.id,
                'format': 'metadata',
                'metadataHeaders': ['Subject', 'From', 'Date']
            });
            
            const headers = msgDetail.result.payload.headers;
            const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
            let from = headers.find(h => h.name === 'From')?.value || 'Unknown Sender';
            from = from.split('<')[0].replace(/"/g, '').trim();
            const dateStr = headers.find(h => h.name === 'Date')?.value;
            const date = dateStr ? new Date(dateStr).toLocaleDateString() : '';
            const snippet = escapeHTML(msgDetail.result.snippet || '');

            mailHtml += `
                <div style="padding:15px; border-bottom:1px solid var(--border); cursor:pointer; display:flex; gap:15px; align-items:center; background:var(--surface); transition:0.2s;" onmouseover="this.style.background='rgba(59,130,246,0.05)'" onmouseout="this.style.background='var(--surface)'">
                    <b style="width:180px; font-size:0.9rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text);">${escapeHTML(from)}</b>
                    <div style="flex-grow:1; font-size:0.9rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                        <b style="color:var(--text);">${escapeHTML(subject)}</b> 
                        <span style="color:var(--text-muted);">- ${snippet}</span>
                    </div>
                    <span style="font-size:0.8rem; color:var(--text-muted); white-space:nowrap;">${date}</span>
                </div>
            `;
        }
        
        document.getElementById('real-mail-list').innerHTML = mailHtml;
        document.getElementById('mail-status-text').innerText = "Connected to Gmail (Live)";
        if(typeof Enterprise !== 'undefined') Enterprise.notify("Gmail synced successfully", "success");

    } catch(e) {
        console.error(e);
        document.getElementById('mail-status-text').innerText = "Error syncing Gmail. Retrying...";
    }
}

window.refreshMailInbox = function() {
    if (gapi.client.getToken() !== null) {
        fetchGmailInbox();
    } else {
        handleAuthClick();
    }
}


/* ==========================================
   ADVANCED NOTIFICATIONS (SNOOZE / DISMISS)
========================================== */

function toggleNotificationPanel() {
    const np = document.getElementById('notification-panel');
    if (!np) return;
    
    const isHidden = np.classList.contains('hidden') || np.style.display === 'none';
    
    if (isHidden) {
        np.classList.remove('hidden');
        np.style.display = 'block';
        renderSystemNotifications();
        
        const badge = document.getElementById('notification-badge');
        if (badge) {
            badge.style.display = 'none';
            badge.innerText = '0';
        }
    } else {
        np.classList.add('hidden');
        np.style.display = 'none';
    }
}

function renderSystemNotifications() {
    const badge = document.getElementById('notification-badge');
    const list = document.getElementById('notification-list');
    if (!badge || !list || !window.db) return;

    const now = Date.now();
    let rawAlerts = [];

    if (window.db.inventory) {
        window.db.inventory.forEach(item => {
            if (item.currentQty <= item.minQty) {
                rawAlerts.push({ id: `inv-${item.id}`, icon: '⚠️', title: 'Low Stock Alert', text: `${escapeHTML(item.name)} is below minimum threshold.`, color: 'var(--danger)', action: () => showTab('inventory') });
            }
        });
    }

    if (window.db.lcs) {
        const today = new Date();
        const warningThreshold = new Date();
        warningThreshold.setDate(today.getDate() + 15);
        window.db.lcs.forEach(lc => {
            const expDate = new Date(lc.expDate);
            if (expDate <= warningThreshold && expDate >= today && lc.status !== 'Settled' && lc.status !== 'Expired') {
                rawAlerts.push({ id: `lc-${lc.id}`, icon: '🏦', title: 'LC Expiring Soon', text: `LC No: ${escapeHTML(lc.no)} requires attention.`, color: 'var(--warning)', action: () => { showTab('finance'); setTimeout(() => { if(typeof switchFinanceTab==='function') switchFinanceTab('lc'); }, 250); } });
            }
        });
    }

    if (window.db.exporter_data) {
        window.db.exporter_data.forEach(d => {
            if (d.expiryDate) {
                const daysLeft = (new Date(d.expiryDate) - new Date()) / (1000 * 60 * 60 * 24);
                if (daysLeft >= 0 && daysLeft < 30) rawAlerts.push({ id: `doc-${d.id}`, icon: '🛡️', title: 'Vault Document Renewal', text: `${escapeHTML(d.name)} expires soon.`, color: 'var(--warning)', action: () => showTab('exporter-data') });
                else if (daysLeft < 0) rawAlerts.push({ id: `doc-${d.id}`, icon: '❌', title: 'Vault Document Expired', text: `${escapeHTML(d.name)} has expired!`, color: 'var(--danger)', action: () => showTab('exporter-data') });
            }
        });
    }

    let activeAlerts = rawAlerts.filter(a => {
        if (window.dismissedAlerts[a.id]) return false;
        if (window.snoozedAlerts[a.id] && window.snoozedAlerts[a.id] > now) return false;
        return true;
    });

    const panel = document.getElementById('notification-panel');
    const isPanelHidden = panel && (panel.classList.contains('hidden') || panel.style.display === 'none');

    if (activeAlerts.length > 0) {
        if (isPanelHidden) {
            badge.style.display = 'flex';
            badge.innerText = activeAlerts.length;
        }
        
        list.innerHTML = activeAlerts.map((a, i) => `
            <div style="padding: 15px; border-bottom: 1px solid var(--border); display: flex; gap: 15px; transition: 0.2s; background:var(--bg);">
                <div style="font-size: 1.8rem; cursor: pointer;" onclick="executeNotificationAction('${a.id}')">${a.icon}</div>
                <div style="flex-grow: 1; text-align: left; cursor: pointer;" onclick="executeNotificationAction('${a.id}')">
                    <div style="font-weight: bold; color: ${a.color}; font-size: 0.95rem;">${a.title}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.3;">${a.text}</div>
                </div>
                <div style="display:flex; flex-direction:column; gap:5px; align-items:flex-end;">
                    <button class="secondary" title="Snooze for 1 Hour" style="font-size:0.7rem; padding: 2px 6px;" onclick="snoozeAlert('${a.id}', 60)">💤 1h</button>
                    <button class="secondary" title="Snooze for 1 Day" style="font-size:0.7rem; padding: 2px 6px;" onclick="snoozeAlert('${a.id}', 1440)">💤 1d</button>
                    <button class="danger" title="Dismiss" style="font-size:0.7rem; padding: 2px 6px; background:transparent; border:1px solid var(--danger); color:var(--danger);" onclick="dismissAlert('${a.id}')">✕</button>
                </div>
            </div>
        `).join('');
        
        window.currentNotificationActionsMap = {};
        activeAlerts.forEach(a => window.currentNotificationActionsMap[a.id] = a.action);
        
    } else {
        badge.style.display = 'none';
        list.innerHTML = `<div style="padding: 40px 20px; color: var(--text-muted); text-align: center;">✅ You are all caught up! No active alerts.</div>`;
    }
}

window.executeNotificationAction = function(id) {
    if (window.currentNotificationActionsMap && window.currentNotificationActionsMap[id]) {
        window.currentNotificationActionsMap[id]();
        toggleNotificationPanel();
    }
};

window.snoozeAlert = function(id, minutes) {
    window.snoozedAlerts[id] = Date.now() + (minutes * 60 * 1000);
    localStorage.setItem('jft_snoozed_alerts', JSON.stringify(window.snoozedAlerts));
    renderSystemNotifications();
    if(typeof Enterprise !== 'undefined') Enterprise.notify(`Alert snoozed for ${minutes < 60 ? minutes + ' mins' : (minutes/60) + ' hours'}`, "info");
};

window.dismissAlert = function(id) {
    window.dismissedAlerts[id] = true;
    localStorage.setItem('jft_dismissed_alerts', JSON.stringify(window.dismissedAlerts));
    renderSystemNotifications();
};

window.clearAllNotifications = function() {
    if(!confirm("Are you sure you want to permanently dismiss all current alerts?")) return;
    const list = document.getElementById('notification-list');
    const buttons = list.querySelectorAll('.danger');
    buttons.forEach(btn => btn.click());
};

setInterval(() => {
    if (typeof renderSystemNotifications === 'function' && sessionStorage.getItem('jft_role') !== 'buyer') {
        renderSystemNotifications();
    }
}, 30000);


/* ==========================================
   CALCULATOR MODULE WITH KEYBOARD BINDING
========================================== */

window.openCalculatorModal = function() {
    document.getElementById('calculator-overlay').classList.remove('hidden');
    const display = document.getElementById('calc-display');
    const history = document.getElementById('calc-history');
    if (display) display.value = '0';
    if (history) history.innerText = '';
};

window.closeCalculatorModal = function() {
    document.getElementById('calculator-overlay').classList.add('hidden');
};

window.calcInput = function(val) {
    const display = document.getElementById('calc-display');
    const history = document.getElementById('calc-history');
    if (!display) return;
    
    if (val === 'C') {
        display.value = '0';
        if(history) history.innerText = '';
    } else if (val === 'DEL') {
        display.value = display.value.length > 1 ? display.value.slice(0, -1) : '0';
    } else if (val === '=') {
        try {
            const expr = display.value;
            const result = new Function('return ' + expr)();
            const finalVal = Number.isInteger(result) ? result : parseFloat(result.toFixed(4));
            if(history) history.innerText = expr + ' =';
            display.value = finalVal;
        } catch (e) {
            display.value = 'Error';
            setTimeout(() => display.value = '0', 1000);
        }
    } else {
        if (display.value === '0' || display.value === 'Error') {
            display.value = val === '.' ? '0.' : val;
        } else {
            const parts = display.value.split(/[\+\-\*\/]/);
            const currentPart = parts[parts.length - 1];
            if (val === '.' && currentPart.includes('.')) return;
            display.value += val;
        }
    }
};


/* ==========================================
   ENTERPRISE NOTEPAD MODULE
========================================== */
window.activeNoteId = null;

window.initNotepad = function() {
    document.getElementById('notepad-overlay').classList.remove('hidden');
    loadNoteList();
    if (!window.activeNoteId && window.db && window.db.notes && window.db.notes.length > 0) {
        openNote(window.db.notes[0].id);
    } else if (!window.activeNoteId) {
        createNewNote();
    }
};

window.loadNoteList = function() {
    const list = document.getElementById('note-list');
    if (!list) return;
    if (!window.db || !window.db.notes || window.db.notes.length === 0) {
        list.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-muted);">No notes created yet.</div>`;
        return;
    }

    const sortedNotes = [...window.db.notes].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.date) - new Date(a.date);
    });

    list.innerHTML = sortedNotes.map(n => `
        <div class="note-list-item ${n.id === window.activeNoteId ? 'active' : ''}" onclick="openNote('${n.id}')">
            <div style="font-weight:bold; color:var(--text); font-size:0.95rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${n.pinned ? '📌 ' : ''}${escapeHTML(n.title || 'Untitled Note')}
            </div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:5px;">${new Date(n.date).toLocaleString()}</div>
        </div>
    `).join('');
};

window.createNewNote = function() {
    window.activeNoteId = 'NOTE_' + Date.now();
    document.getElementById('note-title').value = '';
    document.getElementById('note-body').value = '';
    document.getElementById('note-is-pinned').value = 'false';
    document.getElementById('btn-pin-note').style.opacity = '0.5';
    document.getElementById('note-date-display').innerText = new Date().toLocaleString();
    loadNoteList();
    document.getElementById('note-body').focus();
};

window.openNote = function(id) {
    if(!window.db || !window.db.notes) return;
    const note = window.db.notes.find(n => n.id === id);
    if (!note) return;
    window.activeNoteId = note.id;
    document.getElementById('note-title').value = note.title;
    document.getElementById('note-body').value = note.body;
    document.getElementById('note-is-pinned').value = note.pinned ? 'true' : 'false';
    document.getElementById('btn-pin-note').style.opacity = note.pinned ? '1' : '0.5';
    document.getElementById('note-date-display').innerText = new Date(note.date).toLocaleString();
    loadNoteList();
};

window.saveCurrentNote = function() {
    const id = window.activeNoteId;
    if (!id || !window.db || !window.db.notes) return;
    const title = document.getElementById('note-title').value.trim() || 'Untitled Note';
    const body = document.getElementById('note-body').value;
    const pinned = document.getElementById('note-is-pinned').value === 'true';

    const existingIndex = window.db.notes.findIndex(n => n.id === id);
    const noteData = { id, title, body, pinned, date: new Date().toISOString() };
    
    if (existingIndex > -1) window.db.notes[existingIndex] = noteData;
    else window.db.notes.push(noteData);
    
    if(typeof saveData === 'function') saveData(true);
    document.getElementById('note-date-display').innerText = new Date().toLocaleString() + ' (Saved)';
    loadNoteList();
};

window.deleteCurrentNote = function() {
    if (!window.activeNoteId || !window.db || !window.db.notes) return;
    if (!confirm("Are you sure you want to delete this note?")) return;
    window.db.notes = window.db.notes.filter(n => n.id !== window.activeNoteId);
    if(typeof saveData === 'function') saveData(true);
    window.activeNoteId = null;
    initNotepad();
};

window.togglePinNote = function() {
    const input = document.getElementById('note-is-pinned');
    const btn = document.getElementById('btn-pin-note');
    if (input.value === 'true') {
        input.value = 'false'; btn.style.opacity = '0.5';
    } else {
        input.value = 'true'; btn.style.opacity = '1';
    }
    saveCurrentNote();
};

document.getElementById('note-body')?.addEventListener('input', () => {
    if(window.notepadSaveTimeout) clearTimeout(window.notepadSaveTimeout);
    window.notepadSaveTimeout = setTimeout(saveCurrentNote, 1500);
});


/* ==========================================
   CORPORATE CALENDAR & EVENT MODULE
========================================== */

window.currentCalDate = new Date();

window.initCalendar = function() {
    document.getElementById('calendar-overlay').classList.remove('hidden');
    renderCalendarGrid();
    renderCalendarEvents();
};

window.renderCalendarGrid = function() {
    const grid = document.getElementById('calendar-grid');
    const monthYear = document.getElementById('calendar-month-year');
    if(!grid || !monthYear || !window.db || !window.db.events) return;

    const year = window.currentCalDate.getFullYear();
    const month = window.currentCalDate.getMonth();

    monthYear.innerText = new Date(year, month, 1).toLocaleDateString('en-US', {month: 'long', year: 'numeric'});

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let html = '';
    for(let i=0; i<firstDay; i++) {
        html += `<div style="padding:10px; opacity:0.1;"></div>`;
    }
    
    const today = new Date();
    
    for(let i=1; i<=daysInMonth; i++) {
        const isToday = today.getDate() === i && today.getMonth() === month && today.getFullYear() === year;
        
        const hasEvent = window.db.events.some(e => {
            const ed = new Date(e.date);
            return ed.getDate() === i && ed.getMonth() === month && ed.getFullYear() === year;
        });
        
        let style = `padding:10px; border-radius:4px; border:1px solid var(--border); position:relative; cursor:pointer; height:40px; display:flex; align-items:center; justify-content:center;`;
        if(isToday) style += `background:var(--primary); color:white; border-color:var(--primary); font-weight:bold;`;
        else style += `background:var(--surface); color:var(--text);`;

        let indicator = hasEvent ? `<div style="position:absolute; bottom:2px; left:50%; transform:translateX(-50%); width:6px; height:6px; background:${isToday?'white':'var(--danger)'}; border-radius:50%;"></div>` : '';

        html += `<div style="${style}">${i}${indicator}</div>`;
    }
    grid.innerHTML = html;
};

window.changeCalendarMonth = function(offset) {
    window.currentCalDate.setMonth(window.currentCalDate.getMonth() + offset);
    window.renderCalendarGrid();
};

window.saveCalendarEvent = function(e) {
    e.preventDefault();
    if(!window.db || !window.db.events) return;
    const title = document.getElementById('cal-title').value;
    const date = document.getElementById('cal-date').value;
    const type = document.getElementById('cal-type').value;
    const alertOffset = document.getElementById('cal-alert').value;
    
    window.db.events.push({
        id: 'EVT_' + Date.now(),
        title, date, type, alertOffset,
        notified: false
    });
    
    if(typeof saveData === 'function') saveData(true);
    e.target.reset();
    renderCalendarEvents();
    renderCalendarGrid(); 
    if(typeof Enterprise !== 'undefined') Enterprise.notify("Event Scheduled!", "success");
    checkCalendarAlerts();
};

window.renderCalendarEvents = function() {
    const list = document.getElementById('calendar-list-view');
    if (!list || !window.db || !window.db.events) return;
    
    const cleanDate = new Date();
    cleanDate.setDate(cleanDate.getDate() - 7);
    window.db.events = window.db.events.filter(e => new Date(e.date) > cleanDate);

    if (window.db.events.length === 0) {
        list.innerHTML = `<div style="padding:40px; text-align:center; color:var(--text-muted);">No upcoming events. Your schedule is clear!</div>`;
        return;
    }

    const sortedEvents = [...window.db.events].sort((a,b) => new Date(a.date) - new Date(b.date));
    
    list.innerHTML = sortedEvents.map(e => {
        const evDate = new Date(e.date);
        const isPast = evDate < new Date();
        
        let icon = '✅', color = 'var(--text)';
        if(e.type === 'Meeting') { icon = '🤝'; color = 'var(--primary)'; }
        if(e.type === 'Deadline') { icon = '⚠️'; color = 'var(--danger)'; }
        if(e.type === 'Holiday') { icon = '🎉'; color = 'var(--success)'; }

        return `
            <div class="card" style="margin-bottom:15px; padding: 15px; display:flex; gap:15px; align-items:center; opacity: ${isPast ? '0.5' : '1'}; border-left: 4px solid ${color};">
                <div style="font-size:2rem;">${icon}</div>
                <div style="flex-grow:1;">
                    <div style="font-weight:bold; font-size:1.1rem; color:${color};">${escapeHTML(e.title)}</div>
                    <div style="font-size:0.85rem; color:var(--text-muted); margin-top:5px;">
                        ${evDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
                <button class="danger" style="background:transparent; color:var(--danger); border:1px solid var(--danger); padding:4px 8px; font-size:0.8rem;" onclick="deleteCalendarEvent('${e.id}')">Delete</button>
            </div>
        `;
    }).join('');
};

window.deleteCalendarEvent = function(id) {
    if(!window.db || !window.db.events) return;
    if(!confirm("Remove this event from schedule?")) return;
    window.db.events = window.db.events.filter(e => e.id !== id);
    if(typeof saveData === 'function') saveData(true);
    renderCalendarEvents();
    renderCalendarGrid(); 
    checkCalendarAlerts();
};

window.checkCalendarAlerts = function() {
    if (!window.db || !window.db.events) return;
    const now = Date.now();
    let pendingCount = 0;
    
    window.db.events.forEach(e => {
        if (e.alertOffset === 'none') return;
        
        const evTime = new Date(e.date).getTime();
        const alertTime = evTime - (parseInt(e.alertOffset) * 60 * 1000);
        
        if (now >= alertTime && now <= evTime + (60*60*1000)) {
            pendingCount++;
            
            if (!e.notified) {
                const msg = e.alertOffset === "0" ? `Event Starting Now: ${e.title}` : `Upcoming ${e.type}: ${e.title}`;
                
                const alertId = `cal-${e.id}`;
                if (!window.dismissedAlerts[alertId]) {
                    if(typeof Enterprise !== 'undefined') Enterprise.notify(msg, "warning");
                    if (e.type === 'Deadline') toggleNotificationPanel();
                }
                e.notified = true; 
                if(typeof saveData === 'function') saveData(true);
            }
        }
    });

    const badge = document.getElementById('calendar-badge');
    if (badge) {
        if (pendingCount > 0) {
            badge.style.display = 'flex';
            badge.innerText = pendingCount;
        } else {
            badge.style.display = 'none';
        }
    }
};


/* ==========================================
   GLOBAL BUSINESS CLOCK MODULE
========================================== */

const AVAILABLE_TIMEZONES = [
    { id: 'America/New_York', name: '🇺🇸 USA (New York/EST)' },
    { id: 'America/Chicago', name: '🇺🇸 USA (Chicago/CST)' },
    { id: 'America/Denver', name: '🇺🇸 USA (Denver/MST)' },
    { id: 'America/Los_Angeles', name: '🇺🇸 USA (Los Angeles/PST)' },
    { id: 'Europe/London', name: '🇬🇧 UK (London)' },
    { id: 'Europe/Paris', name: '🇫🇷 France (Paris)' },
    { id: 'Europe/Berlin', name: '🇩🇪 Germany (Berlin)' },
    { id: 'Asia/Dubai', name: '🇦🇪 UAE (Dubai)' },
    { id: 'Asia/Kolkata', name: '🇮🇳 India (IST)' },
    { id: 'Asia/Singapore', name: '🇸🇬 Singapore' },
    { id: 'Asia/Hong_Kong', name: '🇭🇰 Hong Kong' },
    { id: 'Asia/Tokyo', name: '🇯🇵 Japan (Tokyo)' },
    { id: 'Australia/Sydney', name: '🇦🇺 Australia (Sydney)' }
];

window.clockInterval = null;

window.openWorldClockModal = function() {
    document.getElementById('clock-overlay').classList.remove('hidden');
    window.filterClockDropdown(); 
    renderWorldClocks();
    window.clockInterval = setInterval(renderWorldClocks, 1000);
};

window.closeWorldClockModal = function() {
    document.getElementById('clock-overlay').classList.add('hidden');
    if (window.clockInterval) clearInterval(window.clockInterval);
};

window.filterClockDropdown = function() {
    const query = (document.getElementById('clock-search')?.value || '').toLowerCase();
    const select = document.getElementById('clock-country-select');
    if(!select) return;
    
    select.innerHTML = AVAILABLE_TIMEZONES
        .filter(tz => tz.name.toLowerCase().includes(query) || tz.id.toLowerCase().includes(query))
        .map(tz => `<option value="${tz.id}">${tz.name}</option>`)
        .join('');
};

window.addWorldClock = function() {
    if (!window.db || !window.db.clocks) return;
    if (window.db.clocks.length >= 10) return alert("Maximum 10 clocks allowed on dashboard.");
    const tz = document.getElementById('clock-country-select').value;
    if(!tz) return;
    if (window.db.clocks.includes(tz)) return alert("This timezone is already on your dashboard.");
    
    window.db.clocks.push(tz);
    if(typeof saveData === 'function') saveData(true);
    renderWorldClocks();
};

window.removeWorldClock = function(tz) {
    if (!window.db || !window.db.clocks) return;
    window.db.clocks = window.db.clocks.filter(c => c !== tz);
    if(typeof saveData === 'function') saveData(true);
    renderWorldClocks();
};

window.renderWorldClocks = function() {
    const container = document.getElementById('world-clock-container');
    if (!container) return;
    
    if (!window.db || !window.db.clocks || window.db.clocks.length === 0) {
        container.innerHTML = `<div style="grid-column: span 4; text-align:center; padding:40px; color:var(--text-muted);">No clocks added. Search and select a country above.</div>`;
        return;
    }

    const now = new Date();
    
    container.innerHTML = window.db.clocks.map(tz => {
        const config = AVAILABLE_TIMEZONES.find(t => t.id === tz) || { name: tz };
        
        let timeStr = "Error", dateStr = "Error";
        try {
            timeStr = now.toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', minute:'2-digit', second:'2-digit', hour12: true });
            dateStr = now.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' });
        } catch(e) { timeStr = "Invalid TZ"; }

        return `
            <div class="clock-card">
                <button class="danger" style="position:absolute; top:5px; right:5px; width:24px; height:24px; padding:0; border-radius:50%; font-size:0.7rem; background:transparent; color:var(--text-muted); border:1px solid var(--border);" onclick="removeWorldClock('${tz}')" title="Remove">✕</button>
                <div style="font-weight:bold; color:var(--text); margin-bottom:10px; font-size:0.9rem;">${config.name}</div>
                <div class="clock-time">${timeStr}</div>
                <div class="clock-date">${dateStr}</div>
            </div>
        `;
    }).join('');
};


/* --- SPOTLIGHT COMMAND PALETTE & KEYBOARD ACTIONS (PRO) --- */
let activeGlobalSearchResults = [];
let highlightedIndex = 0;

function toggleCommandPalette() {
    if(sessionStorage.getItem('jft_role') === 'buyer') return; 
    const cp = document.getElementById('command-palette-overlay');
    const input = document.getElementById('cp-input');
    if (!cp) return;
    
    if (cp.style.display === 'none' || cp.classList.contains('hidden')) {
        cp.style.display = 'flex'; cp.classList.remove('hidden');
        highlightedIndex = 0;
        if(input) { 
            input.value = ''; 
            resultsInPalette(""); // Triggers Recent Activity
            setTimeout(() => input.focus(), 50); 
        }
    } else {
        cp.style.display = 'none'; cp.classList.add('hidden');
    }
}

function resultsInPalette(query) {
    const results = document.getElementById('cp-results');
    if(!results || !window.db) return;

    activeGlobalSearchResults = [];
    const q = (query || '').toLowerCase().trim();

    // 1. EMPTY QUERY: SHOW RECENT ACTIVITY
    if (q === '') {
        // Fetch last 6 items from all major arrays
        const recents = [];
        const addRecents = (arr, icon, titleField, type, exec) => {
            if(window.db[arr]) {
                window.db[arr].slice(-3).reverse().forEach(item => {
                    recents.push({ 
                        type: `Recent ${type}`, 
                        title: typeof titleField === 'function' ? titleField(item) : item[titleField], 
                        icon, 
                        execute: () => exec(item) 
                    });
                });
            }
        };

        addRecents('docs', '📄', i => i.no, 'Document', i => { showTab('documents'); setTimeout(() => { if(typeof editDoc==='function') editDoc(i.id); }, 100); });
        addRecents('log_containers', '🛳️', i => i.no, 'Container', i => { showTab('logistics'); setTimeout(() => { if(typeof switchLogisticsTab==='function') switchLogisticsTab('container'); }, 100); });
        
        activeGlobalSearchResults = recents;
        renderPaletteItems('⚡ RECENT ACTIVITY');
        return;
    }

    // 2. SEARCH LOGIC (CATEGORY GROUPING)
    const searchDb = (arrayName, icon, titleField, typePrefix, executeFn) => {
        if (window.db[arrayName]) {
            const matches = window.db[arrayName].filter(item => {
                const searchStr = JSON.stringify(item).toLowerCase();
                return searchStr.includes(q);
            }).slice(0, 8);

            matches.forEach(item => {
                let displayTitle = (typeof titleField === 'function') ? titleField(item) : (item[titleField] || "Record");
                activeGlobalSearchResults.push({
                    type: typePrefix, title: displayTitle, icon: icon, 
                    execute: () => executeFn(item)
                });
            });
        }
    };

    // Module Commands first
    APP_COMMANDS.filter(cmd => cmd.keywords.some(kw => kw.toLowerCase().includes(q)) || cmd.title.toLowerCase().includes(q))
        .forEach(a => activeGlobalSearchResults.push({ type: 'Quick Action', title: a.title, icon: '⚡', execute: a.action }));

    // Deep DB Items
    searchDb('docs', '📄', item => `${item.no} - ${item.buyer ? item.buyer.split('\n')[0] : 'Unknown'}`, 'Document', item => {
        showTab('documents'); setTimeout(() => { if(typeof editDoc === 'function') editDoc(item.id); }, 200);
    });
    searchDb('inventory', '📦', item => `${item.name} (${item.currentQty} ${item.unit})`, 'Stock', item => { showTab('inventory'); });
    searchDb('log_containers', '🛳️', item => `Cont: ${item.no} (${item.vessel || 'No Vessel'})`, 'Logistics', item => {
        showTab('logistics'); setTimeout(() => { if(typeof switchLogisticsTab==='function') switchLogisticsTab('container'); }, 100);
    });
    searchDb('expenses', '🧾', item => `${item.party} - ₹${item.total}`, 'Finance', item => {
        showTab('finance'); setTimeout(() => { if(typeof switchFinanceTab==='function') switchFinanceTab('exp'); }, 100);
    });

    if (activeGlobalSearchResults.length === 0) {
        results.innerHTML = `<div style="padding:40px; color:var(--text-muted); text-align:center;">No cloud records match "<b>${window.escapeHTML(query)}</b>"</div>`;
        return;
    }

    renderPaletteItems('🔍 SEARCH RESULTS');
}

// Global filter wrapper for input
window.filterCommands = function() {
    const q = document.getElementById('cp-input').value;
    highlightedIndex = 0;
    resultsInPalette(q);
};

function renderPaletteItems(header) {
    const results = document.getElementById('cp-results');
    if(!results) return;

    let html = header ? `<div style="padding: 10px 15px; font-size: 0.65rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; border-bottom: 1px solid var(--border); background: rgba(0,0,0,0.02);">${header}</div>` : '';

    html += activeGlobalSearchResults.slice(0, 15).map((item, index) => `
        <div class="cp-item ${index === highlightedIndex ? 'selected' : ''}" onclick="executeGlobalCommand(${index})">
            <div class="cp-icon">${item.icon}</div>
            <div class="cp-details">
                <div class="cp-type">${item.type}</div>
                <div class="cp-title">${window.escapeHTML(item.title)}</div>
            </div>
            <div class="cp-shortcut">${index === highlightedIndex ? 'ENTER ↵' : ''}</div>
        </div>
    `).join('');
    
    results.innerHTML = html;
    
    // Auto-scroll to highlighted item
    const selected = results.querySelector('.cp-item.selected');
    if (selected) {
        selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}


// --- POWER-USER KEYBOARD CONTROLLER (GLOBAL) ---
document.addEventListener('keydown', function(e) {
    // 1. Global Command Palette Trigger (Ctrl+K / Cmd+K)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (typeof toggleCommandPalette === 'function') toggleCommandPalette();
        return;
    }

    // 2. Tab Switching Shortcuts (Alt + 1-9)
    if (e.altKey && e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key) - 1;
        if (NAV_TREE[index]) {
            e.preventDefault();
            showTab(NAV_TREE[index].id);
            showToast(`Switched to ${NAV_TREE[index].label}`, 'info', 1000);
        }
        return;
    }

    // 3. Global Escape Handler (Close all floating UI)
    if (e.key === 'Escape') {
        let closedCount = 0;

        // Command Palette
        const cp = document.getElementById('command-palette-overlay');
        if (cp && !cp.classList.contains('hidden')) { toggleCommandPalette(); closedCount++; }

        // Calculator
        const calc = document.getElementById('calculator-overlay');
        if (calc && !calc.classList.contains('hidden')) { 
            if(typeof openCalculatorModal === 'function') openCalculatorModal(); 
            else { calc.classList.add('hidden'); calc.style.display = 'none'; }
            closedCount++; 
        }

        // Notepad
        const note = document.getElementById('notepad-overlay');
        if (note && !note.classList.contains('hidden')) { note.classList.add('hidden'); closedCount++; }

        // Mail
        const mail = document.getElementById('mail-overlay');
        if (mail && !mail.classList.contains('hidden')) { mail.classList.add('hidden'); closedCount++; }
        
        // Notifications
        const notif = document.getElementById('notification-panel');
        if (notif && !notif.classList.contains('hidden')) { 
            if (typeof toggleNotificationPanel === 'function') toggleNotificationPanel();
            else { notif.classList.add('hidden'); notif.style.display = 'none'; }
            closedCount++; 
        }

        // Profile Dropdown
        const profile = document.getElementById('profile-dropdown');
        if (profile && !profile.classList.contains('hidden')) { 
            if (typeof toggleProfileMenu === 'function') toggleProfileMenu();
            else { profile.classList.add('hidden'); profile.style.display = 'none'; }
            closedCount++; 
        }

        // Search Results / Other Overlays
        document.querySelectorAll('.modal-overlay').forEach(m => {
            if (!m.classList.contains('hidden')) { m.classList.add('hidden'); m.style.display = 'none'; closedCount++; }
        });

        if (closedCount > 0) {
            e.preventDefault();
            // Refocus main app to prevent keyboard "dead-zones"
            document.body.focus();
        }
    }

    // 4. Ctrl+S Save Handling (Documents & Global Sync)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const editor = document.getElementById('doc-editor');
        if (editor && !editor.classList.contains('hidden')) {
            if (typeof saveCurrentDoc === 'function') saveCurrentDoc();
        } else {
            if (typeof window.forceSync === 'function') {
                window.forceSync();
                showToast('Cloud Sync Triggered', 'success', 2000);
            }
        }
        return;
    }

    // 5. Calculator Key Mapping
    const calcOverlay = document.getElementById('calculator-overlay');
    if (calcOverlay && !calcOverlay.classList.contains('hidden')) {
        const keyMap = {
            '0': '0', '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
            '+': '+', '-': '-', '*': '*', '/': '/', '.': '.',
            'Enter': '=', 'Backspace': 'DEL', 'Escape': 'C', 'Delete': 'C', '=': '='
        };
        if (keyMap[e.key] !== undefined) {
            e.preventDefault(); 
            if(typeof calcInput === 'function') calcInput(keyMap[e.key]);
        }
    }
});

// --- MOBILE KEYBOARD & INPUT OPTIMIZATION (Dynamic Heuristic) ---
document.addEventListener('focusin', function(e) {
    if (e.target && e.target.tagName === 'INPUT') {
        const t = e.target.type.toLowerCase();
        const id = (e.target.id || '').toLowerCase();
        const placeholder = (e.target.placeholder || '').toLowerCase();
        
        if (!e.target.hasAttribute('inputmode')) {
            if (t === 'number' || id.includes('amount') || id.includes('price') || id.includes('cost') || id.includes('rate') || id.includes('total') || id.includes('qty') || placeholder.includes('amount') || placeholder.includes('price')) {
                e.target.setAttribute('inputmode', 'decimal');
            }
        }
    }
});

/* --- AUTO-MINIMIZE FLOATING BOXES (Click Outside Logic) --- */
window.addEventListener('mousedown', function(e) {
    // 1. Command Palette Closing
    const cpOverlay = document.getElementById('command-palette-overlay');
    if (cpOverlay && !cpOverlay.classList.contains('hidden')) {
        const box = cpOverlay.querySelector('.spotlight-box');
        if (box && !box.contains(e.target)) {
            toggleCommandPalette();
        }
    }

    // 2. Notification Panel Closing
    const notifPanel = document.getElementById('notification-panel');
    if (notifPanel && !notifPanel.classList.contains('hidden')) {
        const btn = document.querySelector('[onclick*="toggleNotificationPanel"]');
        if (!notifPanel.contains(e.target) && (!btn || !btn.contains(e.target))) {
            if (typeof toggleNotificationPanel === 'function') toggleNotificationPanel();
            else { notifPanel.classList.add('hidden'); notifPanel.style.display = 'none'; }
        }
    }

    // 3. Profile Dropdown Closing
    const profileDD = document.getElementById('profile-dropdown');
    if (profileDD && !profileDD.classList.contains('hidden')) {
        const btn = document.querySelector('.user-profile-btn');
        if (!profileDD.contains(e.target) && (!btn || !btn.contains(e.target))) {
            if (typeof toggleProfileMenu === 'function') toggleProfileMenu();
            else { profileDD.classList.add('hidden'); profileDD.style.display = 'none'; }
        }
    }
});
