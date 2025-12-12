// sw.js - Service Worker for PWA
// ========================================

const CACHE_NAME = 'ff14-timeline-v1';
const urlsToCache = [
  '/',
  '/timeline.html',
  '/timeline-style.css',
  '/timeline-data.js',
  '/timeline-render.js',
  '/timeline-timer.js',
  '/timeline-discord.js',
  '/timeline-firebase.js',
  '/timeline-notification.js',
  '/timeline-viewer.js'
];

// インストール時にキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('キャッシュを開きました');
        return cache.addAll(urlsToCache);
      })
      .catch((err) => {
        console.log('キャッシュエラー:', err);
      })
  );
  self.skipWaiting();
});

// アクティベート時に古いキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// フェッチ時にキャッシュを優先（オフライン対応）
self.addEventListener('fetch', (event) => {
  // Firebaseリクエストはキャッシュしない
  if (event.request.url.includes('firebase') || 
      event.request.url.includes('googleapis') ||
      event.request.url.includes('firestore')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

// プッシュ通知の受信（将来の拡張用）
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'タイムライン通知';
  const options = {
    body: data.body || '',
    icon: '/ff14/icon.png',
    badge: '/ff14/badge.png',
    tag: data.tag || 'timeline-notification'
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// 通知クリック時の処理
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // 既存のウィンドウがあればフォーカス
        for (const client of clientList) {
          if (client.url.includes('timeline') && 'focus' in client) {
            return client.focus();
          }
        }
        // なければ新しいウィンドウを開く
        if (clients.openWindow) {
          return clients.openWindow('/timeline.html');
        }
      })
  );
});
