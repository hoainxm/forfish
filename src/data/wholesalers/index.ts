// Vựa / cơ sở thu mua hải sản — gộp 3 vùng (cào từ nguồn công khai: Trang Vàng,
// mã số thuế, listing, web/báo). Tất cả THAM KHẢO — gọi xác minh trước khi giao
// dịch. Nậu nhỏ tại bến không đăng tin → bà con tự thêm ở "Mối quen".

import type { Wholesaler } from "./types";
import { WHOLESALERS_BAC } from "./bac";
import { WHOLESALERS_TRUNG } from "./trung";
import { WHOLESALERS_NAM } from "./nam";

export type { Wholesaler, WholesalerKind } from "./types";

export const WHOLESALERS: Wholesaler[] = [
  ...WHOLESALERS_BAC,
  ...WHOLESALERS_TRUNG,
  ...WHOLESALERS_NAM,
];

export const WHOLESALER_KIND_LABEL: Record<string, string> = {
  vua: "Vựa hải sản",
  "co-so-thu-mua": "Cơ sở thu mua",
  "dai-ly": "Đại lý thu mua",
  "nau-vua": "Nậu vựa",
};

/** Danh sách tỉnh có vựa, sắp theo số vựa giảm dần rồi tên. */
export function provincesWithWholesalers(): { province: string; count: number }[] {
  const m = new Map<string, number>();
  for (const w of WHOLESALERS) {
    if (!w.province) continue;
    m.set(w.province, (m.get(w.province) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([province, count]) => ({ province, count }))
    .sort((a, b) => b.count - a.count || a.province.localeCompare(b.province, "vi"));
}

export function wholesalersByProvince(province: string): Wholesaler[] {
  return WHOLESALERS.filter((w) => w.province === province);
}
