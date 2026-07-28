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
const SDFISH_CACHE_V = "sdfish-v6";
/** Kho ô bản đồ để riêng — xoá/giới hạn được mà không đụng vỏ app */
const SDFISH_TILE_V = "sdfish-tiles-v1";
/*  Kho DỮ LIỆU /api/* — CỐ Ý TÁCH khỏi kho vỏ và KHÔNG mang phiên bản vỏ.
    LỖI ĐÃ SỬA (2026-07-26): trước đây phản hồi /api/* nằm chung khoá
    SDFISH_CACHE_V với vỏ app, mà `activate` xoá mọi kho khác phiên bản hiện
    hành ⇒ **bump vỏ (chỉ đổi giao diện) là XOÁ bản đồ cá bà con đã tải sẵn ở
    bờ**. Mỗi lần deploy là một chuyến biển mất dữ liệu. Nay bump vỏ không đụng
    kho này; chỉ bump SDFISH_API_V khi ĐỔI HÌNH DẠNG payload. */
const SDFISH_API_V = "sdfish-api-v1";
/*  Trần kho API: pretrip nạp ~2–3 MB/lượt (lưới 3/7/16 ngày + bản đồ cá + điểm
    ghim) ⇒ 120 mục thừa sức giữ vài lượt tải sẵn + các điểm bà con đã xem,
    vẫn xa hạn bộ nhớ điện thoại. LRU: Cache API trả key theo thứ tự thêm. */
const API_CACHE_MAX = 120;
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
  // BẢN ĐỒ MÙA VỤ (điểm cá điển hình từng tháng, dựng từ nhiều năm lịch sử) —
  // lớp cá của chuyến DÀI pha trộn bản này với dự báo. Nằm sẵn trong máy thì
  // giữa biển mất sóng vẫn tính được lộ trình 16 ngày.
  "/data/fish-climatology.v1.json",
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
            .filter(
              (k) =>
                k !== SDFISH_CACHE_V &&
                k !== SDFISH_TILE_V &&
                k !== SDFISH_API_V,
            )
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Giữ một kho trong trần: Cache API trả key theo thứ tự thêm vào → bỏ từ đầu. */
async function trimCache(cache, max) {
  const keys = await cache.keys();
  const over = keys.length - max;
  for (let i = 0; i < over; i++) await cache.delete(keys[i]);
}

/** Giữ kho ô bản đồ trong trần. */
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
            // dữ liệu /api/* vào kho RIÊNG (không mất khi bump vỏ); trang vào kho vỏ
            const store = isApi ? SDFISH_API_V : SDFISH_CACHE_V;
            caches
              .open(store)
              .then(async (c) => {
                await c.put(req, copy);
                if (isApi) await trimCache(c, API_CACHE_MAX);
              })
              .catch(() => {});
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

/*
  WEB PUSH (2026-07-28, Phase 3) — admin gửi thông báo per-user/broadcast từ
  /quan-tri qua /api/admin/push (server dùng web-push + VAPID). Payload JSON
  {title, body, url}. Độc lập với cache versioning ở trên — không đụng gì.
*/
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || "SDFish";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.includes(url) && "focus" in client) return client.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      }),
  );
});
