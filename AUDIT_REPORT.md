# SMA ERP — Full System Audit Report
**Date:** 2026-05-09  
**Version Audited:** 8.3.0  
**Audited By:** Claude (Anthropic)  
**Status: PRODUCTION-READY AFTER APPLYING FIXES BELOW**

---

## EXECUTIVE SUMMARY

The codebase is architecturally sound — Firebase/Firestore integration, role-based auth, multi-tenant structure, real-time sync, and financial logic are all correctly designed. However, **9 issues** were found ranging from critical security risks to simulated/fake data that must not reach production. All fixes have been applied in the delivered files.

---

## 🔴 CRITICAL — Must Fix Before Any Real Business Data Is Entered

### 1. Hardcoded API Keys Exposed in Source Code
**Files:** `enterprise.js` (line 240–241), `electron.cjs` (line 76–78)  
**Risk:** Anyone who views your source code or decompiles the Electron app gets free access to your Gemini and OpenAI accounts, leading to billing fraud and data exposure.  
**Fix Applied:** All hardcoded fallback keys removed. The app will use only keys entered by the user in Settings → AI Configuration. If no key is entered, the offline heuristic mode activates cleanly.

### 2. Simulated / Fake Market Data Shown as Real
**File:** `enterprise.js` — `syncPulse()` function  
**Problem:**  
- Oil price was `82.00 + (Math.random() * 5)` — a random number, not real data  
- DXY (Dollar Index) was mathematically estimated from USD/INR — not real  
- Gold was estimated from a USD/INR shift — not real  
**Risk:** You could make real hedging/procurement decisions based on fake numbers.  
**Fix Applied:** Simulated calculations removed. Only the USD/INR rate (fetched live from `open.er-api.com`) is shown. Oil, DXY, and Gold fields are removed from the display to avoid showing false data. The live rate feeds correctly into Forex, PnL, and Stress Test calculations.

### 3. Default '1234' Hardcoded PIN for Session Unlock
**File:** `enterprise.js` — `unlockSession()` function  
**Problem:** Any person who knows "1234" can unlock any locked session on any machine, bypassing the 5-minute idle security lock entirely.  
**Fix Applied:** The `1234` fallback is removed. Session unlock requires the user's actual Firebase password (online) or the password stored in their user record (offline). No default PIN exists.

---

## 🟠 HIGH — Build-Breaking Bug

### 4. Vite Config File Named Incorrectly
**File:** `vite_config.js`  
**Problem:** Vite automatically looks for `vite.config.js` (with a dot), not `vite_config.js` (with an underscore). This means when you run `npm run dev` or `npm run build`, the entire Vite config (PWA plugin, proxy rules, workbox) is silently ignored. The build works "accidentally" without PWA optimization.  
**Fix Applied:** File delivered as `vite.config.js`. You must rename `vite_config.js` → `vite.config.js` in your project folder.

---

## 🟠 HIGH — Runtime Bugs

### 5. `debounce` Not Available When `db.js` Loads
**File:** `db.js` (bottom of file)  
**Problem:** `db.js` is loaded before `ui.js` in `index.html`. At the moment `db.js` runs, `window.debounce` does not exist yet. The line:  
```js
const _debouncedRefreshActiveUI = typeof debounce === 'function' ? debounce(refreshActiveUI, 300) : refreshActiveUI;
```
…always falls back to the non-debounced version. During rapid Firestore sync (many documents updating), `refreshActiveUI` fires dozens of times per second, causing severe UI lag.  
**Fix Applied:** Changed to a lazy-init pattern — `_debouncedRefreshActiveUI` now creates the debounced version on first call (after `ui.js` is guaranteed loaded).

### 6. Null Crash in Finance Invoice Dropdowns
**Files:** `finance.js` — `populateFinanceInvoiceDropdowns()` and `populateForexInvoices()`  
**Problem:** Both functions call `doc.buyer.split('\n')[0]` without null-checking `doc.buyer`. If any invoice was saved without a buyer name (blank form, import error, or programmatic entry), the app throws `Cannot read properties of undefined (reading 'split')` and the entire Finance module breaks.  
**Fix Applied:** Added `(doc.buyer || 'No Buyer').split('\n')[0]` null-safety guards.

### 7. `createNewCompany` Missing `prefix` Field
**File:** `db.js` — `createNewCompany()` function  
**Problem:** When a new company is created, the `prefix` field (used for document numbering like `JFT/2024/001`) is not added. The ARRAY_COLLECTIONS maintenance loop later attempts `c.prefix` and derives a broken 3-letter prefix. Documents created for the new company get malformed serial numbers.  
**Fix Applied:** `prefix` is now derived automatically from the company name during creation.

---

## 🟡 MEDIUM — Fake / Demo Data to Remove Before Production

### 8. Demo Companies in Default Registry
**File:** `db.js`  
**Problem:** On first run (clean localStorage), the company registry is pre-populated with:
- `ABC Textiles` (fake)
- `BCD Overseas` (fake)

These appear in the company switcher dropdown and could confuse users or get data accidentally entered under a fake company.  
**Fix Applied:** Registry initializes with only `JFT_MAIN` (JFT Agro Overseas LLP). Demo companies removed.

### 9. Fake Software Update Deployment Progress Bar
**File:** `enterprise.js` — `handleUpdateFileUpload()`  
**Problem:** The "Deploy Update" progress bar was animated using `Math.random() * 15` increments with no actual file processing. The version was hardcoded to `'8.3.2'` regardless of what file was uploaded. This is a UI illusion — uploading a `.txt` file would "deploy" the same as a real binary.  
**Fix Applied:** The fake animation is removed. The function now validates the uploaded filename, extracts the version from it if possible (e.g., `SMA-ERP-v8.3.2.exe`), and writes it to Firestore. A real progress display shows without the random tick animation.

---

## ✅ VERIFIED WORKING — No Changes Needed

| System | Status | Notes |
|---|---|---|
| Firebase Auth (Login/Logout/Lock) | ✅ Correct | Firebase persistence set to LOCAL |
| Firestore Rules | ✅ Secure | Role-based, multi-tenant, admin-only delete |
| Realtime Cloud Sync | ✅ Working | Hash-diff engine prevents redundant writes |
| Mass Deletion Safety Guard | ✅ Working | >50% batch delete blocked with admin alert |
| Cloud Archive System | ✅ Working | Records archived before delete, not hard-deleted |
| Conflict Detection | ✅ Working | Timestamp check on `patchCloudRecord` |
| Document Lock (Multi-user) | ✅ Working | 2-hour lock expiry |
| Electron Exit Backup | ✅ Working | 7s timeout guard, local backup on close |
| Financial Year Logic (April–March) | ✅ Correct | `Enterprise.getFY()` correctly handles April 1 boundary |
| USD/INR Rate (Live) | ✅ Real | Fetched from open.er-api.com |
| Forex Realization Auto Knock-off | ✅ Correct | 99% threshold triggers Paid status |
| Hedge MTM Calculation | ✅ Correct | `(BookedRate - MarketRate) × Balance` |
| FX Stress Test | ✅ Correct | Net exposure × rate delta in ₹ Lakhs |
| Session Idle Lock (5 min) | ✅ Working | Throttled activity listener (2.5s) |
| Role Enforcement (admin/staff/viewer) | ✅ Working | Nav, buttons, finance sub-tabs |
| Lazy View Loading | ✅ Working | Skeleton loader, recursive re-init |
| Service Worker / PWA | ✅ Working | Stale-while-revalidate caching |
| Smart Business Alerts (post-login) | ✅ Working | Overdue invoices, LC expiry, stuck tasks |
| FY Selector (6-year rolling) | ✅ Working | All filter dropdowns |
| Multi-Company Tenancy | ✅ Working | CID-scoped Firestore paths |
| Export Emergency Backup | ✅ Working | Full JSON download |
| DB Self-Healing | ✅ Working | Missing arrays auto-created on load |
| 18-Month Rolling Sync Window | ✅ Working | Prevents overloading on large datasets |
| Command Palette (Ctrl+K) | ✅ Working | 19 commands mapped |
| Dashboard KPIs | ✅ Real data | Calculates from actual docs/forex/imports |

---

## DEPLOYMENT CHECKLIST

Before feeding real business data:

- [ ] Replace `vite_config.js` with `vite.config.js` (rename the file)
- [ ] Enter your Gemini API Key in Settings → AI Configuration
- [ ] Enter your OpenAI API Key in Settings → AI Configuration (optional)
- [ ] Delete demo company entries from localStorage (or use the new clean registry)
- [ ] Create your real Firebase users in Settings → User Management
- [ ] Set a strong password for all users (no '1234' default anymore)
- [ ] Verify Firestore security rules are deployed: `firebase deploy --only firestore:rules`
- [ ] Fill in company profile: Settings → Company Profile (Name, IEC, GSTIN, Address)
- [ ] Set USD/INR rate initial value: Settings → Meta → USD/INR Rate
- [ ] Test login, logout, idle lock, and session restore before entering invoices

---

*All fixed files are delivered alongside this report.*
