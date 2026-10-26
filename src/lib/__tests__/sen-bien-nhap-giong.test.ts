// Sen Biển hỏi từng câu để nhập giấy tờ / tàu (2026-10-26) — hiểu câu trả lời nói.
import { describe, expect, it } from "vitest";
import {
  cauTomTat, chuTuDo, KICH_BAN_GIAY, kichBanTau, laBoQua, laCo, laDung, loaiGiayTuChu, maTauTuChu, namTuChu, ngayTuChu,
  soGiayTuChu, soThapPhan, soTuChu, tinhTuChu,
} from "@/lib/sen-bien/nhap-giong";

const NAY = new Date("2026-10-26T03:00:00Z");

describe("số đọc bằng chữ", () => {
  it.each([
    ["mười một", 11], ["hai mươi tư", 24], ["hai tư", 24], ["ba mốt", 31], ["ba mươi mốt", 31], ["mười lăm", 15],
    ["hai nghìn không trăm hai mươi bảy", 2027], ["một trăm linh năm", 105], ["hai không hai bảy", 2027], ["2027", 2027], ["chín", 9],
  ])("%s ⇒ %d", (t, n) => expect(soTuChu(t)).toBe(n));
  it("không phải số ⇒ null", () => {
    expect(soTuChu("bình định")).toBeNull();
    expect(soTuChu("")).toBeNull();
  });
  it.each([
    ["hai không mười tám", 2018], ["hai nghìn mười tám", 2018], ["mười tám", 2018], ["chín lăm", 1995], ["2005", 2005],
  ])("năm %s ⇒ %d", (t, n) => expect(namTuChu(t, 2026)).toBe(n));
});

describe("ngày nói ⇒ ISO", () => {
  it.each([
    ["mười một tháng ba năm hai không hai bảy", "2027-03-11"],
    ["ngày 11 tháng 3 năm 2027", "2027-03-11"],
    ["hết hạn ngày mười một tháng ba năm hai nghìn không trăm hai mươi bảy", "2027-03-11"],
    ["mồng năm tháng tư năm hai lăm", "2025-04-05"],
    ["hai tư tháng chín năm hai sáu", "2026-09-24"],
    ["ba mươi mốt tháng mười hai năm hai không hai sáu", "2026-12-31"],
    ["mùng một tháng năm năm hai bảy", "2027-05-01"],
    ["11/3/2027", "2027-03-11"],
    ["11 3 27", "2027-03-11"],
  ])("%s", (t, d) => expect(ngayTuChu(t, NAY)).toBe(d));
  it("thiếu năm / ngày giả / rác ⇒ null (hỏi lại, không đoán)", () => {
    expect(ngayTuChu("mười một tháng ba", NAY)).toBeNull();
    expect(ngayTuChu("ba mươi tháng hai năm hai bảy", NAY)).toBeNull();
    expect(ngayTuChu("không biết", NAY)).toBeNull();
  });
});

describe("số thập phân, số giấy, mã tàu", () => {
  it.each([["mười tám phẩy năm", "18,5"], ["18,5 mét", "18,5"], ["mười tám mét rưỡi", "18,5"], ["hai mươi", "20"], ["15.25", "15,25"]])(
    "dài %s ⇒ %s",
    (t, v) => expect(soThapPhan(t)).toBe(v),
  );
  it("số giấy: chữ số đọc rời ghép lại, 'trên' ⇒ /", () => {
    expect(soGiayTuChu("một bảy sáu chín trên hai không hai lăm trên gl")).toBe("1769/2025/GL");
    expect(soGiayTuChu("số 2024 gạch 01573")).toBe("2024-01573");
    expect(soGiayTuChu("không nhớ")).toBeNull();
  });
  it.each([
    ["gờ lờ chín chín hai tám không tê ét", "GL-99280-TS"],
    ["bê đê chín bảy ba bốn năm tê ét", "BĐ-97345-TS"],
    ["GL 99280 TS", "GL-99280-TS"],
    ["BĐ-97345-TS", "BĐ-97345-TS"],
    ["quy en gờ 1234 tê ét", "QNG-1234-TS"],
  ])("mã %s ⇒ %s", (t, v) => expect(maTauTuChu(t)).toBe(v));
  it("mã thiếu số / không có chữ ⇒ null", () => {
    expect(maTauTuChu("bê đê tê ét")).toBeNull();
    expect(maTauTuChu("chín bảy ba bốn năm")).toBeNull();
  });
});

describe("loại giấy, tỉnh, chữ tự do, lệnh", () => {
  it.each([
    ["đăng kiểm", "dang_kiem"], ["giấy an toàn kỹ thuật", "dang_kiem"], ["giấy đăng ký tàu", "dang_ky_tau"],
    ["giấy phép khai thác", "giay_phep_khai_thac"], ["an toàn thực phẩm", "an_toan_thuc_pham"], ["bảo hiểm thuyền viên", "bao_hiem"],
    ["bằng thuyền trưởng", "chung_chi_thuyen_truong"],
  ])("%s ⇒ %s", (t, k) => expect(loaiGiayTuChu(t)).toBe(k));
  it("tỉnh khớp dài nhất, không dấu", () => {
    expect(tinhTuChu("cảng ở gia lai", ["Gia Lai", "Khánh Hòa"])).toBe("Gia Lai");
    expect(tinhTuChu("khanh hoa", ["Gia Lai", "Khánh Hòa"])).toBe("Khánh Hòa");
    expect(tinhTuChu("hà nội", ["Gia Lai"])).toBeNull();
  });
  it("chữ tự do: bỏ 'tên là', viết hoa chữ đầu", () => {
    expect(chuTuDo("tên là phước lộc 79")).toBe("Phước lộc 79");
    expect(chuTuDo("")).toBeNull();
  });
  it("lệnh: bỏ qua / thôi / có–không", () => {
    expect(laBoQua("bỏ qua")).toBe(true);
    expect(laBoQua("không nhớ")).toBe(true);
    expect(laBoQua("giấy phép")).toBe(false);
    expect(laDung("thôi")).toBe(true);
    expect(laDung("thôi dừng lại")).toBe(false);
    expect(laCo("lưu đi")).toBe(true);
    expect(laCo("đúng rồi")).toBe(true);
    expect(laCo("không, để tôi sửa")).toBe(false);
    expect(laCo("ờ hả")).toBeNull();
  });
});

describe("kịch bản", () => {
  it("giấy: loại (bắt buộc) → hết hạn → số → ngày cấp; hiểu đúng từng bước", () => {
    expect(KICH_BAN_GIAY.map((b) => b.o)).toEqual(["kind", "expiresOn", "number", "issuedOn"]);
    expect(KICH_BAN_GIAY[0].boQuaDuoc).toBe(false);
    expect(KICH_BAN_GIAY[1].hieu("mười một tháng ba năm hai không hai bảy")).toEqual({ ok: true, gt: "2027-03-11", noi: "hết hạn 11 tháng 3 năm 2027" });
  });
  it("tàu: tên (bắt buộc) đầu tiên; chiều dài ngoài 0–100 m ⇒ hỏi lại", () => {
    const kb = kichBanTau(["Gia Lai"]);
    expect(kb[0].o).toBe("name");
    expect(kb[0].boQuaDuoc).toBe(false);
    const dai = kb.find((b) => b.o === "lengthM")!;
    expect(dai.hieu("mười tám phẩy năm")).toMatchObject({ ok: true, gt: "18,5" });
    expect(dai.hieu("ba trăm")).toEqual({ ok: false });
  });
  it("tóm tắt cuối hỏi lưu", () => {
    expect(cauTomTat(["Giấy phép khai thác", "hết hạn 11 tháng 3 năm 2027"])).toBe("Bác xem lại: Giấy phép khai thác, hết hạn 11 tháng 3 năm 2027. Lưu nhé?");
  });
});
