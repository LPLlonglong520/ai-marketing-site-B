/* 安恒营销 AI 站点 · 方案 B · Service Worker
 *
 * 与主站同一套策略，独立缓存命名空间（ams-b-）：
 *   - HTML 导航 / 图片 / 字体：stale-while-revalidate
 *   - 视频(mp4)：不接管（交给浏览器原生缓存，避免 Range 206 冲突）
 *   - 跨域请求：不接管
 *
 * 版本：V = 本方案 10 个页面内容的 md5 前 12 位。
 */
const V = 'e7e9e90af6b0';
const PREFIX = 'ams-b-';
const CACHE = PREFIX + V;

const PRECACHE = [
  './index.html',
  './digital-employee.html',
  './future.html',
  './scene-1.html',
  './scene-2.html',
  './scene-3.html',
  './scene-4.html',
  './scene-5.html',
  './scene-6.html',
  './scene-7.html'
];

/* 首页空闲时预热的高频图片（存在才预热，下面 install 里逐个 try） */
const WARM = [
  './media/de_board_front_1x.webp',
  './media/de_board_front_1x.avif',
  './media/de_board_back_1x.webp',
  './media/de_board_back_1x.avif',
  './media/eco_board_1x.webp',
  './media/eco_board_1x.avif',
  './media/de_char_body.webp',
  './media/de_char_b_body.webp'
];

let opening = null;
function cache() {
  if (!opening) opening = caches.open(CACHE);
  return opening;
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await cache();
    await Promise.all(PRECACHE.map(async (u) => {
      try { await c.add(new Request(u, { cache: 'reload' })); } catch (err) {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    const mine = keys.filter((k) => k.indexOf(PREFIX) === 0);
    const hadOld = mine.some((k) => k !== CACHE);
    await Promise.all(mine.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
    if (hadOld) {
      const cs = await self.clients.matchAll({ type: 'window' });
      cs.forEach((cl) => cl.postMessage({ type: 'updated', v: V }));
    }
  })());
});

self.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.type === 'warm') {
    e.waitUntil((async () => {
      const c = await cache();
      await Promise.all(WARM.map(async (u) => {
        try { if (!(await c.match(u))) await c.add(new Request(u, { cache: 'reload' })); } catch (err) {}
      }));
    })());
  }
});

async function swr(req) {
  const c = await cache();
  const hit = await c.match(req);
  const net = fetch(req).then((r) => {
    if (r && r.ok && r.type === 'basic') {
      const cp = r.clone();
      c.put(req, cp).catch(() => {});
    }
    return r;
  });
  if (hit) {
    net.catch(() => {});
    return hit;
  }
  try {
    const r = await net;
    if (r) return r;
  } catch (err) {}
  return new Response('', { status: 504, statusText: 'offline' });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.slice(-4) === '.mp4') return;
  e.respondWith(swr(req));
});
