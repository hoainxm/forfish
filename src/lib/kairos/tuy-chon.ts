// KAIROS — TUỲ CHỌN DÒNG TIN (14-ba-spec-kairos §13 "Tuỳ chọn dòng tin", 2026-10-24). THUẦN.
//
// Anh Long: "cho 1 cái icon dạng cấu hình của fb để chọn chủ đề thích đọc" ⇒ ƯU TIÊN, KHÔNG lọc (như "Tuỳ chọn
// bảng feed" của Facebook): chủ đề bà con chọn được cộng điểm ở máy chủ (phan-phoi.ts W_THICH), chủ đề khác vẫn
// hiện, luật 85 % tin biển giữ nguyên. Kèm công tắc "Hiện bài trợ lý AI" (mặc định bật; tắt ⇒ `ai=0`, máy chủ bỏ
// bài agent tri thức). Lưu TRONG MÁY ở `forfish.kairos.tuychon.v1` (bên gọi đọc/ghi — feed-client.ts).
// Request chỉ mang MÃ chủ đề + cờ ai, không mang hồ sơ đọc.

import { TOPICS, isTopic, type Topic } from "./chu-de.mjs";

export const TUY_CHON_KEY = "forfish.kairos.tuychon.v1";

export interface TuyChon {
  v: 1;
  /** chủ đề "Thích đọc", theo thứ tự TOPICS; rỗng = như mặc định */
  thich: Topic[];
  /** hiện bài của agent tri thức (tài khoản có chấm AI) */
  ai: boolean;
}

export function tuyChonMacDinh(): TuyChon {
  return { v: 1, thich: [], ai: true };
}

/** Mảng mã bất kỳ ⇒ chủ đề hợp lệ, không trùng, theo thứ tự TOPICS (mã lạ bỏ qua). */
export function chuanChuDe(raw: readonly unknown[]): Topic[] {
  const set = new Set(raw.filter((x): x is Topic => typeof x === "string" && isTopic(x)));
  return TOPICS.filter((t) => set.has(t));
}

/** Chuỗi đã lưu ⇒ TuyChon. Hỏng / lạ / phiên bản khác ⇒ mặc định (mất tuỳ chọn chỉ là xếp như thường). */
export function parseTuyChon(raw: string | null | undefined): TuyChon {
  if (!raw || raw.length > 2048) return tuyChonMacDinh();
  let j: unknown;
  try {
    j = JSON.parse(raw);
  } catch {
    return tuyChonMacDinh();
  }
  if (!j || typeof j !== "object" || (j as { v?: unknown }).v !== 1) return tuyChonMacDinh();
  const o = j as Record<string, unknown>;
  return { v: 1, thich: Array.isArray(o.thich) ? chuanChuDe(o.thich) : [], ai: o.ai !== false };
}

export function serializeTuyChon(t: TuyChon): string {
  return JSON.stringify({ v: 1, thich: chuanChuDe(t.thich), ai: t.ai });
}

/** Bật/tắt một chủ đề "Thích đọc". */
export function doiThich(t: TuyChon, topic: Topic): TuyChon {
  const on = t.thich.includes(topic);
  return { ...t, thich: chuanChuDe(on ? t.thich.filter((x) => x !== topic) : [...t.thich, topic]) };
}

export const giongNhau = (a: TuyChon, b: TuyChon) => serializeTuyChon(a) === serializeTuyChon(b);

/** Thêm tham số vào request dòng tin: `thich=<mã,mã>` (khi có) + `ai=0` (khi tắt). Mặc định ⇒ không thêm gì. */
export function themThamSo(params: URLSearchParams, t: TuyChon): URLSearchParams {
  const q = new URLSearchParams(params);
  const thich = chuanChuDe(t.thich);
  if (thich.length) q.set("thich", thich.join(","));
  if (!t.ai) q.set("ai", "0");
  return q;
}

/** Máy chủ đọc tham số. Mã lạ bỏ qua (không 400); `ai` khác "0" ⇒ hiện agent. */
export function docThamSo(sp: URLSearchParams): { thich: ReadonlySet<Topic>; ai: boolean } {
  const raw = (sp.get("thich") ?? "").slice(0, 200);
  return { thich: new Set(chuanChuDe(raw ? raw.split(",") : [])), ai: sp.get("ai") !== "0" };
}
