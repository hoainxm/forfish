import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { fishModelSignature, type FishForecastResult } from "@/lib/fish-predict";
import {
  shouldReplaceSnapshot,
  snapshotRowId,
  SNAPSHOT_REVALIDATE,
} from "@/lib/fish-snapshot-policy";
import sstClimo from "@/data/sst-climatology.v1.json";
import reefGridJson from "@/data/reef-grid-025.v1.json";

/*
  SNAPSHOT DỰ BÁO CÁ — precompute lưu trên Supabase (2026-07-26).

  Vì sao: /api/fish-forecast tính TẠI CHỖ kéo 7 nguồn (ERDDAP + HYCOM OPeNDAP +
  Copernicus Zarr), nguồn nặng + hay treo → lần tính lạnh chậm/hỏng ("dự báo cá
  chưa tải được"). Nay CRON (/api/cron/refresh-fish) tính sẵn theo lịch rồi ghi
  1 dòng CỦA MÔ HÌNH ĐANG CHẠY (`fishSnapshotRowId`, xem dưới); route chỉ ĐỌC
  dòng đó (nhanh, không phụ thuộc nguồn treo), thiếu thì tự tính rồi lưu.

  Bảng `fish_forecast_snapshot` (migration 0005): đọc/ghi CHỈ qua service-role
  (RLS bật, không policy). Chưa apply migration / chưa cấu hình env → mọi hàm
  degrade êm (null / không ghi) và route tự tính fallback = hành vi cũ.
*/

const TABLE = "fish_forecast_snapshot";

/*
  MỖI MÔ HÌNH MỘT HÀNG (2026-10-05). Trước đây 1 hàng `latest` dùng chung cho
  MỌI bản deploy cùng trỏ một Supabase — bản Vercel cũ (code 30/9) chạy cron
  02:00 UTC ghi đè số do mô hình CŨ tính, prod đọc lại ⇒ ngừ ồ mất khỏi bản đồ
  và bộ lọc loài. Nay id hàng = `latest:<dấu vân tay mô hình>`: băm chữ ký mô
  hình (hồ sơ loài · lịch mùa · hằng số chấm điểm · phiên bản công thức — xem
  `fishModelSignature`) + file khí hậu SST + mã nguồn lưới rạn. Bản nào chỉ
  đọc/ghi hàng của ĐÚNG mô hình mình; bản cũ (chưa biết vân tay) vẫn ghi hàng
  `latest`, vô hại. Hàng chưa có ⇒ route tự tính live rồi lưu vào hàng mới.
  Không cần migration: cột `id` là text (0008), không ràng buộc giá trị.
*/
let rowIdMemo: string | null = null;
export function fishSnapshotRowId(): string {
  if (rowIdMemo) return rowIdMemo;
  const h = createHash("sha256");
  h.update(fishModelSignature());
  h.update(JSON.stringify(sstClimo.regions)); // dải nhiệt lai theo vùng–tháng
  h.update(String((reefGridJson as { sourceHash?: string }).sourceHash ?? "")); // lưới rạn
  rowIdMemo = snapshotRowId(h.digest("hex").slice(0, 12));
  return rowIdMemo;
}

/**
 * GHI snapshot mới (service-role, bypass RLS). Chỉ ghi khi bản mới TỐT NGANG
 * hoặc HƠN bản đang có (`shouldReplaceSnapshot`). Trả `{saved, reason}` để cron
 * nói thật.
 */
export async function saveFishSnapshot(
  payload: FishForecastResult,
): Promise<{ saved: boolean; reason: string }> {
  const admin = createAdminClient();
  if (!admin) return { saved: false, reason: "no-admin-client" };
  if (payload.ok !== true) return { saved: false, reason: "payload-not-ok" };
  const rowId = fishSnapshotRowId();

  const { data: cur } = await admin
    .from(TABLE)
    .select("target_date")
    .eq("id", rowId)
    .maybeSingle();

  if (!shouldReplaceSnapshot(cur?.target_date ?? null, payload)) {
    return { saved: false, reason: "not-newer" };
  }

  const { error } = await admin.from(TABLE).upsert({
    id: rowId,
    payload,
    target_date: payload.targetDate ?? null,
    data_quality: payload.dataQuality ?? null,
    generated_at: payload.generatedAt ?? null,
    updated_at: new Date().toISOString(),
  });
  return { saved: !error, reason: error ? error.message : "ok" };
}

/**
 * ĐỌC snapshot đã lưu — fetch REST + `next.revalidate` để route giữ được ISR
 * (30 phút). Trả payload nếu có và `ok`; null khi chưa có / lỗi / chưa cấu hình
 * (caller tự tính fallback → không bao giờ trắng bản đồ).
 */
export async function loadFishSnapshot(): Promise<FishForecastResult | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const r = await fetch(
      `${url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(fishSnapshotRowId())}&select=payload`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        next: { revalidate: SNAPSHOT_REVALIDATE },
      },
    );
    if (!r.ok) return null;
    const rows = (await r.json()) as { payload?: FishForecastResult }[];
    const payload = rows?.[0]?.payload;
    return payload && payload.ok === true ? payload : null;
  } catch {
    return null;
  }
}
