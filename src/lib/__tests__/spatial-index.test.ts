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
  anyWithinSegment,
  maskWithinSegment,
  pointInRing,
  buildSegmentIndex,
  nearestSegment,
  segmentsWithinCorridor,
  segToSegKm,
  type Segment,
} from "../spatial-index";
import { pointInRing as pointInRingStorm } from "../route-storm";
import { decodeSeamarks, type Seamark } from "../seamarks";
import { haversineKm, type LatLon } from "../route-plan";
import { buildHazardList, type Hazard as RouteHazard } from "../hazards";
import { decodeXacTau } from "../xac-tau";

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

/* ── CHẶNG CÓ CHẠM HIỂM HOẠ KHÔNG — anyWithinSegment (2026-09-04) ─────────
   Đối chiếu với quét cạn bằng chính `distToSegment` trên 1.000 chặng ngẫu
   nhiên (mốc cố định) qua danh sách hiểm hoạ THẬT (xác tàu + giàn khoan + phao
   hiểm hoạ + lồng bè). Sai một chặng là Dijkstra cho tàu đi xuyên xác tàu. */
const laneFeatures = readJson("vn-sea-lanes.v1.json").features as GeoJSON.Feature[];
const realHazards: RouteHazard[] = buildHazardList(
  { xacTau: decodeXacTau(readJson("xac-tau.v1.json")), laneFeatures, seamarks },
  null,
  2026,
).hazards;
const posRH = (h: RouteHazard): LatLon => ({ lat: h.lat, lon: h.lon });
const rOf = (h: RouteHazard) => h.rKm;
const rhIndex = buildIndex(realHazards, posRH);

/** Sinh số giả ổn định giữa các lần chạy (LCG) — không dùng Math.random. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Chặng ngẫu nhiên: MỘT NỬA rải quanh hiểm hoạ thật (để có ca "chạm"), nửa còn lại rải khắp khung. */
function randomSegments(n: number, seed: number, maxLenKm: number): [LatLon, LatLon][] {
  const rnd = lcg(seed);
  const out: [LatLon, LatLon][] = [];
  for (let i = 0; i < n; i++) {
    let a: LatLon;
    if (i % 2 === 0 && realHazards.length) {
      const h = realHazards[Math.floor(rnd() * realHazards.length)];
      a = { lat: h.lat + (rnd() - 0.5) * 0.06, lon: h.lon + (rnd() - 0.5) * 0.06 };
    } else {
      a = { lat: 5 + rnd() * 18, lon: 103 + rnd() * 14 };
    }
    const ang = rnd() * Math.PI * 2;
    const len = (0.5 + rnd() * (maxLenKm - 0.5)) / 111.19;
    out.push([a, { lat: a.lat + Math.sin(ang) * len, lon: a.lon + Math.cos(ang) * len }]);
  }
  return out;
}

function bruteAnyWithin(a: LatLon, b: LatLon): boolean {
  for (const h of realHazards) if (distToSegment(posRH(h), a, b).km <= h.rKm) return true;
  return false;
}

describe("anyWithinSegment — chặng có dính vòng chặn nào không", () => {
  it("bằng ĐÚNG quét cạn distToSegment trên 1.000 chặng, và có cả ca chạm lẫn ca không", () => {
    expect(realHazards.length).toBeGreaterThan(100);
    const segs = randomSegments(1000, 20260904, 9);
    let cham = 0;
    for (const [a, b] of segs) {
      const want = bruteAnyWithin(a, b);
      expect(anyWithinSegment(rhIndex, a, b, rOf)).toBe(want);
      if (want) cham++;
    }
    expect(cham).toBeGreaterThan(20);
    expect(cham).toBeLessThan(980);
  });

  it("chặng đi xuyên tâm xác tàu → chạm; chặng lệch ngoài bán kính một chút → không", () => {
    const h = realHazards.find((x) => x.loai === "gian-khoan")!;
    const kmPerDeg = (Math.PI / 180) * 6371;
    const dx = (h.rKm * 3) / kmPerDeg;
    expect(anyWithinSegment(rhIndex, { lat: h.lat - dx, lon: h.lon }, { lat: h.lat + dx, lon: h.lon }, rOf)).toBe(true);
    // tịnh tiến chặng sang ngang r × 1,05 (theo vĩ độ để khỏi lo co kinh độ)
    const off = (h.rKm * 1.05) / kmPerDeg;
    expect(
      anyWithinSegment(
        rhIndex,
        { lat: h.lat + off, lon: h.lon - dx },
        { lat: h.lat + off, lon: h.lon + dx },
        (x) => (x === h ? h.rKm : 0),
      ),
    ).toBe(false);
  });

  it("bán kính 0/NaN cho mọi phần tử → không bao giờ chạm; chỉ mục rỗng → false; toạ độ hỏng → false", () => {
    const [a, b] = randomSegments(1, 7, 5)[0];
    expect(anyWithinSegment(rhIndex, a, b, () => 0)).toBe(false);
    expect(anyWithinSegment(rhIndex, a, b, () => Number.NaN)).toBe(false);
    expect(anyWithinSegment(buildIndex([] as RouteHazard[], posRH), a, b, rOf)).toBe(false);
    expect(anyWithinSegment(rhIndex, { lat: Number.NaN, lon: 1 }, b, rOf)).toBe(false);
  });

  it("đổi hàm bán kính thì bán kính lớn nhất được tính lại (không dính bộ nhớ đệm cũ)", () => {
    const h = realHazards[0];
    const kmPerDeg = (Math.PI / 180) * 6371;
    const far = { lat: h.lat + 3 / kmPerDeg, lon: h.lon }; // cách 3 km
    expect(anyWithinSegment(rhIndex, far, far, rOf)).toBe(false);
    expect(anyWithinSegment(rhIndex, far, far, () => 4)).toBe(true);
    expect(anyWithinSegment(rhIndex, far, far, rOf)).toBe(false);
  });
});

/* ── MỘT LƯỢT QUÉT TRẢ BIT-OR MỨC — maskWithinSegment (O1 2026-09-04) ──────
   Đây là hàm `legCost` dùng thay cho bốn lượt `anyWithinSegment`; sai một bit
   là chặn nhầm (bà con không rời bến) hoặc thả nhầm (đi xuyên xác tàu). */
const CO = 1;
const CHAN = 2;
/** mức theo vị trí trong danh sách — cố định, để mọi ca đối chiếu được */
const maskOfRH = (h: RouteHazard) => (realHazards.indexOf(h) % 3 === 0 ? CO : CHAN);

function bruteMask(a: LatLon, b: LatLon, rKm: (h: RouteHazard) => number = rOf): number {
  let acc = 0;
  for (const h of realHazards) if (distToSegment(posRH(h), a, b).km <= rKm(h)) acc |= maskOfRH(h);
  return acc;
}

describe("maskWithinSegment — một lượt quét trả đủ bit chặn/cờ", () => {
  it("bằng ĐÚNG quét cạn (bit-OR) trên 1.000 chặng; có đủ ca 0 / chỉ cờ / chỉ chặn / cả hai", () => {
    const segs = randomSegments(1000, 20260904, 9);
    const dem = [0, 0, 0, 0];
    for (const [a, b] of segs) {
      const want = bruteMask(a, b);
      expect(maskWithinSegment(rhIndex, a, b, rOf, maskOfRH)).toBe(want);
      // cùng câu trả lời đúng/sai với anyWithinSegment
      expect(want !== 0).toBe(anyWithinSegment(rhIndex, a, b, rOf));
      dem[want]++;
    }
    expect(dem[0]).toBeGreaterThan(20);
    expect(dem[CO] + dem[CHAN]).toBeGreaterThan(10);
  });

  it("stopAt: dừng sớm khi đã đủ bit hỏi — nhưng bit đã thấy thì không bao giờ mất", () => {
    const segs = randomSegments(1000, 7, 12);
    for (const [a, b] of segs) {
      const full = bruteMask(a, b);
      const m = maskWithinSegment(rhIndex, a, b, rOf, maskOfRH, CHAN);
      // hỏi "chặn không": có chặn thì bit CHẶN phải có; không chặn thì trả đủ như quét cạn
      if (full & CHAN) expect(m & CHAN).toBe(CHAN);
      else expect(m).toBe(full);
      // hỏi đủ hai bit: y hệt quét cạn
      expect(maskWithinSegment(rhIndex, a, b, rOf, maskOfRH, CO | CHAN)).toBe(full);
    }
  });

  it("bán kính 0/NaN → 0; chỉ mục rỗng → 0; toạ độ hỏng → 0", () => {
    const [a, b] = randomSegments(1, 7, 5)[0];
    expect(maskWithinSegment(rhIndex, a, b, () => 0, maskOfRH)).toBe(0);
    expect(maskWithinSegment(rhIndex, a, b, () => Number.NaN, maskOfRH)).toBe(0);
    expect(maskWithinSegment(buildIndex([] as RouteHazard[], posRH), a, b, rOf, maskOfRH)).toBe(0);
    expect(maskWithinSegment(rhIndex, { lat: Number.NaN, lon: 1 }, b, rOf, maskOfRH)).toBe(0);
  });

  it("đổi qua lại chỉ mục / hàm bán kính thì ô nhớ một mục không trả số cũ", () => {
    const h = realHazards[0];
    const kmPerDeg = (Math.PI / 180) * 6371;
    const far = { lat: h.lat + 3 / kmPerDeg, lon: h.lon }; // cách 3 km
    const r4 = () => 4;
    const ixRieng = buildIndex([h], posRH);
    expect(maskWithinSegment(rhIndex, far, far, rOf, maskOfRH)).toBe(0);
    expect(maskWithinSegment(rhIndex, far, far, r4, maskOfRH)).not.toBe(0);
    expect(maskWithinSegment(ixRieng, far, far, rOf, maskOfRH)).toBe(0);
    expect(maskWithinSegment(ixRieng, far, far, r4, maskOfRH)).toBe(maskOfRH(h));
    expect(maskWithinSegment(rhIndex, far, far, rOf, maskOfRH)).toBe(0);
    expect(anyWithinSegment(rhIndex, far, far, r4)).toBe(true);
    expect(anyWithinSegment(ixRieng, far, far, rOf)).toBe(false);
  });
});

describe("pointInRing — dùng chung với route-storm", () => {
  const vuong = [
    [107, 10],
    [108, 10],
    [108, 11],
    [107, 11],
    [107, 10],
  ];
  it("trong/ngoài hình vuông", () => {
    expect(pointInRing({ lat: 10.5, lon: 107.5 }, vuong)).toBe(true);
    expect(pointInRing({ lat: 11.5, lon: 107.5 }, vuong)).toBe(false);
    expect(pointInRing({ lat: 10.5, lon: 106.9 }, vuong)).toBe(false);
  });
  it("route-storm xuất lại ĐÚNG hàm này, không phải bản chép", () => {
    expect(pointInRingStorm).toBe(pointInRing);
  });
  it("vòng rỗng → ngoài", () => {
    expect(pointInRing({ lat: 10.5, lon: 107.5 }, [])).toBe(false);
  });
});

/* ── CHỈ MỤC ĐOẠN — cáp ngầm/ống dẫn thật ───────────────────────────────── */
type CableRef = { kind: string; i: number };
const cableSegs: Segment<CableRef>[] = [];
laneFeatures.forEach((f, i) => {
  const kind = (f.properties as { kind?: string } | null)?.kind ?? "";
  if ((kind !== "cap" && kind !== "ong") || f.geometry.type !== "LineString") return;
  const c = f.geometry.coordinates;
  for (let k = 0; k + 1 < c.length; k++)
    cableSegs.push({
      a: { lat: c[k][1], lon: c[k][0] },
      b: { lat: c[k + 1][1], lon: c[k + 1][0] },
      ref: { kind, i },
    });
});
const cableIx = buildSegmentIndex(cableSegs);

describe("chỉ mục đoạn — nearestSegment / segmentsWithinCorridor", () => {
  it("nhận đủ mọi đoạn cáp/ống thật", () => {
    expect(cableSegs.length).toBeGreaterThan(500);
    expect(cableIx.count).toBe(cableSegs.length);
  });

  it("nearestSegment khớp quét cạn trên 300 điểm quanh cáp (kể cả ca không có gì trong tầm)", () => {
    const rnd = lcg(99);
    let co = 0;
    for (let i = 0; i < 300; i++) {
      const s = cableSegs[Math.floor(rnd() * cableSegs.length)];
      const p = { lat: s.a.lat + (rnd() - 0.5) * 0.2, lon: s.a.lon + (rnd() - 0.5) * 0.2 };
      const maxKm = 5;
      let want: Segment<CableRef> | null = null;
      let wantKm = maxKm;
      for (const c of cableSegs) {
        const km = distToSegment(p, c.a, c.b).km;
        if (km <= wantKm) {
          wantKm = km;
          want = c;
        }
      }
      const got = nearestSegment(cableIx, p, maxKm);
      if (!want) expect(got).toBeNull();
      else {
        co++;
        expect(got).not.toBeNull();
        expect(got!.km).toBeCloseTo(wantKm, 9);
      }
    }
    expect(co).toBeGreaterThan(100);
  });

  it("maxKm vô hạn/NaN/âm → null, không quét cả lưới; chỉ mục rỗng → null", () => {
    const p = cableSegs[0].a;
    expect(nearestSegment(cableIx, p, Infinity)).toBeNull();
    expect(nearestSegment(cableIx, p, Number.NaN)).toBeNull();
    expect(nearestSegment(cableIx, p, -1)).toBeNull();
    expect(nearestSegment(buildSegmentIndex([] as Segment<CableRef>[]), p, 5)).toBeNull();
  });

  it("segmentsWithinCorridor khớp quét cạn segToSegKm, mỗi đoạn một lần, sắp theo alongKm", () => {
    // tuyến cắt ngang vịnh Thái Lan và Biển Đông nam — đi qua nhiều cáp
    const route: LatLon[] = [
      { lat: 9.9, lon: 104.5 },
      { lat: 8.2, lon: 105.5 },
      { lat: 8.6, lon: 107.5 },
      { lat: 10.3, lon: 107.1 },
    ];
    for (const widthKm of [0, 2, 10]) {
      const got = segmentsWithinCorridor(cableIx, route, widthKm);
      const want = cableSegs.filter((c) => {
        let best = Infinity;
        for (let i = 0; i + 1 < route.length; i++)
          best = Math.min(best, segToSegKm(route[i], route[i + 1], c.a, c.b).km);
        return best <= widthKm;
      });
      expect(new Set(got.map((h) => h.seg))).toEqual(new Set(want));
      expect(new Set(got.map((h) => h.seg)).size).toBe(got.length);
      for (let i = 1; i < got.length; i++) expect(got[i].alongKm).toBeGreaterThanOrEqual(got[i - 1].alongKm);
    }
  });

  it("width 0 = CẮT thật: tuyến dựng vuông góc qua giữa một đoạn cáp thật phải bắt đúng đoạn đó", () => {
    const s = cableSegs[Math.floor(cableSegs.length / 3)];
    const m = { lat: (s.a.lat + s.b.lat) / 2, lon: (s.a.lon + s.b.lon) / 2 };
    // pháp tuyến của đoạn (theo độ), dài 0,05° mỗi phía
    const dl = { lat: s.b.lat - s.a.lat, lon: s.b.lon - s.a.lon };
    const len = Math.hypot(dl.lat, dl.lon) || 1;
    const nrm = { lat: (-dl.lon / len) * 0.05, lon: (dl.lat / len) * 0.05 };
    const route: LatLon[] = [
      { lat: m.lat + nrm.lat, lon: m.lon + nrm.lon },
      { lat: m.lat - nrm.lat, lon: m.lon - nrm.lon },
    ];
    const got = segmentsWithinCorridor(cableIx, route, 0);
    expect(got.map((h) => h.seg)).toContain(s);
    expect(got.find((h) => h.seg === s)!.km).toBe(0);
    // và một tuyến tịnh tiến ra xa 5 km thì không cắt đoạn đó nữa
    const xa: LatLon[] = route.map((p) => ({ lat: p.lat + 0.045, lon: p.lon + 0.045 }));
    expect(segmentsWithinCorridor(cableIx, xa, 0).map((h) => h.seg)).not.toContain(s);
  });

  it("segToSegKm: cắt nhau → 0 tại giao điểm; song song → khoảng cách mút", () => {
    const x = segToSegKm({ lat: 10, lon: 107 }, { lat: 10, lon: 108 }, { lat: 9.5, lon: 107.5 }, { lat: 10.5, lon: 107.5 });
    expect(x.km).toBe(0);
    expect(x.alongKm).toBeCloseTo(haversineKm({ lat: 10, lon: 107 }, { lat: 10, lon: 107.5 }), 0);
    const p = segToSegKm({ lat: 10, lon: 107 }, { lat: 10, lon: 108 }, { lat: 10.1, lon: 107 }, { lat: 10.1, lon: 108 });
    expect(p.km).toBeCloseTo(11.12, 1);
  });

  it("đoạn toạ độ hỏng bị bỏ, không ném", () => {
    const ix = buildSegmentIndex([
      { a: { lat: 10, lon: 107 }, b: { lat: 10.1, lon: 107 }, ref: 1 },
      { a: { lat: Number.NaN, lon: 107 }, b: { lat: 10.1, lon: 107 }, ref: 2 },
    ]);
    expect(ix.count).toBe(1);
    expect(nearestSegment(ix, { lat: 10.05, lon: 107.01 }, 5)?.seg.ref).toBe(1);
  });
});

/* ── BENCH: 300 hiểm hoạ × 120.000 chặng (một lượt Dijkstra) ────────────── */
describe("thời gian anyWithinSegment (đo trên dữ liệu thật)", () => {
  it("120.000 chặng qua ~300 hiểm hoạ — in số; trần nới rộng cho CI", () => {
    const N = 120_000;
    const segs = randomSegments(N, 4242, 9);
    // làm nóng
    for (let i = 0; i < 1000; i++) anyWithinSegment(rhIndex, segs[i][0], segs[i][1], rOf);
    const t0 = performance.now();
    let hits = 0;
    for (let i = 0; i < N; i++) if (anyWithinSegment(rhIndex, segs[i][0], segs[i][1], rOf)) hits++;
    const ms = performance.now() - t0;

    const t1 = performance.now();
    for (let i = 0; i < 2000; i++) nearestSegment(cableIx, segs[i][0], 0.5);
    const nearMs = performance.now() - t1;

    console.log(
      [
        "",
        `  anyWithinSegment — ${realHazards.length} hiểm hoạ, ${rhIndex.nLat}×${rhIndex.nLon} ô: ${N} chặng trong ${ms.toFixed(0)} ms (${((ms / N) * 1000).toFixed(2)} µs/chặng, ${hits} chạm)`,
        `  nearestSegment    — ${cableIx.count} đoạn cáp/ống, ${cableIx.nLat}×${cableIx.nLon} ô: ${((nearMs / 2000) * 1000).toFixed(1)} µs/lượt (tầm 0,5 km)`,
        "",
      ].join("\n"),
    );
    // Mục tiêu thiết kế ≤ 300 ms máy bàn; trần test nới ×5 để máy CI chậm không đỏ oan.
    expect(ms).toBeLessThan(1500);
  });
});
