(function () {
  // Mobile browsers don't shrink `100vh` when the on-screen keyboard opens,
  // and some don't handle rotation cleanly either. Track the real usable
  // height ourselves and expose it as a CSS variable everything else uses.
  function updateAppHeight() {
    const h = (window.visualViewport ? window.visualViewport.height : window.innerHeight);
    document.documentElement.style.setProperty('--app-height', h + 'px');
  }
  updateAppHeight();
  window.addEventListener('resize', updateAppHeight);
  window.addEventListener('orientationchange', updateAppHeight);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateAppHeight);
  }
})();

(function () {
  const socket = io();

  /** @type {Object<string, {name: string, messages: any[], unread: number}>} */
  const chats = {};
  let activeRoom = null;

  const tabList = document.getElementById('tab-list');
  const emptyState = document.getElementById('empty-state');
  const chatView = document.getElementById('chat-view');
  const chatRoomName = document.getElementById('chat-room-name');
  const messagesEl = document.getElementById('messages');
  const messageForm = document.getElementById('message-form');
  const messageInput = document.getElementById('message-input');
  const leaveBtn = document.getElementById('leave-btn');
  const attachBtn = document.getElementById('attach-btn');
  const fileInput = document.getElementById('file-input');
  const uploadProgress = document.getElementById('upload-progress');
  const sidebarEl = document.getElementById('sidebar');
  const collapseSidebarBtn = document.getElementById('collapse-sidebar-btn');
  const expandSidebarBtn = document.getElementById('expand-sidebar-btn');

  const STORAGE_KEY = 'hosttalk_last_name';
  const SIDEBAR_COLLAPSED_KEY = 'hosttalk_sidebar_collapsed';

  // ============================================================
  // Collapsible sidebar (chat list)
  // ============================================================
  function setSidebarCollapsed(collapsed) {
    sidebarEl.style.display = collapsed ? 'none' : 'flex';
    expandSidebarBtn.style.display = collapsed ? 'inline-block' : 'none';
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  }

  collapseSidebarBtn.addEventListener('click', () => setSidebarCollapsed(true));
  expandSidebarBtn.addEventListener('click', () => setSidebarCollapsed(false));
  setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');


  // ============================================================
  // Create / Join modals
  // ============================================================
  const createModal = document.getElementById('create-modal');
  const createForm = document.getElementById('create-form');
  const createRoomInput = document.getElementById('create-room');
  const createNameInput = document.getElementById('create-name');
  const createHasPassword = document.getElementById('create-has-password');
  const createPasswordRow = document.getElementById('create-password-row');
  const createPasswordInput = document.getElementById('create-password');

  const joinModal = document.getElementById('join-modal');
  const joinForm = document.getElementById('join-form');
  const joinRoomInput = document.getElementById('join-room');
  const joinNameInput = document.getElementById('join-name');
  const joinPasswordInput = document.getElementById('join-password');

  function openCreateModal() {
    createRoomInput.value = '';
    createNameInput.value = localStorage.getItem(STORAGE_KEY) || '';
    createHasPassword.checked = false;
    createPasswordInput.value = '';
    createPasswordRow.style.display = 'none';
    createModal.style.display = 'flex';
    createRoomInput.focus();
  }
  function closeCreateModal() { createModal.style.display = 'none'; }

  function openJoinModal() {
    joinRoomInput.value = '';
    joinNameInput.value = localStorage.getItem(STORAGE_KEY) || '';
    joinPasswordInput.value = '';
    joinModal.style.display = 'flex';
    joinRoomInput.focus();
  }
  function closeJoinModal() { joinModal.style.display = 'none'; }

  document.getElementById('create-chat-btn').addEventListener('click', openCreateModal);
  document.getElementById('empty-create-btn').addEventListener('click', openCreateModal);
  document.getElementById('create-cancel').addEventListener('click', closeCreateModal);
  createModal.addEventListener('click', (e) => { if (e.target === createModal) closeCreateModal(); });

  document.getElementById('join-chat-btn').addEventListener('click', openJoinModal);
  document.getElementById('empty-join-btn').addEventListener('click', openJoinModal);
  document.getElementById('join-cancel').addEventListener('click', closeJoinModal);
  joinModal.addEventListener('click', (e) => { if (e.target === joinModal) closeJoinModal(); });

  createHasPassword.addEventListener('change', () => {
    createPasswordRow.style.display = createHasPassword.checked ? 'flex' : 'none';
  });

  createForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const room = createRoomInput.value.trim();
    const name = createNameInput.value.trim();
    const hasPassword = createHasPassword.checked;
    const password = createPasswordInput.value.trim();
    if (!room || !name) return;
    if (hasPassword && !password) { alert('Введи пароль або вимкни повзунок.'); return; }

    localStorage.setItem(STORAGE_KEY, name);
    chats[room] = { name, messages: [], unread: 0, password: hasPassword ? password : '' };
    socket.emit('create_room', { room, name, has_password: hasPassword, password });
    closeCreateModal();
  });

  joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const room = joinRoomInput.value.trim();
    const name = joinNameInput.value.trim();
    const password = joinPasswordInput.value.trim();
    if (!room || !name) return;

    localStorage.setItem(STORAGE_KEY, name);

    if (chats[room]) {
      switchTab(room);
      closeJoinModal();
      return;
    }

    chats[room] = { name, messages: [], unread: 0, password };
    socket.emit('join_room', { room, name, password });
    closeJoinModal();
  });

  socket.on('create_error', (data) => {
    if (data.room) delete chats[data.room];
    alert(data.error || "Не вдалось створити чат.");
    if (activeRoom === data.room) activeRoom = Object.keys(chats)[0] || null;
    renderTabs();
    if (activeRoom) switchTab(activeRoom);
  });

  // ============================================================
  // Tabs
  // ============================================================
  function renderTabs() {
    tabList.innerHTML = '';
    const roomNames = Object.keys(chats);

    if (roomNames.length === 0) {
      emptyState.style.display = 'flex';
      chatView.style.display = 'none';
      return;
    }

    roomNames.forEach((room) => {
      const tab = document.createElement('div');
      tab.className = 'tab' + (room === activeRoom ? ' active' : '');
      tab.innerHTML = `
        <span class="tab-name">${escapeHtml(room)}</span>
        ${chats[room].unread > 0 ? `<span class="badge">${chats[room].unread}</span>` : ''}
      `;
      tab.addEventListener('click', () => switchTab(room));
      tabList.appendChild(tab);
    });
  }

  function switchTab(room) {
    if (!chats[room]) return;
    activeRoom = room;
    chats[room].unread = 0;
    emptyState.style.display = 'none';
    chatView.style.display = 'flex';
    chatRoomName.textContent = `${room}  ·  ${chats[room].name}`;
    renderTabs();
    renderMessages();
    updateCallUI();
    messageInput.focus();
  }

  leaveBtn.addEventListener('click', () => {
    if (!activeRoom) return;
    const room = activeRoom;
    if (callState.room === room) hangUp();
    socket.emit('leave_room', { room });
    delete chats[room];
    const remaining = Object.keys(chats);
    activeRoom = remaining.length ? remaining[0] : null;
    if (activeRoom) {
      switchTab(activeRoom);
    } else {
      renderTabs();
    }
  });

  // ============================================================
  // Messages
  // ============================================================
  function renderMessages() {
    if (!activeRoom) return;
    const chat = chats[activeRoom];
    messagesEl.innerHTML = '';
    chat.messages.forEach((m) => messagesEl.appendChild(renderMessage(m, chat.name)));
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function renderMessage(m, myName) {
    const el = document.createElement('div');
    if (m.system) {
      el.className = 'msg system';
      el.textContent = m.msg;
      return el;
    }
    const mine = m.name === myName;
    el.className = 'msg' + (mine ? ' mine' : '');
    const author = mine ? '' : `<div class="msg-author">${escapeHtml(m.name)}</div>`;
    const bubble = m.file ? renderFileBubbleHtml(m.file) : `<div class="msg-bubble">${escapeHtml(m.msg)}</div>`;
    el.innerHTML = author + bubble;
    return el;
  }

  function formatSize(bytes) {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function renderFileBubbleHtml(file) {
    const url = escapeHtml(file.url);
    const name = escapeHtml(file.filename);
    const size = formatSize(file.size);

    if (file.kind === 'image') {
      return `<a href="${url}" target="_blank" class="msg-file-image"><img src="${url}" alt="${name}"></a>`;
    }
    if (file.kind === 'video') {
      return `<video class="msg-file-video" src="${url}" controls></video>`;
    }
    return `
      <a href="${url}" target="_blank" download class="msg-bubble msg-file-generic">
        <span class="file-icon">📄</span>
        <span class="file-info"><span class="file-name">${name}</span><span class="file-size">${size}</span></span>
      </a>
    `;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text || !activeRoom) return;
    socket.emit('message', { room: activeRoom, msg: text });
    messageInput.value = '';
  });

  attachBtn.addEventListener('click', () => {
    if (!activeRoom) return;
    fileInput.click();
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file || !activeRoom) return;

    const room = activeRoom;
    const name = chats[room].name;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('room', room);
    formData.append('name', name);

    uploadProgress.style.display = 'block';
    uploadProgress.textContent = `Завантаження: ${file.name}...`;

    try {
      const res = await fetch('/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Не вдалось завантажити файл.');
        return;
      }
      socket.emit('file_message', {
        room, url: data.url, filename: data.filename, kind: data.kind, size: data.size,
      });
    } catch (err) {
      alert('Помилка завантаження файлу.');
    } finally {
      uploadProgress.style.display = 'none';
    }
  });

  // ============================================================
  // Socket events: chat / rooms
  // ============================================================
  socket.on('history', (data) => {
    const chat = chats[data.room];
    if (!chat) return;
    chat.messages = data.messages || [];
    if (activeRoom === null) {
      switchTab(data.room);
    } else {
      renderTabs();
      if (activeRoom === data.room) renderMessages();
    }
  });

  socket.on('joined', (data) => {
    if (activeRoom === null) switchTab(data.room);
    renderTabs();
  });

  socket.on('message', (data) => {
    const chat = chats[data.room];
    if (!chat) return;
    chat.messages.push(data);
    if (chat.messages.length > 50) chat.messages.shift();

    if (activeRoom === data.room) {
      renderMessages();
    } else {
      chat.unread += 1;
      renderTabs();
    }
  });

  socket.on('join_error', (data) => {
    if (data.room) delete chats[data.room];
    alert(data.error || 'Не вдалось приєднатись до чату.');
    if (activeRoom === data.room) activeRoom = Object.keys(chats)[0] || null;
    renderTabs();
    if (activeRoom) switchTab(activeRoom);
  });

  socket.on('connect', () => {
    // Re-join any rooms we had open, in case of reconnect (with cached password, if any)
    Object.keys(chats).forEach((room) => {
      socket.emit('join_room', { room, name: chats[room].name, password: chats[room].password || '' });
    });
  });

  // ============================================================
  // Voice / video calls (WebRTC mesh, signaled through Socket.IO)
  // ============================================================
  const callBtn = document.getElementById('call-btn');
  const callBar = document.getElementById('call-bar');
  const callParticipantsEl = document.getElementById('call-participants');
  const callVideosEl = document.getElementById('call-videos');
  const muteBtn = document.getElementById('mute-btn');
  const muteBtnIcon = document.getElementById('mute-btn-icon');
  const cameraBtn = document.getElementById('camera-btn');
  const cameraBtnIcon = document.getElementById('camera-btn-icon');
  const switchCameraBtn = document.getElementById('switch-camera-btn');
  const screenshareBtn = document.getElementById('screenshare-btn');
  const hangupBtn = document.getElementById('hangup-btn');
  let cameraFacingMode = 'user'; // front camera by default
  let isScreenSharing = false;

  const MIC_ON_ICON = "/static/icons/mic_on.png";
  const MIC_OFF_ICON = "/static/icons/mic_off.png";
  const CAMERA_ON_ICON = "/static/icons/camera_on.png";
  const CAMERA_OFF_ICON = "/static/icons/camera_off.png";

  // Fullscreen call view (Telegram-style)
  const fullscreenCallBtn = document.getElementById('fullscreen-call-btn');
  const fullscreenCallEl = document.getElementById('fullscreen-call');
  const fullscreenCallTitle = document.getElementById('fullscreen-call-title');
  const fullscreenCallVideos = document.getElementById('fullscreen-call-videos');
  const exitFullscreenCallBtn = document.getElementById('exit-fullscreen-call-btn');
  const fsMuteBtn = document.getElementById('fs-mute-btn');
  const fsMuteBtnIcon = document.getElementById('fs-mute-btn-icon');
  const fsCameraBtn = document.getElementById('fs-camera-btn');
  const fsCameraBtnIcon = document.getElementById('fs-camera-btn-icon');
  const fsSwitchCameraBtn = document.getElementById('fs-switch-camera-btn');
  const fsScreenshareBtn = document.getElementById('fs-screenshare-btn');
  const fsHangupBtn = document.getElementById('fs-hangup-btn');
  let isFullscreenCall = false;

  function syncCallButtons() {
    fsMuteBtnIcon.src = muteBtnIcon.src;
    fsCameraBtnIcon.src = cameraBtnIcon.src;
    fsScreenshareBtn.classList.toggle('active', screenshareBtn.classList.contains('active'));
  }

  function enterFullscreenCall() {
    if (!callState.room) return;
    fullscreenCallTitle.textContent = callState.room;
    // Reparent the live video/audio elements — moving DOM nodes keeps their
    // srcObject and playback running, so nothing needs to reconnect.
    while (callVideosEl.firstChild) {
      fullscreenCallVideos.appendChild(callVideosEl.firstChild);
    }
    syncCallButtons();
    fullscreenCallEl.style.display = 'flex';
    isFullscreenCall = true;
  }

  function exitFullscreenCall() {
    if (!isFullscreenCall) return;
    while (fullscreenCallVideos.firstChild) {
      callVideosEl.appendChild(fullscreenCallVideos.firstChild);
    }
    fullscreenCallEl.style.display = 'none';
    isFullscreenCall = false;
  }

  // New video/audio elements (camera turned on, a new peer's stream arriving)
  // must land in whichever container is actually visible right now — otherwise
  // they render into the hidden compact bar while fullscreen is open, and look
  // like "camera doesn't turn on" even though the stream is running fine.
  // Some mobile browsers defer repainting an element whose `display` was
  // toggled deep inside an async function (after several awaits) until some
  // unrelated click forces a style recalculation. Reading offsetHeight right
  // after the change forces an immediate, synchronous reflow so the button
  // actually shows up without needing an extra tap somewhere else.
  // Some mobile browsers defer repainting an element whose `display` was
  // toggled deep inside an async function (after several awaits) until some
  // unrelated click forces a style recalculation. We avoid that entirely by
  // toggling the .btn-hidden class (opacity-based) instead of display.
  function setSwitchCameraVisible(visible) {
    switchCameraBtn.classList.toggle('btn-hidden', !visible);
    fsSwitchCameraBtn.classList.toggle('btn-hidden', !visible);
  }

  function getActiveVideosContainer() {
    return isFullscreenCall ? fullscreenCallVideos : callVideosEl;
  }

  fullscreenCallBtn.addEventListener('click', enterFullscreenCall);
  exitFullscreenCallBtn.addEventListener('click', exitFullscreenCall);
  fsMuteBtn.addEventListener('click', () => { muteBtn.click(); syncCallButtons(); });
  fsCameraBtn.addEventListener('click', () => { cameraBtn.click(); });
  fsSwitchCameraBtn.addEventListener('click', () => { switchCameraBtn.click(); });
  fsScreenshareBtn.addEventListener('click', () => { screenshareBtn.click(); setTimeout(syncCallButtons, 400); });
  fsHangupBtn.addEventListener('click', () => { hangUp(); });

  const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    // If calls still fail to connect across different mobile networks, add a TURN
    // server here, e.g.: { urls: 'turn:your-turn-host:3478', username: '...', credential: '...' }
  ];

  const callState = {
    room: null,
    localStream: null,
    peers: new Map(),
    names: new Map(),
    muted: false,
    cameraOn: false,
  };

  function updateCallUI() {
    const inCallHere = callState.room === activeRoom && callState.room !== null;
    callBar.style.display = inCallHere ? 'flex' : 'none';
    callBtn.classList.toggle('active', inCallHere);
  }

  callBtn.addEventListener('click', async () => {
    if (!activeRoom) return;
    if (callState.room === activeRoom) return;
    if (callState.room && callState.room !== activeRoom) {
      alert('Спочатку заверши поточний дзвінок в іншому чаті.');
      return;
    }
    await startCall(activeRoom);
  });

  hangupBtn.addEventListener('click', hangUp);

  muteBtn.addEventListener('click', () => {
    if (!callState.localStream) return;
    callState.muted = !callState.muted;
    callState.localStream.getAudioTracks().forEach((t) => (t.enabled = !callState.muted));
    muteBtnIcon.src = callState.muted ? MIC_OFF_ICON : MIC_ON_ICON;
  });

  cameraBtn.addEventListener('click', async () => {
    if (!callState.localStream) return;
    if (!callState.cameraOn) {
      if (isScreenSharing) await stopScreenShare();
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: cameraFacingMode },
        });
        const videoTrack = camStream.getVideoTracks()[0];
        callState.localStream.addTrack(videoTrack);
        showLocalVideoPreview();

        // Renegotiate with every connected peer so they actually receive the new video track
        for (const [peerSid, pc] of callState.peers) {
          pc.addTrack(videoTrack, callState.localStream);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('call_signal', { room: callState.room, to: peerSid, type: 'offer', sdp: offer });
        }

        callState.cameraOn = true;
        cameraBtnIcon.src = CAMERA_ON_ICON;
        fsCameraBtnIcon.src = CAMERA_ON_ICON;
        setSwitchCameraVisible(true);
      } catch (err) {
        alert('Не вдалось увімкнути камеру.');
      }
    } else {
      callState.localStream.getVideoTracks().forEach((t) => t.stop());
      callState.localStream.getVideoTracks().forEach((t) => callState.localStream.removeTrack(t));
      hideLocalVideoPreview();

      // Tell peers we no longer send video (remove the sender + renegotiate)
      for (const [peerSid, pc] of callState.peers) {
        pc.getSenders().filter((s) => s.track && s.track.kind === 'video').forEach((s) => pc.removeTrack(s));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('call_signal', { room: callState.room, to: peerSid, type: 'offer', sdp: offer });
      }

      callState.cameraOn = false;
      cameraBtnIcon.src = CAMERA_OFF_ICON;
      fsCameraBtnIcon.src = CAMERA_OFF_ICON;
      setSwitchCameraVisible(false);
    }
  });

  switchCameraBtn.addEventListener('click', async () => {
    if (!callState.cameraOn) return;
    const nextFacingMode = cameraFacingMode === 'user' ? 'environment' : 'user';

    // Release the current camera FIRST — most phones only allow one active
    // camera stream at a time, so requesting a new one while the old track
    // is still live gets rejected by the OS/browser.
    const oldTrack = callState.localStream.getVideoTracks()[0];
    if (oldTrack) {
      callState.localStream.removeTrack(oldTrack);
      oldTrack.stop();
    }

    try {
      const camStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextFacingMode },
      });
      const newTrack = camStream.getVideoTracks()[0];
      cameraFacingMode = nextFacingMode;
      callState.localStream.addTrack(newTrack);
      showLocalVideoPreview();

      // Swap the track on every peer connection — no renegotiation needed for a same-kind swap
      callState.peers.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (sender) sender.replaceTrack(newTrack);
      });
    } catch (err) {
      alert('Не вдалось перемкнути камеру: ' + (err && err.message ? err.message : err));
      // Camera hardware doesn't support the other facing mode (or is busy) —
      // try to restore the original camera so the user isn't left with none.
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: cameraFacingMode },
        });
        const fallbackTrack = fallbackStream.getVideoTracks()[0];
        callState.localStream.addTrack(fallbackTrack);
        showLocalVideoPreview();
        callState.peers.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (sender) sender.replaceTrack(fallbackTrack);
        });
      } catch (err2) {
        hideLocalVideoPreview();
      }
    }
  });

  // ---- Screen sharing ----------------------------------------------------
  async function startScreenShare() {
    if (!callState.localStream || isScreenSharing) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      alert('Цей браузер не підтримує демонстрацію екрана (getDisplayMedia недоступний). Спробуй оновити Chrome або тестувати з ПК.');
      return;
    }

    let screenStream;
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    } catch (err) {
      if (err && (err.name === 'NotAllowedError' || err.name === 'AbortError')) {
        return; // user cancelled the picker — not an error worth alerting about
      }
      alert('Не вдалось почати демонстрацію екрана: ' + (err && err.message ? err.message : err));
      return;
    }

    // Only one outgoing video source at a time: stop the camera if it's on.
    if (callState.cameraOn) {
      callState.localStream.getVideoTracks().forEach((t) => {
        callState.localStream.removeTrack(t);
        t.stop();
      });
      callState.cameraOn = false;
      cameraBtnIcon.src = CAMERA_OFF_ICON;
      fsCameraBtnIcon.src = CAMERA_OFF_ICON;
      setSwitchCameraVisible(false);
    }

    const screenTrack = screenStream.getVideoTracks()[0];
    callState.localStream.addTrack(screenTrack);
    showLocalVideoPreview();

    for (const [peerSid, pc] of callState.peers) {
      const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
      if (sender) {
        sender.replaceTrack(screenTrack);
      } else {
        pc.addTrack(screenTrack, callState.localStream);
      }
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('call_signal', { room: callState.room, to: peerSid, type: 'offer', sdp: offer });
    }

    isScreenSharing = true;
    screenshareBtn.classList.add('active');
    fsScreenshareBtn.classList.add('active');

    // The browser's own "Stop sharing" bar can end this outside our UI —
    // catch that and clean up the same way as clicking our button would.
    screenTrack.addEventListener('ended', () => stopScreenShare());
  }

  async function stopScreenShare() {
    if (!isScreenSharing || !callState.localStream) return;

    callState.localStream.getVideoTracks().forEach((t) => {
      callState.localStream.removeTrack(t);
      t.stop();
    });
    hideLocalVideoPreview();

    for (const [peerSid, pc] of callState.peers) {
      pc.getSenders().filter((s) => s.track && s.track.kind === 'video').forEach((s) => pc.removeTrack(s));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('call_signal', { room: callState.room, to: peerSid, type: 'offer', sdp: offer });
    }

    isScreenSharing = false;
    screenshareBtn.classList.remove('active');
    fsScreenshareBtn.classList.remove('active');
  }

  screenshareBtn.addEventListener('click', () => {
    if (isScreenSharing) stopScreenShare(); else startScreenShare();
  });

  function showLocalVideoPreview() {
    let el = document.getElementById('call-local-video');
    const targetContainer = getActiveVideosContainer();
    if (!el) {
      el = document.createElement('video');
      el.id = 'call-local-video';
      el.autoplay = true;
      el.playsInline = true;
      el.muted = true; // never play back your own mic through your own speaker
      el.className = 'call-remote-video call-local-video';
      targetContainer.prepend(el);
    } else if (el.parentElement !== targetContainer) {
      targetContainer.prepend(el);
    }
    el.classList.toggle('no-mirror', isScreenSharing); // don't mirror screen shares, only the selfie camera
    el.srcObject = callState.localStream;
  }

  function hideLocalVideoPreview() {
    const el = document.getElementById('call-local-video');
    if (el) el.remove();
  }

  async function startCall(room) {
    try {
      callState.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      alert('Не вдалось отримати доступ до мікрофона.');
      return;
    }
    callState.room = room;
    callState.muted = false;
    callState.cameraOn = false;
    muteBtnIcon.src = MIC_ON_ICON;
    cameraBtnIcon.src = CAMERA_OFF_ICON;
    fsCameraBtnIcon.src = CAMERA_OFF_ICON;
    updateCallUI();
    renderCallParticipants();
    socket.emit('call_join', { room });
  }

  function hangUp() {
    if (!callState.room) return;
    exitFullscreenCall(); // move video elements back before clearing, and close the overlay
    socket.emit('call_leave', { room: callState.room });
    callState.peers.forEach((pc) => pc.close());
    callState.peers.clear();
    callState.names.clear();
    if (callState.localStream) {
      callState.localStream.getTracks().forEach((t) => t.stop());
      callState.localStream = null;
    }
    callState.room = null;
    callState.cameraOn = false;
    cameraFacingMode = 'user';
    setSwitchCameraVisible(false);
    isScreenSharing = false;
    screenshareBtn.classList.remove('active');
    fsScreenshareBtn.classList.remove('active');
    callVideosEl.innerHTML = '';
    updateCallUI();
  }

  function renderCallParticipants() {
    const myName = chats[callState.room] ? chats[callState.room].name : '';
    const names = [myName + ' (ти)', ...callState.names.values()];
    callParticipantsEl.textContent = `У дзвінку (${names.length}): ` + names.join(', ');
  }

  function createPeerConnection(peerSid, room) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    callState.localStream.getTracks().forEach((track) => {
      pc.addTrack(track, callState.localStream);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('call_signal', {
          room, to: peerSid, type: 'ice-candidate', candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      let mediaEl = document.getElementById('call-media-' + peerSid);
      const targetContainer = getActiveVideosContainer();
      if (!mediaEl) {
        // Always use <video> (it plays audio-only streams fine too) so that a
        // video track arriving later (e.g. camera turned on mid-call) always
        // has somewhere to render — an <audio> tag can never show video.
        mediaEl = document.createElement('video');
        mediaEl.id = 'call-media-' + peerSid;
        mediaEl.autoplay = true;
        mediaEl.playsInline = true;
        mediaEl.className = 'call-remote-video';
        targetContainer.appendChild(mediaEl);
      } else if (mediaEl.parentElement !== targetContainer) {
        targetContainer.appendChild(mediaEl);
      }
      if (mediaEl.srcObject !== event.streams[0]) {
        mediaEl.srcObject = event.streams[0];
      }
    };

    callState.peers.set(peerSid, pc);
    return pc;
  }

  function removePeer(peerSid) {
    const pc = callState.peers.get(peerSid);
    if (pc) {
      pc.close();
      callState.peers.delete(peerSid);
    }
    callState.names.delete(peerSid);
    const mediaEl = document.getElementById('call-media-' + peerSid);
    if (mediaEl) mediaEl.remove();
  }

  socket.on('call_participants', async (data) => {
    if (data.room !== callState.room) return;
    for (const p of data.participants) {
      callState.names.set(p.sid, p.name);
      const pc = createPeerConnection(p.sid, data.room);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('call_signal', { room: data.room, to: p.sid, type: 'offer', sdp: offer });
    }
    renderCallParticipants();
  });

  socket.on('call_user_joined', (data) => {
    if (data.room !== callState.room) return;
    callState.names.set(data.sid, data.name);
    renderCallParticipants();
  });

  socket.on('call_user_left', (data) => {
    if (data.room !== callState.room) return;
    removePeer(data.sid);
    renderCallParticipants();
  });

  socket.on('call_signal', async (data) => {
    if (data.room !== callState.room || !callState.localStream) return;
    const peerSid = data.from;

    if (data.type === 'offer') {
      callState.names.set(peerSid, data.fromName || callState.names.get(peerSid) || '?');
      let pc = callState.peers.get(peerSid);
      if (!pc) pc = createPeerConnection(peerSid, data.room);
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('call_signal', { room: data.room, to: peerSid, type: 'answer', sdp: answer });
      renderCallParticipants();
    } else if (data.type === 'answer') {
      const pc = callState.peers.get(peerSid);
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    } else if (data.type === 'ice-candidate') {
      const pc = callState.peers.get(peerSid);
      if (pc && data.candidate) {
        try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (e) {}
      }
    }
  });

  renderTabs();
  updateCallUI();
})();
