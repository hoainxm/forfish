/* eslint-disable @typescript-eslint/no-explicit-any -- mock Supabase client bắt lời gọi rpc. */
// supabase-store dùng hàm NGUYÊN TỬ 0064 (rà Codex 2026-10-19): huỷ đơn + hoàn kho,
// vá yêu cầu, đồng ý báo giá — mỗi việc MỘT lời gọi rpc, không còn đọc-rồi-ghi
// timeline hay hoàn kho/ghi order_id ở lời gọi thứ hai. Hành vi SQL kiểm thật
// trên Postgres lúc apply (04 mục "GHI NGUYÊN TỬ"); đây gác adapter gọi đúng hàm, đúng tham số.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const rpcs: { fn: string; args: any }[] = [];
  const replies: { error: any; data?: any }[] = [];
  const updates: string[] = [];
  const row = (id: string) => ({
    id, code: "SD1", buyer_phone: "0901000001", shop_id: "s1", items: [], status: "da_huy",
    payment_method: "cod", payment_status: "chua_thanh_toan", timeline: [], address: {}, created_at: "", updated_at: "",
    title: "Lưới", qty: 1, unit: "tấm", images: [],
  });
  const q = (id?: string): any => {
    const b: any = {
      select: () => b, eq: (_c: string, v: string) => ((id = v), b), order: () => b, range: () => b,
      maybeSingle: () => Promise.resolve({ data: row(id ?? "x"), error: null }),
      update: (r: any) => (updates.push(Object.keys(r).join(",")), b),
      insert: () => b, single: () => Promise.resolve({ data: null, error: null }),
    };
    return b;
  };
  const admin = {
    from: () => q(),
    rpc: (fn: string, args: any) => {
      rpcs.push({ fn, args });
      return Promise.resolve(replies.shift() ?? { error: null, data: { order: { id: "o-moi" } } });
    },
  };
  return { rpcs, replies, updates, admin };
});

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.admin }));

import { isMarketError } from "@/lib/market/errors";
import { createSupabaseStore } from "@/lib/market/supabase-store";

const entry = { status: "da_huy", at: "2026-10-19T00:00:00Z", by: "buyer" } as any;

beforeEach(() => {
  h.rpcs.length = 0;
  h.replies.length = 0;
  h.updates.length = 0;
});

describe("supabase-store — ghi nguyên tử qua 0064", () => {
  it("huỷ đơn = MỘT rpc market_transition_order (hoàn kho nằm trong), không update/restock riêng", async () => {
    const s = createSupabaseStore();
    await s.transitionOrder("o1", "cho_xac_nhan", { status: "da_huy", cancelBy: "buyer", cancelReason: "đổi ý", timelineAppend: entry });
    expect(h.rpcs.map((r) => r.fn)).toEqual(["market_transition_order"]);
    expect(h.rpcs[0].args).toEqual({
      p_id: "o1", p_expect: "cho_xac_nhan",
      p_patch: { status: "da_huy", cancel_by: "buyer", cancel_reason: "đổi ý" },
      p_entry: entry,
    });
    expect(h.updates).toEqual([]);
  });

  it("P0001 bad_transition ⇒ MarketError bad_transition (không nuốt thành unavailable)", async () => {
    h.replies.push({ error: { code: "P0001", message: "bad_transition" } });
    const s = createSupabaseStore();
    const e = await s.transitionOrder("o1", "da_giao", { status: "hoan_thanh" }).catch((x) => x);
    expect(isMarketError(e) && e.code).toBe("bad_transition");
  });

  it("vá yêu cầu = MỘT rpc market_patch_request, timeline đi qua p_entry", async () => {
    const s = createSupabaseStore();
    await s.patchRequest("r1", "moi", { status: "khong_tim_duoc", rejectReason: "hết hàng", timelineAppend: entry });
    expect(h.rpcs).toEqual([
      { fn: "market_patch_request", args: { p_id: "r1", p_expect: "moi", p_patch: { status: "khong_tim_duoc", reject_reason: "hết hàng" }, p_entry: entry } },
    ]);
  });

  it("đồng ý báo giá = MỘT rpc market_accept_request; mã đơn trùng ⇒ sinh mã mới gọi lại", async () => {
    h.replies.push({ error: { code: "23505", message: 'duplicate key value violates unique constraint "market_orders_code_key"' } });
    const s = createSupabaseStore();
    const pre = {
      shopId: "s1", lines: [], subtotalVnd: 100, shippingVnd: 0, totalVnd: 100, timeline: [entry],
      etaFrom: "2026-10-20", etaTo: "2026-10-22",
    } as any;
    const r = await s.acceptRequest("r1", { status: "da_dat", timelineAppend: entry }, pre);
    expect(h.rpcs.map((x) => x.fn)).toEqual(["market_accept_request", "market_accept_request"]);
    expect(h.rpcs[0].args.p_order.code).not.toBe(h.rpcs[1].args.p_order.code);
    expect(h.rpcs[1].args.p_order).not.toHaveProperty("buyer_phone"); // lấy từ yêu cầu trong DB
    expect(r.order.id).toBe("o-moi");
    expect(h.updates).toEqual([]);
  });
});
