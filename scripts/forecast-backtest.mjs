// scripts/forecast-backtest.mjs
// ─────────────────────────────────────────────────────────────────────────
// BỘ ĐO ĐỘ CHÍNH XÁC ("học thử") cho engine dự báo biển 15 ngày của SDFish.
//
// Ý tưởng: so DỰ-BÁO-CŨ (đã khởi tạo ở quá khứ) với THỰC-TẾ (tái phân tích
// ERA5), để đo sai số tăng bao nhiêu theo tầm ngày (lead day 1..15). Kết quả
// kết tinh thành bảng skill (src/data/forecast-skill.json) dùng để (a) hiệu
// chỉnh bias và (b) gán nhãn độ tin TRUNG THỰC cho từng tầm ngày.
//
// Chạy tay:  node scripts/forecast-backtest.mjs
// Không cần API key (Open-Meteo free). Cần mạng.
//
// PHƯƠNG PHÁP (init-anchored, xác minh 2026-07-25):
//   GIÓ  (wind_speed_10m_max, km/h):
//     - Dự báo: Single Runs API — chọn ĐÚNG lần khởi tạo (run) ở quá khứ, lấy
//       trọn tầm dự báo tới 16 ngày.
//       https://single-runs-api.open-meteo.com/v1/forecast?...&run=<d>T00:00
//       &daily=wind_speed_10m_max  (model mặc định GFS → 16 ngày → lead 1..15)
//     - Thực tế: Archive ERA5.
//       https://archive-api.open-meteo.com/v1/archive?...&daily=wind_speed_10m_max
//   SÓNG (wave_height_max, m):
//     - Dự báo: Single Runs API + model sóng gwam (chỉ ~7 ngày → lead 1..~6).
//       https://single-runs-api.open-meteo.com/v1/forecast?...&run=<d>T00:00
//       &hourly=wave_height&models=gwam  → tự tính daily max theo ngày (GMT).
//     - Thực tế: Marine Archive ERA5-Ocean.
//       https://marine-api.open-meteo.com/v1/marine?...&daily=wave_height_max
//
//   Vì sao KHÔNG dùng historical-forecast-api: nó KHÔNG cho chọn lead time /
//   init tuỳ ý (đã xác minh — trả về 1 chuỗi tái dựng, không theo tầm ngày).
//   Previous Runs API chỉ tới lead 7 và daily-max/sóng không phục vụ được.
//   => Single Runs (chọn run) là nguồn init-anchored đúng nhất cho 15 ngày.
//
//   TRUNG THỰC: sóng chỉ đo được tới ~lead 6 (giới hạn tầm model gwam). Các
//   lead 7..15 KHÔNG có nguồn dự-báo-sóng-lưu-trữ trong Open-Meteo free →
//   waveMae/waveBias = null, nWave = 0. confidence[L] tính CHỦ YẾU theo gió
//   (có đủ 1..15). Đọc docs/app-map/ops/forecast-accuracy.md.
// ─────────────────────────────────────────────────────────────────────────

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, "..", "src", "data", "forecast-skill.json");

// 10 cảng — toạ độ THẬT lấy từ src/data/ports.ts (không bịa).
const PORTS = [
  { id: "cat-ba", name: "Cát Bà", lat: 20.72, lon: 107.06 },
  { id: "lach-hoi", name: "Lạch Hới (Sầm Sơn)", lat: 19.74, lon: 105.95 },
  { id: "cua-lo", name: "Cửa Lò", lat: 18.8, lon: 105.75 },
  { id: "tho-quang", name: "Thọ Quang", lat: 16.12, lon: 108.26 },
  { id: "sa-ky", name: "Sa Kỳ", lat: 15.22, lon: 108.95 },
  { id: "quy-nhon", name: "Quy Nhơn", lat: 13.76, lon: 109.27 },
  { id: "hon-ro", name: "Hòn Rớ (Nha Trang)", lat: 12.2, lon: 109.25 },
  { id: "phan-thiet", name: "Phan Thiết", lat: 10.91, lon: 108.13 },
  { id: "vung-tau", name: "Vũng Tàu", lat: 10.34, lon: 107.09 },
  { id: "rach-gia", name: "Rạch Giá", lat: 9.99, lon: 104.98 },
];

const MAX_LEAD = 15; // engine dự báo tối đa 15 ngày
// Cửa sổ init: đủ xa để ngày (init + 15) đã có ACTUAL (archive ERA5 gần realtime).
const INIT_STEP_DAYS = 3; // bước nhảy giữa các ngày khởi tạo
const INIT_BACK_START = 51; // init sớm nhất: hôm nay - 51 ngày
const INIT_BACK_END = 18; // init muộn nhất:  hôm nay - 18 ngày (để lead15 có actual)

// confidence[L] = clamp(1 - windMae[L] / MAE_REF_WIND, 0, 1)
//   MAE_REF_WIND = 12 km/h: mốc sai số gió mà điểm sea.ts đã lệch đáng kể.
//   sea.ts phạt gió 1.2 điểm/(km/h) trên 20km/h → MAE 12km/h ~ dao động điểm
//   ±14 → coi như "khó tin". Hằng số cố định để confidence có nghĩa tuyệt đối
//   (không phụ thuộc chính dữ liệu của lần chạy này). Đổi mốc = đổi thang tin.
const MAE_REF_WIND = 12;

const FETCH_TIMEOUT_MS = 20000;
const RETRIES = 2;
const CONCURRENCY = 4; // số fetch song song mỗi cảng (nhẹ tay với Open-Meteo)

// ── tiện ích ────────────────────────────────────────────────────────────
const iso = (dt) => dt.toISOString().slice(0, 10);
const addDays = (isoStr, n) => {
  const d = new Date(isoStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const round = (x, p = 2) =>
  x == null || Number.isNaN(x) ? null : Math.round(x * 10 ** p) / 10 ** p;

async function fetchJson(url, label) {
  let lastErr;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      const text = await r.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`non-JSON (${r.status}): ${text.slice(0, 120)}`);
      }
      if (!r.ok) {
        // 400 "No data" cho một số run/model — coi là rỗng, đừng retry vô ích
        const reason = data?.reason || `HTTP ${r.status}`;
        if (r.status === 400 || r.status === 404) return { _empty: true, reason };
        throw new Error(reason);
      }
      return data;
    } catch (e) {
      lastErr = e;
      if (attempt < RETRIES) await new Promise((res) => setTimeout(res, 600 * (attempt + 1)));
    }
  }
  console.warn(`    ! lỗi ${label}: ${String(lastErr).slice(0, 100)}`);
  return { _error: true };
}

// chạy các tác vụ async theo lô để giới hạn số fetch song song
async function pool(items, worker, size) {
  const results = [];
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    results.push(...(await Promise.all(batch.map(worker))));
  }
  return results;
}

function buildInitDates() {
  const today = new Date();
  const dates = [];
  for (let back = INIT_BACK_START; back >= INIT_BACK_END; back -= INIT_STEP_DAYS) {
    const d = new Date(today.getTime() - back * 86400000);
    dates.push(iso(d));
  }
  return dates;
}

// gom hourly wave_height -> daily max (chỉ nhận ngày đủ >=20 giờ hợp lệ)
function hourlyToDailyMax(time, values) {
  const byDate = new Map();
  for (let i = 0; i < time.length; i++) {
    const v = values[i];
    if (v == null) continue;
    const date = time[i].slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(v);
  }
  const out = new Map();
  for (const [date, arr] of byDate) {
    if (arr.length >= 20) out.set(date, Math.max(...arr));
  }
  return out;
}

// ── tích luỹ thống kê theo lead ──────────────────────────────────────────
// mỗi lead giữ: windDiffs[] (f-a), waveDiffs[] (f-a)
const acc = Array.from({ length: MAX_LEAD }, () => ({
  windDiffs: [],
  waveDiffs: [],
}));

function mae(arr) {
  if (!arr.length) return null;
  return arr.reduce((s, x) => s + Math.abs(x), 0) / arr.length;
}
function bias(arr) {
  if (!arr.length) return null;
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

function summarise(generatedAt, initDates) {
  const perLeadDay = acc.map((a, idx) => {
    const L = idx + 1;
    const windMae = mae(a.windDiffs);
    const waveMae = mae(a.waveDiffs);
    const confidence =
      windMae == null ? null : round(clamp(1 - windMae / MAE_REF_WIND, 0, 1), 3);
    return {
      leadDay: L,
      windMae: round(windMae),
      windBias: round(bias(a.windDiffs)),
      waveMae: round(waveMae),
      waveBias: round(bias(a.waveDiffs)),
      confidence,
      n: a.windDiffs.length,
      nWave: a.waveDiffs.length,
    };
  });
  const sampleSize = acc.reduce(
    (s, a) => s + a.windDiffs.length + a.waveDiffs.length,
    0,
  );
  return {
    generatedAt,
    method:
      "Init-anchored backtest: Single Runs API (run=<init>) vs ERA5 archive. " +
      `Gió = wind_speed_10m_max (GFS, lead 1..15) vs archive-api ERA5. ` +
      `Sóng = wave_height_max từ hourly wave_height model gwam (lead 1..~6) vs marine-api ERA5-Ocean. ` +
      `${PORTS.length} cảng, ${initDates.length} ngày khởi tạo (${initDates[0]}..${initDates.at(-1)}), bước ${INIT_STEP_DAYS} ngày. ` +
      `confidence[L]=clamp(1-windMae/${MAE_REF_WIND},0,1). ` +
      `Sóng lead 7..15 không có nguồn dự-báo-lưu-trữ (Open-Meteo free) → null. ` +
      "Xem docs/app-map/ops/forecast-accuracy.md.",
    sampleSize,
    perLeadDay,
  };
}

function writeOut(obj) {
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

// ── main ──────────────────────────────────────────────────────────────────
async function main() {
  const generatedAt = new Date().toISOString();
  const initDates = buildInitDates();
  const winStart = initDates[0];
  const winEnd = addDays(initDates.at(-1), MAX_LEAD);

  console.log(
    `Backtest dự báo biển — ${PORTS.length} cảng × ${initDates.length} init ` +
      `(${initDates[0]}..${initDates.at(-1)}), lead 1..${MAX_LEAD}`,
  );
  console.log(`Cửa sổ ACTUAL: ${winStart} .. ${winEnd}\n`);

  for (let p = 0; p < PORTS.length; p++) {
    const port = PORTS[p];
    console.log(`[${p + 1}/${PORTS.length}] ${port.name} (${port.lat},${port.lon})`);
    const q = `latitude=${port.lat}&longitude=${port.lon}&timezone=GMT`;

    // ACTUAL: gió (archive ERA5) + sóng (marine archive ERA5-Ocean)
    const windActualJson = await fetchJson(
      `https://archive-api.open-meteo.com/v1/archive?${q}&start_date=${winStart}&end_date=${winEnd}&daily=wind_speed_10m_max`,
      "archive wind",
    );
    const waveActualJson = await fetchJson(
      `https://marine-api.open-meteo.com/v1/marine?${q}&start_date=${winStart}&end_date=${winEnd}&daily=wave_height_max`,
      "archive wave",
    );
    const windActual = new Map();
    if (windActualJson?.daily) {
      windActualJson.daily.time.forEach((d, i) => {
        const v = windActualJson.daily.wind_speed_10m_max[i];
        if (v != null) windActual.set(d, v);
      });
    }
    const waveActual = new Map();
    if (waveActualJson?.daily) {
      waveActualJson.daily.time.forEach((d, i) => {
        const v = waveActualJson.daily.wave_height_max[i];
        if (v != null) waveActual.set(d, v);
      });
    }

    // DỰ BÁO CŨ theo từng init — song song có giới hạn
    let pairsWind = 0;
    let pairsWave = 0;
    await pool(
      initDates,
      async (d) => {
        // gió: single-runs daily, run=d 00:00 GMT, tầm 16 ngày
        const windFc = await fetchJson(
          `https://single-runs-api.open-meteo.com/v1/forecast?${q}&daily=wind_speed_10m_max&forecast_days=16&run=${d}T00:00`,
          `SR wind ${d}`,
        );
        if (windFc?.daily) {
          windFc.daily.time.forEach((vd, i) => {
            const lead = Math.round(
              (new Date(vd + "T00:00:00Z") - new Date(d + "T00:00:00Z")) / 86400000,
            );
            if (lead < 1 || lead > MAX_LEAD) return;
            const f = windFc.daily.wind_speed_10m_max[i];
            const a = windActual.get(vd);
            if (f == null || a == null) return;
            acc[lead - 1].windDiffs.push(f - a);
            pairsWind++;
          });
        }
        // sóng: single-runs hourly wave_height model gwam, run=d, ~7 ngày
        const waveFc = await fetchJson(
          `https://single-runs-api.open-meteo.com/v1/forecast?${q}&hourly=wave_height&models=gwam&run=${d}T00:00`,
          `SR wave ${d}`,
        );
        if (waveFc?.hourly?.wave_height) {
          const dailyMax = hourlyToDailyMax(
            waveFc.hourly.time,
            waveFc.hourly.wave_height,
          );
          for (const [vd, f] of dailyMax) {
            const lead = Math.round(
              (new Date(vd + "T00:00:00Z") - new Date(d + "T00:00:00Z")) / 86400000,
            );
            if (lead < 1 || lead > MAX_LEAD) continue;
            const a = waveActual.get(vd);
            if (a == null) continue;
            acc[lead - 1].waveDiffs.push(f - a);
            pairsWave++;
          }
        }
      },
      CONCURRENCY,
    );

    console.log(
      `    actual: gió ${windActual.size}d, sóng ${waveActual.size}d | cặp: gió ${pairsWind}, sóng ${pairsWave}`,
    );

    // ghi tạm sau mỗi cảng — nếu mạng rớt giữa chừng vẫn giữ phần đã thu
    try {
      writeOut(summarise(generatedAt, initDates));
    } catch (e) {
      console.warn("    ! không ghi được file tạm:", String(e).slice(0, 80));
    }
  }

  const result = summarise(generatedAt, initDates);
  writeOut(result);

  console.log(`\n✓ Ghi ${OUT_PATH}`);
  console.log(`  sampleSize = ${result.sampleSize}`);
  console.log("  lead |  windMae windBias | waveMae waveBias | conf |  n / nWave");
  for (const r of result.perLeadDay) {
    console.log(
      `   ${String(r.leadDay).padStart(2)}  |  ` +
        `${String(r.windMae ?? "—").padStart(6)} ${String(r.windBias ?? "—").padStart(7)} | ` +
        `${String(r.waveMae ?? "—").padStart(6)} ${String(r.waveBias ?? "—").padStart(7)} | ` +
        `${String(r.confidence ?? "—").padStart(4)} | ${String(r.n).padStart(4)} / ${r.nWave}`,
    );
  }
}

main().catch((e) => {
  console.error("LỖI không mong đợi:", e);
  // vẫn cố ghi phần đã thu
  try {
    writeOut(summarise(new Date().toISOString(), buildInitDates()));
    console.error("(đã ghi phần thu được trước khi lỗi)");
  } catch {}
  process.exitCode = 1;
});
