/* PlayGoLite service worker: makes the site work offline.
   - Pages: network first (so a new deploy shows straight away), cached copy when offline.
   - Build files under /_next/static and the neural network runtime under /ort: cache first.
   - The Master model is stored separately by the app, so it is left alone here.
   Bump VERSION to drop everything cached by an older worker. */
const VERSION = "v1";
const PAGES = `playgolite-pages-${VERSION}`;
const ASSETS = `playgolite-assets-${VERSION}`;
const MAX_ASSETS = 500;
const NETWORK_TIMEOUT_MS = 4000;

const START_ROUTES = ["/", "/play", "/learn", "/puzzles", "/games", "/review"];

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function cacheAssetsIn(html) {
  const urls = new Set(html.match(/\/_next\/static\/[^"'\\\s)<>]+/g) || []);
  const cache = await caches.open(ASSETS);
  await Promise.allSettled(
    [...urls].map(async (u) => {
      if (await cache.match(u)) return;
      const res = await fetch(u);
      if (res.ok) await cache.put(u, res);
    }),
  );
}

async function precachePage(url) {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) return "";
  const copy = res.clone();
  const cache = await caches.open(PAGES);
  await cache.put(url, copy);
  const html = await res.text();
  await cacheAssetsIn(html);
  return html;
}

async function precacheAll() {
  const lists = await Promise.allSettled(START_ROUTES.map((r) => precachePage(r)));
  // Lessons and puzzles are linked from their list pages.
  const extra = new Set();
  for (const r of lists) {
    if (r.status !== "fulfilled") continue;
    for (const m of r.value.matchAll(/href="(\/(?:learn|puzzles)\/[a-z0-9-]+)"/g)) extra.add(m[1]);
  }
  await Promise.allSettled([...extra].map((u) => precachePage(u)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheAll().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n.startsWith("playgolite-") && n !== PAGES && n !== ASSETS && n !== "playgolite-nn-v1").map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

function offlineResponse() {
  return new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title>' +
      '<body style="font-family:system-ui;margin:0;padding:32px;background:#f6f4ef;color:#1d1d1b"><h1>You are offline</h1>' +
      "<p>This page has not been saved on this device yet. Open it once while online and it will work offline afterwards.</p>" +
      '<p><a href="/">Back to the home screen</a></p></body>',
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Embedder-Policy": "require-corp" } },
  );
}

async function networkFirst(request, isNavigation) {
  const cache = await caches.open(PAGES);
  try {
    const res = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), NETWORK_TIMEOUT_MS)),
    ]);
    if (res.ok && res.type === "basic") {
      // Keep one copy per page. /play and /review share one shell whatever the query is.
      const url = new URL(request.url);
      const key = isNavigation && (url.pathname === "/play" || url.pathname === "/review") ? url.pathname : request.url;
      cache.put(key, res.clone());
    }
    return res;
  } catch (err) {
    const cached =
      (await cache.match(request)) ||
      (isNavigation ? await cache.match(new URL(request.url).pathname) : undefined) ||
      (isNavigation ? await cache.match(request, { ignoreSearch: true }) : undefined);
    if (cached) return cached;
    if (isNavigation) return offlineResponse();
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && res.type === "basic" && !request.headers.has("range")) {
    cache.put(request, res.clone());
    trim(ASSETS, MAX_ASSETS);
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/models/") || url.pathname === "/sw.js" || url.pathname.startsWith("/api/") || url.pathname.startsWith("/g/")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/ort/") || /\.(png|svg|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  event.respondWith(networkFirst(request, request.mode === "navigate"));
});
