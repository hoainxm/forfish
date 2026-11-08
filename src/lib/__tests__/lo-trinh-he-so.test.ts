// Lộ trình theo NGHỀ + hệ số TRĂNG × SÓNG GIÓ (2026-11-08) — lo-trinh/he-so.ts, dau-vao.ts, plan.ts.
import { describe, it, expect, beforeEach } from "vitest";
import { SPECIES_PROFILES } from "@/lib/fish-predict";
import { CHANG_DE_DAT, doRoiTrang, gioChang, heSoBien, heSoTrang, hieuUngRam, moHinhChang, DIEM_BO_NGAY } from "@/lib/lo-trinh/he-so";
import { diemOTheoNghe, dungCaTheoNgay } from "@/lib/lo-trinh/dau-vao";
import { setModelParams } from "@/lib/model-params";
import { buildModelParams } from "../../../scripts/build-model-params.mjs";
import loTrinhParams from "@/data/lo-trinh-params.json";

// tham số lộ trình đi qua model-params (khong-lo-nguon nợ #9) — nạp đúng bản phát hành trước mỗi ca
beforeEach(() => setModelParams(buildModelParams(process.cwd())));
const LOAI_THEO_NGHE = loTrinhParams.loaiTheoNghe as Record<string, string[]>;
import { deXuatLoTrinh } from "@/lib/lo-trinh/plan";
import type { BlendableCell } from "@/lib/fish-blend";
import type { LoTrinhInput, Nghe, OCa } from "@/lib/lo-trinh/types";

const NOW = new Date("2026-11-08T03:00:00Z");
const QUY_NHON = { lat: 13.76, lon: 109.27, ten: "Quy Nhơn" };

describe("nhóm loài theo nghề", () => {
  it("mọi tên loài trong LOAI_THEO_NGHE có thật trong SPECIES_PROFILES (tên ngắn = khoá của `sp`) — gõ sai là nghề đó trắng bản đồ", () => {
    const ten = new Set(SPECIES_PROFILES.map((f) => f.short));
    for (const [nghe, ds] of Object.entries(LOAI_THEO_NGHE)) {
      expect(ds.length, nghe).toBeGreaterThan(0);
      for (const l of ds) expect(ten.has(l), `${nghe}: ${l}`).toBe(true);
    }
  });

  it("câu ngừ chấm theo loài ngừ đại dương, KHÔNG lấy cá nục dù cá nục điểm cao hơn", () => {
    expect(diemOTheoNghe({ "cá nục": 95, "ngừ vây vàng": 40, "ngừ mắt to": 55 }, "cau-ngu")).toEqual({ s: 55, loai: "ngừ mắt to" });
    expect(diemOTheoNghe({ "cá nục": 95 }, "cau-ngu")).toBeNull();
    expect(diemOTheoNghe(undefined, "cau-ngu")).toBeNull();
  });

  it("dungCaTheoNgay có nghề ⇒ bỏ ô không có loài của nghề, ô còn lại mang tên loài", () => {
    const o = (lat: number, lon: number, sp: Record<string, number>): BlendableCell => ({
      lat, lon, s: Math.max(0, ...Object.values(sp)), top: [], sp, t: 27, c: null,
    });
    const fc = {
      date: "2026-11-08",
      baseMode: true,
      cells: [o(19.5, 106.5, { "cá nục": 95 }), o(12.5, 110.5, { "ngừ vây vàng": 70 })],
    };
    const ham = dungCaTheoNgay(fc, null, "2026-11-08", "2026-11-08", "cau-ngu");
    const ra = ham(0);
    expect(ra.every((c) => c.loai === "ngừ vây vàng")).toBe(true);
    expect(ra.some((c) => c.lat === 19.5)).toBe(false);
  });
});

describe("hệ số trăng", () => {
  it("độ rọi: trăng non ≈ 0, rằm ≈ 1 (mốc thiên văn)", () => {
    expect(doRoiTrang(Date.UTC(2000, 0, 6, 18, 14))).toBeLessThan(0.01);
    // trăng tròn 2026-10-26 ~ 04:12 UTC
    expect(doRoiTrang(Date.UTC(2026, 9, 26, 4))).toBeGreaterThan(0.97);
  });
  it("tỷ trọng = số đo sổ tàu: đêm rằm câu ngừ ×(1−5,3%), đêm tối ×1", () => {
    expect(hieuUngRam("cau-ngu")).toBe(-0.053);
    expect(heSoTrang("cau-ngu", 1)).toBeCloseTo(1 + hieuUngRam("cau-ngu"), 6);
    expect(heSoTrang("cau-ngu", 0)).toBe(1);
    expect(heSoTrang("chup-muc", 1)).toBeCloseTo(0.871, 3);
  });
  it("CHƯA NẠP tham số (máy mới, chưa khoá) ⇒ trăng trung tính, nhóm loài lùi về loài tốt nhất — không ném, không trắng", () => {
    setModelParams(null);
    expect(heSoTrang("chup-muc", 1)).toBe(1);
    expect(diemOTheoNghe({ "cá nục": 95, "ngừ vây vàng": 40 }, "cau-ngu")).toEqual({ s: 95, loai: "cá nục" });
  });
});

describe("hệ số biển (thang Điểm đi biển)", () => {
  it("êm giữ nguyên, động mạnh về 0, thiếu số ⇒ null", () => {
    expect(heSoBien(0.6, 15)!.heSo).toBe(1);
    const nhe = heSoBien(1.6, 30)!;
    expect(nhe.heSo).toBeGreaterThan(0);
    expect(nhe.heSo).toBeLessThan(1);
    const manh = heSoBien(4, 70)!;
    expect(manh.diem).toBeLessThanOrEqual(DIEM_BO_NGAY);
    expect(manh.heSo).toBe(0);
    expect(heSoBien(null, null)).toBeNull();
  });
});

/* Hai bãi ngừ gần Quy Nhơn: bãi A biển động mạnh suốt chuyến, bãi B êm.
   Cùng điểm cá ⇒ thuật toán phải chọn B và đưa đủ yếu tố ra. */
function luoiHaiBai(): OCa[] {
  const out: OCa[] = [];
  for (let la = 11; la <= 16; la += 0.25)
    for (let lo = 108.5; lo <= 112; lo += 0.25) {
      const a = 80 * Math.exp(-(((la - 14.2) ** 2 + (lo - 109.75) ** 2) / 0.18));
      const b = 80 * Math.exp(-(((la - 13.0) ** 2 + (lo - 110.0) ** 2) / 0.18));
      const s = Math.round(Math.max(5, a, b));
      out.push({ lat: +la.toFixed(2), lon: +lo.toFixed(2), s, loai: a > b ? "ngừ vây vàng" : "ngừ mắt to" });
    }
  return out;
}

function input(p: Partial<LoTrinhInput> = {}): LoTrinhInput {
  const L = luoiHaiBai();
  return {
    cang: QUY_NHON,
    ngayDi: "2026-11-10",
    soNgay: 8,
    nghe: "cau-ngu" as Nghe,
    tau: { speedKn: 8, litersPerHour: 25, fuelTankL: 5000 },
    diemQuen: [],
    caTheoNgay: () => L,
    bao: [],
    ...p,
  };
}

describe("deXuatLoTrinh với trăng × sóng gió", () => {
  it("né bãi biển động, vùng ra mang loài + yếu tố từng ngày", () => {
    const kq = deXuatLoTrinh(
      input({
        bienTheoNgay: (lat) => (lat > 13.6 ? { songM: 4.2, gioKmh: 75 } : { songM: 0.8, gioKmh: 18 }),
      }),
      NOW,
    );
    expect(kq.vung.length).toBeGreaterThan(0);
    for (const v of kq.vung) {
      expect(v.lat).toBeLessThan(13.6); // không cắm ngày đánh ở bãi sóng 4 m
      expect(v.loai).toBe("ngừ mắt to");
      expect(v.yeuTo?.length).toBe(v.soNgayDanh);
      for (const y of v.yeuTo!) {
        expect(y.songM).toBe(0.8);
        expect(y.trang).toBeGreaterThanOrEqual(0);
        expect(y.trang).toBeLessThanOrEqual(100);
        expect(y.heSo).toBeGreaterThan(0.9);
      }
    }
    expect(kq.ghiChu.some((g) => g.startsWith("Cách chấm mỗi ngày đánh"))).toBe(true);
    expect(kq.ghiChu.some((g) => g.includes("Chưa có đủ dự báo sóng gió"))).toBe(false);
  });

  it("không có dự báo sóng gió ⇒ vẫn ra lộ trình nhưng NÓI là chưa né biển động", () => {
    const kq = deXuatLoTrinh(input({ bienTheoNgay: null }), NOW);
    expect(kq.vung.length).toBeGreaterThan(0);
    expect(kq.ghiChu.some((g) => g.includes("Chưa có đủ dự báo sóng gió"))).toBe(true);
    expect(kq.vung[0].yeuTo?.[0].songM).toBeNull();
  });

  it("bienTheoNgay ném lỗi ⇒ không sập, coi như thiếu dự báo", () => {
    const kq = deXuatLoTrinh(
      input({
        bienTheoNgay: () => {
          throw new Error("hỏng");
        },
      }),
      NOW,
    );
    expect(kq.vung.length).toBeGreaterThan(0);
  });

  it("nghề không có ô nào ⇒ nói theo nghề, không bịa tuyến", () => {
    const kq = deXuatLoTrinh(input({ caTheoNgay: () => [] }), NOW);
    expect(kq.vung).toEqual([]);
    expect(kq.ghiChu.some((g) => g.includes("câu cá ngừ"))).toBe(true);
  });
});

/*  GIỜ CHẶNG = a + hải lý / v THEO NGHỀ (2026-11-08, docs/research/vet-tau-pha-nghe-2026-11.md §0, §6, §7 B0). */
describe("giờ chặng theo số đo đội tàu", () => {
  it("số đo đi qua model-params; thiếu ⇒ mặc định dè dặt 5 kn + 1,5 giờ (KHÔNG 7 kn)", () => {
    const m = moHinhChang("luoi-vay");
    expect(m).toEqual({ aGio: 0.99, vKn: 5.32, p80HeSo: 1.14, doDuoc: true });
    setModelParams(null);
    expect(moHinhChang("luoi-vay")).toEqual(CHANG_DE_DAT);
    expect(CHANG_DE_DAT.vKn).toBeLessThan(7);
  });
  it("giờ = a + hải lý / v; 0 km ⇒ 0; tốc độ khai chỉ là TRẦN (khai nhanh hơn đo không làm chặng ngắn đi)", () => {
    const m = moHinhChang("cau-ngu");
    const km = 100 * 1.852; // 100 hải lý
    expect(gioChang(km, m)).toBeCloseTo(1.52 + 100 / 5.17, 6);
    expect(gioChang(0, m)).toBe(0);
    expect(gioChang(km, m, 9)).toBeCloseTo(gioChang(km, m), 6);
    expect(gioChang(km, m, 4)).toBeCloseTo(1.52 + 100 / 4, 6);
    // so với "hải lý / 7 kn" cũ: chặng 100 hải lý dài thêm ~6 giờ — đúng chiều an toàn
    expect(gioChang(km, m) - 100 / 7).toBeGreaterThan(5);
  });
  it("lộ trình: lịch báo khoảng P50–P80, khai 9 kn vẫn tính theo số đo + nói rõ", () => {
    const kq = deXuatLoTrinh(
      {
        nghe: "luoi-vay",
        cang: { lat: QUY_NHON.lat, lon: QUY_NHON.lon, ten: QUY_NHON.ten },
        ngayDi: "2026-11-08",
        soNgay: 7,
        tau: { speedKn: 9, litersPerHour: 20, fuelTankL: 5000 },
        diemQuen: [],
        caTheoNgay: () => [
          { lat: 13.2, lon: 110.6, s: 90 },
          { lat: 13.25, lon: 110.65, s: 85 },
          { lat: 13.3, lon: 110.6, s: 80 },
        ],
        bao: [],
      } as unknown as LoTrinhInput,
      NOW,
    );
    expect(kq.lich[0].cau).toMatch(/khoảng \d+–\d+ giờ/);
    expect(kq.ghiChu.join(" ")).toMatch(/tốc độ thật của tàu cùng nghề \(5,3 hải lý\/giờ\)/);
  });
});
