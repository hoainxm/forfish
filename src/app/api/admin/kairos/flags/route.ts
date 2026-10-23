// GET /api/admin/kairos/flags — CỜ CHỦ QUYỀN: bài báo máy thu/máy chủ loại vì xuyên tạc chủ
// quyền (South China Sea, Tây Sa…) kèm cụm trúng — CHỈ XEM (14 §3.11, §5, AC16/AC18).
// Kèm SỨC KHOẺ MÁY THU TIN: giờ bài báo mới nhất vào kho (tab nhắc khi im quá 2 giờ — máy GPU
// tắt / hết hạn mức / khoá lệch) + trạng thái từng nguồn RSS (lần đọc được gần nhất, lỗi).
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin-auth";
import { kErr, kairosErrorResponse, storeOr503 } from "@/lib/kairos/server";

export async function GET() {
  const who = await requirePermission("kairos", "view");
  if (!who.ok) return kErr(who.status, who.code);
  const s = await storeOr503();
  if (!s.ok) return s.res;
  try {
    const [rows, news] = await Promise.all([s.store.sovereigntyFlags(100), s.store.newsStatus()]);
    return NextResponse.json({
      ok: true,
      items: rows.map((r) => ({ sourceId: r.source_id, titleNorm: r.title_norm, term: r.flag_term, at: r.first_seen_at ?? null })),
      lastBaoAt: news.lastBaoAt,
      sources: news.sources.map((x) => ({
        id: x.id, outlet: x.outlet, section: x.section, enabled: x.enabled !== false,
        lastOkAt: x.last_ok_at ?? null, lastError: x.last_error ?? null,
      })),
    });
  } catch (e) {
    return kairosErrorResponse(e);
  }
}
