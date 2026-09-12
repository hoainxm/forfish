// scripts/tram-o-bo/validate-brain-pack.mjs
//   node scripts/tram-o-bo/validate-brain-pack.mjs <thư-mục-gói> [--budget-mb 70]
//   node scripts/tram-o-bo/validate-brain-pack.mjs --self-test
// ─────────────────────────────────────────────────────────────────────────────
// CỔNG KIỂM GÓI NÃO "Sen Biển" (bước 8 vòng đêm — 03-vong-dem-soan-goi.md).
// Đỏ (có FAIL) → KHÔNG đăng gói. Cảnh báo (WARN) → người soát, không tự chặn.
//
// Kiểm:
//   [FAIL] manifest.json đọc được; mọi file trong manifest tồn tại, đúng bytes, đúng sha256.
//   [FAIL] không có file "mồ côi" (có trong thư mục nhưng thiếu trong manifest).
//   [FAIL] mỗi mục knowledge có traLoi (khác rỗng), ≤ 4 câu, có nguon, có ngaySoat.
//   [WARN] traLoi nghi chứa SỐ SỐNG (giá/thời tiết…) — ADR 0010 cấm số biến động trong kho.
//   [WARN] tổng dung lượng vượt ngân sách (~50–70 MB, ADR 0010).
//
// ⚠️ KHUÔN GÓI theo contract Agent B (docs/contracts/tro-ly-brain-pack.contract.md).
//    Khi contract chốt tên/field khác → sửa các hằng dưới THEO contract.
// Không phụ thuộc ngoài (node core). Có --self-test (tiền lệ hook .githooks/pre-commit).
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from "node:crypto";
import {
  readdirSync,
  statSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { join, relative, sep, basename, dirname } from "node:path";
import { tmpdir } from "node:os";

const DEFAULT_BUDGET_MB = 70;
const MANIFEST_NAME = "manifest.json";
const MAX_CAU = 4; // traLoi ≤ 4 câu (ADR 0010)
// tên file kho kiến thức: knowledge.json hoặc knowledge.v<N>.json
const KNOWLEDGE_RE = /^knowledge(\.v\d+)?\.json$/;
// đơn vị số sống: giá/thời tiết/đo lường biến động
const LIVE_UNIT_RE = /\d+(?:[.,]\d+)?\s*(?:đồng|₫|nghìn|ngàn|triệu|độ|cấp|km\/?h|m\/?s|hải lý|lít|%|nút|kg|tấn)\b/iu;

function printHelp() {
  process.stdout.write(
    [
      "Kiểm gói não Sen Biển theo contract. Đỏ (FAIL) → không đăng.",
      "",
      "Dùng:",
      "  node scripts/tram-o-bo/validate-brain-pack.mjs <thư-mục-gói> [--budget-mb <n>]",
      "  node scripts/tram-o-bo/validate-brain-pack.mjs --self-test",
      "",
      "Tuỳ chọn:",
      "  --budget-mb <n>  Ngân sách cảnh báo, MB (mặc định: " + DEFAULT_BUDGET_MB + ").",
      "  --self-test      Tự dựng 1 gói HỢP LỆ + 1 gói LỖI, khẳng định pass/fail đúng.",
      "  --help           In trợ giúp này.",
      "",
      "Mã thoát: 0 nếu không có FAIL; 1 nếu có FAIL hoặc --self-test không đúng kỳ vọng.",
    ].join("\n") + "\n"
  );
}

function sha256Buf(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function walkFiles(root) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) stack.push(full);
      else if (st.isFile()) out.push(relative(root, full).split(sep).join("/"));
    }
  }
  return out;
}

// đếm câu: tách theo . ! ? … , bỏ mảnh rỗng
function demCau(s) {
  return s
    .split(/[.!?…]+/u)
    .map((x) => x.trim())
    .filter(Boolean).length;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

// Lấy mảng mục knowledge dù file là mảng hay { muc: [...] } hay { items: [...] } hay { knowledge: [...] }
// `.muc` là khoá theo contract (tro-ly-brain-pack.contract.md §knowledge.v<N>.json); items/knowledge/mảng giữ cho khuôn cũ.
function knowledgeItems(obj) {
  if (Array.isArray(obj)) return obj;
  if (obj && Array.isArray(obj.muc)) return obj.muc;
  if (obj && Array.isArray(obj.items)) return obj.items;
  if (obj && Array.isArray(obj.knowledge)) return obj.knowledge;
  return null;
}

/**
 * Kiểm một thư mục gói. Trả { fails: string[], warns: string[] }.
 * fails khác rỗng = gói KHÔNG được đăng.
 */
export function validatePack(root, opts = {}) {
  const budgetMb = opts.budgetMb ?? DEFAULT_BUDGET_MB;
  const fails = [];
  const warns = [];

  // 1) manifest
  let manifest;
  try {
    manifest = readJson(join(root, MANIFEST_NAME));
  } catch (e) {
    return { fails: ["Không đọc được " + MANIFEST_NAME + ": " + e.message], warns };
  }
  if (!manifest || !Array.isArray(manifest.files)) {
    return { fails: ["manifest.files thiếu hoặc không phải mảng"], warns };
  }

  // 2) manifest ↔ file thật
  const listed = new Set();
  let totalBytes = 0;
  for (const entry of manifest.files) {
    if (!entry || typeof entry.path !== "string") {
      fails.push("manifest có mục file không hợp lệ (thiếu path)");
      continue;
    }
    listed.add(entry.path);
    const full = join(root, entry.path.split("/").join(sep));
    let buf;
    try {
      buf = readFileSync(full);
    } catch {
      fails.push("Thiếu file trong gói: " + entry.path);
      continue;
    }
    totalBytes += buf.length;
    if (typeof entry.bytes === "number" && entry.bytes !== buf.length)
      fails.push("Sai bytes: " + entry.path + " (manifest " + entry.bytes + " ≠ thật " + buf.length + ")");
    if (typeof entry.sha256 === "string" && entry.sha256 !== sha256Buf(buf))
      fails.push("Sai sha256: " + entry.path);
  }

  // 3) file mồ côi (có thật nhưng thiếu trong manifest)
  for (const rel of walkFiles(root)) {
    if (rel === MANIFEST_NAME) continue;
    if (!listed.has(rel)) fails.push("File mồ côi (thiếu trong manifest): " + rel);
  }

  // 4) knowledge: nguon + ngaySoat + ≤4 câu + traLoi khác rỗng
  const knowFiles = walkFiles(root).filter((r) => KNOWLEDGE_RE.test(basename(r)));
  if (knowFiles.length === 0) {
    warns.push("Không thấy file knowledge.json — gói không có kho kiến thức (có thể chủ ý).");
  }
  for (const rel of knowFiles) {
    let items;
    try {
      items = knowledgeItems(readJson(join(root, rel.split("/").join(sep))));
    } catch (e) {
      fails.push(rel + ": không đọc được JSON: " + e.message);
      continue;
    }
    if (!items) {
      fails.push(rel + ": không tìm thấy mảng mục (mảng / .muc / .items / .knowledge)");
      continue;
    }
    items.forEach((it, i) => {
      const nhan = rel + " #" + i + (it && it.id ? " (" + it.id + ")" : "");
      const traLoi = it && typeof it.traLoi === "string" ? it.traLoi.trim() : "";
      if (!traLoi) fails.push(nhan + ": traLoi rỗng");
      else if (demCau(traLoi) > MAX_CAU) fails.push(nhan + ": traLoi > " + MAX_CAU + " câu");
      if (!it || typeof it.nguon !== "string" || !it.nguon.trim())
        fails.push(nhan + ": thiếu nguon (mọi mục kho phải có nguồn — ADR 0010)");
      if (!it || typeof it.ngaySoat !== "string" || !it.ngaySoat.trim())
        fails.push(nhan + ": thiếu ngaySoat");
      if (traLoi && LIVE_UNIT_RE.test(traLoi))
        warns.push(nhan + ": traLoi nghi có SỐ SỐNG — kiểm tay (số biến động không được vào kho)");
    });
  }

  // 5) ngân sách
  if (totalBytes > budgetMb * 1048576)
    warns.push(
      "Vượt ngân sách: " + (totalBytes / 1048576).toFixed(2) + " MB > " + budgetMb + " MB"
    );

  return { fails, warns };
}

function report(name, res) {
  process.stdout.write("== Kiểm gói: " + name + " ==\n");
  for (const w of res.warns) process.stdout.write("  ⚠️  " + w + "\n");
  for (const f of res.fails) process.stdout.write("  ✖  " + f + "\n");
  if (res.fails.length === 0) process.stdout.write("  ✔  Không có lỗi chặn (" + res.warns.length + " cảnh báo).\n");
  else process.stdout.write("  → " + res.fails.length + " lỗi chặn. KHÔNG đăng gói.\n");
}

// ── self-test: dựng gói giả hợp lệ + gói lỗi, khẳng định pass/fail đúng ─────────
function writePackFile(root, rel, content) {
  const full = join(root, rel.split("/").join(sep));
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, "utf8");
  return Buffer.byteLength(content, "utf8");
}

function makeManifest(root, entries, extra = {}) {
  const files = entries.map(({ rel }) => {
    const buf = readFileSync(join(root, rel.split("/").join(sep)));
    return { path: rel, sha256: sha256Buf(buf), bytes: buf.length };
  });
  writeFileSync(
    join(root, MANIFEST_NAME),
    JSON.stringify({ version: "0.0.1-test", createdAt: new Date().toISOString(), minAppVersion: "0.0.0", files, ...extra }, null, 2),
    "utf8"
  );
}

function selfTest() {
  const base = mkdtempSync(join(tmpdir(), "senbien-pack-"));
  let ok = true;
  try {
    // --- gói HỢP LỆ ---
    const good = join(base, "good");
    mkdirSync(good, { recursive: true });
    writePackFile(good, "answers.json", JSON.stringify({ chao_can_gi: "Dạ, bác cần gì?" }));
    writePackFile(
      good,
      "knowledge.json",
      JSON.stringify([
        {
          id: "bao-quan-ca-ngu",
          cauHoiMau: ["Cá ngừ để được mấy ngày?"],
          tuKhoa: ["cá ngừ", "ướp đá"],
          traLoi: "Ướp đá ngay sau khi đánh. Giữ lớp đá phủ kín thân cá. Bù đá mỗi ngày.",
          nguon: "Tài liệu SDVICO",
          ngaySoat: "2026-09-11",
        },
      ])
    );
    makeManifest(good, [{ rel: "answers.json" }, { rel: "knowledge.json" }]);
    const rGood = validatePack(good);
    if (rGood.fails.length !== 0) {
      ok = false;
      process.stdout.write("  ✖ self-test: gói HỢP LỆ lại báo lỗi: " + JSON.stringify(rGood.fails) + "\n");
    }

    // --- gói LỖI: traLoi >4 câu + thiếu nguon/ngaySoat + sai sha + file mồ côi ---
    const bad = join(base, "bad");
    mkdirSync(bad, { recursive: true });
    writePackFile(bad, "answers.json", JSON.stringify({ chao_can_gi: "Dạ." }));
    writePackFile(
      bad,
      "knowledge.json",
      JSON.stringify([
        { id: "loi", cauHoiMau: [], tuKhoa: [], traLoi: "Một. Hai. Ba. Bốn. Năm.", nguon: "", ngaySoat: "" },
      ])
    );
    makeManifest(bad, [{ rel: "answers.json" }, { rel: "knowledge.json" }]);
    // cố tình phá: sửa answers.json SAU khi manifest đã băm → sai sha256
    writePackFile(bad, "answers.json", JSON.stringify({ chao_can_gi: "Đã đổi — sha lệch" }));
    // thêm file mồ côi (không có trong manifest)
    writePackFile(bad, "models/orphan.bin", "khong-co-trong-manifest");
    const rBad = validatePack(bad);
    const need = ["traLoi > 4", "thiếu nguon", "thiếu ngaySoat", "Sai sha256", "mồ côi"];
    for (const frag of need) {
      if (!rBad.fails.some((f) => f.includes(frag))) {
        ok = false;
        process.stdout.write("  ✖ self-test: gói LỖI thiếu bắt lỗi chứa \"" + frag + "\"\n");
      }
    }
    if (rBad.fails.length === 0) {
      ok = false;
      process.stdout.write("  ✖ self-test: gói LỖI lại không có lỗi nào\n");
    }
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
  if (ok) process.stdout.write("✔ self-test ĐẠT: gói hợp lệ pass, gói lỗi fail đúng kỳ vọng.\n");
  else process.stdout.write("✖ self-test HỎNG.\n");
  return ok;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }
  if (argv.includes("--self-test")) {
    process.exit(selfTest() ? 0 : 1);
  }
  let budgetMb = DEFAULT_BUDGET_MB;
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--budget-mb") budgetMb = Number(argv[++i]);
    else if (argv[i].startsWith("--")) {
      process.stderr.write("Không hiểu tuỳ chọn: " + argv[i] + "\n");
      printHelp();
      process.exit(1);
    } else positional.push(argv[i]);
  }
  if (positional.length === 0) {
    printHelp();
    process.exit(1);
  }
  const root = positional[0];
  try {
    if (!statSync(root).isDirectory()) throw new Error(root + " không phải thư mục");
  } catch (e) {
    process.stderr.write("Lỗi: " + e.message + "\n");
    process.exit(1);
  }
  const res = validatePack(root, { budgetMb });
  report(root, res);
  process.exit(res.fails.length === 0 ? 0 : 1);
}

main();
