/* ============================================================
   BACKUP DASHBOARD — Add this block to settings.js
   Paste at the END of settings.js, before the last closing line.

   Also add this HTML inside your settings tab's Backup section:
   See the HTML block at the bottom of this file.
   ============================================================ */

// ─────────────────────────────────────────────────────────────
// BACKUP PATH: Change / Set
// ─────────────────────────────────────────────────────────────
window.changeMasterBackupPath = async function() {
    if (!ipcRenderer) {
        return Enterprise.notify("This feature requires the Desktop App (SMA ERP.exe).", "warning");
    }

    const selectedPath = await ipcRenderer.invoke('select-external-backup-folder');
    if (selectedPath) {
        if (!db.meta) db.meta = {};
        db.meta.masterBackupPath = selectedPath;
        if (typeof saveData === 'function') saveData(true);

        const display = document.getElementById('master-backup-path-display');
        if (display) {
            display.innerText = selectedPath;
            display.style.color = 'var(--success)';
        }

        Enterprise.notify(`✅ Backup path set: ${selectedPath}`, "success");
        Enterprise.logAction(`Backup path configured: ${selectedPath}`);

        // Immediately run first backup to confirm it works
        ipcRenderer.send('auto-backup-data', selectedPath, window.db);
    }
};

// ─────────────────────────────────────────────────────────────
// MANUAL BACKUP: Trigger immediately
// ─────────────────────────────────────────────────────────────
window.triggerManualMasterBackup = function() {
    if (!db.meta?.masterBackupPath) {
        return Enterprise.notify("Set a backup folder first using the 'Change Drive' button.", "warning");
    }
    if (!ipcRenderer) {
        return Enterprise.notify("Desktop App required for drive backup.", "warning");
    }

    Enterprise.notify("🚀 Running backup...", "info");
    ipcRenderer.send('save-master-hard-drive-backup', db.meta.masterBackupPath, window.db);
};

// ─────────────────────────────────────────────────────────────
// DOWNLOAD MANUAL JSON BACKUP (browser download, no drive needed)
// ─────────────────────────────────────────────────────────────
window.downloadManualBackup = function() {
    if (!window.db) return;
    const data  = JSON.stringify(window.db, null, 2);
    const blob  = new Blob([data], { type: 'application/json' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href      = url;
    a.download  = `JFT_Full_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    const timeEl = document.getElementById('set-last-backup');
    if (timeEl) timeEl.innerText = `Last Download: ${new Date().toLocaleString()}`;
    Enterprise.notify("Emergency JSON Backup downloaded.", "success");
    Enterprise.logAction("Manual JSON backup downloaded.");
};

// ─────────────────────────────────────────────────────────────
// RENDER BACKUP STATUS DASHBOARD
// Shows last backup time for each day of the week
// ─────────────────────────────────────────────────────────────
window.renderBackupStatusDashboard = async function() {
    const container = document.getElementById('backup-weekly-status');
    if (!container) return;

    const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const today = DAYS[(new Date().getDay() + 6) % 7]; // JS Sun=0, shift to Mon=0

    // Get status from Electron (has per-day timestamps)
    let status = {};
    if (ipcRenderer) {
        try { status = await ipcRenderer.invoke('get-backup-status') || {}; } catch(e) {}
    }

    container.innerHTML = DAYS.map(day => {
        const info      = status[day];
        const isToday   = day === today;
        const hasBak    = !!info?.lastBackup;
        const lastTime  = hasBak
            ? new Date(info.lastBackup).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
            : 'No backup yet';
        const sizeStr   = hasBak ? `${info.sizeKB} KB` : '';
        const color     = hasBak ? '#10b981' : '#ef4444';
        const icon      = hasBak ? '✅' : '⬜';
        const border    = isToday ? '2px solid var(--primary)' : '1px solid var(--border)';

        return `
        <div style="border:${border}; border-radius:10px; padding:14px 16px; background:var(--surface);
                    display:flex; align-items:center; gap:12px;">
            <div style="font-size:1.4rem;">${icon}</div>
            <div style="flex:1;">
                <div style="font-weight:700; font-size:0.9rem; color:var(--text);">
                    ${day}${isToday ? ' <span style="font-size:0.7rem; background:var(--primary); color:#fff; padding:1px 6px; border-radius:3px; margin-left:4px;">TODAY</span>' : ''}
                </div>
                <div style="font-size:0.78rem; color:${color}; margin-top:2px;">${lastTime}</div>
                ${sizeStr ? `<div style="font-size:0.72rem; color:var(--text-muted);">${sizeStr}</div>` : ''}
            </div>
        </div>`;
    }).join('');
};

// ─────────────────────────────────────────────────────────────
// LISTEN FOR BACKUP EVENTS FROM ELECTRON
// ─────────────────────────────────────────────────────────────
if (ipcRenderer) {
    // Weekly backup result (manual or auto)
    ipcRenderer.on('master-backup-status', (event, response) => {
        if (response.success) {
            Enterprise.notify(`✅ Backup complete! [${response.day}] saved to drive.`, "success");
            const timeEl = document.getElementById('set-last-backup');
            if (timeEl) timeEl.innerText = `Drive Backup: ${response.day} @ ${response.timestamp}`;
            Enterprise.logAction(`Weekly backup written: ${response.day} folder updated.`);
            // Refresh the status dashboard if visible
            window.renderBackupStatusDashboard();
        } else {
            Enterprise.notify(`❌ Backup Failed: ${response.error}`, "danger");
        }
    });

    // Auto-backup complete (from scheduler)
    ipcRenderer.on('auto-backup-complete', (event, result) => {
        const timeEl = document.getElementById('last-backup-time');
        if (timeEl) timeEl.innerText = `Drive: ${result.day} @ ${result.timestamp}`;
        window.renderBackupStatusDashboard();
    });
}

/* ============================================================
   HTML TO ADD TO YOUR SETTINGS.HTML (Backup Section)
   Place this inside your settings tab where backup controls go.
   Replace or extend your existing backup card.
   ============================================================

<div class="card" style="margin-bottom:20px;">
    <h3 style="font-weight:700; margin-bottom:5px;">🗄️ Drive Backup System</h3>
    <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:20px;">
        Automatically backs up all data to a local drive or USB. Each day of the week gets
        its own folder. Next Monday's backup overwrites last Monday's — keeping 7 copies at all times.
    </p>

    <!-- Backup Path -->
    <div style="background:var(--bg); border:1px solid var(--border); border-radius:8px; padding:14px; margin-bottom:16px;">
        <label style="font-size:0.8rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Backup Drive / Folder</label>
        <div style="display:flex; align-items:center; gap:10px; margin-top:8px;">
            <div id="master-backup-path-display" style="flex:1; font-size:0.9rem; color:var(--text-muted); font-family:monospace; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                Not configured
            </div>
            <button onclick="changeMasterBackupPath()" style="white-space:nowrap;">📁 Change Drive</button>
        </div>
    </div>

    <!-- Action Buttons -->
    <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:20px;">
        <button onclick="triggerManualMasterBackup()" style="background:var(--primary); color:#fff;">
            💾 Backup Now (Drive)
        </button>
        <button onclick="downloadManualBackup()" class="secondary">
            ⬇️ Download JSON Backup
        </button>
    </div>

    <div id="set-last-backup" style="font-size:0.8rem; color:var(--text-muted); margin-bottom:20px;">
        Last Drive Backup: Never
    </div>

    <!-- Weekly Status Grid -->
    <div style="font-weight:700; font-size:0.85rem; margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid var(--border);">
        📅 Weekly Backup Calendar
    </div>
    <div id="backup-weekly-status" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(180px,1fr)); gap:10px; margin-bottom:10px;">
        <div style="color:var(--text-muted); font-size:0.85rem;">Loading backup status...</div>
    </div>
    <p style="font-size:0.75rem; color:var(--text-muted); margin-top:8px;">
        ℹ️ Backups run automatically every 60 minutes while the app is open.
        Each day folder keeps one file — replaced the same day next week.
    </p>
</div>

============================================================ */
