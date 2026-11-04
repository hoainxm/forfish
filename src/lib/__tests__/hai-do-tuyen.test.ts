import { describe, expect, it } from "vitest";
import {
  cacChang,
  cauLech,
  daoTuyen,
  docGpx,
  gianLuoc,
  giamSat,
  gioTaiDiem,
  nhanDiemVet,
  tenMacDinh,
  thongKeVet,
  tongKm,
  tuyenTuVet,
  vietGpx,
  type DiemVet,
} from "../hai-do/tuyen";
import { diemTheoPhuongVi } from "../hai-do/an-toan";

const A = { lat: 10, lon: 107 };
const B = diemTheoPhuongVi(A, 90, 18.52); // 10 hl về Đông
const C = diemTheoPhuongVi(B, 0, 9.26); // 5 hl về Bắc

describe("tuyến", () => {
  it("chặng: phương vị, cự ly, phút cộng dồn theo tốc độ", () => {
    const c = cacChang([A, B, C], 10);
    expect(Math.round(c[0].pvDeg)).toBe(90);
    expect(c[0].km).toBeCloseTo(18.52, 1);
    expect(c[0].phut).toBeCloseTo(60, 0);
    expect(c[1].phutDon).toBeCloseTo(90, 0);
    expect(gioTaiDiem([A, B, C], 10).map((h) => Math.round(h * 10) / 10)).toEqual([0, 1, 1.5]);
    expect(tongKm([A, B, C])).toBeCloseTo(27.78, 1);
  });
  it("đảo tuyến + tên mặc định giờ VN", () => {
    expect(daoTuyen([A, B, C])).toEqual([C, B, A]);
    expect(tenMacDinh(Date.parse("2026-11-04T01:25:00Z"))).toBe("Tuyến 04/11 08:25");
  });
});

describe("giám sát tuyến", () => {
  it("giữa chặng 1: điểm kế = B, lệch ~0, còn lại đúng", () => {
    const pos = diemTheoPhuongVi(A, 90, 9.26);
    const g = giamSat([A, B, C], 1, pos, 18.52);
    expect(g.toi).toBe(1);
    expect(Math.round(g.btwDeg!)).toBe(90);
    expect(g.dtwKm).toBeCloseTo(9.26, 1);
    expect(g.xtdKm!).toBeLessThan(0.05);
    expect(g.ttgPhut).toBeCloseTo(30, 0);
    expect(g.conLaiKm).toBeCloseTo(18.52, 1);
    expect(Math.round(g.pvChang!)).toBe(90);
  });
  it("tàu ở RẤT XA tuyến (vừa bấm Bắt đầu) ⇒ không nhảy điểm", () => {
    const xa = diemTheoPhuongVi(A, 180, 300);
    expect(giamSat([A, B, C], 1, xa, 10).toi).toBe(1);
  });
  it("đi lố B mà không chạm vòng, đang bám chặng sau ⇒ chuyển sang C", () => {
    const lo = diemTheoPhuongVi(B, 0, 1);
    expect(giamSat([A, B, C], 1, lo, 10).toi).toBe(2);
  });
  it("tới gần B ⇒ tự chuyển sang C; qua C ⇒ hết tuyến", () => {
    expect(giamSat([A, B, C], 1, diemTheoPhuongVi(B, 270, 0.05), 10).toi).toBe(2);
    const het = giamSat([A, B, C], 2, C, 10);
    expect(het.het).toBe(true);
  });
  it("lệch 1 hải lý ⇒ câu báo; trong hành lang ⇒ im; đứng yên ⇒ không ước giờ", () => {
    const lech = diemTheoPhuongVi(diemTheoPhuongVi(A, 90, 9.26), 0, 1.852);
    const g = giamSat([A, B, C], 1, lech, null);
    expect(cauLech(g, (km) => `${(km / 1.852).toFixed(1)} hl`)).toBe("Lệch tuyến 1.0 hl");
    expect(g.ttgPhut).toBeNull();
    expect(cauLech(giamSat([A, B, C], 1, diemTheoPhuongVi(A, 90, 5), 10), String)).toBeNull();
  });
});

describe("vết tàu", () => {
  it("ghi khi đi ≥ 20 m hoặc 30 s; bỏ fix sai số lớn", () => {
    const d0: DiemVet = [10, 107, 0];
    const p15 = diemTheoPhuongVi(A, 0, 0.015);
    const p25 = diemTheoPhuongVi(A, 0, 0.025);
    expect(nhanDiemVet(null, 10, 107, 0, 5)).toBe(true);
    expect(nhanDiemVet(d0, p15.lat, p15.lon, 10_000, 5)).toBe(false);
    expect(nhanDiemVet(d0, p25.lat, p25.lon, 10_000, 5)).toBe(true);
    expect(nhanDiemVet(d0, p15.lat, p15.lon, 31_000, 5)).toBe(true);
    expect(nhanDiemVet(d0, p25.lat, p25.lon, 10_000, 80)).toBe(false);
  });
  it("thống kê + tuyến từ vết giản lược giữ chỗ rẽ", () => {
    const diem: DiemVet[] = [];
    for (let k = 0; k <= 20; k++) {
      const p = diemTheoPhuongVi(A, 90, k * 0.5);
      diem.push([p.lat, p.lon, k * 60_000]);
    }
    for (let k = 1; k <= 20; k++) {
      const q = diemTheoPhuongVi({ lat: diem[20][0], lon: diem[20][1] }, 0, k * 0.5);
      diem.push([q.lat, q.lon, (20 + k) * 60_000]);
    }
    const tk = thongKeVet(diem);
    expect(tk.km).toBeCloseTo(20, 0);
    expect(tk.phut).toBe(40);
    const t = tuyenTuVet({ id: "v", batDau: 0, diem });
    expect(t.length).toBe(3);
    expect(gianLuoc([A, B], 0.2)).toEqual([A, B]);
  });
});

describe("GPX", () => {
  it("ghi rồi đọc lại đủ tuyến, vết, điểm (kể cả tên có ký tự đặc biệt)", () => {
    const xml = vietGpx({
      tuyen: [{ id: "t", ten: "Ra <Hòn> Bà & về", diem: [A, B, C], luc: 0 }],
      vet: [{ id: "v", batDau: 0, diem: [[10, 107, 0], [10.01, 107.01, 60_000]] }],
      diem: [{ ten: "Rạn cá", lat: 9.5, lon: 106.5 }],
    });
    expect(xml).toContain("<rte>");
    const r = docGpx(xml, 1000);
    expect(r.tuyen[0].ten).toBe("Ra <Hòn> Bà & về");
    expect(r.tuyen[0].diem).toHaveLength(3);
    expect(r.tuyen[0].diem[1].lat).toBeCloseTo(B.lat, 5);
    expect(r.vet[0].diem[1]).toEqual([10.01, 107.01, 60_000]);
    expect(r.diem).toEqual([{ ten: "Rạn cá", lat: 9.5, lon: 106.5 }]);
  });
  it("tệp của máy khác: điểm hỏng bị bỏ, wpt tự đóng, vết không giờ vẫn đọc", () => {
    const xml = `<gpx><wpt lat="10" lon="107"/><wpt lat="999" lon="1"><name>x</name></wpt>
      <trk><trkseg><trkpt lat="10" lon="107"></trkpt><trkpt lat="10.1" lon="107.1"></trkpt></trkseg></trk>
      <rte><rtept lat="10" lon="107"/></rte></gpx>`;
    const r = docGpx(xml, 5000);
    expect(r.diem).toEqual([{ ten: "Điểm", lat: 10, lon: 107 }]);
    expect(r.vet[0].diem.map((d) => d[2])).toEqual([5000, 6000]);
    expect(r.tuyen).toHaveLength(0); // 1 điểm không thành tuyến
  });
});

import { docChay, docTuyen } from "../hai-do/kho-tuyen";
describe("kho tuyến", () => {
  it("bản lưu hỏng ⇒ rỗng; tuyến hỏng bị bỏ, tuyến lành giữ; điểm hỏng trong tuyến bị lọc", () => {
    expect(docTuyen(null)).toEqual([]);
    expect(docTuyen("{")).toEqual([]);
    const r = docTuyen(
      JSON.stringify([
        { id: "a", ten: "A", diem: [{ lat: 10, lon: 107 }, { lat: 999, lon: 1 }, { lat: 10.1, lon: 107.1 }], luc: 1 },
        { id: "b", diem: [{ lat: 10, lon: 107 }] },
        { ten: "không id", diem: [] },
      ]),
    );
    expect(r).toEqual([{ id: "a", ten: "A", diem: [{ lat: 10, lon: 107 }, { lat: 10.1, lon: 107.1 }], luc: 1 }]);
  });
  it("tuyến đang chạy: hỏng ⇒ null", () => {
    expect(docChay(JSON.stringify({ id: "a", toi: 2 }))).toEqual({ id: "a", toi: 2 });
    expect(docChay(JSON.stringify({ id: "a", toi: 0 }))).toBeNull();
    expect(docChay("x")).toBeNull();
  });
});

import { diemTrung, viTriChen } from "../hai-do/tuyen";
describe("sửa tuyến bằng ngón — chèn giữa, trúng điểm", () => {
  const px = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ];
  it("chạm sát chặng 1→2 ⇒ chèn vào vị trí 1; chặng 2→3 ⇒ vị trí 2", () => {
    expect(viTriChen(px, { x: 50, y: 6 })).toBe(1);
    expect(viTriChen(px, { x: 94, y: 60 })).toBe(2);
  });
  it("xa mọi chặng ⇒ null (thêm vào cuối); trúng điểm ⇒ null (để kéo); < 2 điểm ⇒ null", () => {
    expect(viTriChen(px, { x: 40, y: 60 })).toBeNull();
    expect(viTriChen(px, { x: 101, y: 2 })).toBeNull();
    expect(viTriChen([{ x: 0, y: 0 }], { x: 1, y: 1 })).toBeNull();
  });
  it("diemTrung: điểm gần nhất trong ngưỡng, ngoài ngưỡng ⇒ null", () => {
    expect(diemTrung(px, { x: 96, y: 4 })).toBe(1);
    expect(diemTrung(px, { x: 50, y: 50 })).toBeNull();
  });
});

import { gioDen } from "../hai-do/tuyen";
describe("giờ đến theo đồng hồ (ETA)", () => {
  const T = Date.parse("2026-11-04T13:00:00Z"); // 20:00 giờ VN
  it("cộng phút ⇒ giờ VN", () => {
    expect(gioDen(T, 0)).toBe("20:00");
    expect(gioDen(T, 100)).toBe("21:40");
  });
  it("qua nửa đêm ⇒ 'mai'; xa hơn ⇒ '+N ngày'", () => {
    expect(gioDen(T, 6 * 60 + 10)).toBe("02:10 mai");
    expect(gioDen(T, 50 * 60)).toBe("22:00 +2 ngày");
  });
});
