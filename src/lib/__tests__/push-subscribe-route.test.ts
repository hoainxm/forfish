/* eslint-disable @typescript-eslint/no-explicit-any -- mock Supabase admin client
   bắt-lời-gọi, payload tuỳ biến; `any` giới hạn trong khung mock của file này. */
// Route POST /api/push/subscribe — nhánh ĐỔI KHOÁ VAPID (2026-10-07): máy gửi kèm
// endpoint CŨ ⇒ lưu đăng ký mới TRƯỚC rồi mới xoá dòng cũ, và chỉ xoá dòng chưa
// gắn ai / của chính tài khoản đang đăng nhập.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const calls: string[] = [];
  const rows = new Map<string, { customer_phone: string | null }>();
  const who = { phone: null as string | null };
  const admin = {
    from: () => ({
      upsert: (row: any) => {
        calls.push(`upsert:${row.endpoint}`);
        return Promise.resolve({ error: null });
      },
      select: () => ({
        eq: (_c: string, ep: string) => ({
          maybeSingle: () => Promise.resolve({ data: rows.get(ep) ?? null, error: null }),
        }),
      }),
      delete: () => ({
        eq: (_c: string, ep: string) => {
          calls.push(`delete:${ep}`);
          return Promise.resolve({ error: null });
        },
      }),
    }),
  };
  return { calls, rows, who, admin };
});

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.admin }));
vi.mock("@/lib/api-identity", () => ({
  identityFromRequest: async () => ({ ok: true, phone: h.who.phone }),
}));
vi.mock("@/lib/device-token", () => ({
  hashDeviceToken: async () => "x",
  readTokenHeader: () => null,
}));

import { POST } from "@/app/api/push/subscribe/route";

const NEW = "https://fcm.googleapis.com/fcm/send/moi";
const OLD = "https://fcm.googleapis.com/fcm/send/cu";
const post = (extra: Record<string, unknown> = {}) =>
  POST(
    new Request("http://x/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify({
        subscription: { endpoint: NEW, keys: { p256dh: "p".repeat(87), auth: "a".repeat(22) } },
        ...extra,
      }),
    }),
  );

beforeEach(() => {
  h.calls.length = 0;
  h.rows.clear();
  h.who.phone = null;
});

describe("POST /api/push/subscribe — oldEndpoint khi đổi khoá VAPID", () => {
  it("lưu MỚI trước, rồi xoá dòng CŨ (cùng tài khoản)", async () => {
    h.who.phone = "0901234567";
    h.rows.set(OLD, { customer_phone: "0901234567" });
    const r = await post({ oldEndpoint: OLD });
    expect(r.status).toBe(200);
    expect(h.calls).toEqual([`upsert:${NEW}`, `delete:${OLD}`]);
  });

  it("dòng cũ chưa gắn ai → xoá được kể cả máy khách", async () => {
    h.rows.set(OLD, { customer_phone: null });
    await post({ oldEndpoint: OLD });
    expect(h.calls).toContain(`delete:${OLD}`);
  });

  it("dòng cũ của NGƯỜI KHÁC → không xoá, đăng ký mới vẫn lưu, vẫn 200", async () => {
    h.who.phone = "0901234567";
    h.rows.set(OLD, { customer_phone: "0987654321" });
    const r = await post({ oldEndpoint: OLD });
    expect(r.status).toBe(200);
    expect(h.calls).toEqual([`upsert:${NEW}`]);
  });

  it("không gửi oldEndpoint / trùng endpoint mới → chỉ upsert như cũ", async () => {
    await post();
    await post({ oldEndpoint: NEW });
    expect(h.calls).toEqual([`upsert:${NEW}`, `upsert:${NEW}`]);
  });
});
