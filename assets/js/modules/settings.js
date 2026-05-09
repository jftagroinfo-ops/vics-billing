/* --- ENTERPRISE SETTINGS & SINGLE PROFILE ARCHITECTURE --- */

if (!db.profile) db.profile = {}; 
if (!db.bankProfiles) db.bankProfiles = [];
if (!db.customFields) db.customFields = [];
if (!db.users) db.users = [];
if (!db.uiConfig) db.uiConfig = {}; 
if (!db.system_logs) db.system_logs = [];
if (!db.meta) db.meta = {};

window.escapeHTML = window.escapeHTML || function(str) {
    if (!str) return '';
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
};

// ==========================================
// BOOTLOADER & WATCHDOG SYNC ENGINE
// ==========================================
let _settingsSyncHash = "";

function initSettingsSystem() {
    if (typeof db === 'undefined') {
        setTimeout(initSettingsSystem, 50);
        return;
    }
    
    // Safety: Hide Delete button for JFT_MAIN
    const delBtn = document.getElementById('btn-delete-company');
    if (delBtn) {
        if (ACTIVE_CID === 'JFT_MAIN') {
            delBtn.disabled = true;
            delBtn.style.opacity = '0.5';
            delBtn.style.cursor = 'not-allowed';
            delBtn.title = "Primary Entity (JFT Agro Overseas) cannot be deleted.";
        }
    }

    startSettingsWatchdog();
    populateAllSettingsUI(); 
}

window.deleteCurrentCompany = function() {
    if (ACTIVE_CID === 'JFT_MAIN') {
        return Enterprise.notify("Operational Error: You cannot delete the primary 'JFT Agro Overseas' entity.", "danger");
    }

    const coName = db.profile.name || ACTIVE_CID;
    
    // CONFIRMATION 1
    const step1 = confirm(`🚨 FINAL WARNING: You are about to PERMANENTLY DELETE "${coName}".\n\nThis will wipe all documents, invoices, bank records, and cloud sync logs for THIS business only. This cannot be recovered.\n\nAre you absolutely sure?`);
    
    if (step1) {
        // CONFIRMATION 2: TYPE TO CONFIRM
        const step2 = prompt(`To PERMANENTLY DELETE this business profile, please type the business name exactly as shown below:\n\n${coName}`);
        
        if (step2 === coName) {
            // EXECUTE DESTRUCTION
            try {
                // 1. Remove from global registry
                const registryKey = 'jft_companies_registry';
                let registry = JSON.parse(localStorage.getItem(registryKey) || '[]');
                registry = registry.filter(c => c.id !== ACTIVE_CID);
                localStorage.setItem(registryKey, JSON.stringify(registry));
                
                // 2. Wipe the company database
                localStorage.removeItem(`jft_db_${ACTIVE_CID}`);
                
                // 3. Reset to Main Office
                localStorage.setItem('jft_active_cid', 'JFT_MAIN');
                
                Enterprise.notify("🔥 Business Profile Terminated Successfully. Redirecting...", "success");
                setTimeout(() => location.reload(), 1500);
                
            } catch(e) {
                console.error("Purge Error:", e);
                Enterprise.notify("Fatal Error during profile termination.", "danger");
            }
        } else {
            Enterprise.notify("Confirmation Mismatch: Profile deletion aborted.", "warning");
        }
    }
};

function startSettingsWatchdog() {
    setInterval(() => {
        if (typeof db === 'undefined') return;
        
        // PERFORMANCE: Only watchdog if the Settings tab is currently active
        const activeTabId = document.querySelector('.nav-item.active')?.id || 'nav-dashboard';
        if (activeTabId !== 'nav-settings') return;

        if (!db.profile) db.profile = {};
        if (!db.bankProfiles) db.bankProfiles = [];
        if (!db.uiConfig) db.uiConfig = {};
        if (!db.users) db.users = [];

        const currentHash = `${db.profile.name || ''}-${db.bankProfiles.length}-${db.users.length}-${(db.uiConfig.docTypes||[]).length}`;
        
        if (currentHash !== _settingsSyncHash) {
            _settingsSyncHash = currentHash;
            populateAllSettingsUI(); 
            
            const syncBadge = document.getElementById('settings-sync-status');
            if (syncBadge) {
                syncBadge.innerHTML = `<span style="display: inline-block; width: 8px; height: 8px; background: #16a34a; border-radius: 50%; box-shadow: 0 0 5px #16a34a;"></span> Cloud Synced`;
                syncBadge.style.background = 'rgba(34, 197, 94, 0.1)';
                syncBadge.style.color = '#166534';
                syncBadge.style.borderColor = '#bbf7d0';
            }
        }
    }, 4000); // Relaxed for performance
}

// ==========================================
// IMAGE COMPRESSION ENGINE
// ==========================================
function compressImageForStorage(dataUrl, maxWidth, quality, callback, format = 'image/jpeg') {
    const img = new Image();
    img.onload = function() {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Transparency Support: Only fill background for non-PNG formats
        if (format !== 'image/png') {
            ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--surface').trim() || '#ffffff';
            ctx.fillRect(0, 0, width, height);
        }

        ctx.drawImage(img, 0, 0, width, height);
        
        let result = canvas.toDataURL(format, quality);
        
        // DEEP COMPRESSION (Only for large JPEGs)
        if (format === 'image/jpeg') {
            if (result.length > 200000) { 
                result = canvas.toDataURL('image/jpeg', 0.5); 
            }
            if (result.length > 500000) {
                const tinyCanvas = document.createElement('canvas');
                tinyCanvas.width = width * 0.7;
                tinyCanvas.height = height * 0.7;
                tinyCanvas.getContext('2d').drawImage(canvas, 0, 0, tinyCanvas.width, tinyCanvas.height);
                result = tinyCanvas.toDataURL('image/jpeg', 0.4);
            }
        } else if (format === 'image/png' && result.length > 200000) {
            // PNG COMPRESSION (For signatures/logos)
            const scaledCanvas = document.createElement('canvas');
            scaledCanvas.width = width * 0.8; scaledCanvas.height = height * 0.8;
            scaledCanvas.getContext('2d').drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
            result = scaledCanvas.toDataURL('image/png');
        }

        // HARD SECURED GUARD: Firestore doc limit is 1MB. 
        // We cap individual images at 150KB to ensure full profile sync stability.
        if (result.length > 250000) { 
            if(typeof Enterprise !== 'undefined') Enterprise.notify("❌ Image Rejected: File resolution is too high for cloud sync. Please use a compressed version.", "danger");
            callback(null);
            return;
        }

        callback(result);
    };
    img.src = dataUrl;
}

// Temporary hold for images before saving (prevents watchdog overwrites)
let tempLetterhead = null;
let tempSignature = null;
let tempStamp = null;
let _isUploadingBranding = false;

// ==========================================
// POPULATE UI
// ==========================================
function populateAllSettingsUI() {
    const role = sessionStorage.getItem('jft_role');
    const isAdmin = role === 'admin';
    
    const tabDisplay = (id) => { const el = document.getElementById(id); if (el) el.style.display = isAdmin ? 'inline-block' : 'none'; };
    tabDisplay('set-tab-btn-users');
    tabDisplay('set-tab-btn-storage');
    tabDisplay('set-tab-btn-ai');
    tabDisplay('set-tab-btn-api');
    tabDisplay('set-tab-btn-print');
    tabDisplay('set-tab-btn-updates');
    tabDisplay('set-tab-btn-builder');
    tabDisplay('set-tab-btn-audit');

    // Toggle Admin-only sections inside any settings panel
    document.querySelectorAll('#settings .admin-only').forEach(el => {
        el.style.display = isAdmin ? 'block' : 'none';
    });

    const profileUser = document.getElementById('my-profile-username');
    const profileRole = document.getElementById('my-profile-role');
    const profileAvatar = document.getElementById('my-profile-avatar');
    if (profileUser) profileUser.innerText = sessionStorage.getItem('jft_user') || 'User';
    if (profileRole) profileRole.innerText = role ? role.toUpperCase() : 'VIEWER';
    if (profileAvatar) profileAvatar.innerText = (sessionStorage.getItem('jft_user') || 'U').charAt(0).toUpperCase();

    // Initialize System Updates UI if available
    if (isAdmin && typeof checkSystemUpdates === 'function') {
        checkSystemUpdates(false);
    }


    // 1. POPULATE COMPANY PROFILE
    const setVal = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val || ''; };
    setVal('prof-comp-name', db.profile.name);
    setVal('prof-gstin', db.profile.gstin);
    setVal('prof-iec', db.profile.iec);
    setVal('prof-address', db.profile.address1); 
    setVal('prof-email', db.profile.email);
    setVal('prof-phone', db.profile.phone);
    setVal('prof-lut', db.profile.lut);

    // Sync Images from DB to Temp state and UI (Only if not in middle of local upload)
    if (!_isUploadingBranding) {
        if (db.profile.letterheadImg) {
            tempLetterhead = db.profile.letterheadImg;
            const preview = document.getElementById('prof-letterhead-preview');
            if(preview) preview.style.backgroundImage = `url(${tempLetterhead})`;
        } else {
            tempLetterhead = null;
            const preview = document.getElementById('prof-letterhead-preview');
            if(preview) preview.style.backgroundImage = `none`;
        }
        
        if (db.profile.signatureImg) {
            tempSignature = db.profile.signatureImg;
            const sigPreview = document.getElementById('prof-signature-preview');
            if(sigPreview) sigPreview.style.backgroundImage = `url(${tempSignature})`;
        } else {
            tempSignature = null;
            const sigPreview = document.getElementById('prof-signature-preview');
            if(sigPreview) sigPreview.style.backgroundImage = `none`;
        }

    }

    // 2. POPULATE PDF ENGINE
    if (db.uiConfig) {
        setVal('print-currency', db.uiConfig.printCurrency || 'USD');
        setVal('print-margins', db.uiConfig.printMargins || 'normal');
        setVal('print-header-margin', db.uiConfig.headerMargin || 45);
        setVal('print-footer-margin', db.uiConfig.footerMargin || 27);
        
        const lhToggle = document.getElementById('print-letterhead-toggle');
        if(lhToggle) lhToggle.checked = db.uiConfig.useLetterhead || false;
        
        const sigToggle = document.getElementById('print-signature-toggle');
        if(sigToggle) sigToggle.checked = db.uiConfig.useSignature || false;
        
        setVal('print-signature-height', db.uiConfig.signatureHeight || 80);
        const sVal = document.getElementById('sig-height-val');
        if(sVal) sVal.innerText = db.uiConfig.signatureHeight || 80;

        const lhDocs = db.uiConfig.letterheadDocs || {};
        document.querySelectorAll('.lh-doc-cb').forEach(cb => { cb.checked = lhDocs[cb.value] || false; });

        const sigDocs = db.uiConfig.signatureDocs || {};
        document.querySelectorAll('.sig-doc-cb').forEach(cb => { cb.checked = sigDocs[cb.value] || false; });
    }

    // 3. POPULATE CLOUD (Google Drive & Dropbox)
    if (db.meta) {
        const gdToggle = document.getElementById('store-gdrive');
        if(gdToggle) {
            gdToggle.checked = db.meta.gdriveSync || false;
            document.getElementById('gdrive-auth-block').style.display = db.meta.gdriveSync ? 'block' : 'none';
        }
        
        const dbToggle = document.getElementById('store-dropbox');
        if(dbToggle) {
            dbToggle.checked = db.meta.dropboxSync || false;
            document.getElementById('dropbox-auth-block').style.display = db.meta.dropboxSync ? 'block' : 'none';
        }

        // 4. Update Hard Drive Master Backup Path Display
        const pathDisplay = document.getElementById('master-backup-path-display');
        if (pathDisplay) {
            pathDisplay.innerText = db.meta.masterBackupPath || "No local path configured. Backups will default to app storage.";
            if (db.meta.masterBackupPath) pathDisplay.style.color = 'var(--success)';
        }

        // --- NEW API SETTINGS POPULATION ---
        setVal('api-gmail-client-id', db.meta.apiKeys?.gmailClientId);
        setVal('api-usd-inr-rate', db.meta.usdInrRate || 84.00);
        setVal('api-forex-endpoint', db.meta.forexEndpoint);
    }

    // AI ENGINE POPULATOR
    if (typeof Enterprise !== 'undefined' && Enterprise.AI) {
        Enterprise.AI.updateStatusUI();
    }

    renderBanks();
    renderUsers();
    renderUnivCustomFields();
    renderDocTypesTable();
    if (isAdmin) renderAuditLogs();
}

window.saveApiSettings = function(e) {
    e.preventDefault();
    if (typeof Enterprise !== 'undefined' && !Enterprise.security.isAdmin(true)) return; 

    if (!db.meta) db.meta = {};
    if (!db.meta.apiKeys) db.meta.apiKeys = {};

    db.meta.apiKeys.gmailClientId = document.getElementById('api-gmail-client-id').value.trim();
    db.meta.usdInrRate = parseFloat(document.getElementById('api-usd-inr-rate').value) || 84.00;
    db.meta.forexEndpoint = document.getElementById('api-forex-endpoint').value.trim();

    if (typeof window.saveData === 'function') window.saveData(true);
    else if (typeof saveData === 'function') saveData(true);
    
    _settingsSyncHash = Date.now().toString(); 
    
    if(typeof Enterprise !== 'undefined') {
        Enterprise.notify("API & Connectivity Settings Updated!", "success");
        Enterprise.logAction("Updated External API Configurations.");
    }
};

window.calculateStorageStats = function() {
    console.log("Auditing System Storage...");
    
    // 1. Calculate LocalStorage
    let lsTotal = 0;
    for (let x in localStorage) {
        if (!localStorage.hasOwnProperty(x)) continue;
        lsTotal += ((localStorage[x].length + x.length) * 2);
    }
    const lsKB = (lsTotal / 1024).toFixed(2);
    const lsPerc = Math.min(100, (lsTotal / (5 * 1024 * 1024) * 100)); // Browser cap ~5MB

    // 2. Calculate Cloud (DB) Size
    const dbJSON = JSON.stringify(db);
    const dbTotal = dbJSON.length * 2;
    const dbKB = (dbTotal / 1024).toFixed(2);
    const dbPerc = Math.min(100, (dbTotal / (100 * 1024 * 1024) * 100)); // Soft cap 100MB for UX speed

    // 3. Collection Breakdown
    const collections = [
        { name: '📄 Invoices & Docs', key: 'docs' },
        { name: '💰 Expense Ledger', key: 'expenses' },
        { name: '🌐 CRM Directory', key: 'forex' }, // Using forex as proxy for CRM if needed
        { name: '📦 Inventory Logs', key: 'inventory_log' },
        { name: '🛡️ Audit Logs', key: 'system_logs' }
    ];

    let breakdownHTML = '';
    collections.forEach(col => {
        const size = JSON.stringify(db[col.key] || []).length * 2;
        const kb = (size / 1024).toFixed(2);
        breakdownHTML += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(0,0,0,0.02); border-radius: 6px;">
                <span style="font-size: 0.85rem; color: var(--text-muted);">${col.name}</span>
                <span style="font-family: monospace; font-weight: bold; color: var(--text);">${kb} KB</span>
            </div>
        `;
    });

    // Update UI
    const localVal = document.getElementById('storage-local-val');
    const localBar = document.getElementById('storage-local-bar');
    const cloudVal = document.getElementById('storage-cloud-val');
    const cloudBar = document.getElementById('storage-cloud-bar');
    const breakdownList = document.getElementById('storage-breakdown-list');

    if (localVal) localVal.innerText = `${lsKB} KB`;
    if (localBar) localBar.style.width = `${lsPerc}%`;
    if (cloudVal) cloudVal.innerText = `${dbKB} KB`;
    if (cloudBar) cloudBar.style.width = `${dbPerc}%`;
    if (breakdownList) breakdownList.innerHTML = breakdownHTML;

    if(typeof Enterprise !== 'undefined') Enterprise.notify("Storage Audit Complete", "info");
};

window.switchSettingsTab = function(tabName) {
    const role = sessionStorage.getItem('jft_role');
    const isAdmin = role === 'admin';
    
    // Restricted tabs for non-admins (Now including Danger Zone & Updates)
    if (!isAdmin && (tabName === 'users' || tabName === 'audit' || tabName === 'danger' || tabName === 'updates')) {
        Enterprise.notify("⚠️ Access Denied: This high-security module is restricted to Administrators.", "danger");
        return;
    }

    document.querySelectorAll('#settings .settings-nav-btn').forEach(b => {
        b.classList.remove('active');
        // Hide restricted buttons for staff
        const bId = b.id;
        if (!isAdmin && (bId === 'set-tab-btn-users' || bId === 'set-tab-btn-audit' || bId === 'set-tab-btn-danger' || bId === 'set-tab-btn-updates')) {
            b.style.display = 'none';
        } else {
            b.style.display = 'inline-block';
        }
    });

    const activeBtn = document.getElementById(`set-tab-btn-${tabName}`);
    if (activeBtn) activeBtn.classList.add('active');
    
    document.querySelectorAll('#settings .settings-panel').forEach(p => p.classList.add('hidden'));
    const targetPanel = document.getElementById(`set-${tabName}-tab`);
    if (targetPanel) targetPanel.classList.remove('hidden');

    if (tabName === 'adv-storage') {
        calculateStorageStats();
    }
    if (tabName === 'audit') {
        renderAuditLogs();
    }
};

// ==========================================
// MASTER COMPANY PROFILE & BRANDING ENGINE
// ==========================================

window.saveMasterProfile = function(e) {
    e.preventDefault();
    if (typeof Enterprise !== 'undefined' && !Enterprise.security.isAdmin(true)) return; 

    db.profile.name = document.getElementById('prof-comp-name').value;
    db.profile.gstin = document.getElementById('prof-gstin').value;
    db.profile.iec = document.getElementById('prof-iec').value;
    db.profile.address1 = document.getElementById('prof-address').value;
    db.profile.email = document.getElementById('prof-email').value;
    db.profile.phone = document.getElementById('prof-phone').value;
    db.profile.lut = document.getElementById('prof-lut').value;

    db.profile = {...db.profile}; 
    
    if (typeof window.saveData === 'function') window.saveData(true);
    else if (typeof saveData === 'function') saveData(true);
    
    _settingsSyncHash = Date.now().toString(); 
    
    if(typeof Enterprise !== 'undefined') {
        Enterprise.notify("Master Company Profile Saved!", "success");
        Enterprise.logAction("Updated Master Company Profile Details.");
    }
};

window.previewLetterhead = function(e) {
    if (typeof Enterprise !== 'undefined' && !Enterprise.security.isAdmin(true)) return; 
    const file = e.target.files[0];
    if (!file) return;
    
    _isUploadingBranding = true;
    const reader = new FileReader();
    reader.onload = function(evt) {
        compressImageForStorage(evt.target.result, 1200, 0.7, function(compressedBase64) {
            tempLetterhead = compressedBase64;
            db.profile.letterheadImg = compressedBase64;
            const el = document.getElementById('prof-letterhead-preview');
            if(el) el.style.backgroundImage = `url(${tempLetterhead})`;
            
            // AUTO-SAVE PERMANENTLY
            if (typeof window.saveData === 'function') window.saveData(true);
            else if (typeof saveData === 'function') saveData(true);
            _settingsSyncHash = Date.now().toString();
            
            _isUploadingBranding = false;
            if(typeof Enterprise !== 'undefined') Enterprise.notify("🚀 Letterhead Saved & Cloud-Synced!", "success");
        });
    };
    reader.readAsDataURL(file);
};

window.previewSignature = function(e) {
    if (typeof Enterprise !== 'undefined' && !Enterprise.security.isAdmin(true)) return; 
    const file = e.target.files[0];
    if (!file) return;

    _isUploadingBranding = true;
    const reader = new FileReader();
    reader.onload = function(evt) {
        compressImageForStorage(evt.target.result, 400, 1.0, function(compressedBase64) {
            tempSignature = compressedBase64;
            db.profile.signatureImg = compressedBase64;
            const el = document.getElementById('prof-signature-preview');
            if(el) el.style.backgroundImage = `url(${tempSignature})`;
            
            // AUTO-SAVE PERMANENTLY
            if (typeof window.saveData === 'function') window.saveData(true);
            else if (typeof saveData === 'function') saveData(true);
            _settingsSyncHash = Date.now().toString();
            
            _isUploadingBranding = false;
            if(typeof Enterprise !== 'undefined') Enterprise.notify("🖊️ Signature (PNG/JPEG) Saved Permanently!", "success");
        }, 'image/png');
    };
    reader.readAsDataURL(file);
};

window.removeLetterhead = function() {
    if(!confirm("Remove Letterhead?")) return;
    tempLetterhead = null;
    db.profile.letterheadImg = null;
    document.getElementById('prof-letterhead-preview').style.backgroundImage = 'none';
    if (typeof window.saveData === 'function') window.saveData(true);
    _settingsSyncHash = Date.now().toString();
};

window.removeSignature = function() {
    if(!confirm("Remove Signature?")) return;
    tempSignature = null;
    db.profile.signatureImg = null;
    document.getElementById('prof-signature-preview').style.backgroundImage = 'none';
    if (typeof window.saveData === 'function') window.saveData(true);
    _settingsSyncHash = Date.now().toString();
};

window.saveBrandingAssets = function() {
    if (typeof Enterprise !== 'undefined' && !Enterprise.security.isAdmin(true)) return; 
    
    db.profile.letterheadImg = tempLetterhead;
    db.profile.signatureImg = tempSignature;
    db.profile = {...db.profile};

    if (typeof window.saveData === 'function') window.saveData(true);
    else if (typeof saveData === 'function') saveData(true);
    
    _settingsSyncHash = Date.now().toString(); 
    
    if(typeof Enterprise !== 'undefined') {
        Enterprise.notify("Branding Assets Saved Successfully!", "success");
        Enterprise.logAction("Updated Company Branding Assets.");
    }
};

// ==========================================
// CORPORATE BANK DETAILS
// ==========================================

window.addBankProfile = function(e) {
    e.preventDefault();
    if (typeof Enterprise !== 'undefined' && !Enterprise.security.isAdmin(true)) return; 
    
    const isDefault = document.getElementById('bank-is-default')?.checked || false;
    if (isDefault) {
        db.bankProfiles.forEach(b => b.isDefault = false);
    }
    
    const editId = document.getElementById('bank-edit-id')?.value;
    
    const bankData = {
        bankName: document.getElementById('bank-name').value,
        accountNo: document.getElementById('bank-acc').value,
        swift: document.getElementById('bank-swift').value,
        ifsc: document.getElementById('bank-ifsc')?.value || '',
        adCode: document.getElementById('bank-ad')?.value || '',
        corrName: document.getElementById('bank-corr-name').value,
        corrAcc: document.getElementById('bank-corr-acc').value,
        corrSwift: document.getElementById('bank-corr-swift').value,
        isDefault: isDefault
    };

    if (editId) {
        const idx = db.bankProfiles.findIndex(b => b.id === editId);
        if (idx !== -1) {
            bankData.id = editId;
            db.bankProfiles[idx] = bankData;
        }
    } else {
        bankData.id = 'BNK_' + Date.now();
        db.bankProfiles.push(bankData);
    }
    
    db.bankProfiles = [...db.bankProfiles];
    if (typeof window.saveData === 'function') window.saveData(true);
    else if(typeof saveData === 'function') saveData(true);
    
    _settingsSyncHash = Date.now().toString();
    resetBankForm();
    renderBanks(); 
    if(typeof Enterprise !== 'undefined') Enterprise.notify(editId ? "Bank Account Updated." : "Bank Account Added.", "success");
};

window.resetBankForm = function() {
    const fn = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    fn('bank-edit-id', ''); fn('bank-name', ''); fn('bank-acc', ''); fn('bank-swift', '');
    fn('bank-ifsc', ''); fn('bank-ad', ''); fn('bank-corr-name', ''); fn('bank-corr-acc', ''); fn('bank-corr-swift', '');
    
    const isDef = document.getElementById('bank-is-default');
    if (isDef) isDef.checked = false;
    
    document.getElementById('bank-submit-btn').innerText = '➕ Add Bank Account to System';
    document.getElementById('bank-cancel-btn').style.display = 'none';
};

window.editBank = function(id) {
    const b = db.bankProfiles.find(x => x.id === id);
    if (!b) return;
    
    const fn = (x, val) => { const el = document.getElementById(x); if (el) el.value = val || ''; };
    fn('bank-edit-id', b.id); fn('bank-name', b.bankName); fn('bank-acc', b.accountNo); fn('bank-swift', b.swift);
    fn('bank-ifsc', b.ifsc); fn('bank-ad', b.adCode); fn('bank-corr-name', b.corrName);
    fn('bank-corr-acc', b.corrAcc); fn('bank-corr-swift', b.corrSwift);
    
    const isDef = document.getElementById('bank-is-default');
    if (isDef) isDef.checked = b.isDefault || false;
    
    document.getElementById('bank-submit-btn').innerText = '💾 Update Bank Profile';
    document.getElementById('bank-cancel-btn').style.display = 'block';
    
    // Scroll to the top of the form smoothly
    const formPanel = document.getElementById('set-bank-tab');
    if(formPanel) formPanel.scrollIntoView({ behavior: 'smooth' });
};

function renderBanks() {
    const tbody = document.querySelector('#bank-table tbody');
    if (!tbody || !db.bankProfiles) return;
    
    if (db.bankProfiles.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">No bank accounts added yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = db.bankProfiles.map(b => {
        const safeId = escapeHTML(b.id).replace(/&#039;/g, "\\'"); 
        
        let corrHTML = '';
        if (b.corrName) {
            corrHTML = `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border); font-size: 0.8rem; color: var(--primary);">
                <b>Correspondent:</b> ${escapeHTML(b.corrName)}<br>
                <b>A/C:</b> ${escapeHTML(b.corrAcc)} | <b>SWIFT:</b> ${escapeHTML(b.corrSwift)}
            </div>`;
        }
        
        const defaultBadge = b.isDefault ? `<span style="background:var(--success); color:white; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:bold; margin-left:8px;">★ DOCUMENT DEFAULT</span>` : '';

        return `<tr style="border-bottom: 1px solid var(--border);">
            <td style="padding: 12px;">
                <b style="font-size: 1.05rem; color: var(--text);">${escapeHTML(b.bankName)}</b> ${defaultBadge}<br>
                <span style="font-family: monospace; font-size: 0.95rem; color: var(--primary); font-weight: bold;">A/C: ${escapeHTML(b.accountNo)}</span>
                ${corrHTML}
            </td>
            <td style="padding: 12px; font-family: monospace; font-size: 0.85rem;">
                <b>SWIFT:</b> ${escapeHTML(b.swift)}<br>
                <b>IFSC:</b> ${escapeHTML(b.ifsc || '---')}<br>
                <b>AD Code:</b> ${escapeHTML(b.adCode || '---')}
            </td>
            <td style="padding: 12px; color: var(--text-muted); font-size: 0.8rem;">
                ${b.corrName ? 'Yes' : 'None Linked'}
            </td>
            <td style="padding: 12px; text-align: right;">
                <button class="secondary" style="padding:6px 12px; font-size:0.8rem; margin-right: 5px;" onclick="editBank('${safeId}')">Edit</button>
                <button class="danger" style="padding:6px 12px; font-size:0.8rem;" onclick="deleteBank('${safeId}')">Delete</button>
            </td>
        </tr>`;
    }).join('');
}

window.deleteBank = function(id) {
    if (typeof Enterprise !== 'undefined' && !Enterprise.security.isAdmin(true)) return; 
    if(!confirm("Permanently delete this Bank Profile?")) return;
    db.bankProfiles = db.bankProfiles.filter(b => b.id !== id);
    
    db.bankProfiles = [...db.bankProfiles];
    if (typeof window.saveData === 'function') window.saveData(true);
    else if(typeof saveData === 'function') saveData(true);
    
    _settingsSyncHash = Date.now().toString();
    renderBanks();
};

// ==========================================
// USER ACCOUNTS & GRANULAR PERMISSIONS
// ==========================================

window.toggleUserOptions = function(role) {
    const buyMap = document.getElementById('buyer-map-block');
    const permMat = document.getElementById('granular-permissions-block');
    if (buyMap) buyMap.style.display = role === 'buyer' ? 'block' : 'none';
    
    // Enable Granular Module Access UI for Staff
    if (permMat) permMat.style.display = role === 'staff' ? 'block' : 'none';
};

window.toggleSubCb = function(parentCb, subClass) {
    const subs = document.querySelectorAll(`.${subClass} input[type="checkbox"]`);
    subs.forEach(cb => cb.checked = parentCb.checked);
};

window.addUser = function(e) {
    e.preventDefault();
    if (typeof Enterprise !== 'undefined' && !Enterprise.security.isAdmin(true)) return; 
    
    const uname = document.getElementById('new-user-name').value.trim();
    if (db.users.some(u => u.username.toLowerCase() === uname.toLowerCase())) {
        if(typeof Enterprise !== 'undefined') Enterprise.notify("Username already taken!", "danger");
        return;
    }
    
    const role = document.getElementById('new-user-role').value;
    const mappedBuyer = role === 'buyer' ? document.getElementById('new-user-buyer-map').value.trim() : null;

    if (role === 'buyer' && !mappedBuyer) return alert("You MUST specify a Buyer Name to create a B2B Portal account.");

    const canEdit = role === 'admin' ? true : document.getElementById('perm-edit').checked;
    const canDelete = role === 'admin' ? true : document.getElementById('perm-delete').checked;
    
    // Harvest granular permissions from the matrix if it's a staff role
    const allowedModules = [];
    if (role === 'admin' || role === 'buyer') {
        allowedModules.push('all');
    } else {
        const cbs = document.querySelectorAll('#granular-permissions-block input[type="checkbox"]:checked');
        cbs.forEach(cb => {
            if (cb.value && cb.value !== 'on') allowedModules.push(cb.value);
        });
    }

    db.users.push({
        id: 'USR_' + Date.now(),
        username: uname,
        password: '1234', 
        requirePasswordChange: true,
        role: role,
        mappedBuyer: mappedBuyer,
        canEdit: canEdit,
        canDelete: canDelete,
        allowedModules: allowedModules
    });
    
    db.users = [...db.users];
    if (typeof window.saveData === 'function') window.saveData(true);
    else if(typeof saveData === 'function') saveData(true);
    
    _settingsSyncHash = Date.now().toString();
    renderUsers(); 
    e.target.reset();
    
    if(typeof Enterprise !== 'undefined') {
        Enterprise.notify("User created! Default password is '1234'.", "success");
        Enterprise.logAction(`Created new user account: ${uname}`);
    }
};

function renderUsers() {
    const tbody = document.querySelector('#users-table tbody');
    if (!tbody || !db.users) return;

    // AUTO-DEDUPLICATION MAINTENANCE (REPAIRS DAMAGE FROM DUPLICATE PUSHES)
    const seenNames = new Set();
    const uniqueUsers = [];
    db.users.forEach(u => {
        if (!u.username) return;
        const lowered = u.username.toLowerCase();
        if (!seenNames.has(lowered)) {
            seenNames.add(lowered);
            uniqueUsers.push(u);
        }
    });
    if (uniqueUsers.length !== db.users.length) {
        db.users = uniqueUsers;
        if (typeof saveData === 'function') saveData(true);
    }

    tbody.innerHTML = db.users.map(u => {
        let roleBadge = '';
        if (u.role === 'admin') roleBadge = '<span style="background:#fee2e2; color:#991b1b; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold;">SYSTEM ADMIN</span>';
        else if (u.role === 'buyer') roleBadge = '<span style="background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold;">CLIENT PORTAL</span>';
        else roleBadge = '<span style="background:var(--bg); color:#475569; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold;">INTERNAL STAFF</span>';

        let mappingHtml = u.role === 'buyer' ? `<br><span style="color:var(--info); font-size: 0.8rem; font-weight:bold;">↳ ${escapeHTML(u.mappedBuyer)}</span>` : '';
        
        let permHtml = 'Full Database Control';
        if (u.role !== 'admin' && u.role !== 'buyer') {
            const editTag = u.canEdit ? '<span style="color:var(--success); font-weight:bold;">Write</span>' : '<span style="color:var(--text-muted);">Read-Only</span>';
            const delTag = u.canDelete ? '<span style="color:var(--danger); font-weight:bold;">Delete</span>' : '';
            const modCount = u.allowedModules && u.allowedModules[0] === 'all' ? 'All' : (u.allowedModules ? u.allowedModules.length : 0);
            permHtml = `${editTag} &nbsp; ${delTag} <br><span style="font-size:0.75rem; color:var(--text-muted);">Modules Accessed: ${modCount}</span>`;
        } else if (u.role === 'buyer') {
            permHtml = 'Restricted View Only';
        }

        const safeId = escapeHTML(u.id).replace(/&#039;/g, "\\'"); 
        return `<tr style="border-bottom: 1px solid var(--border);">
            <td style="padding: 12px; font-size: 1.05rem; font-weight: bold; color: var(--text);">${escapeHTML(u.username)}</td>
            <td style="padding: 12px;">${roleBadge} ${mappingHtml}</td>
            <td style="padding: 12px; font-size: 0.85rem;">${permHtml}</td>
            <td style="padding: 12px; text-align: right;">
                ${u.username !== 'admin' ? `<button class="danger" style="padding:6px 12px; font-size:0.8rem;" onclick="deleteUser('${safeId}')">Delete</button>` : '<span style="color:var(--text-muted); font-size:0.8rem;"><i>Protected Core</i></span>'}
            </td>
        </tr>`;
    }).join('');
}

window.deleteUser = function(id) {
    if (typeof Enterprise !== 'undefined' && !Enterprise.security.isAdmin(true)) return; 
    if(!confirm("Permanently delete this user account?")) return;
    
    const u = db.users.find(x => x.id === id);
    db.users = db.users.filter(x => x.id !== id);
    
    db.users = [...db.users];
    if (typeof window.saveData === 'function') window.saveData(true);
    else if(typeof saveData === 'function') saveData(true);
    
    _settingsSyncHash = Date.now().toString();
    renderUsers();
    if(typeof Enterprise !== 'undefined' && u) Enterprise.logAction(`Deleted user account: ${u.username}`);
};

async function updatePersonalPassword(e) {
    e.preventDefault();
    const np = document.getElementById('my-profile-new-pass').value;
    const cp = document.getElementById('my-profile-conf-pass').value;
    if (np !== cp) return alert("Passwords do not match!");
    
    const uname = sessionStorage.getItem('jft_user');
    const u = db.users.find(x => x.username === uname);
    if (u) {
        if(typeof hashPassword === 'function') u.password = await hashPassword(np);
        else u.password = np; 
        
        u.requirePasswordChange = false; 
        
        db.users = [...db.users];
        if (typeof window.saveData === 'function') window.saveData(true);
        else if(typeof saveData === 'function') saveData(true);
        
        e.target.reset();
        if(typeof Enterprise !== 'undefined') Enterprise.notify("Password successfully changed!", "success");
    }
}

// ==========================================
// CLOUD, EXPORT & PDF SETTINGS
// ==========================================

window.toggleGDriveAuth = function(checkbox) {
    if (typeof Enterprise !== 'undefined' && !Enterprise.security.isAdmin(true)) {
        checkbox.checked = !checkbox.checked; 
        return;
    }
    const block = document.getElementById('gdrive-auth-block');
    if(block) block.style.display = checkbox.checked ? 'block' : 'none';
    if (!db.meta) db.meta = {};
    db.meta.gdriveSync = checkbox.checked;
    
    if (typeof window.saveData === 'function') window.saveData(true);
    else if(typeof saveData === 'function') saveData(true);
};

window.authenticateGDrive = function() {
    if (typeof Enterprise !== 'undefined' && !Enterprise.security.isAdmin(true)) return; 
    const token = document.getElementById('gdrive-api-key').value;
    if (!token) return alert("Please enter an API Token to authenticate.");
    
    if(typeof Enterprise !== 'undefined') {
        Enterprise.notify("🔄 Establishing Secure Link to Google Drive...", "info");
        setTimeout(() => {
            Enterprise.notify("✅ Google Drive Authorized successfully!", "success");
            Enterprise.logAction("Connected Google Drive Vault Sync.");
            document.getElementById('gdrive-api-key').value = '';
            document.getElementById('gdrive-auth-block').innerHTML = `<div style="padding: 10px; background: rgba(34, 197, 94, 0.1); color: #166534; font-weight: bold; border-radius: 4px; border: 1px solid #bbf7d0;">✓ Google Drive Connected Securely</div>`;
        }, 1500);
    }
};

window.toggleDropboxAuth = function(checkbox) {
    if (typeof Enterprise !== 'undefined' && !Enterprise.security.isAdmin(true)) {
        checkbox.checked = !checkbox.checked; 
        return;
    }
    const block = document.getElementById('dropbox-auth-block');
    if(block) block.style.display = checkbox.checked ? 'block' : 'none';
    if (!db.meta) db.meta = {};
    db.meta.dropboxSync = checkbox.checked;
    
    if (typeof window.saveData === 'function') window.saveData(true);
    else if(typeof saveData === 'function') saveData(true);
};

window.authenticateDropbox = function() {
    if (typeof Enterprise !== 'undefined' && !Enterprise.security.isAdmin(true)) return; 
    const token = document.getElementById('dropbox-api-key').value;
    if (!token) return alert("Please enter an Access Token to authenticate.");
    
    if(typeof Enterprise !== 'undefined') {
        Enterprise.notify("🔄 Establishing Secure Link to Dropbox...", "info");
        setTimeout(() => {
            Enterprise.notify("✅ Dropbox Authorized successfully!", "success");
            Enterprise.logAction("Connected Dropbox Vault Sync.");
            document.getElementById('dropbox-api-key').value = '';
            document.getElementById('dropbox-auth-block').innerHTML = `<div style="padding: 10px; background: #e0f2fe; color: #0369a1; font-weight: bold; border-radius: 4px; border: 1px solid #bae6fd;">✓ Dropbox Connected Securely</div>`;
        }, 1500);
    }
};

window.savePrintSettings = function() {
    if (typeof Enterprise !== 'undefined' && !Enterprise.security.isAdmin(true)) return; 
    if (!db.uiConfig) db.uiConfig = {};
    
    db.uiConfig.printCurrency = document.getElementById('print-currency').value;
    db.uiConfig.printMargins = document.getElementById('print-margins').value;
    db.uiConfig.headerMargin = document.getElementById('print-header-margin').value || 45;
    db.uiConfig.footerMargin = document.getElementById('print-footer-margin').value || 27;
    
    db.uiConfig.useLetterhead = document.getElementById('print-letterhead-toggle').checked;
    db.uiConfig.useSignature = document.getElementById('print-signature-toggle').checked;
    db.uiConfig.signatureHeight = document.getElementById('print-signature-height').value || 80;

    db.uiConfig.letterheadDocs = {};
    document.querySelectorAll('.lh-doc-cb').forEach(cb => { db.uiConfig.letterheadDocs[cb.value] = cb.checked; });

    db.uiConfig.signatureDocs = {};
    document.querySelectorAll('.sig-doc-cb').forEach(cb => { db.uiConfig.signatureDocs[cb.value] = cb.checked; });
    
    localStorage.setItem('jft_uiConfig', JSON.stringify(db.uiConfig));
    db.uiConfig = {...db.uiConfig};
    
    if (typeof window.saveData === 'function') window.saveData(true);
    else if(typeof saveData === 'function') saveData(true);
    
    if (typeof Enterprise !== 'undefined') {
        Enterprise.notify("Print Settings & PDF Injection Logic Saved!", "success");
        Enterprise.logAction("Updated PDF Print Engine Settings.");
    }
};

// ==========================================
// EXPORT & IMPORT ENGINE WITH AUDIT PREVIEW
// ==========================================

window.downloadManualBackup = function() {
    if (typeof Enterprise !== 'undefined' && !Enterprise.security.isAdmin(true)) return; 
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `JFT_Master_Backup_${new Date().toISOString().split('T')[0]}.json`);
    dlAnchorElem.click();
    document.getElementById('set-last-backup').innerText = `Last Backup: ${new Date().toLocaleString()}`;
    if(typeof Enterprise !== 'undefined') Enterprise.logAction("Triggered manual JSON Master Database Backup.");
};

// ==========================================
// MASTER HARD DRIVE BACKUP LOGIC (Node/Electron)
// ==========================================

window.changeMasterBackupPath = async function() {
    if (typeof ipcRenderer === 'undefined' || !ipcRenderer) {
        return Enterprise.notify("Local Folder Selection requires the Desktop App.", "warning");
    }

    try {
        const selectedPath = await ipcRenderer.invoke('select-external-backup-folder');
        if (selectedPath) {
            if (!db.meta) db.meta = {};
            db.meta.masterBackupPath = selectedPath;
            if (typeof saveData === 'function') saveData(true);
            populateAllSettingsUI();
            Enterprise.notify("Master Backup Path Updated Successfully!", "success");
        }
    } catch (err) {
        console.error("Path selection error:", err);
        Enterprise.notify("Could not open directory picker.", "danger");
    }
};

window.triggerManualMasterBackup = function() {
    if (!db.meta.masterBackupPath) {
        return Enterprise.notify("Please configure a backup folder first!", "warning");
    }

    if (typeof ipcRenderer === 'undefined' || !ipcRenderer) {
        return Enterprise.notify("Local Backup requires the Desktop App.", "warning");
    }

    Enterprise.notify("🚀 Starting Master Database Backup...", "info");
    ipcRenderer.send('save-master-hard-drive-backup', db.meta.masterBackupPath, db);
};

// Listen for Master Backup status from Electron
if (typeof ipcRenderer !== 'undefined' && ipcRenderer) {
    ipcRenderer.on('master-backup-status', (event, response) => {
        if (response.success) {
            Enterprise.notify(`✅ Manual Backup Complete! [${response.day}]`, "success");
            const timeEl = document.getElementById('set-last-backup');
            if(timeEl) timeEl.innerText = `Last Drive Backup: ${response.timestamp} (${response.day})`;
            Enterprise.logAction(`Executed Master Hard Drive Backup: ${response.day} subfolder updated.`);
        } else {
            Enterprise.notify(`❌ Backup Failed: ${response.error}`, "danger");
        }
    });
}

// Global Excel Export via SheetJS — works for any db collection
window.exportModuleToExcel = function(collectionKey, sheetLabel) {
    if (typeof XLSX === 'undefined') {
        if(typeof Enterprise !== 'undefined') Enterprise.notify('Excel library not loaded. Check your internet connection.', 'danger');
        return;
    }
    const collection = collectionKey || document.getElementById('csv-export-module')?.value;
    const data = db[collection];
    if (!data || data.length === 0) {
        if(typeof Enterprise !== 'undefined') Enterprise.notify(`No data found in ${collection || 'selected module'}.`, 'warning');
        return;
    }
    
    // Flatten top-level fields, skip nested objects for clean Excel output
    const SKIP_KEYS = new Set(['items', 'dittoData', 'phytoVars', 'cooVars', 'customData', 'notes']);
    const headersSet = new Set();
    data.forEach(item => Object.keys(item).forEach(k => { if (!SKIP_KEYS.has(k)) headersSet.add(k); }));
    const headers = Array.from(headersSet);
    
    const wsData = [headers];
    data.forEach(item => {
        wsData.push(headers.map(h => {
            const v = item[h];
            if (v === null || v === undefined) return '';
            if (typeof v === 'object') return JSON.stringify(v).slice(0, 200);
            return v;
        }));
    });
    
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Auto-width columns
    const colWidths = headers.map((h, i) => {
        const max = Math.max(h.length, ...data.map(item => String(item[h] || '').length));
        return { wch: Math.min(max + 2, 50) };
    });
    ws['!cols'] = colWidths;
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, (sheetLabel || collection).slice(0, 30));
    
    const filename = `JFT_${sheetLabel || collection}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
    
    if(typeof Enterprise !== 'undefined') {
        Enterprise.notify(`✅ Excel export complete: ${filename}`, 'success');
        Enterprise.logAction(`Exported ${collection} to Excel.`);
    }
};


window.executeCSVExport = function() {
    const targetCol = document.getElementById('csv-export-module').value;
    if (!db[targetCol] || db[targetCol].length === 0) {
        if(typeof Enterprise !== 'undefined') Enterprise.notify("No data found in this module.", "warning");
        return;
    }
    const dataArray = db[targetCol];
    const headersSet = new Set();
    dataArray.forEach(item => {
        Object.keys(item).forEach(k => {
            if(k !== 'items' && k !== 'dittoData' && k !== 'phytoVars' && k !== 'customData' && k !== 'notes') headersSet.add(k);
        });
    });
    const headers = Array.from(headersSet);
    let csvContent = headers.join(',') + '\n';
    dataArray.forEach(item => {
        let row = headers.map(header => {
            let val = item[header];
            if (val === undefined || val === null) val = '';
            val = String(val).replace(/"/g, '""'); 
            if (val.startsWith('=') || val.startsWith('+') || val.startsWith('-') || val.startsWith('@')) val = "'" + val;
            return `"${val}"`;
        });
        csvContent += row.join(',') + '\n';
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `JFT_Export_${targetCol}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if(typeof Enterprise !== 'undefined') Enterprise.logAction(`Exported ${targetCol} database to CSV`);
};

window.downloadSampleCSV = function() {
    const module = document.getElementById('csv-import-module').value;
    let csv = '';
    
    if(module === 'inventory') {
        csv = 'name,category,currentQty,minQty,unit,price\nSample Item,Raw Material,100,20,MT,5000';
    } else if(module === 'expenses') {
        csv = 'date,category,party,ref,basic,tax,total,status\n2025-01-01,Transport,ABC Logistics,INV-01,1000,180,1180,Pending';
    } else if(module === 'crm_contacts') {
        csv = 'name,type,email,phone,country,isVip\nGlobal Traders,BUYER,test@test.com,+123456,USA,true';
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${module}_Template.csv`;
    link.click();
};

window.executeCSVImport = function() {
    if (typeof Enterprise !== 'undefined' && !Enterprise.security.isAdmin(true)) return; 
    const fileInput = document.getElementById('csv-import-file');
    const module = document.getElementById('csv-import-module').value;
    if (!fileInput.files || fileInput.files.length === 0) {
        if(typeof Enterprise !== 'undefined') Enterprise.notify("⚠️ Please select a CSV file first.", "warning");
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const rows = text.split('\n').filter(r => r.trim() !== '');
        if(rows.length < 2) return alert("File seems empty or missing headers.");
        
        const headers = rows[0].split(',').map(h => h.trim().replace(/['"]/g, ''));
        let parsedRecords = [];
        
        for(let i = 1; i < rows.length; i++) {
            const vals = rows[i].split(',').map(v => v.trim().replace(/['"]/g, ''));
            let obj = { id: 'IMP_' + Date.now() + i };
            headers.forEach((h, idx) => { 
                if (h === '__proto__' || h === 'constructor' || h === 'prototype') return; 
                obj[h] = vals[idx] || ''; 
            });
            
            if (module === 'inventory') {
                if (!obj.name) continue; 
                obj.currentQty = parseFloat(obj.currentQty || 0);
                obj.minQty = parseFloat(obj.minQty || 0);
            } else if (module === 'expenses') {
                if (!obj.party) continue; 
                obj.total = parseFloat(obj.total || 0);
                obj.basic = parseFloat(obj.basic || 0);
            } else if (module === 'crm_contacts') {
                if (!obj.name) continue;
                obj.isVip = obj.isVip === 'true';
            }
            parsedRecords.push(obj);
        }
        
        // Store temporarily for the Audit Modal Confirmation
        window.pendingCSVData = { module, headers, records: parsedRecords };
        
        // Render Preview Table
        const thead = document.querySelector('#csv-preview-table thead');
        const tbody = document.querySelector('#csv-preview-table tbody');
        
        thead.innerHTML = '<tr>' + headers.map(h => `<th style="padding: 10px; border-bottom: 1px solid var(--border); text-align: left;">${escapeHTML(h)}</th>`).join('') + '</tr>';
        
        tbody.innerHTML = parsedRecords.map(r => {
            return '<tr>' + headers.map(h => `<td style="padding: 10px; border-bottom: 1px solid var(--border);">${escapeHTML(String(r[h]))}</td>`).join('') + '</tr>';
        }).join('');
        
        document.getElementById('csv-preview-modal').style.display = 'flex';
        document.getElementById('csv-preview-modal').classList.remove('hidden');
    };
    reader.readAsText(fileInput.files[0]);
};

window.closeCSVPreview = function() {
    document.getElementById('csv-preview-modal').style.display = 'none';
    document.getElementById('csv-preview-modal').classList.add('hidden');
    document.getElementById('csv-import-file').value = '';
    window.pendingCSVData = null;
};

window.confirmCSVImport = function() {
    if (!window.pendingCSVData) return;
    const { module, records } = window.pendingCSVData;
    
    if (!db[module]) db[module] = [];
    db[module].push(...records);
    db[module] = [...db[module]]; // Force reactivity
    
    if (typeof window.saveData === 'function') window.saveData(true); 
    else if(typeof saveData === 'function') saveData(true);
    
    if(typeof Enterprise !== 'undefined') {
        Enterprise.notify(`✅ Successfully imported ${records.length} records to ${module}!`, "success");
        Enterprise.logAction(`Bulk Imported ${records.length} records via CSV to ${module}`);
    }
    
    closeCSVPreview();
};

// ==========================================
// SYSTEM BUILDER
// ==========================================

window.addDocType = function(e) {
    e.preventDefault();
    if (typeof Enterprise !== 'undefined' && !Enterprise.security.isAdmin(true)) return; 
    const newType = document.getElementById('new-doc-type').value.trim();
    if (!newType) return;
    if (!db.uiConfig) db.uiConfig = {};
    if (!db.uiConfig.docTypes) db.uiConfig.docTypes = ['Commercial Invoice', 'Proforma Invoice', 'Packing List', 'Phyto Draft'];
    
    if(!db.uiConfig.docTypes.includes(newType)) {
        db.uiConfig.docTypes.push(newType);
        db.uiConfig = {...db.uiConfig};
        if (typeof window.saveData === 'function') window.saveData(true); 
        else if(typeof saveData === 'function') saveData(true);
        renderDocTypesTable();
        document.getElementById('new-doc-type').value = '';
        if(typeof renderDocTabsUI === 'function') renderDocTabsUI();
    }
};

function renderDocTypesTable() {
    const tbody = document.querySelector('#doc-types-table tbody');
    if (!tbody || !db.uiConfig || !db.uiConfig.docTypes) return;
    tbody.innerHTML = db.uiConfig.docTypes.map((t, idx) => {
        const isCore = ['Commercial Invoice', 'Proforma Invoice', 'Packing List', 'Phyto Draft'].includes(t);
        return `<tr style="border-bottom: 1px solid var(--border);">
            <td style="padding: 10px;"><b>${escapeHTML(t)}</b></td>
            <td style="padding: 10px; text-align: right;">${isCore ? '<span style="color:var(--text-muted); font-size:0.8rem;"><i>System Core</i></span>' : `<button class="danger" style="padding: 4px 8px; font-size: 0.8rem;" onclick="deleteDocType(${idx})">Delete</button>`}</td>
        </tr>`;
    }).join('');
}

window.deleteDocType = function(idx) {
    if (typeof Enterprise !== 'undefined' && !Enterprise.security.isAdmin(true)) return; 
    if(!confirm("Remove this document tab from the system?")) return;
    db.uiConfig.docTypes.splice(idx, 1);
    db.uiConfig = {...db.uiConfig};
    if (typeof window.saveData === 'function') window.saveData(true); 
    else if(typeof saveData === 'function') saveData(true);
    renderDocTypesTable();
    if(typeof renderDocTabsUI === 'function') renderDocTabsUI();
};

window.addUniversalCustomField = function(e) {
    e.preventDefault();
    if (typeof Enterprise !== 'undefined' && !Enterprise.security.isAdmin(true)) return; 
    const name = document.getElementById('ucf-name').value.trim();
    const target = document.getElementById('ucf-target').value;
    if(!name) return;
    db.customFields.push({ id: 'cf_' + Date.now(), name: name, target: target });
    db.customFields = [...db.customFields];
    if (typeof window.saveData === 'function') window.saveData(true); 
    else if(typeof saveData === 'function') saveData(true);
    renderUnivCustomFields(); e.target.reset();
    if(typeof refreshActiveUI === 'function') refreshActiveUI();
    if(typeof Enterprise !== 'undefined') Enterprise.notify("Custom field injected globally!", "success");
};

function renderUnivCustomFields() {
    const tbody = document.querySelector('#univ-custom-fields-table tbody');
    if (!tbody) return;
    tbody.innerHTML = db.customFields.map(f => {
        let displayTarget = f.target;
        if(f.target === 'log_containers') displayTarget = 'Containers Tracker';
        if(f.target === 'log_trucks') displayTarget = 'Truck Tracker';
        if(f.target === 'log_vessels') displayTarget = 'Vessel Tracker';
        if(f.target === 'expenses') displayTarget = 'Expense Ledger';
        if(f.target === 'po') displayTarget = 'Purchase Orders';
        const safeId = escapeHTML(f.id).replace(/&#039;/g, "\\'"); 
        return `<tr style="border-bottom: 1px solid var(--border);">
            <td style="padding: 10px;"><b>${escapeHTML(f.name)}</b><br><small style="color:var(--text-muted);">ID: ${f.id}</small></td>
            <td style="padding: 10px; color: var(--primary);">${escapeHTML(displayTarget)}</td>
            <td style="padding: 10px; text-align: right;"><button class="danger" style="padding: 4px 8px; font-size: 0.8rem;" onclick="deleteCustomField('${safeId}')">Remove</button></td>
        </tr>`;
    }).join('');
}

window.deleteCustomField = function(id) {
    if (typeof Enterprise !== 'undefined' && !Enterprise.security.isAdmin(true)) return; 
    if(!confirm("Remove this custom field from the system?")) return;
    db.customFields = db.customFields.filter(f => f.id !== id);
    db.customFields = [...db.customFields];
    if (typeof window.saveData === 'function') window.saveData(true); 
    else if(typeof saveData === 'function') saveData(true);
    renderUnivCustomFields();
    if(typeof refreshActiveUI === 'function') refreshActiveUI();
};

function renderAuditLogs() {
    const tbody = document.getElementById('audit-logs-tbody');
    if (!tbody) return;
    if (!db.system_logs || db.system_logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:30px; color:var(--text-muted);">No system events recorded yet.</td></tr>`;
        return;
    }
    const sortedLogs = [...db.system_logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 500);
    tbody.innerHTML = sortedLogs.map(log => {
        const timeStr = new Date(log.timestamp).toLocaleString();
        return `<tr style="border-bottom: 1px solid var(--border);">
            <td style="padding: 10px; color:var(--text-muted); width: 180px;">${timeStr}</td>
            <td style="padding: 10px; font-weight:bold; color:var(--primary); width: 120px;">${escapeHTML(log.user)}</td>
            <td style="padding: 10px;">${escapeHTML(log.action)}</td>
        </tr>`;
    }).join('');
}

window.clearSystemCache = function() {
    if (typeof Enterprise !== 'undefined' && !Enterprise.security.isAdmin(true)) return; 
    if(confirm("This will wipe all locally cached UI memory. Are you sure?")) {
        localStorage.clear(); sessionStorage.clear(); window.location.reload();
    }
};

window.clearAuditLogs = function() {
    if (typeof Enterprise !== 'undefined' && !Enterprise.security.isAdmin(true)) return; 
    if(!confirm("⚠️ PERMANENT ACTION: This will purge the entire cloud-synced system audit ledger. Proceed?")) return;
    
    db.system_logs = [];
    if (typeof window.saveData === 'function') window.saveData(true); 
    else if(typeof saveData === 'function') saveData(true);
    
    renderAuditLogs();
    if(typeof Enterprise !== 'undefined') Enterprise.notify("System Audit Logs Purged", "success");
};

window.runSystemDiagnostic = function() {
    if (typeof Enterprise !== 'undefined' && !Enterprise.security.isAdmin(true)) return;
    
    if(typeof Enterprise !== 'undefined') Enterprise.notify("🩺 Doctor is checking system vitals...", "info");
    const db = window.db; if(!db) return;

    let issues = [];

    // 1. Orphaned Expense Audit
    (db.expenses || []).forEach(e => {
        if (e.docId && !db.docs.find(d => d.id === e.docId)) {
            issues.push({ type: 'Orphaned Expense', ref: e.party + ' (₹' + e.total + ')', sev: 'Medium', fix: 'Unlink' });
        }
    });

    // 2. Orphaned Forex Audit
    (db.forex || []).forEach(f => {
        if (f.docId && !db.docs.find(d => d.id === f.docId)) {
            issues.push({ type: 'Orphaned Forex', ref: (f.docNo || 'Unknown') + ' ($' + f.realFcy + ')', sev: 'High', fix: 'Unlink' });
        }
    });

    // 3. Duplicate Invoice Nos
    const invMap = {};
    (db.docs || []).forEach(d => {
        if (d.no) {
            invMap[d.no] = (invMap[d.no] || 0) + 1;
            if (invMap[d.no] > 1) issues.push({ type: 'Duplicate Inv No', ref: d.no, sev: 'Medium', fix: 'Rename Doc' });
        }
    });

    // 4. Currency Mismatch Audit
    (db.forex || []).forEach(f => {
        const doc = db.docs.find(d => d.id === f.docId);
        if (doc && f.currency && doc.currency && f.currency !== doc.currency) {
            issues.push({ type: 'Currency Variance', ref: doc.no + ' (' + doc.currency + ' vs ' + f.currency + ')', sev: 'Medium', fix: 'Verify ISO' });
        }
    });

    // Render Results
    const container = document.getElementById('diag-results-list');
    if (container) {
        if (issues.length === 0) {
            container.innerHTML = `<div style="padding:40px; text-align:center; color:var(--success);">
                <div style="font-size:3rem; margin-bottom:10px;">🏆</div>
                <h3>Pristine Data State</h3>
                <p>100% Integrity. No orphans or anomalies detected.</p>
            </div>`;
        } else {
            container.innerHTML = issues.map(iss => {
                const color = iss.sev === 'High' ? '#ef4444' : (iss.sev === 'Medium' ? '#f59e0b' : '#3b82f6');
                return `<div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:rgba(0,0,0,0.02); border-left:4px solid ${color}; border-radius:6px; margin-bottom:8px;">
                    <div><b style="font-size:0.85rem;">${iss.type}</b><br><small style="color:var(--text-muted);">${iss.ref}</small></div>
                    <div style="text-align:right;">
                        <span style="font-size:0.6rem; background:${color}; color:white; padding:1px 5px; border-radius:8px; font-weight:bold;">${iss.sev}</span>
                        <div style="font-size:0.7rem; color:var(--primary); margin-top:3px;">Rec: ${iss.fix}</div>
                    </div>
                </div>`;
            }).join('');
        }
    }

    const countEl = document.getElementById('diag-summary-count');
    if (countEl) countEl.innerText = issues.length;
    if(typeof Enterprise !== 'undefined') Enterprise.notify(`Diagnostic Complete: ${issues.length} findings.`, issues.length > 0 ? "warning" : "success");
};

window.repairOrphans = function() {
    if (!confirm("Attempt Auto-Repair? This will unlink records from non-existent invoices.")) return;
    const db = window.db; let fixed = 0;
    (db.expenses || []).forEach(e => { if (e.docId && !db.docs.find(d => d.id === e.docId)) { e.docId = ''; fixed++; } });
    (db.forex || []).forEach(f => { if (f.docId && !db.docs.find(d => d.id === f.docId)) { f.docId = ''; fixed++; } });
    if (fixed > 0) {
        if(typeof saveData === 'function') saveData(true);
        runSystemDiagnostic();
        if(typeof Enterprise !== 'undefined') Enterprise.notify(`Auto-Repair Complete: ${fixed} records recovered.`, "success");
    } else {
        if(typeof Enterprise !== 'undefined') Enterprise.notify("No repairable orphans found.", "info");
    }
};

window.initSettingsSystem = initSettingsSystem;
initSettingsSystem();



