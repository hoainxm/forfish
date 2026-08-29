/*  Lưới độ sâu tĩnh — CÁI BẪY của asset kiểu này là hằng số trong
    `src/lib/depth-grid.ts` và hằng số trong `scripts/generate-depth-grid.mjs`
    trôi khỏi nhau. Lệch mà không ai biết thì lưới vẫn giải mã ra số, chỉ là
    ĐỌC SAI CHỖ: bà con chạm giữa khơi lại thấy "nước cạn", còn bãi cạn thật
    thì im lặng — hỏng đúng thứ lớp này sinh ra để nói.
    Nên bộ test này KHÔNG dựng lưới giả: nó mở file .bin THẬT trong
    public/data và đối chiếu với DEPTH_META, cộng vài điểm mốc địa lý đã biết
    để bắt cả ca lệch NEO TOẠ ĐỘ (đúng cỡ file nhưng sai gốc/bước). */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEPTH_META, decodeDepthGrid, depthClassAt } from "../depth-grid";

const BIN = join(process.cwd(), "public", "data", "depth-grid.v1.bin");
const raw = readFileSync(BIN);
/*  Giải mã TRONG test chứ không ở cấp module: lệch DEPTH_META làm
    `decodeDepthGrid` ném, mà ném lúc import thì cả file test "no tests" —
    đỏ nhưng không nói được điều gì. Gọi trong test thì ca đầu tiên chỉ thẳng
    ra con số lệch bao nhiêu. */
const grid = () =>
  decodeDepthGrid(
    raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer,
  );

describe("depth-grid.v1.bin ↔ DEPTH_META", () => {
  it("cỡ file khớp đúng nLat×nLon ở 2 bit/ô", () => {
    expect(raw.byteLength).toBe(
      Math.ceil((DEPTH_META.nLat * DEPTH_META.nLon) / 4),
    );
  });

  it("decodeDepthGrid từ chối file sai cỡ (dù chỉ lệch 1 byte)", () => {
    const need = Math.ceil((DEPTH_META.nLat * DEPTH_META.nLon) / 4);
    expect(() => decodeDepthGrid(new ArrayBuffer(need - 1))).toThrow();
    expect(() => decodeDepthGrid(new ArrayBuffer(need + 1))).toThrow();
  });

  it("bước lưới đúng 15 giây cung (1/240°) như script sinh ra", () => {
    expect(DEPTH_META.step).toBeCloseTo(1 / 240, 12);
    // ô ETOPO là ô TÂM → gốc lệch nửa bước so với mốc 5°B / 102°Đ
    expect(DEPTH_META.lat0).toBeCloseTo(5 + 1 / 480, 12);
    expect(DEPTH_META.lon0).toBeCloseTo(102 + 1 / 480, 12);
  });

  it("khung phủ trọn vùng biển VN 5–23,5°B / 102–118°Đ", () => {
    const { lat0, lon0, step, nLat, nLon } = DEPTH_META;
    expect(lat0).toBeLessThanOrEqual(5.01);
    expect(lon0).toBeLessThanOrEqual(102.01);
    expect(lat0 + (nLat - 1) * step).toBeGreaterThanOrEqual(23.5);
    expect(lon0 + (nLon - 1) * step).toBeGreaterThanOrEqual(118);
  });
});

describe("đọc lưới thật — điểm mốc địa lý", () => {
  // gọi trong `it`, không ở thân `describe`: ném lúc gom test cũng ra "no tests"
  let cache: ReturnType<typeof grid> | null = null;
  const g = () => (cache ??= grid());
  it("ngoài khung trả null, không đoán bừa", () => {
    expect(depthClassAt(g(), 30, 110)).toBeNull(); // trên Bắc quá khung
    expect(depthClassAt(g(), 13, 130)).toBeNull(); // Đông quá khung
    expect(depthClassAt(g(), 0, 110)).toBeNull();
  });

  it("giữa khơi là nước sâu, đồng bằng là đất liền", () => {
    expect(depthClassAt(g(), 13, 110.5)).toBe(3); // khơi Nam Trung Bộ
    expect(depthClassAt(g(), 9.1, 105.1)).toBe(0); // đồng bằng Cà Mau
    expect(depthClassAt(g(), 21.0, 105.8)).toBe(0); // Hà Nội
  });

  it("rạn giữa biển hiện ra ở độ phân giải mới (Đá Chữ Thập, đảo Phú Lâm)", () => {
    // Ở bước 450 m, một điểm đơn lẻ có thể rơi trúng lòng hồ giữa rạn (sâu
    // thật) — nên soi cả mảng quanh đó, đúng thứ tuyến đường quan tâm.
    const worstAround = (lat: number, lon: number, rings: number) => {
      let w = 3;
      for (let a = -rings; a <= rings; a++) {
        for (let b = -rings; b <= rings; b++) {
          const v = depthClassAt(g(), lat + a * DEPTH_META.step, lon + b * DEPTH_META.step);
          if (v !== null && v < w) w = v;
        }
      }
      return w;
    };
    expect(worstAround(9.55, 112.89, 24)).toBe(0); // Đá Chữ Thập (Trường Sa)
    expect(worstAround(16.83, 112.33, 12)).toBe(0); // đảo Phú Lâm (Hoàng Sa)
  });

  it("có đủ cả bốn lớp và biển vẫn chiếm phần lớn khung", () => {
    const seen = [0, 0, 0, 0];
    for (let k = 0; k < DEPTH_META.nLat * DEPTH_META.nLon; k++) {
      seen[(g().data[k >> 2] >> ((k & 3) * 2)) & 3]++;
    }
    for (const n of seen) expect(n).toBeGreaterThan(0);
    const total = DEPTH_META.nLat * DEPTH_META.nLon;
    expect(seen[3] / total).toBeGreaterThan(0.5); // khung là vùng biển
    expect(seen[0] / total).toBeLessThan(0.5);
  });
});
