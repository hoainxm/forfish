/* eslint-disable @typescript-eslint/no-explicit-any -- mock Supabase admin client
   giữ bảng user_docs trong bộ nhớ; `any` giới hạn trong khung mock của file này. */
// /api/me/sync PUT — GHI CÓ ĐIỀU KIỆN theo rev (0064, rà Codex 2026-10-19).
// Ca bắt buộc: hai máy cùng thêm mục (máy kia ghi CHEN giữa lúc đọc và lúc ghi),
// tạo cuốn đồng thời, hết lượt thử, trần cỡ, và luật cũ (stale/merge) giữ nguyên.
import { beforeEach, describe, expect, it, vi } from "vitest";

import { decidePut, invalidPut, SYNC_MAX_ITEMS } from "@/lib/user-sync-core";

type Row = { data: unknown; client_updated_at: number; rev: number };

const h = vi.hoisted(() => {
  const table = new Map<string, Row>();
  /** chạy NGAY TRƯỚC mỗi lần update/insert — giả lập máy khác ghi chen */
  const before = { fn: null as null | (() => void), runs: 0 };
  const chen = () => {
    if (before.fn) {
      before.runs++;
      before.fn();
    }
  };
  const key = (p: string, k: string) => `${p}|${k}`;
  const admin = {
    from: () => ({
      select: () => {
        const f: Record<string, string> = {};
        const q: any = {
          eq: (c: string, v: string) => ((f[c] = v), q),
          maybeSingle: () =>
            Promise.resolve({ data: table.get(key(f.owner_phone, f.kind)) ?? null, error: null }),
        };
        return q;
      },
      update: (row: any) => {
        const f: Record<string, any> = {};
        const q: any = {
          eq: (c: string, v: any) => ((f[c] = v), q),
          select: () => {
            chen();
            const k = key(f.owner_phone, f.kind);
            const cur = table.get(k);
            if (!cur || cur.rev !== f.rev) return Promise.resolve({ data: [], error: null });
            table.set(k, { data: row.data, client_updated_at: row.client_updated_at, rev: row.rev });
            return Promise.resolve({ data: [{ rev: row.rev }], error: null });
          },
        };
        return q;
      },
      insert: (row: any) => {
        chen();
        const k = key(row.owner_phone, row.kind);
        if (table.has(k)) return Promise.resolve({ error: { code: "23505", message: "dup" } });
        table.set(k, { data: row.data, client_updated_at: row.client_updated_at, rev: row.rev });
        return Promise.resolve({ error: null });
      },
    }),
  };
  return { table, before, admin, key };
});

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.admin }));
vi.mock("@/lib/api-identity", () => ({
  identityFromRequest: async () => ({ ok: true, phone: "0912345678" }),
}));

import { PUT } from "@/app/api/me/sync/route";

const PHONE = "0912345678";
const put = async (body: unknown) => {
  const res = await PUT(new Request("http://x/api/me/sync", { method: "PUT", body: JSON.stringify(body) }));
  return { status: res.status, json: (await res.json()) as any };
};
const ids = (k = "boats") => ((h.table.get(h.key(PHONE, k))?.data as any[]) ?? []).filter((x) => !x._deleted).map((x) => x.id).sort();

beforeEach(() => {
  h.table.clear();
  h.before.fn = null;
  h.before.runs = 0;
});

describe("PUT /api/me/sync — CAS theo rev", () => {
  it("hai máy cùng thêm: máy B ghi chen giữa lúc A đọc và ghi ⇒ GIỮ CẢ HAI mục", async () => {
    h.table.set(h.key(PHONE, "boats"), { data: [{ id: "goc" }], client_updated_at: 100, rev: 1 });
    // B ghi "b" ngay trước lần ghi đầu của A (A đã đọc rev 1)
    h.before.fn = () => {
      h.before.fn = null;
      h.table.set(h.key(PHONE, "boats"), { data: [{ id: "goc" }, { id: "b" }], client_updated_at: 101, rev: 2 });
    };
    const r = await put({ kind: "boats", data: [{ id: "goc" }, { id: "a" }], clientUpdatedAt: 102, baseIds: ["goc"] });
    expect(r.status).toBe(200);
    expect(ids()).toEqual(["a", "b", "goc"]);
    expect(h.table.get(h.key(PHONE, "boats"))!.rev).toBe(3);
    expect(r.json.merged).toBe(true);
  });

  it("hai máy cùng TẠO cuốn mới: insert trùng ⇒ đọc lại rồi gộp, không mất mục nào", async () => {
    h.before.fn = () => {
      h.before.fn = null;
      h.table.set(h.key(PHONE, "boats"), { data: [{ id: "b" }], client_updated_at: 50, rev: 1 });
    };
    const r = await put({ kind: "boats", data: [{ id: "a" }], clientUpdatedAt: 60, baseIds: [] });
    expect(r.status).toBe(200);
    expect(ids()).toEqual(["a", "b"]);
  });

  it("bị chen mãi ⇒ 503 busy (máy giữ sổ chưa đẩy), không ghi bậy", async () => {
    h.table.set(h.key(PHONE, "boats"), { data: [{ id: "goc" }], client_updated_at: 100, rev: 1 });
    h.before.fn = () => {
      const cur = h.table.get(h.key(PHONE, "boats"))!;
      h.table.set(h.key(PHONE, "boats"), { ...cur, rev: cur.rev + 1 });
    };
    const r = await put({ kind: "boats", data: [{ id: "goc" }, { id: "a" }], clientUpdatedAt: 102, baseIds: ["goc"] });
    expect(r.status).toBe(503);
    expect(r.json.code).toBe("busy");
    expect(ids()).toEqual(["goc"]);
    expect(h.before.runs).toBe(3);
  });

  it("máy đời cũ (không baseIds), server mới hơn ⇒ stale, không ghi", async () => {
    h.table.set(h.key(PHONE, "crew"), { data: [{ id: "x" }], client_updated_at: 500, rev: 4 });
    const r = await put({ kind: "crew", data: [], clientUpdatedAt: 400 });
    expect(r.json.stale).toBe(true);
    expect(h.table.get(h.key(PHONE, "crew"))!.rev).toBe(4);
  });

  it("cuốn quá cỡ ⇒ 400 too_large", async () => {
    const data = Array.from({ length: SYNC_MAX_ITEMS + 1 }, (_, i) => ({ id: String(i) }));
    const r = await put({ kind: "boats", data, clientUpdatedAt: 1 });
    expect(r.status).toBe(400);
    expect(r.json.code).toBe("too_large");
  });
});

describe("decidePut — thuần", () => {
  const NOW = "2026-10-19T00:00:00.000Z";
  it("gộp ra y hệt server ⇒ chỉ trả lời, không ghi", () => {
    const d = decidePut({ data: [{ id: "a" }], clientUpdatedAt: 10 }, { kind: "boats", data: [{ id: "a" }], clientUpdatedAt: 5, baseIds: ["a"] }, NOW);
    expect(d.action).toBe("reply");
  });
  it("mốc mới luôn lớn hơn mốc server (đồng hồ máy chậm vẫn kéo được bản mới)", () => {
    const d = decidePut({ data: [{ id: "a" }], clientUpdatedAt: 1000 }, { kind: "boats", data: [{ id: "a" }, { id: "b" }], clientUpdatedAt: 3, baseIds: ["a"] }, NOW);
    expect(d.action).toBe("write");
    if (d.action === "write") expect(d.write.clientUpdatedAt).toBe(1001);
  });
  it("máy xoá mục ⇒ server giữ vết _deleted, trả máy bản đã lọc", () => {
    const d = decidePut({ data: [{ id: "a" }, { id: "b" }], clientUpdatedAt: 1 }, { kind: "boats", data: [{ id: "a" }], clientUpdatedAt: 2, baseIds: ["a", "b"] }, NOW);
    expect(d.action).toBe("write");
    if (d.action === "write") {
      expect((d.write.data as any[]).find((x) => x.id === "b")?._deleted).toBe(true);
      expect(d.reply.server!.data).toEqual([{ id: "a" }]);
    }
  });
  it("invalidPut: chuỗi quá dài ⇒ too_large; cuốn thường ⇒ hợp lệ", () => {
    expect(invalidPut({ kind: "boats", data: [{ id: "a", note: "x".repeat(2_000_001) }], clientUpdatedAt: 1 })).toBe("too_large");
    expect(invalidPut({ kind: "boats", data: [{ id: "a" }], clientUpdatedAt: 1 })).toBeNull();
  });
});
