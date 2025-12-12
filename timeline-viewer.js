// timeline-viewer.js
// ========================================
// 閲覧者向けビュー機能
// ========================================

// ローカル変更を管理
let localChanges = {};
let localHpSettings = { minHp: '', maxHp: '' };

// 閲覧者UIをレンダリング
function renderViewerUI() {
  // 管理者モードの場合は既存UIを使用
  if (isAdmin) {
    renderLogs();
    return;
  }
  
  // 閲覧者モードではコンパクトUIを使用
  renderViewerLogs();
  loadLocalSettings();
}

// 閲覧者向けログリストをレンダリング
function renderViewerLogs() {
  const container = document.getElementById("logList");
  if (!container) return;
  container.innerHTML = "";
  
  // グローバルタイムラインとローカル変更をマージ
  const mergedLogs = getMergedLogs();
  
  if (mergedLogs.length === 0) {
    container.innerHTML = '<div class="no-logs">タイムラインがありません</div>';
    return;
  }
  
  let prevSeconds = null;
  
  mergedLogs.forEach((log, index) => {
    const currentSeconds = parseTime(log.time);
    
    // 経過時間表示
    if (prevSeconds !== null && currentSeconds > prevSeconds) {
      const elapsed = currentSeconds - prevSeconds;
      const elapsedDiv = document.createElement('div');
      elapsedDiv.className = 'elapsed-time-display';
      elapsedDiv.innerHTML = `<span>+${elapsed}秒</span>`;
      container.appendChild(elapsedDiv);
    }
    prevSeconds = currentSeconds;
    
    const item = document.createElement("div");
    item.className = "log-item viewer-log-item";
    item.dataset.logId = log.id;
    
    // --- コンパクト上段（時間・タイトル・メモ） ---
    const topRow = document.createElement("div");
    topRow.className = "log-row-top viewer-row-top";
    
    const timeSpan = document.createElement("span");
    timeSpan.className = "log-time";
    timeSpan.textContent = log.time;
    topRow.appendChild(timeSpan);
    
    const titleSpan = document.createElement("span");
    titleSpan.className = "log-title-display";
    titleSpan.textContent = log.title || '---';
    topRow.appendChild(titleSpan);
    
    const memoSpan = document.createElement("span");
    memoSpan.className = "log-memo-display";
    memoSpan.textContent = log.memo || '';
    topRow.appendChild(memoSpan);
    
    // 通知ミュートボタン
    const notifBtn = document.createElement("button");
    notifBtn.className = `notification-row-btn ${log.muted ? 'muted' : ''}`;
    notifBtn.textContent = log.muted ? '🔕' : '🔔';
    notifBtn.onclick = () => toggleViewerMute(log.id);
    topRow.appendChild(notifBtn);
    
    item.appendChild(topRow);
    
    // --- 軽減表示（公開されている場合のみ） ---
    if (globalSettings.showMitigations) {
      const mitRow = document.createElement("div");
      mitRow.className = "log-row-middle viewer-mit-row";
      
      // 軽減率表示
      const rate = calculateMitigationRate(log);
      const rateSpan = document.createElement("span");
      rateSpan.className = "mitigation-rate";
      rateSpan.textContent = `軽減: ${rate}%`;
      mitRow.appendChild(rateSpan);
      
      // 軽減アイコン（クリック可能）
      const mitContainer = document.createElement("div");
      mitContainer.className = "viewer-mit-container";
      
      mitigationListAll.forEach(mit => {
        const icon = document.createElement("div");
        const isSelected = log.mitigations && log.mitigations.includes(mit.id);
        icon.className = `mit-icon viewer-mit-icon ${isSelected ? 'selected' : ''}`;
        icon.title = mit.name;
        icon.style.backgroundImage = `url('${mit.icon}')`;
        icon.onclick = () => toggleViewerMitigation(log.id, mit.id);
        mitContainer.appendChild(icon);
      });
      
      mitRow.appendChild(mitContainer);
      item.appendChild(mitRow);
      
      // ダメージ入力欄（編集可能）
      const dmgRow = document.createElement("div");
      dmgRow.className = "log-row-damage viewer-dmg-row";
      
      const dmgInput = document.createElement("input");
      dmgInput.type = "text";
      dmgInput.className = "input-damage viewer-input";
      dmgInput.placeholder = "Dmg";
      dmgInput.value = log.damage || '';
      dmgInput.oninput = (e) => updateViewerLogField(log.id, 'damage', e.target.value);
      dmgRow.appendChild(dmgInput);
      
      const mitigatedInput = document.createElement("input");
      mitigatedInput.type = "text";
      mitigatedInput.className = `input-mitigated viewer-input ${getMitigatedClass(log)}`;
      mitigatedInput.placeholder = "軽減後";
      mitigatedInput.value = log.mitigated || '';
      mitigatedInput.readOnly = true;
      dmgRow.appendChild(mitigatedInput);
      
      item.appendChild(dmgRow);
    }
    
    // --- リセットボタン ---
    const btnRow = document.createElement("div");
    btnRow.className = "log-row-bottom viewer-btn-row";
    
    const resetBtn = document.createElement("button");
    resetBtn.className = "viewer-reset-btn";
    resetBtn.textContent = "リセット";
    resetBtn.onclick = () => resetViewerLog(log.id);
    btnRow.appendChild(resetBtn);
    
    item.appendChild(btnRow);
    container.appendChild(item);
  });
}

// グローバルとローカルをマージしたログを取得
function getMergedLogs() {
  // グローバルタイムラインをベースにする
  const merged = globalTimeline.map(log => {
    const localChange = localChanges[log.id];
    if (localChange) {
      return { ...log, ...localChange };
    }
    return { ...log };
  });
  
  // ローカルで追加したログを追加
  const localAddedLogs = Object.values(localChanges).filter(change => change._isLocalAdded);
  merged.push(...localAddedLogs);
  
  // 時間順にソート
  merged.sort((a, b) => parseTime(a.time) - parseTime(b.time));
  
  return merged;
}

// マージしてレンダリング
function mergeAndRenderTimeline() {
  if (isAdmin) {
    // 管理者モードでは従来のレンダリング
    const session = sessions.find(s => s.id === currentSessionId);
    if (session) {
      session.logs = globalTimeline;
    }
    renderLogs();
  } else {
    renderViewerLogs();
  }
}

// 閲覧者：軽減トグル
function toggleViewerMitigation(logId, mitId) {
  if (!localChanges[logId]) {
    const originalLog = globalTimeline.find(l => l.id === logId);
    localChanges[logId] = { ...originalLog };
  }
  
  const log = localChanges[logId];
  if (!log.mitigations) log.mitigations = [];
  
  if (log.mitigations.includes(mitId)) {
    log.mitigations = log.mitigations.filter(id => id !== mitId);
  } else {
    log.mitigations.push(mitId);
  }
  
  recalculateViewerLog(log);
  saveLocalChanges();
  renderViewerLogs();
}

// 閲覧者：ミュートトグル
function toggleViewerMute(logId) {
  if (!localChanges[logId]) {
    const originalLog = globalTimeline.find(l => l.id === logId);
    localChanges[logId] = { ...originalLog };
  }
  
  localChanges[logId].muted = !localChanges[logId].muted;
  saveLocalChanges();
  renderViewerLogs();
}

// 閲覧者：フィールド更新
function updateViewerLogField(logId, field, value) {
  if (!localChanges[logId]) {
    const originalLog = globalTimeline.find(l => l.id === logId);
    localChanges[logId] = { ...originalLog };
  }
  
  localChanges[logId][field] = value;
  
  if (field === 'damage') {
    recalculateViewerLog(localChanges[logId]);
  }
  
  saveLocalChanges();
}

// 閲覧者：ログを初期状態にリセット
function resetViewerLog(logId) {
  delete localChanges[logId];
  saveLocalChanges();
  renderViewerLogs();
  showNotification('リセットしました', 'success');
}

// 閲覧者：ログの再計算
function recalculateViewerLog(log) {
  if (!log.damage) return;
  
  let totalMitigation = 1.0;
  const attackType = log.attackMode || 'magical';
  
  if (log.mitigations) {
    log.mitigations.forEach(mitId => {
      const mit = allMitigations.find(m => m.id === mitId);
      if (!mit) return;
      
      if (mit.type === 'barrier') return;
      
      if (mit.value) {
        totalMitigation *= mit.value;
      } else if (attackType === 'physical' && mit.physicalValue) {
        totalMitigation *= mit.physicalValue;
      } else if (attackType === 'magical' && mit.magicalValue) {
        totalMitigation *= mit.magicalValue;
      }
    });
  }
  
  const baseDamage = parseFloat(log.damage) || 0;
  let barrier = parseFloat(log.barrier) || 0;
  
  // バリア計算
  if (log.mitigations) {
    const maxHp = parseFloat(localHpSettings.maxHp || document.getElementById('maxHpInput').value) || 0;
    log.mitigations.forEach(mitId => {
      const mit = allMitigations.find(m => m.id === mitId);
      if (mit && mit.barrierType === 'maxhp-percent' && maxHp > 0) {
        barrier += Math.floor(maxHp * mit.barrierPercent);
      }
    });
  }
  
  log.mitigated = Math.ceil(baseDamage * totalMitigation - barrier);
}

// ========================================
// 手動タイムライン追加機能
// ========================================

function showAddTimelineModal() {
  const modal = document.getElementById('addTimelineModal');
  if (modal) {
    modal.classList.add('show');
    document.getElementById('newTimeMinutes').value = '0';
    document.getElementById('newTimeSeconds').value = '00';
    document.getElementById('newTimeTitle').value = '';
    document.getElementById('newTimeMemo').value = '';
  }
}

function hideAddTimelineModal() {
  const modal = document.getElementById('addTimelineModal');
  if (modal) {
    modal.classList.remove('show');
  }
}

function addManualTimeline() {
  const minutes = document.getElementById('newTimeMinutes').value || '0';
  const seconds = document.getElementById('newTimeSeconds').value || '00';
  const title = document.getElementById('newTimeTitle').value || '';
  const memo = document.getElementById('newTimeMemo').value || '';
  
  const time = `${minutes}:${seconds.padStart(2, '0')}`;
  
  const newLog = {
    id: Date.now(),
    time: time,
    title: title,
    memo: memo,
    damage: '',
    barrier: '',
    mitigated: '',
    mitigations: [],
    attackMode: 'magical',
    useMaxHp: false,
    muted: false,
    typeIds: [],
    _isLocalAdded: true
  };
  
  if (isAdmin) {
    // 管理者の場合はセッションに追加
    const session = sessions.find(s => s.id === currentSessionId);
    if (session) {
      session.logs.push(newLog);
      session.logs.sort((a, b) => parseTime(a.time) - parseTime(b.time));
      saveToLocalStorage();
      renderLogs();
    }
  } else {
    // 閲覧者の場合はローカルに追加
    localChanges[newLog.id] = newLog;
    saveLocalChanges();
    renderViewerLogs();
  }
  
  hideAddTimelineModal();
  showNotification('タイムラインを追加しました', 'success');
}

// ========================================
// ローカルストレージ操作
// ========================================

function saveLocalChanges() {
  localStorage.setItem('ff14_timeline_local_changes', JSON.stringify(localChanges));
}

function loadLocalChanges() {
  const saved = localStorage.getItem('ff14_timeline_local_changes');
  if (saved) {
    try {
      localChanges = JSON.parse(saved);
    } catch (e) {
      localChanges = {};
    }
  }
}

function saveLocalHpSettings() {
  localHpSettings = {
    minHp: document.getElementById('minHpInput').value,
    maxHp: document.getElementById('maxHpInput').value
  };
  localStorage.setItem('ff14_timeline_local_hp', JSON.stringify(localHpSettings));
}

function loadLocalSettings() {
  // ローカル変更をロード
  loadLocalChanges();
  
  // HP設定をロード
  const savedHp = localStorage.getItem('ff14_timeline_local_hp');
  if (savedHp) {
    try {
      localHpSettings = JSON.parse(savedHp);
      if (localHpSettings.minHp) document.getElementById('minHpInput').value = localHpSettings.minHp;
      if (localHpSettings.maxHp) document.getElementById('maxHpInput').value = localHpSettings.maxHp;
    } catch (e) {}
  }
}

// HP入力のイベントリスナー（閲覧者用）
document.addEventListener('DOMContentLoaded', () => {
  const minHpInput = document.getElementById('minHpInput');
  const maxHpInput = document.getElementById('maxHpInput');
  
  if (minHpInput) {
    minHpInput.addEventListener('change', () => {
      if (!isAdmin) saveLocalHpSettings();
    });
  }
  
  if (maxHpInput) {
    maxHpInput.addEventListener('change', () => {
      if (!isAdmin) saveLocalHpSettings();
    });
  }
});
