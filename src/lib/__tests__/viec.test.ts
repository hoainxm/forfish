import { describe, expect, it } from "vitest";
import {
  CACHE_MAX_BYTES,
  CACHE_MAX_TIN,
  CAU_PHI,
  GIAY,
  HAN_TIN_MS,
  LUU_MAX,
  TAT_HO_SO_MS,
  TRAN_TIN_MO,
  VI_TRI,
  VIEC_KEY,
  VIEC_LUU_KEY,
  byteLen,
  cangCuaTinh,
  cauLoi,
  coThuPhi,
  conChoDangTin,
  hanGiaHan,
  hoSoDangHien,
  isNgay,
  parseCache,
  parseLoc,
  parseLuu,
  parseTinPatch,
  serializeCache,
  toggleLuu,
  trangThaiTin,
  validateBaoXau,
  validateHoSo,
  validateTin,
  type ViecTin,
} from "@/lib/viec";
import { FISHING_PORTS } from "@/data/fishing-ports";

const PORTS = new Set(["tam-quan", "sa-huynh", "phan-thiet", "vung-tau"]);
const ctx = { portIds: PORTS };
const tinOk = { nghe: "cau-muc", portId: "tam-quan", viTri: ["thuyen-vien"], soNguoi: 3 };
const NOW = Date.parse("2026-11-03T00:00:00Z");

const tin = (id: string, extra: Partial<ViecTin> = {}): ViecTin => ({
  id,
  nghe: "cau-muc",
  portId: "tam-quan",
  viTri: ["thuyen-vien"],
  soNguoi: 2,
  ngayDi: null,
  soNgay: null,
  cong: null,
  giay: [],
  ghiChu: null,
  boatReg: null,
  status: "mo",
  expiresAt: "2026-11-17T00:00:00Z",
  createdAt: "2026-11-03T00:00:00Z",
  ...extra,
});

describe("danh mục", () => {
  it("6 vị trí, 3 giấy, id không trùng", () => {
    expect(VI_TRI.map((v) => v.name)).toEqual(["Thuyền viên", "Thuyền trưởng", "Máy trưởng", "Máy phụ", "Nấu ăn", "Thợ lặn"]);
    expect(GIAY).toHaveLength(3);
    expect(new Set(VI_TRI.map((v) => v.id)).size).toBe(6);
  });
  it("khoá máy đúng tên spec", () => {
    expect(VIEC_KEY).toBe("forfish.viec.v1");
    expect(VIEC_LUU_KEY).toBe("forfish.viec.luu.v1");
  });
});

describe("validateTin — khớp check của migration 0079", () => {
  it("tin tối thiểu hợp lệ", () => {
    const v = validateTin(tinOk, ctx);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.value).toMatchObject({ nghe: "cau-muc", port_id: "tam-quan", so_nguoi: 3, giay: [], show_boat: false, ngay_di: null });
  });
  it("nghề phải là mã NGHE Kairos, cảng phải trong danh mục", () => {
    expect(validateTin({ ...tinOk, nghe: "bay-ca" }, ctx)).toMatchObject({ ok: false, code: "bad_nghe" });
    expect(validateTin({ ...tinOk, portId: "hanoi" }, ctx)).toMatchObject({ ok: false, code: "bad_port" });
  });
  it("vị trí 1–6, không mã lạ, bỏ trùng", () => {
    expect(validateTin({ ...tinOk, viTri: [] }, ctx)).toMatchObject({ ok: false, code: "bad_vi_tri" });
    expect(validateTin({ ...tinOk, viTri: ["phi-cong"] }, ctx)).toMatchObject({ ok: false, code: "bad_vi_tri" });
    const v = validateTin({ ...tinOk, viTri: ["may-phu", "may-phu"] }, ctx);
    expect(v.ok && v.value.vi_tri).toEqual(["may-phu"]);
  });
  it("số người 1–30, nguyên", () => {
    for (const n of [0, 31, 2.5, "3"]) expect(validateTin({ ...tinOk, soNguoi: n }, ctx)).toMatchObject({ ok: false, code: "bad_so_nguoi" });
    expect(validateTin({ ...tinOk, soNguoi: 30 }, ctx).ok).toBe(true);
  });
  it("chuyến dài 1–120 ngày hoặc bỏ trống; ngày đi phải có thật", () => {
    expect(validateTin({ ...tinOk, soNgay: 121 }, ctx)).toMatchObject({ ok: false, code: "bad_so_ngay" });
    expect(validateTin({ ...tinOk, soNgay: "" }, ctx).ok).toBe(true);
    expect(validateTin({ ...tinOk, ngayDi: "2026-02-30" }, ctx)).toMatchObject({ ok: false, code: "bad_ngay" });
    expect(validateTin({ ...tinOk, ngayDi: "2026-11-20" }, ctx).ok).toBe(true);
  });
  it("giấy ≤3, mã trong GIAY", () => {
    expect(validateTin({ ...tinOk, giay: ["bang-lai"] }, ctx)).toMatchObject({ ok: false, code: "bad_giay" });
    expect(validateTin({ ...tinOk, giay: GIAY.map((g) => g.id) }, ctx).ok).toBe(true);
  });
  it("công ≤80, ghi chú ≤300, số hiệu ≤30 ký tự (đếm code point)", () => {
    expect(validateTin({ ...tinOk, cong: "a".repeat(81) }, ctx)).toMatchObject({ ok: false, code: "too_long" });
    expect(validateTin({ ...tinOk, ghiChu: "ạ".repeat(300) }, ctx).ok).toBe(true);
    expect(validateTin({ ...tinOk, ghiChu: "ạ".repeat(301) }, ctx)).toMatchObject({ ok: false, code: "too_long" });
    expect(validateTin({ ...tinOk, boatReg: "B".repeat(31) }, ctx)).toMatchObject({ ok: false, code: "too_long" });
  });
  it("hiện số hiệu chỉ khi có số hiệu", () => {
    const a = validateTin({ ...tinOk, showBoat: true }, ctx);
    expect(a.ok && a.value.show_boat).toBe(false);
    const b = validateTin({ ...tinOk, showBoat: true, boatReg: "BĐ-91234-TS" }, ctx);
    expect(b.ok && b.value.show_boat).toBe(true);
  });
  it("bộ lọc chữ Kairos chạy trên công + ghi chú", () => {
    const v = validateTin({ ...tinOk, ghiChu: "Đi ngư trường South China Sea" }, ctx);
    expect(v.ok).toBe(false);
  });
  it("thân không phải object ⇒ bad_body", () => {
    expect(validateTin(null, ctx)).toMatchObject({ ok: false, code: "bad_body" });
    expect(validateTin([], ctx)).toMatchObject({ ok: false, code: "bad_body" });
  });
});

describe("luật cấm thu phí (AC6)", () => {
  it("'đặt cọc' trong ghi chú ⇒ 400 phi + câu tiếng Việt", () => {
    const v = validateTin({ ...tinOk, ghiChu: "Đặt cọc 500 nghìn giữ chỗ" }, ctx);
    expect(v).toMatchObject({ ok: false, code: "phi" });
    expect(cauLoi("phi")).toBe(CAU_PHI);
    expect(CAU_PHI).toBe("Tin tuyển không được thu tiền của người đi bạn.");
  });
  it("bắt 'phí', 'chuyển khoản trước', bản không dấu; trong ô công cũng bắt", () => {
    expect(coThuPhi("Phí giới thiệu 200k")).toBe(true);
    expect(coThuPhi("chuyển khoản trước rồi lên tàu")).toBe(true);
    expect(coThuPhi("dat coc 1 trieu")).toBe(true);
    expect(validateTin({ ...tinOk, cong: "lương chuyến, phí 300k" }, ctx)).toMatchObject({ ok: false, code: "phi" });
  });
  it("không bắt nhầm 'phía', 'miễn phí'", () => {
    expect(coThuPhi("Tàu đậu phía bắc cảng")).toBe(false);
    expect(coThuPhi("Bao ăn ở miễn phí")).toBe(false);
    expect(coThuPhi(null)).toBe(false);
  });
});

describe("validateHoSo", () => {
  const ok = { nghe: ["cau-muc"], viTri: ["thuyen-vien"], ports: ["tam-quan"] };
  it("tối thiểu hợp lệ, mặc định đang tìm", () => {
    const v = validateHoSo(ok, ctx);
    expect(v.ok && v.value.dang_tim).toBe(true);
  });
  it("nghề 1–9, vị trí 1–6, cảng 1–3", () => {
    expect(validateHoSo({ ...ok, nghe: [] }, ctx)).toMatchObject({ ok: false, code: "bad_nghe" });
    expect(validateHoSo({ ...ok, viTri: [] }, ctx)).toMatchObject({ ok: false, code: "bad_vi_tri" });
    expect(validateHoSo({ ...ok, ports: [] }, ctx)).toMatchObject({ ok: false, code: "bad_port" });
    expect(validateHoSo({ ...ok, ports: [...PORTS] }, ctx)).toMatchObject({ ok: false, code: "bad_port" });
  });
  it("số năm 0–50; ghi chú ≤150", () => {
    expect(validateHoSo({ ...ok, soNam: 51 }, ctx)).toMatchObject({ ok: false, code: "bad_so_nam" });
    expect(validateHoSo({ ...ok, soNam: 0 }, ctx).ok).toBe(true);
    expect(validateHoSo({ ...ok, ghiChu: "x".repeat(151) }, ctx)).toMatchObject({ ok: false, code: "too_long" });
  });
  it("tắt được", () => {
    const v = validateHoSo({ ...ok, dangTim: false }, ctx);
    expect(v.ok && v.value.dang_tim).toBe(false);
  });
});

describe("hạn tin · hồ sơ (AC7)", () => {
  it("tin quá 14 ngày ⇒ hết hạn; đủ người / ẩn giữ nguyên", () => {
    const exp = new Date(NOW + 1000).toISOString();
    expect(trangThaiTin({ status: "mo", expiresAt: exp }, NOW)).toBe("mo");
    expect(trangThaiTin({ status: "mo", expiresAt: exp }, NOW + HAN_TIN_MS)).toBe("het-han");
    expect(trangThaiTin({ status: "mo", expiresAt: "hỏng" }, NOW)).toBe("het-han");
    expect(trangThaiTin({ status: "du", expiresAt: exp }, NOW)).toBe("du");
    expect(trangThaiTin({ status: "an", expiresAt: exp }, NOW)).toBe("an");
  });
  it("gia hạn = 14 ngày từ bây giờ, không cộng dồn", () => {
    expect(Date.parse(hanGiaHan(NOW)) - NOW).toBe(HAN_TIN_MS);
  });
  it("trần 5 tin mở", () => {
    expect(TRAN_TIN_MO).toBe(5);
    expect(conChoDangTin(4)).toBe(true);
    expect(conChoDangTin(5)).toBe(false);
    expect(conChoDangTin(Number.NaN)).toBe(false);
  });
  it("hồ sơ tự tắt sau 30 ngày không bật lại", () => {
    const bat = new Date(NOW).toISOString();
    expect(hoSoDangHien({ dang_tim: true, bat_luc: bat }, NOW + TAT_HO_SO_MS - 1)).toBe(true);
    expect(hoSoDangHien({ dang_tim: true, bat_luc: bat }, NOW + TAT_HO_SO_MS)).toBe(false);
    expect(hoSoDangHien({ dang_tim: false, bat_luc: bat }, NOW)).toBe(false);
  });
});

describe("patch · báo xấu · ngày", () => {
  it("parseTinPatch", () => {
    expect(parseTinPatch({ action: "gia-han" })).toEqual({ action: "gia-han" });
    expect(parseTinPatch({ action: "sua", tin: { a: 1 } })).toEqual({ action: "sua", tin: { a: 1 } });
    expect(parseTinPatch({ action: "xoa" })).toBeNull();
  });
  it("validateBaoXau", () => {
    const id = "123e4567-e89b-12d3-a456-426614174000";
    expect(validateBaoXau({ kind: "post", id })).toMatchObject({ ok: true });
    expect(validateBaoXau({ kind: "user", id })).toMatchObject({ ok: false, code: "bad_target" });
    expect(validateBaoXau({ kind: "seeker", id: "0905123456" })).toMatchObject({ ok: false, code: "bad_target" });
  });
  it("isNgay", () => {
    expect(isNgay("2024-02-29")).toBe(true);
    expect(isNgay("2025-02-29")).toBe(false);
    expect(isNgay("3/11/2026")).toBe(false);
  });
});

describe("lọc", () => {
  it("giá trị lạ bị bỏ, không ném", () => {
    const l = parseLoc(new URLSearchParams("port=xyz&nghe=cau-muc&viTri=lai-may&tinh=Quảng Ngãi"), PORTS);
    expect(l).toEqual({ port: null, tinh: "Quảng Ngãi", nghe: "cau-muc", viTri: null });
  });
  it("cảng theo tỉnh — bỏ dấu, bỏ chữ 'tỉnh'", () => {
    const ports = [
      { id: "a", province: "Quảng Ngãi" },
      { id: "b", province: "Tỉnh Quảng Ngãi" },
      { id: "c", province: "Bình Định" },
    ];
    expect(cangCuaTinh("quang ngai", ports)).toEqual(["a", "b"]);
    expect(cangCuaTinh("", ports)).toEqual([]);
  });
  it("danh mục cảng thật có tỉnh để lọc", () => {
    const tinh = FISHING_PORTS.find((p) => p.province)?.province ?? "";
    expect(cangCuaTinh(tinh, FISHING_PORTS).length).toBeGreaterThan(0);
  });
});

describe("bản lưu danh sách (vẽ ngay lúc mở màn)", () => {
  it("vòng ghi–đọc giữ tin; KHÔNG giữ SĐT — kể cả bản cũ có trường sdt", () => {
    const s = serializeCache([tin("a"), tin("b")], NOW);
    const c = parseCache(s);
    expect(c?.tin.map((t) => t.id)).toEqual(["a", "b"]);
    expect(c?.luc).toBe(NOW);
    expect(s).not.toContain("sdt");
    const cu = parseCache(JSON.stringify({ luc: NOW, tin: [tin("a")], sdt: { a: "0905123456" } }));
    expect(JSON.stringify(cu)).not.toContain("0905123456");
  });
  it("≤100 tin, ≤200 KB", () => {
    const many = Array.from({ length: 150 }, (_, i) => tin(`t${i}`, { ghiChu: "ạ".repeat(300) }));
    const s = serializeCache(many, NOW);
    expect(byteLen(s)).toBeLessThanOrEqual(CACHE_MAX_BYTES);
    expect(parseCache(s)!.tin.length).toBeLessThanOrEqual(CACHE_MAX_TIN);
  });
  it("bản hỏng ⇒ null, không ném", () => {
    expect(parseCache("{oops")).toBeNull();
    expect(parseCache(JSON.stringify({ luc: "x", tin: [] }))).toBeNull();
    expect(parseCache(JSON.stringify({ luc: 1, tin: [{ id: 1 }] }))?.tin).toEqual([]);
  });
  it("tin đã lưu: bật/tắt, mới lên đầu, ≤50", () => {
    let l: ViecTin[] = [];
    l = toggleLuu(l, tin("a"));
    l = toggleLuu(l, tin("b"));
    expect(l.map((t) => t.id)).toEqual(["b", "a"]);
    l = toggleLuu(l, tin("a"));
    expect(l.map((t) => t.id)).toEqual(["b"]);
    const full = Array.from({ length: LUU_MAX }, (_, i) => tin(`x${i}`));
    expect(toggleLuu(full, tin("moi"))).toHaveLength(LUU_MAX);
    expect(parseLuu("không phải json")).toEqual([]);
  });
});
