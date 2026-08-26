// Trục 1 — SAO LƯU / PHỤC HỒI dữ liệu offline ra TỆP.
//
// Vì sao: bản tải sẵn nằm ở localStorage (gió/sóng/lớp màu/độ mặn/nước dâng/dòng
// chảy) + kho Service Worker (bản đồ cá). Máy/trình duyệt CÓ THỂ tự xoá cache
// (hết chỗ, "xoá dữ liệu web", cài lại app). Bà con đi biển dài mà mất sạch là
// nguy. Nay cho LƯU RA TỆP .json cầm theo, và PHỤC HỒI lại khi app lỡ xoá.
//
// Thuần dữ liệu — KHÔNG nguồn mới. parseBackup/summarizeBackup tách riêng để
// test được.
//
// ĐẢO CHIỀU MẶC ĐỊNH 2026-08-02 (audit vòng 2, T5 + C-C5) — CHẶN.
// -----------------------------------------------------------------------------
// Bản trước dùng DANH SÁCH CẤM (`SKIP_PREFIXES = tier + identity`), nên mọi khoá
// khác MẶC ĐỊNH LỌT: đếm thật là 35 khoá/họ khoá đang chui vào tệp, trong đó có
// tin nhắn nhắm riêng (`inbox.*`), CCCD 12 số + SĐT từng bạn thuyền (`crew.v1`,
// plaintext), tủ giấy tờ, điểm ghim luồng cá, MÃ MÁY (`device.v1`) và 4 khoá
// nhịp (`heartbeat.*`). Bà con lại AirDrop/Zalo tệp cho nhau vì tưởng nó là
// "chuyện dự báo" — câu chữ nút cũ nói đúng như vậy.
//
// Hai hỏng nặng ngoài dự báo:
//  · MÃ MÁY chia đôi ⇒ hai máy mang cùng mã ⇒ `customer_devices` ghi sai chủ,
//    và máy NHẬN bị đè mã ⇒ 3 mốc trên `customers` reset oan.
//  · 4 khoá nhịp bị đè ⇒ máy nhận IM NHỊP tới 30 phút, nhịp SỰ KIỆN thật bị nuốt.
//
// Nay là DANH SÁCH CHO PHÉP (khuôn `API_CACHE_ALLOW` của service worker): khoá
// mới thêm sau này MẶC ĐỊNH KHÔNG LỌT — muốn vào tệp phải tự tay ghi vào đây và
// tự trả lời "cái này chia cho máy khác có sao không".

import {
  FC_PREFIX,
  fcGet,
  fcKeys,
  fcSet,
  forecastStoreFlush,
  forecastStoreReady,
} from "@/lib/forecast-store";

/*  ═══ DỰ BÁO KHÔNG CÒN NẰM Ở localStorage ═══ (2026-08-02k — CHẶN nếu quên)

    Từ lúc lớp dự báo dời sang IndexedDB, mọi vòng `for (i < localStorage.length)`
    trong file này KHÔNG CÒN THẤY một khoá `forfish.fc.*` nào. Bỏ qua chỗ này thì
    nút "Lưu dự báo ra tệp" vẫn chạy, vẫn tải về một tệp .json trông bình thường
    — mà bên trong RỖNG phần dự báo. Bà con cầm tệp đó ra khơi tin là mình có bản
    dự phòng. Không có tiếng động nào báo hỏng: đó là lý do phải vá cùng lúc, chứ
    không phải "để commit sau".

    Nay mọi lượt đọc/ghi đi qua `kho*()` bên dưới: khoá `forfish.fc.*` hỏi
    `forecast-store`, khoá còn lại hỏi localStorage như cũ. */

/** Khoá localStorage của app đều bắt đầu forfish.* (quy ước dự án) */
const LS_PREFIX = "forfish.";

/** Khoá này thuộc kho dự báo (IndexedDB) hay kho thường (localStorage)? */
const laKhoDuBao = (k: string) => k.startsWith(FC_PREFIX);

/** Đọc một khoá bất kể nó nằm kho nào. */
function khoDoc(k: string): string | null {
  if (laKhoDuBao(k)) return fcGet(k);
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
}

/** Ghi một khoá vào ĐÚNG kho của nó. Ném khi hết chỗ (chỗ gọi đếm `failed`). */
function khoGhi(k: string, v: string): void {
  if (laKhoDuBao(k)) fcSet(k, v);
  else window.localStorage.setItem(k, v);
}

/** Mọi khoá `forfish.*` đang có trong máy, gộp CẢ HAI kho. */
function khoKhoa(): string[] {
  const out = new Set<string>(fcKeys());
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(LS_PREFIX)) out.add(k);
    }
  } catch {
    /* SSR / chặn lưu — lấy được bao nhiêu thì lấy */
  }
  return [...out];
}

/**
 * HAI CHẾ ĐỘ, HAI NÚT KHÁC NHAU (chủ dự án chốt 2026-08-02):
 *  · `forecast` — "Lưu dự báo ra tệp" (mặc định): CHỈ dự báo đã tải + cài đặt
 *    xem. Tệp này chia cho nhau không hại ai: nội dung y hệt thứ ai tải cũng ra.
 *  · `transfer` — "Chuyển toàn bộ sang máy mới": thêm dữ liệu bà con TỰ GÕ
 *    (giấy tờ, tàu, điểm ghim, bảo dưỡng, thương lái, vật tư). Đây là dữ liệu
 *    RIÊNG CỦA TÀU ⇒ nút kèm cảnh báo đỏ, chỉ đưa cho máy của chính mình.
 */
export type BackupMode = "forecast" | "transfer";

/**
 * DỰ BÁO — tải lại được, không nói gì về người dùng.
 * `forfish.fc.*` (lưới gió/sóng, điểm ghim, lớp dải màu, dòng chảy, nước dâng,
 * dấu bản đồ cá, TIN BÃO, bảng giá) + `forfish.sea.<port>.v3` (dự báo theo cảng).
 */
export const FORECAST_PREFIXES = ["forfish.fc.", "forfish.sea."];

/**
 * CÀI ĐẶT XEM — vô hại vì chỉ trả lời "xem thế nào", không trả lời "là ai" và
 * không mở quyền gì. Chọn theo `docs/app-map/ops/state-registry.md`:
 *  · displaymode — cỡ chữ (cụ già chỉnh một lần, mất là phải mò lại)
 *  · home / port — vùng quê + cảng đang xem (gõ tay, không phải định danh)
 *  · maplayer / mapPrefs — lớp bản đồ + đơn vị đo + bật/tắt vùng VMS
 * CỐ Ý BỎ, dù trông cũng "vô hại":
 *  · `installNudge.dismissed.v1` — máy MỚI chưa cài mà đã tắt lời nhắc cài.
 *  · `pwa-frame.<W>x<H>` — số đo màn hình MÁY KHÁC, đè vào là lệch khung.
 *  · `pretrip.lastRunAt.v1` — mốc tải sẵn; đè vào là khoá 6 giờ không cho máy
 *    vừa phục hồi tự kéo dự báo mới. Đúng lúc cần nhất thì im.
 */
export const SETTINGS_KEYS = [
  "forfish.displaymode.v1",
  "forfish.home.v1",
  "forfish.port.v1",
  "forfish.maplayer.v1",
  "forfish.mapPrefs.v1",
];

/**
 * DỮ LIỆU BÀ CON TỰ GÕ — mất là đau (không nguồn nào tải lại được), nhưng cũng
 * là chuyện riêng của tàu ⇒ CHỈ đi cùng chế độ `transfer`, kèm cảnh báo đỏ.
 */
export const TRANSFER_KEYS = [
  "forfish.documents.v1",
  "forfish.boats.v1",
  "forfish.currentBoat.v1",
  "forfish.boat.v1",
  "forfish.places.v1",
  "forfish.maintenance.v1",
  "forfish.products.v1",
  "forfish.buyers.v1",
  "forfish.sdvico-boat.v1",
];

/**
 * KHÔNG BAO GIỜ VÀO TỆP — dù chế độ nào, dù ai thêm khoá gì sau này.
 * Danh sách cho phép ở trên đã đủ chặn, đây là LỚP HAI (và là chỗ để người sau
 * đọc ra LÝ DO thay vì đoán):
 *  · `inbox.*`     — tin nhắm RIÊNG từng người; có sóng là tải lại được.
 *  · `crew.*`      — CCCD 12 số + SĐT người thật, lưu plaintext. Dữ liệu định
 *                    danh của NGƯỜI KHÁC, không phải của chủ máy.
 *  · `identity.*`  — "máy này là của SĐT nào". Nhập của người khác thì máy tự
 *                    nhận mình là người ta (mở nhầm hộp thư, cản xoá dấu tier).
 *  · `tier.*`      — dấu premium + hạn: chia tệp = chia quyền đã trả tiền.
 *  · `device.*`    — MÃ MÁY phải DUY NHẤT; trùng mã là ghi sai chủ máy.
 *  · `heartbeat.*` — mốc/chữ ký nhịp của MÁY KHÁC; đè vào là máy nhận im nhịp.
 *  · `token.*`     — CHUỖI CỨNG chứng minh "tôi là ai" (lib/device-token-store).
 *                    Chép sang máy khác = trao hẳn tài khoản; mà tệp thì bà con
 *                    AirDrop/Zalo cho nhau. Bắt được nhờ cổng quét `src/` trong
 *                    `offline-backup.test.ts` — khoá này ra đời sau bản vá.
 */
export const NEVER_BACKUP_PREFIXES = [
  "forfish.inbox.",
  "forfish.crew.",
  "forfish.identity.",
  "forfish.tier.",
  "forfish.device.",
  "forfish.heartbeat.",
  "forfish.token.",
  /*  · `sync.` — SỔ BOOKKEEPING đồng bộ per-máy (lib/user-sync): mỗi kind đã ghi
   *    lúc nào (mốc client) + còn dirty không. Của RIÊNG máy này. Chép sang máy
   *    khác là dán mốc/dirty sai → máy nhận tưởng đã đẩy/đã mới, bỏ qua sổ thật
   *    hoặc đè nhầm. Trạng thái đồng bộ tự dựng lại từ server, không mất gì. */
  "forfish.sync.",
  /*  · `auth.lastPhone.` — SĐT của người ĐĂNG NHẬP GẦN NHẤT trên MÁY NÀY
   *    (lib/auth-scope). Nó trả lời "máy này vừa là của ai" — cùng loại "là ai"
   *    với `identity.*`. Chép sang máy khác là dán SĐT người lạ vào bộ dò đổi
   *    tài khoản: máy nhận tưởng vừa đổi chủ (hoặc KHÔNG đổi) sai, xoá nhầm hoặc
   *    giữ nhầm dữ liệu KH. Và nó là số điện thoại thật của người khác. */
  "forfish.auth.",
  /*  · `fcindex.` — SỔ MỤC LỤC kho dự báo (lib/forecast-store). Nó mô tả
   *    "MÁY NÀY đang giữ bản nào, lưu lúc nào, nặng bao nhiêu" — payload thì
   *    nằm ở IndexedDB, KHÔNG đi trong tệp. Chép sổ sang máy khác là máy đó
   *    khai có 12 lớp dự báo trong khi kho rỗng: chip xanh, thẻ "đã đủ", rồi ra
   *    khơi mở bản đồ ra trắng. Đúng khuôn "dấu nói dối" mà cả mạch offline đi
   *    vá. Sổ tự dựng lại được từ chính kho lúc mở app nên không mất gì. */
  "forfish.fcindex.",
  /*  · `fcbia.` — DẤU ĐÃ XOÁ: khoá đã xoá mà lệnh xoá chưa tới được IndexedDB của
   *    MÁY NÀY (lib/forecast-store). Chép sang máy khác là ra lệnh xoá những lớp
   *    mà máy đó đang giữ hợp lệ — tức tệp sao lưu biến thành lệnh phá kho.
   *    Dấu tự tiêu sau khi thi hành xong, không mất gì khi không sao lưu. */
  "forfish.fcbia.",
  /*  · `persist.ask.` — MỐC LẦN XIN BỘ NHỚ BỀN của MÁY NÀY (lib/storage-persist,
   *    2026-08-03). Nó trả lời "máy NÀY đã hỏi lúc nào, trình duyệt gật hay
   *    từ chối" — câu trả lời gắn chặt với trình duyệt + nền của đúng máy đó.
   *    Chép sang máy khác là dán một câu trả lời sai vào máy chưa từng hỏi:
   *    máy mới im lặng suốt 24 giờ vì tưởng vừa hỏi rồi, còn /quan-tri thì báo
   *    "đã hỏi, bị từ chối" cho một máy chưa hỏi bao giờ. Mất khoá này không
   *    mất gì: lần mở app kế tiếp hỏi lại. */
  "forfish.persist.",
  /*  · `orders.` — ĐƠN ĐÃ ĐẶT của người đang đăng nhập (lib/catalog-orders,
   *    2026-08-18). Mang SĐT nhận hàng, tên người nhận, điểm giao — dữ liệu cá
   *    nhân, và CÓ SÓNG LÀ TẢI LẠI ĐƯỢC. Không có lý do gì để nó đi theo tệp
   *    sang máy khác; ngăn đã keyed theo SĐT nhưng tệp thì bà con AirDrop/Zalo
   *    cho nhau. Cùng luật với `inbox.`. */
  "forfish.orders.",
  /*  · `catalog.` — BẢN LƯU DANH MỤC CỬA HÀNG (lib/product-catalog,
   *    2026-08-18). Không PII, nhưng là bản chụp giá tại một thời điểm: chép
   *    sang máy khác là dán một bảng giá CŨ vào máy chưa từng tải, và máy đó
   *    hiện nó như bản của chính nó. Có sóng là tải lại được — bỏ ra ngoài tệp. */
  "forfish.catalog.",
  /*  · `cart.` — GIỎ HÀNG đang soạn của MÁY NÀY (lib/cart, 2026-08-11). Trạng
   *    thái tạm trước khi đặt đơn, keyed theo SĐT để cách ly máy dùng chung, và
   *    tự xoá sau khi đặt xong. Chép sang máy khác chẳng để làm gì (đơn đặt rồi
   *    nằm ở server, xem qua "Đơn của tôi"); mất khoá này không mất gì. */
  "forfish.cart.",
];

const hasPrefix = (k: string, list: readonly string[]) =>
  list.some((p) => k.startsWith(p));

/** Khoá này có được vào tệp ở chế độ đó không (thuần, có test). */
export function isBackupable(k: string, mode: BackupMode): boolean {
  if (!k.startsWith(LS_PREFIX)) return false;
  if (hasPrefix(k, NEVER_BACKUP_PREFIXES)) return false;
  if (hasPrefix(k, FORECAST_PREFIXES)) return true;
  if (SETTINGS_KEYS.includes(k)) return true;
  return mode === "transfer" && TRANSFER_KEYS.includes(k);
}

/** Kho /api/* của Service Worker — khớp SDFISH_API_V trong public/sw.js */
const API_CACHE = "sdfish-api-v1";
const FISH_URL = "/api/fish-forecast";

/**
 * Khoá kho BỀN của bản đồ cá — phải khớp `FISH_NS`/`FISH_ID` trong
 * `lib/fish-predict.ts` (có test canh, `offline-backup.test.ts`). Cố ý KHÔNG
 * import từ đó: `fish-predict` kéo theo cả cụm nguồn vệ tinh chạy phía máy chủ,
 * mà file này nằm trong đường tải của màn hình.
 */
const FISH_STORE_KEY = `${FC_PREFIX}fish.latest`;

export interface OfflineBackup {
  v: 1;
  savedAt: number;
  /**
   * Chế độ lúc lưu. Tệp ĐỜI CŨ không có trường này ⇒ coi như `forecast`
   * (HẸP NHẤT) — xem `importMode`, đừng đổi thành `transfer` cho "tiện".
   */
  mode?: BackupMode;
  /** các cặp key→value được phép sao lưu (xem isBackupable) */
  ls: Record<string, string>;
  /** payload bản đồ cá lấy từ kho SW (nếu có) */
  fish?: unknown;
}

/** Kiểm tra + ép kiểu chuỗi JSON → bản sao lưu hợp lệ (thuần, có test). */
export function parseBackup(json: string): OfflineBackup | null {
  let b: unknown;
  try {
    b = JSON.parse(json);
  } catch {
    return null;
  }
  if (
    !b ||
    typeof b !== "object" ||
    (b as OfflineBackup).v !== 1 ||
    typeof (b as OfflineBackup).ls !== "object" ||
    (b as OfflineBackup).ls == null
  ) {
    return null;
  }
  return b as OfflineBackup;
}

/**
 * Chế độ dùng để LỌC LÚC NHẬP.
 *
 * TỆP ĐỜI CŨ (không ghi `mode`) ⇒ `forecast` — HẸP NHẤT (sửa 2026-08-02, vòng
 * soát chéo). Bản vá trước để mặc định `transfer` "cho tệp cũ vẫn phục hồi được
 * đồ tự gõ", nhưng MỌI tệp đang lưu hành trên máy bà con đều là tệp đời cũ, mà
 * chú thích đầu file này nói rõ họ AirDrop/Zalo tệp cho nhau vì tưởng nó là
 * "chuyện dự báo". A gửi tệp cũ cho B ⇒ tủ giấy tờ, danh sách tàu, điểm ghim,
 * đồ trên tàu và SỔ MỐI QUEN (nậu vựa + số điện thoại) của A ghi đè máy B — đúng
 * thứ cả bản vá này dựng ra để chặn. Thà bắt bà con lưu lại tệp mới bằng nút
 * "Chuyển toàn bộ sang máy mới" (có cảnh báo đỏ, ghi `mode` đàng hoàng) còn hơn
 * đè im lặng đồ của người khác.
 *
 * Đổi lại: nhập tệp cũ thì đồ tự gõ trong đó BỊ BỎ QUA — sheet xác nhận PHẢI nói
 * thẳng chuyện đó (xem `BackupSummary.skipped`), không được im.
 */
function importMode(b: OfflineBackup): BackupMode {
  return b.mode === "transfer" ? "transfer" : "forecast";
}

/** Đếm phần tử của một khoá dạng mảng JSON (hỏng / không phải mảng → 0). */
function countList(raw: string | null | undefined): number {
  if (!raw) return 0;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.length : 0;
  } catch {
    return 0;
  }
}

/* ===========================================================================
   BẢNG NHÓM — MỘT NGUỒN SỰ THẬT cho cả "ghi được gì" lẫn "sheet đếm gì".

   VÌ SAO (2026-08-02, vòng soát chéo): bản vá trước có `isBackupable` (quyết
   định GHI) ở đây, còn `backupGroups()` (quyết định NÓI) là một danh sách GÕ
   TAY trong `pretrip-auto-notify.tsx` — và nó thiếu mất `products.v1` (đồ trên
   tàu), `buyers.v1` (SỔ NẬU VỰA + số điện thoại), `currentBoat`, `boat`,
   `sdvico-boat` cùng 5 khoá cài đặt. Kết quả: sheet hứa "Sẽ GHI ĐÈ: 12 lớp dự
   báo · 2 tàu", bà con bấm Đè, SỔ MỐI QUEN BAY MÀ KHÔNG AI BÁO. Cảnh báo đỏ
   "chuyển sang máy mới" còn tự phủ nhận chính nó: người chỉ có mối quen + đồ
   trên tàu thì nó in "chưa có gì bà con tự nhập" trên một tệp chứa nguyên danh
   bạ thương lái.

   Nay MỌI khoá ghi được đều phải tra ra một nhóm ở bảng dưới. Khoá lạ (ai thêm
   vào allowlist mà quên khai nhóm) rơi vào nhánh `unknown: true` — hiện NGUYÊN
   TÊN KHOÁ lên sheet (xấu, cố ý) và test `offline-backup.test.ts` ĐỎ.
   =========================================================================== */

export type BackupGroupKind = "forecast" | "fish" | "personal" | "settings";

export interface BackupGroupSpec {
  /** gộp nhiều khoá về một dòng (vd 5 khoá cài đặt xem) */
  id: string;
  /** tên bà con đọc được, viết thường để ghép câu */
  name: string;
  /** đơn vị đếm phần tử mảng ("giấy", "tàu"…); không có = chỉ có/không */
  unit?: string;
  /**
   * Nhóm GỘP NHIỀU KHOÁ (dự báo, cài đặt xem): đếm theo SỐ KHOÁ, không phải số
   * phần tử trong một khoá — 12 lớp dự báo là 12 khoá `forfish.fc.*` riêng biệt.
   */
  aggregate?: boolean;
  kind: BackupGroupKind;
  /** true = khoá chưa được khai nhóm (lỗi lập trình, phải ĐỎ ở test) */
  unknown?: boolean;
}

const SETTINGS_SPEC: BackupGroupSpec = {
  id: "settings",
  name: "cài đặt xem (cỡ chữ, cảng, lớp bản đồ)",
  unit: "mục",
  aggregate: true,
  kind: "settings",
};

const FORECAST_SPEC: BackupGroupSpec = {
  id: "forecast",
  name: "lớp dự báo",
  unit: "lớp",
  aggregate: true,
  kind: "forecast",
};

export const FISH_SPEC: BackupGroupSpec = {
  id: "fish",
  name: "bản đồ cá",
  kind: "fish",
};

/** Khoá TỰ GÕ → nhóm hiển thị. Phải phủ HẾT `TRANSFER_KEYS` (có test canh). */
const PERSONAL_SPECS: Record<string, BackupGroupSpec> = {
  "forfish.documents.v1": {
    id: "documents",
    name: "tủ giấy tờ",
    unit: "giấy",
    kind: "personal",
  },
  "forfish.boats.v1": {
    id: "boats",
    name: "danh sách tàu",
    unit: "tàu",
    kind: "personal",
  },
  "forfish.currentBoat.v1": {
    id: "currentBoat",
    name: "tàu đang chọn",
    kind: "personal",
  },
  "forfish.boat.v1": {
    id: "boat",
    name: "hồ sơ tàu (bản cũ)",
    kind: "personal",
  },
  "forfish.places.v1": {
    id: "places",
    name: "điểm ghim",
    unit: "điểm",
    kind: "personal",
  },
  "forfish.maintenance.v1": {
    id: "maintenance",
    name: "lịch bảo dưỡng",
    unit: "mục",
    kind: "personal",
  },
  "forfish.products.v1": {
    id: "products",
    name: "đồ trên tàu",
    unit: "món",
    kind: "personal",
  },
  "forfish.buyers.v1": {
    id: "buyers",
    name: "sổ mối quen (nậu vựa + số điện thoại)",
    unit: "mối",
    kind: "personal",
  },
  "forfish.sdvico-boat.v1": {
    id: "sdvicoBoat",
    name: "hồ sơ tàu gửi SDVICO",
    kind: "personal",
  },
};

/** Khoá → nhóm hiển thị (thuần, có test). Khoá lạ → nhóm `unknown`. */
export function backupGroupSpec(k: string): BackupGroupSpec {
  if (hasPrefix(k, FORECAST_PREFIXES)) return FORECAST_SPEC;
  if (SETTINGS_KEYS.includes(k)) return SETTINGS_SPEC;
  const p = PERSONAL_SPECS[k];
  if (p) return p;
  return { id: k, name: k, kind: "personal", unknown: true };
}

/**
 * Tên bà con đọc được của các họ khoá KHÔNG BAO GIỜ vào tệp — để sheet nói
 * THẲNG "tệp có thứ này nhưng app sẽ bỏ qua", thay vì câu trấn an chung chung.
 */
const NEVER_NAMES: Array<[string, string]> = [
  ["forfish.inbox.", "hộp thư"],
  ["forfish.crew.", "sổ bạn thuyền (CCCD)"],
  ["forfish.identity.", "tài khoản đăng nhập"],
  ["forfish.tier.", "dấu tài khoản nâng cao"],
  ["forfish.device.", "mã máy"],
  ["forfish.heartbeat.", "nhịp báo về"],
  ["forfish.fcindex.", "sổ mục lục kho dự báo"],
  ["forfish.fcbia.", "danh sách lớp chờ xoá của máy này"],
];

/** Một dòng trong bảng kê "sẽ ghi đè cái gì" — đếm CẢ HAI VẾ tệp/máy. */
export interface BackupGroup {
  id: string;
  name: string;
  kind: BackupGroupKind;
  /** đếm được theo phần tử (có `unit`) hay chỉ có/không */
  countable: boolean;
  unit: string;
  /** số đang nằm TRONG TỆP */
  file: number;
  /** số ĐANG CÓ trong máy lúc này */
  device: number;
  /**
   * Số sẽ MẤT nếu bấm Đè (chỉ tính cho nhóm ghi-đè-nguyên-khoá; nhóm gộp nhiều
   * khoá như dự báo/cài đặt thì đè theo từng khoá trùng tên nên không tính).
   */
  lost: number;
  /** khoá chưa khai nhóm — hiện nguyên tên, test phải ĐỎ */
  unknown: boolean;
}

function readLs(k: string): string | null {
  return khoDoc(k);
}

/** Đếm một khoá: nhóm gộp → 1 khoá là 1; còn lại → số phần tử mảng, hoặc 1. */
function countOne(raw: string | null, spec: BackupGroupSpec): number {
  if (raw == null) return 0;
  if (spec.aggregate) return 1;
  return spec.unit ? countList(raw) : 1;
}

/** Đếm mọi khoá TRONG MÁY thuộc một nhóm GỘP (dự báo / cài đặt xem). */
function deviceGroupCount(spec: BackupGroupSpec): number {
  let n = 0;
  for (const k of khoKhoa()) {
    if (backupGroupSpec(k).id === spec.id && k.startsWith(LS_PREFIX)) n++;
  }
  return n;
}

/**
 * BẢNG KÊ TRƯỚC KHI ĐÈ (thuần trên tệp, đọc thêm localStorage để so hai vế).
 * Phục hồi là GHI ĐÈ KHÔNG HOÀN TÁC ĐƯỢC: một chạm nhầm là tủ giấy tờ tháng
 * trước đè lên bản hôm nay, rồi biên phòng hỏi giấy giữa biển. Phải đếm ra được
 * "trong tệp bao nhiêu / trong máy đang bao nhiêu / đè xong còn gì" TRƯỚC khi
 * ghi một byte nào — chỉ đếm phía tệp là mời bà con hiểu nhầm "được thêm 3" khi
 * thật ra "mất 9".
 */
export interface BackupSummary {
  savedAt: number;
  mode: BackupMode;
  /** số khoá dự báo (lưới/điểm/lớp màu/bão/giá…) */
  layers: number;
  /** có kèm bản đồ cá dùng được không */
  fish: boolean;
  /** tổng số khoá THẬT SỰ sẽ ghi (đã lọc theo danh sách cho phép) */
  keys: number;
  /** từng nhóm sẽ bị ghi đè — SINH TỪ `isBackupable`, không gõ tay */
  groups: BackupGroup[];
  /**
   * Nhóm CÓ trong tệp nhưng app SẼ BỎ QUA: khoá cấm (sổ bạn thuyền, hộp thư,
   * mã máy…) hoặc đồ tự gõ trong tệp đời cũ (chế độ `forecast`). Sheet phải
   * đọc danh sách này ra, đừng hứa suông "thứ đó trong máy giữ nguyên".
   */
  skipped: string[];
}

export function summarizeBackup(b: OfflineBackup): BackupSummary {
  const mode = importMode(b);
  const all = Object.entries(b.ls).filter(([, v]) => typeof v === "string");
  const entries = all.filter(([k]) => isBackupable(k, mode));

  // ── nhóm SẼ GHI ĐÈ ───────────────────────────────────────────────────────
  const byId = new Map<string, BackupGroup>();
  for (const [k, v] of entries) {
    const spec = backupGroupSpec(k);
    const g = byId.get(spec.id) ?? {
      id: spec.id,
      name: spec.name,
      kind: spec.kind,
      countable: !!spec.unit,
      unit: spec.unit ?? "",
      file: 0,
      device: 0,
      lost: 0,
      unknown: !!spec.unknown,
    };
    g.file += countOne(v, spec);
    g.device += countOne(readLs(k), spec);
    byId.set(spec.id, g);
  }
  // Nhóm GỘP (dự báo / cài đặt): đè theo TỪNG khoá trùng tên, khoá khác tên
  // trong máy vẫn còn ⇒ đếm cả kho cho đúng, và KHÔNG hứa mất mát.
  for (const g of byId.values()) {
    if (g.id === FORECAST_SPEC.id || g.id === SETTINGS_SPEC.id) {
      g.device = deviceGroupCount(g);
      g.lost = 0;
    } else {
      g.lost = Math.max(0, g.device - g.file);
    }
  }
  const fish = b.fish != null && (b.fish as { ok?: boolean }).ok === true;
  const groups = [...byId.values()];
  if (fish) {
    groups.push({
      ...FISH_SPEC,
      countable: false,
      unit: "",
      file: 1,
      device: 0,
      lost: 0,
      unknown: false,
    });
  }

  // ── nhóm SẼ BỊ BỎ QUA (nói thẳng, đừng trấn an suông) ────────────────────
  const skipped: string[] = [];
  const push = (s: string) => {
    if (!skipped.includes(s)) skipped.push(s);
  };
  for (const [k] of all) {
    if (isBackupable(k, mode)) continue;
    if (!k.startsWith(LS_PREFIX)) continue;
    const never = NEVER_NAMES.find(([p]) => k.startsWith(p));
    if (never) {
      push(never[1]);
      continue;
    }
    // đồ tự gõ nằm trong tệp đời cũ / tệp chế độ dự báo → KHÔNG phục hồi
    if (TRANSFER_KEYS.includes(k)) push(backupGroupSpec(k).name);
  }

  return {
    savedAt: typeof b.savedAt === "number" ? b.savedAt : 0,
    mode,
    layers: entries.filter(([k]) => hasPrefix(k, FORECAST_PREFIXES)).length,
    fish,
    keys: entries.length,
    groups,
    skipped,
  };
}

/**
 * Gom bản đã lưu → JSON.
 * `mode` mặc định `forecast`: KHÔNG có gì của bà con lọt ra ngoài trừ khi họ tự
 * chọn nút "Chuyển toàn bộ sang máy mới".
 */
export async function exportOfflineData(
  mode: BackupMode = "forecast",
): Promise<string> {
  /*  CHỜ KHO DỰ BÁO MỞ XONG rồi mới gom — nếu không, bấm "Lưu ra tệp" ngay giây
      đầu mở app sẽ ra một tệp THIẾU HẲN phần dự báo mà chẳng có gì báo. */
  await forecastStoreReady();
  const ls: Record<string, string> = {};
  for (const k of khoKhoa()) {
    if (isBackupable(k, mode)) ls[k] = khoDoc(k) ?? "";
  }
  /*  BẢN ĐỒ CÁ ĐI Ở TRƯỜNG `fish`, KHÔNG ĐI HAI LƯỢT (2026-08-02k). Từ khi
      payload vào kho bền, nó vừa là khoá `forfish.fc.fish.latest` vừa là trường
      `fish` của tệp ⇒ để nguyên là tệp bà con tải về NẶNG GẤP ĐÔI vì chép cùng
      ~1 MB hai lần. Gỡ khỏi `ls`, lấy chính nó làm `fish` (kho SW chỉ còn là
      đường lùi cho tệp/máy đời cũ). Định dạng tệp v1 không đổi. */
  let fish: unknown;
  const rawFish = ls[FISH_STORE_KEY];
  delete ls[FISH_STORE_KEY];
  if (rawFish) {
    try {
      const j = JSON.parse(rawFish) as { data?: { ok?: boolean } };
      if (j?.data?.ok === true) fish = j.data;
    } catch {
      /* bản hỏng — thử tiếp kho SW bên dưới */
    }
  }
  try {
    if (fish == null && typeof caches !== "undefined") {
      const c = await caches.open(API_CACHE);
      const r = await c.match(FISH_URL);
      if (r) {
        /*  CHỈ GÓI BẢN ĐỒ CÁ CÒN DÙNG ĐƯỢC (2026-08-02, audit B7). Kho SW có
            thể đang giữ một phản hồi `{ok:false}` (bản trước route trả 200 kèm
            lỗi — nay đã sửa thành 503, nhưng máy bà con vẫn còn bản cũ). Gói
            rác vào tệp thì lúc phục hồi là ghi rác đè lên bản tốt, mà đây là
            bản DUY NHẤT của lớp cá. */
        const j = (await r.json()) as { ok?: boolean } | null;
        if (j && j.ok === true) fish = j;
      }
    }
  } catch {
    /* không có kho SW / khác origin — bỏ qua phần cá */
  }
  const backup: OfflineBackup = { v: 1, savedAt: Date.now(), mode, ls, fish };
  return JSON.stringify(backup);
}

/**
 * Thứ tự ghi lúc NHẬP: số nhỏ ghi trước.
 *
 * VÌ SAO (2026-08-02, vòng soát chéo): bản trước duyệt `Object.entries(b.ls)`
 * theo thứ tự khoá trong tệp ⇒ 2,5–3 MB dự báo xuống trước, tới lượt
 * `forfish.documents.v1` thì máy hết chỗ, `setItem` ném, `catch {}` RỖNG nuốt
 * im, sheet đóng như đã xong — mà tủ giấy tờ thì rỗng. Dự báo có sóng là tải
 * lại được; giấy tờ / sổ mối quen gõ tay thì KHÔNG. Vậy đồ tự gõ ghi TRƯỚC,
 * cài đặt xem sau, dự báo cuối cùng — và khoá nào ghi hỏng thì ĐẾM rồi trả về
 * cho màn hình BÁO ĐỎ (luật của `lib/user-store.ts`: hết chỗ → nói thật,
 * KHÔNG nuốt im).
 */
function writeRank(k: string): number {
  if (TRANSFER_KEYS.includes(k)) return 0;
  if (SETTINGS_KEYS.includes(k)) return 1;
  return 2;
}

/**
 * Ghi bản sao lưu trở lại máy (localStorage + kho SW bản đồ cá).
 *
 * PHẢI có `opts.confirmed === true` mới ghi (siết 2026-08-02, vòng soát chéo):
 * thiếu / `undefined` ⇒ KHÔNG ghi gì, trả `needsConfirm` để chỗ gọi mở sheet
 * "sẽ ghi đè những gì" trước. Cổng mà là opt-in thì không phải cổng: chỗ gọi
 * mới nào quên truyền cờ là ghi đè thẳng tủ giấy tờ, y như trước khi có sheet.
 */
export async function importOfflineData(
  json: string,
  opts: { confirmed?: boolean } = {},
): Promise<{
  ok: boolean;
  keys: number;
  /** số khoá KHÔNG ghi được (máy hết chỗ / bị chặn) — màn hình phải báo đỏ */
  failed: number;
  fishRestored?: boolean;
  needsConfirm?: boolean;
}> {
  if (opts.confirmed !== true)
    return { ok: false, keys: 0, failed: 0, needsConfirm: true };
  const b = parseBackup(json);
  if (!b) return { ok: false, keys: 0, failed: 0 };
  const mode = importMode(b);
  let keys = 0;
  let failed = 0;
  const writable = Object.entries(b.ls)
    // PHÒNG THỦ 2 LỚP: tệp đời cũ (gom tất) / sửa tay có lẫn khoá cấm → KHÔNG
    // ghi. Không cho import mở khoá premium bằng dấu tier của người khác, không
    // cho đè mã máy, không cho đè nhịp, không cho rước CCCD người lạ vào máy.
    .filter(([k, v]) => typeof v === "string" && isBackupable(k, mode))
    .sort(([a], [c]) => writeRank(a) - writeRank(c));
  await forecastStoreReady();
  for (const [k, v] of writable) {
    try {
      khoGhi(k, v as string);
      keys++;
    } catch {
      // hết chỗ / bị chặn — ĐẾM rồi thử khoá kế, KHÔNG nuốt im
      failed++;
    }
  }
  /*  ĐỢI DỰ BÁO NẰM XUỐNG ĐĨA THẬT rồi mới báo "xong" (2026-08-02k). Kho dự báo
      nhận ghi vào gương RAM trước, nên `khoGhi` không ném dù đĩa sắp từ chối.
      Không chờ ở đây là màn hình báo "phục hồi 14 lớp" trong khi tắt app đi mở
      lại chẳng còn lớp nào — đúng khuôn nói dối mà cả mạch này đi vá. */
  if (!(await forecastStoreFlush())) {
    const duBao = writable.filter(([k]) => laKhoDuBao(k)).length;
    failed += duBao;
    keys = Math.max(0, keys - duBao);
  }
  /*  ĐỐI XỨNG với lúc xuất: KHÔNG ghi bản `{ok:false}` đè lên kho (audit B7).
      Tệp đời cũ có thể mang rác từ thời route trả 200-kèm-lỗi; ghi vào đây là
      ghi đè bản DUY NHẤT của lớp cá — thứ giữa biển không tải lại được. */
  const fishOk = b.fish != null && (b.fish as { ok?: boolean }).ok === true;
  let fishRestored = false;
  if (fishOk) {
    /*  KHO BỀN TRƯỚC, KHO NHANH SAU (2026-08-02k). Kho SW là thứ WebKit dọn
        trước nhất; phục hồi mà chỉ ghi vào đó thì bản đồ cá sống được tới lần
        dọn kế tiếp. Ghi vào IndexedDB mới là phục hồi thật. */
    try {
      fcSet(FISH_STORE_KEY, JSON.stringify({ savedAt: Date.now(), data: b.fish }));
      fishRestored = (await forecastStoreFlush()) || fishRestored;
    } catch {
      /* hết chỗ kho bền — vẫn thử kho SW bên dưới, có còn hơn không */
    }
    try {
      if (typeof caches !== "undefined") {
        const c = await caches.open(API_CACHE);
        await c.put(
          new Request(FISH_URL),
          new Response(JSON.stringify(b.fish), {
            headers: { "content-type": "application/json" },
          }),
        );
        fishRestored = true;
      }
    } catch {
      /* không ghi được kho SW — bản đồ cá sẽ tự tải lại khi có sóng */
    }
  }
  return { ok: true, keys, failed, fishRestored };
}
