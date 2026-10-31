// Service worker : met l'application en cache pour qu'elle fonctionne hors connexion.
// Il ne voit jamais les notes (elles sont dans le localStorage chiffré, pas dans des requêtes réseau).
const CACHE = 'journal-emotions-v19';   // même numéro que APP_VERSION dans index.html
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './communes.txt'];

// cache:'reload' : va chercher les vrais fichiers, pas la copie que le navigateur garde 10 minutes
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(a => new Request(a, {cache:'reload'})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Cache d'abord, puis mise à jour en arrière-plan (stale-while-revalidate)
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const hit = await cache.match(req, {ignoreSearch: true});
    const net = fetch(req.url, {cache:'no-cache'}).then(async res => { if (res.ok) await cache.put(req, res.clone()); return res; }).catch(() => hit);
    e.waitUntil(net);
    return hit || net;
  }));
});
