import { gatherArchiveWeeks } from "@/lib/port-price-archive";
import { loadHistoryFromDb } from "@/lib/price-history-store";

/**
 * Lịch sử giá cá THẬT cho biểu đồ (kiểu chứng khoán).
 *
 * Ưu tiên ĐỌC kho tích luỹ trên DB (`price_history`, ghi bởi cron
 * /api/cron/snapshot-prices) — dài dần theo thời gian, không phụ thuộc VASEP
 * còn giữ bản tin cũ hay không. DB chưa có (chưa cấu hình / chưa chạy cron /
 * demo mode) → LÙI về gom kho bản tin VASEP trực tiếp (`gatherArchiveWeeks`).
 *
 * TRUNG THỰC: mỗi điểm là giá VASEP THẬT — KHÔNG nội suy/bịa. <2 điểm hoặc
 * nguồn fail → { ok:false }, sheet báo "chưa có lịch sử".
 */
export const revalidate = 21600; // 6h

export async function GET() {
  try {
    // 1) DB tích luỹ trước
    const fromDb = await loadHistoryFromDb();
    if (fromDb.length >= 2) {
      return Response.json({ ok: true, source: "db", weeks: fromDb });
    }
    // 2) Lùi về gom kho VASEP trực tiếp
    const weeks = await gatherArchiveWeeks();
    if (weeks.length < 2) return Response.json({ ok: false }, { status: 503 });
    return Response.json({ ok: true, source: "vasep", weeks });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
