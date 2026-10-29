/**
 * Service worker for IrshadMCP.
 *
 * Every visited same-origin GET page or asset is written into a versioned
 * cache, but a cached copy is only *served* when the network request fails —
 * i.e. when the browser is offline. API calls, the MCP endpoint and the
 * worker itself are never cached.
 */
export const swScript = `
const VERSION = "v1";
const CACHE = "irshadmcp-pages-" + VERSION;
const NEVER = ["/api/", "/mcp", "/sw.js"];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith("irshadmcp-pages-") && key !== CACHE)
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER.some((path) => url.pathname === path || url.pathname.startsWith(path))) return;

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          try {
            const cache = await caches.open(CACHE);
            await cache.put(request, response.clone());
          } catch {}
        }
        return response;
      } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
          const home = await caches.match("/");
          if (home) return home;
        }
        throw new Error("Offline and not cached: " + url.pathname);
      }
    })()
  );
});
`;
