// GET /api/admin/sdvico-khach-hoi?status=moi|da_bao|all — ADMIN xem phiếu khách hỏi / đăng ký khuyến mãi SDVICO (0072)
// để đối chiếu với tin Zalo đã nhắn Quân (2026-10-26). Chỉ đọc; đổi trạng thái là việc của AI Assistant (da-bao).
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin-auth";
import { khuyenMaiCuaPhieu } from "@/data/khuyen-mai";
import type { PhieuRow } from "@/lib/sdvico/khach-hoi-server";
import { createAdminClient } from "@/lib/supabase/admin";

const err = (status: number, code: string) => NextResponse.json({ ok: false, code }, { status });
const COLS = "id,created_at,nguon,san_pham,ten,phone,so_tau,cang,loi_nhan,kairos_post_id,kairos_comment_id,trang_thai,bao_luc";

export async function GET(req: Request) {
  const who = await requirePermission("yeu-cau", "view");
  if (!who.ok) return err(who.status, who.code);
  const db = createAdminClient();
  if (!db) return err(503, "not_configured");
  const st = new URL(req.url).searchParams.get("status") ?? "all";
  let q = db.from("sdvico_khach_hoi").select(COLS).order("created_at", { ascending: false }).limit(300);
  if (st === "moi" || st === "da_bao") q = q.eq("trang_thai", st);
  const { data, error } = await q;
  if (error) return err(500, "query_failed");
  const phieu = ((data ?? []) as (PhieuRow & { bao_luc: string | null })[]).map((r) => ({ ...r, khuyenMai: khuyenMaiCuaPhieu(r.san_pham)?.ten ?? null }));
  return NextResponse.json({ ok: true, phieu });
}
