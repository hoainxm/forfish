// 5 KHU VỰC BÁN DỮ LIỆU AIS — đúng bản đồ trong báo giá BG-AIS-2026-01 (30/10/2026, scratch/ban-do-5-khu-vuc/ve.mjs).
// Gom từ 12 vùng bản tin dự báo hải văn (TT Dự báo KTTV quốc gia). Bản tin không công bố toạ độ ranh ⇒ ranh tham khảo:
//   1|2  bờ Quảng Trị (107,1; 17,0) → mũi tây nam Hải Nam (108,6; 18,3)
//   2|3  vĩ tuyến 11,3 Bắc (ranh Khánh Hòa – Lâm Đồng)
//   3|4  mũi Cà Mau (104,8; 8,6) → (106; 6,5)
//   2|5  mép tây vòng Hoàng Sa (110,98; 16,45) → (111,0; 15,3) rồi kinh tuyến 111,5 Đ
// Mỗi khu vực = đa giác rộng ∩ VÙNG BIỂN VIỆT NAM (ranh 75 điểm src/data/vn-maritime-border.ts, khép qua đất liền) — như bản vẽ:
// tàu ngoài vùng biển VN không thuộc khu nào. KHÔNG dùng lib/vung-bien-vn (vùng VMS được phép đánh bắt): vùng đó bỏ quanh
// Hoàng Sa, còn khu 5 đã bán GỒM Hoàng Sa. Đổi ranh ở đây = đổi phạm vi license đã bán ⇒ sửa cả bản đồ báo giá.
import { VN_MARITIME_BORDER } from "@/data/vn-maritime-border";
import { pointInRing } from "@/lib/spatial-index";

export const KHU_VUC = [
  { n: 1, ten: "Vịnh Bắc Bộ", poly: [[103, 17.0], [107.1, 17.0], [108.6, 18.3], [110.5, 20.0], [110.5, 23.6], [103, 23.6]] },
  { n: 2, ten: "Miền Trung", poly: [[103, 17.0], [107.1, 17.0], [108.6, 18.3], [110.98, 16.45], [111.0, 15.3], [111.5, 11.3], [103, 11.3]] },
  { n: 3, ten: "Đông Nam Bộ", poly: [[105.6, 11.3], [111.5, 11.3], [111.5, 4], [106.3, 5.9], [106.0, 6.5], [104.8, 8.6], [105.3, 9.3], [105.6, 10.2]] },
  { n: 4, ten: "Tây Nam Bộ", poly: [[100, 12], [105.6, 12], [105.6, 10.2], [105.3, 9.3], [104.8, 8.6], [106.0, 6.5], [106.3, 5.9], [100, 5.0]] },
  { n: 5, ten: "Biển Đông, Hoàng Sa, Trường Sa", poly: [[110.98, 16.45], [110.98, 21], [120, 21], [120, 3], [111.5, 3], [111.5, 11.3], [111.0, 15.3]] },
] as const;

// Khép ranh ngoài từ Móng Cái vòng TRONG đất liền về Hà Tiên — không cắt qua vịnh Bắc Bộ (cùng ve.mjs).
const KHEP_DAT_LIEN = [
  [107.5, 22.2], [105.5, 22.6], [104.3, 20.5], [104.8, 18.5], [106.0, 17.0],
  [107.6, 14.5], [106.8, 11.6], [105.0, 10.9], [104.47, 10.42],
];
const VUNG_BIEN_VN = [...VN_MARITIME_BORDER, ...KHEP_DAT_LIEN];

/** Khu vực (1–5) chứa điểm, ngoài vùng biển VN / ngoài mọi khu ⇒ null. Ranh chung hai khu thì khu số nhỏ nhận. */
export function khuVucCua(lat: number, lon: number): number | null {
  const p = { lat, lon };
  if (!pointInRing(p, VUNG_BIEN_VN)) return null;
  for (const k of KHU_VUC) if (pointInRing(p, k.poly)) return k.n;
  return null;
}
