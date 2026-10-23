import { describe, expect, it } from "vitest";
import { checkIngestKey, effectiveIngestKey } from "@/lib/kairos/ingest-key";
import { INGEST_MAX_ITEMS, parseIngestBody, planIngest, sourceRows, type IngestItem } from "@/lib/kairos/ingest";
import { urlHash } from "@/lib/kairos/lien-ket.mjs";

/*  /api/kairos/nhap: máy chủ KHÔNG tin máy thu — chạy lại chặn trùng, chủ quyền, chủ đề,
    khu vực. Khoá máy GPU: env đè DB, thiếu cả hai ⇒ đóng (503), so thời-gian-hằng. */

const NOW = Date.parse("2026-10-23T08:00:00.000Z");
const PORTS = [{ id: "sa-huynh", name: "Sa Huỳnh", province: "Quảng Ngãi", active: true }];

const item = (over: Partial<IngestItem> = {}): IngestItem => ({
  sourceId: "vnexpress-thoi-su",
  outlet: "VnExpress",
  url: "https://vnexpress.net/tau-ca-gap-nan-1.html",
  title: "Tàu cá Quảng Ngãi gặp nạn, 10 ngư dân được cứu",
  description: "Biên phòng cứu 10 ngư dân trên tàu cá bị chìm.",
  summary: "Mười ngư dân được cứu an toàn sau khi tàu cá bị chìm.",
  summaryBy: "ai",
  coverUrl: null,
  section: "thoi-su",
  publishedAt: new Date(NOW - 3600_000).toISOString(),
  ...over,
});
const ctx = (over: Partial<Parameters<typeof planIngest>[1]> = {}) => ({ seenHashes: new Set<string>(), recentTitles: [], now: NOW, ports: PORTS, ...over });

describe("khoá máy GPU", () => {
  it("env đè DB; rỗng coi như không đặt", () => {
    expect(effectiveIngestKey("env-key", "db-key")).toBe("env-key");
    expect(effectiveIngestKey("  ", "db-key")).toBe("db-key");
    expect(effectiveIngestKey(undefined, null)).toBeNull();
  });
  it("thiếu khoá ⇒ unconfigured (route 503, KHÔNG mở); sai/thiếu header ⇒ bad", () => {
    expect(checkIngestKey("bất kỳ", null)).toBe("unconfigured");
    expect(checkIngestKey(null, "k".repeat(40))).toBe("bad");
    expect(checkIngestKey("k".repeat(39), "k".repeat(40))).toBe("bad");
    expect(checkIngestKey("k".repeat(40), "k".repeat(40))).toBe("ok");
  });
});

describe("parseIngestBody", () => {
  it("mục hỏng bị bỏ và đếm, gói vẫn nhận", () => {
    const r = parseIngestBody({ items: [item(), { url: "x" }, { ...item(), sourceId: "Có Dấu" }] });
    expect(r.ok && r.items.length).toBe(1);
    expect(r.ok && r.invalid).toBe(2);
  });
  it("quá 50 bài/lượt ⇒ 400; không phải object ⇒ 400", () => {
    expect(parseIngestBody({ items: Array.from({ length: INGEST_MAX_ITEMS + 1 }, () => item()) })).toEqual({ ok: false, code: "too_many" });
    expect(parseIngestBody("x")).toEqual({ ok: false, code: "bad_body" });
  });
  it("bóc thẻ HTML khỏi mô tả, summaryBy lạ ⇒ rss", () => {
    const r = parseIngestBody({ items: [{ ...item(), description: "<p>Tin <b>nóng</b></p>", summaryBy: "gpt" }] });
    expect(r.ok && r.items[0].description).toBe("Tin nóng");
    expect(r.ok && r.items[0].summaryBy).toBe("rss");
  });
  it("nguồn sai chủ đề bị bỏ; nguồn hợp lệ ⇒ hàng kairos_sources", () => {
    const r = parseIngestBody({
      items: [],
      sources: [
        { id: "vnexpress-thoi-su", outlet: "VnExpress", feedUrl: "https://vnexpress.net/rss/thoi-su.rss", section: "thoi-su", topic: "thoi-su", ok: true },
        { id: "x-y", outlet: "Báo", feedUrl: "https://a.b/rss", section: "x", topic: "hot", ok: true },
      ],
    });
    expect(r.ok && r.sources.length).toBe(1);
    const rows = sourceRows(r.ok ? r.sources : [], "2026-10-23T08:00:00.000Z");
    expect(rows[0]).toMatchObject({ id: "vnexpress-thoi-su", last_ok_at: "2026-10-23T08:00:00.000Z", last_error: null });
  });
});

describe("planIngest", () => {
  it("bài sạch ⇒ bao ở cho-kiem, chủ đề nâng lên Nghề cá, gắn tỉnh", () => {
    const p = planIngest([item()], ctx());
    expect(p.stats.nhan).toBe(1);
    const post = p.posts[0];
    expect(post.kind).toBe("bao");
    expect(post.mod_state).toBe("cho-kiem");
    expect(post.topic).toBe("nghe-ca");
    expect(post.provinces).toContain("quang-ngai");
    expect(post.summary_by).toBe("ai");
    expect(p.seen[0].outcome).toBe("nhan");
  });
  it("trùng link (kho hoặc ngay trong gói) bỏ vĩnh viễn — kể cả khác utm/amp", () => {
    const h = urlHash(item().url)!;
    expect(planIngest([item()], ctx({ seenHashes: new Set([h]) })).stats.trungLink).toBe(1);
    const twice = planIngest([item(), item({ url: "http://www.vnexpress.net/tau-ca-gap-nan-1.html?utm_source=fb", title: "Khác hẳn tiêu đề cho đủ dài" })], ctx());
    expect(twice.stats).toMatchObject({ nhan: 1, trungLink: 1 });
  });
  it("trùng tiêu đề trong 7 ngày ⇒ ghi sổ trung-tieu-de, không thành bài", () => {
    const p = planIngest(
      [item({ url: "https://tuoitre.vn/khac.htm" })],
      ctx({ recentTitles: [{ titleNorm: "tau ca quang ngai gap nan 10 ngu dan duoc cuu", firstSeenAt: new Date(NOW - 86400_000).toISOString() }] }),
    );
    expect(p.posts).toHaveLength(0);
    expect(p.seen[0].outcome).toBe("trung-tieu-de");
  });
  it("chủ quyền ở tiêu đề/mô tả ⇒ loại + ghi cụm trúng", () => {
    const p = planIngest([item({ description: "Tàu Trung Quốc hoạt động ở South China Sea." })], ctx());
    expect(p.posts).toHaveLength(0);
    expect(p.stats.chuQuyen).toBe(1);
    expect(p.seen[0]).toMatchObject({ outcome: "loai-chu-quyen" });
    expect(p.seen[0].flag_term).toBeTruthy();
  });
  it("tóm tắt AI trúng cờ chủ quyền ⇒ lùi về mô tả RSS (cắt 300)", () => {
    const p = planIngest([item({ summary: "Ngư dân bị nạn gần quần đảo Tây Sa.", description: "D".repeat(400) })], ctx());
    expect(p.posts[0].summary_by).toBe("rss");
    expect(p.posts[0].summary).toHaveLength(300);
  });
  it("giờ đăng ở tương lai xa / quá cũ ⇒ giờ nhận", () => {
    const fut = planIngest([item({ publishedAt: new Date(NOW + 5 * 3600_000).toISOString() })], ctx());
    expect(fut.posts[0].published_at).toBe(new Date(NOW).toISOString());
    const old = planIngest([item({ publishedAt: "2020-01-01T00:00:00.000Z" })], ctx());
    expect(old.posts[0].published_at).toBe(new Date(NOW).toISOString());
  });
  it("link hỏng ⇒ bỏ, không băm", () => {
    expect(planIngest([item({ url: "javascript:alert(1)" })], ctx()).stats.linkHong).toBe(1);
  });
});
