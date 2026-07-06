/*
 * Service worker: deja la app usable sin conexion cuando esta publicada en
 * internet (los choferes en supermercados con mala senal). Estrategia:
 * red primero y, si falla, la copia guardada.
 */
'use strict';

const CACHE = 'minis-reparto-v1.3.1';
const ARCHIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/supabase-config.js',
  './js/sync.js',
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
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((resp) => {
        const copia = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copia));
        return resp;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html')))
  );
});
