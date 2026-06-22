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
  };
  const state = { createUserError: null as null | { message: string }, rpcData: "uid-123" as string | null };
  const admin = {
    from: (table: string) => ({
      upsert: (row: any, opts: any) => {
        calls.upserts.push({ table, row, opts });
        return Promise.resolve({ error: null });
      },
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

import { POST } from "@/app/api/sdwork/webhook/route";

const SECRET = "test-secret";

beforeEach(() => {
  process.env.SDWORK_WEBHOOK_SECRET = SECRET;
  h.calls.upserts.length = 0;
  h.calls.deletes.length = 0;
  h.calls.createUser.length = 0;
  h.calls.updateUserById.length = 0;
  h.calls.rpc.length = 0;
  h.state.createUserError = null;
  h.state.rpcData = "uid-123";
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
    expect(h.calls.createUser[0].user_metadata).toEqual({ must_change_password: true });
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
    expect(h.calls.updateUserById[0].args.user_metadata).toEqual({ must_change_password: true });
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

  it("customer KHÔNG password → không provision", async () => {
    const res = await post({
      events: [{ entity: "customer", action: "upsert", ref: "c1", data: { phone: "0901234567", name: "A" } }],
    });
    const json = await res.json();
    expect(json.results[0].provisioned).toBeUndefined();
    expect(h.calls.createUser).toHaveLength(0);
  });
});
