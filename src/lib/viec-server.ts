import "server-only";
// VIỆC LÀM — TRỢ GIÚP CHUNG CHO MỌI ROUTE /api/viec/* (spec 17 §5–§7). Luật thuần ở lib/viec.ts (có test).
//
// Ba cửa an toàn ở MỘT chỗ:
//   1. danh tính = identityFromRequest (qua kairos/server readerOf / requireWriter) — SĐT chỉ từ chuỗi, KHÔNG từ body;
//   2. ghi = có hồ sơ Kairos + chưa bị cấm (`banned_until` Kairos — §6.4 "Bị cấm đăng") — requireWriter;
//   3. ra client = qua tinDto / hoSoDto — KHÔNG BAO GIỜ có SĐT. SĐT chỉ ra ở hai route `lien-he` theo luật §5.
//
// MIGRATION 0079 CÓ THỂ CHƯA ÁP: bảng/cột chưa có ⇒ mọi lỗi DB trả 503 `unavailable` (khuôn /api/me/vai) — máy
// giữ bản lưu, không coi là "không có tin".
//
// HỒ SƠ TÌM TÀU — ID CÔNG KHAI = `kairos_profiles.id` (uuid sẵn có của cùng SĐT), KHÔNG phải SĐT, KHÔNG băm SĐT:
// băm SĐT VN (10 số) dò ngược được trong vài giây. Tên hiện = `kairos_profiles.handle` (§6.2 "lấy tên Kairos").
// Đăng hồ sơ đi qua requireWriter nên hồ sơ Kairos luôn có trước hồ sơ tìm tàu.

import { NextResponse } from "next/server";
import { FISHING_PORTS } from "@/data/fishing-ports";
import { createAdminClient } from "@/lib/supabase/admin";
import { isVai, type Vai } from "@/lib/vai";
import type { ViecHoSo, ViecTin } from "@/lib/viec";

export type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

export const PORT_IDS: ReadonlySet<string> = new Set(FISHING_PORTS.map((p) => p.id));

export function vErr(status: number, code: string, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ ok: false, code, ...extra }, { status });
}

export const unavailable = () => vErr(503, "unavailable");

/** Cột đọc của job_posts (đủ cho DTO + kiểm chủ). */
export const POST_COLS =
  "id, owner_phone, nghe, port_id, vi_tri, so_nguoi, ngay_di, so_ngay, cong, giay, ghi_chu, boat_reg, show_boat, status, expires_at, created_at";

export interface PostRow {
  id: string;
  owner_phone: string;
  nghe: string;
  port_id: string;
  vi_tri: string[];
  so_nguoi: number;
  ngay_di: string | null;
  so_ngay: number | null;
  cong: string | null;
  giay: string[];
  ghi_chu: string | null;
  boat_reg: string | null;
  show_boat: boolean;
  status: "mo" | "du" | "an";
  expires_at: string;
  created_at: string;
}

export const SEEKER_COLS = "phone, nghe, so_nam, vi_tri, ports, giay, san_sang, ghi_chu, dang_tim, bat_luc, updated_at";

export interface SeekerRow {
  phone: string;
  nghe: string[];
  so_nam: number | null;
  vi_tri: string[];
  ports: string[];
  giay: string[];
  san_sang: string | null;
  ghi_chu: string | null;
  dang_tim: boolean;
  bat_luc: string;
  updated_at: string;
}

/** Hàng tin ⇒ client. Số hiệu tàu chỉ khi chủ bật; KHÔNG owner_phone. `viewer` = SĐT người xem (để đánh dấu tin mình). */
export function tinDto(r: PostRow, viewer: string | null): ViecTin {
  return {
    id: r.id,
    nghe: r.nghe,
    portId: r.port_id,
    viTri: r.vi_tri ?? [],
    soNguoi: r.so_nguoi,
    ngayDi: r.ngay_di,
    soNgay: r.so_ngay,
    cong: r.cong,
    giay: r.giay ?? [],
    ghiChu: r.ghi_chu,
    boatReg: r.show_boat ? r.boat_reg : null,
    status: r.status,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
    ...(viewer && r.owner_phone === viewer ? { cuaToi: true } : {}),
  };
}

/** Bản cho chính chủ (Sửa cần số hiệu dù đang ẩn). */
export function tinChuDto(r: PostRow): ViecTin & { boatRegRieng: string | null; showBoat: boolean } {
  return { ...tinDto(r, r.owner_phone), boatRegRieng: r.boat_reg, showBoat: r.show_boat };
}

export function hoSoDto(r: SeekerRow, p: { id: string; handle: string }): ViecHoSo {
  return {
    id: p.id,
    ten: p.handle,
    nghe: r.nghe ?? [],
    soNam: r.so_nam,
    viTri: r.vi_tri ?? [],
    ports: r.ports ?? [],
    giay: r.giay ?? [],
    sanSang: r.san_sang,
    ghiChu: r.ghi_chu,
    updatedAt: r.updated_at,
  };
}

/** Vai của SĐT từ `customers.vai`. Không có hàng ⇒ null (chưa chọn). Lỗi DB / cột chưa có ⇒ `{ ok: false }` (503). */
export async function vaiCua(admin: Admin, phone: string): Promise<{ ok: true; vai: Vai | null } | { ok: false }> {
  const { data, error } = await admin.from("customers").select("vai").eq("phone", phone).maybeSingle();
  if (error) return { ok: false };
  return { ok: true, vai: isVai(data?.vai) ? data.vai : null };
}

/** Số tin đang mở (mo + chưa hết hạn) của SĐT; lỗi ⇒ null. `tru` = id tin không tính (tin đang mở lại chính nó). */
export async function demTinMo(admin: Admin, phone: string, nowIso: string, tru?: string): Promise<number | null> {
  let q = admin
    .from("job_posts")
    .select("id", { count: "exact", head: true })
    .eq("owner_phone", phone)
    .eq("status", "mo")
    .gt("expires_at", nowIso);
  if (tru) q = q.neq("id", tru);
  const { count, error } = await q;
  return error ? null : (count ?? 0);
}
