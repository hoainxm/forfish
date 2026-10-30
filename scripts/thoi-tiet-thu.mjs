#!/usr/bin/env node
// MÁY NHÀ TẢI NGUỒN THỜI TIẾT — chạy trên gpu-desktop theo timer systemd (ops/runbook.md › "Thời tiết từ máy nhà").
//
// Vì sao: lượt cron trên Vercel bắn song song nên dính 429 "Minutely API request limit exceeded" của Open-Meteo
// (khung 16 ngày hỏng liên tục), mà hàm Vercel chỉ sống 60 s, không chờ qua phút được. Máy nhà thì chờ được. Máy nhà hỏi máy chủ danh sách URL (GET /api/thoi-tiet/nhap), tải
// từng URL, rồi gửi cả gói NÉN gzip lên (POST cùng đường). Máy chủ ghép bằng đúng logic cron ⇒ DB có số mới.
// URL nào tải hỏng thì bỏ khỏi gói — máy chủ tự gọi mạng cho URL đó (đếm `truot`), không hỏng cả lượt.
//
// Env (~/.config/forlife/thoi-tiet.env, hoặc env process): THOI_TIET_API_BASE (https, không / cuối) ·
// CRON_SECRET (đúng giá trị app_config.cron_secret — ô "Bí mật cron" ở /quan-tri).
// Cờ: --thu (tải hết, in số URL + dung lượng, KHÔNG gửi).

import { homedir } from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

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

const env = { ...docTepEnv(path.join(homedir(), ".config/forlife/thoi-tiet.env")), ...process.env };
const BASE = (env.THOI_TIET_API_BASE ?? "").replace(/\/+$/, "");
const SECRET = env.CRON_SECRET ?? "";
const THU = process.argv.includes("--thu");
const HET_GIO_URL_MS = 60_000;
const HET_GIO_GUI_MS = 120_000;
// Open-Meteo đếm trần THEO PHÚT có trọng số (lưới 156 điểm × 16 ngày rất nặng) ⇒ tải LẦN LƯỢT, gặp 429 chờ qua phút.
const SONG_SONG = 1;
const THU_LAI = 4;
const CHO_429_MS = 65_000;

if (!/^https:\/\//.test(BASE) || !SECRET) {
  log("[thời tiết] thiếu THOI_TIET_API_BASE (https) hoặc CRON_SECRET — dừng");
  process.exit(1);
}
const auth = { authorization: `Bearer ${SECRET}` };

async function taiMot(url) {
  for (let lan = 0; lan <= THU_LAI; lan++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(HET_GIO_URL_MS) });
      const than = await r.text();
      if (r.ok && than.length > 0) {
        JSON.parse(than); // chỉ gửi JSON đọc được
        return than;
      }
      log(`[tải] ${r.status} lần ${lan + 1}: ${url.slice(0, 90)}…`);
      if (r.status === 400) return null; // URL sai — thử lại vô ích
      if (r.status === 429) {
        await new Promise((ok) => setTimeout(ok, CHO_429_MS));
        continue;
      }
    } catch (e) {
      log(`[tải] hỏng lần ${lan + 1}: ${e?.message ?? e} — ${url.slice(0, 90)}…`);
    }
    await new Promise((ok) => setTimeout(ok, 3000 * (lan + 1)));
  }
  return null;
}

const rk = await fetch(`${BASE}/api/thoi-tiet/nhap`, { headers: auth, signal: AbortSignal.timeout(HET_GIO_GUI_MS) }).catch(
  (e) => ({ ok: false, status: String(e?.message ?? e) }),
);
if (!rk.ok) {
  log(`[thời tiết] không lấy được danh sách URL: ${rk.status}`);
  process.exit(1);
}
const { urls } = await rk.json();
if (!Array.isArray(urls) || urls.length === 0) {
  log("[thời tiết] máy chủ trả danh sách rỗng — dừng");
  process.exit(1);
}

const goi = {};
let hong = 0;
let i = 0;
await Promise.all(
  Array.from({ length: SONG_SONG }, async () => {
    while (i < urls.length) {
      const url = urls[i++];
      const than = await taiMot(url);
      if (than != null) goi[url] = than;
      else hong++;
    }
  }),
);
const tho = Buffer.from(JSON.stringify({ goi }));
const nen = gzipSync(tho, { level: 9 });
log(`[tải] ${urls.length - hong}/${urls.length} URL · ${(tho.length / 1e6).toFixed(1)} MB ⇒ nén ${(nen.length / 1e6).toFixed(2)} MB`);
if (THU) process.exit(0);
if (urls.length - hong === 0) {
  log("[thời tiết] không tải được URL nào — bỏ lượt");
  process.exit(1);
}

const rg = await fetch(`${BASE}/api/thoi-tiet/nhap`, {
  method: "POST",
  headers: { ...auth, "content-type": "application/json", "content-encoding": "gzip" },
  body: nen,
  signal: AbortSignal.timeout(HET_GIO_GUI_MS),
}).catch((e) => ({ ok: false, status: String(e?.message ?? e), text: async () => "" }));
const kq = await rg.text();
log(`[gửi] ${rg.status} ${kq.slice(0, 600)}`);
process.exit(rg.ok ? 0 : 1);
