/*
  BỘ MÃ HOÁ HÌNH RẠN — cổng cho `src/lib/reef-bin.mjs`.

  Đây là chỗ dữ liệu bản đồ đi qua HAI LẦN: một lần lúc đóng gói vào git, một
  lần lúc máy bà con mở ra. Sai ở đây không báo lỗi — nó ra một tấm hải đồ trông
  vẫn bình thường mà rạn nằm lệch chỗ, hoặc thiếu vài cái đá. Nên ca nặng nhất
  là ĐỐI CHIẾU VỚI FILE THẬT: giải bộ nguồn ra, mã hoá lại, đòi trùng khít tới
  từng byte và từng toạ độ.
*/
import { existsSync, readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import {
  REEF_BIN_MAGIC,
  REEF_BIN_SCALE,
  REEF_BIN_VERSION,
  decodeReefShapes,
  encodeReefShapes,
} from "@/lib/reef-bin.mjs";

const BIN = "public/data/reef-shapes-aca.v1.bin";
/** Bản JSON là VẬT LIỆU TRUNG GIAN, cố ý không nằm trong git — có thì soi thêm. */
const JSON_SRC = "public/data/reef-shapes-aca.v1.json";

type Ring = Array<[number, number]>;
interface Feat {
  type: "Feature";
  properties: { kind: string; prov: unknown };
  geometry: { type: "MultiPolygon"; coordinates: Ring[][] };
}
interface Coll {
  type: "FeatureCollection";
  properties: Record<string, unknown>;
  features: Feat[];
}

const prov = (source: string) => ({
  origin: { source, at: "2026-08-29" },
  crossChecks: [{ source: "wcmc", agreed: false, offsetM: null, at: "2026-08-29" }],
});

function feat(kind: string, coords: Ring[][], source = "aca"): Feat {
  return {
    type: "Feature",
    properties: { kind, prov: prov(source) },
    geometry: { type: "MultiPolygon", coordinates: coords },
  };
}

/*  Toạ độ mẫu dựng bằng SỐ NGUYÊN đơn vị lưới rồi mới chia — y như bộ thật, vốn
    đã làm tròn 5 số thập phân lúc sinh. Cộng trực tiếp kiểu `9.8 + 0.002` ra
    9.802000000000001, tức một fixture KHÔNG nằm trên lưới; lúc đó ca đỏ vì
    fixture sai chứ không phải vì bộ mã hoá sai, và người sửa sẽ đi nới ngưỡng.  */
const P = (xu: number, yu: number): [number, number] => [xu / REEF_BIN_SCALE, yu / REEF_BIN_SCALE];
const box = (xu: number, yu: number, wu: number, hu: number): Ring => [
  P(xu, yu),
  P(xu + wu, yu),
  P(xu + wu, yu + hu),
  P(xu, yu + hu),
  P(xu, yu),
];

const sample: Coll = {
  type: "FeatureCollection",
  properties: {
    generatedAt: "2026-08-29",
    bbox: [102, 4, 118, 24],
    simplifyTolDeg: { reef: 0.00004, shoal: 0.00012 },
  },
  features: [
    feat("reef", [[box(11_230_000, 980_000, 100, 200), box(11_230_020, 980_020, 30, 30)]]),
    feat("shoal", [[box(11_240_000, 990_000, 1000, 1000)], [box(11_390_000, 1_050_000, 200, 300)]]),
    feat("reef", [[box(10_512_345, 854_321, 5, 5)]], "wcmc"),
  ],
};

// ═══ 1. ĐI VÀ VỀ ═══════════════════════════════════════════════════════════

describe("mã hoá rồi giải mã ra đúng thứ đã bỏ vào", () => {
  it("hình học, kind, lý lịch nguồn, siêu dữ liệu bộ — trùng khít", () => {
    const enc = encodeReefShapes(sample);
    const back = decodeReefShapes(enc.bytes) as unknown as Coll;
    expect(back.properties).toEqual(sample.properties);
    expect(back.features).toEqual(sample.features);
  });

  it("đếm đúng feature · mảnh · vòng · đỉnh (số đo cổng bất biến dựa vào)", () => {
    const enc = encodeReefShapes(sample);
    expect(enc.features).toBe(3);
    expect(enc.polygons).toBe(4); // 1 + 2 + 1
    expect(enc.rings).toBe(5); // mảnh đầu có thêm một vòng LỖ
    expect(enc.vertices).toBe(25); // 5 vòng × 5 đỉnh (kể đỉnh đóng vòng)
    const back = decodeReefShapes(enc.bytes) as unknown as Coll;
    let verts = 0;
    for (const f of back.features) {
      for (const p of f.geometry.coordinates) for (const r of p) verts += r.length;
    }
    expect(verts, "số đỉnh báo ra phải bằng số đỉnh app thật sự nhận").toBe(enc.vertices);
  });

  it("bộ rỗng vẫn đi về được (không ném, không ra rác)", () => {
    const empty: Coll = { type: "FeatureCollection", properties: { a: 1 }, features: [] };
    const back = decodeReefShapes(encodeReefShapes(empty).bytes) as unknown as Coll;
    expect(back.features).toEqual([]);
    expect(back.properties).toEqual({ a: 1 });
  });

  it("vòng KHÔNG kín ở đầu vào thì trả về đã kín — vòng hở là mất một cạnh", () => {
    const open: Ring = [P(11_000_000, 1_000_000), P(11_000_100, 1_000_000), P(11_000_100, 1_000_100)];
    const enc = encodeReefShapes({ ...sample, features: [feat("reef", [[open]])] });
    const back = decodeReefShapes(enc.bytes) as unknown as Coll;
    const ring = back.features[0].geometry.coordinates[0][0];
    expect(ring).toHaveLength(4);
    expect(ring[3]).toEqual(ring[0]);
    expect(enc.vertices).toBe(4);
  });

  it("lý lịch trùng nhau chỉ lưu MỘT lần, mà vẫn trả về đủ cho từng feature", () => {
    const many: Coll = {
      ...sample,
      features: Array.from({ length: 50 }, (_, i) =>
        feat("reef", [[box(11_000_000 + i * 1000, 1_000_000, 100, 100)]]),
      ),
    };
    const enc = encodeReefShapes(many);
    const back = decodeReefShapes(enc.bytes) as unknown as Coll;
    expect(back.features).toHaveLength(50);
    for (const f of back.features) expect(f.properties.prov).toEqual(prov("aca"));
    // 50 lý lịch giống hệt nhau mà file vẫn nhỏ ⇒ bảng tra đang làm việc
    expect(enc.bytes.length).toBeLessThan(1500);
  });
});

describe("hiệu toạ độ ở mọi cỡ varint", () => {
  it("bước nhảy 1 · 127 · 128 · 16.383 · 16.384 đơn vị, cả hai chiều", () => {
    const steps = [1, 127, 128, 16_383, 16_384, 1_000_000];
    let xu = 11_000_000;
    const ring: Ring = [P(xu, 1_000_000)];
    for (const s of steps) {
      xu += s;
      ring.push(P(xu, 1_000_000));
    }
    for (const s of [...steps].reverse()) {
      xu -= s;
      ring.push(P(xu, 1_050_000));
    }
    ring.push(ring[0]);
    const back = decodeReefShapes(
      encodeReefShapes({ ...sample, features: [feat("reef", [[ring]])] }).bytes,
    ) as unknown as Coll;
    expect(back.features[0].geometry.coordinates[0][0]).toEqual(ring);
  });

  it("kinh độ âm / vĩ độ âm (bộ VN không có, nhưng khuôn file phải chịu được)", () => {
    const ring = box(-17_050_000, -3_325_000, 1000, 1000);
    const back = decodeReefShapes(
      encodeReefShapes({ ...sample, features: [feat("reef", [[ring]])] }).bytes,
    ) as unknown as Coll;
    expect(back.features[0].geometry.coordinates[0][0]).toEqual(ring);
  });
});

describe("lượng tử hoá — nói thật về sai số", () => {
  it("toạ độ đã ở lưới 1e-5 ⇒ sai số thêm ĐÚNG BẰNG 0", () => {
    expect(encodeReefShapes(sample).maxQuantErrDeg).toBe(0);
  });

  it("toạ độ mịn hơn lưới ⇒ báo sai số, không giấu", () => {
    const fine: Ring = [
      [110.1234567, 10.1234567],
      [110.1234667, 10.1234567],
      [110.1234667, 10.1234667],
      [110.1234567, 10.1234567],
    ];
    const enc = encodeReefShapes({ ...sample, features: [feat("reef", [[fine]])] });
    expect(enc.maxQuantErrDeg).toBeGreaterThan(0);
    // …nhưng không quá NỬA bước lưới — đó là định nghĩa của làm tròn đúng
    expect(enc.maxQuantErrDeg).toBeLessThanOrEqual(0.5 / REEF_BIN_SCALE + 1e-12);
  });

  it("scale lạ bị chặn ngay, không âm thầm ghi file hỏng", () => {
    expect(() => encodeReefShapes(sample, { scale: 0 })).toThrow();
    expect(() => encodeReefShapes(sample, { scale: -1 })).toThrow();
    expect(() => encodeReefShapes(sample, { scale: 1.5 })).toThrow();
  });
});

describe("file lạ / file hỏng thì NÉM, không trả bộ rỗng", () => {
  it("sai bốn byte nhận dạng", () => {
    const b = encodeReefShapes(sample).bytes.slice();
    b[0] = 0x58;
    expect(() => decodeReefShapes(b)).toThrow(/nhận dạng/);
  });

  it("phiên bản lạ", () => {
    const b = encodeReefShapes(sample).bytes.slice();
    b[4] = 99;
    expect(() => decodeReefShapes(b)).toThrow(/phiên bản/);
  });

  it("file cụt giữa chừng", () => {
    const b = encodeReefShapes(sample).bytes;
    expect(() => decodeReefShapes(b.slice(0, b.length - 4))).toThrow();
    expect(() => decodeReefShapes(new Uint8Array(3))).toThrow();
  });

  /*  Vì sao ném chứ không trả bộ rỗng: lớp này là lớp CẢNH BÁO VẬT CẢN. Một bản
      đồ "tải xong mà trống rạn" nguy hơn hẳn một màn báo lỗi — bà con tin là
      chỗ đó không có gì.  */
  it("CA ĐỐI CHỨNG: bộ giải KHÔNG bao giờ trả về danh sách rỗng khi gặp rác", () => {
    for (const bad of [new Uint8Array(0), new Uint8Array(64), new Uint8Array([1, 2, 3, 4, 5, 6])]) {
      expect(() => decodeReefShapes(bad)).toThrow();
    }
  });
});

// ═══ 2. ĐỐI CHIẾU VỚI BỘ DỮ LIỆU THẬT ══════════════════════════════════════

describe("bộ nguồn thật trên đĩa", () => {
  let real: Coll & { scale: number };

  beforeAll(() => {
    expect(existsSync(BIN), `${BIN} phải nằm trong git`).toBe(true);
    real = decodeReefShapes(readFileSync(BIN)) as unknown as Coll & { scale: number };
  });

  it("giải mã ra bộ đầy đủ, lưới đúng như khai", () => {
    expect(real.scale).toBe(REEF_BIN_SCALE);
    expect(real.features.length).toBeGreaterThan(1000);
    expect(readFileSync(BIN).toString("latin1", 0, 4)).toBe(REEF_BIN_MAGIC);
    expect(readFileSync(BIN)[4]).toBe(REEF_BIN_VERSION);
  });

  it("mọi đối tượng đúng hai thuộc tính, đúng kind, có lý lịch nguồn", () => {
    let bad = 0;
    for (const f of real.features) {
      const keys = Object.keys(f.properties);
      const p = f.properties.prov as { origin?: { source?: string } } | undefined;
      if (keys.length !== 2 || !["reef", "shoal"].includes(f.properties.kind) || !p?.origin) {
        bad++;
      }
    }
    expect(bad, "có đối tượng thiếu lý lịch hoặc mang trường lạ").toBe(0);
  });

  it("KHÔNG đối tượng nào ghi nguồn OSM (bộ này phải sạch ODbL)", () => {
    const osm = real.features.filter(
      (f) => (f.properties.prov as { origin: { source: string } }).origin.source === "osm",
    );
    expect(osm).toHaveLength(0);
  });

  it("KHÔNG ký tự Hán/CJK trong phần chữ của file", () => {
    const text = JSON.stringify({
      properties: real.properties,
      provs: real.features.map((f) => f.properties.prov),
      kinds: [...new Set(real.features.map((f) => f.properties.kind))],
    });
    expect(text).not.toMatch(/[⺀-⿿　-〿㐀-䶿一-鿿豈-﫿]/);
  });

  it("mã hoá LẠI ra đúng từng byte — đi và về không rơi rụng gì", () => {
    const onDisk = readFileSync(BIN);
    const again = encodeReefShapes(real as unknown as Coll, { scale: real.scale });
    expect(again.maxQuantErrDeg).toBe(0);
    expect(Buffer.from(again.bytes).equals(onDisk)).toBe(true);
  }, 60_000);

  it("gọn hơn hẳn bản JSON mà vẫn dưới trần 20 MB/file của hook", () => {
    const size = readFileSync(BIN).length;
    expect(size).toBeLessThan(20 * 1024 * 1024);
    let verts = 0;
    for (const f of real.features) {
      for (const p of f.geometry.coordinates) for (const r of p) verts += r.length;
    }
    // Bản JSON tốn ~19,8 byte mỗi đỉnh; khuôn nhị phân phải dưới 6 — quá số đó
    // là mã hoá đã hỏng ở đâu đó, dù file vẫn giải ra được.
    expect(size / verts).toBeLessThan(6);
  });

  it.skipIf(!existsSync(JSON_SRC))(
    "trùng khít bản JSON gốc tới từng toạ độ (nếu vật liệu trung gian còn trên máy)",
    () => {
      const src = JSON.parse(readFileSync(JSON_SRC, "utf8")) as Coll;
      expect(real.features.length).toBe(src.features.length);
      let diff = 0;
      for (let i = 0; i < src.features.length; i++) {
        const a = src.features[i].geometry.coordinates;
        const b = real.features[i].geometry.coordinates;
        if (a.length !== b.length) {
          diff++;
          continue;
        }
        for (let p = 0; p < a.length; p++) {
          if (a[p].length !== b[p].length) {
            diff++;
            continue;
          }
          for (let g = 0; g < a[p].length; g++) {
            const ra = a[p][g];
            const rb = b[p][g];
            if (ra.length !== rb.length) {
              diff++;
              continue;
            }
            for (let k = 0; k < ra.length; k++) {
              if (ra[k][0] !== rb[k][0] || ra[k][1] !== rb[k][1]) diff++;
            }
          }
        }
      }
      expect(diff, "bản nhị phân lệch bản JSON — đây là phép nén CÓ MẤT MÁT").toBe(0);
    },
    60_000,
  );
});
