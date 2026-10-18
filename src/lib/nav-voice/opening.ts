// CHẾ ĐỘ ĐANG CHẠY — BẢN TIN MỞ ĐẦU + ĐIỂM TIN 30 PHÚT (thuần).
//
// Bản tin mở đầu (doc 15 §5D): đọc MỘT lần lúc bật, tối đa 4 phần, ý NỐI ý (chủ dự
// án 2026-10-17: "các câu này không hợp logic, câu trước vênh câu sau"):
//   bão · sóng gió 6 giờ tới · máy canh gì (CHỈ nói "đang canh" khi ĐÃ có vị trí
//   tàu — chưa định vị mà khẳng định canh rạn là nói sai) · nhắc việc về bờ ở CUỐI,
//   danh từ ngắn, không số ngày (≤ 7 ngày, ≤ 2 việc).
//
// Điểm tin (doc 15 §5C): 30 phút một lần khi tàu đang chạy — hướng, tốc độ,
// nước dưới tàu, gió sóng. CẤM câu phủ định kiểu "không có gì phía trước".

import type { UrgentItem } from "@/lib/urgent";
import type { SeaObservation } from "@/lib/nav-voice/sea-now";
import { seaSavedLine } from "@/lib/nav-voice/sea-now";
import { MIN_MOVING_KMH } from "@/lib/nav-progress";
import { dirSpeech, speedSpeech, type SpeechUnit } from "@/lib/nav-voice/phrases";

export const OPENING_URGENT_DAYS = 7;
export const OPENING_URGENT_MAX = 2;
export const DIEM_TIN_MS = 30 * 60_000;
/** điểm tin nhường nếu vừa có cảnh báo đỏ/vàng trong ngần này */
export const DIEM_TIN_QUIET_MS = 5 * 60_000;

export type ChartReadiness = "du" | "thieu" | "chua-co";

export function urgentLine(items: readonly UrgentItem[]): string {
  const pick = items
    .filter((i) => i.days <= OPENING_URGENT_DAYS)
    .sort((a, b) => a.days - b.days)
    .slice(0, OPENING_URGENT_MAX);
  if (pick.length === 0) return "";
  return `Về bờ nhớ lo: ${pick.map((i) => `${i.label.charAt(0).toLowerCase()}${i.label.slice(1)}`).join(", ")}.`;
}

export function chartLine(chart: ChartReadiness): string {
  if (chart === "chua-co") return "Máy chưa có hải đồ để canh. Bà con dò hải đồ và nghe đài.";
  if (chart === "thieu")
    return "Máy chỉ có một phần hải đồ, canh được một phần độ sâu và chướng ngại. Chỉ tham khảo, nghe đài duyên hải.";
  return "Máy đang canh độ sâu, rạn và chướng ngại phía trước. Chỉ tham khảo, bà con dò hải đồ và nghe đài.";
}

/** Chưa có vị trí tàu: không khẳng định canh gì (dòng báo GPS riêng đã nói chuyện định vị). */
export const CHUA_VI_TRI_LINE = "Chỉ tham khảo, bà con dò hải đồ và nghe đài.";

/** Bản tin mở đầu, ≤ 4 phần: bão · sóng gió · máy canh gì · nhắc việc về bờ. */
export function openingBulletin(o: {
  storm: string;
  sea: SeaObservation | null;
  urgent: readonly UrgentItem[];
  chart: ChartReadiness;
  nowMs: number;
  /** đã có vị trí tàu chưa — chưa thì KHÔNG nói "máy đang canh" */
  coViTri: boolean;
}): string {
  const parts: string[] = [];
  if (o.storm) parts.push(o.storm);
  parts.push(
    o.sea && o.sea.summary
      ? `Sáu giờ tới ${o.sea.warn ? o.sea.warn.charAt(0).toLowerCase() + o.sea.warn.slice(1) : `${o.sea.summary}. ${seaSavedLine(o.sea.savedAt, o.nowMs)}`}`
      : "Máy chưa lưu dự báo sóng gió vùng này.",
  );
  parts.push(o.coViTri ? chartLine(o.chart) : CHUA_VI_TRI_LINE);
  const u = urgentLine(o.urgent);
  if (u) parts.push(u);
  return parts.slice(0, 4).join(" ");
}

/** Lớp độ sâu → câu ngắn cho điểm tin. */
export const DEPTH_HERE_SHORT: Record<number, string> = {
  1: "Dưới tàu là vùng rạn đá.",
  2: "Nước dưới tàu dưới 2 mét.",
  3: "Nước dưới tàu 2 đến 4 mét.",
  4: "Nước dưới tàu 4 đến 12 mét.",
  5: "Nước dưới tàu sâu trên 12 mét.",
};

/** Điểm tin; null khi tàu đứng/neo hoặc chưa biết hướng. */
export function diemTin(o: {
  headingDeg: number | null;
  speedKmh: number | null;
  unit: SpeechUnit;
  depthHere: number | null;
  sea: SeaObservation | null;
}): string | null {
  if (o.headingDeg == null || o.speedKmh == null || o.speedKmh < MIN_MOVING_KMH) return null;
  const parts = [`Tàu đang chạy hướng ${dirSpeech(o.headingDeg)}, ${speedSpeech(o.speedKmh, o.unit)}.`];
  const d = o.depthHere != null ? DEPTH_HERE_SHORT[o.depthHere] : undefined;
  if (d) parts.push(d);
  if (o.sea?.summary) parts.push(`${o.sea.summary.charAt(0).toUpperCase()}${o.sea.summary.slice(1)}.`);
  parts.push("Máy vẫn đang canh.");
  return parts.join(" ");
}

/** Đến lúc đọc điểm tin chưa (thuần — hook gọi mỗi phút). */
export function diemTinDue(lastDiemMs: number, lastAlarmMs: number, startMs: number, nowMs: number): boolean {
  const base = Math.max(lastDiemMs, startMs);
  return nowMs - base >= DIEM_TIN_MS && nowMs - lastAlarmMs >= DIEM_TIN_QUIET_MS;
}
