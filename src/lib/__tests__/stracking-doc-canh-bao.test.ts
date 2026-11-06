import { describe, expect, it } from "vitest";
import { gioDoc, loiDocGiamSat } from "@/lib/stracking/doc-canh-bao.mjs";

// 06/11/2026 14:00 giờ VN
const NOW = Date.parse("2026-11-06T07:00:00Z");
const vn = (s: string) => new Date(Date.parse(`${s}+07:00`)).toISOString();
const tau = (o: Record<string, unknown> = {}) => ({ tenTau: "BV-1-TS", imei: "1", hetHan: "2027-06-01", trongBo: false, matKetNoiTu: null, ...o });

describe("Sen Biển đọc cảnh báo giám sát hành trình (anh Long 06/11: \"cho sen biển đọc cái cảnh báo\")", () => {
  it("giờ đọc tròn kiểu nói; khác ngày thì thêm ngày tháng", () => {
    expect(gioDoc(vn("2026-11-06T09:53:00"), NOW)).toBe("9 giờ 53");
    expect(gioDoc(vn("2026-11-06T15:00:00"), NOW)).toBe("15 giờ");
    expect(gioDoc(vn("2026-11-07T01:00:00"), NOW)).toBe("1 giờ ngày 7 tháng 11");
  });
  it("không có gì ⇒ một câu yên tâm", () => {
    expect(loiDocGiamSat({ tau: [tau()], now: NOW })).toBe("Tàu BV-1-TS ổn, máy giám sát hành trình không có cảnh báo nào hôm nay.");
    expect(loiDocGiamSat({ tau: [tau(), tau({ tenTau: "BV-2-TS", imei: "2" })], now: NOW })).toMatch(/^2 tàu của bà con đều ổn/);
    expect(loiDocGiamSat({ tau: [], now: NOW })).toMatch(/chưa thấy máy/);
  });
  it("mất tín hiệu ngoài khơi: nói giờ mất + giờ chót (+6 giờ); nằm bờ +24 giờ; quá mốc thì nhắc báo vị trí", () => {
    expect(loiDocGiamSat({ tau: [tau({ matKetNoiTu: vn("2026-11-06T09:53:00") })], now: NOW })).toBe(
      "Tàu BV-1-TS đang mất tín hiệu giám sát hành trình từ 9 giờ 53. Cần có tín hiệu lại trước 15 giờ 53 để không bị phạt.",
    );
    expect(loiDocGiamSat({ tau: [tau({ trongBo: true, matKetNoiTu: vn("2026-11-06T09:53:00") })], now: NOW })).toMatch(/trước 9 giờ 53 ngày 7 tháng 11/);
    expect(loiDocGiamSat({ tau: [tau({ matKetNoiTu: vn("2026-11-06T06:00:00") })], now: NOW })).toMatch(/Đã quá mốc/);
  });
  it("cảnh báo hôm nay: nặng trước, tối đa 2/tàu; giữ chữ SOS/GPS; tàu nằm bờ bỏ loại bình thường (không nguồn ngoài)", () => {
    const cb = [
      { imei: "1", loai: "Mất GPS", luc: vn("2026-11-06T12:00:00"), muc: "Báo động" },
      { imei: "1", loai: "SOS", luc: vn("2026-11-06T11:00:00"), muc: "Báo động" },
      { imei: "1", loai: "Pin dự phòng sắp hết", luc: vn("2026-11-06T13:00:00"), muc: "Báo động" },
    ];
    const s = loiDocGiamSat({ tau: [tau()], canhBao: cb, now: NOW });
    expect(s).toBe("Tàu BV-1-TS có cảnh báo SOS lúc 11 giờ. Tàu BV-1-TS có cảnh báo mất GPS lúc 12 giờ.");
    expect(loiDocGiamSat({ tau: [tau({ trongBo: true })], canhBao: [{ imei: "1", loai: "Thiết bị không sử dụng nguồn ngoài", luc: vn("2026-11-06T12:00:00"), muc: "Báo động" }], now: NOW })).toMatch(/ổn/);
  });
  it("cước: còn ≤30 ngày / hết hôm nay / quá hạn; còn dài thì không nói", () => {
    expect(loiDocGiamSat({ tau: [tau({ hetHan: "2026-11-19" })], now: NOW })).toBe("Cước giám sát hành trình tàu BV-1-TS còn 13 ngày.");
    expect(loiDocGiamSat({ tau: [tau({ hetHan: "2026-11-06" })], now: NOW })).toMatch(/hết hạn hôm nay/);
    expect(loiDocGiamSat({ tau: [tau({ hetHan: "2026-11-01" })], now: NOW })).toMatch(/đã quá hạn 5 ngày/);
  });
});
