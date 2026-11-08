// ĐÁY THEO NGHỀ — rạn, chỗ cạn, sát rạn (2026-11-08, anh Long: "tính toán các kiểu rạn rồi nghề rồi tất cả dữ liệu liên quan").
// 09 §3 Phase 1e · research vet-tau §10.7.
//
// Hệ số một ô cá 0,25° = Σ (tỉ phần loại đáy trong ô × hệ số loại đó của NGHỀ). Hai bảng, đều từ model-params (SDF2, cất
// offline — không viết cứng, khong-lo-nguon):
//  · `dayO`  : "i,j" → [ran, n2, n4, n12, sau, gan] — tỉ phần ô 450 m của lưới độ sâu (`depth-grid.v1.bin`) trong ô cá:
//              ran = rạn/đá ngầm/xác tàu · n2 <2 m · n4 2–4 m · n12 4–12 m · sau >12 m · gan = nước đứng sát rạn (~1,4 km).
//              Ô vắng = toàn nước sâu ⇒ hệ số 1.
//  · `dayNghe`: nghề → hệ số từng loại = độ ưa ĐO TỪ VẾT (giờ làm lưới của nghề ở loại đáy đó ÷ giờ có mặt của mọi tàu ở
//              đó), chia cho độ ưa ở nước sâu, KẸP ≤ 1 (chỉ trừ, không thưởng — số đo ưa rạn của câu đến từ câu tay/câu mực,
//              không áp được cho câu ngừ khơi). Vd cào đôi: sát rạn 0,19, 4–12 m 0,15 — lưới kéo né đáy cứng và chỗ cạn.
// Chưa nạp tham số ⇒ null ⇒ chỗ gọi coi như 1 và ghi chú. Chất đáy vệ tinh (ACA) phủ hẹp ⇒ KHÔNG dùng (không nội suy).

import { getModelParams, type ModelParams } from "@/lib/model-params";
import type { Nghe } from "./types";
import { loTrinhParams } from "./he-so";

export const LOAI_DAY = ["ran", "n2", "n4", "n12", "sau", "gan"] as const;
export type LoaiDay = (typeof LOAI_DAY)[number];
/** Trục lưới cá 0,25° (tâm 5,025 + 0,25k; 102,025 + 0,25k) — cùng trục đội tàu / mật độ */
const LAT0 = 5.025, LON0 = 102.025, BUOC = 0.25;

export const khoaO025 = (lat: number, lon: number): string => `${Math.round((lat - LAT0) / BUOC)},${Math.round((lon - LON0) / BUOC)}`;

/**
 * Hệ số đáy (0–1) của nghề tại ô chứa (lat, lon). null = chưa có tham số đáy trong máy (chỗ gọi coi như 1 + nói ra).
 */
export function heSoDay(nghe: Nghe, lat: number, lon: number, p: ModelParams | null = getModelParams()): number | null {
  const lt = loTrinhParams(p);
  const f = lt.dayNghe?.[nghe];
  const bang = lt.dayO;
  if (!f || !bang || typeof bang !== "object") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const fr = bang[khoaO025(lat, lon)];
  if (!Array.isArray(fr) || fr.length !== LOAI_DAY.length) return 1; // ô vắng = toàn nước sâu
  let tu = 0, mau = 0;
  for (let k = 0; k < LOAI_DAY.length; k++) {
    const t = Number(fr[k]);
    const h = f[LOAI_DAY[k]];
    if (!Number.isFinite(t) || t <= 0) continue;
    mau += t;
    tu += t * (typeof h === "number" && Number.isFinite(h) ? Math.max(0, Math.min(1, h)) : 1);
  }
  return mau > 0 ? tu / mau : 1; // ô toàn đất (không có ô nước) — lớp cá đã lọc đất, coi như 1
}

/** Loại đáy nặng nhất (không kể nước sâu) của ô — để nói "ô này nhiều chỗ cạn / sát rạn". null = ô sâu thoáng hoặc chưa có. */
export function dayNoiBat(lat: number, lon: number, p: ModelParams | null = getModelParams()): LoaiDay | null {
  const fr = loTrinhParams(p).dayO?.[khoaO025(lat, lon)];
  if (!Array.isArray(fr)) return null;
  let tot: LoaiDay | null = null, max = 0.05; // dưới 5 % diện tích thì không đáng nói
  LOAI_DAY.forEach((l, k) => {
    if (l !== "sau" && Number(fr[k]) > max) { max = Number(fr[k]); tot = l; }
  });
  return tot;
}

export const TEN_LOAI_DAY: Record<LoaiDay, string> = {
  ran: "rạn, đá ngầm",
  n2: "chỗ rất cạn",
  n4: "chỗ cạn 2–4 m",
  n12: "nước nông 4–12 m",
  sau: "nước sâu",
  gan: "sát rạn",
};
