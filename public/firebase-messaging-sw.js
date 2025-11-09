// Web Push API Service Worker for Supabase

// 处理推送消息
self.addEventListener('push', (event) => {
  console.log('Received push message:', event);

  let data = {};
  if (event.data) {
    data = event.data.json();
  }

  const options = {
    body: data.body || '您有新的消息',
    icon: '/img/icons/android-chrome-192x192.png',
    badge: '/img/icons/badge-72x72.png',
    tag: 'time-tracking-notification',
    requireInteraction: false,
    data: data
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '打卡系统通知', options)
  );
});

// 处理通知点击
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 如果已有打开的窗口,聚焦到该窗口
      for (const client of clientList) {
        if (client.url.includes('/') && 'focus' in client) {
          return client.focus();
        }
      }
      // 否则打开新窗口
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// 处理service worker安装
self.addEventListener('install', (event) => {
  console.log('Service Worker installing.');
  self.skipWaiting();
});

// 处理service worker激活
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating.');
  event.waitUntil(clients.claim());
});
