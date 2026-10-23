// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  dropComment,
  errorText,
  flipHay,
  mediaPathFromUrl,
  replyTarget,
  settleHay,
  shareLink,
  shareText,
  threadComments,
} from "@/lib/kairos/social";
import { loadDraft, saveDraft } from "@/lib/kairos/write-client";
import { KAIROS_DRAFT_KEY } from "@/lib/kairos/cache";
import type { KairosComment } from "@/lib/kairos/types";

const PID = "11111111-2222-4333-8444-555555555555";
const IMG = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

const cm = (id: string, parentId: string | null = null, handle = "Ba Tư"): KairosComment => ({
  id,
  postId: "p",
  parentId,
  author: { profileId: `pid-${id}`, handle, subline: "", avatarUrl: null, official: false },
  body: `bl ${id}`,
  hayCount: 0,
  hayByMe: false,
  createdAt: "2026-10-23T00:00:00Z",
  mine: false,
});

const fail = (code: string, extra: Record<string, unknown> = {}, status = 400) => ({ ok: false as const, code, status, offline: false, extra });

describe("kairos social — câu lỗi theo mã (14 §10)", () => {
  it("mất sóng luôn nói cần sóng, không nói lỗi máy chủ", () => {
    expect(errorText({ code: "offline", status: 0, offline: true })).toMatch(/Cần sóng/);
  });
  it("mỗi mã khung soạn có câu riêng, nói thật", () => {
    expect(errorText(fail("bad_words"))).toMatch(/chữ không hay/);
    expect(errorText(fail("sovereignty"))).toMatch(/Biển Đông/);
    expect(errorText(fail("sovereignty"))).toMatch(/Hoàng Sa, Trường Sa của Việt Nam/);
    expect(errorText(fail("too_long"), "bai")).toMatch(/2\.000/);
    expect(errorText(fail("too_long"), "binh-luan")).toMatch(/1\.000/);
    expect(errorText(fail("rate_limited", {}, 429))).toMatch(/mai/);
    expect(errorText(fail("rules", {}, 409))).toMatch(/nội quy/);
    expect(errorText(fail("too_many_images"))).toMatch(/5 ảnh/);
  });
  it("cấm kèm ngày, đổi tên kèm ngày được đổi lại", () => {
    expect(errorText(fail("banned", { until: "2026-11-02T03:00:00Z" }, 403))).toMatch(/\d{2}\/11\/2026/);
    expect(errorText(fail("handle_cooldown", { nextAt: "2026-11-20T03:00:00Z" }, 429), "ten")).toMatch(/\d{2}\/11\/2026/);
    expect(errorText(fail("handle_cooldown", {}, 429), "ten")).toBe("30 ngày chỉ đổi tên 1 lần.");
    expect(errorText(fail("handle_taken", {}, 409), "ten")).toMatch(/đã có người dùng/);
  });
  it("401 ⇒ cần đăng nhập; mã lạ ⇒ nói số lỗi + Thử lại", () => {
    expect(errorText(fail("login_required", {}, 401))).toBe("Cần đăng nhập.");
    expect(errorText(fail("internal", {}, 500))).toMatch(/lỗi 500/);
  });
});

describe("kairos social — Hay lạc quan (AC09)", () => {
  it("bật/tắt đổi đếm ngay, không âm", () => {
    expect(flipHay({ hayByMe: false, hayCount: 3 })).toEqual({ hayByMe: true, hayCount: 4 });
    expect(flipHay({ hayByMe: true, hayCount: 0 })).toEqual({ hayByMe: false, hayCount: 0 });
  });
  it("máy chủ ok ⇒ lấy số thật; hỏng ⇒ trả về như trước khi bấm", () => {
    const before = { hayByMe: false, hayCount: 3 };
    expect(settleHay(before, { ok: true, data: { on: true, hayCount: 9 } })).toEqual({ hayByMe: true, hayCount: 9 });
    expect(settleHay(before, fail("rate_limited", {}, 429))).toEqual(before);
    expect(settleHay(before, { ok: false, code: "offline", status: 0, offline: true, extra: {} })).toEqual(before);
  });
});

describe("kairos social — bình luận 1 cấp (AC10)", () => {
  it("gom trả lời dưới gốc, giữ thứ tự đến; trả lời mồ côi đứng như gốc", () => {
    const t = threadComments([cm("a"), cm("b"), cm("a1", "a"), cm("x1", "x"), cm("a2", "a")]);
    expect(t.map((x) => x.root.id)).toEqual(["a", "b", "x1"]);
    expect(t[0].replies.map((r) => r.id)).toEqual(["a1", "a2"]);
  });
  it("trùng id (trang chồng) chỉ giữ một", () => {
    expect(threadComments([cm("a"), cm("a")]).length).toBe(1);
  });
  it("trả lời một trả lời ⇒ về gốc kèm @tên; trả lời gốc ⇒ không chèn", () => {
    expect(replyTarget(cm("a"))).toEqual({ parentId: "a", prefix: "" });
    expect(replyTarget(cm("a1", "a", "Út Sa Huỳnh"))).toEqual({ parentId: "a", prefix: "@Út Sa Huỳnh " });
  });
  it("xoá gốc bỏ luôn trả lời con", () => {
    expect(dropComment([cm("a"), cm("a1", "a"), cm("b")], "a").map((c) => c.id)).toEqual(["b"]);
    expect(dropComment([cm("a"), cm("a1", "a")], "a1").map((c) => c.id)).toEqual(["a"]);
  });
});

describe("kairos social — chia sẻ (AC11)", () => {
  it("link /k/[id], bản native dùng host API", () => {
    expect(shareLink("abc", "https://sdfish.vn/", "")).toBe("https://sdfish.vn/k/abc");
    expect(shareLink("abc", "capacitor://localhost", "https://app.sdfish.vn")).toBe("https://app.sdfish.vn/k/abc");
  });
  it("chữ kèm link: tên báo + tiêu đề / tên gọi + đầu bài, cắt 120 ký tự", () => {
    expect(shareText({ kind: "bao", title: "Cấm biển do bão", body: "", summary: null, outlet: "VnExpress", author: null })).toBe(
      "VnExpress: Cấm biển do bão",
    );
    const long = shareText({ kind: "ba-con", title: null, body: "á".repeat(300), summary: null, outlet: null, author: cm("a").author });
    expect([...long].length).toBeLessThanOrEqual("Ba Tư: ".length + 118);
    expect(long.endsWith("…")).toBe(true);
    expect(shareText({ kind: "chinh-thuc", title: null, body: "", summary: null, outlet: null, author: null })).toBe("SDVICO trên Kairos");
  });
  it("chữ chia sẻ không mang SĐT trong dữ liệu (chỉ tên gọi)", () => {
    const t = shareText({ kind: "ba-con", title: null, body: "Cá về nhiều", summary: null, outlet: null, author: cm("a").author });
    expect(t).not.toMatch(/0\d{9}/);
  });
});

describe("kairos social — URL ảnh ⇒ đường kho (sửa bài giữ ảnh)", () => {
  it("Supabase public URL và URL kho dev", () => {
    expect(mediaPathFromUrl(`https://x.supabase.co/storage/v1/object/public/kairos-media/${PID}/${IMG}.jpg`)).toBe(`${PID}/${IMG}.jpg`);
    expect(mediaPathFromUrl(`/api/dev/kairos-media/${PID}__${IMG}.webp`)).toBe(`${PID}/${IMG}.webp`);
    expect(mediaPathFromUrl(`https://x/kairos-media/${PID}/${IMG}.png?t=1`)).toBe(`${PID}/${IMG}.png`);
  });
  it("lạ ⇒ null", () => {
    expect(mediaPathFromUrl("https://bao.vn/anh.jpg")).toBeNull();
    expect(mediaPathFromUrl(`/x/${PID}/${IMG}.gif`)).toBeNull();
  });
});

describe("kairos nháp chữ (forfish.kairos.nhap.v1)", () => {
  beforeEach(() => localStorage.clear());
  it("ghi, đọc lại, chữ rỗng thì xoá", () => {
    const A = "0901000001";
    expect(saveDraft(A, "bl:p1", "đang viết dở", 1)).toBe(true);
    expect(loadDraft(A, "bl:p1")).toBe("đang viết dở");
    expect(loadDraft("0901000002", "bl:p1")).toBe(""); // máy chung: người sau không thấy nháp
    expect(loadDraft(null, "bl:p1")).toBe("");
    expect(saveDraft(A, "bl:p1", "  ", 2)).toBe(true);
    expect(loadDraft(A, "bl:p1")).toBe("");
    expect(Object.keys(JSON.parse(localStorage.getItem(KAIROS_DRAFT_KEY) ?? "{}"))).toEqual([]);
  });
  it("máy không ghi được ⇒ trả false (màn báo, không nuốt)", () => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
    try {
      expect(saveDraft(null, "bai", "chữ", 1)).toBe(false);
    } finally {
      Storage.prototype.setItem = orig;
    }
  });
});
