# SMA ERP — Build & Deploy Guide
**JFT AGRO OVERSEAS LLP**

---

## What You'll Get

Running the build produces:
```
SMA-ERP-PRODUCTION/
  SMA ERP Setup 8.3.0.exe   ← installer for any Windows PC
```

Install it on your PC → opens the app → logs in to Firebase → syncs all data → backs up to local drive.

---

## Prerequisites (one-time setup)

### 1. Install Node.js
Download from **https://nodejs.org** → choose the **LTS** version → install with defaults.

To verify: open Command Prompt and type `node -v` → should show a version number.

### 2. Place All Fixed Files in Your Project
Copy these files (from the audit output) into your project root folder, overwriting the originals:

| File | Action |
|---|---|
| `db.js` | Replace |
| `enterprise.js` | Replace |
| `finance.js` | Replace |
| `electron.cjs` | Replace |
| `vite.config.js` | Add this new file |
| `vite_config.js` | **Delete** the old one |
| `settings_backup.js` | Paste contents at the end of your existing `settings.js` |

---

## Build the .EXE

### Option A — Double-click (easiest)
1. Copy `BUILD.bat` into your project root folder
2. Double-click it
3. Wait ~3–5 minutes
4. Find the installer in `SMA-ERP-PRODUCTION\`

### Option B — Manual (Command Prompt)
Open Command Prompt in your project folder:
```cmd
npm install
npm run build
npm run pack-pc
```

---

## Install on a PC

1. Copy `SMA ERP Setup 8.3.0.exe` to the target PC
2. Double-click → click Next → installs to `C:\Program Files\SMA ERP\`
3. Desktop shortcut is created automatically
4. Open the app → login with your Firebase credentials

---

## Backup System — How It Works

### Drive/Folder Structure
Once you set a backup folder (e.g. `D:\JFT_Backups` or a USB drive), the system creates:

```
D:\JFT_Backups\
  Monday\      JFT_Backup_Monday.json
  Tuesday\     JFT_Backup_Tuesday.json
  Wednesday\   JFT_Backup_Wednesday.json
  Thursday\    JFT_Backup_Thursday.json
  Friday\      JFT_Backup_Friday.json
  Saturday\    JFT_Backup_Saturday.json
  Sunday\      JFT_Backup_Sunday.json
```

### When Does It Back Up?
| Trigger | Frequency |
|---|---|
| App startup | 30 seconds after login |
| Auto-scheduler | Every 60 minutes while app is open |
| Manual button | Immediately on click |
| App close | Forced before quitting |

### The Weekly Rotation Rule
- Monday's backup saves to `Monday\JFT_Backup_Monday.json`
- The **following Monday** it overwrites that same file
- You always have 7 backups — one per day of the week
- **No accumulation** — disk space stays constant

### AppData Backup (always on, no setup needed)
Even without a configured drive, the app saves the last 7 local backups to:
```
C:\Users\YourName\AppData\Roaming\SMA ERP\JFT_AppData_Backups\
```

---

## Set Up the Backup Drive (first time)

1. Open the app → go to **Settings → Backup System**
2. Click **"Change Drive"**
3. Select your folder (e.g. a USB drive or a cloud-synced folder like `D:\OneDrive\JFT_Backups`)
4. A backup runs immediately to confirm it works
5. The **Weekly Backup Calendar** panel shows ✅ for days that have been backed up

---

## Recommended Drive Setup

For maximum safety, point the backup to a folder that's also synced to cloud:

| Option | How |
|---|---|
| **OneDrive** | `C:\Users\Name\OneDrive\JFT_Backups` |
| **Google Drive** | `C:\Users\Name\Google Drive\JFT_Backups` |
| **USB Drive** | `E:\JFT_Backups` (plug in before opening app) |
| **NAS / Network Drive** | `\\NAS\JFT_Backups` |

This gives you: local drive backup + cloud copy automatically.

---

## Restoring from Backup

If you ever need to restore:
1. Open the app → **Settings → Backup System → Download JSON Backup**
   (or find the `.json` file in the day folder)
2. Go to **Settings → System → Import Database**
3. Select the `.json` file → data is restored

Or if the app won't open: copy the JSON file and contact your admin.

---

## Troubleshooting Build Errors

| Error | Fix |
|---|---|
| `node not found` | Install Node.js from nodejs.org |
| `vite build failed` | Run `npm install` first, then try again |
| `electron-builder failed` | Run `npm install electron-builder --save-dev` |
| `icon.ico not found` | Add an `assets/icon.ico` file (any 256x256 .ico) |
| `cannot be installed — Windows protected` | Right-click installer → Properties → Unblock |

---

*Built with Electron + Firebase + Vite — SMA ERP v8.3.0*
