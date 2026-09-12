#!/usr/bin/env node
// nightly-run.mjs — Vòng đêm THẬT (chặng 1–3): kéo câu → gom cụm theo chủ đề →
// qwen3.5:9b (Ollama) soạn NHÁP mục hỏi-đáp → ghi drafts + marker last-run.json.
//
// ĐÂY LÀ BẢN CHẠY THẬT MODEL, nhưng CHƯA nối Supabase và CHƯA có bước người duyệt/đăng gói:
//   • đầu vào: file fixture/ẩn danh (--input), KHÔNG kéo từ Supabase (backend chưa dựng — app-side).
//   • đầu ra: NHÁP ghi ra thư mục trạm cho NGƯỜI DUYỆT xem (02-quan-tri-va-update.md), KHÔNG tự đăng.
//   • nguon để TRỐNG — người duyệt điền (chống bịa, 03-vong-dem-soan-goi.md §4.1).
// Dùng cho: chạy 24/7 (Task Scheduler) để (a) có workload đêm thật, (b) ghi last-run.json cho
// health-check.mjs (09-giam-sat.md) đọc. Xem 03-vong-dem-soan-goi.md cho luồng đầy đủ.
//
// Dùng: node nightly-run.mjs [--input <json>] [--out-dir <dir>] [--model qwen3.5:9b]
//                            [--ollama http://127.0.0.1:11434] [--timeout-ms 120000] [--help]

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

if (argv.includes("--help")) {
  console.log(`nightly-run.mjs — vòng đêm thật (soạn NHÁP bằng qwen3.5:9b), ghi marker cho giám sát.
  --input <json>     đầu vào ẩn danh (mặc định: __fixtures__/unanswered-sample.json)
  --out-dir <dir>    thư mục trạm (mặc định: %LOCALAPPDATA%\\SDFish-Tram hoặc ./_tram)
  --model <tag>      model Ollama (mặc định: qwen3.5:9b)
  --ollama <url>     base Ollama (mặc định: http://127.0.0.1:11434)
  --timeout-ms <n>   trần mỗi lượt gọi (mặc định 120000)
Ghi: <out-dir>/drafts/<ngày>.json + <out-dir>/last-run.json + <out-dir>/logs/nightly-<ngày>.log`);
  process.exit(0);
}

const INPUT = resolve(flag("--input", join(HERE, "__fixtures__", "unanswered-sample.json")));
const OUT_DIR = resolve(flag("--out-dir", process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "SDFish-Tram") : join(HERE, "_tram")));
const MODEL = flag("--model", "qwen3.5:9b");
const OLLAMA = flag("--ollama", process.env.OLLAMA_HOST ? `http://${process.env.OLLAMA_HOST.replace(/^https?:\/\//, "")}` : "http://127.0.0.1:11434");
const TIMEOUT = parseInt(flag("--timeout-ms", "120000"), 10);

const DATE = new Date().toISOString().slice(0, 10);
for (const d of [OUT_DIR, join(OUT_DIR, "drafts"), join(OUT_DIR, "logs")]) mkdirSync(d, { recursive: true });
const logPath = join(OUT_DIR, "logs", `nightly-${DATE}.log`);
const log = (m) => { const line = `[${new Date().toISOString()}] ${m}`; console.log(line); try { writeFileSync(logPath, line + "\n", { flag: "a" }); } catch {} };

const SYSTEM = [
  "Bạn soạn NHÁP mục hỏi-đáp cho ngư dân Việt Nam 40-60 tuổi. Chỉ soạn nháp để người của SDVICO DUYỆT lại.",
  "Luật bắt buộc: trả lời TỐI ĐA 4 câu; tiếng Việt đời thường, dễ hiểu, không thuật ngữ;",
  "TUYỆT ĐỐI KHÔNG bịa số liệu biến động (giá, thời tiết, cấp gió, ngày giờ cụ thể) — nếu cần số thì nói chung chung;",
  "KHÔNG khuyên y tế/pháp lý cá nhân. Chỉ kiến thức nghề cá phổ thông, an toàn.",
  'Trả về DUY NHẤT một JSON: {"cauHoiMau":["..."],"tuKhoa":["..."],"traLoi":"..."} — không kèm giải thích.',
].join(" ");

async function draftOne(chuDe, cauHoiList) {
  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: `Chủ đề: ${chuDe}. Bà con hỏi (nhiều cách nói cùng ý): ${cauHoiList.map((q) => `"${q}"`).join(", ")}. Soạn 1 mục hỏi-đáp nháp.` },
    ],
    stream: false,
    think: false,
    options: { num_ctx: 4096, temperature: 0.4 },
  };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(`${OLLAMA}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const content = j?.message?.content ?? "";
    let parsed = null;
    const m = content.match(/\{[\s\S]*\}/);
    if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
    return { ok: true, parsed, raw: content, tokens: j?.eval_count ?? null };
  } finally { clearTimeout(t); }
}

(async () => {
  const started = new Date().toISOString();
  const marker = { startedAt: started, finishedAt: null, ok: false, model: MODEL, drafts: 0, clusters: 0, error: null };
  try {
    log(`=== VÒNG ĐÊM bắt đầu — model=${MODEL} ollama=${OLLAMA} input=${INPUT} ===`);
    if (!existsSync(INPUT)) throw new Error(`không thấy input: ${INPUT}`);
    const data = JSON.parse(readFileSync(INPUT, "utf8"));
    // gom cụm theo chuNhat (chặng 2)
    const clusters = {};
    for (const item of data.outbox ?? []) {
      const key = item.chuNhat || "khac";
      (clusters[key] ??= []).push(item.cauHoi);
    }
    const keys = Object.keys(clusters);
    marker.clusters = keys.length;
    log(`gom ${keys.length} cụm: ${keys.join(", ")}`);
    const drafts = [];
    for (const key of keys) {
      log(`— soạn nháp cụm "${key}" (${clusters[key].length} câu)…`);
      const r = await draftOne(key, clusters[key]);
      drafts.push({
        chuDe: key,
        cauHoiNguon: clusters[key],
        cauHoiMau: r.parsed?.cauHoiMau ?? null,
        tuKhoa: r.parsed?.tuKhoa ?? null,
        traLoi: r.parsed?.traLoi ?? null,
        raw: r.parsed ? undefined : r.raw, // giữ raw nếu không parse được JSON
        nguon: "",              // TRỐNG — người duyệt điền
        ngaySoat: "",           // người duyệt điền
        canNguoiTra: true,
        model: MODEL,
        tokens: r.tokens,
      });
      log(`  ✓ ${r.parsed ? "parse JSON OK" : "GIỮ raw (không parse được JSON)"}${r.tokens ? `, ${r.tokens} token` : ""}`);
    }
    const draftPath = join(OUT_DIR, "drafts", `${DATE}.json`);
    writeFileSync(draftPath, JSON.stringify({ ngay: DATE, model: MODEL, luuY: "NHÁP — chờ người duyệt điền nguon+ngaySoat rồi mới đóng gói", drafts }, null, 2), "utf8");
    marker.drafts = drafts.length;
    marker.ok = true;
    log(`✓ ghi ${drafts.length} nháp → ${draftPath}`);
  } catch (e) {
    marker.ok = false;
    marker.error = String(e?.message || e);
    log(`✗ LỖI: ${marker.error}`);
  } finally {
    marker.finishedAt = new Date().toISOString();
    try { writeFileSync(join(OUT_DIR, "last-run.json"), JSON.stringify(marker, null, 2), "utf8"); } catch {}
    log(`=== KẾT THÚC ok=${marker.ok} drafts=${marker.drafts} → last-run.json ===`);
    process.exit(marker.ok ? 0 : 1);
  }
})();
