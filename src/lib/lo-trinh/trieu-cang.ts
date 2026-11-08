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

/** Trạm triều xa cảng hơn ngần này thì coi như không có trạm cho cảng đó (con nước ở cửa lạch lệch giờ theo khoảng cách). */
export const TRAM_TOI_DA_KM = 40;
/** Đoạn luồng có một đầu trong bán kính này quanh cảng ⇒ coi là luồng cửa của cảng. */
export const BAN_KINH_LUONG_KM = 15;
/** Tìm giờ đủ nước tối đa ngần này giờ tới; quá ⇒ báo "không đủ nước" (null). Hai chu kỳ bán nhật triều + dư. */
export const TIM_TOI_DA_GIO = 36;
const BUOC_PHUT = 10;

export interface CuaTrieu {
  tenTram: string;
  kmTram: number;
  /** trạm ước tính từ mô hình (không phải trạm đo) — giờ có thể lệch, chỗ hiện phải nói */
  uocTinh: boolean;
  /** luồng cửa: tên + độ sâu khống chế (m, số 0 hải đồ) + ngày thông báo; null = chưa có số đo luồng */
  luong: { ten: string; sauM: number; ngay: string } | null;
  /** nước tàu cần (m); null = chưa khai mớn */
  canM: number | null;
  /** true = có luồng + có mớn ⇒ giờ ra/vào bị ràng buộc thật */
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
): CuaTrieu | null {
  if (!tram?.length || !Number.isFinite(cang?.lat) || !Number.isFinite(cang?.lon)) return null;
  const gan = nearestTideStation(tram, cang.lat, cang.lon);
  if (!gan || gan.distanceKm > TRAM_TOI_DA_KM) return null;
  const st = gan.station;
  const luong = doan?.length ? luongCuaCang(cang, doan) : null;
  const canM = requiredDepthM(draftM ?? null, 0);
  const rangBuoc = luong != null && canM != null;
  const du = (ms: number) => luong!.sauM + tideHeightAt(st, ms) >= canM! - 1e-9;
  return {
    tenTram: st.name,
    kmTram: Math.round(gan.distanceKm),
    uocTinh: isModelStation(st),
    luong,
    canM,
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
