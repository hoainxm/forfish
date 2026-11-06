// /api/admin/accounts/sdt-khac — NHÂN VIÊN GÁN / DUYỆT / GỠ "SỐ KHÁC" của tài khoản (0086, thay PATCH sdt-phu của 0084).
//
// Một tài khoản ≤3 số khác (máy S-Tracking đứng tên số khác, mua hàng SDVICO bằng số khác…); một số đã duyệt chỉ thuộc
// MỘT tài khoản (DB chặn). App chưa có OTP ⇒ CHỈ nhân viên (quyền tab "tai-khoan" edit) làm số "đã duyệt" — bà con
// tự gửi chỉ tạo dòng chờ (/api/me/sdt-khac). Nhật ký `account.sdt-khac`.
//
// POST { phone, sdt, xacNhan? } — gán mới hoặc duyệt dòng chờ. Số đó đang đăng nhập app như một tài khoản riêng ⇒ 409
//   `co_tai_khoan_rieng` (nhân viên xác nhận rồi gửi lại với xacNhan:true — hai người cùng thấy đồ của số đó).
// DELETE { phone, sdt } — gỡ (đã duyệt hay đang chờ).
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin-auth";
import { logActivity } from "@/lib/admin-activity-log";
import { normalizeVnPhone } from "@/lib/phone";
import { chuanSoKhac, maLoiGhi } from "@/lib/sdt-khac";

const loi = (status: number, code: string, them?: Record<string, unknown>) =>
  NextResponse.json({ ok: false, code, ...them }, { status });
const TRANG: Record<string, number> = { toi_da: 409, da_co: 409, da_gan_nguoi_khac: 409, khong_co_ho_so: 404, migration_needed: 503 };

async function docBody(req: Request) {
  const b = (await req.json().catch(() => null)) as { phone?: unknown; sdt?: unknown; xacNhan?: unknown } | null;
  if (typeof b?.phone !== "string" || !b.phone.trim()) return null;
  return { phone: normalizeVnPhone(b.phone), sdt: b.sdt, xacNhan: b.xacNhan === true };
}

export async function POST(req: Request) {
  const who = await requirePermission("tai-khoan", "edit");
  if (!who.ok) return loi(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return loi(503, "not_configured");
  const b = await docBody(req);
  if (!b) return loi(400, "bad_phone");
  const so = chuanSoKhac(b.sdt, b.phone);
  if (!so.ok) return loi(400, so.code);

  // Một số một người: đã duyệt cho tài khoản khác ⇒ nói rõ là ai để nhân viên gỡ bên kia trước (DB cũng chặn).
  const { data: daGan, error: e1 } = await admin
    .from("sdt_khac")
    .select("phone")
    .eq("sdt", so.sdt)
    .not("duyet_luc", "is", null)
    .neq("phone", b.phone)
    .maybeSingle();
  if (e1) return loi(TRANG[maLoiGhi(e1)] ?? 500, maLoiGhi(e1));
  if (daGan) return loi(409, "da_gan_nguoi_khac", { cua: daGan.phone });

  // Số đó tự đăng nhập app (có chuỗi máy còn hiệu lực) ⇒ hỏi lại: gán là tài khoản này cũng thấy đồ/máy của người kia.
  if (!b.xacNhan) {
    const { data: tk } = await admin
      .from("device_tokens")
      .select("customer_phone")
      .eq("customer_phone", so.sdt)
      .is("revoked_at", null)
      .limit(1);
    if (tk && tk.length) return loi(409, "co_tai_khoan_rieng");
  }

  const luc = new Date().toISOString();
  const { data: cho, error: e2 } = await admin
    .from("sdt_khac")
    .update({ duyet_luc: luc, duyet_boi: who.phone })
    .eq("phone", b.phone)
    .eq("sdt", so.sdt)
    .select("id");
  if (e2) return loi(TRANG[maLoiGhi(e2)] ?? 500, maLoiGhi(e2));
  const daDuyetCho = (cho ?? []).length > 0;
  if (!daDuyetCho) {
    const { error: e3 } = await admin
      .from("sdt_khac")
      .insert({ phone: b.phone, sdt: so.sdt, nguon: "nhan-vien", duyet_luc: luc, duyet_boi: who.phone });
    if (e3) {
      const code = maLoiGhi(e3);
      if (code === "loi") console.error("[admin/sdt-khac] ghi hỏng:", e3.message);
      return loi(TRANG[code] ?? 500, code);
    }
  }

  await logActivity(admin, {
    actorPhone: who.phone,
    actorRole: who.role,
    action: "account.sdt-khac",
    target: b.phone,
    detail: { them: so.sdt, duyetCho: daDuyetCho, xacNhan: b.xacNhan },
  });
  return NextResponse.json({ ok: true, sdt: so.sdt });
}

export async function DELETE(req: Request) {
  const who = await requirePermission("tai-khoan", "edit");
  if (!who.ok) return loi(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return loi(503, "not_configured");
  const b = await docBody(req);
  if (!b) return loi(400, "bad_phone");
  const so = chuanSoKhac(b.sdt, b.phone);
  if (!so.ok) return loi(400, so.code);

  const { error } = await admin.from("sdt_khac").delete().eq("phone", b.phone).eq("sdt", so.sdt);
  if (error) return loi(TRANG[maLoiGhi(error)] ?? 500, maLoiGhi(error));
  await logActivity(admin, {
    actorPhone: who.phone,
    actorRole: who.role,
    action: "account.sdt-khac",
    target: b.phone,
    detail: { go: so.sdt },
  });
  return NextResponse.json({ ok: true });
}
