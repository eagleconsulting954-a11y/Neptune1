const VERSION = "neptune-offline-2026-07-23-v3";
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;
const STATIC_ASSETS = [
  "/",
  "/login",
  "/offline.html",
  "/manifest.webmanifest",
  "/neptune-app-icon.svg",
  "/neptune-offline.js"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => ![STATIC_CACHE, PAGE_CACHE].includes(key)).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(request, url) {
  return request.destination === "script"
    || request.destination === "style"
    || request.destination === "font"
    || request.destination === "image"
    || url.pathname.startsWith("/_next/static/")
    || url.pathname === "/manifest.webmanifest"
    || url.pathname === "/neptune-offline.js";
}

async function pageResponse(request) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const response = await fetch(request);
    const requestUrl = new URL(request.url);
    const responseUrl = new URL(response.url);
    if (response.ok && !response.redirected && requestUrl.pathname === responseUrl.pathname) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const exact = await cache.match(request, { ignoreSearch: true });
    if (exact) return exact;
    if (new URL(request.url).pathname.startsWith("/dashboard")) {
      const dashboard = await cache.match("/dashboard", { ignoreSearch: true });
      if (dashboard) return dashboard;
    }
    return (await caches.match("/offline.html")) || new Response("Neptune is offline.", { status: 503, headers: { "content-type": "text/plain" } });
  }
}

async function staticResponse(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

async function cachePage(urlValue) {
  const url = new URL(urlValue || "/dashboard", self.location.origin);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  const request = new Request(url.toString(), { credentials: "include", cache: "no-store" });
  const response = await fetch(request);
  const responseUrl = new URL(response.url);
  if (!response.ok || response.redirected || responseUrl.pathname !== url.pathname) return;
  const cache = await caches.open(PAGE_CACHE);
  await cache.put(request, response.clone());
}

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(pageResponse(request));
    return;
  }

  if (isStaticAsset(request, url)) event.respondWith(staticResponse(request));
});

self.addEventListener("message", event => {
  if (event.data?.type === "CLEAR_PRIVATE") {
    event.waitUntil(caches.delete(PAGE_CACHE));
    return;
  }
  if (event.data?.type === "CACHE_PAGE") {
    event.waitUntil(cachePage(event.data.url).catch(() => {}));
  }
});
