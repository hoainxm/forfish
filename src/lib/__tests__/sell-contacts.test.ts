// Gác lib danh bạ "Bán ở đâu" (src/lib/sell-contacts.ts) — model admin quản lý,
// helper thuần + gộp 3 bộ tĩnh làm fallback/seed.
import { describe, expect, it } from "vitest";
import {
  STATIC_SELL_CONTACTS,
  SELL_KINDS,
  defaultSellContactDrafts,
  validateSellContactDraft,
  type SellContactDraft,
} from "@/lib/sell-contacts";

const okDraft = (over: Partial<SellContactDraft> = {}): SellContactDraft => ({
  kind: "vua",
  name: "Vựa cô Ba",
  species: [],
  markets: [],
  direct: false,
  visible: true,
  ...over,
});

describe("STATIC_SELL_CONTACTS (gộp 3 bộ tĩnh)", () => {
  it("có đủ 3 nhóm và nhiều đầu mối", () => {
    expect(STATIC_SELL_CONTACTS.length).toBeGreaterThan(100);
    for (const k of SELL_KINDS) {
      expect(STATIC_SELL_CONTACTS.some((c) => c.kind === k)).toBe(true);
    }
  });
  it("mọi mục có tên + kind hợp lệ + mảng species/markets", () => {
    for (const c of STATIC_SELL_CONTACTS) {
      expect(c.name.trim().length).toBeGreaterThan(0);
      expect(SELL_KINDS).toContain(c.kind);
      expect(Array.isArray(c.species)).toBe(true);
      expect(Array.isArray(c.markets)).toBe(true);
    }
  });
  it("id không trùng", () => {
    const ids = STATIC_SELL_CONTACTS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("defaultSellContactDrafts", () => {
  it("cùng số lượng với STATIC, mỗi draft hợp lệ", () => {
    const drafts = defaultSellContactDrafts();
    expect(drafts.length).toBe(STATIC_SELL_CONTACTS.length);
    for (const d of drafts) expect(validateSellContactDraft(d)).toBeNull();
  });
});

describe("validateSellContactDraft", () => {
  it("chấp nhận draft hợp lệ", () => {
    expect(validateSellContactDraft(okDraft())).toBeNull();
  });
  it("bắt tên trống", () => {
    expect(validateSellContactDraft(okDraft({ name: " " }))).toMatch(/tên/i);
  });
  it("bắt nhóm sai", () => {
    expect(
      validateSellContactDraft(okDraft({ kind: "xxx" as unknown as "vua" })),
    ).toMatch(/nhóm/i);
  });
});
