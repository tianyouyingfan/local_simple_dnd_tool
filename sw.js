const CACHE_NAME = 'dnd-assist-v0.5.1-modular-structure';

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

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
