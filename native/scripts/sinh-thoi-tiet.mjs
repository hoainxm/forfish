// VECTOR VÀNG CHO THỜI TIẾT (đợt 2d: trường màu · hạt gió · thẻ chạm điểm) — chạy CHÍNH code web:
//   src/lib/scalar-field.ts · scalar-gl.ts · particle-field.ts · marine-weather.ts · sea.ts · sea-cells.ts
//   (+ weather-codes, am-lich, moon, day-labels, tides.tideHeightText, forecast-grid.gridPoints/stepHourIndices)
//   node native/scripts/sinh-thoi-tiet.mjs ⇒ native/shared/src/jvmTest/resources/thoi-tiet/vang.json ⇒ ThoiTietVangTest.kt
// Hai đường tải (fetchScalarFieldsLive, fetchSeaPoint) chạy THẬT với `fetch` giả trả JSON dựng tay — tức là bộ giải
// của web, không phải bản chép. Đầu vào lưới 156 điểm sinh bằng `rnd` (mulberry32) — ThoiTietVangTest dựng lại Y HỆT
// bằng cùng thuật toán, nên vector chỉ giữ ĐẦU RA (gọn, repo chống phình).
// ẢNH TRƯỜNG: fragment shader web (src/components/scalar-gl-field.ts) không chạy được trong node ⇒ `anhThamChieu`
// dưới đây là bản THAM CHIẾU đặc tả GL (LINEAR + CLAMP_TO_EDGE, smoothstep, discard) dựng trên texture/ramp/quad
// CỦA WEB (buildValueTexture, buildRampTexture, gridBounds, EXT_DEG + mercQuad chép y). Chỉ lưu tổng kiểm + vài điểm ảnh.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "../../node_modules/jiti/lib/jiti.mjs";

const goc = dirname(fileURLToPath(import.meta.url));
const repo = join(goc, "../..");
const kho = new Map();
globalThis.localStorage = {
  getItem: (k) => (kho.has(k) ? kho.get(k) : null),
  setItem: (k, v) => void kho.set(k, String(v)),
  removeItem: (k) => void kho.delete(k),
  clear: () => kho.clear(),
  key: (i) => [...kho.keys()][i] ?? null,
  get length() {
    return kho.size;
  },
};
const jiti = createJiti(import.meta.url, { alias: { "@": join(repo, "src") } });
const im = (p) => jiti.import(join(repo, p));
const sf = await im("src/lib/scalar-field.ts");
const sg = await im("src/lib/scalar-gl.ts");
const fg = await im("src/lib/forecast-grid.ts");
const pf = await im("src/lib/particle-field.ts");
const mw = await im("src/lib/marine-weather.ts");
const sea = await im("src/lib/sea.ts");
const sc = await im("src/lib/sea-cells.ts");
const wc = await im("src/lib/weather-codes.ts");
const al = await im("src/lib/am-lich.ts");
const dl = await im("src/lib/day-labels.ts");
const { tideHeightText } = await im("src/lib/tides.ts");

/* ── fetch giả: trả JSON theo đoạn URL ── */
let traLoi = () => ({ status: 404, body: null });
globalThis.fetch = async (url) => {
  const { status, body } = traLoi(String(url));
  return new Response(body == null ? "" : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
};

/* ── mulberry32 — ThoiTietVangTest.rnd dựng lại y ── */
function taoRnd(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  };
}

/* Phản hồi Open-Meteo 156 điểm cho lớp dải màu — LUẬT SINH phải trùng ThoiTietVangTest.phanHoiTruong */
const SO_GIO = 13;
function phanHoiTruong() {
  const rnd = taoRnd(2026);
  const time = Array.from({ length: SO_GIO }, (_, h) => `2026-11-04T${String(h % 24).padStart(2, "0")}:00`);
  const bien = [
    ["cloud_cover", (r) => r % 101],
    ["precipitation", (r) => (r % 300) / 10],
    ["temperature_2m", (r) => 20 + (r % 150) / 10],
    ["cape", (r) => r % 4500],
    ["pressure_msl", (r) => 990 + (r % 450) / 10],
  ];
  return fg.gridPoints().map((p, k) => {
    if (k === 7) return { latitude: p.lat, longitude: p.lon }; // điểm không có hourly
    const hourly = { time };
    for (const [ten, f] of bien) {
      if (k === 8 && ten === "cape") continue; // thiếu một biến
      hourly[ten] = time.map(() => {
        const r = rnd();
        if (r % 17 === 0) return null; // trên bờ / thiếu
        if (r % 53 === 0) return String(f(r)); // số dạng chữ ⇒ web bỏ (num)
        return f(r);
      });
    }
    return { latitude: p.lat, longitude: p.lon, hourly };
  });
}

const hex = (a) => Array.from(a, (x) => x.toString(16).padStart(2, "0")).join("");
const KINDS = ["cloud", "rain", "airtemp", "storm", "pressure", "salinity", "windspeed", "waveheight", "currentspeed"];

/* ── 1. TRƯỜNG MÀU ── */
const respTruong = phanHoiTruong();
const truongLive = {};
for (const days of [1, 3, 16]) {
  traLoi = (u) => (u.includes("api.open-meteo.com") ? { status: 200, body: respTruong } : { status: 404, body: null });
  const all = await sf.fetchScalarFieldsLive(days);
  truongLive[days] = Object.fromEntries(
    // khung 3 lưu ĐỦ số; khung 1/16 chỉ mốc giờ + 2 ô đầu (giải giống hệt, khác mỗi chỉ số giờ — gọn vector)
    Object.entries(all).map(([k, g]) => [k, { kind: g.kind, nLat: g.nLat, nLon: g.nLon, times: g.times, soO: g.cells.length, v: (days === 3 ? g.cells : g.cells.slice(0, 2)).map((c) => c.values) }]),
  );
}
// một object (không mảng) ⇒ chỉ điểm 0 có số
traLoi = () => ({ status: 200, body: respTruong[0] });
const motDiem = await sf.fetchScalarFieldsLive(3);
const truongMotDiem = { soOCoSo: motDiem.cloud.cells.filter((c) => c.values.some((v) => v != null)).length, o0: motDiem.cloud.cells[0].values };

const mauMau = KINDS.map((k) => {
  const s = sf.SCALAR_RAMP[k];
  const vs = [s[0].value - 1, ...s.map((x) => x.value), ...s.slice(1).map((x, i) => (x.value + s[i].value) / 2), s[0].value + (s[1].value - s[0].value) * 0.137, s[s.length - 1].value + 5, NaN];
  return [k, vs.map((v) => [Number.isFinite(v) ? v : null, sf.scalarColor(k, v)])];
});

// lưới nhỏ 5×6 có ô null (đất) cho fill / texture / ảnh
function luoiNho(kind, timeIdx = 0) {
  const nLat = 5,
    nLon = 6;
  const [lo, hi] = sg.rampRange(kind);
  const cells = [];
  for (let i = 0; i < nLat; i++)
    for (let j = 0; j < nLon; j++) {
      const dat = (i >= 3 && j <= 1) || (i === 0 && j === 5) || (i === 2 && j === 3);
      const v = lo + ((i * 7 + j * 3) % 11) * ((hi - lo) / 10);
      cells.push({ lat: 8 + i * 1.5, lon: 105 + j * 2, values: [dat ? null : v, i === 1 ? null : v * 0.9] });
    }
  return { kind, cells, times: ["a", "b"], nLat, nLon, timeIdx };
}
const truongNho = KINDS.map((k) => {
  const g = luoiNho(k);
  const g2 = { ...g, noFill: true };
  return {
    kind: k,
    ramp: hex(sg.buildRampTexture(k)),
    tex0: hex(sg.buildValueTexture(g, 0).data),
    tex1: hex(sg.buildValueTexture(g, 1).data),
    texNoFill: hex(sg.buildValueTexture(g2, 0).data),
  };
});
const vals = luoiNho("cloud").cells.map((c) => c.values[0]);
const vals2 = Array.from({ length: 20 }, (_, i) => (i === 3 || i === 17 ? 5 : null)); // 4×5 thưa
const loc = {
  fill: sf.fillCoastalGaps(vals, 5, 6),
  fill1: sf.fillCoastalGaps(vals, 5, 6, 1),
  fill5: sf.fillCoastalGaps(vals2, 4, 5, 5),
  near: sg.nearestValueFill(vals, 5, 6),
  near2: sg.nearestValueFill(vals2, 4, 5),
  nearRong: sg.nearestValueFill(Array(6).fill(null), 2, 3),
};
const gLive = (() => {
  traLoi = () => ({ status: 200, body: respTruong });
  return sf.fetchScalarFieldsLive(3);
})();
const live3 = await gLive;
const diemDoc = [
  [1, 98],
  [12.3, 109.2],
  [24, 123],
  [-5, 90],
  [11.45, 110.08],
  [3.09, 100.08],
];
const docSo = ["cloud", "rain", "storm"].map((k) => [k, diemDoc.map(([la, lo]) => [0, 4, 99].map((t) => sf.scalarValueAt(live3[k], t, la, lo)))]);
const texLive = Object.fromEntries(["cloud", "airtemp", "storm"].map((k) => [k, [0, 5].map((t) => hex(sg.buildValueTexture(live3[k], t).data))]));
const hop = [sg.gridBounds(live3.cloud), sg.gridBounds(luoiNho("rain"))];

/* ── ẢNH THAM CHIẾU (đặc tả GL) — xem đầu file ── */
const EXT_DEG = 20; // CHÉP Y scalar-gl-field.ts
const mercY = (lat) => (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360;
function anhThamChieu(grid, t, heSo, moRong) {
  const tex = sg.buildValueTexture(grid, t);
  if (!tex) return null;
  const ramp = sg.buildRampTexture(grid.kind);
  const b = sg.gridBounds(grid);
  const dw = b.east - b.west || 1;
  const dh = b.north - b.south || 1;
  const qW = b.west - EXT_DEG,
    qE = b.east + EXT_DEG,
    qS = Math.max(-85, b.south - EXT_DEG),
    qN = Math.min(85, b.north + EXT_DEG);
  const qmS = mercY(qS),
    qmN = mercY(qN);
  const vS = (qS - b.south) / dh,
    vN = (qN - b.south) / dh;
  const [tay, dong, nam, bac] = moRong ? [qW, qE, qS, qN] : [b.west, b.east, b.south, b.north];
  const w0 = b.nLon * heSo,
    h0 = b.nLat * heSo;
  const w = moRong ? Math.max(1, Math.round((w0 * (qE - qW)) / dw)) : w0;
  const h = moRong ? Math.max(1, Math.round((h0 * (qmS - qmN)) / (mercY(b.south) - mercY(b.north) || 1))) : h0;
  const mB = mercY(bac),
    mN = mercY(nam);
  const px = new Array(w * h).fill(0);
  const { nLon, nLat, data } = tex;
  const ss = (a, bb, x) => {
    const q = Math.min(1, Math.max(0, (x - a) / (bb - a)));
    return q * q * (3 - 2 * q);
  };
  for (let y = 0; y < h; y++) {
    const my = mB + ((y + 0.5) / h) * (mN - mB);
    const v = vN + ((my - qmN) / (qmS - qmN)) * (vS - vN);
    const ty = Math.min(nLat - 1, Math.max(0, v * nLat - 0.5));
    const i0 = Math.floor(ty),
      i1 = Math.min(i0 + 1, nLat - 1),
      fy = ty - i0;
    for (let x = 0; x < w; x++) {
      const lon = tay + ((x + 0.5) / w) * (dong - tay);
      const u = (lon - b.west) / dw;
      const tx = Math.min(nLon - 1, Math.max(0, u * nLon - 0.5));
      const j0 = Math.floor(tx),
        j1 = Math.min(j0 + 1, nLon - 1),
        fx = tx - j0;
      const kenh = (k) =>
        ((data[(i0 * nLon + j0) * 4 + k] * (1 - fx) + data[(i0 * nLon + j1) * 4 + k] * fx) * (1 - fy) +
          (data[(i1 * nLon + j0) * 4 + k] * (1 - fx) + data[(i1 * nLon + j1) * 4 + k] * fx) * fy) /
        255;
      const g = kenh(1);
      if (g < 0.12) continue;
      const rx = Math.min(255, Math.max(0, kenh(0) * 256 - 0.5));
      const k0 = Math.floor(rx),
        k1 = Math.min(k0 + 1, 255),
        f = rx - k0;
      const rp = (k) => (ramp[k0 * 4 + k] * (1 - f) + ramp[k1 * 4 + k] * f) / 255;
      const a = Math.round(rp(3) * ss(0.12, 0.62, g) * 255);
      px[y * w + x] = [a, Math.round(rp(0) * 255), Math.round(rp(1) * 255), Math.round(rp(2) * 255)];
    }
  }
  const tong = [0, 0, 0, 0];
  let soDiem = 0;
  for (const p of px) if (p) (soDiem++, p.forEach((c, i) => (tong[i] += c)));
  const rndA = taoRnd(7);
  const mau = Array.from({ length: 40 }, () => {
    const i = rndA() % (w * h);
    return [i, px[i] || [0, 0, 0, 0]];
  });
  return { w, h, tay, nam, dong, bac, soDiem, tong, mau };
}
const anh = [
  ["nho-cloud", luoiNho("cloud"), 0, 4, false],
  ["nho-cloud-rong", luoiNho("cloud"), 0, 4, true],
  ["nho-pressure", luoiNho("pressure"), 1, 3, false],
  ["nho-rain-nofill", { ...luoiNho("rain"), noFill: true }, 0, 5, false],
  ["live-storm", live3.storm, 2, 3, false],
  ["live-airtemp-rong", live3.airtemp, 0, 2, true],
].map(([ten, g, t, hs, mr]) => ({ ten, kind: g.kind, t, heSo: hs, moRong: mr, noFill: !!g.noFill, nguon: ten.startsWith("live") ? "live" : "nho", ...anhThamChieu(g, t, hs, mr) }));

const truong = {
  diem: fg.gridPoints().map((p) => [p.lat, p.lon]),
  buoc: [
    [3, 80],
    [16, 400],
    [1, 30],
    [0, 5],
    [3, 0],
    [2.5, 100],
  ].map(([d, n]) => [d, n, fg.stepHourIndices(d, n)]),
  live: truongLive,
  motDiem: truongMotDiem,
  mau: mauMau,
  meta: KINDS.map((k) => [k, sf.SCALAR_META[k]]),
  range: KINDS.map((k) => [k, sg.rampRange(k)]),
  nho: truongNho,
  loc,
  docSo,
  texLive,
  hop,
  anh,
};

/* ── 2. HẠT ── */
function luoiHat() {
  const cells = [];
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 5; j++) {
      const k = i * 5 + j;
      const dat = k === 6 || k === 13 || k === 19;
      const h0 = dat ? { windKmh: 10 + k, windDirDeg: (k * 37) % 360 } : { windKmh: 5 + k * 2.3, windDirDeg: (k * 41) % 360, waveM: 0.4 + k * 0.11, waveDirDeg: (k * 53 + 7) % 360, curKmh: 0.1 * k, curDirDeg: (k * 29) % 360 };
      const h1 = k === 2 ? null : { windKmh: 30 - k, windDirDeg: -45 + k * 10, waveM: k === 4 ? null : 1.5, waveDirDeg: 400 - k, curKmh: k === 5 ? -0.3 : 2.2, curDirDeg: k === 9 ? null : 365 + k };
      cells.push({ lat: 8 + i * 1.7, lon: 104 + j * 2.11, hours: [h0, h1] });
    }
  return { cells, times: ["a", "b"] };
}
const lh = luoiHat();
const uvJson = (f) => (f ? { nLat: f.nLat, nLon: f.nLon, lat0: f.lat0, lon0: f.lon0, dLat: f.dLat, dLon: f.dLon, u: Array.from(f.u, (x) => (Number.isNaN(x) ? null : x)), v: Array.from(f.v, (x) => (Number.isNaN(x) ? null : x)) } : null);
const diemHat = [
  [8, 104],
  [9.3, 106.5],
  [10.5, 110.2],
  [13.1, 112.44],
  [13.2, 112.44],
  [7.9, 105],
  [11, 108.5],
  [12.2, 107.3],
  [9.7, 108.22],
];
const truongHat = ["wind", "wave", "current"].flatMap((k) => [0, 1].map((t) => [k, t, pf.buildUVField(lh, t, k)]));
const hat = {
  K: [pf.buildUVField({ cells: [{ lat: 0, lon: 0, hours: [{ waveM: 1, waveDirDeg: 0 }] }, { lat: 0, lon: 1, hours: [{ waveM: 1, waveDirDeg: 0 }] }, { lat: 1, lon: 0, hours: [{ curKmh: 2, curDirDeg: 0 }] }, { lat: 1, lon: 1, hours: [{ curKmh: 2, curDirDeg: 0 }] }], times: ["a"] }, 0, "wave").v[0], pf.buildUVField({ cells: [{ lat: 0, lon: 0, hours: [{ curKmh: 2, curDirDeg: 0 }] }, { lat: 0, lon: 1, hours: [] }, { lat: 1, lon: 0, hours: [] }, { lat: 1, lon: 1, hours: [] }], times: ["a"] }, 0, "current").v[0]],
  uv: truongHat.map(([k, t, f]) => [k, t, uvJson(f)]),
  hong: [pf.buildUVField({ cells: [], times: [] }, 0, "wind"), pf.buildUVField({ cells: lh.cells.slice(0, 7), times: [] }, 0, "wind"), pf.buildUVField({ cells: lh.cells.slice(0, 5), times: [] }, 0, "wind")].map((x) => x === null),
  mau: truongHat.map(([k, t, f]) => [k, t, diemHat.map(([la, lo]) => pf.sampleUV(f, la, lo))]),
  buoc: truongHat.map(([k, t, f]) => [k, t, diemHat.map(([la, lo]) => [pf.stepParticle(f, la, lo, 1 / 60), pf.stepParticle(f, la, lo, 0.5, 300)])]),
  lap: truongHat.map(([k, t, f]) => [k, t, uvJson(pf.fillMissingUV(f, (la, lo) => la < 12 || lo > 110)), uvJson(pf.fillMissingUV(f, () => true, 1))]),
};

/* ── 3. THẺ CHẠM ĐIỂM ── */
const soVN = [0, 0.25, 0.35, 0.05, 0.15, 1.005, 2.675, -0.04, -0.05, -0, 1.45, 12.35, 99.95, 1e-7, 123456.789];
const so = {
  beaufort: [0, 0.5, 1, 4.99, 5, 19, 61.2, 133.9, 134, 202, 296, -3, NaN].map((x) => [Number.isNaN(x) ? null : x, mw.beaufort(x)]),
  huong: [0, 22.4, 22.5, 67.5, 180, 337.5, 359, 360, -10, -22.5, 725, 202.5].map((x) => [x, mw.windDirectionVN(x), mw.windDescribeVN(x)]),
  fmt: soVN.flatMap((x) => [0, 1, 2, 3].map((d) => [x, d, mw.formatNumberVN(x, d)])),
  uocSong: [0, 10, 33, 50, -5, 4, 12].map((x) => [x, sea.estimateWaveFromWind(x)]),
  diem: [
    [0.5, 10, 20, 0, null],
    [1.3, 25, 60, 12, 3],
    [3, 60, 90, 40, 95],
    [0.8, 20, 50, 10, 96],
    [2.2, 33, 51, 10.5, 61],
    [0.9, 21.25, 0, 0, 80],
  ].map(([w, wi, g, p, c]) => [w, wi, g, p, c, sea.scoreDay({ date: "x", waveMaxM: w, windMaxKmh: wi, gustMaxKmh: g, precipMm: p, wmoCode: c })]),
  muc: [100, 75, 74, 50, 49, 5].map((s) => [s, sea.levelOf(s)]),
  state: sea.SEA_STATE,
  levelLabel: sea.LEVEL_LABEL,
  tin: [0, 2, 3, 6, 7, 9, 10, 15].flatMap((d) => [null, 0.3, 0.5, 0.8, 0.95].map((c) => [d, c, mw.forecastConfidence(d, c)])),
  wmo: [null, 0, 3, 45, 48, 51, 57, 58, 61, 63, 64, 65, 80, 81, 82, 95, 99].map((c) => [c, wc.weatherFromCode(c)]),
  nuoc: [0, 1.24, 1.25, -0.04, -0.05, -1.26, 12.34, 1234.5, 0.05].map((m) => [m, tideHeightText(m)]),
};
const dongVao = {
  times: ["2026-11-04T00:00", "2026-11-04T11:00", "2026-11-04T13:00", "2026-11-05T12:00", "2026-11-05T09:00", "2026-11-06", "2026-11-07T1x:00", null, "bad", "2026-11-08T15:00", "2026-11-08T09:00", 20261109, "2026-11-04T12:00"],
  vel: [1, 2, 3, 0.5, 0.7, 0.9, 1, 1, 1, 2.2, 2.4, 3, null],
  dir: [10, 20, 30, null, 50, 60, 70, 80, 90, "100", 110, 120, 130],
};
const dong = [...mw.dailyCurrentFromHourly(dongVao.times, dongVao.vel, dongVao.dir)];

// giải 3 phản hồi qua CHÍNH fetchSeaPoint (fetch giả); mỗi ca toạ độ riêng + xoá kho để không lùi về bản lưu
const ngay = ["2026-11-04", "2026-11-05", "2026-11-06"];
const gioVao = {
  current: { wind_speed_10m: 23.4, wind_gusts_10m: 41, wind_direction_10m: 212 },
  daily: { time: ngay, wind_speed_10m_max: [30, 12.5, null], wind_gusts_10m_max: [55, "20", 0], wind_direction_10m_dominant: [200, null, 45], precipitation_sum: [12.5, 0, null], weather_code: [95, 61, 3] },
};
const songVao = { current: { wave_height: 1.24, wave_period: 6.5 }, daily: { wave_height_max: [2.3, null, 0.7] } };
const dongJson = { current: { ocean_current_velocity: 1.1, ocean_current_direction: 95 }, hourly: { time: ["2026-11-04T09:00", "2026-11-04T12:00", "2026-11-05T15:00"], ocean_current_velocity: [0.5, 0.8, 1.9], ocean_current_direction: [10, 20, null] } };
const caSea = [
  ["du", gioVao, songVao, dongJson, 16],
  ["homNay", gioVao, songVao, dongJson, 1],
  ["songHong", gioVao, null, dongJson, 16],
  ["dongHong", gioVao, songVao, null, 16],
  ["datLien", gioVao, { current: { wave_height: null }, daily: { wave_height_max: [null, null, null] } }, null, 16],
  ["thieuCurrent", { daily: gioVao.daily }, { daily: {} }, { hourly: {} }, 16],
  ["trong", { daily: { time: [] } }, songVao, dongJson, 16],
  ["gioHong", null, songVao, dongJson, 16],
];
const seaRa = [];
let caI = 0;
for (const [ten, w, s, c, n] of caSea) {
  kho.clear();
  caI++;
  traLoi = (u) => {
    if (u.includes("wind_speed_10m")) return w == null ? { status: 503, body: null } : { status: 200, body: w };
    if (u.includes("wave_height")) return s == null ? { status: 503, body: null } : { status: 200, body: s };
    if (u.includes("ocean_current")) return c == null ? { status: 503, body: null } : { status: 200, body: c };
    return { status: 404, body: null };
  };
  const lat = 10 + caI,
    lon = 108 + caI / 10;
  try {
    const r = await mw.fetchSeaPoint({ lat, lon }, n);
    seaRa.push({ ten, lat, lon, n, vao: [w, s, c], ra: r });
  } catch (e) {
    seaRa.push({ ten, lat, lon, n, vao: [w, s, c], loi: true });
  }
}

// ô ngăn gió sóng
const ngayCo = (o) => ({ date: "2026-11-04", waveMaxM: 1.36, windMaxKmh: 33, gustMaxKmh: 52, precipMm: 3, wmoCode: 61, waveEstimated: false, score: 70, level: "caution", curKmh: 0.8, curDirDeg: 135, windDirDeg: 200, ...o });
const condCo = (o) => ({ windKmh: 21, windDirDeg: 45, waveM: 0.86, curKmh: 1.2, curDirDeg: 300, stale: false, ...o });
const T0 = Date.UTC(2026, 10, 4, 3, 0);
const caO = [
  { day: ngayCo(), cond: condCo(), isToday: true, tide: { now: { m: 1.24, trend: "len" }, events: [{ kind: "high", atMs: T0 + 5 * 3600000, heightM: 2.15 }, { kind: "low", atMs: T0 + 13 * 3600000 + 7 * 60000, heightM: -0.04, ngayMai: true }] }, fish: { tempC: 28.35, names: ["Cá ngừ", "Mực"] }, season: ["Cá thu"], depth: { label: "~ 4 m — cạn", tone: "danger" } },
  { day: ngayCo({ waveEstimated: true, gustMaxKmh: 0, wmoCode: 95 }), cond: condCo({ stale: true }), isToday: true, tide: null, fish: null, season: ["Cá thu", "Cá nục"], depth: { label: "~ 40 m", tone: "warn" } },
  { day: ngayCo({ date: "2026-11-05", waveMaxM: 0, windDirDeg: undefined, curKmh: undefined, curDirDeg: undefined, wmoCode: 45 }), cond: condCo(), isToday: false, tide: { now: null, events: [{ kind: "low", atMs: T0 - 4 * 3600000, heightM: 0.3 }] }, fish: null, season: [], depth: { label: "~ 80 m", tone: "plain" } },
  { day: ngayCo({ waveMaxM: 0.9, waveEstimated: true }), cond: condCo({ windKmh: 40, waveM: 0.86, curKmh: null, windDirDeg: null }), isToday: true, tide: { now: { m: 0, trend: "dung" }, events: [] }, fish: null, season: [], depth: null },
  { day: ngayCo({ waveMaxM: 1.44, wmoCode: null, curDirDeg: null }), cond: condCo({ waveM: 1.36, windKmh: null, curKmh: null }), isToday: true, tide: { now: { m: -0.5, trend: "xuong" }, events: [] }, fish: { tempC: 30, names: [] }, season: ["x"], depth: null },
  { day: ngayCo({ date: "2026-02-31", wmoCode: 80 }), cond: condCo(), isToday: false, tide: null, fish: null, season: [], depth: null },
  { day: ngayCo({ date: "khong-ro", wmoCode: 82 }), cond: condCo(), isToday: false, tide: null, fish: null, season: [], depth: null },
  ...["2026-01-29", "2026-02-17", "2025-07-25", "2025-08-23", "2026-11-24", "2030-01-01", "2023-03-22", "2023-04-20", "2026-10-26"].map((d) => ({ day: ngayCo({ date: d, wmoCode: 0 }), cond: condCo(), isToday: false, tide: null, fish: null, season: [], depth: null })),
];
const oNgan = caO.map((x) => ({ vao: x, ra: sc.buildSeaCells(x) }));

const ngayAm = ["2026-02-17", "2025-07-25", "2025-08-23", "2023-04-20", "2023-03-22", "2020-05-23", "2026-11-04", "1999-12-31", "2026-13-01", "2026-1-01", "x"].map((d) => [d, al.amLichFromIso(d)]);
const HOM_NAY = "2026-11-04";
const nhanNgay = ["2026-11-04", "2026-11-05", "2026-11-06", "2026-11-03", "2026-10-25", "2026-11-30", "2026", "2026-11", "khong-ro", "2026-02-31"].map((d) => [d, dl.chipLabel(d, HOM_NAY), dl.dayLabel(d, HOM_NAY)]);
const dauLuu = [T0, Date.UTC(2026, 10, 3, 16, 59), Date.UTC(2026, 10, 3, 17, 0), Date.UTC(2026, 9, 31, 23, 30)].map((m) => [m, sc.savedStampVN(m, HOM_NAY)]);
const cauDoc = [
  [ngayCo(), false, null],
  [ngayCo({ waveEstimated: true, date: "2026-11-05" }), true, T0],
  [ngayCo({ waveMaxM: 0, date: "2026-11-02" }), true, null],
  [ngayCo({ date: "2026-11-10" }), true, Date.UTC(2026, 10, 1, 2, 0)],
].map(([d, st, sv]) => [d, st, sv, sc.seaTabSpeech({ day: d, todayIso: HOM_NAY, stale: st, savedAt: sv })]);

const vang = { truong, hat, so, dong: { vao: dongVao, ra: dong }, sea: seaRa, oNgan, ngayAm, nhanNgay, dauLuu, cauDoc };
const thuMuc = join(goc, "../shared/src/jvmTest/resources/thoi-tiet");
mkdirSync(thuMuc, { recursive: true });
const txt = JSON.stringify(vang) + "\n";
writeFileSync(join(thuMuc, "vang.json"), txt);
console.log(`[sinh-thoi-tiet] ${(txt.length / 1024).toFixed(0)} KB · ${anh.length} ảnh · ${seaRa.length} ca điểm · ${oNgan.length} ngăn`);
