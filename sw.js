/* 서비스워커 — 앱 껍데기 캐시로 오프라인/빠른 로딩 지원 (온라인이면 항상 최신) */
const CACHE = 'busan-diary-v2';
const ASSETS = [
  './', './index.html', './css/style.css',
  './js/ui.js', './js/mascots.js', './js/store.js',
  './js/map.js', './js/map-kakao.js', './js/calendar.js', './js/entry.js', './js/app.js',
  './manifest.webmanifest', './assets/favicon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // 지도/폰트 CDN은 네트워크에 맡김
  e.respondWith(
    fetch(req)
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
  );
});
