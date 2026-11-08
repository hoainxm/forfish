// /api/admin/he-thong — CHẨN ĐOÁN + CHỮ TRỢ GIÚP cho tab Hệ thống của /quan-tri (admin only, 2026-11-08).
//
// Vì sao có (docs/app-map/ops/khong-lo-nguon.md nợ #2, #10): chunk JS của /quan-tri là file tĩnh, AI CŨNG TẢI ĐƯỢC
// không cần quyền. Nên (a) lý lịch nguồn của bản đồ cá (`sources`, `dataQuality`, `chain`) không còn đi qua
// `/api/fish-forecast` (route bà con) mà chỉ qua đây; (b) tên nguồn / hệ thống tích hợp trong nhãn quản trị
// nằm ở `admin-nhan-server.ts`, chỉ trả cho người đã qua `requireAdmin`.
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { loadFishSnapshot } from "@/lib/fish-snapshot";
import { NHAN_QUAN_TRI } from "@/lib/admin-nhan-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const who = await requireAdmin();
  if (!who.ok) {
    return NextResponse.json({ ok: false, code: who.code }, { status: who.status });
  }
  let fish: {
    sources: { key: string; id: string; date: string; stale: boolean }[];
    dataQuality: number | null;
    dateSkewDays: number | null;
    baseMode: string | null;
  } | null = null;
  try {
    const snap = await loadFishSnapshot();
    if (snap && snap.ok) {
      fish = {
        sources: Object.entries(snap.sources ?? {}).map(([key, s]) => ({
          key,
          id: String((s as { id?: unknown }).id ?? "?"),
          date: String((s as { date?: unknown }).date ?? "?"),
          stale: Boolean((s as { stale?: unknown }).stale),
        })),
        dataQuality: snap.dataQuality ?? null,
        dateSkewDays: snap.dateSkewDays ?? null,
        baseMode: snap.baseMode ?? null,
      };
    }
  } catch (e) {
    console.error("[admin/he-thong] đọc snapshot cá hỏng:", e);
  }
  return NextResponse.json({ ok: true, fish, nhan: NHAN_QUAN_TRI });
}
