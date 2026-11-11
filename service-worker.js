// Sayfa (HTML) isteklerinde "önce ağ" stratejisi kullanılır: internet varsa her zaman en güncel
// sürüm gelir, yalnızca çevrimdışıyken önbellekteki kopya gösterilir. Böylece eski sürümün
// takılı kalması sorunu yaşanmaz.
const CACHE_NAME = 'tt-fitness-cache-v3';
const FILES_TO_CACHE = [
  './index.html',
  './manifest.json',
  './privacy-policy.html',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './fonts/fonts.css',
  './fonts/ibm-plex-sans-latin-400-normal.woff2',
  './fonts/ibm-plex-sans-latin-500-normal.woff2',
  './fonts/ibm-plex-sans-latin-600-normal.woff2',
  './fonts/ibm-plex-sans-latin-700-normal.woff2',
  './fonts/ibm-plex-sans-latin-ext-400-normal.woff2',
  './fonts/ibm-plex-sans-latin-ext-500-normal.woff2',
  './fonts/ibm-plex-sans-latin-ext-600-normal.woff2',
  './fonts/ibm-plex-sans-latin-ext-700-normal.woff2',
  './fonts/oswald-latin-500-normal.woff2',
  './fonts/oswald-latin-600-normal.woff2',
  './fonts/oswald-latin-700-normal.woff2',
  './fonts/oswald-latin-ext-500-normal.woff2',
  './fonts/oswald-latin-ext-600-normal.woff2',
  './fonts/oswald-latin-ext-700-normal.woff2',
  './vendor/firebase-app-compat.js',
  './vendor/firebase-auth-compat.js',
  './vendor/firebase-firestore-compat.js',
  './vendor/firebase-storage-compat.js',
  './vendor/jspdf.umd.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Tek bir dosya eksik olsa bile kurulum tamamen başarısız olmasın
      Promise.all(FILES_TO_CACHE.map((f) => cache.add(f).catch(() => null)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Firebase / CDN gibi dış istekler önbelleğe alınmaz, doğrudan ağa gider
  if (url.origin !== self.location.origin) return;

  const isPage = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isPage) {
    // Önce ağ, olmazsa önbellek
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match('./index.html')))
    );
    return;
  }

  // Diğer statik dosyalar (ikon, manifest): önbellek varsa onu ver, arka planda güncelle
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
