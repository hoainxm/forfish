/*
  Service worker SDFish — vỏ offline + cache asset. THUẦN, không thư viện.
  Chiến lược:
   · navigation (trang) + /api/*  → network-first (ngoài khơi sóng chập chờn:
     có mạng lấy mới, mất mạng lùi về bản cache gần nhất; trang lùi về "/").
   · asset tĩnh same-origin (_next/static, icon, font, /data) → cache-first.
   · POST + khác origin (map tile, nguồn ngoài) → KHÔNG đụng, để mạng lo.
  Đổi shell thì bump SDFISH_CACHE_V (KHÔNG dùng Date.now — phải ổn định).
*/
const SDFISH_CACHE_V = "sdfish-v2";
const SHELL = [
  "/",
  "/manifest.webmanifest",
  "/logo-src.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SDFISH_CACHE_V)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => {}),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SDFISH_CACHE_V).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // POST (login, gửi yêu cầu) → mạng lo

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // map tile / nguồn ngoài

  const isNavigation = req.mode === "navigate";
  const isApi = url.pathname.startsWith("/api/");

  if (isNavigation || isApi) {
    // network-first: ưu tiên dữ liệu mới, mất mạng dùng cache/last-good
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && req.method === "GET") {
            const copy = res.clone();
            caches.open(SDFISH_CACHE_V).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches
            .match(req)
            .then((hit) => hit || (isNavigation ? caches.match("/") : undefined)),
        ),
    );
    return;
  }

  // asset tĩnh → cache-first
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SDFISH_CACHE_V).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        }),
    ),
  );
});
