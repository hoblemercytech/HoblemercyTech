const CACHE_NAME = 'hmt-admin-v1';
const OFFLINE_PAGE = '/admin.html';

// Files to cache for offline use
const STATIC_ASSETS = [
  '/admin.html',
  'https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
];

// Install — cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('Cache install failed for some assets:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
        .filter(key => key !== CACHE_NAME)
        .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch — network first, fallback to cache, fallback to offline page
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET and Supabase API calls (always need fresh data)
  if (request.method !== 'GET') return;
  if (url.hostname.includes('supabase.co')) return;
  if (url.hostname.includes('resend.com')) return;
  
  event.respondWith(
    fetch(request)
    .then(response => {
      // Cache successful responses
      if (response && response.status === 200 && response.type === 'basic') {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
      }
      return response;
    })
    .catch(() => {
      // Network failed — try cache
      return caches.match(request).then(cached => {
        if (cached) return cached;
        // Last resort — offline page
        if (request.destination === 'document') {
          return caches.match(OFFLINE_PAGE);
        }
      });
    })
  );
});

// Push notifications
self.addEventListener('push', event => {
  if (!event.data) return;
  
  let data = {};
  try { data = event.data.json(); } catch { data = { title: 'HMT Admin', body: event.data.text() }; }
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'HoblemercyTech Admin', {
      body: data.body || 'You have a new notification',
      icon: data.icon || '/icons/icon-192.png',
      badge: data.badge || '/icons/icon-96.png',
      tag: data.tag || 'hmt-notification',
      data: data.url || '/admin.html',
      actions: data.actions || [],
      vibrate: [200, 100, 200],
    })
  );
});

// Notification click — open dashboard
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data || '/admin.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url.includes('admin') && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});