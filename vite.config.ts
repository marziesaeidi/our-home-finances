import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [{
    name: 'local-offline-shell',
    generateBundle(_options, bundle) {
      const assets = Object.keys(bundle).filter(name => /\.(js|css)$/.test(name));
      const version = assets.join(':');
      // Only cache application code/fonts. Financial exports and API responses never enter CacheStorage.
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: `
const CACHE = ${JSON.stringify('khaneh-shell:' + version)};
const FILES = ${JSON.stringify(['/', ...assets.map(name => '/' + name), ...[400,500,600,700,800].map(w => '/fonts/vazirmatn-' + w + '.ttf')])};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('khaneh-shell:') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.open(CACHE).then(cache => cache.match('/')).then(response => response || Response.error())));
  } else if (FILES.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(url.pathname)).then(response => response || fetch(event.request)));
  }
});` });
    },
  }],
  server:{proxy:{'/api/exchange-rates':'http://127.0.0.1:8788'}},
  preview:{proxy:{'/api/exchange-rates':'http://127.0.0.1:8788'}},
});
