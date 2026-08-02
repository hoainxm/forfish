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

/*  KHO TẠM LÚC CÀI (2026-08-02, audit C-2). Mọi thứ có thể hỏng của một mẻ
    install làm ở đây; kho vỏ đang phục vụ chỉ bị đụng ở bước cuối khi đã chắc
    đủ. KHÔNG nằm trong danh sách chừa của `activate` ⇒ mẻ cài hỏng dở để lại
    rác thì lần activate kế tiếp tự dọn. */
const SDFISH_STAGE_V = "sdfish-stage-v1";
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
/*  Trần THỨ HAI của điều hướng (2026-08-02, audit A3): trang KHÔNG có trong kho
    thì hết 2500 ms vẫn phải chờ mạng — chờ bao lâu nữa rồi đành lùi về vỏ app.
    Không có trần này thì ca "sóng sống mà chết" treo vô hạn ở đúng những trang
    ngoài SHELL (`/login`, `/dang-ky`, `/doi-mat-khau`): bị đăng xuất giữa biển
    là màn trắng, không có cả nút quay lại. */
const NAV_GIVEUP_MS = 8000;
/** Yêu cầu RSC (Next tải nội dung trang khi bấm dock) chờ mạng bấy nhiêu rồi
    chịu thua — thua thì Next tự chuyển sang điều hướng cứng, và điều hướng đã
    có bản trong máy để trả. */
const RSC_NETWORK_MS = 3500;
/*  ASSET TĨNH (JS · CSS · font · ảnh · /data) chờ mạng bao lâu rồi chịu thua
    (2026-08-02, audit C-3). Đây từng là nhánh DUY NHẤT không có đồng hồ: ca
    "sóng sống mà chết" (bắt tay được, gói tin không về) làm `fetch` treo mà
    KHÔNG reject ⇒ `.catch` không bao giờ chạy ⇒ promise trong `respondWith`
    không settle ⇒ màn đứng tới lúc trình duyệt tự bỏ cuộc (Chrome ~300 s, iOS
    lâu hơn). Trái đúng bất biến của file này: "thà báo lỗi rõ còn hơn treo UI".
    VÌ SAO 20 GIÂY, KHÔNG PHẢI 2,5 S NHƯ ĐIỀU HƯỚNG: chunk MapLibre ~1 MB trên
    3G ở cảng mất cả chục giây một cách CHÍNH ĐÁNG — cắt sớm là tự làm hỏng app
    cho người đang có sóng thật. 20 s đủ rộng cho sóng chậm mà vẫn cắt được ca
    treo vĩnh viễn.
    QUAN TRỌNG: hết giờ chỉ THÔI CHỜ, KHÔNG hủy `fetch` — mẻ tải vẫn chạy nền và
    vẫn cất vào kho, nên lần bà con chạm lại là có sẵn trong máy. */
const ASSET_NETWORK_MS = 20000;
/*  /api/*: chờ mạng bấy nhiêu rồi lấy BẢN TRONG KHO nếu có (2026-08-02, B4).
    Không phải "hủy mạng" — mẻ tải vẫn chạy nền và vẫn cất bản mới; chỉ là đừng
    bắt bà con nhìn màn trống khi thứ họ cần đã nằm sẵn trong máy. Không có bản
    lưu thì vẫn chờ hết đồng hồ của client, không cắt oan bản mới về muộn. */
const API_STALE_MS = 10000;
/** Trần thời gian tải sẵn JS/CSS của vỏ lúc install — quá thì thôi, cài vỏ mới
    quan trọng hơn (chunk còn thiếu sẽ cất dần lúc bà con mở trang) */
const PRECACHE_MAX_MS = 20000;
/*  Ngân sách RIÊNG cho nhóm "có thì tốt" (4 màn dock + icon + mùa vụ), tách
    khỏi ngân sách của vỏ sống-còn (2026-08-02b). Dùng chung một mốc là vòng
    sống-còn nuốt gần hết rồi vòng phụ chết đói ⇒ bốn màn dock bị bỏ. Đo trên
    bản build thật: vòng phụ chỉ cần thêm ~281 KB (18/25 chunk đã có sẵn từ vòng
    một), 8 giây là rộng rãi mà không kéo dài install trên iOS. */
const OPTIONAL_PRECACHE_MAX_MS = 8000;
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
  /*  FONTSTACK THỨ HAI (2026-08-02, audit A9). Bản đồ dùng HAI fontstack:
      "Noto Sans Regular" (nhãn đẳng sâu, ocean-map.ts) và "Noto Sans Bold"
      (SỐ ĐỘ VĨ/KINH của lưới toạ độ, fishing-map-view.tsx). Chỉ ghim Regular
      ⇒ offline bản đồ vẫn hiện nhưng MẤT HẾT số độ — đúng thứ bà con dùng để
      đối chiếu với máy định vị và hải đồ giấy, mà mất im lặng nên không ai
      biết. Rẻ nhất cả đợt soát: một dòng. */
  "/fonts/Noto%20Sans%20Bold/0-255.pbf",
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
    /*  CHỈ `put`, KHÔNG `delete` trước (2026-08-02, audit A6). Theo spec Cache
        API, `put` là MỘT thao tác lô: xoá mọi bản ghi khớp rồi NỐI VÀO CUỐI —
        đúng thứ đoạn này cần, mà không để khe "SW bị giết giữa hai lệnh" làm
        chunk BIẾN MẤT trong khi HTML vẫn gọi tên nó (iOS giết SW rất mạnh tay).*/
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
async function precacheShellAssets(pages, source, deadlineAt) {
  let timerId = null;
  try {
    const shell = source || (await caches.open(SDFISH_CACHE_V));
    const store = await caches.open(SDFISH_STATIC_V);
    const seen = new Set();
    /*  CHẠM TRẦN SỐ URL (2026-08-02, phát hiện thêm khi soát A5). `push` bỏ im
        lặng mọi URL vượt `PRECACHE_MAX_URLS` ⇒ chúng không vào `seen`, không ai
        kiểm ⇒ hàm trả "xong" trên một cái vỏ THIẾU CHUNK, rồi dấu "sẵn sàng đi
        biển" bật xanh. A5 làm install hỏng oan; cái này làm install XANH OAN —
        nguy hơn. Nay báo ra ngoài để install đừng ghi dấu, NHƯNG KHÔNG ném:
        bản build nở quá trần mà làm install hỏng vĩnh viễn thì app thành không
        cài được, tệ hơn nhiều lần một cái chip nói thật là chưa đủ. */
    let capped = false;
    /*  ĐÃ THẬT SỰ THỬ TẢI (khác `seen` = "đã điểm danh") — 2026-08-02, audit A5.
        LỖI: vòng kiểm lại cuối hàm duyệt `seen`, mà ở vòng SÂU NHẤT
        (`d === PRECACHE_MAX_DEPTH`) các chunk mới phát hiện vẫn được `push` vào
        `seen` rồi vòng lặp kết thúc — chúng KHÔNG BAO GIỜ được tải. Kiểm lại
        thấy thiếu → `return false` → install HỎNG trên MỌI máy, MỌI lần, MÃI
        MÃI. Cây chunk bản build hiện tại dừng đúng ở đáy giới hạn nên chưa nổ;
        thêm một tầng `dynamic import` là nổ. Nay chỉ kiểm thứ đã thử tải. */
    const attempted = new Set();
    let wave = [];
    const push = (u) => {
      if (seen.has(u)) return;
      if (seen.size >= PRECACHE_MAX_URLS) {
        capped = true;
        return;
      }
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
    /*  Có trần thời gian: sóng chập chờn thì tải có thể treo rất lâu, mà cài
        xong vỏ mới còn quan trọng hơn việc tải đủ chunk (chunk thiếu sẽ được
        cất lúc bà con mở trang, nhánh cache-first bên dưới).
        TRẦN LÀ MỐC TUYỆT ĐỐI DÙNG CHUNG (2026-08-02, phát hiện thêm ở lô A):
        hàm này được gọi HAI LẦN trong một mẻ install, mỗi lần trước đây tự dựng
        `deadline` riêng ⇒ ngân sách thật là 2 × PRECACHE_MAX_MS = 40 giây, chưa
        kể `addAll`. iOS giết SW đang install rất mạnh tay, mà thiết kế ở đây là
        fail-hard ⇒ mỗi giây thừa là thêm xác suất rơi vào đúng ca C-2. Và
        `setTimeout` cũ KHÔNG BAO GIỜ được `clearTimeout` nên vòng đầu để lại
        một timer treo tới hết đời service worker. */
    let timedOut = false;
    const endAt = deadlineAt ?? Date.now() + PRECACHE_MAX_MS;
    const deadline = new Promise((resolve) => {
      timerId = setTimeout(
        () => {
          timedOut = true;
          resolve([]);
        },
        Math.max(0, endAt - Date.now()),
      );
    });
    for (let d = 0; d <= PRECACHE_MAX_DEPTH && wave.length && !timedOut; d++) {
      const batch = wave;
      wave = [];
      for (const u of batch) attempted.add(u);
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
    // KIỂM LẠI: mọi URL ĐÃ THỬ TẢI có thật nằm trong kho không. Người gọi dùng
    // cờ này để quyết định install có được coi là xong hay không. KHÔNG duyệt
    // `seen` — xem ghi chú `attempted` ở trên (A5).
    for (const u of attempted) {
      if (!(await store.match(u))) return { ok: false, capped, urls: [] };
    }
    /*  HẾT GIỜ MÀ KHÔNG CÒN VIỆC = VẪN XONG (sửa 2026-08-02b, soát chéo bắt).
        Trước đây `ok: !timedOut` buộc cứng vào đồng hồ, nên một mẻ mà 100% chunk
        đã có sẵn trong kho (vòng phụ dùng lại chunk của vòng sống-còn) vẫn bị
        gắn `ok:false` chỉ vì mốc chung đã cạn — rồi cái `false` đó đi thẳng
        sang nhánh bỏ bốn màn dock. `wave` rỗng nghĩa là không còn URL nào chờ
        tải; hết giờ lúc đó là hết giờ ở vạch đích. */
    const cutShort = timedOut && wave.length > 0;
    return { ok: !cutShort, capped, urls: [...attempted] };
  } catch {
    /* không tải sẵn được thì báo thiếu, đừng nuốt */
    return { ok: false, capped: false, urls: [] };
  } finally {
    if (timerId != null) clearTimeout(timerId);
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
  /*  TẢI VÀO KHO TẠM TRƯỚC, XONG XUÔI MỚI ĐỔI KHO ĐANG PHỤC VỤ
      (2026-08-02, audit C-2 — lỗi CHẶN).

      LỖI ĐÃ SỬA: install ghi thẳng `addAll` vào `SDFISH_CACHE_V` — ĐÚNG cái kho
      service worker cũ đang dùng để phục vụ — rồi MỚI tới bước có quyền hỏng
      (tải JS/CSS, chunk MapLibre ~1 MB, trần 20 s). Ở cảng sóng chập chờn:
      HTML bản MỚI đã nằm trong kho ⇒ bước JS hết giờ ⇒ throw ⇒ install hỏng ⇒
      trình duyệt vứt SW mới và GIỮ BẢN CŨ — nhưng bản cũ không có kho riêng để
      lùi về, nó đang phục vụ HTML bản mới gọi tên chunk băm mới (504). Ra khơi
      mở app = TRẮNG MÀN cả chuyến, mà chip "sẵn sàng đi biển" vẫn xanh vì
      `SHELL_READY_MARK` của lần install cũ còn nằm nguyên trong kho.
      Nhánh fail-safe "thà cài hỏng ở bờ" vì không tách kho tạm nên TỰ TẠO RA
      đúng trạng thái nó muốn tránh.

      Nay: mọi thứ có thể hỏng đều làm trên kho tạm; kho đang phục vụ chỉ bị
      đụng ở bước cuối, khi đã chắc có đủ HTML + JS/CSS. Chunk băm tên vẫn ghi
      thẳng vào `SDFISH_STATIC_V` — an toàn, vì tên có băm nên bản build mới
      KHÔNG đè lên chunk bản cũ đang chạy. */
  await caches.delete(SDFISH_STAGE_V); // mẻ cài hỏng dở lần trước → bỏ, làm lại
  const stage = await caches.open(SDFISH_STAGE_V);
  // nguyên khối — hỏng một là hỏng cả mẻ, và ném ra ngoài.
  // `cache: "reload"` để KHÔNG lấy bản cũ trong kho HTTP của trình duyệt: vỏ
  // vừa deploy mà cất nhầm HTML bản trước là chunk gọi tên không còn ai giữ.
  await stage.addAll(
    CRITICAL_SHELL.map((u) => new Request(u, { cache: "reload" })),
  );
  // kiểm lại: có thật nằm trong kho không (quota đầy vẫn có thể trượt)
  for (const u of CRITICAL_SHELL) {
    const hit = await stage.match(u);
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
  // MỘT hạn chót cho CẢ mẻ install (xem ghi chú trong precacheShellAssets):
  // trước đây hai lần gọi = hai đồng hồ 20 s riêng = ngân sách thật 40 s.
  const deadlineAt = Date.now() + PRECACHE_MAX_MS;
  const critical = await precacheShellAssets(criticalPages, stage, deadlineAt);
  if (!critical.ok) throw new Error("thiếu JS/CSS của vỏ sống-còn");

  /*  TỚI ĐÂY MỚI ĐỤNG KHO ĐANG PHỤC VỤ: đã có đủ HTML sống-còn + JS/CSS của
      chúng. Copy từng mục — không xoá kho cũ, chỉ đè đúng 7 khoá sống-còn, nên
      không có khe nào bà con mở app mà kho trống. */
  const c = await caches.open(SDFISH_CACHE_V);
  for (const u of CRITICAL_SHELL) {
    const hit = await stage.match(u);
    if (hit) await c.put(u, hit);
  }
  await caches.delete(SDFISH_STAGE_V);

  /*  Phần "có thì tốt" (/tau /nguoi /tien /cang + icon + mùa vụ) — CŨNG đi qua
      kho tạm (2026-08-02, audit A8). Trước đây `allSettled` ghi thẳng vào kho
      sống rồi VỨT kết quả `precacheShellAssets(optional)`: bốn màn dock có thể
      có HTML bản mới mà thiếu chunk ⇒ giữa biển bấm Tàu cá / Bạn thuyền là
      màn trắng, trong khi tủ giấy tờ và sổ thuyền viên nằm sẵn trong máy.
      Nay: có đủ chunk thì mới đổi; không đủ thì GIỮ NGUYÊN bản cũ đang chạy
      được. Vẫn best-effort — thiếu cả nhóm này KHÔNG làm install hỏng. */
  try {
    const optional = SHELL.filter((u) => !CRITICAL_SHELL.includes(u));
    const stage2 = await caches.open(SDFISH_STAGE_V);
    const added = [];
    for (const u of optional) {
      try {
        await stage2.add(new Request(u, { cache: "reload" }));
        added.push(u);
      } catch {
        /* thiếu màn phụ thì thôi — bản cũ trong kho vẫn dùng được */
      }
    }
    /*  ĐỒNG HỒ RIÊNG cho nhóm phụ (sửa 2026-08-02b, soát chéo bắt được).
        Dùng chung `deadlineAt` với vòng sống-còn là sai: vòng một nuốt gần trọn
        20 giây (đo trên bản build thật: 27 URL / 2,48 MB), vòng hai chỉ cần
        thêm ~281 KB nhưng thường chỉ còn 1–5 giây ⇒ `timedOut` ⇒ `ok:false` ⇒
        bốn màn dock bị bỏ. Ngân sách riêng, nhỏ, không kéo dài install. */
    const optRes = await precacheShellAssets(
      added,
      stage2,
      Date.now() + OPTIONAL_PRECACHE_MAX_MS,
    );
    for (const u of added) {
      const isPage = !u.includes(".");
      /*  HỒI QUY ĐÃ SỬA (2026-08-02b): trước đây thiếu chunk là `continue` để
          "giữ nguyên bản cũ đang chạy được" — giả định đó SAI ở lần cài ĐẦU
          TIÊN: máy trắng thì kho chưa có `/tau` nào để mà giữ, nên kết quả
          không phải "giữ bản cũ" mà là "KHÔNG CÓ BẢN NÀO". Giữa biển bấm Tàu cá
          để lấy giấy tờ trình biên phòng thì rơi về Trang chủ, suốt cả chuyến —
          tệ hơn hẳn bản trước bản vá (bản đó luôn ghi HTML vô điều kiện).
          Nay chỉ nhường cho bản cũ khi bản cũ THẬT SỰ có trong kho. */
      if (!optRes.ok && isPage && (await c.match(u))) continue;
      const hit = await stage2.match(u);
      if (hit) await c.put(u, hit);
    }
  } catch {
    /* nhóm phụ hỏng thì thôi, không được kéo install hỏng theo */
  }
  await caches.delete(SDFISH_STAGE_V);
  /*  Danh sách URL để client KIỂM LẠI được, và cờ "có đủ không".
      Người gọi (sự kiện install) dùng nó để quyết định có ghi dấu "vỏ đã đủ".
      BỐN MÀN DOCK NẰM TRONG DANH SÁCH KIỂM (2026-08-02b): thiếu chúng thì vỏ
      CHƯA đủ — nói thật, đừng để chip xanh trên một cái vỏ mất bốn màn. */
  const dockPages = SHELL.filter(
    (u) => !u.includes(".") && !CRITICAL_SHELL.includes(u),
  );
  /*  Hỏi thẳng KHO, không hỏi "mẻ này có ghi không": một màn dock đã nằm sẵn
      trong kho từ lần cài trước (bản cũ, vẫn chạy được) thì vỏ vẫn đủ — bắt chip
      đỏ vì mẻ này không ghi lại nó là báo động oan. */
  const dockInCache = [];
  for (const u of dockPages) if (await c.match(u)) dockInCache.push(u);
  return {
    complete: !critical.capped && dockInCache.length === dockPages.length,
    urls: [...CRITICAL_SHELL, ...critical.urls, ...dockInCache],
  };
}

/*  DẤU "VỎ ĐÃ ĐỦ" — nguồn SỰ THẬT DUY NHẤT cho chữ "sẵn sàng đi biển".
    Trước đây app tự kết luận bằng cách đếm localStorage, còn service worker cài
    đủ hay chưa thì KHÔNG AI ĐỌC ⇒ chip có thể báo xanh trên một cái vỏ rỗng.
    Nay install chỉ ghi dấu này khi ĐÃ qua hết cửa (vỏ sống-còn + JS của nó);
    client đọc bằng caches.match, không cần postMessage, không cần bắt tay. */
const SHELL_READY_MARK = "/__sdfish-shell-ready";

/*  Dọn kho tạm rồi NÉM TIẾP — install hỏng không được để lại ~700 KB bản sao vỏ
    nằm chiếm chỗ trên máy bà con (2026-08-02b). Lỗi vẫn phải nổi lên cho trình
    duyệt biết mà giữ service worker cũ. */
async function installShellClean() {
  try {
    return await installShell();
  } catch (e) {
    await caches.delete(SDFISH_STAGE_V).catch(() => {});
    throw e;
  }
}

self.addEventListener("install", (event) => {
  // KHÔNG bọc .catch: để lỗi nổi lên cho trình duyệt biết install thất bại.
  event.waitUntil(
    installShellClean()
      .then(async ({ complete, urls }) => {
        const c = await caches.open(SDFISH_CACHE_V);
        /*  DẤU PHẢI CHỨNG MINH ĐƯỢC (2026-08-02, audit A7/K5). Trước đây dấu chỉ
            nói "một lần install nào đó trong quá khứ đã xong" — nó không biết
            chunk sau đó có bị `trimCache` đuổi hay không, nên chip "sẵn sàng đi
            biển" xanh trên một cái vỏ đã gãy. Nay ghi kèm DANH SÁCH URL để
            client kiểm lại từng cái lúc đọc.
            Và nếu mẻ này bị cắt trần số URL (không tải đủ) thì XOÁ dấu cũ đi —
            đúng lúc này kho vỏ đã mang HTML bản mới, nên dấu cũ là dấu nói dối.
            Lưu ý: KHÔNG xoá dấu ở ĐẦU install — install hỏng thì vỏ cũ còn
            nguyên và dấu cũ vẫn đúng. */
        if (!complete) {
          await c.delete(SHELL_READY_MARK);
          return;
        }
        await c.put(
          SHELL_READY_MARK,
          new Response(JSON.stringify({ at: Date.now(), urls }), {
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

/*  GIỮ SERVICE WORKER SỐNG TỚI KHI GHI XONG KHO (2026-08-02, phát hiện thêm ở
    lô B). Mọi nhánh trước đây `caches.open(...).then(c => c.put(...))` kiểu
    bắn-rồi-quên: trình duyệt được phép giết SW ngay sau khi promise của
    `respondWith` xong, mà chính file này đã ghi nhận luật đó khi vá cú `ack`
    ("iOS giết SW rất mạnh tay"). Nuốt lỗi ở đây — ghi được thì tốt, không thì
    thôi, tuyệt đối không để hỏng cú trả về cho trang. */
/*  ĐUA MỘT PROMISE VỚI ĐỒNG HỒ, XONG THÌ DỌN TIMER (2026-08-02b).
    Trước đây mỗi nhánh tự dựng `new Promise(r => setTimeout(r, ms))` và KHÔNG
    BAO GIỜ `clearTimeout`: mở `/ngu-truong` một lần (~27 asset) là để lại ~27
    timer 20 giây treo, giữ service worker bận và tốn pin của bà con giữa biển.
    Thắng cuộc đua trả về giá trị; hết giờ trả `undefined` — chỗ gọi tự lo
    đường lùi (và LUÔN phải kết bằng một Response thật). */
function raceTimeout(promise, ms) {
  let id = null;
  const timer = new Promise((resolve) => {
    id = setTimeout(() => resolve(undefined), ms);
  });
  return Promise.race([promise, timer]).finally(() => {
    if (id != null) clearTimeout(id);
  });
}

function keepAlive(event, promise) {
  const p = promise.catch(() => {});
  try {
    event.waitUntil(p);
  } catch {
    /* một số ca event đã "xong" — kệ, promise vẫn chạy */
  }
  return p;
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

/*  Ô bản đồ chờ mạng bao lâu rồi lấy ô đã cất (2026-08-02, audit B3). Ô nhỏ
    (~20 KB) nên 8 giây là rộng rãi cho 3G thật; quá đó gần như chắc chắn là ca
    "sóng sống mà chết" — mà nhánh này trước KHÔNG có đồng hồ nên ô đã nằm sẵn
    trong máy vẫn không được vẽ, bản đồ đứng im không báo gì. */
const TILE_NETWORK_MS = 8000;

/** Ô bản đồ: có mạng lấy mới + cất vào kho có trần; mất mạng lấy ô đã cất. */
function tileFirst(event) {
  const req = event.request;
  const cached = () =>
    caches
      .open(SDFISH_TILE_V)
      .then((c) => c.match(req))
      // không có ô đã cất → 204 để bản đồ coi là ô trống, không báo lỗi đỏ
      .then((hit) => hit || new Response(null, { status: 204 }))
      .catch(() => new Response(null, { status: 204 }));
  const net = fetch(req)
    .then((res) => {
      /*  NGUỒN NÓI "KHÔNG HỎI ĐƯỢC" (503 từ /api/tiles, 5xx/429 khác) → lấy ô
          đã cất, ĐỪNG trả ô hỏng ra bản đồ (2026-08-02, đi kèm B2). Không có ô
          cất thì `cached()` tự trả 204 — bản đồ coi là ô trống như trước, không
          hiện lỗi đỏ giữa biển. 204 "trống thật" (ngoài dải zoom) vẫn `res.ok`
          nên đi thẳng, không rơi vào đây. */
      if (!res.ok) return cached();
      {
        const copy = res.clone();
        // GHI VÀO KHO PHẢI NẰM TRONG waitUntil (2026-08-02): trình duyệt được
        // phép giết SW ngay khi promise của respondWith xong — iOS rất mạnh
        // tay. Bắn-rồi-quên nghĩa là mẻ tải sẵn trước chuyến có thể trả dữ
        // liệu cho màn hình mà KHÔNG kịp ghi vào kho: ra khơi kho rỗng trong
        // khi mọi chỉ báo đều xanh vì bà con đã thấy dữ liệu trên màn rồi.
        keepAlive(
          event,
          caches.open(SDFISH_TILE_V).then(async (c) => {
            await c.put(req, copy);
            await trimTileCache(c);
          }),
        );
      }
      return res;
    })
    .catch(() => cached());
  // Hết giờ thì lấy ô trong máy; `net` vẫn chạy nền và vẫn cất cho lần sau.
  return raceTimeout(net, TILE_NETWORK_MS).then((winner) => winner || cached());
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
function navigationFirst(event) {
  const req = event.request;
  const net = fetch(req).then((res) => {
    if (res.ok) {
      const copy = res.clone();
      keepAlive(
        event,
        caches.open(SDFISH_CACHE_V).then((c) => c.put(req, copy)),
      );
    }
    return res;
  });
  net.catch(() => {}); // đừng để promise lỗi lửng lơ
  return raceTimeout(
    net.then(
      (r) => r,
      () => undefined,
    ),
    NAV_NETWORK_MS,
  ).then(async (winner) => {
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
    const hit = await caches.match(req);
    if (hit) return hit;
    /*  TRANG NGOÀI KHO + MẠNG TREO (2026-08-02, audit A3). Bản trước chờ
          `net.catch(...)` — mà `.catch` CHỈ nổ khi mạng reject. Ca "sóng sống
          mà chết" làm `net` không bao giờ settle ⇒ điều hướng tới trang chưa
          lưu (`/login`, `/dang-ky`, `/doi-mat-khau`, `/quan-tri`) treo vô hạn:
          bị đăng xuất giữa biển là màn TRẮNG, không có cả nút quay lại.
          Nay có trần thứ hai: hết `NAV_GIVEUP_MS` thì đành lùi về vỏ app —
          bà con vẫn vào được Trang chủ và dữ liệu trong máy. */
    const late = await raceTimeout(
      net.then(
        (r) => r,
        () => undefined,
      ),
      NAV_GIVEUP_MS,
    );
    /*  PHẢI TRẢ VỀ MỘT Response THẬT (sửa 2026-08-02b, soát chéo bắt được):
        `respondWith(undefined)` bị spec coi là lỗi ⇒ trình duyệt hiện màn lỗi
        mạng của NÓ, mất luôn câu tiếng Việt của mình. Ca chạm tới: kho vỏ bị
        trình duyệt dọn (iOS xoá dữ liệu trang không dùng ~7 ngày) trong khi
        đăng ký service worker còn sống. */
    return (
      late ||
      (await caches.match("/")) ||
      new Response(
        "<!doctype html><meta charset=utf-8>" +
          "<meta name=viewport content='width=device-width,initial-scale=1'>" +
          "<div style='font:600 18px/1.6 system-ui;padding:32px;text-align:center'>" +
          "<p>Chưa mở được trang này — máy đang không có sóng.</p>" +
          "<p>Bà con thử lại lúc có sóng nhé.</p></div>",
        {
          status: 503,
          headers: { "content-type": "text/html; charset=utf-8" },
        },
      )
    );
  });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // POST (login, gửi yêu cầu) → mạng lo

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // nguồn ngoài

  const isNavigation = req.mode === "navigate";
  const isApi = url.pathname.startsWith("/api/");

  if (url.pathname.startsWith("/api/tiles/")) {
    event.respondWith(tileFirst(event));
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
    event.respondWith(navigationFirst(event));
    return;
  }

  if (isApi) {
    // network-first: ưu tiên dữ liệu mới, mất mạng dùng cache/last-good.
    const net = fetch(req)
      .then(async (res) => {
        if (res.ok && req.method === "GET") {
          const copy = res.clone();
          // dữ liệu /api/* vào kho RIÊNG — không mất khi bump vỏ
          keepAlive(
            event,
            caches.open(SDFISH_API_V).then(async (c) => {
              await c.put(req, copy);
              await trimCache(c, API_CACHE_MAX);
            }),
          );
          return res;
        }
        // LỖI mà kho có bản tốt → trả bản đó. Hai loại được cứu (xem
        // isRescuableStatus): NGUỒN HỎNG (503 của /api/storms khi GDACS chết,
        // 503 của fish-forecast khi snapshot lẫn live đều sập) và HẾT HẠN/CHƯA
        // ĐĂNG NHẬP (401/403 — premium gác cửa TẢI, không gác cửa XEM, luật
        // 2026-08-01). Bản trong kho có mốc thời gian, client tự nói cũ bao lâu.
        // KHÔNG xoá bản cũ ở đây: payload bản đồ cá CHỈ tồn tại trong kho này
        // (fish-predict chỉ lưu DẤU), mà middleware fail-closed nên một cú
        // 403 thoáng qua giữa biển sẽ xoá vĩnh viễn thứ không tải lại được.
        if (!isRescuableStatus(res.status)) return res; // 404… → nói thật
        const hit = await caches.match(req);
        return hit || res;
      })
      /*  KHÔNG có bản trong kho → phải trả một Response THẬT. `caches.match`
          trả `undefined` và `respondWith(undefined)` bị spec coi là lỗi ⇒ trang
          nhận NetworkError chung chung, khó chẩn đoán. Nhánh asset bên dưới vốn
          đã làm đúng (504 gọn) — nay nhánh /api theo cùng chuẩn. */
      .catch(() =>
        caches.match(req).then(
          (h) =>
            h ||
            new Response(JSON.stringify({ ok: false }), {
              status: 504,
              headers: { "content-type": "application/json" },
            }),
        ),
      );
    /*  ĐỒNG HỒ "CÓ BẢN LƯU THÌ ĐỪNG BẮT CHỜ" (2026-08-02, audit B4).
        Trước đây nhánh này CỐ Ý không có đồng hồ, lập luận "client đã có
        AbortSignal riêng". Khúc bị sót: client hủy thì trình duyệt vứt LUÔN cả
        `respondWith`, nên `.catch(() => caches.match(req))` KHÔNG BAO GIỜ chạy
        ⇒ `fetchFishForecast` hủy sau 35 s và màn hình nói "dự báo cá chưa tải
        được" TRONG KHI bản đồ cá đang nằm nguyên trong kho SW.
        Nay: quá API_STALE_MS mà trong kho CÓ bản → trả bản đó ngay (bà con thấy
        dữ liệu thay vì màn trống); KHÔNG có bản thì vẫn chờ mạng hết giờ của
        client, không cắt oan. `net` chạy tiếp và vẫn cất bản mới cho lần sau —
        không mất tính "ưu tiên dữ liệu mới". */
    event.respondWith(
      raceTimeout(net, API_STALE_MS).then(
        (winner) => winner || caches.match(req).then((h) => h || net),
      ),
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
            keepAlive(
              event,
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
                }),
            );
          }
          return res;
        })
        // Mạng hỏng mà kho không có: trả 504 gọn thay vì để promise lửng lơ —
        // trang biết đường lùi (Next chuyển sang điều hướng cứng, và điều hướng
        // đã có bản trong máy để trả).
        .catch(() =>
          caches.match(req).then((h) => h || new Response("", { status: 504 })),
        );
      // ĐỒNG HỒ CHO MỌI NHÁNH (2026-08-02): trước đây chỉ RSC có, còn JS/CSS/
      // font/ảnh trả thẳng `net` ⇒ ca sóng "sống mà chết" treo màn vô hạn (C-3).
      // Thua đồng hồ thì thử kho một lần nữa (mẻ khác có thể vừa cất xong) rồi
      // trả 504 gọn — `net` vẫn chạy nền và vẫn cất, lần sau là có sẵn.
      const limitMs = isRsc ? RSC_NETWORK_MS : ASSET_NETWORK_MS;
      return raceTimeout(net, limitMs).then(
        (winner) =>
          winner ||
          caches.match(req).then((h) => h || new Response("", { status: 504 })),
      );
    }),
  );
});

/*
  WEB PUSH (2026-07-28, Phase 3) — admin gửi thông báo per-user/broadcast từ
  /quan-tri qua /api/admin/push (server dùng web-push + VAPID). Payload JSON
  {title, body, url}. Độc lập với cache versioning ở trên — không đụng gì.
*/
/*  TIN PHẢI TỰ KHAI TUỔI (2026-08-01, chủ dự án chốt: giữ TTL 4 tuần nhưng
    "user nhận biết được tin đó trễ bao nhiêu ngày").
    Mất sóng thì Apple/Google GIỮ tin rồi đẩy khi máy online lại — tin bão gửi
    hôm nay có thể nổ trên máy bà con hai tuần sau, đọc như đang xảy ra. Với app
    của ngư dân đó là nói dối chuyện tính mạng.
    GIỮ ĐỒNG BỘ với src/lib/push-message.ts (có test đọc file này bắt lệch). */
const PUSH_FRESH_MS = 2 * 60 * 60 * 1000;

/** Trần cho cú báo biên nhận — xem ghi chú tại chỗ dùng (audit F7) */
const ACK_TIMEOUT_MS = 10000;

function formatSentAtVN(ms) {
  const d = new Date(ms + 7 * 3600 * 1000); // UTC+7
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())} ${p(d.getUTCDate())}/${p(
    d.getUTCMonth() + 1,
  )}`;
}

function staleWarningVN(sentAtMs, nowMs) {
  const late = nowMs - sentAtMs;
  if (!Number.isFinite(late) || late < PUSH_FRESH_MS) return null;
  const hours = Math.round(late / 3600000);
  if (hours < 24) return `TIN CŨ ${hours} GIỜ TRƯỚC —`;
  return `TIN CŨ ${Math.round(hours / 24)} NGÀY TRƯỚC —`;
}

function pushBodyVN(body, sentAtMs, nowMs) {
  if (sentAtMs == null || !Number.isFinite(sentAtMs)) return body;
  const warn = staleWarningVN(sentAtMs, nowMs);
  return [warn, body, `(tin lúc ${formatSentAtVN(sentAtMs)})`]
    .filter(Boolean)
    .join(" ");
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || "SDFish";
  const sentAtMs = data.sentAt ? Date.parse(data.sentAt) : NaN;
  const options = {
    body: pushBodyVN(data.body || "", sentAtMs, Date.now()),
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    // giờ hệ điều hành hiện cạnh thông báo = GIỜ GỬI THẬT, không phải giờ tới
    ...(Number.isFinite(sentAtMs) ? { timestamp: sentAtMs } : {}),
    data: { url: data.url || "/", messageId: data.messageId || null },
  };
  /* BÁO VỀ "ĐÃ NHẬN" (0023): gửi xong chỉ biết đã đẩy tới Apple/Google, không
     biết máy bà con có nhận không. Nhánh này CHẠY THẬT trên máy khi tin tới, mà
     lúc đó máy đang có mạng (nó vừa nhận được push) ⇒ cú báo gần như luôn đi
     được. Bắn rồi quên: hỏng thì thôi, KHÔNG được cản việc hiện thông báo. */
  const ack =
    data.messageId && self.registration.pushManager
      ? self.registration.pushManager
          .getSubscription()
          .then((sub) =>
            sub
              ? fetch("/api/push/ack", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  // ĐỒNG HỒ (2026-08-02, audit F7): biên nhận treo giữ service
                  // worker sống, tốn pin và sóng của bà con suốt chuyến. Hỏng
                  // thì thôi — lần mở app sau có sóng sẽ báo lại.
                  signal: AbortSignal.timeout(ACK_TIMEOUT_MS),
                  body: JSON.stringify({
                    messageId: data.messageId,
                    endpoint: sub.endpoint,
                    kind: "delivered",
                  }),
                })
              : null,
          )
          .catch(() => {})
      : Promise.resolve();

  event.waitUntil(
    Promise.all([self.registration.showNotification(title, options), ack]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  const messageId =
    event.notification.data && event.notification.data.messageId;
  /* BÁO VỀ "ĐÃ ĐỌC" — bấm được thì đương nhiên đã nhận (route ghi cả hai mốc).
     ⚠️ PHẢI nằm TRONG waitUntil (sửa 2026-08-01p): trước đây cú fetch này đứng
     ngoài, mà trình duyệt được phép giết service worker ngay khi promise trong
     waitUntil xong ⇒ request đang bay bị cắt. iOS giết SW rất mạnh tay đúng
     lúc PWA bật lên foreground, nên bà con CÓ bấm mà "đọc" vẫn không lên. */
  const ack = messageId
    ? self.registration.pushManager
        .getSubscription()
        .then((sub) =>
          sub
            ? fetch("/api/push/ack", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: AbortSignal.timeout(ACK_TIMEOUT_MS), // xem ghi chú ở nhánh push
                body: JSON.stringify({
                  messageId,
                  endpoint: sub.endpoint,
                  kind: "opened",
                }),
              })
            : null,
        )
        .catch(() => {})
    : Promise.resolve();
  const focus = self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client)
          return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    });
  // Mở app KHÔNG được chờ cú báo: biên nhận hỏng thì thôi, bà con vẫn phải vào
  // được app ngay (`ack` đã nuốt lỗi ở trên nên Promise.all không bao giờ reject).
  event.waitUntil(Promise.all([focus, ack]));
});
