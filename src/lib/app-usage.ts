// THANG TRẠNG THÁI DÙNG APP — luật THUẦN, dùng chung client (gửi nhịp) ·
// route /api/me/heartbeat (ghi) · /quan-tri (hiện). Có test.
//
// Mỗi bậc chứng tỏ ĐÚNG MỘT việc người dùng đã làm:
//   0 chua-ghi-nhan   — máy chưa gửi nhịp nào. KHÔNG có nghĩa "chưa dùng app":
//                       heartbeat chỉ gửi khi ĐÃ ĐĂNG NHẬP và CÒN SÓNG, và cột
//                       chỉ ghi từ 2026-08-01. Bậc này nghĩa là CHƯA BIẾT.
//   1 moi-vo-web      — đã mở trong trình duyệt (đăng nhập, còn sóng), CHƯA mở
//                       bản cài. Không phân biệt được "chưa cài icon" với "cài
//                       rồi mà chưa bấm vào" — mà hậu quả hai ca GIỐNG HỆT: kho
//                       của bản cài vẫn trống.
//   2 da-mo-ban-cai   — đã mở icon bản cài ít nhất một lần khi còn sóng. Đây là
//                       bằng chứng đã qua ải "kho bản cài bắt đầu từ trống".
//   3 du-do-di-bien   — vỏ app đủ + mọi lớp dữ liệu đã tải, ĐO TRÊN ĐÚNG CÁI
//                       KHO sẽ dùng ngoài biển (xem countsAsOfflineReady).

/** Loại máy thô — khớp check constraint của `customers.device_platform` (0022) */
export type DevicePlatform = "ios" | "android" | "khac";

/** Nhãn chip loại máy ở /quan-tri — cùng khuôn ngắn, một dòng (luật nhãn 03) */
export const PLATFORM_LABEL: Record<DevicePlatform, string> = {
  ios: "iPhone",
  android: "Android",
  khac: "Máy khác",
};

/**
 * Ép giá trị máy gửi lên về đúng một loại hợp lệ — THUẦN, có test.
 *
 * Vì sao cần: giá trị này đi thẳng vào cột có CHECK constraint. Client cũ
 * (chưa có bản mới) không gửi gì → `null`, và null phải được giữ nguyên là
 * "chưa biết" chứ KHÔNG được đoán thành 'khac' — hai thứ đó khác nhau: một
 * bên là chưa hỏi, một bên là hỏi rồi mà không phải iOS/Android.
 */
export function normalizePlatform(v: unknown): DevicePlatform | null {
  return v === "ios" || v === "android" || v === "khac" ? v : null;
}

/**
 * Ép "ngày phủ dữ liệu" client khai về đúng một ngày dùng được — THUẦN, có test.
 *
 * Vì sao cần (0025): giá trị này đi thẳng vào một cột `date`. Một chuỗi rác lọt
 * xuống là **cả lệnh update hỏng** ⇒ mất luôn 3 mốc thời gian vốn đang chạy tốt
 * — đúng khuôn lỗi mà cột 0022 đã dính một lần. Client khai gì cũng không được
 * tin: đây là số liệu vận hành, sai thì chỉ hỏng thống kê của chính máy đó.
 *
 * Nhận: đúng dạng `YYYY-MM-DD`, là ngày CÓ THẬT, và nằm trong dải hợp lý
 * (2020-01-01 … 2100-01-01 — dự báo xa nhất của app là 16 ngày, nhưng đừng gắt
 * quá tới mức đồng hồ máy lệch vài ngày là mất số liệu).
 */
export function normalizeDataUntil(v: unknown): string | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const t = Date.parse(`${v}T00:00:00Z`);
  if (!Number.isFinite(t)) return null;
  // ngày có thật (bắt 2026-02-31 kiểu này)
  if (new Date(t).toISOString().slice(0, 10) !== v) return null;
  if (t < Date.parse("2020-01-01T00:00:00Z")) return null;
  if (t > Date.parse("2100-01-01T00:00:00Z")) return null;
  return v;
}

export type UsageStage =
  | "chua-ghi-nhan"
  | "moi-vo-web"
  | "da-mo-ban-cai"
  | "du-do-di-bien";

/** Nhãn chip — cùng khuôn 3 chữ, một dòng (luật nhãn ngang hàng, 03) */
export const USAGE_STAGE_LABEL: Record<UsageStage, string> = {
  "chua-ghi-nhan": "Chưa ghi nhận",
  "moi-vo-web": "Chưa mở bản cài",
  "da-mo-ban-cai": "Chưa đủ dữ liệu",
  "du-do-di-bien": "Đủ đồ đi biển",
};

/**
 * Nhịp này có được tính là "ĐỦ ĐỒ ĐI BIỂN" không.
 *
 * LUẬT: **phải gửi TỪ BẢN CÀI**, mọi nền, không ngoại lệ.
 *
 * ⚠️ LÝ DO GỐC (2026-08-01): iOS cho bản "Thêm vào Màn hình chính" một KHO
 * LƯU TRỮ RIÊNG, tách hẳn Safari. Tải đủ dữ liệu TRONG SAFARI **không chứng
 * minh được gì** cho cái icon mà bà con sẽ bấm lúc ra khơi — chip báo xanh cho
 * đúng người sắp nhổ neo với bản cài TRỐNG TRƠN (TC-13 trong
 * ops/qa-offline-acceptance.md).
 *
 * ⚠️ SIẾT SANG CẢ ANDROID (2026-08-01j, chủ dự án chốt: "1 chiều thôi, web →
 * PWA → tải; nếu không PWA thì cứ nằm ở Web để đảm bảo họ có PWA"). Bản trước
 * miễn cho Android vì bản cài ở đó dùng CHUNG kho với Chrome, nên xét về DỮ
 * LIỆU thì tải ở tab cũng như tải ở bản cài. Nhưng thang này không chỉ đo dữ
 * liệu — nó là DANH SÁCH GỌI ĐIỆN. Người Android tải đủ trong tab sẽ nhảy
 * thẳng lên bậc cao nhất, `usageCallPriority` = 3 ("yên tâm nhất"), rơi khỏi
 * danh sách nhắc cài — dù màn hình họ chưa có cái icon nào. Mà tab Chrome dễ
 * bị dọn hơn bản cài, `persist()` cũng khó được cấp hơn, và bà con phải nhớ
 * đường vào thay vì bấm icon. Nay chưa cài thì đứng lại ở "Chưa mở bản cài",
 * bậc "đủ đồ" KHÔNG có đường tắt.
 */
export function countsAsOfflineReady(beat: {
  offlineReady: boolean;
  standalone: boolean;
}): boolean {
  if (!beat.offlineReady) return false;
  // chỉ tính khi nhịp gửi TỪ BẢN CÀI — đúng cái kho sẽ dùng ngoài biển
  return beat.standalone;
}

/** Quy 3 mốc trong DB về đúng một bậc (bậc cao nhất đạt được). */
export function usageStage(a: {
  pwaLastOpenAt: string | null;
  webLastOpenAt: string | null;
  offlineReadyAt: string | null;
}): UsageStage {
  if (a.offlineReadyAt) return "du-do-di-bien";
  if (a.pwaLastOpenAt) return "da-mo-ban-cai";
  if (a.webLastOpenAt) return "moi-vo-web";
  return "chua-ghi-nhan";
}

/**
 * Mức ĐÁNG GỌI ĐIỆN — số càng nhỏ càng cần liên hệ trước. Dùng để xếp danh
 * sách ở /quan-tri: nhóm mới-vô-web đứng đầu vì họ là nhóm sẽ ra khơi với máy
 * trắng tay mà không biết.
 */
export function usageCallPriority(stage: UsageStage): number {
  switch (stage) {
    case "moi-vo-web":
      return 0; // nguy hiểm nhất: đã dùng app mà bản cài vẫn trống
    case "da-mo-ban-cai":
      return 1; // chỉ cần nhắc bấm tải
    case "chua-ghi-nhan":
      return 2; // chưa biết gì — phải hỏi trực tiếp
    case "du-do-di-bien":
      return 3; // yên tâm nhất
  }
}

/* ── CHIP "SẴN SÀNG ĐI BIỂN" ────────────────────────────────────────────────
   (2026-08-02g — chủ dự án chốt: gộp "online lần cuối" + "dữ liệu tới ngày nào"
   thành MỘT chip trong /quan-tri, và PHẢI phân biệt bản cài với bản web.)

   TỐI ƯU ĐÁNG NÓI: **không cần cột `last_online_at`, không cần migration cho
   nó.** "Lần cuối máy còn sóng" chính là mốc nhịp gần nhất — `pwa_last_open_at`
   / `web_last_open_at` đã ghi đúng thứ đó từ 0021, vì nhịp CHỈ gửi được khi máy
   có sóng. Thêm cột mới là chép lại dữ liệu đã có rồi phải giữ hai chỗ đồng bộ.

   VÌ SAO GỘP MỘT CHIP: hai con số chỉ có nghĩa KHI ĐI VỚI NHAU. "Dữ liệu tới
   18/08" nghe rất yên tâm, nhưng nếu máy lần cuối online là 9 ngày trước thì đó
   là **lời khai cũ**. Ngược lại "online 5 phút trước" mà dữ liệu chỉ tới ngày
   mai thì đó là người ĐÁNG GỌI NHẤT: còn sóng, còn kịp bảo họ bấm tải. Tách hai
   chip là bắt người trực tổng đài tự ghép trong đầu, mỗi hàng một lần.

   VÌ SAO PHẢI PHÂN BIỆT KHO (chủ dự án: *"user đã pass qua bước bản cài, đã có
   dữ liệu, nhưng sau đó toàn dùng bản web?"*): trên iOS kho bản cài TÁCH RIÊNG
   với Safari. Nhóm này nguy hiểm mà nhìn qua lại rất đẹp — họ mở app hằng ngày
   (nên "online lần cuối" luôn tươi), đã từng đủ đồ (nên bậc thang vẫn xanh),
   nhưng cái kho sẽ theo họ ra khơi thì đứng im từ lâu. Chip phải đo mốc của
   ĐÚNG KHO ĐÓ, không đo mốc mới nhất. */

/** Máy còn sóng lần cuối — TÁCH THEO KHO, vì hai kho có thể lệch nhau hẳn. */
export function lastOnlineAt(a: {
  pwaLastOpenAt: string | null;
  webLastOpenAt: string | null;
}): { sea: string | null; web: string | null; any: string | null } {
  const sea = a.pwaLastOpenAt ?? null;
  const web = a.webLastOpenAt ?? null;
  const any = !sea ? web : !web ? sea : sea > web ? sea : web;
  return { sea, web, any };
}

/** Còn bao nhiêu ngày dữ liệu phủ tới, tính từ hôm nay. null = không biết. */
export function daysOfDataLeft(
  dataUntil: string | null | undefined,
  nowMs: number,
): number | null {
  if (!dataUntil) return null;
  const t = Date.parse(`${dataUntil}T00:00:00+07:00`);
  if (!Number.isFinite(t)) return null;
  return Math.floor((t - nowMs) / 86_400_000);
}

export type ReadinessTone = "ok" | "warn" | "risk" | "unknown";

/** Vì sao chip có màu đó — để /quan-tri nói ĐÚNG việc cần làm, không nói chung chung */
export type ReadinessReason =
  | "chua-ghi-nhan"
  | "chua-cai"
  | "ban-cai-cu"
  | "het-du-lieu"
  | "sap-can"
  | "mat-song-lau"
  | "chua-bao-ngay"
  | "on";

export interface Readiness {
  tone: ReadinessTone;
  reason: ReadinessReason;
  /** mốc online của KHO SẼ RA KHƠI (bản cài) */
  seaOnline: string | null;
  /** mốc online của kho web */
  webOnline: string | null;
  /** số ngày dữ liệu kho bản cài còn phủ */
  seaDays: number | null;
  /** số ngày dữ liệu kho web còn phủ */
  webDays: number | null;
}

/** Bao lâu không mở bản cài thì con số của nó thành "lời khai cũ" */
export const SEA_STALE_DAYS = 3;
/** Dưới bấy nhiêu ngày dữ liệu thì gọi nhắc là còn kịp */
export const DATA_LOW_DAYS = 3;

/**
 * CHIP GỘP — THUẦN, có test. Luật màu ở đây là luật VẬN HÀNH, không phải thẩm mỹ.
 */
export function readinessChip(
  a: {
    pwaLastOpenAt: string | null;
    webLastOpenAt: string | null;
    /** ngày phủ của kho BẢN CÀI (customers.data_until) */
    dataUntil: string | null;
    /** ngày phủ của kho WEB (customers.data_until_web, migration 0027) */
    dataUntilWeb?: string | null;
  },
  nowMs: number,
): Readiness {
  const on = lastOnlineAt(a);
  const seaDays = daysOfDataLeft(a.dataUntil, nowMs);
  const webDays = daysOfDataLeft(a.dataUntilWeb, nowMs);
  const base = {
    seaOnline: on.sea,
    webOnline: on.web,
    seaDays,
    webDays,
  };

  // Chưa nhịp nào — KHÔNG tô đỏ: "chưa ghi nhận" không có nghĩa là chưa dùng app
  // (nhịp chỉ gửi khi ĐÃ đăng nhập + còn sóng, và chỉ ghi từ 01/08/2026).
  if (!on.any) return { tone: "unknown", reason: "chua-ghi-nhan", ...base };

  /*  CHƯA BAO GIỜ MỞ BẢN CÀI. Kho web có đầy tới đâu cũng không theo họ ra khơi
      được (iOS), nên đây là nhóm đáng gọi nhất — đúng `usageCallPriority` 0. */
  if (!on.sea) return { tone: "risk", reason: "chua-cai", ...base };

  // Kho sẽ ra khơi đã hết dữ liệu → gọi ngay.
  if (seaDays != null && seaDays <= 0) {
    return { tone: "risk", reason: "het-du-lieu", ...base };
  }

  const seaMs = Date.parse(on.sea);
  const seaStale =
    Number.isFinite(seaMs) &&
    Math.floor((nowMs - seaMs) / 86_400_000) > SEA_STALE_DAYS;

  /*  CA CHỦ DỰ ÁN CHỈ RA: đã cài, đã có dữ liệu, nhưng gần đây TOÀN DÙNG WEB.
      Đặt TRƯỚC nhánh "mất sóng lâu" vì việc cần làm khác hẳn: không phải "gọi
      lúc có sóng" mà là "bảo bà con mở ĐÚNG cái icon đã cài". */
  if (seaStale && on.web && on.web > on.sea) {
    return { tone: "warn", reason: "ban-cai-cu", ...base };
  }
  if (seaStale) return { tone: "warn", reason: "mat-song-lau", ...base };

  // Có mở bản cài gần đây nhưng chưa báo được ngày phủ → không dám nói là ổn.
  if (seaDays == null) {
    return { tone: "warn", reason: "chua-bao-ngay", ...base };
  }
  if (seaDays < DATA_LOW_DAYS) {
    return { tone: "warn", reason: "sap-can", ...base };
  }
  return { tone: "ok", reason: "on", ...base };
}


/* ── DUNG LƯỢNG KHO CỦA MÁY (0029) ─────────────────────────────────────────
   Chủ dự án chốt 2026-08-02j: *"làm cái heartbeat để biết dung lượng storage bao
   nhiêu thôi rồi phải ưu tiên localStorage rồi cache rồi… để đảm bảo offline
   luôn chạy."*

   Chuyện thật dẫn tới đây: cả một ngày soát offline xây trên con số "localStorage
   5 MB" mà không ai đo. Đo thật thì Chromium cho **99,88 MB** và 1.425 MB cho cả
   origin. iOS thì CHƯA AI ĐO — mà iPhone là phần lớn bà con. Không quyết kiến
   trúc lưu trữ bằng phỏng đoán được; để đội tàu đo hộ. */

/** Trần trên cho số MB báo lên — chặn số rác, và 4 TB là quá đủ cho điện thoại */
export const STORAGE_MB_MAX = 4 * 1024 * 1024;

/**
 * Số MB hợp lệ để ghi xuống cột `integer`, hoặc `null`. THUẦN, có test.
 *
 * Client khai sai chỉ hỏng thống kê của chính máy đó, KHÔNG mở được quyền gì —
 * nhưng vẫn phải chặn: một chuỗi lạ / số âm / Infinity xuống thẳng cột `integer`
 * là CẢ LỆNH UPDATE HỎNG, mất luôn mấy mốc thời gian vốn đang chạy tốt (đúng
 * khuôn lỗi cột 0022 đã dính).
 */
export function normalizeStorageMb(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number.NaN;
  if (!Number.isFinite(n) || n < 0 || n > STORAGE_MB_MAX) return null;
  return Math.round(n);
}
