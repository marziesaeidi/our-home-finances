import { defineConfig, loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig(({ mode }) => {
// Same public origin the database server accepts; Vite's preview host check must allow it too.
const { APP_PUBLIC_ORIGIN } = loadEnv(mode, process.cwd(), 'APP_');
const allowedHosts = APP_PUBLIC_ORIGIN ? [new URL(APP_PUBLIC_ORIGIN).hostname] : [];
return {
  resolve: { alias: { '@': decodeURIComponent(new URL('./src', import.meta.url).pathname).replace(/^\/(\w:)/, '$1') } },
  plugins: [tailwindcss(), {
    name: 'local-offline-shell',
    generateBundle(_options, bundle) {
      const assets = Object.keys(bundle).filter(name => /\.(js|css)$/.test(name));
      const version = assets.join(':');
      // Only cache application code/fonts. Financial exports and API responses never enter CacheStorage.
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: `
const CACHE = ${JSON.stringify('khaneh-shell:' + version)};
const FILES = ${JSON.stringify(['/', ...assets.map(name => '/' + name), ...[400,500,600,700,800].map(w => '/fonts/vazirmatn-' + w + '.ttf')])};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))));
self.addEventListener('message', event => { if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting(); });
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('khaneh-shell:') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request, { cache: 'no-cache' }).catch(() => caches.open(CACHE).then(cache => cache.match('/')).then(response => response || Response.error())));
  } else if (FILES.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(url.pathname)).then(response => response || fetch(event.request)));
  }
});` });
    },
  }],
  server:{proxy:{'/api/database':'http://127.0.0.1:8789','/api/exchange-rates':'http://127.0.0.1:8788'}},
  preview:{allowedHosts,proxy:{'/api/database':'http://127.0.0.1:8789','/api/exchange-rates':'http://127.0.0.1:8788'}},
};
});
