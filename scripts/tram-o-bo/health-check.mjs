// scripts/tram-o-bo/health-check.mjs
//   node scripts/tram-o-bo/health-check.mjs [tuỳ chọn]
//   node scripts/tram-o-bo/health-check.mjs --self-test
// ─────────────────────────────────────────────────────────────────────────────
// GIÁM SÁT "Trạm học ở bờ" (docs/app-map/ops/tram-o-bo/09-giam-sat.md).
//
// Triết lý cảnh báo (00-tong-quan.md §6): TRẠM CHẾT KHÔNG PHẢI SỰ CỐ KHẨN — app bà
// con vẫn chạy GÓI CŨ đã tải, tìm-trích offline như thường. Nên mọi cảnh báo ở đây
// nghĩa là "cần soạn gói / gói đang cũ dần", KHÔNG phải "cháy nhà". Mức được lái bởi
//   (1) ĐỘ CŨ CỦA GÓI  và  (2) VÒNG ĐÊM CÓ CHẠY KHÔNG.
// Ollama/GPU/đĩa là tín hiệu phụ. Kể cả mức ĐỎ ở đây chỉ là "gói thật sự đang mục,
// không ai soạn mới — ra sửa trạm", không phải app hỏng.
//
// KHÔNG mở cổng ra ngoài: chỉ đọc Ollama ở localhost (00 §2). Log/marker để NGOÀI repo
// (CLAUDE.md §"CẤM file dữ liệu tạm trong cây làm việc").
//
// Không phụ thuộc ngoài (chỉ node core, Node ≥ 18 có fetch + fs.statfsSync) — nguyên
// tắc 15 §5. Có --self-test (tiền lệ hook .githooks/pre-commit + validate-brain-pack.mjs).
// Mã thoát: 0 = XANH, 1 = VÀNG (cảnh báo), 2 = ĐỎ.
// ─────────────────────────────────────────────────────────────────────────────

import { spawnSync } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  mkdtempSync,
  rmSync,
  statfsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ── Ngưỡng (đổi ở đây, có ghi lý do) ─────────────────────────────────────────
const OLLAMA_URL = "http://127.0.0.1:11434"; // localhost-only, KHÔNG mở cổng ra ngoài
const OLLAMA_TIMEOUT_MS = 2500; // ping ngắn: trạm chết không được treo health-check
const PACK_AGE_WARN_DAYS = 15; // gói bắt đầu "cũ dần"
const PACK_AGE_CRIT_DAYS = 30; // gói "quá cũ" — cần soạn mới
const RUN_STALE_WARN_HOURS = 48; // lỡ ~2 đêm liên tiếp (đêm lỡ thì bù, 03 §8.1)
const RUN_STALE_CRIT_HOURS = 24 * 7; // cả tuần không có đêm nào chạy xong
const DISK_WARN_GB = 10; // đóng gói ~50–70 MB + model + log — dưới mức này lo dần
const DISK_CRIT_GB = 2; // gần như chắc chắn không đủ chỗ soạn/đóng gói

const LEVEL_NAME = ["xanh", "vàng", "đỏ"];
const LEVEL_MARK = ["✔", "⚠️", "✖"];
const GB = 1024 * 1024 * 1024;

function printHelp() {
  process.stdout.write(
    [
      "Giám sát Trạm học ở bờ: Ollama sống? vòng đêm chạy? gói cũ chưa? GPU/đĩa? → bảng + mã thoát.",
      "",
      "Triết lý: trạm chết KHÔNG khẩn (app chạy gói cũ). Cảnh báo = 'cần soạn gói', không phải 'cháy nhà'.",
      "",
      "Dùng:",
      "  node scripts/tram-o-bo/health-check.mjs [tuỳ chọn]",
      "  node scripts/tram-o-bo/health-check.mjs --self-test",
      "",
      "Tuỳ chọn:",
      "  --run-marker <path>    Marker vòng đêm ghi ra (last-run.json). Hoặc env TRAM_RUN_MARKER.",
      "  --pack-manifest <path> manifest.json của gói mới nhất (đo độ cũ). Hoặc env TRAM_PACK_MANIFEST.",
      "  --disk-path <path>     Ổ/thư mục kiểm đĩa trống (mặc định: thư mục hiện tại).",
      "  --ollama-url <url>     Mặc định " + OLLAMA_URL + " (localhost — KHÔNG mở ra ngoài).",
      "  --timeout-ms <n>       Ping Ollama, ms (mặc định: " + OLLAMA_TIMEOUT_MS + ").",
      "  --notify <lệnh>        Chỗ cắm webhook/notify: chạy <lệnh> khi mức ≥ vàng, nhận JSON qua stdin.",
      "                         Hoặc env TRAM_NOTIFY_CMD. KHÔNG hardcode dịch vụ nào.",
      "  --json                 In JSON thay bảng (cho máy đọc / cron).",
      "  --self-test            Dựng marker giả (ok/lỗi/thiếu) trong tmp, khẳng định phân mức đúng.",
      "  --help                 In trợ giúp này.",
      "",
      "Khuôn last-run.json (vòng đêm ghi — 03-vong-dem-soan-goi.md §8.2):",
      '  { "startedAt": ISO, "finishedAt": ISO, "ok": true|false, "drafts": <số>, "error"?: <chuỗi> }',
      "",
      "Mã thoát: 0 = XANH · 1 = VÀNG (cảnh báo) · 2 = ĐỎ.",
    ].join("\n") + "\n"
  );
}

// ── Dò tín hiệu (IO/spawn) — mỗi hàm tự chịu lỗi, KHÔNG được sập cả script ────

// Ollama sống? GET /api/tags với timeout ngắn. Trạm chết → alive:false, không treo.
async function probeOllama(url, timeoutMs) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url.replace(/\/$/, "") + "/api/tags", { signal: ac.signal });
    if (!res.ok) return { alive: false, error: "HTTP " + res.status };
    const body = await res.json().catch(() => ({}));
    const models = Array.isArray(body.models) ? body.models.map((m) => m.name || m.model).filter(Boolean) : [];
    return { alive: true, models };
  } catch (e) {
    return { alive: false, error: e && e.name === "AbortError" ? "hết giờ (" + timeoutMs + "ms)" : (e && e.message) || "không kết nối" };
  } finally {
    clearTimeout(t);
  }
}

// `ollama ps`: model đang nạp nằm GPU hay tràn CPU? Không có ollama → na.
function probeOllamaPs() {
  const r = spawnSync("ollama", ["ps"], { encoding: "utf8", timeout: 5000 });
  if (r.error) return { na: true, reason: r.error.code === "ENOENT" ? "không thấy lệnh ollama" : r.error.message };
  const text = (r.stdout || "").trim();
  const lines = text.split(/\r?\n/).filter(Boolean);
  // dòng đầu là header (NAME ID SIZE PROCESSOR UNTIL); có model = còn dòng sau
  const hasModel = lines.length > 1;
  const proc = lines.slice(1).join(" ");
  const onGpu = /gpu/i.test(proc);
  const cpuSpill = /cpu/i.test(proc); // "100% CPU" hoặc "48%/52% CPU/GPU" = có tràn CPU
  return { na: false, hasModel, onGpu, cpuSpill, text };
}

// nvidia-smi: VRAM/độ dùng/nhiệt. Không có driver/GPU → na.
function probeNvidiaSmi() {
  const r = spawnSync(
    "nvidia-smi",
    ["--query-gpu=name,memory.used,memory.total,utilization.gpu,temperature.gpu", "--format=csv,noheader,nounits"],
    { encoding: "utf8", timeout: 5000 }
  );
  if (r.error) return { na: true, reason: r.error.code === "ENOENT" ? "không thấy nvidia-smi" : r.error.message };
  const rows = (r.stdout || "")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [name, memUsed, memTotal, util, temp] = line.split(",").map((x) => x.trim());
      return { name, memUsedMb: Number(memUsed), memTotalMb: Number(memTotal), utilPct: Number(util), tempC: Number(temp) };
    });
  if (rows.length === 0) return { na: true, reason: "nvidia-smi không trả dòng nào" };
  return { na: false, rows };
}

// Đọc marker vòng đêm. Thiếu path / thiếu file / JSON hỏng đều xử lý mềm.
function readRunMarker(path) {
  if (!path) return { present: false, reason: "chưa truyền --run-marker / TRAM_RUN_MARKER" };
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (e) {
    return { present: false, reason: e && e.code === "ENOENT" ? "không thấy file marker" : (e && e.message) };
  }
  try {
    const j = JSON.parse(raw);
    return {
      present: true,
      ok: j.ok === true,
      startedAt: j.startedAt || null,
      finishedAt: j.finishedAt || null,
      drafts: typeof j.drafts === "number" ? j.drafts : null,
      error: j.error || null,
    };
  } catch (e) {
    return { present: true, parseError: (e && e.message) || "JSON hỏng" };
  }
}

// Đọc manifest gói để tính độ cũ theo createdAt.
function readPackManifest(path, now) {
  if (!path) return { present: false, reason: "chưa truyền --pack-manifest / TRAM_PACK_MANIFEST" };
  try {
    const j = JSON.parse(readFileSync(path, "utf8"));
    const created = j.createdAt ? new Date(j.createdAt) : null;
    const ageDays = created && !isNaN(created) ? (now - created.getTime()) / 86400000 : null;
    return { present: true, version: j.version ?? null, createdAt: j.createdAt || null, ageDays };
  } catch (e) {
    return { present: false, reason: e && e.code === "ENOENT" ? "không thấy manifest" : (e && e.message) };
  }
}

// Đĩa trống qua fs.statfsSync (Node ≥ 18.15) — cross-platform, khỏi spawn.
function probeDisk(path) {
  try {
    const s = statfsSync(path);
    const freeBytes = s.bsize * s.bavail;
    const totalBytes = s.bsize * s.blocks;
    return { na: false, path, freeBytes, totalBytes, freeGb: freeBytes / GB };
  } catch (e) {
    return { na: true, reason: (e && e.message) || "không đọc được đĩa" };
  }
}

// ── ĐÁNH GIÁ (thuần) — nhận input đã dò, trả rows + mức tổng. Đây là phần --self-test soi ──
export function assess(inp) {
  const now = inp.now instanceof Date ? inp.now.getTime() : Date.now();
  const rows = [];
  const add = (key, nhan, gia, muc, nghia) => rows.push({ key, nhan, gia, muc, nghia });

  // (a) Ollama sống? — trạm chết chỉ là VÀNG (app chạy gói cũ, 03 §8.3)
  const o = inp.ollama || { alive: false, error: "không dò" };
  if (o.alive)
    add("ollama", "Ollama sống", "có" + (o.models && o.models.length ? " (" + o.models.length + " model)" : ""), 0,
      "trạm sẵn sàng soạn nháp đêm nay");
  else
    add("ollama", "Ollama sống", "KHÔNG — " + (o.error || "?"), 1,
      "đêm nay có thể không soạn được gói; app bà con VẪN chạy gói cũ — không khẩn");

  // (b) Vòng đêm tối qua — TRỤC CHÍNH
  const m = inp.marker || { present: false };
  if (!m.present)
    add("vong-dem", "Vòng đêm chạy", "chưa từng (thiếu marker)", 1,
      (m.reason || "thiếu last-run.json") + " — chưa soạn gói lần nào, hoặc marker để sai chỗ");
  else if (m.parseError)
    add("vong-dem", "Vòng đêm chạy", "marker hỏng", 1, "last-run.json không đọc được: " + m.parseError);
  else if (!m.ok)
    add("vong-dem", "Vòng đêm chạy", "LỖI đêm gần nhất", 1,
      "vòng đêm báo ok=false" + (m.error ? " (" + m.error + ")" : "") + " — soi log, không khẩn (gói cũ còn dùng)");
  else {
    const fin = m.finishedAt ? new Date(m.finishedAt).getTime() : NaN;
    const hrs = isNaN(fin) ? Infinity : (now - fin) / 3600000;
    if (hrs <= RUN_STALE_WARN_HOURS)
      add("vong-dem", "Vòng đêm chạy", "xong " + fmtHrs(hrs) + " trước" + (m.drafts != null ? " (" + m.drafts + " nháp)" : ""), 0,
        "đêm gần nhất chạy xong bình thường");
    else if (hrs <= RUN_STALE_CRIT_HOURS)
      add("vong-dem", "Vòng đêm chạy", "lần cuối " + fmtHrs(hrs) + " trước", 1,
        "vòng đêm chưa chạy vài đêm — kiểm Task Scheduler / Ollama; gói chưa mới thêm");
    else
      add("vong-dem", "Vòng đêm chạy", "ngừng " + fmtHrs(hrs) + " trước", 2,
        "vòng đêm ngừng quá 1 tuần — gói không còn được soạn mới; ra sửa trạm");
  }

  // (c) Độ cũ của gói — TRỤC CHÍNH
  const p = inp.pack || { present: false };
  if (!p.present)
    add("goi", "Độ cũ gói", "n/a", 0, (p.reason || "chưa truyền --pack-manifest") + " — bật để đo độ trễ soạn gói");
  else if (p.ageDays == null)
    add("goi", "Độ cũ gói", "n/a (thiếu createdAt)", 1, "manifest v" + p.version + " không có createdAt hợp lệ");
  else if (p.ageDays <= PACK_AGE_WARN_DAYS)
    add("goi", "Độ cũ gói", "v" + p.version + ", " + fmtDays(p.ageDays), 0, "gói còn tươi");
  else if (p.ageDays <= PACK_AGE_CRIT_DAYS)
    add("goi", "Độ cũ gói", "v" + p.version + ", " + fmtDays(p.ageDays), 1, "gói đang cũ dần — cân nhắc soạn gói mới");
  else
    add("goi", "Độ cũ gói", "v" + p.version + ", " + fmtDays(p.ageDays), 2, "gói quá cũ — cần soạn gói mới (bà con vẫn dùng được, chỉ là không mới)");

  // (d) GPU / VRAM — phụ, phần lớn chỉ thông tin
  const g = inp.gpu || { na: true };
  if (g.na) add("gpu", "GPU/VRAM", "n/a", 0, g.reason || "không có nvidia-smi (không sập)");
  else {
    const r0 = g.rows[0];
    add("gpu", "GPU/VRAM", r0.name + " " + r0.memUsedMb + "/" + r0.memTotalMb + "MB, " + r0.utilPct + "%, " + r0.tempC + "°C", 0,
      "thông tin — soạn nháp dùng VRAM này");
  }
  const ps = inp.ollamaPs || { na: true };
  if (!ps.na && ps.hasModel) {
    if (ps.cpuSpill && !ps.onGpu)
      add("ollama-ps", "Model trên GPU?", "CPU (tràn)", 1, "model chạy CPU — soạn nháp sẽ chậm; kiểm VRAM/quant (04-toi-uu)");
    else if (ps.cpuSpill)
      add("ollama-ps", "Model trên GPU?", "GPU+CPU", 1, "một phần tràn CPU — chậm hơn; cân nhắc qwen3.5:4b để chừa VRAM");
    else if (ps.onGpu)
      add("ollama-ps", "Model trên GPU?", "GPU", 0, "model nằm trọn GPU — tốt");
  }

  // (e) Đĩa trống
  const d = inp.disk || { na: true };
  if (d.na) add("dia", "Đĩa trống", "n/a", 0, d.reason || "không đọc được");
  else if (d.freeGb < DISK_CRIT_GB)
    add("dia", "Đĩa trống", fmtGb(d.freeGb) + " tại " + d.path, 2, "gần đầy — không đủ chỗ soạn/đóng gói; dọn log/work (04-toi-uu)");
  else if (d.freeGb < DISK_WARN_GB)
    add("dia", "Đĩa trống", fmtGb(d.freeGb) + " tại " + d.path, 1, "đĩa vơi dần — dọn log/work sớm");
  else add("dia", "Đĩa trống", fmtGb(d.freeGb) + " tại " + d.path, 0, "đủ chỗ");

  const level = rows.reduce((mx, r) => Math.max(mx, r.muc), 0);
  return { level, rows, generatedAt: new Date(now).toISOString() };
}

function fmtHrs(h) {
  if (!isFinite(h)) return "?";
  if (h < 1) return Math.round(h * 60) + " phút";
  if (h < 48) return h.toFixed(1) + " giờ";
  return (h / 24).toFixed(1) + " ngày";
}
function fmtDays(d) {
  return d < 1 ? Math.round(d * 24) + " giờ" : d.toFixed(1) + " ngày";
}
function fmtGb(gb) {
  return gb.toFixed(1) + " GB";
}

// ── In bảng + tổng kết ───────────────────────────────────────────────────────
function report(res) {
  process.stdout.write("== Giám sát Trạm học ở bờ ==\n");
  process.stdout.write("Lúc: " + res.generatedAt + "\n\n");
  for (const r of res.rows) {
    process.stdout.write("  " + LEVEL_MARK[r.muc] + " [" + LEVEL_NAME[r.muc] + "] " + r.nhan + ": " + r.gia + "\n");
    process.stdout.write("      " + r.nghia + "\n");
  }
  process.stdout.write("\n" + "-".repeat(60) + "\n");
  const tag = LEVEL_NAME[res.level].toUpperCase();
  if (res.level === 0)
    process.stdout.write("  KẾT LUẬN: 🟢 " + tag + " — trạm khoẻ, gói mới, vòng đêm chạy đều.\n");
  else if (res.level === 1)
    process.stdout.write(
      "  KẾT LUẬN: 🟡 " + tag + " — cần để mắt: có thứ nên soạn gói / trạm hụt nhịp.\n" +
        "  KHÔNG khẩn — app bà con vẫn chạy gói cũ offline (00 §6).\n"
    );
  else
    process.stdout.write(
      "  KẾT LUẬN: 🔴 " + tag + " — gói đang mục / vòng đêm ngừng / đĩa đầy: RA SỬA TRẠM.\n" +
        "  Vẫn KHÔNG phải sự cố app: bà con dùng gói cũ được, chỉ là gói không mới thêm.\n"
    );
}

// Chỗ cắm webhook/notify — chạy lệnh user đưa, đẩy JSON qua stdin. KHÔNG hardcode dịch vụ.
function maybeNotify(cmd, res) {
  if (!cmd) return;
  if (res.level < 1) return; // chỉ báo khi ≥ vàng
  try {
    const payload = JSON.stringify({ level: res.level, levelName: LEVEL_NAME[res.level], generatedAt: res.generatedAt, rows: res.rows });
    // shell:true để nhận cả chuỗi lệnh có tham số; lỗi notify KHÔNG được làm hỏng giám sát
    const r = spawnSync(cmd, { shell: true, input: payload, encoding: "utf8", timeout: 10000 });
    if (r.error) process.stderr.write("(notify lỗi, bỏ qua: " + r.error.message + ")\n");
  } catch (e) {
    process.stderr.write("(notify lỗi, bỏ qua: " + ((e && e.message) || e) + ")\n");
  }
}

// ── self-test: dựng marker giả (ok/lỗi/thiếu) + manifest giả, khẳng định phân mức ──
function selfTest() {
  const base = mkdtempSync(join(tmpdir(), "tram-health-"));
  let ok = true;
  const fail = (msg) => {
    ok = false;
    process.stdout.write("  ✖ self-test: " + msg + "\n");
  };
  // Ollama/GPU/đĩa MOCK cố định — không phụ thuộc phần cứng/dịch vụ thật
  const ollamaUp = { alive: true, models: ["qwen3.5:9b"] };
  const ollamaDown = { alive: false, error: "không kết nối" };
  const gpuNa = { na: true, reason: "mock" };
  const diskOk = { na: false, path: base, freeBytes: 50 * GB, totalBytes: 500 * GB, freeGb: 50 };
  const now = Date.now();
  const iso = (msAgo) => new Date(now - msAgo).toISOString();
  const H = 3600000;
  const D = 24 * H;

  try {
    // marker OK vừa chạy xong
    const mOk = join(base, "ok.json");
    writeFileSync(mOk, JSON.stringify({ startedAt: iso(2 * H), finishedAt: iso(1 * H), ok: true, drafts: 7 }), "utf8");
    // marker OK nhưng cũ (5 ngày)
    const mStale = join(base, "stale.json");
    writeFileSync(mStale, JSON.stringify({ startedAt: iso(5 * D + H), finishedAt: iso(5 * D), ok: true, drafts: 3 }), "utf8");
    // marker LỖI
    const mErr = join(base, "err.json");
    writeFileSync(mErr, JSON.stringify({ startedAt: iso(1 * H), finishedAt: iso(H / 2), ok: false, error: "Ollama down" }), "utf8");
    // manifest gói tươi + gói quá cũ
    const packFresh = join(base, "manifest-fresh.json");
    writeFileSync(packFresh, JSON.stringify({ version: "3", createdAt: iso(2 * D), files: [] }), "utf8");
    const packOld = join(base, "manifest-old.json");
    writeFileSync(packOld, JSON.stringify({ version: "1", createdAt: iso(40 * D), files: [] }), "utf8");

    const readM = (p) => readRunMarker(p);
    const readP = (p) => readPackManifest(p, now);

    // Ca 1: tất cả tốt → XANH (0)
    let r = assess({ now, ollama: ollamaUp, gpu: gpuNa, disk: diskOk, marker: readM(mOk), pack: readP(packFresh) });
    if (r.level !== 0) fail("ca 'tất cả tốt' phải XANH (0), lại ra " + r.level);

    // Ca 2: Ollama chết, còn lại tốt → VÀNG (1), KHÔNG được leo ĐỎ (trạm chết không khẩn)
    r = assess({ now, ollama: ollamaDown, gpu: gpuNa, disk: diskOk, marker: readM(mOk), pack: readP(packFresh) });
    if (r.level !== 1) fail("ca 'Ollama chết' phải VÀNG (1) — trạm chết không khẩn, lại ra " + r.level);

    // Ca 3: marker THIẾU → VÀNG (1)
    r = assess({ now, ollama: ollamaUp, gpu: gpuNa, disk: diskOk, marker: readM(join(base, "khong-co.json")), pack: readP(packFresh) });
    if (r.level !== 1) fail("ca 'marker thiếu' phải VÀNG (1), lại ra " + r.level);
    if (r.rows.find((x) => x.key === "vong-dem").muc !== 1) fail("row vòng-đêm khi thiếu marker phải mức 1");

    // Ca 4: marker LỖI → VÀNG (1)
    r = assess({ now, ollama: ollamaUp, gpu: gpuNa, disk: diskOk, marker: readM(mErr), pack: readP(packFresh) });
    if (r.level !== 1) fail("ca 'marker lỗi' phải VÀNG (1), lại ra " + r.level);

    // Ca 5: vòng đêm cũ 5 ngày → VÀNG (1) từ trục vòng đêm
    r = assess({ now, ollama: ollamaUp, gpu: gpuNa, disk: diskOk, marker: readM(mStale), pack: readP(packFresh) });
    if (r.rows.find((x) => x.key === "vong-dem").muc !== 1) fail("row vòng-đêm cũ 5 ngày phải mức 1");

    // Ca 6: gói quá cũ (40 ngày) → ĐỎ (2)
    r = assess({ now, ollama: ollamaUp, gpu: gpuNa, disk: diskOk, marker: readM(mOk), pack: readP(packOld) });
    if (r.level !== 2) fail("ca 'gói 40 ngày' phải ĐỎ (2), lại ra " + r.level);
    if (r.rows.find((x) => x.key === "goi").muc !== 2) fail("row gói 40 ngày phải mức 2");

    // Ca 7: đĩa gần đầy → ĐỎ (2)
    const diskFull = { na: false, path: base, freeBytes: 1 * GB, totalBytes: 500 * GB, freeGb: 1 };
    r = assess({ now, ollama: ollamaUp, gpu: gpuNa, disk: diskFull, marker: readM(mOk), pack: readP(packFresh) });
    if (r.level !== 2) fail("ca 'đĩa 1GB' phải ĐỎ (2), lại ra " + r.level);

    // Ca 8: pack không truyền → không tự leo mức (n/a mức 0)
    r = assess({ now, ollama: ollamaUp, gpu: gpuNa, disk: diskOk, marker: readM(mOk), pack: readP(null) });
    if (r.level !== 0) fail("ca 'không truyền pack' phải XANH (0), lại ra " + r.level);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
  if (ok) process.stdout.write("✔ self-test ĐẠT: phân mức xanh/vàng/đỏ đúng, không phụ thuộc Ollama/GPU thật.\n");
  else process.stdout.write("✖ self-test HỎNG.\n");
  return ok;
}

// ── main ─────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const a = {
    runMarker: process.env.TRAM_RUN_MARKER || null,
    packManifest: process.env.TRAM_PACK_MANIFEST || null,
    diskPath: process.cwd(),
    ollamaUrl: OLLAMA_URL,
    timeoutMs: OLLAMA_TIMEOUT_MS,
    notify: process.env.TRAM_NOTIFY_CMD || null,
    json: false,
    help: false,
    selfTest: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === "--help" || x === "-h") a.help = true;
    else if (x === "--self-test") a.selfTest = true;
    else if (x === "--json") a.json = true;
    else if (x === "--run-marker") a.runMarker = argv[++i];
    else if (x === "--pack-manifest") a.packManifest = argv[++i];
    else if (x === "--disk-path") a.diskPath = argv[++i];
    else if (x === "--ollama-url") a.ollamaUrl = argv[++i];
    else if (x === "--timeout-ms") a.timeoutMs = Number(argv[++i]);
    else if (x === "--notify") a.notify = argv[++i];
    else throw new Error("Không hiểu tuỳ chọn: " + x);
  }
  return a;
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    process.stderr.write("Lỗi: " + e.message + "\n");
    printHelp();
    process.exit(2);
  }
  if (args.help) {
    printHelp();
    process.exit(0);
  }
  if (args.selfTest) {
    process.exit(selfTest() ? 0 : 2);
  }

  const now = new Date();
  const ollama = await probeOllama(args.ollamaUrl, args.timeoutMs);
  const ollamaPs = probeOllamaPs();
  const gpu = probeNvidiaSmi();
  const marker = readRunMarker(args.runMarker);
  const pack = readPackManifest(args.packManifest, now.getTime());
  const disk = probeDisk(args.diskPath);

  const res = assess({ now, ollama, ollamaPs, gpu, marker, pack, disk });

  if (args.json) process.stdout.write(JSON.stringify(res, null, 2) + "\n");
  else report(res);

  maybeNotify(args.notify, res);
  process.exit(res.level);
}

main();
