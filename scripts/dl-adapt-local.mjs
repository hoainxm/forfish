#!/usr/bin/env node
// dl-adapt-local.mjs — dựng lại đầu vào của scripts/dl-build-labels.mjs (ForFish) từ bản kéo
// DataLake LOCAL (data-local/datalake-iuu) thay cho scripts/dl-collect.mjs (cần đường hầm API).
// Ra đúng shape dl-collect ghi:
//   <out>/logbooks_<from>_<to>.json  (bỏ owner/regNo/commune/logbookNo; vessel = {id,lengthM,gso})
//   <out>/trips_<from>_<to>.json     ({code,status,vessel,dep,arr,hours,vms})
//   <out>/vessels.json               ({id,lengthM,powerCv,gear,gso}) — tàu các tỉnh có nhật ký
//   <out>/track/<vesselId>.json      ({hasVms, p:[[unixSec,lat,lng]], c:[[dir,unixSec,source,vmsRule]]})
// KHÔNG chép PII (tên/SĐT/địa chỉ chủ tàu, số đăng ký).
//
// Lọc nhật ký: API `logbooks?from&to` ≡ chuyến có NGÀY RỜI hoặc NGÀY CẬP (giờ VN) trong [from,to]
// (dò 2026-10-11: khớp 113.104/113.104 bản API 08-01→10-11, dư 247).
//
//   node scripts/dl-adapt-local.mjs --src <datalake-iuu> --snap 2026-10-11 \
//     --out $SDFISH_DATA_DIR/dl --from 2026-08-01 --to 2026-09-30 --track-months 2026-07,2026-08,2026-09,2026-10
//   --src  bắt buộc (hoặc env SDVICO_DATALAKE_ROOT) — repo AI-Assistant, gitignored: sdvico-data/data-local/datalake-iuu
//   --snap mặc định = snapshot MỚI NHẤT trong <src>/snapshots     --out mặc định $SDFISH_DATA_DIR/dl
//   --selftest  chạy bộ kiểm PII-strip trên dữ liệu giả (không đụng đĩa thật)
// Vào repo từ tools/ ngoài repo ngày 2026-10-19 (rà pipeline 2F) — trước đó KHÔNG có version.
import { createReadStream, mkdirSync, writeFileSync, appendFileSync, readFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { gzipSync } from "node:zlib";
import { pathToFileURL } from "node:url";
import { dataDir } from "./lib/data-dir.mjs";

export const PII_KEYS = ["owner", "regNo", "commune", "logbookNo"];

export async function run({ SRC, SNAP, OUT, FROM, TO, TMONTHS }) {
  const SD = join(SRC, "snapshots", SNAP);
  async function* lines(f) {
    const rl = createInterface({ input: createReadStream(f).pipe(createGunzip()), crlfDelay: Infinity });
    for await (const l of rl) if (l.trim()) yield JSON.parse(l);
  }
  const vnDay = (s) => (s ? new Date(Date.parse(s) + 7 * 3600e3).toISOString().slice(0, 10) : null);
  const inR = (d) => d && d >= FROM && d <= TO;
  const vesselLite = (v) => (v ? { id: v.id ?? v.vesselId ?? null, lengthM: v.lengthM ?? null, gso: v.province?.gso ?? v.provinceGso ?? null } : null);

  mkdirSync(join(OUT, "track"), { recursive: true });

  // 1. chuyến — gộp các tháng, khử theo code (ưu tiên bản có giờ cập, rồi bản tháng sau)
  const months = readdirSync(SD).filter((f) => /^trips-\d{4}-\d{2}\.ndjson\.gz$/.test(f)).sort();
  const trips = new Map();
  for (const f of months)
    for await (const t of lines(join(SD, f))) {
      const old = trips.get(t.code);
      if (old && old.arrival?.at && !t.arrival?.at) continue;
      trips.set(t.code, t);
    }
  console.log(`chuyến (mọi tháng): ${trips.size}`);

  // 2. nhật ký
  const logbooks = [];
  const usedTrips = new Set();
  for await (const i of lines(join(SD, "logbooks-all.ndjson.gz"))) {
    const t = trips.get(i.trip?.code);
    if (!t) continue;
    if (!(inR(vnDay(t.departure?.at)) || inR(vnDay(t.arrival?.at)))) continue;
    const { owner, regNo, commune, ...v } = i.vessel ?? {};
    void owner; void regNo; void commune;
    const { vessel, logbookNo, ...rest } = i;
    void vessel; void logbookNo;
    logbooks.push({ ...rest, vessel: vesselLite(v) });
    usedTrips.add(t.code);
  }
  writeFileSync(join(OUT, `logbooks_${FROM}_${TO}.json`), JSON.stringify(logbooks));
  console.log(`nhật ký: ${logbooks.length}`);

  // 3. chuyến ra: chuyến có chân trong khoảng + mọi chuyến nhật ký trỏ tới
  const tripRows = [];
  for (const i of trips.values()) {
    const leg = inR(vnDay(i.departure?.at)) || inR(vnDay(i.arrival?.at));
    if (!leg && !usedTrips.has(i.code)) continue;
    tripRows.push({
      code: i.code,
      status: i.status,
      vessel: vesselLite(i.vessel),
      dep: i.departure?.at ?? null,
      arr: i.arrival?.at ?? null,
      hours: i.durationHours ?? null,
      vms: i.vms ? { flags: i.vms.flags ?? [], dep: i.vms.departedAt ?? null, arr: i.vms.arrivedAt ?? null, seaDays: i.vms.seaDays ?? null } : null,
    });
  }
  writeFileSync(join(OUT, `trips_${FROM}_${TO}.json`), JSON.stringify(tripRows));
  console.log(`chuyến ra: ${tripRows.length}`);

  // 4. tàu — sổ mới nhất, các tỉnh có nhật ký
  const gsos = new Set(logbooks.map((l) => l.vessel?.gso).filter(Boolean));
  const vs = [];
  for await (const i of lines(join(SD, "vessels.ndjson.gz"))) {
    if (!gsos.has(i.provinceGso)) continue;
    vs.push({ id: i.vesselId, lengthM: i.lengthM ?? null, powerCv: i.powerCv ?? null, gear: i.gear ?? null, gso: i.provinceGso });
  }
  writeFileSync(join(OUT, "vessels.json"), JSON.stringify(vs));
  console.log(`tàu: ${vs.length} (${gsos.size} tỉnh)`);

  // 5. track — chỉ tàu có nhật ký; gom từng tháng ra file tạm rồi ghép
  const want = new Set(logbooks.map((l) => l.vessel?.id).filter(Boolean));
  const TMP = join(OUT, "_tmp_track");
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  for (const m of TMONTHS) {
    const f = join(SRC, "tracks", `${m}.ndjson.gz`);
    if (!existsSync(f)) { console.warn(`! thiếu ${f}`); continue; }
    let k = 0;
    for await (const o of lines(f)) {
      if (!want.has(o.v)) continue;
      const c = (o.pc ?? []).map((x) => [x.direction, Date.parse(x.at) / 1000, x.source ?? null, x.vmsRule ?? null]);
      appendFileSync(join(TMP, `${o.v}.ndjson`), JSON.stringify({ p: o.pts ?? [], c }) + "\n");
      k++;
    }
    console.log(`track ${m}: ${k} tàu×tháng`);
  }
  let withVms = 0;
  for (const id of want) {
    const f = join(TMP, `${id}.ndjson`);
    const pm = new Map(), cm = new Map();
    if (existsSync(f))
      for (const l of readFileSync(f, "utf8").split("\n")) {
        if (!l) continue;
        const o = JSON.parse(l);
        for (const [t, la, lo] of o.p) pm.set(t, [t, +la.toFixed(5), +lo.toFixed(5)]);
        for (const c of o.c) cm.set(`${c[0]}|${c[1]}`, c);
      }
    const p = [...pm.values()].sort((a, b) => a[0] - b[0]);
    const c = [...cm.values()].sort((a, b) => a[1] - b[1]);
    const hasVms = p.length > 0;
    if (hasVms) withVms++;
    writeFileSync(join(OUT, "track", `${id}.json`), JSON.stringify({ hasVms, p: hasVms ? p : [], c: hasVms ? c : [] }));
  }
  rmSync(TMP, { recursive: true, force: true });
  console.log(`xong: ${want.size} tàu có nhật ký · ${withVms} có VMS → ${OUT}`);

}

// ── selftest: dữ liệu giả, kiểm PII bị bỏ và shape ra đúng ────────────────────────────────────────
export async function selftest() {
  const { mkdtempSync, rmSync: rm } = await import("node:fs");
  const root = mkdtempSync(join(tmpdir(), "dl-adapt-"));
  const snap = join(root, "snapshots", "2026-10-11"); mkdirSync(snap, { recursive: true });
  mkdirSync(join(root, "tracks"), { recursive: true });
  const gz = (f, rows) => writeFileSync(f, gzipSync(rows.map((r) => JSON.stringify(r)).join("\n") + "\n"));
  gz(join(snap, "trips-2026-08.ndjson.gz"), [{ code: "T1", status: "done", vessel: { id: "V1", lengthM: 20, province: { gso: "56" } }, departure: { at: "2026-08-05T01:00:00Z" }, arrival: { at: "2026-08-07T01:00:00Z" }, durationHours: 48 }]);
  gz(join(snap, "logbooks-all.ndjson.gz"), [{ trip: { code: "T1" }, logbookNo: "SECRET-1", catch: [{ asfis: "YFT", kg: 10 }], vessel: { id: "V1", lengthM: 20, owner: "Nguyen Van A", regNo: "KG-1234-TS", commune: "X", province: { gso: "56" } } }]);
  gz(join(snap, "vessels.ndjson.gz"), [{ vesselId: "V1", lengthM: 20, powerCv: 400, gear: "PS", provinceGso: "56", owner: "Nguyen Van A" }]);
  gz(join(root, "tracks", "2026-08.ndjson.gz"), [{ v: "V1", pts: [[1786000000, 10.123456789, 106.5]], pc: [{ direction: "out", at: "2026-08-05T01:00:00Z" }] }]);
  const out = join(root, "out");
  const log = console.log; console.log = () => {};
  try { await run({ SRC: root, SNAP: "2026-10-11", OUT: out, FROM: "2026-08-01", TO: "2026-09-30", TMONTHS: ["2026-08"] }); } finally { console.log = log; }
  const rd = (f) => readFileSync(join(out, f), "utf8");
  const fail = (m) => { throw new Error("selftest HỎNG: " + m); };
  const all = readdirSync(out).filter((f) => f.endsWith(".json")).map(rd).join("") + rd("track/V1.json");
  for (const bad of ["Nguyen", "KG-1234", "SECRET-1"]) if (all.includes(bad)) fail("PII lọt ra: " + bad);
  const lb = JSON.parse(rd("logbooks_2026-08-01_2026-09-30.json"));
  if (lb.length !== 1 || lb[0].vessel.id !== "V1" || "logbookNo" in lb[0]) fail("logbook shape");
  const tr = JSON.parse(rd("track/V1.json"));
  if (!tr.hasVms || tr.p[0][1] !== 10.12346) fail("track làm tròn 5 chữ số");
  if (JSON.parse(rd("vessels.json"))[0].powerCv !== 400) fail("vessels");
  rm(root, { recursive: true, force: true });
  console.log("dl-adapt-local selftest OK");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2);
  if (argv.includes("--selftest")) await selftest().catch((e) => { console.error(e.message); process.exit(1); });
  else {
    const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
    const SRC = arg("src", process.env.SDVICO_DATALAKE_ROOT);
    if (!SRC) { console.error("cần --src <datalake-iuu> hoặc env SDVICO_DATALAKE_ROOT"); process.exit(2); }
    const snaps = existsSync(join(SRC, "snapshots")) ? readdirSync(join(SRC, "snapshots")).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort() : [];
    const SNAP = arg("snap", snaps.at(-1));
    if (!SNAP) { console.error(`không có snapshot trong ${SRC}/snapshots`); process.exit(2); }
    await run({
      SRC, SNAP,
      OUT: arg("out", join(dataDir(), "dl")),
      FROM: arg("from", "2026-08-01"), TO: arg("to", "2026-09-30"),
      TMONTHS: arg("track-months", "2026-07,2026-08,2026-09,2026-10").split(","),
    });
  }
}
