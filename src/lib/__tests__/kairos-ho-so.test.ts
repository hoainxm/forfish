import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { aboutDto } from "@/lib/kairos/dto";
import {
  addMoiTen, GIOI_THIEU_MAX, gridPhotos, isDefaultHandle, NGHE, ngheName, parseMoiTen, samePort, shouldAskName, tinhName, TINH_LIST,
} from "@/lib/kairos/ho-so";
import { PROVINCES } from "@/lib/kairos/khu-vuc.mjs";
import { validateMePatch } from "@/lib/kairos/me-patch";
import { defaultHandle } from "@/lib/kairos/ten-goi";
import type { KairosPost } from "@/lib/kairos/types";
import { EMPTY_ABOUT, errorText } from "@/lib/kairos/social";

/* TRANG CÁ NHÂN KIỂU FACEBOOK (14 §3.8, AC13 bản 2026-10-24): danh mục nghề/quê khớp 0067,
   luật mời đặt tên, lưới ảnh, cùng cảng, kiểm PATCH /me phần Giới thiệu, DTO Giới thiệu. */

const PID = "00000000-0000-4000-8000-0000000000aa";
const OTHER = "00000000-0000-4000-8000-0000000000bb";
const img = (n: number, who = PID) => `${who}/00000000-0000-4000-8000-${String(n).padStart(12, "0")}.jpg`;
const PORTS = new Set(["sa-huynh", "ly-son"]);

describe("0067 khớp danh mục trong code", () => {
  const sql = readFileSync(path.join(process.cwd(), "supabase/migrations/0067_kairos_ho_so.sql"), "utf8");
  it("check que_tinh có đủ 34 mã tỉnh của khu-vuc.mjs; check nghe có đủ mã NGHE", () => {
    expect(PROVINCES).toHaveLength(34);
    for (const p of PROVINCES) expect(sql).toContain(`'${p.id}'`);
    for (const n of NGHE) expect(sql).toContain(`'${n.id}'`);
  });
  it("chạy lại an toàn + không policy mới + trần giới thiệu 150", () => {
    expect(sql.match(/^\s+add column if not exists/gm)).toHaveLength(5);
    expect(sql).not.toMatch(/create policy/i);
    expect(sql).toContain(`between 1 and ${GIOI_THIEU_MAX}`);
  });
});

describe("danh mục quê / nghề", () => {
  it("tên theo mã; mã lạ ⇒ rỗng", () => {
    expect(tinhName("quang-ngai")).toBe("Quảng Ngãi");
    expect(ngheName("cau-muc")).toBe("Câu mực");
    expect(tinhName("rac")).toBe("");
    expect(ngheName(null)).toBe("");
  });
  it("ô chọn tỉnh xếp theo tên, đủ 34", () => {
    expect(TINH_LIST).toHaveLength(34);
    const names = TINH_LIST.map((t) => t.name);
    expect([...names].sort((a, b) => a.localeCompare(b, "vi"))).toEqual(names);
  });
});

describe("mời đặt tên (tên máy đặt còn nguyên)", () => {
  it("nhận đúng mọi dạng defaultHandle sinh ra", () => {
    expect(isDefaultHandle(defaultHandle(null, "0912345689", () => false)!)).toBe(true);
    expect(isDefaultHandle(defaultHandle(null, "0912345689", (n) => n === "ba con 5689")!)).toBe(true); // "Bà con 5689 2"
    expect(isDefaultHandle(defaultHandle(null, "", () => false)!)).toBe(true); // "Bà con mới"
    expect(isDefaultHandle("Bà con Sa Huỳnh")).toBe(false);
    expect(isDefaultHandle("Tư Sa Huỳnh")).toBe(false);
  });
  it("chỉ mời khi chưa đổi lần nào + tên mặc định + không phải Chính thức", () => {
    expect(shouldAskName({ handle: "Bà con 5689", handle_changed_at: null, official: false })).toBe(true);
    expect(shouldAskName({ handle: "Bà con 5689", handle_changed_at: "2026-10-01T00:00:00Z", official: false })).toBe(false);
    expect(shouldAskName({ handle: "Tư Sa Huỳnh", handle_changed_at: null, official: false })).toBe(false);
    expect(shouldAskName({ handle: "Bà con 5689", handle_changed_at: null, official: true })).toBe(false);
  });
  it("khoá Để sau: hỏng ⇒ []; thêm không trùng, giữ 20 mục mới nhất", () => {
    expect(parseMoiTen(null)).toEqual([]);
    expect(parseMoiTen("{rác")).toEqual([]);
    expect(parseMoiTen('{"a":1}')).toEqual([]);
    expect(parseMoiTen('["a",2,"b"]')).toEqual(["a", "b"]);
    expect(addMoiTen(["a", "b"], "a")).toEqual(["b", "a"]);
    const many = Array.from({ length: 25 }, (_, i) => `p${i}`).reduce<string[]>((l, x) => addMoiTen(l, x), []);
    expect(many).toHaveLength(20);
    expect(many.at(-1)).toBe("p24");
  });
});

describe("lưới ảnh — ảnh trong bài CỦA CHÍNH người đó", () => {
  const post = (id: string, author: string | null, images: string[], reshareOf: KairosPost | null = null): KairosPost =>
    ({
      id, kind: "ba-con", author: author ? { profileId: author, handle: "x", subline: "", avatarUrl: null, official: false } : null,
      images, reshareOf,
    }) as unknown as KairosPost;
  it("theo thứ tự bài, bỏ trùng, bỏ bài người khác, không lấy ảnh bài gốc khi đăng lại", () => {
    const orig = post("o", "khac", ["u9"]);
    const got = gridPhotos([post("a", "me", ["u1", "u2"]), post("b", "khac", ["u3"]), post("c", "me", ["u2", "u4"], orig), post("d", "me", [])], "me");
    expect(got).toEqual([
      { postId: "a", url: "u1" },
      { postId: "a", url: "u2" },
      { postId: "c", url: "u4" },
    ]);
  });
  it("tối đa `max`; không bài ⇒ []", () => {
    expect(gridPhotos([post("a", "me", ["1", "2", "3"])], "me", 2)).toHaveLength(2);
    expect(gridPhotos([], "me")).toEqual([]);
  });
});

describe("cùng cảng", () => {
  it("cả hai có cảng và trùng", () => {
    expect(samePort("sa-huynh", "sa-huynh")).toBe(true);
    expect(samePort("sa-huynh", "ly-son")).toBe(false);
    expect(samePort(null, null)).toBe(false);
    expect(samePort("", "")).toBe(false);
  });
});

describe("validateMePatch — Giới thiệu + ảnh bìa (0067)", () => {
  const ok = (body: unknown) => validateMePatch(body, PID, PORTS);
  it("quê / nghề / cảng nhà theo danh mục; null = xoá; mã lạ ⇒ lỗi riêng", () => {
    expect(ok({ queTinh: "quang-ngai", nghe: "cau-muc", homePort: "sa-huynh" })).toEqual({
      ok: true,
      value: { queTinh: "quang-ngai", nghe: "cau-muc", homePort: "sa-huynh" },
    });
    expect(ok({ queTinh: null, nghe: null, homePort: null })).toEqual({ ok: true, value: { queTinh: null, nghe: null, homePort: null } });
    expect(ok({ queTinh: "quang-nam" })).toEqual({ ok: false, code: "bad_province" }); // tỉnh cũ đã nhập
    expect(ok({ nghe: "ban-ca" })).toEqual({ ok: false, code: "bad_job" });
    expect(ok({ homePort: "khong-co" })).toEqual({ ok: false, code: "bad_port" });
    expect(ok({ homePort: 3 })).toEqual({ ok: false, code: "bad_port" });
  });
  it("giới thiệu: 150 ký tự (đếm như Postgres) được, 151 thì too_long; xuống dòng ⇒ dấu cách; rỗng ⇒ null", () => {
    expect(ok({ gioiThieu: "🐟".repeat(150) }).ok).toBe(true);
    expect(ok({ gioiThieu: "a".repeat(151) })).toEqual({ ok: false, code: "too_long" });
    expect(ok({ gioiThieu: " Đi biển\n\n20 năm " })).toEqual({ ok: true, value: { gioiThieu: "Đi biển 20 năm" } });
    expect(ok({ gioiThieu: "   " })).toEqual({ ok: true, value: { gioiThieu: null } });
    expect(ok({ gioiThieu: null })).toEqual({ ok: true, value: { gioiThieu: null } });
    expect(ok({ gioiThieu: 5 })).toEqual({ ok: false, code: "bad_body" });
  });
  it("giới thiệu lọc chữ bậy + chủ quyền như bài", () => {
    expect(ok({ gioiThieu: "đm thời tiết" })).toMatchObject({ ok: false, code: "bad_words" });
    expect(ok({ gioiThieu: "Hay đi Xisha Islands" })).toMatchObject({ ok: false, code: "sovereignty" });
  });
  it("ảnh bìa phải trong thư mục của chính hồ sơ; null = bỏ", () => {
    expect(ok({ coverPath: img(1) })).toEqual({ ok: true, value: { coverPath: img(1) } });
    expect(ok({ coverPath: img(1, OTHER) })).toEqual({ ok: false, code: "bad_cover" });
    expect(ok({ coverPath: "../x.jpg" })).toEqual({ ok: false, code: "bad_cover" });
    expect(ok({ coverPath: null })).toEqual({ ok: true, value: { coverPath: null } });
  });
  it("không truyền danh mục cảng ⇒ mọi cảng đều lạ (an toàn)", () => {
    expect(validateMePatch({ homePort: "sa-huynh" }, PID)).toEqual({ ok: false, code: "bad_port" });
  });
});

describe("aboutDto + câu lỗi", () => {
  it("cột chưa có (undefined) ⇒ Giới thiệu rỗng, không lỗi", () => {
    expect(aboutDto({}, (p) => `/m/${p}`)).toEqual(EMPTY_ABOUT);
  });
  it("đủ cột ⇒ URL ảnh bìa + mã", () => {
    expect(aboutDto({ cover_path: "a/b.jpg", que_tinh: "hue", nghe: "lan", gioi_thieu: "Thợ lặn", home_port: "ly-son" }, (p) => `/m/${p}`)).toEqual({
      coverUrl: "/m/a/b.jpg",
      queTinh: "hue",
      nghe: "lan",
      gioiThieu: "Thợ lặn",
      homePort: "ly-son",
    });
  });
  it("mã lỗi mới có câu đời thường; too_long của Giới thiệu nói đúng trần 150", () => {
    const e = (code: string, what?: Parameters<typeof errorText>[1]) => errorText({ code, status: 400, offline: false }, what);
    expect(e("too_long", "ho-so")).toContain("150");
    expect(e("bad_province")).toBe("Chọn lại trong danh sách giúp.");
    expect(errorText({ code: "fields_missing", status: 503, offline: false })).toContain("chưa mở");
  });
});
