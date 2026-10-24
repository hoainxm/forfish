import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/*  TRANG CÁ NHÂN (14 §3.8, AC13 bản 2026-10-24) chạy thật route trên kho file dev: PATCH /me
    phần Giới thiệu + ảnh bìa, GET trang người dùng (số theo dõi, cùng cảng, mời đặt tên), danh
    sách theo dõi (không SĐT — AC21), ảnh bìa là ảnh đang dùng. Cuối file: kho Supabase khi cột
    0067 CHƯA có (deploy đi trước migration) — đọc vẫn chạy, ghi trường mới ⇒ fields_missing. */

const h = vi.hoisted(() => ({ store: null as unknown, db: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api-identity", () => ({
  identityFromRequest: async (req: Request, optional?: boolean) => {
    const phone = req.headers.get("x-test-phone");
    if (phone) return { ok: true, phone };
    return optional ? { ok: true, phone: null } : { ok: false, res: Response.json({ ok: false, code: "login_required" }, { status: 401 }) };
  },
}));
vi.mock("@/lib/market/notify", () => ({ notifyMarket: async () => undefined }));
vi.mock("@/lib/app-config", () => ({ getConfigValue: async () => null }));
vi.mock("@/lib/kairos/store", async (orig) => ({ ...(await orig<object>()), getKairosStore: async () => h.store }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.db }));

vi.stubEnv("MARKET_STORE", "file");
vi.stubEnv("VERCEL", "");

import { createKairosFileStore } from "@/lib/kairos/file-store";
import { createKairosSupabaseStore } from "@/lib/kairos/supabase-store";
import type { KairosStore, ProfileFull } from "@/lib/kairos/store";
import { GET as meGet, PATCH as mePatch } from "@/app/api/kairos/me/route";
import { GET as userGet } from "@/app/api/kairos/users/[profileId]/route";
import { GET as followsGet } from "@/app/api/kairos/users/[profileId]/follows/route";

const A = "0901000021";
const B = "0901000022";
const C = "0901000023";
let dir: string;
let store: KairosStore;
const prof: Record<string, ProfileFull> = {};

const req = (method: string, phone: string | null, body?: unknown, url = "http://x/api") =>
  new Request(url, {
    method,
    headers: { ...(phone ? { "x-test-phone": phone } : {}), "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const pctx = (profileId: string) => ({ params: Promise.resolve({ profileId }) });
const img = (who: string) => `${prof[who].id}/${crypto.randomUUID()}.jpg`;

beforeAll(async () => {
  dir = mkdtempSync(path.join(os.tmpdir(), "kairos-ho-so-"));
  store = createKairosFileStore({ dir });
  h.store = store;
  for (const [phone, handle] of [[A, "Bà con 0021"], [B, "Tư Tam Quan"], [C, "Năm Cửa Việt"]]) {
    prof[phone] = await store.createProfile({ phone, handle, handle_norm: handle.toLowerCase() });
  }
});
afterAll(() => rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

describe("PATCH /me — Giới thiệu + ảnh bìa", () => {
  it("lưu quê, nghề, cảng nhà, giới thiệu, ảnh bìa; GET /me trả lại `about`", async () => {
    const cover = img(B);
    const r = await mePatch(req("PATCH", B, { queTinh: "gia-lai", nghe: "luoi-vay", homePort: "sa-huynh", gioiThieu: "Đi biển 20 năm", coverPath: cover }));
    expect(r.status).toBe(200);
    const me = (await r.json()).me;
    expect(me.about).toMatchObject({ queTinh: "gia-lai", nghe: "luoi-vay", homePort: "sa-huynh", gioiThieu: "Đi biển 20 năm" });
    expect(me.about.coverUrl).toContain(prof[B].id);
    // cảng nhà tự chọn thắng ⇒ dòng phụ theo cảng
    expect(me.subline).toMatch(/Sa Huỳnh/);
    const g = await (await meGet(req("GET", B))).json();
    expect(g.me.about.nghe).toBe("luoi-vay");
  });
  it("mã lạ ⇒ 400 có mã; ảnh bìa thư mục người khác ⇒ 400 bad_cover", async () => {
    expect((await (await mePatch(req("PATCH", B, { queTinh: "quang-nam" }))).json()).code).toBe("bad_province");
    expect((await (await mePatch(req("PATCH", B, { homePort: "khong-co" }))).json()).code).toBe("bad_port");
    const bad = await mePatch(req("PATCH", B, { coverPath: img(C) }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).code).toBe("bad_cover");
  });
  it("ảnh bìa là ảnh ĐANG DÙNG — Huỷ khung soạn / dọn ảnh mồ côi không xoá nó", async () => {
    const p = (await store.profileByPhone(B))!;
    expect(p.cover_path).toBeTruthy();
    expect((await store.mediaInUse([p.cover_path!])).has(p.cover_path!)).toBe(true);
  });
});

describe("đổi tên lần đầu rời tên máy đặt không tính hạn 30 ngày", () => {
  it("Bà con 0021 ⇒ tên mới: handle_changed_at vẫn null, hết mời; lần đổi sau mới tính hạn", async () => {
    const before = await (await userGet(req("GET", A), pctx(prof[A].id))).json();
    expect(before.user.askName).toBe(true);
    const r = await mePatch(req("PATCH", A, { handle: "Ba Sa Kỳ" }));
    expect(r.status).toBe(200);
    expect((await store.profileByPhone(A))?.handle_changed_at).toBeNull();
    expect((await r.json()).me.askName).toBe(false);
    expect((await mePatch(req("PATCH", A, { handle: "Ba Sa Kỳ Hai" }))).status).toBe(200);
    expect((await store.profileByPhone(A))?.handle_changed_at).toBeTruthy();
    expect((await mePatch(req("PATCH", A, { handle: "Ba Sa Kỳ Ba" }))).status).toBe(429);
  });
});

describe("GET trang người dùng — số theo dõi, cùng cảng, không SĐT", () => {
  it("đếm người theo dõi / đang theo dõi; cùng cảng khi người xem cùng cảng nhà", async () => {
    await store.setEdge("follow", A, B, true);
    await store.setEdge("follow", C, B, true);
    await store.setEdge("follow", B, C, true);
    await store.updateProfile(C, { home_port: "sa-huynh" });
    const j = await (await userGet(req("GET", C), pctx(prof[B].id))).json();
    expect(j.user).toMatchObject({ followers: 2, followingCount: 1, samePort: true, isAgent: false, askName: false, me: false, following: true });
    expect(j.user.about.queTinh).toBe("gia-lai");
    const guest = await (await userGet(req("GET", null), pctx(prof[B].id))).json();
    expect(guest.user.samePort).toBe(false);
    for (const p of [A, B, C]) expect(JSON.stringify(j)).not.toContain(p);
  });
  it("danh sách theo dõi: mới nhất trước, không SĐT, bỏ người mình chặn; dir sai 400; id lạ 404", async () => {
    const r = await followsGet(req("GET", null, undefined, `http://x/api?dir=followers`), pctx(prof[B].id));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.people.map((p: { profileId: string }) => p.profileId).sort()).toEqual([prof[A].id, prof[C].id].sort());
    expect(j.more).toBe(false);
    const txt = JSON.stringify(j);
    for (const p of [A, B, C]) expect(txt).not.toContain(p);

    await store.setEdge("block", B, A, true);
    const mine = await (await followsGet(req("GET", B, undefined, `http://x/api?dir=followers`), pctx(prof[B].id))).json();
    expect(mine.people.map((p: { profileId: string }) => p.profileId)).toEqual([prof[C].id]);
    await store.setEdge("block", B, A, false);

    const following = await (await followsGet(req("GET", null, undefined, `http://x/api?dir=following`), pctx(prof[B].id))).json();
    expect(following.people.map((p: { handle: string }) => p.handle)).toEqual(["Năm Cửa Việt"]);
    expect((await followsGet(req("GET", null, undefined, `http://x/api?dir=ai`), pctx(prof[B].id))).status).toBe(400);
    expect((await followsGet(req("GET", null, undefined, `http://x/api?dir=followers`), pctx(crypto.randomUUID()))).status).toBe(404);
  });
});

// ── Kho Supabase khi cột 0067 CHƯA có ────────────────────────────────────
type Q = { table: string; cols: string; patch: Record<string, unknown> | null };
function fakeDb(hasCols: boolean) {
  const seen: Q[] = [];
  const row = {
    id: "00000000-0000-4000-8000-0000000000aa", phone: "0901", handle: "Bà con 0901", handle_norm: "ba con 0901", handle_changed_at: null,
    avatar_path: null, show_boat: false, official: false, rules_accepted_at: null, banned_until: null, ban_reason: null, created_at: "2026-10-24T00:00:00Z",
    ...(hasCols ? { cover_path: null, que_tinh: "hue", nghe: null, gioi_thieu: null, home_port: null } : {}),
  };
  const NEW = ["cover_path", "que_tinh", "nghe", "gioi_thieu", "home_port"];
  return {
    seen,
    from(table: string) {
      const q: Q = { table, cols: "", patch: null };
      const chain = {
        select(c: string) {
          q.cols = c;
          return chain;
        },
        update(p: Record<string, unknown>) {
          q.patch = p;
          return chain;
        },
        eq: () => chain,
        in: () => chain,
        maybeSingle: () => chain,
        single: () => chain,
        then(res: (v: unknown) => unknown, rej: (e: unknown) => unknown) {
          seen.push({ ...q });
          const badSel = !hasCols && NEW.some((k) => q.cols.includes(k));
          const badPatch = !hasCols && !!q.patch && NEW.some((k) => k in q.patch!);
          const out = badPatch
            ? { data: null, error: { code: "PGRST204", message: "Could not find the 'que_tinh' column of 'kairos_profiles' in the schema cache" } }
            : badSel
              ? { data: null, error: { code: "42703", message: "column kairos_profiles.cover_path does not exist" } }
              : { data: { ...row, ...(q.patch ?? {}) }, error: null };
          return Promise.resolve(out).then(res, rej);
        },
      };
      return chain;
    },
    storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `https://k/${p}` } }) }) },
  };
}

describe("kho Supabase — deploy đi trước migration 0067", () => {
  it("cột chưa có: đọc hồ sơ vẫn ra (trường mới undefined), lần sau đọc thẳng cột gốc", async () => {
    const db = fakeDb(false);
    h.db = db;
    const s = createKairosSupabaseStore()!;
    const p = await s.profileByPhone("0901");
    expect(p?.handle).toBe("Bà con 0901");
    expect(p?.cover_path).toBeUndefined();
    const n = db.seen.length;
    await s.profileById(p!.id);
    expect(db.seen.slice(n).every((q) => !q.cols.includes("cover_path"))).toBe(true); // nhớ cột thiếu, không hỏi lại mỗi lượt
  });
  it("cột chưa có: ghi trường mới ⇒ KairosError fields_missing (503); ghi trường cũ vẫn được", async () => {
    h.db = fakeDb(false);
    const s = createKairosSupabaseStore()!;
    await expect(s.updateProfile("0901", { que_tinh: "hue" })).rejects.toMatchObject({ code: "fields_missing" });
    await expect(s.updateProfile("0901", { show_boat: true })).resolves.toMatchObject({ show_boat: true });
  });
  it("cột đã có: đọc đủ trường mới", async () => {
    h.db = fakeDb(true);
    const s = createKairosSupabaseStore()!;
    expect((await s.profileByPhone("0901"))?.que_tinh).toBe("hue");
  });
});
