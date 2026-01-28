/* sw.js - fixed for Cloudflare Pages redirected navigation responses */

const CACHE_NAME = 'dnd-assist-v0.5.6-statblock-layout'; // 建议改个新版本，避免旧缓存影响

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
  'js/modules/state/state.js',
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

// 尝试获取“非 redirected”的最终响应：如果发生了 redirect，就用 response.url 再拉一次
async function fetchNoRedirected(input, init) {
  let res = await fetch(input, init);

  // 最多再尝试几次，避免极端情况下循环跳转
  for (let i = 0; i < 3 && res && res.redirected; i++) {
    res = await fetch(res.url, init);
  }

  return res;
}

async function putIfCacheable(cache, key, response) {
  // 只缓存 ok 且非 redirected 的响应
  if (response && response.ok && !response.redirected) {
    await cache.put(key, response.clone());
    return true;
  }
  return false;
}

self.addEventListener('install', (event) => {
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
          // 预缓存也尽量避免把 redirected 的响应写进 cache
          const res = await fetchNoRedirected(url);
          if (!res || !res.ok) throw new Error(`Precache failed: ${url} status=${res?.status}`);
          // 用“原始 url”作为 cache key（你原来的逻辑也是这样）
          await cache.put(url, res.clone());
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

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

async function networkFirst(request, cacheKey = request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const res = await fetchNoRedirected(request);

    // 注意：即使 res.ok，但 res.redirected===true 也不缓存，避免后续拿到“重定向结果”
    await putIfCacheable(cache, cacheKey, res);

    const cached = await cache.match(cacheKey);
    return cached || res;
  } catch (_) {
    const cached = await cache.match(cacheKey);
    return (
      cached ||
      new Response('Offline', {
        status: 504,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    );
  }
}

async function handleNavigate(event) {
  const cache = await caches.open(CACHE_NAME);

  try {
    // 关键改动：导航请求优先用“用户正在访问的 URL”去拉，避免强制 fetch /index.html 触发规范化跳转
    let res = await fetchNoRedirected(event.request);

    // 如果仍然是 redirected，强制用最终 URL 再拉一次（fetchNoRedirected 已经做了多次尝试）
    if (res && res.redirected) {
      res = await fetchNoRedirected(res.url);
    }

    if (res && res.ok && !res.redirected) {
      // 导航统一缓存到 INDEX_URL，离线回退稳定
      await cache.put(INDEX_URL, res.clone());
      return res;
    }

    // 如果网络返回的是 redirected 或非 ok，就退回缓存的 index
    const cachedIndex = await cache.match(INDEX_URL);
    return cachedIndex || res;
  } catch (_) {
    const cachedIndex = await cache.match(INDEX_URL);
    return (
      cachedIndex ||
      new Response('Offline', {
        status: 504,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    );
  }
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const rel = toScopeRelativePath(url.pathname);
  if (rel == null) return;

  // 导航请求（包含 "/"）走专用逻辑，避免 redirected response 被用于 respondWith(navigate)
  if (event.request.mode === 'navigate' || rel === 'index.html') {
    event.respondWith(handleNavigate(event));
    return;
  }

  const alias = LEGACY_MODULE_ALIASES[rel];
  if (alias) {
    const u = toCacheUrl(alias);
    event.respondWith(networkFirst(u, u));
    return;
  }

  event.respondWith(networkFirst(event.request));
});
