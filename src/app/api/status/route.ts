import { LOCAL_BUILD_DATE, LOCAL_BUILD_ID } from "@/lib/app-version";
import { buildStatus } from "@/lib/status-report";
import { createAdminClient } from "@/lib/supabase/admin";
import { timeoutSignal } from "@/lib/abort";
import { getCronSecret } from "@/lib/app-config";

/**
 * TRẠNG THÁI BẢN ĐANG CHẠY + ĐỘ TƯƠI DỮ LIỆU (lib/status-report.ts). Công khai như
 * /api/version: chỉ mã bản, ngày fit tham số mô hình và TUỔI các bản tính sẵn — KHÔNG
 * trả nội dung dự báo nào (không phải route dữ liệu, ngoài dataGate; xem
 * data-route-rules.test). GÁC (2026-11-08, khong-lo-nguon nợ #14): khối `model` (ngày fit tham số) CHỈ trả khi
 * kèm `Authorization: Bearer <CRON_SECRET>` (smoke / người vận hành) — công khai chỉ còn mã bản + độ tươi.
 * DB lỗi/thiếu env ⇒ vẫn 200 với duLieu "khong-doc-duoc"
 * (đây là trang để HỎI tình trạng — tự nó không được sập theo DB). Không cache.
 */
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 5000;

async function moiNhat(table: string, idLike: string | null): Promise<{ at: string | null; ok: boolean }> {
  const admin = createAdminClient();
  if (!admin) return { at: null, ok: false };
  try {
    let q = admin.from(table).select("updated_at").order("updated_at", { ascending: false }).limit(1);
    if (idLike) q = q.like("id", idLike);
    const sig = timeoutSignal(TIMEOUT_MS);
    const { data, error } = await (sig ? q.abortSignal(sig) : q);
    if (error) return { at: null, ok: false };
    return { at: (data?.[0] as { updated_at?: string } | undefined)?.updated_at ?? null, ok: true };
  } catch {
    return { at: null, ok: false };
  }
}

export async function GET(req: Request) {
  const secret = await getCronSecret().catch(() => null);
  const noiBo = !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
  const [fish, weather] = await Promise.all([
    moiNhat("fish_forecast_snapshot", null),
    moiNhat("weather_snapshot", "grid:%"),
  ]);
  const body = buildStatus({
    build: LOCAL_BUILD_ID,
    builtOn: LOCAL_BUILD_DATE,
    // ngày fit đọc LÚC BUILD trong next.config.ts — KHÔNG import JSON tham số (cổng model-params.test)
    fishBlendFittedAt: process.env.SDFISH_MODEL_BLEND_AT || null,
    forecastSkillFittedAt: process.env.SDFISH_MODEL_SKILL_AT || null,
    fishSnapshotAt: fish.at,
    weatherSnapshotAt: weather.at,
    dbOk: fish.ok && weather.ok,
    nowMs: Date.now(),
  });
  const congKhai: Partial<typeof body> = { ...body };
  delete congKhai.model;
  return Response.json(noiBo ? body : congKhai, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
