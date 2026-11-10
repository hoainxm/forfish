import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vmsZones from "@/data/vms-zones.json";
import { insideAllowed } from "@/lib/geofence";
import { haversineKm } from "@/lib/geo";
import { trongVungBienVN } from "@/lib/vung-bien-vn";
import { trongVungNhanh } from "@/lib/lo-trinh/vung-nhanh";
import { decodeClimatology, climScoreAt, type ClimatologyFile } from "@/lib/fish-blend";
import {
  deXuatLoTrinh,
  doanTrongVung,
  CAU_CHAN_BAO,
  CAU_CHUA_KIEM_BAO,
  TRAN_SO_NGAY,
  SAT_DAU_KM,
} from "@/lib/lo-trinh/plan";
import type { LoTrinhInput, LoTrinhKetQua, OCa, Nghe } from "@/lib/lo-trinh/types";
import type { LngLat } from "@/data/vn-maritime-border";

/* Lưới cá giả 0,25° phủ cả trong lẫn NGOÀI vùng biển VN (để thuật toán tự lọc), điểm = các
   "đốm" Gauss. Đốm mạnh nhất cố ý đặt ở vùng cần chú ý quanh Hoàng Sa. */
type Dom = { lat: number; lon: number; s: number; r: number };
const DOM: Dom[] = [
  { lat: 16.5, lon: 112.0, s: 100, r: 0.8 }, // Hoàng Sa — vùng cần chú ý, KHÔNG được đề xuất
  { lat: 12.6, lon: 110.6, s: 85, r: 0.6 },
  { lat: 11.2, lon: 109.9, s: 75, r: 0.5 },
  { lat: 14.6, lon: 110.0, s: 70, r: 0.5 },
];
function luoi(dom: Dom[] = DOM, lat0 = 7, lat1 = 19.5, lon0 = 104, lon1 = 116, step = 0.25): OCa[] {
  const out: OCa[] = [];
  for (let la = lat0; la <= lat1 + 1e-9; la += step)
    for (let lo = lon0; lo <= lon1 + 1e-9; lo += step) {
      let s = 10;
      for (const d of dom) s = Math.max(s, d.s * Math.exp(-(((la - d.lat) ** 2 + (lo - d.lon) ** 2) / (2 * d.r * d.r))));
      out.push({ lat: +la.toFixed(3), lon: +lo.toFixed(3), s: Math.round(s) });
    }
  return out;
}
const LUOI = luoi();

const QUY_NHON = { lat: 13.76, lon: 109.27, ten: "Cảng Quy Nhơn" };
const NOW = new Date("2026-10-29T03:00:00Z");

function input(p: Partial<LoTrinhInput> = {}): LoTrinhInput {
  return {
    cang: QUY_NHON,
    ngayDi: "2026-11-01",
    soNgay: 10,
    nghe: "luoi-re",
    tau: { speedKn: 7, litersPerHour: 20, fuelTankL: 5000 },
    diemQuen: [],
    caTheoNgay: () => LUOI,
    bao: [],
    ...p,
  };
}

const MOC_KHONG_RA_NGOAI = (kq: LoTrinhKetQua) => {
  for (let i = 0; i + 1 < kq.moc.length; i++) {
    const a = kq.moc[i], b = kq.moc[i + 1];
    const km = haversineKm(a, b);
    const n = Math.max(1, Math.ceil(km / 1)); // mẫu 1 km — dày hơn thuật toán (2 km) để bắt lọt khe
    for (let k = 0; k <= n; k++) {
      const p = { lat: a.lat + ((b.lat - a.lat) * k) / n, lon: a.lon + ((b.lon - a.lon) * k) / n };
      if (haversineKm(p, a) <= SAT_DAU_KM || haversineKm(p, b) <= SAT_DAU_KM) continue;
      expect(trongVungBienVN(p.lat, p.lon), `mẫu ${p.lat},${p.lon} ngoài vùng (đoạn ${i})`).toBe(true);
    }
  }
};

const CAUTION_POLYS = vmsZones.caution.features.flatMap(
  (f) => f.geometry.coordinates as unknown as LngLat[][][],
);
const NGAY_MS = 86_400_000;
const dauNgayVN = (iso: string) => Date.parse(`${iso}T00:00:00+07:00`);
const ngayCach = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / NGAY_MS);

describe("trongVungNhanh — cùng kết quả với trongVungBienVN", () => {
  it("khớp trên 20.000 điểm giả ngẫu nhiên (hạt cố định) + sát biên + cảng", () => {
    let x = 12345;
    const rnd = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
    const diem: [number, number][] = [];
    for (let i = 0; i < 20000; i++) diem.push([4 + rnd() * 19, 101 + rnd() * 18]);
    for (const [lo, la] of (vmsZones.allowed.features[0].geometry.coordinates as number[][][][])[2][0].slice(0, 300))
      diem.push([la + 1e-4, lo - 1e-4], [la - 1e-4, lo + 1e-4], [la, lo]);
    diem.push([13.76, 109.27], [10.34, 107.09], [16.5, 112], [NaN, 109]);
    let sai = 0;
    for (const [la, lo] of diem) if (trongVungNhanh(la, lo) !== trongVungBienVN(la, lo)) sai++;
    expect(sai).toBe(0);
  });
});

describe("deXuatLoTrinh — tuyến cơ bản", () => {
  const kq = deXuatLoTrinh(input(), NOW);

  it("có 1–4 vùng, lịch, mốc cảng ở hai đầu, số liệu dương", () => {
    expect(kq.chanBao).toBeNull();
    expect(kq.vung.length).toBeGreaterThanOrEqual(1);
    expect(kq.vung.length).toBeLessThanOrEqual(4);
    expect(kq.moc[0].loai).toBe("cang");
    expect(kq.moc.at(-1)!.loai).toBe("cang");
    expect(kq.moc.length).toBe(kq.vung.length + 2);
    expect(kq.lich[0].loai).toBe("chay");
    expect(kq.lich.at(-1)!.loai).toBe("ve");
    expect(kq.haiLy).toBeGreaterThan(0);
    expect(kq.litDau).toBeGreaterThan(0);
    expect(kq.vung.map((v) => v.ten)).toEqual(kq.vung.map((_, i) => `Vùng ${i + 1}`));
    expect(kq.ghiChu.join(" ")).toMatch(/Lít dầu tính theo giờ chạy máy \(20 lít mỗi giờ máy\)/);
  });

  it("không có mẫu nào của tuyến nằm ngoài vùng biển VN (trừ sát cảng/điểm)", () => {
    MOC_KHONG_RA_NGOAI(kq);
  });

  it("không vùng nào nằm trong vùng cần chú ý quanh Hoàng Sa dù đốm cá mạnh nhất ở đó", () => {
    for (const v of kq.vung) {
      expect(insideAllowed(v.lat, v.lon, CAUTION_POLYS)).toBe(false);
      expect(haversineKm(v, { lat: 16.5, lon: 112 })).toBeGreaterThan(150);
    }
  });

  it("câu lịch đời thường: có 'Ngày', không phần trăm, không hứa cá", () => {
    for (const d of kq.lich) {
      expect(d.cau).toMatch(/^Ngày \d+(–\d+)?: /);
      expect(d.cau).not.toMatch(/%|có cá|chắc chắn/);
      expect(d.tuNgay).toBeLessThanOrEqual(d.denNgay);
    }
    expect(kq.lich[0].cau).toMatch(/chạy ra vùng 1, khoảng \d+(–\d+)? giờ/); // P50–P80 (§3 B5)
    // ngày không lùi
    for (let i = 1; i < kq.lich.length; i++) expect(kq.lich[i].tuNgay).toBeGreaterThanOrEqual(kq.lich[i - 1].tuNgay);
  });

  it("tất định: cùng input ⇒ cùng output", () => {
    expect(deXuatLoTrinh(input(), NOW)).toEqual(kq);
  });

  it("đoạn cắt ngang đất liền / ra Hoàng Sa bị coi là không hợp lệ", () => {
    // Quy Nhơn → Đà Nẵng qua đất liền? đi thẳng phía trong bờ: lấy hai điểm hai bên mũi Sơn Trà–Hải Vân
    expect(doanTrongVung({ lat: 13.5, lon: 109.6 }, { lat: 16.6, lon: 112.2 })).toBe(false);
    expect(doanTrongVung({ lat: 12.6, lon: 110.6 }, { lat: 11.2, lon: 109.9 })).toBe(true);
    expect(doanTrongVung({ lat: 11.5, lon: 107.0 }, { lat: 14.0, lon: 108.0 })).toBe(false); // trên đất liền
  });
});

describe("deXuatLoTrinh — điểm quen", () => {
  it("điểm quen ngoài vùng (Hoàng Sa, trên đất) bị loại + ghi chú; điểm trong vùng được ghé", () => {
    const kq = deXuatLoTrinh(
      input({
        diemQuen: [
          { lat: 16.5, lon: 112.0, ten: "Chà Hoàng Sa" },
          { lat: 14.0, lon: 108.5, ten: "Trên núi" },
          { lat: 13.2, lon: 110.2, ten: "Chà ông Tư" },
        ],
      }),
      NOW,
    );
    const ten = kq.moc.map((m) => m.ten);
    expect(ten).not.toContain("Chà Hoàng Sa");
    expect(ten).not.toContain("Trên núi");
    expect(ten).toContain("Chà ông Tư");
    const ghi = kq.ghiChu.join("\n");
    expect(ghi).toMatch(/Chà Hoàng Sa.*ngoài vùng biển Việt Nam/);
    expect(ghi).toMatch(/Trên núi.*ngoài vùng biển Việt Nam/);
    const q = kq.vung.find((v) => v.ten === "Chà ông Tư")!;
    expect(q.laDiemQuen).toBe(true);
    expect(q.soNgayDanh).toBeGreaterThanOrEqual(1);
    expect(kq.moc.find((m) => m.ten === "Chà ông Tư")!.loai).toBe("diem-quen");
    MOC_KHONG_RA_NGOAI(kq);
  });
});

describe("deXuatLoTrinh — cổng bão (cửa sổ tới lúc về)", () => {
  const goc = deXuatLoTrinh(input(), NOW);
  const v1 = goc.vung[0];

  it("bão (không mốc giờ) gần tuyến ⇒ chanBao, không trả vùng/lịch", () => {
    const kq = deXuatLoTrinh(input({ bao: [{ ten: "WUTIP", diem: [{ lat: v1.lat + 0.5, lon: v1.lon + 0.5 }] }] }), NOW);
    expect(kq.chanBao).toBe(CAU_CHAN_BAO);
    expect(kq.vung).toEqual([]);
    expect(kq.lich).toEqual([]);
    expect(kq.moc).toEqual([]);
    expect(kq.ghiChu.join(" ")).toMatch(/WUTIP/);
  });

  it("cửa sổ = max(5 ngày, tới lúc về P80): chuyến 10 ngày ⇒ bão ngày 8 vẫn chặn, sau ngày về thì không", () => {
    const start = dauNgayVN("2026-11-01");
    const bao = (ngay: number) => [
      { ten: "B", diem: [{ lat: v1.lat, lon: v1.lon + 0.3, at: start + ngay * NGAY_MS }] },
    ];
    expect(deXuatLoTrinh(input({ bao: bao(2) }), NOW).chanBao).toBe(CAU_CHAN_BAO);
    // trước 2026-11-08 cửa sổ chỉ 5 ngày ⇒ bão ngày 8 lọt; giờ chuyến còn ở biển ngày 8 ⇒ phải chặn
    const kq8 = deXuatLoTrinh(input({ bao: bao(8) }), NOW);
    expect(kq8.chanBao).toBe(CAU_CHAN_BAO);
    expect(kq8.ghiChu.join(" ")).toMatch(/trong (9|10|11) ngày tới/);
    // chuyến ngắn 3 ngày: cửa sổ vẫn tối thiểu 5 ngày ⇒ bão ngày 4 chặn, ngày 8 không
    expect(deXuatLoTrinh(input({ soNgay: 3, bao: bao(4) }), NOW).chanBao).toBe(CAU_CHAN_BAO);
    const ngan8 = deXuatLoTrinh(input({ soNgay: 3, bao: bao(8) }), NOW);
    expect(ngan8.chanBao).toBeNull();
    expect(ngan8.vung.length).toBeGreaterThan(0);
  });

  it("bão xa tuyến (>200 km) ⇒ không chặn", () => {
    const kq = deXuatLoTrinh(input({ bao: [{ ten: "XA", diem: [{ lat: 20.5, lon: 118 }] }] }), NOW);
    expect(kq.chanBao).toBeNull();
  });

  it("bao null ⇒ vẫn tính nhưng ghi chú chưa kiểm được tin bão", () => {
    const kq = deXuatLoTrinh(input({ bao: null }), NOW);
    expect(kq.vung.length).toBeGreaterThan(0);
    expect(kq.ghiChu).toContain(CAU_CHUA_KIEM_BAO);
    expect(deXuatLoTrinh(input(), NOW).ghiChu).not.toContain(CAU_CHUA_KIEM_BAO);
  });
});

describe("deXuatLoTrinh — ngân sách ngày + ngày nên về", () => {
  const ve = (kq: LoTrinhKetQua) => kq.lich.at(-1)!;

  it.each([
    ["luoi-re", 3], ["luoi-re", 10], ["luoi-re", 16],
    ["luoi-vay", 12], ["chup-muc", 14], ["cau-ngu", 5], ["cau-ngu", 16],
    ["luoi-keo", 16], ["keo-doi", 16], ["keo-doi", 10],
  ] as [Nghe, number][])("%s %i ngày: về cảng không quá hạn", (nghe, soNgay) => {
    const kq = deXuatLoTrinh(input({ nghe, soNgay }), NOW);
    expect(kq.vung.length).toBeGreaterThan(0);
    const han = { "luoi-vay": 7, "luoi-re": 15, "chup-muc": 10, "cau-ngu": 99, "luoi-keo": 16, "keo-doi": 20 }[nghe];
    expect(ve(kq).denNgay).toBeLessThanOrEqual(Math.min(soNgay, han));
    expect(ngayCach("2026-11-01", kq.ngayNenVe)).toBe(ve(kq).denNgay - 1);
    // tổng ngày đánh ≤ số ngày tính
    expect(kq.vung.reduce((a, v) => a + v.soNgayDanh, 0)).toBeLessThanOrEqual(kq.soNgayTinh);
  });

  it("câu cá ngừ: ngày về ≤ ngày đánh đầu + 7", () => {
    const kq = deXuatLoTrinh(input({ nghe: "cau-ngu", soNgay: 16 }), NOW);
    const danhDau = kq.lich.find((d) => d.loai === "danh")!.tuNgay;
    expect(ve(kq).denNgay).toBeLessThanOrEqual(danhDau + 7);
    expect(ngayCach("2026-11-01", kq.ngayNenVe)).toBeLessThanOrEqual(danhDau - 1 + 7);
    expect(kq.ghiChu.join(" ")).toMatch(/Câu cá ngừ/);
  });

  it("soNgay 20 ⇒ tính 16 ngày + ghi chú", () => {
    const kq = deXuatLoTrinh(input({ soNgay: 20 }), NOW);
    expect(kq.soNgayTinh).toBe(TRAN_SO_NGAY);
    expect(kq.ghiChu.join(" ")).toMatch(/20 ngày.*16 ngày đầu/);
    expect(ve(kq).denNgay).toBeLessThanOrEqual(16);
  });
});

describe("deXuatLoTrinh — dầu", () => {
  it("két nhỏ ⇒ thiếu dầu; két lớn hoặc chưa khai ⇒ không", () => {
    const nho = deXuatLoTrinh(input({ tau: { speedKn: 7, litersPerHour: 20, fuelTankL: 50 } }), NOW);
    expect(nho.thieuDau).toBe(true);
    expect(deXuatLoTrinh(input({ tau: { speedKn: 7, litersPerHour: 20, fuelTankL: 1e6 } }), NOW).thieuDau).toBe(false);
    expect(deXuatLoTrinh(input({ tau: { speedKn: 7, litersPerHour: 20, fuelTankL: null } }), NOW).thieuDau).toBe(false);
  });

  it("lít dầu = giờ chạy × lít/giờ TRUNG BÌNH (09/11: số lít/giờ bà con khai không dùng nữa)", () => {
    const a = deXuatLoTrinh(input(), NOW);
    const b = deXuatLoTrinh(input({ tau: { speedKn: 7, litersPerHour: 40, fuelTankL: 5000 } }), NOW);
    expect(b.moc).toEqual(a.moc);
    expect(b.litDau).toBe(a.litDau);
    // giờ chạy P50 = Σ (a + hải lý/v) × lít/giờ — test không nạp model-params ⇒ mặc định dè dặt 5 kn + 1,5 giờ/chặng
    const soChang = a.moc.length - 1;
    expect(Math.abs(a.litDau - (a.haiLy / 5 + 1.5 * soChang) * 20)).toBeLessThanOrEqual(20);
  });

  it("tốc độ hỏng ⇒ dùng mặc định + ghi chú", () => {
    const kq = deXuatLoTrinh(input({ tau: { speedKn: 0, litersPerHour: NaN, fuelTankL: null } }), NOW);
    expect(kq.vung.length).toBeGreaterThan(0);
    expect(kq.ghiChu.join(" ")).toMatch(/tạm tính dè dặt 5 hải lý\/giờ/); // KHÔNG quay về 7 kn (vet-tau §7 B0)
    expect(kq.ghiChu.join(" ")).not.toMatch(/tạm tính 20 lít/);
  });
});

describe("deXuatLoTrinh — đầu vào rỗng/hỏng không ném", () => {
  it("dữ liệu cá rỗng ⇒ kết quả rỗng + ghi chú", () => {
    const kq = deXuatLoTrinh(input({ caTheoNgay: () => [] }), NOW);
    expect(kq.vung).toEqual([]);
    expect(kq.lich).toEqual([]);
    expect(kq.ghiChu.join(" ")).toMatch(/Bản đồ cá chưa thấy vùng nào có cá của nghề/);
  });

  it("chỉ có ô ngoài vùng biển VN ⇒ rỗng", () => {
    const kq = deXuatLoTrinh(input({ caTheoNgay: () => luoi(DOM, 16, 17, 111.5, 112.5) }), NOW);
    expect(kq.vung).toEqual([]);
  });

  it("caTheoNgay ném lỗi ⇒ không ném, kết quả rỗng", () => {
    const kq = deXuatLoTrinh(input({ caTheoNgay: () => { throw new Error("hỏng"); } }), NOW);
    expect(kq.vung).toEqual([]);
  });

  it("soNgay < 1 ⇒ rỗng + ghi chú", () => {
    for (const soNgay of [0, -3, NaN]) {
      const kq = deXuatLoTrinh(input({ soNgay }), NOW);
      expect(kq.vung).toEqual([]);
      expect(kq.soNgayTinh).toBe(0);
      expect(kq.ghiChu.join(" ")).toMatch(/Số ngày đi/);
    }
  });

  it("ngày đi hỏng ⇒ tính từ hôm nay (giờ VN) + ghi chú", () => {
    const kq = deXuatLoTrinh(input({ ngayDi: "2026-13-40" }), NOW);
    expect(kq.ghiChu.join(" ")).toMatch(/tạm tính từ hôm nay/);
    expect(kq.ngayNenVe >= "2026-10-29").toBe(true);
  });

  it("1 ngày — quá ngắn để đi đánh xa ⇒ không ném", () => {
    const kq = deXuatLoTrinh(input({ soNgay: 1 }), NOW);
    expect(Array.isArray(kq.vung)).toBe(true);
  });
});

describe("deXuatLoTrinh — tốc độ + dữ liệu thật", () => {
  it("~2.400 ô × 16 ngày chạy < 300 ms", () => {
    const days = Array.from({ length: 16 }, (_, d) =>
      luoi(DOM.map((x) => ({ ...x, lat: x.lat + d * 0.05 })), 7.125, 18.875, 104.125, 116.875).slice(0, 2400),
    );
    expect(days[0].length).toBe(2400);
    const t0 = performance.now();
    const kq = deXuatLoTrinh(input({ soNgay: 16, caTheoNgay: (d) => days[d], diemQuen: [{ lat: 11.8, lon: 109.6, ten: "Chà" }] }), NOW);
    const ms = performance.now() - t0;
    expect(kq.vung.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(300);
  });

  it("bản đồ mùa vụ thật (fish-climatology tháng 4): tuyến hợp lệ trong vùng", () => {
    const file = JSON.parse(
      readFileSync(join(process.cwd(), "public", "data", "fish-climatology.v1.json"), "utf8"),
    ) as ClimatologyFile;
    const clim = decodeClimatology(file);
    const cells: OCa[] = [];
    for (let i = 0; i < file.nLat; i++)
      for (let j = 0; j < file.nLon; j++) {
        const lat = file.lat0 + i * file.dLat, lon = file.lon0 + j * file.dLon;
        const s = climScoreAt(clim, lat, lon, 4);
        if (s > 0) cells.push({ lat, lon, s });
      }
    expect(cells.length).toBeGreaterThan(100);
    for (const cang of [QUY_NHON, { lat: 10.34, lon: 107.09, ten: "Vũng Tàu" }, { lat: 20.72, lon: 107.06, ten: "Cát Bà" }]) {
      const kq = deXuatLoTrinh(input({ cang, soNgay: 12, nghe: "cau-ngu", caTheoNgay: () => cells }), NOW);
      expect(kq.vung.length, cang.ten).toBeGreaterThan(0);
      MOC_KHONG_RA_NGOAI(kq);
      for (const v of kq.vung) expect(trongVungBienVN(v.lat, v.lon)).toBe(true);
    }
  });
});

describe("deXuatLoTrinh — giờ đi, dầu đèn, vừa két, GRASP (2026-11-08)", () => {
  const ketLon = { speedKn: 7, litersPerHour: 20, fuelTankL: 1e6 };

  it("giờ đi: vắng = 6 giờ; giờ khác dời lịch; giờ sai ⇒ tạm 6 giờ + ghi chú", () => {
    const vang = deXuatLoTrinh(input({ nghe: "luoi-vay" }), NOW);
    expect(deXuatLoTrinh(input({ nghe: "luoi-vay", gioDi: 6 }), NOW)).toEqual(vang);
    const toi = deXuatLoTrinh(input({ nghe: "luoi-vay", gioDi: 20 }), NOW);
    expect(toi.lich.map((l) => l.cau)).not.toEqual(vang.lich.map((l) => l.cau));
    const sai = deXuatLoTrinh(input({ nghe: "luoi-vay", gioDi: 25 }), NOW);
    expect(sai.ghiChu.join(" ")).toMatch(/Giờ đi chưa đúng/);
    expect(sai.moc).toEqual(vang.moc);
  });

  it("dầu chong đèn: chưa nạp tham số ⇒ không cộng, KHÔNG đòi khai; lít đèn khai tay không dùng (09/11)", () => {
    const khong = deXuatLoTrinh(input({ nghe: "chup-muc", tau: ketLon }), NOW);
    expect(khong.ghiChu.join(" ")).not.toMatch(/chong đèn|khai số lít/);
    const co = deXuatLoTrinh(input({ nghe: "chup-muc", tau: { ...ketLon, litDem: 30 } }), NOW);
    expect(co.litDau).toBe(khong.litDau);
  });

  it("két vừa: tuyến tự gọn cho lít chạy chậm P80 × 1,3 ≤ két, không báo thiếu", () => {
    const rong = deXuatLoTrinh(input({ tau: ketLon }), NOW);
    const ket = Math.round(rong.litDau * 0.6);
    const gon = deXuatLoTrinh(input({ tau: { ...ketLon, fuelTankL: ket } }), NOW);
    expect(gon.vung.length).toBeGreaterThan(0);
    expect(gon.thieuDau).toBe(false);
    // test không nạp model-params ⇒ p80HeSo dè dặt 1,15; litDau đã làm tròn chục
    expect(gon.litDau * 1.15 * 1.3).toBeLessThanOrEqual(ket + 30);
    expect(gon.ghiChu.join(" ")).toMatch(new RegExp(`vừa két ${ket} lít`));
  });

  it("GRASP: tất định, tuyến hợp lệ, chạy dưới 300 ms", () => {
    const t0 = performance.now();
    const a = deXuatLoTrinh(input({ soNgay: 16, nghe: "luoi-keo" }), NOW);
    const ms = performance.now() - t0;
    expect(deXuatLoTrinh(input({ soNgay: 16, nghe: "luoi-keo" }), NOW)).toEqual(a);
    expect(a.vung.length).toBeGreaterThan(0);
    MOC_KHONG_RA_NGOAI(a);
    expect(ms).toBeLessThan(300);
  });
});

describe("deXuatLoTrinh — ngưỡng vùng tốt tính trên ô tới được (2026-11-10)", () => {
  /* Ca thật 10/11: lưới vây Quy Nhơn ra 0 vùng — top 20% ô CẢ NƯỚC nằm ở chỗ đường thẳng từ cảng cắt đất liền, ngưỡng gom
     vùng tính trước khi lọc tầm tới ⇒ ô quanh cảng không bao giờ thành vùng. Dựng lại: một khối ô điểm cao trong vịnh Thái
     Lan (từ Quy Nhơn đi thẳng phải cắt qua đất liền) + vài ô điểm vừa ngoài khơi Quy Nhơn. */
  const xa: OCa[] = [];
  for (let la = 9.0; la <= 10.75 + 1e-9; la += 0.25) for (let lo = 103.25; lo <= 104.0 + 1e-9; lo += 0.25) xa.push({ lat: +la.toFixed(2), lon: +lo.toFixed(2), s: 95 });
  const gan: OCa[] = [
    { lat: 13.75, lon: 109.75, s: 45 },
    { lat: 13.75, lon: 110.0, s: 50 },
    { lat: 14.0, lon: 109.75, s: 40 },
    { lat: 13.5, lon: 109.75, s: 40 },
  ];
  it("ô ngoài tầm chiếm hết top 20% cả nước ⇒ vẫn đề xuất vùng trong tầm quanh cảng", () => {
    expect(doanTrongVung(QUY_NHON, { lat: 10, lon: 103.5 })).toBe(false); // tiền đề: không đi thẳng tới khối xa được
    for (const nghe of ["luoi-vay", "cau-ngu"] as Nghe[]) {
      const kq = deXuatLoTrinh(input({ nghe, soNgay: 15, caTheoNgay: () => [...xa, ...gan] }), NOW);
      expect(kq.vung.length, nghe).toBeGreaterThan(0);
      for (const v of kq.vung) expect(v.lat, nghe).toBeGreaterThan(13);
      expect(kq.ghiChu.join(" "), nghe).not.toMatch(/Không có vùng cá nào/);
    }
  });
  it("không ô nào tới được ⇒ rỗng + nói ra, không ném", () => {
    const kq = deXuatLoTrinh(input({ nghe: "luoi-vay", soNgay: 15, caTheoNgay: () => xa }), NOW);
    expect(kq.vung).toEqual([]);
    expect(kq.ghiChu.join(" ")).toMatch(/Không có vùng cá nào/);
  });
});
