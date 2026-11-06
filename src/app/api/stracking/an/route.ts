// POST / DELETE /api/stracking/an — bà con "XOÁ" máy giám sát khỏi danh sách của mình, hoặc hiện lại (2026-11-06; anh Hoà
// đề xuất, anh Long duyệt: "ko gọi là ẩn mà là xoá, mặc dù trong hệ thống là ẩn"; "máy nào ẩn thì ko cần thông báo liên
// quan nữa"). Thân { serial }. Thực chất ghi/xoá dòng `stracking_an` (0085) — kho S-Tracking giữ nguyên.
//
// Quyền: SĐT lấy từ PHIÊN (không nhận từ máy khách); chỉ xoá được máy có SĐT CHỦ TÀU (anh Long 06/11) là một trong các
// SĐT của tài khoản (SĐT chính + SĐT phụ 0084). Ghi dấu cho SĐT chính VÀ mọi SĐT của tài khoản đang gắn với máy, để tin đã
// gộp từ SĐT phụ không mang máy đó trở lại. DELETE xoá dấu của mọi SĐT của tài khoản.
// 401 chưa đăng nhập · 400 thân sai · 404 không phải máy của bạn · 503 hạ tầng.
import { identityFromRequest } from "@/lib/api-identity";
import { createAdminClient } from "@/lib/supabase/admin";
import { locMayTheoSdt, sdtTraCuaTaiKhoan } from "@/lib/sdt-khac";

export const dynamic = "force-dynamic";

const SERIAL = /^[\w.-]{1,64}$/u;

async function docSerial(req: Request): Promise<string | null> {
  const b = (await req.json().catch(() => null)) as { serial?: unknown } | null;
  const s = typeof b?.serial === "string" ? b.serial.trim() : "";
  return SERIAL.test(s) ? s : null;
}

async function chuanBi(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return { res: who.res } as const;
  const serial = await docSerial(req);
  if (!serial) return { res: Response.json({ ok: false, code: "bad_serial" }, { status: 400 }) } as const;
  const admin = createAdminClient();
  if (!admin) return { res: Response.json({ ok: false, code: "unavailable" }, { status: 503 }) } as const;
  const sdts = await sdtTraCuaTaiKhoan(admin, who.phone);
  return { admin, sdts, serial, phone: who.phone } as const;
}

export async function POST(req: Request) {
  const c = await chuanBi(req);
  if ("res" in c) return c.res;
  const loc = locMayTheoSdt(c.sdts);
  if (!loc) return Response.json({ ok: false, code: "not_mine" }, { status: 404 });
  const { data: may, error } = await c.admin
    .from("stracking_thiet_bi")
    .select("serial,sdt_chu_tau")
    .eq("serial", c.serial)
    .or(loc)
    .maybeSingle();
  if (error) return Response.json({ ok: false, code: "unavailable" }, { status: 503 });
  if (!may) return Response.json({ ok: false, code: "not_mine" }, { status: 404 });
  const ganMay = [may.sdt_chu_tau].filter((s): s is string => !!s && c.sdts.includes(s));
  const sdtGhi = [...new Set([c.phone, ...ganMay])].filter((s) => /^0[1-9]\d{8}$/.test(s));
  const { error: eGhi } = await c.admin
    .from("stracking_an")
    .upsert(sdtGhi.map((sdt) => ({ sdt, serial: c.serial })), { onConflict: "sdt,serial", ignoreDuplicates: true });
  if (eGhi) return Response.json({ ok: false, code: "unavailable" }, { status: 503 });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const c = await chuanBi(req);
  if ("res" in c) return c.res;
  const { error } = await c.admin.from("stracking_an").delete().eq("serial", c.serial).in("sdt", [...new Set([c.phone, ...c.sdts])]);
  if (error) return Response.json({ ok: false, code: "unavailable" }, { status: 503 });
  return Response.json({ ok: true });
}
