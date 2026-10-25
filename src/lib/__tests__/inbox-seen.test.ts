import { describe, it, expect, beforeEach } from "vitest";

/* localStorage mock (env node — không jsdom), khớp mẫu inbox-read.test */
const _ls = (() => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  } as unknown as Storage;
})();
(globalThis as unknown as { window: unknown }).window = { localStorage: _ls };
(globalThis as unknown as { localStorage: Storage }).localStorage = _ls;

import {
  BAO_HIEU_LUC_MS,
  CHUA_DOC_TOI_DA_MS,
  INBOX_HIDDEN_KEY,
  INBOX_SEEN_KEY,
  anTin,
  boAnTin,
  chuaDocIds,
  clearInbox,
  linkConHieuLuc,
  loadHidden,
  loadSeen,
  locTinAn,
  markSeen,
  type InboxMessage,
} from "@/lib/inbox";

const NOW = Date.parse("2026-10-25T08:00:00+07:00");
const GIO = 3600000;

function tin(id: string, truocMs: number, url: string | null = null): InboxMessage {
  return { id, title: "t" + id, body: "b", url, sentAt: new Date(NOW - truocMs).toISOString(), mine: false };
}

beforeEach(() => localStorage.clear());

describe("chuaDocIds — chưa thấy VÀ gửi trong 7 ngày", () => {
  it("tin mới chưa thấy ⇒ đếm; đã thấy ⇒ không", () => {
    const list = [tin("a", GIO), tin("b", 2 * GIO)];
    expect([...chuaDocIds(list, new Set(), NOW)].sort()).toEqual(["a", "b"]);
    expect([...chuaDocIds(list, new Set(["a"]), NOW)]).toEqual(["b"]);
  });
  it("tin cũ hơn 7 ngày không đếm dù chưa thấy — số không nói dối về tin hàng tháng", () => {
    const list = [tin("cu", CHUA_DOC_TOI_DA_MS + 1), tin("vua", CHUA_DOC_TOI_DA_MS - 1)];
    expect([...chuaDocIds(list, new Set(), NOW)]).toEqual(["vua"]);
  });
  it("sentAt hỏng ⇒ coi như cũ, không đếm", () => {
    const m = { ...tin("x", 0), sentAt: "rác" };
    expect(chuaDocIds([m], new Set(), NOW).size).toBe(0);
  });
});

describe("markSeen / loadSeen — ghi máy ngay, cách ly tài khoản", () => {
  it("ghi rồi đọc lại đúng ngăn; ngăn khác đọc ra rỗng", () => {
    expect(markSeen("0912345678", ["a", "b"])).toBe(true);
    expect([...loadSeen("0912345678")].sort()).toEqual(["a", "b"]);
    expect([...loadSeen("84912345678")].sort()).toEqual(["a", "b"]); // cùng người, hai cách viết
    expect(loadSeen("0987654321").size).toBe(0);
    expect(loadSeen(null).size).toBe(0);
  });
  it("gọi lại với id đã có ⇒ không ghi thêm, vẫn true; rỗng ⇒ false", () => {
    markSeen("0912345678", ["a"]);
    const truoc = localStorage.getItem(INBOX_SEEN_KEY);
    expect(markSeen("0912345678", ["a"])).toBe(true);
    expect(localStorage.getItem(INBOX_SEEN_KEY)).toBe(truoc);
    expect(markSeen("0912345678", [])).toBe(false);
  });
  it("trần 500 id — cắt id cũ nhất trước", () => {
    const ids = Array.from({ length: 600 }, (_, i) => "m" + i);
    markSeen("0912345678", ids);
    const s = loadSeen("0912345678");
    expect(s.size).toBe(500);
    expect(s.has("m0")).toBe(false);
    expect(s.has("m599")).toBe(true);
  });
  it("sổ rác trong máy ⇒ rỗng, không ném", () => {
    localStorage.setItem(INBOX_SEEN_KEY, "{hỏng");
    expect(loadSeen("0912345678").size).toBe(0);
  });
  it("clearInbox xoá luôn sổ seen + ẩn (máy dùng chung)", () => {
    markSeen("0912345678", ["a"]);
    anTin("0912345678", ["b"]);
    clearInbox();
    expect(localStorage.getItem(INBOX_SEEN_KEY)).toBeNull();
    expect(localStorage.getItem(INBOX_HIDDEN_KEY)).toBeNull();
  });
});

describe("anTin / boAnTin / locTinAn — ẩn tin bằng ⋯, hoàn tác được", () => {
  it("ẩn cả nhóm id, lọc khỏi danh sách vẽ, hoàn tác trả lại", () => {
    const list = [tin("a", GIO), tin("b", GIO), tin("c", GIO)];
    expect(anTin("0912345678", ["a", "b"])).toBe(true);
    const h = loadHidden("0912345678");
    expect(locTinAn(list, h).map((m) => m.id)).toEqual(["c"]);
    expect(boAnTin("0912345678", ["a", "b"])).toBe(true);
    expect(locTinAn(list, loadHidden("0912345678")).map((m) => m.id)).toEqual(["a", "b", "c"]);
  });
  it("không có gì ẩn ⇒ trả bản sao đủ, không đụng mảng gốc", () => {
    const list = [tin("a", GIO)];
    const out = locTinAn(list, new Set());
    expect(out).toEqual(list);
    expect(out).not.toBe(list);
  });
});

describe("linkConHieuLuc — tin bão quá 14 ngày không còn link", () => {
  it("tin thường có url ⇒ còn; không url ⇒ không", () => {
    expect(linkConHieuLuc(tin("a", 30 * 24 * GIO, "/kairos/p/1"), NOW)).toBe(true);
    expect(linkConHieuLuc(tin("b", GIO, null), NOW)).toBe(false);
  });
  it("tin bão trong 14 ngày ⇒ còn; quá 14 ngày ⇒ hết (bản đồ đã nói 'đã tan')", () => {
    const url = "/ngu-truong?bao=gdacs-champi&lat=15&lon=112&t=1";
    expect(linkConHieuLuc(tin("c", BAO_HIEU_LUC_MS - 1, url), NOW)).toBe(true);
    expect(linkConHieuLuc(tin("d", BAO_HIEU_LUC_MS + 1, url), NOW)).toBe(false);
  });
  it("tin bão giờ hỏng ⇒ không link (thà nói ít)", () => {
    const m = { ...tin("e", 0, "/ngu-truong?bao=x"), sentAt: "rác" };
    expect(linkConHieuLuc(m, NOW)).toBe(false);
  });
});
