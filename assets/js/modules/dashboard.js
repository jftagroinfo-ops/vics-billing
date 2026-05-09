/* --- ADVANCED EXECUTIVE COMMAND CENTER DASHBOARD v9.0 (PROD-READY) --- */

let dashPerformanceChart = null;
let currentLeaderboardType = 'buyers';

// Pagination States
let dashCompliancePage = 0;
let dashUnpaidExportPage = 0;
let dashUnpaidImportPage = 0;
let dashUnpaidExpensePage = 0;
const RADAR_PAGE_SIZE = 5;

function initDashboardSystem() {
    if (typeof db === 'undefined') {
        setTimeout(initDashboardSystem, 100);
        return;
    }
    startDashboardWatchdog();
}
initDashboardSystem();

let _lastDashSyncHash = "";

function startDashboardWatchdog() {
    setInterval(() => {
        if (typeof db === 'undefined') return;
        const activeTab = document.querySelector('.nav-item.active')?.id || '';
        if (activeTab !== 'nav-dashboard') return;

        const currentHash = `${(db.docs||[]).length}-${(db.imports||[]).length}-${(db.import_expenses||[]).length}-${(db.expenses||[]).length}-${(db.tasks||[]).length}-${(db.events||[]).length}-${(db.import_manual_pnl||[]).length}`;
        if (currentHash !== _lastDashSyncHash) {
            _lastDashSyncHash = currentHash;
            renderDashboard();
        }
    }, 4000);

    setInterval(() => {
        const el = document.getElementById('dash-live-clock');
        if (el) el.innerText = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
    }, 1000);
}

window.renderDashboard = function() {
    const currentRole = sessionStorage.getItem('jft_role') || 'viewer';
    const adminView = document.getElementById('admin-dashboard-view');
    const buyerView = document.getElementById('buyer-dashboard-view');

    if (currentRole === 'buyer') {
        if(adminView) adminView.classList.add('hidden');
        if(buyerView) buyerView.classList.remove('hidden');
        renderBuyerPortal();
    } else {
        if(adminView) adminView.classList.remove('hidden');
        if(buyerView) buyerView.classList.add('hidden');
        renderOperationalDashboard();
        if (typeof fetchLiveForexRates === 'function') fetchLiveForexRates();
    }
};

function renderOperationalDashboard() {
    if (!db.docs) return;
    const currentYear = new Date().getFullYear();
    const liveRate = (typeof getUsdInrRate === 'function') ? getUsdInrRate() : (db.meta?.usdInrRate || 84.50);

    // Show/hide "Estimated Rate" warning badge on the dashboard forex panel
    const offlineBadge = document.getElementById('dash-offline-rate-badge');
    if (offlineBadge) {
        if (window._usingFallbackRate) {
            offlineBadge.style.display = 'flex';
            offlineBadge.title = `Using estimated fallback rate of ₹${liveRate}. Live fetch unavailable or no rate saved in Settings → Meta.`;
        } else {
            offlineBadge.style.display = 'none';
        }
    }

    // --- KPI ACCUMULATORS (HIGH-FIDELITY BUSINESS LOGIC) ---
    let exportProfitYTD = 0;
    let importProfitYTD = 0;
    let activeExportShips = 0;
    let activeImportShips = 0;

    // A. Export Realization Logic
    (db.docs || []).forEach(d => {
        if(d.type !== 'Commercial Invoice' || d.status === 'Cancelled') return;
        const totalUSD = parseFloat(d.total || d.cifTotal || 0);
        
        // Use realized rate from finance if available, else liveRate
        const finEntry = (db.forex || []).find(f => f.invoiceId === d.id);
        const realizedRate = finEntry ? parseFloat(finEntry.rate || liveRate) : liveRate;
        const revenueINR = totalUSD * realizedRate;
        
        if(new Date(d.date).getFullYear() === currentYear) {
            const costing = (db.costings || []).find(c => c.id === d.costingId || (c.refNo && d.invoiceNo && c.refNo.includes(d.invoiceNo)));
            const materialCostINR = costing ? (parseFloat(costing.fobTarget || costing.totalCost || 0)) : (revenueINR * 0.82); // 18% default margin if no costing
            const shipExps = (db.expenses || []).filter(e => e.shipId === d.id).reduce((s,e) => s + parseFloat(e.total || 0), 0);
            exportProfitYTD += (revenueINR - materialCostINR - shipExps);
        }
        if(['Sent', 'Shipped', 'Pending'].includes(d.status)) activeExportShips++;
    });

    // B. Import Realization Logic (Weighted Average Rate)
    (db.imports || []).forEach(i => {
        const pms = (db.import_payments || []).filter(p => p.importId === i.id);
        const paidFCY = pms.reduce((s,p) => s + parseFloat(p.fcy || 0), 0);
        const paidINR = pms.reduce((s,p) => s + (parseFloat(p.fcy || 0) * parseFloat(p.rate || 0)), 0);
        const waccRate = paidFCY > 0 ? (paidINR / paidFCY) : liveRate;
        
        const cifINR = parseFloat(i.val || 0) * waccRate;
        
        if(new Date(i.timestamp).getFullYear() === currentYear) {
            const manual = (db.import_manual_pnl || []).find(m => m.shipId === i.id);
            const saleValue = manual ? parseFloat(manual.saleValue || 0) : 0;
            const impExps = (db.import_expenses || []).filter(e => e.ref === i.ref).reduce((s,e) => s + (parseFloat(e.amt || 0) + parseFloat(e.gst||0) - parseFloat(e.tds||0)), 0);
            if(saleValue > 0) importProfitYTD += (saleValue - cifINR - impExps);
        }
        if(!['Delivered', 'Closed', 'Cancelled'].includes(i.status)) activeImportShips++;
    });

    const netProfitINR = exportProfitYTD + importProfitYTD;
    const lcExposureUSD = (db.lcs || []).filter(l => !['Settled','Expired'].includes(l.status)).reduce((s,l) => s + parseFloat(l.amount || 0), 0);

    // AI LIQUIDITY CALCULATION
    let projLiquidity = "Scanning...";
    if(typeof calc90DayAIProjection === 'function') {
        const projection = calc90DayAIProjection();
        const finalBalance = projection[projection.length - 1].balance;
        projLiquidity = `₹ ${(finalBalance/100000).toFixed(2)} L`;
    }

    const setV = (id, v) => { const el = document.getElementById(id); if(el) el.innerText = v; };
    setV('dash-kpi-rev', `₹ ${(exportProfitYTD/100000).toFixed(2)} L`);
    setV('dash-kpi-imp-spend', `₹ ${(importProfitYTD/100000).toFixed(2)} L`);
    setV('dash-kpi-logistics', `${activeExportShips + activeImportShips} Units`); // Updated ID to match new dashboard
    setV('dash-kpi-net', `₹ ${(netProfitINR/100000).toFixed(2)} L`);
    setV('dash-kpi-lc', `$ ${(lcExposureUSD/1000).toFixed(1)} K`);
    setV('dash-kpi-liquidity', projLiquidity);

    renderProfitLeakageAudit();
    renderPerformanceChart(liveRate);
    renderLeaderboard();
    renderComplianceRadarTable();
    renderUnpaidExportRadarTable(liveRate);
    renderUnpaidImportRadarTable();
    renderUnpaidExpenseRadarTable();
    renderStuckWorkflow();
    renderDashCalendarEvents();
    renderSystemPulse();
}

function renderSystemPulse() {
    const pulseContainer = document.getElementById('dash-system-pulse-container');
    if (!pulseContainer) return;

    const activities = [];

    // 1. Recent Invoices
    if (db.docs) {
        db.docs.slice(-5).reverse().forEach(inv => {
            activities.push({
                type: 'Document',
                id: inv.id,
                title: inv.no || 'New Invoice',
                subtitle: inv.buyer ? inv.buyer.split('\n')[0] : 'Draft',
                icon: '📄',
                color: 'var(--success)',
                action: () => { showTab('documents'); setTimeout(() => { if(typeof editDoc==='function') editDoc(inv.id); }, 150); }
            });
        });
    }

    // 2. Recent Imports/Logistics
    if (db.imports) {
        db.imports.slice(-3).reverse().forEach(imp => {
            activities.push({
                type: 'Logistics',
                id: imp.id,
                title: imp.ref || 'Shipment',
                subtitle: imp.supplier || 'Unknown Supplier',
                icon: '🛳️',
                color: 'var(--primary)',
                action: () => { showTab('logistics'); setTimeout(() => { if(typeof switchLogisticsTab==='function') switchLogisticsTab('container'); }, 150); }
            });
        });
    }

    if (activities.length === 0) {
        pulseContainer.innerHTML = '<div style="padding:20px; color:var(--text-muted);">No activity recorded yet.</div>';
        return;
    }

    pulseContainer.innerHTML = activities.map(act => `
        <div class="card" onclick="window.jumpToRecord('${act.type}', '${act.id}')" style="min-width: 200px; flex-shrink: 0; padding: 12px; cursor: pointer; border: 1px solid var(--border); transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); background: rgba(var(--surface-rgb), 0.5); backdrop-filter: blur(8px);">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom: 8px;">
                <div style="width:30px; height:30px; border-radius:8px; background: ${act.color}; color:white; display:flex; align-items:center; justify-content:center; font-size:1rem;">${act.icon}</div>
                <div style="font-size:0.65rem; font-weight:800; color:var(--text-muted); text-transform:uppercase;">${act.type}</div>
            </div>
            <div style="font-size: 0.9rem; font-weight: 700; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${act.title}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top:2px;">${act.subtitle}</div>
        </div>
    `).join('');
}

function renderProfitLeakageAudit() {
    const leakEl = document.getElementById('dash-kpi-leakage');
    const leakSubEl = document.getElementById('dash-kpi-leakage-sub');
    if (!leakEl || !db.docs) return;

    let leakageCount = 0;
    let totalDeviation = 0;

    (db.docs || []).filter(d => d.type === 'Commercial Invoice' && d.status !== 'Cancelled').forEach(doc => {
        if (typeof window.auditShipmentMargin === 'function') {
            const audit = window.auditShipmentMargin(doc.id);
            if (audit.status === 'Leakage') {
                leakageCount++;
                // Extract number from tip if possible, or just increment
                totalDeviation += 1; 
            }
        }
    });

    leakEl.innerText = leakageCount;
    if (leakSubEl) {
        if (leakageCount > 0) {
            leakSubEl.innerText = `${leakageCount} Shipments over budget`;
            leakSubEl.style.color = 'var(--danger)';
            leakEl.style.color = 'var(--danger)';
        } else {
            leakSubEl.innerText = 'All costs within targets';
            leakSubEl.style.color = 'var(--success)';
            leakEl.style.color = 'var(--success)';
        }
    }
}

window.jumpToRecord = function(type, id) {
    if (type === 'Document') {
        showTab('documents');
        setTimeout(() => { if(typeof editDoc==='function') editDoc(id); }, 200);
    } else if (type === 'Logistics') {
        showTab('logistics');
        setTimeout(() => { if(typeof switchLogisticsTab==='function') switchLogisticsTab('container'); }, 200);
    }
};

function renderPerformanceChart(rate) {
    const ctx = document.getElementById('dash-performance-chart');
    if(!ctx) return;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const revData = new Array(12).fill(0);
    const expData = new Array(12).fill(0);
    const currentYear = new Date().getFullYear();
    (db.docs || []).filter(d => d.type==='Commercial Invoice').forEach(d => {
        const dt = new Date(d.date);
        if(dt.getFullYear() === currentYear) revData[dt.getMonth()] += (parseFloat(d.total || 0) * (d.currency === 'USD' ? rate : 1))/100000;
    });
    (db.expenses || []).forEach(e => {
        const dt = new Date(e.date);
        if(dt.getFullYear() === currentYear) expData[dt.getMonth()] += parseFloat(e.total || 0)/100000;
    });
    if (dashPerformanceChart) dashPerformanceChart.destroy();
    dashPerformanceChart = new Chart(ctx, { type: 'line', data: { labels: months, datasets: [ { label: 'Revenue (L)', data: revData, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.4 }, { label: 'Expenses (L)', data: expData, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: true, tension: 0.4 } ] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } } });
}

// --- RADAR NAVIGATION ---
window.changeDashCompliancePage = (d) => { dashCompliancePage = Math.max(0, dashCompliancePage + d); renderOperationalDashboard(); };
window.changeDashUnpaidExportPage = (d) => { dashUnpaidExportPage = Math.max(0, dashUnpaidExportPage + d); renderOperationalDashboard(); };
window.changeDashUnpaidImportPage = (d) => { dashUnpaidImportPage = Math.max(0, dashUnpaidImportPage + d); renderOperationalDashboard(); };
window.changeDashUnpaidExpensePage = (d) => { dashUnpaidExpensePage = Math.max(0, dashUnpaidExpensePage + d); renderOperationalDashboard(); };

const calcAging = (date) => {
    if(!date) return 0;
    const diff = new Date() - new Date(date);
    return Math.floor(diff / (86400000));
};

function renderComplianceRadarTable() {
    const list = document.getElementById('dash-compliance-list');
    if(!list || !db.exporter_data) return;
    let items = [...(db.exporter_data || [])].sort((a,b) => new Date(a.expiryDate) - new Date(b.expiryDate));
    const start = dashCompliancePage * RADAR_PAGE_SIZE;
    items = items.slice(start, start + RADAR_PAGE_SIZE);
    list.innerHTML = `<table class="modern-table" style="width:100%; font-size:0.7rem;"><thead><tr><th>Document</th><th>Expiry</th><th style="text-align:right;">Status</th></tr></thead><tbody>${items.map(d => {
        const left = Math.floor((new Date(d.expiryDate) - new Date()) / 86400000);
        return `<tr><td style="padding:6px 0;"><b>${d.name}</b></td><td>${d.expiryDate}</td><td style="text-align:right; color:${left<30?'red':'green'}; font-weight:800;">${left}d</td></tr>`;
    }).join('')}</tbody></table>`;
}

function renderUnpaidExportRadarTable(rate) {
    const list = document.getElementById('dash-unpaid-export-radar');
    if(!list) return;
    let items = (db.docs || []).filter(d => d.type==='Commercial Invoice' && d.status !== 'Paid').sort((a,b) => new Date(a.date) - new Date(b.date));
    const start = dashUnpaidExportPage * RADAR_PAGE_SIZE;
    items = items.slice(start, start + RADAR_PAGE_SIZE);
    list.innerHTML = `<table class="modern-table" style="width:100%; font-size:0.7rem;"><thead><tr><th>Buyer Name</th><th>Invoice #</th><th>Amount ($)</th><th>Aging</th></tr></thead><tbody>${items.map(d => {
        const valUSD = (d.currency==='USD') ? parseFloat(d.total || 0) : (parseFloat(d.total || 0) / rate);
        return `<tr><td style="padding:6px 0; max-width:80px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"><b>${d.consignee?.split('\n')[0]}</b></td><td>${d.invoiceNo}</td><td style="font-weight:700;">$${valUSD.toLocaleString()}</td><td style="color:red;">${calcAging(d.date)}d</td></tr>`;
    }).join('')}</tbody></table>` || '<p style="text-align:center; padding:10px;">Clear. ✅</p>';
}

function renderUnpaidImportRadarTable() {
    const list = document.getElementById('dash-unpaid-import-radar');
    if(!list) return;
    let items = (db.imports || []).map(i => {
        const total = parseFloat(i.val || 0);
        const paid = (db.import_payments || []).filter(p => p.importId === i.id).reduce((s,p) => s + parseFloat(p.fcy || 0), 0);
        return { ...i, balance: total - paid };
    }).filter(i => i.balance > 0.01).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    const start = dashUnpaidImportPage * RADAR_PAGE_SIZE;
    items = items.slice(start, start + RADAR_PAGE_SIZE);
    list.innerHTML = `<table class="modern-table" style="width:100%; font-size:0.7rem;"><thead><tr><th>Supplier</th><th>Ref/OBL</th><th>Amount ($)</th><th>Aging</th></tr></thead><tbody>${items.map(i => `<tr><td style="padding:6px 0;"><b>${i.supplier}</b></td><td>${i.ref || 'NA'}</td><td style="font-weight:700;">$${i.balance.toLocaleString()}</td><td style="color:red;">${calcAging(i.timestamp)}d</td></tr>`).join('')}</tbody></table>` || '<p style="text-align:center; padding:10px;">Clear. ✅</p>';
}

function renderUnpaidExpenseRadarTable() {
    const list = document.getElementById('dash-unpaid-expense-radar');
    if(!list) return;
    const combined = [
        ...(db.expenses || []).filter(e => e.status !== 'Paid').map(e => ({ name: e.desc || 'Exp', inv: e.refNo || '--', am: e.total, date: e.date, color: '#f59e0b' })),
        ...(db.import_expenses || []).filter(e => e.status !== 'Paid').map(e => ({ name: e.head || 'Imp Exp', inv: e.invoiceNo || '--', am: (parseFloat(e.amt||0)+parseFloat(e.gst||0)-parseFloat(e.tds||0)), date: e.date, color: '#ef4444' }))
    ].sort((a,b) => new Date(a.date) - new Date(b.date));
    let items = combined.slice(dashUnpaidExpensePage * RADAR_PAGE_SIZE, (dashUnpaidExpensePage+1) * RADAR_PAGE_SIZE);
    list.innerHTML = `<table class="modern-table" style="width:100%; font-size:0.7rem;"><thead><tr><th>Vendor/Head</th><th>Bill #</th><th>Amount (₹)</th><th>Aging</th></tr></thead><tbody>${items.map(e => `<tr><td style="padding:6px 0;"><b>${e.name}</b></td><td>${e.inv}</td><td>₹${parseFloat(e.am).toLocaleString()}</td><td style="color:red;">${calcAging(e.date)}d</td></tr>`).join('')}</tbody></table>` || '<p style="text-align:center; padding:10px;">Clear. ✅</p>';
}

function renderLeaderboard() {
    const tbody = document.getElementById('dash-leaderboard-tbody');
    if(!tbody) return;
    let data = {};
    const type = currentLeaderboardType;
    if(type === 'buyers') {
        (db.docs || []).filter(d => d.type==='Commercial Invoice').forEach(d => {
            const name = d.buyer.split('\n')[0].trim();
            if(!data[name]) data[name] = { count: 0, val: 0 };
            data[name].count++; data[name].val += parseFloat(d.total || 0);
        });
    } else {
        (db.imports || []).forEach(i => {
            const name = i.supplier || 'Unknown Supplier';
            if(!data[name]) data[name] = { count: 0, val: 0 };
            data[name].count++; data[name].val += parseFloat(i.val || 0);
        });
    }
    const sorted = Object.entries(data).sort((a,b) => b[1].val - a[1].val).slice(0, 5);
    tbody.innerHTML = sorted.map(([name, d]) => `<tr><td style="padding:6px 0;"><b>${name}</b></td><td style="text-align:center;">${d.count}</td><td style="text-align:right; font-weight:700;">$${d.val.toLocaleString()}</td></tr>`).join('');
}

function renderDashCalendarEvents() {
    const cont = document.getElementById('dash-calendar-events');
    if(!cont) return;
    const today = new Date().toISOString().split('T')[0];
    const events = (db.events || []).filter(e => e.date >= today).slice(0, 4);
    cont.innerHTML = events.map(e => `<div style="padding:8px; background:rgba(59,130,246,0.05); border-left:4px solid var(--primary); margin-bottom:8px; font-size:0.8rem;"><b>${e.date}</b><br>${e.title}</div>`).join('') || '<p style="text-align:center; color:var(--text-muted); padding:10px;">No upcoming events.</p>';
}

function renderStuckWorkflow() {
    const cont = document.getElementById('dash-stuck-tasks');
    if(!cont) return;
    const stuck = (db.tasks || []).filter(t => t.status === 'Stuck').slice(0, 3);
    cont.innerHTML = stuck.map(t => `<div style="padding:8px; border-left:3px solid red; background:rgba(239,68,68,0.05); font-size:0.8rem; margin-bottom:8px;"><b>${t.title}</b></div>`).join('') || '<p style="text-align:center; color:var(--text-muted); padding:10px;">Pipeline Clear. ✅</p>';
}

window.switchDashLeaderboard = (type) => { 
    currentLeaderboardType = type; 
    document.getElementById('btn-dash-buyers').classList.toggle('primary', type==='buyers');
    document.getElementById('btn-dash-sellers').classList.toggle('primary', type==='sellers');
    renderLeaderboard(); 
};

window.fetchLiveForexRates = async function() {
    const usdEl = document.getElementById('dash-fx-usd');
    const eurEl = document.getElementById('dash-fx-eur');
    const aedEl = document.getElementById('dash-fx-aed');
    if(!usdEl) return;

    try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await res.json();
        if(data && data.rates) {
            if(data.rates.INR) usdEl.innerText = `₹ ${data.rates.INR.toFixed(2)}`;
            if(data.rates.EUR && data.rates.INR) eurEl.innerText = `₹ ${(data.rates.INR / data.rates.EUR).toFixed(2)}`;
            if(data.rates.AED && data.rates.INR) aedEl.innerText = `₹ ${(data.rates.INR / data.rates.AED).toFixed(2)}`;
            
            // Sync to Global DB for other modules to use
            if(window.db && window.db.meta && data.rates.INR) {
                window.db.meta.usdInrRate = data.rates.INR;
            }
        }
    } catch(e) {
        console.warn("Dashboard Forex Sync Fail:", e);
    }
};

window.processAICommand = async function(query) {
    if (!query) return;
    const responseEl = document.getElementById('ai-command-response');
    if (!responseEl) return;

    responseEl.classList.remove('hidden');
    responseEl.innerHTML = `
        <div style="background: var(--surface); padding: 20px; border-radius: 12px; border: 1px solid var(--primary); margin-bottom: 25px; animation: slideIn 0.3s ease-out;">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                <span style="font-size:1.5rem;">🤖</span>
                <span style="font-weight:bold; color:var(--primary);">AI Strategic Assistant</span>
                <span style="font-size:0.7rem; color:var(--text-muted); margin-left:auto;">Analyzing Workspace...</span>
            </div>
            <div id="ai-active-response" style="font-size: 1rem; line-height: 1.6; color: var(--text);">
                <span class="skeleton-text" style="width:100%; display:block; margin-bottom:8px;"></span>
                <span class="skeleton-text" style="width:80%; display:block;"></span>
            </div>
            <div style="margin-top:15px; text-align:right;">
                <button onclick="document.getElementById('ai-command-response').classList.add('hidden')" class="secondary" style="padding:4px 12px; font-size:0.7rem;">Dismiss</button>
            </div>
        </div>
    `;

    try {
        // Business Context Injection
        let context = "I am an ERP agent. Current State:";
        if(window.db) {
            const net = document.getElementById('dash-kpi-net')?.innerText || 'Unknown';
            context += ` Net Profit (YTD): ${net}.`;
            context += ` Active Shipments: ${(db.docs||[]).length} Export, ${(db.imports||[]).length} Import.`;
        }

        const prompt = `${context}\n\nUSER QUERY: ${query}`;
        const response = await Enterprise.AI.ask(prompt, "You are a professional Business Intelligence Analyst for JFT Agro. Provide concise, data-driven insights. Be professional and strategic.");
        
        const activeResEl = document.getElementById('ai-active-response');
        if(activeResEl && response.text) {
            activeResEl.innerText = response.text;
            activeResEl.innerHTML += `<div style="margin-top:10px; font-size:0.6rem; color:var(--text-muted); border-top:1px solid var(--border); padding-top:5px;">Source: ${response.source} | Agent Insight Engine v8.2</div>`;
        } else {
            activeResEl.innerText = "I was unable to synthesize a response from the cloud. Please check your AI API keys in Settings.";
        }

    } catch (err) {
        console.error("AI Command Fail:", err);
        const activeResEl = document.getElementById('ai-active-response');
        if(activeResEl) activeResEl.innerText = "Error connecting to AI Hub: " + err.message;
    }
};
