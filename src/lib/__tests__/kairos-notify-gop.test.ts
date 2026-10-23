import { describe, expect, it } from "vitest";
import { boatExtra } from "@/lib/kairos/author-extra";
import { validateMePatch } from "@/lib/kairos/me-patch";
import { commentRecipients, notifyMessage } from "@/lib/kairos/notify-gop";
import { isBanned, KAIROS_RATES, overLimit, RATE_AUDIT_ACTIONS, rateUsed, windowStart } from "@/lib/kairos/rate";

/*  AC10 (thông báo trả lời), AC12 (hồ sơ, dòng phụ), A1 (trần tần suất). */

const A = "0901000001";
const B = "0901000002";
const C = "0901000003";
const PID = "00000000-0000-4000-8000-0000000000aa";

describe("commentRecipients — ai được báo", () => {
  it("bình luận bài bà con ⇒ báo chủ bài; không tự báo mình", () => {
    expect(commentRecipients({ postKind: "ba-con", postAuthor: A, parentAuthor: null, commenter: B })).toEqual([{ phone: A, why: "post" }]);
    expect(commentRecipients({ postKind: "ba-con", postAuthor: A, parentAuthor: null, commenter: A })).toEqual([]);
  });
  it("trả lời ⇒ báo người được trả lời trước, rồi chủ bài; trùng người ⇒ một tin", () => {
    expect(commentRecipients({ postKind: "ba-con", postAuthor: A, parentAuthor: C, commenter: B })).toEqual([
      { phone: C, why: "reply" },
      { phone: A, why: "post" },
    ]);
    expect(commentRecipients({ postKind: "ba-con", postAuthor: A, parentAuthor: A, commenter: B })).toEqual([{ phone: A, why: "reply" }]);
  });
  it("bài báo / Chính thức không có chủ bà con ⇒ chỉ báo người được trả lời (A8)", () => {
    expect(commentRecipients({ postKind: "bao", postAuthor: null, parentAuthor: null, commenter: B })).toEqual([]);
    expect(commentRecipients({ postKind: "chinh-thuc", postAuthor: "sdvico:chinh-thuc", parentAuthor: C, commenter: B })).toEqual([{ phone: C, why: "reply" }]);
  });
  it("câu chữ có tên gọi, link bài, KHÔNG có SĐT", () => {
    const m = notifyMessage({ phone: A, why: "reply" }, "Ba Sa Huỳnh", PID);
    expect(m.url).toBe(`/kairos/p/${PID}`);
    expect(m.body).toContain("Ba Sa Huỳnh");
    expect(JSON.stringify(m)).not.toContain(A);
  });
});

describe("trần tần suất (A1)", () => {
  it("10 bài/ngày: bài thứ 11 bị chặn; đếm hỏng ⇒ chặn", () => {
    expect(KAIROS_RATES.posts.limit).toBe(10);
    expect(overLimit("posts", 9)).toBe(false);
    expect(overLimit("posts", 10)).toBe(true);
    expect(overLimit("posts", Number.NaN)).toBe(true);
    expect(windowStart("posts", Date.parse("2026-10-23T08:00:00Z"))).toBe("2026-10-22T08:00:00.000Z");
  });
  it("cấm: còn hạn / giờ hỏng ⇒ đang cấm; hết hạn ⇒ không", () => {
    const now = Date.parse("2026-10-23T08:00:00Z");
    expect(isBanned(null, now)).toBe(false);
    expect(isBanned("2026-10-24T00:00:00Z", now)).toBe(true);
    expect(isBanned("2026-10-01T00:00:00Z", now)).toBe(false);
    expect(isBanned("rác", now)).toBe(true);
  });
});

describe("validateMePatch", () => {
  it("tên gọi qua luật ten-goi; tên cấm ⇒ mã lỗi", () => {
    const r = validateMePatch({ handle: "  Ba   Sa Huỳnh " }, PID);
    expect(r.ok && r.value.handle).toEqual({ handle: "Ba Sa Huỳnh", norm: "ba sa huynh" });
    expect(validateMePatch({ handle: "SDVICO thật" }, PID)).toMatchObject({ ok: false, code: "handle_reserved" });
  });
  it("ảnh đại diện phải trong thư mục của chính hồ sơ; null = bỏ ảnh", () => {
    expect(validateMePatch({ avatarPath: `${PID}/00000000-0000-4000-8000-000000000001.jpg` }, PID).ok).toBe(true);
    expect(validateMePatch({ avatarPath: "00000000-0000-4000-8000-0000000000bb/00000000-0000-4000-8000-000000000001.jpg" }, PID)).toEqual({ ok: false, code: "bad_avatar" });
    expect(validateMePatch({ avatarPath: null }, PID)).toEqual({ ok: true, value: { avatarPath: null } });
  });
  it("kiểu sai / rỗng ⇒ 400; acceptRules chỉ nhận true", () => {
    expect(validateMePatch({ showBoat: "có" }, PID)).toEqual({ ok: false, code: "bad_body" });
    expect(validateMePatch({}, PID)).toEqual({ ok: false, code: "bad_body" });
    expect(validateMePatch({ acceptRules: false }, PID)).toEqual({ ok: false, code: "bad_body" });
    expect(validateMePatch({ acceptRules: true, showBoat: true }, PID)).toEqual({ ok: true, value: { acceptRules: true, showBoat: true } });
  });
});

describe("boatExtra — dòng phụ + số hiệu tàu từ sổ tàu đồng bộ", () => {
  const name = (id: string) => (id === "sa-huynh" ? "Sa Huỳnh" : null);
  it("tàu đầu tiên còn sống: Cảng X + số hiệu", () => {
    expect(boatExtra([{ _deleted: true, homePortId: "xx" }, { homePortId: "sa-huynh", maTau: " QNg-90123-TS " }], name)).toEqual({
      subline: "Cảng Sa Huỳnh",
      boatReg: "QNg-90123-TS",
    });
  });
  it("không cảng nhà ⇒ tên cơ sở bên mua; có cảng thì cảng thắng", () => {
    expect(boatExtra(undefined, name, "Vựa cá Bà Tư")).toEqual({ subline: "Vựa cá Bà Tư", boatReg: null });
    expect(boatExtra([{ homePortId: "sa-huynh" }], name, "Vựa cá Bà Tư").subline).toBe("Cảng Sa Huỳnh");
  });
  it("không sổ / sổ hỏng / cảng lạ ⇒ trống, không ném", () => {
    expect(boatExtra(undefined, name)).toEqual({ subline: "", boatReg: null });
    expect(boatExtra("rác", name)).toEqual({ subline: "", boatReg: null });
    expect(boatExtra([{ homePortId: "khong-co" }], name)).toEqual({ subline: "", boatReg: null });
  });
});

describe("rateUsed — xoá bài rồi đăng lại không lách trần", () => {
  it("lấy số lớn hơn giữa bảng và nhật ký", () => {
    expect(rateUsed(2, [10, 0])).toBe(10); // xoá 8 bài: bảng còn 2, nhật ký vẫn 10
    expect(overLimit("posts", rateUsed(2, [10]))).toBe(true);
    expect(rateUsed(5, [])).toBe(5); // nhật ký ghi hỏng ⇒ bảng vẫn chặn
    expect(RATE_AUDIT_ACTIONS.posts).toEqual(["post_create", "post_reshare"]);
  });
});
