const CACHE_NAME = 'dnd-assist-v0.5.5-statblock-layout';

const SCOPE = self.registration?.scope || new URL('./', self.location).toString();
const SCOPE_URL = new URL(SCOPE);
const SCOPE_PATH = SCOPE_URL.pathname;
const INDEX_URL = new URL('index.html', SCOPE).toString();
const toCacheUrl = (path) => new URL(path, SCOPE).toString();
const toScopeRelativePath = (pathname) => {
  if (!pathname.startsWith(SCOPE_PATH)) return null;
  const rel = pathname.slice(SCOPE_PATH.length);
  if (!rel) return 'index.html';
  if (rel === '/') return 'index.html';
  return rel.startsWith('/') ? rel.slice(1) : rel;
};

const urlsToCache = [
  'index.html',
  'style.css',
  'manifest.json',
  'icon.ico',
  'icon-192.png',
  'icon-512.png',
  'js/main.js',
  'js/vendor/vue.js',
  'js/vendor/dexie.js',
  'js/modules/domain/battle/conditions.js',
  'js/modules/app/keyboard-shortcuts.js',
  'js/modules/app/ui-layers.js',
  'js/modules/composables/use-computed.js',
  'js/modules/composables/use-image-cropper.js',
  'js/modules/composables/use-toasts.js',
  'js/modules/domain/battle/action-execution.js',
  'js/modules/domain/battle/battle-core.js',
  'js/modules/domain/battle/hp-status.js',
  'js/modules/domain/battle/quick-dice.js',
  'js/modules/domain/battle/targeting.js',
  'js/modules/domain/entities/actor-viewer.js',
  'js/modules/domain/entities/cr-adjustment.js',
  'js/modules/domain/entities/entity-crud.js',
  'js/modules/domain/entities/ui-toggles.js',
  'js/modules/domain/groups/monster-groups.js',
  'js/modules/infra/persistence/data-loader.js',
  'js/modules/infra/persistence/db.js',
  'js/modules/infra/persistence/import-export.js',
  'js/modules/media/image-cropper.js',
  'js/modules/shared/helpers.js',
  'js/modules/shared/statblock.js',
  'js/modules/shared/utils.js',
  'js/modules/state/constants.js',
  'js/modules/state/state.js'
].map(toCacheUrl);

const LEGACY_MODULE_ALIASES = {
  'js/modules/helpers.js': 'js/modules/shared/helpers.js',
  'js/modules/utils.js': 'js/modules/shared/utils.js',
  'js/modules/use-toasts.js': 'js/modules/composables/use-toasts.js',
  'js/modules/use-computed.js': 'js/modules/composables/use-computed.js',
  'js/modules/use-image-cropper.js': 'js/modules/composables/use-image-cropper.js',
  'js/modules/data-loader.js': 'js/modules/infra/persistence/data-loader.js',
  'js/modules/import-export.js': 'js/modules/infra/persistence/import-export.js',
  'js/modules/ui-toggles.js': 'js/modules/domain/entities/ui-toggles.js',
  'js/modules/image-cropper.js': 'js/modules/media/image-cropper.js',
  'js/modules/actor-viewer.js': 'js/modules/domain/entities/actor-viewer.js',
  'js/modules/entity-crud.js': 'js/modules/domain/entities/entity-crud.js',
  'js/modules/cr-adjustment.js': 'js/modules/domain/entities/cr-adjustment.js',
  'js/modules/battle-core.js': 'js/modules/domain/battle/battle-core.js',
  'js/modules/hp-status.js': 'js/modules/domain/battle/hp-status.js',
  'js/modules/targeting.js': 'js/modules/domain/battle/targeting.js',
  'js/modules/action-execution.js': 'js/modules/domain/battle/action-execution.js',
  'js/modules/quick-dice.js': 'js/modules/domain/battle/quick-dice.js',
  'js/modules/monster-groups.js': 'js/modules/domain/groups/monster-groups.js',
  'js/modules/keyboard-shortcuts.js': 'js/modules/app/keyboard-shortcuts.js',
};

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      const required = new Set([
        toCacheUrl('index.html'),
        toCacheUrl('style.css'),
        toCacheUrl('js/main.js'),
        toCacheUrl('js/vendor/vue.js'),
        toCacheUrl('js/vendor/dexie.js'),
      ]);

      const results = await Promise.allSettled(
        urlsToCache.map(async (url) => {
          await cache.add(url);
          return url;
        })
      );

      const failedRequired = [];
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status === 'fulfilled') continue;
        const url = urlsToCache[i];
        if (required.has(url)) failedRequired.push(url);
      }
      if (failedRequired.length) {
        throw new Error(`SW install failed: required assets not cached (${failedRequired.length})`);
      }
    })()
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

async function networkFirst(request, cacheKey = request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(cacheKey, response.clone());
      return response;
    }
    const cached = await cache.match(cacheKey);
    return cached || response;
  } catch (_) {
    const cached = await cache.match(cacheKey);
    return cached || new Response('Offline', {
      status: 504,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const rel = toScopeRelativePath(url.pathname);
  if (rel == null) return;

  if (event.request.mode === 'navigate' || rel === 'index.html') {
    event.respondWith(networkFirst(INDEX_URL, INDEX_URL));
    return;
  }

  const alias = LEGACY_MODULE_ALIASES[rel];
  if (alias) {
    event.respondWith(
      networkFirst(toCacheUrl(alias), toCacheUrl(alias))
    );
    return;
  }

  event.respondWith(
    networkFirst(event.request)
  );
});
