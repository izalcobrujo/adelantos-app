const CACHE    = 'adelantos-v2';
const BASE     = '/adelantos-app';

const ASSETS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/adelantos-app.jsx',
  BASE + '/manifest.json',
  BASE + '/icon-192.png',
  BASE + '/icon-512.png',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone@7.23.5/babel.min.js',
  'https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap',
];

// Instalar: cachear todo
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(ASSETS.map(url => cache.add(url).catch(() => {})))
    )
  );
  self.skipWaiting();
});

// Activar: borrar caches viejos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Nunca interceptar el backup en la nube
  if (url.includes('script.google.com')) return;

  // CDN (React, Babel, fuentes) → cache-first
  if (url.includes('unpkg.com') || url.includes('fonts.g')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(event.request, res.clone()));
          return res;
        });
      })
    );
    return;
  }

  // Archivos locales → network-first, fallback a caché
  event.respondWith(
    fetch(event.request)
      .then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(event.request, res.clone()));
        return res;
      })
      .catch(() =>
        caches.match(event.request)
          .then(cached => cached || caches.match(BASE + '/index.html'))
      )
  );
});
