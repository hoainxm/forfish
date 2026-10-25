// GET/PUT /api/admin/kairos/ads — BÀI TÀI TRỢ của Kairos (14 §20). Xem: kairos:view · Sửa: kairos:create (cùng
// quyền đăng bài Chính thức — preset quản lý KHÔNG có). PUT gửi CẢ danh sách (≤20), kiểm từng dòng ở ranh giới
// (quang-cao.kiemDanhSach) — một dòng sai ⇒ không ghi gì, trả câu nói dòng nào sai. Nhật ký trước, ghi sau.
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin-auth";
import { kiemDanhSach } from "@/lib/kairos/quang-cao";
import { docQuangCao, ghiQuangCao } from "@/lib/kairos/quang-cao-store";
import { clientIp, jsonBody, kErr, storeOr503 } from "@/lib/kairos/server";

export async function GET() {
  const who = await requirePermission("kairos", "view");
  if (!who.ok) return kErr(who.status, who.code);
  try {
    return NextResponse.json({ ok: true, items: await docQuangCao({ tuoi: true }) });
  } catch {
    return kErr(503, "ads_read_failed");
  }
}

export async function PUT(req: Request) {
  const who = await requirePermission("kairos", "create");
  if (!who.ok) return kErr(who.status, who.code);
  const body = (await jsonBody(req)) as { items?: unknown } | null;
  const v = kiemDanhSach(body?.items);
  if (!v.ok) return NextResponse.json({ ok: false, code: "bad_ads", message: v.loi }, { status: 400 });
  const s = await storeOr503();
  if (!s.ok) return s.res;
  try {
    await s.store.audit({
      actor: `staff:${who.phone}`, actor_kind: "staff", action: "admin_ads", target_type: "ads",
      detail: { count: v.value.length, on: v.value.filter((q) => q.bat).length, ids: v.value.map((q) => q.id) }, ip: clientIp(req),
    });
  } catch {
    return kErr(503, "audit_failed");
  }
  if (!(await ghiQuangCao(v.value, `staff:${who.phone}`))) return kErr(503, "ads_write_failed");
  return NextResponse.json({ ok: true, items: v.value });
}
