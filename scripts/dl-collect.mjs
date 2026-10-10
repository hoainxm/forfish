#!/usr/bin/env node
// scripts/dl-collect.mjs — TẢI DỮ LIỆU HUẤN LUYỆN lớp dự báo cá từ DataLake thủy sản (Cục).
// ─────────────────────────────────────────────────────────────────────────────
// Lấy ba thứ cho khoảng [from, to]:
//   1. nhật ký khai thác eCDT (`logbooks`) — sản lượng theo loài + số mẻ (+ mẻ nếu có)
//   2. chuyến (`trips`) — giờ rời/cập để cắt track đúng chuyến
//   3. track VMS (`vessels/{id}/track`, ≤31 ngày/lần) của MỌI tàu có nhật ký
// + danh mục tàu (nghề, chiều dài, công suất) của các tàu đó.
//
// RIÊNG TƯ: API trả cả tên/SĐT/địa chỉ chủ tàu. Bộ tải BỎ NGAY `owner`, `commune`,
// `regNo`/`reg` trước khi ghi đĩa — chỉ giữ mã tàu V… (mã hệ thống, không phải số ĐK).
// DỮ LIỆU KHÔNG VÀO REPO (CLAUDE.md "chống phình" quy tắc 5): mặc định ghi ra
// ~/sdfish-data/dl. Chỉ THAM SỐ đã fit mới vào src/data.
//
//   DATALAKE_BASE=https://….trycloudflare.com DATALAKE_KEY=… \
//     node scripts/dl-collect.mjs --from 2026-08-01 --to 2026-09-30 [--track-from 2026-07-01] [--out ~/sdfish-data/dl] [--conc 12]
//   (hoặc --env /đường/dẫn/.env.local có DATALAKE_MCP_BASE + DATALAKE_MCP_KEY)
// Chạy lại được: phần đã tải (file có sẵn) được bỏ qua.
import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const FROM = arg("from", "2026-08-01");
const TO = arg("to", "2026-09-30");
const OUT = arg("out", join(homedir(), "sdfish-data", "dl")).replace(/^~/, homedir());
const CONC = Number(arg("conc", 12));
// --only tracks: chỉ tải track (chạy song song với một tiến trình đang tải chuyến/tàu)
const ONLY = arg("only", null);
const PAGE_CONC = Number(arg("page-conc", 2)); // trang chuyến nặng: >2 làm nghẽn cả track

let BASE = process.env.DATALAKE_BASE;
let KEY = process.env.DATALAKE_KEY;
const envFile = arg("env", null);
if (envFile) {
  const env = Object.fromEntries(
    readFileSync(envFile, "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
  BASE ||= env.DATALAKE_MCP_BASE;
  KEY ||= env.DATALAKE_MCP_KEY;
}
if (!BASE || !KEY) {
  console.error("thiếu DATALAKE_BASE/DATALAKE_KEY (hoặc --env)");
  process.exit(2);
}
const API = `${BASE.replace(/\/$/, "")}/api/dl-iuu-report`;
mkdirSync(join(OUT, "track"), { recursive: true });

async function get(path, tries = 5) {
  let last;
  for (let a = 0; a < tries; a++) {
    try {
      const r = await fetch(`${API}/${path}`, { headers: { "X-Api-Key": KEY }, signal: AbortSignal.timeout(240_000) });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`${r.status} ${path}`);
      return await r.json();
    } catch (e) {
      last = e;
      await new Promise((s) => setTimeout(s, 3000 + a * 4000));
    }
  }
  throw last;
}

/** Bỏ PII: chỉ giữ mã tàu, chiều dài, tỉnh. */
const vesselLite = (v) => (v ? { id: v.id ?? v.vesselId ?? null, lengthM: v.lengthM ?? null, gso: v.province?.gso ?? v.provinceGso ?? null } : null);

/** Mọi trang của một danh sách: trang 1 lấy tổng, các trang sau tải SONG SONG (tuần tự ~1 trang/30 s). */
async function pages(path, map) {
  // mỗi trang lưu xuống đĩa ⇒ dừng giữa chừng chạy lại không mất (trang chuyến ~30 s/trang)
  const tag = path.replace(/[^a-z0-9]+/gi, "_");
  mkdirSync(join(OUT, "pages"), { recursive: true });
  const page = async (p) => {
    const f = join(OUT, "pages", `${tag}_${p}.json`);
    if (existsSync(f)) return JSON.parse(readFileSync(f, "utf8"));
    const items = (await get(`${path}&page=${p}&pageSize=2000`))?.items ?? [];
    writeFileSync(f, JSON.stringify(items.map(map)));
    return items.map(map);
  };
  const first = await get(`${path}&page=1&pageSize=1`);
  const total = first?.total ?? 0;
  const n = Math.ceil(total / 2000);
  const got = new Array(n + 1);
  const todo = Array.from({ length: n }, (_, i) => i + 1);
  let done = 0;
  await Promise.all(
    Array.from({ length: PAGE_CONC }, async () => {
      while (todo.length) {
        const p = todo.shift();
        got[p] = await page(p);
        process.stdout.write(`\r${path.split("?")[0]} trang ${++done}/${n}   `);
      }
    }),
  );
  process.stdout.write("\n");
  const out = got.flat();
  if (out.length !== total) console.warn(`! ${path.split("?")[0]}: nhận ${out.length} ≠ tổng ${total}`);
  return out;
}

const range = `from=${FROM}&to=${TO}`;

// 1. nhật ký
const fLb = join(OUT, `logbooks_${FROM}_${TO}.json`);
if (!existsSync(fLb)) {
  const rows = await pages(`logbooks?${range}`, (i) => {
    const { owner, regNo, commune, ...v } = i.vessel ?? {};
    void owner; void regNo; void commune;
    const { vessel, logbookNo, ...rest } = i;
    void vessel; void logbookNo;
    return { ...rest, vessel: vesselLite(v) };
  });
  writeFileSync(fLb, JSON.stringify(rows));
}
const logbooks = JSON.parse(readFileSync(fLb, "utf8"));

// 2. chuyến
const fTr = join(OUT, `trips_${FROM}_${TO}.json`);
if (ONLY !== "tracks" && !existsSync(fTr)) {
  const rows = await pages(`trips?${range}`, (i) => ({
    code: i.code,
    status: i.status,
    vessel: vesselLite(i.vessel),
    dep: i.departure?.at ?? null,
    arr: i.arrival?.at ?? null,
    hours: i.durationHours ?? null,
    vms: i.vms ? { flags: i.vms.flags ?? [], dep: i.vms.departedAt ?? null, arr: i.vms.arrivedAt ?? null, seaDays: i.vms.seaDays ?? null } : null,
  }));
  writeFileSync(fTr, JSON.stringify(rows));
}

// 3. danh mục tàu (nghề) — theo tỉnh của các tàu có nhật ký
// Thứ tự tải track = độ hữu ích (máy chủ chịu ~6 lượt/s, 27 nghìn tàu ≈ vài giờ — tải dần,
// kiểm định chạy được trên phần đã có): tàu có khai số mẻ trước (để chỉnh ngưỡng tốc độ),
// rồi tàu nhiều sản lượng nhất.
const prio = new Map();
for (const l of logbooks) {
  const id = l.vessel?.id;
  if (!id) continue;
  const kg = Math.max(l.landedKg ?? 0, l.catchKg ?? 0);
  prio.set(id, (prio.get(id) ?? 0) + kg + ((l.haulCount ?? 0) > 0 ? 1e9 : 0));
}
const vesselIds = [...prio.keys()].sort((a, b) => prio.get(b) - prio.get(a));
const fVs = join(OUT, "vessels.json");
if (ONLY !== "tracks" && !existsSync(fVs)) {
  const gsos = [...new Set(logbooks.map((l) => l.vessel?.gso).filter(Boolean))];
  const all = [];
  for (const g of gsos)
    all.push(
      ...(await pages(`vessels?province=${g}`, (i) => ({
        id: i.vesselId, lengthM: i.lengthM ?? null, powerCv: i.powerCv ?? null, gear: i.gear ?? null, gso: i.provinceGso ?? g,
      }))),
    );
  writeFileSync(fVs, JSON.stringify(all));
}

// 4. track — chia khoảng thành đoạn ≤ 31 ngày
function windows(from, to) {
  const out = [];
  let a = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (a <= end) {
    const b = new Date(Math.min(a.getTime() + 29 * 86400e3, end.getTime()));
    out.push([a.toISOString().slice(0, 10), b.toISOString().slice(0, 10)]);
    a = new Date(b.getTime() + 86400e3);
  }
  return out;
}
// chuyến của nhật ký tháng 8 có thể rời bến từ tháng 7 → track bắt đầu sớm hơn (--track-from)
const W = windows(arg("track-from", FROM), TO);
let done = 0, noVms = 0, fail = 0;
const t0 = Date.now();
async function track(id) {
  const f = join(OUT, "track", `${id}.json`);
  if (existsSync(f)) return;
  const pts = [];
  const calls = [];
  let hasVms = false;
  for (const [a, b] of W) {
    const d = await get(`vessels/${id}/track?from=${a}&to=${b}`);
    if (!d) continue;
    if (!d.hasVms) break; // tàu không lắp VMS: các đoạn sau cũng rỗng
    hasVms = true;
    for (const p of d.points ?? []) pts.push([Date.parse(p.at) / 1000, +p.lat.toFixed(5), +p.lng.toFixed(5)]);
    for (const c of d.portCalls ?? []) calls.push([c.direction, Date.parse(c.at) / 1000, c.source ?? null, c.vmsRule ?? null]);
  }
  if (!hasVms) noVms++;
  writeFileSync(f, JSON.stringify({ hasVms, p: pts, c: calls }));
}
const queue = [...vesselIds];
await Promise.all(
  Array.from({ length: CONC }, async () => {
    while (queue.length) {
      const id = queue.shift();
      try { await track(id); } catch { fail++; }
      if (++done % 500 === 0) console.log(`track ${done}/${vesselIds.length} · không VMS ${noVms} · lỗi ${fail} · ${Math.round((Date.now() - t0) / 1000)}s`);
    }
  }),
);
console.log(`xong: ${logbooks.length} nhật ký · ${vesselIds.length} tàu · lỗi track ${fail} → ${OUT}`);
