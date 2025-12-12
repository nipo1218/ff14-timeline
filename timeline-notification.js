// timeline-notification.js
// ========================================
// PWA通知機能
// ========================================

let notificationEnabled = true;
let notificationPermission = 'default';

// 通知の初期化
async function initNotifications() {
  if (!('Notification' in window)) {
    console.log('このブラウザは通知をサポートしていません');
    return;
  }
  
  notificationPermission = Notification.permission;
  
  if (notificationPermission === 'default') {
    // 初回は許可を求める
    const permission = await Notification.requestPermission();
    notificationPermission = permission;
  }
  
  updateNotificationUI();
}

// 通知UIの更新
function updateNotificationUI() {
  const btn = document.getElementById('notificationToggleBtn');
  if (!btn) return;
  
  if (notificationEnabled && notificationPermission === 'granted') {
    btn.textContent = '🔔';
    btn.classList.remove('disabled');
    btn.title = '通知ON';
  } else {
    btn.textContent = '🔕';
    btn.classList.add('disabled');
    btn.title = '通知OFF';
  }
}

// 通知のON/OFF切り替え
async function toggleNotification() {
  if (notificationPermission !== 'granted') {
    const permission = await Notification.requestPermission();
    notificationPermission = permission;
    if (permission !== 'granted') {
      showNotification('通知が許可されていません', 'error');
      return;
    }
  }
  
  notificationEnabled = !notificationEnabled;
  localStorage.setItem('ff14_notification_enabled', notificationEnabled);
  updateNotificationUI();
  
  showNotification(notificationEnabled ? '通知をONにしました' : '通知をOFFにしました', 'success');
}

// タイムライン通知を送信
function sendTimelineNotification(log) {
  if (!notificationEnabled || notificationPermission !== 'granted') return;
  if (log.muted) return; // ミュートされている場合はスキップ
  
  const title = log.title || 'タイムライン通知';
  const body = log.memo ? `${log.time} - ${log.memo}` : log.time;
  
  try {
    const notification = new Notification(title, {
      body: body,
      icon: '/ff14/icon.png',
      badge: '/ff14/badge.png',
      tag: `timeline-${log.id}`,
      requireInteraction: false,
      silent: false
    });
    
    // 3秒後に自動で閉じる
    setTimeout(() => notification.close(), 3000);
  } catch (error) {
    console.error('通知エラー:', error);
  }
}

// -5秒カウント用の通知スケジューラー
let scheduledNotifications = [];

function scheduleNotifications(logs, startTime) {
  // 既存のスケジュールをクリア
  clearScheduledNotifications();
  
  const now = Date.now();
  
  logs.forEach(log => {
    if (log.muted) return;
    
    const logSeconds = parseTime(log.time);
    const triggerTime = startTime + (logSeconds * 1000);
    const delay = triggerTime - now;
    
    if (delay > 0) {
      const timeoutId = setTimeout(() => {
        sendTimelineNotification(log);
      }, delay);
      
      scheduledNotifications.push(timeoutId);
    }
  });
}

function clearScheduledNotifications() {
  scheduledNotifications.forEach(id => clearTimeout(id));
  scheduledNotifications = [];
}

// Service Worker登録
async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker登録成功:', registration.scope);
    } catch (error) {
      console.error('Service Worker登録失敗:', error);
    }
  }
}

// 初期化時に通知設定を読み込む
document.addEventListener('DOMContentLoaded', () => {
  const savedEnabled = localStorage.getItem('ff14_notification_enabled');
  if (savedEnabled !== null) {
    notificationEnabled = savedEnabled === 'true';
  }
  initNotifications();
  registerServiceWorker();
});
