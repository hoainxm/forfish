// /api/sdvico/khach-hoi — PHIẾU KHÁCH HỎI SẢN PHẨM SDVICO (14 §3.14, migration 0072; anh Long 2026-10-25: agent trực trên
// SDFish, nhận khách hỏi/đặt, làm rõ SĐT + số tàu + cảng lắp, chuyển nhóm Zalo KD qua AI Assistant).
//
// POST  bà con gửi phiếu (phiếu riêng mở từ thẻ SDVICO trả lời dưới bình luận, hoặc trang sản phẩm). Chưa đăng nhập vẫn
//       gửi được (khách mới = mối bán hàng). Kiểm ở ranh giới `kiemPhieu`: thiếu SĐT hợp lệ / số tàu / cảng ⇒ 400 kèm mã
//       để form chỉ đúng ô. Trần PHIEU_MOI_SDT_NGAY phiếu / SĐT / 24 giờ ⇒ 429.
// GET   AI Assistant lấy phiếu `moi` (≤50, cũ trước) kèm `tinNhan` soạn sẵn cho Zalo — header `x-sdvico-key`.
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { kiemPhieu, PHIEU_MOI_SDT_NGAY, tinNhanKd } from "@/lib/sdvico/khach-hoi";
import { khoaPhieuSai, type PhieuRow } from "@/lib/sdvico/khach-hoi-server";
import { createAdminClient } from "@/lib/supabase/admin";

const COLS = "id,created_at,nguon,san_pham,ten,phone,so_tau,cang,loi_nhan,kairos_post_id,kairos_comment_id,trang_thai";

export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const v = kiemPhieu(raw);
  if (!v.ok) return NextResponse.json({ ok: false, error: v.code }, { status: 400 });
  const db = createAdminClient();
  if (!db) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  const who = await identityFromRequest(req, true);
  const nguoiGui = who.ok && who.phone ? who.phone : null;
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const { count, error: e1 } = await db
    .from("sdvico_khach_hoi")
    .select("id", { count: "exact", head: true })
    .eq("phone", v.value.phone)
    .gte("created_at", since);
  if (e1) {
    console.error("[sdvico] đếm phiếu hỏng:", e1.message);
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  }
  if ((count ?? 0) >= PHIEU_MOI_SDT_NGAY) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  const p = v.value;
  const { data, error } = await db
    .from("sdvico_khach_hoi")
    .insert({
      nguon: p.nguon, san_pham: p.sanPham, ten: p.ten, phone: p.phone, so_tau: p.soTau, cang: p.cang, loi_nhan: p.loiNhan,
      kairos_post_id: p.kairosPostId, kairos_comment_id: p.kairosCommentId, nguoi_gui: nguoiGui,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[sdvico] ghi phiếu khách hỏng:", error?.message);
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
}

export async function GET(req: Request) {
  const sai = await khoaPhieuSai(req);
  if (sai) return sai;
  const db = createAdminClient();
  if (!db) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  const { data, error } = await db.from("sdvico_khach_hoi").select(COLS).eq("trang_thai", "moi").order("created_at", { ascending: true }).limit(50);
  if (error) {
    console.error("[sdvico] đọc phiếu khách hỏng:", error.message);
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  }
  const goc = new URL(req.url).origin;
  const phieu = ((data ?? []) as PhieuRow[]).map((r) => ({
    ...r,
    tinNhan: tinNhanKd(
      {
        nguon: r.nguon, sanPham: r.san_pham, ten: r.ten, phone: r.phone, soTau: r.so_tau, cang: r.cang, loiNhan: r.loi_nhan,
        kairosPostId: r.kairos_post_id, kairosCommentId: r.kairos_comment_id, createdAt: r.created_at,
      },
      r.kairos_post_id ? `${goc}/kairos/p/${r.kairos_post_id}${r.kairos_comment_id ? `#bl-${r.kairos_comment_id}` : ""}` : null,
    ),
  }));
  return NextResponse.json({ ok: true, phieu });
}
