/* global importScripts, firebase */
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Basic offline caching for PWA
const CACHE_NAME = 'placement-pwa-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/logo192.png',
  '/logo512.png',
  '/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Navigation requests: App Shell fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/offline.html'))
    );
    return;
  }

  const url = new URL(request.url);
  // Bypass cross-origin and dynamic API calls
  if (url.origin !== self.location.origin) return;

  // Stale-while-revalidate for same-origin GETs
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});

// Initialize Firebase for background messaging (must be hardcoded in SW)
firebase.initializeApp({
  apiKey: "AIzaSyAJuJ8DKdnn75WgvyXnKV3PJwp4BbwMvCc",
  authDomain: "trail-f142f.firebaseapp.com",
  projectId: "trail-f142f",
  storageBucket: "trail-f142f.firebasestorage.app",
  messagingSenderId: "472625893135",
  appId: "1:472625893135:web:0096c358c7589df975f87a",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Background message received:', payload);
  
  const notificationTitle = payload.notification?.title || 'Placement Update';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: payload.notification?.icon || '/logo192.png',
    badge: '/favicon.ico',
    data: payload.data || {},
    tag: payload.data?.notificationId || 'placement-notification',
    requireInteraction: true, // Keep notification visible until user interacts
    silent: false,
    vibrate: [200, 100, 200], // Vibration pattern for mobile
    actions: [
      {
        action: 'view',
        title: 'View',
        icon: '/logo192.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };
  
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function (event) {
  console.log('Notification clicked:', event);
  event.notification.close();
  
  if (event.action === 'dismiss') {
    // Just close the notification
    return;
  }
  
  // Handle view action or default click
  const url = event.notification?.data?.actionLink || 
              event.notification?.data?.url || 
              '/student/notifications';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window/tab open with our app
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          // Navigate to the notification URL
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            url: url
          });
          return client;
        }
      }
      // If no existing window, open a new one
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Handle notification action clicks
self.addEventListener('notificationaction', function(event) {
  console.log('Notification action clicked:', event.action);
  
  if (event.action === 'view') {
    event.notification.close();
    const url = event.notification?.data?.actionLink || '/student/notifications';
    
    event.waitUntil(
      clients.openWindow(url)
    );
  } else if (event.action === 'dismiss') {
    event.notification.close();
  }
});

