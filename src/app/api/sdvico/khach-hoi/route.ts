// /api/sdvico/khach-hoi — PHIẾU KHÁCH HỎI SẢN PHẨM SDVICO (14 §3.14, migration 0072; anh Long 2026-10-25: agent trực trên
// SDFish, nhận khách hỏi/đặt, làm rõ SĐT + số tàu + cảng lắp, chuyển nhóm Zalo KD qua AI Assistant).
//
// Phiếu do máy chủ TỰ LẬP khi hội thoại trực đủ số tàu + cảng (/api/kairos/truc, 0073) — SĐT = SĐT tài khoản khách.
// GET   AI Assistant lấy phiếu `moi` (≤50, cũ trước) kèm `tinNhan` soạn sẵn cho Zalo — header `x-sdvico-key`.
import { NextResponse } from "next/server";
import { tinNhanKd } from "@/lib/sdvico/khach-hoi";
import { khoaPhieuSai, type PhieuRow } from "@/lib/sdvico/khach-hoi-server";
import { createAdminClient } from "@/lib/supabase/admin";

const COLS = "id,created_at,nguon,san_pham,ten,phone,so_tau,cang,loi_nhan,kairos_post_id,kairos_comment_id,trang_thai";

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
