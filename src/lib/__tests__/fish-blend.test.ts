import { describe, it, expect } from "vitest";
import weights from "@/data/fish-blend-weights.json";
import climFile from "../../../public/data/fish-climatology.v1.json";
import {
  BLEND_USABLE,
  MAX_MEASURED_LEAD,
  ABSENT_PERSIST,
  blendWeight,
  measuredWeight,
  climShare,
  PRODUCT_SHARE_FIRST,
  PRODUCT_SHARE_LAST,
  blendScore,
  blendFishCells,
  buildClimScaleMap,
  hotspotSpacingDeg,
  hotspotMaxCount,
  HOTSPOT_SPACING_TODAY_DEG,
  decodeClimatology,
  climScoreAt,
  type ClimatologyFile,
} from "@/lib/fish-blend";

/*
  Lớp cá cho chuyến dài = pha trộn dự báo × mùa vụ. Test canh 3 thứ:
   1. BẢNG w là số ĐO ĐƯỢC, hợp lệ, phân biệt theo tầm ngày (guard
      "always-on-term" — bài học lặp lại: hệ số khai rộng hơn phân bố thật thì
      số hạng luôn bật, mô hình mất khả năng phân biệt).
   2. Hàm pha trộn chạy ĐÚNG BIÊN (hôm nay = ảnh hôm nay; tầm xa nghiêng mùa vụ).
   3. OFFLINE: mọi thứ chạy được KHÔNG có mạng — w nhúng trong bundle, bản mùa
      vụ giải mã từ file tĩnh; thiếu dữ liệu thì giữ bản dự báo, không bịa.
*/

const w = weights as {
  perLead: { lead: number; w: number | null; n?: number }[];
  guard: { degenerate: boolean; spread: number; verdict: string };
  caveat: string;
  cvWinsOverPersistence: number[];
};

describe("bảng trọng số w(d) — số đo được, không đặt tay", () => {
  it("có mốc đo và mọi w nằm trong [0,1]", () => {
    const measured = w.perLead.filter((r) => typeof r.w === "number");
    expect(measured.length).toBeGreaterThan(0);
    for (const r of measured) {
      expect(r.w as number).toBeGreaterThanOrEqual(0);
      expect(r.w as number).toBeLessThanOrEqual(1);
    }
  });

  it("w KHÔNG TĂNG theo tầm ngày (ảnh cũ không thể biết thêm khi đi xa hơn)", () => {
    const measured = w.perLead
      .filter((r): r is { lead: number; w: number } => typeof r.w === "number")
      .sort((a, b) => a.lead - b.lead);
    for (let i = 1; i < measured.length; i++) {
      expect(measured[i].w).toBeLessThanOrEqual(measured[i - 1].w + 1e-9);
    }
  });

  it("GUARD always-on-term: w phân biệt theo tầm, không suy biến", () => {
    expect(w.guard.degenerate).toBe(false);
    expect(w.guard.spread).toBeGreaterThan(0.05);
  });

  it("có ghi caveat trung thực (sự thật là bản đồ, không phải sản lượng cá)", () => {
    expect(w.caveat).toMatch(/KHÔNG PHẢI sản lượng/i);
  });

  it("mỗi mốc đo dựa trên số mẫu lớn (không fit trên vài chục ô)", () => {
    for (const r of w.perLead) {
      if (typeof r.w !== "number") continue;
      expect(r.n ?? 0).toBeGreaterThan(1000);
    }
  });
});

describe("blendWeight — nội suy theo tầm ngày", () => {
  it("bảng dùng được", () => {
    expect(BLEND_USABLE).toBe(true);
    expect(MAX_MEASURED_LEAD).toBeGreaterThanOrEqual(10);
  });

  it("ngày 0 = 1 (hôm nay chính là ảnh hôm nay, không pha)", () => {
    expect(blendWeight(0)).toBe(1);
  });

  it("không tăng theo ngày và luôn trong [0,1]", () => {
    let prev = Infinity;
    for (let d = 0; d <= 20; d++) {
      const v = blendWeight(d);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(prev + 1e-9);
      prev = v;
    }
  });

  it("quá mốc đo cuối thì GIỮ w mốc cuối — không ngoại suy", () => {
    const last = blendWeight(MAX_MEASURED_LEAD);
    expect(blendWeight(MAX_MEASURED_LEAD + 5)).toBeCloseTo(last, 9);
    expect(blendWeight(999)).toBeCloseTo(last, 9);
  });

  it("ngày âm coi như hôm nay (không vỡ khi gọi sai)", () => {
    expect(blendWeight(-3)).toBe(1);
  });
});

describe("blendScore", () => {
  it("ngày 0 trả đúng điểm dự báo", () => {
    expect(blendScore(80, 10, 0)).toBe(80);
  });

  it("hai bản bằng nhau thì pha kiểu gì cũng ra chính nó", () => {
    for (const d of [0, 1, 5, 16]) expect(blendScore(55, 55, d)).toBe(55);
  });

  it("nằm giữa hai đầu vào (không bao giờ vọt ra ngoài)", () => {
    for (const d of [1, 3, 8, 16]) {
      const v = blendScore(90, 20, d);
      expect(v).toBeGreaterThanOrEqual(20);
      expect(v).toBeLessThanOrEqual(90);
    }
  });

  it("tầm càng xa càng nghiêng về mùa vụ", () => {
    const near = blendScore(90, 20, 1);
    const far = blendScore(90, 20, MAX_MEASURED_LEAD);
    expect(far).toBeLessThanOrEqual(near);
  });

  it("kẹp trong 0..100 kể cả đầu vào bẩn", () => {
    expect(blendScore(999, 999, 3)).toBe(100);
    expect(blendScore(-50, -50, 3)).toBe(0);
  });
});

describe("bản mùa vụ — giải mã + tra cứu, KHÔNG cần mạng", () => {
  const clim = decodeClimatology(climFile as unknown as ClimatologyFile);

  it("giải mã đủ 12 tháng, đúng cỡ lưới", () => {
    expect(clim.months.size).toBe(12);
    for (const [, buf] of clim.months) {
      expect(buf.length).toBe(clim.meta.nLat * clim.meta.nLon);
    }
  });

  it("dựng từ nhiều năm lịch sử (không phải một năm lẻ)", () => {
    const [from, to] = clim.meta.years ?? [0, 0];
    expect(to - from).toBeGreaterThanOrEqual(2);
  });

  it("có ô điểm cao trong vùng biển VN", () => {
    let maxSeen = 0;
    for (const [, buf] of clim.months)
      for (const v of buf) if (v > maxSeen) maxSeen = v;
    expect(maxSeen).toBeGreaterThanOrEqual(50);
  });

  it("KHÁC NHAU giữa các tháng (có tính mùa vụ thật, không phải một bản chép 12 lần)", () => {
    const sum = (m: number) =>
      (clim.months.get(m) ?? new Uint8Array()).reduce((a, b) => a + b, 0);
    const totals = Array.from({ length: 12 }, (_, i) => sum(i + 1));
    const max = Math.max(...totals);
    const min = Math.min(...totals);
    expect(max).toBeGreaterThan(0);
    // chênh ≥10% giữa tháng đậm nhất và nhạt nhất
    expect((max - min) / max).toBeGreaterThan(0.1);
  });

  it("tra ngoài lưới trả 0, không ném", () => {
    expect(climScoreAt(clim, 0, 0, 6)).toBe(0);
    expect(climScoreAt(clim, 60, 200, 6)).toBe(0);
  });

  it("tra trong lưới trả 0..100", () => {
    const { lat0, lon0, dLat, dLon, nLat, nLon } = clim.meta;
    for (let k = 0; k < 50; k++) {
      const lat = lat0 + dLat * Math.floor((k * 7) % nLat);
      const lon = lon0 + dLon * Math.floor((k * 11) % nLon);
      const v = climScoreAt(clim, lat, lon, ((k % 12) + 1) as number);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it("thiếu bản mùa vụ (null) → 0 điểm, blend giữ nguyên bản dự báo", () => {
    expect(climScoreAt(null, 12, 110, 6)).toBe(0);
    // với clim = 0 mà vẫn phải giữ được thông tin dự báo ở ngày gần
    expect(blendScore(70, 0, 0)).toBe(70);
  });

  it("file hỏng cỡ lưới → bỏ tháng đó, không ném", () => {
    const broken = {
      ...(climFile as unknown as ClimatologyFile),
      months: { "1": "AAAA", "2": "" },
    };
    const c = decodeClimatology(broken);
    expect(c.months.size).toBe(0);
    expect(climScoreAt(c, 12, 110, 1)).toBe(0);
  });
});

describe("v2 — chuẩn hoá phân vị + pha trên HỢP hai tập", () => {
  const clim = decodeClimatology(climFile as unknown as ClimatologyFile);
  const month = 7;

  it("bảng quy đổi KHÔNG GIẢM (giữ đúng thứ tự mùa vụ)", () => {
    const day = Array.from({ length: 500 }, (_, i) => 25 + (i % 60));
    const map = buildClimScaleMap(clim, month, day);
    for (let v = 1; v <= 100; v++) expect(map[v]).toBeGreaterThanOrEqual(map[v - 1]);
    expect(map[0]).toBe(0); // không có số mùa vụ thì vẫn không có
  });

  it("KÉO GIÃN biên độ: điểm mùa vụ cao nhất được quy về gần đỉnh thang ngày", () => {
    // bản đồ ngày giả có đỉnh 90 — mùa vụ (đỉnh ~59) phải được nâng lên gần đó
    const day = Array.from({ length: 800 }, (_, i) => 30 + Math.floor((i / 800) * 60));
    const map = buildClimScaleMap(clim, month, day);
    const buf = clim.months.get(month)!;
    const maxRaw = Math.max(...buf);
    expect(map[maxRaw]).toBeGreaterThan(maxRaw); // đã được nâng, không còn bị nén
    expect(map[maxRaw]).toBeGreaterThanOrEqual(80);
  });

  it("thiếu dữ liệu → bảng ĐỒNG NHẤT (không bịa)", () => {
    const map = buildClimScaleMap(null, month, [50, 60]);
    for (let v = 0; v <= 100; v++) expect(map[v]).toBe(v);
    const map2 = buildClimScaleMap(clim, month, []);
    for (let v = 0; v <= 100; v++) expect(map2[v]).toBe(v);
  });

  const mk = (lat: number, lon: number, s: number, sp = {}) => ({
    lat,
    lon,
    s,
    top: [],
    sp,
    t: 29,
    c: 0.2,
  });
  const cells = [
    mk(12.28, 109.28, 80, { "ngừ vây vàng": 70 }),
    mk(10.03, 107.03, 45),
    mk(14.0, 112.0, 30),
  ];

  it("NGÀY 0 trả NGUYÊN mảng cũ (hôm nay không bao giờ đổi)", () => {
    expect(blendFishCells(cells, clim, month, 0)).toBe(cells);
  });

  it("thiếu bản mùa vụ → trả nguyên mảng cũ", () => {
    expect(blendFishCells(cells, null, month, 8)).toBe(cells);
  });

  it("SINH Ô MỚI ở ngày xa — đây là lỗi của bản v1 (0 ô mới ở mọi tầm)", () => {
    const out = blendFishCells(cells, clim, month, 16);
    const created = out.filter((c) => c.fromClim);
    expect(out.length).toBeGreaterThan(cells.length);
    expect(created.length).toBeGreaterThan(0);
    for (const c of created) {
      expect(c.s).toBeGreaterThan(0);
      expect(c.s).toBeLessThanOrEqual(100);
    }
  });

  it("ngày càng xa, mùa vụ càng gánh nhiều (tỷ lệ % tăng theo ngày)", () => {
    const shares = [1, 3, 8, 16].map((d) => 1 - blendWeight(d));
    for (let i = 1; i < shares.length; i++)
      expect(shares[i]).toBeGreaterThan(shares[i - 1]);
  });

  it("ô cũ giữ nguyên toạ độ + số loài co giãn theo tỉ lệ", () => {
    const out = blendFishCells(cells, clim, month, 8);
    const keep = out.find((c) => c.lat === 12.28 && c.lon === 109.28)!;
    expect(keep).toBeTruthy();
    const v = keep.sp["ngừ vây vàng"];
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(100);
  });

  it("ô vắng mặt được coi là DƯỚI ngưỡng giữ, không phải 0", () => {
    expect(ABSENT_PERSIST).toBeGreaterThan(0);
    expect(ABSENT_PERSIST).toBeLessThan(25); // KEEP_MIN của lưới cá
  });

  it("mảng rỗng → trả rỗng, không ném", () => {
    expect(blendFishCells([], clim, month, 8)).toEqual([]);
  });
});

describe("v3 — lớp chọn của chủ dự án + giãn lại phân bố", () => {
  const clim = decodeClimatology(climFile as unknown as ClimatologyFile);
  const month = 7;

  it("tỷ lệ mùa vụ chạm đúng hai mốc chủ dự án chốt (6 % → 56 %)", () => {
    const leads = w.perLead
      .filter((r): r is { lead: number; w: number } => typeof r.w === "number")
      .map((r) => r.lead)
      .sort((a, b) => a - b);
    expect(climShare(leads[0])).toBeCloseTo(PRODUCT_SHARE_FIRST, 3);
    expect(climShare(leads[leads.length - 1])).toBeCloseTo(PRODUCT_SHARE_LAST, 3);
  });

  it("tỷ lệ mùa vụ TĂNG DẦN theo ngày, không bao giờ giảm", () => {
    let prev = -1;
    for (let d = 1; d <= 20; d++) {
      const v = climShare(d);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      prev = v;
    }
  });

  it("ngày 0 KHÔNG pha (mùa vụ gánh 0 %)", () => {
    expect(climShare(0)).toBe(0);
    expect(blendWeight(0)).toBe(1);
  });

  it("TẦM XA đẩy lên trên mức đo; tầm GẦN được phép thấp hơn (độ cong gamma)", () => {
    const leads = w.perLead
      .filter((r): r is { lead: number; w: number } => typeof r.w === "number")
      .map((r) => r.lead)
      .sort((a, b) => a - b);
    const last = leads[leads.length - 1];
    // xa: cố ý đẩy lên hẳn trên mức tối ưu theo sai số
    expect(climShare(last)).toBeGreaterThan(1 - measuredWeight(last));
    // gần: đường cong gamma>1 giữ thấp — đo được là TỐT HƠN, nên không ép ≥ mức đo
    expect(climShare(3)).toBeLessThan(climShare(last));
  });

  const mkCells = () =>
    Array.from({ length: 60 }, (_, i) => ({
      lat: 9 + Math.floor(i / 8) * 0.25,
      lon: 106 + (i % 8) * 0.25,
      s: 25 + ((i * 7) % 60),
      top: [] as string[],
      sp: {} as Record<string, number>,
      t: 29,
      c: 0.2,
    }));

  it("KHÔNG làm bản đồ nghèo đi — số ô mỗi mức giữ như hôm nay", () => {
    const cells = mkCells();
    const cnt = (arr: { s: number }[], lo: number) => arr.filter((c) => c.s >= lo).length;
    const base40 = cnt(cells, 40);
    const base60 = cnt(cells, 60);
    for (const d of [3, 8, 16]) {
      const out = blendFishCells(cells, clim, month, d);
      // cho phép chênh nhẹ do làm tròn/ô mùa vụ thêm vào, nhưng KHÔNG được tụt
      expect(cnt(out, 40)).toBeGreaterThanOrEqual(base40);
      expect(cnt(out, 60)).toBeGreaterThanOrEqual(base60 - 1);
    }
  });

  it("ngày càng xa càng ĐỔI CHỖ nhiều (thứ tự ô khác dần so với hôm nay)", () => {
    const cells = mkCells();
    const key = (c: { lat: number; lon: number }) => `${c.lat},${c.lon}`;
    const base = new Set(cells.filter((c) => c.s >= 40).map(key));
    const changedAt = (d: number) => {
      const out = blendFishCells(cells, clim, month, d);
      return out.filter((c) => c.s >= 40 && !base.has(key(c))).length;
    };
    expect(changedAt(16)).toBeGreaterThanOrEqual(changedAt(3));
  });
});

describe("độ rộng hồng tâm theo tầm ngày (đo từ dịch chuyển thật)", () => {
  it("HÔM NAY giữ y như cũ — không đổi hành vi đang chạy", () => {
    expect(hotspotSpacingDeg(0)).toBe(HOTSPOT_SPACING_TODAY_DEG);
    expect(hotspotSpacingDeg(1)).toBe(HOTSPOT_SPACING_TODAY_DEG);
    expect(hotspotMaxCount(0)).toBe(8);
  });

  it("càng xa càng NỚI RỘNG, không bao giờ hẹp lại", () => {
    let prev = 0;
    for (let d = 0; d <= 20; d++) {
      const v = hotspotSpacingDeg(d);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      expect(v).toBeGreaterThanOrEqual(HOTSPOT_SPACING_TODAY_DEG);
      prev = v;
    }
  });

  it("khớp mức lệch ĐO ĐƯỢC của trọng tâm cụm (214 km ở ngày 8, 249 km ở ngày 16)", () => {
    expect(hotspotSpacingDeg(8) * 111).toBeGreaterThan(190);
    expect(hotspotSpacingDeg(8) * 111).toBeLessThan(240);
    expect(hotspotSpacingDeg(16) * 111).toBeGreaterThan(230);
    expect(hotspotSpacingDeg(16) * 111).toBeLessThan(270);
  });

  it("quá mốc đo cuối thì GIỮ, không ngoại suy vô hạn", () => {
    expect(hotspotSpacingDeg(99)).toBeCloseTo(hotspotSpacingDeg(16), 9);
  });

  it("nới rộng thì BỚT chấm (không để chật kín màn)", () => {
    let prev = 99;
    for (const d of [0, 3, 5, 8, 12, 16]) {
      const n = hotspotMaxCount(d);
      expect(n).toBeLessThanOrEqual(prev);
      expect(n).toBeGreaterThanOrEqual(3);
      prev = n;
    }
  });
});
