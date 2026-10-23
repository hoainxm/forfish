import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  buildReefDepthIndex,
  decodeReefDepth,
  nguongChanRanM,
  oSangMet,
  reefAt,
  reefDepthAtM,
  CAN_KHI_CHUA_KHAI_MON_M,
  DU_PHONG_SDB_M,
  RONG_XA_BO_M,
} from "../reef-depth";

const ROOT = path.resolve(__dirname, "../../..");
const raw = fs.readFileSync(path.join(ROOT, "public/data/reef-depth.v1.bin"));
const rd = decodeReefDepth(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer);
const ix = buildReefDepthIndex(rd);

describe("reef-depth.v1.bin (file thật)", () => {
  it("đọc được 168 thực thể, CHỈ Hoàng Sa / Trường Sa, datum MSL, có ghi nguồn CC BY", () => {
    expect(rd.features.length).toBe(168);
    expect(new Set(rd.features.map((f) => f.nhom))).toEqual(new Set(["hoang-sa", "truong-sa"]));
    expect(rd.datum).toBe("MSL");
    expect(rd.credit.join(" ")).toMatch(/CC BY 4\.0/);
    expect(rd.credit.join(" ")).toMatch(/Hohai/);
  });

  it("CHỦ QUYỀN: không tên nào có chữ Hán hay hậu tố loại hình nước ngoài; mọi tên bắt đầu bằng loại tiếng Việt", () => {
    for (const f of rd.features) {
      expect(f.ten).not.toMatch(/[一-鿿]/);
      expect(f.ten).not.toMatch(/\b(Dao|Jiao|Ansha|Shazhou|Qunjiao|Reef|Reefs|Island|Islands|Shoal|Shoals|Bank|Banks|Atoll|Cay)\b/);
      expect(f.ten).toMatch(/^(Đảo|Đá|Bãi|Cồn|Cụm|Nhóm|Hòn)/);
    }
  });

  it("CHỦ QUYỀN: tên đã giải mã qua đúng bộ quét audit-names của dự án (file .bin thân nhị phân nên bộ quét không tự đọc được)", async () => {
    const os = await import("node:os");
    const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "rdp-")), "ten.json");
    fs.writeFileSync(tmp, JSON.stringify(rd.features.map((f) => ({ name: f.ten }))));
    const { scan } = await import(path.join(ROOT, "scripts/audit-names.mjs"));
    const r = await scan([tmp]);
    expect(r.findings.map((x: { sample: string }) => x.sample)).toEqual([]);
  });

  it("mọi lưới giải mã đúng cỡ và nằm trong Biển Đông", () => {
    for (const f of rd.features) {
      expect(f.grid.length).toBe(f.nLat * f.nLon);
      expect(f.lat0).toBeGreaterThan(6.5);
      expect(f.lat0).toBeLessThan(17.6);
      expect(f.lon0).toBeGreaterThan(110.5);
    }
  });

  it("Đá Chữ Thập có phần nông 0–2 m; điểm biển khơi xa mọi rạn trả null", () => {
    const f = rd.features.find((x) => x.ten === "Đá Chữ Thập");
    expect(f).toBeDefined();
    expect(f!.nongNhatM).toBeLessThan(2);
    // tìm một ô cạn của Chữ Thập rồi tra ngược qua chỉ mục
    let hit: { lat: number; lon: number } | null = null;
    for (let i = 0; i < f!.nLat && !hit; i++)
      for (let j = 0; j < f!.nLon && !hit; j++)
        if (f!.grid[i * f!.nLon + j] <= 20) hit = { lat: f!.lat0 + (i + 0.5) * f!.dLat, lon: f!.lon0 + (j + 0.5) * f!.dLon };
    expect(hit).not.toBeNull();
    expect(reefDepthAtM(ix, hit!.lat, hit!.lon)).toBeLessThanOrEqual(2);
    expect(reefAt(ix, hit!.lat, hit!.lon)?.ten).toBe("Đá Chữ Thập");
    expect(reefDepthAtM(ix, 12.0, 113.5)).toBeNull();
    expect(reefDepthAtM(ix, 10.0, 107.0)).toBeNull();
  });
});

describe("luật ngưỡng chặn rạn", () => {
  it("chưa khai mớn: 4 m + sai số vệ tinh + ròng xa bờ", () => {
    expect(nguongChanRanM(null, null)).toBeCloseTo(CAN_KHI_CHUA_KHAI_MON_M + DU_PHONG_SDB_M + RONG_XA_BO_M, 5);
  });
  it("đã khai mớn 1,5 m, sóng 1 m, 6 hải lý/giờ: 1,5 + 0,5 + 0,5 + 0 lún + 1,0 + 0,8 = 4,3 m", () => {
    expect(nguongChanRanM(1.5, 1, 6)).toBeCloseTo(4.3, 2);
  });
  it("sóng to + chạy nhanh làm ngưỡng tăng (không bao giờ giảm dưới mớn)", () => {
    expect(nguongChanRanM(1.5, 3, 12)).toBeGreaterThan(nguongChanRanM(1.5, 1, 6));
    expect(nguongChanRanM(3, 0, 0)).toBeGreaterThan(3 + DU_PHONG_SDB_M);
  });
  it("mã ô: 254 = sâu hơn 25,3 m, 255 = không số", () => {
    expect(oSangMet(0)).toBe(0);
    expect(oSangMet(37)).toBeCloseTo(3.7, 5);
    expect(oSangMet(254)).toBeGreaterThan(25.3);
    expect(oSangMet(255)).toBeNull();
  });
});

describe("giải mã RLE + file méo", () => {
  const mk = (cells: number[]) => {
    const out: number[] = [];
    for (let i = 0; i < cells.length; ) {
      if (cells[i] !== 255) { out.push(cells[i++]); continue; }
      let n = 0; while (i < cells.length && cells[i] === 255) { n++; i++; }
      out.push(255); while (n >= 0x80) { out.push((n & 0x7f) | 0x80); n >>>= 7; } out.push(n);
    }
    const body = new Uint8Array(out);
    const head = new TextEncoder().encode(JSON.stringify({ v: 1, sinh: "t", datum: "MSL", credit: [], features: [{ ten: "Đá Thử", nhom: "truong-sa", nguon: "x", lat0: 10, lon0: 114, dLat: 0.001, dLon: 0.001, nLat: 1, nLon: cells.length, nongNhatM: 0, trungViM: 1, off: 0, len: body.length }] }));
    const file = new Uint8Array(8 + head.length + body.length);
    file.set([82, 68, 80, 49], 0);
    new DataView(file.buffer).setUint32(4, head.length, true);
    file.set(head, 8); file.set(body, 8 + head.length);
    return file.buffer;
  };
  it("dải 300 ô không số (varint 2 byte) giải đúng", () => {
    const cells = [5, ...Array(300).fill(255), 7, 254];
    const r = decodeReefDepth(mk(cells));
    expect(Array.from(r.features[0].grid)).toEqual(cells);
  });
  it("sai chữ ký ⇒ ném", () => {
    const b = new Uint8Array(mk([1, 2]));
    b[0] = 0;
    expect(() => decodeReefDepth(b.buffer)).toThrow();
  });
});

describe("thẻ chạm rạn", () => {
  it("chạm đúng tên gần tâm ⇒ ra đúng thực thể; chạm ven bờ ⇒ null", async () => {
    const { timRanChoThe } = await import("../reef-depth");
    const f = rd.features.find((x) => x.ten === "Đá Chữ Thập")!;
    const tam = { lat: f.lat0 + (f.dLat * f.nLat) / 2, lon: f.lon0 + (f.dLon * f.nLon) / 2 };
    expect(timRanChoThe(rd, "Đá Chữ Thập", tam.lat + 0.02, tam.lon)?.ten).toBe("Đá Chữ Thập");
    expect(timRanChoThe(rd, "Hòn Mun", 12.17, 109.3)).toBeNull();
    expect(timRanChoThe(rd, "x", null, null)).toBeNull();
  });
  it("lọc theo khung: khung ven bờ Nha Trang ⇒ 0 thực thể (vẫn là bản đã đối chiếu)", async () => {
    const { reefDepthInBBox } = await import("../reef-depth");
    expect(reefDepthInBBox(rd, { latMin: 11.5, latMax: 12.5, lonMin: 108.8, lonMax: 109.6 }).features.length).toBe(0);
    expect(reefDepthInBBox(rd, { latMin: 9, latMax: 10, lonMin: 112, lonMax: 113.5 }).features.length).toBeGreaterThan(0);
  });
});
