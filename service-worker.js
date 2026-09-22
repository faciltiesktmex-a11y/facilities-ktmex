/* ============================================================
   KTMEX Facilities — Service Worker
   Versión: v9-8.6.0-20260921

   Cambios respecto a la versión anterior:
   1. El archivo debe publicarse como "service-worker.js".
      Servido como .txt el navegador lo rechaza por MIME type y
      la PWA nunca se registra.
   2. Los assets pasan de "cache-first sin revalidar" a
      stale-while-revalidate: se responde al instante desde caché
      y en segundo plano se descarga la versión nueva. Antes un
      icono o el manifest quedaban congelados hasta cambiar CACHE.
   3. Se ignoran explícitamente las peticiones al backend de
      Apps Script para que nunca queden cacheadas.
   4. Soporte de SKIP_WAITING para actualizar sin cerrar la app.
   ============================================================ */

const CACHE = 'ktmex-facilities-v9-8.6.0-20260921';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(APP_SHELL.map(u => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Permite forzar la activación de una versión nueva desde la app.
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // El backend (script.google.com) nunca se cachea.
  if (url.hostname.indexOf('script.google.com') >= 0 ||
      url.hostname.indexOf('googleusercontent.com') >= 0) return;

  if (url.origin !== self.location.origin) return;

  // Navegación: red primero, caché como respaldo sin conexión.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(r => {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy));
          return r;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // Assets: stale-while-revalidate.
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req)
        .then(r => {
          if (r && r.ok) {
            const copy = r.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return r;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
