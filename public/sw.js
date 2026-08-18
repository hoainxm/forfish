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
  // NHÃN ĐẢO tiếng Việt (ven bờ + Hoàng Sa + Trường Sa) + TUYẾN HÀNG HẢI —
  // chi tiết hải đồ, nhãn chủ quyền. Thiếu là giữa biển mất hết tên đảo, mất
  // định hướng. Asset tĩnh nhỏ (~18 KB + ~3 KB).
  "/data/vn-islands.v1.json",
  "/data/vn-sea-lanes.v1.json",
  // font chữ trên bản đồ (số mét đường đẳng sâu) — thiếu là mất hết CHỮ/SỐ
  "/fonts/Noto%20Sans%20Regular/0-255.pbf",
  /*  FONTSTACK THỨ HAI (2026-08-02, audit A9). Bản đồ dùng HAI fontstack:
      "Noto Sans Regular" (nhãn đẳng sâu, ocean-map.ts) và "Noto Sans Bold"
      (SỐ ĐỘ VĨ/KINH của lưới toạ độ, fishing-map-view.tsx). Chỉ ghim Regular
      ⇒ offline bản đồ vẫn hiện nhưng MẤT HẾT số độ — đúng thứ bà con dùng để
      đối chiếu với máy định vị và hải đồ giấy, mà mất im lặng nên không ai
      biết. Rẻ nhất cả đợt soát: một dòng. */
  "/fonts/Noto%20Sans%20Bold/0-255.pbf",
  /*  DẤU TIẾNG VIỆT cho NHÃN ĐẢO + TUYẾN TÀU (2026-08-07). Nhãn đảo dùng
      fontstack Bold, nhãn tuyến dùng Regular; tên đảo tiếng Việt (đá Chữ Thập,
      Cù Lao Chàm, đảo Song Tử Tây…) rải trên BA dải Unicode: 0-255 (đã có),
      256-511 (ă ơ ư đ Đ) và 7680-7935 (ạ ả ấ ầ ộ ợ ữ…). Thiếu hai dải sau thì
      offline nhãn đảo hiện thiếu chữ / thành ô vuông — đúng nhãn chủ quyền mà
      bà con cần đọc giữa biển. */
  "/fonts/Noto%20Sans%20Bold/256-511.pbf",
  "/fonts/Noto%20Sans%20Bold/7680-7935.pbf",
  "/fonts/Noto%20Sans%20Regular/256-511.pbf",
  "/fonts/Noto%20Sans%20Regular/7680-7935.pbf",
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
    await putWithRoom(store, url, forPut, null, DON_KHI_DAY, SDFISH_STATIC_V);
    return body;
  }
  const net = await fetch(url);
  if (!net.ok) return null;
  // Nhân bản TRƯỚC khi ai đó đọc thân — put() nuốt một bản, đọc chữ một bản.
  const forCache = net.clone();
  const body = isJs ? await net.clone().text() : null;
  /*  QUA `putWithRoom`, KHÔNG `store.put` trần (2026-08-02c, soát chéo bắt).
      Đây là đường CÀI ĐẶT TRÊN MÁY GẦN ĐẦY — chỗ dễ đụng hạn ngạch nhất trong
      cả file, mà lại là chỗ DUY NHẤT còn giữ khuôn `put` trần sau khi bản vá
      T1 dựng `putWithRoom`. `put` ném ở đây thì `precacheOne` reject ⇒ vòng
      kiểm lại cuối `precacheShellAssets` thấy thiếu ⇒ install HỎNG, bà con
      không cập nhật được vỏ chỉ vì máy đầy vài trăm KB.
      KHÔNG truyền `max`/`trimFn`: `precacheShellAssets` đã gọi
      `trimCache(store, STATIC_CACHE_MAX)` MỘT LẦN ở cuối; trim mỗi asset là
      thêm ~120 lượt `cache.keys()` vào đúng mẻ install đang chạy đua với
      PRECACHE_MAX_MS. */
  await putWithRoom(store, url, forCache, null, DON_KHI_DAY, SDFISH_STATIC_V);
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
  /*  Có mục sống-còn nào đi qua CHUYỂN HƯỚNG không — xem ghi chú ngay dưới. */
  let criticalRedirected = false;
  for (const u of CRITICAL_SHELL) {
    const hit = await stage.match(u);
    /*  ĐỪNG CẤT BẢN ĐÃ ĐI QUA CHUYỂN HƯỚNG (2026-08-02, audit R11 — bẫy chờ).
        `Cache.put` KHÔNG ném với response redirect (spec chỉ ném với 206 /
        `Vary: *` / thân đã dùng), nên chỗ này im lặng nhận. Bẫy nằm ở LÚC PHỤC
        VỤ: `navigationFirst` gọi `caches.match(req)` cho request điều hướng —
        request đó có `redirect: "manual"`, mà trả về một Response
        `redirected = true` thì trình duyệt coi là NETWORK ERROR ⇒ MÀN TRẮNG
        OFFLINE, đúng lúc bà con mở app giữa biển.
        Nhánh "từ mạng" đã gác `opaqueredirect` từ 2026-08-01 (xem
        `navigationFirst`); đường "từ kho" thì tới nay chưa ai gác. Hiện chưa nổ
        vì không route nào trong SHELL redirect — đóng lúc còn rẻ.
        HAI CA, HAI CÁCH XỬ (tách 2026-08-02c, soát chéo bắt được — trước đây
        gộp làm một cú `throw`):
         · `!hit` — `stage.addAll` báo xong mà kho tạm KHÔNG có ⇒ máy đang hỏng
           thật (hạn ngạch, kho bị dọn giữa chừng). NÉM: cài hỏng ở bờ thì thử
           lại được, còn "cài xong" trên vỏ rỗng thì bà con chỉ biết khi đã ra
           khơi.
         · `hit.redirected` — KHÔNG ném. Ca này không phải máy hỏng mà là CẤU
           HÌNH ĐỔI (thêm một cú redirect lên "/" hay "/ngu-truong", kể cả tạm ở
           tầng hosting). Ném ở đây biến một dòng cấu hình thành: install hỏng
           trên MỌI máy, MỌI lần — máy đã cài thì đứng lại ở vỏ cũ, máy mới cài
           thì KHÔNG CÓ VỎ NÀO, và không một lời cảnh báo. Nay: không cất bản
           redirect (bất biến R11 giữ nguyên — bản redirect nằm trong kho vỏ =
           màn trắng lúc điều hướng offline), giữ nguyên bản cũ nếu kho đã có,
           và HẠ CỜ `complete` ⇒ chip nói thật "vỏ chưa đủ" thay vì app sập câm.
           KHÔNG dùng `continue` trần như đề xuất ban đầu: `dockInCache` chỉ đếm
           bốn màn dock, KHÔNG đếm CRITICAL_SHELL, nên `continue` mà không hạ cờ
           là chip XANH trên một cái vỏ thiếu "/" — đúng lời hứa dối phải diệt. */
    if (!hit) {
      throw new Error(`vỏ sống-còn không cất được: ${u}`);
    }
    if (hit.redirected) {
      criticalRedirected = true;
      continue;
    }
    await c.put(u, hit);
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
      // `redirected` → bỏ qua, KHÔNG ném (nhóm phụ không được kéo install hỏng).
      // Lý do xem ghi chú R11 ở vòng vỏ sống-còn bên trên: bản redirect nằm
      // trong kho = màn trắng lúc điều hướng offline. Thiếu thì `dockInCache`
      // đếm hụt ⇒ chip báo vỏ CHƯA đủ, nói thật.
      if (hit && !hit.redirected) await c.put(u, hit);
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
    /*  `!criticalRedirected`: một mục sống-còn đi qua chuyển hướng thì nó KHÔNG
        nằm trong kho vỏ (xem vòng copy bên trên) ⇒ vỏ chưa đủ, chip phải đỏ. */
    complete:
      !critical.capped &&
      !criticalRedirected &&
      dockInCache.length === dockPages.length,
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

/*  GIỮ SỐNG CHO MẺ TẢI VỀ MUỘN (2026-08-02, audit T2 — lỗi CHẶN).

    SỰ KIỆN: bốn nhánh mạng đều đăng ký `keepAlive` BÊN TRONG `.then` của `net`
    ("mạng về thì cất vào kho"). Nhưng từ 2026-08-02 mọi nhánh đều ĐUA ĐỒNG HỒ:
    khi `raceTimeout` thắng, promise của `respondWith` settle NGAY, trong khi
    `.then` của `net` còn chưa chạy. Lúc `net` về thật thì `event.waitUntil` ném
    `InvalidStateError` (sự kiện đã xong, không còn promise nào treo) — và
    `keepAlive` nuốt đúng lỗi đó ⇒ CÚ GHI KHO KHÔNG BAO GIỜ ĐƯỢC BẢO VỆ, trình
    duyệt được phép giết service worker giữa chừng ⇒ BẢN MỚI KHÔNG VÀO KHO.
    Nổ dày nhất ở điều hướng (`NAV_NETWORK_MS` chỉ 2500 ms): ngoài khơi gần như
    lần nào mạng cũng về sau đồng hồ, tức là gần như KHÔNG BAO GIỜ cất được
    trang mới — kho vỏ đứng yên ở bản của lần cài đặt.

    Cách chữa: đăng ký giữ-sống NGAY khi tạo `net`, lúc `respondWith` chắc chắn
    còn treo, nên `waitUntil` nhận đúng.

    ⚠️ VÌ SAO PHẢI BỌC THÊM MỘT ĐỒNG HỒ (đừng gỡ): `raceTimeout` CỐ Ý không hủy
    `fetch` (mẻ tải chạy nền để lần sau có sẵn). Ở đúng ca "sóng sống mà chết"
    thì `net` có thể KHÔNG BAO GIỜ settle ⇒ `waitUntil` giữ service worker sống
    vô hạn: ghim CPU + radio, đốt pin điện thoại của bà con giữa biển. Nên chặn
    hai đầu: giữ sống đủ lâu cho mẻ về muộn (gấp đôi trần của nhánh, rộng rãi
    cho sóng 3G thật), rồi buông. */
function keepAliveLate(event, net, limitMs) {
  return keepAlive(event, raceTimeout(net, limitMs * 2));
}

/** Giữ một kho trong trần: Cache API trả key theo thứ tự thêm vào → bỏ từ đầu. */
async function trimCache(cache, max) {
  const keys = await cache.keys();
  const over = keys.length - max;
  for (let i = 0; i < over; i++) await cache.delete(keys[i]);
}

/*  MÁY SẮP ĐẦY THÌ HY SINH Ô BẢN ĐỒ, ĐỪNG ĐỂ CHẠM VÀO DỰ BÁO (2026-08-02k).

    Chủ dự án chốt thứ tự: *"1- token · 2- sóng + gió + dòng chảy · 3- cá · 4-
    các lớp khác"*, và riêng về kho: *"khi dọn dung lượng, xóa tile cũ trước,
    không xóa gói dự báo mới nhất."*

    VÌ SAO TRẦN 600 Ô KHÔNG ĐỦ ĐỂ GIỮ LỜI HỨA ĐÓ: ô bản đồ và dự báo nay nằm hai
    kho khác nhau (Cache Storage vs IndexedDB) NHƯNG **dùng chung một hạn ngạch
    theo origin**. Nên 600 ô nặng vài chục MB vẫn có thể ăn hết chỗ mà lẽ ra
    dành cho gói 16 ngày — rồi lượt ghi dự báo kế tiếp hỏng, trong khi trần ô
    vẫn "chưa chạm". Trần theo SỐ Ô không nói gì về BYTE.

    Nay hỏi thẳng máy còn bao nhiêu chỗ; sắp cạn thì siết trần ô xuống. Ô bản đồ
    có sóng là tải lại được — dự báo giữa biển thì không. Hỏi hỏng / máy không có
    Storage API ⇒ giữ nguyên trần cũ, không đoán.
*/
const TILE_CACHE_MIN = 120;
/** Dưới ngần này MB trống thì coi là máy sắp cạn (đủ chỗ cho ~2 gói 16 ngày). */
const KHO_CAN_MB = 60;

async function tranOHienGio() {
  try {
    const st = self.navigator && self.navigator.storage;
    if (!st || typeof st.estimate !== "function") return TILE_CACHE_MAX;
    const e = await st.estimate();
    if (!e || typeof e.quota !== "number") return TILE_CACHE_MAX;
    const tuDoMb = (e.quota - (e.usage || 0)) / 1048576;
    return tuDoMb < KHO_CAN_MB ? TILE_CACHE_MIN : TILE_CACHE_MAX;
  } catch {
    return TILE_CACHE_MAX;
  }
}

/** Giữ kho ô bản đồ trong trần — trần SIẾT LẠI khi máy sắp cạn chỗ. */
async function trimTileCache(cache) {
  const max = await tranOHienGio();
  const keys = await cache.keys();
  const over = keys.length - max;
  for (let i = 0; i < over; i++) await cache.delete(keys[i]);
}

/*  GHI VÀO KHO KHI MÁY GẦN HẾT CHỖ (2026-08-02, audit T1).

    SỰ KIỆN: cả ba nhánh cất (ô bản đồ · /api · asset) đều `await c.put(...)`
    RỒI mới `await trim...(...)`, và cả cụm nằm trong `keepAlive` = `.catch(() =>
    {})` ⇒ QuotaExceeded bị nuốt sạch, không ai biết bản mới KHÔNG nằm xuống.

    VÌ SAO ĐẢO THỨ TỰ (trim trước, put sau) LÀ KHÔNG ĐỦ — đọc kỹ chỗ này trước
    khi "đơn giản hoá": `trimCache` đếm theo SỐ ENTRY (trần 120 cho kho API).
    Payload lưới gió/sóng 16 ngày là VÀI MB một bản, nên hạn ngạch của trình
    duyệt cạn từ rất lâu TRƯỚC khi kho chạm 120 mục ⇒ gọi trim trước giải phóng
    đúng 0 byte, rồi `put` vẫn ném y như cũ. Trần-theo-số-mục và hạn-ngạch-theo-
    byte là hai đại lượng khác nhau.

    Nên: bắt lỗi THẬT, dọn theo BYTE rồi THỬ LẠI một lần — cùng lối với
    `saveForecast` bên localStorage (src/lib/forecast-cache.ts: tính `needBytes`
    → dọn → ghi lại, và DỪNG khi dọn không ăn thua). Hỏng lần hai thì để
    `keepAlive` nuốt: cất không được thì thôi, tuyệt đối không phá cú trả về
    đang phục vụ màn hình.

    ⚠️ CHỈ DÙNG CHO KHO CÓ TRẦN (ô bản đồ · API · chunk băm tên · RSC). TUYỆT
    ĐỐI KHÔNG dùng cho kho vỏ `SDFISH_CACHE_V`: mục cũ nhất ở đó là "/",
    "/ngu-truong", nền bản đồ, font — đuổi chúng để nhét một cái icon là tự tay
    xoá vỏ sống-còn giữa biển. `res` phải là bản CLONE chưa ai đọc thân. */

/*  BA HỒI QUY CỦA BẢN VÁ T1 ĐẦU TIÊN, vá ở đây (2026-08-02c, ba agent phản biện
    bắt được) — đọc trước khi "đơn giản hoá" đoạn dưới:

    (a) HẠN NGẠCH LÀ CỦA CẢ ORIGIN, KHÔNG PHẢI CỦA KHO NÀY. Bà con xem 12 MB ô
        bản đồ ở cảng ⇒ hạn ngạch cạn ⇒ `/api/fish-forecast` 3 MB về ⇒ `put` ném
        ⇒ bản cũ dọn 8 mục CỦA KHO API rồi thử lại, vẫn ném vì sức ép nằm ở kho
        ô bản đồ. Ở HEAD: nuốt im, KHÔNG MẤT GÌ. Sau bản vá: MẤT 8 mục mà vẫn
        không ghi được — và nạn nhân đầu tiên là bản `/api/fish-forecast` cũ
        ĐANG DÙNG ĐƯỢC (payload bản đồ cá CHỈ tồn tại trong kho đó). Nay: đo
        BYTE giải phóng được, dọn không ăn thua thì DỪNG, không dọn tiếp.
    (b) SÀN CỨNG 8 GIẾT KHO ÍT MỤC: `Math.max(8, …)` ở một kho 3 mục là xoá sạch
        cả 3. Nay không có sàn; trần là NỬA KHO và kho dưới `RECLAIM_MIN_KEYS`
        mục thì không đuổi ai.
    (c) `trimFn` KHÔNG BAO GIỜ CHẠY khi cú ghi lại ném — tức khuôn `trim`-sau-
        `put` mà chính hàm này sinh ra để diệt vẫn còn nguyên ở đúng ca xấu
        nhất. Nay cú ghi lại nằm trong `try` RIÊNG, trim chạy ở mọi đường ra. */

/** Kho ít hơn bấy nhiêu mục thì đuổi ai cũng vô nghĩa (bỏ 3/3 để nhét 1). */
const RECLAIM_MIN_KEYS = 4;

/*  TRẦN CỠ THÂN ĐƯỢC GIỮ BẢN DỰ PHÒNG (2026-08-02c).
    `res.clone()` TEE đôi dòng dữ liệu: nhánh không ai đọc giữ TRỌN THÂN TRONG
    RAM cho tới khi nhánh kia đọc xong. Mà đường THÀNH CÔNG không bao giờ đụng
    tới bản dự phòng ⇒ với lưới gió/sóng 1,6 MB và bản đồ cá 3 MB trên Android
    rẻ, đó là chi phí RAM THẬT, trả MỌI LẦN GHI, cho một nhánh gần như không
    dùng tới. Nay chỉ giữ bản dự phòng khi thân NHỎ (ô bản đồ ~20 KB, phần lớn
    chunk JS/CSS, phản hồi RSC) — chỗ mà một lần dọn nhỏ đủ mua lại chỗ trống.
    Thân LỚN thì ghi thẳng kiểu dòng chảy, hỏng thì THÔI: không có bản dự phòng
    thì cũng KHÔNG ĐƯỢC XOÁ GÌ — mất mục cũ mà vẫn không ghi được là tệ hơn hẳn
    nuốt im (xem (a) ở trên). */
const SPARE_MAX_BYTES = 1024 * 1024;

/** Cỡ thân một phản hồi (byte). `allowRead` = được phép đọc thân (chỉ dùng cho
    entry SẮP BỊ XOÁ). Trả 0 nghĩa là "không đo được". */
async function bodyBytes(res, allowRead) {
  const len = Number(res.headers.get("content-length"));
  if (Number.isFinite(len) && len > 0) return len;
  if (!allowRead) return 0;
  try {
    return (await res.blob()).size;
  } catch {
    return 0;
  }
}

/*  DỌN CHỖ THEO BYTE, CÓ CẦU DAO. Trả về SỐ BYTE ước đã giải phóng — chỗ gọi
    thấy 0 thì biết dọn không ăn thua (sức ép nằm ở kho khác) và đừng dọn tiếp.
    Cùng lối với `dropOldest`/`saveForecast` bên localStorage.
    Hai trần, KHÔNG có sàn: (1) không bao giờ quá NỬA kho; (2) đủ số byte cần
    thì dừng ngay. */
/*  BẬC HY SINH CHO KHO /api — mirror của `DROP_RANK` bên localStorage.

    ⚠️ VÌ SAO CẦN (chủ dự án hỏi "bản đồ cá sao không cho localStorage để dự
    phòng"): bản đồ cá KHÔNG nhét vừa localStorage (~1,95 MB UTF-16, cộng lưới
    gió 1,58 MB là đã 3,53/5 MB, chưa tính các lớp khác). Nó nằm đúng chỗ rồi —
    Cache API, kho rộng hàng trăm MB. Nhưng ở đó nó **không được bảo vệ gì cả**:
    `reclaimRoom` bỏ thuần FIFO, mà bản đồ cá được tải SỚM trong mẻ tải sẵn nên
    nằm ngay đầu hàng ⇒ **một bản tin giá dầu 10 KB có thể đuổi nguyên bản đồ cá
    1 MB**, và nếu cú ghi lại vẫn hỏng thì mất trắng.

    Nay xếp bậc y như localStorage: thứ RẺ đi trước, và tuyệt đối không hy sinh
    thứ QUÝ HƠN thứ đang ghi. Bản đồ cá + tin bão đứng cao nhất — giữa biển
    không tải lại được, và tin bão thì dính tính mạng. */
const API_DROP_RANK = [
  "/api/port-prices",
  "/api/fuel-price",
  "/api/nautical",
  "/api/sea-scalar",
  "/api/salinity",
  "/api/currents-depth",
  "/api/weather-snapshot",
  "/api/fish-forecast",
  "/api/storms",
];

/** Bậc của một URL trong kho /api. Không nhận ra → coi như rẻ nhất. */
function apiDropRank(url) {
  const p = new URL(url).pathname;
  const i = API_DROP_RANK.findIndex((a) => p === a || p.startsWith(a + "/"));
  return i === -1 ? 0 : i;
}

async function reclaimRoom(c, needBytes, keepUrl) {
  let keys = await c.keys();
  if (keys.length < RECLAIM_MIN_KEYS) return 0;
  /*  Chỉ áp bậc cho kho /api (chỗ duy nhất trộn nhiều loại giá trị khác hẳn
      nhau). Kho ô bản đồ / chunk thì mọi mục ngang hàng, FIFO là đúng. */
  if (keepUrl && new URL(keepUrl).pathname.startsWith("/api/")) {
    const tran = apiDropRank(keepUrl);
    keys = keys
      .filter((r) => apiDropRank(r.url) <= tran && r.url !== keepUrl)
      .sort((a, b) => apiDropRank(a.url) - apiDropRank(b.url));
    if (keys.length < 1) return 0;
  }
  /*  TRẦN LÀ NỬA KHO, KHÔNG CÓ SÀN (sửa 2026-08-02h).
      LỖI ĐÃ SỬA: `Math.max(8, keys.length >> 2)` — cái SÀN 8 nuốt luôn cái trần.
      Kho 4–7 mục thì `maxDrop = 8 > keys.length` ⇒ vòng lặp xoá SẠCH kho, rồi
      còn chạy tiếp với `keys[i] === undefined`. Đúng cảnh máy gần đầy lúc còn ở
      cảng: một lượt làm tươi là bay bản dự báo cuối cùng, ra biển trắng tay.
      `keys.length >> 1` vừa là trần nửa kho vừa tự chặn tràn mảng. */
  const maxDrop = keys.length >> 1;
  let freed = 0;
  // Cache API trả key theo thứ tự THÊM VÀO → bỏ từ đầu = bỏ bản cất sớm nhất.
  for (let i = 0; i < maxDrop; i++) {
    const hit = await c.match(keys[i]);
    const size = hit ? await bodyBytes(hit, true) : 0;
    if (await c.delete(keys[i])) freed += size;
    if (freed >= needBytes) break;
  }
  return freed;
}

/*  Cờ "kho này ĐƯỢC dọn khi đầy, nhưng ĐỪNG trim theo số mục ở mỗi lượt ghi".
    `precacheShellAssets` đã gọi `trimCache(store, STATIC_CACHE_MAX)` MỘT LẦN ở
    cuối; trim mỗi asset là quét lại cả kho hàng trăm lượt. */
const DON_KHI_DAY = async () => {};

async function putWithRoom(c, req, res, max, trimFn, cacheName) {
  /*  ĐO TRƯỚC, KHÔNG ĐỌC THÂN (`allowRead: false`): đọc thân ở đây là hỏng luôn
      cú `put` ngay dưới. Không có `content-length` → 0 → không giữ bản dự phòng,
      cũng không dọn: thà nuốt im còn hơn xoá mù. */
  /*  ═══ LỚP CỐ ĐỊNH THÌ KHÔNG DỌN ═══ (chủ dự án chốt 2026-08-02h)

      Kho nào CÓ trần (`max`) hoặc CÓ hàm trim thì mới là kho tự phình — ô bản
      đồ (bà con kéo tới đâu cất tới đó), kho /api. Chỉ những kho đó mới có thứ
      đáng đuổi, và đuổi cái cũ nhất là đúng.

      Kho KHÔNG trần, KHÔNG trim = `precacheOne` → vỏ app, nền bản đồ, đường bờ,
      độ sâu, font. Đó là LỚP CỐ ĐỊNH: tải một lần, không bao giờ cũ, và mất là
      app không mở nổi giữa biển. Đuổi ở đây thì được vài chục KB mà đổi lấy một
      cái app không chạy — trong khi đường dọn HỢP LỆ của lớp này đã có sẵn và
      đúng: deploy bản mới thì đổi tên kho, `activate` xoá nguyên khối kho cũ.

      Call-site vốn đã tự khai loại kho, nên không phải đổi một chỗ gọi nào. */
  /*  ⚠️ GÁC THEO **TÊN KHO**, KHÔNG GÁC THEO THAM SỐ CHỖ GỌI (sửa 2026-08-02h —
      phản biện bắt: bản vá trước gác nhầm trục).

      Bản trước suy "không trần + không trim ⇒ lớp cố định". Sai, vì `SDFISH_STATIC_V`
      có HAI chỗ ghi: `precacheOne` (không trần) VÀ nhánh fetch cho asset băm tên
      (`max = STATIC_CACHE_MAX` ⇒ `evictable = true`). Đường phá thật: máy gần đầy
      hạn ngạch, bà con mở một màn nạp lazy chunk chưa precache ⇒ `put` ném ⇒
      `reclaimRoom` bỏ **từ đầu hàng** = đúng các chunk `precacheOne` cất SỚM NHẤT
      lúc install = khung sườn + MapLibre của `/` và `/ngu-truong` ⇒ cold-start
      offline giữa biển: `caches.match` trượt, `fetch` hỏng ⇒ **trắng màn**.

      Hai kho dưới đây là LỚP CỐ ĐỊNH: tải một lần, không bao giờ cũ, mất là app
      không mở nổi. Đường dọn hợp lệ duy nhất của chúng là đổi tên kho lúc deploy
      rồi `activate` xoá nguyên khối — nhánh đó không đụng tới đây. */
  /*  ⚠️ CHỈ CHẶN KHO VỎ. Bản trước chặn CẢ `SDFISH_STATIC_V` và đó là một lỗi
      CHẶN do chính bản vá đẻ ra (soát chéo 2026-08-02h bắt được):

      `SDFISH_STATIC_V` là kho CHUNK BĂM TÊN, và nó là kho ĐƯỢC PHÉP dọn — chunk
      của bản build CŨ nằm đó chính là thứ đáng đuổi. Chặn dọn ở đây thì đường
      CÀI ĐẶT trên máy gần đầy (`precacheOne` → `put` ném QuotaExceeded) không
      còn cách nào lấy chỗ ⇒ asset không nằm xuống ⇒ vòng kiểm cuối
      `precacheShellAssets` thấy thiếu ⇒ **install NÉM, service worker mới không
      bao giờ activate, lặp lại mọi lần mở app**. Tức là để tránh mất vài chunk,
      bản vá làm bà con không cài nổi bản mới.

      Kho VỎ (`SDFISH_CACHE_V` — HTML, `/data/*`, `/fonts/*.pbf`, icon) thì khác
      hẳn: mục cũ nhất ở đó là `/` và `/ngu-truong`, mất là app không mở nổi giữa
      biển. Kho này vốn đã không đi qua `putWithRoom` ở cả hai chỗ ghi (`c.put`
      trần) — giữ cổng ở đây là lớp khoá thứ hai, phòng người sau nối nhầm. */
  const evictable = cacheName !== SDFISH_CACHE_V && (max != null || trimFn != null);
  const need = await bodyBytes(res, false);
  const spare = need > 0 && need <= SPARE_MAX_BYTES ? res.clone() : null;
  try {
    await c.put(req, res);
  } catch {
    // QuotaExceeded — kho đầy theo BYTE, trần theo số mục không cứu được
    if (spare && evictable) {
      const freed = await reclaimRoom(c, need, req.url);
      // freed === 0 ⇒ không đuổi được ai (kho quá ít mục) ⇒ đừng thử lại vô ích
      if (freed > 0) {
        try {
          await c.put(req, spare);
        } catch {
          /*  DỌN RỒI VẪN NÉM ⇒ SỨC ÉP NẰM Ở KHO KHÁC (hạn ngạch là của cả
              origin). DỪNG — dọn tiếp chỉ mất thêm bản bà con đang dùng được mà
              vẫn không ghi nổi một byte. Để `keepAlive` nuốt. */
        }
      }
    }
  }
  /*  TRIM CHẠY Ở MỌI ĐƯỜNG RA — đây là lý do cú ghi lại phải nằm trong `try`
      RIÊNG. `max == null && !trimFn` (đường `precacheOne`) thì KHÔNG trim:
      `trimCache(c, null)` sẽ tính `keys.length - null = keys.length` và xoá
      SẠCH KHO. */
  if (trimFn) await trimFn(c);
  else if (max != null) await trimCache(c, max);
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
          caches
            .open(SDFISH_TILE_V)
            .then((c) => putWithRoom(c, req, copy, null, trimTileCache, SDFISH_TILE_V)),
        );
      }
      return res;
    })
    .catch(() => cached());
  keepAliveLate(event, net, TILE_NETWORK_MS);
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
      /*  KHO VỎ KHÔNG DÙNG `putWithRoom`: mục cũ nhất ở đây là "/",
          "/ngu-truong", nền bản đồ, font — đuổi chúng để nhét một trang mới là
          tự tay xoá vỏ sống-còn. Máy hết chỗ thì thà không cất trang này. */
      keepAlive(
        event,
        caches.open(SDFISH_CACHE_V).then((c) => c.put(req, copy)),
      );
    }
    return res;
  });
  net.catch(() => {}); // đừng để promise lỗi lửng lơ
  /*  NAV_GIVEUP_MS chứ không phải NAV_NETWORK_MS: trang chưa có trong kho thì
      nhánh này còn một cuộc đua THỨ HAI, và nó chạy SAU cuộc đua thứ nhất —
      trần thật của nhánh điều hướng là NAV_NETWORK_MS + NAV_GIVEUP_MS =
      2,5 + 8 = 10,5 giây, không phải 8. `keepAliveLate` nhân đôi trần được
      truyền vào (8 × 2 = 16 s) nên vẫn phủ trọn 10,5 s đó; truyền
      NAV_NETWORK_MS vào đây thì mức giữ-sống chỉ còn 5 s, tức tự cắt mẻ tải về
      muộn của chính mình. Xem ghi chú `keepAliveLate`. */
  keepAliveLate(event, net, NAV_GIVEUP_MS);
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
            caches
              .open(SDFISH_API_V)
              .then((c) => putWithRoom(c, req, copy, API_CACHE_MAX, null, SDFISH_API_V)),
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
    keepAliveLate(event, net, API_STALE_MS);
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
      // ĐỒNG HỒ CHO MỌI NHÁNH (2026-08-02): trước đây chỉ RSC có, còn JS/CSS/
      // font/ảnh trả thẳng `net` ⇒ ca sóng "sống mà chết" treo màn vô hạn (C-3).
      // Thua đồng hồ thì thử kho một lần nữa (mẻ khác có thể vừa cất xong) rồi
      // trả 504 gọn — `net` vẫn chạy nền và vẫn cất, lần sau là có sẵn.
      const limitMs = isRsc ? RSC_NETWORK_MS : ASSET_NETWORK_MS;
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
            const store = isRsc
              ? SDFISH_RSC_V
              : isHashed
                ? SDFISH_STATIC_V
                : SDFISH_CACHE_V;
            const max = isRsc
              ? RSC_CACHE_MAX
              : isHashed
                ? STATIC_CACHE_MAX
                : null;
            keepAlive(
              event,
              caches.open(store).then((c) =>
                /*  KHO VỎ (asset không băm tên: icon, /data, /fonts) KHÔNG có
                    trần và KHÔNG được đuổi ai — mục cũ nhất ở đó là "/",
                    "/ngu-truong", nền bản đồ. Chỉ hai kho CÓ TRẦN mới được dọn
                    chỗ khi máy đầy (xem putWithRoom). */
                max == null
                  ? c.put(req, copy)
                  : putWithRoom(c, req, copy, max, null, store),
              ),
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
      keepAliveLate(event, net, limitMs);
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

/*  ĐỒNG HỒ CHẶN CHO fetch — bản NỘI BỘ của `src/lib/abort.ts` (2026-08-02c).
    `sw.js` là script service worker thuần, KHÔNG import được `@/lib/abort`, nên
    phải chép ý tưởng chứ không chia sẻ mã được.

    VÌ SAO KHÔNG GỌI THẲNG `AbortSignal.timeout(...)`: hàm tĩnh đó chỉ có từ
    Safari 16 / Chrome 103. Trên iPhone còn Safari 15 và WebView Android đời cũ
    — đúng nhóm máy của bà con — nó ném `TypeError` NGAY TRONG `.then`, rồi
    `.catch(() => {})` ở cuối chuỗi nuốt sạch ⇒ CÚ BÁO BIÊN NHẬN KHÔNG BAO GIỜ
    ĐƯỢC GỬI: dựng lại đúng cảnh "đã gửi mà đọc 0" mà bản vá 0024 (1b1aeb4) vừa
    dọn, riêng cho nhóm máy cũ, và im lặng tuyệt đối.

    KHÔNG BAO GIỜ ném. Trả `undefined` khi môi trường không có cả
    `AbortController` — `fetch(url, { signal: undefined })` hợp lệ, chỉ là
    không có đồng hồ; thà gửi được biên nhận không đồng hồ còn hơn không gửi. */
function timeoutSignal(ms) {
  try {
    if (
      typeof AbortSignal !== "undefined" &&
      typeof AbortSignal.timeout === "function"
    ) {
      return AbortSignal.timeout(ms);
    }
  } catch {
    /* có tên mà gọi hỏng → rơi xuống đường lùi bên dưới */
  }
  try {
    if (typeof AbortController === "undefined") return undefined;
    const ctrl = new AbortController();
    setTimeout(() => {
      try {
        ctrl.abort();
      } catch {
        /* bỏ qua */
      }
    }, ms);
    return ctrl.signal;
  } catch {
    return undefined;
  }
}

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
    // GOM THEO SỰ KIỆN (2026-08-18, audit P2): server gửi `tag` cho bão
    // (`bao-<khoá>`) và đơn hàng (`don-<id>`) ⇒ tin mới cùng cơn/cùng đơn ĐÈ
    // tin cũ trên màn khoá thay vì xếp chồng 4–5 dòng; `renotify` để lần đè vẫn
    // rung/kêu (bão lên cấp phải đánh thức được). Tin tay không tag → như cũ.
    ...(data.tag ? { tag: String(data.tag), renotify: true } : {}),
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
                  signal: timeoutSignal(ACK_TIMEOUT_MS),
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
                signal: timeoutSignal(ACK_TIMEOUT_MS), // xem ghi chú ở nhánh push
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
