import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MARK,
  loadTestAccounts,
  parseEnvFile,
  newToken,
  makeRest,
  planCap,
  cap,
  thu,
} from "../../../scripts/test-account.mjs";
import { isValidTokenShape } from "@/lib/device-token";

/*  SCRIPT TÀI KHOẢN TEST (2026-09-17, chủ dự án: "bổ sung cách làm account test,
    danh sách phải lưu riêng để khoanh vùng"). Cổng: (1) file danh sách hợp lệ và
    là nguồn duy nhất; (2) chuỗi sinh ra đúng khuôn app nhận; (3) luật 1 tài
    khoản 1 máy: có chuỗi sống mà không --multi ⇒ từ chối; (4) cấp + nâng premium
    tạm ghi đúng dấu vết; (5) thu: chỉ xoá chuỗi của script, trả hạng gốc. */

const ROOT = process.cwd();

describe("danh sách tài khoản test", () => {
  it("scripts/test-accounts.json hợp lệ, ≥2 basic + ≥1 premium, có mục đích", () => {
    const list = loadTestAccounts(join(ROOT, "scripts", "test-accounts.json"));
    expect(list.filter((a) => a.tier === "basic").length).toBeGreaterThanOrEqual(2);
    expect(list.filter((a) => a.tier === "premium").length).toBeGreaterThanOrEqual(1);
    for (const a of list) expect(a.purpose.length, a.phone).toBeGreaterThan(10);
    expect(new Set(list.map((a) => a.phone)).size).toBe(list.length);
  });

  it("script từ chối số ngoài danh sách (đọc mã nguồn: cổng khoanh vùng có thật)", () => {
    const src = readFileSync(join(ROOT, "scripts", "test-account.mjs"), "utf8");
    expect(src).toContain("KHÔNG nằm trong scripts/test-accounts.json");
  });
});

describe("helper thuần", () => {
  it("parseEnvFile: KEY=VALUE, bỏ comment, cắt quote", () => {
    expect(parseEnvFile('# a\nNEXT_PUBLIC_SUPABASE_URL="https://x.supabase.co"\nSUPABASE_SERVICE_ROLE_KEY=srk\n\nX = y ')).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "srk",
      X: "y",
    });
  });

  it("newToken: đúng khuôn lib/device-token (47 ký tự, sdf_ + base64url) + băm sha256 hex", () => {
    const { token, hash } = newToken();
    expect(isValidTokenShape(token)).toBe(true);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("planCap: luật 1 tài khoản 1 máy, nâng premium chỉ khi đang basic", () => {
    const basic = { customer: { tier: "basic" }, live: 0 };
    expect(planCap(basic, {})).toEqual({ ok: true, origTier: "basic", raise: false, allowMulti: false });
    expect(planCap(basic, { premiumDays: 1 }).raise).toBe(true);
    expect(planCap({ customer: { tier: "premium" }, live: 0 }, { premiumDays: 1 }).raise).toBe(false);
    expect(planCap({ customer: { tier: "premium" }, live: 2 }, {}).ok).toBe(false);
    expect(planCap({ customer: { tier: "premium" }, live: 2 }, { multi: true })).toMatchObject({ ok: true, allowMulti: true });
    expect(planCap({ customer: null, live: 0 }, {}).ok).toBe(false);
  });
});

describe("cap / thu qua REST giả", () => {
  type Row = Record<string, unknown>;
  function fakeDb(customer: Row) {
    const tokens: Row[] = [];
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string, init: { method?: string; body?: string }) => {
      const u = new URL(url);
      const path = u.pathname.replace("/rest/v1/", "") + u.search;
      calls.push(`${init.method} ${path}`);
      const ok = (body: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });
      if (init.method === "GET" && path.startsWith("customers")) return ok([customer]);
      if (init.method === "GET" && path.startsWith("device_tokens")) return ok(tokens.filter((t) => !t.revoked_at));
      if (init.method === "POST" && path === "device_tokens") { const row = JSON.parse(init.body!) as Row; tokens.push(row); return ok([row]); }
      if (init.method === "PATCH" && path.startsWith("customers")) { Object.assign(customer, JSON.parse(init.body!)); return ok([customer]); }
      if (init.method === "DELETE" && path.startsWith("device_tokens")) { const del = tokens.filter((t) => t.device_id === MARK); for (const d of del) tokens.splice(tokens.indexOf(d), 1); return ok(del); }
      return { ok: false, status: 500, text: async () => "?" };
    });
    return { customer, tokens, calls, rest: makeRest({ url: "https://x.supabase.co", srk: "srk" }, fetchImpl as unknown as typeof fetch) };
  }

  it("cap --premium trên basic: chèn chuỗi có dấu vết + nâng hạng; thu: xoá đúng chuỗi đó + trả basic", async () => {
    const db = fakeDb({ phone: "0900000777", tier: "basic", premium_until: null, name: "Khách Test E2E" });
    const out: string[] = [];
    const token = await cap(db.rest, "0900000777", { premiumDays: 1 }, (s: string) => out.push(s));
    expect(isValidTokenShape(token)).toBe(true);
    expect(db.tokens).toHaveLength(1);
    expect(db.tokens[0]).toMatchObject({ customer_phone: "0900000777", device_id: MARK, platform: "test:basic", allow_multi: false });
    expect(db.customer.tier).toBe("premium");
    expect(out.join("\n")).toContain(`x-sdfish-token: ${token}`);
    expect(out.join("\n")).toContain("localStorage.setItem('forfish.token.v1'");
    // chuỗi máy thật (không phải của script) phải sống sót qua 'thu'
    db.tokens.push({ token_hash: "h", customer_phone: "0900000777", device_id: "may-that", platform: "ios" });
    await thu(db.rest, "0900000777", (s: string) => out.push(s));
    expect(db.tokens.map((t) => t.device_id)).toEqual(["may-that"]);
    expect(db.customer).toMatchObject({ tier: "basic", premium_until: null });
  });

  it("cap khi đang có chuỗi sống và không --multi ⇒ ném, không chèn gì", async () => {
    const db = fakeDb({ phone: "0912345678", tier: "premium", premium_until: "2026-10-01", name: "NPP" });
    db.tokens.push({ token_hash: "h", customer_phone: "0912345678", device_id: "may-that" });
    await expect(cap(db.rest, "0912345678", {}, () => {})).rejects.toThrow(/1 tài khoản 1 máy/);
    expect(db.tokens).toHaveLength(1);
    await cap(db.rest, "0912345678", { multi: true }, () => {});
    expect(db.tokens).toHaveLength(2);
    expect(db.tokens[1]).toMatchObject({ allow_multi: true, platform: "test:premium" });
    expect(db.customer.tier).toBe("premium");
  });
});
