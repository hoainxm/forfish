// TỈNH THEO VỊ TRÍ MÁY (14 §21c, sửa 2026-11-06).
//
// Anh Long 06/11: "các tin chính sách thì lấy các tin của các tỉnh, thêm cái cơ sở là vị trí gps của điện thoại đang
// sử dụng để chọn luôn các tin liên quan tỉnh đó, ví dụ hcm đang có các chính sách hỗ trợ ngư dân".
//
// Toạ độ ⇒ tỉnh của CẢNG CÁ GẦN NHẤT trong danh bạ (FISHING_PORTS, có sẵn trong máy) — không gọi mạng, không cần ranh
// giới tỉnh. Quá TINH_TOI_DA_KM (ngoài khơi xa / sâu trong đất liền) ⇒ null: ngoài biển vị trí máy không nói bà con làm
// hồ sơ ở đâu, khi đó tab Chính sách lùi về tỉnh cảng nhà.
// nợ: cảng gần nhất không phải ranh giới tỉnh — người đứng sát ranh giới (vd Cần Giờ ↔ Long An cũ) có thể ra tỉnh bên
// cạnh; nâng cấp khi app có lớp ranh giới tỉnh offline (đang chưa có).
//
// Kho `forfish.vitri.tinh.v1` = tỉnh lần đo cuối + giờ đo: mở app mất sóng / chưa bắt GPS vẫn có tỉnh ngay; cũ quá
// TINH_HET_HAN_MS thì thôi dùng (bà con đã đi nơi khác). Hỏng/không ghi được ⇒ coi như chưa đo, KHÔNG ném.

import { FISHING_PORTS, PORT_COORD_SAI } from "@/data/fishing-ports";
import { haversineKm } from "@/lib/geo";
import { COASTAL_PROVINCES, provinceKey } from "@/lib/region";

export const TINH_VI_TRI_KEY = "forfish.vitri.tinh.v1";
/** cảng gần nhất xa hơn chừng này ⇒ không đoán tỉnh */
export const TINH_TOI_DA_KM = 150;
/** tỉnh đo được giữ 7 ngày */
export const TINH_HET_HAN_MS = 7 * 24 * 3600_000;

type CangToaDo = { id?: string; province?: string; lat?: number; lng?: number };

/** Tên tỉnh chuẩn trong COASTAL_PROVINCES (danh bạ cảng ghi tên giống, đối chiếu qua provinceKey cho chắc). */
function tenChuan(province: string | undefined): string | null {
  if (!province) return null;
  const k = provinceKey(province);
  return COASTAL_PROVINCES.find((p) => provinceKey(p.name) === k)?.name ?? null;
}

/**
 * Toạ độ ⇒ tên tỉnh ven biển (theo cảng cá gần nhất ≤ `toiDaKm`). Toạ độ hỏng ⇒ null.
 */
export function tinhTuToaDo(
  lat: number,
  lon: number,
  cang: readonly CangToaDo[] = FISHING_PORTS,
  toiDaKm = TINH_TOI_DA_KM,
): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  let tot: { km: number; province: string } | null = null;
  for (const c of cang) {
    if (c.lat == null || c.lng == null || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) continue;
    // toạ độ sai rõ trong nguồn (vd "Phường 6 Thắng Nhì" Vũng Tàu nằm ở Nha Trang) ⇒ không dùng để đoán tỉnh
    if (c.id && PORT_COORD_SAI.has(c.id)) continue;
    const ten = tenChuan(c.province);
    if (!ten) continue;
    const km = haversineKm({ lat, lon }, { lat: c.lat, lon: c.lng });
    if (km <= toiDaKm && (!tot || km < tot.km)) tot = { km, province: ten };
  }
  return tot?.province ?? null;
}

export type TinhDaDo = { province: string; at: number };

type Kho = Pick<Storage, "getItem" | "setItem">;

function kho(): Kho | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Tỉnh lần đo cuối còn hạn; hỏng / hết hạn / tỉnh lạ ⇒ null. */
export function docTinhViTri(now = Date.now(), k: Kho | null = kho()): TinhDaDo | null {
  if (!k) return null;
  try {
    const v = JSON.parse(k.getItem(TINH_VI_TRI_KEY) ?? "null") as { province?: unknown; at?: unknown } | null;
    if (!v || typeof v.province !== "string" || typeof v.at !== "number") return null;
    if (v.at > now + 60_000 || now - v.at > TINH_HET_HAN_MS) return null;
    const ten = tenChuan(v.province);
    return ten ? { province: ten, at: v.at } : null;
  } catch {
    return null;
  }
}

/** Ghi tỉnh vừa đo. `false` = máy không ghi được (vẫn dùng được trong phiên). */
export function ghiTinhViTri(province: string, now = Date.now(), k: Kho | null = kho()): boolean {
  if (!k) return false;
  try {
    k.setItem(TINH_VI_TRI_KEY, JSON.stringify({ province, at: now }));
    return true;
  } catch {
    return false;
  }
}
