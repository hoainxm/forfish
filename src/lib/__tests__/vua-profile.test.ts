import { describe, expect, it } from "vitest";

import {
  chuyenTrangThaiAdmin,
  doiOChinh,
  isVuaAdminAction,
  isVuaKind,
  isVuaStatus,
  nhomDauMoi,
  parseVuaBody,
  tachLoai,
  trangThaiKhiLuu,
  VUA_KIND_LABEL,
  VUA_KINDS,
  VUA_MAX,
  vuaThanhDauMoi,
  type VuaDraft,
} from "@/lib/vua-profile";

const HOP_LE = {
  name: "Vựa Tư Hải",
  kind: "vua",
  province: "Quảng Ngãi",
  address: "Cảng Sa Huỳnh",
  species: "cá ngừ, mực",
  hours: "4 giờ – 9 giờ sáng",
  contact: "+84 905 123 456",
};

const ban = (over: Partial<VuaDraft> = {}): VuaDraft => ({
  name: "Vựa Tư Hải",
  kind: "vua",
  province: "Quảng Ngãi",
  address: "Cảng Sa Huỳnh",
  species: ["cá ngừ"],
  hours: null,
  contact: "0905123456",
  ...over,
});

describe("loại hồ sơ vựa — khớp check của vua_profiles (0079)", () => {
  it("bốn loại, nhãn đời thường", () => {
    expect([...VUA_KINDS]).toEqual(["vua", "nau", "nha-may", "cho"]);
    expect(VUA_KIND_LABEL).toEqual({ vua: "Vựa", nau: "Nậu", "nha-may": "Nhà máy", cho: "Chợ" });
    expect(isVuaKind("nau")).toBe(true);
    for (const v of ["", "nhamay", "Vua", null, 3]) expect(isVuaKind(v)).toBe(false);
  });
  it("trạng thái đúng bốn mã", () => {
    for (const s of ["cho_duyet", "hoat_dong", "tu_choi", "tam_khoa"]) expect(isVuaStatus(s)).toBe(true);
    expect(isVuaStatus("open")).toBe(false);
  });
  it("vựa + nậu vào mục Nậu vựa, nhà máy, chợ vào mục riêng", () => {
    expect(nhomDauMoi("vua")).toBe("vua");
    expect(nhomDauMoi("nau")).toBe("vua");
    expect(nhomDauMoi("nha-may")).toBe("nhamay");
    expect(nhomDauMoi("cho")).toBe("cho");
  });
});

describe("parseVuaBody — ranh giới", () => {
  it("bản hợp lệ: cắt khoảng trắng, tách loài, chuẩn hoá SĐT", () => {
    const r = parseVuaBody({ ...HOP_LE, name: "  Vựa   Tư Hải  " });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.name).toBe("Vựa Tư Hải");
    expect(r.value.species).toEqual(["cá ngừ", "mực"]);
    expect(r.value.contact).toBe("0905123456");
  });
  it("ô trống ⇒ null, SĐT trống ⇒ null (route điền SĐT tài khoản)", () => {
    const r = parseVuaBody({ name: "Nậu Ba", kind: "nau", province: " ", contact: "" });
    expect(r).toEqual({
      ok: true,
      value: { name: "Nậu Ba", kind: "nau", province: null, address: null, species: [], hours: null, contact: null },
    });
  });
  it("tên 3–60 chữ", () => {
    expect(parseVuaBody({ ...HOP_LE, name: "ab" })).toMatchObject({ ok: false, field: "name" });
    expect(parseVuaBody({ ...HOP_LE, name: "x".repeat(61) })).toMatchObject({ ok: false, field: "name" });
    expect(parseVuaBody({ ...HOP_LE, name: "x".repeat(60) }).ok).toBe(true);
  });
  it("loại lạ bị chặn", () => {
    expect(parseVuaBody({ ...HOP_LE, kind: "dai-ly" })).toMatchObject({ ok: false, field: "kind" });
  });
  it("tỉnh ≤40, địa chỉ ≤200, giờ ≤60", () => {
    expect(parseVuaBody({ ...HOP_LE, province: "x".repeat(41) })).toMatchObject({ field: "province" });
    expect(parseVuaBody({ ...HOP_LE, address: "x".repeat(201) })).toMatchObject({ field: "address" });
    expect(parseVuaBody({ ...HOP_LE, hours: "x".repeat(61) })).toMatchObject({ field: "hours" });
  });
  it("loài ≤20, nhận mảng hoặc chuỗi phẩy, bỏ trùng", () => {
    const nhieu = Array.from({ length: 21 }, (_, i) => `loài ${i}`);
    expect(parseVuaBody({ ...HOP_LE, species: nhieu })).toMatchObject({ ok: false, field: "species" });
    const r = parseVuaBody({ ...HOP_LE, species: ["Mực", "mực", " cá thu ", 7] });
    expect(r.ok && r.value.species).toEqual(["Mực", "cá thu"]);
    expect(parseVuaBody({ ...HOP_LE, species: "x".repeat(VUA_MAX.speciesItem + 1) })).toMatchObject({
      field: "species",
    });
  });
  it("SĐT sai bị chặn", () => {
    expect(parseVuaBody({ ...HOP_LE, contact: "12345" })).toMatchObject({ ok: false, field: "contact" });
  });
  it("body rác không ném", () => {
    expect(parseVuaBody(null).ok).toBe(false);
    expect(parseVuaBody("x").ok).toBe(false);
  });
  it("tachLoai tách phẩy / chấm phẩy / xuống dòng", () => {
    expect(tachLoai("cá ngừ; mực\n tôm,, ")).toEqual(["cá ngừ", "mực", "tôm"]);
  });
});

describe("trạng thái khi chủ hồ sơ lưu", () => {
  it("hồ sơ mới ⇒ chờ duyệt", () => {
    expect(trangThaiKhiLuu(null, ban())).toBe("cho_duyet");
  });
  it("đang hiện: chỉ đổi loài/giờ ⇒ vẫn hiện", () => {
    expect(trangThaiKhiLuu({ ...ban(), status: "hoat_dong" }, ban({ species: ["mực"], hours: "sáng" }))).toBe(
      "hoat_dong",
    );
  });
  it("đang hiện: đổi tên / loại / tỉnh / địa chỉ / SĐT ⇒ chờ duyệt lại", () => {
    const truoc = { ...ban(), status: "hoat_dong" as const };
    expect(trangThaiKhiLuu(truoc, ban({ name: "Vựa Khác" }))).toBe("cho_duyet");
    expect(trangThaiKhiLuu(truoc, ban({ kind: "nau" }))).toBe("cho_duyet");
    expect(trangThaiKhiLuu(truoc, ban({ province: "Bình Định" }))).toBe("cho_duyet");
    expect(trangThaiKhiLuu(truoc, ban({ address: null }))).toBe("cho_duyet");
    expect(trangThaiKhiLuu(truoc, ban({ contact: "0912345678" }))).toBe("cho_duyet");
  });
  it("chỉ khác hoa thường / khoảng trắng ở ô chính ⇒ không tính là đổi", () => {
    expect(doiOChinh(ban(), ban({ name: "vựa tư hải" }))).toBe(false);
  });
  it("bị từ chối ⇒ gửi lại thành chờ duyệt; đang chờ ⇒ vẫn chờ", () => {
    expect(trangThaiKhiLuu({ ...ban(), status: "tu_choi" }, ban())).toBe("cho_duyet");
    expect(trangThaiKhiLuu({ ...ban(), status: "cho_duyet" }, ban({ name: "Vựa Mới" }))).toBe("cho_duyet");
  });
  it("bị khoá ⇒ không cho sửa", () => {
    expect(trangThaiKhiLuu({ ...ban(), status: "tam_khoa" }, ban())).toBe("khoa");
  });
});

describe("quản trị đổi trạng thái", () => {
  it("chỉ ba thao tác", () => {
    for (const a of ["duyet", "tu-choi", "khoa"]) expect(isVuaAdminAction(a)).toBe(true);
    expect(isVuaAdminAction("xoa")).toBe(false);
  });
  it("duyệt (kể cả mở khoá) ⇒ hiện, xoá lý do", () => {
    expect(chuyenTrangThaiAdmin("cho_duyet", "duyet", "x")).toEqual({ ok: true, status: "hoat_dong", note: null });
    expect(chuyenTrangThaiAdmin("tam_khoa", "duyet", null)).toMatchObject({ ok: true, status: "hoat_dong" });
    expect(chuyenTrangThaiAdmin("hoat_dong", "duyet", null)).toEqual({ ok: false, code: "no_change" });
  });
  it("từ chối BẮT lý do 3–300 chữ", () => {
    expect(chuyenTrangThaiAdmin("cho_duyet", "tu-choi", "")).toEqual({ ok: false, code: "need_reason" });
    expect(chuyenTrangThaiAdmin("cho_duyet", "tu-choi", " ab ")).toEqual({ ok: false, code: "need_reason" });
    expect(chuyenTrangThaiAdmin("cho_duyet", "tu-choi", "x".repeat(301))).toEqual({ ok: false, code: "note_too_long" });
    expect(chuyenTrangThaiAdmin("cho_duyet", "tu-choi", "Sai địa chỉ")).toEqual({
      ok: true,
      status: "tu_choi",
      note: "Sai địa chỉ",
    });
  });
  it("khoá: lý do tuỳ", () => {
    expect(chuyenTrangThaiAdmin("hoat_dong", "khoa", undefined)).toEqual({ ok: true, status: "tam_khoa", note: null });
    expect(chuyenTrangThaiAdmin("tam_khoa", "khoa", "x")).toEqual({ ok: false, code: "no_change" });
  });
});

describe("hồ sơ vựa vào danh bạ Đầu mối", () => {
  it("map đúng nhóm, nhãn phụ, SĐT liên hệ, cờ xác minh", () => {
    const c = vuaThanhDauMoi(
      {
        id: "vp-0",
        name: "Nậu Ba",
        kind: "nau",
        province: "Bình Định",
        address: null,
        species: ["mực"],
        hours: null,
        contact: "0905123456",
        xacMinh: true,
      },
      3,
    );
    expect(c).toMatchObject({
      id: "vp-0",
      kind: "vua",
      subLabel: "Nậu",
      province: "Bình Định",
      address: undefined,
      phone: "0905123456",
      species: ["mực"],
      visible: true,
      sortOrder: 3,
      xacMinh: true,
    });
  });
});
