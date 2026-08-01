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
   · /api/admin/* → KHÔNG đụng (xem ghi chú ở nhánh fetch).

  BUMP SDFISH_CACHE_V khi nào (làm rõ 2026-08-01): chỉ khi cần XOÁ SẠCH kho vỏ
  cũ — đổi hình dạng entry, hoặc bỏ bớt URL khỏi SHELL. THÊM url vào SHELL thì
  KHÔNG cần bump: sw.js đổi byte là trình duyệt cài lại, `c.add` nhét entry mới
  vào chính kho đang dùng. Và bump có GIÁ: kho vỏ cũ bị `activate` xoá trước khi
  biết mẻ `c.add` mới có đủ không — mạng chập chờn lúc cập nhật là bà con mất vỏ
  đang chạy được. (KHÔNG dùng Date.now — phải ổn định.)
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
    vẫn xa hạn bộ nhớ điện thoại. Dọn kiểu FIFO: Cache API trả key theo thứ
    tự THÊM VÀO, nên bỏ từ đầu = bỏ bản cất sớm nhất (KHÔNG phải ít-dùng-nhất). */
const API_CACHE_MAX = 120;
/** Trần số ô giữ lại (~20 KB/ô → ~12 MB). Quá thì bỏ ô cũ nhất. */
const TILE_CACHE_MAX = 600;

/*  Kho ASSET BĂM TÊN (/_next/static: JS · CSS · font của bản build) — CỐ Ý
    TÁCH khỏi kho vỏ và KHÔNG mang phiên bản vỏ.
    LỖI ĐÃ SỬA (2026-07-31): chunk JS/CSS nằm chung khoá vỏ, mà `activate` xoá
    mọi kho khác phiên bản ⇒ **bump vỏ là xoá sạch chunk đã tích luỹ**; HTML
    trong kho vẫn còn nhưng gọi chunk không còn ai giữ ⇒ ra khơi mở app là
    MÀN HÌNH TRẮNG. Tên file có băm hash nên bản build khác nhau không đụng
    nhau — chỉ cần trần (dọn FIFO), không cần xoá trắng. LƯU Ý: chunk đã có thì
    precache bỏ qua, nên chunk khung sườn dùng suốt vẫn giữ vị trí cất LẦN ĐẦU
    và có thể bị bỏ trước đống `_rsc` mới — chưa cắn ở trần 400, nhưng đừng đọc
    chữ "trần" thành "ưu tiên cái hay dùng". */
const SDFISH_STATIC_V = "sdfish-static-v1";
/** Trần số asset băm tên giữ lại (đủ vài bản build; quá thì bỏ cũ nhất) */
const STATIC_CACHE_MAX = 400;

/*  Kho RSC (phản hồi `?_rsc=` — Next xin nội dung trang khi bấm dock) — TÁCH
    RIÊNG 2026-08-01b. LỖI ĐÃ SỬA: trước để chung kho asset băm tên, mà mỗi lần
    điều hướng lại đẻ một entry `_rsc` mới trong khi `trimCache` bỏ theo THỨ TỰ
    THÊM VÀO (FIFO, không phải LRU) và `precacheOne` bỏ qua asset đã có (không
    làm mới vị trí) ⇒ đủ nhiều deploy/điều hướng thì chính CHUNK KHUNG SƯỜN mà
    vỏ đang tham chiếu bị đẩy ra trước, cold-start offline nhận 504 → trắng màn.
    Hai kho riêng thì `_rsc` không bao giờ ăn được chỗ của JS/CSS. */
const SDFISH_RSC_V = "sdfish-rsc-v1";
/** Trần entry RSC (đủ vài vòng dock × vài build) */
const RSC_CACHE_MAX = 60;

/*  DANH SÁCH /api ĐƯỢC CACHE — GIỮ ĐỒNG BỘ với src/lib/sw-cache-policy.ts
    (test `sw-cache-policy.test.ts` đọc file này và bắt lệch).
    Vì sao có: SW từng cache MỌI /api/* GET, mà từ 2026-08-01 còn cứu cả 401/403
    bằng bản trong kho ("đã tải thì cứ dùng"). Trên MÁY DÙNG CHUNG (chủ tàu +
    bạn thuyền chung điện thoại) thì đó là đổi tài khoản vẫn đọc được phản hồi
    của người trước. Luật "đã tải thì cứ dùng" chỉ đúng cho DỰ BÁO/GIÁ — thứ ai
    xem cũng như nhau — KHÔNG đúng cho hồ sơ cá nhân. */
const API_CACHE_ALLOW = [
  "/api/fish-forecast",
  "/api/storms",
  "/api/weather-snapshot",
  "/api/salinity",
  "/api/sea-scalar",
  "/api/currents-depth",
  "/api/nautical",
  "/api/port-prices",
  "/api/fuel-price",
];

/** /api này có được cache + được cứu bằng bản trong kho không */
function isCacheableApiPath(pathname) {
  return API_CACHE_ALLOW.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

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
/** Bao nhiêu lớp "chunk gọi chunk" thì lần theo (xem precacheShellAssets) */
const PRECACHE_MAX_DEPTH = 2;
/** Trần số URL tải sẵn — chặn trường hợp bản build sau nở ra cả cây lazy chunk */
const PRECACHE_MAX_URLS = 120;

/*  VỎ SỐNG-CÒN — thiếu MỘT thứ trong đây là app coi như không dùng được ngoài
    biển, nên mẻ này TẢI NGUYÊN KHỐI: `addAll` (được tất hoặc không được gì) và
    thiếu thì INSTALL HỎNG HẲN → service worker mới KHÔNG activate, bản cũ tiếp
    tục phục vụ.
    LỖI ĐÃ SỬA (2026-08-01b, review ngoài chỉ ra): trước dùng `allSettled` cho
    cả SHELL rồi `skipWaiting()` vô điều kiện + `.catch(() => {})` — cài lần đầu
    ở cảng sóng chập chờn có thể sinh ra một PWA ĐÃ ACTIVATE mà thiếu
    `/ngu-truong` hoặc thiếu dữ liệu nền bản đồ, và bà con chỉ phát hiện khi đã
    ra khơi. Thà cài hỏng ở bờ (thử lại được) còn hơn "cài xong" mà rỗng. */
const CRITICAL_SHELL = [
  "/",
  // Ra khơi (bản đồ ngư trường) — màn bà con mở giữa biển lúc mất sóng. Không
  // nằm sẵn trong vỏ thì mở app ngoài khơi chỉ về được trang chủ.
  "/ngu-truong",
  // NỀN BẢN ĐỒ LÚC MẤT SÓNG: hình bờ + đảo, đường đẳng sâu, độ sâu tại điểm.
  "/data/vn-coast.v1.json",
  "/data/isobaths.v1.json",
  "/data/depth-grid.v1.bin",
  // font chữ trên bản đồ (số mét đường đẳng sâu) — thiếu là mất hết CHỮ/SỐ
  "/fonts/Noto%20Sans%20Regular/0-255.pbf",
];

const SHELL = [
  ...CRITICAL_SHELL,
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
  // BẢN ĐỒ MÙA VỤ (điểm cá điển hình từng tháng, dựng từ nhiều năm lịch sử) —
  // lớp cá của chuyến DÀI pha trộn bản này với dự báo. Nằm sẵn trong máy thì
  // giữa biển mất sóng vẫn tính được lộ trình 16 ngày.
  "/data/fish-climatology.v1.json",
];

/** Rút các đường dẫn /_next/static/... mà một trang HTML cần (JS · CSS · font) */
function staticAssetUrls(html) {
  const out = new Set();
  const re = /["'(](\/_next\/static\/[^"')\s\\]+)["')\\]/g;
  let m;
  while ((m = re.exec(html))) out.add(m[1]);
  return [...out];
}

/** Rút các chunk mà MỘT FILE JS gọi tới lúc chạy (dynamic import).
    Turbopack ghi thẳng đường dẫn tương đối vào mã, ví dụ trong chunk của
    /ngu-truong: `["static/chunks/…","static/chunks/261cq39jf3lqt.js"].map(t=>e.l(t))`
    ⇒ KHÔNG có tiền tố `/_next/` nên `staticAssetUrls` (quét HTML) không thấy. */
function lazyChunkUrls(js) {
  const out = new Set();
  const re = /["'](static\/(?:chunks|css|media)\/[^"'\s\\]+)["']/g;
  let m;
  while ((m = re.exec(js))) out.add(`/_next/${m[1]}`);
  return [...out];
}

/** Cất một asset vào kho tĩnh (đã có thì thôi). Trả về NỘI DUNG nếu là .js —
    để đi tiếp sang các chunk mà nó gọi. */
async function precacheOne(store, url) {
  const isJs = url.endsWith(".js");
  const hit = await store.match(url);
  if (hit) {
    // ĐÃ CÓ (bản build trước cũng dùng chunk này) → KHÔNG tải lại, nhưng phải
    // GHI LẠI để đưa xuống CUỐI HÀNG. Cache API trả key theo thứ tự THÊM VÀO và
    // `trimCache` bỏ từ đầu ⇒ chunk khung sườn dùng suốt nhiều bản build mà
    // không ai đụng tới sẽ bị đuổi TRƯỚC đống chunk mới toanh — đúng chunk mà
    // vỏ đang cần, cold-start offline nhận 504 = trắng màn. Ghi lại mỗi lần
    // install biến "cũ nhất" thành "lâu nhất không còn ai tham chiếu".
    const forPut = hit.clone();
    const body = isJs ? await hit.clone().text() : null;
    await store.delete(url);
    await store.put(url, forPut);
    return body;
  }
  const net = await fetch(url);
  if (!net.ok) return null;
  // Nhân bản TRƯỚC khi ai đó đọc thân — put() nuốt một bản, đọc chữ một bản.
  const forCache = net.clone();
  const body = isJs ? await net.clone().text() : null;
  await store.put(url, forCache);
  return body;
}

/*
  TẢI SẴN LUÔN JS/CSS CỦA VỎ (2026-07-31, mở rộng 2026-08-01).
  Vì sao: SHELL chỉ có HTML + dữ liệu + font bản đồ, KHÔNG có một file JS nào.
  HTML lấy từ kho mà chunk không có ai giữ thì trang chủ mất hết kiểu dáng, còn
  /ngu-truong (bản đồ dựng bằng JS, server render ra div rỗng) là TRỐNG TRƠN —
  đúng màn bà con mở giữa biển.

  HAI LỖ CỦA BẢN ĐẦU, vá ở đây:
  (1) Chỉ đọc HTML của "/" và "/ngu-truong" trong khi SHELL đã thêm /tau /nguoi
      /tien /cang ⇒ bốn màn đó có HTML mà THIẾU chunk: giữa biển hiện đúng tiêu
      đề + tab nhưng KHÔNG hydrate (tủ giấy tờ đọc localStorage trong useEffect
      nên vĩnh viễn rỗng, bấm tab không ăn) — dối hơn cả màn trắng. Nay danh
      sách trang lấy THẲNG từ SHELL, thêm màn vào SHELL là tự có chunk.
  (2) Chunk nạp bằng dynamic import (MapLibre ~1 MB của /ngu-truong) KHÔNG được
      HTML nhắc tên — chỉ chunk khác gọi nó ⇒ quét HTML về mặt cấu trúc không
      bao giờ với tới. Nay lần theo `PRECACHE_MAX_DEPTH` lớp "chunk gọi chunk".
      Thiếu nó thì /ngu-truong offline = import reject, mà app KHÔNG có
      error.tsx ⇒ màn lỗi mặc định của Next, mất bản đồ + lớp bão + đẳng sâu.
  Best-effort: hỏng thì thôi, không chặn install.
*/
async function precacheShellAssets(pages) {
  try {
    const shell = await caches.open(SDFISH_CACHE_V);
    const store = await caches.open(SDFISH_STATIC_V);
    const seen = new Set();
    let wave = [];
    const push = (u) => {
      if (seen.has(u) || seen.size >= PRECACHE_MAX_URLS) return;
      seen.add(u);
      wave.push(u);
    };
    // Trang = mục không có đuôi file (icon/json/font thì tự nó là asset)
    for (const page of pages) {
      if (page.includes(".")) continue;
      const res = await shell.match(page);
      if (!res) continue;
      for (const u of staticAssetUrls(await res.clone().text())) push(u);
    }
    // Có trần thời gian: sóng chập chờn thì tải có thể treo rất lâu, mà cài
    // xong vỏ mới còn quan trọng hơn việc tải đủ chunk (chunk thiếu sẽ được
    // cất lúc bà con mở trang, nhánh cache-first bên dưới).
    let timedOut = false;
    const deadline = new Promise((resolve) =>
      setTimeout(() => {
        timedOut = true;
        resolve([]);
      }, PRECACHE_MAX_MS),
    );
    for (let d = 0; d <= PRECACHE_MAX_DEPTH && wave.length && !timedOut; d++) {
      const batch = wave;
      wave = [];
      const done = await Promise.race([
        Promise.allSettled(batch.map((u) => precacheOne(store, u))),
        deadline,
      ]);
      for (const r of done) {
        if (r.status !== "fulfilled" || !r.value) continue;
        for (const u of lazyChunkUrls(r.value)) push(u);
      }
    }
    await trimCache(store, STATIC_CACHE_MAX);
    // KIỂM LẠI: mọi URL đã điểm danh có thật nằm trong kho không. Người gọi
    // dùng cờ này để quyết định install có được coi là xong hay không.
    for (const u of seen) {
      if (!(await store.match(u))) return false;
    }
    return !timedOut;
  } catch {
    /* không tải sẵn được thì báo thiếu, đừng nuốt */
    return false;
  }
}

/*
  CÀI ĐẶT — HAI MỨC, CÓ KIỂM LẠI (2026-08-01b).

  Mức 1 (BẮT BUỘC): CRITICAL_SHELL tải NGUYÊN KHỐI bằng `addAll`, xong còn ĐỌC
  LẠI từng entry trong kho để chắc nó có thật (addAll xong mà quota đầy thì
  entry vẫn có thể không nằm lại). Thiếu một thứ → THROW → install HỎNG → SW mới
  KHÔNG activate, bản cũ tiếp tục phục vụ và trình duyệt sẽ thử cài lại sau.
  Mức 2 (CÓ THÌ TỐT): phần còn lại của SHELL + JS/CSS — `allSettled`, hỏng thì
  thôi, cất dần khi bà con mở trang.

  Trước đây cả hai mức chung một rổ `allSettled` rồi `skipWaiting()` vô điều
  kiện + `.catch(() => {})`: cài ở cảng sóng chập chờn có thể ra một PWA "đã
  cài" mà thiếu /ngu-truong hoặc thiếu dữ liệu nền — bà con chỉ biết khi đã ra
  khơi. Thà cài hỏng ở bờ còn hơn.
*/
async function installShell() {
  const c = await caches.open(SDFISH_CACHE_V);
  // nguyên khối — hỏng một là hỏng cả mẻ, và ném ra ngoài.
  // `cache: "reload"` để KHÔNG lấy bản cũ trong kho HTTP của trình duyệt: vỏ
  // vừa deploy mà cất nhầm HTML bản trước là chunk gọi tên không còn ai giữ.
  await c.addAll(
    CRITICAL_SHELL.map((u) => new Request(u, { cache: "reload" })),
  );
  // kiểm lại: có thật nằm trong kho không (quota đầy vẫn có thể trượt)
  for (const u of CRITICAL_SHELL) {
    const hit = await c.match(u);
    if (!hit) throw new Error(`vỏ sống-còn thiếu: ${u}`);
  }

  /* JS/CSS CỦA HAI MÀN SỐNG-CÒN CŨNG LÀ BẮT BUỘC (2026-08-01c).
     Lỗ của bản trước: CRITICAL_SHELL chỉ có HTML + dữ liệu + font, KHÔNG một
     dòng JS. Install vẫn "xong" trong khi chunk MapLibre thiếu ⇒ ra khơi mở
     /ngu-truong là màn lỗi mặc định của Next, mất bản đồ + lớp bão + đẳng sâu.
     Mà /ngu-truong server render ra div rỗng: thiếu JS thì nó KHÔNG phải "xấu
     một chút", nó là trống trơn. Nên: thiếu chunk của "/" hoặc "/ngu-truong"
     → install HỎNG luôn, y như thiếu HTML. */
  const criticalPages = CRITICAL_SHELL.filter((u) => !u.includes("."));
  const okCritical = await precacheShellAssets(criticalPages);
  if (!okCritical) throw new Error("thiếu JS/CSS của vỏ sống-còn");

  // phần "có thì tốt" — hỏng thì thôi, cất dần khi bà con mở trang
  const optional = SHELL.filter((u) => !CRITICAL_SHELL.includes(u));
  await Promise.allSettled(
    optional.map((u) => c.add(new Request(u, { cache: "reload" }))),
  );
  await precacheShellAssets(optional);
}

/*  DẤU "VỎ ĐÃ ĐỦ" — nguồn SỰ THẬT DUY NHẤT cho chữ "sẵn sàng đi biển".
    Trước đây app tự kết luận bằng cách đếm localStorage, còn service worker cài
    đủ hay chưa thì KHÔNG AI ĐỌC ⇒ chip có thể báo xanh trên một cái vỏ rỗng.
    Nay install chỉ ghi dấu này khi ĐÃ qua hết cửa (vỏ sống-còn + JS của nó);
    client đọc bằng caches.match, không cần postMessage, không cần bắt tay. */
const SHELL_READY_MARK = "/__sdfish-shell-ready";

self.addEventListener("install", (event) => {
  // KHÔNG bọc .catch: để lỗi nổi lên cho trình duyệt biết install thất bại.
  event.waitUntil(
    installShell()
      .then(async () => {
        const c = await caches.open(SDFISH_CACHE_V);
        await c.put(
          SHELL_READY_MARK,
          new Response(JSON.stringify({ at: Date.now() }), {
            headers: { "content-type": "application/json" },
          }),
        );
      })
      .then(() => self.skipWaiting()),
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
                k !== SDFISH_STATIC_V &&
                k !== SDFISH_RSC_V,
            )
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => purgeLegacyEntries())
      .then(() => self.clients.claim()),
  );
});

/*
  DỌN RÁC BẢN TRƯỚC LỠ CẤT (2026-08-01). Hai kho này CỐ Ý không bị xoá theo
  phiên bản vỏ, nên thứ cất sai phải xoá tay:
   · kho vỏ: phản hồi `?_rsc=` — nay đưa sang kho tĩnh (có trần, dọn FIFO). Kho vỏ
     KHÔNG có trần, mà mỗi bản deploy sinh một bộ URL `_rsc` mới ⇒ phình mãi.
   · kho API: `/api/admin/*` — nay KHÔNG cache nữa (xem nhánh fetch); bản 200
     đã lỡ cất là danh bạ khách (SĐT + tên + hạng) nằm lại trên máy nhân viên.
*/
async function purgeLegacyEntries() {
  try {
    const shell = await caches.open(SDFISH_CACHE_V);
    for (const req of await shell.keys()) {
      if (new URL(req.url).searchParams.has("_rsc")) await shell.delete(req);
    }
  } catch {
    /* dọn được thì tốt, không thì thôi */
  }
  try {
    // Kho API: bỏ MỌI thứ ngoài allowlist — gồm cả /api/admin/* và hồ sơ cá
    // nhân (/api/me, /api/crew-reports…) mà bản trước đã lỡ cất. Máy dùng chung
    // trên tàu thì đó là dữ liệu người trước nằm lại cho người sau đọc.
    const api = await caches.open(SDFISH_API_V);
    for (const req of await api.keys()) {
      if (!isCacheableApiPath(new URL(req.url).pathname)) await api.delete(req);
    }
  } catch {
    /* dọn được thì tốt, không thì thôi */
  }
  try {
    // Kho tĩnh: bỏ `_rsc` lẫn vào từ bản 2026-08-01 (nay có kho riêng)
    const st = await caches.open(SDFISH_STATIC_V);
    for (const req of await st.keys()) {
      if (new URL(req.url).searchParams.has("_rsc")) await st.delete(req);
    }
  } catch {
    /* dọn được thì tốt, không thì thôi */
  }
}

/**
 * Lỗi này có ĐƯỢC CỨU bằng bản trong kho không (2026-08-01b).
 *
 * · 5xx · 408 · 429 — nguồn/hạ tầng hỏng: cứu, hiển nhiên.
 * · 401 · 403 — máy chủ nói "hết hạn premium / chưa đăng nhập". VẪN CỨU, theo
 *   luật chủ dự án chốt 2026-08-01: premium gác CỬA TẢI chứ không gác cửa XEM
 *   ("đã tải được, lưu trong máy rồi thì cứ dùng… online lại, hết hạn thì không
 *   tải mới được"). Cứu ở đây KHÔNG phá chốt thật: middleware vẫn chặn, nên
 *   không ai lấy thêm được dữ liệu MỚI — thứ trả về chỉ là bản chính máy đó đã
 *   tải hợp lệ lúc còn hạn, và nó tự hết giá trị sau ≤16 ngày.
 *   `/api/admin/*` KHÔNG dính: SW loại khỏi cache từ đầu nhánh fetch.
 * · 404 và các mã khác — nói thật, đừng che.
 */
function isRescuableStatus(status) {
  return (
    status >= 500 ||
    status === 408 ||
    status === 429 ||
    status === 401 ||
    status === 403
  );
}

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
      // NGUỒN/HẠ TẦNG HỎNG mà trang này đã nằm trong kho → trả bản trong kho
      // (2026-07-31b). Bản trước chỉ lo mạng ĐỨT và mạng CHẬM; còn 504 của
      // gateway vệ tinh / 500 của Vercel vẫn đi thẳng ra app, bà con nhận
      // trang lỗi DÙ trang đó có sẵn trong máy.
      // Thu hẹp 2026-08-01: chỉ 5xx/408/429. `!winner.ok` cũ khớp cả 404 (phải
      // hiện 404 thật) lẫn `opaqueredirect` (status 0 — chuyển hướng của
      // middleware) ⇒ mọi redirect thêm sau này lên route trong SHELL sẽ bị
      // nuốt im lặng, bà con đứng lại ở trang cũ mà không hiểu vì sao.
      if (
        winner &&
        !winner.ok &&
        winner.type !== "opaqueredirect" &&
        isRescuableStatus(winner.status)
      ) {
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

  /*  WEB QUẢN TRỊ — KHÔNG ĐỤNG (2026-08-01).
      `/quan-tri` dựng toàn bộ bảng điều khiển từ THÂN JSON của
      /api/admin/health (vai + bảng quyền) rồi /api/admin/accounts (danh bạ
      khách: SĐT + tên + hạng). Cất chúng vào kho là: đăng xuất hoặc bị gỡ
      quyền xong tải lại trang vẫn thấy y nguyên — bản 200 cũ đè lên 401/403
      thật. Khu này CHỈ dùng khi ngồi bờ có mạng, chẳng có lời hứa offline nào
      để giữ ⇒ để mạng lo, SW đứng ngoài. */
  if (url.pathname.startsWith("/api/admin/")) return;

  /*  MỌI /api KHÁC KHÔNG NẰM TRONG ALLOWLIST — cũng để mạng lo (2026-08-01b).
      Trước đây SW cache TẤT CẢ /api/* GET: gồm /api/me, /api/crew-reports,
      /api/product-inquiries… tức HỒ SƠ GẮN VỚI NGƯỜI ĐANG ĐĂNG NHẬP. Ghép với
      luật mới "lỗi/từ chối thì cứu bằng bản trong kho" thì trên một điện thoại
      dùng chung (chủ tàu + bạn thuyền), đổi tài khoản vẫn đọc được phản hồi của
      người trước — kể cả khi máy chủ đã trả 401. Dự báo/giá thì ai xem cũng như
      nhau nên cache thoải mái; hồ sơ cá nhân thì không. */
  if (isApi && !isCacheableApiPath(url.pathname)) return;

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
          // LỖI mà kho có bản tốt → trả bản đó. Hai loại được cứu (xem
          // isRescuableStatus): NGUỒN HỎNG (503 của /api/storms khi GDACS chết,
          // 500 của fish-forecast) và HẾT HẠN/CHƯA ĐĂNG NHẬP (401/403 — premium
          // gác cửa TẢI, không gác cửa XEM, luật 2026-08-01). Bản trong kho có
          // mốc thời gian, phía client tự nói cũ bao lâu.
          // KHÔNG xoá bản cũ ở đây: payload bản đồ cá CHỈ tồn tại trong kho này
          // (fish-predict chỉ lưu DẤU), mà middleware fail-closed nên một cú
          // 403 thoáng qua giữa biển sẽ xoá vĩnh viễn thứ không tải lại được.
          if (!isRescuableStatus(res.status)) return res; // 404… → nói thật
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
            // JS/CSS băm tên vào kho RIÊNG (bump vỏ không xoá) + trần (FIFO).
            // Phản hồi `?_rsc=` vào KHO RSC RIÊNG (2026-08-01b): trước để chung
            // kho asset, mà `_rsc` đẻ một bộ mới mỗi deploy + mỗi lần bấm dock
            // ⇒ trần FIFO chung sẽ đẩy chính CHUNK KHUNG SƯỜN (cất sớm nhất, và
            // không được làm mới vị trí khi trúng kho) ra trước ⇒ cold-start
            // offline nhận 504 cho chunk = trắng màn. Hai kho, hai trần.
            caches
              .open(
                isRsc
                  ? SDFISH_RSC_V
                  : isHashed
                    ? SDFISH_STATIC_V
                    : SDFISH_CACHE_V,
              )
              .then(async (c) => {
                await c.put(req, copy);
                if (isRsc) await trimCache(c, RSC_CACHE_MAX);
                else if (isHashed) await trimCache(c, STATIC_CACHE_MAX);
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
