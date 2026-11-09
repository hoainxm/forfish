// Lộ trình theo NGHỀ + hệ số TRĂNG × SÓNG GIÓ (2026-11-08) — lo-trinh/he-so.ts, dau-vao.ts, plan.ts.
import { describe, it, expect, beforeEach } from "vitest";
import { CHANG_DE_DAT, daDoTrang, dauTrungBinh, doRoiTrang, gioChang, gioMayBai, heSoBai, heSoBien, heSoTrang, hieuUngRam, moHinhChang, DIEM_BO_NGAY, SAN_BAI } from "@/lib/lo-trinh/he-so";
import { BAI_NGHE, diemOTheoLoai, dungBaiTheoNgay, dungCaTheoNgay } from "@/lib/lo-trinh/dau-vao";
import { GIO_XUAT_BEN, KHUNG_DANH } from "@/lib/lo-trinh/plan";
import type { NenFleet } from "@/lib/fleet-density";
import { setModelParams } from "@/lib/model-params";
import { buildModelParams } from "../../../scripts/build-model-params.mjs";
import loTrinhParams from "@/data/lo-trinh-params.json";

// tham số lộ trình đi qua model-params (khong-lo-nguon nợ #9) — nạp đúng bản phát hành trước mỗi ca
beforeEach(() => setModelParams(buildModelParams(process.cwd())));
import { deXuatLoTrinh } from "@/lib/lo-trinh/plan";
import type { BlendableCell } from "@/lib/fish-blend";
import type { LoTrinhInput, Nghe, OCa } from "@/lib/lo-trinh/types";

const NOW = new Date("2026-11-08T03:00:00Z");
const QUY_NHON = { lat: 13.76, lon: 109.27, ten: "Quy Nhơn" };

describe("loài chủ tàu chọn (09/11 — bỏ nhóm loài đoán theo nghề)", () => {
  it("tham số phát hành KHÔNG còn danh sách loài theo nghề", () => {
    expect("loaiTheoNghe" in loTrinhParams).toBe(false);
  });

  it("chấm theo loài đã chọn, KHÔNG lấy cá nục dù cá nục điểm cao hơn", () => {
    const chon = ["ngừ vây vàng", "ngừ mắt to"];
    expect(diemOTheoLoai({ "cá nục": 95, "ngừ vây vàng": 40, "ngừ mắt to": 55 }, chon)).toEqual({ s: 55, loai: "ngừ mắt to" });
    expect(diemOTheoLoai({ "cá nục": 95 }, chon)).toBeNull();
    expect(diemOTheoLoai(undefined, chon)).toBeNull();
    expect(diemOTheoLoai({ "cá nục": 95 }, [])).toBeNull();
  });

  it("dungCaTheoNgay có loài ⇒ bỏ ô không có loài đã chọn, ô còn lại mang tên loài; không chọn ⇒ điểm chung", () => {
    const o = (lat: number, lon: number, sp: Record<string, number>): BlendableCell => ({
      lat, lon, s: Math.max(0, ...Object.values(sp)), top: [], sp, t: 27, c: null,
    });
    const fc = {
      date: "2026-11-08",
      baseMode: true,
      cells: [o(19.5, 106.5, { "cá nục": 95 }), o(12.5, 110.5, { "ngừ vây vàng": 70 })],
    };
    const ra = dungCaTheoNgay(fc, null, "2026-11-08", "2026-11-08", ["ngừ vây vàng"])(0);
    expect(ra.every((c) => c.loai === "ngừ vây vàng")).toBe(true);
    expect(ra.some((c) => c.lat === 19.5)).toBe(false);
    const chung = dungCaTheoNgay(fc, null, "2026-11-08", "2026-11-08", [])(0);
    expect(chung.some((c) => c.lat === 19.5)).toBe(true);
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
  it("CHƯA NẠP tham số (máy mới, chưa khoá) ⇒ trăng trung tính — không ném", () => {
    setModelParams(null);
    expect(heSoTrang("chup-muc", 1)).toBe(1);
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
    expect(m).toEqual({ aGio: 0.98, vKn: 5.32, p80HeSo: 1.14, doDuoc: true });
    setModelParams(null);
    expect(moHinhChang("luoi-vay")).toEqual(CHANG_DE_DAT);
    expect(CHANG_DE_DAT.vKn).toBeLessThan(7);
  });
  it("cào / cào đôi có số đo riêng (chặng có đầu là cảng — báo cáo §10), không rơi về mặc định; trăng ĐÃ ĐO 09/11", () => {
    expect(moHinhChang("luoi-keo")).toEqual({ aGio: 0.67, vKn: 4.95, p80HeSo: 1.81, doDuoc: true });
    expect(moHinhChang("keo-doi")).toEqual({ aGio: 0.79, vKn: 4.95, p80HeSo: 1.98, doDuoc: true });
    // cào đôi: đêm rằm −9,7 % (p 0,002); cào đơn: CI chứa 0 ⇒ 0 nhưng là ĐÃ ĐO (ghi chú nói "như nhau", không "chưa có")
    expect(hieuUngRam("keo-doi")).toBe(-0.097);
    expect(heSoTrang("keo-doi", 1)).toBeCloseTo(0.903, 6);
    expect(hieuUngRam("luoi-keo")).toBe(0);
    expect(daDoTrang("luoi-keo")).toBe(true);
    expect(heSoTrang("luoi-keo", 1)).toBe(1);
    setModelParams(null);
    expect(daDoTrang("luoi-keo")).toBe(false);
  });
  it("rê: chặng đo lại trên chặng có đầu là cảng (09/11 — sai trung vị 21,4 % → 16,3 %)", () => {
    expect(moHinhChang("luoi-re")).toEqual({ aGio: 0.79, vKn: 5.06, p80HeSo: 1.31, doDuoc: true });
  });
  it("giờ = a + hải lý / v; 0 km ⇒ 0; tốc độ khai chỉ là TRẦN (khai nhanh hơn đo không làm chặng ngắn đi)", () => {
    const m = moHinhChang("cau-ngu");
    const km = 100 * 1.852; // 100 hải lý
    expect(gioChang(km, m)).toBeCloseTo(1.64 + 100 / 5.31, 6); // câu ngừ đo riêng (research §10.9, đo lại 09/11)
    expect(gioChang(0, m)).toBe(0);
    expect(gioChang(km, m, 9)).toBeCloseTo(gioChang(km, m), 6);
    expect(gioChang(km, m, 4)).toBeCloseTo(1.64 + 100 / 4, 6);
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

/*  MỖI NGHỀ MỘT CÁCH TÍNH (2026-11-08, anh Long: "mỗi nghề có cách tính riêng, dẫn tới bãi đánh riêng, lịch riêng").
    research vet-tau §10.5 + 09 §3 Phase 1d. */
describe("hồ sơ nghề — lịch, dầu, bãi", () => {
  const vungGan = [
    { lat: 13.2, lon: 109.75, s: 90 },
    { lat: 13.25, lon: 109.75, s: 85 },
  ];
  const vao = (nghe: Nghe, them: Partial<LoTrinhInput> = {}): LoTrinhInput =>
    ({
      nghe,
      cang: { lat: QUY_NHON.lat, lon: QUY_NHON.lon, ten: QUY_NHON.ten },
      ngayDi: "2026-11-08",
      gioDi: 6, // ca thử dựng quanh giờ đi 6 giờ (giờ mặc định nay theo nghề — gioDiMacDinh)
      soNgay: 5,
      tau: { speedKn: 6, litersPerHour: 20, fuelTankL: null },
      diemQuen: [],
      caTheoNgay: () => vungGan,
      bao: [],
      ...them,
    }) as LoTrinhInput;

  it("khung đánh theo nghề: đêm/ngày/cả ngày; xuất bến 6 giờ", () => {
    expect(GIO_XUAT_BEN).toBe(6);
    expect(KHUNG_DANH["keo-doi"]).toMatchObject({ batDau: 6, dai: 11 });
    expect(KHUNG_DANH["luoi-keo"].dai).toBe(24);
    for (const n of ["chup-muc", "luoi-vay"] as Nghe[]) expect(KHUNG_DANH[n].batDau).toBeGreaterThanOrEqual(17);
  });

  it("tới bãi ~15 giờ 30 (đi 6 giờ, chạy ~9,5 giờ): chụp mực chờ tới 18 giờ đánh đêm; cào đôi quá nửa khung ⇒ chờ 6 giờ sáng; cào đơn kéo luôn", () => {
    const chup = deXuatLoTrinh(vao("chup-muc"), NOW);
    expect(chup.lich[0].cau).toMatch(/neo chờ tới 18 giờ/);
    expect(chup.lich.find((d) => d.loai === "danh")!).toMatchObject({ tuNgay: 1 });
    expect(chup.lich.find((d) => d.loai === "danh")!.cau).toMatch(/đánh đêm/);
    const doi = deXuatLoTrinh(vao("keo-doi"), NOW);
    expect(doi.lich[0].cau).toMatch(/neo chờ tới 6 giờ/);
    expect(doi.lich.find((d) => d.loai === "danh")!).toMatchObject({ tuNgay: 2 });
    expect(doi.lich.find((d) => d.loai === "danh")!.cau).toMatch(/kéo ban ngày 6–17 giờ/);
    const don = deXuatLoTrinh(vao("luoi-keo"), NOW);
    expect(don.lich[0].cau).not.toMatch(/neo chờ/);
    expect(don.lich.find((d) => d.loai === "danh")!.cau).toMatch(/kéo cả ngày đêm/);
    // chuyến không quá số ngày khai
    for (const kq of [chup, doi, don]) expect(kq.lich.at(-1)!.denNgay).toBeLessThanOrEqual(5);
  });

  it("dầu lúc đánh: cào chạy máy ~13 giờ/ngày ở bãi ⇒ cùng tuyến tốn dầu hơn hẳn câu", () => {
    expect(gioMayBai("keo-doi")).toBe(12.94);
    expect(gioMayBai("luoi-keo")).toBe(13.54);
    expect(gioMayBai("cau-ngu")).toBe(1.5);
    const cau = deXuatLoTrinh(vao("cau-ngu"), NOW);
    const keo = deXuatLoTrinh(vao("luoi-keo"), NOW);
    expect(keo.litDau).toBeGreaterThan(cau.litDau * 2);
    expect(keo.ghiChu.join(" ")).toMatch(/giờ máy lúc đánh \(55 lít mỗi giờ máy, mức trung bình tàu lưới cào; chạy máy khoảng 13,5 giờ/);
    // câu ngừ chưa có bài đo dầu đèn ⇒ không cộng, KHÔNG đòi bà con khai (09/11)
    expect(cau.ghiChu.join(" ")).not.toMatch(/chong đèn|khai số lít/);
    setModelParams(null);
    expect(gioMayBai("keo-doi")).toBeNull();
    expect(deXuatLoTrinh(vao("keo-doi"), NOW).ghiChu.join(" ")).toMatch(/Lít dầu tính theo giờ chạy máy \(20 lít mỗi giờ máy\)\./);
  });

  it("dầu TRUNG BÌNH theo nghề (09/11, bỏ ô lít dầu): số khai của bà con không đổi kết quả; đèn theo nghề", () => {
    expect(dauTrungBinh("chup-muc")).toEqual({ litGio: 93, litDem: 180 });
    expect(dauTrungBinh("luoi-vay")).toEqual({ litGio: 65, litDem: 70 });
    expect(dauTrungBinh("cau-ngu")).toEqual({ litGio: 55, litDem: null });
    const a = deXuatLoTrinh(vao("chup-muc"), NOW);
    const b = deXuatLoTrinh({ ...vao("chup-muc"), tau: { speedKn: 7, litersPerHour: 999, fuelTankL: null, litDem: 999 } }, NOW);
    expect(b.litDau).toBe(a.litDau);
    const dem = a.vung.reduce((s, v) => s + v.soNgayDanh, 0);
    expect(a.ghiChu.join(" ")).toMatch(new RegExp(`chong đèn 180 lít × ${dem} đêm`));
    expect(a.ghiChu.join(" ")).not.toMatch(/tạm tính \d+ lít/);
    setModelParams(null);
    expect(dauTrungBinh("chup-muc")).toEqual({ litGio: null, litDem: null });
  });

  it("hệ số bãi: chỗ không ai đánh nghề này còn 25 %, đông nhất giữ nguyên, chưa có bãi ⇒ 1", () => {
    expect(SAN_BAI).toBe(0.25);
    expect(heSoBai(0)).toBe(0.25);
    expect(heSoBai(1)).toBe(1);
    expect(heSoBai(0.5)).toBeCloseTo(0.625, 6);
    expect(heSoBai(null)).toBe(1);
    expect(heSoBai(Number.NaN)).toBe(1);
  });

  it("bãi kéo lộ trình về chỗ tàu cùng nghề hay đánh, dù điểm cá ở đó thấp hơn một chút", () => {
    const hai = [
      { lat: 12.0, lon: 109.6, s: 90 }, // cá cao nhưng không tàu cào nào đánh
      { lat: 13.2, lon: 109.75, s: 80 }, // bãi cào
    ];
    const bai = (lat: number) => (lat > 13 ? 1 : 0);
    const co = deXuatLoTrinh(vao("keo-doi", { caTheoNgay: () => hai, baiTheoNgay: (lat) => bai(lat), soNgay: 3 }), NOW);
    expect(co.vung[0].lat).toBeGreaterThan(13);
    expect(co.vung[0].yeuTo?.[0].bai).toBe(100);
    expect(co.ghiChu.join(" ")).toMatch(/× bãi/);
    const khong = deXuatLoTrinh(vao("keo-doi", { caTheoNgay: () => hai, soNgay: 3 }), NOW);
    expect(khong.ghiChu.join(" ")).toMatch(/Chưa có bãi tàu cào đôi/);
  });

  it("dungBaiTheoNgay: điểm nền ÷ 100 theo ô + ngày; ô không có ⇒ 0; ngày ngoài bộ ⇒ null; mỗi nghề có bãi riêng", () => {
    const nen = {
      ok: true,
      tu: "2026-11-08",
      nghe: "keo-doi",
      step: 0.25,
      ngay: [{ dateIso: "2026-11-09", moonBin: "0", baseDays: 30, thinBase: false, ref: 1, o: [[13.275, 109.775, 5, 5, 80, 3, null]] }],
      loai: {},
      generatedAt: "",
    } as unknown as NenFleet;
    const f = dungBaiTheoNgay(nen, "2026-11-08")!;
    expect(f(13.3, 109.8, 1)).toBeCloseTo(0.8, 6);
    expect(f(10, 108, 1)).toBe(0);
    expect(f(13.3, 109.8, 5)).toBeNull();
    expect(dungBaiTheoNgay(null, "2026-11-08")).toBeNull();
    expect(new Set(Object.values(BAI_NGHE)).size).toBe(6);
    expect(BAI_NGHE["keo-doi"]).toBe("keo-doi");
    expect(BAI_NGHE["luoi-keo"]).toBe("keo-don");
  });
});

