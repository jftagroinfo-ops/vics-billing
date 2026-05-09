/* --- INTERNAL CHAT ENGINE (ADVANCED ENTERPRISE MESSENGER) --- */

if (!db.chats) db.chats = [];
if (!db.pinnedChats) db.pinnedChats = [];
if (!db.mutedChats) db.mutedChats = [];
if (!db.chatGroups) db.chatGroups = [];

window.escapeHTML = window.escapeHTML || function(str) {
    if (!str) return '';
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
};

window.activeChatUser = null;
let lastChatCount = 0;
let currentChatSearchQuery = '';

// 1. CLICK OUTSIDE TO CLOSE
document.addEventListener('click', (e) => {
    const popup = document.getElementById('chat-popup');
    if (popup && !popup.classList.contains('hidden')) {
        if (e.target === popup) {
            window.toggleChatPopup();
        }
    }
});

window.toggleChatPopup = function() {
    const popup = document.getElementById('chat-popup');
    const btn = document.getElementById('chat-floating-btn');
    
    if (popup.classList.contains('hidden')) {
        popup.classList.remove('hidden');
        popup.style.display = 'flex'; 
        if (btn) btn.style.display = 'none';
        
        const currentUser = sessionStorage.getItem('jft_user') || 'User';
        const nameEl = document.getElementById('my-chat-name');
        const avatarEl = document.getElementById('my-chat-avatar');
        
        if (nameEl) nameEl.innerText = escapeHTML(currentUser);
        if (avatarEl) avatarEl.innerText = escapeHTML(currentUser.charAt(0).toUpperCase());

        window.renderChatSidebar();
        
        if (!window.activeChatUser && db.users && db.users.length > 1) {
            const other = db.users.find(u => u.username !== currentUser);
            if (other) window.selectChatUser(other.username);
        }
    } else {
        popup.classList.add('hidden');
        popup.style.display = 'none';
        if (btn) btn.style.display = 'flex';
    }
};

window.renderChatSidebar = function(filterQuery = '') {
    const list = document.getElementById('chat-user-list');
    if (!list || !db.users) return;

    const currentUser = sessionStorage.getItem('jft_user') || 'User';
    
    let chatEntities = db.users.filter(u => u.username !== currentUser).map(u => ({ name: u.username, type: 'user' }));
    
    db.chatGroups.forEach(g => {
        if (g.members && g.members.includes(currentUser)) {
            chatEntities.push({ name: g.name, type: 'group' });
        }
    });

    if (filterQuery) {
        const q = filterQuery.toLowerCase();
        chatEntities = chatEntities.filter(e => e.name.toLowerCase().includes(q));
    }

    chatEntities.sort((a, b) => {
        const aPinned = db.pinnedChats.includes(a.name);
        const bPinned = db.pinnedChats.includes(b.name);
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        return a.name.localeCompare(b.name);
    });

    if (chatEntities.length === 0) {
        list.innerHTML = `<div style="padding:20px; text-align:center; color:#94a3b8; font-size:0.9rem;">No contacts found.</div>`;
        return;
    }

    list.innerHTML = chatEntities.map(entity => {
        const isActive = window.activeChatUser === entity.name;
        const isPinned = db.pinnedChats.includes(entity.name);
        const isMuted = db.mutedChats.includes(entity.name);
        
        let unreads = 0;
        let sharedChats = [];

        if (entity.type === 'group') {
            sharedChats = db.chats.filter(c => c.receiver === entity.name).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
            const lastMsgObj = sharedChats[sharedChats.length - 1];
            if (lastMsgObj && lastMsgObj.sender !== currentUser && !lastMsgObj.readBy?.includes(currentUser)) unreads = 1;
        } else {
            unreads = db.chats.filter(c => c.sender === entity.name && c.receiver === currentUser && !c.read).length;
            sharedChats = db.chats.filter(c => 
                (c.sender === currentUser && c.receiver === entity.name) || 
                (c.sender === entity.name && c.receiver === currentUser)
            ).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
        }

        const unreadBadge = unreads > 0 ? `<div style="background:#ef4444; color:white; border-radius:50%; width:20px; height:20px; display:flex; align-items:center; justify-content:center; font-size:0.7rem; font-weight:bold; box-shadow:0 2px 4px rgba(239,68,68,0.3);">${unreads}</div>` : '';
        
        let lastMsg = sharedChats.length > 0 ? sharedChats[sharedChats.length - 1].text || '' : 'Start a conversation...';
        if (lastMsg && lastMsg.startsWith('[IMAGE:')) lastMsg = '📷 Image attached';
        else if (lastMsg === '[Expired Image]') lastMsg = '🚫 Expired Image';
        
        const displayMsg = lastMsg.length > 25 ? lastMsg.substring(0, 25) + '...' : lastMsg;

        const avatarIcon = entity.type === 'group' ? '👥' : escapeHTML(entity.name.charAt(0).toUpperCase());
        const statusIcons = `${isPinned ? '📌' : ''} ${isMuted ? '🔕' : ''}`;

        return `
            <div class="chat-user-item ${isActive ? 'active' : ''}" onclick="window.selectChatUser('${escapeHTML(entity.name)}')">
                <div class="chat-avatar" style="width:40px; height:40px; font-size:1.1rem; flex-shrink:0;">${avatarIcon}</div>
                <div style="flex:1; overflow:hidden;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
                        <b style="font-size:0.95rem; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(entity.name)} <span style="font-size:0.7rem;">${statusIcons}</span></b>
                    </div>
                    <div style="font-size:0.8rem; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(displayMsg)}</div>
                </div>
                ${unreadBadge}
            </div>
        `;
    }).join('');
};

window.filterChatUsers = function(query) {
    window.renderChatSidebar(query);
};

// 2. PERFECTLY ALIGNED TOP BAR UI & SMALLER ICONS
window.selectChatUser = function(name) {
    window.activeChatUser = name;
    currentChatSearchQuery = ''; 
    const searchBar = document.getElementById('in-chat-search-bar');
    if (searchBar) searchBar.remove();
    
    document.getElementById('chat-empty-state').classList.add('hidden');
    document.getElementById('chat-active-state').classList.remove('hidden');
    
    const isMuted = db.mutedChats.includes(name);
    const isPinned = db.pinnedChats.includes(name);
    const isGroup = db.chatGroups.some(g => g.name === name);
    
    const nameEl = document.getElementById('active-chat-name');
    const avatarEl = document.getElementById('active-chat-avatar');

    nameEl.innerText = escapeHTML(name) + (isPinned ? ' 📌' : '') + (isMuted ? ' 🔕' : '');
    avatarEl.innerText = isGroup ? '👥' : escapeHTML(name.charAt(0).toUpperCase());
    
    // Group Header Clickable for Management
    if (isGroup) {
        nameEl.style.cursor = 'pointer';
        avatarEl.style.cursor = 'pointer';
        nameEl.title = "Click to manage group members";
        avatarEl.title = "Click to manage group members";
        nameEl.onclick = () => window.manageChatGroup();
        avatarEl.onclick = () => window.manageChatGroup();
    } else {
        nameEl.style.cursor = 'default';
        avatarEl.style.cursor = 'default';
        nameEl.title = "";
        avatarEl.title = "";
        nameEl.onclick = null;
        avatarEl.onclick = null;
    }
    
    // Dynamic alignment of Name/Avatar to Left
    const headerLeft = document.querySelector('#chat-active-state .chat-header-glass > div:nth-child(1)');
    if (headerLeft) {
        headerLeft.style.cssText = "display:flex; align-items:center; gap:12px; flex:1; min-width:0;";
    }
    const nameContainer = nameEl.parentElement;
    if(nameContainer) {
        nameContainer.style.cssText = "line-height: 1.3; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;";
    }
    
    // Smaller Icons, neatly aligned to the right
    const toolbarContainer = document.querySelector('#chat-active-state .chat-header-glass > div:nth-child(2)');
    if (toolbarContainer) {
        toolbarContainer.style.cssText = "display:flex; gap:6px; align-items:center; flex-shrink:0;";
        toolbarContainer.innerHTML = `
            <button class="chat-toolbar-btn" title="Search Chat" style="font-size:0.95rem; padding:4px;" onclick="window.searchCurrentChat()">🔍</button>
            <button class="chat-toolbar-btn" title="Pin Chat" style="font-size:0.95rem; padding:4px;" onclick="window.pinCurrentChat()">📌</button>
            <button class="chat-toolbar-btn" title="Mute Notifications" style="font-size:0.95rem; padding:4px;" onclick="window.muteCurrentChat()">🔕</button>
            <button class="chat-toolbar-btn" title="Download Export" style="font-size:0.95rem; padding:4px;" onclick="window.downloadChatHistory()">⬇️</button>
            <button class="chat-toolbar-btn" title="Clear Chat" style="font-size:0.95rem; color:#ef4444; padding:4px;" onclick="window.clearCurrentChat()">🗑️</button>
            <div style="border-left: 1px solid var(--border); height: 16px; margin: 0 6px;"></div>
            <button class="chat-toolbar-btn" style="font-size:1.1rem; color:#64748b; padding:4px;" onmouseover="this.style.color='#0f172a'" onmouseout="this.style.color='#64748b'" onclick="window.toggleChatPopup()">✕</button>
        `;
    }

    // Ensure Auto-Reply button is in the input toolbar alongside Attach & Emoji
    const inputToolbar = document.querySelector('.chat-input-toolbar');
    if (inputToolbar && !document.getElementById('btn-auto-reply')) {
        const autoReplyBtn = document.createElement('button');
        autoReplyBtn.type = 'button';
        autoReplyBtn.id = 'btn-auto-reply';
        autoReplyBtn.className = 'chat-toolbar-btn';
        autoReplyBtn.title = 'Quick Auto Reply';
        autoReplyBtn.onclick = window.toggleAutoReplyPicker;
        autoReplyBtn.innerHTML = `<span style="font-size: 0.95rem; margin-right: 5px;">💬</span> Auto Reply`;
        inputToolbar.appendChild(autoReplyBtn);
    }

    const currentUser = sessionStorage.getItem('jft_user') || 'User';
    let changed = false;
    
    db.chats.forEach(c => {
        if (!isGroup && c.sender === name && c.receiver === currentUser && !c.read) {
            c.read = true;
            if (c.text && c.text.startsWith('[IMAGE:')) c.seenAt = Date.now(); 
            changed = true;
        } else if (isGroup && c.receiver === name && c.sender !== currentUser) {
            if (!c.readBy) c.readBy = [];
            if (!c.readBy.includes(currentUser)) {
                c.readBy.push(currentUser);
                if (c.text && c.text.startsWith('[IMAGE:') && !c.seenAt) c.seenAt = Date.now(); 
                changed = true;
            }
        }
    });
    
    if (changed && typeof saveData === 'function') saveData(false);

    window.renderChatSidebar();
    window.renderChatMessages();
    
    setTimeout(() => {
        const input = document.getElementById('chat-input-text');
        if (input) input.focus();
    }, 100);
};

// 3. AUTO REPLY POPUP LOGIC
window.toggleAutoReplyPicker = function() {
    let picker = document.getElementById('chat-auto-reply-picker');
    if (!picker) {
        picker = document.createElement('div');
        picker.id = 'chat-auto-reply-picker';
        picker.style.cssText = "position:absolute; bottom:80px; left:180px; background: var(--surface); border:1px solid var(--border); border-radius:12px; padding:15px; box-shadow:0 10px 25px rgba(0,0,0,0.15); display:flex; flex-direction:column; gap:8px; z-index:10002; width: 220px;";
        
        const replies = ['Okay 👍', 'Thank you!', 'Noted.', 'I will check and revert.', 'Approved ✅', 'Need some time ⏳'];
        
        picker.innerHTML = replies.map(r => `<button type="button" style="text-align:left; padding:8px 12px; background:var(--bg); border:1px solid var(--border); border-radius:6px; cursor:pointer; color:#334155; font-size:0.85rem;" onmouseover="this.style.background='rgba(59, 130, 246, 0.1)'; this.style.borderColor='var(--primary)';" onmouseout="this.style.background='var(--bg)'; this.style.borderColor='var(--border)';" onclick="document.getElementById('chat-input-text').value='${r}'; window.sendChatMessage(); document.getElementById('chat-auto-reply-picker').style.display='none';">${r}</button>`).join('');
        
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.style.cssText = "margin-top:5px; padding:8px; background:var(--bg); border:none; border-radius:6px; cursor:pointer; font-weight:bold; color:#ef4444; font-size:0.85rem;";
        closeBtn.innerText = "Close";
        closeBtn.onclick = () => picker.style.display = 'none';
        picker.appendChild(closeBtn);
        
        document.querySelector('.chat-input-area').appendChild(picker);
    } else {
        picker.style.display = picker.style.display === 'none' ? 'flex' : 'none';
    }
    
    const emojiPicker = document.getElementById('chat-emoji-picker');
    if (emojiPicker) emojiPicker.style.display = 'none';
};


// 4. FIX RIGHT MARGIN OVERFLOW & PHANTOM IMAGES
window.renderChatMessages = function() {
    const container = document.getElementById('chat-messages-container');
    if (!container || !window.activeChatUser) return;

    const currentUser = sessionStorage.getItem('jft_user') || 'User';
    const isGroup = db.chatGroups.some(g => g.name === window.activeChatUser);
    
    let messages = [];
    if (isGroup) {
        messages = db.chats.filter(c => c.receiver === window.activeChatUser).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    } else {
        messages = db.chats.filter(c => 
            (c.sender === currentUser && c.receiver === window.activeChatUser) || 
            (c.sender === window.activeChatUser && c.receiver === currentUser)
        ).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    if (messages.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:#94a3b8; margin-top:auto; margin-bottom:auto;">This is the beginning of your secure chat history with ${escapeHTML(window.activeChatUser)}.</div>`;
        return;
    }

    let html = '';
    let lastDate = '';

    messages.forEach(msg => {
        if (currentChatSearchQuery && !msg.text.toLowerCase().includes(currentChatSearchQuery.toLowerCase())) return;

        const isMe = msg.sender === currentUser;
        const msgDate = new Date(msg.timestamp).toLocaleDateString();
        
        if (msgDate !== lastDate) {
            html += `<div style="text-align:center; margin:15px 0;"><span style="background:var(--bg); color:#64748b; padding:4px 12px; border-radius:12px; font-size:0.75rem; font-weight:bold; border: 1px solid var(--border);">${msgDate}</span></div>`;
            lastDate = msgDate;
        }

        const timeStr = window.formatChatTime(msg.timestamp);
        const bubbleClass = isMe ? 'bubble-right' : 'bubble-left';
        const timeColor = isMe ? 'rgba(255,255,255,0.8)' : '#64748b';
        const readStatus = isMe ? (msg.read || (msg.readBy && msg.readBy.length > 0) ? '<span style="color:var(--primary); margin-left:4px;">✓✓</span>' : '<span style="opacity:0.6; margin-left:4px;">✓</span>') : '';

        let displayText = escapeHTML(msg.text || '');

        if (msg.text && msg.text.startsWith('[IMAGE:')) {
            const base64Data = msg.text.substring(7, msg.text.length - 1);
            displayText = `<div style="margin-bottom:5px; font-size:0.75rem; opacity:0.8; font-style:italic;">⏳ Auto-destructs 1hr after viewing</div><img src="${base64Data}" style="max-width: 100%; border-radius: 8px; cursor: pointer; border: 1px solid rgba(0,0,0,0.1);" onclick="window.open(this.src)" />`;
        } else if (msg.text === '[Expired Image]') {
            displayText = `<div style="padding:10px; text-align:center; opacity:0.7; font-style:italic;">🚫 Image Expired & Removed from Server</div>`;
        }
        else if (currentChatSearchQuery) {
            const regex = new RegExp(`(${currentChatSearchQuery})`, 'gi');
            displayText = displayText.replace(regex, '<mark style="background: #fde047; color: #0f172a; padding: 0 2px; border-radius: 2px;">$1</mark>');
        }

        let senderLabel = (isGroup && !isMe) ? `<div style="font-size:0.75rem; font-weight:bold; color:#3b82f6; margin-bottom:4px;">${escapeHTML(msg.sender)}</div>` : '';

        // ADDED word-break and overflow-wrap to strictly prevent horizontal overflow
        html += `
            <div class="chat-bubble ${bubbleClass}">
                ${senderLabel}
                <div style="white-space: pre-wrap; word-break: break-word; overflow-wrap: break-word; max-width: 100%; box-sizing: border-box;">${displayText}</div>
                <span class="chat-time" style="color: ${timeColor};">${timeStr}${readStatus}</span>
            </div>
        `;
    });

    if (html === '') html = `<div style="text-align:center; color:#94a3b8; margin-top:auto; margin-bottom:auto;">No messages match your search.</div>`;

    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
};

window.sendChatMessage = function() {
    const input = document.getElementById('chat-input-text');
    if (!input || !input.value.trim() || !window.activeChatUser) return;

    const text = input.value.trim();
    const currentUser = sessionStorage.getItem('jft_user') || 'User';

    if (window.activeChatUser === currentUser) return;

    db.chats.push({
        id: 'MSG_' + Date.now(),
        sender: currentUser,
        receiver: window.activeChatUser,
        text: text,
        timestamp: new Date().toISOString(),
        read: false,
        readBy: []
    });

    input.value = '';
    
    const emojiPicker = document.getElementById('chat-emoji-picker');
    if(emojiPicker) emojiPicker.style.display = 'none';
    const autoReplyPicker = document.getElementById('chat-auto-reply-picker');
    if(autoReplyPicker) autoReplyPicker.style.display = 'none';

    window.renderChatMessages();
    const searchBox = document.querySelector('.chat-input-glass');
    const currentFilter = searchBox ? searchBox.value.toLowerCase() : '';
    window.renderChatSidebar(currentFilter);
    
    if (typeof saveData === 'function') saveData(false);
};

window.formatChatTime = function(isoString) {
    const d = new Date(isoString);
    let hours = d.getHours();
    let minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return hours + ':' + minutes + ' ' + ampm;
};

// ==========================================
// ADVANCED WHATSAPP-STYLE GROUP MANAGEMENT
// ==========================================
window.createChatGroup = function() {
    const currentUser = sessionStorage.getItem('jft_user') || 'User';
    const users = db.users.filter(u => u.username !== currentUser);
    
    if (users.length === 0) return alert("No other users available to add to a group.");

    const overlay = document.createElement('div');
    overlay.className = 'personal-modal-overlay';
    overlay.id = 'create-group-modal';
    overlay.style.zIndex = '10005';
    
    let userCheckboxes = users.map(u => `
        <label style="display:flex; align-items:center; gap:10px; padding:10px; border-bottom:1px solid var(--border); cursor:pointer; color:#0f172a;">
            <input type="checkbox" value="${escapeHTML(u.username)}" class="group-member-cb">
            ${escapeHTML(u.username)}
        </label>
    `).join('');

    overlay.innerHTML = `
        <div class="card" style="width:400px; background: var(--surface); padding:25px; border-radius:12px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); display:flex; flex-direction:column; gap:15px;">
            <h3 style="margin:0 0 10px 0; color:#0f172a; border-bottom:1px solid var(--border); padding-bottom:10px;">👥 Create New Group</h3>
            <input type="text" id="new-group-name" placeholder="Enter Group Name..." style="padding:10px; border:1px solid var(--border); border-radius:6px; outline:none; font-size:0.95rem; width:100%; box-sizing:border-box;">
            
            <div style="font-weight:bold; font-size:0.85rem; color:#64748b; margin-top:5px;">Select Members:</div>
            <div style="max-height:200px; overflow-y:auto; border:1px solid var(--border); border-radius:6px; padding:5px; background:var(--bg);">
                ${userCheckboxes}
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:10px;">
                <button type="button" class="secondary" onclick="document.getElementById('create-group-modal').remove()" style="padding:8px 15px; border:1px solid var(--border); background:transparent; border-radius:6px; cursor:pointer;">Cancel</button>
                <button type="button" onclick="window.submitCreateGroup()" style="padding:8px 15px; background:#3b82f6; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">Create Group</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
};

window.submitCreateGroup = function() {
    const nameInput = document.getElementById('new-group-name');
    const groupName = nameInput ? nameInput.value.trim() : '';
    
    if (!groupName) return alert("Please enter a group name.");
    if (db.users.find(u => u.username.toLowerCase() === groupName.toLowerCase()) || db.chatGroups.find(g => g.name.toLowerCase() === groupName.toLowerCase())) {
        return alert("This name is already taken by a user or group.");
    }

    const currentUser = sessionStorage.getItem('jft_user') || 'User';
    const selectedMembers = Array.from(document.querySelectorAll('.group-member-cb:checked')).map(cb => cb.value);
    
    if (selectedMembers.length === 0) return alert("Please select at least one member.");

    selectedMembers.push(currentUser); 

    db.chatGroups.push({ id: 'GRP_' + Date.now(), name: groupName, members: selectedMembers });
    
    if(typeof saveData === 'function') saveData(true);
    document.getElementById('create-group-modal').remove();
    window.renderChatSidebar();
    window.selectChatUser(groupName);
    if(typeof Enterprise !== 'undefined') Enterprise.notify(`Group '${groupName}' created successfully.`, "success");
};

window.manageChatGroup = function() {
    const group = db.chatGroups.find(g => g.name === window.activeChatUser);
    if (!group) return;

    const currentUser = sessionStorage.getItem('jft_user') || 'User';
    const allUsers = db.users.filter(u => u.username !== currentUser);
    
    const overlay = document.createElement('div');
    overlay.className = 'personal-modal-overlay';
    overlay.id = 'manage-group-modal';
    overlay.style.zIndex = '10005';
    
    let membersList = group.members.map(m => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid var(--border); color:#0f172a;">
            <span>${escapeHTML(m)}${m === currentUser ? ' (You)' : ''}</span>
            ${m !== currentUser ? `<button style="background:transparent; border:none; color:#ef4444; cursor:pointer; font-size:0.85rem; font-weight:bold;" onclick="window.removeGroupMember('${escapeHTML(m)}')">Remove</button>` : ''}
        </div>
    `).join('');

    let availableUsers = allUsers.filter(u => !group.members.includes(u.username));
    let addMemberSelect = `<select id="add-member-select" style="padding:10px; border-radius:6px; border:1px solid var(--border); flex-grow:1; outline:none; background: var(--surface);">
        <option value="">-- Select user to add --</option>
        ${availableUsers.map(u => `<option value="${escapeHTML(u.username)}">${escapeHTML(u.username)}</option>`).join('')}
    </select>`;

    overlay.innerHTML = `
        <div class="card" style="width:400px; background: var(--surface); padding:25px; border-radius:12px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); display:flex; flex-direction:column; gap:15px;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:10px;">
                <h3 style="margin:0; color:#0f172a;">👥 Manage: ${escapeHTML(group.name)}</h3>
                <button style="background:transparent; border:none; cursor:pointer; font-size:1.2rem; color:#64748b;" onclick="document.getElementById('manage-group-modal').remove()">✕</button>
            </div>
            
            <div style="font-weight:bold; font-size:0.85rem; color:#64748b;">Group Members:</div>
            <div style="max-height:200px; overflow-y:auto; border:1px solid var(--border); border-radius:6px; padding:5px; background:var(--bg);">
                ${membersList}
            </div>

            <div style="display:flex; gap:10px; margin-top:5px;">
                ${addMemberSelect}
                <button onclick="window.addGroupMember()" style="padding:10px 20px; background:#10b981; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">Add</button>
            </div>

            <button onclick="window.deleteGroup()" style="margin-top:15px; padding:12px; background:#fef2f2; color:#ef4444; border:1px solid #fca5a5; border-radius:6px; cursor:pointer; font-weight:bold; width:100%;">🗑️ Delete Entire Group</button>
        </div>
    `;
    document.body.appendChild(overlay);
};

window.removeGroupMember = function(username) {
    const group = db.chatGroups.find(g => g.name === window.activeChatUser);
    if (!group) return;
    group.members = group.members.filter(m => m !== username);
    if(typeof saveData === 'function') saveData(true);
    if(typeof Enterprise !== 'undefined') Enterprise.notify(`${username} removed from group.`, "info");
    document.getElementById('manage-group-modal').remove();
    window.manageChatGroup(); 
};

window.addGroupMember = function() {
    const select = document.getElementById('add-member-select');
    const username = select.value;
    if (!username) return;

    const group = db.chatGroups.find(g => g.name === window.activeChatUser);
    if (!group) return;
    
    group.members.push(username);
    if(typeof saveData === 'function') saveData(true);
    if(typeof Enterprise !== 'undefined') Enterprise.notify(`${username} added to group.`, "success");
    document.getElementById('manage-group-modal').remove();
    window.manageChatGroup(); 
};

window.deleteGroup = function() {
    const group = db.chatGroups.find(g => g.name === window.activeChatUser);
    if (!group) return;
    
    if (confirm("SECURITY WARNING: Are you sure you want to completely delete this group and all its messages for everyone?")) {
        db.chatGroups = db.chatGroups.filter(g => g.name !== group.name);
        db.chats = db.chats.filter(c => c.receiver !== group.name);
        window.activeChatUser = null;
        if(typeof saveData === 'function') saveData(true);
        
        document.getElementById('manage-group-modal').remove();
        document.getElementById('chat-active-state').classList.add('hidden');
        document.getElementById('chat-empty-state').classList.remove('hidden');
        window.renderChatSidebar();
        if(typeof Enterprise !== 'undefined') Enterprise.notify("Group securely deleted.", "success");
    }
};

window.searchCurrentChat = function() { 
    const searchBarId = 'in-chat-search-bar';
    let bar = document.getElementById(searchBarId);
    
    if (!bar) {
        bar = document.createElement('div');
        bar.id = searchBarId;
        bar.style.cssText = "padding:12px 20px; background:var(--bg); border-bottom:1px solid var(--border); display:flex; gap:10px; align-items:center;";
        bar.innerHTML = `
            <input type="text" id="in-chat-search-input" placeholder="Highlight keywords in this conversation..." style="flex-grow:1; padding:8px 15px; border-radius:20px; border:1px solid var(--border); outline:none; font-size:0.9rem; color:#0f172a;" oninput="window.executeChatSearch(this.value)">
            <button onclick="document.getElementById('${searchBarId}').remove(); window.executeChatSearch('');" style="background:transparent; border:none; cursor:pointer; font-size:1.2rem; color:#64748b;" title="Clear Search">✕</button>
        `;
        const header = document.querySelector('.chat-header-glass');
        header.parentNode.insertBefore(bar, header.nextSibling);
        document.getElementById('in-chat-search-input').focus();
    } else {
        bar.remove();
        window.executeChatSearch('');
    }
};

window.executeChatSearch = function(query) {
    currentChatSearchQuery = query;
    window.renderChatMessages();
};

window.pinCurrentChat = function() { 
    if (!window.activeChatUser) return;
    if (db.pinnedChats.includes(window.activeChatUser)) {
        db.pinnedChats = db.pinnedChats.filter(u => u !== window.activeChatUser);
        if(typeof Enterprise !== 'undefined') Enterprise.notify("Chat unpinned from top.", "info");
    } else {
        if (db.pinnedChats.length >= 5) {
            alert("Maximum 5 chats can be pinned at a time to maintain dashboard organization.");
            return;
        }
        db.pinnedChats.push(window.activeChatUser);
        if(typeof Enterprise !== 'undefined') Enterprise.notify("Chat pinned to top.", "success");
    }
    if(typeof saveData === 'function') saveData(true);
    window.selectChatUser(window.activeChatUser); 
};

window.muteCurrentChat = function() { 
    if (!window.activeChatUser) return;
    if (db.mutedChats.includes(window.activeChatUser)) {
        db.mutedChats = db.mutedChats.filter(u => u !== window.activeChatUser);
        if(typeof Enterprise !== 'undefined') Enterprise.notify("Chat notifications enabled.", "info");
    } else {
        db.mutedChats.push(window.activeChatUser);
        if(typeof Enterprise !== 'undefined') Enterprise.notify("Chat notifications muted.", "warning");
    }
    if(typeof saveData === 'function') saveData(true);
    window.selectChatUser(window.activeChatUser); 
};

window.downloadChatHistory = function() {
    if (!window.activeChatUser) return;
    const currentUser = sessionStorage.getItem('jft_user') || 'User';
    const isGroup = db.chatGroups.some(g => g.name === window.activeChatUser);
    
    let messages = [];
    if (isGroup) {
        messages = db.chats.filter(c => c.receiver === window.activeChatUser).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    } else {
        messages = db.chats.filter(c => 
            (c.sender === currentUser && c.receiver === window.activeChatUser) || 
            (c.sender === window.activeChatUser && c.receiver === currentUser)
        ).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    let textContent = `Secure Chat History Export\nParticipants: ${currentUser} & ${window.activeChatUser}\nDate Exported: ${new Date().toLocaleString()}\n---------------------------------------------------\n\n`;
    
    messages.forEach(m => {
        const time = window.formatChatTime(m.timestamp);
        const date = new Date(m.timestamp).toLocaleDateString();
        let msgText = m.text.startsWith('[IMAGE:') ? '[Attached Phantom Image]' : (m.text === '[Expired Image]' ? '[Expired Image]' : m.text);
        textContent += `[${date} ${time}] ${m.sender}: ${msgText}\n`;
    });

    const blob = new Blob([textContent], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Chat_Export_${window.activeChatUser.replace(/\s+/g,'_')}_${Date.now()}.txt`;
    a.click();
    if(typeof Enterprise !== 'undefined') Enterprise.notify("Chat history downloaded successfully.", "success");
};

window.clearCurrentChat = function() {
    if (!window.activeChatUser) return;
    if (!confirm(`SECURITY WARNING: Are you sure you want to permanently delete your entire chat history with ${window.activeChatUser}? This cannot be undone.`)) return;
    
    const currentUser = sessionStorage.getItem('jft_user') || 'User';
    db.chats = db.chats.filter(c => 
        !(c.sender === currentUser && c.receiver === window.activeChatUser) && 
        !(c.sender === window.activeChatUser && c.receiver === currentUser)
    );
    
    if(typeof saveData === 'function') saveData(true);
    window.renderChatMessages();
    window.renderChatSidebar();
    if(typeof Enterprise !== 'undefined') Enterprise.notify("Chat history permanently wiped.", "success");
};

window.triggerChatImageUpload = function() { 
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = e => {
        const file = e.target.files[0];
        if (file) {
            if(file.size > 2 * 1024 * 1024) { 
                alert("Image is too large. Please select an image under 2MB.");
                return;
            }
            const reader = new FileReader();
            reader.onload = function(event) {
                const base64 = event.target.result;
                const currentUser = sessionStorage.getItem('jft_user') || 'User';
                
                db.chats.push({
                    id: 'MSG_' + Date.now(),
                    sender: currentUser,
                    receiver: window.activeChatUser,
                    text: `[IMAGE:${base64}]`,
                    timestamp: new Date().toISOString(),
                    read: false,
                    readBy: []
                });
                
                window.renderChatMessages();
                window.renderChatSidebar();
                if (typeof saveData === 'function') saveData(false);
            };
            reader.readAsDataURL(file);
        }
    };
    input.click();
};

window.toggleChatEmojiPicker = function() { 
    let picker = document.getElementById('chat-emoji-picker');
    if (!picker) {
        picker = document.createElement('div');
        picker.id = 'chat-emoji-picker';
        picker.style.cssText = "position:absolute; bottom:80px; left:20px; background: var(--surface); border:1px solid var(--border); border-radius:12px; padding:15px; box-shadow:0 10px 25px rgba(0,0,0,0.15); display:grid; grid-template-columns:repeat(8, 1fr); gap:8px; z-index:10002;";
        
        const emojis = ['😀','😂','🥰','😎','🤔','🙄','😪','😴','😷','🤒','🤢','🤮','🤧','😵','🤯','🤠','🥳','😎','🤓','🧐','😕','😟','🙁','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾', '👍', '👎', '👏', '🙌', '👐', '🤲', '🤝', '🙏'];
        
        picker.innerHTML = emojis.map(e => `<span style="cursor:pointer; font-size:1.5rem; text-align:center; transition:transform 0.1s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'" onclick="document.getElementById('chat-input-text').value += '${e}'; document.getElementById('chat-input-text').focus();">${e}</span>`).join('');
        
        const closeBtn = document.createElement('div');
        closeBtn.innerHTML = `<button type="button" style="grid-column: span 8; margin-top:10px; padding:8px; background:#fef2f2; border:1px solid #fca5a5; border-radius:6px; cursor:pointer; font-weight:bold; color:#ef4444;" onclick="document.getElementById('chat-emoji-picker').style.display='none'">Close</button>`;
        picker.appendChild(closeBtn);
        
        document.querySelector('.chat-input-area').appendChild(picker);
    } else {
        picker.style.display = picker.style.display === 'none' ? 'grid' : 'none';
    }
    
    const autoReplyPicker = document.getElementById('chat-auto-reply-picker');
    if (autoReplyPicker) autoReplyPicker.style.display = 'none';
};

// ==========================================
// REAL-TIME SYNC & GARBAGE COLLECTION LOOP
// ==========================================
setInterval(() => {
    const currentUser = sessionStorage.getItem('jft_user') || 'User';
    if (!db.chats) return;

    let scrubbed = false;
    const now = Date.now();

    // 1-HOUR PHANTOM IMAGE GARBAGE COLLECTOR
    db.chats.forEach(c => {
        if (c.text && c.text.startsWith('[IMAGE:') && c.seenAt) {
            if (now - c.seenAt > 3600000) { // 3600000ms = 1 Hour
                c.text = '[Expired Image]'; 
                delete c.seenAt;
                scrubbed = true;
            }
        }
    });

    if (scrubbed && typeof saveData === 'function') {
        saveData(false); 
        if (window.activeChatUser) window.renderChatMessages();
    }

    const unreadCount = db.chats.filter(c => c.receiver === currentUser && !c.read).length;
    const badge = document.getElementById('chat-unread-badge');
    
    if (badge) {
        badge.innerText = unreadCount;
        badge.style.display = unreadCount > 0 ? 'flex' : 'none';
    }

    const popup = document.getElementById('chat-popup');
    
    if (db.chats.length > lastChatCount) {
        const lastMsg = db.chats[db.chats.length - 1];
        const isPopupClosed = popup?.classList.contains('hidden');
        
        if ((lastMsg.receiver === currentUser || (lastMsg.receiver && lastMsg.receiver.startsWith('GRP_') && db.chatGroups.some(g=>g.name===lastMsg.receiver && g.members.includes(currentUser)))) && lastMsg.sender !== currentUser && isPopupClosed) {
            if (!db.mutedChats.includes(lastMsg.sender) && !db.mutedChats.includes(lastMsg.receiver)) {
                if(typeof Enterprise !== 'undefined') Enterprise.notify(`💬 New message from ${escapeHTML(lastMsg.sender)}`, "info");
                try { new Audio('assets/sounds/notify.mp3').play(); } catch(e){}
            }
        }
        lastChatCount = db.chats.length;
    }

    if (popup && !popup.classList.contains('hidden')) {
        const searchBox = document.querySelector('.chat-input-glass');
        const currentFilter = searchBox ? searchBox.value.toLowerCase() : '';
        window.renderChatSidebar(currentFilter);
        
        if (window.activeChatUser) window.renderChatMessages();
    }
}, 3000);

setTimeout(() => {
    const currentUser = sessionStorage.getItem('jft_user') || 'User';
    lastChatCount = db.chats ? db.chats.length : 0;
    
    const floatBtn = document.getElementById('chat-floating-btn');
    if(floatBtn) floatBtn.style.display = 'flex'; 
}, 1000);


