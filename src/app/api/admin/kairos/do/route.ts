// GET /api/admin/kairos/do?days=7|30|90 — ĐO KAIROS (CDP nội bộ SDVICO, 14 §22). Quyền kairos:view.
// Trả số liệu thô đã kiểm (lib/kairos/do-khach.docDoTho) + tên bài tài trợ để màn ghép. SĐT + tên khách CHỈ trả
// cho quản trị viên (admin) — quản lý thấy số đã che (cheSdt), không tên: quản lý có tầm nhìn "khách của mình",
// danh sách ở đây là toàn bộ khách.
// nợ: quản lý chỉ thấy số đã che cho cả danh sách, nâng khi quản lý cần gọi bán — lọc theo khách mình cấp (scope own).
// 0077 chưa áp ⇒ 503 `not_migrated` (màn nói rõ, không giả số 0).
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin-auth";
import { cheSdt, docDoTho, docKhoang } from "@/lib/kairos/do-khach";
import { docDo } from "@/lib/kairos/phan-phoi-store";
import { docQuangCao } from "@/lib/kairos/quang-cao-store";
import { kErr } from "@/lib/kairos/server";

export async function GET(req: Request) {
  const who = await requirePermission("kairos", "view");
  if (!who.ok) return kErr(who.status, who.code);
  const days = docKhoang(new URL(req.url).searchParams.get("days"));
  let raw: unknown;
  try {
    raw = await docDo(days);
  } catch {
    return kErr(503, "not_migrated");
  }
  const d = docDoTho(raw);
  const xemSdt = who.role === "admin";
  const khach = xemSdt ? d.khach : d.khach.map((k) => ({ ...k, phone: cheSdt(k.phone), name: null }));
  const ads = await docQuangCao().catch(() => []);
  return NextResponse.json({
    ok: true,
    days,
    xemSdt,
    ...d,
    khach,
    tenTaiTro: Object.fromEntries(ads.map((q) => [q.id, `${q.nhaTaiTro} — ${q.tieuDe}`])),
  });
}
