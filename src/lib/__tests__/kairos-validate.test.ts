import { describe, it, expect } from "vitest";
import { charLen, cleanText, isOwnMediaPath, isUuid, MAX_DISCARD, replyRoot, validateComment, validateDiscard, validatePost, validateReport } from "@/lib/kairos/validate";

const PID = "6f1c2a8e-1111-4222-8333-944455556666";
const OTHER = "7a2d3b9f-2222-4333-8444-a55566667777";
const img = (owner = PID, n = 1) => `${owner}/0000000${n}-aaaa-4bbb-8ccc-dddddddddddd.jpg`;
const ctx = { profileId: PID, portIds: new Set(["sa-huynh", "phan-thiet", "la-gi", "ninh-co"]) };
const post = (over: Record<string, unknown>) => validatePost({ body: "Biển êm, cá nhiều", ...over }, ctx);
const codeOf = (r: { ok: boolean; code?: string }) => (r.ok ? "ok" : r.code);

describe("validatePost — bài bà con", () => {
  it("bài thường hợp lệ, chủ đề mặc định nghe-ca", () => {
    const r = post({});
    expect(r.ok && r.value).toEqual({ body: "Biển êm, cá nhiều", images: [], topic: "nghe-ca", ports: [], reshareOf: null });
  });

  it("2.000 ký tự được, 2.001 ⇒ too_long (đếm ký tự như Postgres)", () => {
    expect(codeOf(post({ body: "á".repeat(2000) }))).toBe("ok");
    expect(codeOf(post({ body: "á".repeat(2001) }))).toBe("too_long");
    expect(charLen("🐟")).toBe(1);
  });

  it("5 ảnh được, 6 ảnh ⇒ too_many_images", () => {
    const five = [1, 2, 3, 4, 5].map((n) => img(PID, n));
    expect(codeOf(post({ images: five }))).toBe("ok");
    expect(codeOf(post({ images: [...five, img(PID, 6)] }))).toBe("too_many_images");
  });

  it("ảnh của người khác / đường lạ ⇒ bad_image", () => {
    expect(codeOf(post({ images: [img(OTHER)] }))).toBe("bad_image");
    expect(codeOf(post({ images: ["../../etc/passwd"] }))).toBe("bad_image");
    expect(codeOf(post({ images: ["https://evil.example/a.jpg"] }))).toBe("bad_image");
    expect(codeOf(post({ images: "abc" }))).toBe("bad_image");
  });

  it("rỗng chữ: được khi có ảnh hoặc đăng lại; không gì ⇒ empty", () => {
    expect(codeOf(post({ body: "   ", images: [img()] }))).toBe("ok");
    expect(codeOf(post({ body: "", reshareOf: OTHER }))).toBe("ok");
    expect(codeOf(post({ body: "  \n " }))).toBe("empty");
    expect(codeOf(validatePost(null, ctx))).toBe("empty");
    expect(codeOf(post({ body: 12 }))).toBe("empty");
  });

  it("chủ đề lạ ⇒ bad_topic; cảng lạ / quá 3 cảng ⇒ bad_port", () => {
    expect(codeOf(post({ topic: "chinh-tri" }))).toBe("bad_topic");
    expect(codeOf(post({ ports: ["khong-co"] }))).toBe("bad_port");
    expect(codeOf(post({ ports: ["sa-huynh", "phan-thiet", "la-gi", "ninh-co"] }))).toBe("bad_port");
    const r = post({ ports: ["sa-huynh", "sa-huynh"], topic: "doi-song" });
    expect(r.ok && r.value.ports).toEqual(["sa-huynh"]);
  });

  it("chữ bậy ⇒ bad_words; xuyên tạc chủ quyền ⇒ sovereignty (chạy ở route)", () => {
    expect(codeOf(post({ body: "đm thời tiết" }))).toBe("bad_words");
    expect(codeOf(post({ body: "Tàu đi Xisha Islands" }))).toBe("sovereignty");
    expect(codeOf(post({ body: "Tàu ra Hoàng Sa đánh cá" }))).toBe("ok");
  });

  it("reshareOf phải là uuid", () => {
    expect(codeOf(post({ reshareOf: "abc" }))).toBe("empty");
  });
});

describe("validateComment", () => {
  it("1.000 ký tự được, 1.001 ⇒ too_long; rỗng ⇒ empty", () => {
    expect(codeOf(validateComment({ body: "a".repeat(1000) }))).toBe("ok");
    expect(codeOf(validateComment({ body: "a".repeat(1001) }))).toBe("too_long");
    expect(codeOf(validateComment({ body: "  " }))).toBe("empty");
    expect(codeOf(validateComment({}))).toBe("empty");
  });
  it("parentId phải là uuid; chữ bậy chặn", () => {
    expect(codeOf(validateComment({ body: "hay", parentId: "x" }))).toBe("empty");
    expect(codeOf(validateComment({ body: "hay", parentId: OTHER }))).toBe("ok");
    expect(codeOf(validateComment({ body: "vcl" }))).toBe("bad_words");
  });
  it("trả lời một trả lời ⇒ gắn vào bình luận gốc", () => {
    expect(replyRoot({ id: "c2", parentId: "c1" })).toBe("c1");
    expect(replyRoot({ id: "c1", parentId: null })).toBe("c1");
  });
});

describe("validateReport", () => {
  it("lý do sẵn + ghi chú ≤200", () => {
    expect(codeOf(validateReport({ targetType: "post", targetId: OTHER, reason: "lua-dao" }))).toBe("ok");
    expect(codeOf(validateReport({ targetType: "post", targetId: OTHER, reason: "ghet" }))).toBe("bad_reason");
    expect(codeOf(validateReport({ targetType: "user", targetId: OTHER, reason: "khac" }))).toBe("bad_reason");
    expect(codeOf(validateReport({ targetType: "comment", targetId: "1", reason: "khac" }))).toBe("bad_reason");
    expect(codeOf(validateReport({ targetType: "post", targetId: OTHER, reason: "khac", note: "a".repeat(201) }))).toBe("too_long");
  });
  it("ghi chú được trích chữ bậy (người trực cần thấy)", () => {
    const r = validateReport({ targetType: "comment", targetId: OTHER, reason: "bay-ba", note: "nó chửi đm" });
    expect(r.ok && r.value.note).toBe("nó chửi đm");
  });
});

describe("cleanText + isUuid", () => {
  it("bỏ ký tự điều khiển/ẩn, giữ xuống dòng, gộp dòng trống", () => {
    expect(cleanText("a​b\u0007\r\n\n\n\nc ")).toBe("ab\n\nc");
  });
  it("uuid", () => {
    expect(isUuid(PID)).toBe(true);
    expect(isUuid("0901234567")).toBe(false);
  });
});

describe("validateDiscard — Huỷ khung soạn xoá ảnh vừa tải", () => {
  it("chỉ ảnh trong thư mục của mình; trùng gộp lại", () => {
    expect(validateDiscard({ paths: [img(), img(), img(PID, 2)] }, PID)).toEqual({ ok: true, value: [img(), img(PID, 2)] });
    expect(isOwnMediaPath(img(), PID.toUpperCase())).toBe(true);
    expect(isOwnMediaPath(img(OTHER), PID)).toBe(false);
  });
  it("một đường lạ ⇒ cả gói 400 (không xoá nửa vời); rỗng / quá trần / không phải mảng ⇒ bad_body", () => {
    expect(codeOf(validateDiscard({ paths: [img(), img(OTHER)] }, PID))).toBe("bad_image");
    expect(codeOf(validateDiscard({ paths: ["../x.jpg"] }, PID))).toBe("bad_image");
    expect(codeOf(validateDiscard({ paths: [] }, PID))).toBe("bad_body");
    expect(codeOf(validateDiscard({ paths: Array.from({ length: MAX_DISCARD + 1 }, () => img()) }, PID))).toBe("bad_body");
    expect(codeOf(validateDiscard(null, PID))).toBe("bad_body");
  });
});
