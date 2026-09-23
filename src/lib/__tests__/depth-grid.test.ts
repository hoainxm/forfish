/*  Lưới độ sâu tĩnh — CÁI BẪY của asset kiểu này là hằng số trong
    `src/lib/depth-grid.ts` và hằng số trong `scripts/generate-depth-grid.mjs`
    trôi khỏi nhau. Lệch mà không ai biết thì lưới vẫn giải mã ra số, chỉ là
    ĐỌC SAI CHỖ: bà con chạm giữa khơi lại thấy "nước cạn", còn bãi cạn thật
    thì im lặng — hỏng đúng thứ lớp này sinh ra để nói.
    Nên bộ test này KHÔNG dựng lưới giả: nó mở file .bin THẬT trong
    public/data và đối chiếu với DEPTH_META, cộng vài điểm mốc địa lý đã biết
    để bắt cả ca lệch NEO TOẠ ĐỘ (đúng cỡ file nhưng sai gốc/bước).

    Từ 2026-09-04 (Đợt 0): 6 lớp, 4 bit/ô — 0 đất · 1 mặt nạ rạn · 2 nước <2 m
    · 3 nước 2–4 m · 4 nước 4–12 m · 5 đủ sâu. Bản 2 bit cũ có cỡ đúng một nửa
    và PHẢI bị `decodeDepthGrid` từ chối. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEPTH_CLASS_DEEP,
  DEPTH_CLASS_LABEL,
  DEPTH_CLASS_MIN_M,
  DEPTH_GRID_BYTES,
  DEPTH_META,
  decodeDepthGrid,
  depthClassAt,
  type DepthClass,
} from "../depth-grid";

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

const N_CELL = DEPTH_META.nLat * DEPTH_META.nLon;
/** đọc thẳng theo chỉ số ô — dùng cho các vòng quét toàn khung */
const rawClassAt = (data: Uint8Array, k: number) => (data[k >> 1] >> ((k & 1) * 4)) & 15;

describe("depth-grid.v1.bin ↔ DEPTH_META", () => {
  it("cỡ file khớp đúng nLat×nLon ở 4 bit/ô (2 ô/byte)", () => {
    expect(DEPTH_GRID_BYTES).toBe(Math.ceil(N_CELL / 2));
    expect(raw.byteLength).toBe(DEPTH_GRID_BYTES);
  });

  it("decodeDepthGrid từ chối file sai cỡ (lệch 1 byte, và cả bản 2 bit cũ)", () => {
    expect(() => decodeDepthGrid(new ArrayBuffer(DEPTH_GRID_BYTES - 1))).toThrow();
    expect(() => decodeDepthGrid(new ArrayBuffer(DEPTH_GRID_BYTES + 1))).toThrow();
    // bản 2 bit/ô (4 ô/byte) trước 2026-09-04 — service worker cũ còn giữ có
    // thể đưa file này vào; đọc nó theo 4 bit là sai lớp khắp nơi ⇒ phải ném
    expect(() => decodeDepthGrid(new ArrayBuffer(Math.ceil(N_CELL / 4)))).toThrow();
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

  it("bảng nhãn + sàn độ sâu đủ 6 lớp, sàn tăng dần theo lớp nước", () => {
    const classes: DepthClass[] = [0, 1, 2, 3, 4, 5];
    for (const c of classes) expect(DEPTH_CLASS_LABEL[c].length).toBeGreaterThan(3);
    expect(DEPTH_CLASS_MIN_M[0]).toBeNull();
    expect(DEPTH_CLASS_MIN_M[1]).toBeNull();
    expect(DEPTH_CLASS_MIN_M[2]).toBe(0);
    expect(DEPTH_CLASS_MIN_M[3]).toBe(2);
    expect(DEPTH_CLASS_MIN_M[4]).toBe(4);
    expect(DEPTH_CLASS_MIN_M[5]).toBe(12);
    expect(DEPTH_CLASS_DEEP).toBe(5);
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

  it("giữa khơi là nước sâu, đồng bằng/thành phố là đất liền (cổng v)", () => {
    expect(depthClassAt(g(), 13, 110.5)).toBe(DEPTH_CLASS_DEEP); // khơi Nam Trung Bộ
    expect(depthClassAt(g(), 9.1, 105.1)).toBe(0); // đồng bằng Cà Mau
    expect(depthClassAt(g(), 10.8, 106.7)).toBe(0); // Sài Gòn
    expect(depthClassAt(g(), 21.0, 105.8)).toBe(0); // Hà Nội
  });

  it("rạn giữa biển hiện ra ở độ phân giải mới (Đá Chữ Thập, đảo Phú Lâm) — mốc cũ vẫn đúng nghĩa", () => {
    // Ở bước 450 m, một điểm đơn lẻ có thể rơi trúng lòng hồ giữa rạn (sâu
    // thật) — nên soi cả mảng quanh đó, đúng thứ tuyến đường quan tâm.
    // "Đúng nghĩa" = KHÔNG ĐI QUA ĐƯỢC: đất (0) hoặc mặt nạ rạn (1). Bản 2 bit
    // cũ đòi đúng 0 vì 0 là "z > −2 m"; nay 0 là đường bờ/z > 0 hai nguồn.
    const worstAround = (lat: number, lon: number, rings: number) => {
      let w: number = DEPTH_CLASS_DEEP;
      for (let a = -rings; a <= rings; a++) {
        for (let b = -rings; b <= rings; b++) {
          const v = depthClassAt(g(), lat + a * DEPTH_META.step, lon + b * DEPTH_META.step);
          if (v !== null && v < w) w = v;
        }
      }
      return w;
    };
    expect(worstAround(9.55, 112.89, 24)).toBeLessThanOrEqual(1); // Đá Chữ Thập (Trường Sa)
    expect(worstAround(16.83, 112.33, 12)).toBeLessThanOrEqual(1); // đảo Phú Lâm (Hoàng Sa)
  });

  it("có đủ cả sáu lớp, không có mã lạ, và biển vẫn chiếm phần lớn khung", () => {
    const seen = [0, 0, 0, 0, 0, 0];
    let odd = 0;
    const d = g().data;
    for (let k = 0; k < N_CELL; k++) {
      const v = rawClassAt(d, k);
      if (v > DEPTH_CLASS_DEEP) odd++;
      else seen[v]++;
    }
    expect(odd).toBe(0);
    for (const n of seen) expect(n).toBeGreaterThan(0);
    expect(seen[5] / N_CELL).toBeGreaterThan(0.5); // khung là vùng biển
    expect(seen[0] / N_CELL).toBeLessThan(0.5);
  });
});

/*  ─────────────────────────────────────────────────────────────────────────
    SỰ CỐ AN TOÀN 2026-08-29 — vì sao có nguyên khối test dưới đây.

    Bản lưới trước chỉ dựng từ ETOPO 15". Lấy tâm 25 hình rạn thật trong
    reef-shapes.v1.json rồi hỏi hai nguồn thì 5 tâm bị xếp "đủ sâu" trong khi
    GEBCO nói nước sâu 1–2 m. "Đủ sâu" nghĩa là route-plan.ts VẠCH TUYẾN CHẠY
    THẲNG QUA — tàu mớn 1,5–3 m đi vào là mắc cạn.

    Đây không phải lỗi code sửa một dòng là xong: ô ETOPO rộng ~450 m, mà một
    nửa số hình rạn trong file còn NHỎ HƠN MỘT Ô. Một mô hình 450 m về nguyên
    tắc không phân giải nổi cái rạn. Bản vá vì thế là RÀNG BUỘC dữ liệu (mặt
    nạ rạn + nguồn GEBCO thứ hai), và ràng buộc dữ liệu thì chỉ có test đọc
    ĐÚNG FILE THẬT mới giữ được — không có kiểu test nào khác bắt được ngày
    ai đó chạy lại script mà quên bật mặt nạ.

    Hai vế phải cùng đúng, thiếu vế nào cũng là hỏng:
      · KHÔNG được còn chỗ rạn nào mang lớp "đủ sâu" (vá thiếu → mắc cạn)
      · biển sâu thật vẫn phải là "đủ sâu" (vá quá tay → báo động giả khắp
        nơi, bà con tắt cảnh báo, mất luôn tác dụng)
    ───────────────────────────────────────────────────────────────────────── */
describe("ràng buộc an toàn: rạn không bao giờ là 'đủ sâu'", () => {
  let cache: ReturnType<typeof grid> | null = null;
  const g = () => (cache ??= grid());

  type Geom = { type: string; coordinates: unknown };
  const shapes = (): { properties: { kind: string }; geometry: Geom }[] =>
    JSON.parse(
      readFileSync(join(process.cwd(), "public", "data", "reef-shapes.v1.json"), "utf8"),
    ).features;

  /*  Tâm = trung bình các đỉnh — CỐ Ý dùng đúng định nghĩa mà bản kiểm tra
      2026-08-29 đã dùng để tìm ra lỗi, để ca test này so được với con số gốc. */
  const centroid = (geo: Geom): [number, number] => {
    let sx = 0, sy = 0, n = 0;
    const walk = (a: unknown): void => {
      const arr = a as unknown[];
      if (typeof arr[0] === "number") {
        sx += arr[0] as number;
        sy += arr[1] as number;
        n++;
      } else arr.forEach(walk);
    };
    walk(geo.coordinates);
    return [sx / n, sy / n];
  };

  it("QUÉT TOÀN BỘ hình rạn/bãi cạn/đá/xác tàu — không hình nào có tâm 'đủ sâu'", () => {
    const all = shapes();
    expect(all.length).toBeGreaterThan(2000); // file còn nguyên, không rỗng
    const bad: string[] = [];
    let checked = 0;
    for (const f of all) {
      const [lon, lat] = centroid(f.geometry);
      const cls = depthClassAt(g(), lat, lon);
      if (cls === null) continue; // vài hình nằm ngoài khung 102–118°Đ
      checked++;
      if (cls === DEPTH_CLASS_DEEP) bad.push(`${f.properties.kind} ${lat.toFixed(4)},${lon.toFixed(4)}`);
    }
    expect(checked).toBeGreaterThan(2000); // đã thật sự quét, không rơi hết vào null
    expect(bad).toEqual([]);
  });

  it("năm toạ độ gây ra sự cố không còn là 'đủ sâu' (mốc cũ, cổng iv)", () => {
    // GEBCO đo lần lượt: -1, -2, -2, -1, -11 m
    for (const [lat, lon] of [
      [9.761, 116.514],
      [9.726, 116.588],
      [9.761, 114.341],
      [8.682, 114.177],
      [22.379, 113.886],
    ]) {
      const cls = depthClassAt(g(), lat, lon);
      expect(cls, `${lat},${lon} phải bị chặn`).not.toBeNull();
      expect(cls, `${lat},${lon} vẫn đang là "đủ sâu"`).toBeLessThan(DEPTH_CLASS_DEEP);
    }
  });

  it("mọi ô CHẠM hình rạn đều bị chặn, không chỉ ô trúng tâm", () => {
    /*  Tâm mới chỉ là một điểm. Cái bẫy thật là rạn NHỎ HƠN Ô LƯỚI: nó lọt
        giữa bốn tâm ô rồi biến mất. Nên quét từng ĐỈNH của mọi hình (đỉnh chắc
        chắn nằm trên hình) cộng bốn ô kề — ô kề cách ~450 m, vẫn nằm trong
        bán kính nở, nên bị chặn là điều bản vá PHẢI bảo đảm. */
    const step = DEPTH_META.step;
    const bad: string[] = [];
    let checked = 0;
    for (const f of shapes()) {
      const walk = (a: unknown): void => {
        const arr = a as unknown[];
        if (typeof arr[0] === "number") {
          const [lon, lat] = arr as number[];
          for (const [dy, dx] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const cls = depthClassAt(g(), lat + dy * step, lon + dx * step);
            if (cls === null) continue; // ngoài khung 102–118°Đ
            checked++;
            if (cls === DEPTH_CLASS_DEEP) bad.push(`${f.properties.kind} ${lat.toFixed(4)},${lon.toFixed(4)}`);
          }
        } else arr.forEach(walk);
      };
      walk(f.geometry.coordinates);
    }
    expect(checked).toBeGreaterThan(50000);
    expect(bad.slice(0, 10)).toEqual([]);
    expect(bad.length).toBe(0);
  });
});

describe("chống vá quá tay: biển sâu vẫn phải là 'đủ sâu'", () => {
  let cache: ReturnType<typeof grid> | null = null;
  const g = () => (cache ??= grid());

  it("các điểm khơi xa mọi rạn vẫn là 'đủ sâu'", () => {
    for (const [lat, lon, ten] of [
      [13, 114, "giữa Biển Đông"],
      [13, 110.5, "khơi Nam Trung Bộ"],
      [15, 112.5, "giữa Hoàng Sa – Trường Sa"],
      [17, 110, "khơi Quảng Trị"],
      [11, 111.5, "khơi Bình Thuận"],
      [7, 109, "Nam Biển Đông"],
    ] as [number, number, string][]) {
      expect(depthClassAt(g(), lat, lon), ten).toBe(DEPTH_CLASS_DEEP);
    }
  });

  it("cả ô vuông 1°×1° quanh 13°B/114°Đ đều 'đủ sâu', không lấm tấm báo động giả", () => {
    let n = 0, deep = 0;
    for (let lat = 12.5; lat <= 13.5; lat += DEPTH_META.step * 4) {
      for (let lon = 113.5; lon <= 114.5; lon += DEPTH_META.step * 4) {
        n++;
        if (depthClassAt(g(), lat, lon) === DEPTH_CLASS_DEEP) deep++;
      }
    }
    expect(n).toBeGreaterThan(3000);
    expect(deep).toBe(n);
  });

  it("lớp 1 'mặt nạ rạn' vẫn là thiểu số — trần 2% khung (cổng iii)", () => {
    /*  Mặt nạ rạn ép ô về lớp 1, mà lớp 1 là KHÔNG ĐI QUA ĐƯỢC. Nới tay quá
        thì tuyến nào cũng vòng vèo hoặc "không tìm được đường". Đo thật: sau
        bản vá 2026-08-29 là ~0,9% (lúc lớp 1 còn gộp cả nước <4 m); 2026-09-04
        chỉ còn mặt nạ, ~0,66%. Trần 2% để ngày ai đó nới bán kính lên vài
        chục km thì test đỏ chứ không phải bà con phát hiện hộ. */
    let mask = 0;
    const d = g().data;
    for (let k = 0; k < N_CELL; k++) if (rawClassAt(d, k) === 1) mask++;
    expect(mask / N_CELL).toBeGreaterThan(0.001); // mặt nạ có chạy thật
    expect(mask / N_CELL).toBeLessThan(0.02);
  });
});

/*  ─────────────────────────────────────────────────────────────────────────
    BRIEFING-03 (2026-09-04) — đất không được trộn với nước nông.

    Bản 2 bit cũ định nghĩa "đất = z > −2 m": bãi bùn ven bờ ở mực nước trung
    bình (0–2 m) thành đất, tuyến từ Rạch Giá bị chặn bởi "đất ngoài khơi" cách
    bờ 8–12 km. Nay đất = tâm ô TRONG đa giác vn-coast HOẶC cả hai mô hình cùng
    nói z > 0. Hai cổng dưới đây đọc file thật + đường bờ thật.
    ───────────────────────────────────────────────────────────────────────── */
describe("briefing-03: đất theo đường bờ, không theo ngưỡng −2 m", () => {
  let cache: ReturnType<typeof grid> | null = null;
  const g = () => (cache ??= grid());

  type Poly = { rings: number[][][]; x0: number; y0: number; x1: number; y1: number };
  const coastPolys = (): Poly[] => {
    const fc = JSON.parse(
      readFileSync(join(process.cwd(), "public", "data", "vn-coast.v1.json"), "utf8"),
    ) as { features: { geometry: { type: string; coordinates: number[][][] } }[] };
    return fc.features
      .filter((f) => f.geometry.type === "Polygon")
      .map((f) => {
        const rings = f.geometry.coordinates;
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const p of rings[0]) {
          if (p[0] < x0) x0 = p[0];
          if (p[0] > x1) x1 = p[0];
          if (p[1] < y0) y0 = p[1];
          if (p[1] > y1) y1 = p[1];
        }
        return { rings, x0, y0, x1, y1 };
      });
  };
  const inRing = (lon: number, lat: number, r: number[][]) => {
    let inside = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1];
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  const onLand = (polys: Poly[], lon: number, lat: number) => {
    for (const p of polys) {
      if (lon < p.x0 || lon > p.x1 || lat < p.y0 || lat > p.y1) continue;
      let ins = false;
      for (const r of p.rings) if (inRing(lon, lat, r)) ins = !ins;
      if (ins) return true;
    }
    return false;
  };

  it("cổng (ii): bốn điểm briefing-03 (vịnh Rạch Giá) là NƯỚC, không còn là đất", () => {
    for (const [lat, lon] of [[10.02, 104.99], [10.02, 104.96], [9.75, 104.85], [10.02, 104.72]]) {
      const cls = depthClassAt(g(), lat, lon);
      expect(cls, `${lat},${lon} ngoài khung?`).not.toBeNull();
      expect(cls, `${lat},${lon} vẫn là "đất"`).not.toBe(0);
    }
  });

  it("cổng (i): mẫu 0,1° dải ven bờ VN — ô NƯỚC theo vn-coast hiếm khi mang lớp 0", () => {
    /*  Đo thật 2026-09-04 (khung 102–110°Đ, 6.457 điểm nước theo đường bờ):
        bản 2 bit cũ 104 điểm (1,61 %), bản 6 lớp 51 điểm (0,79 %) — phần dư
        là thứ luật mới CỐ Ý giữ:
        đảo thật mà vn-coast giản lược đã cắt (Hạ Long, Côn Đảo, Cù Lao Chàm),
        bờ Campuchia/Thái Lan/Hải Nam không có trong vn-coast (cả hai mô hình
        cùng z > 0), và ô mép bờ làm tròn 450 m. Trần đặt GIỮA hai con số để
        quay lại luật "đất = z > −2 m" là đỏ; con số thật ghi ở báo cáo Đợt 0.
        Cổng ≤ 0,1 % của quyết định thiết kế KHÔNG đạt được với vn-coast hiện
        tại — không phải vì lưới sai, mà vì đường bờ thiếu đảo; xem Assumptions. */
    const polys = coastPolys();
    expect(polys.length).toBeGreaterThan(500);
    let water = 0;
    const land: string[] = [];
    for (let lat = 5.05; lat <= 23.5; lat += 0.1) {
      for (let lon = 102.05; lon <= 110; lon += 0.1) {
        if (onLand(polys, lon, lat)) continue;
        water++;
        if (depthClassAt(g(), lat, lon) === 0) land.push(`${lat.toFixed(2)},${lon.toFixed(2)}`);
      }
    }
    expect(water).toBeGreaterThan(6000);
    expect(land.length / water, land.slice(0, 20).join(" ")).toBeLessThan(0.012);
  });
});
