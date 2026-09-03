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

/*  ─────────────────────────────────────────────────────────────────────────
    SỰ CỐ AN TOÀN 2026-08-29 — vì sao có nguyên khối test dưới đây.

    Bản lưới trước chỉ dựng từ ETOPO 15". Lấy tâm 25 hình rạn thật trong
    reef-shapes.v1.json rồi hỏi hai nguồn thì 5 tâm bị xếp lớp 3 "đủ sâu"
    trong khi GEBCO nói nước sâu 1–2 m. Lớp 3 nghĩa là route-plan.ts VẠCH
    TUYẾN CHẠY THẲNG QUA — tàu mớn 1,5–3 m đi vào là mắc cạn.

    Đây không phải lỗi code sửa một dòng là xong: ô ETOPO rộng ~450 m, mà một
    nửa số hình rạn trong file còn NHỎ HƠN MỘT Ô. Một mô hình 450 m về nguyên
    tắc không phân giải nổi cái rạn. Bản vá vì thế là RÀNG BUỘC dữ liệu (mặt
    nạ rạn + nguồn GEBCO thứ hai), và ràng buộc dữ liệu thì chỉ có test đọc
    ĐÚNG FILE THẬT mới giữ được — không có kiểu test nào khác bắt được ngày
    ai đó chạy lại script mà quên bật mặt nạ.

    Hai vế phải cùng đúng, thiếu vế nào cũng là hỏng:
      · KHÔNG được còn chỗ rạn nào mang lớp 3 (vá thiếu → mắc cạn)
      · biển sâu thật vẫn phải là lớp 3 (vá quá tay → báo động giả khắp nơi,
        bà con tắt cảnh báo, mất luôn tác dụng)
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
      if (cls === 3) bad.push(`${f.properties.kind} ${lat.toFixed(4)},${lon.toFixed(4)}`);
    }
    expect(checked).toBeGreaterThan(2000); // đã thật sự quét, không rơi hết vào null
    expect(bad).toEqual([]);
  });

  it("năm toạ độ gây ra sự cố không còn là 'đủ sâu'", () => {
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
      expect(cls, `${lat},${lon} vẫn đang là "đủ sâu"`).toBeLessThan(3);
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
            if (cls === 3) bad.push(`${f.properties.kind} ${lat.toFixed(4)},${lon.toFixed(4)}`);
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

  it("các điểm khơi xa mọi rạn vẫn là lớp 3", () => {
    for (const [lat, lon, ten] of [
      [13, 114, "giữa Biển Đông"],
      [13, 110.5, "khơi Nam Trung Bộ"],
      [15, 112.5, "giữa Hoàng Sa – Trường Sa"],
      [17, 110, "khơi Quảng Trị"],
      [11, 111.5, "khơi Bình Thuận"],
      [7, 109, "Nam Biển Đông"],
    ] as [number, number, string][]) {
      expect(depthClassAt(g(), lat, lon), ten).toBe(3);
    }
  });

  it("cả ô vuông 1°×1° quanh 13°B/114°Đ đều là lớp 3, không lấm tấm báo động giả", () => {
    let n = 0, deep = 0;
    for (let lat = 12.5; lat <= 13.5; lat += DEPTH_META.step * 4) {
      for (let lon = 113.5; lon <= 114.5; lon += DEPTH_META.step * 4) {
        n++;
        if (depthClassAt(g(), lat, lon) === 3) deep++;
      }
    }
    expect(n).toBeGreaterThan(3000);
    expect(deep).toBe(n);
  });

  it("lớp 'rất cạn' vẫn là thiểu số — trần 2% khung", () => {
    /*  Mặt nạ rạn ép ô về lớp 1, mà lớp 1 là KHÔNG ĐI QUA ĐƯỢC. Nới tay quá
        thì tuyến nào cũng vòng vèo hoặc "không tìm được đường". Đo thật: sau
        bản vá là ~0,9%. Trần 2% để ngày ai đó nới bán kính lên vài chục km
        thì test đỏ chứ không phải bà con phát hiện hộ. */
    const total = DEPTH_META.nLat * DEPTH_META.nLon;
    let veryShallow = 0;
    for (let k = 0; k < total; k++) {
      if (((g().data[k >> 2] >> ((k & 3) * 2)) & 3) === 1) veryShallow++;
    }
    expect(veryShallow / total).toBeGreaterThan(0.001); // mặt nạ có chạy thật
    expect(veryShallow / total).toBeLessThan(0.02);
  });
});
