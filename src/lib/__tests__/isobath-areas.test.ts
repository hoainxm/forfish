/*  VÙNG ĐỘ SÂU (`DEPARE`) — bộ canh cho public/data/isobaths.v1.json.

    CÁI BẪY của lớp này KHÔNG phải "vẽ có ra hình không". Hình lúc nào cũng ra.
    Bẫy là nó ra hình SAI THEO CHIỀU NGUY HIỂM mà không ai thấy:

     · một LỖ (bãi ngầm nhô lên giữa vùng sâu) bị tô thành vùng ngoài ⇒ bản đồ
       nói chỗ NÔNG nhất là chỗ SÂU nhất;
     · một vòng HỞ ⇒ MapLibre tự khép bằng dây cung, dải tô liếm ngang qua chỗ
       chưa bao giờ được đo;
     · dải tô nói "≥ 20 m" ở chỗ khảo sát nhà nước đo được 7 m.

    Cả ba đều im lặng trên màn hình bàn làm việc và chỉ nói ra ngoài biển. Nên
    bộ test này KHÔNG dựng dữ liệu giả: nó mở file THẬT trong public/data và
    đối chiếu với TOÀN BỘ điểm đo sâu Thông báo hàng hải (hiện 572) — khảo sát thật của cơ
    quan nhà nước, cùng chuẩn "số 0 hải đồ".

    Sinh lại file: `node scripts/generate-isobaths.mjs`. */
import { describe, expect, it } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

type Pos = [number, number];
type Feat = {
  type: "Feature";
  properties: { d: number; k: "vung" | "duong" };
  geometry:
    | { type: "MultiPolygon"; coordinates: Pos[][][] }
    | { type: "MultiLineString"; coordinates: Pos[][] };
};

const DATA = join(process.cwd(), "public", "data");
const FILE = join(DATA, "isobaths.v1.json");
const fc = JSON.parse(readFileSync(FILE, "utf8")) as {
  type: string;
  features: Feat[];
};

const LEVELS = [5, 10, 20, 50, 100, 200, 500, 1000, 2000];
/** Mức nông nhất ĐƯỢC tô — phải khớp FILL_MIN_M trong script sinh. */
const FILL_MIN_M = 10;
const FILL_LEVELS = LEVELS.filter((l) => l >= FILL_MIN_M);

const areas = fc.features.filter(
  (f): f is Feat & { geometry: { type: "MultiPolygon"; coordinates: Pos[][][] } } =>
    f.properties.k === "vung",
);
const lines = fc.features.filter(
  (f): f is Feat & { geometry: { type: "MultiLineString"; coordinates: Pos[][] } } =>
    f.properties.k === "duong",
);

/* ── hình học thuần, đủ dùng cho test (không kéo thư viện) ───────────────── */
function signedArea(r: Pos[]): number {
  let s = 0;
  for (let i = 0; i < r.length - 1; i++) {
    s += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
  }
  return s / 2;
}
function bbox(r: Pos[]): [number, number, number, number] {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const p of r) {
    if (p[0] < a) a = p[0];
    if (p[1] < b) b = p[1];
    if (p[0] > c) c = p[0];
    if (p[1] > d) d = p[1];
  }
  return [a, b, c, d];
}
function inRing(x: number, y: number, r: Pos[]): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 2; i < r.length - 1; j = i++) {
    const [xi, yi] = r[i];
    const [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/*  Chỉ mục bbox dựng MỘT LẦN: ~570 điểm × 8 mức × ~250 đa giác mà không lọc
    bbox thì bộ test thành thứ người ta bỏ qua vì chạy lâu. */
const indexed = FILL_LEVELS.map((d) => {
  const f = areas.find((a) => a.properties.d === d);
  return {
    d,
    polys: (f?.geometry.coordinates ?? []).map((poly) => ({
      rings: poly,
      bb: bbox(poly[0]),
    })),
  };
});

/** Dải tô SÂU NHẤT phủ điểm này, hoặc `null` khi lớp tô im lặng ở đó. */
function bandAt(lon: number, lat: number): number | null {
  let band: number | null = null;
  for (const lv of indexed) {
    for (const p of lv.polys) {
      const [a, b, c, d] = p.bb;
      if (lon < a || lon > c || lat < b || lat > d) continue;
      if (!inRing(lon, lat, p.rings[0])) continue;
      let inHole = false;
      for (let k = 1; k < p.rings.length; k++) {
        if (inRing(lon, lat, p.rings[k])) { inHole = true; break; }
      }
      if (!inHole) { band = lv.d; break; }
    }
  }
  return band;
}

/* ── trọng tài: toàn bộ điểm đo sâu khảo sát ─────────────────────────────────── */
type Survey = { lon: number; lat: number; d: number };
function loadSurvey(file: string): Survey[] {
  const raw = JSON.parse(readFileSync(join(DATA, file), "utf8")) as {
    diem?: [number, number, number, number][];
  };
  // [lon, lat, độ sâu ×10 (dm), chỉ số thông báo] — xem src/lib/soundings.ts
  return (raw.diem ?? []).map(([lon, lat, dm]) => ({ lon, lat, d: dm / 10 }));
}
const survey = [
  ...loadSurvey("soundings.v1.json"),
  ...loadSurvey("soundings-cangvu.v1.json"),
];

/** Điểm bị tô SÂU HƠN khảo sát bao nhiêu mét (chỉ tính chiều nguy hiểm). */
const overpaint = survey
  .map((s) => ({ s, band: bandAt(s.lon, s.lat) }))
  .filter((x) => x.band !== null && x.band > x.s.d)
  .map((x) => ({ ...x, over: (x.band as number) - x.s.d }));

describe("isobaths.v1.json — hợp đồng hình dạng file", () => {
  it("đúng 9 vai ĐƯỜNG (mọi mức) + 8 vai VÙNG (từ 10 m trở ra)", () => {
    expect(fc.type).toBe("FeatureCollection");
    expect(lines.map((f) => f.properties.d).sort((a, b) => a - b)).toEqual(LEVELS);
    expect(areas.map((f) => f.properties.d).sort((a, b) => a - b)).toEqual(FILL_LEVELS);
    expect(fc.features.length).toBe(LEVELS.length + FILL_LEVELS.length);
  });

  /*  Đây là QUYẾT ĐỊNH AN TOÀN đóng đinh thành hình dạng file, không phải một
      lá cờ ai đó có thể bật. Mô hình 1/48° mù ở dải dưới 5 m (13 điểm khảo sát
      thật sự nông dưới 4 m, mô hình xếp đúng ĐÚNG 1). Không sinh đa giác cho
      mức 5 m nghĩa là không ai tô nhầm nó được — kể cả khi quên đọc chú thích. */
  it("mức 5 m KHÔNG có vai vùng — mô hình không đủ tin ở dải đó", () => {
    expect(areas.some((f) => f.properties.d === 5)).toBe(false);
    expect(lines.some((f) => f.properties.d === 5)).toBe(true);
  });

  /*  Trần = ĐÚNG cỡ bản file chỉ-có-đường mà nó thay thế. Thêm cả một vai hình
      học mới mà file vẫn phải nhẹ đi — nếu không thì đã vi phạm CLAUDE.md
      §CHỐNG PHÌNH, và file này nằm trong CRITICAL_SHELL (tải nguyên khối lúc
      cài PWA ở cảng sóng yếu), nặng thêm là hỏng ngân sách cài đặt. */
  it("không nặng hơn bản chỉ-có-đường mà nó thay (1.334.280 byte)", () => {
    expect(statSync(FILE).size).toBeLessThanOrEqual(1_334_280);
  });
});

describe("vùng độ sâu — bất biến hình học", () => {
  it("mọi vòng KHÉP KÍN (đỉnh cuối trùng đỉnh đầu)", () => {
    const open: string[] = [];
    for (const f of areas) {
      for (const poly of f.geometry.coordinates) {
        for (const r of poly) {
          const a = r[0];
          const b = r[r.length - 1];
          if (a[0] !== b[0] || a[1] !== b[1]) {
            open.push(`${f.properties.d} m @ [${a}]`);
          }
          expect(r.length).toBeGreaterThanOrEqual(4);
        }
      }
    }
    expect(open).toEqual([]);
  });

  /*  Hướng MANG THÔNG TIN: vòng đầu của mỗi Polygon là vòng NGOÀI (diện tích
      dương), các vòng sau là LỖ (âm). Sai hướng là MapLibre tô ngược trong với
      ngoài. */
  it("vòng ngoài ngược kim đồng hồ, lỗ thuận kim", () => {
    for (const f of areas) {
      for (const poly of f.geometry.coordinates) {
        expect(signedArea(poly[0])).toBeGreaterThan(0);
        for (let k = 1; k < poly.length; k++) {
          expect(signedArea(poly[k])).toBeLessThan(0);
        }
      }
    }
  });

  /*  Vùng "sâu ≥ 20 m" PHẢI nằm gọn trong vùng "sâu ≥ 10 m". Diện tích thực
      (đã trừ lỗ) giảm dần là điều kiện cần, và là thứ bắt được ca lỗ bị gắn
      nhầm vòng ngoài — lỗi mà mắt không thấy trên bản đồ. */
  it("chín dải LỒNG NHAU: càng sâu diện tích càng nhỏ", () => {
    const net = FILL_LEVELS.map((d) => {
      const f = areas.find((a) => a.properties.d === d);
      let s = 0;
      for (const poly of f?.geometry.coordinates ?? []) {
        for (const r of poly) s += signedArea(r);
      }
      return { d, s };
    });
    for (let i = 1; i < net.length; i++) {
      expect(
        net[i].s,
        `mức ${net[i].d} m (${net[i].s.toFixed(1)}) phải nhỏ hơn mức ${net[i - 1].d} m (${net[i - 1].s.toFixed(1)})`,
      ).toBeLessThan(net[i - 1].s);
    }
  });

  /*  CA CHÉP TAY. Bãi ngầm ở ~[114,35 · 10,64] (quần đảo Trường Sa) là LỖ lớn
      nhất nằm trong vùng 2000 m. Nếu bước gắn lỗ trong script hỏng, điểm này
      sẽ được tô 2000 m — bản đồ nói bãi ngầm là chỗ sâu nhất. Đúng ca nguy
      hiểm nhất mà lớp này có thể sinh ra, và mắt không bắt được. */
  it("LỖ không bị tô: bãi ngầm trong vùng 2000 m phải ra dải nông hơn", () => {
    const band = bandAt(114.346, 10.639);
    expect(band).not.toBeNull();
    expect(band).toBeLessThan(2000);
  });
});

describe("vai đường — nét đẳng sâu", () => {
  /*  Vòng khép kín chạy dọc biên lưới đệm; tổng chiều dài đoạn mép đo được là
      ~201° (~22.000 km). Lọt một đoạn nào vào vai "duong" là bản đồ có một nét
      "2000 m" thẳng băng dọc 102°Đ / 118°Đ / 5°B — đường đẳng sâu KHÔNG CÓ
      THẬT, mà bản đồ mặc định không chặn pan tới mép. */
  it("không đoạn nét nào chạy dọc mép khung dữ liệu", () => {
    const STEP = 5 / 240;
    const W = 102 + 1 / 480;
    const S = 5 + 1 / 480;
    const E = W + 768 * STEP;
    const N = S + 864 * STEP;
    const onFrame = (p: Pos) =>
      p[0] <= W + STEP || p[0] >= E - STEP || p[1] <= S + STEP || p[1] >= N - STEP;
    let hits = 0;
    for (const f of lines) {
      for (const ln of f.geometry.coordinates) {
        for (let i = 0; i < ln.length - 1; i++) {
          if (onFrame(ln[i]) && onFrame(ln[i + 1])) hits++;
        }
      }
    }
    expect(hits).toBe(0);
  });

  it("mỗi mức đều còn nét để vẽ và dán nhãn", () => {
    for (const f of lines) {
      expect(f.geometry.coordinates.length, `mức ${f.properties.d} m`).toBeGreaterThan(0);
    }
  });
});

describe("CỔNG AN TOÀN — điểm đo sâu Thông báo hàng hải làm trọng tài", () => {
  it("có đủ trọng tài (≥557 điểm) — thiếu là cổng này rỗng ruột", () => {
    /* Ý của ca này là "đủ trọng tài", không phải "đúng 557". Con số 557 là ảnh
       chụp corpus lúc viết; đợt OCR 2026-09-01 nâng nó lên 572 và sẽ còn tăng
       mỗi lần mở thêm thông báo. Khoá cứng bằng dấu bằng là biến mọi lần dữ
       liệu TỐT LÊN thành một ca đỏ. Giữ sàn — cái thật sự cần canh là số trọng
       tài không TỤT. */
    expect(survey.length).toBeGreaterThanOrEqual(557);
    for (const s of survey) expect(s.d).toBeGreaterThan(0);
  });

  /*  BẤT BIẾN CỨNG. Vượt 15 m không còn giải thích được bằng chuẩn mực nước
      hay ô lưới 2,3 km — đó là hình học hỏng (lỗ bị tô, vòng khép sai). Ngưỡng
      này KHÔNG được nới. */
  it("không điểm khảo sát nào bị tô sâu hơn 15 m so với số đo", () => {
    const gross = overpaint.filter((x) => x.over > 15);
    expect(
      gross.map((x) => `${x.s.d} m → tô ${x.band} m @ [${x.s.lon},${x.s.lat}]`),
    ).toEqual([]);
  });

  /*  NGƯỠNG 6 m KHÔNG PHẢI SỐ TỰ NGHĨ: đây đúng `nguong.tolAbsM` mà
      public/data/soundings-verified.v1.json đang dùng để đối chiếu chính hai mô
      hình này, với lý do ghi sẵn trong đó — chuẩn "số 0 hải đồ" nằm dưới mực
      nước trung bình 1–2 m, cộng ô lưới nuốt luồng nạo vét.
      Hiện có ĐÚNG 1 ca: 7,2 m ở Lòng Tàu (465/TBHH-CVHHĐN) bị tô 20 m — lòng
      lạch sông mà ô 2,3 km không phân giải nổi. Trần 2 chừa đúng một chỗ để
      hình đổi nhẹ không làm đỏ oan; lên 3 là phải quay lại xem lại FILL_MIN_M,
      KHÔNG phải nới trần. */
  it("số điểm bị tô sâu hơn 6 m không quá 2", () => {
    const over6 = overpaint.filter((x) => x.over > 6);
    expect(
      over6.length,
      over6.map((x) => `${x.s.d} m → tô ${x.band} m @ [${x.s.lon},${x.s.lat}]`).join(" · "),
    ).toBeLessThanOrEqual(2);
  });

  /*  Vượt 3 m còn giải thích được (triều Vũng Tàu 3–4 m + chuẩn mực nước), nên
      đây là trần NGÂN SÁCH chứ không phải bất biến: hiện 11 ca, gần hết ở khu
      tiếp cận Vũng Tàu. Trần 15 để thấy ngay khi con số bò lên. */
  it("số điểm bị tô sâu hơn 3 m không quá 15", () => {
    expect(overpaint.filter((x) => x.over > 3).length).toBeLessThanOrEqual(15);
  });

  /*  CA CHÉP TAY — chính là ca đã bắt lớp tô phải bỏ mức 5 m.
      Thông báo 737/TBHH-CVHHKG (Kiên Giang) đo được 1,2–1,4 m nước ở sáu điểm
      này; lưới 1/48° nói ≥ 5 m. Tàu vỏ gỗ mớn 1,8–2,5 m đọc "5 m" ở đây là
      mắc cạn. Sáu điểm phải KHÔNG được tô — bỏ trắng là câu trả lời đúng. */
  it("sáu điểm cạn 1,2–1,4 m ở Kiên Giang KHÔNG được tô dải nào", () => {
    const kienGiang: Pos[] = [
      [105.0685, 10.00325],
      [105.06781, 10.00267],
      [105.06817, 10.00297],
      [105.059, 9.99636],
      [105.06567, 10.001],
      [105.06886, 10.0035],
    ];
    for (const [lon, lat] of kienGiang) {
      expect(bandAt(lon, lat), `[${lon},${lat}]`).toBeNull();
    }
  });
});

describe("ca đối chứng chép tay — mốc địa lý đã biết", () => {
  /*  Bắt ca lệch NEO TOẠ ĐỘ: hình đúng cỡ, đúng số vòng, nhưng đặt sai chỗ —
      thứ mà mọi kiểm tra thống kê ở trên đều cho qua. */
  it("giữa Biển Đông là bồn sâu, vịnh Bắc Bộ là thềm nông", () => {
    expect(bandAt(114.0, 14.0)).toBe(2000); // bồn trung tâm Biển Đông
    expect(bandAt(110.5, 10.0)).toBe(2000); // đông nam Phú Quý
    expect(bandAt(107.5, 19.5)).toBe(50); // giữa vịnh Bắc Bộ — nông, không quá 100 m
  });

  it("đất liền không bao giờ được tô", () => {
    expect(bandAt(105.85, 21.02)).toBeNull(); // Hà Nội
    expect(bandAt(108.05, 12.67)).toBeNull(); // Buôn Ma Thuột
  });
});
