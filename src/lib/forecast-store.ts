// Trục 1 — KHO DỰ BÁO NẰM Ở ĐÂU (tầng cất, tách khỏi tầng luật).
//
// ═══ VÌ SAO CÓ FILE NÀY (chủ dự án chốt 2026-08-02k) ═══
//
// ⚠️ ĐÍNH CHÍNH BẢN ĐẦU (cùng ngày, sau vòng phản biện + tài liệu WebKit chủ dự
// án đưa). Bản đầu của chú thích này viết SAI hai chuyện, và cả hai đều là loại
// sai dẫn người sau đi nhầm đường:
//   · SAI: "IndexedDB được 15–60% dung lượng TRỐNG". Không có hạn mức riêng cho
//     IndexedDB. Nó DÙNG CHUNG hạn ngạch theo origin với Cache Storage,
//     localStorage, Service Worker và File System. Mức trần là theo **tổng dung
//     lượng THIẾT BỊ**, không phải chỗ trống: Safari/PWA màn hình chính tối đa
//     ~60%/origin; WKWebView không phải trình duyệt mặc định thì ~15%.
//   · SAI (ngầm): "Cache API bị dọn sau 7 ngày nên chuyển sang IndexedDB cho an
//     toàn". Luật ITP 7 ngày quét **MỌI kho do JavaScript ghi** — IndexedDB,
//     Cache Storage, SessionStorage, và cả ĐĂNG KÝ SERVICE WORKER — chứ không
//     riêng Cache API. Dời sang IndexedDB KHÔNG thoát được luật đó.
//     Thứ thoát được là **cài ra màn hình chính**: domain chính của PWA A2HS
//     được MIỄN luật 7 ngày. Việc đó app đã làm (`components/install-prompt.tsx`).
//
// ═══ LÝ DO THẬT, VÀ NÓ ĐỦ MẠNH ═══
//
// 1. **localStorage ≈ 5 MB/origin trên WebKit** — hạn mức RIÊNG, nhỏ hơn hẳn hạn
//    ngạch origin, và không co giãn theo máy. Chuỗi lưu dạng UTF-16 nên ~2,5
//    triệu ký tự là chạm. Gói 16 ngày đang chiếm ~4 MB trong đó (riêng ba khung
//    lưới gió/sóng đã 0,67 + 1,10 + 1,58 = 3,35 MB) — tức app nhét gần đầy một
//    cái thùng 5 MB, rồi còn phải chia thùng đó cho chuỗi đăng nhập, danh tính,
//    tủ giấy tờ, sổ bạn thuyền.
//
// 2. **iOS 16 có lỗi: chạm hạn mức localStorage thì XOÁ SẠCH localStorage**
//    (WebKit Bugzilla #245479). Đây mới là chỗ chết người, và nó phá thẳng luật
//    nền của cả kho offline. Thiết kế cũ dựa vào việc BẮT `QuotaExceededError`
//    rồi dọn bớt — nhưng trên iOS 16, đúng lúc ném lỗi đó thì cả thùng đã bay:
//    mất luôn chuỗi đăng nhập (bà con bị đá ra giữa biển), dấu hạng, tủ giấy tờ.
//    Chở 4 MB dự báo trong thùng 5 MB nghĩa là **cố tình chạy sát mép cái lỗi
//    đó mỗi ngày**.
//
// Vậy lý do dời KHÔNG phải "IndexedDB bền hơn trước luật 7 ngày" (không đúng),
// mà là: **lấy khối nặng ra khỏi cái thùng 5 MB, để cái thùng đó không bao giờ
// chạm hạn mức nữa** — nhờ thế thứ nhỏ mà sống còn (chuỗi đăng nhập, danh tính,
// giấy tờ) được yên.
//
// ═══ HỆ QUẢ DỄ HIỂU NHẦM NHẤT — ĐỌC KỸ TRƯỚC KHI "THÊM BẢN DỰ PHÒNG" ═══
//
// Chính sách hạn ngạch của WebKit (số chủ dự án đưa, khớp tài liệu WebKit):
//   · Cache Storage · IndexedDB · localStorage · Service Worker · File System
//     **DÙNG CHUNG MỘT hạn ngạch theo origin** — không kho nào có túi riêng.
//   · Một origin trong Safari/PWA: tối đa ~**60% tổng dung lượng THIẾT BỊ**
//     (tổng dung lượng máy, KHÔNG phải chỗ trống). Đây là mức TRẦN, không phải
//     lời hứa — WebKit không bảo đảm cấp đủ.
//   · Tất cả origin cộng lại: tối đa ~**80% tổng dung lượng thiết bị**.
//   · PWA đã thêm vào màn hình chính hưởng hạn ngạch NHƯ khi chạy trong trình duyệt.
//   · WKWebView không phải trình duyệt mặc định: chỉ ~15%.
//
// ⇒ Dời 4 MB từ localStorage sang IndexedDB **KHÔNG làm origin nhẹ đi một byte
//   nào** — vẫn từng ấy byte trong cùng một túi. Cái đổi là **cái trần nào đang
//   siết**: thoát khỏi hạn mức con ~5 MB của localStorage (và thoát lỗi iOS 16
//   xoá sạch localStorage khi chạm hạn mức đó).
//
// ⇒ Và vì chung một túi: **chép thêm một bản "cho chắc" sang kho khác là ăn
//   GẤP ĐÔI hạn ngạch**, tức đẩy origin tới gần vòng thu hồi LRU hơn — bản dự
//   phòng đi gây ra đúng cái nó định phòng. Muốn có bản dự phòng THẬT thì phải
//   để NGOÀI origin: tệp bà con tự xuất ra máy (`lib/offline-backup.ts`).
//
// ═══ CÁI KHÓ DUY NHẤT, VÀ CÁCH GỠ ═══
//
// `loadForecast` là hàm ĐỒNG BỘ, gọi thẳng trong luồng vẽ màn. IndexedDB thì
// BẤT ĐỒNG BỘ. Không thể đổi hết chỗ gọi thành `await` mà không đụng ~30 file.
//
// ⚠️ BẢN ĐẦU LÀM SAI CHỖ NÀY, và hai vòng soát chéo độc lập cùng bắt được (mức
// CHẶN). Bản đầu để **gương RAM làm nguồn đọc duy nhất**. Gương nạp bất đồng bộ,
// nên trong lúc chưa nạp xong thì MỌI cửa hỏi "trong máy có gì" đều trả LỜI
// KHÔNG: `savedCoverage()` ra `savedCount = 0` ⇒ màn Chuẩn bị đi biển bung thẻ
// TO *"máy chưa có dữ liệu đi biển"*. Mà đường đọc lại duy nhất là
// `subscribePhase` — chỉ nổ khi mẻ tải sẵn đổi trạng thái, tức **ngoài biển mất
// sóng thì không bao giờ nổ**. Kết cục: thẻ đỏ đứng suốt chuyến trong khi kho
// đang giữ đủ 16 ngày. Trước đây khuôn lỗi là DẤU XANH trên kho rỗng; bản đầu
// dựng lại đúng nó, chỉ đảo chiều — ĐỎ DỐI trên kho đầy. Mà đỏ dối giữa biển
// thì bà con quay tàu về bờ.
//
// NAY TÁCH LÀM HAI, theo đúng thứ mỗi cửa THẬT SỰ cần:
//
//   · **SỔ MỤC LỤC** — vài KB, nằm ở localStorage, ghi/đọc ĐỒNG BỘ. Giữ
//     `{khoá → [lưu lúc nào, nặng bao nhiêu]}`. Đây là NGUỒN SỰ THẬT cho mọi câu
//     hỏi "có hay không / lưu lúc nào / nặng bao nhiêu". Không bao giờ có cửa sổ
//     rỗng, vì localStorage đọc được ngay từ nhịp đầu tiên.
//   · **PAYLOAD** — nằm ở IndexedDB, kèm một bản gương RAM để đọc đồng bộ sau
//     khi đã nạp. Chỉ các lớp bản đồ mới cần tới payload, mà chúng đều đọc trong
//     hàm `async` có sẵn nhánh lùi.
//
// Nhờ tách thế: cửa nguy hiểm nhất (đếm "trong máy có gì") **hết hẳn cửa sổ
// rỗng**, chứ không phải hẹp lại. Tiện thể bỏ luôn cái tật `JSON.parse` cả kho
// ~5 MB mỗi lượt dựng chip — nay đọc sổ là xong.
//
// ═══ BA TRẠNG THÁI, KHÔNG PHẢI HAI ═══
//
// Kho có thể ĐANG MỞ, MỞ ĐƯỢC, hoặc KHÔNG MỞ ĐƯỢC (IndexedDB hỏng/chậm quá trần
// chờ). Gộp "không mở được" vào "trống" là nói dối; gộp vào "có đủ" cũng là nói
// dối. Nên `forecastStoreState()` trả đúng ba trạng thái, và màn hình phải nói
// "đang mở kho" thay vì đoán bừa một trong hai đầu.
//
// ═══ DỌN localStorage: CHỈ SAU KHI ĐĨA ĐÃ NHẬN ═══
//
// Đúng luật chủ dự án đã chốt cho toàn bộ kho offline: *"nó phải down được cái
// mới nó mới xoá cái cũ đi chứ."* Bản cũ chỉ bị xoá khỏi localStorage sau khi
// IndexedDB **xác nhận** đã ghi. Giao dịch hỏng ⇒ không xoá gì, lần mở sau thử
// lại. Không có cửa nào mất dữ liệu ở giữa.
//
// ⚠️ OFFLINE: file này KHÔNG có một lời gọi mạng nào. Mọi thứ ở đây chạy y hệt
// khi mất sóng — đó là lý do nó tồn tại.

/** Tiền tố mọi khoá dự báo (giữ nguyên quy ước `forfish.*` của dự án) */
export const FC_PREFIX = "forfish.fc.";

const DB_NAME = "sdfish";
const DB_VERSION = 1;
const STORE = "fc";

/**
 * TRẦN CHỜ MỞ KHO (ms) — IndexedDB có thể treo VĨNH VIỄN, không phải giả thuyết:
 * Safari chế độ riêng tư, iOS đang khoá máy, hoặc một tab khác đang giữ giao dịch
 * nâng phiên bản. `indexedDB.open()` lúc đó không gọi `onsuccess`, cũng không gọi
 * `onerror` — nó IM. Không có trần này thì `forecastStoreReady()` treo mãi và mọi
 * đường đọc kho chờ theo. Hết giờ ⇒ lùi về localStorage, app vẫn chạy.
 */
const MO_KHO_TIMEOUT_MS = 4000;

/**
 * TRẦN CHỜ MỘT GIAO DỊCH GHI (ms) — RỘNG HƠN HẲN trần mở kho.
 *
 * ⚠️ VÌ SAO TÁCH RA (lỗi NẶNG vòng soát 2026-08-02k): bản đầu dùng chung 4 giây
 * cho cả `open` lẫn `ghiMe`. Nhưng mẻ tải sẵn ghi ~3 MB trong MỘT giao dịch, mà
 * 5 giờ sáng máy bà con còn đang đồng bộ ảnh/iCloud — quá 4 giây là chuyện
 * thường. Hết trần ⇒ `flush` trả false ⇒ `runPretrip` kết luận `full` ⇒ **khoá 6
 * giờ + in "Máy hết chỗ nhớ — xoá bớt điểm đã lưu"**, trong khi máy còn cả chục
 * GB và mẻ thật ra tải xong hết. Tàu nhổ neo lúc 7h với dự báo không được ghi.
 * 4 giây hợp lý cho `open` (chỉ mở kho); ghi 3 MB thì không.
 */
const GHI_TIMEOUT_MS = 20000;

/**
 * TRẦN GƯƠNG RAM (ký tự). localStorage tự ném khi đầy, còn `Map` thì không —
 * thiếu trần này là đổi "hết chỗ đĩa" lấy "hết chỗ RAM", máy yếu thì app bị hệ
 * điều hành giết giữa biển.
 *
 * Gói 16 ngày đầy đủ ≈ 2,5 triệu ký tự. Để 12 triệu (~24 MB UTF-16 trong RAM) là
 * gấp ~5 lần chỗ cần — rộng cho mọi lớp thêm sau này, mà vẫn là một con số CÓ
 * THẬT chứ không phải vô hạn. Chạm trần thì `fcSet` ném đúng như localStorage
 * đầy ⇒ máy dọn theo luật `eligibleVictims` sẵn có, không đẻ đường xử lý mới.
 */
const RAM_TRAN_KY_TU = 12 * 1024 * 1024;

/**
 * SỔ MỤC LỤC — khoá localStorage riêng, CỐ Ý KHÔNG nằm dưới `forfish.fc.` để
 * `fcKeys()` không nhặt nhầm chính nó thành một bản dự báo.
 */
const INDEX_KEY = "forfish.fcindex.v1";

/** `{khoá → [lưu lúc nào (epoch ms), nặng bao nhiêu (byte)]}` */
type MucLuc = Record<string, [number, number]>;

type Backend = "idb" | "ls";

/**
 * KHO ĐANG Ở TRẠNG THÁI NÀO — ba, không phải hai.
 *  · `dang-mo`        — chưa nạp xong; màn hình phải nói "đang mở kho", ĐỪNG kết
 *                       luận trống mà cũng đừng khoe đủ.
 *  · `san-sang`       — mở được, đọc được payload.
 *  · `khong-mo-duoc`  — IndexedDB hỏng/chậm quá trần chờ MÀ sổ mục lục nói có
 *                       dữ liệu. Tức "có mà chưa lấy ra được" — khác hẳn "trống".
 */
export type ForecastStoreState = "dang-mo" | "san-sang" | "khong-mo-duoc";

/** Bản gương trong RAM — NGUỒN ĐỌC ĐỒNG BỘ duy nhất khi đã nạp xong. */
const guong = new Map<string, string>();
/** Tổng ký tự đang giữ trong gương (khoá + giá trị) — canh trần RAM. */
let guongKyTu = 0;

let backend: Backend = "ls";
let daNap = false;
let napP: Promise<void> | null = null;

/** Khoá đang chờ đẩy xuống đĩa (giá trị `null` = chờ XOÁ). */
const hangCho = new Map<string, string | null>();
let dangDay: Promise<boolean> | null = null;
/** Lượt đẩy gần nhất có xuống đĩa trót lọt không (false = đĩa đang từ chối). */
let dayOk = true;
/** đang ở chế độ ghi từng mục để cô lập mục đĩa từ chối */
let ghiTungMuc = false;

/* ══════════════════════════════════════════════════════════════════════════
   localStorage — vẫn dùng làm ĐƯỜNG LÙI và làm nơi ĐỌC bản chưa kịp dọn
   ══════════════════════════════════════════════════════════════════════════ */

function ls(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null; // SSR / trình duyệt chặn lưu
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   SỔ MỤC LỤC — nguồn sự thật ĐỒNG BỘ cho "có gì trong máy"
   ══════════════════════════════════════════════════════════════════════════ */

let mucLuc: MucLuc = {};

function docSo(): void {
  try {
    const raw = ls()?.getItem(INDEX_KEY);
    if (!raw) return;
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object") return;
    const out: MucLuc = {};
    for (const [k, m] of Object.entries(v as Record<string, unknown>)) {
      if (!k.startsWith(FC_PREFIX)) continue;
      if (!Array.isArray(m) || typeof m[0] !== "number") continue;
      out[k] = [m[0], typeof m[1] === "number" ? m[1] : 0];
    }
    mucLuc = out;
  } catch {
    /* sổ hỏng → coi như chưa có; `nap()` sẽ dựng lại từ chính kho */
  }
}

/*  Đọc sổ NGAY khi nạp module — trước cả lúc React dựng cây, nên mọi cửa hỏi
    "trong máy có gì" đều có câu trả lời đúng ngay từ nhịp vẽ đầu tiên. */
docSo();

/**
 * Ghi sổ xuống localStorage — ĐỒNG BỘ, KHÔNG hoãn.
 *
 * ⚠️ BẢN ĐẦU HOÃN MỘT NHỊP (`setTimeout(0)`) để gom mẻ, và đó là một lớp lỗi
 * thời điểm không đáng có (vòng soát 2026-08-02k):
 *   · hai `saveForecast` trong CÙNG một macrotask — vd `Promise.allSettled([
 *     fetchLivePrices(), fetchFuelPrice()])` — thì lượt sau chạy `soConHopLe()`
 *     lúc INDEX_KEY còn chưa kịp tồn tại, và **xoá mất mục của lượt trước**;
 *   · app bị đóng giữa hai nhịp là sổ mất (tuy `nap()` dựng lại được từ kho,
 *     nhưng thêm một đường phải đúng là thêm một đường có thể sai).
 * Đổi lại chi phí gần như bằng không: sổ chỉ vài KB, mà thứ vừa được gỡ khỏi
 * localStorage là mấy MB payload. Ghi thẳng vừa rẻ vừa hết cả lớp lỗi.
 */
function ghiSo(): void {
  ghiSoNgay();
}

let soDaGhi = false;

function ghiSoNgay(): void {
  try {
    ls()?.setItem(INDEX_KEY, JSON.stringify(mucLuc));
    soDaGhi = true;
  } catch {
    /* sổ không ghi được thì kho vẫn đúng; lần mở sau `nap()` dựng lại sổ */
  }
}

/**
 * SỔ CÒN ĐÁNG TIN KHÔNG — sổ nằm ở localStorage, nên localStorage bị xoá từ bên
 * ngoài (bà con bấm "Xoá dữ liệu trang web", trình duyệt dọn, hoặc test dựng lại
 * môi trường) mà bản trong RAM vẫn khai có là sổ đang NÓI DỐI theo chiều nguy
 * hiểm: app tưởng còn dự báo trong khi chẳng còn gì. Một lượt đọc khoá nhỏ là đủ
 * phát hiện và tự dọn.
 */
function soConHopLe(): boolean {
  if (Object.keys(mucLuc).length === 0) return true;
  const s = ls();
  if (!s) return true; // SSR — không kết luận được thì đừng vứt sổ
  try {
    if (s.getItem(INDEX_KEY) != null) return true;
  } catch {
    return true;
  }
  /*  ⚠️ HAI CỬA CHẶN XOÁ OAN (lỗi NẶNG vòng soát 2026-08-02k). Bản đầu thấy
      INDEX_KEY vắng là vứt sạch sổ — chữa được chiều "khai thừa" nhưng đẻ ra
      chiều "khai thiếu", nguy hơn vì nó là ĐỎ DỐI:
        (a) sổ CHƯA TỪNG ghi được. `ghiSoNgay` nuốt lỗi, nên Safari riêng tư /
            localStorage bị chặn là INDEX_KEY KHÔNG BAO GIỜ tồn tại ⇒ mỗi lượt
            `fcKeys`/`fcMeta` lại nuốt sạch sổ trong khi payload nằm nguyên trên
            IndexedDB. Mọi `savedAt` về 0 ⇒ chip "đã cũ" vĩnh viễn, nút xuất tệp
            khoá, và `rankedVictims` mất thứ tự "cũ trước" nên có thể xoá đúng
            bản mới nhất.
        (b) `ghiSo()` đang hoãn (setTimeout 0). Hai `saveForecast` trong CÙNG
            một macrotask — vd `Promise.allSettled([fetchLivePrices(),
            fetchFuelPrice()])` — thì lượt sau xoá mất mục của lượt trước.
      Và nếu gương đang cầm dữ liệu thì sổ chắc chắn KHÔNG phải rác. */
  if (!soDaGhi || guong.size > 0) return true;
  mucLuc = {};
  return false;
}

/** Mốc lưu + cỡ của một bản, ĐỒNG BỘ và luôn đúng — `null` = không có. */
export function fcMeta(k: string): { savedAt: number; bytes: number } | null {
  soConHopLe();
  const m = mucLuc[k];
  if (m) return { savedAt: m[0], bytes: m[1] };
  /*  Chưa di trú xong (lần mở đầu sau khi cập nhật): bản còn ở localStorage mà
      sổ chưa có. Đọc thẳng cho khỏi báo thiếu oan. */
  const raw = (() => {
    try {
      return ls()?.getItem(k) ?? null;
    } catch {
      return null;
    }
  })();
  if (raw == null) return null;
  return { savedAt: savedAtCua(raw), bytes: (k.length + raw.length) * 2 };
}

/**
 * Móc `savedAt` ra khỏi chuỗi mà KHÔNG parse cả bản.
 *
 * `saveForecast` luôn dựng bằng `JSON.stringify({savedAt, data})` nên `savedAt`
 * chắc chắn là trường đầu. Bắt được bằng một biểu thức ngắn thì khỏi phải
 * `JSON.parse` bản lưới 1,6 MB chỉ để đọc một con số — đúng cái tật làm khựng
 * màn Chuẩn bị đi biển. Không khớp thì mới chịu parse.
 */
function savedAtCua(raw: string): number {
  const m = /^\{"savedAt":(\d+)/.exec(raw);
  if (m) return Number(m[1]);
  try {
    const v = (JSON.parse(raw) as { savedAt?: unknown }).savedAt;
    return typeof v === "number" ? v : 0;
  } catch {
    return 0;
  }
}

function lsKhoaCu(): string[] {
  const s = ls();
  if (!s) return [];
  const out: string[] = [];
  try {
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k && k.startsWith(FC_PREFIX)) out.push(k);
    }
  } catch {
    /* đọc được bao nhiêu thì lấy bấy nhiêu */
  }
  return out;
}

/* ══════════════════════════════════════════════════════════════════════════
   IndexedDB — bọc trong Promise, MỌI cửa đều có đường thoát
   ══════════════════════════════════════════════════════════════════════════ */

function moKho(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let xong = false;
    const tra = (db: IDBDatabase | null) => {
      if (xong) return;
      xong = true;
      resolve(db);
    };
    let req: IDBOpenDBRequest;
    try {
      if (typeof indexedDB === "undefined") return tra(null);
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      return tra(null); // Safari riêng tư đời cũ ném ngay tại đây
    }
    /* TRẦN CHỜ: xem chú thích MO_KHO_TIMEOUT_MS — `open` có thể IM luôn. */
    const hen = setTimeout(() => tra(null), MO_KHO_TIMEOUT_MS);
    const dong = (db: IDBDatabase | null) => {
      clearTimeout(hen);
      tra(db);
    };
    req.onupgradeneeded = () => {
      try {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      } catch {
        /* tạo kho hỏng ⇒ `onerror` sẽ dọn tiếp */
      }
    };
    req.onsuccess = () => dong(req.result);
    req.onerror = () => dong(null);
    /*  `onblocked`: tab khác đang giữ phiên bản cũ. KHÔNG tự đóng tab kia (sẽ
        làm hỏng kho của nó); chỉ chịu thua êm và dùng localStorage lượt này. */
    req.onblocked = () => dong(null);
  });
}

let dbP: Promise<IDBDatabase | null> | null = null;
function db(): Promise<IDBDatabase | null> {
  dbP ??= moKho();
  return dbP;
}

/**
 * Đọc TOÀN BỘ kho trong MỘT giao dịch.
 *
 * ⚠️ TRẢ `null` KHI ĐỌC HỎNG, KHÔNG TRẢ MẢNG RỖNG (lỗi CHẶN, vòng soát
 * 2026-08-02k bắt). Bản trước trả `[]` cho BA chuyện khác hẳn nhau — đĩa rỗng
 * thật · đọc quá giờ · giao dịch đọc hỏng — nên `nap()` không phân biệt được và
 * kết luận "máy trắng". Nặng hơn: nó còn ghi đè sổ mục lục thành `{}`, tức
 * **phá luôn bản ghi trên đĩa**, nên phiên sau cũng mất nốt.
 * Ca kích hoạt rất thật: Android rẻ / iPhone vừa được đánh thức, `getAll()`
 * 3–5 MB quá trần chờ ở đúng lượt mở app đầu tiên. Bà con thấy thẻ TO "máy chưa
 * có dữ liệu đi biển" giữa biển trong khi kho còn nguyên gói 16 ngày.
 * Không bao giờ ném.
 */
function docHet(d: IDBDatabase): Promise<Array<[string, string]> | null> {
  return new Promise((resolve) => {
    let xong = false;
    const tra = (v: Array<[string, string]> | null) => {
      if (xong) return;
      xong = true;
      resolve(v);
    };
    /*  DÙNG TRẦN CHỜ CỦA VIỆC GHI, KHÔNG PHẢI CỦA VIỆC MỞ: đây là lượt đọc CẢ
        KHO 3–5 MB, cùng hạng nặng với một giao dịch ghi. 4 giây là trần dành
        cho `open` (chỉ mở kho) — dùng lại ở đây chính là chỗ đẻ ra lỗi trên. */
    const hen = setTimeout(() => tra(null), GHI_TIMEOUT_MS);
    try {
      const tx = d.transaction(STORE, "readonly");
      const st = tx.objectStore(STORE);
      const rk = st.getAllKeys();
      const rv = st.getAll();
      tx.oncomplete = () => {
        clearTimeout(hen);
        const ks = (rk.result ?? []) as IDBValidKey[];
        const vs = (rv.result ?? []) as unknown[];
        const out: Array<[string, string]> = [];
        for (let i = 0; i < ks.length; i++) {
          const k = ks[i];
          const v = vs[i];
          if (typeof k === "string" && typeof v === "string") out.push([k, v]);
        }
        tra(out);
      };
      tx.onerror = () => {
        clearTimeout(hen);
        tra(null); // đọc HỎNG ≠ kho rỗng — xem chú thích đầu hàm
      };
      tx.onabort = () => {
        clearTimeout(hen);
        tra(null); // đọc HỎNG ≠ kho rỗng — xem chú thích đầu hàm
      };
    } catch {
      clearTimeout(hen);
      tra(null); // đọc HỎNG ≠ kho rỗng — xem chú thích đầu hàm
    }
  });
}

/** Ghi/xoá một mẻ trong MỘT giao dịch. Trả false nếu đĩa từ chối (hết chỗ…). */
function ghiMe(
  d: IDBDatabase,
  me: Array<[string, string | null]>,
): Promise<boolean> {
  return new Promise((resolve) => {
    let xong = false;
    const tra = (v: boolean) => {
      if (xong) return;
      xong = true;
      resolve(v);
    };
    const hen = setTimeout(() => tra(false), GHI_TIMEOUT_MS);
    try {
      const tx = d.transaction(STORE, "readwrite");
      const st = tx.objectStore(STORE);
      for (const [k, v] of me) {
        if (v == null) st.delete(k);
        else st.put(v, k);
      }
      tx.oncomplete = () => {
        clearTimeout(hen);
        tra(true);
      };
      tx.onerror = () => {
        clearTimeout(hen);
        tra(false);
      };
      tx.onabort = () => {
        clearTimeout(hen);
        tra(false);
      };
    } catch {
      clearTimeout(hen);
      tra(false);
    }
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   NẠP + DỌN NHÀ (chạy đúng MỘT lần cho mỗi lần mở app)
   ══════════════════════════════════════════════════════════════════════════ */

function themGuong(k: string, v: string): void {
  const cu = guong.get(k);
  if (cu != null) guongKyTu -= k.length + cu.length;
  guong.set(k, v);
  guongKyTu += k.length + v.length;
}

function boGuong(k: string): void {
  const cu = guong.get(k);
  if (cu == null) return;
  guongKyTu -= k.length + cu.length;
  guong.delete(k);
}

/**
 * LẬT VỀ NHÁNH localStorage THÌ PHẢI XẢ HÀNG CHỜ XUỐNG ĐÓ (lỗi vòng đánh giá
 * cuối 2026-08-02k).
 *
 * Ca dựng lại được: `nap()` đặt `backend="idb"` rồi kẹt ở giao dịch di trú tới
 * 20 giây; trong khoảng đó mọi `fcSet` vào gương + hàng chờ. Di trú hỏng ⇒ lật
 * `backend="ls"`, mà từ đó `fcSet` ghi thẳng localStorage và KHÔNG BAO GIỜ vét
 * hàng chờ nữa ⇒ `forecastStoreFlush()` trả `false` VĨNH VIỄN ⇒ `runPretrip`
 * luôn kết luận `full` (khoá 6 giờ + in "Máy hết chỗ nhớ — xoá bớt điểm đã
 * lưu") và `runLayer` ném ở MỌI lớp, trong khi localStorage đang ghi tốt.
 */
/**
 * TRẦN CỠ MỘT MỤC ĐƯỢC XẢ NGƯỢC VỀ localStorage (ký tự).
 *
 * ⚠️ VÌ SAO PHẢI CÓ (vòng soát 5 bắt, mức NẶNG — chính bản vá V5 đẻ ra): xả
 * KHÔNG TRẦN nghĩa là đổ ngược payload hàng MB vào **đúng cái thùng 5 MB mà cả
 * commit này dựng ra để thoát**, rồi `flush()` trả `true` — app tuyên bố "chắc
 * chắn còn sau khi tắt app" cho dữ liệu nằm trong cái thùng mà iOS 16 chạm mức
 * là XOÁ SẠCH (mất luôn chuỗi đăng nhập + sổ mục lục).
 * Tệ hơn, điều kiện kích hoạt TƯƠNG QUAN DƯƠNG: giao dịch IndexedDB hỏng chủ
 * yếu vì máy đầy — đúng lúc localStorage cũng sát mép.
 * Nên chỉ xả thứ NHỎ (tin bão · giá · điểm chạm — vài KB, chính là nhóm mà
 * localStorage vốn hợp): lưới gió, lớp dải màu, bản đồ cá thì ở lại hàng chờ và
 * `flush` trả `false` — đó mới là câu trả lời THẬT.
 */
const XA_NGUOC_TRAN_KY_TU = 64 * 1024;

function xaHangChoXuongLs(): void {
  const s = ls();
  for (const [k, v] of [...hangCho.entries()]) {
    if (v != null && k.length + v.length > XA_NGUOC_TRAN_KY_TU) continue;
    try {
      if (v == null) s?.removeItem(k);
      else s?.setItem(k, v);
      hangCho.delete(k);
    } catch {
      /* localStorage cũng đầy ⇒ để lại trong hàng chờ, `flush` báo false ĐÚNG */
    }
  }
}

async function nap(): Promise<void> {
  const d = await db();
  if (!d) {
    /*  KHÔNG MỞ ĐƯỢC IndexedDB ⇒ Ở NGUYÊN localStorage. Không nạp gương, không
        dọn gì hết: `fcGet` sẽ tự hỏi localStorage, `fcSet` ghi thẳng vào đó.
        Đường lùi cho Safari riêng tư, WebView cũ, và cho test (node không có
        IndexedDB).

        ⚠️ NHƯNG PHẢI PHÂN BIỆT "KHÔNG MỞ ĐƯỢC" VỚI "TRỐNG" (lỗi CHẶN vòng soát
        2026-08-02k). Từ phiên thứ hai trở đi localStorage đã được dọn sạch, nên
        một lượt `open` chậm quá 4 giây (iOS vừa đánh thức tiến trình) làm app
        thấy máy TRẮNG TINH trong khi gói 16 ngày còn nguyên trên đĩa — rồi bung
        thẻ "máy chưa có dữ liệu đi biển" giữa biển. Sổ mục lục còn nguyên ở
        localStorage nên ở đây BIẾT được là kho có dữ liệu; nói thật bằng trạng
        thái thứ ba thay vì đoán bừa. */
    backend = "ls";
    daNap = true;
    return;
  }
  const tren = await docHet(d);
  if (tren == null) {
    /*  ĐỌC KHO HỎNG / QUÁ GIỜ ⇒ KHÔNG ĐƯỢC KẾT LUẬN GÌ VỀ NỘI DUNG KHO.
        Giữ nguyên sổ đang có (đừng đè), ở lại nhánh localStorage để
        `forecastStoreState()` trả `khong-mo-duoc` — màn hình sẽ nói "đang mở
        kho" thay vì bung thẻ "máy chưa có dữ liệu đi biển" giữa biển. Cũng
        TUYỆT ĐỐI không dọn localStorage lượt này. */
    backend = "ls";
    dayOk = false;
    daNap = true;
    return;
  }
  backend = "idb";
  for (const [k, v] of tren) themGuong(k, v);
  /*  DỰNG LẠI SỔ TỪ CHÍNH KHO — kho là sự thật, sổ chỉ là bản chép nhanh. Sổ
      lệch (bị xoá, hỏng, hoặc sót từ phiên trước) thì tự lành ở đây. */
  const soMoi: MucLuc = {};
  for (const [k, v] of tren) soMoi[k] = [savedAtCua(v), (k.length + v.length) * 2];

  /*  ═══ DỌN localStorage — CHỈ SAU KHI ĐĨA ĐÃ NHẬN ═══
      Luật của cả kho offline: "phải down được cái mới nó mới xoá cái cũ đi."
      Bản nào IndexedDB đã có thì localStorage chỉ là rác cũ, xoá thẳng. Bản nào
      chỉ có ở localStorage thì phải CHÉP XUỐNG ĐĨA VÀ ĐỢI XÁC NHẬN rồi mới xoá.
      Giao dịch hỏng ⇒ không xoá một khoá nào, lần mở sau làm lại. */
  const khoaCu = lsKhoaCu();
  if (khoaCu.length === 0) {
    mucLuc = hoaSo(soMoi);
    ghiSo();
    daNap = true;
    return;
  }
  const s = ls();
  const canChep: Array<[string, string]> = [];
  const daCoTrenDia: string[] = [];
  for (const k of khoaCu) {
    const v = s?.getItem(k);
    if (typeof v !== "string") continue;
    const treanDia = guong.get(k);
    if (treanDia != null) {
      /*  ⚠️ SO MỐC RỒI MỚI XOÁ (lỗi NẶNG vòng soát 2026-08-02k bắt).
          Bản đầu giả định "đĩa đã có ⇒ bản ở localStorage là rác cũ" rồi xoá
          thẳng, không đọc, không so. Giả định đó SAI vì chính app ghi vào
          localStorage mỗi phiên chạy nhánh lùi (`backend === "ls"`).
          Ca dựng lại được: phiên A (đĩa tốt) lưu tin bão v1 rồi dọn localStorage
          · phiên B (IndexedDB mở hỏng) tải tin bão v2 HÔM NAY vào localStorage ·
          phiên C (đĩa tốt) thấy đĩa "đã có" nên **xoá mất v2**. Bản tin bão lùi
          lại mấy ngày, không một tiếng động — mà bão thì dính tính mạng.
          Nay bản localStorage MỚI HƠN được chép ĐÈ xuống đĩa; chỉ bản cũ hơn
          hoặc bằng mới bị coi là thừa. */
      if (savedAtCua(v) > savedAtCua(treanDia)) canChep.push([k, v]);
      else daCoTrenDia.push(k);
      continue;
    }
    canChep.push([k, v]);
  }
  /*  Xoá bản THỪA trước (đĩa đã có bản mới hơn hoặc bằng ⇒ xoá là an toàn), để
      giải phóng chỗ trong localStorage NGAY cả khi mẻ chép bên dưới có hỏng. */
  for (const k of daCoTrenDia) {
    try {
      s?.removeItem(k);
    } catch {
      /* xoá không được cũng không sao — chỉ tốn chỗ */
    }
  }
  if (canChep.length > 0) {
    const ok = await ghiMe(d, canChep);
    if (ok) {
      for (const [k, v] of canChep) {
        themGuong(k, v);
        soMoi[k] = [savedAtCua(v), (k.length + v.length) * 2];
        try {
          s?.removeItem(k);
        } catch {
          /* để lại cũng không sai: `fcGet` ưu tiên gương, `fcRemove` dọn cả hai */
        }
      }
    } else {
      /*  ĐĨA TỪ CHỐI ⇒ GIỮ NGUYÊN localStorage, và ở lại đường cũ lượt này.
          Gương đã nạp phần đĩa nên đọc vẫn ra, nhưng KHÔNG xoá gì. */
      backend = "ls";
      dayOk = false;
      xaHangChoXuongLs();
      for (const [k, v] of canChep) {
        soMoi[k] = [savedAtCua(v), (k.length + v.length) * 2];
      }
    }
  }
  mucLuc = hoaSo(soMoi);
  ghiSo();
  dangNapLai = false;
  daNap = true;
}

/**
 * Chờ kho mở xong đúng một nhịp. Gọi ở đầu các đường ĐỌC BẤT ĐỒNG BỘ (cửa
 * "mất sóng thì lấy bản đã lưu") để không bao giờ đọc phải cái gương còn rỗng.
 *
 * An toàn khi gọi nhiều lần / gọi song song: chỉ nạp một lượt.
 * KHÔNG BAO GIỜ TREO: mọi cửa IndexedDB bên trong đều có trần chờ.
 */
/** Số lượt nạp HỎNG đã thử lại (có đáy — không thành vòng thử vô tận). */
let soLanNapHong = 0;
const TRAN_NAP_LAI = 2;
/** đang ở lượt nạp LẠI (daNap vẫn true để trạng thái nói thật) */
let dangNapLai = false;

export function forecastStoreReady(): Promise<void> {
  napP ??= nap()
    .catch(() => {
      /* hỏng kiểu gì cũng phải mở khoá, không được để chỗ gọi chờ mãi */
      backend = "ls";
      daNap = true;
    })
    /* BÁO CHO MÀN HÌNH ĐỌC LẠI — thiếu vế này thì chip/thẻ đóng băng ở lượt đọc
       đầu tiên suốt cả chuyến khi mất sóng (xem `subscribeForecastStore`). */
    .then(() => {
      baoDaNap();
      /*  ⚠️ HỎNG LƯỢT ĐẦU KHÔNG ĐƯỢC LÀ MÙ CẢ PHIÊN (vòng soát 5, mức NẶNG).
          `nap()` vốn chạy đúng một lần, nên một cơn nghẽn 20 giây lúc mở app
          (iOS vừa đánh thức tiến trình, máy đang đồng bộ ảnh) = app mù suốt
          chuyến, dù đĩa lành ngay sau đó. Băng cảnh báo có bảo "đóng app rồi mở
          lại", nhưng giữa biển bà con hiếm khi làm.
          Nay mở khoá cho lượt gọi SAU nạp lại — có đáy 2 lượt để không thành
          vòng thử vô tận, và chỉ mở khi thật sự CHƯA lấy được gì ra. */
      /*  ⚠️ KHÔNG ĐƯỢC HẠ `daNap` XUỐNG (tự soát trong lúc vá): làm thế thì
          trạng thái tụt về "dang-mo" ⇒ chip nói "Đang mở kho dữ liệu…" mà nếu
          không ai gọi `forecastStoreReady()` nữa thì nó treo ở đó VĨNH VIỄN —
          đúng cái lỗi "hứa một chuyện tạm thời mà không bao giờ kết thúc" mà V1
          vừa diệt. Lượt nạp NÀY đã xong và đã thất bại: nói thật là
          "khong-mo-duoc". Chỉ mở khoá để lượt gọi SAU được nạp lại. */
      if (forecastStoreState() === "khong-mo-duoc" && soLanNapHong < TRAN_NAP_LAI) {
        soLanNapHong += 1;
        napP = null;
        dbP = null;
        dangNapLai = true; // để `ghiNhanSo` vẫn ghi nhận ghi-trong-lúc-nạp
      }
    });
  return napP;
}

/** Kho đã mở xong chưa (để chỗ nào cần thì phân biệt "chưa mở" với "trống"). */
export function forecastStoreHydrated(): boolean {
  return daNap;
}

/**
 * BA TRẠNG THÁI, xem `ForecastStoreState`. Màn hình nào định kết luận "máy chưa
 * có dữ liệu" thì BẮT BUỘC gọi cái này trước — hai trạng thái kia không cho
 * phép kết luận đó.
 */
/** Mục này có LẤY RA ĐƯỢC không — thăm dò rẻ, không dựng lại chuỗi lớn. */
function layDuocKhong(k: string): boolean {
  if (guong.has(k)) return true;
  try {
    return ls()?.getItem(k) != null;
  } catch {
    return false;
  }
}

export function forecastStoreState(): ForecastStoreState {
  if (!daNap) return "dang-mo";
  /*  Nạp xong mà vẫn ở nhánh localStorage TRONG KHI sổ nói có dữ liệu ⇒ dữ liệu
      nằm trên đĩa nhưng lượt này không lấy ra được. KHÔNG phải trống. */
  /*  ⚠️ HỎI ĐÚNG CÂU: "SỔ KHAI CÓ MÀ LẤY RA ĐƯỢC KHÔNG?" (vòng soát 5 bắt, mức
      CHẶN, chứng minh bằng mã chạy).

      Bản V1 hỏi một cờ nội bộ, chỉ bật khi `docHet()` hỏng. Nhưng có HAI cửa
      hỏng, không phải một: cửa thứ hai là `db()` trả `null` (`indexedDB.open`
      quá trần 4 giây · `onerror` · `onblocked` khi tab khác đang giữ kho — cửa
      này sẽ dính MỌI máy có 2 tab ở lần bump `DB_VERSION` sau). Đường đó không
      bật cờ ⇒ trả "san-sang" trong khi gương rỗng và sổ khai 1,6 MB ⇒ thẻ TO
      "máy chưa có dữ liệu đi biển" bung ra giữa biển, popup liệt kê 9 dòng
      "chưa lưu" mà tổng vẫn in 1,6 MB — một bảng tự mâu thuẫn. Điều kiện CŨ
      (trước V1) lại phủ được ca này; V1 chữa ca Safari-riêng-tư nhưng ĐÁNH RƠI
      ca kia. Đổi cửa, không lấp lỗ.

      Nay không suy từ cờ nào nữa mà hỏi thẳng SỰ THẬT: sổ nói có mà không mục
      nào lấy ra được ⇒ kho chưa mở được. Đúng cho CẢ HAI cửa, và vẫn trả
      "san-sang" cho Safari riêng tư (ở đó payload nằm thật trong localStorage
      nên lấy ra được). Sổ rỗng = máy mới tinh = "sẵn sàng và trống". */
  const ks = Object.keys(mucLuc);
  if (ks.length === 0) return "san-sang";
  for (const k of ks) if (layDuocKhong(k)) return "san-sang";
  return "khong-mo-duoc";
}

const nguoiCho = new Set<() => void>();

/**
 * BÁO CHO MÀN HÌNH BIẾT KHO VỪA MỞ XONG — đăng ký xong trả về hàm huỷ.
 *
 * ⚠️ VÌ SAO BẮT BUỘC (lỗi CHẶN do chính bản vá này đẻ ra, vòng phản biện
 * 2026-08-02k bắt được):
 *
 * Màn "Chuẩn bị đi biển" đọc kho bằng `savedCoverage()` — ĐỒNG BỘ, ngay lần vẽ
 * đầu. Trước đây kho là localStorage nên lượt đọc đó luôn đúng. Nay kho nạp bất
 * đồng bộ, mà đường đọc lại duy nhất là `subscribePhase` — chỉ nổ khi mẻ tải sẵn
 * đổi trạng thái. **Ngoài biển mất sóng thì mẻ tải sẵn không chạy, `phase` không
 * đổi, không có lượt đọc lại nào.** Kết cục: thẻ nhắc TO "trong máy chưa có gì"
 * đứng nguyên suốt chuyến trong khi IndexedDB đang giữ đủ 16 ngày.
 *
 * Trước đây khuôn lỗi là DẤU XANH trên kho rỗng; bản vá suýt dựng lại đúng nó,
 * chỉ đảo chiều — ĐỎ DỐI trên kho đầy. Mà đỏ dối giữa biển thì bà con quay tàu.
 *
 * Gọi khi kho đã mở xong thì chạy LUÔN một nhịp (khỏi lỡ chuyến).
 */
export function subscribeForecastStore(fn: () => void): () => void {
  /*  "Đã nạp" CHƯA ĐỦ để bắn-rồi-thôi: nạp xong mà KHÔNG MỞ ĐƯỢC kho thì còn
      lượt nạp lại phía sau, và màn hình phải nghe được lượt đó. */
  if (daNap && forecastStoreState() !== "khong-mo-duoc") {
    fn();
    return () => undefined;
  }
  nguoiCho.add(fn);
  return () => void nguoiCho.delete(fn);
}

function baoDaNap(): void {
  /*  ⚠️ LƯỢT NẠP HỎNG THÌ GIỮ NGUYÊN DANH SÁCH NGƯỜI NGHE (vòng soát 6 bắt).
      Bản trước `clear()` vô điều kiện. Nhưng sau một lượt nạp HỎNG, `daNap` đã
      là true nên `subscribeForecastStore` chuyển sang "bắn ngay rồi trả noop" —
      không ai vào danh sách nữa. Lượt NẠP LẠI thành công sau đó KHÔNG báo được
      cho màn hình nào ⇒ chip đứng "Đang mở kho dữ liệu…" suốt chuyến trong khi
      kho ĐÃ mở được. Đúng cái lỗi mà `subscribeForecastStore` sinh ra để diệt. */
  if (forecastStoreState() === "khong-mo-duoc") return;
  const ds = [...nguoiCho];
  nguoiCho.clear();
  for (const fn of ds) {
    try {
      fn();
    } catch {
      /* một màn hỏng không được chặn các màn còn lại */
    }
  }
}

/** Đang cất ở đâu — cho nhịp báo về và cho test đọc ra sự thật. */
export function forecastStoreBackend(): Backend {
  return backend;
}

/*  Mở kho NGAY khi file này được nạp — sớm nhất có thể, trước cả lúc React
    dựng cây. Đổi lại, cửa sổ "gương còn rỗng" hẹp tới mức gần như không tồn
    tại, và `fcGet` vẫn có đường lùi localStorage che nốt phần còn lại. */
if (typeof window !== "undefined") void forecastStoreReady();

/* ══════════════════════════════════════════════════════════════════════════
   CỬA ĐỌC / GHI — thay chỗ cho window.localStorage trong forecast-cache
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Đọc một bản. ĐỒNG BỘ, không bao giờ ném.
 *
 * MISS Ở GƯƠNG THÌ HỎI TIẾP localStorage — đây là lớp chắn cho cửa sổ "chưa nạp
 * xong" và cho ca dọn nhà dở dang. Đọc thừa một lượt localStorage rẻ hơn nhiều
 * so với việc nói dối bà con là "chưa có dữ liệu".
 */
export function fcGet(k: string): string | null {
  const tuLs = (() => {
    try {
      return ls()?.getItem(k) ?? null;
    } catch {
      return null;
    }
  })();
  /*  NHÁNH `ls`: localStorage là KHO THẬT ⇒ hỏi nó TRƯỚC. Gương lúc này chỉ là
      bản chụp đĩa từ lượt nạp, có thể CŨ HƠN thứ vừa ghi (xem `fcSet`). */
  if (backend === "ls") return tuLs ?? guong.get(k) ?? null;
  return guong.get(k) ?? tuLs;
}

/**
 * Ghi một bản. NÉM khi không còn chỗ — giữ nguyên giao kèo của
 * `localStorage.setItem` để `saveForecast` chạy tiếp đường dọn sẵn có.
 *
 * Đường IndexedDB: vào gương ngay (đọc ra được liền) + xếp hàng xuống đĩa.
 * Muốn BIẾT CHẮC đã nằm xuống đĩa thì `await forecastStoreFlush()`.
 */
export function fcSet(k: string, v: string): void {
  if (backend === "ls") {
    const s = ls();
    if (!s) throw new Error("no-storage");
    s.setItem(k, v); // ném QuotaExceededError y như cũ
    /*  ⚠️ CẬP NHẬT GƯƠNG LUÔN (lỗi CHẶN vòng soát 2026-08-02k bắt).
        Bản đầu `return` ngay tại đây. Nhưng `backend` CÓ THỂ lật từ `idb` về
        `ls` giữa phiên (giao dịch di trú hỏng), lúc đó gương đang đầy dữ liệu
        CŨ mà `fcGet` thì ưu tiên gương ⇒ bản vừa tải về không bao giờ đọc ra
        được. Ca thật: bà con chạm "Tải lại" lớp Tin bão, fetch xong, ghi xong,
        `saveForecast` trả `true` — mà màn hình vẫn hiện bản tin HÔM QUA và chip
        vẫn đỏ "đã cũ". Bấm lại, y hệt. Đúng khuôn "nút bấm không được gì" mà
        commit c316cbd vừa đi vá, nay dựng lại ở tầng dưới.
        `fcRemove` vốn đã gọi `boGuong` ở mọi nhánh — chỉ `fcSet` là lệch.

        Cách vá KHÔNG phải là nhét bản mới vào gương (làm thế thì gương sống dai
        hơn chính cái kho nó soi). Vá ở `fcGet`: nhánh `ls` thì localStorage là
        KHO THẬT, phải hỏi nó TRƯỚC, gương chỉ là bản chụp đĩa để đọc thêm. */
    boGuong(k); // gương không được giữ bản CŨ hơn thứ vừa ghi
    /*  ⚠️ DỌN LUÔN MỤC CŨ TRONG HÀNG CHỜ (vòng soát 6 bắt — bản vá vòng 6 CÒN
        HỞ). Bản cũ cùng khoá có thể đang kẹt hàng chờ (quá trần xả ngược). Nay
        bản MỚI đã nằm thật trong localStorage, mà mục kẹt vẫn còn thì
        `conKetLai()` tiếp tục trả `false` ⇒ bà con chạm "Tải lại" đúng lớp đó,
        ghi trót lọt, mà dòng vẫn ĐỎ — bấm bao nhiêu lần cũng đỏ. Đúng khuôn
        "nút bấm không được gì" (c316cbd) dựng lại lần nữa. */
    hangCho.delete(k);
    ghiNhanSo(k, v);
    return;
  }
  const cu = guong.get(k);
  const themVao = k.length + v.length - (cu == null ? 0 : k.length + cu.length);
  if (guongKyTu + themVao > RAM_TRAN_KY_TU) {
    /*  CHẠM TRẦN RAM. Ném để chỗ gọi biết là KHÔNG GIỮ ĐƯỢC — nhưng ném bằng
        một khuôn RIÊNG, vì đây KHÔNG phải "đĩa hết chỗ".

        ⚠️ VÌ SAO PHẢI TÁCH (vòng soát 2026-08-02k): `saveForecast` bắt lỗi này
        rồi chạy đường dọn, mà đường dọn gọi `fcRemove` ⇒ **XOÁ THẬT trên
        IndexedDB**. Tức một ràng buộc BỘ NHỚ bị đổi thành mất mát ĐĨA, trong khi
        đĩa còn rộng mênh mông — đúng thứ cả kiến trúc mới dựng ra để thoát.
        Xem `saveForecast`: nó nhận diện khuôn này và TỪ CHỐI GHI thay vì dọn. */
    throw new Error(FC_LOI_TRAN_RAM);
  }
  themGuong(k, v);
  ghiNhanSo(k, v);
  hangCho.set(k, v);
  xepLichDay();
}

/**
 * Khuôn lỗi "hết chỗ RAM, KHÔNG phải hết chỗ đĩa" — `forecast-cache` phải phân
 * biệt được, vì hai chuyện đòi hai cách xử khác hẳn nhau (xem `fcSet`).
 */
export const FC_LOI_TRAN_RAM = "forecast-store-ram-full";

/*  ═══ GHI/XOÁ XẢY RA TRONG LÚC ĐANG NẠP ═══ (lỗi NẶNG vòng soát 2026-08-02k)

    `nap()` dựng `soMoi` từ ẢNH CHỤP đĩa lấy lúc bắt đầu, rồi gán đè lên sổ. Mà
    cửa sổ nạp KHÔNG hề yên tĩnh: `/api/storms` và `/api/fish-forecast` trả từ
    kho service worker trong ~50 ms ngay lúc mở app, `pretrip` chạy ở `useEffect`
    mount. Đè thẳng thì:
      · bản VỪA GHI mất mục lục ⇒ `latestSavedAt` null ⇒ chip "dự báo đã cũ, chạm
        tải mới" (đỏ dối, mời tải lại ~3 MB) · `bytesUnder` 0 ⇒ nút "Lưu dự báo"
        bị khoá · `entriesUnder` cho `savedAt=0` ⇒ chính bản mới nhất thành nạn
        nhân ĐẦU TIÊN khi máy đầy;
      · bản VỪA XOÁ sống lại trong sổ ⇒ sổ khai có mà `fcGet` trả null.
    Nên phải nhớ hai danh sách này và hoà vào `soMoi` thay vì đè. */
const ghiTrongLucNap = new Set<string>();
const xoaTrongLucNap = new Set<string>();

function ghiNhanSo(k: string, v: string): void {
  /*  ⚠️ KHO LÀNH LẠI BẰNG MỘT LƯỢT GHI CŨNG PHẢI BÁO (vòng soát 7, đã dựng lại
      bằng mã). `forecastStoreState()` trả `san-sang` ngay khi MỘT khoá trong sổ
      đọc được — mà một lớp vừa tải về là đủ. Nhưng `baoDaNap()` chỉ được gọi từ
      `forecastStoreReady().then`, nên người nghe đậu trong `nguoiCho` KHÔNG AI
      GỌI ⇒ chip đứng "Chưa mở được kho…" trong khi kho đọc được. Ở bờ thì
      `subscribePhase` che được (mẻ tải sẵn đổi phase); GIỮA BIỂN không có mẻ nào
      chạy — đúng ca file này sinh ra để chống. */
  mucLuc[k] = [savedAtCua(v), (k.length + v.length) * 2];
  if (!daNap || dangNapLai) {
    ghiTrongLucNap.add(k);
    xoaTrongLucNap.delete(k);
  }
  ghiSo();
  /*  KHÔNG so trạng thái TRƯỚC/SAU — `fcSet` nhánh `ls` đã `setItem` xong rồi
      mới gọi vào đây, nên "trước" đo được đã là "sau" (tự bắt trong lúc viết,
      test cứu). Hỏi thẳng điều cần biết: CÓ AI ĐANG CHỜ mà kho nay đọc được
      không. `nguoiCho` chỉ có người khi kho từng chưa sẵn sàng, nên không có
      chuyện báo thừa. */
  if (daNap && nguoiCho.size > 0 && forecastStoreState() === "san-sang") {
    baoDaNap();
  }
}

/** Hoà sổ vừa dựng từ đĩa với những gì đã ghi/xoá trong lúc nạp. */
function hoaSo(soMoi: MucLuc): MucLuc {
  for (const k of ghiTrongLucNap) {
    const m = mucLuc[k];
    if (m) soMoi[k] = m; // bản mới hơn ảnh chụp — giữ
  }
  for (const k of xoaTrongLucNap) delete soMoi[k];
  ghiTrongLucNap.clear();
  xoaTrongLucNap.clear();
  return soMoi;
}

/** Xoá một bản khỏi CẢ HAI kho (localStorage có thể còn bản chưa dọn xong). */
export function fcRemove(k: string): void {
  boGuong(k);
  delete mucLuc[k];
  if (!daNap || dangNapLai) {
    xoaTrongLucNap.add(k);
    ghiTrongLucNap.delete(k);
  }
  ghiSo();
  if (backend === "idb") {
    hangCho.set(k, null);
    xepLichDay();
  } else {
    /*  ⚠️ ĐỌC KỸ TRƯỚC KHI TIN: xếp lệnh xoá vào hàng chờ ở đây **CHƯA dọn được
        bản trên IndexedDB** (tự soát vòng 8 — bản vá vòng 7 ở chỗ này là VÔ
        HIỆU, và chú thích cũ của nó nói sai).
        Lý do: trên nhánh `ls`, `forecastStoreFlush` thoát sớm và chỉ gọi
        `xaHangChoXuongLs()`, mà hàm đó xử mục `null` bằng `localStorage.
        removeItem` rồi **gỡ khỏi hàng chờ luôn** — lệnh xoá không bao giờ tới
        IndexedDB. Cái nó ĐANG làm được: giữ đúng thứ tự (mục ghi kẹt cùng khoá
        bị lệnh xoá thay thế, nên `xaHangChoXuongLs` không đổ ngược bản đã xoá
        vào localStorage) và không làm `conKetLai` kẹt `false`.
        HỐ CÒN LẠI, ghi ra để người sau khỏi tưởng đã kín: phiên nào backend lật
        idb→ls, bản xoá trong phiên đó KHÔNG tới được đĩa; phiên sau mở kho tốt
        thì bản cũ trên IndexedDB **sống lại**. Vá thật cần một dấu-mộ bền
        (tombstone) trong sổ mục lục — chưa làm, vì ca này đòi ba điều kiện xảy
        ra liên tiếp và hậu quả là "thấy lại một lớp đã xoá", không mất dữ liệu. */
    hangCho.set(k, null);
  }
  try {
    ls()?.removeItem(k);
  } catch {
    /* bỏ qua */
  }
}

/**
 * Mọi khoá dự báo đang có. Gộp gương + localStorage (bản chưa dọn xong) và bỏ
 * trùng — chỗ gọi luôn thấy đúng MỘT danh sách, không phụ thuộc đang ở tầng nào.
 */
export function fcKeys(): string[] {
  const out = new Set<string>();
  /*  SỔ TRƯỚC — sổ ở localStorage nên đọc được NGAY từ nhịp vẽ đầu tiên, kể cả
      khi gương chưa nạp xong hay IndexedDB không mở nổi. Đây là vế làm cho câu
      "trong máy có gì" hết cửa sổ nói dối. */
  soConHopLe();
  for (const k of Object.keys(mucLuc)) out.add(k);
  for (const k of guong.keys()) if (k.startsWith(FC_PREFIX)) out.add(k);
  for (const k of lsKhoaCu()) out.add(k);
  return [...out];
}

/* ══════════════════════════════════════════════════════════════════════════
   ĐẨY XUỐNG ĐĨA
   ══════════════════════════════════════════════════════════════════════════ */

let henDay: ReturnType<typeof setTimeout> | null = null;

/**
 * Gom nhiều lượt ghi vào MỘT giao dịch. Mẻ tải sẵn ghi ~15 lớp liên tiếp; mỗi
 * lớp một giao dịch riêng là 15 lượt fsync, đủ để thấy khựng trên máy yếu.
 * Hoãn 50 ms là đủ gom trọn một mẻ mà bà con không kịp cảm thấy.
 */
function xepLichDay(): void {
  if (henDay != null) return;
  henDay = setTimeout(() => {
    henDay = null;
    void day();
  }, 50);
}

/** Số lượt đã tự thử lại sau khi đĩa từ chối (đặt lại về 0 khi ghi được). */
let soLanThuLai = 0;
/** Trần thử lại — CÓ ĐÁY, để không thành vòng đẩy-hỏng-đẩy-lại vô tận. */
const TRAN_THU_LAI = 3;
let henLai: ReturnType<typeof setTimeout> | null = null;

/**
 * ĐĨA TỪ CHỐI THÌ TỰ THỬ LẠI — vài lượt, giãn dần, rồi thôi.
 *
 * ⚠️ VÌ SAO CẦN (lỗi NẶNG vòng soát 2026-08-02k): bản đầu hỏng là `break` rồi
 * thôi, lượt thử lại chỉ đến từ một `fcSet` mới hoặc một `flush`. Mà `flush` chỉ
 * có ở mẻ tải sẵn và lúc nhập tệp. Nên mọi lượt ghi ĐỜI THƯỜNG — bà con chạm
 * bản đồ xem điểm, kéo thanh giờ, bật lớp mây, xem bão — nếu giao dịch hỏng thì
 * **nằm trong RAM tới lúc tắt app rồi mất**, mà chip vẫn xanh vì đọc gương.
 *
 * CÓ ĐÁY vì đĩa đầy thật thì thử mãi cũng vô ích, chỉ tốn pin; ba lượt giãn dần
 * là đủ vượt các cơn nghẽn tạm (đồng bộ ảnh, máy đang bận).
 */
function henThuLai(): void {
  if (henLai != null || soLanThuLai >= TRAN_THU_LAI) return;
  const cho = 2000 * 2 ** soLanThuLai; // 2s · 4s · 8s
  soLanThuLai += 1;
  henLai = setTimeout(() => {
    henLai = null;
    if (hangCho.size > 0) void day();
  }, cho);
}

async function day(): Promise<boolean> {
  if (dangDay) return dangDay;
  const chay = (async () => {
    const d = await db();
    if (!d) {
      dayOk = false;
      return false;
    }
    /*  Vét sạch hàng chờ TRƯỚC khi vào giao dịch: lượt ghi mới đến trong lúc
        đang đẩy sẽ nằm ở mẻ sau, không bị nuốt. */
    let ok = true;
    while (hangCho.size > 0) {
      /*  Sau một mẻ hỏng thì ghi TỪNG MỤC để cô lập thủ phạm (xem bên dưới). */
      const tatCa = [...hangCho.entries()];
      const me = ghiTungMuc ? tatCa.slice(0, 1) : tatCa;
      for (const [k] of me) hangCho.delete(k);
      const r = await ghiMe(d, me);
      if (!r) {
        /*  ⚠️ TRẢ MẺ VỀ HÀNG CHỜ (sửa ngay trong lượt viết — bản đầu để mất).
            `hangCho.clear()` chạy TRƯỚC giao dịch để lượt ghi mới không bị nuốt;
            nhưng giao dịch hỏng mà không trả mẻ về thì mấy lớp đó nằm trong
            gương RAM VĨNH VIỄN KHÔNG BAO GIỜ xuống đĩa — app trông như đã lưu
            đủ, tắt đi mở lại là trắng. Trả về để lượt `flush` sau thử lại.
            KHÔNG đè lượt ghi MỚI HƠN đã vào hàng trong lúc đang đẩy. */
        if (me.length === 1) {
          /*  MỘT MÌNH MÀ VẪN HỎNG ⇒ đĩa từ chối HẲN mục này. Tách ra khỏi hàng
              chờ để nó không đầu độc mọi giao dịch sau, nhưng ghi vào
              `khongGhiDuoc` để `flush` vẫn nói THẬT về nó. */
          khongGhiDuoc.set(me[0][0], me[0][1]);
        } else {
          /*  Mẻ nhiều mục hỏng ⇒ CHƯA biết mục nào là thủ phạm. Trả về hàng chờ
              rồi lượt sau ghi TỪNG MỤC MỘT để cô lập — thà tốn mấy giao dịch
              nhỏ còn hơn để một mục xấu chặn cả kho. */
          for (const [k, v] of me) if (!hangCho.has(k)) hangCho.set(k, v);
          ghiTungMuc = true;
        }
        ok = false;
        break; // đừng quay vòng vô tận — hẹn lượt thử lại có kiểm soát bên dưới
      }
    }
    if (ok) {
      soLanThuLai = 0;
      ghiTungMuc = false;
    }
    else henThuLai();
    dayOk = ok;
    return ok;
  })();
  dangDay = chay;
  try {
    return await chay;
  } finally {
    dangDay = null;
  }
}

/**
 * ĐỢI CHO TỚI KHI THỰC SỰ NẰM XUỐNG ĐĨA — `true` = chắc chắn còn sau khi tắt app.
 *
 * ⚠️ VÌ SAO BẮT BUỘC PHẢI CÓ: gương RAM nhận mọi lượt ghi mà không bao giờ từ
 * chối, nên `saveForecast` trả `true` gần như luôn luôn. Nếu mẻ tải sẵn tin vào
 * đó rồi ghi mốc "đã tải xong", mà giao dịch IndexedDB lại hỏng (máy hết đĩa),
 * thì tàu ra khơi với một cái mốc xanh và một cái kho rỗng. Đúng khuôn nói dối
 * mà cả ngày hôm nay đi vá. Chỗ nào ghi mốc thì chỗ đó phải chờ ở đây.
 */
/**
 * ĐĨA TỪ CHỐI HẲN — mục đã thử ghi RIÊNG một mình mà vẫn hỏng.
 *
 * ⚠️ VÌ SAO CẦN (vòng soát 7, "hàng chờ nhiễm độc"): một mục đĩa từ chối vĩnh
 * viễn nằm lại `hangCho` thì MỌI lượt ghi sau đó đi CHUNG một giao dịch với nó
 * ⇒ tin bão 600 byte cũng không vào nổi, mọi lớp đỏ suốt phiên. Nay tách nó ra
 * để phần còn lại chạy tiếp — nhưng KHÔNG giả vờ là đã ghi được: nó vào danh
 * sách này và `conKetLai` vẫn trả `false` cho mẻ nào có nó.
 *
 * GIỮ NGUYÊN NỘI DUNG, không chỉ giữ tên khoá: đĩa lành lại (bà con xoá bớt
 * ảnh) thì phải cứu được mấy mục này, không thì "tách ra" hoá thành "vứt đi".
 */
const khongGhiDuoc = new Map<string, string | null>();

/** Mẻ này còn mục nào CHƯA nằm xuống đĩa không (không truyền = hỏi cả kho). */
function conKetLai(chiKhoa?: Iterable<string>): boolean {
  if (chiKhoa == null) return hangCho.size === 0 && khongGhiDuoc.size === 0;
  for (const k of chiKhoa) {
    if (hangCho.has(k) || khongGhiDuoc.has(k)) return false;
  }
  return true;
}

export async function forecastStoreFlush(
  /*  ⚠️ HỎI ĐÚNG CÂU: "MẺ CỦA TÔI ĐÃ NẰM XUỐNG CHƯA", KHÔNG PHẢI "HÀNG CHỜ CÓ
      RỖNG KHÔNG" (tự soát vòng 6).
      Từ khi `xaHangChoXuongLs()` có trần 64 KB, mục LỚN (lưới, lớp dải màu, bản
      đồ cá) ở lại hàng chờ vĩnh viễn trên nhánh `ls` — đúng thiết kế, vì chúng
      thật sự không nhét nổi vào thùng 5 MB. Nhưng `flush()` hỏi cả hàng chờ nên
      trả `false` VĨNH VIỄN ⇒ bà con chạm "Tải lại" lớp TIN BÃO (600 byte, đã
      ghi xuống localStorage trót lọt) vẫn bị `runLayer` NÉM ⇒ dòng đó đỏ, mà
      bấm lại bao nhiêu lần cũng đỏ. Một lưới kẹt làm hỏng phán quyết của MỌI
      lớp khác.
      Truyền khoá của chính mẻ mình thì câu trả lời đúng cho từng mẻ. Không
      truyền = hỏi cả kho (giữ nguyên hành vi cũ cho chỗ gọi chưa đổi). */
  chiKhoa?: Iterable<string>,
): Promise<boolean> {
  await forecastStoreReady();
  if (backend === "ls") {
    /*  ⚠️ HÀNG CHỜ CÒN THÌ KHÔNG ĐƯỢC BÁO XONG (lỗi NẶNG vòng soát 2026-08-02k).
        `backend` LẬT từ "idb" về "ls" được — đúng ở phiên nâng cấp mà mọi máy
        đều đi qua một lần: `nap()` đặt "idb", kẹt ở giao dịch di trú tới 20
        giây, trong lúc đó mọi `fcSet` vào gương + hàng chờ, rồi di trú hỏng nên
        lật về "ls". Trả `true` vô điều kiện lúc đó là phá đúng giao kèo của hàm
        ("true = chắc chắn còn sau khi tắt app"): mẻ tải sẵn ghi mốc, KHOÁ 6 GIỜ,
        với mấy lớp chỉ nằm trong RAM.

        XẢ Ở ĐÂY, KHÔNG CHỈ Ở CHỖ LẬT NHÁNH (tự soát vòng 5): bản vá đầu chỉ gọi
        `xaHangChoXuongLs()` tại MỘT trong các đường lật `backend` về "ls" — còn
        nhánh `.catch` của `forecastStoreReady` (nap ném SAU khi đã đặt "idb")
        thì không, nên hàng chờ kẹt lại và hàm này trả `false` VĨNH VIỄN ⇒ mẻ
        tải sẵn luôn kết luận "Máy hết chỗ nhớ" + khoá 6 giờ. Đặt ở cửa ra thì
        phủ hết mọi đường, kể cả đường ai đó thêm sau này. Vét được bao nhiêu
        hay bấy nhiêu; localStorage cũng đầy thì hàng chờ còn lại và `false`
        chính là câu trả lời ĐÚNG. */
    xaHangChoXuongLs();
    return conKetLai(chiKhoa);
  }
  if (henDay != null) {
    clearTimeout(henDay);
    henDay = null;
  }
  /*  ⚠️ KHÔNG GÁC BẰNG PHÁN QUYẾT TOÀN KHO (vòng soát 7 — khuôn "nút bấm không
      được gì", TẦNG THỨ TƯ). Vòng 5–6 đã scope `conKetLai` theo mẻ, nhưng vẫn
      để `ok && …`, mà `ok` là kết quả của CẢ hàng chờ — và nhánh này là nhánh
      GẦN HẾT máy bà con chạy. Ca đã chứng minh bằng mã: tin bão 600 byte nằm
      THẬT trên đĩa mà `flush([tin bão])` vẫn `false` ⇒ `runLayer` ném ⇒ dòng đỏ,
      bấm bao nhiêu lần cũng đỏ.
      Câu trả lời đúng chỉ phụ thuộc: khoá của MẺ NÀY còn kẹt hàng chờ không, và
      có nằm trong danh sách "đĩa từ chối hẳn" không. */
  /*  ĐĨA CÓ THỂ ĐÃ LÀNH (bà con xoá bớt ảnh/video) ⇒ CHO MẤY MỤC TỪNG BỊ TỪ
      CHỐI HẲN một cơ hội nữa trước khi phán quyết. Không có vế này thì "tách ra
      cho khỏi đầu độc hàng chờ" biến thành "vứt đi vĩnh viễn". */
  if (khongGhiDuoc.size > 0) {
    for (const [k, v] of khongGhiDuoc) if (!hangCho.has(k)) hangCho.set(k, v);
    khongGhiDuoc.clear();
  }
  await day();
  return conKetLai(chiKhoa);
}

/**
 * Kho dự báo đang chiếm bao nhiêu BYTE — cho nhịp báo dung lượng tách theo kho
 * (xem `storageBreakdownMb`). Đọc từ gương nên rẻ, không đụng đĩa.
 */
export function forecastStoreBytes(): number {
  return guongKyTu * 2; // UTF-16
}

/** Lượt đẩy gần nhất có trót lọt không — cho màn hình nói thật khi đĩa từ chối. */
export function forecastStorePersistOk(): boolean {
  return dayOk;
}

/** CHỈ CHO TEST: xoá sạch trạng thái module giữa các ca. */
export function __resetForecastStore(): void {
  guong.clear();
  guongKyTu = 0;
  hangCho.clear();
  if (henDay != null) {
    clearTimeout(henDay);
    henDay = null;
  }
  if (henLai != null) {
    clearTimeout(henLai);
    henLai = null;
  }
  mucLuc = {};
  khongGhiDuoc.clear();
  ghiTungMuc = false;
  soDaGhi = false;
  ghiTrongLucNap.clear();
  xoaTrongLucNap.clear();
  nguoiCho.clear();
  soLanThuLai = 0;
  backend = "ls";
  daNap = false;
  napP = null;
  dbP = null;
  dangDay = null;
  dayOk = true;
  soLanNapHong = 0;
  dangNapLai = false;
  docSo(); // dựng lại sổ từ localStorage hiện tại của ca test
}
