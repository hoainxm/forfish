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
import type { PretripResult, SavedSummary } from "@/lib/pretrip";

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
