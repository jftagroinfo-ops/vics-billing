/* ================================================
   SMA ERP — AI ASSISTANT MODULE
   UI Pro Max Aesthetic | frontend-design skill
   ================================================ */

(function () {

  const AI_STYLE_ID = 'jft-ai-styles';

  function injectStyles() {
    if (document.getElementById(AI_STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = AI_STYLE_ID;
    s.innerHTML = `
      .ai-bg {
        padding: 40px;
        min-height: 100%;
        background: radial-gradient(ellipse at bottom right, rgba(59,130,246,0.07) 0%, transparent 60%);
        font-family: 'Outfit', 'Inter', system-ui, sans-serif;
        display: flex;
        flex-direction: column;
        height: calc(100vh - 80px);
        box-sizing: border-box;
      }
      .ai-hdr {
        margin-bottom: 30px;
        animation: aiFadeUp 0.8s cubic-bezier(0.16,1,0.3,1) backwards;
      }
      @keyframes aiFadeUp {
        from { opacity: 0; transform: translateY(20px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .ai-title {
        font-size: 2.8rem; font-weight: 800; letter-spacing: -1.5px; margin: 0;
        background: linear-gradient(135deg, var(--text, #c9d1d9) 0%, rgba(150,150,150,0.7) 100%);
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      }
      .ai-subtitle { color: var(--text-muted, #8b949e); font-size: 1rem; margin-top: 8px; }
      
      /* Main chat container */
      .ai-chat-wrapper {
        flex: 1; display: flex; gap: 25px; min-height: 0;
      }
      .ai-chat-main {
        flex: 1; display: flex; flex-direction: column; min-height: 0;
        background: rgba(255,255,255,0.02); backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px);
        border: 1px solid rgba(255,255,255,0.07); border-radius: 22px; overflow: hidden;
        box-shadow: 0 20px 50px rgba(0,0,0,0.2);
      }
      .ai-messages {
        flex: 1; overflow-y: auto; padding: 30px; display: flex;
        flex-direction: column; gap: 20px; scroll-behavior: smooth;
      }
      .ai-bubble {
        max-width: 80%; padding: 16px 22px; border-radius: 20px;
        font-size: 0.97rem; line-height: 1.65; position: relative; animation: aiFadeUp 0.4s ease;
      }
      .ai-bubble.user {
        align-self: flex-end;
        background: linear-gradient(135deg, var(--primary,#3b82f6), #6366f1);
        color: white; border-bottom-right-radius: 5px;
        box-shadow: 0 8px 20px rgba(59,130,246,0.3);
      }
      .ai-bubble.assistant {
        align-self: flex-start;
        background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
        color: var(--text, #c9d1d9); border-bottom-left-radius: 5px;
      }
      .ai-bubble.assistant .ai-label {
        font-size: 0.7rem; font-weight: 700; letter-spacing: 1px;
        text-transform: uppercase; color: var(--primary,#3b82f6); margin-bottom: 8px;
        display: flex; align-items: center; gap: 6px;
      }
      .ai-typing-dot {
        width: 8px; height: 8px; border-radius: 50%; background: var(--text-muted, #8b949e);
        animation: aiTypeBounce 1.2s infinite ease-in-out;
      }
      .ai-typing-dot:nth-child(2) { animation-delay: 0.2s; }
      .ai-typing-dot:nth-child(3) { animation-delay: 0.4s; }
      @keyframes aiTypeBounce {
        0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
        40% { transform: scale(1.2); opacity: 1; }
      }
      .ai-input-area {
        padding: 20px 25px; border-top: 1px solid rgba(255,255,255,0.06);
        background: rgba(0,0,0,0.15); display: flex; gap: 15px; align-items: center;
      }
      .ai-input {
        flex: 1; padding: 15px 22px; border-radius: 30px;
        background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);
        color: var(--text, #c9d1d9); font-size: 1rem; outline: none;
        font-family: inherit; transition: all 0.3s ease;
      }
      .ai-input:focus { border-color: var(--primary,#3b82f6); box-shadow: 0 0 0 4px rgba(59,130,246,0.15); background: rgba(0,0,0,0.4); }
      .ai-send-btn {
        width: 52px; height: 52px; border-radius: 50%; flex-shrink: 0;
        background: linear-gradient(135deg, var(--primary,#3b82f6), #6366f1);
        border: none; color: white; cursor: pointer; display: flex;
        align-items: center; justify-content: center;
        box-shadow: 0 8px 20px rgba(59,130,246,0.4);
        transition: all 0.3s ease;
      }
      .ai-send-btn:hover { transform: scale(1.1); box-shadow: 0 12px 28px rgba(59,130,246,0.55); }
      .ai-send-btn:disabled { opacity: 0.5; transform: none; }

      /* Side panel with quick prompts */
      .ai-sidebar {
        width: 270px; flex-shrink: 0; display: flex; flex-direction: column; gap: 20px;
        animation: aiFadeUp 1s cubic-bezier(0.16,1,0.3,1) 0.1s backwards;
      }
      .ai-panel {
        background: rgba(255,255,255,0.02); backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px);
        border: 1px solid rgba(255,255,255,0.07); border-radius: 18px; padding: 22px;
        box-shadow: 0 15px 35px rgba(0,0,0,0.15);
      }
      .ai-panel-title {
        font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;
        color: var(--text-muted,#8b949e); margin-bottom: 15px; display: flex; align-items: center; gap: 8px;
      }
      .ai-prompt-chip {
        display: block; width: 100%; text-align: left; padding: 11px 14px; margin-bottom: 8px;
        background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px;
        color: var(--text,#c9d1d9); cursor: pointer; font-size: 0.85rem; font-family: inherit;
        transition: all 0.25s ease; line-height: 1.35;
      }
      .ai-prompt-chip:hover { background: rgba(59,130,246,0.1); border-color: rgba(59,130,246,0.3); color: #93c5fd; }
      .ai-stat-row { display: flex; justify-content: space-between; align-items: center; padding: 9px 0; border-bottom: 1px dashed rgba(255,255,255,0.06); }
      .ai-stat-row:last-child { border-bottom: none; }
      .ai-stat-label { font-size: 0.82rem; color: var(--text-muted,#8b949e); }
      .ai-stat-val { font-size: 0.92rem; font-weight: 700; color: var(--text,#c9d1d9); }

      .ai-badge-live {
        display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px;
        border-radius: 20px; background: rgba(16,185,129,0.1);
        border: 1px solid rgba(16,185,129,0.25); color: #34d399; font-size: 0.72rem; font-weight: 700;
      }
      .ai-pulse { width: 7px; height: 7px; border-radius: 50%; background: #10b981; animation: pulse 2s infinite; }
    `;
    document.head.appendChild(s);
  }

  /* Enterprise Business Knowledge Base — Offline Intelligence */
  const KB = {
    "invoice":    "📄 To create a new invoice, navigate to the **Documents & Invoices** tab in the sidebar. Click '+ New Document', select 'Commercial Invoice', fill in buyer details, products, and quantities, then click 'Save & Preview'. You can also print or export it to PDF.",
    "lc":         "🏦 A **Letter of Credit (LC)** is managed under the **LC Manager** tab. You can log new LCs, track their status (Issued → Amended → Utilized → Expired), and set expiry alerts. The system will notify you 30 days before expiry.",
    "costing":    "🧮 The **Costing Calculator** helps you compute export margins. Navigate to 'Costing Calc', enter FOB price, freight, insurance, documentation charges, and bank charges to get your net realization. The Reverse Margin Simulator works backwards from your target profit.",
    "vessel":     "🚢 To track a vessel, go to **Logistics Tracker** → 'Ping Fleet'. The marine simulator will interpolate vessel positions based on your departure and destination ports and show ETAs.",
    "inventory":  "📦 The **Inventory** module tracks stock in real-time. You can add goods with HSN codes, available quantity, and purchase price. It automatically calculates stock value and alerts you when levels are low.",
    "finance":    "💰 The **Finance & PnL** module handles expense logging, forex realization, export incentives, and profit/loss analysis. Use the PnL tab to see your net position across all shipments.",
    "incentives": "💸 Government export incentives like RODTEP, MEIS, and duty drawback are tracked under **Govt Incentives**. Enter your export value and the system will estimate your entitlement based on current rates.",
    "attendance": "📅 Employee **Attendance** is tracked under the HR module. You can mark daily presence, apply leaves, and generate monthly salary summaries with deduction logic.",
    "settings":   "⚙️ The **Settings** module lets you configure company identity, manage user roles (Admin / Buyer), and sync data with Firebase cloud or Google Drive backup.",
    "crm":        "🤝 The **Network Directory** stores all your business contacts — buyers, suppliers, and logistics partners. You can tag contacts as VIP, store emails and phone numbers, and link them to deals.",
    "chat":       "💬 The **Secure Messaging** feature (bottom-right bubble) lets team members communicate in real-time through Firebase. Click the chat icon and select a user to send encrypted messages.",
    "export":     "📤 SMA ERP supports exporting data to PDF (via jsPDF), ZIP archives, Excel (via SheetJS), and Google Drive. Use the **Print & Export** options available in the Documents module footer.",
    "backup":     "☁️ Data is automatically synced to your Firebase Realtime Database in the cloud. You can also force a manual Google Drive backup from the **Settings → Core Vault** panel.",
    "tasks":      "✅ The **Workflow Pipeline (Task Board)** is a Kanban-style board. Drag tasks between Pending → Processing → Blocked → Completed columns. Use '+ New Task' to create export compliance workflows.",
    "theme":      "🎨 You can change the app theme from **Settings → Interface Aesthetics**. Toggle between Midnight (dark), Daylight (light), and Glass (immersive blur) modes.",
    
    "draft email": `✉️ Here is a professional **payment reminder email draft** you can use:\n\n---\nSubject: Payment Reminder — Invoice [INV NO] Due\n\nDear [Buyer Name],\n\nThis is a gentle reminder that Invoice No. [INV NO] amounting to USD [AMOUNT] issued on [DATE] is now due for payment.\n\nKindly arrange the payment at your earliest convenience and share the bank transfer confirmation with us.\n\nFor any queries, please feel free to contact us.\n\nWarm regards,\n[Your Name]\n[Company Name]\n---`,
    
    "draft letter": `📝 Here is a **professional business letter template**:\n\n---\n[Date]\n\nTo,\n[Recipient Name & Company]\n[Address]\n\nSub: [Subject]\n\nDear Sir/Madam,\n\nWith reference to the above subject, we hereby write to inform you that [state your message clearly].\n\nKindly acknowledge receipt of this letter and revert at your earliest convenience.\n\nYours faithfully,\n[Authorized Signatory]\nFor [Company Name]\n---`,
    
    "payment reminder": `💰 **Payment Reminder Best Practices:**\n\n1. **First Reminder (Day 7 after due date):** Friendly reminder via email/WhatsApp.\n2. **Second Reminder (Day 15):** Follow-up call with written confirmation.\n3. **Third Notice (Day 30):** Formal demand letter citing LC/contract terms.\n4. **Escalation (Day 45+):** Involve your bank or trade finance partner. Consider LC discounting if applicable.\n\nIn SMA ERP, use **Finance → Aging Report** to track all outstanding receivables with days-past-due calculations.`,
    
    "rodtep":     "💸 **RODTEP (Remission of Duties and Taxes on Exported Products)** is an Indian government scheme that refunds embedded central, state and local duties/taxes paid during export production. Current rates vary by HS Code (typically 0.5%–4.3%). Track your entitlement under **Govt Incentives** in SMA ERP.",
    
    "compliance": "🛡️ Export **Compliance Documents** include: IEC (Import Export Code), RCMC (Registration-cum-Membership Certificate), AD Code Registration, FSSAI/Phytosanitary Certificate, GST Registration, and Bank AD Code. Track their renewal dates in **Document Vault** to avoid shipment delays.",
    
    "payroll":    "👥 **Payroll Calculation Formula:** Basic + HRA + DA + Transport + Medical - PF (12%) - ESI (0.75% if applicable) - TDS = Net Salary. In JFT Enterprise Attendance module, generate monthly salary reports per employee with deduction summaries automatically.",
    
    "default":    "I'm your **SMA ERP AI Assistant** — powered by hybrid local + Gemini AI intelligence.\n\n🚀 I can help you with:\n• Invoice creation & document queries\n• LC management & tracking\n• Export costing & margins\n• Drafting professional business emails\n• Logistics & vessel tracking\n• Finance, PnL & expense queries\n• HR, attendance & payroll\n• Govt incentives (RODTEP, MEIS)\n\n*Connect your Gemini API key in Settings → Cloud for unlimited advanced AI.*"
  };

  function fetchDataInsights(q) {
    q = q.toLowerCase();
    try {
      // 1. Unpaid / Dues
      if (q.includes('unpaid') || q.includes('owe') || q.includes('pending payment') || q.includes('money')) {
        const unpaid = (db.docs || []).filter(d => d.type === 'Commercial Invoice' && d.status !== 'Paid' && d.status !== 'Cancelled');
        if (unpaid.length === 0) return "✅ ⚖️ Your ledger is clean! No unpaid commercial invoices found.";
        const total = unpaid.reduce((sum, d) => sum + (parseFloat(d.total || d.fobTotal || d.cifTotal) || 0), 0);
        return `📊 Found **${unpaid.length} unpaid invoices** totaling **$${total.toLocaleString()}**. Your largest outstanding is with **${unpaid[0].buyer.split('\n')[0]}**. Suggest checking the Aging Report for details.`;
      }
      // 2. Logistics / Ships
      if (q.includes('vessel') || q.includes('ship') || q.includes('eta') || q.includes('where')) {
        const active = (db.log_vessels || []).filter(v => v.pod && !v.arrived);
        if (active.length === 0) return "🚢 No vessels currently in deep-sea transit. Your latest shipments may still be at the port or in local transit.";
        return `🚢 You have **${active.length} active vessels** at sea. The next arrival is **${active[0].no}** reaching **${active[0].pod}** around **${active[0].eta}**.`;
      }
      // 3. Stock / Inventory
      if (q.includes('stock') || q.includes('inventory') || q.includes('how much') || q.includes('shortage')) {
        const inv = (db.inventory || []);
        const low = inv.filter(i => (parseFloat(i.qty) || 0) < 5);
        if (q.includes('short') || q.includes('low')) {
           return low.length > 0 ? `📦 **Stock Alert:** ${low.length} items are below safety levels: **${low.map(x=>x.name).join(', ')}**.` : "✅ All stock levels are currently within safe limits.";
        }
        const total = inv.reduce((sum, i) => sum + (parseFloat(i.qty) * (parseFloat(i.price) || 0)), 0);
        return `📦 Inventory Status: **${inv.length} items** tracked. Total warehouse book value: **₹${total.toLocaleString('en-IN')}**.`;
      }
      // 4. Compliance
      if (q.includes('expiry') || q.includes('compliance') || q.includes('license')) {
        const docs = (db.exporter_data || []);
        const nearing = docs.filter(d => d.expiry && Math.ceil((new Date(d.expiry) - new Date()) / 86400000) < 30);
        return nearing.length > 0 ? `🛡️ **Compliance Watch:** ${nearing.length} documents expire within 30 days: **${nearing.map(x=>x.name).join(', ')}**.` : "✅ Your compliance vault is up to date.";
      }
    } catch(e) { console.warn("AI Data Query Error", e); }
    return null;
  }

  function smartAnswer(q) {
    // Check for Data Insights first
    const insight = fetchDataInsights(q);
    if (insight) return insight;

    q = q.toLowerCase();
    for (const key of Object.keys(KB)) {
      if (key !== 'default' && q.includes(key)) return KB[key];
    }
    // Fuzzy match keywords
    const pairs = [
      ['invoice','commercial','proforma','document','bl','bill of lading'], 
      ['lc','letter of credit','bank','payment'],
      ['costing','margin','profit','fob','reverse'],
      ['vessel','ship','marine','tracking','ais'],
      ['inventory','stock','warehouse','goods'],
      ['finance','pnl','expense','forex','realization'],
      ['incentive','rodtep','meis','drawback','government'],
      ['attendance','hr','salary','leave','employee'],
      ['setting','configure','role','admin'],
      ['crm','contact','buyer','supplier','logistics'],
      ['chat','message','communication'],
      ['export','pdf','zip','download'],
      ['backup','sync','cloud','firebase','drive'],
      ['task','kanban','workflow','board'],
      ['theme','dark','light','glass','aesthetic'],
    ];
    for (let i = 0; i < pairs.length; i++) {
      if (pairs[i].some(w => q.includes(w))) {
        return KB[Object.keys(KB)[i]] || KB.default;
      }
    }
    return KB.default;
  }

  function appendBubble(role, html) {
    const msgs = document.getElementById('ai-messages');
    if (!msgs) return;
    const div = document.createElement('div');
    div.className = `ai-bubble ${role}`;
    if (role === 'assistant') {
      div.innerHTML = `<div class="ai-label"><div class="ai-pulse"></div>SMA AI</div>${html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>')}`;
    } else {
      div.textContent = html;
    }
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function showTyping() {
    const msgs = document.getElementById('ai-messages');
    if (!msgs) return;
    const div = document.createElement('div');
    div.className = 'ai-bubble assistant'; div.id = 'ai-typing-indicator';
    div.innerHTML = `<div class="ai-label"><div class="ai-pulse"></div>SMA AI</div><div style="display:flex;gap:6px;padding:5px 0;"><div class="ai-typing-dot"></div><div class="ai-typing-dot"></div><div class="ai-typing-dot"></div></div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function removeTyping() {
    document.getElementById('ai-typing-indicator')?.remove();
  }

  async function handleSend() {
    const input = document.getElementById('ai-user-input');
    const sendBtn = document.getElementById('ai-send-btn');
    if (!input) return;
    const q = input.value.trim();
    if (!q) return;
    input.value = '';

    appendBubble('user', q);
    sendBtn.disabled = true;
    showTyping();

    // 1. DISPATCH TO CENTRAL AI ENGINE
    const docSummary = (db.docs || []).length;
    const unpaidCount = (db.docs || []).filter(d => d.type === 'Commercial Invoice' && d.status !== 'Paid').length;
    const invCount = (db.inventory || []).length;
    const company = typeof getActiveCompany === 'function' ? getActiveCompany().name : 'SMA ERP';
    
    const sysContext = `[REAL_TIME_CONTEXT] Company: ${company}, Docs: ${docSummary}, Unpaid: ${unpaidCount}, Inventory: ${invCount}. Role: Admin/Strategic.`;
    const sysPrompt = `You are the SMA ERP AI Assistant. Context: ${sysContext}. Task: Answer business queries, draft trade emails, and explain international trade logistics. Guidelines: Concise, professional, use emojis, use HTML <br> for newlines.`;

    const aiResponse = await Enterprise.AI.ask(q, sysPrompt);

    removeTyping();

    if (aiResponse.text) {
        let text = aiResponse.text;
        // Basic formatting conversion
        text = text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
        appendBubble('assistant', `<strong>[${aiResponse.source}]</strong> ${text}`);
    } else {
        // LOCAL FALLBACK
        const answer = smartAnswer(q);
        appendBubble('assistant', `<strong>[LOCAL]</strong> ${answer}`);
        if (!localStorage.getItem('jft_ai_api_key') && !localStorage.getItem('jft_openai_api_key')) {
            appendBubble('assistant', "💡 *Tip: Link your API keys in **Settings → Advanced AI Engine** to unlock GPT-4 & Gemini Pro power.*");
        }
    }

    sendBtn.disabled = false;
    input.focus();
  }

  const QUICK_PROMPTS = [
    '📄 How to create an invoice?',
    '🚢 How to track a vessel?',
    '🧮 How does costing calc work?',
    '💸 What is RODTEP incentive?',
    '✉️ Draft a payment reminder email',
    '📝 Draft a formal business letter',
    '🏦 How to manage Letter of Credits?',
    '🛡️ What compliance documents do I need?',
    '👥 How is payroll calculated?',
    '☁️ How to backup my data?',
  ];

  /* ————— PUBLIC ————— */
  window.renderAIAssistant = function () {
    injectStyles();
    const panel = document.getElementById('ai-assistant');
    if (!panel) return;

    panel.innerHTML = `
      <div class="ai-bg">
        <div class="ai-hdr">
          <h2 class="ai-title">AI Assistant</h2>
          <div style="display:flex;gap:12px;align-items:center;margin-top:8px;">
            <span class="ai-badge-live"><div class="ai-pulse"></div>ONLINE</span>
            <p class="ai-subtitle" style="margin:0;">Business Intelligence for SMA ERP Platform.</p>
          </div>
        </div>

        <div class="ai-chat-wrapper">
          <!-- Main Chat -->
          <div class="ai-chat-main">
            <div class="ai-messages" id="ai-messages">
              <!-- Welcome bubble -->
              <div class="ai-bubble assistant">
                <div class="ai-label"><div class="ai-pulse"></div>SMA AI</div>
                👋 Hello! I'm your <strong>SMA ERP AI Assistant</strong>.<br>
                I know everything about this platform — invoices, logistics, costing, finance, compliance and more.<br><br>
                <em>Ask me anything to get started.</em>
              </div>
            </div>
            <div class="ai-input-area">
              <input type="text" id="ai-user-input" class="ai-input" placeholder="Ask a business logic question or draft an email..."
                     autocomplete="off" onkeydown="if(event.key==='Enter') window.aiSend()">
              <button id="ai-send-btn" class="ai-send-btn" onclick="window.aiSend()">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
              </button>
            </div>
          </div>

          <!-- Side Panel -->
          <div class="ai-sidebar">
            <div class="ai-panel">
              <div class="ai-panel-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
                Quick Prompts
              </div>
              ${QUICK_PROMPTS.map(p => `<button class="ai-prompt-chip" onclick="window.aiQuickPrompt(this.innerText)">${p}</button>`).join('')}
            </div>

            <div class="ai-panel">
              <div class="ai-panel-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V10"/><path d="m18 20V4"/><path d="m6 20v-4"/></svg>
                System Status
              </div>
              <div class="ai-stat-row">
                <span class="ai-stat-label">AI Engine</span>
                <span class="ai-stat-val" style="color:#34d399;">● Online</span>
              </div>
              <div class="ai-stat-row">
                <span class="ai-stat-label">Knowledge Base</span>
                <span class="ai-stat-val">v8.2 Enterprise</span>
              </div>
              <div class="ai-stat-row">
                <span class="ai-stat-label">Response Mode</span>
                <span class="ai-stat-val" id="ai-response-mode">Hybrid AI</span>
              </div>
              <div class="ai-stat-row">
                <span class="ai-stat-label">Advanced Key</span>
                <span class="ai-stat-val" id="ai-key-status" style="color:#a78bfa;">Unlinked</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  window.aiSend = handleSend;
  window.aiQuickPrompt = function (text) {
    const clean = text.replace(/^[\p{Emoji}]+\s*/u, '').trim();
    const input = document.getElementById('ai-user-input');
    if (input) { input.value = clean; handleSend(); }
  };

  // Run on logic init to display correct status
  setTimeout(() => {
    const key = localStorage.getItem('jft_ai_api_key') || (typeof db !== 'undefined' && db.meta?.apiKeys?.geminiApiKey);
    const el = document.getElementById('ai-key-status');
    const req = document.getElementById('ai-response-mode');
    if (key && el) {
        el.innerText = 'Connected ✅'; el.style.color = '#34d399';
        if (req) { req.innerText = 'Deep Logic / GPT'; }
    }
  }, 1000);

})();

