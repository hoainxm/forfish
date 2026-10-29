/**
 * QUYỀN XEM AIS THEO TÀI KHOẢN (2026-10-29, anh Long: "AIS là chỉ cho Long view thôi nhé, cũng 1 dạng option
 * bật cho ai người đó view đc").
 *
 * Danh sách SĐT ở `app_config.tau_ais_xem` (trang quản trị → Cấu hình ứng dụng, ô "Tài khoản xem AIS"; env
 * TAU_AIS_XEM là đường lùi). CHƯA ĐẶT ⇒ mặc định chỉ chủ dự án. Không migration: thêm/bớt người là sửa một ô.
 * Hai cửa cùng đọc luật này: middleware chặn GET /api/tau-ais (403 `ais_off`) và GET /api/tau-ais/quyen cho máy
 * biết để hiện nút AIS. Thuần — dùng chung server + test.
 */
import { isValidVnPhone, normalizeVnPhone } from "@/lib/phone";

export const MAC_DINH_XEM_AIS = ["0938635689"] as const;

/** "0938 635 689, +84901234567; 0912…" → danh sách SĐT chuẩn (ngăn bằng phẩy/chấm phẩy/xuống dòng — khoảng trắng TRONG số được giữ; bỏ ô hỏng, bỏ trùng). */
export function docDanhSachSdt(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const out = new Set<string>();
  for (const part of raw.split(/[,;\n]+/).map((p) => p.trim())) {
    if (!part) continue;
    if (isValidVnPhone(part)) out.add(normalizeVnPhone(part));
  }
  return [...out];
}

/** Ô cấu hình hợp lệ khi có ít nhất một SĐT và MỌI mẩu đều là SĐT (gõ sai một số thì chặn, không lặng lẽ bỏ). */
export function danhSachSdtHopLe(raw: string): boolean {
  const parts = raw.split(/[,;\n]+/).map((p) => p.trim()).filter(Boolean);
  return parts.length > 0 && parts.every((p) => isValidVnPhone(p));
}

/** Tài khoản này có được xem AIS không. `cauHinh` = giá trị ô (null/rỗng ⇒ mặc định chỉ chủ dự án). */
export function duocXemAis(phone: string | null | undefined, cauHinh: string | null | undefined): boolean {
  if (!phone) return false;
  const ds = docDanhSachSdt(cauHinh);
  const hieuLuc = ds.length > 0 ? ds : [...MAC_DINH_XEM_AIS];
  return hieuLuc.includes(normalizeVnPhone(phone));
}
