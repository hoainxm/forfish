import { describe, expect, it } from "vitest";
import { AUTH_PER_PAGE, PAGE, eachAuthUser, readAll } from "../supabase/read-all";

/** bảng giả N dòng, mỗi câu trả tối đa PAGE dòng như PostgREST */
const table = (n: number) => {
  const calls: [number, number][] = [];
  const build = async (from: number, to: number) => {
    calls.push([from, to]);
    const rows = [];
    for (let i = from; i <= Math.min(to, PAGE + from - 1) && i < n; i++) rows.push({ i });
    return { data: rows, error: null };
  };
  return { build, calls };
};

describe("readAll", () => {
  it("đọc đủ bảng lớn hơn 1000 dòng (lỗi 2026-11-06: 11 046 chỉ hiện 1000)", async () => {
    const t = table(11046);
    const r = await readAll<{ i: number }>(t.build);
    expect(r?.rows.length).toBe(11046);
    expect(r?.truncated).toBe(false);
    expect(new Set(r?.rows.map((x) => x.i)).size).toBe(11046);
  });

  it("đúng bội số 1000 ⇒ dừng ở trang rỗng, không thừa quá một cửa sổ", async () => {
    const t = table(2000);
    const r = await readAll(t.build);
    expect(r?.rows.length).toBe(2000);
    expect(t.calls.length).toBe(1 + 4); // trang đầu + một cửa sổ 4 trang song song
  });

  it("bảng nhỏ chỉ đúng MỘT câu", async () => {
    const t = table(300);
    await readAll(t.build);
    expect(t.calls.length).toBe(1);
  });

  it("song song nhưng giữ đúng thứ tự dòng", async () => {
    const calls: number[] = [];
    // trang sau trả NHANH hơn trang trước — kết quả vẫn phải theo thứ tự trang
    const build = async (from: number, to: number) => {
      calls.push(from);
      await new Promise((ok) => setTimeout(ok, 20 - Math.min(from / PAGE, 19)));
      const rows = [];
      for (let i = from; i <= to && i < 5500; i++) rows.push({ i });
      return { data: rows, error: null };
    };
    const r = await readAll<{ i: number }>(build);
    expect(r?.rows.map((x) => x.i)).toEqual(Array.from({ length: 5500 }, (_, i) => i));
  });

  it("một trang trong cửa sổ lỗi ⇒ null", async () => {
    const build = async (from: number) =>
      from === 2 * PAGE
        ? { data: null, error: { code: "x" } }
        : { data: Array.from({ length: PAGE }, () => ({})), error: null };
    expect(await readAll(build)).toBeNull();
  });

  it("bảng rỗng", async () => {
    expect(await readAll(table(0).build)).toEqual({ rows: [], truncated: false });
  });

  it("chạm trần trang ⇒ truncated", async () => {
    const r = await readAll(table(5000).build, 3);
    expect(r).toMatchObject({ truncated: true });
    expect(r?.rows.length).toBe(3000);
  });

  it("lỗi hoặc ném ⇒ null", async () => {
    expect(await readAll(async () => ({ data: null, error: { code: "x" } }))).toBeNull();
    expect(
      await readAll(async () => {
        throw new Error("mạng");
      }),
    ).toBeNull();
  });
});

describe("eachAuthUser", () => {
  const users = (n: number) =>
    async ({ page, perPage }: { page: number; perPage: number }) => {
      const out = [];
      for (let i = (page - 1) * perPage; i < Math.min(page * perPage, n); i++)
        out.push({ email: `${i}@x`, created_at: "" });
      return { data: { users: out }, error: null };
    };

  it("duyệt hết 13 392 user (trần cũ 4 000)", async () => {
    let n = 0;
    const r = await eachAuthUser(users(13392), () => {
      n++;
    });
    expect(n).toBe(13392);
    expect(r).toEqual({ truncated: false, stopped: false });
  });

  it("visit trả true ⇒ dừng sớm", async () => {
    let n = 0;
    const r = await eachAuthUser(users(5000), (u) => {
      n++;
      return u.email === `${AUTH_PER_PAGE + 5}@x`;
    });
    expect(r.stopped).toBe(true);
    expect(n).toBe(AUTH_PER_PAGE + 6);
  });

  it("lỗi ⇒ ném", async () => {
    await expect(
      eachAuthUser(async () => ({ data: { users: [] }, error: new Error("x") }), () => {}),
    ).rejects.toThrow();
  });
});
