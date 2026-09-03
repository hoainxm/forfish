/*  CHỈ MỤC KHÔNG GIAN — kiểm trên DỮ LIỆU THẬT trong public/data, không dựng
    dữ liệu giả.

    Vì sao không giả: cái bẫy của một chỉ mục là nó luôn trả về MỘT CÁI GÌ ĐÓ.
    Sai ô, sai kẹp biên, sai công thức đổi độ ra km — kết quả vẫn là một danh
    sách trông hợp lý, chỉ là thiếu mất hòn đá ngầm gần nhất. Nên mọi ca đúng-
    sai ở đây đều đối chiếu với QUÉT CẠN (duyệt hết mọi phần tử): chỉ mục phải
    ra ĐÚNG BẰNG kết quả quét cạn, không được xê xích một phần tử nào.

    Cuối file có phần ĐO THỜI GIAN. Nó không `expect` con số tuyệt đối (máy CI
    nhanh chậm khác nhau, chốt ngưỡng cứng là tự đẻ ra test đỏ ngẫu nhiên) —
    nó in số ra để đưa vào docs/research/phuong-phap-ban-do.md, và chỉ chốt một
    bất biến thật: chỉ mục phải NHANH HƠN HẲN quét cạn. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildIndex,
  queryRadius,
  queryNearest,
  queryCorridor,
  distToSegment,
  pathPoints,
} from "../spatial-index";
import { decodeSeamarks, type Seamark } from "../seamarks";
import { haversineKm, type LatLon } from "../route-plan";

const DATA = join(process.cwd(), "public", "data");
const readJson = (f: string) => JSON.parse(readFileSync(join(DATA, f), "utf8"));

/** 5.851 báo hiệu hàng hải thật (phao, đèn biển, tiêu, vùng neo). */
const seamarks: Seamark[] = decodeSeamarks(readJson("seamarks.v1.json"));

/** Điểm hiểm hoạ thật: đá ngầm, chướng ngại, xác tàu. */
type Hazard = { lat: number; lon: number; kind: string };
const hazards: Hazard[] = (
  readJson("reef-shapes.v1.json").features as {
    properties?: { kind?: string };
    geometry?: { type?: string; coordinates?: number[] };
  }[]
)
  .filter((f) => f.geometry?.type === "Point")
  .map((f) => ({
    lon: (f.geometry!.coordinates as number[])[0],
    lat: (f.geometry!.coordinates as number[])[1],
    kind: f.properties?.kind ?? "?",
  }));

const posSeamark = (m: Seamark): LatLon => ({ lat: m.lat, lon: m.lon });
const posHazard = (h: Hazard): LatLon => ({ lat: h.lat, lon: h.lon });

const smIndex = buildIndex(seamarks, posSeamark);
const hzIndex = buildIndex(hazards, posHazard);

/** Vài chỗ thật trên biển VN để hỏi. */
const SPOTS: LatLon[] = [
  { lat: 12.24, lon: 109.35 }, // ngoài khơi Nha Trang
  { lat: 20.75, lon: 106.85 }, // cửa Hải Phòng
  { lat: 16.05, lon: 108.35 }, // vịnh Đà Nẵng
  { lat: 9.7, lon: 114.3 }, // Trường Sa
  { lat: 10.3, lon: 107.1 }, // Vũng Tàu
];

const NM_KM = 1.852;

/** Quét cạn — sự thật để đối chiếu. */
function bruteRadius<T>(
  items: readonly T[],
  pos: (t: T) => LatLon,
  c: LatLon,
  km: number,
): T[] {
  return items.filter((it) => haversineKm(c, pos(it)) <= km);
}

describe("dựng chỉ mục trên dữ liệu thật", () => {
  it("nhận đủ mọi báo hiệu và mọi điểm hiểm hoạ (không rơi cái nào)", () => {
    expect(seamarks.length).toBeGreaterThan(1000);
    // 87 điểm đá ngầm / chướng ngại / xác tàu trong bản dữ liệu hiện tại —
    // ngưỡng đặt thấp hơn để lần sinh lại (OSM mọc thêm/bớt) không đỏ oan,
    // nhưng vẫn bắt được ca file rỗng / đọc trượt.
    expect(hazards.length).toBeGreaterThan(50);
    expect(smIndex.count).toBe(seamarks.length);
    expect(hzIndex.count).toBe(hazards.length);
  });

  it("mọi phần tử nằm đúng một ô, tổng số ô khớp CSR", () => {
    const total = smIndex.start[smIndex.start.length - 1];
    expect(total).toBe(smIndex.count);
    expect(smIndex.order.length).toBe(smIndex.count);
    // mỗi chỉ số xuất hiện đúng một lần
    const seen = new Set(Array.from(smIndex.order));
    expect(seen.size).toBe(smIndex.count);
  });

  it("cạnh ô tự chọn nằm trong khoảng dùng được, không suy biến", () => {
    expect(smIndex.cellDeg).toBeGreaterThan(0.001);
    expect(smIndex.cellDeg).toBeLessThan(5);
    expect(smIndex.nLat * smIndex.nLon).toBeLessThan(1 << 20);
  });

  it("toạ độ hỏng bị bỏ, KHÔNG làm hỏng cả lớp", () => {
    const dirty = [
      { lat: 12, lon: 109 },
      { lat: Number.NaN, lon: 109 },
      { lat: 12, lon: Number.POSITIVE_INFINITY },
      { lat: 999, lon: 109 },
      { lat: 12.01, lon: 109.01 },
    ];
    const ix = buildIndex(dirty, (p) => p);
    expect(ix.count).toBe(2);
    expect(queryRadius(ix, { lat: 12, lon: 109 }, 50)).toHaveLength(2);
  });

  it("danh sách rỗng vẫn dựng được và mọi truy vấn trả rỗng", () => {
    const ix = buildIndex([] as LatLon[], (p) => p);
    expect(ix.count).toBe(0);
    expect(queryRadius(ix, SPOTS[0], 10)).toEqual([]);
    expect(queryNearest(ix, SPOTS[0])).toEqual([]);
    expect(queryCorridor(ix, SPOTS, 10)).toEqual([]);
  });
});

describe("quanh tôi có gì — queryRadius", () => {
  it("bằng ĐÚNG quét cạn ở mọi chỗ, mọi bán kính", () => {
    for (const spot of SPOTS) {
      for (const nm of [1, 5, 20, 60]) {
        const km = nm * NM_KM;
        const got = queryRadius(smIndex, spot, km).map((h) => h.item);
        const want = bruteRadius(seamarks, posSeamark, spot, km);
        expect(new Set(got).size).toBe(got.length); // không trùng
        expect(got.length).toBe(want.length);
        expect(new Set(got)).toEqual(new Set(want));
      }
    }
  });

  it("sắp gần trước, và khoảng cách trả về là khoảng cách thật", () => {
    const hits = queryRadius(smIndex, SPOTS[0], 40 * NM_KM);
    expect(hits.length).toBeGreaterThan(0);
    for (let i = 1; i < hits.length; i++)
      expect(hits[i].km).toBeGreaterThanOrEqual(hits[i - 1].km);
    for (const h of hits)
      expect(h.km).toBeCloseTo(haversineKm(SPOTS[0], posSeamark(h.item)), 6);
  });

  it("lọc theo loại chạy trước khi tính khoảng cách, kết quả vẫn khớp quét cạn", () => {
    const c = SPOTS[1];
    const km = 30 * NM_KM;
    const only = (h: Hazard) => h.kind === "wreck";
    const got = queryCorridorSafe(hzIndex, c, km, only);
    const want = bruteRadius(hazards, posHazard, c, km).filter(only);
    expect(new Set(got)).toEqual(new Set(want));
  });

  it("bán kính vô lý trả rỗng, KHÔNG ném và không tự đổi thành số khác", () => {
    expect(queryRadius(smIndex, SPOTS[0], 0)).toEqual([]);
    expect(queryRadius(smIndex, SPOTS[0], -5)).toEqual([]);
    expect(queryRadius(smIndex, SPOTS[0], Number.NaN)).toEqual([]);
    expect(
      queryRadius(smIndex, { lat: Number.NaN, lon: 109 }, 10),
    ).toEqual([]);
  });

  /*  CA HỒI QUY — ĐỪNG GỠ. Đây là ca đã bắt được lỗi thật lúc dựng file này:
      hộp lọc thô đổi km ra độ bằng 111,32 (ellipsoid) trong khi `haversineKm`
      đo trên quả cầu R = 6371 (111,195 km/độ). Hộp hẹp hơn hình tròn ~0,1% ⇒
      một cái phao nằm sát mép BIẾN MẤT khỏi câu trả lời, im lặng: 936 thay vì
      937 trên 2.000 lượt hỏi. Không ca nào trong năm chỗ SPOTS ở trên bắt được
      — phải quét đủ rộng mới đụng đúng cái nằm sát mép.
      Nên ca này quét 2.000 tâm rải đều khắp vùng biển VN (mốc cố định, không
      ngẫu nhiên, để lần chạy nào cũng như nhau) và đòi chỉ mục khớp TỪNG SỐ với
      quét cạn. Nó là lưới an toàn cho MỌI thay đổi sau này về hình học. */
  it("khớp từng số với quét cạn trên 2.000 tâm rải khắp vùng biển VN", () => {
    const R = 5 * NM_KM;
    let viaIndex = 0;
    let viaBrute = 0;
    for (let i = 0; i < 2000; i++) {
      const t = (i * 2654435761) % 100000;
      const c = { lat: 6 + (t % 1000) / 60, lon: 103 + ((t / 1000) | 0) / 8 };
      viaIndex += queryRadius(smIndex, c, R).length;
      viaBrute += bruteRadius(seamarks, posSeamark, c, R).length;
    }
    expect(viaIndex).toBe(viaBrute);
    expect(viaBrute).toBeGreaterThan(0); // quét cạn phải thật sự tìm thấy gì đó
  });

  it("điểm nằm SÁT MÉP bán kính vẫn được đếm (lệch thuần theo vĩ độ)", () => {
    // 1° vĩ trên quả cầu của haversineKm = 111,1949 km
    const kmPerDeg = (Math.PI / 180) * 6371;
    const c = { lat: 19.7, lon: 109.1 };
    const R = 9.26; // 5 hải lý
    const inside = { lat: c.lat + (R * 0.999) / kmPerDeg, lon: c.lon };
    const outside = { lat: c.lat + (R * 1.001) / kmPerDeg, lon: c.lon };
    const ix = buildIndex([inside, outside], (p) => p);
    const hits = queryRadius(ix, c, R);
    expect(hits).toHaveLength(1);
    expect(hits[0].item).toBe(inside);
  });

  it("chỗ giữa khơi không có báo hiệu nào thì nói thẳng là không có", () => {
    // giữa Biển Đông, cách mọi luồng lạch rất xa
    const empty = queryRadius(smIndex, { lat: 13.5, lon: 112.5 }, 5 * NM_KM);
    expect(empty).toEqual([]);
  });
});

/** queryRadius có lọc — gói lại cho gọn ở ca test trên. */
function queryCorridorSafe(
  ix: ReturnType<typeof buildIndex<Hazard>>,
  c: LatLon,
  km: number,
  where: (h: Hazard) => boolean,
): Hazard[] {
  return queryRadius(ix, c, km, where).map((h) => h.item);
}

describe("gần nhất là cái nào — queryNearest", () => {
  it("trả đúng cái quét cạn cho là gần nhất, ở mọi chỗ", () => {
    for (const spot of SPOTS) {
      const got = queryNearest(smIndex, spot, 1);
      let bestKm = Infinity;
      let best: Seamark | null = null;
      for (const m of seamarks) {
        const km = haversineKm(spot, posSeamark(m));
        if (km < bestKm) {
          bestKm = km;
          best = m;
        }
      }
      expect(got).toHaveLength(1);
      expect(got[0].km).toBeCloseTo(bestKm, 9);
      expect(got[0].item).toBe(best);
    }
  });

  it("lấy k cái gần nhất, đúng thứ tự và đúng tập", () => {
    const k = 5;
    const spot = SPOTS[2];
    const got = queryNearest(smIndex, spot, k);
    const want = [...seamarks]
      .map((m) => ({ m, km: haversineKm(spot, posSeamark(m)) }))
      .sort((a, b) => a.km - b.km)
      .slice(0, k);
    expect(got).toHaveLength(k);
    got.forEach((h, i) => expect(h.km).toBeCloseTo(want[i].km, 9));
  });

  it("trần maxKm chặn được: không có gì trong tầm thì trả rỗng, không quét cả lưới", () => {
    const far = queryNearest(smIndex, { lat: 13.5, lon: 112.5 }, 1, 5);
    expect(far).toEqual([]);
  });

  it("tâm nằm NGOÀI khung dữ liệu vẫn tìm được cái gần nhất ở mép", () => {
    const outside = { lat: 3.0, lon: 100.0 };
    const got = queryNearest(smIndex, outside, 1);
    expect(got).toHaveLength(1);
    let bestKm = Infinity;
    for (const m of seamarks)
      bestKm = Math.min(bestKm, haversineKm(outside, posSeamark(m)));
    expect(got[0].km).toBeCloseTo(bestKm, 9);
  });

  it("k ≤ 0 trả rỗng", () => {
    expect(queryNearest(smIndex, SPOTS[0], 0)).toEqual([]);
    expect(queryNearest(smIndex, SPOTS[0], -3)).toEqual([]);
  });
});

describe("đường tôi đi có sát gì không — queryCorridor", () => {
  /** Tuyến thật: Nha Trang → ngư trường ngoài khơi → Phan Thiết. */
  const route: LatLon[] = [
    { lat: 12.24, lon: 109.2 },
    { lat: 11.6, lon: 109.6 },
    { lat: 10.9, lon: 108.6 },
    { lat: 10.55, lon: 108.1 },
  ];

  it("bằng ĐÚNG quét cạn trên toàn tuyến", () => {
    const widthKm = 3 * NM_KM;
    const got = queryCorridor(smIndex, route, widthKm).map((h) => h.item);
    const want = seamarks.filter((m) => {
      let best = Infinity;
      for (let i = 0; i + 1 < route.length; i++)
        best = Math.min(best, distToSegment(posSeamark(m), route[i], route[i + 1]).km);
      return best <= widthKm;
    });
    expect(new Set(got)).toEqual(new Set(want));
  });

  it("mỗi đối tượng chỉ hiện MỘT lần dù tuyến quay lại gần nó", () => {
    const zigzag: LatLon[] = [
      { lat: 12.2, lon: 109.2 },
      { lat: 12.4, lon: 109.4 },
      { lat: 12.2, lon: 109.2 },
      { lat: 12.4, lon: 109.4 },
    ];
    const got = queryCorridor(smIndex, zigzag, 5 * NM_KM);
    expect(new Set(got.map((h) => h.item)).size).toBe(got.length);
  });

  it("sắp theo thứ tự GẶP (alongKm tăng), không phải theo gần", () => {
    const got = queryCorridor(smIndex, route, 5 * NM_KM);
    expect(got.length).toBeGreaterThan(0);
    for (let i = 1; i < got.length; i++)
      expect(got[i].alongKm).toBeGreaterThanOrEqual(got[i - 1].alongKm);
    // alongKm không vượt quá chiều dài tuyến
    let total = 0;
    for (let i = 0; i + 1 < route.length; i++)
      total += haversineKm(route[i], route[i + 1]);
    for (const h of got) expect(h.alongKm).toBeLessThanOrEqual(total + 1e-6);
  });

  it("tuyến một điểm = hỏi quanh điểm đó", () => {
    const one = queryCorridor(smIndex, [SPOTS[0]], 5 * NM_KM);
    const around = queryRadius(smIndex, SPOTS[0], 5 * NM_KM);
    expect(new Set(one.map((h) => h.item))).toEqual(
      new Set(around.map((h) => h.item)),
    );
  });

  it("tuyến rỗng / bề rộng vô lý trả rỗng, không ném", () => {
    expect(queryCorridor(smIndex, [], 5)).toEqual([]);
    expect(queryCorridor(smIndex, route, 0)).toEqual([]);
    expect(queryCorridor(smIndex, route, Number.NaN)).toEqual([]);
  });
});

describe("hình học phụ trợ", () => {
  it("distToSegment: điểm trên đoạn cho khoảng cách 0", () => {
    const a = { lat: 12, lon: 109 };
    const b = { lat: 12.5, lon: 109.5 };
    const mid = { lat: 12.25, lon: 109.25 };
    const d = distToSegment(mid, a, b);
    expect(d.km).toBeLessThan(0.01);
    expect(d.alongKm).toBeGreaterThan(0);
  });

  it("distToSegment: ngoài hai mút thì kẹp về mút, không ngoại suy", () => {
    const a = { lat: 12, lon: 109 };
    const b = { lat: 12.5, lon: 109 };
    const before = distToSegment({ lat: 11, lon: 109 }, a, b);
    expect(before.alongKm).toBe(0);
    expect(before.km).toBeCloseTo(haversineKm({ lat: 11, lon: 109 }, a), 0);
    const after = distToSegment({ lat: 14, lon: 109 }, a, b);
    expect(after.alongKm).toBeCloseTo(haversineKm(a, b), 0);
  });

  it("distToSegment: đoạn suy biến (hai mút trùng) vẫn ra khoảng cách tới điểm", () => {
    const a = { lat: 12, lon: 109 };
    const d = distToSegment({ lat: 12.1, lon: 109 }, a, a);
    expect(d.alongKm).toBe(0);
    expect(d.km).toBeCloseTo(haversineKm({ lat: 12.1, lon: 109 }, a), 0);
  });

  it("pathPoints: không có khe nào rộng hơn bước lấy mẫu", () => {
    const route: LatLon[] = [
      { lat: 12.24, lon: 109.2 },
      { lat: 11.6, lon: 109.6 },
      { lat: 10.9, lon: 108.6 },
    ];
    const step = 0.4;
    const pts = pathPoints(route, step);
    expect(pts.length).toBeGreaterThan(100);
    // biên nới 1‰: `pathPoints` chia đều theo NỘI SUY TUYẾN TÍNH trên lon/lat,
    // còn thước đo là haversine — hai thứ lệch nhau ở số hạng bậc cao. Sai lệch
    // đó không đáng kể so với ô lưới độ sâu 450 m, nhưng so bằng `<=` tuyệt đối
    // thì đỏ vì con số thứ mười sáu sau dấu phẩy.
    for (let i = 1; i < pts.length; i++)
      expect(haversineKm(pts[i - 1], pts[i])).toBeLessThanOrEqual(step * 1.001);
    // giữ đúng hai đầu
    expect(pts[0]).toEqual(route[0]);
    expect(pts[pts.length - 1].lat).toBeCloseTo(route[2].lat, 9);
  });

  it("pathPoints: đầu vào vô lý trả rỗng", () => {
    expect(pathPoints([], 1)).toEqual([]);
    expect(pathPoints([{ lat: 12, lon: 109 }], 0)).toEqual([]);
    expect(pathPoints([{ lat: 12, lon: 109 }], Number.NaN)).toEqual([]);
  });
});

/* ── ĐO THỜI GIAN THẬT ────────────────────────────────────────────────────
   In số ra để đưa vào tài liệu phương pháp. Bất biến duy nhất được chốt:
   chỉ mục phải nhanh hơn HẲN quét cạn — nếu một ngày nó không còn nhanh hơn
   thì cả file này mất lý do tồn tại, và test phải nói ra điều đó. */
describe("thời gian truy vấn (đo trên dữ liệu thật)", () => {
  const REPS = 2000;
  const centers = Array.from({ length: REPS }, (_, i) => {
    // rải đều trong khung biển VN, ổn định giữa các lần chạy (không random)
    const t = (i * 2654435761) % 100000;
    return { lat: 6 + (t % 1000) / 60, lon: 103 + ((t / 1000) | 0) / 8 };
  });

  it("nhanh hơn hẳn quét cạn, và in ra con số", () => {
    const t0 = performance.now();
    const ix = buildIndex(seamarks, posSeamark);
    const buildMs = performance.now() - t0;

    const radiusKm = 5 * NM_KM;

    const t1 = performance.now();
    let n1 = 0;
    for (const c of centers) n1 += queryRadius(ix, c, radiusKm).length;
    const idxMs = performance.now() - t1;

    const t2 = performance.now();
    let n2 = 0;
    for (const c of centers) n2 += bruteRadius(seamarks, posSeamark, c, radiusKm).length;
    const bruteMs = performance.now() - t2;

    const t3 = performance.now();
    for (const c of centers) queryNearest(ix, c, 1, 200);
    const nearMs = performance.now() - t3;

    const route: LatLon[] = [
      { lat: 12.24, lon: 109.2 },
      { lat: 11.6, lon: 109.6 },
      { lat: 10.9, lon: 108.6 },
      { lat: 10.55, lon: 108.1 },
    ];
    const t4 = performance.now();
    for (let i = 0; i < 200; i++) queryCorridor(ix, route, 3 * NM_KM);
    const corrMs = performance.now() - t4;

    expect(n1).toBe(n2); // nhanh hơn nhưng vẫn ra đúng bằng nhau

    /*  In bằng console.log CÓ CHỦ Ý (đây là chỗ duy nhất trong bộ test làm vậy):
        con số đo được phải đi vào docs/research/phuong-phap-ban-do.md, mà tài
        liệu bán licence thì không được chép số từ trí nhớ. Xem bằng:
        `npx vitest run src/lib/__tests__/spatial-index.test.ts --reporter=verbose` */
    console.log(
      [
        "",
        `  chỉ mục không gian — ${seamarks.length} báo hiệu, ${ix.nLat}×${ix.nLon} ô (cạnh ${ix.cellDeg.toFixed(4)}°)`,
        `  dựng chỉ mục            : ${buildMs.toFixed(1)} ms (một lần cho cả phiên)`,
        `  quanh tôi 5 hải lý      : ${((idxMs / REPS) * 1000).toFixed(1)} µs/lượt  (quét cạn ${((bruteMs / REPS) * 1000).toFixed(1)} µs — nhanh hơn ${(bruteMs / idxMs).toFixed(0)}×)`,
        `  báo hiệu gần nhất       : ${((nearMs / REPS) * 1000).toFixed(1)} µs/lượt`,
        `  soi tuyến 4 điểm ±3 hl  : ${((corrMs / 200) * 1000).toFixed(1)} µs/lượt`,
        "",
      ].join("\n"),
    );

    expect(idxMs).toBeLessThan(bruteMs);
  });
});
