import { describe, it, expect } from "vitest";
import weights from "@/data/fish-blend-weights.json";
import climFile from "../../../public/data/fish-climatology.v1.json";
import {
  BLEND_USABLE,
  MAX_MEASURED_LEAD,
  blendWeight,
  blendScore,
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
