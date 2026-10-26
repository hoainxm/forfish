// Hạn giấy của bà con dưới bài luật Sen Biển (14 §21f, anh Long 2026-10-26).
import { describe, expect, it } from "vitest";
import { cauThuyenVien, GIAY_CUA_MUC, giayCuaBai, hanGiay, linkGiay, mucCuaBai, tomTatThuyenVien } from "@/lib/kairos/han-giay";
import { MUC, ghepBai } from "@/lib/kairos/tuyen-truyen-luat.mjs";
import { giayTuUrl, type BoatDocument } from "@/lib/documents";

const TODAY = new Date("2026-10-26T05:00:00Z"); // 12:00 giờ VN
const muc = (id: string) => MUC.find((m) => m.id === id)!;
const bai = (id: string) => ({ kind: "chinh-thuc", body: ghepBai(muc(id).mau, muc(id)) });
const ctx = { currentId: "t1", knownIds: new Set(["t1", "t2"]), today: TODAY };
const giay = (over: Partial<BoatDocument & { boatId?: string }>): BoatDocument & { boatId?: string } => ({
  id: crypto.randomUUID(),
  kind: "giay_phep_khai_thac",
  label: "Giấy phép",
  boatId: "t1",
  ...over,
});

describe("mục luật ⇒ giấy theo dõi", () => {
  it("mọi id trong GIAY_CUA_MUC có trong kho luật", () => {
    for (const id of Object.keys(GIAY_CUA_MUC)) expect(MUC.some((m) => m.id === id), id).toBe(true);
  });
  it("nhận bài Sen Biển theo nguyên văn trích; bài giấy phép ⇒ giấy phép khai thác", () => {
    expect(mucCuaBai(bai("d21-k2-a"))?.id).toBe("d21-k2-a");
    expect(giayCuaBai(bai("d21-k2-a"))).toEqual([{ loai: "giay", kind: "giay_phep_khai_thac" }]);
    expect(giayCuaBai(bai("d34-k3-an-toan-ky-thuat"))).toEqual([{ loai: "giay", kind: "dang_kiem" }]);
    expect(giayCuaBai(bai("d39-k4-bao-hiem"))).toEqual([{ loai: "thuyen-vien", muc: "bao-hiem" }]);
  });
  it("bài luật không về giấy có hạn (vượt ranh, VMS) / bài bà con / bài báo ⇒ không có khối", () => {
    expect(giayCuaBai(bai("d21-k2-d"))).toEqual([]);
    expect(giayCuaBai(bai("d37-k7"))).toEqual([]);
    expect(giayCuaBai({ kind: "ba-con", body: bai("d21-k2-a").body })).toEqual([]);
    expect(giayCuaBai({ kind: "chinh-thuc", body: "Chào bà con" })).toEqual([]);
    expect(giayCuaBai({ kind: "chinh-thuc", body: null })).toEqual([]);
  });
});

describe("hanGiay — đọc tủ giấy tờ của tàu đang xem", () => {
  it("chưa lưu ⇒ chua-co; lưu mà chưa có ngày ⇒ chua-han; giấy đăng ký không ngày ⇒ khong-han", () => {
    expect(hanGiay("giay_phep_khai_thac", [], ctx).muc).toBe("chua-co");
    expect(hanGiay("giay_phep_khai_thac", [giay({})], ctx).muc).toBe("chua-han");
    expect(hanGiay("dang_ky_tau", [giay({ kind: "dang_ky_tau" })], ctx).muc).toBe("khong-han");
  });
  it("đã quá / hết hôm nay ⇒ het; ≤30 ngày ⇒ sap; xa hơn ⇒ con — kèm số ngày và ngày hết", () => {
    expect(hanGiay("giay_phep_khai_thac", [giay({ expiresOn: "2026-10-20" })], ctx)).toMatchObject({ muc: "het", days: -6, expiresOn: "2026-10-20" });
    expect(hanGiay("giay_phep_khai_thac", [giay({ expiresOn: "2026-10-26" })], ctx)).toMatchObject({ muc: "het", days: 0 });
    expect(hanGiay("giay_phep_khai_thac", [giay({ expiresOn: "2026-11-10" })], ctx)).toMatchObject({ muc: "sap", days: 15 });
    expect(hanGiay("giay_phep_khai_thac", [giay({ expiresOn: "2027-06-01" })], ctx).muc).toBe("con");
  });
  it("giấy cũ đã hết + giấy mới vừa gia hạn ⇒ lấy giấy còn hạn xa nhất (không báo đỏ oan)", () => {
    const docs = [giay({ expiresOn: "2026-09-01" }), giay({ expiresOn: "2027-09-01" })];
    expect(hanGiay("giay_phep_khai_thac", docs, ctx).muc).toBe("con");
  });
  it("giấy của tàu khác trong sổ không tính; giấy chưa gắn tàu tính cho tàu đang xem", () => {
    expect(hanGiay("giay_phep_khai_thac", [giay({ boatId: "t2", expiresOn: "2026-10-20" })], ctx).muc).toBe("chua-co");
    expect(hanGiay("giay_phep_khai_thac", [giay({ boatId: undefined, expiresOn: "2026-10-20" })], ctx).muc).toBe("het");
  });
});

describe("tomTatThuyenVien — sổ thuyền viên", () => {
  const crew = [
    { name: "A", hasInsurance: true, insuranceExpiry: "2026-10-01", certLabel: "Thuyền trưởng hạng III", certExpiry: "2028-01-01" },
    { name: "B", hasInsurance: true, insuranceExpiry: "2026-11-05" },
    { name: "C", hasInsurance: true },
    { name: "D", hasInsurance: false },
  ];
  it("bảo hiểm: đếm hết / sắp / chưa ghi (kể cả người chưa có bảo hiểm)", () => {
    const t = tomTatThuyenVien("bao-hiem", crew, TODAY, 30);
    expect(t).toMatchObject({ tong: 4, coGiay: 3, het: 1, sap: 1, chuaNgay: 2 });
    expect(cauThuyenVien(t)).toEqual({ cau: "1 người đã hết hạn · 1 người sắp hết hạn · 2 người chưa ghi bảo hiểm", muc: "het" });
  });
  it("chứng chỉ: chỉ người có ghi chứng chỉ; còn hạn cả ⇒ con", () => {
    const t = tomTatThuyenVien("chung-chi", crew, TODAY, 30);
    expect(t).toMatchObject({ tong: 4, coGiay: 1, het: 0, sap: 0, chuaNgay: 0 });
    expect(cauThuyenVien(t)).toEqual({ cau: "Còn hạn cả 1 người", muc: "con" });
  });
  it("sổ trống / không ai ghi chứng chỉ / dữ liệu hỏng ⇒ mời nhập, không ném", () => {
    expect(cauThuyenVien(tomTatThuyenVien("bao-hiem", [], TODAY, 30))).toEqual({ cau: "Sổ thuyền viên chưa có ai", muc: "chua-co" });
    expect(cauThuyenVien(tomTatThuyenVien("chung-chi", [{ name: "D" }], TODAY, 30))).toEqual({ cau: "Chưa ghi chứng chỉ của ai", muc: "chua-co" });
    expect(tomTatThuyenVien("bao-hiem", [null, 3, "x"] as unknown[], TODAY, 30).tong).toBe(0);
  });
});

describe("link mở đúng giấy", () => {
  it("linkGiay ⇒ tủ giấy tờ đọc lại được đúng loại; loại lạ ⇒ null", () => {
    const u = new URL(linkGiay("dang_kiem"), "http://x");
    expect(u.pathname).toBe("/tau");
    expect(giayTuUrl(u.search)).toBe("dang_kiem");
    expect(giayTuUrl("?tab=giay-to&giay=lung-tung")).toBeNull();
    expect(giayTuUrl("?tab=giay-to")).toBeNull();
  });
});
