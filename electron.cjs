try {
    require('dotenv').config();
} catch (error) {
    console.log("Production mode: skipping dotenv");
}
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindow;
let backupTimeout; 
let isGeneratingPDF = false;
let isQuitting = false; // Prevents default exit until backup is done

// ALLOW LIST for Environment Variables to prevent arbitrary host data exposure
// ALLOW LIST for Environment Variables to prevent arbitrary host data exposure
const SECURE_ENV_ALLOWLIST = [
    'SENDGRID_API_KEY', 
    'EXCHANGE_RATE_API_KEY', 
    'GEMINI_API_KEY', 
    'OPENAI_API_KEY',
    'GMAIL_CLIENT_ID'
];

// REPAIRED: Resolve GAPI storage blockage by disabling specific Tracking Prevention flags
app.commandLine.appendSwitch('disable-features', 'TrackingPrevention,CookieDeprecationFacilitatedTesting');

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    icon: path.join(__dirname, 'assets/icon.ico'),
    webPreferences: {
      nodeIntegration: false, 
      contextIsolation: true, 
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile('index.html');

  // NEW: Intercept close for Mandatory Backup on Exit (Req 24)
  mainWindow.on('close', (e) => {
      if (!isQuitting) {
          e.preventDefault();
          // Ask frontend to capture DB state and start the mandatory exit backup flow
          mainWindow.webContents.send('initiate-exit-backup');
      }
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// SECURE IPC BRIDGE FOR ENV VARIABLES (FIXED: Whitelisted)
ipcMain.handle('get-secure-env', (event, key) => {
    if (SECURE_ENV_ALLOWLIST.includes(key)) {
        const val = process.env[key];
        if (val) return val;
        
        // Internal Defaults (Securely held in Main Process)
        const DEFAULTS = {
            'GEMINI_API_KEY': 'AIzaSyCRubhGsuugQThhxkURvvzt2dkwVCNu8QM',
            'OPENAI_API_KEY': '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'
        };
        return DEFAULTS[key] || null;
    }
    console.warn(`[SECURITY] Blocked unauthorized env variable request: ${key}`);
    return null; 
});

// DEBOUNCED LOCAL BACKUP & IMMEDIATE EXIT BACKUP (Req 24)
ipcMain.on('trigger-local-backup', (event, dbState, isExitBackup = false) => {
    if (backupTimeout) clearTimeout(backupTimeout);
    
    // If it's an exit backup, execute immediately without debounce
    const delay = isExitBackup ? 0 : 3000;

    backupTimeout = setTimeout(() => {
        const backupFolder = path.join(app.getPath('userData'), 'JFT_Backups');
        if (!fs.existsSync(backupFolder)){ fs.mkdirSync(backupFolder, { recursive: true }); }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(backupFolder, `JFT_Data_Backup_${timestamp}.json`);
        
        fs.writeFile(backupPath, JSON.stringify(dbState, null, 2), (err) => {
            if (err) {
                console.error("Local backup failed:", err);
                if (isExitBackup) event.reply('exit-backup-failed', err.message);
            } else {
                console.log("✅ Local backup safely saved at:", backupPath);
                if (isExitBackup) event.reply('exit-backup-success', backupPath);
            }
        });
    }, delay);
});

// NEW: Handle Additional External Backup (Req 24)
ipcMain.handle('select-external-backup-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: 'Select External Drive/Folder for Additional Backup',
        properties: ['openDirectory']
    });
    if (!canceled && filePaths.length > 0) return filePaths[0];
    return null;
});

ipcMain.on('save-external-backup', (event, folderPath, dbState) => {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(folderPath, `JFT_Data_Backup_External_${timestamp}.json`);
        fs.writeFileSync(backupPath, JSON.stringify(dbState, null, 2));
        event.reply('external-backup-success', backupPath);
    } catch(e) {
        console.error("External backup failed:", e);
        event.reply('external-backup-error', e.message);
    }
});

// MASTER HARD DRIVE BACKUP CYCLE (Req: Daily Overwrite Rotation)
ipcMain.on('save-master-hard-drive-backup', (event, folderPath, dbState) => {
    try {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDay = days[new Date().getDay()];
        const targetDir = path.join(folderPath, currentDay);
        
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        
        const backupPath = path.join(targetDir, `JFT_Master_Data_${currentDay}.json`);
        
        // Use synchronous write to ensure data is locked before return
        fs.writeFileSync(backupPath, JSON.stringify(dbState, null, 2));
        
        // Log to console for dev awareness
        console.log(`[MASTER_BACKUP] Saved to: ${backupPath}`);
        
        event.reply('master-backup-status', { 
            success: true, 
            path: backupPath, 
            day: currentDay, 
            timestamp: new Date().toLocaleTimeString() 
        });
    } catch (e) {
        console.error("Master Hard Drive backup failed:", e);
        event.reply('master-backup-status', { success: false, error: e.message });
    }
});

// NEW: Confirm App Exit once backups are finished
ipcMain.on('confirm-exit', () => {
    isQuitting = true;
    app.quit();
});

// ENTERPRISE SILENT PDF GENERATION (WITH DEBOUNCE FIX & DEADLOCK PREVENTION)
ipcMain.on('generate-pdf', async (event, htmlContent, filename) => {
    if (isGeneratingPDF) return; 
    isGeneratingPDF = true;

    let printWin = new BrowserWindow({ show: false });
    printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    // DEADLOCK PREVENTION: 10-second timeout
    const pdfTimeout = setTimeout(() => {
        if (isGeneratingPDF) {
            console.error("PDF Engine Error: Generation timed out.");
            event.reply('pdf-error', 'PDF Generation timed out.');
            if (!printWin.isDestroyed()) printWin.close();
            isGeneratingPDF = false;
        }
    }, 10000);

    printWin.webContents.on('did-fail-load', () => {
        clearTimeout(pdfTimeout);
        console.error("PDF Engine Error: Content failed to load.");
        event.reply('pdf-error', 'Document failed to render properly.');
        if (!printWin.isDestroyed()) printWin.close();
        isGeneratingPDF = false;
    });

    printWin.webContents.on('did-finish-load', async () => {
        clearTimeout(pdfTimeout);
        try {
            const pdfData = await printWin.webContents.printToPDF({
                printBackground: true,
                pageSize: 'A4',
                marginsType: 0
            });

            const defaultPath = path.join(app.getPath('documents'), filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
            const { filePath } = await dialog.showSaveDialog(mainWindow, {
                title: 'Save Invoice PDF',
                defaultPath: defaultPath,
                filters: [{ name: 'PDF Documents', extensions: ['pdf'] }]
            });

            if (filePath) {
                fs.writeFileSync(filePath, pdfData);
                event.reply('pdf-success', filePath);
            }
        } catch (error) {
            console.error("PDF Engine Error:", error);
            event.reply('pdf-error', error.message);
        } finally {
            if (!printWin.isDestroyed()) printWin.close();
            isGeneratingPDF = false; 
        }
    });
});

// REAL SYSTEM UPDATER: Launch .exe and quit current app
ipcMain.on('execute-update-installer', (event, installerPath) => {
    console.log("Launching system update:", installerPath);
    
    // Launch the .exe installer completely detached from the app
    const subprocess = spawn(installerPath, [], {
        detached: true,
        stdio: 'ignore'
    });
    subprocess.unref();

    // Force quit the JFT app immediately so the installer can overwrite the files
    isQuitting = true; // Bypass mandatory backup when updating
    app.quit();
});