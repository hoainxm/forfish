import { describe, expect, it } from "vitest";

import { caDangBan, diemViec, giaQuanTam, khopLoai, viecDaiLy, viecHop } from "@/lib/home-vai";
import type { MarketListing } from "@/lib/market-listings-core";
import type { ViecTin } from "@/lib/viec";

const tin = (p: Partial<MarketListing> & { id: string }): MarketListing => ({
  side: "ban",
  posterKind: "ngu-dan",
  posterName: "Tàu",
  species: "Cá ngừ",
  status: "open",
  postedOn: "2026-11-01",
  ...p,
});

describe("cá đang bán gần cảng — trang chủ vai Thu mua (spec 17 §4.2)", () => {
  it("chỉ tin bán đang mở, bỏ tin của mình", () => {
    const r = caDangBan(
      [
        tin({ id: "a" }),
        tin({ id: "b", side: "mua" }),
        tin({ id: "c", status: "closed" }),
        tin({ id: "d", mine: true }),
      ],
      undefined,
    );
    expect(r.map((l) => l.id)).toEqual(["a"]);
  });
  it("cùng tỉnh cảng nhà lên trước (không phân biệt dấu/hoa), rồi tin mới trước", () => {
    const r = caDangBan(
      [
        tin({ id: "xa-moi", province: "Bình Định", postedOn: "2026-11-03" }),
        tin({ id: "gan-cu", province: "Quảng Ngãi", postedOn: "2026-10-30" }),
        tin({ id: "gan-moi", province: "quang  ngai", postedOn: "2026-11-02" }),
      ],
      "Quảng Ngãi",
    );
    expect(r.map((l) => l.id)).toEqual(["gan-moi", "gan-cu", "xa-moi"]);
  });
  it("chưa khai cảng ⇒ chỉ theo ngày; trần n tin", () => {
    const ds = Array.from({ length: 8 }, (_, i) => tin({ id: `t${i}`, postedOn: `2026-10-0${i + 1}` }));
    const r = caDangBan(ds, undefined);
    expect(r).toHaveLength(5);
    expect(r[0].id).toBe("t7");
    expect(caDangBan(ds, undefined, 0)).toEqual([]);
  });
});

const NOW = Date.parse("2026-11-03T08:00:00Z");
const viec = (p: Partial<ViecTin> & { id: string }): ViecTin => ({
  nghe: "luoi-vay",
  portId: "sa-huynh",
  viTri: ["thuyen-vien"],
  soNguoi: 2,
  ngayDi: null,
  soNgay: null,
  cong: null,
  giay: [],
  ghiChu: null,
  boatReg: null,
  status: "mo",
  expiresAt: "2026-11-10T00:00:00Z",
  createdAt: "2026-11-01T00:00:00Z",
  ...p,
});

describe("khớp loài vựa mua (trang chủ Thu mua)", () => {
  it("không dấu, hai chiều, bỏ chữ 'cá' đầu", () => {
    expect(khopLoai("Cá ngừ đại dương 1,2 tấn", ["ngừ"])).toBe(true);
    expect(khopLoai("mực ống", ["Mực"])).toBe(true);
    expect(khopLoai("Cá nục", ["cá ngừ"])).toBe(false);
    expect(khopLoai("Cá nục", [])).toBe(false);
    expect(khopLoai("", ["nuc"])).toBe(false);
  });
  it("giá: loài khớp lên trước, không khai loài ⇒ n dòng đầu", () => {
    const gia = [{ species: "Cá nục" }, { species: "Cá ngừ sọc dưa" }, { species: "Mực lá" }];
    expect(giaQuanTam(gia, ["ngừ"], 2).map((g) => g.species)).toEqual(["Cá ngừ sọc dưa", "Cá nục"]);
    expect(giaQuanTam(gia, [], 2).map((g) => g.species)).toEqual(["Cá nục", "Cá ngừ sọc dưa"]);
  });
});

describe("tin tuyển hợp hồ sơ (trang chủ Đi bạn)", () => {
  const hoSo = { nghe: ["cau-muc"], viTri: ["may-truong"], ports: ["tam-quan"] };
  it("điểm: nghề 3 · vị trí 2 · cảng 2; không hồ sơ ⇒ 0", () => {
    expect(diemViec(viec({ id: "a", nghe: "cau-muc", viTri: ["may-truong"], portId: "tam-quan" }), hoSo)).toBe(7);
    expect(diemViec(viec({ id: "b" }), hoSo)).toBe(0);
    expect(diemViec(viec({ id: "c", nghe: "cau-muc" }), null)).toBe(0);
  });
  it("khớp nhiều lên trước, rồi tin mới; bỏ tin của mình / hết hạn / đủ người", () => {
    const r = viecHop(
      [
        viec({ id: "moi-khong-khop", createdAt: "2026-11-03T00:00:00Z" }),
        viec({ id: "khop-nghe", nghe: "cau-muc" }),
        viec({ id: "cua-toi", nghe: "cau-muc", cuaToi: true }),
        viec({ id: "het-han", nghe: "cau-muc", expiresAt: "2026-11-01T00:00:00Z" }),
        viec({ id: "du", nghe: "cau-muc", status: "du" }),
      ],
      hoSo,
      NOW,
    );
    expect(r.map((t) => t.id)).toEqual(["khop-nghe", "moi-khong-khop"]);
    expect(r[0].hopNghe).toBe(true);
    expect(r[1].hopNghe).toBe(false);
  });
});

describe("việc cần làm ngay của đại lý", () => {
  it("chỉ việc có số, đúng thứ tự gấp", () => {
    const r = viecDaiLy({ donCho: 2, baoChuyen: 0, yeuCauMoi: 3, sapHet: 1 });
    expect(r.map((v) => v.key)).toEqual(["don", "yeu-cau", "sap-het"]);
    expect(r[0].ten).toBe("2 đơn chờ xác nhận");
  });
  it("không việc nào ⇒ rỗng; số lạ bỏ qua", () => {
    expect(viecDaiLy({ donCho: 0, baoChuyen: 0, yeuCauMoi: 0, sapHet: 0 })).toEqual([]);
    expect(viecDaiLy({ donCho: Number.NaN, baoChuyen: -1, yeuCauMoi: 0, sapHet: 0 })).toEqual([]);
  });
});
