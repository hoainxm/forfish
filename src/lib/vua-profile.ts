// HỒ SƠ VỰA (spec 17 §12.4) — logic THUẦN dùng chung route ↔ màn /tien/vua ↔ quản trị. Không fetch, không window.
//
// Vựa/nậu/nhà máy/chợ TỰ KHAI hồ sơ, nhân viên SDVICO duyệt rồi mới hiện ở Chợ cá › Đầu mối cạnh danh bạ admin
// (`sell_contacts`). Bảng `vua_profiles` (migration 0079) — mọi giới hạn dưới đây CHÉP ĐÚNG check của bảng, để route
// trả 400 rõ ràng trước khi Postgres trả 23514 khó hiểu.
//
// LUẬT TRẠNG THÁI KHI CHỦ HỒ SƠ BẤM LƯU (`trangThaiKhiLuu`):
//   · chưa có hồ sơ             ⇒ cho_duyet
//   · cho_duyet                 ⇒ cho_duyet (sửa trong lúc chờ)
//   · tu_choi                   ⇒ cho_duyet (gửi lại — xoá lý do cũ)
//   · hoat_dong + đổi Ô CHÍNH   ⇒ cho_duyet (tên, loại, tỉnh, địa chỉ, SĐT liên hệ — thứ bà con dựa vào để tin)
//   · hoat_dong + chỉ đổi loài/giờ ⇒ giữ hoat_dong (việc thường ngày, không bắt duyệt lại)
//   · tam_khoa                  ⇒ KHÔNG cho sửa (route trả 403 `locked`)

import { isValidVnPhone, normalizeVnPhone } from "@/lib/phone";
import type { SellContact } from "@/lib/sell-contacts";

export const VUA_KINDS = ["vua", "nau", "nha-may", "cho"] as const;
export type VuaKind = (typeof VUA_KINDS)[number];

export const VUA_KIND_LABEL: Record<VuaKind, string> = {
  vua: "Vựa",
  nau: "Nậu",
  "nha-may": "Nhà máy",
  cho: "Chợ",
};

export const isVuaKind = (v: unknown): v is VuaKind =>
  typeof v === "string" && (VUA_KINDS as readonly string[]).includes(v);

export const VUA_STATUSES = ["cho_duyet", "hoat_dong", "tu_choi", "tam_khoa"] as const;
export type VuaStatus = (typeof VUA_STATUSES)[number];

export const isVuaStatus = (v: unknown): v is VuaStatus =>
  typeof v === "string" && (VUA_STATUSES as readonly string[]).includes(v);

/** Giới hạn — khớp check của `vua_profiles` (0079). `speciesItem` là trần riêng của app (bảng không ghi). */
export const VUA_MAX = {
  nameMin: 3,
  name: 60,
  province: 40,
  address: 200,
  species: 20,
  speciesItem: 40,
  hours: 60,
  contact: 20,
  note: 300,
  noteMin: 3,
} as const;

/** Phần chủ hồ sơ khai (không có status — trạng thái do máy chủ quyết). */
export interface VuaDraft {
  name: string;
  kind: VuaKind;
  province: string | null;
  address: string | null;
  species: string[];
  hours: string | null;
  /** SĐT hiện trên Đầu mối — đã chuẩn hoá; null = dùng SĐT tài khoản (route điền) */
  contact: string | null;
}

export type VuaField = "name" | "kind" | "province" | "address" | "species" | "hours" | "contact";

export type VuaParse =
  | { ok: true; value: VuaDraft }
  | { ok: false; field: VuaField; message: string };

const optStr = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim().replace(/\s+/g, " ");
  return t ? t : null;
};

/** "cá ngừ, mực;  cá thu" ⇒ ["cá ngừ","mực","cá thu"] — bỏ trống, bỏ trùng (không phân biệt hoa thường). */
export function tachLoai(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/[,;\n]/)) {
    const t = raw.trim().replace(/\s+/g, " ");
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

/**
 * Ranh giới: body bất kỳ ⇒ bản khai sạch, hoặc ô sai đầu tiên theo thứ tự form + câu lỗi tiếng Việt.
 * `species` nhận mảng chuỗi hoặc một chuỗi phẩy.
 */
export function parseVuaBody(body: unknown): VuaParse {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const name = optStr(b.name) ?? "";
  if (name.length < VUA_MAX.nameMin)
    return { ok: false, field: "name", message: "Nhập tên vựa (ít nhất 3 chữ)." };
  if (name.length > VUA_MAX.name)
    return { ok: false, field: "name", message: `Tên dài quá — tối đa ${VUA_MAX.name} chữ.` };

  if (!isVuaKind(b.kind)) return { ok: false, field: "kind", message: "Chọn loại: vựa, nậu, nhà máy hay chợ." };

  const province = optStr(b.province);
  if (province && province.length > VUA_MAX.province)
    return { ok: false, field: "province", message: "Tên tỉnh dài quá." };

  const address = optStr(b.address);
  if (address && address.length > VUA_MAX.address)
    return { ok: false, field: "address", message: `Địa chỉ dài quá — tối đa ${VUA_MAX.address} chữ.` };

  let species: string[];
  if (Array.isArray(b.species)) {
    species = tachLoai(b.species.filter((x): x is string => typeof x === "string").join(","));
  } else if (typeof b.species === "string") {
    species = tachLoai(b.species);
  } else {
    species = [];
  }
  if (species.length > VUA_MAX.species)
    return { ok: false, field: "species", message: `Nhiều loài quá — tối đa ${VUA_MAX.species} loài.` };
  if (species.some((s) => s.length > VUA_MAX.speciesItem))
    return { ok: false, field: "species", message: "Có tên loài dài quá — ngăn các loài bằng dấu phẩy." };

  const hours = optStr(b.hours);
  if (hours && hours.length > VUA_MAX.hours)
    return { ok: false, field: "hours", message: `Giờ mua dài quá — tối đa ${VUA_MAX.hours} chữ.` };

  const contactRaw = optStr(b.contact);
  let contact: string | null = null;
  if (contactRaw) {
    if (!isValidVnPhone(contactRaw))
      return { ok: false, field: "contact", message: "Số điện thoại chưa đúng." };
    contact = normalizeVnPhone(contactRaw);
    if (contact.length > VUA_MAX.contact)
      return { ok: false, field: "contact", message: "Số điện thoại chưa đúng." };
  }

  return { ok: true, value: { name, kind: b.kind, province, address, species, hours, contact } };
}

/** Ô CHÍNH đổi chưa — đổi thì hồ sơ đã duyệt phải duyệt lại. So sau khi đã chuẩn hoá (parseVuaBody). */
export function doiOChinh(
  truoc: Pick<VuaDraft, "name" | "kind" | "province" | "address" | "contact">,
  sau: Pick<VuaDraft, "name" | "kind" | "province" | "address" | "contact">,
): boolean {
  const n = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
  return (
    n(truoc.name) !== n(sau.name) ||
    truoc.kind !== sau.kind ||
    n(truoc.province) !== n(sau.province) ||
    n(truoc.address) !== n(sau.address) ||
    n(truoc.contact) !== n(sau.contact)
  );
}

/** Trạng thái sau khi chủ hồ sơ lưu — luật ở đầu file. "khoa" = không được sửa. */
export function trangThaiKhiLuu(
  truoc: (Pick<VuaDraft, "name" | "kind" | "province" | "address" | "contact"> & { status: VuaStatus }) | null,
  sau: VuaDraft,
): VuaStatus | "khoa" {
  if (!truoc) return "cho_duyet";
  switch (truoc.status) {
    case "tam_khoa":
      return "khoa";
    case "hoat_dong":
      return doiOChinh(truoc, sau) ? "cho_duyet" : "hoat_dong";
    default:
      return "cho_duyet";
  }
}

/* ── QUẢN TRỊ ─────────────────────────────────────────────────────────────── */

export type VuaAdminAction = "duyet" | "tu-choi" | "khoa";

export const isVuaAdminAction = (v: unknown): v is VuaAdminAction =>
  v === "duyet" || v === "tu-choi" || v === "khoa";

/**
 * Nhân viên đổi trạng thái: duyệt (cả mở khoá), từ chối (BẮT lý do 3–300 chữ), khoá (lý do tuỳ, ≤300).
 * Trả trạng thái mới hoặc câu lỗi. Bước không đổi gì (duyệt hồ sơ đang hiện) ⇒ lỗi, để nhật ký không ghi rác.
 */
export function chuyenTrangThaiAdmin(
  hienTai: VuaStatus,
  action: VuaAdminAction,
  lyDo: unknown,
): { ok: true; status: VuaStatus; note: string | null } | { ok: false; code: string } {
  const note = optStr(lyDo);
  if (note && note.length > VUA_MAX.note) return { ok: false, code: "note_too_long" };
  if (action === "duyet") {
    if (hienTai === "hoat_dong") return { ok: false, code: "no_change" };
    return { ok: true, status: "hoat_dong", note: null };
  }
  if (action === "tu-choi") {
    if (!note || note.length < VUA_MAX.noteMin) return { ok: false, code: "need_reason" };
    if (hienTai === "tu_choi") return { ok: false, code: "no_change" };
    return { ok: true, status: "tu_choi", note };
  }
  if (hienTai === "tam_khoa") return { ok: false, code: "no_change" };
  return { ok: true, status: "tam_khoa", note };
}

/* ── ĐẦU MỐI ──────────────────────────────────────────────────────────────── */

/** Một hồ sơ vựa đang hiện, như GET /api/vua trả — KHÔNG có SĐT chủ tài khoản, chỉ SĐT liên hệ chủ tự khai. */
export interface PublicVua {
  id: string;
  name: string;
  kind: VuaKind;
  province: string | null;
  address: string | null;
  species: string[];
  hours: string | null;
  contact: string | null;
  xacMinh: boolean;
}

/** Nhóm của danh bạ Đầu mối (`sell_contacts.kind`) mà hồ sơ này nằm vào. Vựa + nậu cùng mục "Nậu vựa". */
export function nhomDauMoi(kind: VuaKind): "vua" | "cho" | "nhamay" {
  if (kind === "cho") return "cho";
  if (kind === "nha-may") return "nhamay";
  return "vua";
}

/** Hồ sơ vựa ⇒ một hàng của danh bạ Đầu mối (cùng khuôn `SellContact` của sell_contacts). Nhãn phụ = loại tự khai. */
export function vuaThanhDauMoi(v: PublicVua, thuTu: number): SellContact {
  return {
    id: v.id,
    kind: nhomDauMoi(v.kind),
    name: v.name,
    subLabel: VUA_KIND_LABEL[v.kind],
    province: v.province ?? undefined,
    address: v.address ?? undefined,
    phone: v.contact ?? undefined,
    hours: v.hours ?? undefined,
    species: v.species,
    markets: [],
    direct: false,
    visible: true,
    sortOrder: thuTu,
    xacMinh: v.xacMinh,
  };
}
