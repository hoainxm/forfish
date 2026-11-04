#!/usr/bin/env node
// MÁY NHÀ TẢI TRƯỚC Ô BẢN ĐỒ — chạy trên gpu-desktop theo timer systemd (ops/runbook.md › "Ô bản đồ từ máy nhà").
//
// Vì sao: máy chủ (IIS sdfish.sdvico.vn) chỉ có kho ô tự đầy dần theo lượt bà con kéo (lib/kho-o-ban-do). Máy
// nhà tải TRƯỚC cả vùng biển VN rồi đẩy vào ngăn `may-nha` của kho ⇒ nguồn ngoài sập vẫn còn ô để phát, và:
//   · Nước nóng lạnh (MUR L4) + Vùng nhiều mồi (VIIRS phù du) z0–7: mỗi ô lấy NGUYÊN ẢNH GỐC của ngày mới nhất
//     nguồn có ảnh (SST thử `default` trước; phù du từ hôm qua lùi tối đa 8 ngày). KHÔNG ghép/trộn điểm ảnh nhiều
//     ngày — anh Long 2026-11-04: "phải lấy đúng cái nguồn chứ ghép ảnh chế dữ liệu thì các dự báo sau sao đúng
//     được?". Lỗ mây/vệt quét trong ảnh một ngày là SỰ THẬT của nguồn, giữ nguyên.
//   · Hải đồ độ sâu (EMODnet) z0–10: tĩnh ⇒ giữ bản ở máy nhà, tải lại khi quá 30 ngày, đẩy lại mỗi 7 ngày.
// Seamark (OpenSeaMap) KHÔNG tải trước: z8–18 quá nhiều ô, máy chủ tự đầy kho theo lượt xem.
//
// Env (~/.config/forlife/o-ban-do.env, hoặc env process): O_BAN_DO_API_BASE (https, không / cuối — máy chủ CÓ ĐĨA
// BỀN, tức IIS) · CRON_SECRET (đúng app_config.cron_secret).
// Cờ: --thu (tải, in số ô + dung lượng, KHÔNG gửi) · --hai-do (ép đẩy hải đồ lượt này) ·
//     --lop=sst,chlorophyll,chart (chỉ chạy các lớp này).

import { homedir } from "node:os";
import path from "node:path";
import { mkdirSync, readFileSync, statSync, writeFileSync, renameSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { HOP_BIEN_VN, URL_NGUON, laPng, oTrongHop } from "../src/lib/o-ban-do-nguon.mjs";

const log = (...a) => console.log(new Date().toISOString(), ...a);
function docTepEnv(file) {
  const out = {};
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m) out[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
    }
  } catch {
    /* không có tệp env ⇒ chỉ dùng env process */
  }
  return out;
}

const env = { ...docTepEnv(path.join(homedir(), ".config/forlife/o-ban-do.env")), ...process.env };
const BASE = (env.O_BAN_DO_API_BASE ?? "").replace(/\/+$/, "");
const SECRET = env.CRON_SECRET ?? "";
const THU = process.argv.includes("--thu");
const EP_HAI_DO = process.argv.includes("--hai-do");
const LOP = (process.argv.find((a) => a.startsWith("--lop="))?.slice(6) ?? "sst,chlorophyll,chart").split(",");
const KHO = path.join(env.O_BAN_DO_KHO ?? path.join(homedir(), ".local/forlife/o-ban-do/kho"));
const NGAY = 86_400_000;
const SONG_SONG = 6;
const HET_GIO_O_MS = 30_000;
const TRAN_GOI_BYTE = 2_500_000; // base64 thô mỗi gói (nén gzip còn ít hơn — dưới trần thân 4,5 MB của Vercel)
const ETAG_O_GIA = "1000000000000";

if (!THU && (!/^https:\/\//.test(BASE) || !SECRET)) {
  log("[ô bản đồ] thiếu O_BAN_DO_API_BASE (https) hoặc CRON_SECRET — dừng");
  process.exit(1);
}

const ngayUTC = (lui) => new Date(Date.now() - lui * NGAY).toISOString().slice(0, 10);

/** Tải một ô. Trả Buffer PNG, "khong" (404 — ô/ngày không có ảnh) hoặc null (hỏng sau khi thử lại). */
async function taiO(url) {
  for (let lan = 0; lan < 3; lan++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(HET_GIO_O_MS) });
      if (r.status === 404) return "khong";
      const etag = (r.headers.get("etag") ?? "").replace(/^W\//, "").replace(/"/g, "");
      if (r.ok && etag !== ETAG_O_GIA) {
        const buf = Buffer.from(await r.arrayBuffer());
        if (laPng(buf)) return buf;
      }
      if (r.ok && etag === ETAG_O_GIA) return "khong"; // ngày chưa xử lý — coi như không có ảnh
      if (r.status === 429) await new Promise((ok) => setTimeout(ok, 30_000));
    } catch {
      /* hết giờ / mạng — thử lại */
    }
    await new Promise((ok) => setTimeout(ok, 2000 * (lan + 1)));
  }
  return null;
}

/** Chạy `viec` trên danh sách với SONG_SONG luồng. */
async function chayDong(ds, viec) {
  let i = 0;
  await Promise.all(
    Array.from({ length: SONG_SONG }, async () => {
      while (i < ds.length) await viec(ds[i++]);
    }),
  );
}

const tepKho = (src, t) => path.join(KHO, src, String(t.z), String(t.x), `${t.y}.png`);
function luuKho(src, t, buf) {
  const f = tepKho(src, t);
  mkdirSync(path.dirname(f), { recursive: true });
  writeFileSync(`${f}.tmp`, buf);
  renameSync(`${f}.tmp`, f);
}
function tuoiKho(src, t) {
  try {
    return Date.now() - statSync(tepKho(src, t)).mtimeMs;
  } catch {
    return Infinity;
  }
}

// ---------- gửi theo gói ----------
let goi = [];
let goiByte = 0;
const dem = { gui: 0, ghi: 0, loai: 0, goiHong: 0, byte: 0 };

async function guiGoi() {
  if (goi.length === 0) return;
  const than = gzipSync(Buffer.from(JSON.stringify({ o: goi })));
  dem.byte += than.length;
  const n = goi.length;
  goi = [];
  goiByte = 0;
  if (THU) {
    dem.gui += n;
    return;
  }
  for (let lan = 0; lan < 3; lan++) {
    try {
      const r = await fetch(`${BASE}/api/o-ban-do/nhap`, {
        method: "POST",
        headers: { authorization: `Bearer ${SECRET}`, "content-type": "application/json", "content-encoding": "gzip" },
        body: than,
        signal: AbortSignal.timeout(120_000),
      });
      const kq = await r.json().catch(() => ({}));
      if (r.ok) {
        dem.gui += n;
        dem.ghi += kq.ghi ?? 0;
        dem.loai += kq.loai ?? 0;
        return;
      }
      log(`[gửi] ${r.status} lần ${lan + 1}: ${JSON.stringify(kq).slice(0, 200)}`);
      if (r.status === 401 || r.status === 404) break; // sai khoá / máy chủ chưa có route — thử lại vô ích
    } catch (e) {
      log(`[gửi] hỏng lần ${lan + 1}: ${e?.message ?? e}`);
    }
    await new Promise((ok) => setTimeout(ok, 5000 * (lan + 1)));
  }
  dem.goiHong++;
}

async function themVaoGoi(src, t, buf) {
  const b64 = buf.toString("base64");
  goi.push({ src, z: t.z, x: t.x, y: t.y, png: b64 });
  goiByte += b64.length;
  if (goiByte >= TRAN_GOI_BYTE) await guiGoi();
}

// ---------- từng lớp ----------

/** Ảnh theo ngày: mỗi ô thử lần lượt `ngays`, lấy ảnh gốc đầu tiên có (không sửa byte nào). */
async function lopTheoNgay(src, ngays, ten) {
  const ds = oTrongHop(HOP_BIEN_VN, 0, 7);
  const ra = [];
  const theoNgay = {};
  let hong = 0;
  await chayDong(ds, async (t) => {
    for (const ngay of ngays) {
      const b = await taiO(URL_NGUON[src](t.z, t.x, t.y, ngay));
      if (Buffer.isBuffer(b)) {
        luuKho(src, t, b);
        ra.push([t, b]);
        theoNgay[ngay] = (theoNgay[ngay] ?? 0) + 1;
        return;
      }
      if (b === null) hong++;
    }
  });
  for (const [t, b] of ra) await themVaoGoi(src, t, b);
  log(`[${ten}] ${ra.length}/${ds.length} ô · theo ngày ${JSON.stringify(theoNgay)} · ${hong} lượt tải hỏng`);
}

const TEP_HAI_DO_GUI = path.join(KHO, "chart.gui-luc");
async function lopHaiDo() {
  let lanGui = 0;
  try {
    lanGui = Number(readFileSync(TEP_HAI_DO_GUI, "utf8")) || 0;
  } catch {
    /* chưa gửi lần nào */
  }
  const canGui = EP_HAI_DO || Date.now() - lanGui > 7 * NGAY;
  if (!canGui) {
    log(`[hải đồ] đã đẩy ${new Date(lanGui).toISOString()} — chưa tới 7 ngày, bỏ qua`);
    return;
  }
  const ds = oTrongHop(HOP_BIEN_VN, 0, 10);
  let tai = 0;
  let khong = 0;
  let hong = 0;
  const co = [];
  await chayDong(ds, async (t) => {
    if (tuoiKho("chart", t) < 30 * NGAY) {
      co.push(t);
      return;
    }
    const b = await taiO(URL_NGUON.chart(t.z, t.x, t.y));
    if (Buffer.isBuffer(b)) {
      luuKho("chart", t, b);
      tai++;
      co.push(t);
    } else if (b === "khong") khong++;
    else hong++;
  });
  for (const t of co) await themVaoGoi("chart", t, readFileSync(tepKho("chart", t)));
  await guiGoi();
  if (!THU && hong === 0 && dem.goiHong === 0) writeFileSync(TEP_HAI_DO_GUI, String(Date.now()));
  log(`[hải đồ] ${co.length}/${ds.length} ô (tải mới ${tai}, nguồn không có ${khong}, hỏng ${hong})`);
}

const t0 = Date.now();
if (LOP.includes("sst")) await lopTheoNgay("sst", ["default", ...Array.from({ length: 10 }, (_, i) => ngayUTC(i + 1))], "sst");
if (LOP.includes("chlorophyll"))
  await lopTheoNgay("chlorophyll", Array.from({ length: 8 }, (_, i) => ngayUTC(i + 1)), "phù du");
await guiGoi();
if (LOP.includes("chart")) await lopHaiDo();
await guiGoi();
log(
  `[ô bản đồ] ${THU ? "THỬ (không gửi) — " : ""}${dem.gui} ô · nén ${(dem.byte / 1e6).toFixed(2)} MB · ` +
    `máy chủ ghi ${dem.ghi}, loại ${dem.loai} · gói hỏng ${dem.goiHong} · ${Math.round((Date.now() - t0) / 1000)} s`,
);
if (dem.goiHong > 0) process.exit(1);
