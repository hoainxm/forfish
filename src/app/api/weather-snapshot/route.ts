import { loadWeatherSnapshot } from "@/lib/weather-snapshot";
import {
  isValidSnapshotId,
  snapshotNeedsPremium,
} from "@/lib/weather-snapshot-id";
import { premiumDenied } from "@/lib/api-identity";

/**
 * ĐỌC snapshot thời tiết (LƯỚI AN TOÀN) — client gọi khi live Open-Meteo lỗi.
 *
 * Khung MIỄN PHÍ (d3) + dự báo theo cảng: PUBLIC — dữ liệu thời tiết không cá
 * nhân, client vốn tải được từ live nên không lộ thêm gì.
 *
 * Khung PREMIUM (>3 ngày, từ 2026-07-29 cron có snapshot d16): CHẶN THẬT ở đây
 * — 401 chưa đăng nhập · 403 chưa premium, cùng luật middleware /api/fish-forecast
 * (admin theo ADMIN_PHONES xem như premium). Demo mode (chưa cấu hình Supabase)
 * → MỞ, khớp triết lý app: thiếu env thì chạy được hết bằng dữ liệu công khai.
 *
 * Whitelist id để không thành proxy đọc bảng tuỳ ý.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/*  Chốt premium dời sang `lib/api-identity.ts` (2026-08-02) — một bản dùng chung
    với /api/currents-depth, và nhận diện bằng CHUỖI CỨNG thay vì phiên Supabase
    (máy ngư dân không còn giữ phiên nào). Bản chép tay ở đây đã xoá. */

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!isValidSnapshotId(id)) {
    return Response.json({ ok: false, code: "bad_id" }, { status: 400 });
  }

  const needsPremium = snapshotNeedsPremium(id);
  if (needsPremium) {
    const denied = await premiumDenied(req);
    if (denied) {
      return Response.json(
        { ok: false, code: denied.code },
        { status: denied.status },
      );
    }
  }

  const { payload, unreachable } = await loadWeatherSnapshot(id);
  /*  KHÔNG HỎI ĐƯỢC ≠ KHÔNG CÓ (2026-08-02, audit lô B).
      404 cố ý KHÔNG nằm trong `isRescuableStatus` của service worker ("404 →
      nói thật"), nên trả 404 lúc hạ tầng chập chờn là tự tay chặn đường cứu:
      máy đang giữ lưới 16 ngày trong kho vẫn nhận 404. 503 thì SW trả lại bản
      trong kho, còn client vẫn có nhánh `!r.ok` như cũ — màn hình không đổi. */
  if (unreachable) {
    return Response.json({ ok: false, code: "source_down" }, { status: 503 });
  }
  if (payload == null) {
    return Response.json({ ok: false, code: "not_found" }, { status: 404 });
  }
  // Khung miễn phí: CDN + SW cache theo id (thời tiết đổi chậm, cron 1 lần/ngày).
  // Khung premium: `private` — không để CDN dùng chung bản đã qua cửa cho người khác.
  return Response.json(payload, {
    headers: {
      "Cache-Control": needsPremium
        ? "private, max-age=1800"
        : "public, s-maxage=1800, stale-while-revalidate=86400",
    },
  });
}
