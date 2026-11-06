// /api/me/sdt-khac — BÀ CON GỬI "SỐ KHÁC CỦA TÔI" (0086, anh Long 06/11: "cho khách bổ sung sdt mua hàng sdvico").
//
// Mua hàng SDVICO / máy giám sát hành trình đứng tên số khác số đăng nhập ⇒ bà con gõ số đó ⇒ ghi dòng CHỜ DUYỆT
// (`nguon='khach'`, `duyet_luc` null) + báo nhân viên qua hộp yêu cầu CRM. App CHƯA có OTP nên dòng chờ KHÔNG mở thêm
// quyền xem gì — chỉ khi nhân viên duyệt ở /quan-tri (Tài khoản) thì đồ/máy của số đó mới hiện (lib/sdt-khac).
//
// POST { sdt } gửi · DELETE { sdt } rút số CHỜ của chính mình (gõ nhầm) — số đã duyệt chỉ nhân viên gỡ.
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { createAdminClient } from "@/lib/supabase/admin";
import { createConsultationRequest, isAssetSyncConfigured } from "@/lib/sdwork-assets";
import { chuanSoKhac, maLoiGhi } from "@/lib/sdt-khac";

const loi = (status: number, code: string) => NextResponse.json({ ok: false, code }, { status });
const TRANG: Record<string, number> = {
  bad_sdt: 400,
  trung_sdt_chinh: 400,
  toi_da: 409,
  da_co: 409,
  khong_co_ho_so: 409,
  migration_needed: 503,
};

async function docSo(req: Request): Promise<unknown> {
  const body = (await req.json().catch(() => null)) as { sdt?: unknown } | null;
  return body?.sdt;
}

export async function POST(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  const admin = createAdminClient();
  if (!admin) return loi(503, "not_configured");

  const so = chuanSoKhac(await docSo(req), who.phone);
  if (!so.ok) return loi(400, so.code);

  const { error } = await admin.from("sdt_khac").insert({ phone: who.phone, sdt: so.sdt, nguon: "khach" });
  if (error) {
    const code = maLoiGhi(error);
    // gửi lại đúng số đã gửi ⇒ coi như xong (bấm hai lần khi sóng yếu), không báo lỗi
    if (code === "da_co") return NextResponse.json({ ok: true, sdt: so.sdt, daGui: true });
    if (code === "loi") console.error("[me/sdt-khac] ghi hỏng:", error.message);
    return loi(TRANG[code] ?? 500, code);
  }

  // Báo nhân viên — hỏng thì dòng chờ vẫn nằm ở /quan-tri, không làm bà con gửi lại.
  if (isAssetSyncConfigured()) {
    const { data: cust } = await admin.from("customers").select("name").eq("phone", who.phone).maybeSingle();
    await createConsultationRequest({
      fullName: ((cust?.name as string | null) ?? "Khách SDFish").slice(0, 120),
      phone: who.phone,
      message: `Xin gắn số ${so.sdt} (số mua hàng / số máy giám sát hành trình) vào tài khoản ${who.phone}. Nhân viên gọi xác nhận rồi duyệt ở /quan-tri → Tài khoản → Số khác.`,
    }).catch(() => false);
  }
  return NextResponse.json({ ok: true, sdt: so.sdt });
}

export async function DELETE(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  const admin = createAdminClient();
  if (!admin) return loi(503, "not_configured");

  const so = chuanSoKhac(await docSo(req), who.phone);
  if (!so.ok) return loi(400, so.code);

  const { error } = await admin
    .from("sdt_khac")
    .delete()
    .eq("phone", who.phone)
    .eq("sdt", so.sdt)
    .is("duyet_luc", null);
  if (error) {
    const code = maLoiGhi(error);
    return loi(TRANG[code] ?? 500, code);
  }
  return NextResponse.json({ ok: true });
}
