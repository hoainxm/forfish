// /api/cho/yeu-cau — YÊU CẦU ĐẶT HÀNG của chủ tàu (2026-10-18, "đặt bất kỳ cái gì").
//  GET  : yêu cầu của tôi (hết hạn lười trước khi trả — settleRequests)
//  POST : gửi yêu cầu mới → chủ sàn thấy ở /quan-tri (tab Yêu cầu đặt)
// SĐT LUÔN từ identityFromRequest — không bao giờ từ body (11 R16).
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { vnToday } from "@/lib/market/eta";
import { isRequestStatus } from "@/lib/market/request-state";
import { marketErrorResponse, settleRequests } from "@/lib/market/route-utils";
import { getMarketStore } from "@/lib/market/store";
import type { RequestDraft } from "@/lib/market/types";
import { validateRequestDraft } from "@/lib/market/validate";

/** chống bấm gửi liên tục: tối đa 10 yêu cầu đang chờ một lúc */
const OPEN_MAX = 10;

export async function GET(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  try {
    const u = new URL(req.url);
    const status = u.searchParams.get("status");
    const page = Number(u.searchParams.get("page") ?? "1");
    const store = await getMarketStore();
    const res = await store.listBuyerRequests(who.phone, {
      ...(status && isRequestStatus(status) ? { status } : {}),
      page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
      pageSize: 20,
    });
    const items = await settleRequests(store, res.items, new Date().toISOString());
    return NextResponse.json({ ok: true, items, total: res.total });
  } catch (e) {
    return marketErrorResponse(e);
  }
}

export async function POST(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  const body = (await req.json().catch(() => null)) as RequestDraft | null;
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, code: "bad_body" }, { status: 400 });
  const draft: RequestDraft = {
    title: typeof body.title === "string" ? body.title : "",
    qty: typeof body.qty === "number" ? body.qty : Number(body.qty),
    unit: typeof body.unit === "string" ? body.unit : "",
    description: typeof body.description === "string" ? body.description : undefined,
    images: Array.isArray(body.images) ? body.images : undefined,
    needBy: typeof body.needBy === "string" && body.needBy ? body.needBy : undefined,
    address: body.address,
    paymentMethod: body.paymentMethod,
  };
  const bad = validateRequestDraft(draft, vnToday());
  if (bad) return NextResponse.json({ ok: false, code: "invalid", message: bad }, { status: 400 });
  try {
    const store = await getMarketStore();
    const open = await store.listBuyerRequests(who.phone, { status: "moi", pageSize: 1 });
    if (open.total >= OPEN_MAX)
      return NextResponse.json({ ok: false, code: "invalid", message: "Bà con đang có 10 yêu cầu chờ báo giá — đợi chủ sàn trả lời bớt rồi gửi tiếp." }, { status: 400 });
    const request = await store.createRequest(who.phone, draft);
    return NextResponse.json({ ok: true, request });
  } catch (e) {
    return marketErrorResponse(e);
  }
}
