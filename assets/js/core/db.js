/* --- FIREBASE CLOUD DATABASE MODULE (UNIVERSAL GLOBAL SYNC EDITION) --- */

var ipcRenderer = window.electron?.ipcRenderer || null;
window.ipcRenderer = ipcRenderer; // Global access for modules

const firebaseConfig = {
    apiKey: "AIzaSyCngbfvJYivLmruQcVDTdIbiS3dzEyhMxA",
    authDomain: "jft-enterprise.firebaseapp.com",
    projectId: "jft-enterprise",
    storageBucket: "jft-enterprise.firebasestorage.app",
    messagingSenderId: "695350467294",
    appId: "1:695350467294:web:7f098b8137fdfbf21f004f"
};

// Initialize Firestore with modern settings to avoid host-override and persistence warnings
// Initialize Firestore
firebase.initializeApp(firebaseConfig);
const cloudDB = firebase.firestore();

// MODERN OFFLINE SYNC (Compat v10 Layer)
// Using an IIFE to handle persistence without blocking the main thread or drowning in warnings
(function() {
    try {
        // Only enable persistence if not already enabled. Multi-tab synchronization is crucial for enterprise apps.
        cloudDB.enablePersistence({ synchronizeTabs: true }).catch((err) => {
            if (err.code === 'failed-precondition') console.debug("[DB] Persistence: Multiple tabs open.");
            else if (err.code === 'unimplemented') console.warn("[DB] Persistence: Browser unsupported.");
        });
    } catch (e) {
        console.debug("[DB] Firestore persistence already configured.");
    }
})();

// --- MULTI-COMPANY TENANCY ENGINE ---
// SECURED: CID Guard prevents names (like 'JFT AGRO OVERSEAS LLP') from being used as IDs.
let rawCid = localStorage.getItem('jft_active_cid') || 'JFT_MAIN';
if (rawCid.includes(' ')) {
    console.warn("Detected invalid CID (looks like a Name). Resetting to JFT_MAIN.");
    rawCid = 'JFT_MAIN';
}
const ACTIVE_CID = rawCid;
localStorage.setItem('jft_active_cid', ACTIVE_CID);
localStorage.setItem('jft_active_company', ACTIVE_CID);
window.ACTIVE_CID = ACTIVE_CID; // Global access for modules

// Helper for multi-tenancy cloud references
function getCloudRef(col) {
    if (ACTIVE_CID === 'JFT_MAIN') return cloudDB.collection(col);
    return cloudDB.collection('tenants').doc(ACTIVE_CID).collection(col);
}

const STORAGE_KEY = 'jft_db_' + ACTIVE_CID;
const COMPANIES_KEY = 'jft_companies_registry';

// Initialize global companies registry with demo entities
if (!localStorage.getItem(COMPANIES_KEY)) {
    localStorage.setItem(COMPANIES_KEY, JSON.stringify([
        { id: 'JFT_MAIN', name: 'JFT AGRO OVERSEAS LLP', logo: '🌐', industry: 'Logistics', prefix: 'JFT' },
        { id: 'CID_ABC', name: 'ABC Textiles', logo: '🧥', industry: 'Garments', prefix: 'ABC' },
        { id: 'CID_BCD', name: 'BCD Overseas', logo: '🚢', industry: 'Import/Export', prefix: 'BCD' }
    ]));
} else {
    // FORCE MIGRATION: Update legacy names if they exist in local storage
    let registry = JSON.parse(localStorage.getItem(COMPANIES_KEY) || '[]');
    let changed = false;
    registry.forEach(c => {
        if (c.id === 'JFT_MAIN' && (c.name === 'JFT Main Office' || c.name === 'JFT Agro Overseas')) {
            c.name = 'JFT AGRO OVERSEAS LLP';
            c.logo = '🌐';
            changed = true;
        }
        // Ensure every company has a prefix (derived from name if missing)
        if (!c.prefix) {
            c.prefix = c.name.split(' ')[0].slice(0, 3).toUpperCase();
            changed = true;
        }
    });
    if (changed) localStorage.setItem(COMPANIES_KEY, JSON.stringify(registry));
}

window.getManagedCompanies = function() {
    return JSON.parse(localStorage.getItem(COMPANIES_KEY) || '[]');
};

window.getActiveCompany = function() {
    const list = window.getManagedCompanies();
    return list.find(c => c.id === ACTIVE_CID) || { id: 'SMA', name: 'SMA ERP', prefix: 'SMA' };
};

window.switchCompany = function(cid) {
    if (cid === 'NEW') {
        const name = prompt("Enter New Company Name (e.g. ABC Textiles):");
        if (name) {
            const ind = prompt("Industry Segment (e.g. Garments, Logistics):") || 'General Business';
            return window.createNewCompany(name, ind);
        }
        return;
    }
    if (!cid) return;
    localStorage.setItem('jft_active_cid', cid);
    if(typeof Enterprise !== 'undefined') Enterprise.notify("Switching Company Environment...", "info");
    setTimeout(() => location.reload(), 1000);
};

window.createNewCompany = function(name, industry) {
    const list = window.getManagedCompanies();
    const newId = 'CID_' + Date.now();
    list.push({ id: newId, name: name, industry: industry, logo: '🏢' });
    localStorage.setItem(COMPANIES_KEY, JSON.stringify(list));
    window.switchCompany(newId);
};

if (typeof window.db === 'undefined' || !window.db) {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try { window.db = JSON.parse(saved); } catch(e) { console.error("DB Corrupt:", e); }
    }
    
    if (!window.db) {
        window.db = {
            id: ACTIVE_CID,
            meta: { 
                lastBackup: null, 
                usdInrRate: 83.50,
                apiKeys: { gmailClientId: '', forexApiKey: '' }
            },
            profile: { name: ACTIVE_CID === 'JFT_MAIN' ? 'JFT Agro Enterprise' : '', address1: '', address2: '', iec: '', gstin: '', lut: '', letterheadImg: null, signatureImg: null, stampImg: null },
            features: { finance: true, logistics: true, inventory: true, costing: true, hr: true, import: true },
            uiConfig: { docTypes: ['Commercial Invoice', 'Proforma Invoice', 'Packing List', 'Phyto Draft'] }, 
            theme: { primary: ACTIVE_CID === 'JFT_MAIN' ? '#0f172a' : '#1e3a8a', secondary: '#3b82f6', accent: '#8b5cf6' },
            bankProfiles: [],
            users: [ { id: 'u1', username: 'admin', role: 'admin', canDelete: true, canEditSettings: true } ],
            customFields: [], 
            docs: [], expenses: [], forex: [], hedges: [], log_trucks: [], log_containers: [], log_vessels: [], log_couriers: [],
            inventory: [], inventory_log: [], stock_loss: [], po: [], costings: [], incentives: [], lcs: [], attendance: [], tasks: [], exporter_data: [], imports: [], notifications: [],
            import_expenses: [], import_payments: [], import_hedges: [], import_simulations: [], import_manual_pnl: [],
            chats: [], system_logs: [], customTabs: [], notes: [], clocks: [], freight_rates: [], macro_indicators: []
        };
        
        // REPAIRED: Robust Company Registry Audit
        if (window.db.companies) {
            window.db.companies.forEach(c => {
                if (c.id === 'JFT_MAIN') c.name = 'JFT AGRO OVERSEAS LLP';
                if (!c.id) c.id = (typeof generateId === 'function') ? generateId() : 'CO_' + Date.now();
            });
        }
        
        window.isCloudReady = true;
        
        // Final fallback: Ensure the module system is initialized
        if (typeof initApp === 'function') {
            console.log("[CORE] Data Layer Ready. Ready for UI initialization.");
        }
    }
}
var db = window.db; 
if (typeof window.isCloudReady !== 'undefined') window.isCloudReady = true;
localStorage.setItem(STORAGE_KEY, JSON.stringify(db));

const CONFIG_KEYS = ['meta', 'profile', 'theme', 'features', 'uiConfig'];
const ARRAY_COLLECTIONS = [
    'bankProfiles', 'customFields', 'docs', 'expenses', 'forex', 'hedges',
    'log_trucks', 'log_containers', 'log_vessels', 'log_couriers', 
    'inventory', 'inventory_log', 'po', 'stock_loss', 'costings', 'incentives', 'lcs', 
    'attendance', 'tasks', 'exporter_data', 'imports', 'notifications', 'chats', 'system_logs', 
    'import_expenses', 'import_payments', 'import_hedges', 'import_simulations', 'import_manual_pnl',
    'customTabs', 'notes', 'clocks', 'freight_rates', 'macro_indicators'
];

// SELF-HEALING DATABASE: Ensure ALL required arrays exist in the active memory db
if (window.db) {
    ARRAY_COLLECTIONS.forEach(col => {
        if (!window.db[col]) window.db[col] = [];
    });
}

let hashCache = {}; 
let isEnterpriseSyncActive = false;

window.DocLocker = {
    lock: async function(col, id) {
        const user = sessionStorage.getItem('jft_user');
        if (!user) return;
        try { 
            await cloudDB.collection(col).doc(id).update({ _isLocked: true, _lockedBy: user, _lockedAt: Date.now() }); 
        } catch(e) { 
            console.warn("Could not lock doc:", e); 
            if(typeof Enterprise !== 'undefined') Enterprise.notify("Failed to lock document on server", "warning"); 
        }
    },
    unlock: async function(col, id) {
        try { 
            await cloudDB.collection(col).doc(id).update({ _isLocked: false, _lockedBy: null, _lockedAt: null }); 
        } catch(e) { 
            console.warn("Could not unlock doc:", e); 
        }
    },
    isLockedByOther: function(doc) {
        if (doc._isLocked && doc._lockedBy !== sessionStorage.getItem('jft_user')) {
            if (Date.now() - doc._lockedAt > 7200000) return false; 
            return true; 
        }
        return false;
    }
};

window.archiveRecord = async function(col, id) {
    if (!window.db[col]) window.db[col] = []; 
    const idx = window.db[col].findIndex(x => x.id === id);
    if (idx > -1) {
        const localItem = window.db[col][idx];
        
        // CONCURRENCY CHECK: Verify the record still exists in cloud before archiving
        try {
            const docRef = getCloudRef(col).doc(id);
            const cloudSnap = await docRef.get();
            if(!cloudSnap.exists) {
                Enterprise.notify("❌ Archive Failed: Record was already deleted by another user.", "danger");
                window.db[col].splice(idx, 1); // Clean local state
                return;
            }

            const item = { ...localItem, _archivedAt: new Date().toISOString() };
            const archiveRef = getCloudRef(col + '_archive').doc(id);
            await archiveRef.set(item);
            await docRef.delete();
            if(typeof Enterprise !== 'undefined') Enterprise.notify("Record moved to secure Cloud Archive.", "success");
        } catch(e) { 
            console.error("Archiving failed:", e);
            if(typeof Enterprise !== 'undefined') Enterprise.notify("Archiving failed. Please check connection.", "danger"); 
        }
    }
};

window.patchCloudRecord = async function(col, id, updates) {
    try {
        const docRef = getCloudRef(col).doc(id);
        const cloudSnap = await docRef.get();
        
        if (cloudSnap.exists) {
            const cloudData = cloudSnap.data();
            // Conflict Check: If cloud has a higher timestamp/version than local (simplified)
            if (cloudData._lastSync && updates._lastSync && cloudData._lastSync > updates._lastSync) {
                if(!confirm("⚠️ DATA COLLISION: Another user has made more recent changes to this record. Do you want to overwrite their changes anyway?")) {
                    return false;
                }
            }
        }
        
        updates._lastSync = Date.now();
        updates._updatedBy = sessionStorage.getItem('jft_user') || 'System';
        
        await docRef.set(updates, { merge: true });
        return true;
    } catch(e) {
        console.error("Patch failed:", e);
        return false;
    }
};

function runDatabaseMaintenance() {
    if (window.db.exporter_data && window.db.exporter_data.length > 0) {
        const originalLength = window.db.exporter_data.length;
        window.db.exporter_data = window.db.exporter_data.filter(d => d.no || d.issueDate || d.name);
        if (window.db.exporter_data.length < originalLength && typeof saveData === 'function') saveData(true); 
    }
}

async function initRealtimeSync() {
    const refreshEl = document.getElementById('last-refresh-time');
    if (refreshEl) refreshEl.innerText = "Connecting to Cloud... 🔄";

    CONFIG_KEYS.forEach(key => {
        cloudDB.collection('jft_config').doc(key).onSnapshot(doc => {
            if (doc.exists) {
                const data = doc.data().value;
                const hash = JSON.stringify(data);
                if (hashCache[`[config]${key}`] !== hash) {
                    window.db[key] = data; hashCache[`[config]${key}`] = hash; _debouncedRefreshActiveUI();
                }
            }
        });
    });

    cloudDB.collection('users').onSnapshot(snapshot => {
        if (!window.db.users) window.db.users = []; // SAFEGURAD: Protects against undefined array
        
        snapshot.docChanges().forEach(change => {
            const data = change.doc.data();
            if (!data.id) return; 
            const syncKey = `[users]${data.id}`;
            const hash = JSON.stringify(data);
            const idx = window.db.users.findIndex(x => x.id === data.id);
            if (change.type === 'added' || change.type === 'modified') {
                if (hashCache[syncKey] !== hash) {
                    if (idx > -1) window.db.users[idx] = data; else window.db.users.push(data);
                    hashCache[syncKey] = hash;
                }
            }
            if (change.type === 'removed') {
                if (idx > -1) {
                    window.db.users.splice(idx, 1);
                    delete hashCache[syncKey];
                }
            }
        });
    });
}

window.startEnterpriseSync = function() {
    if (isEnterpriseSyncActive) return;
    isEnterpriseSyncActive = true;

    ARRAY_COLLECTIONS.forEach(col => {
        let query;
        if (ACTIVE_CID === 'JFT_MAIN') {
            query = cloudDB.collection(col);
        } else {
            query = cloudDB.collection('tenants').doc(ACTIVE_CID).collection(col);
        }
        
        // BULK DATA LAZY LOADING: Truncate active memory ingestion to 18 months rolling horizon
        if (['docs', 'expenses', 'forex', 'log_trucks', 'log_containers', 'log_couriers', 'log_vessels', 'inventory_log', 'tasks', 'imports'].includes(col)) {
            const dateHorizon = new Date();
            dateHorizon.setMonth(dateHorizon.getMonth() - 18);
            const horizonStr = dateHorizon.toISOString().split('T')[0];
            
            // Tasks and Imports use 'timestamp' for rolling window since they might not have a 'date' field
            if (col === 'tasks' || col === 'imports') {
                query = query.where('timestamp', '>=', dateHorizon.getTime());
            } else {
                query = query.where('date', '>=', horizonStr);
            }
        }
        
        if (col === 'system_logs') { query = query.orderBy('timestamp', 'desc').limit(500); }

        query.onSnapshot(snapshot => {
            let hasMeaningfulChanges = false;
            // SAFEGUARD: Ensure the local collection exists before processing changes
            if (!window.db[col]) window.db[col] = [];
            
            const dbRef = window.db; // Local pointer to global for speed
            
            snapshot.docChanges().forEach(change => {
                const data = change.doc.data();
                if (!data.id) return; 
                const syncKey = `[${col}]${data.id}`;
                const hash = JSON.stringify(data);
                const idx = dbRef[col].findIndex(x => x.id === data.id);

                if (change.type === 'added' || change.type === 'modified') {
                    if (hashCache[syncKey] !== hash) {
                        if (idx > -1) dbRef[col][idx] = data; else dbRef[col].push(data);
                        hashCache[syncKey] = hash; hasMeaningfulChanges = true;
                    }
                }
                if (change.type === 'removed') {
                    if (idx > -1) dbRef[col].splice(idx, 1);
                    if (hashCache[syncKey]) {
                        delete hashCache[syncKey];
                        hasMeaningfulChanges = true;
                    }
                }
            });
            if (hasMeaningfulChanges) {
                if (col === 'exporter_data') runDatabaseMaintenance();
                _debouncedRefreshActiveUI();
            }
        }, err => {
            console.error(`Permission Denied or Sync Error for ${col}:`, err);
        });
    });

    setTimeout(() => { 
        const refreshEl = document.getElementById('last-refresh-time');
        if (refreshEl) refreshEl.innerText = `☁️ Last Sync: ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`; 
        runDatabaseMaintenance();

        if(window.autoSyncInterval) clearInterval(window.autoSyncInterval);
        window.autoSyncInterval = setInterval(() => {
            if(typeof saveData === 'function') saveData(true); 
        }, 180000); 

    }, 3000);
};

// DEBOUNCED UI REFRESH: Prevents massive lag during rapid batch updates from Firestore
const _debouncedRefreshActiveUI = typeof debounce === 'function' ? debounce(refreshActiveUI, 300) : refreshActiveUI;

function refreshActiveUI() {
    const activeTabId = document.querySelector('.nav-item.active')?.id || 'nav-dashboard';
    
    // 1. Core Visuals (Always apply)
    if (typeof applyTheme === 'function') applyTheme(); 
    
    // 2. Tab-Specific Rendering (Performance Boost: Only render what's visible)
    if (activeTabId === 'nav-dashboard' && typeof renderDashboard === 'function') renderDashboard();
    if (activeTabId === 'nav-documents' && typeof renderDocTabsUI === 'function') renderDocTabsUI();
    if (activeTabId === 'nav-finance' && typeof renderPnL === 'function') renderPnL();
    if (activeTabId === 'nav-logistics' && typeof renderLogistics === 'function') renderLogistics();
    if (activeTabId === 'nav-inventory' && typeof renderInventoryLedger === 'function') renderInventoryLedger();
    if (activeTabId === 'nav-costing' && typeof renderCostingTable === 'function') renderCostingTable();
    if (activeTabId === 'nav-lc-manager' && typeof renderLCList === 'function') renderLCList();
    if (activeTabId === 'nav-incentives' && typeof renderIncentives === 'function') renderIncentives();
    if (activeTabId === 'nav-tasks' && typeof renderTasksWorkspace === 'function') renderTasksWorkspace();
    if (activeTabId === 'nav-crm' && typeof renderNetworkCRM === 'function') renderNetworkCRM();
    if (activeTabId === 'nav-exporter-data' && typeof renderExporterData === 'function') renderExporterData();
    if (activeTabId === 'nav-attendance' && typeof renderAttendanceWorkspace === 'function') renderAttendanceWorkspace();
    if (activeTabId === 'nav-settings' && typeof initSettingsSystem === 'function') initSettingsSystem();

    // 3. Global Components
    if (typeof updateChatUI === 'function') updateChatUI(); 
    if (typeof renderDrafts === 'function') renderDrafts(); 
}

async function saveData(isSilentSync = false, forceBackup = false) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(window.db)); // Local Multi-Tenant Snapshot
    
    const refreshEl = document.getElementById('last-refresh-time');
    if (refreshEl && !isSilentSync) refreshEl.innerText = "Syncing... ⏳";
    
    try {
        let batch = cloudDB.batch();
        let ops = 0;
        let pendingHashes = {}; // Staging area
        
        const updateTimeUI = () => {
            if (refreshEl) refreshEl.innerText = `☁️ Last Sync: ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        };

        const commitBatch = async () => {
            if (ops > 0) {
                const hashesToCommit = pendingHashes;
                pendingHashes = {};
                try { 
                    await batch.commit(); 
                    Object.keys(hashesToCommit).forEach(k => {
                        if (hashesToCommit[k] === null) delete hashCache[k]; else hashCache[k] = hashesToCommit[k];
                    });
                } catch(e) { 
                    console.error("Batch commit failed:", e); 
                    if (refreshEl) refreshEl.innerText = "❌ Sync Partially Failed";
                    throw e; // Bubble up to stop larger sync
                }
                batch = cloudDB.batch(); ops = 0;
            }
        };

    const currentRole = sessionStorage.getItem('jft_role') || 'viewer';
    const isAdminUser = (currentRole === 'admin');

    if (isAdminUser) {
        for (const key of CONFIG_KEYS) {
            const hash = JSON.stringify(window.db[key]);
            if (hashCache[`[config]${key}`] !== hash) {
                batch.set(cloudDB.collection('jft_config').doc(key), { value: window.db[key] });
                pendingHashes[`[config]${key}`] = hash; ops++;
            }
        }
    }

    const currentUserIds = new Set();
    const currentFirebaseUser = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : null;
    const currentUsername = sessionStorage.getItem('jft_user');

    if (!window.db.users) window.db.users = []; // SAFEGUARD
    for (const item of window.db.users) {
        if (currentFirebaseUser && item.username && currentUsername && item.username.toLowerCase() === currentUsername.toLowerCase()) {
            item.id = currentFirebaseUser.uid; 
        } else if (!item.id) {
            item.id = generateId(); 
        }

        currentUserIds.add(item.id);
        const hash = JSON.stringify(item);
        const syncKey = `[users]${item.id}`;
        if (hashCache[syncKey] !== hash) {
            if (isAdminUser || item.id === currentFirebaseUser?.uid) {
                batch.set(cloudDB.collection('users').doc(item.id), item);
                pendingHashes[syncKey] = hash; ops++;
                if(ops >= 450) await commitBatch(); 
            } else {
                hashCache[syncKey] = hash; // Skip silently
            }
        }
    }
    
    if (isAdminUser) {
        for (const syncKey of Object.keys(hashCache)) {
            if (syncKey.startsWith(`[users]`)) {
                const id = syncKey.slice(7);
                if (!currentUserIds.has(id)) {
                    batch.delete(cloudDB.collection('users').doc(id));
                    pendingHashes[syncKey] = null; ops++;
                    if (ops >= 450) await commitBatch();
                }
            }
        }
    }

    for (const col of ARRAY_COLLECTIONS) {
        if (col === 'system_logs') continue;
        const currentIds = new Set();
        if (!window.db[col]) window.db[col] = []; // SAFEGUARD
        for (const item of window.db[col]) {
            if (!item.id) item.id = (typeof generateId === 'function') ? generateId() : col.slice(0,3) + '_' + Date.now();
            currentIds.add(item.id);
            const hash = JSON.stringify(item);
            const syncKey = `[${col}]${item.id}`;
            if (hashCache[syncKey] !== hash) {
                const docRef = getCloudRef(col).doc(item.id);
                batch.set(docRef, item, { merge: true });
                pendingHashes[syncKey] = hash; ops++;
                if(ops >= 450) await commitBatch(); 
            }
        }
        
        // CLOUD WIPE PROTECTION: If more than 50% of the collection is being deleted, trigger sanity check
        const deletions = [];
        for (const syncKey of Object.keys(hashCache)) {
            if (syncKey.startsWith(`[${col}]`)) {
                const id = syncKey.slice(col.length + 2);
                if (!currentIds.has(id)) deletions.push({ syncKey, id });
            }
        }

        if (deletions.length > 0) {
            const cacheSize = Object.keys(hashCache).filter(k => k.startsWith(`[${col}]`)).length;
            if (deletions.length > (cacheSize / 2) && cacheSize > 5 && !isSilentSync) {
                console.warn(`[SAFETY] Mass Deletion Detected in ${col}! Blocked sync for this collection.`);
                Enterprise.notify(`Mass data change blocked in ${col}. Contact Support or Admin.`, "danger");
                continue; // Skip this collection's deletions to protect cloud
            }
            
            for (const del of deletions) {
                batch.delete(getCloudRef(col).doc(del.id));
                pendingHashes[del.syncKey] = null; ops++; 
                if(ops >= 450) await commitBatch();
            }
        }
    }

        await commitBatch();
        
        if (ipcRenderer) {
            ipcRenderer.send('trigger-local-backup', db);
            if (db.meta && db.meta.masterBackupPath) {
                // BYPASS THROTTLE if forceBackup or Exit event
                if (forceBackup || !window._lastMasterAutoBackup || Date.now() - window._lastMasterAutoBackup > 600000) {
                    ipcRenderer.send('save-master-hard-drive-backup', db.meta.masterBackupPath, db);
                    window._lastMasterAutoBackup = Date.now();
                }
            }
            const backupEl = document.getElementById('last-backup-time');
            if(backupEl) backupEl.innerText = `Local Backup: ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        }
    } catch (e) {
        console.error("Master Sync Failure:", e);
        if (refreshEl) refreshEl.innerText = "❌ Sync Engine Error";
    } finally {
        if (refreshEl) refreshEl.innerText = `☁️ Last Sync: ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    }
}

function generateId() { return 'id-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now(); }

// --- ELECTRON EXIT GUARD: MANDATORY BACKUP ON CLOSE ---
if (ipcRenderer) {
    ipcRenderer.on('initiate-exit-backup', async () => {
        console.log("[SYSTEM] Close signal received. Finalizing sync...");
        
        const closeImmediately = () => {
            console.log("[SYSTEM] Final exit confirmed.");
            ipcRenderer.send('confirm-exit');
        };

        // Safety timeout: Never hang the app for more than 7 seconds on exit (Extended for backup)
        const safetyTimeout = setTimeout(closeImmediately, 7000);

        try {
            // Only perform sync/backup if a user is active
            if (sessionStorage.getItem('jft_user')) {
                // If it's a desktop app, we use saveData which now handles the force-backup
                if (typeof window.saveData === 'function') {
                    await window.saveData(true, true); // (silent, forceBackup)
                } else if (typeof saveData === 'function') {
                    await saveData(true, true);
                }
            }
            clearTimeout(safetyTimeout);
            closeImmediately();
        } catch (e) {
            console.error("Exit synchronization error:", e);
            clearTimeout(safetyTimeout);
            closeImmediately();
        }
    });
}

initRealtimeSync();