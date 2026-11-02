/* eslint-disable @typescript-eslint/no-explicit-any -- mock Supabase admin
   client bắt-lời-gọi: row/args/params là payload tuỳ biến của từng bảng/RPC,
   gõ chặt không thêm giá trị cho test mà chỉ làm nhiễu. `any` giới hạn trong
   khung mock của file test này. */
// Integration test cho route /api/sdwork/webhook — CHỨNG MINH luồng thật:
// verify HMAC, upsert đúng bảng, provision (tạo) vs reset (đặt lại) auth user,
// idempotent delete. Mock Supabase admin client để bắt lời gọi.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHmac } from "node:crypto";

const h = vi.hoisted(() => {
  const calls = {
    upserts: [] as { table: string; row: any; opts: any }[],
    deletes: [] as { table: string; col: string; val: string }[],
    createUser: [] as any[],
    updateUserById: [] as { id: string; args: any }[],
    rpc: [] as { fn: string; params: any }[],
    lookups: [] as { table: string; col: string; val: string }[],
    updates: [] as { table: string; patch: any; id: string; isNullCol: string }[],
  };
  const state = {
    createUserError: null as null | { message: string },
    rpcData: "uid-123" as string | null,
    upsertError: null as any,
    /** hàng `customers` đang giữ SĐT (tra khi upsert đụng customers_phone_key) */
    holder: null as null | { id: string; sdwork_ref: string | null },
    /** số hàng UPDATE nhận-về khớp (0 = bị event khác nhận mất giữa chừng) */
    claimRows: 1,
  };
  const admin = {
    from: (table: string) => ({
      upsert: (row: any, opts: any) => {
        calls.upserts.push({ table, row, opts });
        return Promise.resolve({ error: state.upsertError });
      },
      select: () => ({
        eq: (col: string, val: string) => ({
          maybeSingle: () => {
            calls.lookups.push({ table, col, val });
            return Promise.resolve({ data: state.holder, error: null });
          },
        }),
      }),
      update: (patch: any) => ({
        eq: (_col: string, id: string) => ({
          is: (isNullCol: string) => ({
            select: () => {
              calls.updates.push({ table, patch, id, isNullCol });
              return Promise.resolve({
                data: Array.from({ length: state.claimRows }, () => ({ id })),
                error: null,
              });
            },
          }),
        }),
      }),
      delete: () => ({
        eq: (col: string, val: string) => {
          calls.deletes.push({ table, col, val });
          return Promise.resolve({ error: null });
        },
      }),
    }),
    auth: {
      admin: {
        createUser: (args: any) => {
          calls.createUser.push(args);
          return Promise.resolve({ error: state.createUserError });
        },
        updateUserById: (id: string, args: any) => {
          calls.updateUserById.push({ id, args });
          return Promise.resolve({ error: null });
        },
      },
    },
    rpc: (fn: string, params: any) => {
      calls.rpc.push({ fn, params });
      return Promise.resolve({ data: state.rpcData, error: null });
    },
  };
  return { calls, state, admin };
});

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.admin }));
// Vai nhân sự (RBAC 2026-10-02): mặc định KHÔNG ai là staff; test riêng bật lên.
const staff = vi.hoisted(() => ({ phones: new Set<string>(), unavailable: false }));
vi.mock("@/lib/staff-store", () => ({
  isStaffPhone: async (_admin: unknown, phone: string) =>
    staff.unavailable ? null : staff.phones.has(phone),
}));

import { POST } from "@/app/api/sdwork/webhook/route";

const SECRET = "test-secret";

beforeEach(() => {
  process.env.SDWORK_WEBHOOK_SECRET = SECRET;
  h.calls.upserts.length = 0;
  h.calls.deletes.length = 0;
  h.calls.createUser.length = 0;
  h.calls.updateUserById.length = 0;
  h.calls.rpc.length = 0;
  h.calls.lookups.length = 0;
  h.calls.updates.length = 0;
  h.state.createUserError = null;
  h.state.rpcData = "uid-123";
  h.state.upsertError = null;
  h.state.holder = null;
  h.state.claimRows = 1;
  staff.phones.clear();
  staff.unavailable = false;
});

function post(body: unknown, sig?: string) {
  const raw = JSON.stringify(body);
  const signature = sig ?? createHmac("sha256", SECRET).update(raw).digest("hex");
  return POST(
    new Request("http://x/api/sdwork/webhook", {
      method: "POST",
      body: raw,
      headers: { "content-type": "application/json", "x-sdwork-signature": signature },
    }),
  );
}

describe("POST /api/sdwork/webhook", () => {
  it("sai chữ ký → 401", async () => {
    const res = await post({ events: [] }, "deadbeef");
    expect(res.status).toBe(401);
  });

  it("thiếu secret → 503", async () => {
    delete process.env.SDWORK_WEBHOOK_SECRET;
    const res = await POST(
      new Request("http://x", { method: "POST", body: "{}", headers: { "x-sdwork-signature": "x" } }),
    );
    expect(res.status).toBe(503);
  });

  it("customer mới + password → TẠO auth user, không updateUserById", async () => {
    const res = await post({
      events: [
        { entity: "customer", action: "upsert", ref: "c1", data: { phone: "0901234567", name: "A", password: "matkhau123" } },
      ],
    });
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.results[0]).toMatchObject({ ref: "c1", ok: true, provisioned: true });
    expect(h.calls.upserts[0].table).toBe("customers");
    expect(h.calls.upserts[0].opts).toEqual({ onConflict: "sdwork_ref" });
    expect(h.calls.createUser).toHaveLength(1);
    // Chính sách 2026-07-21: KHÔNG ép đổi mật khẩu lần đầu
    expect(h.calls.createUser[0].user_metadata).toEqual({ must_change_password: false });
    expect(h.calls.updateUserById).toHaveLength(0); // KHÔNG đặt lại khi tạo mới
  });

  it("customer ĐÃ tồn tại + KHÔNG reset → bỏ qua, không ghi đè mật khẩu", async () => {
    h.state.createUserError = { message: "User already registered" };
    const res = await post({
      events: [
        { entity: "customer", action: "upsert", ref: "c1", data: { phone: "0901234567", password: "x123456" } },
      ],
    });
    const json = await res.json();
    expect(json.results[0].provisioned).toBe(true);
    expect(h.calls.updateUserById).toHaveLength(0); // không ghi đè
    expect(h.calls.rpc).toHaveLength(0);
  });

  it("customer ĐÃ tồn tại + resetPassword:true → tra RPC + updateUserById đặt lại", async () => {
    h.state.createUserError = { message: "already registered" };
    const res = await post({
      events: [
        { entity: "customer", action: "upsert", ref: "c1", data: { phone: "0901234567", password: "newpass1", resetPassword: true } },
      ],
    });
    const json = await res.json();
    expect(json.results[0].provisioned).toBe(true);
    expect(h.calls.rpc[0]).toEqual({ fn: "auth_user_id_by_phone", params: { p_phone: "0901234567" } });
    expect(h.calls.updateUserById).toHaveLength(1);
    expect(h.calls.updateUserById[0].id).toBe("uid-123");
    expect(h.calls.updateUserById[0].args.password).toBe("newpass1");
    // Reset cũng XÓA cờ ép đổi còn sót (chính sách 2026-07-21)
    expect(h.calls.updateUserById[0].args.user_metadata).toEqual({ must_change_password: false });
  });

  it("TÀI KHOẢN NHÂN SỰ + resetPassword:true → KHÔNG đặt lại (CRM không chiếm được quyền quản trị)", async () => {
    staff.phones.add("0901234567");
    h.state.createUserError = { message: "User already registered" };
    const res = await post({
      events: [
        { entity: "customer", action: "upsert", ref: "c1", data: { phone: "0901234567", password: "newpass1", resetPassword: true } },
      ],
    });
    expect(res.status).toBe(200);
    expect(h.calls.updateUserById).toHaveLength(0);
  });

  it("không tra được vai (DB nghẹt) → coi như nhân sự, KHÔNG đặt lại", async () => {
    staff.unavailable = true;
    h.state.createUserError = { message: "User already registered" };
    await post({
      events: [
        { entity: "customer", action: "upsert", ref: "c1", data: { phone: "0901234567", password: "newpass1", resetPassword: true } },
      ],
    });
    expect(h.calls.updateUserById).toHaveLength(0);
  });

  it("reset nhưng RPC không tìm thấy user → provisioned:false (không nuốt lỗi)", async () => {
    h.state.createUserError = { message: "already registered" };
    h.state.rpcData = null;
    const res = await post({
      events: [
        { entity: "customer", action: "upsert", ref: "c1", data: { phone: "0901234567", password: "newpass1", resetPassword: true } },
      ],
    });
    const json = await res.json();
    expect(json.results[0].provisioned).toBe(false);
  });

  it("device upsert → ghi bảng devices, không đụng auth", async () => {
    const res = await post({
      events: [
        { entity: "device", action: "upsert", ref: "d1", data: { customerPhone: "0901234567", name: "Anten SF-50", serial: "S1" } },
      ],
    });
    const json = await res.json();
    expect(json.results[0]).toMatchObject({ ref: "d1", ok: true });
    expect(h.calls.upserts[0].table).toBe("devices");
    expect(h.calls.createUser).toHaveLength(0);
  });

  it("delete → xoá theo sdwork_ref", async () => {
    const res = await post({ events: [{ entity: "supply", action: "delete", ref: "s9", data: {} }] });
    const json = await res.json();
    expect(json.results[0].ok).toBe(true);
    expect(h.calls.deletes[0]).toEqual({ table: "supplies", col: "sdwork_ref", val: "s9" });
  });

  it("customer KHÔNG password + SĐT hợp lệ → TẠO tài khoản với mật khẩu mặc định sd123456", async () => {
    // Chính sách 2026-07-21: đồng bộ định kỳ (không kèm password) vẫn phải
    // đảm bảo mọi khách có tài khoản — trước đây nhánh này bỏ qua provision
    // → khách mất event password là vĩnh viễn không đăng nhập được.
    const res = await post({
      events: [{ entity: "customer", action: "upsert", ref: "c1", data: { phone: "0901234567", name: "A" } }],
    });
    const json = await res.json();
    expect(json.results[0].provisioned).toBe(true);
    expect(h.calls.createUser).toHaveLength(1);
    expect(h.calls.createUser[0].password).toBe("sd123456");
    expect(h.calls.createUser[0].user_metadata).toEqual({ must_change_password: false });
    expect(h.calls.updateUserById).toHaveLength(0); // đã có user thì createUser lỗi "exists" → giữ nguyên, không reset
  });

  it("customer KHÔNG password + ĐÃ có user → giữ nguyên, không ghi đè mật khẩu", async () => {
    h.state.createUserError = { message: "User already registered" };
    const res = await post({
      events: [{ entity: "customer", action: "upsert", ref: "c1", data: { phone: "0901234567", name: "A" } }],
    });
    const json = await res.json();
    expect(json.results[0].provisioned).toBe(true);
    expect(h.calls.updateUserById).toHaveLength(0);
    expect(h.calls.rpc).toHaveLength(0);
  });

  it("customer KHÔNG password + SĐT KHÔNG hợp lệ (số bàn 02x) → chỉ upsert hồ sơ, không tạo login", async () => {
    const res = await post({
      events: [{ entity: "customer", action: "upsert", ref: "c1", data: { phone: "02253746464", name: "Cty X" } }],
    });
    const json = await res.json();
    expect(json.results[0].ok).toBe(true);
    expect(json.results[0].provisioned).toBeUndefined();
    expect(h.calls.createUser).toHaveLength(0);
  });

  describe("khách TRÙNG SĐT (2026-10-31: 865 event dead upsert_failed)", () => {
    const PHONE_TAKEN = {
      code: "23505",
      message: 'duplicate key value violates unique constraint "customers_phone_key"',
      details: "Key (phone)=(0901234567) already exists.",
    };

    it("SĐT đã có hàng CHƯA gắn mã (tạo tay /quan-tri) → nhận về: gắn mã vào hàng đó, vẫn provision", async () => {
      h.state.upsertError = PHONE_TAKEN;
      h.state.holder = { id: "row-1", sdwork_ref: null };
      const res = await post({
        events: [{ entity: "customer", action: "upsert", ref: "c1", data: { phone: "0901234567", name: "A" } }],
      });
      const json = await res.json();
      expect(json.results[0]).toMatchObject({ ref: "c1", ok: true, provisioned: true });
      expect(h.calls.lookups).toEqual([{ table: "customers", col: "phone", val: "0901234567" }]);
      expect(h.calls.updates).toHaveLength(1);
      expect(h.calls.updates[0]).toMatchObject({ table: "customers", id: "row-1", isNullCol: "sdwork_ref" });
      expect(h.calls.updates[0].patch).toMatchObject({ sdwork_ref: "c1", phone: "0901234567", name: "A" });
      expect(json.applied).toBe(1);
    });

    it("CRM gửi tên rỗng → KHÔNG xoá tên đã nhập tay khi nhận về", async () => {
      h.state.upsertError = PHONE_TAKEN;
      h.state.holder = { id: "row-1", sdwork_ref: null };
      await post({ events: [{ entity: "customer", action: "upsert", ref: "c1", data: { phone: "0901234567" } }] });
      expect(h.calls.updates[0].patch).not.toHaveProperty("name");
    });

    it("SĐT thuộc khách SDWork KHÁC → phone_conflict, KHÔNG ghi đè, không provision", async () => {
      h.state.upsertError = PHONE_TAKEN;
      h.state.holder = { id: "row-1", sdwork_ref: "c-khac" };
      const res = await post({
        events: [{ entity: "customer", action: "upsert", ref: "c1", data: { phone: "0901234567", name: "A" } }],
      });
      const json = await res.json();
      expect(json.results[0]).toMatchObject({ ref: "c1", ok: false, code: "phone_conflict" });
      expect(h.calls.updates).toHaveLength(0);
      expect(h.calls.createUser).toHaveLength(0);
    });

    it("hàng vừa bị event khác nhận mất giữa chừng (UPDATE khớp 0 hàng) → phone_conflict", async () => {
      h.state.upsertError = PHONE_TAKEN;
      h.state.holder = { id: "row-1", sdwork_ref: null };
      h.state.claimRows = 0;
      const res = await post({
        events: [{ entity: "customer", action: "upsert", ref: "c1", data: { phone: "0901234567", name: "A" } }],
      });
      const json = await res.json();
      expect(json.results[0]).toMatchObject({ ok: false, code: "phone_conflict" });
      expect(h.calls.createUser).toHaveLength(0);
    });

    it("lỗi upsert KHÁC (không phải trùng SĐT) → vẫn upsert_failed như cũ, không tra SĐT", async () => {
      h.state.upsertError = { code: "42703", message: 'column "x" does not exist' };
      const res = await post({
        events: [{ entity: "customer", action: "upsert", ref: "c1", data: { phone: "0901234567", name: "A" } }],
      });
      const json = await res.json();
      expect(json.results[0]).toMatchObject({ ok: false, code: "upsert_failed" });
      expect(h.calls.lookups).toHaveLength(0);
    });

    it("device KHÔNG đi nhánh nhận về (chỉ customer có khoá SĐT)", async () => {
      h.state.upsertError = PHONE_TAKEN;
      const res = await post({
        events: [{ entity: "device", action: "upsert", ref: "d1", data: { customerPhone: "0901234567", name: "Anten" } }],
      });
      const json = await res.json();
      expect(json.results[0]).toMatchObject({ ok: false, code: "upsert_failed" });
      expect(h.calls.lookups).toHaveLength(0);
    });
  });
});

// ── ĐƠN SDVICO (entity "order", 2026-11-02, ADR 0018) ─────────────────────
describe("POST /api/sdwork/webhook — entity order", () => {
  const order = (over: Record<string, unknown> = {}) => ({
    entity: "order",
    action: "upsert",
    ref: "o1",
    data: {
      customerPhone: "0901234567",
      customerName: "Khách A",
      code: "DH75768",
      status: "dang_chuan_bi",
      orderedAt: "2026-11-02T01:00:00Z",
      snapshotAt: "2026-11-02T01:00:05Z",
      items: [{ name: "Máy S-Tracking", qty: 1, unit: "cái", unitPrice: 5500000, lineTotal: 5500000 }],
      total: 5500000,
      ...over,
    },
  });

  it("upsert → gọi RPC crm_order_upsert đúng hàng đã map, KHÔNG đụng TABLE map", async () => {
    const res = await post({ events: [order()] });
    const json = await res.json();
    expect(json.results[0]).toMatchObject({ ref: "o1", entity: "order", ok: true });
    expect(json.results[0].code).toBeUndefined();
    const call = h.calls.rpc.find((c) => c.fn === "crm_order_upsert");
    expect(call?.params.p).toMatchObject({
      sdwork_ref: "o1",
      code: "DH75768",
      customer_phone: "0901234567",
      status: "dang_chuan_bi",
      total_vnd: 5500000,
      snapshot_at: "2026-11-02T01:00:05Z",
    });
    expect(call?.params.p.items[0]).toEqual({
      name: "Máy S-Tracking", qty: 1, unit: "cái", unitPriceVnd: 5500000, lineTotalVnd: 5500000,
    });
    expect(h.calls.upserts).toHaveLength(0);
    expect(h.calls.createUser).toHaveLength(0); // order KHÔNG tự tạo tài khoản (việc của event customer)
  });

  it("bản cũ hơn (RPC trả stale) → vẫn ok + code stale_snapshot (CRM không retry)", async () => {
    h.state.rpcData = "stale";
    const json = await (await post({ events: [order()] })).json();
    expect(json.results[0]).toMatchObject({ ok: true, code: "stale_snapshot" });
  });

  it("trạng thái ngoài 4 mã → bad_status, không gọi RPC", async () => {
    const json = await (await post({ events: [order({ status: "completed" })] })).json();
    expect(json.results[0]).toMatchObject({ ok: false, code: "bad_status" });
    expect(h.calls.rpc).toHaveLength(0);
  });

  it("SĐT sai / thiếu mã / thiếu snapshotAt → missing_required", async () => {
    const json = await (
      await post({
        events: [
          order({ customerPhone: "02436000000" }),
          { ...order({ code: "" }), ref: "o2" },
          { ...order({ snapshotAt: undefined }), ref: "o3" },
        ],
      })
    ).json();
    expect(json.results.map((r: { code: string }) => r.code)).toEqual([
      "missing_required", "missing_required", "missing_required",
    ]);
    expect(h.calls.rpc).toHaveLength(0);
  });

  it("delete → RPC crm_order_delete (bia mộ) kèm snapshotAt, không xoá thẳng bảng", async () => {
    h.state.rpcData = "applied";
    const json = await (
      await post({ events: [{ entity: "order", action: "delete", ref: "o1", data: { snapshotAt: "2026-11-02T02:00:00Z" } }] })
    ).json();
    expect(json.results[0]).toMatchObject({ ok: true });
    expect(json.results[0].code).toBeUndefined();
    expect(h.calls.rpc).toContainEqual({
      fn: "crm_order_delete",
      params: { p_ref: "o1", p_snapshot_at: "2026-11-02T02:00:00Z" },
    });
    expect(h.calls.deletes).toHaveLength(0);
  });

  it("delete thiếu snapshotAt → p_snapshot_at null (RPC dùng now()); hàng mới hơn còn đó → stale_snapshot", async () => {
    h.state.rpcData = "stale";
    const json = await (await post({ events: [{ entity: "order", action: "delete", ref: "o1", data: {} }] })).json();
    expect(json.results[0]).toMatchObject({ ok: true, code: "stale_snapshot" });
    expect(h.calls.rpc[0].params.p_snapshot_at).toBeNull();
  });

  it("batch customer + order (lần đầu sang): tạo TK mặc định cho SĐT mới, rồi ghi đơn", async () => {
    const json = await (
      await post({
        events: [
          { entity: "customer", action: "upsert", ref: "acc1", data: { phone: "0901234567", name: "Khách A" } },
          order(),
        ],
      })
    ).json();
    expect(json.results.map((r: { ok: boolean }) => r.ok)).toEqual([true, true]);
    expect(h.calls.createUser).toHaveLength(1);
    expect(h.calls.createUser[0].password).toBe("sd123456");
    expect(h.calls.updateUserById).toHaveLength(0);
  });

  it("SĐT đã có tài khoản → giữ nguyên, KHÔNG đổi mật khẩu", async () => {
    h.state.createUserError = { message: "User already registered" };
    const json = await (
      await post({
        events: [
          { entity: "customer", action: "upsert", ref: "acc1", data: { phone: "0901234567", name: "Khách A" } },
          order(),
        ],
      })
    ).json();
    expect(json.results[0]).toMatchObject({ ok: true, provisioned: true });
    expect(h.calls.updateUserById).toHaveLength(0);
  });
});
