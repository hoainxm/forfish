// @vitest-environment jsdom
// Rà FB vòng 2 (2026-10-24) — bình luận (trả lời không chèn @tên, gập luồng, thứ tự giờ) +
// khung soạn (hỏi khi đóng, nháp kèm ảnh).
import { beforeEach, describe, expect, it } from "vitest";
import {
  bocTienTo,
  ghepTraLoi,
  khungCoThayDoi,
  replyTarget,
  threadComments,
  traLoiHien,
} from "@/lib/kairos/social";
import { loadDraft, loadDraftFull, saveDraft } from "@/lib/kairos/write-client";
import { draftSlot, KAIROS_DRAFT_KEY } from "@/lib/kairos/cache";
import type { KairosComment } from "@/lib/kairos/types";

const cm = (id: string, parentId: string | null = null, at = "2026-10-23T00:00:00Z", handle = "Ba Tư"): KairosComment => ({
  id,
  postId: "p",
  parentId,
  author: { profileId: `pid-${id}`, handle, subline: "", avatarUrl: null, official: false },
  body: `bl ${id}`,
  hayCount: 0,
  hayByMe: false,
  createdAt: at,
  mine: false,
});

describe("trả lời — ô không chèn @tên, ghép lúc gửi", () => {
  const goc = cm("a", null, undefined, "Ba Tư");
  const traLoi = cm("a1", "a", undefined, "Út Sa Huỳnh");

  it("huỷ trả lời: chữ giữ nguyên, gửi như bình luận gốc", () => {
    expect(ghepTraLoi("cá về nhiều", null, false)).toBe("cá về nhiều");
  });
  it("đổi người trả lời: chỉ tiền tố của người SAU CÙNG, chữ đang gõ giữ nguyên", () => {
    const t1 = replyTarget(traLoi);
    const t2 = replyTarget(cm("a2", "a", undefined, "Năm Lý Sơn"));
    expect(ghepTraLoi("đúng rồi", { handle: "Năm Lý Sơn" }, !!t2.prefix)).toBe("@Năm Lý Sơn đúng rồi");
    expect(ghepTraLoi("đúng rồi", { handle: "Út Sa Huỳnh" }, !!t1.prefix)).toBe("@Út Sa Huỳnh đúng rồi");
  });
  it("trả lời bình luận gốc: không thêm @tên", () => {
    const t = replyTarget(goc);
    expect(t).toEqual({ parentId: "a", prefix: "" });
    expect(ghepTraLoi("cảm ơn", { handle: "Ba Tư" }, !!t.prefix)).toBe("cảm ơn");
  });
  it("trả lời một trả lời: thêm @tên một lần, không nhân đôi", () => {
    const t = replyTarget(traLoi);
    expect(t.parentId).toBe("a");
    expect(ghepTraLoi("cảm ơn", { handle: "Út Sa Huỳnh" }, !!t.prefix)).toBe("@Út Sa Huỳnh cảm ơn");
    expect(ghepTraLoi("@Út Sa Huỳnh cảm ơn", { handle: "Út Sa Huỳnh" }, true)).toBe("@Út Sa Huỳnh cảm ơn");
  });
  it("nháp cũ lỡ chèn @tên: bóc đúng tên đã biết (tên có dấu cách), lạ thì để nguyên", () => {
    expect(bocTienTo("@Út Sa Huỳnh chào", ["Ba Tư", "Út Sa Huỳnh", "Út"])).toBe("chào");
    expect(bocTienTo("@Ai Đó chào", ["Ba Tư"])).toBe("@Ai Đó chào");
    expect(bocTienTo("chào", ["Ba Tư"])).toBe("chào");
  });
});

describe("gập luồng 'Xem N phản hồi'", () => {
  const [t] = threadComments([cm("a"), cm("a1", "a", "2026-10-23T01:00:00Z"), cm("a2", "a", "2026-10-23T02:00:00Z")]);
  it("≥2 trả lời ⇒ mặc định gập hết", () => {
    expect(traLoiHien(t, new Set())).toEqual([]);
  });
  it("bung (luồng trong Set) ⇒ hiện hết theo giờ", () => {
    expect(traLoiHien(t, new Set(["a"])).map((c) => c.id)).toEqual(["a1", "a2"]);
  });
  it("trỏ tới một trả lời (#bl-<id>) ⇒ bung luồng đó; trỏ chỗ khác thì vẫn gập", () => {
    expect(traLoiHien(t, new Set(), "a2").length).toBe(2);
    expect(traLoiHien(t, new Set(), "zz")).toEqual([]);
  });
  it("luồng 1 trả lời ⇒ hiện luôn", () => {
    const [one] = threadComments([cm("b"), cm("b1", "b")]);
    expect(traLoiHien(one, new Set()).map((c) => c.id)).toEqual(["b1"]);
  });
});

describe("thứ tự bình luận theo giờ", () => {
  it("trang 1 → chèn bình luận của mình → nối trang 2 cũ hơn: của mình đứng cuối, trang 2 trước nó", () => {
    let list: KairosComment[] = [cm("p1a", null, "2026-10-23T05:00:00Z"), cm("p1b", null, "2026-10-23T06:00:00Z")];
    list = [...list, { ...cm("toi", null, "2026-10-24T08:00:00Z"), mine: true }];
    list = [...list, cm("p2a", null, "2026-10-23T01:00:00Z"), cm("p2b", null, "2026-10-23T02:00:00Z")];
    expect(threadComments(list).map((t) => t.root.id)).toEqual(["p2a", "p2b", "p1a", "p1b", "toi"]);
  });
  it("trả lời trong luồng cũng theo giờ; trùng giờ so id", () => {
    const [t] = threadComments([cm("a"), cm("a9", "a", "2026-10-23T03:00:00Z"), cm("a2", "a", "2026-10-23T01:00:00Z"), cm("a1", "a", "2026-10-23T01:00:00Z")]);
    expect(t.replies.map((c) => c.id)).toEqual(["a1", "a2", "a9"]);
  });
});

describe("khung soạn — hỏi khi đóng", () => {
  it("bài mới: trống ⇒ đóng ngay; có chữ hoặc ảnh ⇒ hỏi", () => {
    expect(khungCoThayDoi("  ", [])).toBe(false);
    expect(khungCoThayDoi("cá", [])).toBe(true);
    expect(khungCoThayDoi("", ["u1"])).toBe(true);
  });
  it("sửa bài: không đổi gì ⇒ đóng ngay; đổi chữ / ảnh ⇒ hỏi", () => {
    const cu = { body: "bài cũ", images: ["u1"] };
    expect(khungCoThayDoi("bài cũ", ["u1"], cu)).toBe(false);
    expect(khungCoThayDoi("bài mới", ["u1"], cu)).toBe(true);
    expect(khungCoThayDoi("bài cũ", [], cu)).toBe(true);
  });
});

describe("nháp kèm ảnh (forfish.kairos.nhap.v1)", () => {
  const A = "0901000001";
  beforeEach(() => localStorage.clear());

  it("Lưu nháp ghi chữ + ảnh, đọc lại đủ; gõ tiếp không làm rơi ảnh", () => {
    expect(saveDraft(A, "bai", "đang viết", 1, ["https://x/a.jpg"])).toBe(true);
    expect(loadDraftFull(A, "bai")).toEqual({ text: "đang viết", images: ["https://x/a.jpg"] });
    expect(saveDraft(A, "bai", "đang viết thêm", 2)).toBe(true);
    expect(loadDraftFull(A, "bai")).toEqual({ text: "đang viết thêm", images: ["https://x/a.jpg"] });
    expect(loadDraft(A, "bai")).toBe("đang viết thêm");
  });
  it("nháp chỉ có ảnh vẫn giữ; Bỏ bài (rỗng + ảnh rỗng) xoá hẳn", () => {
    saveDraft(A, "bai", "", 1, ["https://x/a.jpg"]);
    expect(loadDraftFull(A, "bai")?.images).toEqual(["https://x/a.jpg"]);
    saveDraft(A, "bai", "", 2, []);
    expect(loadDraftFull(A, "bai")).toBeNull();
  });
  it("nháp cũ không có trường ảnh vẫn đọc được", () => {
    localStorage.setItem(KAIROS_DRAFT_KEY, JSON.stringify({ [draftSlot(A, "bai")]: { text: "nháp cũ", at: 1 } }));
    expect(loadDraftFull(A, "bai")).toEqual({ text: "nháp cũ", images: [] });
    expect(loadDraft(A, "bai")).toBe("nháp cũ");
  });
  it("ảnh hỏng trong nháp (không phải chuỗi) bị bỏ, không làm hỏng chữ", () => {
    saveDraft(A, "bai", "chữ", 1);
    const all = JSON.parse(localStorage.getItem(KAIROS_DRAFT_KEY) ?? "{}");
    const k = Object.keys(all)[0];
    all[k].images = [1, null, "https://x/b.jpg"];
    localStorage.setItem(KAIROS_DRAFT_KEY, JSON.stringify(all));
    expect(loadDraftFull(A, "bai")).toEqual({ text: "chữ", images: ["https://x/b.jpg"] });
  });
});
