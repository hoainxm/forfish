// GET /api/admin/cho/danh-gia — đánh giá cho admin, kể cả bản đã ẩn (12 §7.3).
//
// HAI CÁCH DÙNG:
//   ?productId=…  — đánh giá của MỘT món (admin mở chi tiết món)
//   (bỏ trống)    — HÀNG ĐỢI CẢ SÀN, mới nhất trước (2026-09-07)
//
// Vì sao mở bản cả sàn: trước đây `productId` là BẮT BUỘC, nên nhân viên muốn
// soát một đánh giá bậy phải đoán đúng món rồi mở từng thẻ. Với sàn vài trăm
// món đó là việc không làm được — luật "admin ẩn đánh giá vi phạm" (11 §7) coi
// như có trên giấy mà không có đường đi.
//
// ?sao=2 — chỉ lấy đánh giá ≤ 2 sao, chỗ lời lẽ nặng thường nằm.
import { NextResponse } from "next/server";
import { MarketError } from "@/lib/market/errors";
import { marketErrorResponse } from "@/lib/market/route-utils";
import { getMarketStore } from "@/lib/market/store";
import { pageParam, requireMarketAdmin } from "../_guard";

export async function GET(req: Request) {
  const who = await requireMarketAdmin();
  if (!who.ok) return who.res;
  try {
    const sp = new URL(req.url).searchParams;
    const productId = sp.get("productId")?.trim() || undefined;

    const rawSao = sp.get("sao")?.trim();
    let maxRating: number | undefined;
    if (rawSao) {
      const n = Number(rawSao);
      if (!Number.isInteger(n) || n < 1 || n > 5) throw new MarketError("invalid", "Lọc sao phải là số 1 đến 5.");
      maxRating = n;
    }

    const store = await getMarketStore();
    const page = await store.listReviews({
      ...(productId ? { productId } : {}),
      ...(maxRating != null ? { maxRating } : {}),
      page: pageParam(sp),
      includeHidden: true,
    });
    return NextResponse.json({
      ok: true,
      items: page.items,
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
    });
  } catch (e) {
    return marketErrorResponse(e);
  }
}
