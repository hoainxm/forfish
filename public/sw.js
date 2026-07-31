/*
  Service worker SDFish — vỏ offline + cache asset. THUẦN, không thư viện.
  Chiến lược:
   · navigation (trang) → ĐUA mạng với bản trong máy (network-first CÓ ĐỒNG HỒ:
     mạng về trong NAV_NETWORK_MS thì lấy bản mới, không thì trả ngay bản đã
     lưu; trang chưa lưu thì lùi về "/").
   · /api/*  → network-first (ngoài khơi sóng chập chờn: có mạng lấy mới, mất
     mạng lùi về bản cache gần nhất).
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

/*  Kho ASSET BĂM TÊN (/_next/static: JS · CSS · font của bản build) — CỐ Ý
    TÁCH khỏi kho vỏ và KHÔNG mang phiên bản vỏ.
    LỖI ĐÃ SỬA (2026-07-31): chunk JS/CSS nằm chung khoá vỏ, mà `activate` xoá
    mọi kho khác phiên bản ⇒ **bump vỏ là xoá sạch chunk đã tích luỹ**; HTML
    trong kho vẫn còn nhưng gọi chunk không còn ai giữ ⇒ ra khơi mở app là
    MÀN HÌNH TRẮNG. Tên file có băm hash nên bản build khác nhau không đụng
    nhau — chỉ cần trần LRU, không cần xoá trắng. */
const SDFISH_STATIC_V = "sdfish-static-v1";
/** Trần số asset băm tên giữ lại (đủ vài bản build; quá thì bỏ cũ nhất) */
const STATIC_CACHE_MAX = 400;

/** Điều hướng chờ mạng bao lâu trước khi trả bản trong máy (ms).
    Ngoài khơi hay gặp sóng "sống mà chết" — bắt tay được nhưng gói tin không
    về; không có đồng hồ này thì bà con nhìn màn trắng tới lúc trình duyệt tự
    hết giờ, DÙ "/" và "/ngu-truong" đã nằm sẵn trong kho. */
const NAV_NETWORK_MS = 2500;
/** Yêu cầu RSC (Next tải nội dung trang khi bấm dock) chờ mạng bấy nhiêu rồi
    chịu thua — thua thì Next tự chuyển sang điều hướng cứng, và điều hướng đã
    có bản trong máy để trả. */
const RSC_NETWORK_MS = 3500;
/** Trần thời gian tải sẵn JS/CSS của vỏ lúc install — quá thì thôi, cài vỏ mới
    quan trọng hơn (chunk còn thiếu sẽ cất dần lúc bà con mở trang) */
const PRECACHE_MAX_MS = 20000;

const SHELL = [
  "/",
  // Ra khơi (bản đồ ngư trường) — màn bà con mở giữa biển lúc mất sóng. Không
  // nằm sẵn trong vỏ thì mở app ngoài khơi chỉ về được trang chủ.
  "/ngu-truong",
  // BỐN MÀN CÒN LẠI của dock (2026-07-31b). Rẻ nhất trong cả đợt soát offline
  // mà trước đây bỏ sót: thiếu chúng thì giữa biển bấm Tàu cá / Bạn thuyền /
  // Giao dịch / Cảng là màn trắng — trong khi giấy tờ, sổ thuyền viên, danh bạ
  // chỗ bán đều là dữ liệu NẰM SẴN TRONG MÁY, không cần mạng mới xem được.
  "/tau",
  "/nguoi",
  "/tien",
  "/cang",
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

/** Rút các đường dẫn /_next/static/... mà một trang HTML cần (JS · CSS · font) */
function staticAssetUrls(html) {
  const out = new Set();
  const re = /["'(](\/_next\/static\/[^"')\s\\]+)["')\\]/g;
  let m;
  while ((m = re.exec(html))) out.add(m[1]);
  return [...out];
}

/*
  TẢI SẴN LUÔN JS/CSS CỦA VỎ (2026-07-31).
  Vì sao: SHELL chỉ có HTML + dữ liệu + font bản đồ, KHÔNG có một file JS nào.
  HTML lấy từ kho mà chunk không có ai giữ thì trang chủ mất hết kiểu dáng, còn
  /ngu-truong (bản đồ dựng bằng JS, server render ra div rỗng) là TRỐNG TRƠN —
  đúng màn bà con mở giữa biển. Đọc HTML VỪA cất trong kho vỏ (không tải lại)
  rồi cất các chunk nó gọi. Best-effort: hỏng thì thôi, không chặn install.
*/
async function precacheShellAssets() {
  try {
    const shell = await caches.open(SDFISH_CACHE_V);
    const store = await caches.open(SDFISH_STATIC_V);
    const urls = new Set();
    for (const page of ["/", "/ngu-truong"]) {
      const res = await shell.match(page);
      if (!res) continue;
      const html = await res.clone().text();
      for (const u of staticAssetUrls(html)) urls.add(u);
    }
    // Có trần thời gian: sóng chập chờn thì `add` có thể treo rất lâu, mà cài
    // xong vỏ mới còn quan trọng hơn việc tải đủ chunk (chunk thiếu sẽ được
    // cất lúc bà con mở trang, nhánh cache-first bên dưới).
    await Promise.race([
      Promise.allSettled(
        [...urls].map(async (u) => {
          if (await store.match(u)) return; // bản build cũ đã có thì thôi
          return store.add(u);
        }),
      ),
      new Promise((resolve) => setTimeout(resolve, PRECACHE_MAX_MS)),
    ]);
    await trimCache(store, STATIC_CACHE_MAX);
  } catch {
    /* không tải sẵn được thì vỏ vẫn chạy như cũ */
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SDFISH_CACHE_V)
      .then((c) =>
        // Từng file một: một file hỏng KHÔNG được kéo đổ cả mẻ (addAll là
        // "được tất hoặc không được gì" — trước đây hỏng 1 là vỏ trống trơn).
        Promise.allSettled(SHELL.map((u) => c.add(u))),
      )
      .then(() => precacheShellAssets())
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
                k !== SDFISH_API_V &&
                k !== SDFISH_STATIC_V,
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

/**
 * ĐIỀU HƯỚNG: đua MẠNG với BẢN TRONG MÁY.
 *
 * LỖI ĐÃ SỬA (2026-07-31): trước đây chỉ `fetch(req)` rồi `.catch` — mà `.catch`
 * CHỈ nổ khi mạng đứt HẲN. Sóng "sống mà chết" ngoài khơi (bắt tay được, gói
 * tin không về) làm promise không bao giờ xong ⇒ màn trắng/xoay tới lúc trình
 * duyệt tự hết giờ, trong khi "/" và "/ngu-truong" nằm sẵn trong kho. Trái với
 * bất biến của dự án: "thà báo lỗi rõ còn hơn treo UI chờ browser timeout".
 * Mạng về sau đồng hồ vẫn được cất vào kho cho lần mở sau.
 */
function navigationFirst(req) {
  const net = fetch(req).then((res) => {
    if (res.ok) {
      const copy = res.clone();
      caches
        .open(SDFISH_CACHE_V)
        .then((c) => c.put(req, copy))
        .catch(() => {});
    }
    return res;
  });
  net.catch(() => {}); // đừng để promise lỗi lửng lơ
  const waited = new Promise((resolve) => setTimeout(resolve, NAV_NETWORK_MS));
  return Promise.race([net.then((r) => r, () => undefined), waited]).then(
    async (winner) => {
      // MÁY CHỦ TRẢ LỖI mà trang này đã nằm trong kho → trả bản trong kho
      // (2026-07-31b). Bản trước chỉ lo mạng ĐỨT và mạng CHẬM; còn 504 của
      // gateway vệ tinh / 500 của Vercel vẫn đi thẳng ra app, bà con nhận
      // trang lỗi DÙ trang đó có sẵn trong máy.
      if (winner && !winner.ok) {
        const hit = await caches.match(req);
        if (hit) return hit;
      }
      if (winner) return winner;
      // Hết giờ (hoặc mạng hỏng): chỉ trả bản của ĐÚNG trang này. KHÔNG lấy "/"
      // thay cho trang khác chỉ vì mạng chậm — mạng phải hỏng HẲN mới đành lùi
      // về vỏ app (thà vỏ còn hơn màn báo lỗi của trình duyệt).
      return caches
        .match(req)
        .then((hit) => hit || net.catch(() => caches.match("/")));
    },
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

  if (isNavigation) {
    event.respondWith(navigationFirst(req));
    return;
  }

  if (isApi) {
    // network-first: ưu tiên dữ liệu mới, mất mạng dùng cache/last-good.
    // KHÔNG đặt đồng hồ ở đây: mọi lời gọi /api/* phía client đã có
    // AbortSignal.timeout riêng (8–35s tuỳ nguồn), và cắt sớm ở đây thì bản
    // MỚI về muộn cũng không được cất.
    event.respondWith(
      fetch(req)
        .then(async (res) => {
          if (res.ok && req.method === "GET") {
            const copy = res.clone();
            // dữ liệu /api/* vào kho RIÊNG — không mất khi bump vỏ
            caches
              .open(SDFISH_API_V)
              .then(async (c) => {
                await c.put(req, copy);
                await trimCache(c, API_CACHE_MAX);
              })
              .catch(() => {});
            return res;
          }
          // NGUỒN HỎNG mà kho có bản tốt → trả bản đó (2026-07-31b). Ví dụ
          // thật: /api/storms trả 503 khi GDACS chết, /api/fish-forecast 500 —
          // trước đây lỗi đi thẳng ra app, xoá trắng bản tin bão + bản đồ cá
          // bà con tải trước lúc rời bờ, dù chúng còn nằm nguyên trong máy.
          // Bản trong kho có mốc thời gian, phía client tự nói cũ bao lâu.
          const hit = await caches.match(req);
          return hit || res;
        })
        .catch(() => caches.match(req)),
    );
    return;
  }

  // asset tĩnh → cache-first
  const isHashed = url.pathname.startsWith("/_next/static/");
  // Next xin nội dung trang khi bấm dock (?_rsc=…) — không phải "navigate" nên
  // rơi vào nhánh này; treo ở đây là bấm tab không ăn gì.
  const isRsc = url.searchParams.has("_rsc");
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      const net = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            // JS/CSS băm tên vào kho RIÊNG (bump vỏ không xoá) + trần LRU
            caches
              .open(isHashed ? SDFISH_STATIC_V : SDFISH_CACHE_V)
              .then(async (c) => {
                await c.put(req, copy);
                if (isHashed) await trimCache(c, STATIC_CACHE_MAX);
              })
              .catch(() => {});
          }
          return res;
        })
        // Mạng hỏng mà kho không có: trả 504 gọn thay vì để promise lửng lơ —
        // trang biết đường lùi (Next chuyển sang điều hướng cứng, và điều hướng
        // đã có bản trong máy để trả).
        .catch(() =>
          caches
            .match(req)
            .then((h) => h || new Response("", { status: 504 })),
        );
      if (!isRsc) return net;
      const waited = new Promise((resolve) =>
        setTimeout(() => resolve(new Response("", { status: 504 })), RSC_NETWORK_MS),
      );
      return Promise.race([net, waited]);
    }),
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
