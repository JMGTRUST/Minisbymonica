/*
 * Service worker: deja la app usable sin conexion cuando esta publicada en
 * internet (los choferes en supermercados con mala senal).
 */
'use strict';

const CACHE = 'minis-reparto-v1.3';
const ARCHIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/util.js',
  './js/seed.js',
  './js/store.js',
  './js/panel.js',
  './js/despacho.js',
  './js/visitas.js',
  './js/config.js',
  './js/datos.js',
  './js/ayuda.js',
  './js/app.js',
  './icono.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;

  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((resp) => (resp.ok ? resp : Promise.reject(new Error(`HTTP ${resp.status}`))))
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Los recursos versionados de la app salen de caché al instante. Una nueva
  // versión de CACHE los renueva al instalarse. Nunca devolvemos HTML para JS/CSS.
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(
      (guardado) =>
        guardado ||
        fetch(e.request).then((resp) => {
          if (resp.ok) {
            const copia = resp.clone();
            e.waitUntil(caches.open(CACHE).then((c) => c.put(e.request, copia)));
          }
          return resp;
        })
    )
  );
});
