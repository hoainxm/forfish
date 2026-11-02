// Ô GÕ TOẠ ĐỘ TỰ NHẢY — luật thuần cho `components/ui/o-toa-do.tsx` (anh Long 2026-11-02:
// "chỗ gõ thì cho gõ thông minh, bắt đủ là nó nhảy theo cái tiếp theo — độ rồi tới phút
// rồi tới giây"). Mỗi trục ba ô [độ][phút][giây] + chip hướng; gõ đủ số là con trỏ sang
// ô kế, gõ dấu ngăn (cách, chấm, phẩy, °, ', -) cũng sang ô kế, xoá ở ô trống thì lùi.
// Kết quả ghép thành MỘT chuỗi cho `parseOneCoord` (một luật đọc cho mọi chỗ nhập).
// Test: __tests__/o-toa-do.test.ts.

import { parseOneCoord, type CoordAxis } from "@/lib/parse-coord";

export type PhanToaDo = { d: string; m: string; s: string; am: boolean };
export type OSo = "d" | "m" | "s";

/** số chữ số tối đa của từng ô */
export const DAI_O: Record<CoordAxis, Record<OSo, number>> = {
  lat: { d: 2, m: 2, s: 2 },
  lon: { d: 3, m: 2, s: 2 },
};
const TRAN: Record<CoordAxis, Record<OSo, number>> = {
  lat: { d: 90, m: 59, s: 59 },
  lon: { d: 180, m: 59, s: 59 },
};

/** chỉ giữ chữ số (giây cho thêm MỘT dấu thập phân — máy định vị hay in "12,5″") */
export function locSo(raw: string, o: OSo): string {
  if (o !== "s") return raw.replace(/\D/g, "");
  const s = raw.replace(/\./g, ",").replace(/[^\d,]/g, "");
  const i = s.indexOf(",");
  return i < 0 ? s : s.slice(0, i + 1) + s.slice(i + 1).replace(/,/g, "");
}

/**
 * Gõ xong thì có nhảy sang ô kế không: đủ số chữ số, HOẶC thêm một chữ số nữa chắc chắn
 * vượt trần (vĩ "9" → 9x > 90 trừ 90 · phút "6" → 6x > 59) — khỏi bắt gõ số 0 đầu.
 * Giây có phần lẻ thì không tự nhảy (bà con còn gõ tiếp phần lẻ).
 */
export function nenNhay(text: string, o: OSo, axis: CoordAxis): boolean {
  if (!text || text.includes(",")) return false;
  if (text.length >= DAI_O[axis][o]) return true;
  return Number(`${text}0`) > TRAN[axis][o];
}

/** ký tự gõ vào được coi là "sang ô kế" */
export function laDauNgan(ch: string): boolean {
  return /^[\s.,°'′″"\-/:;dDmM]$/.test(ch);
}

/** Ghép ba ô + hướng thành chuỗi cho `parseOneCoord`; "" khi chưa gõ gì. */
export function ghepToaDo(p: PhanToaDo, axis: CoordAxis): string {
  if (!p.d && !p.m && !p.s) return "";
  const huong = axis === "lat" ? (p.am ? "S" : "N") : p.am ? "W" : "E";
  return [p.d || "0", p.m || "0", p.s || "0"].join(" ") + ` ${huong}`;
}

/**
 * Tách một chuỗi toạ độ bất kỳ (bà con dán, "lấy chỗ đang trỏ" điền sẵn ở hệ độ thập phân
 * hay độ-phút-giây) thành ba ô. Chuỗi không đọc được ⇒ null (giữ nguyên ô đang gõ).
 */
export function tachToaDo(raw: string, axis: CoordAxis): PhanToaDo | null {
  if (!raw.trim()) return { d: "", m: "", s: "", am: false };
  const v = parseOneCoord(raw, axis);
  if (v == null) return null;
  const a = Math.abs(v);
  let d = Math.floor(a);
  let m = Math.floor((a - d) * 60);
  let s = Math.round(((a - d) * 60 - m) * 60 * 10) / 10;
  if (s >= 60) {
    s = 0;
    m += 1;
  }
  if (m >= 60) {
    m = 0;
    d += 1;
  }
  const so = (n: number) => String(n).replace(".", ",").padStart(2, "0");
  return { d: String(d), m: so(m), s: so(s), am: v < 0 };
}
