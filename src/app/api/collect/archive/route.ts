// LƯU TRỮ THEO NGÀY (2026-10-10, chủ dự án: "lưu đầy đủ đi, để phục vụ cho tối ưu sau này").
// Chép MỌI hàng weather_snapshot (lưới gió/sóng, mây/mưa/nhiệt/dông/áp suất, dòng chảy theo
// tầng, độ mặn, nước dâng) và MỌI hàng fish_forecast_snapshot (bản đồ cá đủ ô, đủ loài) vào
// kho Storage `forecast-archive` theo ngày giờ VN — hai bảng đó ghi đè mỗi ngày. Lưới ĐẦU VÀO
// mô hình cá do /api/cron/refresh-fish tự lưu (chỉ nó có trong tay).
//
// Lịch: SAU refresh-fish (02:00 UTC) và refresh-weather (02:30 UTC) để chép bản mới nhất.
// Chạy lại trong ngày = ghi đè cùng file. Không ném: phần nào hỏng ghi vào `parts`.
// Bảo vệ bằng CRON_SECRET như mọi cron (route không trả dữ liệu cho app).
import { NextResponse } from "next/server";
import { getCronSecret } from "@/lib/app-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { vnToday } from "@/lib/sea-history";
import { ARCHIVE_CONCURRENCY, archivePath, mapPool, putArchive, summarizePuts } from "@/lib/forecast-archive";

export const maxDuration = 300; // lưới d16 vài MB/hàng, ~50 hàng
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = (await getCronSecret()) ?? "";
  if (!secret) return NextResponse.json({ ok: false, code: "not_configured" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false, code: "not_configured" }, { status: 503 });

  const day = vnToday(new Date());
  const parts: Record<string, ReturnType<typeof summarizePuts>> = {};

  // Mỗi hàng select riêng (không select * cả bảng một lần — hàng d16 nặng), nhưng chạy
  // SONG SONG theo nhóm ARCHIVE_CONCURRENCY: đo prod 2026-10-10, ghi TUẦN TỰ 57 file mất
  // 5 phút 13 giây (~5 s/file IIS → Supabase) ⇒ IIS/ARR cắt ở ~5 phút, cron-prod nhận 502.
  for (const [kind, table] of [
    ["weather", "weather_snapshot"],
    ["fish", "fish_forecast_snapshot"],
  ] as const) {
    const { data: ids, error } = await admin.from(table).select("id");
    if (error || !ids) {
      parts[kind] = { ok: false, files: 0, bytes: 0, failed: 1, note: error?.message ?? "không đọc được danh sách" };
      continue;
    }
    const puts = await mapPool(ids as { id: string }[], ARCHIVE_CONCURRENCY, async ({ id }) => {
      const { data: row, error: e } = await admin.from(table).select("*").eq("id", id).maybeSingle();
      return e || !row
        ? { path: `${kind}/${id}`, ok: false, bytes: 0, error: e?.message ?? "mất hàng" }
        : await putArchive(admin, archivePath(kind, day, id), row);
    });
    parts[kind] = summarizePuts(puts);
  }

  return NextResponse.json({ ok: Object.values(parts).some((p) => p.ok), day, parts });
}
