// VECTOR VÀNG CHO DỰ BÁO GIÓ/SÓNG/DÒNG CHẢY (app-map 18 §5) — chạy CHÍNH src/lib/forecast-grid.ts (+ om-url.ts,
// source-cadence.ts) trên phản hồi Open-Meteo GIẢ tự dựng (nhỏ, tất định), `fetch` giả bắt cả URL máy gọi.
//   node native/scripts/sinh-du-bao.mjs ⇒ native/shared/src/jvmTest/resources/du-bao/vang.json ⇒ LuoiDuBaoVangTest.kt
// Mẫu GỌN (repo chống phình): lưới ra ghi dạng THƯA — chỉ ô có ít nhất một số; ô còn lại phải toàn null.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "../../node_modules/jiti/lib/jiti.mjs";

// giờ máy = giờ VN: web chạy trên máy bà con (Date.parse "YYYY-MM-DDTHH:mm" là giờ ĐỊA PHƯƠNG — gridWaveStillUseful)
process.env.TZ = "Asia/Ho_Chi_Minh";
const goc = dirname(fileURLToPath(import.meta.url));
const repo = join(goc, "../..");
// "trên máy bà con" ⇒ omUrl đi cầu /api/om (y thiết bị native)
globalThis.window = { location: { origin: "https://sdfish.sdvico.vn" } };
const jiti = createJiti(import.meta.url, { alias: { "@": join(repo, "src") } });
const fg = await jiti.import(join(repo, "src/lib/forecast-grid.ts"));
const om = await jiti.import(join(repo, "src/lib/om-url.ts"));
const sc = await jiti.import(join(repo, "src/lib/source-cadence.ts"));

/* ── phản hồi giả ── */
const gio = (n, ngay = "2026-11-04") => {
  const t0 = Date.parse(`${ngay}T00:00:00Z`);
  return Array.from({ length: n }, (_, h) => new Date(t0 + h * 3600e3).toISOString().slice(0, 16));
};
const so = (p, h, k, mod, sc_) => Math.round(((p * 13 + h * 7 + k * 5) % mod) * sc_ * 10) / 10;
const diem = (time, p, a, b, modA, scA, extra) => {
  const hourly = { time };
  hourly[a] = time.map((_, h) => so(p, h, 1, modA, scA));
  hourly[b] = time.map((_, h) => so(p, h, 2, 360, 1));
  if (extra) extra(hourly);
  return { latitude: 1, longitude: 98, hourly };
};
const ok = (body) => ({ ma: 200, than: JSON.stringify(body) });

const t80 = gio(80);
const t200 = gio(200, "2026-12-30");
const t24 = gio(24);
const CA = [
  {
    ten: "d3-day-du",
    days: 3,
    gio: ok([
      diem(t80, 0, "wind_speed_10m", "wind_direction_10m", 60, 1.1),
      diem(t80, 1, "wind_speed_10m", "wind_direction_10m", 60, 1.1, (h) => {
        h.wind_speed_10m[4] = null;
        h.wind_speed_10m[6] = "12";
        h.wind_direction_10m[9] = true;
      }),
      { latitude: 1 },
      diem(t80, 3, "wind_speed_10m", "wind_direction_10m", 60, 1.1),
    ]),
    song: ok([
      diem(t80, 0, "wave_height", "wave_direction", 9, 0.5),
      diem(t80, 1, "wave_height", "wave_direction", 9, 0.5, (h) => {
        h.wave_height = h.wave_height.map(() => null); // đất liền
      }),
      {},
    ]),
    dong: ok(diem(t80, 0, "ocean_current_velocity", "ocean_current_direction", 5, 0.9)),
  },
  {
    ten: "d16-song-429-dong-500",
    days: 16,
    gio: ok([diem(t200, 0, "wind_speed_10m", "wind_direction_10m", 70, 1), diem(t200, 5, "wind_speed_10m", "wind_direction_10m", 70, 1)]),
    song: { ma: 429, than: '{"error":true,"reason":"Daily API request limit exceeded"}' },
    dong: { ma: 500, than: "loi" },
  },
  {
    ten: "d1-mot-diem-song-hong-dong-mat-song",
    days: 1,
    gio: ok(diem(t24, 2, "wind_speed_10m", "wind_direction_10m", 50, 1.3)),
    song: { ma: 200, than: "khong-phai-json" },
    dong: { nem: true },
  },
  { ten: "gio-500", days: 3, gio: { ma: 500, than: "{}" }, song: ok({}), dong: ok({}) },
  { ten: "gio-mat-song", days: 3, gio: { nem: true }, song: ok({}), dong: ok({}) },
  { ten: "gio-than-hong", days: 3, gio: { ma: 200, than: "<html>" }, song: ok({}), dong: ok({}) },
];

let daGoi = [];
globalThis.fetch = async (input) => {
  const url = String(input);
  daGoi.push(url);
  const ca = globalThis.__ca;
  const r = url.includes("wind_speed_10m") ? ca.gio : url.includes("wave_height") ? ca.song : ca.dong;
  if (r.nem) throw new TypeError("Failed to fetch");
  return new Response(r.than, { status: r.ma });
};

const nonNull = (h) => [h.windKmh, h.windDirDeg, h.waveM, h.waveDirDeg, h.curKmh, h.curDirDeg].map((x) => x ?? null);
const thua = (g) => ({
  times: g.times,
  n: g.cells.length,
  o: g.cells.flatMap((c, i) => (c.hours.some((h) => nonNull(h).some((x) => x != null)) ? [[i, c.hours.map(nonNull)]] : [])),
  ...(g.stale !== undefined ? { stale: g.stale } : {}),
  ...(g.savedAt !== undefined ? { savedAt: g.savedAt } : {}),
});

const giai = [];
const luoi = {};
for (const ca of CA) {
  globalThis.__ca = ca;
  daGoi = [];
  let ra = null;
  let loi = null;
  try {
    const g = await fg.fetchForecastGridLive(ca.days);
    luoi[ca.ten] = g;
    ra = thua(g);
  } catch (e) {
    loi = String(e?.message ?? e);
  }
  giai.push({ ten: ca.ten, days: ca.days, gio: ca.gio, song: ca.song, dong: ca.dong, url: [...daGoi].sort(), ra, loi });
}
// URL dài (156 toạ độ) — tách phần toạ độ chung ra một lần
const pts = fg.gridPoints();
const LL = `latitude=${pts.map((p) => p.lat).join(",")}&longitude=${pts.map((p) => p.lon).join(",")}`;
for (const c of giai) c.url = c.url.map((u) => u.split(LL).join("{LL}"));

/* ── lưới nhỏ cho luật ghi đè / ghép (≥20 ô, đúng 4 góc ⇒ gridIsCurrent) ── */
const H = (w, v, c) => ({ windKmh: w, windDirDeg: w == null ? null : 90, waveM: v, waveDirDeg: v == null ? null : 180, curKmh: c, curDirDeg: c == null ? null : 45 });
const nho = (times, f, { lech = false, it = false } = {}) => {
  const n = it ? 10 : 20;
  const cells = Array.from({ length: n }, (_, i) => ({
    lat: i === n - 1 ? 24 : i === 0 ? 1 : 1 + i,
    lon: i === n - 1 ? 123 : i === 0 ? (lech ? 100 : 98) : 98 + i,
    hours: times.map((_, k) => f(i, k)),
  }));
  return { cells, times };
};
const T1 = ["2026-11-04T00:00", "2026-11-04T03:00", "2026-11-04T06:00"];
const T2 = ["2026-11-04T03:00", "2026-11-04T06:00", "2026-11-04T09:00"];
const T3 = ["2026-12-01T00:00", "2026-12-01T03:00"];
const day = nho(T1, (i, k) => H(10 + i + k, 1 + k / 2, i % 3 === 0 ? 0.5 + k : null));
const khongSong = nho(T2, (i, k) => H(20 + i, null, null));
const khongDong = nho(T1, (i, k) => H(30, 2, null));
const lech = nho(T1, (i, k) => H(30, null, null), { lech: true });
const it = nho(T1, (i, k) => H(30, null, null), { it: true });
const truc3 = nho(T3, (i, k) => H(5, null, null));
const khongSongIt = nho(T1, (i, k) => H(40, null, null), { it: true });
const NOW = Date.UTC(2026, 10, 4, 2, 0);
const LUOI_NHO = { day, khongSong, khongDong, lech, it, truc3, khongSongIt };
const gon = (g) => ({ times: g.times, cells: g.cells.map((c) => [c.lat, c.lon, c.hours.map(nonNull)]) });
const ghiDe = [
  [null, "day", NOW],
  ["day", "khongSong", NOW],
  ["day", "khongDong", NOW],
  ["day", "truc3", NOW],
  ["lech", "khongSong", NOW],
  ["it", "khongSong", NOW],
  ["khongSong", "day", NOW],
  ["day", "khongSongIt", NOW],
  ["day", "khongSongIt", Date.UTC(2026, 10, 3, 23, 0)], // 06:00 giờ VN = mốc cuối ⇒ còn dùng ⇒ giữ
  ["day", "khongSongIt", Date.UTC(2026, 10, 3, 23, 1)],
  ["day", "truc3", Date.UTC(2027, 0, 1)],
].map(([p, n, now]) => {
  const P = p ? LUOI_NHO[p] : null;
  const N = LUOI_NHO[n];
  const m = fg.mergeGridCurrent(P, N);
  // ghép trả NGUYÊN `next` (cùng tham chiếu) ⇒ ghi null cho gọn
  return [p, n, now, fg.shouldOverwriteGrid(P ? { data: P, savedAt: 0 } : null, N, now), m === N ? null : gon(m), P ? fg.gridWaveStillUseful(P, now) : null];
});
const luoiNho = Object.fromEntries(Object.entries(LUOI_NHO).map(([k, g]) => [k, gon(g)]));

/* ── lưới dày cho mũi tên thưa (26 cột × 4 hàng) — Kotlin dựng lại ĐÚNG công thức này (LuoiDuBaoVangTest.day26) ── */
const day26 = {
  times: ["2026-11-04T00:00"],
  cells: Array.from({ length: 104 }, (_, i) => {
    const r = Math.floor(i / 26);
    const c = i % 26;
    const co = i % 3 === 0;
    return {
      lat: 5 + r * 0.5,
      lon: 100 + c * 0.5,
      hours: [co ? { windKmh: (i * 7) % 60, windDirDeg: (i * 37) % 360, waveM: ((i * 3) % 9) / 2, waveDirDeg: (i * 53) % 360, curKmh: ((i * 5) % 7) / 2, curDirDeg: (i * 71) % 360 } : { windKmh: null, windDirDeg: null }],
    };
  }),
};
const hinh = [[13, 12], [26, 4], [26, 24], [1, 5], [7, 1], [0, 0]];
const buocMuiTen = hinh.map(([nLon, nLat]) => {
  const cells = Array.from({ length: nLon * nLat }, (_, i) => ({ lat: Math.floor(i / Math.max(1, nLon)), lon: i % Math.max(1, nLon), hours: [] }));
  return [nLon, nLat, fg.arrowStep(cells)];
});
// lưới lệch: số ô không chia hết số cột
buocMuiTen.push([-1, -1, fg.arrowStep([{ lat: 0, lon: 0, hours: [] }, { lat: 0, lon: 1, hours: [] }, { lat: 1, lon: 0, hours: [] }])]);

const g3 = luoi["d3-day-du"];
const muiTen = [];
for (const k of ["wind", "wave", "current"]) {
  for (const t of [0, 1, 7, 24, 99]) muiTen.push(["d3-day-du", t, k, fg.arrowFeatures(g3, t, k)]);
  muiTen.push(["day26", 0, k, fg.arrowFeatures(day26, 0, k)]);
}

const QUERY = [[1, 98], [24, 123], [12.5, 110.4], [0.13, 97.93], [0.1, 98], [24.9, 123], [10.85, 103.2], [-5, 110], [11.7, 104.25], [16, 120.5]];
const gan = QUERY.map(([la, lo]) => {
  const r = fg.nearestGridCell(g3, la, lo);
  return [la, lo, r ? g3.cells.indexOf(r.cell) : null, r ? r.distDeg : null];
});

const g16 = luoi["d16-song-429-dong-500"];
const cat = [1, 3, 5, 7, 8, 16, 20].map((d) => { const t = fg.truncateGrid(g16, d); return [d, t.times.length, t === g16]; });

const BUOC = [[3, 80], [3, 0], [3, 1], [16, 200], [16, 385], [1, 24], [7, 500], [10, 241], [0, 10]];
const nhip = [];
for (const s of [Date.UTC(2026, 10, 4, 3, 59), Date.UTC(2026, 10, 4, 4, 0), Date.UTC(2026, 10, 4, 21, 30), Date.UTC(2026, 10, 4, 23, 10)]) {
  for (const dPhut of [-1, 0, 10, 44, 45, 46, 60, 120, 400, 719, 720, 721, 1500]) {
    const now = s + dPhut * 60e3;
    nhip.push([s, now, sc.isCacheCurrent(s, now)]);
  }
}
nhip.push([null, NOW, sc.isCacheCurrent(null, NOW)]);

const ISO = ["2026-06-12T13:00", "2026-11-04T00:00", "2026-11-05T21:00", "2026-12-31T09:00", "2027-01-01T00:00", "2026-02-31T06:00", "2026-11-04", "khong-ro", "2026-11T05:00", "2026-03-01T7:00"];
const HOM = [undefined, "2026-11-04", "2026-12-31"];
const nhan = {
  timeLabel: ISO.flatMap((i) => HOM.map((h) => [i, h ?? null, fg.timeLabelVN(i, h)])),
  scrub: ["2026-11-04", "2026-11-05", "2026-11-06", "2026-11-03", "2027-01-01", "2026-02-31", "khong-ro", "2026-11"].flatMap((i) => HOM.concat(["khong-ro"]).map((h) => [i, h ?? null, fg.scrubDayLabel(i, h)])),
  nhom: [
    g3.times,
    ["2026-11-04T21:00", "2026-11-04T23:00", "2026-11-05T00:00", "2026-11-05", "2026-11-05Tab", "2026-11-06T12:00", "2026-11-06T"],
    [],
  ].map((ts) => [ts, fg.groupTimesByDay(ts)]),
};

const hienHanh = [
  ["d3", g3],
  ["d16", g16],
  ["d1", luoi["d1-mot-diem-song-hong-dong-mat-song"]],
  ["day", day],
  ["lech", lech],
  ["it", it],
  ["rong", { cells: [], times: [] }],
].map(([t, g]) => [t, fg.gridIsCurrent(g), fg.gridHasCurrent(g), fg.gridHasWave(g)]);

const omCa = [
  ["forecast", `${LL}&timezone=Asia%2FHo_Chi_Minh&forecast_days=3&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=kmh`],
  ["marine", "latitude=10.5&longitude=107&forecast_days=16&hourly=wave_height,wave_direction&models=ncep_gfswave025"],
  ["marine", "latitude=10.5&longitude=107&forecast_days=17"],
  ["marine", "latitude=10.5&longitude=107&forecast_days=0"],
  ["marine", "latitude=10.5&longitude=107"],
  ["ensemble", "latitude=10.5&longitude=107&forecast_days=1&foo=bar"],
  ["khac", "latitude=10.5&longitude=107&forecast_days=1"],
  ["forecast", "latitude=10.5a&longitude=107&forecast_days=1"],
  ["forecast", "latitude=10.5&longitude=107&forecast_days=1&hourly=a%20b"],
  ["forecast", "latitude=10.5&longitude=107&forecast_days=02&timezone=Asia/Ho_Chi_Minh&&hourly=x"],
  ["forecast", "latitude=-1.25,2&longitude=107,108&forecast_days=1&models=a&models=b"],
  ["forecast", "latitude=10.5&longitude=107&forecast_days=1&hourly="],
  ["forecast", "forecast_days=1"],
].map(([api, q]) => [api, q.split(LL).join("{LL}"), om.omDays(new URLSearchParams(q)), om.omUpstream(api, new URLSearchParams(q))]);

const vang = {
  diem: pts.map((p) => [p.lat, p.lon]),
  hang: {
    bounds: fg.GRID_BOUNDS_DEG,
    stepLat: fg.GRID_STEP_LAT_DEG,
    stepLon: fg.GRID_STEP_LON_DEG,
    snapLat: fg.GRID_SNAP_MAX_LAT_DEG,
    snapLon: fg.GRID_SNAP_MAX_LON_DEG,
    snap: fg.GRID_SNAP_MAX_DEG,
    nLat: fg.GRID_N_LAT,
    nLon: fg.GRID_N_LON,
    LL,
  },
  buoc: BUOC.map(([d, a]) => [d, a, fg.stepHourIndices(d, a)]),
  giai,
  luoiNho,
  ghiDe,
  buocMuiTen,
  muiTen,
  gan,
  cat,
  nhip,
  nhan,
  hienHanh,
  mau: {
    wind: JSON.stringify(fg.WIND_COLOR_EXPR),
    wave: JSON.stringify(fg.WAVE_COLOR_EXPR),
    current: JSON.stringify(fg.CURRENT_COLOR_EXPR),
    legend: ["wind", "wave", "current"].map((k) => [k, fg.legendStops(k), fg.legendUnit(k)]),
  },
  om: omCa,
};

const thuMuc = join(goc, "../shared/src/jvmTest/resources/du-bao");
mkdirSync(thuMuc, { recursive: true });
const out = JSON.stringify(vang) + "\n";
writeFileSync(join(thuMuc, "vang.json"), out);
console.log(`[sinh-du-bao] ${giai.length} ca giải · ${muiTen.length} lớp mũi tên · ${(out.length / 1024).toFixed(1)} KB`);
