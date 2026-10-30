// GET /api/tau-ais/vet?id= — ĐƯỜNG ĐI 7 NGÀY của MỘT tàu AIS (bảng tau_ais_vet, migration 0076; ghi ở POST …/nhap).
// Gác ở middleware như /api/tau-ais (tài khoản được bật AIS — data-route-rules feature "ais").
// Trả { ok, id, diem: [{ t, lat, lon, kn }] } theo thời gian tăng dần (lib/tau-ais/chuan-hoa gopVet). Chưa có điểm ⇒
// 200 với mảng rỗng (tàu mới vào vùng / mã đổi mỗi bản) — không phải lỗi. Không hỏi được kho ⇒ 503 nói thật.
// CDN giữ 5 phút: điểm mới chỉ thêm mỗi giờ.
import { gopVet, idCoDinh } from "@/lib/tau-ais/chuan-hoa.mjs";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!idCoDinh(id)) return Response.json({ ok: false, code: "bad_id" }, { status: 400 });
  const admin = createAdminClient();
  if (!admin) return Response.json({ ok: false, code: "source_down" }, { status: 503 });
  const { data, error } = await admin.from("tau_ais_vet").select("ngay, diem").eq("tau_id", id).order("ngay");
  if (error) {
    console.error("[tàu AIS] đọc đường đi hỏng:", error.message);
    return Response.json({ ok: false, code: "source_down" }, { status: 503 });
  }
  return Response.json(
    { ok: true, id, diem: gopVet(data) },
    { headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=900" } },
  );
}
