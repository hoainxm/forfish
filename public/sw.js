/*
  Service worker SDFish — vỏ offline + cache asset. THUẦN, không thư viện.
  Chiến lược:
   · navigation (trang) + /api/*  → network-first (ngoài khơi sóng chập chờn:
     có mạng lấy mới, mất mạng lùi về bản cache gần nhất; trang lùi về "/").
   · /api/tiles/*  → network-first nhưng để RIÊNG một kho có TRẦN số ô, tránh
     xem bản đồ lâu là đầy bộ nhớ máy.
   · asset tĩnh same-origin (_next/static, icon, font, /data) → cache-first.
   · POST + khác origin (map tile nguồn ngoài) → KHÔNG đụng, để mạng lo.
  Đổi shell thì bump SDFISH_CACHE_V (KHÔNG dùng Date.now — phải ổn định).
*/
const SDFISH_CACHE_V = "sdfish-v4";
/** Kho ô bản đồ để riêng — xoá/giới hạn được mà không đụng vỏ app */
const SDFISH_TILE_V = "sdfish-tiles-v1";
/** Trần số ô giữ lại (~20 KB/ô → ~12 MB). Quá thì bỏ ô cũ nhất. */
const TILE_CACHE_MAX = 600;

const SHELL = [
  "/",
  // Ra khơi (bản đồ ngư trường) — màn bà con mở giữa biển lúc mất sóng. Không
  // nằm sẵn trong vỏ thì mở app ngoài khơi chỉ về được trang chủ.
  "/ngu-truong",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  // NỀN BẢN ĐỒ LÚC MẤT SÓNG. Ô bản đồ nền là host ngoài, SW không giữ được →
  // mất sóng là màn hình trắng. Bốn file này nằm sẵn trong máy từ lúc cài app,
  // đủ để vẽ: hình bờ + đảo, đường đẳng sâu có số mét, độ sâu tại điểm chạm.
  "/data/vn-coast.v1.json",
  "/data/isobaths.v1.json",
  "/data/depth-grid.v1.bin",
  // font chữ trên bản đồ (số mét đường đẳng sâu) — thiếu là mất hết CHỮ/SỐ
  "/fonts/Noto%20Sans%20Regular/0-255.pbf",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SDFISH_CACHE_V)
      .then((c) =>
        // Từng file một: một file hỏng KHÔNG được kéo đổ cả mẻ (addAll là
        // "được tất hoặc không được gì" — trước đây hỏng 1 là vỏ trống trơn).
        Promise.allSettled(SHELL.map((u) => c.add(u))),
      )
      .then(() => self.skipWaiting())
      .catch(() => {}),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SDFISH_CACHE_V && k !== SDFISH_TILE_V)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Giữ kho ô trong trần: Cache API trả key theo thứ tự thêm vào → bỏ từ đầu. */
async function trimTileCache(cache) {
  const keys = await cache.keys();
  const over = keys.length - TILE_CACHE_MAX;
  for (let i = 0; i < over; i++) await cache.delete(keys[i]);
}

/** Ô bản đồ: có mạng lấy mới + cất vào kho có trần; mất mạng lấy ô đã cất. */
function tileFirst(req) {
  return fetch(req)
    .then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches
          .open(SDFISH_TILE_V)
          .then(async (c) => {
            await c.put(req, copy);
            await trimTileCache(c);
          })
          .catch(() => {});
      }
      return res;
    })
    .catch(() =>
      caches
        .open(SDFISH_TILE_V)
        .then((c) => c.match(req))
        // không có ô đã cất → 204 để bản đồ coi là ô trống, không báo lỗi đỏ
        .then((hit) => hit || new Response(null, { status: 204 })),
    );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // POST (login, gửi yêu cầu) → mạng lo

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // nguồn ngoài

  const isNavigation = req.mode === "navigate";
  const isApi = url.pathname.startsWith("/api/");

  if (url.pathname.startsWith("/api/tiles/")) {
    event.respondWith(tileFirst(req));
    return;
  }

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
