// Vựa / cơ sở thu mua hải sản — gộp 3 vùng (cào từ nguồn công khai: Trang Vàng,
// mã số thuế, listing, web/báo). Tất cả THAM KHẢO — gọi xác minh trước khi giao
// dịch. Nậu nhỏ tại bến không đăng tin → bà con tự thêm ở "Mối quen".

import type { Wholesaler } from "./types";
import { WHOLESALERS_BAC } from "./bac";
import { WHOLESALERS_TRUNG } from "./trung";
import { WHOLESALERS_NAM } from "./nam";
import { WHOLESALERS_BS_BAC } from "./bs-bac";
import { WHOLESALERS_BS_TRUNG } from "./bs-trung";
import { WHOLESALERS_BS_NAM } from "./bs-nam";

export type { Wholesaler, WholesalerKind } from "./types";

// Gộp 6 nguồn (3 vùng + 3 đợt bổ sung), khử trùng theo tên+tỉnh chuẩn hóa.
const ALL = [
  ...WHOLESALERS_BAC,
  ...WHOLESALERS_TRUNG,
  ...WHOLESALERS_NAM,
  ...WHOLESALERS_BS_BAC,
  ...WHOLESALERS_BS_TRUNG,
  ...WHOLESALERS_BS_NAM,
];

const norm = (s?: string) =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

export const WHOLESALERS: Wholesaler[] = (() => {
  const seen = new Set<string>();
  const out: Wholesaler[] = [];
  for (const w of ALL) {
    const key = `${norm(w.name)}|${norm(w.province)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(w);
  }
  return out;
})();

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
