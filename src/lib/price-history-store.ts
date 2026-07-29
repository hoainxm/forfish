import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  rowsToWeeks,
  weeksToRows,
  type PriceRow,
  type WeekPrice,
} from "@/lib/port-price-history";

/*
  KHO LỊCH SỬ GIÁ tích luỹ trên Supabase (bảng `price_history`, migration 0016).

  Vì sao: kho bản tin VASEP chỉ giữ ~13 tuần gần nhất. Để biểu đồ giá dài dần
  theo thời gian, cron (/api/cron/snapshot-prices) UPSERT các tuần VASEP vào
  bảng này (idempotent theo khoá (week_end, species_id)); tuần cũ rơi khỏi
  listing VASEP vẫn còn ở DB → lịch sử chỉ dài thêm.

  GHI qua service-role (bypass RLS). ĐỌC qua REST + next.revalidate (giữ ISR).
  Chưa cấu hình env / chưa apply migration → mọi hàm degrade êm (rỗng / không
  ghi) và route lùi về gom kho VASEP trực tiếp = hành vi trước khi có DB.
*/

const TABLE = "price_history";
const READ_REVALIDATE = 21600; // 6h — bản tin ra mỗi tuần, đọc lại thưa cũng đủ

/** ĐỌC toàn bộ lịch sử tích luỹ. Rỗng khi chưa cấu hình / lỗi / bảng trống. */
export async function loadHistoryFromDb(): Promise<WeekPrice[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  try {
    const r = await fetch(
      `${url}/rest/v1/${TABLE}?select=week_end,species_id,min_vnd,max_vnd,province&order=week_end.asc`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        next: { revalidate: READ_REVALIDATE },
      },
    );
    if (!r.ok) return [];
    const rows = (await r.json()) as PriceRow[];
    return Array.isArray(rows) ? rowsToWeeks(rows) : [];
  } catch {
    return [];
  }
}

/** UPSERT các tuần vào DB (service-role). Trả số DÒNG đã ghi; 0 nếu chưa cấu hình. */
export async function saveWeeksToDb(
  weeks: WeekPrice[],
): Promise<{ saved: number; reason: string }> {
  const admin = createAdminClient();
  if (!admin) return { saved: 0, reason: "no-admin-client" };
  const rows = weeksToRows(weeks);
  if (rows.length === 0) return { saved: 0, reason: "no-rows" };
  const { error } = await admin
    .from(TABLE)
    .upsert(rows, { onConflict: "week_end,species_id" });
  return { saved: error ? 0 : rows.length, reason: error ? error.message : "ok" };
}
