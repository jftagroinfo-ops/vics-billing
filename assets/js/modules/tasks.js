/* --- SMART TASK AUTOMATION, KANBAN & BULK PIPELINE MODULE --- */

// 1. SAFE NATIVE BOOTLOADER
function initTasksSystem() {
    if (typeof db === 'undefined') {
        setTimeout(initTasksSystem, 50);
        return;
    }
    if (!db.tasks) db.tasks = [];
    if (!db.docs) db.docs = [];
    startTasksWatchdog();
    initTaskFilters();
}
initTasksSystem();

// escapeHTML is defined globally in ui.js — no local copy needed.

// UI State
let activeTaskDocId = null;
let currentTaskFilter = 'All'; 
let currentTaskView = 'kanban'; 
let bulkSelectedTasks = new Set();
let _lastTasksCount = -1;

function setVisibility(elId, show, displayType = 'block') {
    const el = document.getElementById(elId);
    if (!el) return;
    if (show) {
        el.classList.remove('hidden');
        el.style.display = displayType;
    } else {
        el.classList.add('hidden');
        el.style.display = 'none';
    }
}

// Watchdog Engine for Cloud updates
function startTasksWatchdog() {
    setInterval(() => {
        if (typeof db === 'undefined') return;
        // PERF: Skip re-render when Task Board tab is not visible
        if (document.getElementById('tasks')?.style.display === 'none') return;
        if (!db.tasks) db.tasks = [];
        if (!db.docs) db.docs = [];
        
        if (db.tasks.length !== _lastTasksCount) {
            _lastTasksCount = db.tasks.length;
            renderTasksWorkspace();
        }
    }, 5000); // Slowed from 1500ms → 5000ms
}

function initTaskFilters() {
    Enterprise.initFYSelector('task-fy-filter');
}

function checkTaskDateFilter(dDateStr, filterFy) {
    return Enterprise.checkFY(dDateStr, filterFy);
}

// Global Re-render
window.renderTasksWorkspace = function() {
    renderGlobalAlerts();
    renderTaskSidebar();
    
    if (!activeTaskDocId) {
        setVisibility('workspace-empty-state', true, 'flex');
        setVisibility('workspace-active-state', false);
        
        const sidebar = document.getElementById('task-sidebar');
        if (sidebar) sidebar.classList.remove('sidebar-hidden');
    } else {
        setVisibility('workspace-empty-state', false);
        setVisibility('workspace-active-state', true, 'flex');
        updateWorkspaceHeader();
        
        if (currentTaskView === 'kanban') {
            renderKanbanBoard();
        } else {
            renderBulkList();
        }
    }
};

window.setTaskFilter = function(filter) {
    currentTaskFilter = filter;
    
    // ENSURE VISIBILITY: If searching for Stuck/Critical tasks, reset FY filters 
    // to ensure they aren't hidden by a date filter.
    if (filter === 'Stuck') {
        const fySelect = document.getElementById('task-fy-filter');
        if(fySelect) fySelect.value = '';
    }
    
    document.querySelectorAll('.sidebar-filter-btn').forEach(btn => {
        btn.style.background = 'var(--surface)';
        btn.style.color = 'var(--text)';
        btn.style.borderColor = 'var(--border)';
    });

    const activeBtn = Array.from(document.querySelectorAll('.sidebar-filter-btn')).find(b => b.innerText.includes(filter) || b.innerText.includes(filter.split(' ')[0]));
    if (activeBtn) {
        if (filter === 'All') { activeBtn.style.background = 'var(--primary)'; activeBtn.style.color = 'white'; activeBtn.style.borderColor = 'var(--primary)'; }
        if (filter === 'Active') { activeBtn.style.background = 'var(--info)'; activeBtn.style.color = 'white'; activeBtn.style.borderColor = 'var(--info)';}
        if (filter === 'Stuck') { activeBtn.style.background = 'var(--danger)'; activeBtn.style.color = 'white'; activeBtn.style.borderColor = 'var(--danger)';}
        if (filter === 'Done') { activeBtn.style.background = 'var(--success)'; activeBtn.style.color = 'white'; activeBtn.style.borderColor = 'var(--success)';}
    }
    
    renderTaskSidebar();
};

window.toggleTaskView = function(viewType) {
    currentTaskView = viewType;
    document.querySelectorAll('.view-toggle-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-view-${viewType}`).classList.add('active');

    if (viewType === 'kanban') {
        setVisibility('view-kanban', true, 'flex');
        setVisibility('view-list', false);
        renderKanbanBoard();
    } else {
        setVisibility('view-kanban', false);
        setVisibility('view-list', true, 'flex');
        renderBulkList();
    }
};

window.toggleTaskSidebar = function() {
    const sidebar = document.getElementById('task-sidebar');
    if (sidebar) {
        sidebar.classList.toggle('sidebar-hidden');
    }
};

// ==========================================
// ALERT ENGINE (Fixed for Orphaned Tasks)
// ==========================================
function renderGlobalAlerts() {
    const dashboard = document.getElementById('global-alert-dashboard');
    if (!dashboard || !db.tasks || !db.docs) return;

    const todayStr = new Date().toISOString().split('T')[0];
    
    // STRICT SYNC: Only check tasks that belong to active Commercial Invoices
    const validDocIds = new Set(
        db.docs.filter(d => d.type === 'Commercial Invoice' && d.status !== 'Cancelled').map(d => d.id)
    );
    
    const activeTasks = db.tasks.filter(t => validDocIds.has(t.docId));
    
    const stuckTasks = activeTasks.filter(t => t.status === 'Stuck');
    const overdueTasks = activeTasks.filter(t => t.status !== 'Completed' && t.dueDate && t.dueDate < todayStr);
    
    const totalIssues = stuckTasks.length + overdueTasks.length;

    if (totalIssues === 0) {
        dashboard.innerHTML = `
            <div class="task-alert-banner all-clear">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:1.5rem;">✨</span>
                    <div>
                        <strong style="font-size:1.1rem; display:block;">All Clear!</strong>
                        <span style="font-size:0.85rem;">Zero stuck queries and zero overdue tasks across your active Commercial Invoices.</span>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    dashboard.innerHTML = `
        <div class="task-alert-banner">
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:1.5rem;">🚨</span>
                <div>
                    <strong style="font-size:1.1rem; display:block;">Action Required: Pipeline Bottlenecks Detected</strong>
                    <span style="font-size:0.85rem;">You have <b>${stuckTasks.length} Stuck Queries</b> and <b>${overdueTasks.length} Overdue Tasks</b> requiring your attention.</span>
                </div>
            </div>
            <button onclick="setTaskFilter('Stuck')" style="background: var(--surface); color:var(--danger); border:none; padding:8px 15px; font-weight:bold; border-radius:6px; cursor:pointer;">View Issues</button>
        </div>
    `;
}

// ==========================================
// SIDEBAR: SHIPMENT PORTFOLIOS
// ==========================================
window.renderTaskSidebar = function() {
    const list = document.getElementById('task-shipment-list');
    const badge = document.getElementById('sidebar-count-badge');
    if (!list || !db.docs) return;

    const searchInput = document.getElementById('task-shipment-search');
    const query = searchInput ? searchInput.value.toLowerCase() : '';
    
    const filterFy = document.getElementById('task-fy-filter')?.value;

    let shipments = db.docs.filter(d => d.type === 'Commercial Invoice' && d.status !== 'Cancelled');
    
    shipments = shipments.filter(d => {
        if (!checkTaskDateFilter(d.date, filterFy)) return false;
        return true;
    });

    shipments.sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0));

    let html = '';
    let renderedCount = 0;

    shipments.forEach(d => {
        const myTasks = db.tasks.filter(t => t.docId === d.id);
        const total = myTasks.length;
        const completed = myTasks.filter(t => t.status === 'Completed').length;
        const stuck = myTasks.filter(t => t.status === 'Stuck').length;
        
        let progressPct = total === 0 ? 0 : Math.round((completed / total) * 100);

        const docNo = String(d.no || 'Draft Invoice');
        const docBuyer = String(d.buyer || 'Unknown Buyer');
        const buyerLine = docBuyer.includes('\n') ? docBuyer.split('\n')[0] : docBuyer;

        if (currentTaskFilter === 'Stuck' && stuck === 0) return;
        if (currentTaskFilter === 'Active' && (total === 0 || completed === total) && stuck === 0) return;
        if (currentTaskFilter === 'Done' && (total === 0 || completed !== total)) return;
        
        if (query && !docNo.toLowerCase().includes(query) && !buyerLine.toLowerCase().includes(query)) return;

        renderedCount++;

        const isActive = activeTaskDocId === d.id;
        let bgStyle = 'background: transparent; border-left: 4px solid transparent; border-bottom: 1px solid var(--border);';
        let cardClass = 'shipment-card';
        if (isActive) cardClass += ' active';
        if (stuck > 0) cardClass += ' has-stuck';

        let statusPill = '';
        if (total === 0) statusPill = '<span style="font-size:0.6rem; color:var(--text-muted); background: var(--bg); padding: 2px 6px; border-radius: 4px;">Empty</span>';
        else if (stuck > 0) statusPill = '<span style="font-size:0.6rem; color:var(--danger); background: #fee2e2; padding: 2px 6px; border-radius: 4px; font-weight: bold;">⚠️ Stuck</span>';
        else if (completed === total) statusPill = '<span style="font-size:0.6rem; color:var(--success); background: rgba(34, 197, 94, 0.1); padding: 2px 6px; border-radius: 4px; font-weight: bold;">✅ Done</span>';
        else statusPill = '<span style="font-size:0.6rem; color:var(--info); background: #e0f2fe; padding: 2px 6px; border-radius: 4px; font-weight: bold;">🔄 Active</span>';

        html += `
        <div class="${cardClass}" onclick="selectTaskShipment('${escapeHTML(d.id)}')" style="${isActive ? '' : bgStyle}">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="font-weight: bold; color: var(--text); font-size: 0.9rem;">${escapeHTML(docNo)}</div>
                ${statusPill}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 4px 0 8px 0;">${escapeHTML(buyerLine)}</div>
            
            <div style="display: flex; align-items: center; gap: 8px;">
                <div style="flex-grow: 1; height: 4px; background: var(--border); border-radius: 2px; overflow: hidden;">
                    <div style="height: 100%; width: ${progressPct}%; background: ${stuck > 0 ? 'var(--danger)' : (progressPct === 100 ? 'var(--success)' : 'var(--primary)')};"></div>
                </div>
                <span style="font-size: 0.65rem; color: var(--text-muted); font-weight: bold;">${completed}/${total}</span>
            </div>
        </div>`;
    });

    if (renderedCount === 0) {
        html = `<div style="padding: 30px 20px; text-align: center; color: var(--text-muted);">
            <div style="font-size: 2rem; margin-bottom: 10px;">📭</div>
            <div style="font-size: 0.85rem;">No portfolios match this filter.</div>
        </div>`;
    }

    if (badge) badge.innerText = renderedCount;
    list.innerHTML = html;
};

window.selectTaskShipment = function(docId) {
    activeTaskDocId = docId;
    bulkSelectedTasks.clear(); 
    
    const sidebar = document.getElementById('task-sidebar');
    if (sidebar) {
        sidebar.classList.add('sidebar-hidden');
    }
    
    renderTasksWorkspace();
};

function updateWorkspaceHeader() {
    const doc = db.docs.find(d => d.id === activeTaskDocId);
    if (!doc) return;

    const docNo = String(doc.no || 'Draft Invoice');
    const docBuyer = String(doc.buyer || 'Unknown Buyer');
    const buyerLine = docBuyer.includes('\n') ? docBuyer.split('\n')[0] : docBuyer;

    document.getElementById('board-invoice-title').innerText = escapeHTML(docNo);
    document.getElementById('board-invoice-buyer').innerText = escapeHTML(buyerLine);

    const tasks = db.tasks.filter(t => t.docId === activeTaskDocId);
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'Completed').length;
    const stuck = tasks.filter(t => t.status === 'Stuck').length;
    let progressPct = total === 0 ? 0 : Math.round((completed / total) * 100);
    
    const kpiBadge = document.getElementById('board-kpi-badge');
    const progFill = document.getElementById('board-progress-fill');

    if (total === 0) {
        if(kpiBadge) { kpiBadge.innerText = 'Empty Pipeline'; kpiBadge.style.background = 'var(--bg)'; kpiBadge.style.color = '#64748b'; }
        if(progFill) progFill.style.background = 'transparent';
    } else if (stuck > 0) {
        if(kpiBadge) { kpiBadge.innerText = `${stuck} Queries Pending`; kpiBadge.style.background = '#fee2e2'; kpiBadge.style.color = '#991b1b'; }
        if(progFill) progFill.style.background = 'var(--danger)';
    } else if (progressPct === 100) {
        if(kpiBadge) { kpiBadge.innerText = 'All Clear & Shipped'; kpiBadge.style.background = 'rgba(34, 197, 94, 0.1)'; kpiBadge.style.color = '#166534'; }
        if(progFill) progFill.style.background = 'var(--success)';
    } else {
        if(kpiBadge) { kpiBadge.innerText = `${progressPct}% Complete`; kpiBadge.style.background = '#e0f2fe'; kpiBadge.style.color = '#0369a1'; }
        if(progFill) progFill.style.background = 'var(--primary)';
    }
    if(progFill) progFill.style.width = `${progressPct}%`;
}

// ==========================================
// VIEW 1: KANBAN BOARD
// ==========================================
function renderKanbanBoard() {
    const tasks = db.tasks.filter(t => t.docId === activeTaskDocId);
    const todayStr = new Date().toISOString().split('T')[0];

    const cols = ['Pending', 'Processing', 'Stuck', 'Completed'];
    cols.forEach(col => {
        const colTasks = tasks.filter(t => t.status === col).sort((a,b) => {
            const pMap = { 'High': 3, 'Medium': 2, 'Low': 1 };
            if (pMap[a.priority] !== pMap[b.priority]) return pMap[b.priority] - pMap[a.priority];
            return new Date(a.dueDate || '2099-12-31') - new Date(b.dueDate || '2099-12-31');
        });
        
        const countEl = document.getElementById(`kb-count-${col}`);
        if(countEl) countEl.innerText = colTasks.length;
        
        const colDiv = document.getElementById(`kb-col-${col}`);
        if(colDiv) {
            colDiv.innerHTML = colTasks.map(t => generateTaskCardHTML(t, todayStr)).join('');
        }
    });
}

function generateTaskCardHTML(task, todayStr) {
    let icon = '📄';
    const tl = (task.title || '').toLowerCase();
    if(tl.includes('invoice')) icon = '💰';
    if(tl.includes('packing')) icon = '📦';
    if(tl.includes('bl') || tl.includes('bill of') || tl.includes('shipping')) icon = '🚢';
    if(tl.includes('phyto') || tl.includes('health') || tl.includes('sgs')) icon = '🌿';
    if(tl.includes('coo') || tl.includes('origin')) icon = '🌍';
    if(tl.includes('bank') || tl.includes('brc') || tl.includes('payment')) icon = '🏦';

    const isOverdue = task.dueDate && task.dueDate < todayStr && task.status !== 'Completed';
    const dateHtml = task.dueDate 
        ? `<div class="${isOverdue ? 'status-overdue' : ''}" style="font-size:0.65rem; color: ${isOverdue ? 'inherit' : 'var(--text-muted)'}; margin-top:5px;">
            📅 Due: ${typeof formatDateIN === 'function' ? formatDateIN(task.dueDate) : task.dueDate} ${isOverdue ? ' (OVERDUE)' : ''}
           </div>` 
        : '';

    let notesHtml = '';
    if (task.notes && task.notes.length > 0) {
        notesHtml = `<div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--bg); display: flex; flex-direction: column; gap: 6px;">`;
        task.notes.forEach(note => {
            const timeStr = note.timestamp ? (typeof formatDateIN === 'function' ? formatDateIN(note.timestamp) : String(note.timestamp).split('T')[0]) : '';
            if (note.resolved) {
                notesHtml += `
                <div style="background: var(--surface); padding: 6px 8px; border-radius: 4px; border: 1px solid var(--border); border-left: 3px solid var(--success);">
                    <del style="color: var(--danger); font-size: 0.75rem; line-height: 1.2;"><span style="color: var(--text-muted); word-break: break-word;">${escapeHTML(note.text)}</span></del>
                </div>`;
            } else {
                notesHtml += `
                <div style="background: var(--surface)5f5; padding: 6px 8px; border-radius: 4px; border: 1px solid #fecaca; border-left: 3px solid var(--danger);">
                    <div style="font-size: 0.75rem; color: #7f1d1d; line-height: 1.2; word-break: break-word;"><b>Query:</b> ${escapeHTML(note.text)}</div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
                        <div style="font-size: 0.6rem; color: #991b1b;">${escapeHTML(note.user)} &bull; ${timeStr}</div>
                        <button onclick="resolveTaskQuery('${task.id}', '${note.id}')" style="background: var(--surface); color: var(--success); border: 1px solid var(--success); padding: 2px 6px; font-size: 0.65rem; font-weight: bold; cursor: pointer; border-radius: 4px;">Resolve</button>
                    </div>
                </div>`;
            }
        });
        notesHtml += `</div>`;
    }

    return `
    <div style="background: var(--surface); padding: 12px; border-radius: 6px; border: 1px solid var(--border); box-shadow: 0 1px 2px rgba(0,0,0,0.05); cursor: grab;" draggable="true" ondragstart="startTaskDrag(event, '${task.id}')" ondragend="endTaskDrag(event)">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
            <div style="display: flex; gap: 6px; align-items: flex-start;">
                <span style="font-size: 1.1rem;">${icon}</span>
                <div>
                    <span class="priority-badge priority-${task.priority || 'Medium'}">${task.priority || 'Medium'}</span>
                    <strong style="font-size: 0.85rem; color: var(--text); line-height: 1.3; display: block; margin-top: 4px;">${escapeHTML(task.title)}</strong>
                </div>
            </div>
            <div style="display: flex; flex-direction:column; gap:4px;">
                <button onclick="deleteTask('${task.id}')" style="background: transparent; border: none; color: var(--border); cursor: pointer; font-size: 0.8rem; padding: 0;">✕</button>
                <button onclick="openNewTaskModal('${task.id}')" style="background: transparent; border: none; color: var(--border); cursor: pointer; font-size: 0.8rem; padding: 0;">✏️</button>
            </div>
        </div>
        
        ${dateHtml}
        ${notesHtml}

        <div style="display: flex; gap: 6px; margin-top: 10px;">
            <input type="text" id="query-input-${escapeHTML(task.id)}" placeholder="Add note/query..." style="margin: 0; flex-grow: 1; padding: 4px 8px; font-size: 0.75rem; border-radius: 4px; border: 1px solid var(--border); background: var(--bg); color: var(--text);">
            <button onclick="addTaskQuery('${task.id}')" style="padding: 4px 8px; font-size: 0.75rem; font-weight: bold; background: var(--primary); color: white; border: none; border-radius: 4px; cursor: pointer;">Post</button>
        </div>
    </div>`;
}

// Drag & Drop Handlers
window.startTaskDrag = function(ev, taskId) {
    ev.dataTransfer.setData("text/plain", taskId);
    ev.target.style.opacity = '0.4'; 
};

window.endTaskDrag = function(ev) {
    ev.target.style.opacity = '1';
};

window.allowTaskDrop = function(ev) {
    ev.preventDefault(); 
};

window.dropTask = function(ev, targetStatus) {
    ev.preventDefault();
    const taskId = ev.dataTransfer.getData("text/plain");
    if (taskId) updateTaskStatus(taskId, targetStatus);
};


// ==========================================
// VIEW 2: MAXIMIZED BULK LIST VIEW
// ==========================================
function renderBulkList() {
    const tbody = document.getElementById('bulk-list-body');
    if (!tbody) return;

    const tasks = db.tasks.filter(t => t.docId === activeTaskDocId);
    const todayStr = new Date().toISOString().split('T')[0];

    tasks.sort((a,b) => {
        if (a.status === 'Completed' && b.status !== 'Completed') return 1;
        if (a.status !== 'Completed' && b.status === 'Completed') return -1;
        const pMap = { 'High': 3, 'Medium': 2, 'Low': 1 };
        if (pMap[a.priority] !== pMap[b.priority]) return pMap[b.priority] - pMap[a.priority];
        return new Date(a.dueDate || '2099-12-31') - new Date(b.dueDate || '2099-12-31');
    });

    if(tasks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 30px; color: var(--text-muted);">No tasks generated for this shipment yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = tasks.map(t => {
        const isChecked = bulkSelectedTasks.has(t.id) ? 'checked' : '';
        const isOverdue = t.dueDate && t.dueDate < todayStr && t.status !== 'Completed';
        const displayDate = t.dueDate ? (typeof formatDateIN === 'function' ? formatDateIN(t.dueDate) : t.dueDate) : '---';
        
        let statusColor = '#64748b';
        if(t.status === 'Completed') statusColor = '#10b981';
        if(t.status === 'Processing') statusColor = '#0ea5e9';
        if(t.status === 'Stuck') statusColor = '#ef4444';

        let notePreview = '<span style="color:var(--border);">-</span>';
        if (t.notes && t.notes.length > 0) {
            const unres = t.notes.filter(n => !n.resolved);
            if (unres.length > 0) {
                notePreview = `<span style="color:var(--danger); font-size:0.8rem;"><b>Query:</b> ${escapeHTML(unres[0].text)}</span>`;
            } else {
                notePreview = `<span style="color:var(--success); font-size:0.8rem;">✓ ${t.notes.length} resolved</span>`;
            }
        }

        return `
        <tr>
            <td style="text-align: center;">
                <input type="checkbox" ${isChecked} onchange="toggleTaskSelection('${t.id}')" style="width: 16px; height: 16px; cursor: pointer;">
            </td>
            <td><span class="priority-badge priority-${t.priority || 'Medium'}">${t.priority || 'Medium'}</span></td>
            <td><strong style="color: var(--text);">${escapeHTML(t.title)}</strong></td>
            <td>${notePreview}</td>
            <td>
                <span style="color: ${isOverdue ? 'var(--danger)' : 'var(--text-muted)'}; font-weight: ${isOverdue ? 'bold' : 'normal'};">
                    ${displayDate} ${isOverdue ? '⚠️' : ''}
                </span>
            </td>
            <td><span style="color: ${statusColor}; font-weight: bold;">${t.status}</span></td>
            <td style="text-align: right;">
                <button class="secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="openNewTaskModal('${t.id}')">Edit</button>
            </td>
        </tr>`;
    }).join('');

    const masterCheck = document.getElementById('bulk-select-all');
    if (masterCheck) {
        masterCheck.checked = tasks.length > 0 && bulkSelectedTasks.size === tasks.length;
    }
}

window.toggleTaskSelection = function(id) {
    if (bulkSelectedTasks.has(id)) {
        bulkSelectedTasks.delete(id);
    } else {
        bulkSelectedTasks.add(id);
    }
    const tasks = db.tasks.filter(t => t.docId === activeTaskDocId);
    const masterCheck = document.getElementById('bulk-select-all');
    if (masterCheck) masterCheck.checked = bulkSelectedTasks.size === tasks.length;
};

window.toggleBulkSelectAll = function(cb) {
    const tasks = db.tasks.filter(t => t.docId === activeTaskDocId);
    if (cb.checked) {
        tasks.forEach(t => bulkSelectedTasks.add(t.id));
    } else {
        bulkSelectedTasks.clear();
    }
    renderBulkList();
};

window.bulkCompleteTasks = function() {
    if (bulkSelectedTasks.size === 0) return alert("Please select at least one task.");
    if (!confirm(`Mark ${bulkSelectedTasks.size} tasks as Completed?`)) return;

    db.tasks.forEach(t => {
        if (bulkSelectedTasks.has(t.id)) t.status = 'Completed';
    });

    bulkSelectedTasks.clear();
    
    db.tasks = [...db.tasks];
    if (typeof window.saveData === 'function') window.saveData(true);
    else if(typeof saveData === 'function') saveData(true);
    
    renderTasksWorkspace();
    if(typeof Enterprise !== 'undefined') Enterprise.notify("Tasks bulk completed successfully!", "success");
};


// ==========================================
// TASK CREATION & AUTO-CHECKLIST ENGINE
// ==========================================
window.autoGenerateExportTasks = function() {
    if (!activeTaskDocId) { alert("⚠️ Please select an Invoice from the Pipeline first!"); return; }
    if (!confirm("Generate intelligent 6-step export checklist with automated priorities and due dates?")) return;

    const doc = db.docs.find(d => d.id === activeTaskDocId);
    if (!doc) return; 
    
    const today = new Date();
    const addDays = (days) => {
        const d = new Date(today);
        d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
    };

    const smartDefaults = [
        { title: "Finalize Commercial Invoice & Packing List", priority: "High", due: addDays(0) },
        { title: "Submit Shipping Instructions (Draft BL)", priority: "High", due: addDays(1) },
        { title: "Apply for Phytosanitary / SGS Inspection", priority: "Medium", due: addDays(2) },
        { title: "Apply for Certificate of Origin (COO)", priority: "Medium", due: addDays(3) },
        { title: "Courier Original Documents to Buyer", priority: "High", due: addDays(5) },
        { title: "E-BRC / Bank Realization Tracker", priority: "Low", due: addDays(15) }
    ];

    smartDefaults.forEach(def => {
        if(!db.tasks.some(t => t.docId === activeTaskDocId && t.title === def.title)) {
            db.tasks.push({
                id: 'TSK_' + Date.now() + Math.random().toString(36).substr(2, 5),
                docId: activeTaskDocId,
                docNo: String(doc.no || 'Draft Invoice'),
                title: def.title,
                priority: def.priority,
                dueDate: def.due,
                date: new Date().toISOString().split('T')[0], // For schema consistency
                status: 'Pending',
                notes: [],
                timestamp: new Date().toISOString()
            });
        }
    });

    db.tasks = [...db.tasks];
    if (typeof window.saveData === 'function') window.saveData(true);
    else if(typeof saveData === 'function') saveData(true);
    
    _lastTasksCount = db.tasks.length;
    renderTasksWorkspace();
    if(typeof Enterprise !== 'undefined') Enterprise.notify("Smart Checklist Generated!", "success");
};

window.openNewTaskModal = function(editId = null) {
    if (!activeTaskDocId) { alert("⚠️ Please select an Invoice from the Pipeline first!"); return; }
    
    const form = document.getElementById('task-form');
    if(form) form.reset();
    
    if (editId) {
        const t = db.tasks.find(x => x.id === editId);
        if (t) {
            document.getElementById('nt-id').value = t.id;
            document.getElementById('nt-title').value = t.title;
            document.getElementById('nt-priority').value = t.priority || 'Medium';
            document.getElementById('nt-date').value = t.dueDate || '';
            document.getElementById('nt-status').value = t.status || 'Pending';
        }
    } else {
        document.getElementById('nt-id').value = '';
        document.getElementById('nt-date').value = new Date().toISOString().split('T')[0]; 
    }
    
    setVisibility('new-task-modal', true, 'flex');
};

window.closeNewTaskModal = function() {
    setVisibility('new-task-modal', false);
};

window.submitNewTask = function(e) {
    e.preventDefault();
    if (!activeTaskDocId) return;

    const doc = db.docs.find(d => d.id === activeTaskDocId);
    if (!doc) return; 

    const editId = document.getElementById('nt-id').value;
    
    const taskData = {
        docId: activeTaskDocId,
        docNo: String(doc.no || 'Draft Invoice'),
        title: document.getElementById('nt-title').value || 'Untitled Task',
        priority: document.getElementById('nt-priority').value,
        dueDate: document.getElementById('nt-date').value,
        date: new Date().toISOString().split('T')[0], // For schema consistency
        status: document.getElementById('nt-status').value,
        timestamp: new Date().toISOString()
    };

    if (editId) {
        const idx = db.tasks.findIndex(t => t.id === editId);
        if (idx > -1) {
            taskData.id = db.tasks[idx].id;
            taskData.notes = db.tasks[idx].notes || [];
            db.tasks[idx] = taskData;
        }
    } else {
        taskData.id = 'TSK_' + Date.now();
        taskData.notes = [];
        db.tasks.push(taskData);
    }

    db.tasks = [...db.tasks];
    if (typeof window.saveData === 'function') window.saveData(true);
    else if(typeof saveData === 'function') saveData(true);
    
    _lastTasksCount = db.tasks.length;
    closeNewTaskModal();
    renderTasksWorkspace();
};

window.updateTaskStatus = function(taskId, newStatus) {
    const task = db.tasks.find(t => t.id === taskId);
    if (task) {
        task.status = newStatus;
        
        db.tasks = [...db.tasks];
        if (typeof window.saveData === 'function') window.saveData(true);
        else if(typeof saveData === 'function') saveData(true);
        
        renderTasksWorkspace();
    }
};

window.deleteTask = function(taskId) {
    if(typeof Enterprise !== 'undefined' && !Enterprise.security.canDelete()) return;
    if(!confirm("Are you sure you want to delete this task?")) return;
    
    db.tasks = db.tasks.filter(t => t.id !== taskId);
    
    db.tasks = [...db.tasks];
    if (typeof window.saveData === 'function') window.saveData(true);
    else if(typeof saveData === 'function') saveData(true);
    
    _lastTasksCount = db.tasks.length;
    renderTasksWorkspace();
};

window.addTaskQuery = function(taskId) {
    const input = document.getElementById(`query-input-${taskId}`);
    if (!input) return;
    
    const text = input.value.trim();
    if (!text) return;

    const task = db.tasks.find(t => t.id === taskId);
    if (!task) return;

    if (!task.notes) task.notes = [];
    
    task.notes.push({
        id: 'NOT_' + Date.now(),
        text: text,
        user: sessionStorage.getItem('jft_user') || 'System User',
        timestamp: new Date().toISOString(),
        resolved: false
    });

    if (task.status !== 'Completed') task.status = 'Stuck';

    db.tasks = [...db.tasks];
    if (typeof window.saveData === 'function') window.saveData(true);
    else if(typeof saveData === 'function') saveData(true);
    
    renderTasksWorkspace();
};

window.resolveTaskQuery = function(taskId, noteId) {
    const task = db.tasks.find(t => t.id === taskId);
    if (!task) return;

    const note = task.notes.find(n => n.id === noteId);
    if (note) {
        note.resolved = true;
        
        const hasUnresolved = task.notes.some(n => n.resolved === false);
        if (!hasUnresolved && task.status === 'Stuck') {
            task.status = 'Processing';
            if(typeof Enterprise !== 'undefined') Enterprise.notify("All queries resolved. Task moved to Processing.", "info");
        }

        db.tasks = [...db.tasks];
        if (typeof window.saveData === 'function') window.saveData(true);
        else if(typeof saveData === 'function') saveData(true);
        
        renderTasksWorkspace();
    }
};


