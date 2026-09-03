// Trục 1 — THUỶ TRIỀU (nước lớn / nước ròng) tính NGAY TRONG MÁY.
//
// Vì sao có file này: bà con đang phải tra bảng giấy hoặc app nước ngoài không
// có trạm Việt Nam. Thuỷ triều KHÔNG cần mạng — nó là thiên văn cộng với vài
// chục con số riêng của từng cửa lạch (hằng số điều hoà). Đóng gói mấy con số
// đó vào máy (public/data/tide-stations.v1.json) là ngoài biển mất sóng nhiều
// ngày vẫn biết mấy giờ nước lớn, mấy giờ nước ròng.
//
// ── FILE NÀY THUẦN ─────────────────────────────────────────────────────────
// KHÔNG fetch, KHÔNG DOM, KHÔNG import gì (kể cả `@/lib/day-labels` — nó kéo
// theo `ocean-map` → `@protomaps/basemaps`, thứ chỉ chạy trong trình duyệt).
// Nhờ vậy `scripts/generate-tides.mjs` nạp thẳng được file này qua tsx và DÙNG
// LẠI ĐÚNG bộ thiên văn khi phân tích hằng số — phân tích và dự báo không thể
// lệch nhau. Lead lo phần tải file JSON + ghim vào service worker.
//
// ── QUY ƯỚC PHA — ĐỌC TRƯỚC KHI NHÉT HẰNG SỐ TỪ NGUỒN KHÁC VÀO ─────────────
// Pha `phase` trong file JSON là pha trễ so với đối số cân bằng V(t) ĐỊNH NGHĨA
// NGAY TẠI ĐÂY: V = i1·τ + i2·s + i3·h + i4·p + i5·N' + i6·ps, KHÔNG cộng hằng
// số ±90°/180° của khai triển thế triều. Hằng số công bố ở nơi khác (FES2022,
// bảng thuỷ triều, EOT20…) dùng quy ước CÓ hằng số đó ⇒ pha sẽ LỆCH tới 90°
// (≈ 3 giờ đồng hồ với sóng bán nhật triều). Muốn thêm trạm từ nguồn ngoài thì
// phải quy đổi pha trước, ĐỪNG chép thẳng. (Sinh bằng chính script trong repo
// thì không dính: script và file này dùng chung V(t) nên hằng số luôn khớp.)
//
// ## Assumptions
// - "Số 0" của độ cao là MỰC NƯỚC THẤP NHẤT LÝ THUYẾT do chính bộ hằng số này
//   sinh ra (quét 19 năm), tức xấp xỉ số 0 hải đồ mà bảng thuỷ triều VN dùng.
//   Không lấy được số 0 hải đồ chính thức của từng cảng nên KHÔNG hứa nó trùng
//   tuyệt đối — chênh vài chục cm là chuyện có thật, xem `st.rmseM`.
// - Ngày là NGÀY LỊCH VIỆT NAM (+07:00) cố định, không lấy theo múi giờ máy —
//   cùng luật với `day-labels.ts` (máy đặt sai giờ thì nhãn vẫn đúng giờ đài).
// - Cặp đỉnh–chân chênh nhau dưới 5 cm bị bỏ cả đôi: đó là gợn của sóng nước
//   nông, gọi nó là "con nước" thì bà con canh nhầm. Ngày nước kém ở trạm nhật
//   triều vì vậy có khi chỉ còn 1 đỉnh 1 chân — đúng thực tế, nước đứng cả ngày.
// - Chỉ dự báo phần THIÊN VĂN. Gió mùa, bão, lũ sông có thể đẩy mực nước lệch
//   vài chục cm — mọi câu chữ xuất ra đều phải giữ chữ "tham khảo" ở màn hình.

/* ---------------------------------------------------------------------------
   1. Kiểu dữ liệu
--------------------------------------------------------------------------- */

/** Một sóng triều: biên độ (m) + pha trễ (độ), theo quy ước V(t) của file này. */
export interface TideConstituent {
  name: string;
  amp: number;
  phase: number;
}

export interface TideStation {
  /** khoá ổn định, không dấu — vd "hon-dau" */
  id: string;
  /** tên bà con gọi — vd "Hòn Dấu" */
  name: string;
  lat: number;
  lon: number;
  /** mực nước trung bình tính trên số 0 (m) — cộng vào tổng các sóng */
  z0: number;
  /** nguồn số liệu gốc (ghi nguồn bắt buộc hiện trong app) */
  source: string;
  /** khoảng thời gian bản ghi dùng để phân tích — vd "2015–2024" */
  span: string;
  /**
   * Sai số kiểm chứng (m), null = chưa đo. Ý nghĩa TUỲ `nguon`:
   *  · gauge — sai số ngoài mẫu (holdout) so với số đo thật cùng trạm.
   *  · model — sai số EOT20 ↔ trạm đo, đo tại 4 trạm thật (không có máy đo tại
   *    chỗ để holdout); ở cửa lạch nông sai số thật có thể LỚN HƠN con số này.
   */
  rmseM: number | null;
  /**
   * Nguồn của bộ hằng số — QUYẾT ĐỊNH độ tin, KHÔNG được trộn:
   *  · "gauge" (mặc định) — phân tích từ MÁY ĐO mực nước thật. Chuẩn vàng.
   *  · "model" — quy đổi từ MÔ HÌNH triều EOT20 cho cửa lạch xa mọi trạm đo.
   *    Kém tin hơn; UI phải nói rõ "ước tính từ mô hình" (xem tideModelCaveat).
   * Vắng cờ = "gauge" (4 trạm cũ không ghi cờ vẫn là trạm đo).
   */
  nguon?: "gauge" | "model";
  /** một câu mô tả kiểu con nước ở cửa này — hiện cạnh bảng cho bà con đối chiếu */
  note?: string;
  cons: TideConstituent[];
}

/** Trạm ước tính từ mô hình (nguon="model"), không phải máy đo thật. */
export function isModelStation(st: TideStation): boolean {
  return st.nguon === "model";
}

export interface TideStationsFile {
  v: 1;
  phaseConvention: string;
  credit: string;
  stations: TideStation[];
}

export interface TideExtreme {
  /** epoch ms */
  atMs: number;
  /** độ cao trên số 0 (m) */
  heightM: number;
  kind: "high" | "low";
}

/* ---------------------------------------------------------------------------
   2. Thiên văn — đối số cân bằng V(t) và hệ số điều chỉnh chu kỳ 18,6 năm
--------------------------------------------------------------------------- */

const DEG = Math.PI / 180;
/** Giờ Việt Nam cố định (+07:00) — giống day-labels.ts, không theo máy. */
export const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Số Doodson (i1..i6) nhân với (τ, s, h, p, N', ps).
 * `nodal` chọn công thức điều chỉnh 18,6 năm (Schureman) ở `nodalFactors`.
 */
const DOODSON: Record<
  string,
  { d: [number, number, number, number, number, number]; nodal: string }
> = {
  // dài ngày
  SA: { d: [0, 0, 1, 0, 0, -1], nodal: "one" },
  SSA: { d: [0, 0, 2, 0, 0, 0], nodal: "one" },
  MM: { d: [0, 1, 0, -1, 0, 0], nodal: "mm" },
  MSF: { d: [0, 2, -2, 0, 0, 0], nodal: "m2" },
  MF: { d: [0, 2, 0, 0, 0, 0], nodal: "mf" },
  // nhật triều (một con nước một ngày) — trục chính của vịnh Bắc Bộ
  Q1: { d: [1, -2, 0, 1, 0, 0], nodal: "o1" },
  O1: { d: [1, -1, 0, 0, 0, 0], nodal: "o1" },
  P1: { d: [1, 1, -2, 0, 0, 0], nodal: "one" },
  S1: { d: [1, 1, -1, 0, 0, 0], nodal: "one" },
  K1: { d: [1, 1, 0, 0, 0, 0], nodal: "k1" },
  J1: { d: [1, 2, 0, -1, 0, 0], nodal: "j1" },
  OO1: { d: [1, 3, 0, 0, 0, 0], nodal: "oo1" },
  // bán nhật triều (hai con nước một ngày) — trục chính của Vũng Tàu
  "2N2": { d: [2, -2, 0, 2, 0, 0], nodal: "m2" },
  MU2: { d: [2, -2, 2, 0, 0, 0], nodal: "m2" },
  N2: { d: [2, -1, 0, 1, 0, 0], nodal: "m2" },
  NU2: { d: [2, -1, 2, -1, 0, 0], nodal: "m2" },
  M2: { d: [2, 0, 0, 0, 0, 0], nodal: "m2" },
  LDA2: { d: [2, 1, -2, 1, 0, 0], nodal: "m2" },
  T2: { d: [2, 2, -3, 0, 0, 1], nodal: "one" },
  S2: { d: [2, 2, -2, 0, 0, 0], nodal: "one" },
  K2: { d: [2, 2, 0, 0, 0, 0], nodal: "k2" },
  "2SM2": { d: [2, 4, -4, 0, 0, 0], nodal: "m2" },
  // nước nông (cửa lạch, luồng cạn — méo con nước, đổi giờ đứng nước)
  MO3: { d: [3, -1, 0, 0, 0, 0], nodal: "mo3" },
  M3: { d: [3, 0, 0, 0, 0, 0], nodal: "m3" },
  MK3: { d: [3, 1, 0, 0, 0, 0], nodal: "mk3" },
  MN4: { d: [4, -1, 0, 1, 0, 0], nodal: "m4" },
  M4: { d: [4, 0, 0, 0, 0, 0], nodal: "m4" },
  MS4: { d: [4, 2, -2, 0, 0, 0], nodal: "m2" },
  MK4: { d: [4, 2, 0, 0, 0, 0], nodal: "mk4" },
  S4: { d: [4, 4, -4, 0, 0, 0], nodal: "one" },
  "2MN6": { d: [6, -1, 0, 1, 0, 0], nodal: "m6" },
  M6: { d: [6, 0, 0, 0, 0, 0], nodal: "m6" },
  "2MS6": { d: [6, 2, -2, 0, 0, 0], nodal: "m4" },
};

/** Tên mọi sóng file này biết tính — script phân tích lấy đúng danh sách này. */
export const TIDE_CONSTITUENTS = Object.keys(DOODSON);

/** Tốc độ (độ/giờ) của τ, s, h, p, N', ps — dùng cho tần số từng sóng. */
const RATES: [number, number, number, number, number, number] = [
  14.49205211, 0.54901653, 0.04106864, 0.00464183, 0.00220641, 0.00000196,
];

/** Tần số của một sóng, độ/giờ. Ném khi tên lạ (đừng đoán bừa). */
export function tideSpeed(name: string): number {
  const c = DOODSON[name];
  if (!c) throw new Error(`sóng triều lạ: ${name}`);
  return c.d.reduce((sum, k, i) => sum + k * RATES[i], 0);
}

const JD_EPOCH = 2440587.5; // JD lúc 1970-01-01T00:00:00Z

function norm360(x: number): number {
  return ((x % 360) + 360) % 360;
}

/** Đối số thiên văn tại thời điểm `ms` (epoch ms, giờ UTC). */
interface Astro {
  /** τ, s, h, p, N', ps — độ */
  a: [number, number, number, number, number, number];
  /** N (kinh độ điểm nút lên) — độ, cho hệ số 18,6 năm */
  n: number;
}

function astro(ms: number): Astro {
  const jd = ms / 86400000 + JD_EPOCH;
  const T = (jd - 2451545.0) / 36525;
  const T2 = T * T;
  const T3 = T2 * T;
  const T4 = T3 * T;

  const s =
    218.3164477 +
    481267.88123421 * T -
    0.0015786 * T2 +
    T3 / 538841 -
    T4 / 65194000;
  const h = 280.46646 + 36000.76983 * T + 0.0003032 * T2;
  const p =
    83.3532465 +
    4069.0137287 * T -
    0.010322 * T2 -
    T3 / 80053 +
    T4 / 18999000;
  const N =
    125.0445479 -
    1934.1362891 * T +
    0.0020754 * T2 +
    T3 / 467441 -
    T4 / 60616000;
  const ps = 282.937348 + 1.7195366 * T + 0.00045688 * T2;

  // τ = góc giờ của mặt trăng trung bình tại Greenwich.
  const utHours = (((ms / 3600000) % 24) + 24) % 24;
  const tau = 15 * utHours + h - s;

  return {
    a: [
      norm360(tau),
      norm360(s),
      norm360(h),
      norm360(p),
      norm360(-N),
      norm360(ps),
    ],
    n: norm360(N),
  };
}

/**
 * Hệ số biên độ f và lệch pha u (độ) theo chu kỳ điểm nút 18,6 năm.
 * Công thức xấp xỉ chuẩn (Schureman) — bỏ qua là sai tới 19% với K1, 37% với
 * Mf; với vịnh Bắc Bộ (K1/O1 áp đảo) đó là nửa mét nước.
 */
function nodalFactors(kind: string, N: number): { f: number; u: number } {
  const c1 = Math.cos(N * DEG);
  const c2 = Math.cos(2 * N * DEG);
  const c3 = Math.cos(3 * N * DEG);
  const s1 = Math.sin(N * DEG);
  const s2 = Math.sin(2 * N * DEG);
  const s3 = Math.sin(3 * N * DEG);

  const m2 = { f: 1.0004 - 0.0373 * c1 + 0.0002 * c2, u: -2.14 * s1 };
  const o1 = {
    f: 1.0089 + 0.1871 * c1 - 0.0147 * c2 + 0.0014 * c3,
    u: 10.8 * s1 - 1.34 * s2 + 0.19 * s3,
  };
  const k1 = {
    f: 1.006 + 0.115 * c1 - 0.0088 * c2 + 0.0006 * c3,
    u: -8.86 * s1 + 0.68 * s2 - 0.07 * s3,
  };
  const k2 = {
    f: 1.0241 + 0.2863 * c1 + 0.0083 * c2 - 0.0015 * c3,
    u: -17.74 * s1 + 0.68 * s2 - 0.04 * s3,
  };

  switch (kind) {
    case "one":
      return { f: 1, u: 0 };
    case "m2":
      return m2;
    case "o1":
      return o1;
    case "k1":
      return k1;
    case "k2":
      return k2;
    case "mm":
      return { f: 1.0 - 0.13 * c1 + 0.0013 * c2, u: 0 };
    case "mf":
      return {
        f: 1.0429 + 0.4135 * c1 - 0.004 * c2,
        u: -23.74 * s1 + 2.68 * s2 - 0.38 * s3,
      };
    case "j1":
      return {
        f: 1.1029 + 0.1676 * c1 - 0.017 * c2 + 0.0016 * c3,
        u: -12.94 * s1 + 1.34 * s2 - 0.19 * s3,
      };
    case "oo1":
      return {
        f: 1.1027 + 0.6504 * c1 + 0.0317 * c2 - 0.0014 * c3,
        u: -36.68 * s1 + 4.02 * s2 - 0.57 * s3,
      };
    case "m3":
      return { f: Math.pow(m2.f, 1.5), u: 1.5 * m2.u };
    case "m4":
      return { f: m2.f * m2.f, u: 2 * m2.u };
    case "m6":
      return { f: m2.f * m2.f * m2.f, u: 3 * m2.u };
    case "mk3":
      return { f: m2.f * k1.f, u: m2.u + k1.u };
    case "mo3":
      return { f: m2.f * o1.f, u: m2.u + o1.u };
    case "mk4":
      return { f: m2.f * k2.f, u: m2.u + k2.u };
    default:
      throw new Error(`hệ số điều nút lạ: ${kind}`);
  }
}

/**
 * (V+u) và f của mọi sóng tại một thời điểm — dùng chung cho DỰ BÁO (file này)
 * và PHÂN TÍCH (scripts/generate-tides.mjs). Một nguồn duy nhất: hai bên lệch
 * nhau là hằng số vô nghĩa ngay.
 */
export function tideArguments(
  ms: number,
  names: readonly string[],
): { f: number[]; vu: number[] } {
  const { a, n } = astro(ms);
  const f: number[] = new Array(names.length);
  const vu: number[] = new Array(names.length);
  for (let i = 0; i < names.length; i++) {
    const c = DOODSON[names[i]];
    if (!c) throw new Error(`sóng triều lạ: ${names[i]}`);
    let v = 0;
    for (let k = 0; k < 6; k++) v += c.d[k] * a[k];
    const nf = nodalFactors(c.nodal, n);
    f[i] = nf.f;
    vu[i] = norm360(v + nf.u);
  }
  return { f, vu };
}

/* ---------------------------------------------------------------------------
   3. Dự báo mực nước
--------------------------------------------------------------------------- */

/** Mực nước trên số 0 (m) tại trạm `st`, thời điểm `ms` (epoch ms). */
export function tideHeightAt(st: TideStation, ms: number): number {
  const names = st.cons.map((c) => c.name);
  const { f, vu } = tideArguments(ms, names);
  let sum = st.z0;
  for (let i = 0; i < st.cons.length; i++) {
    sum += f[i] * st.cons[i].amp * Math.cos((vu[i] - st.cons[i].phase) * DEG);
  }
  return sum;
}

/* Bước quét 6 phút: nhỏ hơn 1/10 chu kỳ sóng nhanh nhất trong bộ (M6 ≈ 4 giờ 8
   phút) nên không bỏ sót đỉnh nào; nhỏ hơn nữa chỉ tốn pin. */
const SCAN_STEP_MS = 6 * 60 * 1000;
/* Một cặp đỉnh–chân chênh nhau chưa tới ngưỡng này là GỢN của sóng nước nông,
   không phải con nước — gọi tên nó ra thì bà con canh nhầm giờ.
   ⚠️ Đây là độ nổi (prominence) so với ĐỈNH/CHÂN KỀ, KHÔNG phải so với mẫu kề
   nhau: quanh đỉnh triều đường cong phẳng, hai mẫu cách 6 phút chỉ chênh vài
   MILIMÉT, lấy ngưỡng 3 cm mà so với mẫu kề thì lọc sạch MỌI con nước (đã dính
   đúng lỗi này lúc dựng, bắt được nhờ bộ test đối chiếu số đo thật). */
const MIN_PROMINENCE_M = 0.05;

/** Nửa ngày lịch VN → mốc epoch ms của 00:00 giờ VN. */
function vnDayStartMs(isoDate: string): number {
  const t = Date.parse(`${isoDate}T00:00:00Z`);
  if (!Number.isFinite(t)) return NaN;
  return t - VN_OFFSET_MS;
}

/** Tinh chỉnh vị trí đỉnh/chân bằng chia ba đoạn (hàm trơn, hội tụ nhanh). */
function refine(
  st: TideStation,
  lo: number,
  hi: number,
  wantMax: boolean,
): { atMs: number; heightM: number } {
  let a = lo;
  let b = hi;
  for (let i = 0; i < 40 && b - a > 1000; i++) {
    const m1 = a + (b - a) / 3;
    const m2 = b - (b - a) / 3;
    const h1 = tideHeightAt(st, m1);
    const h2 = tideHeightAt(st, m2);
    if (wantMax ? h1 < h2 : h1 > h2) a = m1;
    else b = m2;
  }
  const atMs = Math.round((a + b) / 2);
  return { atMs, heightM: tideHeightAt(st, atMs) };
}

/**
 * Đỉnh triều / chân triều trong NGÀY LỊCH VIỆT NAM `isoDate` ("YYYY-MM-DD").
 * Quét rộng ra hai bên 3 giờ rồi mới cắt về trong ngày — đỉnh sát 00h/24h vẫn
 * được nhận đúng là đỉnh chứ không thành "mép đoạn".
 * Ngày hỏng → mảng rỗng (đừng ném giữa biển).
 */
export function tideExtremesForDay(
  st: TideStation,
  isoDate: string,
): TideExtreme[] {
  const start = vnDayStartMs(isoDate);
  if (!Number.isFinite(start)) return [];
  const end = start + 86400000;
  const margin = 3 * 3600000;

  const times: number[] = [];
  const hs: number[] = [];
  for (let t = start - margin; t <= end + margin; t += SCAN_STEP_MS) {
    times.push(t);
    hs.push(tideHeightAt(st, t));
  }

  // 1) mọi điểm quay đầu thô, đã tinh chỉnh về giờ thật
  let ex: TideExtreme[] = [];
  for (let i = 1; i < hs.length - 1; i++) {
    const isMax = hs[i] >= hs[i - 1] && hs[i] >= hs[i + 1];
    const isMin = hs[i] <= hs[i - 1] && hs[i] <= hs[i + 1];
    if (isMax === isMin) continue; // vừa max vừa min = đoạn phẳng, bỏ
    const r = refine(st, times[i - 1], times[i + 1], isMax);
    ex.push({ ...r, kind: isMax ? "high" : "low" });
  }

  // 2) gộp hai đỉnh (hoặc hai chân) dính nhau — giữ cái cao/thấp hơn
  const merge = (list: TideExtreme[]): TideExtreme[] => {
    const m: TideExtreme[] = [];
    for (const e of list) {
      const last = m[m.length - 1];
      if (last && last.kind === e.kind) {
        const better =
          e.kind === "high" ? e.heightM > last.heightM : e.heightM < last.heightM;
        if (better) m[m.length - 1] = e;
      } else m.push(e);
    }
    return m;
  };
  ex = merge(ex);

  // 3) bỏ gợn: cặp đỉnh–chân kề nhau chênh dưới ngưỡng thì cả hai đều không
  //    phải con nước — bỏ đôi rồi gộp lại, lặp tới khi sạch
  for (;;) {
    let worst = -1;
    let worstD = MIN_PROMINENCE_M;
    for (let i = 0; i + 1 < ex.length; i++) {
      const d = Math.abs(ex[i].heightM - ex[i + 1].heightM);
      if (d < worstD) {
        worstD = d;
        worst = i;
      }
    }
    if (worst < 0) break;
    ex.splice(worst, 2);
    ex = merge(ex);
  }

  // 4) cắt về đúng ngày (bước 1–3 cần cả phần lấn ra hai bên mới xét đúng)
  return ex.filter((e) => e.atMs >= start && e.atMs < end);
}

/* ---------------------------------------------------------------------------
   4. Nói tiếng người — bà con 40–60 tuổi, đọc trên tàu, nắng chói
--------------------------------------------------------------------------- */

/**
 * Giờ đọc kiểu đời thường: 14:00 → "2 giờ chiều", 20:30 → "8 giờ rưỡi tối",
 * 05:15 → "5 giờ 15 sáng". Làm tròn 5 phút (đỉnh triều đứng nước cả tiếng,
 * nói lẻ từng phút là giả vờ chính xác).
 */
export function tideClockText(ms: number): string {
  const d = new Date(Math.round(ms / 300000) * 300000 + VN_OFFSET_MS);
  let hh = d.getUTCHours();
  const mm = d.getUTCMinutes();

  let buoi: string;
  if (hh === 0) buoi = "đêm";
  else if (hh < 4) buoi = "khuya";
  else if (hh < 11) buoi = "sáng";
  else if (hh < 13) buoi = "trưa";
  else if (hh < 18) buoi = "chiều";
  else if (hh < 23) buoi = "tối";
  else buoi = "đêm";

  if (hh === 0) hh = 12;
  else if (hh > 12) hh -= 12;

  const phut = mm === 0 ? "" : mm === 30 ? " rưỡi" : ` ${mm}`;
  return `${hh} giờ${phut} ${buoi}`;
}

/** 1.83 → "1,8 m" (một số lẻ, dấu phẩy kiểu Việt Nam). */
export function tideHeightText(m: number): string {
  return `${(Math.round(m * 10) / 10).toLocaleString("vi-VN")} m`;
}

/**
 * Một dòng cho mỗi con nước:
 *   "Nước lớn lúc 2 giờ chiều · 1,8 m"
 *   "Nước ròng lúc 8 giờ tối · 0,4 m"
 */
export function tideExtremeText(e: TideExtreme): string {
  const ten = e.kind === "high" ? "Nước lớn" : "Nước ròng";
  return `${ten} lúc ${tideClockText(e.atMs)} · ${tideHeightText(e.heightM)}`;
}

/** Cả ngày, mỗi con nước một dòng. Không có số liệu → mảng rỗng. */
export function tideDayLines(st: TideStation, isoDate: string): string[] {
  return tideExtremesForDay(st, isoDate).map(tideExtremeText);
}

/**
 * Câu tóm cả ngày: "Nước lên xuống 3,6 m — con nước cường, chảy xiết".
 *
 * Cường hay kém phải so với CHÍNH CỬA ĐÓ, không so số tuyệt đối: 3 m ở Vũng
 * Tàu là chuyện thường, 3 m ở Quy Nhơn thì cả năm không có. Mốc so lấy thẳng
 * từ bộ hằng số của trạm:
 *   · ngày cường nhất ≈ 2·[(M2+S2) + (K1+O1)]  — hai họ sóng cùng pha
 *   · ngày kém nhất   ≈ 2·[|M2−S2| + |K1−O1|]  — hai họ sóng triệt nhau
 * Gọi tên khi hôm nay lệch quá 40% về một phía so với khoảng giữa.
 */
export function tideRangeText(
  st: TideStation,
  isoDate: string,
): string | null {
  const start = vnDayStartMs(isoDate);
  if (!Number.isFinite(start)) return null;

  /*  Đo trên CẢ ĐƯỜNG NƯỚC trong ngày chứ không chỉ trên các đỉnh/chân: ngày
      nước kém ở trạm nhật triều có khi cả ngày chỉ một lần quay đầu (Hòn Dấu
      1/9/2026 đúng như vậy). Lấy theo đỉnh thì hôm đó không có số để nói và
      hàm trả null — đẩy việc nghĩ câu chữ sang màn hình, đúng thứ nguyên tắc 4
      cấm. Quét đường nước thì ngày nào cũng có câu, và câu đó vẫn đúng. */
  let hi = -Infinity;
  let lo = Infinity;
  for (let t = start; t <= start + 86400000; t += 30 * 60000) {
    const h = tideHeightAt(st, t);
    if (h > hi) hi = h;
    if (h < lo) lo = h;
  }
  const range = hi - lo;
  const turns = tideExtremesForDay(st, isoDate).length;

  const amp = (n: string) => st.cons.find((c) => c.name === n)?.amp ?? 0;
  const semi = amp("M2");
  const semi2 = amp("S2");
  const diur = amp("K1");
  const diur2 = amp("O1");
  const spring = 2 * (semi + semi2 + diur + diur2);
  const neap = 2 * (Math.abs(semi - semi2) + Math.abs(diur - diur2));
  const mid = (spring + neap) / 2;

  const suffix =
    turns < 2
      ? " — cả ngày nước gần như đứng"
      : spring <= 0
        ? ""
        : range > mid + 0.4 * (spring - mid)
          ? " — con nước cường, chảy xiết"
          : range < mid - 0.4 * (mid - neap)
            ? " — con nước kém, nước đứng lâu"
            : "";
  return `Nước lên xuống ${tideHeightText(range)}${suffix}`;
}

export interface TideDraftInput {
  /** mớn nước của tàu (m) */
  draftM: number;
  /** độ sâu ghi trên hải đồ tại chỗ định qua (m, so với số 0 hải đồ) */
  chartDepthM: number;
  /** khoảng hở an toàn dưới đáy tàu (m) — mặc định 0,5 m */
  clearanceM?: number;
}

/**
 * Cảnh báo mắc cạn tại con nước ròng thấp nhất trong ngày.
 * PHẢI có độ sâu hải đồ mới nói được: chỉ biết mực triều thì không biết đáy ở
 * đâu. Thiếu số liệu → trả null, KHÔNG đoán (bịa ở đây là bà con mắc cạn).
 */
export function tideDraftWarning(
  extremes: TideExtreme[],
  input: TideDraftInput,
): string | null {
  const { draftM, chartDepthM } = input;
  const clearance = input.clearanceM ?? 0.5;
  if (!(draftM > 0) || !Number.isFinite(chartDepthM)) return null;
  const lows = extremes.filter((e) => e.kind === "low");
  if (!lows.length) return null;

  const worst = lows.reduce((a, b) => (b.heightM < a.heightM ? b : a));
  const water = chartDepthM + worst.heightM;
  const need = draftM + clearance;
  if (water >= need) return null;
  return (
    `Coi chừng cạn: lúc ${tideClockText(worst.atMs)} nước chỉ còn ` +
    `${tideHeightText(water)} chỗ này, tàu mớn ${tideHeightText(draftM)} ` +
    `cần ${tideHeightText(need)} — chờ nước lên hãy qua.`
  );
}

/* ---------------------------------------------------------------------------
   5. Đọc file trạm (thuần — Lead lo phần tải)
--------------------------------------------------------------------------- */

function isCons(x: unknown): x is TideConstituent {
  const c = x as TideConstituent;
  return (
    !!c &&
    typeof c.name === "string" &&
    DOODSON[c.name] !== undefined &&
    Number.isFinite(c.amp) &&
    Number.isFinite(c.phase)
  );
}

/**
 * Kiểm tra + đọc `public/data/tide-stations.v1.json`.
 * Bản ghi hỏng bị BỎ chứ không làm sập cả file — nhưng file sai phiên bản thì
 * NÉM, vì tính nhầm mực nước còn tệ hơn không có số.
 */
export function decodeTideStations(raw: unknown): TideStation[] {
  const file = raw as TideStationsFile;
  if (!file || file.v !== 1 || !Array.isArray(file.stations)) {
    throw new Error("tide-stations: sai định dạng hoặc sai phiên bản");
  }
  return file.stations.filter(
    (s): s is TideStation =>
      !!s &&
      typeof s.id === "string" &&
      typeof s.name === "string" &&
      Number.isFinite(s.lat) &&
      Number.isFinite(s.lon) &&
      Number.isFinite(s.z0) &&
      Array.isArray(s.cons) &&
      s.cons.length > 0 &&
      s.cons.every(isCons),
  );
}

const EARTH_KM = 6371;

/** Trạm gần nhất (km) — null khi danh sách rỗng hoặc toạ độ hỏng. */
export function nearestTideStation(
  stations: readonly TideStation[],
  lat: number,
  lon: number,
): { station: TideStation; distanceKm: number } | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  let best: { station: TideStation; distanceKm: number } | null = null;
  for (const st of stations) {
    const dLat = (st.lat - lat) * DEG;
    const dLon = (st.lon - lon) * DEG;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat * DEG) * Math.cos(st.lat * DEG) * Math.sin(dLon / 2) ** 2;
    const km = 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)));
    if (!best || km < best.distanceKm) best = { station: st, distanceKm: km };
  }
  return best;
}

/**
 * Câu nói thật về trạm ước tính từ mô hình — null nếu là trạm đo thật.
 * Trạm mô hình kém tin BẤT KỂ gần hay xa (mô hình lưới ~14 km, ở cửa lạch nông
 * lệch cả tiếng), nên câu này KHÔNG phụ thuộc khoảng cách.
 */
export function tideModelCaveat(st: TideStation): string | null {
  if (!isModelStation(st)) return null;
  return "Con nước ở đây ƯỚC TÍNH từ mô hình (chưa có trạm đo tại chỗ) — chỉ xem con nước lên hay xuống, giờ giấc có thể lệch.";
}

/**
 * Câu nói thật về độ tin cậy — BẮT BUỘC hiện cạnh bảng con nước.
 * Hai lớp, gộp lại nếu cùng có:
 *  · trạm MÔ HÌNH (truyền `station`) → luôn nhắc "ước tính từ mô hình";
 *  · trạm ở XA → nhắc giờ nước có thể lệch theo khoảng cách.
 * `station` là tuỳ chọn để không phá lời gọi cũ; NÊN truyền để trạm mô hình
 * được gắn cờ đúng (nếu không, trạm mô hình gần sẽ trông như trạm đo — sai).
 */
export function tideTrustText(
  distanceKm: number,
  station?: TideStation,
): string | null {
  const model = station ? tideModelCaveat(station) : null;
  let dist: string | null = null;
  if (Number.isFinite(distanceKm) && distanceKm > 30) {
    dist =
      distanceKm <= 120
        ? "Trạm hơi xa — giờ nước ở cửa nhà mình có thể lệch nửa tiếng tới một tiếng."
        : "Trạm ở xa — chỉ xem cho biết con nước lên hay xuống, đừng lấy làm giờ chính xác.";
  }
  // Trạm mô hình đã tự nói "chỉ xem lên/xuống" nên không lặp câu khoảng-cách nặng.
  if (model) return dist && distanceKm <= 120 ? `${model} ${dist}` : model;
  return dist;
}

/* ---------------------------------------------------------------------------
   6. Tải trạm — phần "Lead lo phần tải" ở chú thích mục 5, trả nợ 2026-09-02.

   Engine này nằm trong repo với đầy đủ test mà KHÔNG một component nào import
   — tài sản không-nối thứ NĂM (sau lớp độ sâu, ký hiệu, đối chiếu, vn-aids).
   Trong khi "thuỷ triều" là một món in đậm trên tờ quảng cáo máy hải đồ
   5 triệu mà bà con đang phải mua.

   Cùng án lệ fetchSeamarks: hỏng thì xoá đệm để lần sóng về sau thử lại.
--------------------------------------------------------------------------- */
import { timeoutSignal } from "@/lib/abort";

let cachedStations: Promise<TideStation[]> | null = null;

export async function fetchTideStations(): Promise<TideStation[]> {
  if (!cachedStations) {
    cachedStations = fetch("/data/tide-stations.v1.json", {
      signal: timeoutSignal(20000),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`tide-stations ${r.status}`);
        return r.json();
      })
      .then(decodeTideStations)
      .catch((e) => {
        cachedStations = null;
        throw e;
      });
  }
  return cachedStations;
}
