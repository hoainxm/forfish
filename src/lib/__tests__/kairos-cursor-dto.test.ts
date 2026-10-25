import { describe, it, expect } from "vitest";
import { decodeCursor, encodeCursor, pageOf } from "@/lib/kairos/cursor";
import { authorDto, postDto, type CommentRow, type DtoCtx, type PostRow, type ProfileRow } from "@/lib/kairos/dto";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("cursor — phân trang (published_at, id)", () => {
  it("mã rồi giải ra đúng", () => {
    const c = { at: "2026-10-23T01:02:03.000Z", id: id(7) };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
  });

  it("chuỗi lạ / hỏng ⇒ null (route coi như trang đầu)", () => {
    for (const s of [null, "", "!!!", "abc", encodeCursor({ at: "2026-10-23T00:00:00Z", id: id(1) }).slice(0, 10), "x".repeat(200)]) {
      expect(decodeCursor(s)).toBeNull();
    }
    expect(decodeCursor(Buffer.from("2026-10-23|khong-phai-uuid").toString("base64url"))).toBeNull();
  });

  it("cuộn hết dòng tin không lặp, không sót — kể cả bài cùng giờ", () => {
    const at = (n: number) => new Date(Date.parse("2026-10-23T00:00:00Z") + Math.floor(n / 3) * 1000).toISOString();
    const rows = Array.from({ length: 47 }, (_, n) => ({ at: at(n), id: id(n) })).sort(
      (a, b) => Date.parse(b.at) - Date.parse(a.at) || (a.id < b.id ? 1 : -1),
    );
    const seen: string[] = [];
    let cur: string | null = null;
    let pages = 0;
    do {
      const pg: { items: { at: string; id: string }[]; next: string | null } = pageOf(rows, (r) => r, decodeCursor(cur), 20);
      seen.push(...pg.items.map((r) => r.id));
      cur = pg.next;
      pages++;
    } while (cur && pages < 10);
    expect(pages).toBe(3);
    expect(seen).toEqual(rows.map((r) => r.id));
  });

  it("bài mới chen vào đầu không làm trang sau lặp bài", () => {
    const rows = Array.from({ length: 30 }, (_, n) => ({ at: new Date(1e12 - n * 1000).toISOString(), id: id(n) }));
    const p1 = pageOf(rows, (r) => r, null, 20);
    const withNew = [{ at: new Date(1e12 + 5000).toISOString(), id: id(99) }, ...rows];
    const p2 = pageOf(withNew, (r) => r, decodeCursor(p1.next), 20);
    expect(p2.items.map((r) => r.id)).toEqual(rows.slice(20).map((r) => r.id));
    expect(p2.next).toBeNull();
  });

  it("bình luận tăng dần", () => {
    const rows = Array.from({ length: 5 }, (_, n) => ({ at: new Date(1e12 + n).toISOString(), id: id(n) }));
    const p1 = pageOf(rows, (r) => r, null, 3, "asc");
    const p2 = pageOf(rows, (r) => r, decodeCursor(p1.next), 3, "asc");
    expect([...p1.items, ...p2.items].map((r) => r.id)).toEqual(rows.map((r) => r.id));
  });
});

describe("dto — SĐT không bao giờ ra client (AC21)", () => {
  const ME = "0901234567";
  const HIM = "0987654321";
  const profiles = new Map<string, ProfileRow>([
    [ME, { id: id(1), phone: ME, handle: "Tư Sa Huỳnh", avatar_path: `${id(1)}/${id(9)}.jpg`, show_boat: true, official: false }],
    [HIM, { id: id(2), phone: HIM, handle: "Ba Lý Sơn", avatar_path: null, show_boat: false, official: false }],
  ]);
  const ctx: DtoCtx = {
    viewer: ME,
    profiles,
    sublines: new Map([[ME, "Cảng Sa Huỳnh"]]),
    boats: new Map([[ME, "QNg-90123-TS"], [HIM, "QNg-11111-TS"]]),
    mediaUrl: (p) => `https://cdn.example/kairos-media/${p}`,
    hayPosts: new Set([id(50)]),
  };
  const row = (over: Partial<PostRow> = {}): PostRow => ({
    id: id(50),
    kind: "ba-con",
    author_phone: HIM,
    outlet: null,
    url: null,
    title: null,
    body: "Cá về nhiều",
    summary: null,
    summary_by: null,
    cover_url: null,
    images: [`${id(2)}/${id(8)}.jpg`],
    topic: "nghe-ca",
    regions: ["mien-trung"],
    provinces: ["quang-ngai"],
    ports: ["sa-huynh"],
    reshare_of: null,
    pinned_until: null,
    hay_count: 3,
    comment_count: 1,
    published_at: "2026-10-23T00:00:00Z",
    edited_at: null,
    ...over,
  });
  const comment: CommentRow = { id: id(60), post_id: id(50), parent_id: null, author_phone: ME, body: "hay", hay_count: 0, created_at: "2026-10-23T00:01:00Z" };

  it("JSON bài + bình luận + bài gốc không chứa SĐT nào", () => {
    const dto = postDto(row({ reshare_of: id(51) }), ctx, { topComments: [comment], reshare: row({ id: id(51), author_phone: ME }) });
    const json = JSON.stringify(dto);
    expect(json).not.toContain(ME);
    expect(json).not.toContain(HIM);
    expect(json).not.toMatch(/phone/i);
  });

  it("mine/hayByMe tính ở máy chủ, chỉ trả boolean", () => {
    const dto = postDto(row(), ctx, { topComments: [comment] });
    expect(dto.mine).toBe(false);
    expect(dto.hayByMe).toBe(true);
    expect(dto.topComments[0].mine).toBe(true);
    expect(postDto(row(), { ...ctx, viewer: null }).mine).toBe(false);
  });

  it("số hiệu tàu chỉ hiện khi chủ bật", () => {
    expect(authorDto(ME, ctx).boatReg).toBe("QNg-90123-TS");
    expect(authorDto(HIM, ctx).boatReg).toBeUndefined();
  });

  it("đường kho ⇒ URL công khai; bài báo không có tác giả", () => {
    expect(postDto(row(), ctx).images).toEqual([`https://cdn.example/kairos-media/${id(2)}/${id(8)}.jpg`]);
    expect(postDto(row({ kind: "bao", author_phone: null, outlet: "VnExpress" }), ctx).author).toBeNull();
  });

  it("bài gốc không còn ⇒ reshareGone", () => {
    const d = postDto(row({ reshare_of: id(51) }), ctx, { reshare: null });
    expect(d.reshareOf).toBeNull();
    expect(d.reshareGone).toBe(true);
  });

  it("thiếu hồ sơ ⇒ 'Bà con' ẩn danh, không lộ SĐT", () => {
    const a = authorDto("0911222333", ctx);
    expect(a.handle).toBe("Bà con");
    expect(JSON.stringify(a)).not.toContain("0911222333");
  });
});
