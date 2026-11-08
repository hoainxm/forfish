// THUỶ TRIỀU Ở CẢNG ĐẬU — giờ ra/vào cửa lạch của lộ trình (2026-11-08, anh Long: "giờ đi cần tính toán cả thuỷ triều ở chỗ
// họ đậu tàu nữa"). 09 §3 Phase 1e.
//
// Hai mức, NÓI THẬT mức nào đang dùng:
//  · RÀNG BUỘC CỨNG — biết độ sâu khống chế của luồng cửa (thông báo hàng hải, `fairway-depths`, quy về số 0 hải đồ) VÀ
//    biết mớn tàu: qua cửa được khi  sâu luồng + mực triều (so số 0) ≥ nước tàu cần (`requiredDepthM`: mớn + 0,5 m).
//    Giờ đi/giờ về rơi vào lúc thiếu nước ⇒ dời tới giờ sớm nhất đủ nước (tàu chờ trong cảng / ngoài cửa).
//  · CHỈ BÁO — thiếu một trong hai: không bịa ràng buộc, chỉ đưa giờ NƯỚC LỚN ngày đi / ngày về để thuyền trưởng tự cân.
// Triều tính ngay trong máy (`tides.ts`, hằng số điều hoà ghim sẵn) — không cần mạng, đi biển nhiều ngày vẫn đúng.
// THUẦN: không fetch; màn hình đưa trạm + đoạn luồng vào.

import { haversineKm, type LatLon } from "@/lib/geo";
import { requiredDepthM } from "@/lib/hazards";
import { isModelStation, nearestTideStation, tideHeightAt, tideUpcoming, type TideStation } from "@/lib/tides";
import type { FairwayDepth } from "@/lib/fairway-depth";
import { getModelParams, type ModelParams } from "@/lib/model-params";
import { loTrinhParams } from "./he-so";

/** Trạm triều xa cảng hơn ngần này thì coi như không có trạm cho cảng đó (con nước ở cửa lạch lệch giờ theo khoảng cách). */
export const TRAM_TOI_DA_KM = 40;
/** Đoạn luồng có một đầu trong bán kính này quanh cảng ⇒ coi là luồng cửa của cảng. */
export const BAN_KINH_LUONG_KM = 15;
/** Tìm giờ đủ nước tối đa ngần này giờ tới; quá ⇒ báo "không đủ nước" (null). Hai chu kỳ bán nhật triều + dư. */
export const TIM_TOI_DA_GIO = 36;
const BUOC_PHUT = 10;
/** Cửa đo được (model-params `cuaCang`) trong bán kính này quanh cảng bà con chọn ⇒ dùng số đo của cửa đó. */
export const BAN_KINH_CUA_DO_KM = 6;
/** Tỉ phần lượt qua cửa lúc nước dưới p25 nền: dưới ngưỡng này ⇒ cửa PHỤ THUỘC con nước (ràng buộc). Không phụ thuộc ⇒ ~0,25;
 *  độ lệch chuẩn ~0,03 với 200 lượt ⇒ 0,15 là cách > 3 lần nhiễu. 0,15–0,2 chỉ báo. */
export const NGUONG_PHU_THUOC = 0.15;

export interface CuaTrieu {
  tenTram: string;
  kmTram: number;
  /** trạm ước tính từ mô hình (không phải trạm đo) — giờ có thể lệch, chỗ hiện phải nói */
  uocTinh: boolean;
  /** luồng cửa: tên + độ sâu khống chế (m, số 0 hải đồ) + ngày thông báo; null = chưa có số đo luồng */
  luong: { ten: string; sauM: number; ngay: string } | null;
  /** nước tàu cần (m); null = chưa khai mớn */
  canM: number | null;
  /** CỬA ĐO ĐƯỢC từ lượt ra/vào thật (research §10.8): tàu ở đây chỉ qua cửa khi triều ≥ nguongM (số 0 của trạm đo);
   *  `phuThuoc` false = hơi phụ thuộc (chỉ báo). null = cảng chưa có số đo */
  cuaDo: { nguongM: number; soLuot: number; tiLeNuocThap: number; phuThuoc: boolean; tram: string } | null;
  /** true = (có luồng + có mớn) HOẶC cửa đo được là phụ thuộc ⇒ giờ ra/vào bị ràng buộc thật */
  rangBuoc: boolean;
  /** giờ (epoch ms) sớm nhất ≥ ms qua được cửa; không ràng buộc ⇒ trả ms; trong 36 giờ không đủ nước ⇒ null */
  quaCua: (ms: number) => number | null;
  /** giờ nước lớn kế tiếp ≥ ms (epoch ms) + độ cao (m so số 0); null nếu không tính được */
  nuocLon: (ms: number) => { ms: number; caoM: number } | null;
}

/** Luồng cửa của cảng: đoạn có một đầu trong BAN_KINH_LUONG_KM, lấy chỗ NÔNG NHẤT (con số làm tàu mắc cạn). */
export function luongCuaCang(cang: LatLon, doan: readonly FairwayDepth[]): { ten: string; sauM: number; ngay: string } | null {
  let tot: FairwayDepth | null = null;
  for (const d of doan) {
    if (Math.min(haversineKm(cang, d.tu), haversineKm(cang, d.den)) > BAN_KINH_LUONG_KM) continue;
    if (!tot || d.sauM < tot.sauM) tot = d;
  }
  return tot ? { ten: tot.route?.ten ?? tot.ten, sauM: tot.sauM, ngay: tot.at } : null;
}

/**
 * Dựng cửa triều cho cảng. null = không có trạm triều trong TRAM_TOI_DA_KM (chỗ gọi ghi chú "chưa tính triều").
 * `draftM` = mớn tàu (hồ sơ tàu); null/≤0 ⇒ chưa khai.
 */
export function dungCuaTrieu(
  cang: LatLon,
  tram: readonly TideStation[] | null,
  doan: readonly FairwayDepth[] | null,
  draftM: number | null | undefined,
  p: ModelParams | null = getModelParams(),
): CuaTrieu | null {
  if (!tram?.length || !Number.isFinite(cang?.lat) || !Number.isFinite(cang?.lon)) return null;
  const gan = nearestTideStation(tram, cang.lat, cang.lon);
  if (!gan || gan.distanceKm > TRAM_TOI_DA_KM) return null;
  const st = gan.station;
  const luong = doan?.length ? luongCuaCang(cang, doan) : null;
  const canM = requiredDepthM(draftM ?? null, 0);
  // cửa đo được gần nhất (≤ BAN_KINH_CUA_DO_KM); mực triều so ở ĐÚNG trạm đã dùng khi đo
  let cuaDo: CuaTrieu["cuaDo"] = null;
  let stDo: TideStation | null = null;
  let kmDo = Infinity;
  for (const c of loTrinhParams(p).cuaCang ?? []) {
    if (!Array.isArray(c) || c.length < 6) continue;
    const [la, lo, id, nguong, tiLe, n] = c;
    const km = haversineKm(cang, { lat: la, lon: lo });
    if (km > BAN_KINH_CUA_DO_KM || km >= kmDo || !Number.isFinite(nguong)) continue;
    const s = tram.find((x) => x.id === id);
    if (!s) continue;
    kmDo = km;
    stDo = s;
    cuaDo = { nguongM: nguong, soLuot: n, tiLeNuocThap: tiLe, phuThuoc: tiLe < NGUONG_PHU_THUOC, tram: s.name };
  }
  const coLuong = luong != null && canM != null;
  const rangBuoc = coLuong || !!cuaDo?.phuThuoc;
  const du = (ms: number) =>
    (!coLuong || luong!.sauM + tideHeightAt(st, ms) >= canM! - 1e-9) &&
    (!cuaDo?.phuThuoc || tideHeightAt(stDo!, ms) >= cuaDo.nguongM - 1e-9);
  return {
    tenTram: st.name,
    kmTram: Math.round(gan.distanceKm),
    uocTinh: isModelStation(st),
    luong,
    canM,
    cuaDo,
    rangBuoc,
    quaCua: (ms) => {
      if (!rangBuoc) return ms;
      if (!Number.isFinite(ms)) return null;
      for (let k = 0; k <= (TIM_TOI_DA_GIO * 60) / BUOC_PHUT; k++) {
        const t = ms + k * BUOC_PHUT * 60_000;
        if (du(t)) return t;
      }
      return null;
    },
    nuocLon: (ms) => {
      if (!Number.isFinite(ms)) return null;
      const x = tideUpcoming(st, ms, 4).find((e) => e.kind === "high");
      return x ? { ms: x.atMs, caoM: x.heightM } : null;
    },
  };
}
