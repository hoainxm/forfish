/**
 * SỔ NGUỒN — "nhiều nguồn cho một trường, so ngày lấy bản mới nhất, một nguồn
 * hỏng thì hệ thống vẫn chạy".
 *
 * Vì sao có file này (yêu cầu chủ dự án 2026-07-26): trước đây route dự báo cá
 * chỉ có NỬA SAU của lời hứa — nguồn tuỳ chọn lỗi thì `.catch(()=>null)` rồi bỏ
 * yếu tố. Thiếu hẳn: (a) mỗi trường có NHIỀU nguồn ứng viên, (b) SO NGÀY để lấy
 * bản mới nhất, (c) chặn tuổi (ảnh 20 ngày trước KHÔNG được coi là "hôm nay"),
 * (d) ghi lại đã dùng nguồn nào / ngày nào để tầng trên hạ chất lượng cho thật.
 *
 * File này THUẦN (không fetch, không đọc đồng hồ máy): nhận danh sách ứng viên
 * + ngày hôm nay, trả về bản thắng cuộc. Fetch nằm trong `load()` của từng ứng
 * viên do route dựng — nên test được toàn bộ luật mà không cần mạng.
 *
 * Ngày dùng ở đây LUÔN là "YYYY-MM-DD" theo GIỜ VIỆT NAM (`isoDateVN`), khớp
 * cách nhãn ngày của app (xem lib/day-labels.ts) — máy chủ Vercel chạy UTC nên
 * KHÔNG được lấy ngày/tháng từ đồng hồ máy chủ.
 */

import { daysBetweenISO } from "@/lib/day-labels";

/** Một NGUỒN ỨNG VIÊN cho một trường (vd SST). Xếp trong mảng theo ưu tiên. */
export interface FieldCandidate<T> {
  /** khoá ổn định ghi vào provenance, vd "noaa-blended-sst" */
  id: string;
  /** tên người đọc doc hiểu được, vd "NOAA Blended SST (daily)" */
  label: string;
  /** quá ngần này ngày = KHÔNG còn coi là hiện tại (vẫn dùng, nhưng gắn stale) */
  maxAgeDays: number;
  /**
   * Tải + parse. `date` là ngày của DỮ LIỆU (ảnh vệ tinh), KHÔNG phải lúc tải.
   * Không có dữ liệu dùng được → trả `null` (hoặc cứ ném lỗi, đã bắt hết).
   */
  load: () => Promise<{ grid: T; date: string } | null>;
}

/** Bản thắng cuộc + lý lịch của nó */
export interface Resolved<T> {
  grid: T;
  id: string;
  /** ngày dữ liệu "YYYY-MM-DD" */
  date: string;
  /** số ngày từ ngày dữ liệu tới hôm nay (≥ 0) */
  ageDays: number;
  /** quá `maxAgeDays` — dữ liệu CŨ, tầng trên phải hạ chất lượng */
  stale: boolean;
}

/** Phần ghi vào payload cho client/kiểm tra (bỏ `grid` cho nhẹ) */
export type FieldProvenance = Omit<Resolved<unknown>, "grid">;

/**
 * Nguồn TĨNH (địa hình đáy ETOPO — đáy biển không đổi theo ngày): không có khái
 * niệm "cũ". Dùng hằng này làm `maxAgeDays` để không bao giờ bị đánh stale.
 */
export const STATIC_MAX_AGE_DAYS = 36500;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-07-26" hợp lệ? (chuỗi rỗng / "last" / ngày bịa → false) */
export function isValidIsoDate(s: unknown): s is string {
  if (typeof s !== "string" || !ISO_DATE_RE.test(s)) return false;
  return Number.isFinite(Date.parse(`${s}T00:00:00Z`));
}

/**
 * Chọn bản dùng được MỚI NHẤT trong các ứng viên của MỘT trường.
 *
 * Luật (mỗi luật có test riêng ở __tests__/source-registry.test.ts):
 *  1. Chạy MỌI ứng viên SONG SONG (`Promise.allSettled`) — không tuần tự, vì
 *     route dự báo cá chỉ có 60 s và ứng viên nào cũng là lưới vài trăm KB.
 *  2. Bỏ ứng viên ném lỗi / trả `null` / ngày không parse được.
 *  3. Trong số còn lại, lấy bản có `date` MỚI NHẤT. HOÀ ngày → lấy ứng viên ưu
 *     tiên cao hơn (đứng TRƯỚC trong mảng).
 *  4. `ageDays` = số ngày từ `date` tới `todayIso` (ngày tương lai → kẹp 0).
 *  5. Bản mới nhất mà vẫn quá tuổi → VẪN TRẢ VỀ (thà có ảnh cũ còn hơn không có
 *     gì) nhưng `stale: true` — KHÔNG âm thầm coi là hiện tại.
 *  6. Không ứng viên nào dùng được → `null` (tầng trên tự quyết bỏ yếu tố hay
 *     trả {ok:false}).
 */
export async function resolveField<T>(
  cands: FieldCandidate<T>[],
  todayIso: string,
): Promise<Resolved<T> | null> {
  // luật 1 — song song, một ứng viên chậm/treo không chặn ứng viên khác
  const settled = await Promise.allSettled(cands.map((c) => c.load()));

  let best: Resolved<T> | null = null;
  for (let i = 0; i < settled.length; i++) {
    const r = settled[i];
    // luật 2 — lỗi / null / thiếu ngày thì bỏ qua, KHÔNG làm hỏng cả trường
    if (r.status !== "fulfilled" || !r.value) continue;
    const { grid, date } = r.value;
    if (!isValidIsoDate(date)) continue;

    // luật 4 — tuổi theo NGÀY VIỆT NAM; ảnh "ngày mai" (lệch múi giờ) coi là 0
    const ageDays = Math.max(0, daysBetweenISO(date, todayIso));
    const cand: Resolved<T> = {
      grid,
      id: cands[i].id,
      date,
      ageDays,
      // luật 5 — quá tuổi vẫn dùng, nhưng phải NÓI THẬT là cũ
      stale: ageDays > cands[i].maxAgeDays,
    };
    // luật 3 — chỉ thay khi ngày MỚI HƠN THẬT (so chuỗi ISO = so ngày); bằng
    // ngày thì giữ bản đang có = ứng viên đứng trước = ưu tiên cao hơn
    if (best === null || cand.date > best.date) best = cand;
  }
  // luật 6 — không ai dùng được
  return best;
}

/* ----------------------------------------------------------------------------
   Điểm chất lượng dữ liệu — 0..1
---------------------------------------------------------------------------- */

/** Trường bắt buộc bị CŨ: trừ nặng (SST/phù du cũ = cả bản đồ lệch) */
export const STALE_REQUIRED_PENALTY = 0.25;

/**
 * PHẠT THEO ĐÒN BẨY — mất mỗi nguồn TUỲ CHỌN trừ bao nhiêu vào `dataQuality`.
 *
 * PHẠM VI (chốt 2026-07-27): `dataQuality` chỉ còn phục vụ TRANG QUẢN TRỊ (staff
 * xem sức khoẻ nguồn) — KHÔNG còn cảnh báo bà con ("thiếu vài nguồn" đã bỏ ở
 * `lowQualityNote`). Vẫn phạt theo ĐÒN BẨY để số quản trị phản ánh đúng nguồn
 * nào mất nặng, không phải để doạ user.
 *
 * VÌ SAO KHÔNG PHẠT ĐỀU (sửa 2026-07-26): bản cũ trừ 0,05 đều cho mọi trường ⇒
 * mất nguồn NẶNG (ETOPO/HYCOM/SSHA) và mất nguồn NHẸ (dòng/dị thường) trông như
 * nhau trong số quản trị, không phân biệt được mức hệ trọng.
 *
 * CĂN CỨ — ablation ĐÃ ĐO (Δ %diện tích điểm nóng khi BỎ nguồn, hè/đông):
 *   · bathy  (ETOPO độ sâu)      bỏ đi: %điểm nóng mùa đông 67,8 → 33,0 (−34,8)
 *   · sla    (SSHA)              −21,9
 *   · hycom  (nhiệt theo tầng)   −1,7 hè / −6,0 đông — số nhỏ nhưng là nguồn
 *     DUY NHẤT cho cả ba lưới d20/nhiệt đáy/nhiệt 250 m: mất là mất cả cụm
 *   · currents (hội tụ)          −2,3
 *   · anom   (dị thường nhiệt)   −2,1
 * Trọng số đặt tỉ lệ theo thứ hạng đó, làm tròn cho dễ đọc.
 *
 * Trường CÓ nhưng CŨ trừ MỘT NỬA mức mất hẳn (giữ tỉ lệ 2:1 như bản cũ
 * 0,05 : 0,025) — dữ liệu cũ vẫn hơn không có gì.
 */
export const MISSING_PENALTY_BY_FIELD: Record<string, number> = {
  // ĐÒN BẨY đo được (ablation Δ%điểm nóng khi bỏ nguồn, scripts/model-discrimination-audit.mjs):
  //   bathy  — mất ETOPO: %điểm nóng mùa đông 67.8 → 33.0 (cổng độ sâu cho loài xa bờ)
  //   sla    — −21.9đ (mang HAI cơ chế: rìa xoáy + độ lõm mực nước)
  //   hycom  — −1.7 hè / −6.0 đông, VÀ là cổng nhiệt ĐÁY cho 11 loài đáy mềm
  //   currents/anom — −2.3 / −2.1, nhẹ
  // Ngưỡng LOW_QUALITY_THRESHOLD 0.9 chọn để mất BẤT KỲ nguồn nặng nào (bathy/sla/
  // hycom) đều bật cảnh báo, còn mất nguồn nhẹ thì im — không doạ oan.
  bathy: 0.2,
  sla: 0.15,
  hycom: 0.15,
  currents: 0.05,
  anom: 0.05,
};
/** Trường tuỳ chọn lạ (thêm sau mà quên khai đòn bẩy) → mức nhẹ, không doạ oan */
export const MISSING_OPTIONAL_PENALTY = 0.05;
/**
 * Lệch ngày giữa các lưới quá mức này thì trừ điểm chất lượng.
 *
 * Các trường resolve ĐỘC LẬP nên nhịp nguồn khác nhau: ảnh vệ tinh trễ 1–2 ngày,
 * dòng Copernicus là nowcast theo GIỜ. Công thức đang NHÂN front (ảnh cũ) với
 * hội tụ (hôm nay) ⇒ lệch pha ~1–2 ô ở dòng 0,3 m/s. Không ép được mọi nguồn
 * cùng ngày (nguồn không có), nhưng lệch lớn thì phải NÓI, không để vô hình.
 */
export const MAX_GRID_SKEW_DAYS = 3;
/** Trừ bao nhiêu khi lệch ngày vượt ngưỡng */
export const SKEW_PENALTY = 0.1;
/** Trường CÓ nhưng cũ = một nửa mức mất hẳn của chính trường đó */
export const STALE_PENALTY_RATIO = 0.5;

/** Mất trường `key` trừ bao nhiêu điểm (trường bắt buộc → 1 = về 0) */
export function missingPenalty(key: string, required: boolean): number {
  if (required) return 1;
  return MISSING_PENALTY_BY_FIELD[key] ?? MISSING_OPTIONAL_PENALTY;
}

export interface QualityField {
  /** khoá trường ("sst" | "chl" | "sla" | "anom" | "currents" | "hycom" | "bathy") */
  key: string;
  /** true = thiếu hẳn thì route trả {ok:false} (SST, phù du) */
  required: boolean;
  /** null = KHÔNG nguồn nào dùng được cho trường này */
  resolved: { stale: boolean } | null;
}

/**
 * Điểm chất lượng 0..1 cho một lượt dự báo:
 *
 *   bắt đầu 1.0
 *   − 0.25 mỗi trường BẮT BUỘC bị cũ (stale)
 *   − MISSING_PENALTY_BY_FIELD[key] mỗi trường TUỲ CHỌN mất hẳn (theo ĐÒN BẨY)
 *   − một NỬA mức đó nếu trường TUỲ CHỌN có nhưng cũ
 *   (trường BẮT BUỘC mất hẳn → 0: route đã trả {ok:false}, tính cho đủ luật)
 *   kẹp về [0,1], làm tròn 3 số lẻ (khỏi rác dấu phẩy động).
 *
 * Với bộ trường hiện tại (2 bắt buộc + 5 tuỳ chọn), mất HẾT tuỳ chọn trừ 0,55 →
 * 0,45; thêm 2 trường bắt buộc cũ nữa thì kẹp về 0. CHỈ để hạ kỳ vọng/nhắc bà
 * con, KHÔNG dùng làm hệ số nhân vào điểm cá (không được lấy chất lượng nguồn
 * sửa điểm loài).
 */
export function dataQuality(
  fields: QualityField[],
  /** lệch ngày lớn nhất giữa các lưới (từ `gridDateSkewDays`); bỏ trống = 0 */
  skewDays = 0,
): number {
  let q = 1;
  for (const f of fields) {
    const miss = missingPenalty(f.key, f.required);
    if (f.resolved === null) {
      q -= miss;
    } else if (f.resolved.stale) {
      q -= f.required ? STALE_REQUIRED_PENALTY : miss * STALE_PENALTY_RATIO;
    }
  }
  // Lệch pha giữa các lưới: front (ảnh cũ) × hội tụ (hôm nay) là số nhân của hai
  // thời điểm khác nhau — không sửa được bằng nguồn hiện có, nhưng phải TRỪ ĐIỂM
  // chứ không im lặng coi như cùng ngày.
  if (skewDays > MAX_GRID_SKEW_DAYS) q -= SKEW_PENALTY;
  return Math.max(0, Math.min(1, Math.round(q * 1000) / 1000));
}

/**
 * Tháng MÙA VỤ phải lấy theo NGÀY CỦA DỮ LIỆU, không phải đồng hồ máy chủ.
 * Sự cố đã xác minh: `new Date().getMonth()+1` chạy trên Vercel (UTC) nên ngày
 * 1/8 lúc 3h sáng VN vẫn là 31/7 UTC → lệch tháng; và cuối tháng thì ảnh vệ
 * tinh của tháng TRƯỚC bị ghép mùa vụ tháng MỚI (ảnh 31/7 + mùa vụ tháng 8).
 * Ngày hỏng → 0 để nơi gọi tự lùi (không bịa tháng).
 */
export function monthOfIsoDate(isoDate: string): number {
  if (!isValidIsoDate(isoDate)) return 0;
  return Number(isoDate.slice(5, 7));
}

/**
 * Ngày dữ liệu THỰC SỰ dùng để lọc mùa vụ = ngày CŨ NHẤT trong các trường BẮT
 * BUỘC (khớp cách `FishForecast.date` lấy ảnh cũ hơn — nói thật, không lấy ngày
 * đẹp nhất). Không có ngày nào hợp lệ → "".
 */
export function oldestIsoDate(dates: (string | null | undefined)[]): string {
  const ok = dates.filter(isValidIsoDate).sort();
  return ok[0] ?? "";
}

/* ----------------------------------------------------------------------------
   Một dòng nói thật cho bà con (client)
---------------------------------------------------------------------------- */

/**
 * Ngưỡng `dataQuality` coi là "chắp vá nhiều" — nay CHỈ dùng cho TRANG QUẢN TRỊ
 * và test (KHÔNG còn gác câu cảnh báo bà con; xem `lowQualityNote`).
 *
 * Với đòn bẩy hiện tại: mất bathy → 0.80 · sla → 0.85 · hycom → 0.85 (nặng);
 * mất currents/anom → 0.95 (nhẹ). Staff nhìn số này để biết nguồn nào rụng.
 */
export const LOW_QUALITY_THRESHOLD = 0.9;

/**
 * Câu nhắc khi bản đồ cá dựng từ ảnh CŨ — `null` = KHÔNG nói gì.
 *
 * Màn hình phải GỌN (quyết định sản phẩm 2026-07-25) nên đây KHÔNG phải badge
 * thường trực: chỉ hiện trong ca xấu, rồi tự tắt sau NOTIFY_HIDE_MS như dòng
 * "mất sóng". Nhưng im hẳn khi ảnh CŨ thì thành hứa "hôm nay" mà dữ liệu không
 * đảm bảo — bà con ra khơi theo bản đồ này (bệnh "số cũ trông như mới").
 *
 * CHỈ nói chuyện ẢNH CŨ. KHÔNG còn nói "thiếu vài nguồn": chủ dự án chốt
 * 2026-07-27 — bà con KHÔNG cần biết chuyện thiếu nguồn phụ (bản đồ vẫn dựng từ
 * nguồn còn sống, bất biến monotonic bảo đảm mất nguồn chỉ GIẢM điểm chứ không
 * bịa). Tình trạng thiếu nguồn / `dataQuality` vẫn giữ cho trang QUẢN TRỊ.
 *
 * Chữ đời thường, không nói "dataQuality", không nói tên dataset.
 */
export function lowQualityNote(cast: {
  sources?: Record<string, { stale: boolean }>;
}): string | null {
  const s = cast.sources ?? {};
  // ảnh nhiệt/phù du cũ = cả bản đồ lệch → nói thẳng chuyện "ảnh cũ"
  if (s.sst?.stale || s.chl?.stale) {
    return "Số biển hôm nay lấy từ ảnh cũ — có thể chưa sát.";
  }
  return null;
}

/**
 * CÂU NÓI khi lớp cá KHÔNG tải được — phân biệt LỖI TẢI với KHOÁ QUYỀN.
 * `null` = ĐỪNG hiện nút "chạm để thử lại" (bấm bao nhiêu lần cũng vô ích).
 *
 * ⚠️ VÌ SAO CÓ (2026-08-18, chủ dự án gửi ảnh màn hình thật): màn Ra khơi gộp
 * MỌI ca `!ok` thành một câu *"Dự báo cá chưa tải được — chạm để thử lại"*,
 * kể cả khi máy chủ đã trả lời rất rõ là **chưa đăng nhập** (401 `login_required`
 * / `no_token`) hay **chưa premium** (403 `premium_required`). Bà con bấm mãi
 * không được gì — đúng hai khuôn mà cả mạch này đang diệt: "nói sai lý do" và
 * "nút bấm không được gì". Hai ca đó đã có thẻ khoá riêng (`PremiumLock`) lo,
 * nên ở đây trả `null` để không chồng hai thông điệp lên nhau.
 *
 * Đo cùng ngày: snapshot cá trên máy chủ khoẻ (0,5 giờ tuổi, chất lượng 1,
 * 2187 ô) — tức câu "chưa tải được" hôm đó gần như chắc chắn là chuyện QUYỀN,
 * không phải nguồn.
 */
export function fishFailNote(code?: string | null): string | null {
  switch (code) {
    case "login_required":
    case "no_token":
    case "unknown_token":
    case "token_revoked":
    case "premium_required":
      return null; // thẻ khoá quyền lo phần này
    case "unavailable":
      return "Máy chủ đang bận — chạm thử lại sau ít phút";
    default:
      return "Dự báo cá chưa tải được — chạm để thử lại";
  }
}
