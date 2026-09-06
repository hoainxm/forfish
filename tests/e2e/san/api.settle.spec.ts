import { expect, test } from "@playwright/test";
import type { Order } from "@/lib/market/types";
import { PERSONA, SEED, devLogin, get, listBuyerOrders } from "./helpers";

// TỰ HOÀN THÀNH LƯỜI KHI ĐỌC (`settleOverdue`, LEAD §4 #3) — AC-38b/AC-38c.
// Đơn seed `SD260825H8ZN` đã giao 9 ngày trước ⇒ LƯỢT ĐỌC ĐẦU TIÊN của bất kỳ
// ai phải thấy nó `hoan_thanh`, `by=system`, `completedAt = deliveredAt + 7 ngày`,
// và KHÔNG có thông báo nào được gửi (không phải tin mới với ai).
test.describe("Chợ — tự hoàn thành sau 7 ngày (API)", () => {
  let ba = "";
  let admin = "";

  test.beforeAll(async ({ request }) => {
    ba = await devLogin(request, PERSONA.buyerBa);
    admin = await devLogin(request, PERSONA.admin);
  });

  test("AC-38c đơn đã giao 9 ngày ⇒ đọc là thấy hoan_thanh (by=system), DB đã ghi", async ({ request }) => {
    const list = await listBuyerOrders(request, ba, { pageSize: 50 });
    expect(list.status, JSON.stringify(list.body)).toBe(200);
    const o = list.body.items.find((x) => x.code === SEED.orderDaGiao9Ngay);
    expect(o, `đơn seed ${SEED.orderDaGiao9Ngay}`).toBeTruthy();
    expect(o!.status, "quá 7 ngày ⇒ hoàn thành ngay lượt đọc").toBe("hoan_thanh");

    // AC-38b — mốc hoàn thành là deliveredAt + 7 ngày, KHÔNG phải giờ đọc
    const delivered = Date.parse(o!.deliveredAt ?? "");
    const completed = Date.parse(o!.completedAt ?? "");
    expect(Number.isFinite(delivered) && Number.isFinite(completed)).toBe(true);
    expect(completed - delivered, "completedAt = deliveredAt + 7 ngày").toBe(7 * 24 * 3600 * 1000);
    const last = o!.timeline.find((t) => t.status === "hoan_thanh");
    expect(last?.by, "hệ thống tự làm ⇒ by = system").toBe("system");
    expect(o!.paymentStatus, "đơn COD hoàn thành ⇒ đã thanh toán").toBe("da_thanh_toan");

    // đã GHI thật: đọc lại một mình đơn đó cũng thấy hoàn thành
    const lai = await get<{ order: Order }>(request, `/api/cho/don/${o!.id}`, ba);
    expect(lai.status).toBe(200);
    expect(lai.body.order.status).toBe("hoan_thanh");

    // và route admin cũng thấy cùng trạng thái
    const ad = await get<{ items: Order[] }>(request, `/api/admin/cho/don?code=${SEED.orderDaGiao9Ngay}`, admin);
    expect(ad.status).toBe(200);
    expect(ad.body.items.find((x) => x.code === SEED.orderDaGiao9Ngay)?.status).toBe("hoan_thanh");
  });

  test("Đơn đã giao 2 ngày KHÔNG bị tự hoàn thành", async ({ request }) => {
    const list = await listBuyerOrders(request, ba, { pageSize: 50 });
    const o = list.body.items.find((x) => x.code === SEED.orderDaGiao2Ngay);
    // ca admin ở api.admin.spec.ts có thể đã huỷ đơn khác, đơn này giữ nguyên
    expect(o, `đơn seed ${SEED.orderDaGiao2Ngay}`).toBeTruthy();
    expect(["da_giao", "hoan_thanh"]).toContain(o!.status);
    expect(o!.status, "chưa tới 7 ngày ⇒ vẫn chờ người mua bấm Đã nhận").toBe("da_giao");
  });

  test("T4' KHÔNG gửi thông báo cho ai", async ({ request }) => {
    const res = await get<{ items: { title: string; body: string }[] }>(
      request, `/api/dev/notifications?phone=${PERSONA.buyerBa}`, admin,
    );
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const tin = res.body.items.filter((n) => `${n.title} ${n.body}`.includes(SEED.orderDaGiao9Ngay));
    expect(tin.length, "tự hoàn thành không phải tin mới với ai").toBe(0);
  });
});
