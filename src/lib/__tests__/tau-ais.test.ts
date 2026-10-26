import { describe, expect, it } from "vitest";
import { chuanHoaHang, danhSachO, gopTau, kiemGoi, oTile, rutId, VUNG_BIEN_VN } from "@/lib/tau-ais/chuan-hoa.mjs";
import { moTaTau, tauGanDiem, tuoiTinLabel, tuoiTinPhut, type TauAis } from "@/lib/tau-ais";

const HANG = {
  LAT: "15.836166", LON: "109.15148", SPEED: "41", COURSE: "111", HEADING: "111", ELAPSED: "14",
  DESTINATION: "CLASS B", FLAG: "VN", LENGTH: "17", SHIPNAME: "GIANG LQ 15 C31", SHIPTYPE: "2", SHIP_ID: "9057335",
};

describe("tàu AIS — chuẩn hoá hàng nguồn", () => {
  it("hàng tàu cá VN ⇒ bản ghi gọn, tốc độ ÷10, bỏ 'CLASS B'", () => {
    expect(chuanHoaHang(HANG)).toEqual({
      id: "9057335", ten: "GIANG LQ 15 C31", loai: 2, co: "VN", lat: 15.83617, lon: 109.15148,
      kn: 4.1, huong: 111, mui: 111, phut: 14, dai: 17, dich: null,
    });
  });
  it("tàu vệ tinh không tên ⇒ ten null, id base64 giữ nguyên; thiếu toạ độ ⇒ null", () => {
    const t = chuanHoaHang({ ...HANG, SHIPNAME: "[SAT-AIS]", SHIP_ID: "TWpNd0==", HEADING: null, LENGTH: undefined });
    expect(t?.ten).toBeNull();
    expect(t?.id).toBe("TWpNd0==");
    const dai = "TWpNd056UXhNak13TnpReE1qTXdOdz09LXFPcUdGdlpJN2FEMEVuWkthQWNDZHc9PQ==";
    expect(rutId(dai)).toMatch(/^v[0-9a-z]{6,12}$/);
    expect(rutId(dai)).toBe(rutId(dai));
    expect(chuanHoaHang({ ...HANG, SHIP_ID: dai })?.id).toBe(rutId(dai));
    expect(t?.mui).toBeNull();
    expect(t?.dai).toBeNull();
    expect(chuanHoaHang({ ...HANG, LAT: "abc" })).toBeNull();
    expect(chuanHoaHang({ ...HANG, SHIP_ID: "" })).toBeNull();
    expect(chuanHoaHang({ ...HANG, SHIPTYPE: "5" })?.loai).toBe(0);
  });
  it("gộp ô: cùng id giữ tin mới nhất", () => {
    const a = chuanHoaHang(HANG)!;
    const b = { ...a, phut: 3, lat: 15.9 };
    expect(gopTau([a, b, a])).toEqual([b]);
  });
});

describe("tàu AIS — ô quét", () => {
  it("toạ độ ⇒ ô z:8 của nguồn (ô 512 px; trình duyệt 2026-10-26 ở 14N 112E gọi X:102–103 Y:58–59)", () => {
    expect(oTile(14, 112)).toEqual({ x: 103, y: 58 });
    expect(oTile(14, 112, 7)).toEqual({ x: 51, y: 29 });
  });
  it("hộp biển VN phủ bằng ~48 ô z:8, mỗi ô một lần", () => {
    const o = danhSachO(VUNG_BIEN_VN);
    expect(o.length).toBeGreaterThan(30);
    expect(o.length).toBeLessThan(60);
    expect(new Set(o.map((t) => `${t.x}/${t.y}`)).size).toBe(o.length);
  });
});

describe("tàu AIS — máy chủ kiểm gói", () => {
  it("gói gọn hợp lệ ⇒ bản v1; hàng ngoài vùng / tin quá 4 giờ bị bỏ; gói rỗng/sai ⇒ mã lỗi", () => {
    const r = kiemGoi({ luc: "2026-10-26T02:00:00.000Z", tau: [chuanHoaHang(HANG), { ...chuanHoaHang(HANG)!, id: "xa", lat: 40 }, { ...chuanHoaHang(HANG)!, id: "cu", phut: 600 }, null] });
    expect(r.ok && r.ban?.soTau).toBe(1);
    expect(r.ok && r.ban?.luc).toBe("2026-10-26T02:00:00.000Z");
    expect(kiemGoi({ tau: [] })).toEqual({ ok: false, code: "trong" });
    expect(kiemGoi({ tau: "x" })).toEqual({ ok: false, code: "bad_body" });
    expect(kiemGoi(null)).toEqual({ ok: false, code: "bad_body" });
  });
  it("chấp nhận cả hàng thô của nguồn", () => {
    const r = kiemGoi({ tau: [HANG] });
    expect(r.ok && r.ban?.tau[0].ten).toBe("GIANG LQ 15 C31");
  });
});

describe("tàu AIS — phía máy ngư dân", () => {
  const t: TauAis = { id: "1", ten: "A", loai: 2, co: "VN", lat: 10, lon: 110, kn: 4.1, huong: 120, mui: null, phut: 10, dai: 17, dich: null };
  it("tàu gần điểm chạm trong 3 km, xa hơn ⇒ null", () => {
    expect(tauGanDiem([t], 10.01, 110)?.tau.id).toBe("1");
    expect(tauGanDiem([t], 10.1, 110)).toBeNull();
  });
  it("tuổi tin = tuổi trong nguồn + tuổi bản; nhãn đời thường", () => {
    expect(tuoiTinPhut(t, { luc: "2026-10-26T02:00:00.000Z" }, Date.parse("2026-10-26T02:07:00.000Z"))).toBe(17);
    expect(tuoiTinLabel(1)).toBe("vừa xong");
    expect(tuoiTinLabel(17)).toBe("17 phút trước");
    expect(tuoiTinLabel(150)).toBe("3 giờ trước");
  });
  it("mô tả tàu", () => {
    expect(moTaTau(t)).toBe("Tàu cá · VN · 4,1 hải lý/h hướng 120° · 17 m");
    expect(moTaTau({ ...t, kn: 0, co: null, dai: null })).toBe("Tàu cá · đang đứng");
  });
});
