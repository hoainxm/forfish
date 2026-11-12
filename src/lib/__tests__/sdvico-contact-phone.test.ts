/* eslint-disable @typescript-eslint/no-explicit-any -- mock CRM bắt-lời-gọi */
import { describe, it, expect, vi, beforeEach } from "vitest";

/*  G13 (ba-spec 19): /api/sdvico/order + /api/sdvico/request.
    Đã đăng nhập ⇒ SĐT gửi sang SDWork LUÔN là SĐT của phiên, bỏ qua body.phone.
    Khách vãng lai ⇒ số tự gõ. Mã chống trùng của đơn phải đúng dạng máy sinh. */

vi.mock("server-only", () => ({}));
const h = vi.hoisted(() => ({
  sessionPhone: "",
  orders: [] as any[],
  requests: [] as any[],
}));
vi.mock("@/lib/api-identity", () => ({
  identityFromRequest: async () => ({ ok: true, phone: h.sessionPhone, legacy: false }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { name: "Chủ tàu A" } }) };
      return q;
    },
  }),
}));
vi.mock("@/lib/sdwork-order", async (orig) => ({
  ...(await orig<typeof import("@/lib/sdwork-order")>()),
  isOrderConfigured: () => true,
  createSdfishOrder: async (input: any) => {
    h.orders.push(input);
    return { ok: true, displayRef: "SDF-000001", status: "pending" };
  },
}));
vi.mock("@/lib/sdwork-assets", () => ({
  isAssetSyncConfigured: () => true,
  createConsultationRequest: async (input: any) => {
    h.requests.push(input);
    return true;
  },
}));

import { POST as ORDER } from "@/app/api/sdvico/order/route";
import { POST as REQUEST } from "@/app/api/sdvico/request/route";
import { contactPhone } from "@/lib/phone";
import { isValidOrderRef } from "@/lib/sdwork-order";

const REF = "sdf-3f2b8c1e-9a4d-4c7e-8b21-5d6f7a8b9c0d";
const post = (body: unknown) =>
  new Request("http://x/api", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  h.sessionPhone = "";
  h.orders = [];
  h.requests = [];
});

describe("contactPhone", () => {
  it("phiên thắng số gõ", () => expect(contactPhone("0901234567", "0912345678")).toBe("0901234567"));
  it("không phiên ⇒ số gõ", () => expect(contactPhone("", " 0912345678 ")).toBe("0912345678"));
  it("không có gì ⇒ rỗng", () => expect(contactPhone(null, undefined)).toBe(""));
});

describe("isValidOrderRef", () => {
  it("nhận sdf-UUID", () => expect(isValidOrderRef(REF)).toBe(true));
  it("nhận dạng dự phòng máy cũ", () => expect(isValidOrderRef("sdf-1762934400000-k3j9x2m1qa")).toBe(true));
  it.each(["DH75768", "sdf-1", "abc", "sdf-" + "a".repeat(77), "sdf-<script>aaaaaaaaaaaaaaaaaa"])(
    "chối %s",
    (ref) => expect(isValidOrderRef(ref)).toBe(false),
  );
});

describe("POST /api/sdvico/order", () => {
  it("đã đăng nhập: body.phone của người khác bị bỏ qua", async () => {
    h.sessionPhone = "0901234567";
    const res = await ORDER(post({ externalRef: REF, phone: "0912345678", productName: "Máy dò" }));
    expect(res.status).toBe(200);
    expect(h.orders).toHaveLength(1);
    expect(h.orders[0].phone).toBe("0901234567");
  });

  it("khách vãng lai: dùng số tự gõ", async () => {
    const res = await ORDER(post({ externalRef: REF, phone: "0912345678", productName: "Máy dò" }));
    expect(res.status).toBe(200);
    expect(h.orders[0].phone).toBe("0912345678");
  });

  it("mã đơn sai dạng ⇒ 400 bad_ref, không gọi CRM", async () => {
    h.sessionPhone = "0901234567";
    const res = await ORDER(post({ externalRef: "DH75768", productName: "Máy dò" }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("bad_ref");
    expect(h.orders).toHaveLength(0);
  });

  it("thiếu mã ⇒ 400 missing_ref", async () => {
    const res = await ORDER(post({ phone: "0912345678", productName: "Máy dò" }));
    expect((await res.json()).code).toBe("missing_ref");
    expect(h.orders).toHaveLength(0);
  });
});

describe("POST /api/sdvico/request", () => {
  it("đã đăng nhập: body.phone của người khác bị bỏ qua", async () => {
    h.sessionPhone = "0901234567";
    const res = await REQUEST(post({ topic: "sua", phone: "0912345678", detail: "hỏng máy" }));
    expect(res.status).toBe(200);
    expect(h.requests).toHaveLength(1);
    expect(h.requests[0].phone).toBe("0901234567");
  });

  it("khách vãng lai: dùng số tự gõ", async () => {
    const res = await REQUEST(post({ topic: "sua", phone: "0912345678", detail: "hỏng máy" }));
    expect(res.status).toBe(200);
    expect(h.requests[0].phone).toBe("0912345678");
  });
});
