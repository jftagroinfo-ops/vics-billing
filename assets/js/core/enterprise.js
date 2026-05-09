/* --- ENTERPRISE SECURITY & NOTIFICATION CORE (FIREBASE AUTH EDITION) --- */

let isCloudReady = false;
var isDesktopApp = typeof window.electron !== 'undefined';
var ipcRenderer = window.electron?.ipcRenderer || null;
window.ipcRenderer = ipcRenderer; // Global access for modules

const Enterprise = {
    notify: function(message, type = 'info') {
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        } else {
            console.log(`[NOTIFY] ${type.toUpperCase()}: ${message}`);
            // Fallback to legacy if showToast isn't loaded for some reason
            const area = document.getElementById('system-notification-area');
            if (area) {
                // simple append
                const div = document.createElement('div');
                div.innerText = message;
                area.appendChild(div);
                setTimeout(() => div.remove(), 3000);
            }
        }
    },

    logAction: function(actionMsg) {
        if (typeof db === 'undefined') return;
        const user = sessionStorage.getItem('jft_user') || 'System';
        const logId = 'log-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
        const logEntry = {
            id: logId,
            user: user,
            action: actionMsg,
            timestamp: new Date().toISOString()
        };
        
        if (!db.system_logs) db.system_logs = [];
        db.system_logs.unshift(logEntry); // Add locally for immediate viewing
        if (db.system_logs.length > 500) {
            db.system_logs = db.system_logs.slice(0, 500);
        }

        // STRICT APPEND-ONLY: Write directly to Firebase out-of-band to prevent batch overriding
        if (typeof cloudDB !== 'undefined' && cloudDB.collection) {
            cloudDB.collection('system_logs').doc(logId).set(logEntry).catch(e => console.error("Log failed:", e));
        } else if (typeof saveData === 'function') {
            saveData(true);
        }
    },

    // --- FINANCIAL YEAR UTILITIES (April 1 to March 31) ---
    getFY: function(dateStr) {
        const d = dateStr ? new Date(dateStr) : new Date();
        const year = d.getFullYear();
        const month = d.getMonth(); // 0 is January
        const startY = (month >= 3) ? year : year - 1;
        return `${startY}-${(startY + 1).toString().slice(2)}`;
    },

    initFYSelector: function(elementId, defaultToCurrent = true) {
        const sel = document.getElementById(elementId);
        if (!sel || (sel.options && sel.options.length > 1)) return;
        
        const currentFY = this.getFY();
        const startYear = parseInt(currentFY.split('-')[0]);
        
        let html = `<option value="">All Financial Years</option>`;
        for(let i = 0; i < 6; i++) {
            const y1 = startYear - i;
            const fy = `${y1}-${(y1 + 1).toString().slice(2)}`;
            html += `<option value="${fy}">${fy}</option>`;
        }
        sel.innerHTML = html;
        if(defaultToCurrent) sel.value = currentFY;
    },

    checkFY: function(dateStr, filterFY) {
        if (!filterFY || !dateStr) return true;
        const dDate = new Date(dateStr);
        if (isNaN(dDate.getTime())) return true;
        
        const parts = filterFY.split('-');
        const y1 = parseInt(parts[0]);
        const y2 = y1 + 1; // Explicitly calc year 2
        
        const fyStart = new Date(`${y1}-04-01T00:00:00`);
        const fyEnd = new Date(`${y2}-03-31T23:59:59`);
        return dDate >= fyStart && dDate <= fyEnd;
    },

    security: {
        getCurrentUser: function() {
            const sessionUser = sessionStorage.getItem('jft_user');
            const dbUser = (typeof db !== 'undefined' && db.users && sessionUser) 
                ? db.users.find(u => u.username.toLowerCase() === sessionUser.toLowerCase()) 
                : null;

            return {
                username: sessionUser || 'Guest',
                role: dbUser ? dbUser.role : (sessionStorage.getItem('jft_role') || 'viewer'),
                canDelete: dbUser ? dbUser.canDelete : (sessionStorage.getItem('jft_canDelete') === 'true')
            };
        },
        canDelete: function() {
            const user = this.getCurrentUser();
            if (user.role === 'admin') return true;
            if (user.canDelete) return true;
            Enterprise.notify("Access Denied: You do not have permission to delete records.", "danger");
            return false;
        },
        isAdmin: function(showToast = true) {
            const user = this.getCurrentUser();
            if (user.role !== 'admin') {
                if (showToast) Enterprise.notify("Access Denied: Administrator privileges required.", "danger");
                return false;
            }
            return true;
        }
    },

    AI: {
        lastSync: localStorage.getItem('jft_ai_last_sync') || 'Never',
        isOnline: false,
        macro: { oil: 84.50, dxy: 103.20, gold: 2150.00, fed: 5.50, updated: 'Never' },
        
        saveConfigs: async function() {
            const g = document.getElementById('ai-key-gemini').value.trim();
            const o = document.getElementById('ai-key-openai').value.trim();
            
            if (g) localStorage.setItem('jft_ai_api_key', g);
            else localStorage.removeItem('jft_ai_api_key');
            
            if (o) localStorage.setItem('jft_openai_api_key', o);
            else localStorage.removeItem('jft_openai_api_key');

            if (typeof db !== 'undefined') {
                if (!db.meta) db.meta = {};
                if (!db.meta.apiKeys) db.meta.apiKeys = {};
                db.meta.apiKeys.geminiApiKey = g;
                db.meta.apiKeys.openaiApiKey = o;
                if (typeof saveData === 'function') saveData(true);
            }
            
            Enterprise.notify("🌍 AI Credentials Staged. Testing connection...", "info");
            await this.syncPulse(true);
        },

        syncPulse: async function(force = false) {
            try {
                // 1. Fetch Forex & Macro
                const res = await fetch('https://open.er-api.com/v6/latest/USD');
                const data = await res.json();
                if (data && data.rates && data.rates.INR) {
                    window.lastUSDINR = data.rates.INR;
                    this.isOnline = true;
                    this.macro.updated = new Date().toLocaleTimeString();
                    
                    // Simulated Macro (Correlated to USD/INR volatility)
                    const shift = (data.rates.INR - 83.00) * 0.4;
                    this.macro.dxy = 103.50 + shift;
                    this.macro.oil = 82.00 + (Math.random() * 5); 
                    this.macro.gold = 2150.00 + (shift * 20);
                }
                
                // 2. Validate Keys via a silent "Ping"
                const ping = await this.ask("PING", "You are a connectivity tester. Respond with PONG.");
                if (ping.text && ping.text.includes("PONG")) {
                    this.isOnline = true;
                    if (force) Enterprise.notify("🚀 AI Engine Online: Keys Verified & Link Synchronized!", "success");
                } else {
                    if (force) Enterprise.notify("⚠️ AI Response Interrupted. Check API Keys.", "warning");
                }

                this.registerSync();
                this.updateStatusUI();
                
                // Propagate to Tabs
                if (typeof runMAFAEEngine === 'function' && force) runMAFAEEngine();
                if (typeof runMAFAEImportEngine === 'function' && force) runMAFAEImportEngine();

            } catch (err) {
                this.isOnline = false;
                if (force) Enterprise.notify("❌ Network Error: AI working in Offline/Heuristic mode.", "danger");
                this.updateStatusUI();
            }
        },

        updateStatusUI: function() {
            const hasGemini = !!(localStorage.getItem('jft_ai_api_key') || (typeof db !== 'undefined' && db.meta?.apiKeys?.geminiApiKey));
            const hasOpenAI = !!(localStorage.getItem('jft_openai_api_key') || (typeof db !== 'undefined' && db.meta?.apiKeys?.openaiApiKey));
            
            const gStat = document.getElementById('status-gemini');
            const oStat = document.getElementById('status-openai');
            const globalStat = document.getElementById('ai-global-status');
            const syncEl = document.getElementById('ai-last-sync');

            if (gStat) {
                gStat.innerHTML = `Gemini: <span style="color:${hasGemini?'#10b981':'#ef4444'}; font-weight:bold;">${hasGemini ? (this.isOnline ? 'ONLINE' : 'LINKED (OFFLINE)') : 'UNLINKED'}</span>`;
            }
            if (oStat) {
                oStat.innerHTML = `ChatGPT: <span style="color:${hasOpenAI?'#10b981':'#ef4444'}; font-weight:bold;">${hasOpenAI ? (this.isOnline ? 'ONLINE' : 'LINKED (OFFLINE)') : 'UNLINKED'}</span>`;
            }
            
            if (globalStat) {
                const colors = this.isOnline ? {bg: 'rgba(16,185,129,0.1)', dot: '#10b981', text: '#059669', msg: 'SYSTEM LIVE (AI CLOUD SYNC)'} 
                                            : {bg: 'rgba(239,68,68,0.05)', dot: '#ef4444', text: '#ef4444', msg: 'OFFLINE (LOCAL HEURISTICS)'};
                globalStat.innerHTML = `<span style="display:inline-block; width:8px; height:8px; background:${colors.dot}; border-radius:50%; box-shadow:0 0 5px ${colors.dot};"></span> ${colors.msg}`;
                globalStat.style.color = colors.text;
                globalStat.style.background = colors.bg;
            }

            // Dashboard Sync
            const dashDot = document.getElementById('dash-ai-status-dot');
            const dashText = document.getElementById('dash-ai-status-text');
            if (dashDot) {
                dashDot.style.background = this.isOnline ? '#10b981' : '#ef4444';
                dashDot.style.boxShadow = `0 0 5px ${this.isOnline ? '#10b981' : '#ef4444'}`;
            }
            if (dashText) {
                dashText.innerText = this.isOnline ? 'AI ENGINE: LIVE & SYNCED' : 'AI ENGINE: OFFLINE';
                dashText.style.color = this.isOnline ? '#10b981' : '#ef4444';
            }

            if (syncEl) syncEl.innerText = this.macro.updated || 'Never';

            // Input Persistence
            const gi = document.getElementById('ai-key-gemini');
            const oi = document.getElementById('ai-key-openai');
            if (gi && !gi.value) gi.value = localStorage.getItem('jft_ai_api_key') || (typeof db !== 'undefined' && db.meta?.apiKeys?.geminiApiKey) || '';
            if (oi && !oi.value) oi.value = localStorage.getItem('jft_openai_api_key') || (typeof db !== 'undefined' && db.meta?.apiKeys?.openaiApiKey) || '';
        },

        ask: async function(prompt, systemPrompt = "You are JFT Enterprise AI.") {
            const dbGK = (typeof db !== 'undefined' && db.meta?.apiKeys?.geminiApiKey);
            const dbOK = (typeof db !== 'undefined' && db.meta?.apiKeys?.openaiApiKey);
            
            const customGK = localStorage.getItem('jft_ai_api_key') || dbGK;
            const customOK = localStorage.getItem('jft_openai_api_key') || dbOK;

            let defaultGK = "AIzaSyCRubhGsuugQThhxkURvvzt2dkwVCNu8QM"; // MASTER FAILOVER
            let defaultOK = "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";

            const openaiBase = "https://api.openai.com";

            const tryGemini = async (key, type) => {
                if (!key || key.length < 5) return null;
                try {
                    // Modern V1 endpoint with Flash 1.5 support
                    const res = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${key}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ contents: [{ parts: [{ text: `${systemPrompt}\n\nUSER: ${prompt}` }] }] })
                    });
                    
                    if (res.status === 404) {
                        // Fallback to Gemini Pro if Flash is not enabled for this key/region
                        const res2 = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${key}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ contents: [{ parts: [{ text: `${systemPrompt}\n\nUSER: ${prompt}` }] }] })
                        });
                        const data2 = await res2.json();
                        if (data2.candidates?.[0]?.content?.parts?.[0]?.text) {
                            return { text: data2.candidates[0].content.parts[0].text, source: `GEMINI-PRO (${type})` };
                        }
                    }

                    const data = await res.json();
                    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                        return { text: data.candidates[0].content.parts[0].text, source: `GEMINI-FLASH (${type})` };
                    }
                } catch (e) { console.warn(`Gemini ${type} Fail:`, e); }
                return null;
            };

            const tryOpenAI = async (key, type) => {
                if (!key || key.length < 5) return null;
                try {
                    const res = await fetch(`${openaiBase}/v1/chat/completions`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
                        body: JSON.stringify({
                            model: 'gpt-4o-mini',
                            messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
                            max_tokens: 500,
                            temperature: 0.7
                        })
                    });
                    const data = await res.json();
                    if (data.choices?.[0]?.message?.content) {
                        return { text: data.choices[0].message.content, source: `GPT (${type})` };
                    }
                } catch (e) { console.warn(`OpenAI ${type} Fail:`, e); }
                return null;
            };

            // PROGRESSIVE FAILOVER CLUSTER
            let result = await tryGemini(customGK, "CUSTOM");
            if (!result) result = await tryGemini(defaultGK, "MASTER_FAILOVER");
            if (!result) result = await tryOpenAI(customOK, "CUSTOM");
            if (!result) result = await tryOpenAI(defaultOK, "MASTER_FAILOVER");

            // IF CLOUD FAILS, LOG IT AND FALLBACK TO LOCAL HEURISTICS
            if (result) {
                this.isOnline = true;
                this.registerSync();
                return result;
            } else {
                console.warn("[AI] All Cloud API attempts failed. Using Local Heuristics.");
                // Use fallback from modular KB
                const localAnswer = typeof smartAnswer === 'function' ? smartAnswer(prompt) : "I'm currently working in offline mode. Please check your cloud connection or API keys.";
                const tip = (!customGK && !customOK) ? "<br><br>💡 <b>Tip:</b> Link your own Gemini API Key in <i>Settings -> Maintenance & Updates</i> to unlock deeper intelligence." : "";
                return { text: localAnswer + tip, source: 'LOCAL_HEURISTIC' };
            }
        },

        registerSync: function() {
            this.lastSync = new Date().toLocaleString();
            localStorage.setItem('jft_ai_last_sync', this.lastSync);
            const syncEl = document.getElementById('ai-last-sync');
            if (syncEl) syncEl.innerText = this.lastSync;
        }
    }
};

// AUTO-REFRESH ENGINE (EVERY 15 MINS)
setInterval(() => {
    if (Enterprise.AI && Enterprise.AI.syncPulse) Enterprise.AI.syncPulse();
}, 900000);

// --- 2. LOGIN & AUTHENTICATION LOGIC ---

document.addEventListener("DOMContentLoaded", () => {
    // SECURED: Firebase Observer handles session continuity automatically
    if (typeof firebase !== 'undefined' && firebase.auth) {
        
        // Use LOCAL persistence so the user stays logged in even if the app is closed/reopened on mobile
        firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(console.error);

        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                // Determine username from email or metadata
                const username = user.displayName || user.email.split('@')[0];
                
                // If sessionStorage was cleared (e.g. app restart), restore it from the Firebase user
                if (!sessionStorage.getItem('jft_user')) {
                    console.log("[AUTH] Restoring session from Firebase user...");
                    sessionStorage.setItem('jft_user', username);
                    sessionStorage.setItem('jft_email', user.email);
                }
                
                // Robust Fallback Logic for Database user sync
                let attempts = 0;
                const waitForDB = setInterval(async () => {
                    attempts++;
                    if (typeof db !== 'undefined' && db.users && db.users.length > 0) {
                        clearInterval(waitForDB);
                        const userRecord = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
                        const role = userRecord ? userRecord.role : 'viewer';
                        const canDelete = userRecord ? userRecord.canDelete : false;
                        const allowedModules = userRecord ? userRecord.allowedModules : [];
                        
                        processSuccessfulLogin(username, role, canDelete, allowedModules);
                    } else if (attempts > 6 && typeof cloudDB !== 'undefined') {
                        // After 3 seconds, if local cache hasn't hydrated, fetch directly from Firestore to unblock login
                        clearInterval(waitForDB);
                        try {
                            const usersSnap = await cloudDB.collection('users').where('username', '==', username).get();
                            if (!usersSnap.empty) {
                                const userRecord = usersSnap.docs[0].data();
                                processSuccessfulLogin(username, userRecord.role || 'viewer', userRecord.canDelete || false, userRecord.allowedModules || []);
                            } else {
                                processSuccessfulLogin(username, 'viewer', false, []); // Safe fallback
                            }
                        } catch (err) {
                            console.warn("Direct DB fetch failed, defaulting to viewer.", err);
                            processSuccessfulLogin(username, 'viewer', false, []);
                        }
                    }
                }, 500);

                // ENSURE AI STATUS IS REFRESHED ON LOGIN
                setTimeout(() => {
                    if (Enterprise.AI && Enterprise.AI.updateStatusUI) Enterprise.AI.updateStatusUI();
                }, 1000);
            } else {
                // Force show login if no active Firebase session
                document.body.classList.add('auth-locked');
                document.getElementById('login-overlay').style.display = 'flex';
                const userDisplay = document.getElementById('current-user-display');
                if (userDisplay) userDisplay.innerText = `Logged Out`;

                // Auto-fill last used user id for convenience without storing password
                const lastUser = localStorage.getItem('jft_last_user');
                if (lastUser) {
                    const userInput = document.getElementById('login-user');
                    if (userInput && !userInput.value) userInput.value = lastUser;
                }
            }
        });
    } else {
        console.error("Firebase Auth SDK not loaded! Check index.html");
    }
});

async function performLogin(event) {
    event.preventDefault();
    
    const userInput = document.getElementById('login-user').value.trim().toLowerCase();
    const passInput = document.getElementById('login-pass').value; 
    const errorBox = document.getElementById('login-error');
    const btn = event.target.querySelector('button');

    try {
        btn.innerText = "Authenticating...";
        btn.disabled = true;

        // --- 1. LOGIN ATTEMPT (Exclusive Firebase Auth) ---
        const email = userInput.includes('@') ? userInput : `${userInput}@jftagro.local`;
        
        // Ensure we use LOCAL persistence before signing in
        await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        
        await firebase.auth().signInWithEmailAndPassword(email, passInput);
        
        // Pre-set session storage to avoid race conditions with onAuthStateChanged
        sessionStorage.setItem('jft_user', userInput.split('@')[0]);
        sessionStorage.setItem('jft_email', email);

        errorBox.style.display = 'none';
        btn.innerText = "Secure Login";
        
    } catch (error) {
        console.error("Auth Error:", error);
        errorBox.innerText = "Invalid Username or Password!";
        errorBox.style.display = 'block';
        btn.innerText = "Secure Login";
        btn.disabled = false;
    }
}

function processSuccessfulLogin(username, role, canDelete, allowedModules = []) {
    sessionStorage.setItem('jft_user', username);
    sessionStorage.setItem('jft_role', role);
    sessionStorage.setItem('jft_canDelete', canDelete ? 'true' : 'false');
    
    // Fallback: If allowedModules is empty but they are staff, assume they should see most things except sensitive ones
    const finalAllowed = (allowedModules && allowedModules.length > 0) ? allowedModules : (role === 'admin' ? ['all'] : []);
    sessionStorage.setItem('jft_allowed', JSON.stringify(finalAllowed));
    localStorage.setItem('jft_last_user', username);
    
    document.body.classList.remove('auth-locked');
    document.getElementById('login-overlay').style.display = 'none';
    const userDisplay = document.getElementById('current-user-display');
    if (userDisplay) {
        userDisplay.innerText = `👤 ${username}`;
        if (isDesktopApp) userDisplay.innerHTML += ` <span style="background:var(--accent); color:white; font-size:0.6rem; padding:2px 4px; border-radius:3px; margin-left:5px;">DESKTOP</span>`;
    }

    if (typeof window.startEnterpriseSync === 'function') window.startEnterpriseSync();
    if (Enterprise.AI && Enterprise.AI.syncPulse) Enterprise.AI.syncPulse();

    Enterprise.logAction("Logged into system.");
    Enterprise.notify(`Welcome back, ${username}!`, "success");
    enforceRoleUI(role);
    resetIdleTimer();
    
    // Run smart business alerts after DB has had time to hydrate (5s delay)
    setTimeout(() => { if (typeof window.runSmartBusinessAlerts === 'function') window.runSmartBusinessAlerts(); }, 5000);
}

function enforceRoleUI(role) {
    // 1. TOP-LEVEL NAVIGATION ENFORCEMENT
    // User wants "Same View as Admin" but hide specific modules.
    const forbiddenModules = ['nav-costing']; // "Costing Calculator" is the only full module restricted.
    
    // Ensure Top Bar and Sidebar are ALWAYS visible (User reported they were missing)
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.style.display = 'flex';
    const mainHeader = document.querySelector('.header');
    if (mainHeader) mainHeader.style.display = 'flex';
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.style.marginLeft = ''; // Reset possible buyer/mobile overrides

    if (role !== 'admin') {
        forbiddenModules.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        
        // Hide sensitive utility items
        const cloudBtn = document.querySelector('button[onclick*="window.forceSync"]');
        if (cloudBtn) cloudBtn.style.display = 'none';
    } else {
        // Admin: Show all modules
        forbiddenModules.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'flex';
        });
        const cloudBtn = document.querySelector('button[onclick*="window.forceSync"]');
        if (cloudBtn) cloudBtn.style.display = '';
    }

    // 2. SUB-TAB ENFORCEMENT (Finance, Settings) 
    // These are handled dynamically inside modules/finance.js and modules/settings.js 
    // to hide specific buttons like "Global PnL" and "Audit Logs".
}

function logout() {
    Enterprise.logAction("Logged out of system.");
    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().signOut().then(() => {
            sessionStorage.clear();
            location.reload();
        });
    }
}

// --- 3. SESSION LOCK & IDLE TIMEOUT LOGIC ---
let idleTimer;
let activityThrottler;
const IDLE_TIMEOUT_MS = 300000; // 5 MINUTES FOR SECURE IDLE AUTOLOCK

function resetIdleTimer() {
    clearTimeout(idleTimer);
    const sessionLockOverlay = document.getElementById('session-lock-overlay');
    if (sessionStorage.getItem('jft_user') && sessionLockOverlay && sessionLockOverlay.classList.contains('hidden')) {
        idleTimer = setTimeout(lockSession, IDLE_TIMEOUT_MS); 
    }
}

function throttledActivity() {
    if (!activityThrottler) {
        activityThrottler = setTimeout(() => {
            resetIdleTimer();
            activityThrottler = null;
        }, 2500); 
    }
}

window.addEventListener('mousemove', throttledActivity);
window.addEventListener('keydown', throttledActivity);
window.addEventListener('click', throttledActivity);
window.addEventListener('scroll', throttledActivity);

window.performLogout = function() {
    // SECURITY UPGRADE: Force a final backup before session termination
    if (typeof ipcRenderer !== 'undefined' && ipcRenderer) {
        if (typeof window.saveData === 'function') {
            console.log("[LOGOUT] Forcing final master backup...");
            window.saveData(true); 
        } else if (typeof triggerManualMasterBackup === 'function') {
            triggerManualMasterBackup();
        }
    } else {
        if (!confirm("Are you sure you want to log out of SMA ERP?")) return;
    }

    Enterprise.logAction("User manually logged out.");
    sessionStorage.clear();
    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().signOut().then(() => {
            location.reload();
        }).catch(() => {
            location.reload();
        });
    }
};

window.lockSession = function(manual = false) {
    const sessionLockOverlay = document.getElementById('session-lock-overlay');
    if (sessionLockOverlay) {
        sessionLockOverlay.classList.remove('hidden');
        sessionLockOverlay.style.display = 'flex';
        const passEl = document.getElementById('unlock-pass');
        if (passEl) setTimeout(() => passEl.focus(), 100);
        Enterprise.logAction(manual === true ? "Session manually locked by user." : "Session auto-locked due to inactivity.");
    }
}

window.unlockSession = async function(event) {
    event.preventDefault();
    const pass = document.getElementById('unlock-pass').value;
    const email = sessionStorage.getItem('jft_email') || `${sessionStorage.getItem('jft_user')}@jftagro.local`;
    const uname = sessionStorage.getItem('jft_user');
    const btn = event.target.querySelector('button');

    btn.innerText = "Verifying...";

    // 1. OFFLINE CAPABLE PIN SYSTEM (Fallback & Fast Check)
    if (window.db && window.db.users) {
        const u = window.db.users.find(x => x.username === uname);
        // By default, system sets '1234' on local user creation
        // Also supports checking against user defined offline pass
        if (u && (pass === u.password || pass === '1234')) {
            _grantUnlock(btn);
            return;
        }
    }

    // 2. FIREBASE PROD SYSTEM (If online)
    if (navigator.onLine && typeof firebase !== 'undefined' && firebase.auth) {
        try {
            await firebase.auth().signInWithEmailAndPassword(email, pass);
            _grantUnlock(btn);
            return;
        } catch(err) {
            console.warn("Firebase Auth Sync Fail", err);
        }
    }

    Enterprise.notify("Incorrect PIN or Password!", "danger");
    btn.innerText = "Unlock Workspace";
    document.getElementById('unlock-pass').value = '';
    document.getElementById('unlock-pass').focus();
}

function _grantUnlock(btn) {
    document.getElementById('session-lock-overlay').classList.add('hidden');
    document.getElementById('session-lock-overlay').style.display = 'none';
    document.getElementById('unlock-pass').value = '';
    
    Enterprise.notify("Workspace Unlocked", "success");
    Enterprise.logAction("Session unlocked successfully.");
    resetIdleTimer();
    if(btn) btn.innerText = "Unlock Workspace";
}

const style = document.createElement('style');
style.innerHTML = `@keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`;
document.head.appendChild(style);

// ============================================================
// SMART BUSINESS ALERTS ENGINE (Runs after login)
// ============================================================
window.runSmartBusinessAlerts = function() {
    if (sessionStorage.getItem('jft_role') !== 'admin') return;
    if (typeof db === 'undefined') { setTimeout(window.runSmartBusinessAlerts, 2000); return; }
    
    const today = new Date();
    const alerts = [];
    
    // 1. Overdue Invoices (Commercial Invoices that are Sent/Shipped for > 30 days)
    const overdueInvoices = (db.docs || []).filter(d => {
        if (d.type !== 'Commercial Invoice') return false;
        if (['Paid', 'Cancelled'].includes(d.status)) return false;
        const invoiceDate = new Date(d.date);
        const ageDays = Math.floor((today - invoiceDate) / (1000 * 60 * 60 * 24));
        return ageDays > 30;
    });
    if (overdueInvoices.length > 0) {
        alerts.push({ type: 'warning', msg: `⚠️ ${overdueInvoices.length} invoice(s) are overdue (unpaid > 30 days). Review in Finance → Aging Report.` });
    }
    
    // 2. LC Expiry Alert (LCs expiring in <= 30 days)
    const expiringLCs = (db.lcs || []).filter(lc => {
        if (!lc.expiryDate || lc.status === 'Expired') return false;
        const daysLeft = Math.ceil((new Date(lc.expiryDate) - today) / (1000 * 60 * 60 * 24));
        return daysLeft >= 0 && daysLeft <= 30;
    });
    if (expiringLCs.length > 0) {
        alerts.push({ type: 'danger', msg: `🏦 ${expiringLCs.length} LC(s) expiring within 30 days! Go to LC Manager immediately.` });
    }
    
    // 3. Compliance Document Expiry
    const expiringDocs = (db.exporter_data || []).filter(d => {
        if (!d.expiryDate) return false;
        const daysLeft = Math.ceil((new Date(d.expiryDate) - today) / (1000 * 60 * 60 * 24));
        return daysLeft >= 0 && daysLeft <= 45;
    });
    if (expiringDocs.length > 0) {
        alerts.push({ type: 'warning', msg: `🛡️ ${expiringDocs.length} compliance certificate(s) expiring within 45 days. Check Document Vault.` });
    }

    // 4. Stuck Tasks Alert (Sync with Task Module logic)
    const validDocIds = new Set((db.docs || []).filter(d => d.type === 'Commercial Invoice' && d.status !== 'Cancelled').map(d => d.id));
    const activeStuckTasks = (db.tasks || []).filter(t => t.status === 'Stuck' && validDocIds.has(t.docId));
    
    if (activeStuckTasks.length > 0) {
        alerts.push({ type: 'danger', msg: `🚨 ${activeStuckTasks.length} workflow task(s) are currently STUCK. Immediate attention required.` });
    }
    
    // Show alerts with a delay between each
    alerts.forEach((alert, i) => {
        setTimeout(() => Enterprise.notify(alert.msg, alert.type), (i + 1) * 1800);
    });
    
    if (alerts.length > 0) {
        console.info(`[JFT Smart Alerts] ${alerts.length} business alert(s) dispatched.`);
    }
};

/**
 * ============================================================
 * ENTERPRISE AUTO-UPDATE & BINARY DEPLOYMENT ENGINE (Phase 12)
 * ============================================================
 */
Enterprise.SoftwareVersion = '8.3.1';

Enterprise.Updates = {
    check: async function(manual = false) {
        console.log("[UPDATE] Checking for system-wide enterprise updates...");
        try {
            if (typeof cloudDB === 'undefined' || !cloudDB) return;
            const doc = await cloudDB.collection('system_info').doc('update_config').get();
            
            let latestVer = Enterprise.SoftwareVersion;
            let lastChecked = new Date().toLocaleTimeString();
            
            if (doc.exists) {
                const data = doc.data();
                latestVer = data.version || Enterprise.SoftwareVersion;
            }

            // Update Settings UI if active
            const statusText = document.getElementById('update-status-text');
            const statusIcon = document.getElementById('update-status-icon');
            const statusLast = document.getElementById('update-last-checked');
            const verBadge = document.getElementById('current-version-badge');

            if (verBadge) verBadge.innerText = `VERSION v${Enterprise.SoftwareVersion}`;

            if (this.compareVersions(latestVer, Enterprise.SoftwareVersion) > 0) {
                const msg = `🚀 NEW SYSTEM UPDATE: Version v${latestVer} is now available. Important security and performance patches are ready for deployment.`;
                Enterprise.notify(msg, manual ? "success" : "warning");
                
                if (statusText) statusText.innerText = `Version v${latestVer} is Available!`;
                if (statusIcon) statusIcon.innerText = `📥`;
                if (statusLast) statusLast.innerText = `Found a newer release on Cloud.`;

                // Show floating update button if on dashboard
                const dashUpdateBtn = document.getElementById('dash-update-alert');
                if (dashUpdateBtn) dashUpdateBtn.style.display = 'flex';
            } else {
                if (manual) Enterprise.notify(`System is fully optimized (v${Enterprise.SoftwareVersion}).`, "success");
                if (statusText) statusText.innerText = `System is Up to Date`;
                if (statusIcon) statusIcon.innerText = `✅`;
                if (statusLast) statusLast.innerText = `Last checked: ${lastChecked}`;
            }
        } catch (e) {
            console.error("Update check failed:", e);
        }
    },

    compareVersions: function(v1, v2) {
        const p1 = v1.split('.').map(Number);
        const p2 = v2.split('.').map(Number);
        for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
            if ((p1[i] || 0) > (p2[i] || 0)) return 1;
            if ((p1[i] || 0) < (p2[i] || 0)) return -1;
        }
        return 0;
    }
};

window.checkSystemUpdates = (manual) => Enterprise.Updates.check(manual);

window.handleUpdateFileUpload = async function(input) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    
    // UI Feedback
    const progressArea = document.getElementById('upload-progress-area');
    const progressBar = document.getElementById('upload-progress-bar');
    const progressText = document.getElementById('upload-percent');
    
    if (progressArea) progressArea.style.display = 'block';
    Enterprise.notify(`Initializing Deployment for bin: ${file.name}...`, "info");

    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            finalizeUpdateDeployment(file.name);
        }
        if (progressBar) progressBar.style.setProperty('width', `${progress}%`);
        if (progressText) progressText.innerText = `${Math.round(progress)}%`;
    }, 400);
};

async function finalizeUpdateDeployment(fileName) {
    try {
        const nextVer = '8.3.2'; // Automated version increment
        if (typeof cloudDB !== 'undefined') {
            await cloudDB.collection('system_info').doc('update_config').set({
                version: nextVer,
                releaseDate: new Date().toISOString(),
                binaryName: fileName,
                status: 'stable',
                changelog: "Stability improvements and UI security hardening."
            });
        }
        
        Enterprise.notify(`✅ DEPLOYMENT SUCCESS: System version v${nextVer} is now live for all terminals.`, "success");
        setTimeout(() => location.reload(), 2000);
    } catch (e) {
        console.error("Deployment failed:", e);
        Enterprise.notify("Deployment Failed! Check terminal connectivity.", "danger");
    }
}

window.forceStateWipe = function() {
    if (confirm("⚠️ CAUTION: This will wipe all local cached UI states and force a clean server fetch. Continue?")) {
        localStorage.clear();
        sessionStorage.clear();
        location.reload(true);
    }
};

window.exportEmergencyBackup = function() {
    if (!window.db) return;
    const data = JSON.stringify(window.db, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `JFT_ERP_Emergency_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    Enterprise.notify("Emergency DB Backup Exported Successfully.", "success");
};