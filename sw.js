const CACHE_NAME = 'dnd-assist-v0.5.4-condition-system';

const urlsToCache = [
  '/',
  'index.html',
  'style.css',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'js/main.js',
  'js/vendor/vue.js',
  'js/vendor/dexie.js',
  'js/modules/domain/battle/conditions.js',
  'js/modules/app/keyboard-shortcuts.js',
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
  'js/modules/shared/utils.js',
  'js/modules/state/constants.js',
  'js/modules/state/state.js'
];

const LEGACY_MODULE_ALIASES = {
  '/js/modules/helpers.js': 'js/modules/shared/helpers.js',
  '/js/modules/utils.js': 'js/modules/shared/utils.js',
  '/js/modules/use-toasts.js': 'js/modules/composables/use-toasts.js',
  '/js/modules/use-computed.js': 'js/modules/composables/use-computed.js',
  '/js/modules/use-image-cropper.js': 'js/modules/composables/use-image-cropper.js',
  '/js/modules/data-loader.js': 'js/modules/infra/persistence/data-loader.js',
  '/js/modules/import-export.js': 'js/modules/infra/persistence/import-export.js',
  '/js/modules/ui-toggles.js': 'js/modules/domain/entities/ui-toggles.js',
  '/js/modules/image-cropper.js': 'js/modules/media/image-cropper.js',
  '/js/modules/actor-viewer.js': 'js/modules/domain/entities/actor-viewer.js',
  '/js/modules/entity-crud.js': 'js/modules/domain/entities/entity-crud.js',
  '/js/modules/cr-adjustment.js': 'js/modules/domain/entities/cr-adjustment.js',
  '/js/modules/battle-core.js': 'js/modules/domain/battle/battle-core.js',
  '/js/modules/hp-status.js': 'js/modules/domain/battle/hp-status.js',
  '/js/modules/targeting.js': 'js/modules/domain/battle/targeting.js',
  '/js/modules/action-execution.js': 'js/modules/domain/battle/action-execution.js',
  '/js/modules/quick-dice.js': 'js/modules/domain/battle/quick-dice.js',
  '/js/modules/monster-groups.js': 'js/modules/domain/groups/monster-groups.js',
  '/js/modules/keyboard-shortcuts.js': 'js/modules/app/keyboard-shortcuts.js',
};

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
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
    }
    return response;
  } catch (_) {
    return cache.match(cacheKey);
  }
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const isIndex = url.pathname === '/' || url.pathname.endsWith('/index.html');
  if (event.request.mode === 'navigate' || isIndex) {
    event.respondWith(
      networkFirst(event.request)
    );
    return;
  }

  const alias = LEGACY_MODULE_ALIASES[url.pathname];
  if (alias) {
    event.respondWith(
      networkFirst(alias, alias)
    );
    return;
  }

  event.respondWith(
    networkFirst(event.request)
  );
});
