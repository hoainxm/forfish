import { fetchCurDepthGrid } from "@/lib/copernicus-cur-depth";
import {
  CUR_DEPTH_TIERS,
  CUR_DEPTH_MAX_DAYS,
  type CurDepthTier,
} from "@/lib/weather-snapshot-id";
import { premiumDenied } from "@/lib/api-identity";

/**
 * DÒNG CHẢY THEO TẦNG — đường LIVE khi snapshot chưa có (client đi snapshot
 * TRƯỚC, route này là nấc sau). Server fetch Copernicus phy-cur P1D (chunk đã
 * cache 6h qua next fetch) rồi trả lưới NGÀY 156 điểm.
 *
 * PREMIUM: >3 ngày chặn thật (cùng luật /api/weather-snapshot — thời tiết >3
 * ngày là hàng premium). Demo mode (chưa cấu hình Supabase) → mở.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/*  Chốt premium dời sang `lib/api-identity.ts` (2026-08-02) — một bản dùng chung
    với /api/weather-snapshot, và nhận diện bằng CHUỖI CỨNG thay vì phiên Supabase
    (máy ngư dân không còn giữ phiên nào). Bản chép tay ở đây đã xoá. */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tier = Number(url.searchParams.get("tier"));
  const days = Number(url.searchParams.get("days") ?? CUR_DEPTH_MAX_DAYS);
  if (!CUR_DEPTH_TIERS.includes(tier as CurDepthTier)) {
    return Response.json({ ok: false, code: "bad_tier" }, { status: 400 });
  }
  /*  KHUNG NGÀY ĐƯỢC NHẬN — phải phủ HẾT `CUR_DEPTH_FALLBACK_DAYS` ở
      `lib/cur-depth.ts` và mọi nấc `pretrip` thật sự tải. Có cổng khoá ba chỗ
      này lại (`forecast-store.test.ts`): thiếu một nấc là mẻ tải sẵn ăn 400
      `bad_days` ở chặng lùi, rồi giữa biển dòng chảy tầng hết bản để mượn. */
  if (![3, CUR_DEPTH_MAX_DAYS].includes(days)) {
    return Response.json({ ok: false, code: "bad_days" }, { status: 400 });
  }
  if (days > 3) {
    const denied = await premiumDenied(req);
    if (denied) {
      return Response.json(
        { ok: false, code: denied.code },
        { status: denied.status },
      );
    }
  }

  const grid = await fetchCurDepthGrid(tier, days);
  if (!grid) {
    return Response.json({ ok: false, code: "source_down" }, { status: 503 });
  }
  return Response.json(
    { ok: true, savedAt: Date.now(), ...grid },
    {
      headers: {
        // nguồn theo NGÀY — cache tư nhân 1h là đủ; khung premium không để CDN chung
        "Cache-Control": days > 3 ? "private, max-age=3600" : "public, s-maxage=3600",
      },
    },
  );
}
