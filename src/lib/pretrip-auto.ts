// Trục 1 — TỰ TẢI SẴN DỰ BÁO khi vào màn Ra khơi (thay nút "Chuẩn bị đi biển").
//
// Vì sao có file này: bà con không nên phải nhớ bấm nút nào cả — vào trang là máy
// lo. Nhưng tải sẵn KHÔNG rẻ: mỗi lượt kéo gió sóng từng chỗ ghim + bản đồ cá +
// 3 khung lưới gió/sóng ≈ 2,5–3 MB. Bà con phần lớn dùng sim trả tiền theo dung
// lượng, nên "vào trang là tải" mà không có cửa chặn thì mỗi ngày mở app chục
// lần là đốt vài chục MB tiền sóng vô ích.
//
// Cửa chặn ở đây THUẦN (truyền `nowMs`/`online` vào, không gọi Date.now hay
// navigator ẩn) để test được từng trường hợp.

import { formatDateVN } from "@/lib/ocean-map";
import type { PretripResult, SavedSummary, SavedCoverage } from "@/lib/pretrip";

/**
 * TIẾT CHẾ DATA: chỉ tự tải lại khi bản trong máy đã cũ hơn ngần này.
 *
 * 6 giờ khớp nhịp nguồn: /api/fish-forecast có ISR 6h, lưới gió/sóng cũng chỉ
 * đổi vài giờ một lần. Chạy dày hơn thì tốn tiền sóng của bà con mà tải về vẫn
 * đúng con số cũ — không được lợi gì.
 */
export const PRETRIP_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Mốc lần TỰ tải gần nhất (epoch ms) — quy ước key `forfish.*` */
export const PRETRIP_LAST_RUN_KEY = "forfish.pretrip.lastRunAt.v1";

export interface AutoPretripGate {
  /** mốc lần tự tải gần nhất (epoch ms); null = chưa lần nào */
  lastRunAt: number | null;
  nowMs: number;
  /** máy đang có sóng hay không (navigator.onLine) */
  online: boolean;
}

/**
 * Có nên TỰ tải sẵn lúc này không.
 *  · mất sóng     → KHÔNG (thử cũng hỏng, chỉ tổ báo lỗi vô ích)
 *  · chưa lần nào → CÓ
 *  · bản còn mới  → KHÔNG (im lặng hoàn toàn, không báo gì)
 *  · bản đã cũ    → CÓ
 */
export function shouldAutoPretrip({
  lastRunAt,
  nowMs,
  online,
}: AutoPretripGate): boolean {
  if (!online) return false;
  if (lastRunAt == null || !Number.isFinite(lastRunAt)) return true;
  // mốc nằm ở TƯƠNG LAI = đồng hồ máy bị chỉnh lùi; coi như chưa có mốc, nếu
  // không thì cửa chặn kẹt mãi và máy không bao giờ tải bản mới.
  if (lastRunAt > nowMs) return true;
  return nowMs - lastRunAt >= PRETRIP_MIN_INTERVAL_MS;
}

/**
 * Cách nhau tối thiểu giữa hai lần THỬ tải (khác `PRETRIP_MIN_INTERVAL_MS` là
 * khoảng cách giữa hai lần tải THÀNH CÔNG). Cần vì: lần thử hỏng KHÔNG ghi mốc
 * `lastRunAt` — mạng chập chờn ngoài khơi có thể bật/tắt liên tục, không có cửa
 * này thì mỗi lần `online` nháy là bắn lại cả mẻ 2,5–3 MB.
 */
export const PRETRIP_MIN_RETRY_MS = 2 * 60 * 1000;

export interface AutoPretripAttemptGate extends AutoPretripGate {
  /** mốc lần THỬ gần nhất trong phiên (epoch ms); null = chưa thử lần nào */
  lastAttemptAt: number | null;
}

/**
 * Có nên THỬ tự tải lúc này không — dùng cho cả lần mở app LẪN các lần máy có
 * sóng lại / quay lại app (2026-07-29). Hai cửa chặn cộng lại:
 *  · `shouldAutoPretrip` — bản trong máy còn mới / mất sóng thì thôi
 *  · cách lần THỬ trước ≥ PRETRIP_MIN_RETRY_MS — chống mạng chập chờn bắn liên tục
 */
export function shouldAttemptAutoPretrip({
  lastRunAt,
  lastAttemptAt,
  nowMs,
  online,
}: AutoPretripAttemptGate): boolean {
  if (!shouldAutoPretrip({ lastRunAt, nowMs, online })) return false;
  if (lastAttemptAt == null || !Number.isFinite(lastAttemptAt)) return true;
  if (lastAttemptAt > nowMs) return true; // đồng hồ máy chỉnh lùi
  return nowMs - lastAttemptAt >= PRETRIP_MIN_RETRY_MS;
}

/**
 * MẺ TẢI SẴN VỪA RỒI CÓ ĐƯỢC GHI MỐC `lastRunAt` KHÔNG (thuần, 2026-08-01).
 *
 * LỖI ĐÃ SỬA: `pretrip-auto-notify` gọi `markAutoPretripRun()` VÔ ĐIỀU KIỆN
 * trong `.then()` — mà `runPretrip` không bao giờ reject (mỗi bước có catch
 * riêng), nên mẻ hỏng sạch cũng ghi mốc và khoá `PRETRIP_MIN_INTERVAL_MS` = 6
 * GIỜ. Cảnh thật: 5h sáng chủ tàu mở app lúc còn ở khu neo khuất sóng, cả mẻ
 * hỏng, 20 phút sau ra cửa biển sóng đầy vạch — app không tải nữa, tàu đi biển
 * với máy trống dự báo. Trái đúng bất biến ghi ở `PRETRIP_MIN_RETRY_MS` bên
 * trên: "lần thử hỏng KHÔNG ghi mốc `lastRunAt`".
 *
 * Luật:
 *  · giữ được dự báo (có chỗ + có ngày xa nhất) → GHI mốc, nghỉ 6 giờ
 *  · máy HẾT CHỖ → GHI mốc: thử lại cũng không giữ được, chỉ tổ đốt tiền sóng
 *  · hỏng vì sóng → KHÔNG ghi, để cửa 2 phút (`PRETRIP_MIN_RETRY_MS`) tự thử lại
 *
 * KHÔNG dùng `r.ok > 0` làm điều kiện: hai bước "Nước dâng / xoáy" và "Bản đồ
 * mùa vụ" không bao giờ ném (fetchSeaScalar trả `{ok:false}`, fetchClimatology
 * kết bằng `.catch(() => null)`), nên `r.ok >= 2` kể cả khi rút cáp mạng — gác
 * bằng `ok` là không gác gì cả.
 */
export function shouldMarkPretripRun(r: PretripResult): boolean {
  if (r.full) return true;
  return r.saved.places > 0 && !!r.saved.untilIso;
}

/** Đọc mốc lần tự tải gần nhất trong máy (null khi chưa có / máy chặn lưu). */
export function lastAutoPretripAt(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PRETRIP_LAST_RUN_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** Ghi mốc vừa tự tải xong. Máy chặn lưu thì thôi — không được làm app chết. */
export function markAutoPretripRun(nowMs: number = Date.now()): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PRETRIP_LAST_RUN_KEY, String(nowMs));
  } catch {
    /* hết chỗ nhớ / chế độ riêng tư — bỏ qua */
  }
}

/**
 * MỘT dòng báo sau khi tự tải xong (rồi tự tắt). Ngắn, đời thường, nói ngày —
 * không nói "đồng bộ/cache/offline".
 */
export function autoPretripLine(r: PretripResult): string {
  if (r.full) return "Máy hết chỗ nhớ — xoá bớt điểm đã lưu.";
  // KHÔNG được khoe bản CŨ trong máy như thể vừa tải: hỏng sạch thì nói hỏng.
  if (r.ok === 0 || !r.saved.places || !r.saved.untilIso) {
    return "Chưa tải được dự báo — chưa có sóng.";
  }
  return `Đã lưu dự báo tới ngày ${formatDateVN(r.saved.untilIso)}.`;
}

/** Ba trạng thái của nhãn nhỏ THƯỜNG TRỰC (trên box biển động) — không nhập nhằng */
export type PretripSavedPhase = "loading" | "idle";

/**
 * Nhãn nhỏ "trong máy đã có dự báo tới đâu" hiện thường trực sát box biển động —
 * để bà con LIẾC là biết máy đã sẵn sàng cho chuyến biển chưa (khác dòng nổi tự
 * tắt autoPretripLine). Thuần để test được câu chữ.
 *  · đang tải       → "Đang tải dữ liệu dự báo"
 *  · có bản đã lưu  → "Đã lưu dữ liệu dự báo tới ngày <ngày xa nhất>"
 *  · chưa có gì     → "Chưa tải dữ liệu dự báo"
 */
export function pretripSavedText(
  phase: PretripSavedPhase,
  saved: SavedSummary | null,
): string {
  if (phase === "loading") return "Đang tải dữ liệu dự báo";
  if (saved && saved.places > 0 && saved.untilIso) {
    return `Đã lưu dữ liệu dự báo tới ngày ${formatDateVN(saved.untilIso)}`;
  }
  return "Chưa tải dữ liệu dự báo";
}

/**
 * Câu chữ chip THEO ĐỘ PHỦ TỪNG LỚP (2026-07-29). "Đã lưu … tới ngày X" chỉ
 * được nói khi MỌI lớp tự-tải-được (cá, điểm, lưới, mây/mưa/nhiệt, độ mặn, dòng
 * chảy) đã có trong máy — TRUNG THỰC, không còn nói quá theo mỗi gió-sóng-điểm.
 * Thiếu lớp nào thì nói thẳng còn mấy lớp + mời chạm mở popup để tải lại lẻ.
 */
export function coverageChipText(
  phase: PretripSavedPhase,
  cov: SavedCoverage | null,
): string {
  if (phase === "loading") return "Đang tải dữ liệu dự báo";
  if (!cov || cov.layers.every((l) => !l.saved)) return "Chưa tải dữ liệu dự báo";
  if (cov.allSaved) {
    return cov.untilIso
      ? `Đã lưu đủ dự báo — tới ngày ${formatDateVN(cov.untilIso)}`
      : "Đã lưu đủ dự báo cho offline";
  }
  return `Còn thiếu ${cov.missing} lớp — chạm xem`;
}
