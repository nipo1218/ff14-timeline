// timeline-timer.js
// ========================================
// コアロジック: タイマー, 計算, 音声認識, ショートカット
// ========================================

document.addEventListener('DOMContentLoaded', () => {
  loadFromLocalStorage();
  if (sessions.length === 0) {
    createNewSession();
  }
  
  renderTabs();
  renderLogs();
  updateToolbar();
  renderVoiceLibrary();
  
  const voiceFileInput = document.getElementById('voiceFileInput');
  if (voiceFileInput) {
    voiceFileInput.addEventListener('change', handleVoiceFileSelect);
  }

  setupKeyboardShortcuts();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('data:application/javascript,' + encodeURIComponent(`
      self.addEventListener('fetch', function(event) { event.respondWith(fetch(event.request)); });
    `)).catch(() => {});
  }
});

// ========================================
// 音声認識 (Web Speech API)
// ========================================
let recognition = null;
let isMicListening = false;

// 音声コマンド用マッピング (正規表現 -> スキルID)
const voiceSkillMap = [
  { regex: /リプ|リプライザル/, id: 'rep' },
  { regex: /アドル/, id: 'add' },
  { regex: /けんせい|牽制/, id: 'fnt' },
  { regex: /パッセ|パッセージ/, id: 'pas' },
  { regex: /ミッショ|ミッショナリー/, id: 'mis' },
  { regex: /じん|陣|野戦/, id: 'soil' },
  { regex: /どとう|疾風|怒涛/, id: 'exp' },
  { regex: /うんめい|運命|輪/, id: 'cu' },
  { regex: /サンバ|タクティシャン|守りの/, id: 'sam' },
  { regex: /ランパ|ランパート/, id: 'ram1' }, // 便宜上ram1 (両対応はロジックで吸収推奨だが今回は簡易)
  { id: 'ram2', regex: /ランパ|ランパート/ }, // 重複許容
  { regex: /エクス|エクスト/, id: 'ext' },
  { regex: /ブルワ|ブルワーク/, id: 'blw' },
  { regex: /シェルトロン/, id: 'shl' },
  { regex: /ヴィジル/, id: 'vig' },
  { regex: /マインド|ダークマインド/, id: 'mnd' },
  { regex: /ブラナイ|ブラックナイト/, id: 'bla' },
  { regex: /オブレ|オベーション/, id: 'obl' }
];

function toggleMic() {
  const btn = document.getElementById('micBtn');
  if (isMicListening) {
    stopMic();
    return;
  }
  startMic();
}

function startMic() {
  const btn = document.getElementById('micBtn');
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("このブラウザは音声認識に対応していません(Chrome推奨)");
    return;
  }

  if (!recognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = () => {
      isMicListening = true;
      if(btn) btn.classList.add('listening');
      showNotification('マイクON: お話しください', 'success');
    };

    recognition.onend = () => {
      if (isMicListening) {
        recognition.start(); // 自動再開
      } else {
        if(btn) btn.classList.remove('listening');
      }
    };

    recognition.onresult = (event) => {
      const last = event.results.length - 1;
      const transcript = event.results[last][0].transcript;
      if (transcript) {
        processVoiceInput(transcript);
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      if (event.error === 'not-allowed') {
        stopMic();
        alert("マイクの使用が許可されていません");
      }
    };
  }

  try {
    recognition.start();
  } catch(e) { /* already started */ }
}

function stopMic() {
  isMicListening = false;
  if (recognition) recognition.stop();
  const btn = document.getElementById('micBtn');
  if(btn) btn.classList.remove('listening');
  showNotification('マイクOFF', 'success');
}

function processVoiceInput(text) {
  const session = sessions.find(s => s.id === currentSessionId);
  if (!session || session.logs.length === 0) return;
  const targetLog = session.logs[session.logs.length - 1];

  let isSkillDetected = false;

  // スキル検知
  voiceSkillMap.forEach(item => {
    if (item.regex.test(text)) {
      // まだONになっていなければONにする
      if (!targetLog.mitigations.includes(item.id)) {
        targetLog.mitigations.push(item.id);
        isSkillDetected = true;
        showNotification(`音声検知: ${item.id === 'rep' ? 'リプライザル' : item.id}`, 'success');
      }
    }
  });

  if (isSkillDetected) {
    recalculateLog(targetLog);
    renderLogs();
    saveToLocalStorage();
  } else {
    // スキルでなければメモに追記
    writeToLatestMemo(text, targetLog);
  }
}

function writeToLatestMemo(text, targetLog) {
  if (targetLog.memo) {
    targetLog.memo += " " + text;
  } else {
    targetLog.memo = text;
  }

  saveToLocalStorage();
  
  const input = document.querySelector(`.input-memo[data-log-id="${targetLog.id}"]`);
  if (input) {
    input.value = targetLog.memo;
    input.classList.add('updated');
    setTimeout(() => input.classList.remove('updated'), 1000);
  } else {
    renderLogs();
  }
}


// ========================================
// ショートカット & テンキー
// ========================================
let damageInputBuffer = '';
let damageInputTimer = null;

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (e.repeat) return;

    // 数字キー
    if (/^\d$/.test(e.key)) {
      handleDamageInput(e.key);
      return;
    }

    // リセット (.)
    if (e.key === '.') {
      resetDamageInput();
      return;
    }

    // 属性切り替え
    if (e.key === '/') { setLatestAttackMode('physical'); highlightLastLog(); return; }
    if (e.key === '*') { setLatestAttackMode('magical'); highlightLastLog(); return; }
    if (e.key === '-') { setLatestAttackMode('darkness'); highlightLastLog(); return; }

    // Shift / Alt
    if (e.key === 'Shift') {
      e.preventDefault();
      recordSpecialCast(-10);
      highlightLastLog();
      return;
    }
    if (e.key === 'Alt') {
      e.preventDefault();
      recordSpecialCast(-5);
      highlightLastLog();
      return;
    }

    const key = e.key.toLowerCase();
    const keyMap = {
      'q': 'single', 'w': 'pair', 'e': 'stack44', 'r': 'role', 't': 'tank',
      'a': 'stack', 's': 'spread', 'd': 'dot', 'f': 'unknown', 'g': 'gimmick',
      '[': 'cast_start', ']': 'cast_end',
      'z': 'stop', 'x': 'tower', 'c': 'gaze', 'v': 'kb', 'b': 'burst',
      ' ': 'cast_auto'
    };

    if (keyMap[e.key] || keyMap[key]) {
      e.preventDefault();
      const typeId = keyMap[e.key] || keyMap[key];
      if (typeId === 'cast_auto') recordSpecialCast(-3);
      else recordTap(typeId);
      highlightLastLog();
    }
  });
}

function setLatestAttackMode(mode) {
  const session = sessions.find(s => s.id === currentSessionId);
  if (!session || session.logs.length === 0) return;
  const targetLog = session.logs[session.logs.length - 1];
  targetLog.attackMode = mode;
  recalculateLog(targetLog);
  renderLogs();
  saveToLocalStorage();
  showNotification(`属性変更: ${mode==='physical'?'物理':mode==='magical'?'魔法':'無属性'}`, 'success');
}

function handleDamageInput(digit) {
  damageInputBuffer += digit;

  if (damageInputTimer) clearTimeout(damageInputTimer);
  damageInputTimer = setTimeout(() => { damageInputBuffer = ''; }, 1000);

  if (damageInputBuffer.length > 3) {
    damageInputBuffer = damageInputBuffer.slice(-3);
  }

  applyDamageFromBuffer();
}

function resetDamageInput() {
  damageInputBuffer = '';
  if (damageInputTimer) clearTimeout(damageInputTimer);
  applyZeroDamage();
}

function applyDamageFromBuffer() {
  const session = sessions.find(s => s.id === currentSessionId);
  if (!session || session.logs.length === 0) return;
  const targetLog = session.logs[session.logs.length - 1];
  const val = parseInt(damageInputBuffer, 10);
  const damageVal = val * 1000;
  targetLog.damage = damageVal.toString();
  recalculateLog(targetLog);
  renderLogs();
  saveToLocalStorage();
  showNotification(`ダメージ: ${damageVal.toLocaleString()}`, 'success');
}

function applyZeroDamage() {
  const session = sessions.find(s => s.id === currentSessionId);
  if (!session || session.logs.length === 0) return;
  const targetLog = session.logs[session.logs.length - 1];
  targetLog.damage = '0';
  recalculateLog(targetLog);
  renderLogs();
  saveToLocalStorage();
  showNotification(`ダメージリセット: 0`, 'success');
}

// ========================================
// タイマー / 記録ロジック
// ========================================

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  createNewSession();
  seconds = 0;
  isRunning = true;
  document.getElementById("timer").textContent = "00:00";
  document.getElementById("timer").className = 'running';
  timerInterval = setInterval(() => {
    seconds++;
    updateTimerDisplay();
  }, 1000);
  
  if(!isMicListening) startMic();

  renderTabs(); renderLogs(); updateToolbar();
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  isRunning = false;
  document.getElementById("timer").className = '';
  saveToLocalStorage();
}

function updateTimerDisplay() {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  document.getElementById("timer").textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function recordTap(typeId) {
  if (!sessions[0]?.active && isRunning) {
    currentSessionId = sessions[0].id;
    renderTabs(); updateToolbar();
  }
  const activeSession = sessions[0];
  if (!activeSession) { createNewSession(); return recordTap(typeId); }

  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const timeStr = `${m}:${s.toString().padStart(2, '0')}`;
  const typeObj = attackTypes.find(t => t.id === typeId) || attackTypes[0];

  activeSession.logs.push({
    id: Date.now(),
    time: timeStr,
    title: typeObj.label,
    memo: '',
    typeIds: [typeId],
    damage: '0', barrier: '', mitigated: '', mitigations: [],
    attackMode: 'magical', useMaxHp: typeId === 'tank', muted: true, voiceId: null
  });

  renderLogs();
  saveToLocalStorage();
}

function recordSpecialCast(offsetSeconds) {
  if (!sessions[0]?.active && isRunning) {
    currentSessionId = sessions[0].id;
    renderTabs(); updateToolbar();
  }
  const activeSession = sessions[0];
  if (!activeSession) { createNewSession(); return recordSpecialCast(offsetSeconds); }

  recordTap('cast_end');
  const targetSeconds = seconds + offsetSeconds;
  const timeStr = formatSecondsToTime(targetSeconds);
  const typeStart = attackTypes.find(t => t.id === 'cast_start');

  activeSession.logs.push({
    id: Date.now() + 1,
    time: timeStr,
    title: typeStart.label,
    memo: '',
    typeIds: ['cast_start'],
    damage: '0', barrier: '', mitigated: '', mitigations: [],
    attackMode: 'magical', useMaxHp: false, muted: true, voiceId: null
  });
  sortLogs();
  renderLogs();
  saveToLocalStorage();
  showNotification(`自動記録: 詠唱開始(${offsetSeconds}s)`, 'success');
}

function recordSpecialCastSpace() {
  recordSpecialCast(-3);
}

// ========================================
// 計算ロジック
// ========================================

function recalculateLog(log) {
  const baseDamage = parseFloat(log.damage);
  if (isNaN(baseDamage) || baseDamage < 0) { log.mitigated = ''; return; }
  
  let barrier = parseFloat(log.barrier) || 0;
  const maxHp = parseFloat(document.getElementById('maxHpInput').value) || 0;
  
  log.mitigations.forEach(mitId => {
    const mit = allMitigations.find(m => m.id === mitId);
    if (mit && mit.barrierType === 'maxhp-percent' && maxHp > 0) {
      barrier += Math.floor(maxHp * mit.barrierPercent);
    }
  });

  let totalMitigation = 1.0;
  const attackType = log.attackMode;
  let hasRep=false, hasFeint=false, hasAddle=false;
  
  log.mitigations.forEach(mitId => {
    const mit = allMitigations.find(m => m.id === mitId);
    if (!mit || mit.barrierType === 'maxhp-percent') return;

    if (mitId === 'rep' && !hasRep) { hasRep = true; totalMitigation *= mit.value; }
    else if (mitId === 'fnt' && !hasFeint) { hasFeint = true; totalMitigation *= (attackType === 'physical' ? mit.physicalValue : mit.magicalValue); }
    else if (mitId === 'add' && !hasAddle) { hasAddle = true; totalMitigation *= (attackType === 'magical' ? mit.magicalValue : mit.physicalValue); }
    else if (!['rep','fnt','add'].includes(mitId)) {
      if (mit.value) totalMitigation *= mit.value;
      else if (mit.physicalValue && attackType === 'physical') totalMitigation *= mit.physicalValue;
      else if (mit.magicalValue && attackType === 'magical') totalMitigation *= mit.magicalValue;
    }
  });

  let damage = baseDamage * totalMitigation;
  damage = Math.max(0, damage - barrier);
  log.mitigated = Math.floor(damage).toString();
}

function recalculateFromMitigated(log) {
  const mitigated = parseFloat(log.mitigated);
  if (isNaN(mitigated)) return;
  
  let barrier = parseFloat(log.barrier) || 0;
  const maxHp = parseFloat(document.getElementById('maxHpInput').value) || 0;
  
  log.mitigations.forEach(mitId => {
    const mit = allMitigations.find(m => m.id === mitId);
    if (mit && mit.barrierType === 'maxhp-percent' && maxHp > 0) {
      barrier += Math.floor(maxHp * mit.barrierPercent);
    }
  });

  let totalMitigation = 1.0;
  const attackType = log.attackMode;
  let hasRep=false, hasFeint=false, hasAddle=false;

  log.mitigations.forEach(mitId => {
    const mit = allMitigations.find(m => m.id === mitId);
    if (!mit || mit.barrierType === 'maxhp-percent') return;
    if (mitId === 'rep' && !hasRep) { hasRep = true; totalMitigation *= mit.value; }
    else if (mitId === 'fnt' && !hasFeint) { hasFeint=true; totalMitigation *= (attackType==='physical'?mit.physicalValue:mit.magicalValue); }
    else if (mitId === 'add' && !hasAddle) { hasAddle=true; totalMitigation *= (attackType==='magical'?mit.magicalValue:mit.physicalValue); }
    else if (!['rep','fnt','add'].includes(mitId)) {
      if(mit.value) totalMitigation*=mit.value;
      else if(mit.physicalValue && attackType==='physical') totalMitigation*=mit.physicalValue;
      else if(mit.magicalValue && attackType==='magical') totalMitigation*=mit.magicalValue;
    }
  });

  const baseDamage = (mitigated + barrier) / totalMitigation;
  log.damage = Math.ceil(baseDamage).toString();
}

function calculateMitigationRate(log) {
  let totalMitigation = 1.0;
  const attackType = log.attackMode;
  let hasRep=false, hasFeint=false, hasAddle=false;
  
  log.mitigations.forEach(mitId => {
    const mit = allMitigations.find(m => m.id === mitId);
    if (!mit || mit.barrierType === 'maxhp-percent') return;
    if (mitId === 'rep' && !hasRep) { hasRep = true; totalMitigation *= mit.value; }
    else if (mitId === 'fnt' && !hasFeint) { hasFeint=true; totalMitigation *= (attackType==='physical'?mit.physicalValue:mit.magicalValue); }
    else if (mitId === 'add' && !hasAddle) { hasAddle=true; totalMitigation *= (attackType==='magical'?mit.magicalValue:mit.physicalValue); }
    else if (!['rep','fnt','add'].includes(mitId)) {
      if(mit.value) totalMitigation*=mit.value;
    }
  });
  return Math.round((1 - totalMitigation) * 100);
}

function calculateNeededMitigation(log) {
  if (!log.mitigated) return null;
  const hp = log.useMaxHp 
    ? (parseFloat(document.getElementById('maxHpInput').value) || 0)
    : (parseFloat(document.getElementById('minHpInput').value) || 0);
  if (hp <= 0) return null;
  const mitigated = parseFloat(log.mitigated);
  if (mitigated < hp) return null;
  
  const baseDamage = parseFloat(log.damage) || 0;
  if (baseDamage <= 0) return null;
  
  const currentRate = calculateMitigationRate(log);
  const targetDamage = hp - 1;
  let barrier = parseFloat(log.barrier) || 0;
  
  const maxHp = parseFloat(document.getElementById('maxHpInput').value) || 0;
  log.mitigations.forEach(mitId => {
    const mit = allMitigations.find(m => m.id === mitId);
    if (mit && mit.barrierType === 'maxhp-percent' && maxHp > 0) {
      barrier += Math.floor(maxHp * mit.barrierPercent);
    }
  });
  
  const targetBeforeBarrier = targetDamage + barrier;
  const neededMitigation = 1 - (targetBeforeBarrier / baseDamage);
  const neededPercent = Math.ceil(neededMitigation * 100);
  
  return neededPercent - currentRate;
}

// Helpers
function getMitigatedClass(log) {
  if (!log.mitigated) return '';
  const hp = log.useMaxHp ? (parseFloat(document.getElementById('maxHpInput').value) || 0) : (parseFloat(document.getElementById('minHpInput').value) || 0);
  if (hp <= 0) return '';
  const val = parseFloat(log.mitigated);
  if (val >= hp) return 'danger';
  if (val >= hp * 0.8) return 'warning';
  return 'safe';
}

function parseTime(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  return parts.length === 2 ? parseInt(parts[0]) * 60 + parseInt(parts[1]) : 0;
}

function formatSecondsToTime(totalSeconds) {
  const isNegative = totalSeconds < 0;
  const absSec = Math.abs(totalSeconds);
  const m = Math.floor(absSec / 60);
  const s = absSec % 60;
  return `${isNegative ? '-' : ''}${m}:${s.toString().padStart(2, '0')}`;
}

function highlightLastLog() {
  setTimeout(() => {
    const list = document.getElementById('logList');
    if(list.lastElementChild) {
      list.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      list.lastElementChild.style.backgroundColor = '#332';
      setTimeout(() => list.lastElementChild.style.backgroundColor = '', 200);
    }
  }, 50);
}

// CRUD / UI helpers
function setAttackType(logId, typeId, event) {
  if (event && event.type === 'contextmenu') event.preventDefault();
  const session = sessions.find(s => s.id === currentSessionId);
  if (!session) return;
  const log = session.logs.find(l => l.id === logId);
  if (!log) return;
  if (!log.typeIds) log.typeIds = [log.typeId || 'aoe_l'];
  const isMulti = (event && (event.ctrlKey || event.metaKey || event.button === 2));
  if (isMulti) {
    if (log.typeIds.includes(typeId)) { if (log.typeIds.length > 1) log.typeIds = log.typeIds.filter(id => id !== typeId); }
    else log.typeIds.push(typeId);
  } else { log.typeIds = [typeId]; }
  const labels = log.typeIds.map(id => { const t = attackTypes.find(at => at.id === id); return t ? t.label : ''; });
  log.title = labels.join(' or ');
  recalculateLog(log);
  renderLogs();
  saveToLocalStorage();
}

function toggleMitigation(logId, mitId) {
  const session = sessions.find(s => s.id === currentSessionId);
  if (!session) return;
  const log = session.logs.find(l => l.id === logId);
  if (log) {
    if (log.mitigations.includes(mitId)) log.mitigations = log.mitigations.filter(id => id !== mitId);
    else log.mitigations.push(mitId);
    recalculateLog(log);
  }
  renderLogs(); saveToLocalStorage();
}

function updateLogDataDirect(logId, field, value) {
  const session = sessions.find(s => s.id === currentSessionId);
  if (!session) return;
  const log = session.logs.find(l => l.id === logId);
  if (log) {
    log[field] = value;
    if (field === 'damage' || field === 'barrier') recalculateLog(log);
    else if (field === 'mitigated') recalculateFromMitigated(log);
    if (field === 'time') { sortLogs(); renderLogs(); }
  }
  saveToLocalStorage();
}

function toggleAttackMode(logId) {
  const session = sessions.find(s => s.id === currentSessionId);
  const log = session.logs.find(l => l.id === logId);
  if (log) {
    if (log.attackMode === 'magical') log.attackMode = 'physical';
    else if (log.attackMode === 'physical') log.attackMode = 'darkness';
    else log.attackMode = 'magical';
    recalculateLog(log);
  }
  renderLogs(); saveToLocalStorage();
}

function toggleHpReference(logId) {
  const session = sessions.find(s => s.id === currentSessionId);
  const log = session.logs.find(l => l.id === logId);
  if (log) { log.useMaxHp = !log.useMaxHp; recalculateLog(log); }
  renderLogs(); saveToLocalStorage();
}

function toggleMute(logId) {
  const session = sessions.find(s => s.id === currentSessionId);
  const log = session.logs.find(l => l.id === logId);
  if (log) log.muted = !log.muted;
  renderLogs(); saveToLocalStorage();
}

function deleteLog(logId) {
  const session = sessions.find(s => s.id === currentSessionId);
  if (!session) return;
  session.logs = session.logs.filter(log => log.id !== logId);
  renderLogs(); saveToLocalStorage();
}

function startEditTime(logId) { editingTimeLogId = logId; renderLogs(); setTimeout(() => { document.querySelector('.time-edit-input')?.focus(); }, 10); }
function finishEditTime(logId, newTime) { editingTimeLogId = null; updateLogDataDirect(logId, 'time', newTime); }
function sortLogs() {
  const session = sessions.find(s => s.id === currentSessionId);
  if (session) session.logs.sort((a, b) => parseTime(a.time) - parseTime(b.time));
}

function saveToLocalStorage() {
  const data = { sessions, currentSessionId, minHp: document.getElementById('minHpInput').value, maxHp: document.getElementById('maxHpInput').value, voiceLibrary, prefix: document.getElementById('defaultPrefixInput').value };
  localStorage.setItem('ff14_timeline_data', JSON.stringify(data));
}
function loadFromLocalStorage() {
  const savedData = localStorage.getItem('ff14_timeline_data');
  if (!savedData) return;
  try {
    const data = JSON.parse(savedData);
    sessions = data.sessions || [];
    currentSessionId = data.currentSessionId || (sessions[0]?.id);
    if(data.minHp) document.getElementById('minHpInput').value = data.minHp;
    if(data.maxHp) document.getElementById('maxHpInput').value = data.maxHp;
    voiceLibrary = data.voiceLibrary || [];
    if(data.prefix) document.getElementById('defaultPrefixInput').value = data.prefix;
  } catch(e) {}
}
function createNewSession() {
  if (sessions.length >= 10) sessions.pop();
  const now = new Date();
  const sessionName = `${document.getElementById('defaultPrefixInput').value||"煉獄4層"} #${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getDate().toString().padStart(2,'0')}`;
  const newSession = { id: Date.now(), active: true, name: sessionName, logs: [] };
  sessions.unshift(newSession);
  currentSessionId = newSession.id;
}
function updateSessionName(newName) {
  const session = sessions.find(s => s.id === currentSessionId);
  if (session) { session.name = newName; renderTabs(); saveToLocalStorage(); }
}
function deleteCurrentSession() {
  if (!confirm("現在のタブ（記録）を完全に削除しますか？")) return;
  sessions = sessions.filter(s => s.id !== currentSessionId);
  if (sessions.length > 0) currentSessionId = sessions[0].id;
  else { stopTimer(); document.getElementById("timer").textContent = "00:00"; createNewSession(); isRunning = false; }
  renderTabs(); renderLogs(); updateToolbar(); saveToLocalStorage();
}
function switchTab(sessionId) { currentSessionId = sessionId; renderTabs(); renderLogs(); updateToolbar(); }
function updateToolbar() {
  const session = sessions.find(s => s.id === currentSessionId);
  const input = document.getElementById("sessionNameInput");
  if (session) { input.value = session.name; input.disabled = false; } else { input.value = ""; input.disabled = true; }
}
function showNotification(message, type = 'success') {
  const existing = document.querySelector('.notification');
  if (existing) existing.remove();
  const notif = document.createElement('div');
  notif.className = `notification notification-${type}`;
  notif.textContent = message;
  document.body.appendChild(notif);
  setTimeout(() => notif.classList.add('show'), 10);
  setTimeout(() => { notif.classList.remove('show'); setTimeout(() => notif.remove(), 300); }, 2500);
}