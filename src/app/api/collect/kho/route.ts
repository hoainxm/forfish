// /api/collect/kho — MÁY GPU SAO KHO `forecast-archive` VỀ LÀM BẢN DỰ PHÒNG (2026-11-04, anh Long: lưu ở server cho
// user, "lưu ở gpu cho back up"). Kho chỉ có MỘT bản trên Supabase Storage; mất project/bucket là mất trắng chuỗi
// ngày đã lưu — thứ không bao giờ tải lại được (dự báo của hôm qua chỉ có hôm qua).
// Cửa: `Authorization: Bearer <cron_secret>`. Không trả dữ liệu cho app.
//  · GET ?tu=YYYY-MM-DD&den=YYYY-MM-DD ⇒ { ok, muc: [{ path, bytes, capNhat }] } (≤ 62 ngày mỗi lượt)
//  · GET ?file=<path> ⇒ { ok, url } — URL ký 10 phút, GPU tải THẲNG từ Supabase (byte không đi qua IIS)
import { getCronSecret } from "@/lib/app-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { ARCHIVE_BUCKET } from "@/lib/forecast-archive";
import { MOI_LOAI, lietKeKho } from "@/lib/kho-liet-ke";
import { dayNgay, laDuongKho } from "@/lib/nguon-ngay";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = await getCronSecret();
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return Response.json({ ok: false, code: "unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return Response.json({ ok: false, code: "not_configured" }, { status: 503 });
  const u = new URL(req.url);
  const file = u.searchParams.get("file");
  if (file !== null) {
    if (!laDuongKho(file)) return Response.json({ ok: false, code: "bad_path" }, { status: 400 });
    const { data, error } = await admin.storage.from(ARCHIVE_BUCKET).createSignedUrl(file, 600);
    if (error || !data?.signedUrl) return Response.json({ ok: false, code: "sign_failed", note: error?.message }, { status: 503 });
    return Response.json({ ok: true, url: data.signedUrl });
  }
  const ngay = dayNgay(u.searchParams.get("tu") ?? "", u.searchParams.get("den") ?? "");
  if (!ngay) return Response.json({ ok: false, code: "bad_range" }, { status: 400 });
  try {
    return Response.json({ ok: true, muc: await lietKeKho(admin, MOI_LOAI, ngay) });
  } catch (e) {
    return Response.json({ ok: false, code: "list_failed", note: (e as Error).message }, { status: 503 });
  }
}
