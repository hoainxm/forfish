#!/usr/bin/env node
// scripts/train/run.mjs — RUNNER MỘT LỆNH cho pipeline train dự báo cá (rà pipeline 2026-10-18, mảnh 2F).
// Thuần Node, không dependency. Chạy tới stage `eval` (fit/propose/PR đợi nối nền xong).
//
//   node scripts/train/run.mjs [--data <dir>] [--src <datalake-iuu>] [--snap <YYYY-MM-DD>]
//        [--dry-run] [--resume] [--only id,id] [--from-stage id] [--list]
//   $SDFISH_DATA_DIR  thư mục dữ liệu NGOÀI repo (mặc định ~/sdfish-data; PC GPU: /mnt/c/Users/admin/sdfish-data)
//   $SDVICO_DATALAKE_ROOT  DataLake thô (mặc định ~/forlife/sdvico-data/data-local/datalake-iuu)
//   $TSX  đường dẫn tsx (mặc định: node_modules/.bin/tsx của repo → ~/fish-eval-r1/tools/node_modules/.bin/tsx → npx tsx)
//
// Stage = {id, deps, inputs[], outputs[], items[{id, argv|fn, outputs[]}], needsNet, memMB}.
//   khoá cache của item = sha256(mã script + mọi file ./import của nó + argv + băm đầu vào)
//   đầu vào: file ≤ 256 MB băm nội dung; thư mục/file lớn băm (tên + kích thước) — không băm 11 GB mỗi lần.
//   item trùng khoá và đủ đầu ra (đúng kích thước đã ghi) ⇒ SKIP. Chỉ mục cache: <data>/runs/cache.json.
//   <data>/runs/<YYYY-MM-DD>-<gitsha>[-dirty]/manifest.json được ghi SAU MỖI item (chết giữa chừng vẫn nối được).
//   --resume  bỏ qua stage manifest đã ghi `done` (không băm lại đầu vào). Không có cờ: băm lại, item trùng khoá ⇒ CACHE.
//   --dry-run  in DAG + từng item sẽ CHẠY hay CACHE, không chạy gì, không ghi đĩa.
//   Tuần tự (RAM 23 GB: labels 9 GB, fleet 8 GB — không song song hoá ở đây; nợ: --jobs 2 khi cần).
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, symlinkSync, writeFileSync, renameSync, rmSync, lstatSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dataDir, datalakeRoot } from "../lib/data-dir.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sha = (x) => createHash("sha256").update(x).digest("hex");
const HASH_MAX = 256 * 1024 * 1024;

// ── băm (có nhớ trong một lượt chạy; xoá nhớ sau mỗi item thật sự chạy) ──────────────────────────────
let memo = new Map();
export function fingerprint(p) {
  if (memo.has(p)) return memo.get(p);
  let out;
  if (!existsSync(p)) out = null;
  else {
    const st = statSync(p);
    if (st.isFile()) out = st.size <= HASH_MAX ? "f:" + sha(readFileSync(p)) : `s:${st.size}`;
    else {
      const h = createHash("sha256");
      const walk = (d) => {
        for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
          const q = join(d, e.name);
          if (e.isDirectory()) walk(q);
          else if (e.isFile() || e.isSymbolicLink()) { try { h.update(`${q.slice(p.length)}:${statSync(q).size}\n`); } catch { h.update(`${q.slice(p.length)}:?\n`); } }
        }
      };
      walk(p);
      out = "d:" + h.digest("hex");
    }
  }
  memo.set(p, out);
  return out;
}

/** Mã của script + mọi file tương đối nó import (đệ quy) → một băm. */
export function codeHash(entry, seen = new Set()) {
  const h = createHash("sha256");
  const visit = (f) => {
    if (seen.has(f) || !existsSync(f) || !statSync(f).isFile()) return;
    seen.add(f);
    const src = readFileSync(f, "utf8");
    h.update(f.slice(REPO.length) + "\n" + src);
    for (const m of src.matchAll(/(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g)) {
      const base = resolve(dirname(f), m[1]);
      for (const c of [base, base + ".mjs", base + ".ts", base + ".js", join(base, "index.ts")]) if (existsSync(c) && statSync(c).isFile()) { visit(c); break; }
    }
  };
  visit(entry);
  return h.digest("hex");
}

// ── cấu hình + định nghĩa stage ────────────────────────────────────────────────────────────────────
export const WINDOWS = ["2026-01-01,2026-02-28", "2026-03-01,2026-04-30", "2026-05-01,2026-06-30", "2026-07-01,2026-08-31", "2026-09-01,2026-10-11"];
export const MONTHS = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
const LAST_DAY = "2026-10-11";

export function dayRange(from, to) {
  const out = [];
  for (let t = Date.parse(from + "T00:00:00Z"); t <= Date.parse(to + "T00:00:00Z"); t += 86400e3) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

export function buildStages(cfg) {
  const { D, R, SNAP, TSX } = cfg;
  const node = (heap) => (heap ? ["node", `--max-old-space-size=${heap}`] : ["node"]);
  const S = (f) => join(REPO, "scripts", f);
  const stages = [];
  const add = (s) => stages.push({ deps: [], inputs: [], needsNet: false, memMB: 1000, ...s });

  const trackMonths = MONTHS.join(",");
  add({
    id: "adapt", deps: [], memMB: 4000,
    note: "snapshot DataLake local → dl-all/ (shape dl-collect, bỏ PII)",
    inputs: [join(R, "snapshots", SNAP), join(R, "tracks")],
    items: [{ id: "dl-all", entry: S("dl-adapt-local.mjs"), argv: [...node(), S("dl-adapt-local.mjs"), "--src", R, "--snap", SNAP, "--out", join(D, "dl-all"), "--from", "2026-01-01", "--to", LAST_DAY, "--track-months", trackMonths],
      outputs: [join(D, "dl-all/vessels.json"), join(D, `dl-all/logbooks_2026-01-01_${LAST_DAY}.json`), join(D, `dl-all/trips_2026-01-01_${LAST_DAY}.json`)] }],
  });
  add({
    id: "adapt-0809", deps: [], memMB: 3000,
    note: "nhãn kiểm định 8–9/2026 → dl-trk0809/",
    inputs: [join(R, "snapshots", SNAP), join(R, "tracks")],
    items: [{ id: "dl-trk0809", entry: S("dl-adapt-local.mjs"), argv: [...node(), S("dl-adapt-local.mjs"), "--src", R, "--snap", SNAP, "--out", join(D, "dl-trk0809"), "--from", "2026-08-01", "--to", "2026-09-30", "--track-months", "2026-07,2026-08,2026-09,2026-10"],
      outputs: [join(D, "dl-trk0809/vessels.json"), join(D, "dl-trk0809/logbooks_2026-08-01_2026-09-30.json"), join(D, "dl-trk0809/trips_2026-08-01_2026-09-30.json")] }],
  });
  add({
    id: "aux", deps: ["adapt"], memMB: 4000,
    note: "gear-map (nghề tàu NULL) + pairs (kéo đôi) cho nhãn v2",
    inputs: [join(R, "encounters", "events.ndjson")],
    items: [
      { id: "gear-map", entry: S("gear-infer.mjs"), argv: [...node(), S("gear-infer.mjs"), "--dir", join(D, "dl-all"), "--out", join(D, "dl-all/gear-map.json")], inputs: [join(D, "dl-all/vessels.json"), join(D, `dl-all/logbooks_2026-01-01_${LAST_DAY}.json`)], outputs: [join(D, "dl-all/gear-map.json")] },
      { id: "pairs", entry: S("dl-labels-v2.mjs"), argv: [...node(), S("dl-labels-v2.mjs"), "--pairs-prep", "--events", join(R, "encounters/events.ndjson"), "--out", join(D, "dl-all/pairs.json")], outputs: [join(D, "dl-all/pairs.json")] },
    ],
  });

  const v2Common = ["--v2", "--ablate", "--ports", join(R, "snapshots", SNAP, "catalog-ports.json.gz"), "--encounters", join(R, "encounters/vessels.json"), "--gear-map", join(D, "dl-all/gear-map.json"), "--pairs", join(D, "dl-all/pairs.json")];
  const labelDirs = WINDOWS.map((w) => join(D, `dl-all/labels-v2-${w.split(",")[0]}`));
  add({
    id: "labels-v2", deps: ["adapt", "adapt-0809", "aux"], memMB: 9000,
    note: "nhãn v2: 5 khúc 2 tháng (dl-all) + nhãn kiểm định 8–9 (dl-trk0809)",
    inputs: [join(R, "snapshots", SNAP, "catalog-ports.json.gz"), join(R, "encounters/vessels.json"), join(D, "dl-all/gear-map.json"), join(D, "dl-all/pairs.json"), S("fishing-bands.v2.json")],
    items: [
      ...WINDOWS.map((w, i) => ({ id: `w-${w.split(",")[0]}`, entry: S("dl-build-labels.mjs"),
        argv: [...node(9000), S("dl-build-labels.mjs"), ...v2Common, "--dir", join(D, "dl-all"), "--from", "2026-01-01", "--to", LAST_DAY, "--window", w, "--out", labelDirs[i]],
        inputs: [join(D, "dl-all/vessels.json"), join(D, `dl-all/logbooks_2026-01-01_${LAST_DAY}.json`), join(D, "dl-all/track")],
        outputs: [join(labelDirs[i], "report.json"), join(labelDirs[i], "effort.csv"), join(labelDirs[i], "catch.csv")] })),
      { id: "val-0809", entry: S("dl-build-labels.mjs"),
        argv: [...node(9000), S("dl-build-labels.mjs"), "--v2", "--ports", join(R, "snapshots", SNAP, "catalog-ports.json.gz"), "--encounters", join(R, "encounters/vessels.json"), "--gear-map", join(D, "dl-all/gear-map.json"), "--pairs", join(D, "dl-all/pairs.json"), "--dir", join(D, "dl-trk0809"), "--from", "2026-08-01", "--to", "2026-09-30", "--out", join(D, "dl-trk0809/labels-v2")],
        inputs: [join(D, "dl-trk0809/vessels.json"), join(D, "dl-trk0809/logbooks_2026-08-01_2026-09-30.json"), join(D, "dl-trk0809/track")],
        outputs: [join(D, "dl-trk0809/labels-v2/report.json"), join(D, "dl-trk0809/labels-v2/effort.csv"), join(D, "dl-trk0809/labels-v2/catch.csv")] },
    ],
  });

  // Tập tháng loại ra cho từng biến thể lưới: ex-<m>, ex-<a>+<b> (nếp 2 tháng), ex-fwd-<m> (mọi tháng ≥ m: chuỗi tiến thuần)
  const variants = [
    { tag: "full", ex: [] },
    ...MONTHS.map((m) => ({ tag: `ex-${m}`, ex: [m] })),
    ...[0, 2, 4, 6, 8].map((i) => ({ tag: `ex-${MONTHS[i]}+${MONTHS[i + 1]}`, ex: [MONTHS[i], MONTHS[i + 1]] })),
    ...MONTHS.slice(1).map((m) => ({ tag: `ex-fwd-${m}`, ex: MONTHS.filter((x) => x >= m) })),
    ...["2026-08", "2026-09"].flatMap((m) => ["A", "B"].map((h) => ({ tag: `ex-${m}-${h}`, ex: [m], half: h }))),
  ];
  const exArgs = (v) => [...(v.ex.length ? ["--exclude-month", v.ex.join(",")] : []), ...(v.half ? ["--vessel-half", v.half] : [])];
  add({
    id: "fleet-grid-v2", deps: ["adapt", "aux"], memMB: 8000,
    note: "lưới giờ đánh đội tàu v2: full + ex-tháng + nếp 2 tháng + ex-fwd + nửa tàu A/B (08, 09)",
    inputs: [join(R, "snapshots", SNAP), join(D, "dl-all/gear-map.json"), S("fishing-bands.v2.json")],
    items: variants.map((v) => {
      const out = join(D, "fleet-v2", v.tag === "full" ? "fleet-full.json" : `fleet-${v.tag}.json`);
      return { id: v.tag, entry: S("build-fleet-effort-grid.mjs"), argv: [...node(5000), S("build-fleet-effort-grid.mjs"), "--root", R, "--snapshot", SNAP, "--v2", "--gear-map", join(D, "dl-all/gear-map.json"), ...exArgs(v), "--out", out], outputs: [out] };
    }),
  });
  add({
    id: "catch-grid-v2", deps: ["labels-v2"], memMB: 4000,
    note: "lưới kg/loài v2 từ 5 khúc nhãn v2: cùng biến thể với lưới đội tàu",
    inputs: labelDirs.map((d) => join(d, "catch.csv")),
    items: variants.map((v) => {
      const out = join(D, "catch-v2", v.tag === "full" ? "catch-full.json" : `catch-${v.tag}.json`);
      return { id: v.tag, entry: S("build-species-catch-grid.mjs"), argv: [...node(4000), S("build-species-catch-grid.mjs"), "--labels", labelDirs.join(","), ...exArgs(v), "--out", out], outputs: [out] };
    }),
  });

  const satDates = dayRange("2026-01-01", cfg.satTo ?? LAST_DAY);
  add({
    id: "sat-grids", deps: [], needsNet: true, memMB: 2000,
    note: "lưới vệ tinh ERDDAP theo ngày (cache từng ngày trong fish-validate-run; mất mạng ⇒ dừng stage này, stage khác không ảnh hưởng)",
    items: [{ id: "erddap", entry: S("fish-validate-run.mjs"), argv: [...TSX, S("fish-validate-run.mjs"), "--dates", satDates.join(","), "--out", join(D, "fc-full"), "--features", "full"], outputs: [join(D, "fc-full/grids/etopo.json")] }],
  });
  add({
    id: "features-cache", deps: ["sat-grids"], memMB: 6000,
    note: "đặc trưng ô-ngày Float32 từ lưới vệ tinh (một nguồn công thức với production)",
    inputs: [join(D, "fc-full/grids")],
    items: [{ id: "features", entry: S("fish-features-cache.mjs"), argv: [...TSX, S("fish-features-cache.mjs")], outputs: [join(D, "fc-full/features/manifest.json")] }],
  });
  add({
    id: "eval-honest", deps: ["labels-v2", "fleet-grid-v2", "catch-grid-v2", "sat-grids"], memMB: 9000,
    note: "bộ đo trung thực (AUC trong-nghề, baseline, 4 phép rò, bootstrap, CPUE) trên nhãn kiểm định 8–9",
    inputs: [join(D, "dl-trk0809/labels-v2"), join(D, "fleet-v2"), join(D, "catch-v2")],
    items: [
      { id: "grids-0809", fn: "linkGrids0809", argv: ["(tạo thư mục fc-full/grids-0809 chỉ chứa 08–09 + etopo; dl-eval-fleet đòi lưới giữ-tháng-ra cho MỌI tháng có ảnh)"], outputs: [join(D, "fc-full/grids-0809/etopo.json")] },
      { id: "honest", entry: S("dl-eval-fleet.mjs"), argv: [...TSX, S("dl-eval-fleet.mjs"), "--honest", "--grids", join(D, "fc-full/grids-0809"), "--labels", join(D, "dl-trk0809/labels-v2"), "--fleet-dir", join(D, "fleet-v2"), "--fleet-full", join(D, "fleet-v2/fleet-full.json"), "--catch-dir", join(D, "catch-v2"), "--out", join(D, "eval-v2"), "--boot", "500"], outputs: [join(D, "eval-v2/honest-eval.json")] },
    ],
  });
  return stages;
}

const FNS = {
  linkGrids0809(cfg) {
    const src = join(cfg.D, "fc-full/grids"), dst = join(cfg.D, "fc-full/grids-0809");
    rmSync(dst, { recursive: true, force: true });
    mkdirSync(dst, { recursive: true });
    for (const f of readdirSync(src)) if (f === "etopo.json" || /-2026-0[89]-\d\d\.json$/.test(f)) symlinkSync(join(src, f), join(dst, f));
  },
};

// ── thực thi ──────────────────────────────────────────────────────────────────────────────────────────
export function resolveTsx() {
  if (process.env.TSX) return process.env.TSX.split(" ");
  for (const c of [join(REPO, "node_modules/.bin/tsx"), join(process.env.HOME ?? "", "fish-eval-r1/tools/node_modules/.bin/tsx")]) if (existsSync(c)) return [c];
  return ["npx", "tsx"];
}

/** Khoá của item = mã + argv + băm đầu vào (của stage và của item). null nếu thiếu đầu vào (chưa có). */
export function itemKey(stage, item) {
  const ins = [...(stage.inputs ?? []), ...(item.inputs ?? [])];
  const fps = [];
  for (const p of ins) {
    const f = fingerprint(p);
    if (f === null) return { key: null, missing: p };
    fps.push(basename(p) + "=" + f);
  }
  const code = item.entry ? codeHash(item.entry) : sha(item.fn ?? "");
  return { key: sha(JSON.stringify({ code, argv: item.argv, fps })), missing: null };
}

const outputsOk = (item, rec) => rec && item.outputs.every((o) => existsSync(o) && statSync(o).size === rec.sizes?.[o]);
const sizes = (outs) => Object.fromEntries(outs.filter(existsSync).map((o) => [o, statSync(o).size]));
const readJson = (f, d) => { try { return JSON.parse(readFileSync(f, "utf8")); } catch { return d; } };
const writeAtomic = (f, o) => { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f + ".tmp", JSON.stringify(o, null, 1)); renameSync(f + ".tmp", f); };

export function plan(stages, { only, fromStage }) {
  const ids = new Set(stages.map((s) => s.id));
  for (const x of [...(only ?? []), ...(fromStage ? [fromStage] : [])]) if (!ids.has(x)) throw new Error(`stage không có: ${x} (có: ${[...ids].join(", ")})`);
  let sel = stages;
  if (only?.length) sel = stages.filter((s) => only.includes(s.id));
  if (fromStage) { const i = stages.findIndex((s) => s.id === fromStage); sel = sel.filter((s) => stages.indexOf(s) >= i); }
  return sel; // thứ tự khai báo đã là thứ tự topo (kiểm ở selftest)
}

function gitInfo() {
  const g = (a) => spawnSync("git", a, { cwd: REPO, encoding: "utf8" }).stdout?.trim() ?? "";
  const dirty = g(["status", "--porcelain", "--", "scripts", "src"]) !== "";
  return { sha: g(["rev-parse", "--short", "HEAD"]) || "nogit", dirty };
}

async function main(argv) {
  const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
  const has = (k) => argv.includes(`--${k}`);
  const D = resolve(arg("data", dataDir()));
  const R = resolve(arg("src", datalakeRoot()));
  const snaps = existsSync(join(R, "snapshots")) ? readdirSync(join(R, "snapshots")).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort() : [];
  const SNAP = arg("snap", snaps.at(-1) ?? "(chưa có snapshot)");
  const cfg = { D, R, SNAP, TSX: resolveTsx() };
  const stages = buildStages(cfg);
  const sel = plan(stages, { only: arg("only", "").split(",").filter(Boolean), fromStage: arg("from-stage", null) });
  const dry = has("dry-run") || has("list");
  const git = gitInfo();
  const runId = `${new Date().toISOString().slice(0, 10)}-${git.sha}${git.dirty ? "-dirty" : ""}`;
  const runDir = join(D, "runs", runId);
  const manifestPath = join(runDir, "manifest.json");
  const cachePath = join(D, "runs", "cache.json");
  const cache = readJson(cachePath, {});
  const prev = readJson(manifestPath, null); // cùng ngày + cùng commit ⇒ GỘP vào manifest cũ (item CACHE giữ `lastRan` của lượt chạy thật)
  const manifest = prev;
  const m = manifest ?? { runId, git, data: D, src: R, snapshot: SNAP, startedAt: new Date().toISOString(), stages: {} };

  console.log(`${dry ? "DRY-RUN " : ""}train run ${runId}\n  data=${D}\n  src=${R} snapshot=${SNAP}\n  tsx=${cfg.TSX.join(" ")}`);
  let failed = null;
  for (const st of sel) {
    const need = st.deps.filter((d) => !sel.some((s) => s.id === d));
    console.log(`\n[${st.id}] ${st.note ?? ""}\n  deps=${st.deps.join(",") || "—"} net=${st.needsNet ? "CÓ" : "không"} ram≈${st.memMB}MB items=${st.items.length}${need.length ? ` (deps ngoài lượt chọn: ${need.join(",")} — giả định đã chạy)` : ""}`);
    if (!dry && m.stages[st.id]?.status === "done" && has("resume")) { console.log("  = resume: stage đã xong trong manifest"); continue; }
    const old = m.stages[st.id]?.items ?? {};
    const rec = (m.stages[st.id] = { status: "running", startedAt: new Date().toISOString(), items: {} });
    let nRun = 0, nCache = 0;
    for (const it of st.items) {
      const { key, missing } = itemKey(st, it);
      const hit = key && outputsOk(it, cache[key]);
      const label = `  - ${it.id}`;
      if (dry) { console.log(`${label}  ${hit ? "CACHE" : missing ? `CHẠY (chưa có đầu vào: ${missing})` : "CHẠY"}\n      ${it.fn ? "fn:" + it.fn : it.argv.map((a) => (a.length > 140 ? a.slice(0, 60) + `…(${a.length} ký tự)` : a)).join(" ")}`); continue; }
      if (hit) { const o = old[it.id]; rec.items[it.id] = { status: "cache", key, ...(o?.status === "ran" ? { lastRan: { secs: o.secs, outputs: o.outputs } } : o?.lastRan ? { lastRan: o.lastRan } : {}) }; nCache++; console.log(`${label}  CACHE (${key.slice(0, 10)})`); continue; }
      if (missing) { failed = `thiếu đầu vào ${missing}`; rec.items[it.id] = { status: "failed", error: failed }; console.log(`${label}  LỖI: ${failed}`); break; }
      const t0 = Date.now();
      process.stdout.write(`${label}  chạy… `);
      let ok = true, err = "";
      if (it.fn) { try { FNS[it.fn](cfg); } catch (e) { ok = false; err = String(e.message); } }
      else {
        for (const o of it.outputs) mkdirSync(dirname(o), { recursive: true });
        const [cmd, ...a] = it.argv;
        const r = spawnSync(cmd, a, { cwd: REPO, stdio: ["ignore", "inherit", "inherit"], env: { ...process.env, SDFISH_DATA_DIR: D } });
        ok = r.status === 0; err = ok ? "" : `exit ${r.status ?? r.signal}`;
      }
      memo = new Map(); // đầu ra vừa đổi
      const missingOut = ok ? it.outputs.filter((o) => !existsSync(o)) : [];
      if (ok && missingOut.length) { ok = false; err = `thiếu đầu ra ${missingOut.join(", ")}`; }
      const secs = Math.round((Date.now() - t0) / 100) / 10;
      if (ok) {
        const key2 = itemKey(st, it).key; // băm lại SAU khi chạy (đầu vào do stage khác sinh có thể vừa xuất hiện)
        const sz = sizes(it.outputs);
        cache[key2 ?? key] = { at: new Date().toISOString(), sizes: sz };
        rec.items[it.id] = { status: "ran", key: key2 ?? key, secs, outputs: Object.fromEntries(it.outputs.map((o) => [o, { size: sz[o], sha256: statSync(o).size <= HASH_MAX ? sha(readFileSync(o)) : null }])) };
        nRun++; console.log(`xong ${secs}s`);
        writeAtomic(cachePath, cache);
      } else { failed = `${st.id}/${it.id}: ${err}`; rec.items[it.id] = { status: "failed", secs, error: err }; console.log(`LỖI ${err}`); }
      rec.finishedAt = new Date().toISOString();
      writeAtomic(manifestPath, m); // sau MỖI item
      if (!ok) break;
    }
    if (dry) continue;
    rec.status = failed ? "failed" : "done"; rec.ran = nRun; rec.cached = nCache; rec.finishedAt = new Date().toISOString();
    writeAtomic(manifestPath, m);
    if (failed) break;
  }
  if (!dry) { m.finishedAt = new Date().toISOString(); m.status = failed ? "failed" : "done"; writeAtomic(manifestPath, m); console.log(`\nmanifest: ${manifestPath}`); }
  if (failed) { console.error(`\nDỪNG: ${failed}`); process.exit(1); }
}

// ── selftest (không đụng đĩa thật, không chạy script thật) ─────────────────────────────────────────────
export async function selftest() {
  const assert = (c, m) => { if (!c) throw new Error("selftest HỎNG: " + m); };
  const cfg = { D: "/d", R: "/r", SNAP: "2026-10-11", TSX: ["tsx"] };
  const st = buildStages(cfg);
  const ids = st.map((s) => s.id);
  assert(new Set(ids).size === ids.length, "id stage trùng");
  st.forEach((s, i) => s.deps.forEach((d) => assert(ids.indexOf(d) >= 0 && ids.indexOf(d) < i, `dep ${d} của ${s.id} không đứng trước (không topo)`)));
  for (const s of st) { assert(s.items.length > 0, s.id + " rỗng"); for (const it of s.items) assert(it.outputs.length && (it.argv || it.fn), `${s.id}/${it.id}`); }
  const sel = plan(st, { only: ["eval-honest"] }); assert(sel.length === 1, "--only");
  assert(plan(st, { fromStage: "labels-v2" })[0].id === "labels-v2", "--from-stage");
  let threw = false; try { plan(st, { only: ["zzz"] }); } catch { threw = true; } assert(threw, "stage lạ phải lỗi");
  assert(dayRange("2026-01-30", "2026-02-02").join() === "2026-01-30,2026-01-31,2026-02-01,2026-02-02", "dayRange");
  const fwd = st.find((s) => s.id === "fleet-grid-v2").items.find((i) => i.id === "ex-fwd-2026-09");
  assert(fwd.argv.includes("2026-09,2026-10"), "ex-fwd = mọi tháng ≥ M");
  // cache: khoá đổi khi nội dung đổi
  const { mkdtempSync } = await import("node:fs"); const { tmpdir } = await import("node:os");
  const tmp = mkdtempSync(join(tmpdir(), "train-run-")); const f = join(tmp, "in.txt"); const sc = join(tmp, "s.mjs");
  writeFileSync(f, "a"); writeFileSync(sc, "export {}");
  const s1 = { inputs: [f] }, it1 = { entry: sc, argv: ["x"], outputs: [] };
  const k1 = itemKey(s1, it1).key; memo = new Map(); assert(k1 === itemKey(s1, it1).key, "khoá không tất định");
  memo = new Map(); writeFileSync(f, "b"); assert(itemKey(s1, it1).key !== k1, "đổi đầu vào mà khoá y nguyên");
  memo = new Map(); writeFileSync(f, "a"); writeFileSync(sc, "export const y=1"); assert(itemKey(s1, it1).key !== k1, "đổi mã mà khoá y nguyên");
  memo = new Map(); assert(itemKey({ inputs: [join(tmp, "none")] }, it1).key === null, "thiếu đầu vào phải null");
  rmSync(tmp, { recursive: true, force: true });
  console.log(`train/run selftest OK (${st.length} stage, ${st.reduce((n, s) => n + s.items.length, 0)} item)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes("--selftest")) await selftest().catch((e) => { console.error(e.message); process.exit(1); });
  else await main(process.argv.slice(2));
}
