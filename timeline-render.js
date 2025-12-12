// timeline-render.js
// ========================================
// 描画・DOM操作・UI生成
// ========================================

function renderLogs() {
  const container = document.getElementById("logList");
  container.innerHTML = "";
  const session = sessions.find(s => s.id === currentSessionId);
  if (!session) return;

  let prevSeconds = null;

  session.logs.forEach((log, index) => {
    if (!log.typeIds) { log.typeIds = log.typeId ? [log.typeId] : []; }

    const currentSeconds = parseTime(log.time);

    if (prevSeconds !== null && currentSeconds > prevSeconds) {
      const elapsed = currentSeconds - prevSeconds;
      const elapsedDiv = document.createElement('div');
      elapsedDiv.className = 'elapsed-time-display';
      elapsedDiv.innerHTML = `<span>+${elapsed}秒</span>`;
      container.appendChild(elapsedDiv);
    }
    prevSeconds = currentSeconds;

    const item = document.createElement("div");
    item.className = "log-item";
    item.dataset.logId = log.id;

    // --- 上段 ---
    const topRow = document.createElement("div");
    topRow.className = "log-row-top";

    if (editingTimeLogId === log.id) {
      const timeInput = document.createElement("input");
      timeInput.type = "text";
      timeInput.className = "time-edit-input";
      timeInput.value = log.time;
      timeInput.onblur = () => finishEditTime(log.id, timeInput.value);
      timeInput.onkeydown = (e) => { if (e.key === 'Enter') finishEditTime(log.id, timeInput.value); };
      topRow.appendChild(timeInput);
    } else {
      const timeSpan = document.createElement("span");
      timeSpan.className = "log-time";
      timeSpan.textContent = log.time;
      timeSpan.onclick = () => startEditTime(log.id);
      topRow.appendChild(timeSpan);
    }

    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.className = "input-title";
    titleInput.placeholder = "攻撃名";
    titleInput.value = log.title;
    titleInput.oninput = (e) => {
      log.title = e.target.value;
      saveToLocalStorage();
    };

    const memoInput = document.createElement("input");
    memoInput.type = "text";
    memoInput.className = "input-memo";
    memoInput.dataset.logId = log.id;
    memoInput.placeholder = "メモ";
    memoInput.value = log.memo || '';
    memoInput.oninput = (e) => {
      log.memo = e.target.value;
      saveToLocalStorage();
    };

    const attackModeBtn = document.createElement("button");
    attackModeBtn.className = `attack-type-btn ${log.attackMode}-btn`;
    attackModeBtn.innerHTML = `<img src="ff14/${log.attackMode}.png" onerror="this.parentElement.textContent='${log.attackMode==='physical'?'物':log.attackMode==='magical'?'魔':'闇'}'">`;
    attackModeBtn.onclick = () => toggleAttackMode(log.id);

    const dmgInput = document.createElement("input");
    dmgInput.type = "text";
    dmgInput.className = "input-damage";
    dmgInput.placeholder = "Dmg";
    dmgInput.value = log.damage;
    dmgInput.oninput = (e) => {
      log.damage = e.target.value;
      recalculateLog(log);
      saveToLocalStorage();
      renderMitigatedValue(item, log);
    };

    const barrierInput = document.createElement("input");
    barrierInput.type = "text";
    barrierInput.className = "input-barrier";
    barrierInput.placeholder = "バリア量"; // 表記変更
    barrierInput.value = log.barrier;
    barrierInput.oninput = (e) => {
      log.barrier = e.target.value;
      recalculateLog(log);
      saveToLocalStorage();
      renderMitigatedValue(item, log);
    };

    const mitigatedInput = document.createElement("input");
    mitigatedInput.type = "text";
    mitigatedInput.className = `input-mitigated ${getMitigatedClass(log)}`;
    mitigatedInput.placeholder = "軽減後"; // 表記変更
    mitigatedInput.value = log.mitigated;
    mitigatedInput.oninput = (e) => {
      log.mitigated = e.target.value;
      recalculateFromMitigated(log);
      saveToLocalStorage();
      renderMitigatedValue(item, log);
    };

    const hpToggleBtn = document.createElement("button");
    hpToggleBtn.className = "hp-toggle-btn";
    hpToggleBtn.innerHTML = `<img src="ff14/${log.useMaxHp ? 'タンク' : 'ヒーラー'}.png" onerror="this.parentElement.textContent='${log.useMaxHp?'T':'H'}'">`;
    hpToggleBtn.onclick = () => toggleHpReference(log.id);

    const muteBtn = document.createElement("button");
    muteBtn.className = `mute-btn ${log.muted ? 'muted' : ''}`;
    muteBtn.textContent = log.muted ? '🔇' : '🔊';
    muteBtn.onclick = () => toggleMute(log.id);

    topRow.appendChild(titleInput);
    topRow.appendChild(memoInput);
    topRow.appendChild(attackModeBtn);
    topRow.appendChild(dmgInput);
    topRow.appendChild(barrierInput);
    topRow.appendChild(mitigatedInput);
    topRow.appendChild(hpToggleBtn);
    topRow.appendChild(muteBtn);

    // --- 中段 ---
    const midRow = document.createElement("div");
    midRow.className = "log-row-middle";

    const mitigationInfo = document.createElement("div");
    mitigationInfo.className = "mitigation-info";
    updateMitigationInfoDom(mitigationInfo, log);
    midRow.appendChild(mitigationInfo);

    const details = document.createElement("details");
    details.className = "log-details";
    const summary = document.createElement("summary");
    summary.className = "log-summary";
    summary.textContent = "攻撃タイプ変更";
    details.appendChild(summary);

    const keyboardContainer = document.createElement("div");
    keyboardContainer.className = "log-keyboard-grid";

    // ログ内ミニキーボード (QWERT配列)
    const rows = [
      ['single', 'pair', 'stack44', 'role', 'tank'],
      ['stack', 'spread', 'dot', 'unknown', 'gimmick', 'cast_start', 'cast_end'],
      ['stop', 'tower', 'gaze', 'kb', 'burst']
    ];

    rows.forEach(rowIds => {
      const rowDiv = document.createElement("div");
      rowDiv.className = "log-keyboard-row";
      rowIds.forEach(id => {
        const type = attackTypes.find(t => t.id === id);
        if (type) {
          const btn = document.createElement("div");
          const isSelected = log.typeIds.includes(type.id);
          btn.className = `mini-key-btn ${isSelected ? 'selected' : ''}`;
          btn.textContent = type.label; 
          
          btn.onmousedown = (e) => setAttackType(log.id, type.id, e);
          btn.oncontextmenu = (e) => e.preventDefault();
          rowDiv.appendChild(btn);
        }
      });
      keyboardContainer.appendChild(rowDiv);
    });

    details.appendChild(keyboardContainer);
    midRow.appendChild(details);

    // --- 下段 ---
    const btmRow = document.createElement("div");
    btmRow.className = "log-row-bottom";

    const allGroup = document.createElement("div");
    allGroup.className = "mitigation-group";
    const allLabel = document.createElement("div");
    allLabel.className = "mitigation-group-label";
    allLabel.textContent = "全員：";
    allGroup.appendChild(allLabel);
    
    const allContainer = document.createElement("div");
    allContainer.className = "mitigation-container";
    mitigationListAll.forEach(mit => {
      const icon = document.createElement("div");
      const isSelected = log.mitigations.includes(mit.id);
      icon.className = `mit-icon ${isSelected ? 'selected' : ''}`;
      icon.title = mit.name;
      icon.style.backgroundImage = `url('${mit.icon}')`;
      icon.onclick = () => toggleMitigation(log.id, mit.id);
      allContainer.appendChild(icon);
    });
    allGroup.appendChild(allContainer);
    btmRow.appendChild(allGroup);

    const tankGroup = document.createElement("div");
    tankGroup.className = "mitigation-group";
    const tankLabel = document.createElement("div");
    tankLabel.className = "mitigation-group-label";
    tankLabel.textContent = "タンク：";
    tankGroup.appendChild(tankLabel);
    
    const tankContainer = document.createElement("div");
    tankContainer.className = "mitigation-container";
    
    mitigationListTank1.forEach(mit => {
      const icon = document.createElement("div");
      const isSelected = log.mitigations.includes(mit.id);
      icon.className = `mit-icon ${isSelected ? 'selected' : ''}`;
      icon.title = mit.name;
      icon.style.backgroundImage = `url('${mit.icon}')`;
      icon.onclick = () => toggleMitigation(log.id, mit.id);
      tankContainer.appendChild(icon);
    });
    
    const spacer = document.createElement("div");
    spacer.className = "mitigation-spacer";
    tankContainer.appendChild(spacer);
    
    mitigationListTank2.forEach(mit => {
      const icon = document.createElement("div");
      const isSelected = log.mitigations.includes(mit.id);
      icon.className = `mit-icon ${isSelected ? 'selected' : ''}`;
      icon.title = mit.name;
      icon.style.backgroundImage = `url('${mit.icon}')`;
      icon.onclick = () => toggleMitigation(log.id, mit.id);
      tankContainer.appendChild(icon);
    });
    tankGroup.appendChild(tankContainer);
    btmRow.appendChild(tankGroup);

    const btnGroup = document.createElement("div");
    btnGroup.className = "row-btn-group";
    const copyBtn = document.createElement("button");
    copyBtn.className = "row-btn";
    copyBtn.textContent = "コピー";
    copyBtn.onclick = () => copyRow(log.id);
    const delBtn = document.createElement("button");
    delBtn.className = "row-btn btn-row-del";
    delBtn.textContent = "削除";
    delBtn.onclick = () => deleteLog(log.id);

    btnGroup.appendChild(copyBtn);
    btnGroup.appendChild(delBtn);
    btmRow.appendChild(btnGroup);

    item.appendChild(topRow);
    item.appendChild(midRow);
    item.appendChild(btmRow);
    container.appendChild(item);
  });
}

function updateMitigationInfoDom(container, log) {
  container.innerHTML = '';
  
  const rate = calculateMitigationRate(log);
  const rateSpan = document.createElement("span");
  rateSpan.className = "mitigation-rate";
  rateSpan.textContent = `軽減: ${rate}%`;
  container.appendChild(rateSpan);

  const neededMit = calculateNeededMitigation(log);
  if (neededMit !== null && neededMit > 0) {
    const neededSpan = document.createElement("span");
    const mitClass = getMitigatedClass(log);
    neededSpan.className = `mitigation-needed ${mitClass === 'warning' ? 'warning' : ''}`;
    neededSpan.textContent = `あと${neededMit}%必要`;
    container.appendChild(neededSpan);
  }
}

function renderMitigatedValue(item, log) {
  const mitInput = item.querySelector('.input-mitigated');
  const dmgInput = item.querySelector('.input-damage');
  const mitigationInfo = item.querySelector('.mitigation-info');

  if (mitInput) {
    mitInput.value = log.mitigated;
    mitInput.className = `input-mitigated ${getMitigatedClass(log)}`;
  }
  if (dmgInput) {
    dmgInput.value = log.damage;
  }
  if (mitigationInfo) {
    updateMitigationInfoDom(mitigationInfo, log);
  }
}

function updateMitigationInfo(item, log) {
  const mitigationInfo = item.querySelector('.mitigation-info');
  if (mitigationInfo) updateMitigationInfoDom(mitigationInfo, log);
}

function renderTabs() {
  const container = document.getElementById("tabsContainer");
  container.innerHTML = "";
  sessions.forEach((session) => {
    const div = document.createElement("div");
    div.className = `tab ${session.id === currentSessionId ? 'active' : ''}`;
    const status = (session.active && isRunning) ? "● " : "";
    div.textContent = status + session.name;
    div.onclick = () => switchTab(session.id);
    container.appendChild(div);
  });
}

function updateToolbar() {
  const session = sessions.find(s => s.id === currentSessionId);
  const input = document.getElementById("sessionNameInput");
  if (session) {
    input.value = session.name;
    input.disabled = false;
  } else {
    input.value = "";
    input.disabled = true;
  }
}

function renderVoiceLibrary() {
  const list = document.getElementById('voiceList');
  if (!list) return;
  list.innerHTML = '';
  voiceLibrary.forEach(voice => {
    const item = document.createElement('div');
    item.className = 'voice-item';
    item.innerHTML = `
      <span class="voice-item-name">${voice.name}</span>
      <button class="voice-item-play" onclick="playVoice(${voice.id})">▶</button>
      <button class="voice-item-delete" onclick="deleteVoice(${voice.id})">×</button>
    `;
    list.appendChild(item);
  });
}