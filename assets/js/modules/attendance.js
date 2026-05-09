/* ================================================
   JFT ENTERPRISE — HR ATTENDANCE & PAYROLL MODULE
   ================================================ */

// 1. SAFE NATIVE BOOTLOADER
function initAttendanceSystem() {
    if (typeof db === 'undefined') {
        setTimeout(initAttendanceSystem, 50);
        return;
    }
    if (!db.attendance) db.attendance = [];
    if (!db.hr_advances) db.hr_advances = [];
    
    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = today.substring(0, 7);
    
    if(document.getElementById('att-date')) document.getElementById('att-date').value = today;
    if(document.getElementById('adv-date')) document.getElementById('adv-date').value = today;
    if(document.getElementById('filter-month-att')) document.getElementById('filter-month-att').value = thisMonth;
    if(document.getElementById('filter-month-adv')) document.getElementById('filter-month-adv').value = thisMonth;
    if(document.getElementById('ps-month')) document.getElementById('ps-month').value = thisMonth;

    startAttendanceWatchdog();
}
initAttendanceSystem();

window.escapeHTML = window.escapeHTML || function(str) {
    if (!str) return '';
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
};

// UI State Tracking
let _lastAttCount = -1;
let _lastAdvCount = -1;
window.attCurrentPage = 1;
window.advCurrentPage = 1;

function startAttendanceWatchdog() {
    setInterval(() => {
        if (typeof db === 'undefined') return;
        if (!db.attendance) db.attendance = [];
        if (!db.hr_advances) db.hr_advances = [];
        
        if (db.attendance.length !== _lastAttCount || db.hr_advances.length !== _lastAdvCount) {
            _lastAttCount = db.attendance.length;
            _lastAdvCount = db.hr_advances.length;
            renderAttendanceWorkspace();
        }
    }, 1500);
}

// ==========================================
// DATA ENTRY LOGIC
// ==========================================

window.logAttendance = function(e) {
    e.preventDefault();
    if (typeof Enterprise !== 'undefined' && !Enterprise.security.isAdmin(true)) return;

    const entry = {
        id: 'att_' + Date.now(),
        name: document.getElementById('att-name').value.trim(),
        date: document.getElementById('att-date').value,
        shift: document.getElementById('att-shift').value,
        status: document.getElementById('att-status').value,
        time: document.getElementById('att-time').value,
        timestamp: new Date().toISOString()
    };
    
    db.attendance.push(entry);
    db.attendance = [...db.attendance]; // Force Reactivity
    
    if (typeof window.saveData === 'function') window.saveData(true);
    else if (typeof saveData === 'function') saveData(true);
    
    _lastAttCount = db.attendance.length;
    document.getElementById('att-name').value = '';
    renderAttendanceWorkspace();
    
    if (typeof Enterprise !== 'undefined') Enterprise.notify('Attendance saved.', 'success');
};

window.logAdvance = function(e) {
    e.preventDefault();
    if (typeof Enterprise !== 'undefined' && !Enterprise.security.isAdmin(true)) return;

    const rawAmt = parseFloat(document.getElementById('adv-amt').value) || 0;
    const entry = {
        id: 'adv_' + Date.now(),
        name: document.getElementById('adv-name').value.trim(),
        date: document.getElementById('adv-date').value,
        amount: Math.round(rawAmt * 100) / 100,
        ref: document.getElementById('adv-ref').value,
        reason: document.getElementById('adv-reason').value,
        timestamp: new Date().toISOString()
    };
    
    db.hr_advances.push(entry);
    db.hr_advances = [...db.hr_advances]; // Force Reactivity
    
    if (typeof window.saveData === 'function') window.saveData(true);
    else if (typeof saveData === 'function') saveData(true);
    
    _lastAdvCount = db.hr_advances.length;
    e.target.reset();
    document.getElementById('adv-date').value = new Date().toISOString().split('T')[0];
    renderAttendanceWorkspace();
    
    if (typeof Enterprise !== 'undefined') Enterprise.notify('Salary Advance logged.', 'success');
};

// ==========================================
// RENDER UI & TABLES
// ==========================================

window.renderAttendanceWorkspace = function() {
    renderKPIs();
    renderAttTable();
    renderAdvTable();
};

function renderKPIs() {
    if (!db.attendance) return;
    const today = document.getElementById('att-date')?.value || new Date().toISOString().split('T')[0];
    
    const todayRecs = db.attendance.filter(a => a.date === today);
    
    const setKPI = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setKPI('att-stat-present', todayRecs.filter(a => a.status === 'Present').length);
    setKPI('att-stat-half', todayRecs.filter(a => a.status === 'Half Day').length);
    setKPI('att-stat-absent', todayRecs.filter(a => a.status === 'Absent' || a.status === 'On Leave').length);
}

function renderAttTable() {
    const tbody = document.querySelector('#attendance-table tbody');
    if (!tbody || !db.attendance) return;

    const filterMonth = document.getElementById('filter-month-att')?.value || '';
    const searchQ = (document.getElementById('filter-search-att')?.value || '').toLowerCase();
    const limit = 25;

    let filtered = db.attendance.filter(a => {
        if (filterMonth && (!a.date || !a.date.startsWith(filterMonth))) return false;
        if (searchQ && !(a.name || '').toLowerCase().includes(searchQ)) return false;
        return true;
    });

    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    const startIndex = (window.attCurrentPage - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    if (paginated.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px; color:var(--text-muted);">No attendance records found.</td></tr>`;
        return;
    }

    let html = paginated.map(a => {
        let statusBadge = '';
        if (a.status === 'Present') statusBadge = '<span class="att-badge att-badge-present">● Present</span>';
        else if (a.status === 'Absent') statusBadge = '<span class="att-badge att-badge-absent">● Absent</span>';
        else if (a.status === 'Half Day') statusBadge = '<span class="att-badge att-badge-half">◑ Half Day</span>';
        else statusBadge = '<span class="att-badge att-badge-leave">◌ On Leave</span>';

        const displayDate = typeof formatDateIN === 'function' ? formatDateIN(a.date) : a.date;
        const safeId = escapeHTML(a.id).replace(/&#039;/g, "\\'");

        return `<tr style="border-bottom: 1px solid var(--border);">
            <td style="padding: 10px; color: var(--text-muted);">${displayDate}</td>
            <td style="padding: 10px;">
                <strong style="color: var(--text);">${escapeHTML(a.name)}</strong><br>
                <span style="font-size: 0.75rem; color: var(--primary);">${escapeHTML(a.shift || 'General')}</span>
            </td>
            <td style="padding: 10px;">${statusBadge}</td>
            <td style="padding: 10px; text-align: right;">
                <button class="danger" style="padding: 4px 8px; font-size: 0.75rem;" onclick="deleteAttendance('${safeId}')">Del</button>
            </td>
        </tr>`;
    }).join('');

    const totalPages = Math.ceil(filtered.length / limit) || 1;
    if (totalPages > 1) {
        html += `
        <tr><td colspan="4" style="text-align:center; padding: 10px; background: var(--surface) !important;">
            <button type="button" class="secondary" style="padding: 2px 8px; font-size:0.8rem;" onclick="window.attCurrentPage--; renderAttTable()" ${window.attCurrentPage <= 1 ? 'disabled' : ''}>◀ Prev</button>
            <span style="margin:0 15px; font-size:0.85rem; font-weight:bold;">Page ${window.attCurrentPage} of ${totalPages}</span>
            <button type="button" class="secondary" style="padding: 2px 8px; font-size:0.8rem;" onclick="window.attCurrentPage++; renderAttTable()" ${window.attCurrentPage >= totalPages ? 'disabled' : ''}>Next ▶</button>
        </td></tr>`;
    }

    tbody.innerHTML = html;
}

function renderAdvTable() {
    const tbody = document.querySelector('#advances-table tbody');
    if (!tbody || !db.hr_advances) return;

    const filterMonth = document.getElementById('filter-month-adv')?.value || '';
    const searchQ = (document.getElementById('filter-search-adv')?.value || '').toLowerCase();
    const limit = 25;

    let filtered = db.hr_advances.filter(a => {
        if (filterMonth && (!a.date || !a.date.startsWith(filterMonth))) return false;
        if (searchQ && !(a.name || '').toLowerCase().includes(searchQ)) return false;
        return true;
    });

    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    const startIndex = (window.advCurrentPage - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    if (paginated.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px; color:var(--text-muted);">No advances logged yet.</td></tr>`;
        return;
    }

    let html = paginated.map(a => {
        const displayDate = typeof formatDateIN === 'function' ? formatDateIN(a.date) : a.date;
        const safeId = escapeHTML(a.id).replace(/&#039;/g, "\\'");

        return `<tr style="border-bottom: 1px solid var(--border);">
            <td style="padding: 10px; color: var(--text-muted);">${displayDate}</td>
            <td style="padding: 10px;">
                <strong style="color: var(--text);">${escapeHTML(a.name)}</strong><br>
                <span style="font-size: 0.75rem; color: var(--text-muted);">${escapeHTML(a.ref || '—')}</span>
            </td>
            <td style="padding: 10px; color: var(--danger); font-weight: bold;">₹${a.amount.toFixed(2)}</td>
            <td style="padding: 10px; text-align: right;">
                <button class="danger" style="padding: 4px 8px; font-size: 0.75rem;" onclick="deleteAdvance('${safeId}')">Del</button>
            </td>
        </tr>`;
    }).join('');

    const totalPages = Math.ceil(filtered.length / limit) || 1;
    if (totalPages > 1) {
        html += `
        <tr><td colspan="4" style="text-align:center; padding: 10px; background: var(--surface) !important;">
            <button type="button" class="secondary" style="padding: 2px 8px; font-size:0.8rem;" onclick="window.advCurrentPage--; renderAdvTable()" ${window.advCurrentPage <= 1 ? 'disabled' : ''}>◀ Prev</button>
            <span style="margin:0 15px; font-size:0.85rem; font-weight:bold;">Page ${window.advCurrentPage} of ${totalPages}</span>
            <button type="button" class="secondary" style="padding: 2px 8px; font-size:0.8rem;" onclick="window.advCurrentPage++; renderAdvTable()" ${window.advCurrentPage >= totalPages ? 'disabled' : ''}>Next ▶</button>
        </td></tr>`;
    }

    tbody.innerHTML = html;
}

window.deleteAttendance = function(id) {
    if (typeof Enterprise !== 'undefined' && !Enterprise.security.canDelete()) return;
    if (!confirm('Delete this attendance record?')) return;
    
    db.attendance = db.attendance.filter(a => a.id !== id);
    if (typeof window.saveData === 'function') window.saveData(true);
    else if (typeof saveData === 'function') saveData(true);
    
    _lastAttCount = db.attendance.length;
    renderAttendanceWorkspace();
};

window.deleteAdvance = function(id) {
    if (typeof Enterprise !== 'undefined' && !Enterprise.security.canDelete()) return;
    if (!confirm('Delete this advance? It will also remove the payroll deduction.')) return;
    
    db.hr_advances = db.hr_advances.filter(a => a.id !== id);
    if (typeof window.saveData === 'function') window.saveData(true);
    else if (typeof saveData === 'function') saveData(true);
    
    _lastAdvCount = db.hr_advances.length;
    renderAttendanceWorkspace();
};

// ==========================================
// PAYSLIP ENGINE & REPORTS
// ==========================================

window.openPayslipModal = function() {
    const select = document.getElementById('ps-employee');
    if(!select || !db.attendance) return;

    // Get unique employees from this month
    const targetMonth = document.getElementById('ps-month').value || new Date().toISOString().substring(0, 7);
    const names = new Set();
    
    db.attendance.filter(a => a.date && a.date.startsWith(targetMonth)).forEach(a => {
        if(a.name) names.add(a.name);
    });

    let html = '<option value="">-- Select Employee --</option>';
    Array.from(names).sort().forEach(n => {
        html += `<option value="${escapeHTML(n)}">${escapeHTML(n)}</option>`;
    });

    select.innerHTML = html;

    const modal = document.getElementById('payslip-modal');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
};

window.closePayslipModal = function() {
    const modal = document.getElementById('payslip-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
};

window.executePayslipGeneration = function() {
    const empName = document.getElementById('ps-employee').value;
    const targetMonth = document.getElementById('ps-month').value;
    const baseSalary = parseFloat(document.getElementById('ps-salary').value);

    if(!empName || !targetMonth || isNaN(baseSalary)) {
        window.showToast("Please fill out all fields.", "warning");
        return;
    }

    // Process Payroll Logic
    const monthlyRecs = db.attendance.filter(a => a.name === empName && a.date && a.date.startsWith(targetMonth));
    const monthlyAdv  = db.hr_advances.filter(a => a.name === empName && a.date && a.date.startsWith(targetMonth));

    let pres = 0, abs = 0, half = 0, leave = 0, advTotal = 0;

    monthlyRecs.forEach(a => {
        if (a.status === 'Present') pres++;
        else if (a.status === 'Absent') abs++;
        else if (a.status === 'Half Day') half++;
        else if (a.status === 'On Leave') leave++;
    });

    monthlyAdv.forEach(adv => {
        advTotal += adv.amount;
    });

    // Assume 30 days in a month for standard calculation. 
    // Payable Days = Present + Paid Leaves + (Half Days * 0.5)
    const payableDays = pres + leave + (half * 0.5);
    
    // Per Day Salary
    const perDay = baseSalary / 30; 
    
    // Gross Salary Earned
    const grossSalary = perDay * payableDays;
    
    // Net Salary
    const netSalary = grossSalary - advTotal;

    const reportMonthStr = new Date(targetMonth + '-01').toLocaleString('default', { month:'long', year:'numeric' });
    const companyName = (db.profile && db.profile.name) ? escapeHTML(db.profile.name) : 'JFT Agro Overseas';

    const html = `<html><head><title>Payslip - ${escapeHTML(empName)}</title>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1e293b; background: var(--surface); }
        .wrapper { max-width: 800px; margin: 0 auto; border: 1px solid var(--border); padding: 40px; }
        h1 { text-align: center; margin: 0 0 5px 0; color: #0f172a; font-size: 24px; text-transform: uppercase; }
        h3 { text-align: center; margin: 0 0 30px 0; color: #64748b; font-weight: 400; font-size: 14px; }
        .grid-2 { display: table; width: 100%; margin-bottom: 30px; }
        .col { display: table-cell; width: 50%; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; }
        th, td { padding: 12px; border: 1px solid var(--border); text-align: left; }
        th { background: var(--bg); color: #334155; font-weight: bold; }
        .amt-col { text-align: right; }
        .total-row { font-weight: bold; background: var(--bg); font-size: 16px; }
        .sig-box { margin-top: 80px; width: 100%; display: table; }
        .sig-line { display: table-cell; width: 50%; text-align: center; }
        .sig-line span { border-top: 1px solid #000; padding-top: 5px; display: inline-block; width: 200px; }
    </style></head><body>
        <div class="wrapper">
            <h1>${companyName}</h1>
            <h3>Salary Slip - ${escapeHTML(reportMonthStr)}</h3>
            
            <div class="grid-2">
                <div class="col">
                    <b>Employee Name:</b> ${escapeHTML(empName)}<br><br>
                    <b>Base Monthly Salary:</b> ₹${baseSalary.toLocaleString('en-IN', {minimumFractionDigits:2})}<br>
                    <b>Calculated Per Day:</b> ₹${perDay.toLocaleString('en-IN', {minimumFractionDigits:2})}
                </div>
                <div class="col" style="text-align: right;">
                    <b>Total Days in Month:</b> 30<br><br>
                    <b>Days Present:</b> ${pres}<br>
                    <b>Half Days:</b> ${half} (0.5x)<br>
                    <b>Paid Leaves:</b> ${leave}<br>
                    <b>Total Payable Days:</b> <span style="color:#166534; font-weight:bold;">${payableDays}</span>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Earnings & Deductions Description</th>
                        <th class="amt-col">Amount (INR)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Gross Salary Earned (${payableDays} Days @ ₹${perDay.toFixed(2)})</td>
                        <td class="amt-col">₹${grossSalary.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                    </tr>
                    <tr>
                        <td style="color: #9f1239;">Less: Salary Advances & Deductions</td>
                        <td class="amt-col" style="color: #9f1239;">- ₹${advTotal.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                    </tr>
                    <tr class="total-row">
                        <td>NET PAYABLE SALARY</td>
                        <td class="amt-col" style="color:#166534;">₹${netSalary.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                    </tr>
                </tbody>
            </table>
            
            <p style="margin-top:20px; font-size:12px; color:#64748b; text-align:center;">This is a system generated document by JFT Enterprise.</p>
            
            <div class="sig-box">
                <div class="sig-line"><span>Employee Signature</span></div>
                <div class="sig-line"><span>Authorized HR Signatory</span></div>
            </div>
        </div>
    </body></html>`;

    const ipc = window.ipcRenderer;
    if (ipc) {
        if (typeof Enterprise !== 'undefined') Enterprise.notify('Generating Payslip PDF...', 'info');
        ipc.send('generate-pdf', html, `Payslip_${escapeHTML(empName).replace(/\s+/g, '_')}_${targetMonth}`);
    } else {
        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
        setTimeout(() => win.print(), 800);
    }
    
    closePayslipModal();
};

window.printMonthlyTimesheet = function() {
    if (typeof Enterprise !== 'undefined' && !Enterprise.security.isAdmin(true)) return;
    if (!db.attendance || !db.attendance.length) {
        if (typeof Enterprise !== 'undefined') Enterprise.notify('No attendance records found.', 'warning');
        return;
    }

    const targetDate  = document.getElementById('att-date')?.value || new Date().toISOString().split('T')[0];
    const targetMonth = targetDate.substring(0, 7);
    const monthlyRecs = db.attendance.filter(a => a.date && a.date.startsWith(targetMonth));
    const monthlyAdv  = db.hr_advances.filter(a => a.date && a.date.startsWith(targetMonth));

    if (!monthlyRecs.length) {
        if (typeof Enterprise !== 'undefined') Enterprise.notify('No records for ' + targetMonth + '.', 'warning');
        return;
    }

    const empData = {};
    monthlyRecs.forEach(a => {
        const name = escapeHTML(a.name);
        if (!empData[name]) empData[name] = { present:0, absent:0, half:0, leave:0, advances:0 };
        if (a.status === 'Present')  empData[name].present++;
        if (a.status === 'Absent')   empData[name].absent++;
        if (a.status === 'Half Day') empData[name].half++;
        if (a.status === 'On Leave') empData[name].leave++;
    });
    monthlyAdv.forEach(adv => {
        const name = escapeHTML(adv.name);
        if (!empData[name]) empData[name] = { present:0, absent:0, half:0, leave:0, advances:0 };
        empData[name].advances += adv.amount;
    });

    let rowsHTML = '';
    Object.keys(empData).sort().forEach(name => {
        const d = empData[name];
        const payable = d.present + d.leave + (d.half * 0.5);
        rowsHTML += `<tr>
            <td style="text-align:left;"><b>${escapeHTML(name)}</b></td>
            <td>${d.present}</td><td>${d.half}</td>
            <td style="color:#dc2626; font-weight:bold;">${d.absent}</td>
            <td style="background:rgba(34, 197, 94, 0.05); font-weight:bold; color:#166534;">${payable} Days</td>
            <td style="color:#9f1239; font-weight:bold;">${d.advances > 0 ? '₹' + d.advances.toFixed(2) : '—'}</td>
        </tr>`;
    });

    const reportMonth = new Date(targetMonth + '-01').toLocaleString('default', { month:'long', year:'numeric' });
    const companyName = (db.profile && db.profile.name) ? escapeHTML(db.profile.name) : 'JFT Agro Overseas';

    const html = `<html><head><title>Master Payroll — ${escapeHTML(reportMonth)}</title>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1e293b; }
        h1 { text-align: center; margin: 0 0 5px 0; color: #0f172a; font-size: 1.8rem; }
        h3 { text-align: center; margin: 0 0 30px 0; color: #64748b; font-weight: 400; font-size: 1rem; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 0.9rem; text-align: center; }
        th, td { padding: 12px 14px; border: 1px solid var(--border); }
        th { background: var(--bg); color: #334155; font-weight: 700; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.5px; }
        tr:nth-child(even) { background: var(--bg); }
        .footer { font-size: 0.75rem; color: #94a3b8; margin-top: 20px; text-align: center; }
        .sig { margin-top: 60px; text-align: right; padding-right: 60px; font-weight: bold; }
        .sig-line { border-top: 1px solid #334155; display: inline-block; padding-top: 6px; width: 200px; text-align: center; }
    </style></head><body>
        <h1>${companyName}</h1>
        <h3>Master Monthly Payroll &amp; Advance Report — <strong>${escapeHTML(reportMonth)}</strong></h3>
        <table>
            <thead><tr>
                <th style="text-align:left;">Employee Name</th>
                <th>Full Days</th><th>Half Days</th><th>Days Absent</th>
                <th>Total Payable Days</th><th style="color:#9f1239;">Advances (₹)</th>
            </tr></thead>
            <tbody>${rowsHTML}</tbody>
        </table>
        <p class="footer">*Total Payable Days includes approved paid leaves. This report is system-generated by JFT Enterprise HR module.</p>
        <div class="sig"><div class="sig-line">HR / Admin Signature</div></div>
    </body></html>`;

    const ipc = window.ipcRenderer;
    if (ipc) {
        if (typeof Enterprise !== 'undefined') Enterprise.notify('Generating Master Payroll PDF...', 'info');
        ipc.send('generate-pdf', html, 'Master_Payroll_' + escapeHTML(targetMonth));
    } else {
        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
        setTimeout(() => win.print(), 800);
    }
};


