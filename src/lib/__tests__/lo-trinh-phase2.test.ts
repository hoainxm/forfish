import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setModelParams } from "@/lib/model-params";
import { buildModelParams } from "../../../scripts/build-model-params.mjs";

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

import { deXuatLoTrinh, khungBienCuaNghe, KHUNG_DANH } from "../lo-trinh/plan";
import { baoTuTinBao, dungBienTheoNgay, KM_KHOP_DUONG_BAO } from "../lo-trinh/dau-vao";
import {
  docKg,
  docNhatKy,
  ghiNhatKy,
  ghiSanLuong,
  GOP_PHUT,
  nenHoiSanLuong,
  NHAT_KY_KEY,
  nhatKyReadFailed,
  soBamTuyen,
  themLanSo,
  timChuyen,
  TOI_THIEU_SO,
  type NhatKyChuyen,
} from "../lo-trinh/nhat-ky";
import { TRANSFER_KEYS } from "../offline-backup";
import type { KhungGio, LoTrinhDaLuu, LoTrinhInput, Nghe, OCa } from "../lo-trinh/types";
import type { ForecastGrid } from "../forecast-grid";
import type { StormAlert, StormCheck } from "../storms";
import type { StormTrack } from "../storm-track";

beforeEach(() => localStorage.clear());
afterEach(() => setModelParams(null));

/* lưới cá giả: đốm ngoài khơi Quy Nhơn – Phú Yên, nằm trong vùng biển VN */
function luoi(): OCa[] {
  const dom = [
    { lat: 12.6, lon: 110.6, s: 85, r: 0.6 },
    { lat: 11.2, lon: 109.9, s: 75, r: 0.5 },
    { lat: 14.6, lon: 110.0, s: 70, r: 0.5 },
  ];
  const out: OCa[] = [];
  for (let la = 9; la <= 17 + 1e-9; la += 0.25)
    for (let lo = 107; lo <= 113 + 1e-9; lo += 0.25) {
      let s = 10;
      for (const d of dom) s = Math.max(s, d.s * Math.exp(-(((la - d.lat) ** 2 + (lo - d.lon) ** 2) / (2 * d.r * d.r))));
      out.push({ lat: +la.toFixed(3), lon: +lo.toFixed(3), s: Math.round(s) });
    }
  return out;
}
const LUOI = luoi();
const QUY_NHON = { lat: 13.76, lon: 109.27, ten: "Cảng Quy Nhơn" };
const NOW = new Date("2026-10-29T03:00:00Z");
const input = (p: Partial<LoTrinhInput> = {}): LoTrinhInput => ({
  cang: QUY_NHON,
  ngayDi: "2026-11-01",
  gioDi: 6,
  soNgay: 10,
  nghe: "luoi-re",
  tau: { speedKn: 7, litersPerHour: 20, fuelTankL: 5000 },
  diemQuen: [],
  caTheoNgay: () => LUOI,
  bao: [],
  ...p,
});

describe("Phase 2 — tính lại giữa chuyến từ chỗ tàu đang đứng", () => {
  const DUNG = { lat: 12.2, lon: 110.3, ten: "Chỗ tàu đang đứng" };

  it("điểm đầu = GPS, vẫn về cảng; hạn về = số ngày còn lại", () => {
    const kq = deXuatLoTrinh(input({ diemDau: DUNG, soNgay: 4, ngayDi: "2026-11-05", gioDi: 14 }), NOW);
    expect(kq.chanBao).toBeNull();
    expect(kq.vung.length).toBeGreaterThan(0);
    expect(kq.moc[0]).toMatchObject({ lat: DUNG.lat, lon: DUNG.lon, ten: DUNG.ten });
    expect(kq.moc[kq.moc.length - 1]).toMatchObject({ lat: QUY_NHON.lat, lon: QUY_NHON.lon });
    expect(kq.tuChoDung).toBe(DUNG.ten);
    expect(kq.lich[0].cau).toContain("từ chỗ đang đứng");
    expect(kq.ngayNenVe <= "2026-11-08").toBe(true); // 05 + 4 ngày - 1
    expect(kq.ghiChu.some((g) => g.startsWith("Tính lại từ chỗ tàu đang đứng: còn 4 ngày"))).toBe(true);
  });

  it("chuyến mới (không diemDau) giữ nguyên: mốc đầu là cảng, không cờ tuChoDung", () => {
    const kq = deXuatLoTrinh(input(), NOW);
    expect(kq.moc[0]).toMatchObject({ lat: QUY_NHON.lat, lon: QUY_NHON.lon });
    expect(kq.tuChoDung).toBeUndefined();
  });

  it("toạ độ GPS hỏng ⇒ nói ra, tính như chuyến từ cảng", () => {
    const kq = deXuatLoTrinh(input({ diemDau: { lat: NaN, lon: 110, ten: "x" } }), NOW);
    expect(kq.ghiChu).toContain("Vị trí tàu chưa đúng — tạm tính như chuyến mới từ cảng.");
    expect(kq.moc[0]).toMatchObject({ lat: QUY_NHON.lat });
  });

  it("câu ngừ tính lại KHÔNG áp hạn 7 ngày từ ngày đánh đầu (app không biết đã đánh mấy ngày)", () => {
    const kq = deXuatLoTrinh(input({ nghe: "cau-ngu", diemDau: DUNG, soNgay: 3 }), NOW);
    expect(kq.ghiChu.some((g) => g.startsWith("Câu cá ngừ: nên về cảng"))).toBe(false);
  });
});

describe("Phase 2 — dầu theo pha", () => {
  it("chạy + lúc đánh + đèn cộng lại ≈ tổng lít (trước khi làm tròn tới chục)", () => {
    setModelParams(buildModelParams(process.cwd())); // dầu đèn = số trung bình theo nghề trong model-params (09/11)
    const kq = deXuatLoTrinh(input({ nghe: "luoi-vay", tau: { speedKn: 7, litersPerHour: 20, fuelTankL: 8000 } }), NOW);
    const p = kq.dauTheoPha!;
    expect(p.chay).toBeGreaterThan(0);
    expect(p.den).toBeGreaterThan(0);
    expect(Math.abs(p.chay + p.danh + p.den - kq.litDau)).toBeLessThanOrEqual(10);
  });
  it("chưa nạp tham số ⇒ pha đèn = 0", () => {
    setModelParams(null);
    const kq = deXuatLoTrinh(input({ nghe: "luoi-vay" }), NOW);
    expect(kq.dauTheoPha!.den).toBe(0);
  });
});

describe("Phase 2 — ô nửa ngày: sóng gió trong khung đánh của nghề", () => {
  it("khung theo KHUNG_DANH, điểm giữa khung rơi vào ngày đó", () => {
    expect(khungBienCuaNghe("luoi-keo")).toBeUndefined(); // kéo cả ngày đêm
    expect(khungBienCuaNghe("keo-doi")).toEqual({ tuGio: 6, soGio: 11 });
    for (const n of ["cau-ngu", "luoi-vay", "luoi-re", "chup-muc"] as Nghe[]) {
      const k = khungBienCuaNghe(n)!;
      expect(k.soGio).toBe(KHUNG_DANH[n].dai);
      const giua = k.tuGio + k.soGio / 2;
      expect(giua >= 0 && giua < 24).toBe(true);
    }
  });

  it("thuật toán đưa khung vào bienTheoNgay", () => {
    const thay: (KhungGio | undefined)[] = [];
    deXuatLoTrinh(
      input({
        nghe: "luoi-vay",
        bienTheoNgay: (_la, _lo, _d, k) => {
          thay.push(k);
          return { songM: 0.5, gioKmh: 10 };
        },
      }),
      NOW,
    );
    expect(thay.length).toBeGreaterThan(0);
    expect(thay.every((k) => k?.tuGio === 18 && k.soGio === 11)).toBe(true);
  });

  // lưới 1 ô, mỗi giờ một mốc, 2 ngày: sóng 3 m lúc 10–15 giờ, 0,5 m còn lại
  const ngay = "2026-11-01";
  const times: string[] = [];
  const hours: { waveM: number; windKmh: number }[] = [];
  for (let d = 0; d < 3; d++)
    for (let h = 0; h < 24; h++) {
      const iso = new Date(Date.parse(`${ngay}T00:00:00+07:00`) + (d * 24 + h) * 3_600_000 + 7 * 3_600_000).toISOString().slice(0, 13);
      times.push(`${iso}:00`);
      const trua = h >= 10 && h <= 15;
      hours.push({ waveM: trua ? 3 : 0.5, windKmh: trua ? 50 : 15 });
    }
  const grid: ForecastGrid = { cells: [{ lat: 12, lon: 110, hours }], times };

  it("cả ngày ⇒ lấy sóng trưa; khung đêm ⇒ chỉ sóng đêm", () => {
    const f = dungBienTheoNgay(grid, ngay)!;
    expect(f(12, 110, 0)?.songM).toBe(3);
    const dem = f(12, 110, 0, { tuGio: 18, soGio: 11 });
    expect(dem).toEqual({ songM: 0.5, gioKmh: 15 });
    const ngayKeo = f(12, 110, 1, { tuGio: 6, soGio: 11 });
    expect(ngayKeo?.songM).toBe(3);
  });

  it("khung chỉ phủ một phần ⇒ lấy phần có; khung không có mốc nào ⇒ lùi về số cả ngày; ngày ngoài lưới ⇒ null", () => {
    const f = dungBienTheoNgay(grid, ngay)!;
    expect(f(12, 110, 2, { tuGio: 18, soGio: 11 })).toEqual({ songM: 0.5, gioKmh: 15 }); // ngày 3 chỉ có 18–23 giờ
    expect(f(12, 110, 9, { tuGio: 18, soGio: 11 })).toBeNull();
    // đuôi lưới thưa: chỉ mốc 12 giờ trưa ⇒ khung đêm không có mốc nào ⇒ số cả ngày
    const thua: ForecastGrid = {
      cells: [{ lat: 12, lon: 110, hours: [{ waveM: 2, windKmh: 40 }] }],
      times: [`${ngay}T12:00`],
    };
    expect(dungBienTheoNgay(thua, ngay)!(12, 110, 0, { tuGio: 18, soGio: 11 })).toEqual({ songM: 2, gioKmh: 40 });
  });
});

describe("Phase 2 — mốc giờ bão từ đường dự báo NCHMF có sẵn trong /api/storms", () => {
  const now = Date.parse("2026-10-29T08:00:00Z");
  const storm: StormAlert = {
    id: "s1", name: "KAJIKI", kindLabel: "Bão", windKmh: 100, lat: 15, lon: 115,
    alert: "danger", updated: "2026-10-29T06:00:00Z", track: [[115, 15], [113, 16]], areas: [], key: "k-kajiki",
  };
  const t1 = now + 24 * 3_600_000, t2 = now + 48 * 3_600_000;
  const track = (key: string, lat: number, lon: number): StormTrack => ({
    key, radiusKm: 200, name: "Bão số 9", laBao: true, issuedAt: now, buTuTinLuc: null,
    past: [{ at: now, lat, lon, cap: 11, giat: 13 }],
    forecast: [
      { at: t1, lat: lat + 0.5, lon: lon - 1, cap: 11, giat: 13, danger: null },
      { at: null, lat: lat + 1, lon: lon - 2, cap: 10, giat: 12, danger: null },
      { at: t2, lat: lat + 1.5, lon: lon - 3, cap: 9, giat: 11, danger: null },
    ],
  });

  it("khớp theo key ⇒ thêm mốc có `at` (mốc không giờ vẫn giữ, không at)", () => {
    const c: StormCheck = { ok: true, storms: [storm], checkedAt: "2026-10-29T07:00:00Z", tracks: [track("k-kajiki", 30, 130)] };
    const d = baoTuTinBao(c, now)![0].diem;
    expect(d[0]).toEqual({ lat: 15, lon: 115 }); // tâm hiện tại vẫn không giờ (coi như có mặt suốt cửa sổ)
    expect(d.filter((x) => x.at != null).map((x) => x.at)).toEqual([t1, t2]);
    expect(d.some((x) => x.at == null && x.lat === 31)).toBe(true);
  });

  it("không trùng key thì khớp theo khoảng cách tâm ≤ 300 km; xa hơn ⇒ không thêm", () => {
    const gan: StormCheck = { ok: true, storms: [{ ...storm, key: undefined }], checkedAt: "2026-10-29T07:00:00Z", tracks: [track("x", 15.5, 115)] };
    expect(baoTuTinBao(gan, now)![0].diem.some((x) => x.at === t1)).toBe(true);
    const xa: StormCheck = { ok: true, storms: [{ ...storm, key: undefined }], checkedAt: "2026-10-29T07:00:00Z", tracks: [track("x", 25, 125)] };
    expect(KM_KHOP_DUONG_BAO).toBe(300);
    expect(baoTuTinBao(xa, now)![0].diem.some((x) => x.at != null)).toBe(false);
  });

  it("bản tin cũ không có `tracks` ⇒ như trước (không ném)", () => {
    const c: StormCheck = { ok: true, storms: [storm], checkedAt: "2026-10-29T07:00:00Z" };
    expect(baoTuTinBao(c, now)![0].diem.every((x) => x.at == null)).toBe(true);
  });

  it("chặn bão nói giờ dự báo khi điểm gần nhất có giờ", () => {
    const at = Date.parse("2026-11-02T07:00:00+07:00");
    const kq = deXuatLoTrinh(input({ bao: [{ ten: "KAJIKI", diem: [{ lat: 12.6, lon: 110.6, at }] }] }), NOW);
    expect(kq.chanBao).not.toBeNull();
    expect(kq.ghiChu.some((g) => g.includes("Bão KAJIKI") && g.includes("dự báo tới gần tuyến khoảng 7 giờ 02/11"))).toBe(true);
  });
});

describe("Phase 3 — nhật ký đo hiệu quả (chỉ trong máy)", () => {
  const rec = (id: string, nghe: Nghe = "luoi-re", ngayDi = "2026-11-01", ve = "2026-11-10"): LoTrinhDaLuu => ({
    id,
    ten: `Quy Nhơn · ${id}`,
    boatId: null,
    taoLuc: "2026-10-30T00:00:00Z",
    tuoiDuLieu: { ca: null, bao: null },
    input: { cang: QUY_NHON, ngayDi, soNgay: 10, nghe, tau: { speedKn: 7, litersPerHour: 20, fuelTankL: null }, diemQuen: [] },
    ketQua: { vung: [], lich: [], moc: [], haiLy: 0, litDau: 0, thieuDau: false, ngayNenVe: ve, soNgayTinh: 10, chanBao: null, ghiChu: [] },
  });
  const P = { lat: 12, lon: 110 };
  const t0 = Date.parse("2026-11-03T02:00:00Z");

  it("khoá mới nằm trong nhóm sao lưu `transfer`", () => {
    expect(TRANSFER_KEYS).toContain(NHAT_KY_KEY);
  });

  it("chỉ ghi trong khoảng chuyến; gộp hai lần bấm sát nhau", () => {
    const r = rec("a");
    expect(themLanSo([], r, P, 5, t0, "2026-10-31")).toBeNull(); // trước ngày đi
    expect(themLanSo([], r, P, 5, t0, "2026-11-13")).toBeNull(); // quá ngày về + 2
    let l = themLanSo([], r, P, 5, t0, "2026-11-03")!;
    l = themLanSo(l, r, P, 7, t0 + (GOP_PHUT - 1) * 60_000, "2026-11-03")!;
    expect(timChuyen(l, "a")!.viTri).toHaveLength(1);
    expect(timChuyen(l, "a")!.viTri[0]).toMatchObject({ cachHaiLy: 7, ngayThu: 3 });
    l = themLanSo(l, r, P, 30, t0 + 3_600_000, "2026-11-03")!;
    expect(timChuyen(l, "a")!.viTri).toHaveLength(2);
  });

  it("sản lượng: hỏi khi tới ngày về, thôi hỏi khi đã khai; kg gõ nhầm bị chặn", () => {
    const r = rec("b");
    expect(nenHoiSanLuong(null, r, "2026-11-09")).toBe(false);
    expect(nenHoiSanLuong(null, r, "2026-11-10")).toBe(true);
    expect(nenHoiSanLuong(null, r, "2026-12-20")).toBe(false); // quá 30 ngày
    expect(ghiSanLuong([], r, 0, t0)).toBeNull();
    const l = ghiSanLuong([], r, 1500, t0)!;
    expect(nenHoiSanLuong(timChuyen(l, "b"), r, "2026-11-11")).toBe(false);
    expect(docKg("1.500")).toBe(1500);
    expect(docKg("abc")).toBeNull();
    expect(docKg("")).toBeNull();
  });

  it("tự so sát tuyến / khác tuyến: dưới 3 chuyến mỗi nhóm thì chưa kết luận", () => {
    let l: NhatKyChuyen[] = [];
    for (let i = 0; i < TOI_THIEU_SO; i++) {
      const sat = rec(`s${i}`), lech = rec(`l${i}`);
      l = themLanSo(l, sat, P, 5, t0, "2026-11-03")!;
      l = ghiSanLuong(l, sat, 2000, t0)!;
      l = themLanSo(l, lech, P, 60, t0, "2026-11-03")!;
      if (i < TOI_THIEU_SO - 1) l = ghiSanLuong(l, lech, 1000, t0)!;
    }
    let so = soBamTuyen(l, "luoi-re");
    expect(so.duSo).toBe(false);
    l = ghiSanLuong(l, rec(`l${TOI_THIEU_SO - 1}`), 1000, t0)!;
    so = soBamTuyen(l, "luoi-re");
    expect(so).toEqual({ bam: { n: 3, kgTB: 2000 }, lech: { n: 3, kgTB: 1000 }, duSo: true });
    expect(soBamTuyen(l, "cau-ngu").bam.n).toBe(0); // chỉ so cùng nghề
  });

  it("ghi/đọc qua localStorage; đọc hỏng ⇒ khoá ghi (K4)", () => {
    const l = ghiSanLuong([], rec("c"), 800, t0)!;
    expect(docNhatKy()).toEqual([]);
    expect(ghiNhatKy(l)).toBe(true);
    expect(docNhatKy()[0].sanLuong?.kg).toBe(800);
    localStorage.setItem(NHAT_KY_KEY, "{hỏng");
    expect(docNhatKy()).toEqual([]);
    expect(nhatKyReadFailed()).toBe(true);
    expect(ghiNhatKy(l)).toBe(false);
    expect(localStorage.getItem(NHAT_KY_KEY)).toBe("{hỏng");
  });
});
