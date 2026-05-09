/* --- COMPREHENSIVE IMPORT MANAGEMENT ENGINE v3.3 --- */

(function() {
    // Shared state/db access
    const safeStr = (s) => (s ? String(s).trim() : '');
    const escapeHTML = (str) => {
        if (!str) return '';
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    };

    // --- TAB SYSTEM ---
    window.switchImportTab = function(tabName) {
        try {
            document.querySelectorAll('#import-mgmt .sub-tab-btn').forEach(btn => btn.classList.remove('active'));
            const btn = document.getElementById(`btn-imp-${tabName}`);
            if(btn) btn.classList.add('active');
            
            document.querySelectorAll('#import-mgmt .import-container').forEach(p => p.classList.add('hidden'));
            const target = document.getElementById(`imp-${tabName}-tab`);
            if(target) target.classList.remove('hidden');

            if (window.resetViewScroll) window.resetViewScroll();

            if(tabName === 'ledger') renderImportLedger();
            if(tabName === 'expense') renderImportExpenseLedger();
            if(tabName === 'forex') { 
                renderImportHedgeLedger(); 
                renderImportPaymentLedger();
                populateImportDossierSelect(); 
                updateHedgeSelectInPayment(); 
            }
            if(tabName === 'dossier') { 
                populateImportDossierSelect(); 
                renderImportDossier360(); 
            }
            if(tabName === 'pnl') calculateGlobalImportStats();
            if(tabName === 'logistics') renderImportContainerLedger();
            if(tabName === 'calc') {
                if(window.runAdvImportCalc) runAdvImportCalc();
                renderImportSimHistory();
            }
        } catch (e) { console.error("Tab switch failed:", e); }
    };

    // --- MASTER LEDGER ---
    window.renderImportLedger = function() {
        const db = window.db; if(!db) return;
        const tbody = document.getElementById('imp-ledger-tbody'); if(!tbody) return;

        const fy = document.getElementById('imp-filter-fy')?.value || '';
        const status = document.getElementById('imp-filter-status')?.value || '';
        const search = (document.getElementById('imp-filter-search')?.value || '').toLowerCase();

        const data = (db.imports || []).filter(i => {
            const matchesFY = !fy || safeStr(i.fy) === fy;
            const matchesStatus = !status || safeStr(i.status) === status;
            const matchesSearch = !search || 
                safeStr(i.supplier).toLowerCase().includes(search) || 
                safeStr(i.ref).toLowerCase().includes(search) || 
                safeStr(i.obl).toLowerCase().includes(search) ||
                safeStr(i.awb).toLowerCase().includes(search);
            return matchesFY && matchesStatus && matchesSearch;
        }).sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0));

        tbody.innerHTML = data.map(i => {
            const trackLink = getTrackLink(i.vessel, i.obl || i.awb);
            const val = parseFloat(i.val || 0);

            // ETA DRIFT LOGIC
            let driftHtml = '';
            if (i.etaHistory && i.etaHistory.length > 1) {
                const initial = new Date(i.etaHistory[0].eta);
                const current = new Date(i.eta);
                const diffDays = Math.ceil((current - initial) / (1000 * 60 * 60 * 24));
                if (diffDays > 0) driftHtml = `<br><span style="color:#ef4444; font-size:0.65rem; font-weight:bold;">⚠️ +${diffDays}d Drift</span>`;
                else if (diffDays < 0) driftHtml = `<br><span style="color:#10b981; font-size:0.65rem; font-weight:bold;">🚀 ${diffDays}d Early</span>`;
            }

            return `
            <tr style="border-bottom: 1px solid var(--border);">
                <td><b style="color:var(--primary); font-family:monospace;">${escapeHTML(i.ref)}</b><br><small style="color:var(--text-muted);">${escapeHTML(i.fy)}</small></td>
                <td><small>OBL: ${escapeHTML(i.obl || '--')}</small><br><small>AWB: ${escapeHTML(i.awb || '--')}</small></td>
                <td><b>${escapeHTML(i.supplier)}</b><br><small>${escapeHTML(i.product)} (${i.qty || 0} MT)</small></td>
                <td><small>${escapeHTML(i.vessel || 'N/A')}</small><br><small>POD: ${escapeHTML(i.pod || 'Mundra')}</small></td>
                <td style="font-weight:700; color:var(--primary); font-family:monospace;">$${val.toLocaleString()}</td>
                <td>
                    ${i.eta ? formatDateIN(i.eta) : 'Pending'}${driftHtml}
                    ${i.etaHistory ? `<button onclick="showImportEtaTimeline('${i.id}')" style="background:none; border:none; padding:0; cursor:pointer; font-size:0.65rem; color:var(--primary); text-decoration:underline; display:block; margin-top:2px;">View Log</button>` : ''}
                    <br><small>POL: ${i.pol || '--'}</small>
                </td>
                <td><span class="imp-status-badge status-${safeStr(i.status).replace(/\s+/g, '-').toLowerCase()}">${i.status || 'Pending'}</span></td>
                <td>${trackLink}</td>
                <td style="text-align:right; white-space:nowrap;">
                    <button class="secondary" style="padding:4px 8px;" onclick="editImportShipment('${i.id}')" title="Edit">✏️</button>
                    <button class="secondary" style="padding:4px 8px;" onclick="viewImportDossierDirect('${i.id}')" title="360 Dossier">📂</button>
                    <button class="secondary" style="padding:4px 8px; color:var(--danger);" onclick="deleteImport('${i.id}')" title="Delete">🗑️</button>
                </td>
            </tr>
        `}).join('') || '<tr><td colspan="9" style="text-align:center; padding:40px; color:var(--text-muted);">No matching shipments found.</td></tr>';
        
        populateFYSelectors();
    };

    window.saveImportDetailed = function(e) {
        e.preventDefault();
        const db = window.db; if(!db) return;
        const existing = editingId ? db.imports.find(x => x.id === editingId) : null;
        
        const shipment = {
            id: editingId || 'IMP_' + Date.now(),
            supplier: document.getElementById('imp-det-supplier').value,
            ref: document.getElementById('imp-det-ref').value,
            fy: document.getElementById('imp-det-fy').value,
            obl: document.getElementById('imp-det-obl').value,
            awb: document.getElementById('imp-det-awb').value,
            product: document.getElementById('imp-det-product').value,
            qty: parseFloat(document.getElementById('imp-det-qty').value) || 0,
            val: parseFloat(document.getElementById('imp-det-val').value) || 0,
            curr: document.getElementById('imp-det-curr').value,
            vessel: document.getElementById('imp-det-vessel').value,
            pol: document.getElementById('imp-det-pol').value,
            pod: document.getElementById('imp-det-pod').value,
            etd: document.getElementById('imp-det-etd').value,
            eta: document.getElementById('imp-det-eta').value,
            status: document.getElementById('imp-det-status').value,
            etaHistory: existing ? (existing.etaHistory || []) : [],
            timestamp: Date.now()
        };

        // TRACK ETA DRIFT
        if (!existing || existing.eta !== shipment.eta) {
            shipment.etaHistory.push({
                eta: shipment.eta,
                timestamp: Date.now(),
                user: sessionStorage.getItem('jft_user') || 'System'
            });
        }

        if(!db.imports) db.imports = [];
        if (editingId) {
            const idx = db.imports.findIndex(x => x.id === editingId);
            if (idx > -1) db.imports[idx] = shipment;
            delete e.target.dataset.editing;
        } else { db.imports.push(shipment); }
        
        if(window.saveData) saveData();
        e.target.reset();
        renderImportLedger();
        if(window.Enterprise) Enterprise.notify("🚢 Shipment Synchronized!", "success");
    };

    window.editImportShipment = function(id) {
        const i = (window.db?.imports || []).find(x => x.id === id);
        if(!i) return;
        const setV = (id, v) => { const el = document.getElementById(id); if(el) el.value = v || ''; };
        setV('imp-det-supplier', i.supplier); setV('imp-det-ref', i.ref); setV('imp-det-fy', i.fy);
        setV('imp-det-obl', i.obl); setV('imp-det-awb', i.awb); setV('imp-det-product', i.product);
        setV('imp-det-qty', i.qty); setV('imp-det-val', i.val); setV('imp-det-curr', i.curr);
        setV('imp-det-vessel', i.vessel); setV('imp-det-pol', i.pol); setV('imp-det-pod', i.pod);
        setV('imp-det-etd', i.etd); setV('imp-det-eta', i.eta); setV('imp-det-status', i.status);
        document.getElementById('imp-master-form').dataset.editing = id;
        window.scrollTo(0,0);
    };

    window.deleteImport = function(id) {
        if(!confirm("Erase this shipment and all related history?")) return;
        const db = window.db; if(!db) return;
        db.imports = (db.imports || []).filter(x => x.id !== id);
        if(window.saveData) saveData();
        renderImportLedger();
    };

    window.showImportEtaTimeline = function(id) {
        const i = (window.db?.imports || []).find(x => x.id === id);
        if(!i || !i.etaHistory) return;

        let html = `<div style="padding:25px; font-family:var(--font); min-width:350px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid var(--border); padding-bottom:10px;">
                <h3 style="margin:0; color:var(--primary);">🗓️ Import ETA Audit Trail</h3>
                <span style="font-family:monospace; background:var(--bg); padding:3px 8px; border-radius:4px; font-size:0.8rem;">${i.ref}</span>
            </div>
            <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:25px;">Shipment: ${i.supplier} | Vessel: ${i.vessel || 'N/A'}</p>
            <div style="border-left: 2px solid var(--primary); padding-left: 20px; margin-left: 10px;">
        `;

        i.etaHistory.forEach((h, idx) => {
            const dateStr = new Date(h.timestamp).toLocaleString();
            let driftIcon = '📍';
            let driftText = 'Original Schedule';
            let color = 'var(--text)';

            if (idx > 0) {
                const prev = new Date(i.etaHistory[idx-1].eta);
                const curr = new Date(h.eta);
                const diff = Math.ceil((curr - prev) / (1000 * 60 * 60 * 24));
                if (diff > 0) { driftIcon = '🔴'; driftText = `Delayed by ${diff} days`; color = '#ef4444'; }
                else if (diff < 0) { driftIcon = '🟢'; driftText = `Early by ${Math.abs(diff)} days`; color = '#10b981'; }
                else { driftIcon = '⚪'; driftText = 'Updated (no change)'; color = 'var(--text-muted)'; }
            }

            html += `
                <div style="margin-bottom:20px; position:relative;">
                    <div style="position:absolute; left:-28px; top:2px; background:white; font-size:1.2rem;">${driftIcon}</div>
                    <div style="font-weight:700; font-size:1rem; color:${color};">${h.eta || 'TBD'}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted); border-bottom:1px dashed var(--border); display:inline-block; margin-bottom:4px;">${driftText}</div>
                    <div style="font-size:0.65rem; color:var(--text-muted);">Timestamp: ${dateStr} | Auth: ${h.user || 'System'}</div>
                </div>
            `;
        });
        html += `</div></div>`;
        if(window.Enterprise && window.Enterprise.showModal) window.Enterprise.showModal(html);
        else alert("Log data: " + JSON.stringify(i.etaHistory));
    };

    // --- LANDING COST SIMULATOR ---
    window.runAdvImportCalc = function() {
        try {
            const val = parseFloat(document.getElementById('adv-imp-val').value) || 0;
            const rate = parseFloat(document.getElementById('adv-imp-ex').value) || 83.50;
            const bcd = parseFloat(document.getElementById('adv-imp-bcd').value) || 0;
            const sws = parseFloat(document.getElementById('adv-imp-sws').value) || 0;
            const igst = parseFloat(document.getElementById('adv-imp-igst').value) || 0;
            const ops = parseFloat(document.getElementById('adv-imp-local-ops').value) || 0;
            const inland = parseFloat(document.getElementById('adv-imp-inland').value) || 0;

            const valINR = val * rate;
            const dutyBase = valINR * (bcd / 100);
            const swsDuty = dutyBase * (sws / 100);
            const igstDuty = (valINR + dutyBase + swsDuty) * (igst / 100);
            const totalDuty = dutyBase + swsDuty + igstDuty;
            const finalLanding = valINR + totalDuty + ops + inland;

            document.getElementById('adv-imp-tot-inr').innerText = `₹${finalLanding.toLocaleString(undefined, {minimumFractionDigits:2})}`;
            document.getElementById('adv-imp-pur-inr').innerText = `₹${valINR.toLocaleString()}`;
            document.getElementById('adv-imp-duty-inr').innerText = `₹${totalDuty.toLocaleString()}`;
        } catch(e) { console.warn("Calculation fail", e); }
    };

    window.saveImportCosting = function() {
        const db = window.db; if(!db) return;
        const totalINR = document.getElementById('adv-imp-tot-inr').innerText;
        if(totalINR === "₹0.00") return alert("Enter values first.");
        
        if(!db.import_simulations) db.import_simulations = [];
        db.import_simulations.push({
            id: 'SIM_' + Date.now(),
            cif: document.getElementById('adv-imp-val').value,
            rate: document.getElementById('adv-imp-ex').value,
            bcd: document.getElementById('adv-imp-bcd').value,
            sws: document.getElementById('adv-imp-sws').value,
            igst: document.getElementById('adv-imp-igst').value,
            ops: document.getElementById('adv-imp-local-ops').value,
            inland: document.getElementById('adv-imp-inland').value,
            totalINR: totalINR, timestamp: Date.now(), date: new Date().toISOString()
        });
        if(window.saveData) saveData();
        renderImportSimHistory();
        if(window.Enterprise) Enterprise.notify("Landed Cost Simulation Saved", "success");
    };

    window.renderImportSimHistory = function() {
        const db = window.db; if(!db) return;
        const tbody = document.getElementById('imp-sim-history-tbody'); if(!tbody) return;
        const searchStr = (document.getElementById('imp-calc-search')?.value || '').toLowerCase();
        
        const sims = (db.import_simulations || []).filter(s => {
            return !searchStr || (s.totalINR || '').toLowerCase().includes(searchStr) || formatDateIN(s.date).toLowerCase().includes(searchStr);
        }).sort((a,b) => b.timestamp - a.timestamp);

        tbody.innerHTML = sims.map(s => `
            <tr>
                <td><b>${s.id.slice(-6)}</b><br><small>${formatDateIN(s.date)}</small></td>
                <td>$${parseFloat(s.cif || 0).toLocaleString()}</td>
                <td>₹${parseFloat(s.rate || 0).toFixed(2)}</td>
                <td style="font-weight:bold; color:var(--primary);">${s.totalINR}</td>
                <td style="text-align:right;">
                    <button class="secondary" style="padding:4px 8px;" onclick="loadImportSim('${s.id}')">📂</button>
                    <button class="secondary" style="padding:4px 8px; color:var(--danger);" onclick="deleteImportSim('${s.id}')">🗑️</button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="5" style="text-align:center; padding:20px;">No saved simulations.</td></tr>';
    };

    window.loadImportSim = function(id) {
        const s = (window.db?.import_simulations || []).find(x => x.id === id);
        if(!s) return;
        const setV = (id, v) => { const el = document.getElementById(id); if(el) el.value = v || 0; };
        setV('adv-imp-val', s.cif); setV('adv-imp-ex', s.rate); setV('adv-imp-bcd', s.bcd);
        setV('adv-imp-sws', s.sws); setV('adv-imp-igst', s.igst); setV('adv-imp-local-ops', s.ops);
        setV('adv-imp-inland', s.inland);
        runAdvImportCalc();
        window.scrollTo(0,0);
    };

    window.clearImportCalc = function() {
        document.getElementById('adv-imp-val').value = 0;
        document.getElementById('adv-imp-local-ops').value = 0;
        document.getElementById('adv-imp-inland').value = 0;
        runAdvImportCalc();
    };

    window.deleteImportSim = function(id) {
        if(!confirm("Erase this costing history?")) return;
        const db = window.db; if(!db) return;
        db.import_simulations = (db.import_simulations || []).filter(x => x.id !== id);
        if(window.saveData) saveData();
        renderImportSimHistory();
    };

    // --- EXPENSES ---
    window.renderImportExpenseLedger = function() {
        const db = window.db; if(!db) return;
        const tbody = document.getElementById('impx-ledger-tbody'); if(!tbody) return;

        const refSel = document.getElementById('impx-ref');
        if(refSel) {
            const options = (db.imports || []).map(i => `<option value="${i.ref}">${i.ref} | ${i.supplier}</option>`);
            refSel.innerHTML = '<option value="">-- Map to Shipment --</option>' + options.join('');
        }

        const fy = document.getElementById('impx-filter-fy')?.value || '';
        const status = document.getElementById('impx-filter-status')?.value || '';
        const search = (document.getElementById('impx-filter-search')?.value || '').toLowerCase();

        const data = (db.import_expenses || []).filter(e => {
            const matchesFY = !fy || safeStr(e.fy) === fy;
            const matchesStatus = !status || safeStr(e.status) === status;
            const matchesSearch = !search || safeStr(e.party).toLowerCase().includes(search) || safeStr(e.ref).toLowerCase().includes(search);
            return matchesFY && matchesStatus && matchesSearch;
        }).sort((a,b) => b.timestamp - a.timestamp);

        tbody.innerHTML = data.map(e => {
            const total = (parseFloat(e.amt || 0) + parseFloat(e.gst||0) - parseFloat(e.tds||0));
            return `
            <tr>
                <td><b>${escapeHTML(e.ref)}</b><br><small>${formatDateIN(e.date)}</small></td>
                <td><small>${escapeHTML(e.cat)}</small></td>
                <td>${escapeHTML(e.party)}<br><small style="color:var(--text-muted);">${escapeHTML(e.vendorInv || '--')}</small></td>
                <td>₹${parseFloat(e.amt || 0).toLocaleString()}</td>
                <td>₹${parseFloat(e.gst||0).toLocaleString()}</td>
                <td style="color:#ef4444;">-₹${parseFloat(e.tds||0).toLocaleString()}</td>
                <td style="font-weight:bold;">₹${total.toLocaleString()}</td>
                <td><span class="status-badge" style="background:${e.status==='Paid'?'#10b981':'#ef4444'}; font-size:0.65rem;">${e.status || 'Unpaid'}</span></td>
                <td style="text-align:right;">
                    <button class="secondary" style="padding:4px 6px;" onclick="editImportExpense('${e.id}')">✏️</button>
                    <button class="secondary" style="padding:4px 6px; color:var(--danger);" onclick="deleteImportExpense('${e.id}')">🗑️</button>
                </td>
            </tr>
        `}).join('') || '<tr><td colspan="9" style="text-align:center; padding:20px;">No expenses found.</td></tr>';
    };

    window.saveImportExpenseDet = function(e) {
        e.preventDefault();
        const db = window.db; if(!db) return;
        const editingId = e.target.dataset.editing;
        const exp = {
            id: editingId || 'IEXP_' + Date.now(),
            date: document.getElementById('impx-date').value,
            ref: document.getElementById('impx-ref').value,
            cat: document.getElementById('impx-cat').value,
            party: document.getElementById('impx-party').value,
            vendorInv: document.getElementById('impx-vendor-inv').value,
            fy: document.getElementById('impx-fy').value,
            amt: parseFloat(document.getElementById('impx-amt').value) || 0,
            gst: parseFloat(document.getElementById('impx-gst').value) || 0,
            tds: parseFloat(document.getElementById('impx-tds').value) || 0,
            status: document.getElementById('impx-status').value,
            remarks: document.getElementById('impx-remarks').value,
            timestamp: Date.now()
        };
        if(!db.import_expenses) db.import_expenses = [];
        if(editingId) {
            const idx = db.import_expenses.findIndex(x => x.id === editingId);
            if(idx > -1) db.import_expenses[idx] = exp;
            delete e.target.dataset.editing;
        } else { db.import_expenses.push(exp); }
        if(window.saveData) saveData();
        e.target.reset();
        renderImportExpenseLedger();
        if(window.Enterprise) Enterprise.notify("Expense/Duty Record Synchronized", "info");
    };

    window.editImportExpense = function(id) {
        const e = (window.db?.import_expenses || []).find(x => x.id === id);
        if(!e) return;
        const setV = (id, v) => { const el = document.getElementById(id); if(el) el.value = v || ''; };
        setV('impx-date', e.date); setV('impx-ref', e.ref); setV('impx-cat', e.cat);
        setV('impx-party', e.party); setV('impx-vendor-inv', e.vendorInv); setV('impx-fy', e.fy);
        setV('impx-amt', e.amt); setV('impx-gst', e.gst); setV('impx-tds', e.tds);
        setV('impx-status', e.status); setV('impx-remarks', e.remarks);
        document.getElementById('imp-exp-form').dataset.editing = id;
        window.scrollTo(0, 0);
    };

    window.deleteImportExpense = function(id) {
        if(!confirm("Erase this expense entry?")) return;
        const db = window.db; if(!db) return;
        db.import_expenses = (db.import_expenses || []).filter(x => x.id !== id);
        if(window.saveData) saveData();
        renderImportExpenseLedger();
    };

    // --- FOREX & HEDGING ---
    window.saveImportHedge = function(e) {
        e.preventDefault();
        const db = window.db; if(!db) return;
        const hedge = {
            id: 'IHEDGE_' + Date.now(),
            ref: document.getElementById('imp-h-ref').value,
            bank: document.getElementById('imp-h-bank').value,
            amount: parseFloat(document.getElementById('imp-h-amt').value) || 0,
            rate: parseFloat(document.getElementById('imp-h-rate').value) || 0,
            expiry: document.getElementById('imp-h-exp').value,
            type: document.getElementById('imp-h-type').value,
            status: 'Active', timestamp: Date.now()
        };
        if(!db.import_hedges) db.import_hedges = [];
        db.import_hedges.push(hedge);
        if(window.saveData) saveData();
        e.target.reset();
        renderImportHedgeLedger();
        updateHedgeSelectInPayment();
        if(window.Enterprise) Enterprise.notify("Forward Booking Registered", "success");
    };

    window.renderImportHedgeLedger = function() {
        const db = window.db; if(!db) return;
        const tbody = document.getElementById('imp-hedge-detailed-tbody'); if(!tbody) return;
        
        tbody.innerHTML = (db.import_hedges || []).map(h => {
            const used = (db.import_payments || []).filter(p => p.hedgeId === h.id).reduce((s,p) => s + parseFloat(p.fcy || 0), 0);
            const bal = Math.max(0, parseFloat(h.amount || 0) - used);
            return `
            <tr>
                <td><b>${escapeHTML(h.ref)}</b><br><small>${escapeHTML(h.bank)}</small></td>
                <td style="font-weight:bold;">$${parseFloat(h.amount || 0).toLocaleString()}</td>
                <td>₹${parseFloat(h.rate || 0).toFixed(2)}</td>
                <td>${formatDateIN(h.expiry)}</td>
                <td style="color:${bal>0?'var(--primary)':'#64748b'}; font-weight:bold;">$${bal.toLocaleString()}</td>
                <td style="text-align:right;">
                    <button class="secondary" style="padding:4px 6px; color:var(--danger);" onclick="deleteImportHedge('${h.id}')">🗑️</button>
                </td>
            </tr>
        `}).join('') || '<tr><td colspan="6" style="text-align:center; padding:20px;">No forward bookings found.</td></tr>';
    };

    window.deleteImportHedge = function(id) {
        if(!confirm("Erase this forward booking?")) return;
        const db = window.db; if(!db) return;
        db.import_hedges = (db.import_hedges || []).filter(x => x.id !== id);
        if(window.saveData) saveData();
        renderImportHedgeLedger();
        updateHedgeSelectInPayment();
    };

    window.updateHedgeSelectInPayment = function() {
        const db = window.db; if(!db) return;
        const sel = document.getElementById('imp-pay-hedge-link'); if(!sel) return;
        const active = (db.import_hedges || []).filter(h => {
            const used = (db.import_payments || []).filter(p => p.hedgeId === h.id).reduce((s,p) => s + parseFloat(p.fcy || 0), 0);
            return (parseFloat(h.amount || 0) - used) > 0.01;
        });
        sel.innerHTML = '<option value="">-- Spot Purchase --</option>' + 
            active.map(h => {
                const used = (db.import_payments || []).filter(p => p.hedgeId === h.id).reduce((s,p) => s + parseFloat(p.fcy || 0), 0);
                const bal = (parseFloat(h.amount || 0) - used).toFixed(2);
                return `<option value="${h.id}">${h.ref} | Bal: $${bal} @ ₹${h.rate}</option>`;
            }).join('');
    };

    // --- PAYMENTS ---
    window.renderImportPaymentLedger = function() {
        const db = window.db; if(!db) return;
        const tbody = document.getElementById('imp-pay-ledger-tbody'); if(!tbody) return;
        const search = (document.getElementById('imp-pay-filter-search')?.value || '').toLowerCase();
        
        tbody.innerHTML = (db.import_payments || []).filter(p => {
            const ship = (db.imports || []).find(i => i.id === p.importId);
            const refT = ship ? safeStr(ship.ref) : '';
            return !search || refT.toLowerCase().includes(search) || safeStr(p.date).includes(search);
        }).sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0)).map(p => {
            const ship = (db.imports || []).find(i => i.id === p.importId);
            const hedge = (db.import_hedges || []).find(h => h.id === p.hedgeId);
            const fcy = parseFloat(p.fcy || 0);
            const rate = parseFloat(p.rate || 0);
            return `
            <tr>
                <td><b>${ship ? ship.ref : 'N/A'}</b><br><small>${formatDateIN(p.date)}</small></td>
                <td style="font-weight:700;">$${fcy.toLocaleString()}</td>
                <td>${hedge ? hedge.ref : '<i style="color:var(--text-muted);">Spot Price</i>'}</td>
                <td>₹${rate.toFixed(2)}</td>
                <td style="font-weight:bold; color:var(--primary);">₹${(fcy * rate).toLocaleString()}</td>
                <td style="text-align:right;">
                    <button class="secondary" style="padding:4px 6px; color:var(--danger);" onclick="deleteImportPayment('${p.id}')">🗑️</button>
                </td>
            </tr>
        `}).join('') || '<tr><td colspan="6" style="text-align:center; padding:20px;">No payments recorded.</td></tr>';
    };

    window.saveImportPayment = function(e) {
        e.preventDefault();
        const db = window.db; if(!db) return;
        const payment = {
            id: 'IPAY_' + Date.now(),
            importId: document.getElementById('imp-pay-ref').value,
            hedgeId: document.getElementById('imp-pay-hedge-link').value || null,
            date: document.getElementById('imp-pay-date').value,
            fcy: parseFloat(document.getElementById('imp-pay-fcy').value) || 0,
            rate: parseFloat(document.getElementById('imp-pay-rate').value) || 0,
            timestamp: Date.now()
        };
        if(!db.import_payments) db.import_payments = [];
        db.import_payments.push(payment);
        if(window.saveData) saveData();
        e.target.reset();
        renderImportPaymentLedger();
        updateHedgeSelectInPayment();
        populateImportDossierSelect();
        if(window.Enterprise) Enterprise.notify("Payment Outstanding Realized", "success");
        if(window.updatePayableBalance) updatePayableBalance();
    };

    window.deleteImportPayment = function(id) {
        if(!confirm("Erase this payment ledger entry?")) return;
        const db = window.db; if(!db) return;
        db.import_payments = (db.import_payments || []).filter(x => x.id !== id);
        if(window.saveData) saveData();
        renderImportPaymentLedger();
        updateHedgeSelectInPayment();
        populateImportDossierSelect();
    };

    // --- P&L ANALYTICS ---
    window.calculateGlobalImportStats = function() {
        const db = window.db; if(!db) return;
        const tbody = document.getElementById('imp-partition-tbody'); if(!tbody) return;

        const search = (document.getElementById('imp-pnl-filter-search')?.value || '').toLowerCase();
        let tVal = 0, tExp = 0, tRev = 0;

        tbody.innerHTML = (db.imports || []).filter(i => {
             return !search || safeStr(i.supplier).toLowerCase().includes(search) || safeStr(i.ref).toLowerCase().includes(search);
        }).map(i => {
            // DYNAMIC RATE CALCULATION: Use actual payment rate or meta rate
            const pms = (db.import_payments || []).filter(p => p.importId === i.id);
            const paidFCY = pms.reduce((s,p) => s + parseFloat(p.fcy || 0), 0);
            const paidINR = pms.reduce((s,p) => s + (parseFloat(p.fcy || 0) * parseFloat(p.rate || 0)), 0);
            const avgRate = paidFCY > 0 ? (paidINR / paidFCY) : (db.meta?.usdInrRate || 83.50);
            
            const purINR = parseFloat(i.val || 0) * avgRate;
            const shipExps = (db.import_expenses || []).filter(e => e.ref === i.ref);
            const expSum = shipExps.reduce((s,e) => s + (parseFloat(e.amt || 0) + parseFloat(e.gst||0) - parseFloat(e.tds||0)), 0);
            
            const manual = (db.import_manual_pnl || []).find(m => m.shipId === i.id);
            const saleVal = manual ? parseFloat(manual.saleValue || 0) : 0;
            
            tVal += purINR; tExp += expSum; tRev += saleVal;
            const net = saleVal - (purINR + expSum);
            const roi = (purINR + expSum) > 0 ? (net / (purINR + expSum)) * 100 : 0;

            return `
                <tr>
                    <td><b>${i.ref}</b></td>
                    <td>${escapeHTML(i.supplier)}</td>
                    <td>₹${purINR.toLocaleString()} <small style="display:block; font-size:9px; color:var(--text-muted);">@ ${avgRate.toFixed(2)}</small></td>
                    <td>₹${expSum.toLocaleString()}</td>
                    <td><input type="number" id="pnl-sale-${i.id}" value="${saleVal}" style="width:110px; font-weight:700;"></td>
                    <td style="color:${net>=0?'#10b981':'#ef4444'}; font-weight:bold;">₹${net.toLocaleString()}</td>
                    <td style="font-weight:bold;">${roi.toFixed(1)}%</td>
                    <td style="text-align:right;">
                        <button class="secondary" style="background:var(--primary); color:white; padding:4px 8px;" onclick="saveImportManualSale('${i.id}')">💾 Save</button>
                    </td>
                </tr>
            `;
        }).join('') || '<tr><td colspan="8" style="text-align:center; padding:40px;">No shipments logs available.</td></tr>';

        const setT = (id, v) => { const el = document.getElementById(id); if(el) el.innerText = v; };
        setT('imp-pnl-rev', `₹${tRev.toLocaleString()}`);
        setT('imp-pnl-pur', `₹${tVal.toLocaleString()}`);
        setT('imp-pnl-exp', `₹${tExp.toLocaleString()}`);
        setT('imp-pnl-net', `₹${(tRev - tVal - tExp).toLocaleString()}`);
    };

    window.saveImportManualSale = function(id) {
        const db = window.db; if(!db) return;
        const val = parseFloat(document.getElementById(`pnl-sale-${id}`)?.value || 0);
        if(!db.import_manual_pnl) db.import_manual_pnl = [];
        const idx = db.import_manual_pnl.findIndex(m => m.shipId === id);
        if(idx > -1) db.import_manual_pnl[idx].saleValue = val;
        else db.import_manual_pnl.push({ shipId: id, saleValue: val });
        if(window.saveData) saveData();
        calculateGlobalImportStats();
        if(window.Enterprise) Enterprise.notify("Manual Sale Projection Saved", "success");
    };

    // --- LOGISTICS ---
    window.renderImportContainerLedger = function() {
        const db = window.db; if(!db) return;
        const tbody = document.getElementById('imp-log-tbody'); if(!tbody) return;

        const oblS = document.getElementById('imp-log-obl');
        if(oblS) {
            const opts = (db.imports || []).map(i => `<option value="${i.obl || i.awb || i.ref}">${i.obl || i.awb || i.ref} | ${i.supplier}</option>`);
            oblS.innerHTML = '<option value="">-- Choose OBL/AWB --</option>' + opts.join('');
        }

        const search = (document.getElementById('imp-log-filter-search')?.value || '').toLowerCase();
        tbody.innerHTML = (db.log_containers || []).filter(c => {
             return !search || safeStr(c.no).toLowerCase().includes(search) || safeStr(c.masterBl).toLowerCase().includes(search);
        }).sort((a,b) => b.timestamp - a.timestamp).map(c => `
            <tr>
                <td><b>${escapeHTML(c.no)}</b></td>
                <td>${escapeHTML(c.seal || '--')}<br><small>${escapeHTML(c.size)}</small></td>
                <td>${escapeHTML(c.masterBl || '--')}</td>
                <td>${c.nw || 0} MT</td>
                <td><span class="status-badge" style="background:#3b82f6; font-size:0.65rem;">${c.status || 'Mapped'}</span></td>
                <td style="text-align:right;">
                    <button class="secondary" style="padding:4px 6px;" onclick="editImportContainer('${c.id}')">✏️</button>
                    <button class="secondary" style="padding:4px 6px; color:var(--danger);" onclick="deleteImportContainer('${c.id}')">🗑️</button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="6" style="text-align:center; padding:20px;">No container data.</td></tr>';
    };

    window.saveImportContainerDet = function(e) {
        e.preventDefault();
        const db = window.db; if(!db) return;
        const editingId = e.target.dataset.editing;
        const cont = {
            id: editingId || 'CONT_' + Date.now(),
            no: document.getElementById('imp-log-cont-no').value,
            masterBl: document.getElementById('imp-log-obl').value,
            seal: document.getElementById('imp-log-seal').value,
            size: document.getElementById('imp-log-size').value,
            nw: parseFloat(document.getElementById('imp-log-nw').value) || 0,
            status: document.getElementById('imp-log-status').value,
            timestamp: Date.now()
        };
        if(!db.log_containers) db.log_containers = [];
        if(editingId) {
             const idx = db.log_containers.findIndex(x => x.id === editingId);
             if(idx > -1) db.log_containers[idx] = cont;
             delete e.target.dataset.editing;
        } else { db.log_containers.push(cont); }
        if(window.saveData) saveData();
        e.target.reset();
        renderImportContainerLedger();
        if(window.Enterprise) Enterprise.notify("Physical Container Linked", "success");
    };

    window.editImportContainer = function(id) {
        const c = (window.db?.log_containers || []).find(x => x.id === id);
        if(!c) return;
        const setV = (id, v) => { const el = document.getElementById(id); if(el) el.value = v || ''; };
        setV('imp-log-cont-no', c.no); setV('imp-log-obl', c.masterBl); setV('imp-log-seal', c.seal);
        setV('imp-log-size', c.size); setV('imp-log-nw', c.nw); setV('imp-log-status', c.status);
        document.getElementById('imp-log-form').dataset.editing = id;
        window.scrollTo(0, 0);
    };

    window.deleteImportContainer = function(id) {
        if(!confirm("Erase this container mapping?")) return;
        const db = window.db; if(!db) return;
        db.log_containers = (db.log_containers || []).filter(x => x.id !== id);
        if(window.saveData) saveData();
        renderImportContainerLedger();
    };

    // --- 360° DOSSIER ENGINE ---
    window.renderImportDossier360 = function() {
        const db = window.db; if(!db) return;
        const id = document.getElementById('imp-dos-select')?.value;
        const i = (db.imports || []).find(x => x.id === id);
        const content = document.getElementById('imp-dos-content');
        const empty = document.getElementById('imp-dos-empty');
        
        if(!i) { content?.classList.add('hidden'); empty?.classList.remove('hidden'); return; }
        content.classList.remove('hidden'); empty.classList.add('hidden');

        // Logic
        const manual = (db.import_manual_pnl || []).find(m => m.shipId === i.id);
        const saleINR = manual ? manual.saleValue : 0;
        
        const pms = (db.import_payments || []).filter(p => p.importId === id);
        const paidFCY = pms.reduce((s,p) => s + parseFloat(p.fcy || 0), 0);
        const paidINR = pms.reduce((s,p) => s + (parseFloat(p.fcy || 0) * parseFloat(p.rate || 0)), 0);
        const avgRate = paidFCY > 0 ? (paidINR / paidFCY) : (db.meta?.usdInrRate || 83.50);

        const purINR = parseFloat(i.val || 0) * avgRate;
        const shipExps = (db.import_expenses || []).filter(e => e.ref === i.ref);
        const dutyINR = shipExps.filter(e => e.cat.toLowerCase().includes('duty') || e.cat.toLowerCase().includes('customs')).reduce((s,e) => s + (parseFloat(e.amt || 0) + parseFloat(e.gst||0) - parseFloat(e.tds||0)), 0);
        const opsINR = shipExps.filter(e => !e.cat.toLowerCase().includes('duty') && !e.cat.toLowerCase().includes('customs')).reduce((s,e) => s + (parseFloat(e.amt || 0) + parseFloat(e.gst||0) - parseFloat(e.tds||0)), 0);
        
        const totActual = purINR + dutyINR + opsINR;
        const netProfit = saleINR - totActual;
        const margin = totActual > 0 ? (netProfit / totActual) * 100 : 0;

        // UI Update
        document.getElementById('idos-supplier').innerText = i.supplier;
        document.getElementById('idos-ident').innerText = `INV ${i.ref} | FY ${i.fy} | OBL ${i.obl || i.awb}`;
        document.getElementById('idos-cif').innerText = `$${parseFloat(i.val || 0).toLocaleString()}`;
        document.getElementById('idos-sale-inr-display').innerText = `₹${saleINR.toLocaleString()}`;
        document.getElementById('idos-cost-inr').innerText = `₹${totActual.toLocaleString()}`;
        document.getElementById('idos-profit-inr').innerText = `₹${netProfit.toLocaleString()}`;
        document.getElementById('idos-profit-inr').style.color = netProfit >= 0 ? '#10b981' : '#fca5a5';
        document.getElementById('idos-margin-gauge').innerText = `${margin.toFixed(1)}%`;
        
        // Variance
        const simSelect = document.getElementById('idos-var-sim-select');
        if(simSelect && simSelect.options.length <= 1) {
            simSelect.innerHTML = '<option value="">-- No Sim (Standard 11%) --</option>' + (db.import_simulations || []).map(s => `<option value="${s.id}">${s.id.slice(-6)} | ₹${s.totalINR}</option>`).join('');
        }
        const sim = (db.import_simulations || []).find(s => s.id === simSelect.value);
        const estDuty = sim ? (parseFloat(sim.cif)*parseFloat(sim.rate)*(parseFloat(sim.bcd)/100 + 0.18)) : purINR * 0.11;
        const estOps = sim ? (parseFloat(sim.ops) + parseFloat(sim.inland)) : 85000;

        document.getElementById('idos-var-tbody').innerHTML = `
            <tr><td>Customs Duty</td><td>₹${estDuty.toLocaleString()}</td><td>₹${dutyINR.toLocaleString()}</td><td style="color:${dutyINR>estDuty+100?'#ef4444':'#10b981'}; font-weight:700;">${(dutyINR-estDuty).toLocaleString()}</td></tr>
            <tr><td>Logistics & Ops</td><td>₹${estOps.toLocaleString()}</td><td>₹${opsINR.toLocaleString()}</td><td style="color:${opsINR>estOps+100?'#ef4444':'#10b981'}; font-weight:700;">${(opsINR-estOps).toLocaleString()}</td></tr>
        `;

        // Expenses
        document.getElementById('idos-exp-tbody').innerHTML = shipExps.map(e => `
            <tr><td>${formatDateIN(e.date)}</td><td>${e.cat}</td><td>${e.party}</td><td style="font-weight:700;">₹${(parseFloat(e.amt)+parseFloat(e.gst||0)-parseFloat(e.tds||0)).toLocaleString()}</td></tr>
        `).join('') || '<tr><td colspan="4" style="text-align:center;">No linked charges.</td></tr>';

        // Payments
        document.getElementById('idos-pay-tbody').innerHTML = pms.map(p => `
            <tr><td>${formatDateIN(p.date)}</td><td style="font-weight:700;">$${parseFloat(p.fcy).toLocaleString()}</td><td>₹${parseFloat(p.rate).toFixed(2)}</td><td style="text-align:right;">₹${(p.fcy*p.rate).toLocaleString()}</td></tr>
        `).join('') || '<tr><td colspan="4" style="text-align:center;">No payments.</td></tr>';
        
        const paidUSD = pms.reduce((s,p) => s + parseFloat(p.fcy), 0);
        document.getElementById('idos-pay-bal').innerText = `$${(parseFloat(i.val || 0) - paidUSD).toLocaleString()}`;

        // Containers
        const conts = (db.log_containers || []).filter(c => 
            (i.obl && c.masterBl === i.obl) || 
            (i.awb && c.masterBl === i.awb) || 
            (i.ref && c.masterBl === i.ref)
        );
        const logTbody = document.getElementById('idos-log-tbody');
        if(logTbody) {
            logTbody.innerHTML = conts.map(c => `
                <tr>
                    <td><b>${escapeHTML(c.no)}</b></td>
                    <td>${escapeHTML(c.seal || '--')}<br><small>${escapeHTML(c.size)}</small></td>
                    <td>${escapeHTML(c.masterBl || '--')}</td>
                    <td>${c.nw || 0} MT</td>
                    <td><span class="status-badge" style="background:#3b82f6; font-size:0.65rem;">${c.status || 'Mapped'}</span></td>
                </tr>
            `).join('') || `<tr><td colspan="5" style="text-align:center; padding:15px;">No containers linked for this OBL/AWB.</td></tr>`;
        }

        // Timeline
        const timeline = document.getElementById('idos-timeline');
        if(timeline) {
            timeline.innerHTML = `
                <div style="display:flex; gap:12px; align-items:flex-start;">
                    <div style="min-width:90px; font-weight:700; color:var(--primary);">${i.etd ? formatDateIN(i.etd) : '--'}</div>
                    <div><b>Origin Departure:</b> ${escapeHTML(i.pol || 'Global Load Port')}<br><small style="color:var(--text-muted);">Carrier: ${escapeHTML(i.vessel || 'N/A')}</small></div>
                </div>
                <div style="display:flex; gap:12px; align-items:flex-start;">
                    <div style="min-width:90px; font-weight:700; color:var(--primary);">${i.eta ? formatDateIN(i.eta) : '--'}</div>
                    <div><b>Expected Arrival:</b> ${escapeHTML(i.pod || 'India POD')}<br><small style="color:var(--text-muted);">Status: ${i.status}</small></div>
                </div>
            `;
        }
    };

    window.viewImportDossierDirect = function(id) {
        const sel = document.getElementById('imp-dos-select');
        if(sel) { sel.value = id; switchImportTab('dossier'); }
    };

    window.saveImportAudit = function() {
        if(window.Enterprise) Enterprise.notify("Monetary Audit Baseline Saved for Business Record", "success");
    };

    window.printImportDossier = function() {
        const h = document.getElementById('imp-dos-content').innerHTML;
        const w = window.open('', '_blank');
        w.document.write(`<html><head><title>JFT Import Dossier</title><style>body{font-family:sans-serif;padding:30px;} table{width:100%;border-collapse:collapse;margin:15px 0;} th,td{border:1px solid #ddd;padding:8px;text-align:left;}</style></head><body>${h}</body></html>`);
        w.document.close(); w.print();
    };

    // --- SHARED TOOLS ---
    window.fetchImportLiveRate = async function(id) {
        try {
            const r = await fetch('https://open.er-api.com/v6/latest/USD');
            const d = await r.json();
            const el = document.getElementById(id);
            if(el) { el.value = (d.rates.INR + 0.45).toFixed(2); if(window.runAdvImportCalc) runAdvImportCalc(); }
        } catch(e) { console.error("Rate fetch failed", e); }
    };

    window.exportImportLedger = function() {
        const d = window.db?.imports || [];
        const csv = "Ref,Supplier,Qty,Val,Status\n" + d.map(i => `${i.ref},${i.supplier},${i.qty},${i.val},${i.status}`).join("\n");
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'})); a.download="Imports.csv"; a.click();
    };

    function formatDateIN(d) {
        if(!d) return '--';
        try { return new Date(d).toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'}); } 
        catch(e) { return '--'; }
    }

    function getTrackLink(carrier, no) {
        if(!no || no === '--') return '--';
        const c = String(carrier || '').toLowerCase();
        let url = '#';
        if(c.includes('maersk')) url = `https://www.maersk.com/tracking/${no}`;
        else if(c.includes('msc')) url = `https://www.msc.com/en/track-a-shipment?query=${no}`;
        else if(c.includes('hapag')) url = `https://www.hapag-lloyd.com/en/online-business/track/track-by-container-no.html?container=${no}`;
        else if(c.includes('cma')) url = `https://www.cma-cgm.com/ebusiness/tracking/search?SearchBy=BL&Reference=${no}`;
        if(url === '#') return `<span style="opacity:0.3;font-size:10px;">Link N/A</span>`;
        return `<a href="${url}" target="_blank" style="text-decoration:none;">🔗</a>`;
    }

    function populateFYSelectors() {
        const sel = document.getElementById('imp-filter-fy'); if(!sel || !window.db) return;
        const years = [...new Set((window.db.imports || []).map(i => i.fy))].filter(y => y).sort();
        if(sel.options.length <= 1) { years.forEach(y => sel.add(new Option(y, y))); }
    }

    window.populateImportDossierSelect = function() {
        const db = window.db; if(!db) return;
        const sel = document.getElementById('imp-dos-select'); if(!sel) return;
        sel.innerHTML = '<option value="">-- Choose Shipment --</option>' + (db.imports || []).map(i => `<option value="${i.id}">${i.ref} | ${i.supplier}</option>`).join('');
        
        const payRef = document.getElementById('imp-pay-ref');
        if(payRef) {
            payRef.innerHTML = '<option value="">-- Select Shipment --</option>' + (db.imports || []).map(i => {
                const paid = (db.import_payments || []).filter(p => p.importId === i.id).reduce((s,p) => s + parseFloat(p.fcy || 0), 0);
                const bal = (parseFloat(i.val || 0) - paid);
                return (bal > 0.01) ? `<option value="${i.id}">${i.ref} | Bal: $${bal.toFixed(2)}</option>` : '';
            }).join('');
        }
    };

    // --- INITIALIZATION ---
    function initImportModule() {
        const db = window.db; if(!db) { setTimeout(initImportModule, 500); return; }
        ['imports', 'import_expenses', 'import_hedges', 'import_payments', 'log_containers', 'import_simulations', 'import_manual_pnl'].forEach(c => { if(!db[c]) db[c] = []; });
        
        switchImportTab('ledger');
        console.log("JFT Monetary Import Engine v3.3 Ready.");
    }

    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', () => setTimeout(initImportModule, 1000)); } 
    else { setTimeout(initImportModule, 1000); }

})();
