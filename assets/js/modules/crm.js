/* ================================================
   JFT ENTERPRISE — NETWORK DIRECTORY (MINI-CRM)
   Professional Edition | Standardized UI Patterns
   ================================================ */

(function () {

  const state = {
    viewMode: localStorage.getItem('crm_view_mode') || 'grid', // 'grid' or 'table'
    filters: {
      type: 'ALL',
      search: '',
      vipOnly: false
    }
  };

  function getDB() { return typeof db !== 'undefined' ? db : null; }
  function getAll() { const d = getDB(); if (!d) return []; if (!d.crm_contacts) d.crm_contacts = []; return d.crm_contacts; }
  function save(contacts) { const d = getDB(); if (!d) return; d.crm_contacts = contacts; if (typeof saveData === 'function') saveData(true); }
  function esc(str) { return String(str == null ? '' : str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]); }

  window.renderNetworkCRM = function () {
    const all = getAll();
    if (all.length === 0) {
      const seeds = [
        { id: 'c1', name: 'Al Jassmi General Trading', type: 'BUYER', email: 'procurement@aljassmi.ae', phone: '+971 4 332 1100', country: 'UAE', isVip: true },
        { id: 'c2', name: 'Evergreen Marine Lines', type: 'LOGISTICS', email: 'ops@evergreen-marine.com', phone: '+886 2 2505 7766', country: 'Taiwan', isVip: false },
        { id: 'c3', name: 'AgroFarm Co-operative', type: 'SUPPLIER', email: 'sales@agrofarm.in', phone: '+91 22 6655 4433', country: 'India', isVip: false },
        { id: 'c4', name: 'Maersk Line A/S', type: 'LOGISTICS', email: 'bookings@maersk.com', phone: '+45 33 63 33 63', country: 'Denmark', isVip: true }
      ];
      save(seeds);
    }

    const panel = document.getElementById('crm');
    if (!panel) return;

    panel.innerHTML = `
      <div class="main-tab visible" style="animation: staggerFadeIn 0.4s ease-out;">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
          <div>
            <h1 style="margin:0; font-size:1.8rem;">🤝 Buyers &amp; Contacts</h1>
            <p style="color:var(--text-muted); margin:5px 0 0 0; font-size:0.95rem;">Manage and track global business contacts across the supply chain.</p>
          </div>
          <button onclick="window.crmNewContact()" style="padding: 12px 24px;">➕ Add New Contact</button>
        </div>

        <!-- VIEW SWITCHER TABS -->
        <div style="display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid var(--border); padding-bottom: 10px;">
          <button class="sub-tab-btn ${state.viewMode === 'grid' ? 'active' : ''}" onclick="window.crmSwitchMode('grid')">📇 Modern Grid View</button>
          <button class="sub-tab-btn ${state.viewMode === 'table' ? 'active' : ''}" onclick="window.crmSwitchMode('table')">📄 Bulk List Ledger</button>
        </div>

        <!-- STANDARDIZED FILTER BOX -->
        <div class="ledger-filter-box">
          <div class="ledger-filter-item" style="flex: 1.5; min-width: 200px;">
            <span class="ledger-filter-label">SEARCH DIRECTORY</span>
            <input type="text" id="crm-search" class="ledger-filter-input" placeholder="Search by name, email, country..." oninput="window.updateCRMFilters()" style="width: 100%;">
          </div>
          
          <div class="ledger-filter-item">
            <span class="ledger-filter-label">CONTACT TYPE</span>
            <select id="crm-filter-type" class="ledger-filter-input" onchange="window.updateCRMFilters()" style="width: 150px;">
              <option value="ALL">All Sources</option>
              <option value="BUYER">International Buyers</option>
              <option value="SUPPLIER">Local Suppliers</option>
              <option value="LOGISTICS">Logistics Partners</option>
            </select>
          </div>

          <div class="ledger-filter-item">
            <span class="ledger-filter-label">PARTNER LEVEL</span>
            <select id="crm-filter-vip" class="ledger-filter-input" onchange="window.updateCRMFilters()" style="width: 140px;">
              <option value="ALL">All Partners</option>
              <option value="VIP">⭐ VIP Only</option>
            </select>
          </div>

          <div style="display: flex; gap: 8px; flex-shrink: 0;">
            <button type="button" class="ledger-filter-btn" style="color: #ef4444; width: 38px; padding: 0; font-size:1.2rem;" title="Reset Filters" onclick="window.resetCRMFilters()">✖</button>
          </div>
        </div>

        <div id="crm-content"></div>
      </div>
    `;

    applyFilters();
  };

  window.resetCRMFilters = function() {
    state.filters = { type: 'ALL', search: '', vipOnly: false };
    window.renderNetworkCRM();
  };

  window.updateCRMFilters = window.debounce(function() {
    const searchEl = document.getElementById('crm-search');
    const typeEl = document.getElementById('crm-filter-type');
    const vipEl = document.getElementById('crm-filter-vip');
    
    if (searchEl) state.filters.search = searchEl.value.toLowerCase();
    if (typeEl) state.filters.type = typeEl.value;
    if (vipEl) state.filters.vipOnly = vipEl.value === 'VIP';
    
    applyFilters();
  }, 250);

  window.crmSwitchMode = function(mode) {
    state.viewMode = mode;
    localStorage.setItem('crm_view_mode', mode);
    window.renderNetworkCRM();
  };

  function applyFilters() {
    const contacts = getAll();
    const filtered = contacts.filter(c => {
      const matchSearch = !state.filters.search || 
        c.name.toLowerCase().includes(state.filters.search) || 
        c.email.toLowerCase().includes(state.filters.search) || 
        (c.country || '').toLowerCase().includes(state.filters.search);
      
      const matchType = state.filters.type === 'ALL' || c.type === state.filters.type;
      const matchVip = !state.filters.vipOnly || c.isVip;
      
      return matchSearch && matchType && matchVip;
    });

    const container = document.getElementById('crm-content');
    if (!container) return;

    if (state.viewMode === 'grid') {
      renderGrid(filtered, container);
    } else {
      renderTable(filtered, container);
    }
  }

  function renderGrid(contacts, container) {
    if (contacts.length === 0) {
      container.innerHTML = `<div class="card" style="text-align:center; padding:50px; color:var(--text-muted); border:1px dashed var(--border);">No contacts matched your search criteria.</div>`;
      return;
    }
    
    container.innerHTML = `
      <div class="grid-3">
        ${contacts.map(c => `
          <div class="card" style="position:relative; overflow:hidden; border-top: 4px solid var(--primary);">
            ${c.isVip ? '<span style="position:absolute; top:12px; right:12px; color:#f59e0b; font-size:1.2rem;">★</span>' : ''}
            <div style="display:flex; gap:15px; align-items:center;">
              <div style="width:45px; height:45px; background:var(--primary); color:white; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:1.3rem; font-weight:bold; flex-shrink:0;">
                ${esc(c.name.charAt(0))}
              </div>
              <div style="min-width:0;">
                <h3 style="margin:0; font-size:1rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${esc(c.name)}">${esc(c.name)}</h3>
                <span class="status-badge status-${c.type}" style="font-size:0.65rem; padding:2px 6px; margin-top:4px;">${esc(c.type)}</span>
              </div>
            </div>

            <div style="margin-top:15px; display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; align-items:center; gap:8px; font-size:0.85rem; color:var(--text-muted);">
                <span>📧</span> <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(c.email)}</span>
              </div>
              <div style="display:flex; align-items:center; gap:8px; font-size:0.85rem; color:var(--text-muted);">
                <span>📞</span> ${esc(c.phone)}
              </div>
              <div style="display:flex; align-items:center; gap:8px; font-size:0.85rem; color:var(--text-muted);">
                <span>🌍</span> ${esc(c.country || 'International')}
              </div>
            </div>

            <div style="display:flex; gap:8px; margin-top:20px; padding-top:15px; border-top:1px solid var(--border);">
              <button class="secondary" style="flex:1; font-size:0.8rem; padding:8px;" onclick="window.crmChat('${esc(c.name)}')">💬 Chat</button>
              <button class="secondary danger" style="flex:1; font-size:0.8rem; padding:8px;" onclick="window.crmDelete('${esc(c.id)}')">🗑️ Remove</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderTable(contacts, container) {
    if (contacts.length === 0) {
      container.innerHTML = `<div class="card" style="text-align:center; padding:50px; color:var(--text-muted); border:1px dashed var(--border);">No contacts matched your search criteria.</div>`;
      return;
    }

    container.innerHTML = `
      <div class="card" style="padding:0; overflow:hidden;">
        <table style="width:100%; border-collapse:collapse; margin-top:0;">
          <thead style="background:rgba(0,0,0,0.02);">
            <tr>
              <th style="padding:15px;">Contact Name</th>
              <th style="padding:15px;">Type</th>
              <th style="padding:15px;">Email Address</th>
              <th style="padding:15px;">Phone</th>
              <th style="padding:15px;">Country</th>
              <th style="padding:15px;">Status</th>
              <th style="padding:15px; text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${contacts.map(c => `
              <tr style="border-bottom:1px solid var(--border);">
                <td style="padding:12px 15px;"><b>${esc(c.name)}</b></td>
                <td style="padding:12px 15px;"><span class="status-badge status-${c.type}">${esc(c.type)}</span></td>
                <td style="padding:12px 15px;">${esc(c.email)}</td>
                <td style="padding:12px 15px;">${esc(c.phone)}</td>
                <td style="padding:12px 15px;">${esc(c.country)}</td>
                <td style="padding:12px 15px;">${c.isVip ? '⭐ VIP Partner' : 'Standard'}</td>
                <td style="padding:12px 15px; text-align:right;">
                  <button class="secondary" style="padding:6px 10px;" onclick="window.crmChat('${esc(c.name)}')">💬</button>
                  <button class="secondary danger" style="padding:6px 10px; margin-left:5px;" onclick="window.crmDelete('${esc(c.id)}')">🗑️</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  window.crmNewContact = function () {
    const name = prompt('Company / Contact Name:'); if (!name) return;
    const type = (prompt('Type (BUYER / SUPPLIER / LOGISTICS):', 'BUYER') || 'BUYER').toUpperCase();
    const email = prompt('Email Address:') || '';
    const phone = prompt('Phone Number:') || '';
    const country = prompt('Country:') || '';
    const isVip = confirm('Mark as VIP partner?');

    const contact = { id: 'crm_' + Date.now(), name, type, email, phone, country, isVip };
    const all = getAll();
    all.push(contact);
    save(all);
    window.renderNetworkCRM();
    if(typeof Enterprise !== 'undefined') Enterprise.notify('Contact saved to directory.', 'success');
  };

  window.crmDelete = function (id) {
    if (!confirm('Permanently remove this contact from your network?')) return;
    const all = getAll().filter(c => c.id !== id);
    save(all);
    window.renderNetworkCRM();
  };

  window.crmChat = function (name) {
    if (typeof toggleChatPopup === 'function') toggleChatPopup();
    if (typeof Enterprise !== 'undefined') Enterprise.notify(`Initializing secure channel with ${name}...`, 'info');
  };

})();

