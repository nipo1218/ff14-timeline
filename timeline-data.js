// timeline-data.js
// ========================================
// データ定義・グローバル変数
// ========================================

// 全員用軽減スキル
const mitigationListAll = [
  { id: 'rep', name: 'リプ', icon: 'ff14/tank/リプライザル.png', value: 0.9, type: 'dealt' },
  { id: 'add', name: 'アドル', icon: 'ff14/dps/アドル.png', physicalValue: 0.95, magicalValue: 0.9, type: 'dealt' },
  { id: 'fnt', name: '牽制', icon: 'ff14/dps/牽制.png', physicalValue: 0.9, magicalValue: 0.95, type: 'dealt' },
  { id: 'pas', name: 'パッセ', icon: 'ff14/tank/パッセ.png', value: 0.85, type: 'taken' },
  { id: 'mis', name: 'ミッショナリー', icon: 'ff14/tank/ミッショナリー.png', physicalValue: 0.95, magicalValue: 0.9, type: 'taken' },
  { id: 'soil', name: '陣', icon: 'ff14/healer/学者/陣.png', value: 0.9, type: 'taken' },
  { id: 'exp', name: '怒涛', icon: 'ff14/healer/学者/怒涛.png', value: 0.9, type: 'taken' },
  { id: 'cu', name: '輪', icon: 'ff14/healer/占星/運命.png', value: 0.9, type: 'taken' },
  { id: 'sam', name: 'サンバ', icon: 'ff14/dps/サンバ.png', value: 0.85, type: 'taken' },
];

// タンク用軽減スキル
const mitigationListTank1 = [
  { id: 'ram1', name: 'ランパ', icon: 'ff14/tank/ランパ.png', value: 0.8, type: 'taken' },
  { id: 'ext', name: 'エクスト', icon: 'ff14/tank/エクスト.png', value: 0.6, type: 'taken' },
  { id: 'blw', name: 'ブルワ', icon: 'ff14/tank/ブルワ.png', value: 1.0, type: 'block' },
  { id: 'shl', name: 'シェルトロン', icon: 'ff14/tank/シェルトロン.png', value: 0.85, type: 'taken' },
];

const mitigationListTank2 = [
  { id: 'ram2', name: 'ランパ', icon: 'ff14/tank/ランパ.png', value: 0.8, type: 'taken' },
  { id: 'vig', name: 'ヴィジル', icon: 'ff14/tank/ヴィジル.png', value: 0.6, type: 'taken' },
  { id: 'mnd', name: 'マインド', icon: 'ff14/tank/マインド.png', physicalValue: 0.9, magicalValue: 0.8, type: 'taken' },
  { id: 'bla', name: 'ブラナイ', icon: 'ff14/tank/ブラナイ.png', barrierType: 'maxhp-percent', barrierPercent: 0.25, type: 'barrier' },
  { id: 'obl', name: 'オブレ', icon: 'ff14/tank/オブレ.png', value: 0.9, type: 'taken' },
];

const allMitigations = [...mitigationListAll, ...mitigationListTank1, ...mitigationListTank2];

// 攻撃タイプの定義 (QWERT配列準拠)
const attackTypes = [
  // Row 1: QWERT
  { id: 'single',    label: '単体',     key: 'Q', damage: 0 },
  { id: 'pair',      label: 'ペア',     key: 'W', damage: 0 },
  { id: 'stack44',   label: '4:4',      key: 'E', damage: 0 },
  { id: 'role',      label: 'ロール',   key: 'R', damage: 0 },
  { id: 'tank',      label: 'タンク強', key: 'T', damage: 0 },

  // Row 2: ASDFG []
  { id: 'stack',     label: '頭割り',   key: 'A', damage: 0 },
  { id: 'spread',    label: '散開',     key: 'S', damage: 0 },
  { id: 'dot',       label: '全体(Dot)',key: 'D', damage: 0 },
  { id: 'unknown',   label: '？？？',   key: 'F', damage: 0 },
  { id: 'gimmick',   label: 'ギミック', key: 'G', damage: 0 },
  { id: 'cast_start',label: '詠唱開始', key: '[', damage: 0 },
  { id: 'cast_end',  label: '詠唱完了', key: ']', damage: 0 },

  // Row 3: ZXCVB
  { id: 'stop',      label: '動作禁止', key: 'Z', damage: 0 }, // 新規追加
  { id: 'tower',     label: '塔踏み',   key: 'X', damage: 0 },
  { id: 'gaze',      label: '視線',     key: 'C', damage: 0 },
  { id: 'kb',        label: 'ノックバック', key: 'V', damage: 0 },
  { id: 'burst',     label: 'バースト', key: 'B', damage: 0 },
  
  // Space
  { id: 'cast_auto', label: '詠唱完了(自動)', key: 'Space', damage: 0 } 
];

// 初期ダメージマッピング（全て0）
const defaultDamage = {};
attackTypes.forEach(t => {
  defaultDamage[t.id] = 0;
});

// ========================================
// グローバル変数
// ========================================
let sessions = [];
let currentSessionId = null;
let timerInterval = null;
let seconds = 0;
let isRunning = false;
let playbackInterval = null;
let playbackSeconds = -5;
let isPlaybackRunning = false;
let globalMuted = true;
let voiceLibrary = [];
let editingTimeLogId = null;