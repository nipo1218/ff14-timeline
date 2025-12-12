// timeline-firebase.js
// ========================================
// Firebase初期化・設定
// ========================================

// ⚠️ 以下の設定は自分のFirebaseプロジェクトの値に置き換えてください
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// 管理者のメールアドレス
const ADMIN_EMAIL = "0miyanipo@gmail.com";

// Firebaseの初期化（CDNからロード後に呼び出す）
let db = null;
let auth = null;
let currentUser = null;
let isAdmin = false;
let unsubscribeSnapshot = null;

// 初期化関数
function initFirebase() {
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDK not loaded');
    return;
  }
  
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  auth = firebase.auth();
  
  // 認証状態の監視
  auth.onAuthStateChanged(async (user) => {
    currentUser = user;
    isAdmin = user && user.email === ADMIN_EMAIL;
    
    updateAuthUI();
    
    if (user) {
      console.log('ログイン:', user.email);
      await loadGlobalData();
      subscribeToGlobalChanges();
    } else {
      console.log('未ログイン');
      // 閲覧者モードでもデータはロード
      await loadGlobalData();
      subscribeToGlobalChanges();
    }
    
    renderViewerUI();
  });
}

// Google認証でログイン
async function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    await auth.signInWithPopup(provider);
    showNotification('ログインしました', 'success');
  } catch (error) {
    console.error('ログインエラー:', error);
    showNotification('ログインに失敗しました', 'error');
  }
}

// ログアウト
async function signOut() {
  try {
    await auth.signOut();
    showNotification('ログアウトしました', 'success');
  } catch (error) {
    console.error('ログアウトエラー:', error);
  }
}

// 認証UIの更新
function updateAuthUI() {
  const authBtn = document.getElementById('authBtn');
  const adminBadge = document.getElementById('adminBadge');
  const adminControls = document.querySelectorAll('.admin-only');
  const viewerControls = document.querySelectorAll('.viewer-only');
  
  if (authBtn) {
    if (currentUser) {
      authBtn.textContent = 'ログアウト';
      authBtn.onclick = signOut;
    } else {
      authBtn.textContent = 'Googleでログイン';
      authBtn.onclick = signInWithGoogle;
    }
  }
  
  if (adminBadge) {
    adminBadge.style.display = isAdmin ? 'inline-block' : 'none';
  }
  
  // 管理者専用コントロールの表示切り替え
  adminControls.forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
  });
  
  // 閲覧者専用コントロール
  viewerControls.forEach(el => {
    el.style.display = !isAdmin ? '' : 'none';
  });
}

// ========================================
// Firestoreデータ操作
// ========================================

// グローバルデータの構造
// collections:
//   - global/settings: HP設定、軽減公開設定
//   - global/timeline: 管理者が設定した基本タイムライン
//   - global/voices: ボイスライブラリ

// グローバルデータをロード
async function loadGlobalData() {
  if (!db) return;
  
  try {
    // 設定をロード
    const settingsDoc = await db.collection('global').doc('settings').get();
    if (settingsDoc.exists) {
      const settings = settingsDoc.data();
      globalSettings = settings;
      
      // HP設定を適用（ローカルで上書きされていない場合）
      const localHpData = localStorage.getItem('ff14_timeline_local_hp');
      if (!localHpData) {
        if (settings.minHp) document.getElementById('minHpInput').value = settings.minHp;
        if (settings.maxHp) document.getElementById('maxHpInput').value = settings.maxHp;
      }
    }
    
    // タイムラインをロード
    const timelineDoc = await db.collection('global').doc('timeline').get();
    if (timelineDoc.exists) {
      globalTimeline = timelineDoc.data().logs || [];
    }
    
    // ボイスライブラリをロード
    const voicesDoc = await db.collection('global').doc('voices').get();
    if (voicesDoc.exists) {
      globalVoiceLibrary = voicesDoc.data().voices || [];
      renderVoiceLibrary();
    }
    
  } catch (error) {
    console.error('データロードエラー:', error);
  }
}

// リアルタイム変更の購読
function subscribeToGlobalChanges() {
  if (!db || unsubscribeSnapshot) return;
  
  // タイムラインの変更を監視
  unsubscribeSnapshot = db.collection('global').doc('timeline')
    .onSnapshot((doc) => {
      if (doc.exists) {
        globalTimeline = doc.data().logs || [];
        mergeAndRenderTimeline();
      }
    });
}

// 管理者：タイムラインを保存
async function saveGlobalTimeline() {
  if (!isAdmin || !db) {
    showNotification('管理者のみ保存できます', 'error');
    return;
  }
  
  const session = sessions.find(s => s.id === currentSessionId);
  if (!session) return;
  
  try {
    await db.collection('global').doc('timeline').set({
      logs: session.logs,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: currentUser.email
    });
    showNotification('タイムラインを保存しました', 'success');
  } catch (error) {
    console.error('保存エラー:', error);
    showNotification('保存に失敗しました', 'error');
  }
}

// 管理者：設定を保存
async function saveGlobalSettings() {
  if (!isAdmin || !db) return;
  
  try {
    await db.collection('global').doc('settings').set({
      minHp: document.getElementById('minHpInput').value,
      maxHp: document.getElementById('maxHpInput').value,
      showMitigations: document.getElementById('showMitigationsToggle')?.checked ?? true,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showNotification('設定を保存しました', 'success');
  } catch (error) {
    console.error('設定保存エラー:', error);
  }
}

// 管理者：ボイスを追加
async function addGlobalVoice(voiceData) {
  if (!isAdmin || !db) return;
  
  try {
    const voicesRef = db.collection('global').doc('voices');
    const doc = await voicesRef.get();
    const voices = doc.exists ? (doc.data().voices || []) : [];
    voices.push(voiceData);
    
    await voicesRef.set({ voices, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    globalVoiceLibrary = voices;
    renderVoiceLibrary();
    showNotification('ボイスを追加しました', 'success');
  } catch (error) {
    console.error('ボイス追加エラー:', error);
  }
}

// グローバル変数
let globalSettings = {
  minHp: '',
  maxHp: '',
  showMitigations: true
};
let globalTimeline = [];
let globalVoiceLibrary = [];
