import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "@/lib/kairos/cursor";
import {
  BAO_FEED_MS, matchFeed, NEW_COUNT_CAP, parseFeedParams, parseSince, pgQuote, postgrestFeedExpr, type FeedFilter, type FilterableRow,
} from "@/lib/kairos/feed-query";

/*  Dòng tin: một bộ lọc, hai cách chạy (PostgREST ở prod, matchFeed ở kho file dev). Ở đây
    giữ luật nền: bài ẩn không lên, bài báo chỉ lên khi agent cho đạt + trong 30 ngày, bài
    người bị chặn bị bỏ, chip lọc đúng. */

const PORTS = new Set(["sa-huynh", "tam-quan"]);
const NOW = Date.parse("2026-10-23T08:00:00.000Z");
const iso = (minAgo: number) => new Date(NOW - minAgo * 60_000).toISOString();
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const sp = (q: string) => new URLSearchParams(q);

const row = (over: Partial<FilterableRow>): FilterableRow => ({
  id: id(1), kind: "ba-con", author_phone: "0901000001", topic: "nghe-ca", ports: [], provinces: [], regions: ["ca-nuoc"],
  hidden: false, mod_state: "cho-kiem", published_at: iso(10), feed_at: iso(10), ...over,
});
const base: FeedFilter = { baoSince: new Date(NOW - BAO_FEED_MS).toISOString() };

describe("parseFeedParams", () => {
  it("mặc định chip Mới, con trỏ hỏng ⇒ trang đầu", () => {
    const r = parseFeedParams(sp("cursor=%%%"), PORTS);
    expect(r).toEqual({ ok: true, value: { chip: "moi", cursor: null, theoDoi: false } });
  });
  it("chip chủ đề ⇒ lọc topic; chip lạ ⇒ 400", () => {
    const r = parseFeedParams(sp("chip=phap-luat"), PORTS);
    expect(r.ok && r.value.topic).toBe("phap-luat");
    expect(parseFeedParams(sp("chip=hot"), PORTS)).toEqual({ ok: false, code: "bad_chip" });
  });
  it("Cảng tôi cần mã cảng trong danh mục; Bến = port không kèm chip", () => {
    expect(parseFeedParams(sp("chip=cang-toi"), PORTS)).toEqual({ ok: false, code: "bad_port" });
    expect(parseFeedParams(sp("chip=cang-toi&port=xx"), PORTS)).toEqual({ ok: false, code: "bad_port" });
    const ben = parseFeedParams(sp("port=sa-huynh"), PORTS);
    expect(ben.ok && ben.value.ports).toEqual(["sa-huynh"]);
  });
  it("Gần tôi: tỉnh tự suy vùng biển; thiếu cả hai ⇒ 400", () => {
    const r = parseFeedParams(sp("chip=gan-toi&province=quang-ninh"), PORTS);
    expect(r.ok && r.value.near).toEqual({ provinces: ["quang-ninh"], regions: ["vinh-bac-bo"] });
    expect(parseFeedParams(sp("chip=gan-toi"), PORTS)).toEqual({ ok: false, code: "bad_area" });
    expect(parseFeedParams(sp("chip=gan-toi&region=bien-dong-xa"), PORTS)).toEqual({ ok: false, code: "bad_area" });
  });
  it("Theo dõi đánh dấu cần SĐT; author phải là uuid (không bao giờ SĐT)", () => {
    const r = parseFeedParams(sp("chip=theo-doi"), PORTS);
    expect(r.ok && r.value.theoDoi).toBe(true);
    expect(parseFeedParams(sp("author=0901000001"), PORTS)).toEqual({ ok: false, code: "bad_author" });
  });
  it("con trỏ hợp lệ được giải", () => {
    const c = encodeCursor({ at: iso(5), id: id(9) });
    const r = parseFeedParams(sp(`cursor=${c}`), PORTS);
    expect(r.ok && r.value.cursor).toEqual(decodeCursor(c));
  });
});

describe("matchFeed — luật nền", () => {
  it("bài ẩn không bao giờ lên", () => {
    expect(matchFeed(row({ hidden: true }), base)).toBe(false);
  });
  it("bài báo chỉ lên khi agent cho đạt VÀ trong 30 ngày; bài bà con hiện ngay", () => {
    expect(matchFeed(row({ kind: "bao", author_phone: null, mod_state: "cho-kiem" }), base)).toBe(false);
    expect(matchFeed(row({ kind: "bao", author_phone: null, mod_state: "nghi" }), base)).toBe(false);
    expect(matchFeed(row({ kind: "bao", author_phone: null, mod_state: "dat" }), base)).toBe(true);
    expect(matchFeed(row({ kind: "bao", author_phone: null, mod_state: "dat", published_at: iso(31 * 24 * 60) }), base)).toBe(false);
    expect(matchFeed(row({ mod_state: "cho-kiem" }), base)).toBe(true);
  });
  it("bài người bị chặn bị bỏ, bài báo (không tác giả) không bị bỏ nhầm", () => {
    const f = { ...base, excludeAuthors: ["0901000001"] };
    expect(matchFeed(row({}), f)).toBe(false);
    expect(matchFeed(row({ kind: "bao", author_phone: null, mod_state: "dat" }), f)).toBe(true);
  });
  it("chip: chủ đề, cảng, Gần tôi (tỉnh HOẶC vùng), tác giả", () => {
    expect(matchFeed(row({ topic: "the-thao" }), { ...base, topic: "nghe-ca" })).toBe(false);
    expect(matchFeed(row({ ports: ["sa-huynh"] }), { ...base, ports: ["sa-huynh"] })).toBe(true);
    expect(matchFeed(row({ ports: [] }), { ...base, ports: ["sa-huynh"] })).toBe(false);
    const near = { ...base, near: { provinces: ["quang-ngai"], regions: ["mien-trung"] } };
    expect(matchFeed(row({ regions: ["mien-trung"] }), near)).toBe(true);
    expect(matchFeed(row({ provinces: ["quang-ngai"], regions: [] }), near)).toBe(true);
    expect(matchFeed(row({ regions: ["tay-nam-bo"] }), near)).toBe(false);
    expect(matchFeed(row({}), { ...base, authors: [] })).toBe(false);
    expect(matchFeed(row({}), { ...base, authors: ["0901000001"] })).toBe(true);
  });
  it("con trỏ (giờ desc, id desc) + newerThan", () => {
    const c = { at: iso(10), id: id(5) };
    expect(matchFeed(row({ feed_at: iso(11) }), { ...base, cursor: c })).toBe(true);
    expect(matchFeed(row({ feed_at: iso(10), id: id(4) }), { ...base, cursor: c })).toBe(true);
    expect(matchFeed(row({ feed_at: iso(10), id: id(6) }), { ...base, cursor: c })).toBe(false);
    expect(matchFeed(row({ feed_at: iso(9) }), { ...base, newerThan: iso(10) })).toBe(true);
    expect(matchFeed(row({ feed_at: iso(10) }), { ...base, newerThan: iso(10) })).toBe(false);
  });
  it("bài báo báo đăng từ lâu nhưng được duyệt SAU mốc since ⇒ vẫn đếm là bài mới (theo feed_at)", () => {
    const late = row({ kind: "bao", author_phone: null, mod_state: "dat", published_at: iso(6 * 60), feed_at: iso(2) });
    expect(matchFeed(late, { ...base, newerThan: iso(10) })).toBe(true);
    expect(postgrestFeedExpr({ ...base, newerThan: iso(10) })).toContain(`feed_at.gt.${pgQuote(iso(10))}`);
  });
});

describe("postgrestFeedExpr — cùng luật, một tham số or=(and(...))", () => {
  it("luôn có điều kiện bài báo đạt + 30 ngày", () => {
    const e = postgrestFeedExpr(base)!;
    expect(e).toBe(`and(or(kind.neq.bao,and(mod_state.eq.dat,published_at.gte.${pgQuote(base.baoSince)})))`);
  });
  it("có chinhSachSince ⇒ bài chinh-sach được cửa sổ riêng (365 ngày), bài báo khác vẫn 30 ngày — cả hai cách chạy", () => {
    const cs = new Date(NOW - 200 * 24 * 3600_000).toISOString();
    const f: FeedFilter = { ...base, chinhSachSince: cs };
    expect(postgrestFeedExpr(f)).toBe(
      `and(or(kind.neq.bao,and(mod_state.eq.dat,or(published_at.gte.${pgQuote(base.baoSince)},and(topic.eq.chinh-sach,published_at.gte.${pgQuote(cs)})))))`,
    );
    const cu = iso(100 * 24 * 60);
    const bao = (topic: string) => row({ kind: "bao", author_phone: null, mod_state: "dat", published_at: cu, feed_at: cu, topic });
    expect(matchFeed(bao("thoi-su"), f)).toBe(false);
    expect(matchFeed(bao("chinh-sach"), f)).toBe(true);
    expect(matchFeed(bao("chinh-sach"), base)).toBe(false);
  });
  it("đủ các vế, giá trị có dấu dành riêng được bọc ngoặc kép", () => {
    const c = { at: iso(10), id: id(5) };
    const e = postgrestFeedExpr({
      ...base, topic: "nghe-ca", ports: ["sa-huynh"], near: { provinces: ["quang-ngai"], regions: ["mien-trung"] },
      excludeAuthors: ["0901000001"], cursor: c,
    })!;
    expect(e).toContain("topic.eq.nghe-ca");
    expect(e).toContain('ports.ov."{sa-huynh}"');
    expect(e).toContain('or(provinces.ov."{quang-ngai}",regions.ov."{mien-trung}")');
    expect(e).toContain('or(author_phone.is.null,author_phone.not.in.("0901000001"))');
    expect(e).toContain(`or(feed_at.lt."${c.at}",and(feed_at.eq."${c.at}",id.lt.${c.id}))`);
    // ngoặc cân
    expect(e.split("(").length).toBe(e.split(")").length);
  });
  it("Theo dõi mà chưa theo dõi ai ⇒ null (khỏi gọi DB, trang trống)", () => {
    expect(postgrestFeedExpr({ ...base, authors: [] })).toBeNull();
  });
  it("pgQuote thoát ngoặc kép và gạch chéo", () => {
    expect(pgQuote('a"b\\c')).toBe('"a\\"b\\\\c"');
  });
});

describe("parseSince", () => {
  it("ISO hợp lệ, kẹp trong 30 ngày, hỏng ⇒ null", () => {
    expect(parseSince(iso(5), NOW)).toBe(iso(5));
    expect(parseSince("2020-01-01T00:00:00Z", NOW)).toBe(new Date(NOW - BAO_FEED_MS).toISOString());
    expect(parseSince("hôm qua", NOW)).toBeNull();
    expect(parseSince(null, NOW)).toBeNull();
    expect(NEW_COUNT_CAP).toBe(99);
  });
});
