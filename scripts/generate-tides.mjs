// scripts/generate-tides.mjs
//   npx tsx scripts/generate-tides.mjs                  # sinh lại TẤT CẢ (mạng)
//   npx tsx scripts/generate-tides.mjs --add-model-only # chỉ dựng lại trạm mô
//                                                        # hình, giữ NGUYÊN trạm đo
// ─────────────────────────────────────────────────────────────────────────────
// SINH HẰNG SỐ ĐIỀU HOÀ THUỶ TRIỀU cho các trạm Việt Nam
//   → public/data/tide-stations.v1.json
//
// Hai LOẠI trạm, KHÔNG trộn lẫn (xem cờ `nguon` trong tide-stations.v1.json):
//   · nguon="gauge" — 4 trạm ĐO THẬT (UHSLC/JASL), hằng số tự phân tích từ số
//     đo mực nước từng giờ. Đây là chuẩn vàng. Phần dưới sinh ra chúng.
//   · nguon="model" — trạm ƯỚC TÍNH từ mô hình triều EOT20, cho các cửa lạch XA
//     cả 4 trạm thật (Định An, Rạch Giá, Nha Trang…). ĐỘ TIN THẤP HƠN, gắn cờ
//     rõ. Xem buildModelStations() ở cuối + docs/research/thuy-trieu-2026-09.md.
//
// ── VÌ SAO 4 TRẠM ĐO KHÔNG MƯỢN HẰNG SỐ CỦA MÔ HÌNH ─────────────────────────
// Đã rà giấy phép trước khi viết dòng nào (xem BÁO CÁO GIẤY PHÉP ở cuối file):
//   · TPXO9-atlas  — CẤM dùng thương mại ⇒ LOẠI cho MỌI mục đích.
//   · FES2022/FES2014 (AVISO) — độ cao triều dùng thương mại ĐƯỢC và đóng gói
//     ĐƯỢC, nhưng phải ĐĂNG KÝ tài khoản AVISO (duyệt vài ngày) mới tải được.
//   · EOT20 (SEANOE, CC-BY 4.0) — dùng thương mại được, tải TỰ DO không cần đăng
//     ký, gói gốc 2,3 GB netCDF. → ĐÃ DÙNG cho trạm nguon="model" (xem bên dưới).
// Mô hình là lưới ĐẠI DƯƠNG ~14 km: ở cửa lạch nông nó lệch hàng chục cm và cả
// tiếng — nên ở ĐÂU CÓ trạm đo thật gần thì luôn ưu tiên trạm đo. Mô hình chỉ
// lấp chỗ TRỐNG, nơi nội suy từ trạm thật (cách 100–300 km) còn lệch hơn.
// Vì sao mô hình vẫn được phép: bản đồ/con nước là MIỄN PHÍ (CLAUDE.md "Nguồn
// dữ liệu — đừng tự giới hạn"); ràng buộc thương mại chỉ cắn phần DỰ BÁO CÁ.
//
// ── NGUỒN (trạm đo thật) ─────────────────────────────────────────────────────
// UHSLC / JASL Research Quality Data Set (University of Hawaii Sea Level Center
// + NOAA NCEI) — mực nước từng giờ tại trạm triều ký. Giấy phép ghi ngay trong
// siêu dữ liệu ERDDAP: "The data may be used and redistributed for free but is
// not intended for legal use, since it may contain inaccuracies." Tức DÙNG VÀ
// PHÁT HÀNH LẠI TỰ DO, không phân biệt thương mại. Bắt buộc ghi nguồn + giữ
// nguyên câu "chỉ để tham khảo".
//
// ── CÁCH LÀM ────────────────────────────────────────────────────────────────
//   1. Tải mực nước từng giờ (ERDDAP CSV, chia theo năm để mất mạng chạy lại).
//   2. Chọn sóng theo TIÊU CHUẨN RAYLEIGH: bản ghi dài T giờ chỉ tách nổi hai
//      sóng cách nhau ≥ 1/T chu kỳ/giờ. Bản ghi 11 tháng mà cố tách Sa/S1/T2
//      thì ma trận suy biến và biên độ bịa ra vài chục cm.
//   3. Bình phương tối thiểu: h(t) = z + Σ f(t)·[a·cos(V+u) + b·sin(V+u)].
//      f, V+u lấy từ CHÍNH `src/lib/tides.ts` (hàm `tideArguments`) — phân tích
//      và dự báo dùng chung một bộ thiên văn thì không thể lệch quy ước.
//   4. Số 0 độ cao = MỰC NƯỚC THẤP NHẤT LÝ THUYẾT do chính bộ hằng số này sinh
//      (quét 19 năm) — xấp xỉ số 0 hải đồ. Số đo gốc lấy mốc "station zero" tuỳ
//      trạm nên KHÔNG dùng lại được.
//   5. KIỂM CHỨNG NGOÀI MẪU: bỏ hẳn đoạn cuối bản ghi ra khỏi phần phân tích,
//      dự báo lại đoạn đó rồi so với số đo thật → RMSE ghi vào JSON.
//
// ── CHẠY LẠI KHI NÀO ────────────────────────────────────────────────────────
// ~1 lần/năm (thêm năm số liệu mới) hoặc khi UHSLC bổ sung trạm Việt Nam.
// Chạy xong PHẢI chạy `npm test` — bộ test đối chiếu với số đo thật.
// ─────────────────────────────────────────────────────────────────────────────

import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import {
  TIDE_CONSTITUENTS,
  tideArguments,
  tideSpeed,
  tideHeightAt,
} from "../src/lib/tides.ts";

const ERDDAP =
  "https://uhslc.soest.hawaii.edu/erddap/tabledap/global_hourly_rqds.csv";
const OUT = "public/data/tide-stations.v1.json";
const EOT_POINTS = "scripts/eot20-points.json";
// 11 trạm = 5,6 KB; 83 trạm (4 đo + 7 vùng + 72 cảng, 2026-09-04) = 57 KB —
// vẫn một file nhỏ trong CRITICAL_SHELL, tải một lần là có con nước cả năm
const BUDGET_KB = 80;

// Chỉ dựng lại trạm mô hình (không đụng mạng, giữ nguyên trạm đo trong file cũ).
const ADD_MODEL_ONLY = process.argv.includes("--add-model-only");

/**
 * Trạm triều ký Việt Nam CÓ THẬT trong kho UHSLC (tra lại 2026-09-03 bằng
 * `global_hourly_rqds` + `global_hourly_fast`, lọc station_country = Viet Nam
 * VÀ quét theo khung toạ độ VN 8–23°N/102–112°E để bắt cả trạm gắn nhầm nước).
 * Đối chiếu chéo IOC Sea Level Monitoring Facility (ioc-sealevelmonitoring.org)
 * cùng ngày: IOC chỉ có Qui Nhon + Vung Tau, đều đã nằm trong 4 trạm này.
 * KHÔNG có trạm nào khác — Đà Nẵng, Nha Trang, Cửa Ông, Rạch Giá, Phú Quốc,
 * Côn Đảo, Cửa Việt, Định An, Trường Sa hiện KHÔNG có số đo giờ mở. Bốn trạm
 * là TRẦN của nguồn ĐO GHI GIỜ mở, không phải lựa chọn. Bịa thêm trạm ĐO là
 * bà con mắc cạn — nên các cửa lạch xa dùng trạm MÔ HÌNH (nguon="model", mục
 * 4b), gắn cờ rõ và độ tin thấp hơn, KHÔNG trộn với trạm đo. Chi tiết + trạm
 * bị loại và lý do: docs/research/thuy-trieu-2026-09.md.
 */
const STATIONS = [
  {
    id: "hon-dau",
    name: "Hòn Dấu",
    record: 6502,
    years: [1995],
    holdoutDays: 90,
    note: "Cửa Cấm – Hải Phòng, mốc chuẩn độ cao quốc gia. Nhật triều đều.",
  },
  {
    id: "vung-ang",
    name: "Vũng Áng",
    record: 6511,
    years: [1996, 1997],
    holdoutDays: 90,
    note: "Hà Tĩnh — bắc Trung Bộ. Nhật triều không đều.",
  },
  {
    id: "quy-nhon",
    name: "Quy Nhơn",
    record: 3812,
    years: [2019, 2020, 2021, 2022, 2023, 2024],
    holdoutDays: 366,
    note: "Bình Định — Nam Trung Bộ. Nhật triều không đều, biên độ nhỏ.",
  },
  {
    id: "vung-tau",
    name: "Vũng Tàu",
    record: 3832,
    years: [2019, 2020, 2021, 2022, 2023, 2024],
    holdoutDays: 366,
    note: "Bà Rịa – Vũng Tàu, cửa ngõ sông Sài Gòn. Bán nhật triều không đều.",
  },
];

/**
 * Thứ tự ƯU TIÊN khi chọn sóng (Rayleigh loại dần từ dưới lên). Sóng chính của
 * biển Việt Nam đứng trước: vịnh Bắc Bộ K1/O1 áp đảo, phía nam M2/S2.
 */
const PRIORITY = [
  "M2",
  "K1",
  "O1",
  "S2",
  "N2",
  "P1",
  "K2",
  "Q1",
  "M4",
  "MS4",
  "MF",
  "MM",
  "SSA",
  "SA",
  "MN4",
  "M6",
  "MU2",
  "NU2",
  "2N2",
  "T2",
  "J1",
  "OO1",
  "S1",
  "MK3",
  "MO3",
  "M3",
  "MSF",
  "LDA2",
  "2SM2",
  "MK4",
  "S4",
  "2MN6",
  "2MS6",
];

const YEAR_MS = 365.25 * 86400000;

/* ── 1. Tải số đo ────────────────────────────────────────────────────────── */

async function fetchYear(record, year) {
  const q =
    `${ERDDAP}?time,sea_level&record_id=${record}` +
    `&time%3E=${year}-01-01T00:00:00Z&time%3C=${year}-12-31T23:00:00Z`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(q, {
        headers: { "User-Agent": "SDFish-build/1.0 (fisherman app; tides)" },
      });
      if (res.status === 404) return []; // ERDDAP báo "không có dòng nào"
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const rows = [];
      for (const line of text.split("\n").slice(2)) {
        const c = line.indexOf(",");
        if (c < 0) continue;
        const ms = Date.parse(line.slice(0, c));
        const mm = Number.parseFloat(line.slice(c + 1));
        if (Number.isFinite(ms) && Number.isFinite(mm)) {
          rows.push({ ms, h: mm / 1000 });
        }
      }
      return rows;
    } catch (e) {
      if (attempt === 3) throw e;
      console.log(`   thử lại (${e.message})`);
    }
  }
  return [];
}

/* ── 2. Chọn sóng theo Rayleigh ──────────────────────────────────────────── */

function pickConstituents(spanHours) {
  const minSep = 1 / spanHours; // chu kỳ/giờ → độ/giờ nhân 360
  const minSepDeg = 360 * minSep;
  const chosen = [];
  for (const name of PRIORITY) {
    if (!TIDE_CONSTITUENTS.includes(name)) continue;
    const sp = tideSpeed(name);
    if (Math.abs(sp) < minSepDeg) continue; // lẫn với giá trị trung bình
    if (chosen.some((c) => Math.abs(tideSpeed(c) - sp) < minSepDeg)) continue;
    chosen.push(name);
  }
  return chosen;
}

/* ── 3. Bình phương tối thiểu ────────────────────────────────────────────── */

/** Giải hệ đối xứng bằng khử Gauss có chọn trục — n ≤ ~70 nên đủ nhanh. */
function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    }
    if (Math.abs(M[piv][col]) < 1e-12) {
      throw new Error(`hệ suy biến ở cột ${col} — bản ghi quá ngắn?`);
    }
    [M[col], M[piv]] = [M[piv], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const k = M[r][col] / M[col][col];
      if (k === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= k * M[col][c];
    }
  }
  // khử Gauss-Jordan ở trên đã làm mọi hàng chỉ còn phần tử đường chéo
  return M.map((row, i) => row[n] / row[i]);
}

/** Phân tích điều hoà → { z, cons: [{name, amp, phase}] } */
function harmonicFit(rows, names) {
  const n = 1 + 2 * names.length;
  const A = Array.from({ length: n }, () => new Float64Array(n));
  const b = new Float64Array(n);
  const x = new Float64Array(n);

  for (const row of rows) {
    const { f, vu } = tideArguments(row.ms, names);
    x[0] = 1;
    for (let i = 0; i < names.length; i++) {
      const rad = vu[i] * (Math.PI / 180);
      x[1 + 2 * i] = f[i] * Math.cos(rad);
      x[2 + 2 * i] = f[i] * Math.sin(rad);
    }
    for (let i = 0; i < n; i++) {
      if (x[i] === 0) continue;
      b[i] += x[i] * row.h;
      for (let j = i; j < n; j++) A[i][j] += x[i] * x[j];
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) A[i][j] = A[j][i];

  const sol = solve(
    A.map((r) => Array.from(r)),
    Array.from(b),
  );
  const cons = names.map((name, i) => {
    const a = sol[1 + 2 * i];
    const bb = sol[2 + 2 * i];
    // h = a·cos(V+u) + b·sin(V+u) = H·cos(V+u−g) với H=√(a²+b²), g=atan2(b,a)
    const amp = Math.hypot(a, bb);
    const phase = ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
    return { name, amp, phase };
  });
  return { z: sol[0], cons };
}

/* ── 4. Số 0 hải đồ = mực nước thấp nhất lý thuyết (quét 19 năm) ─────────── */

function lowestAstronomicalTide(cons) {
  const names = cons.map((c) => c.name);
  const start = Date.UTC(2026, 0, 1);
  const step = 30 * 60000;
  let min = Infinity;
  for (let t = start; t < start + 19 * YEAR_MS; t += step) {
    const { f, vu } = tideArguments(t, names);
    let s = 0;
    for (let i = 0; i < names.length; i++) {
      s += f[i] * cons[i].amp * Math.cos((vu[i] - cons[i].phase) * (Math.PI / 180));
    }
    if (s < min) min = s;
  }
  return min;
}

/* ── 4b. Trạm MÔ HÌNH từ EOT20 — hiệu chuẩn pha bằng chính 4 trạm đo ───────
   EOT20 công bố hằng số theo quy ước Greenwich (pha trễ G so với thế triều cân
   bằng CÓ hằng số ±90°/180°). Quy ước V(t) của tides.ts thì KHÔNG có hằng số
   đó (xem chú thích đầu tides.ts). Thay vì tự suy hằng số quy đổi C cho từng
   sóng — dễ sai 90° = 3 tiếng nước — ta ĐO C thẳng từ dữ liệu: tại 4 trạm đã
   biết pha ĐÚNG (nguon=gauge), C = G_eot − pha_ta. C là hằng số toán học (không
   đổi theo nơi) nên nếu 4 trạm cho C nhất quán thì đó CHÍNH là hằng số quy đổi;
   độ tản của nó = sai số EOT20, ta báo ra chứ không giấu. Đơn vị (cm→m) cũng đo
   luôn từ tỉ số biên độ. Kết quả tự kiểm: C rơi đúng vào bội số 90° như lý
   thuyết Doodson–Warburg, độ tản chỉ 1–6° trên 8 sóng chính. (rà 2026-09-03) */

const DEGR = Math.PI / 180;
const MAJOR = ["M2", "S2", "K1", "O1", "N2", "K2", "P1", "Q1"];

const circMean = (deg) => {
  let x = 0, y = 0;
  for (const a of deg) { x += Math.cos(a * DEGR); y += Math.sin(a * DEGR); }
  return ((Math.atan2(y, x) / DEGR) % 360 + 360) % 360;
};
const circStd = (deg) => {
  let x = 0, y = 0;
  for (const a of deg) { x += Math.cos(a * DEGR); y += Math.sin(a * DEGR); }
  x /= deg.length; y /= deg.length;
  return Math.sqrt(-2 * Math.log(Math.max(Math.hypot(x, y), 1e-9))) / DEGR;
};
const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};

function predictHeight(cons, ms) {
  const names = cons.map((c) => c.name);
  const { f, vu } = tideArguments(ms, names);
  let s = 0;
  for (let i = 0; i < cons.length; i++) {
    s += f[i] * cons[i].amp * Math.cos((vu[i] - cons[i].phase) * DEGR);
  }
  return s;
}

function buildModelStations(gaugeStations, eot) {
  const byId = Object.fromEntries(gaugeStations.map((s) => [s.id, s]));
  const calib = eot.calib.filter((c) => byId[c.gaugeId]);
  if (calib.length < 3) {
    throw new Error(`CHẶN: chỉ ${calib.length} trạm đo để hiệu chuẩn EOT20 (cần ≥ 3).`);
  }

  // 1) hệ số đơn vị amp (ta/eot) — trên các sóng chính, biên độ đủ lớn
  const ratios = [];
  for (const c of calib) {
    const g = byId[c.gaugeId];
    for (const gc of g.cons) {
      if (!MAJOR.includes(gc.name)) continue;
      const ee = c.cons[gc.name];
      if (ee && ee.amp_cm > 0 && gc.amp > 0.02) ratios.push(gc.amp / ee.amp_cm);
    }
  }
  const scale = median(ratios);
  if (!(scale > 0.005 && scale < 0.02)) {
    throw new Error(`CHẶN: hệ số đơn vị EOT20 = ${scale} — không giống cm→m.`);
  }

  // 2) dấu pha toàn cục f và độ lệch quy ước C từng sóng (chọn f cho độ tản nhỏ)
  const calibrate = (f) => {
    const per = {};
    const names = new Set();
    for (const c of calib) for (const n of Object.keys(c.cons)) names.add(n);
    for (const name of names) {
      const Cs = [];
      for (const c of calib) {
        const ee = c.cons[name];
        const gc = byId[c.gaugeId].cons.find((x) => x.name === name);
        if (!ee || !gc || ee.amp_cm * scale < 0.02) continue;
        Cs.push(((f * ee.G_deg - gc.phase) % 360 + 360) % 360);
      }
      if (Cs.length >= 2) per[name] = { C: circMean(Cs), std: circStd(Cs), n: Cs.length };
    }
    return per;
  };
  const score = (per) => {
    let s = 0, w = 0;
    for (const n of MAJOR) if (per[n]) { s += per[n].std; w++; }
    return w ? s / w : 1e9;
  };
  const plus = calibrate(1), minus = calibrate(-1);
  const f = score(plus) <= score(minus) ? 1 : -1;
  const cal = f === 1 ? plus : minus;
  console.log(
    `\n── EOT20: hệ số đơn vị ${scale.toExponential(3)}, dấu pha f=${f} ` +
      `(độ tản sóng chính +${score(plus).toFixed(1)}°/−${score(minus).toFixed(1)}°)`,
  );

  // sóng đủ tin để đưa vào trạm mô hình: độ tản C nhỏ
  const reliable = (n) => cal[n] && (MAJOR.includes(n) ? cal[n].std <= 35 : cal[n].std <= 20);
  const toCons = (consRaw) => {
    const cons = [];
    for (const [name, ee] of Object.entries(consRaw)) {
      if (!reliable(name)) continue;
      const amp = ee.amp_cm * scale;
      if (amp < 0.002) continue;
      cons.push({
        name,
        amp: Number(amp.toFixed(4)),
        phase: Number((((f * ee.G_deg - cal[name].C) % 360 + 360) % 360).toFixed(2)),
      });
    }
    return cons;
  };

  // 3) sai số EOT20↔trạm đo (bỏ lệch mốc) — con số TRUNG THỰC cho độ tin
  const errs = [];
  for (const c of calib) {
    const g = byId[c.gaugeId];
    const cons = toCons(c.cons);
    const t0 = Date.UTC(2026, 0, 1);
    let mean = 0, k = 0;
    for (let t = t0; t < t0 + 365 * 86400000; t += 3600000) {
      mean += predictHeight(cons, t) - predictHeight(g.cons, t); k++;
    }
    mean /= k;
    let se = 0;
    for (let t = t0; t < t0 + 365 * 86400000; t += 3600000) {
      const d = predictHeight(cons, t) - predictHeight(g.cons, t) - mean;
      se += d * d;
    }
    const rmse = Math.sqrt(se / k);
    errs.push(rmse);
    console.log(`   EOT20 ↔ ${g.id}: RMSE ${(rmse * 100).toFixed(1)} cm`);
  }
  const modelRmse = Number(median(errs).toFixed(3));
  console.log(`   sai số mô hình đại diện (trung vị) = ${(modelRmse * 100).toFixed(1)} cm`);

  // 4) dựng trạm mô hình
  /*  HAI HẠNG (2026-09-04, chủ dự án: "sinh hết đi, sinh ở các cảng luôn"):
        · 7 điểm cửa lạch lớn (id không có tiền tố) = hạng VÙNG — luật CHẶN
          giữ nguyên: hỏng một điểm là dừng cả lượt sinh;
        · điểm `cang-*` (toạ độ cảng cá trong danh mục) = hạng CẢNG — hỏng thì
          BỎ điểm đó và NÓI RA, không dừng: cảng nằm sâu trong sông (Mỹ Tho,
          Cần Thơ) ô EOT20 gần nhất cách 40 km trở lên (`sampleRadius` ≥ 3 do
          extract-eot20.py ghi) — số lấy ở đó là số của cửa biển, không phải
          của bến; thà thiếu trạm còn hơn có trạm nói giờ nước của chỗ khác. */
  const stations = [];
  const bo = [];
  for (const m of eot.model) {
    const laCang = m.id.startsWith("cang-");
    const loi = (msg) => {
      if (!laCang) throw new Error(`CHẶN: trạm mô hình ${m.id} ${msg}`);
      bo.push(`${m.id}: ${msg}`);
      return null;
    };
    if (laCang && (m.sampleRadius ?? 0) >= 3) {
      loi(`ô EOT20 ướt gần nhất cách ≥ ${m.sampleRadius} ô (~${m.sampleRadius * 14} km) — nằm sâu trong sông`);
      continue;
    }
    const cons = toCons(m.cons);
    if (cons.length < 6) {
      loi(`chỉ còn ${cons.length} sóng`);
      continue;
    }
    const z0 = Number((-lowestAstronomicalTide(cons)).toFixed(3));
    if (!(z0 > 0.2 && z0 < 3.5)) {
      loi(`z0=${z0} m — ngoài khoảng hợp lý`);
      continue;
    }
    stations.push({
      id: m.id,
      name: m.name,
      lat: Number(m.lat.toFixed(4)),
      lon: Number(m.lon.toFixed(4)),
      z0,
      source: "EOT20 (DGFI-TUM), doi:10.17882/79489",
      span: `mô hình ${eot.extractedAt}`,
      rmseM: modelRmse,
      nguon: "model",
      ...(laCang ? { hang: "cang" } : {}),
      note: `${m.note} Ước tính từ mô hình EOT20 — kém tin hơn trạm đo.`,
      cons,
    });
    const F = (n) => cons.find((c) => c.name === n)?.amp ?? 0;
    console.log(
      `   ${m.id}: ${cons.length} sóng · z0 ${z0} m · ` +
        `F=${((F("K1") + F("O1")) / (F("M2") + F("S2") + 1e-9)).toFixed(2)}${laCang ? " · cảng" : ""}`,
    );
  }
  if (bo.length) {
    console.log(`\n   BỎ ${bo.length} điểm cảng (nói ra, không dừng):`);
    for (const b of bo) console.log(`   ✗ ${b}`);
  }
  return stations;
}

/* ── 5. Chạy ─────────────────────────────────────────────────────────────── */

let out = [];
if (ADD_MODEL_ONLY) {
  const prev = JSON.parse(readFileSync(OUT, "utf8"));
  out = prev.stations.filter((s) => s.nguon !== "model");
  console.log(
    `--add-model-only: giữ ${out.length} trạm đo thật từ ${OUT}, dựng lại trạm mô hình.`,
  );
}

for (const st of ADD_MODEL_ONLY ? [] : STATIONS) {
  console.log(`\n── ${st.name} (bản ghi UHSLC ${st.record}) ──`);
  let rows = [];
  for (const y of st.years) {
    const r = await fetchYear(st.record, y);
    console.log(`   ${y}: ${r.length} giờ`);
    rows = rows.concat(r);
  }
  rows.sort((a, b) => a.ms - b.ms);
  if (rows.length < 24 * 200) {
    throw new Error(`CHẶN: ${st.name} chỉ có ${rows.length} giờ — quá ngắn.`);
  }

  const spanHours = (rows[rows.length - 1].ms - rows[0].ms) / 3600000;
  const names = pickConstituents(spanHours);
  console.log(
    `   ${Math.round(spanHours / 24)} ngày · giữ ${names.length}/${PRIORITY.length} sóng`,
  );

  // kiểm chứng NGOÀI MẪU: cắt đuôi ra, phân tích phần còn lại, dự báo phần đuôi
  const cut = rows[rows.length - 1].ms - st.holdoutDays * 86400000;
  const train = rows.filter((r) => r.ms < cut);
  const test = rows.filter((r) => r.ms >= cut);
  const trainSpan = (train[train.length - 1].ms - train[0].ms) / 3600000;
  const trainFit = harmonicFit(train, pickConstituents(trainSpan));

  let rmse = null;
  if (test.length > 24 * 20) {
    const nm = trainFit.cons.map((c) => c.name);
    const predict = (ms) => {
      const { f, vu } = tideArguments(ms, nm);
      let s = 0;
      for (let i = 0; i < nm.length; i++) {
        s +=
          f[i] * trainFit.cons[i].amp * Math.cos((vu[i] - trainFit.cons[i].phase) * (Math.PI / 180));
      }
      return s;
    };
    const resid = test.map((r) => r.h - predict(r.ms));
    const mean = resid.reduce((a, v) => a + v, 0) / resid.length;
    rmse = Math.sqrt(
      resid.reduce((a, v) => a + (v - mean) ** 2, 0) / resid.length,
    );
    console.log(
      `   kiểm chứng ngoài mẫu ${Math.round((test[test.length - 1].ms - test[0].ms) / 86400000)} ngày: RMSE ${(rmse * 100).toFixed(1)} cm`,
    );
  }

  // hằng số CÔNG BỐ = phân tích trên TOÀN BỘ bản ghi
  const full = harmonicFit(rows, names);
  const cons = full.cons
    .filter((c) => c.amp >= 0.002) // dưới 2 mm là nhiễu, chỉ tốn dung lượng
    .map((c) => ({
      name: c.name,
      amp: Number(c.amp.toFixed(4)),
      phase: Number(c.phase.toFixed(2)),
    }));

  const z0 = Number((-lowestAstronomicalTide(cons)).toFixed(3));

  // ── CỔNG TỰ KIỂM 1: bộ hằng số phải có sóng chính đủ lớn ────────────────
  const main = cons.filter((c) => ["M2", "K1", "O1"].includes(c.name));
  if (!main.some((c) => c.amp > 0.05)) {
    throw new Error(`CHẶN: ${st.name} không có sóng chính nào > 5 cm — fit hỏng.`);
  }
  // ── CỔNG TỰ KIỂM 2: số 0 hải đồ phải nằm trong khoảng có thật ───────────
  if (!(z0 > 0.3 && z0 < 3.5)) {
    throw new Error(`CHẶN: ${st.name} z0 = ${z0} m — ngoài khoảng hợp lý.`);
  }
  // ── CỔNG TỰ KIỂM 3: sai số ngoài mẫu ────────────────────────────────────
  if (rmse !== null && rmse > 0.35) {
    throw new Error(
      `CHẶN: ${st.name} RMSE ngoài mẫu ${(rmse * 100).toFixed(0)} cm > 35 cm.`,
    );
  }

  const y0 = new Date(rows[0].ms).getUTCFullYear();
  const y1 = new Date(rows[rows.length - 1].ms).getUTCFullYear();
  out.push({
    id: st.id,
    name: st.name,
    lat: 0,
    lon: 0,
    z0,
    source: `UHSLC/JASL RQDS #${st.record}`,
    span: y0 === y1 ? `${y0}` : `${y0}–${y1}`,
    rmseM: rmse === null ? null : Number(rmse.toFixed(3)),
    // KHÔNG ghi nguon cho trạm đo: vắng cờ = "gauge" (xem tides.ts). Nhờ vậy 4
    // trạm cũ giữ NGUYÊN từng byte, và full-regen với --add-model-only cho ra
    // cùng một file. Chỉ trạm mô hình mới mang cờ nguon="model".
    note: st.note,
    cons,
  });
  console.log(
    `   z0 = ${z0} m · ${cons.length} sóng · ` +
      cons
        .filter((c) => ["M2", "S2", "K1", "O1"].includes(c.name))
        .map((c) => `${c.name} ${(c.amp * 100).toFixed(0)}cm`)
        .join(" "),
  );
}

/* ── 6. Toạ độ trạm (lấy từ chính ERDDAP, không gõ tay) ──────────────────── */

for (const st of ADD_MODEL_ONLY ? [] : out) {
  const rec = STATIONS.find((s) => s.id === st.id).record;
  const res = await fetch(
    `https://uhslc.soest.hawaii.edu/erddap/tabledap/global_hourly_rqds.csv?` +
      `latitude,longitude&record_id=${rec}&distinct()`,
  );
  const line = (await res.text()).split("\n")[2] ?? "";
  const [la, lo] = line.split(",").map(Number);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) {
    throw new Error(`CHẶN: không lấy được toạ độ trạm ${st.name}`);
  }
  st.lat = Number(la.toFixed(4));
  st.lon = Number(lo.toFixed(4));
}

/* ── 6b. Trạm mô hình EOT20 (cửa lạch xa cả 4 trạm đo) ───────────────────── */

const modelStations = buildModelStations(
  out,
  JSON.parse(readFileSync(EOT_POINTS, "utf8")),
);
out = [...out, ...modelStations];

/* ── 7. Ghi file + cổng cuối ─────────────────────────────────────────────── */

const file = {
  v: 1,
  phaseConvention:
    "Pha trễ so với V(t) định nghĩa trong src/lib/tides.ts (KHÔNG cộng hằng số ±90°/180° của khai triển thế triều). Đừng trộn với hằng số công bố nơi khác.",
  credit:
    "Trạm đo (nguon=gauge): UHSLC/JASL Research Quality Data Set (University of Hawaii Sea Level Center & NOAA NCEI). Trạm ước tính (nguon=model): mô hình triều EOT20 (Hart-Davis et al. 2021, DGFI-TUM; SEANOE CC-BY 4.0, doi:10.17882/79489). Hằng số điều hoà do SDFish tự phân tích/quy đổi. Chỉ để tham khảo.",
  stations: out,
};
const json = JSON.stringify(file);

// CỔNG TỰ KIỂM 4: file phải đọc lại được bằng chính hàm dự báo của app
for (const st of file.stations) {
  const h = tideHeightAt(st, Date.UTC(2026, 5, 15, 3, 0));
  if (!Number.isFinite(h) || h < -1 || h > 8) {
    throw new Error(`CHẶN: ${st.name} dự báo ra ${h} m — vô lý.`);
  }
}
// CỔNG TỰ KIỂM 5: ngân sách dung lượng (bà con tải qua sóng 3G)
const kb = Math.round(json.length / 1024);
if (kb > BUDGET_KB) {
  throw new Error(`CHẶN: ${kb} KB > ngân sách ${BUDGET_KB} KB.`);
}

mkdirSync("public/data", { recursive: true });
writeFileSync(OUT, json);
console.log(
  `\nOK: ${OUT} — ${out.length} trạm, ${kb} KB (ngân sách ${BUDGET_KB} KB)`,
);
