import { describe, it, expect, beforeEach } from "vitest";

const _ls = (() => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  } as Storage;
})();
(globalThis as unknown as { window: unknown }).window = { localStorage: _ls };
(globalThis as unknown as { localStorage: Storage }).localStorage = _ls;

import { baoTuTinBao, docSo, docTauTinh, dungCaTheoNgay, ghiTauTinh, gioTinBao, TAU_TRAN } from "../lo-trinh/dau-vao";
import { chuoiChangTuMoc, mucVung, soViTri, LECH_HAI_LY } from "../lo-trinh/so-vi-tri";
import { MAX_STOPS } from "../route-stops";
import type { StormAlert, StormCheck } from "../storms";

const O = (lat: number, lon: number, s: number) => ({ lat, lon, s, top: [], sp: {}, t: 28, c: null });

beforeEach(() => localStorage.clear());

describe("dungCaTheoNgay", () => {
  it("không có bản đồ cá ⇒ mọi ngày rỗng", () => {
    const f = dungCaTheoNgay(null, null, "2026-11-02", "2026-10-29");
    expect(f(0)).toEqual([]);
    expect(f(10)).toEqual([]);
  });

  it("baseMode ⇒ trả nguyên ô (đã lọc trong vùng), chỉ lat/lon/s", () => {
    const fc = { date: "2026-10-28", cells: [O(12, 110, 80), O(40, 140, 90)], baseMode: true };
    const f = dungCaTheoNgay(fc, null, "2026-11-02", "2026-10-29");
    expect(f(5)).toEqual([{ lat: 12, lon: 110, s: 80 }]); // ô Nhật Bản bị lọc ngoài vùng
  });

  it("thiếu bản mùa vụ ⇒ giữ nguyên dự báo ở ngày xa (không bịa)", () => {
    const fc = { date: "2026-10-28", cells: [O(12, 110, 70)] };
    const f = dungCaTheoNgay(fc, null, "2026-11-02", "2026-10-29");
    expect(f(12)).toEqual([{ lat: 12, lon: 110, s: 70 }]);
    expect(f(12)).toBe(f(12)); // nhớ theo (tầm, tháng)
  });
});

describe("baoTuTinBao", () => {
  const now = Date.parse("2026-10-29T08:00:00Z");
  const storm: StormAlert = {
    id: "s1", name: "KAJIKI", kindLabel: "Bão", windKmh: 100, lat: 15, lon: 115,
    alert: "danger", updated: "2026-10-29T06:00:00Z", track: [[115, 15], [113, 16]], areas: [],
  };
  it("chưa có tin / không hỏi được ⇒ null (phải nói ra)", () => {
    expect(baoTuTinBao(null, now)).toBeNull();
    expect(baoTuTinBao({ ok: false }, now)).toBeNull();
  });
  it("tin cũ mà không bão ⇒ null (cấm coi là trời quang)", () => {
    const cu: StormCheck = { ok: true, storms: [], checkedAt: "2026-10-27T00:00:00Z" };
    expect(baoTuTinBao(cu, now)).toBeNull();
  });
  it("tin mới không bão ⇒ []", () => {
    const moi: StormCheck = { ok: true, storms: [], checkedAt: "2026-10-29T07:00:00Z" };
    expect(baoTuTinBao(moi, now)).toEqual([]);
    expect(gioTinBao(moi)).toBe("2026-10-29T07:00:00Z");
  });
  it("có bão ⇒ tâm + track dự báo, kể cả tin cũ", () => {
    const cu: StormCheck = { ok: true, storms: [storm], checkedAt: "2026-10-26T00:00:00Z" };
    const r = baoTuTinBao(cu, now)!;
    expect(r[0].ten).toBe("KAJIKI");
    expect(r[0].diem[0]).toEqual({ lat: 15, lon: 115 });
    expect(r[0].diem.length).toBeGreaterThan(1);
  });
});

describe("hồ sơ tàu forfish.boat.v1", () => {
  it("chưa khai ⇒ số mặc định + cờ macDinh", () => {
    const r = docTauTinh();
    expect(r.macDinh).toBe(true);
    expect(r.docHong).toBe(false);
    expect(r.tau.fuelTankL).toBeNull();
  });
  it("ghi chỉ đè ba trường, giữ mớn nước", () => {
    localStorage.setItem("forfish.boat.v1", JSON.stringify({ speedKn: 7, litersPerHour: 20, draftM: 2.4 }));
    docTauTinh();
    expect(ghiTauTinh({ speedKn: 9, litersPerHour: 30, fuelTankL: 8000 })).toBe(true);
    const raw = JSON.parse(localStorage.getItem("forfish.boat.v1")!);
    expect(raw).toEqual({ speedKn: 9, litersPerHour: 30, draftM: 2.4, fuelTankL: 8000 });
    expect(docTauTinh().macDinh).toBe(false);
  });
  it("ĐỌC HỎNG ⇒ không ghi đè (K4)", () => {
    localStorage.setItem("forfish.boat.v1", "[1,2]");
    expect(docTauTinh().docHong).toBe(true);
    expect(ghiTauTinh({ speedKn: 9, litersPerHour: 30, fuelTankL: null })).toBe(false);
    expect(localStorage.getItem("forfish.boat.v1")).toBe("[1,2]");
  });
  it("docSo: dấu phẩy, ngoài trần, bỏ trống", () => {
    expect(docSo("7,5", TAU_TRAN.speedKn)).toBe(7.5);
    expect(docSo("99", TAU_TRAN.speedKn)).toBeNull();
    expect(docSo("", TAU_TRAN.speedKn)).toBeNull();
    expect(docSo("abc", TAU_TRAN.speedKn)).toBeNull();
  });
});

describe("so vị trí + thang vùng", () => {
  const kq = {
    soNgayTinh: 10,
    moc: [
      { lat: 13.76, lon: 109.27 },
      { lat: 13.76, lon: 112 },
      { lat: 13.76, lon: 109.27 },
    ],
    lich: [
      { tuNgay: 1, denNgay: 2, loai: "chay" as const, cau: "Chạy ra Vùng 1" },
      { tuNgay: 3, denNgay: 9, loai: "danh" as const, cau: "Đánh Vùng 1" },
      { tuNgay: 10, denNgay: 10, loai: "ve" as const, cau: "Về Quy Nhơn" },
    ],
  };
  const luc = (iso: string) => Date.parse(`${iso}T05:00:00Z`); // 12h trưa VN

  it("trên tuyến ⇒ 0 hải lý, đúng chặng theo lịch", () => {
    const r = soViTri(kq, "2026-11-01", { lat: 13.76, lon: 111 }, luc("2026-11-04"));
    expect(r.cachTuyenHaiLy).toBe(0);
    expect(r.theoKeHoach).toBe("Theo kế hoạch: ngày 4 — đánh Vùng 1.");
    expect(r.lech).toBe(false);
  });
  it(`lệch > ${LECH_HAI_LY} hải lý ⇒ cờ lệch`, () => {
    const r = soViTri(kq, "2026-11-01", { lat: 14.5, lon: 111 }, luc("2026-11-04"));
    expect(r.cachTuyenHaiLy).toBeGreaterThan(LECH_HAI_LY);
    expect(r.lech).toBe(true);
  });
  it("chưa tới ngày / đã quá chuyến", () => {
    expect(soViTri(kq, "2026-11-01", { lat: 13.76, lon: 110 }, luc("2026-10-30")).theoKeHoach).toContain("còn 2 ngày");
    expect(soViTri(kq, "2026-11-01", { lat: 13.76, lon: 110 }, luc("2026-11-20")).theoKeHoach).toContain("đã về cảng");
  });
  it("thang chữ Được/Khá/Tốt theo mốc FISH_LEVEL_BANDS", () => {
    expect(mucVung(45)).toBe("Được");
    expect(mucVung(60)).toBe("Khá");
    expect(mucVung(90)).toBe("Tốt");
  });
});

describe("chuoiChangTuMoc — nạp vào dẫn đường", () => {
  const cang = { lat: 13.76, lon: 109.27, ten: "Cảng Quy Nhơn", loai: "cang" as const };
  const v = (i: number) => ({ lat: 13 + i, lon: 112, ten: `Vùng ${i}`, loai: "vung" as const });
  it("bỏ cảng xuất phát, giữ cảng về cuối, có tên", () => {
    const r = chuoiChangTuMoc([cang, v(1), v(2), cang]);
    expect(r.map((s) => s.name)).toEqual(["Vùng 1", "Vùng 2", "Cảng Quy Nhơn"]);
  });
  it(`quá trần ${MAX_STOPS} ⇒ bớt mốc giữa, cảng về vẫn ở cuối`, () => {
    const r = chuoiChangTuMoc([cang, v(1), v(2), v(3), v(4), v(5), v(6), v(7), cang]);
    expect(r).toHaveLength(MAX_STOPS);
    expect(r[r.length - 1].name).toBe("Cảng Quy Nhơn");
  });
});
