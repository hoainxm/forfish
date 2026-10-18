import "server-only";
// Dùng chung cho 4 route ghi trên MỘT đơn của người mua (huỷ · đã nhận · báo
// chuyển khoản · đánh giá): mở đơn ĐÚNG CỦA NGƯỜI GỌI rồi trả kèm kho.
// Thư mục `_lib` có gạch dưới ⇒ App Router không coi là route.
//
// Vì sao ở đây chứ không ở `lib/market/` : đó là tập file của Core (12 §10.1) —
// bốn route này của Buyer agent, luật nghiệp vụ vẫn nằm nguyên ở order-state.ts.
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { getMarketStore } from "@/lib/market/store";
import type { MarketStore } from "@/lib/market/store";
import type { Order } from "@/lib/market/types";

export type BuyerOrderGate =
  | { ok: true; phone: string; store: MarketStore; order: Order }
  | { ok: false; res: NextResponse };

/** Đơn không phải của mình ⇒ 404, y như đơn không tồn tại (11 §5.8). */
export async function openMyOrder(req: Request, id: string): Promise<BuyerOrderGate> {
  const who = await identityFromRequest(req);
  if (!who.ok) return { ok: false, res: who.res };
  const store = await getMarketStore();
  const order = await store.getOrder(id);
  if (!order || order.buyerPhone !== who.phone) {
    return { ok: false, res: NextResponse.json({ ok: false, code: "not_found" }, { status: 404 }) };
  }
  return { ok: true, phone: who.phone, store, order };
}
