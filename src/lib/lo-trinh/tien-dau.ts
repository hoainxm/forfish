// QUY DẦU RA TIỀN (Phase 2, 09 §6 — 2026-11-08). Thuần: lít dầu của lộ trình × giá dầu DO 0,05S đã có trong máy
// (`lib/fuel-price.ts` — lấy được thì cất, mất sóng trả bản đã cất). Giá điều hành theo KỲ ⇒ câu luôn kèm NGÀY của kỳ giá
// để không ai nhầm là giá hôm nay. Không có giá ⇒ null ⇒ màn chỉ in lít (không bịa giá).
// Hai mức giá: vùng 1 (gần kho) và vùng 2 (xa kho, đảo) ⇒ in KHOẢNG khi hai mức khác nhau.

import type { FuelPrice } from "@/lib/fuel-price";

export interface TienDau {
  /** đồng — theo giá vùng 1 */
  tu: number;
  /** đồng — theo giá vùng 2 (≥ tu) */
  den: number;
  /** ngày áp dụng của kỳ giá (YYYY-MM-DD), "" nếu nguồn không ghi */
  ngay: string;
}

/** Giá dầu hợp lý (đồng/lít) — ngoài trần coi như hỏng, không quy ra tiền. */
const GIA_TRAN: readonly [number, number] = [5_000, 100_000];

const giaHopLe = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= GIA_TRAN[0] && v <= GIA_TRAN[1];

export function tienDau(lit: number, gia: FuelPrice | null | undefined): TienDau | null {
  if (!gia || !Number.isFinite(lit) || lit <= 0 || !giaHopLe(gia.do005Zone1)) return null;
  const g2 = giaHopLe(gia.do005Zone2) ? Math.max(gia.do005Zone1, gia.do005Zone2) : gia.do005Zone1;
  return { tu: lit * gia.do005Zone1, den: lit * g2, ngay: /^\d{4}-\d{2}-\d{2}$/.test(gia.date ?? "") ? gia.date : "" };
}

/** Số tiền đời thường: "23,4 triệu", "850 nghìn". */
export function soTien(dong: number): string {
  if (!Number.isFinite(dong) || dong <= 0) return "0 đồng";
  if (dong >= 1_000_000) return `${String(Math.round(dong / 100_000) / 10).replace(".", ",")} triệu`;
  return `${Math.max(1, Math.round(dong / 1000))} nghìn`;
}

/** "Khoảng 23,4–24,1 triệu đồng tiền dầu (giá dầu DO kỳ 06/11, gần kho – xa kho)". null = không có giá. */
export function cauTienDau(t: TienDau | null): string | null {
  if (!t) return null;
  const a = soTien(t.tu), b = soTien(t.den);
  const ky = t.ngay ? ` kỳ ${t.ngay.slice(8, 10)}/${t.ngay.slice(5, 7)}` : "";
  if (a === b) return `Khoảng ${a} đồng tiền dầu (giá dầu DO${ky}).`;
  // cùng đơn vị thì chỉ in đơn vị một lần: "23,4–24,1 triệu"
  const dvA = a.split(" ")[1], dvB = b.split(" ")[1];
  const khoang = dvA === dvB ? `${a.split(" ")[0]}–${b}` : `${a}–${b}`;
  return `Khoảng ${khoang} đồng tiền dầu (giá dầu DO${ky}, gần kho – xa kho).`;
}
