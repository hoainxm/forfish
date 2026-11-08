// Lộ trình — con nước ở cảng đậu, đáy theo nghề, trọng số khi mất sóng (2026-11-08, 09 §3 Phase 1e + §5c-b).
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { decodeTideStations, tideHeightAt } from "@/lib/tides";
import type { FairwayDepth } from "@/lib/fairway-depth";
import { dungCuaTrieu, luongCuaCang, TRAM_TOI_DA_KM } from "@/lib/lo-trinh/trieu-cang";
import { dayNoiBat, heSoDay, khoaO025, LOAI_DAY } from "@/lib/lo-trinh/day-nghe";
import { bangTrongSo, cauMatKhiTinhLai, soVoiLucTinh, type DauVaoTrongSo } from "@/lib/lo-trinh/offline-trong-so";
import { setModelParams } from "@/lib/model-params";
import { buildModelParams } from "../../../scripts/build-model-params.mjs";
import dayO from "@/data/day-o025.json";
import { deXuatLoTrinh } from "@/lib/lo-trinh/plan";
import type { CuaTrieu } from "@/lib/lo-trinh/trieu-cang";
import type { LoTrinhInput } from "@/lib/lo-trinh/types";

beforeEach(() => setModelParams(buildModelParams(process.cwd())));

const tram = decodeTideStations(JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/data/tide-stations.v1.json"), "utf8")));
const QUY_NHON = { lat: 13.76, lon: 109.27 };
const luong = (sauM: number, gan = QUY_NHON): FairwayDepth =>
  ({
    tu: { lat: gan.lat + 0.01, lon: gan.lon },
    den: { lat: gan.lat + 0.03, lon: gan.lon },
    sauM,
    daiKm: 2,
    xapXi: false,
    at: "2026-08-01",
    ten: "Từ phao 1 đến phao 3",
    route: { ten: "Luồng thử", noi: "", prov: {} },
    notice: {},
  }) as unknown as FairwayDepth;

describe("con nước ở cảng đậu", () => {
  it("có trạm gần, có luồng + mớn ⇒ ràng buộc: giờ qua cửa là giờ ĐẦU TIÊN đủ nước (sâu luồng + triều ≥ mớn + 0,5)", () => {
    const c = dungCuaTrieu(QUY_NHON, tram, [luong(0.8)], 2.0)!;
    expect(c).not.toBeNull();
    expect(c.kmTram).toBeLessThanOrEqual(TRAM_TOI_DA_KM);
    expect(c.rangBuoc).toBe(true);
    expect(c.canM).toBe(2.5);
    const st = tram.find((s) => s.name === c.tenTram)!;
    const tu = Date.parse("2026-11-09T23:00:00Z"); // 6 giờ sáng VN
    const ra = c.quaCua(tu)!;
    expect(ra).toBeGreaterThanOrEqual(tu);
    expect(0.8 + tideHeightAt(st, ra)).toBeGreaterThanOrEqual(2.5 - 1e-9);
    if (ra > tu) expect(0.8 + tideHeightAt(st, ra - 10 * 60_000)).toBeLessThan(2.5);
    expect(c.nuocLon(tu)!.ms).toBeGreaterThan(tu);
  });

  it("luồng sâu quá mức triều nào cũng không đủ ⇒ null (không bịa giờ đi)", () => {
    const c = dungCuaTrieu(QUY_NHON, tram, [luong(-5)], 3)!;
    expect(c.quaCua(Date.parse("2026-11-09T23:00:00Z"))).toBeNull();
  });

  it("thiếu luồng hoặc thiếu mớn ⇒ chỉ báo nước lớn, giờ đi giữ nguyên", () => {
    const t = Date.parse("2026-11-09T23:00:00Z");
    for (const c of [dungCuaTrieu(QUY_NHON, tram, [], 2), dungCuaTrieu(QUY_NHON, tram, [luong(1)], null)]) {
      expect(c!.rangBuoc).toBe(false);
      expect(c!.quaCua(t)).toBe(t);
      expect(c!.nuocLon(t)).not.toBeNull();
    }
    expect(luongCuaCang(QUY_NHON, [luong(1, { lat: 12, lon: 109.2 })])).toBeNull(); // luồng xa > 15 km không tính
  });

  it("không có trạm trong 40 km / chưa tải trạm ⇒ null", () => {
    expect(dungCuaTrieu({ lat: 8, lon: 113 }, tram, [], 2)).toBeNull();
    expect(dungCuaTrieu(QUY_NHON, null, [], 2)).toBeNull();
  });
});

describe("đáy theo nghề", () => {
  const o = (dayO as { o: Record<string, number[]> }).o;
  // ô có nhiều rạn + sát rạn nhất trong bảng
  const [khoa] = Object.entries(o).sort((a, b) => b[1][0] + b[1][5] - (a[1][0] + a[1][5]))[0];
  const [i, j] = khoa.split(",").map(Number);
  const lat = 5.025 + 0.25 * i, lon = 102.025 + 0.25 * j;

  it("bảng đáy: mỗi ô 6 tỉ phần cộng ≈ 1 (đất không tính), khoá đúng trục lưới cá", () => {
    expect(Object.keys(o).length).toBeGreaterThan(500);
    for (const fr of Object.values(o)) {
      expect(fr).toHaveLength(LOAI_DAY.length);
      expect(fr.reduce((a, b) => a + b, 0)).toBeGreaterThan(0.97);
    }
    expect(khoaO025(lat, lon)).toBe(khoa);
  });

  it("ô nhiều rạn: cào đôi bị trừ nặng hơn câu ngừ; ô nước sâu (vắng bảng) ⇒ 1; chưa nạp tham số ⇒ null", () => {
    const keo = heSoDay("keo-doi", lat, lon)!;
    const cau = heSoDay("cau-ngu", lat, lon)!;
    expect(keo).toBeLessThan(cau);
    expect(keo).toBeLessThan(0.5);
    expect(dayNoiBat(lat, lon)).toMatch(/ran|gan/);
    expect(heSoDay("keo-doi", 12.025, 112.025)).toBe(1);
    setModelParams(null);
    expect(heSoDay("keo-doi", lat, lon)).toBeNull();
  });
});

describe("trọng số khi mất sóng", () => {
  const du: DauVaoTrongSo = {
    now: Date.parse("2026-11-08T03:00:00Z"),
    soNgay: 10,
    ngayDi: "2026-11-09",
    caLuc: Date.parse("2026-11-08T00:00:00Z"),
    coMuaVu: true,
    bienDen: "2026-11-23",
    baoKiemDuoc: true,
    baiTu: "2026-11-08",
    thamSo: { trang: true, chang: true, mayBai: true, day: true },
    trieu: { coTram: true, rangBuoc: true },
  };

  it("đủ mọi lớp ⇒ 10 lớp đều 'du'", () => {
    const b = bangTrongSo(du);
    expect(b).toHaveLength(10);
    expect(b.every((r) => r.trangThai === "du")).toBe(true);
  });

  it("ngoài biển 5 ngày sau: cá cũ, sóng gió + bãi chỉ phủ một phần, bão chưa kiểm ⇒ nói đúng hậu quả", () => {
    const b = bangTrongSo({ ...du, now: du.now + 5 * 86_400_000, bienDen: "2026-11-14", baiTu: "2026-10-28", baoKiemDuoc: false });
    const m = Object.fromEntries(b.map((r) => [r.ma, r]));
    expect(m.ca.trangThai).toBe("cu");
    expect(m.bien.trangThai).toBe("thieu");
    expect(m.bien.cau).toMatch(/4 ngày cuối/);
    expect(m.bai.trangThai).toBe("thieu");
    expect(m.bao.cau).toMatch(/nghe đài/);
  });

  it("so với lúc tính: liệt kê lớp sẽ mất nếu tính lại; bản lưu cũ không ghi ⇒ nói thật", () => {
    const luc = bangTrongSo(du);
    const bay = bangTrongSo({ ...du, bienDen: null, thamSo: { ...du.thamSo, day: false } });
    const mat = soVoiLucTinh(luc, bay)!;
    expect(mat.map((r) => r.ma).sort()).toEqual(["bien", "day"]);
    expect(cauMatKhiTinhLai(mat)).toMatch(/Tính lại bây giờ sẽ mất: sóng gió, đáy biển/);
    expect(soVoiLucTinh(luc, luc)).toEqual([]);
    expect(cauMatKhiTinhLai([])).toBeNull();
    expect(soVoiLucTinh(undefined, bay)).toBeNull();
    expect(cauMatKhiTinhLai(null)).toMatch(/chưa ghi lúc tính/);
  });
});

describe("lộ trình dùng con nước + đáy", () => {
  const NOW = new Date("2026-11-08T03:00:00Z");
  const vao = (cuaTrieu: CuaTrieu | null): LoTrinhInput =>
    ({
      nghe: "keo-doi",
      cang: { ...QUY_NHON, ten: "Quy Nhơn" },
      ngayDi: "2026-11-09",
      soNgay: 5,
      tau: { speedKn: 6, litersPerHour: 20, fuelTankL: null },
      diemQuen: [],
      caTheoNgay: () => [
        { lat: 13.2, lon: 109.75, s: 90 },
        { lat: 13.25, lon: 109.75, s: 85 },
      ],
      bao: [],
      cuaTrieu,
    }) as LoTrinhInput;
  const gia = (rangBuoc: boolean, choGio: number): CuaTrieu => ({
    tenTram: "Quy Nhơn",
    kmTram: 2,
    uocTinh: false,
    luong: { ten: "Luồng thử", sauM: 1, ngay: "2026-08-01" },
    canM: rangBuoc ? 2.5 : null,
    rangBuoc,
    // cửa chỉ mở ở các mốc "chẵn choGio giờ" tính từ 0 giờ UTC — đủ để thấy dời giờ
    quaCua: (ms) => (rangBuoc ? Math.ceil(ms / (choGio * 3_600_000)) * choGio * 3_600_000 : ms),
    nuocLon: (ms) => ({ ms: ms + 3_600_000, caoM: 2 }),
  });

  it("ràng buộc: giờ đi dời tới lúc đủ nước, về tới cửa thiếu nước thì chờ; nói rõ luồng + nước cần", () => {
    const kq = deXuatLoTrinh(vao(gia(true, 10)), NOW);
    expect(kq.lich[0].cau).toMatch(/chờ nước, ra cửa lúc/);
    expect(kq.ghiChu.join(" ")).toMatch(/Giờ ra\/vào cửa theo con nước \(trạm Quy Nhơn\): luồng Luồng thử sâu 1 m, tàu cần 2,5 m/);
    expect(kq.lich.at(-1)!.denNgay).toBeLessThanOrEqual(5);
  });

  it("chỉ báo: không dời giờ, nói giờ nước lớn; chưa có trạm ⇒ nói chưa tính; có số đáy ⇒ '× đáy'", () => {
    const bao = deXuatLoTrinh(vao(gia(false, 10)), NOW);
    expect(bao.lich[0].cau).not.toMatch(/chờ nước/);
    expect(bao.ghiChu.join(" ")).toMatch(/nước lớn ngày đi lúc/);
    expect(bao.ghiChu.join(" ")).toMatch(/× đáy/);
    expect(deXuatLoTrinh(vao(null), NOW).ghiChu.join(" ")).toMatch(/Chưa tính con nước ở Quy Nhơn/);
  });
});

