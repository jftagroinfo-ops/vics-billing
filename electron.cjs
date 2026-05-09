/* ============================================================
   SMA ERP — ELECTRON MAIN PROCESS
   JFT AGRO OVERSEAS LLP

   BACKUP SYSTEM:
   ▸ AppData backup  — every sync (debounced 3s), keeps last 7
   ▸ Weekly rotating — Mon/Tue/Wed/Thu/Fri/Sat/Sun folders
     Each day has ONE file. Next week it overwrites it.
   ▸ Hourly auto-trigger to drive (if path configured)
   ▸ Exit backup — forced before app closes
   ============================================================ */

try { require('dotenv').config(); } catch (e) { /* production */ }

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path   = require('path');
const fs     = require('fs');
const { spawn } = require('child_process');

let mainWindow;
let backupTimeout;
let weeklyBackupInterval;
let isGeneratingPDF = false;
let isQuitting      = false;

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const SECURE_ENV_ALLOWLIST = [
    'SENDGRID_API_KEY','EXCHANGE_RATE_API_KEY',
    'GEMINI_API_KEY','OPENAI_API_KEY','GMAIL_CLIENT_ID'
];

app.commandLine.appendSwitch(
    'disable-features','TrackingPrevention,CookieDeprecationFacilitatedTesting'
);

// ─────────────────────────────────────────────────────────────
// WINDOW
// ─────────────────────────────────────────────────────────────
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400, height: 900, minWidth: 1024, minHeight: 768,
        icon: path.join(__dirname, 'assets/icon.ico'),
        webPreferences: {
            nodeIntegration:    false,
            contextIsolation:   true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.cjs')
        }
    });
    mainWindow.setMenuBarVisibility(false);
    mainWindow.loadFile('index.html');

    // Intercept close → mandatory backup before quit
    mainWindow.on('close', (e) => {
        if (!isQuitting) {
            e.preventDefault();
            mainWindow.webContents.send('initiate-exit-backup');

            // FORCE-CLOSE SAFETY NET:
            // If frontend doesn't respond within 4 seconds (login screen,
            // JS error, or db.js not loaded yet) — force quit anyway.
            // This guarantees the X button ALWAYS closes the app.
            setTimeout(() => {
                if (!isQuitting) {
                    console.log('[SYSTEM] Force-close timeout. Quitting now.');
                    isQuitting = true;
                    app.quit();
                }
            }, 4000);
        }
    });
}

app.whenReady().then(() => {
    createWindow();
    startWeeklyBackupScheduler();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (weeklyBackupInterval) clearInterval(weeklyBackupInterval);
    if (process.platform !== 'darwin') app.quit();
});

// ─────────────────────────────────────────────────────────────
// BACKUP STATUS FILE
// Saved in: %APPDATA%\SMA ERP\backup_status.json
// Tracks last backup time per day so UI can show it
// ─────────────────────────────────────────────────────────────
function getStatusPath() {
    return path.join(app.getPath('userData'), 'backup_status.json');
}
function readBackupStatus() {
    try {
        const p = getStatusPath();
        if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch(e) {}
    return {};
}
function writeBackupStatus(status) {
    try { fs.writeFileSync(getStatusPath(), JSON.stringify(status, null, 2)); } catch(e) {}
}

// ─────────────────────────────────────────────────────────────
// WEEKLY ROTATING BACKUP
//
// Drive structure:
//   D:\JFT_Backups\
//     Monday\     JFT_Backup_Monday.json   ← replaced every Monday
//     Tuesday\    JFT_Backup_Tuesday.json
//     Wednesday\  ...
//     Thursday\
//     Friday\
//     Saturday\
//     Sunday\
// ─────────────────────────────────────────────────────────────
function performWeeklyBackup(folderPath, dbState) {
    const day       = DAYS[new Date().getDay()];
    const targetDir = path.join(folderPath, day);

    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    // One file per day — overwrites last week's same-day backup automatically
    const filePath = path.join(targetDir, `JFT_Backup_${day}.json`);
    const payload  = {
        _backupMeta: {
            day,
            timestamp:  new Date().toISOString(),
            humanTime:  new Date().toLocaleString('en-IN'),
            appVersion: '8.3.0'
        },
        ...dbState
    };

    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));

    // Update per-day status log
    const status  = readBackupStatus();
    status[day]   = {
        lastBackup: new Date().toISOString(),
        humanTime:  new Date().toLocaleString('en-IN'),
        path:       filePath,
        sizeKB:     Math.round(fs.statSync(filePath).size / 1024)
    };
    writeBackupStatus(status);

    console.log(`[BACKUP] ✅ ${day} → ${filePath}`);
    return { success: true, path: filePath, day, timestamp: new Date().toLocaleTimeString() };
}

// ─────────────────────────────────────────────────────────────
// SCHEDULER — triggers every 60 min while app is open
// Frontend listens for 'request-auto-backup', reads db & path,
// and sends back 'auto-backup-data' with the actual data.
// ─────────────────────────────────────────────────────────────
function startWeeklyBackupScheduler() {
    if (weeklyBackupInterval) clearInterval(weeklyBackupInterval);

    // First run: 30 seconds after app starts (catches missed overnight backup)
    setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('request-auto-backup');
        }
    }, 30 * 1000);

    // Then every 60 minutes
    weeklyBackupInterval = setInterval(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('request-auto-backup');
        }
    }, 60 * 60 * 1000);
}

// ─────────────────────────────────────────────────────────────
// IPC HANDLERS
// ─────────────────────────────────────────────────────────────

// Environment variables (no hardcoded fallbacks — enter keys in Settings)
ipcMain.handle('get-secure-env', (event, key) => {
    if (SECURE_ENV_ALLOWLIST.includes(key)) {
        const val = process.env[key];
        if (val) return val;
    }
    return null;
});

// ── AppData local backup (debounced, keeps last 7 files) ────
ipcMain.on('trigger-local-backup', (event, dbState) => {
    if (backupTimeout) clearTimeout(backupTimeout);

    backupTimeout = setTimeout(() => {
        const folder = path.join(app.getPath('userData'), 'JFT_AppData_Backups');
        if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

        // Rolling 7-file limit
        try {
            const files = fs.readdirSync(folder)
                .filter(f => f.endsWith('.json'))
                .map(f => ({ name: f, mtime: fs.statSync(path.join(folder, f)).mtimeMs }))
                .sort((a, b) => b.mtime - a.mtime);
            files.slice(7).forEach(f => {
                try { fs.unlinkSync(path.join(folder, f.name)); } catch(e) {}
            });
        } catch(e) {}

        const ts   = new Date().toISOString().replace(/[:.]/g, '-');
        const file = path.join(folder, `JFT_Local_${ts}.json`);
        fs.writeFile(file, JSON.stringify(dbState, null, 2), (err) => {
            if (err) console.error("AppData backup failed:", err);
            else     console.log("✅ AppData backup:", file);
        });
    }, 3000);
});

// ── Weekly drive backup triggered by frontend (manual or auto) ──
ipcMain.on('save-master-hard-drive-backup', (event, folderPath, dbState) => {
    try {
        const result = performWeeklyBackup(folderPath, dbState);
        event.reply('master-backup-status', result);
    } catch(e) {
        console.error("Weekly backup failed:", e);
        event.reply('master-backup-status', { success: false, error: e.message });
    }
});

// ── Auto-backup: frontend sends data in response to 'request-auto-backup' ──
ipcMain.on('auto-backup-data', (event, folderPath, dbState) => {
    if (!folderPath || !dbState) return;
    try {
        const result = performWeeklyBackup(folderPath, dbState);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('auto-backup-complete', result);
        }
    } catch(e) {
        console.error("Auto backup error:", e);
    }
});

// ── Backup status for all 7 days → sent to Settings UI ──────
ipcMain.handle('get-backup-status', () => readBackupStatus());

// ── Folder picker dialog ─────────────────────────────────────
ipcMain.handle('select-external-backup-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title:      'Select Drive / Folder for Weekly Backups',
        properties: ['openDirectory']
    });
    if (!canceled && filePaths.length > 0) return filePaths[0];
    return null;
});

// ── One-off export backup ────────────────────────────────────
ipcMain.on('save-external-backup', (event, folderPath, dbState) => {
    try {
        const ts   = new Date().toISOString().replace(/[:.]/g, '-');
        const file = path.join(folderPath, `JFT_Export_${ts}.json`);
        fs.writeFileSync(file, JSON.stringify(dbState, null, 2));
        event.reply('external-backup-success', file);
    } catch(e) {
        event.reply('external-backup-error', e.message);
    }
});

// ── Confirm exit ─────────────────────────────────────────────
ipcMain.on('confirm-exit', () => { isQuitting = true; app.quit(); });

// ─────────────────────────────────────────────────────────────
// PDF GENERATION
// ─────────────────────────────────────────────────────────────
ipcMain.on('generate-pdf', async (event, htmlContent, filename) => {
    if (isGeneratingPDF) return;
    isGeneratingPDF = true;

    const printWin = new BrowserWindow({ show: false });
    printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    const timeout = setTimeout(() => {
        event.reply('pdf-error', 'PDF generation timed out.');
        if (!printWin.isDestroyed()) printWin.close();
        isGeneratingPDF = false;
    }, 10000);

    printWin.webContents.on('did-fail-load', () => {
        clearTimeout(timeout);
        event.reply('pdf-error', 'Document failed to render.');
        if (!printWin.isDestroyed()) printWin.close();
        isGeneratingPDF = false;
    });

    printWin.webContents.on('did-finish-load', async () => {
        clearTimeout(timeout);
        try {
            const pdfData = await printWin.webContents.printToPDF({
                printBackground: true, pageSize: 'A4', marginsType: 0
            });
            const defaultPath = path.join(
                app.getPath('documents'),
                filename.endsWith('.pdf') ? filename : `${filename}.pdf`
            );
            const { filePath } = await dialog.showSaveDialog(mainWindow, {
                title: 'Save PDF', defaultPath,
                filters: [{ name: 'PDF Documents', extensions: ['pdf'] }]
            });
            if (filePath) {
                fs.writeFileSync(filePath, pdfData);
                event.reply('pdf-success', filePath);
            }
        } catch(err) {
            event.reply('pdf-error', err.message);
        } finally {
            if (!printWin.isDestroyed()) printWin.close();
            isGeneratingPDF = false;
        }
    });
});

// ─────────────────────────────────────────────────────────────
// UPDATE INSTALLER
// ─────────────────────────────────────────────────────────────
ipcMain.on('execute-update-installer', (event, installerPath) => {
    const sub = spawn(installerPath, [], { detached: true, stdio: 'ignore' });
    sub.unref();
    isQuitting = true;
    app.quit();
});
