// Trục 1 — NHÃN NGÀY/GIỜ NÓI THẬT.
//
// Vì sao có file này: dự báo lưu trong máy (ra biển mất sóng, chuyến 5–16 ngày)
// vẫn nằm đúng vị trí mảng như lúc lưu. Nhãn theo VỊ TRÍ ("phần tử đầu = Hôm
// nay") sẽ NÓI DỐI khi bản lưu đã mấy ngày tuổi. Mọi hàm ở đây so NGÀY THẬT,
// không so vị trí mảng.
//
// Giờ dùng chung là GIỜ VIỆT NAM (+07:00) — cố định, không lấy theo máy: dữ
// liệu dự báo cũng xin theo Asia/Ho_Chi_Minh, và máy đặt sai múi giờ thì nhãn
// vẫn phải đúng với giờ bà con nghe đài.

import { formatDateVN } from "@/lib/ocean-map";

const DAY_MS = 24 * 60 * 60 * 1000;
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

const WEEKDAYS = [
  "Chủ nhật",
  "Thứ hai",
  "Thứ ba",
  "Thứ tư",
  "Thứ năm",
  "Thứ sáu",
  "Thứ bảy",
];

const WEEKDAYS_SHORT = ["CN", "Th 2", "Th 3", "Th 4", "Th 5", "Th 6", "Th 7"];

/** epoch ms → "YYYY-MM-DD" theo giờ Việt Nam */
export function isoDateVN(ms: number = Date.now()): string {
  const d = new Date(ms + VN_OFFSET_MS);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** epoch ms → "07:15 ngày 20/7" (giờ Việt Nam) — dùng cho "tin lúc…", "đo lúc…" */
export function clockVN(ms: number): string {
  const d = new Date(ms + VN_OFFSET_MS);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm} ngày ${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

/**
 * Số ngày từ `fromIso` tới `toIso` ("2026-07-20"). Âm = toIso đã qua.
 * Ngày hỏng → 0 (thà nói "hôm nay" hơn là văng lỗi giữa biển).
 */
export function daysBetweenISO(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / DAY_MS);
}

/** Ngày đó đã trôi qua so với hôm nay chưa (bản lưu cũ hay dính) */
export function isPastDay(isoDate: string, todayIso: string): boolean {
  return daysBetweenISO(todayIso, isoDate) < 0;
}

function weekdayOf(isoDate: string): number {
  // T12:00Z giữ nguyên ngày lịch khi đọc bằng getUTCDay
  return new Date(`${isoDate}T12:00:00Z`).getUTCDay();
}

/**
 * Nhãn ngày đầy đủ. CHỈ nói "Hôm nay"/"Ngày mai" khi ngày khớp THẬT — bản lưu
 * mấy hôm trước sẽ hiện ngày thật + "(đã qua)".
 */
export function dayLabel(isoDate: string, todayIso: string): string {
  const diff = daysBetweenISO(todayIso, isoDate);
  if (diff === 0) return "Hôm nay";
  if (diff === 1) return "Ngày mai";
  const name = `${WEEKDAYS[weekdayOf(isoDate)]} ${formatDateVN(isoDate)}`;
  return diff < 0 ? `${name} (đã qua)` : name;
}

/** Nhãn ngắn cho chip chọn ngày — cùng luật với dayLabel */
export function chipLabel(isoDate: string, todayIso: string): string {
  const diff = daysBetweenISO(todayIso, isoDate);
  if (diff === 0) return "Hôm nay";
  if (diff === 1) return "Ngày mai";
  const name = `${WEEKDAYS_SHORT[weekdayOf(isoDate)]} ${formatDateVN(isoDate)}`;
  return diff < 0 ? `${name} · qua` : name;
}
