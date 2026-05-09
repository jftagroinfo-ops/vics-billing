const CACHE_NAME = 'jft-erp-cache-v2';
const ASSETS_TO_CACHE = [
  '/',
  'index.html',
  'assets/css/style.css',
  'assets/js/core/db.js',
  'assets/js/core/ui.js',
  'assets/js/core/enterprise.js',
  'assets/js/modules/dashboard.js',
  'assets/js/modules/documents.js',
  'assets/js/modules/finance.js',
  'assets/js/modules/inventory.js',
  'assets/js/modules/logistics.js',
  'assets/js/modules/costing.js',
  'assets/js/modules/tasks.js',
  'assets/js/modules/crm.js',
  'assets/js/modules/attendance.js',
  'assets/js/modules/settings.js',
  'assets/js/modules/reports.js',
  'views/reports.html'
];

// INSTALL: Pre-Cache Core Assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then((cache) => {
            console.log('[ServiceWorker] Pre-caching ERP Shell');
            // Using Promise.allSettled to ensure installation completes even if an asset is missing
            return Promise.allSettled(ASSETS_TO_CACHE.map(url => cache.add(url).catch(e => console.warn('Cache add failed', url))));
        })
        .then(() => self.skipWaiting())
    );
});

// ACTIVATE: Clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[ServiceWorker] Removing old system cache', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    return self.clients.claim();
});

// FETCH: Stale-While-Revalidate Strategy
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    
    // Bypass external firebase databases & APIs
    if (event.request.url.includes('firestore.googleapis.com') || 
        event.request.url.includes('identitytoolkit.googleapis.com') ||
        event.request.url.includes('google.com')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                return cachedResponse;
            });
            
            // Return instant cache, then gracefully update cache in background
            return cachedResponse || fetchPromise;
        })
    );
});
