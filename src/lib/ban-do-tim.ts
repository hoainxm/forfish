/*
  Ô "ĐI ĐÂU?" TRÊN BẢN ĐỒ — luật thuần cho hộp tìm (BD-02, rà FB 2026-10-25).
  Ô tìm MIỄN PHÍ cho mọi tài khoản đã đăng nhập (CLAUDE.md: bản đồ cho không, cái
  bán là dự báo cá): gõ tên cảng / chọn điểm đã lưu / gõ toạ độ ⇒ bay tới + ghim.
  Dữ liệu đều nằm trong máy (cảng trong bundle, điểm lưu localStorage) nên mất
  sóng vẫn tìm được. Không window, không fetch. Test: __tests__/ban-do-tim.test.ts.
*/
import { FISHING_PORTS, PORT_COORD_SAI } from "@/data/fishing-ports";
import { boDau } from "@/lib/cho-ca";
import type { SavedPlace } from "@/lib/places";
import { relevanceRank } from "@/lib/region";

export type KetQuaTim = {
  loai: "diem" | "cang";
  id: string;
  ten: string;
  /** dòng phụ mờ: tỉnh (cảng) hoặc "Cảng nhà" (điểm nhà) */
  phu?: string;
  /** chữ để so khớp thêm (huyện/xã/địa chỉ cảng — "Nha Trang" nằm ở đây, không ở tên) — không hiển thị */
  khoa?: string;
  lat: number;
  lon: number;
};

/** tối đa kết quả mỗi nhóm — đủ chọn, không thành danh bạ */
export const TOI_DA_CANG = 8;
export const TOI_DA_CANG_GOI_Y = 6;
export const TOI_DA_DIEM = 5;

/** cảng có toạ độ tin được (bỏ cảng thiếu toạ độ / toạ độ sai đã ghi sổ) */
export const CANG_TIM_DUOC: KetQuaTim[] = FISHING_PORTS.filter(
  (p) => p.lat != null && p.lng != null && !PORT_COORD_SAI.has(p.id),
).map((p) => ({
  loai: "cang",
  id: p.id,
  ten: p.name,
  phu: p.province,
  khoa: [p.district, p.ward, p.address].filter(Boolean).join(" "),
  lat: p.lat as number,
  lon: p.lng as number,
}));

/** cảng loại I — gợi ý khi chưa có tỉnh nhà */
const CANG_LOAI_I = new Set(FISHING_PORTS.filter((p) => p.klass === 1).map((p) => p.id));

function khop(q: string, ...truong: (string | undefined)[]): boolean {
  const k = boDau(q.trim());
  if (!k) return true;
  return truong.some((t) => t != null && boDau(t).includes(k));
}

/** tên bắt đầu bằng chữ gõ thì lên trước tên chỉ chứa ở giữa */
function batDau(q: string, ten: string): 0 | 1 {
  return boDau(ten).startsWith(boDau(q.trim())) ? 0 : 1;
}

/**
 * Cảng theo chữ gõ. Chưa gõ ⇒ ≤6 cảng tỉnh nhà (chưa có tỉnh ⇒ 6 cảng loại I).
 * Gõ ⇒ lọc bỏ dấu theo tên + tỉnh + huyện/địa chỉ; tỉnh nhà lên trước, rồi cùng miền; ≤8.
 */
export function timCang(q: string, tinhNha?: string, cangs: KetQuaTim[] = CANG_TIM_DUOC): KetQuaTim[] {
  const chu = q.trim();
  if (!chu) {
    const goiY = tinhNha
      ? cangs.filter((c) => relevanceRank(c.phu, tinhNha) === 0)
      : cangs.filter((c) => CANG_LOAI_I.has(c.id));
    return goiY.sort((a, b) => a.ten.localeCompare(b.ten, "vi")).slice(0, TOI_DA_CANG_GOI_Y);
  }
  return cangs
    .filter((c) => khop(chu, c.ten, c.phu, c.khoa))
    .sort(
      (a, b) =>
        relevanceRank(a.phu, tinhNha) - relevanceRank(b.phu, tinhNha) ||
        batDau(chu, a.ten) - batDau(chu, b.ten) ||
        a.ten.localeCompare(b.ten, "vi"),
    )
    .slice(0, TOI_DA_CANG);
}

/** điểm đã lưu theo chữ gõ — cảng nhà lên đầu, rồi tên; ≤5. Trống ⇒ []. */
export function timDiemLuu(q: string, places: SavedPlace[]): KetQuaTim[] {
  return places
    .filter((p) => khop(q, p.name))
    .sort((a, b) => (a.kind !== b.kind ? (a.kind === "home" ? -1 : 1) : a.name.localeCompare(b.name, "vi")))
    .slice(0, TOI_DA_DIEM)
    .map((p) => ({
      loai: "diem",
      id: p.id,
      ten: p.name,
      phu: p.kind === "home" ? "Cảng nhà" : undefined,
      lat: p.lat,
      lon: p.lon,
    }));
}

/** chuỗi gõ trông như toạ độ "10.52, 108.21" / "10,52 108,21" (phẩy hay chấm đều được) */
const MAU_TOA_DO = /^\s*(-?\d+(?:[.,]\d+)?)\s*[, ]\s*(-?\d+(?:[.,]\d+)?)/;

/** toạ độ gõ nhanh trong ô tìm; ngoài phạm vi lat ±90 / lon ±180 ⇒ null */
export function docToaDoNhanh(q: string): { lat: number; lon: number } | null {
  const m = MAU_TOA_DO.exec(q);
  if (!m) return null;
  const lat = Number(m[1].replace(",", "."));
  const lon = Number(m[2].replace(",", "."));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

/** "Đến 10,52 · 108,21" — số kiểu Việt (phẩy thập phân), 2 chữ số là đủ nhìn */
export function nhanToaDo(lat: number, lon: number): string {
  const so = (v: number) => v.toFixed(2).replace(".", ",");
  return `Đến ${so(lat)} · ${so(lon)}`;
}

/** câu khi không khớp gì — một dòng mờ, không khuyên dạy */
export function cauKhongThay(q: string): string {
  return `Không thấy “${q.trim()}”`;
}
