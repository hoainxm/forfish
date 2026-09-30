// scripts/tram-o-bo/export-brain-pack.mjs
//   node scripts/tram-o-bo/export-brain-pack.mjs <thư-mục-nội-dung> [tuỳ chọn]
// ─────────────────────────────────────────────────────────────────────────────
// ĐÓNG GÓI NÃO "Sen Biển" (bước 7 vòng đêm — docs/app-map/ops/tram-o-bo/03-vong-dem-soan-goi.md)
//
// Nhận một thư mục nội dung ĐÃ DUYỆT (intents/answers/knowledge + models/ + audio/)
// → tính sha256 + bytes từng file → sinh manifest.json đúng khuôn → in tổng dung
// lượng và CẢNH BÁO nếu vượt ngân sách (~50–70 MB, ADR 0010).
//
// ⚠️ CẦN CONTRACT Agent B (docs/contracts/tro-ly-brain-pack.contract.md) để chốt
//    tên/đường dẫn file trong gói. Khuôn manifest ở đây theo ADR 0010 §"Định dạng
//    gói"; khi contract chốt khác thì sửa THEO contract (đây không phải nguồn shape).
// ⚠️ CHƯA NỐI SUPABASE — script này chỉ đóng gói CỤC BỘ trên trạm. Việc đăng gói lên
//    bucket + đặt version + rollout là thao tác tay ở /quan-tri (02-quan-tri-va-update.md).
//
// Không phụ thuộc ngoài (chỉ node core) — nguyên tắc 15 §5 (không thêm dep cho việc vài dòng).
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from "node:crypto";
import {
  readdirSync,
  statSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_BUDGET_MB = 70; // ADR 0010: ~50–70 MB/gói
const MANIFEST_NAME = "manifest.json";

function printHelp() {
  process.stdout.write(
    [
      "Đóng gói não Sen Biển → manifest.json (sha256 từng file) + kiểm ngân sách.",
      "",
      "Dùng:",
      "  node scripts/tram-o-bo/export-brain-pack.mjs <thư-mục-nội-dung> [tuỳ chọn]",
      "",
      "Tuỳ chọn:",
      "  --version <v>          Phiên bản gói (mặc định: 0.0.0-draft). Nên đặt thật khi phát hành.",
      "  --min-app-version <v>  App cũ hơn mức này không tải gói (mặc định: 0.0.0).",
      "  --budget-mb <n>        Ngân sách cảnh báo, MB (mặc định: " + DEFAULT_BUDGET_MB + ").",
      "  --notes <chuỗi>        Ghi chú vào manifest.",
      "  --out <đường-dẫn>      Nơi ghi manifest (mặc định: <thư-mục-nội-dung>/manifest.json).",
      "  --dry-run              Không ghi file, chỉ in tóm tắt.",
      "  --help                 In trợ giúp này.",
      "",
      "Ra: manifest.json { version, createdAt, minAppVersion, files:[{path,sha256,bytes}], notes }",
      "Mã thoát: 0 nếu đóng gói được (kể cả khi vượt ngân sách — chỉ cảnh báo); 1 nếu lỗi đầu vào.",
    ].join("\n") + "\n"
  );
}

function parseArgs(argv) {
  const args = { _: [], budgetMb: DEFAULT_BUDGET_MB, version: "0.0.0-draft", minAppVersion: "0.0.0", notes: "", out: null, dryRun: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--version") args.version = argv[++i];
    else if (a === "--min-app-version") args.minAppVersion = argv[++i];
    else if (a === "--budget-mb") args.budgetMb = Number(argv[++i]);
    else if (a === "--notes") args.notes = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a.startsWith("--")) throw new Error("Không hiểu tuỳ chọn: " + a);
    else args._.push(a);
  }
  return args;
}

// Liệt kê mọi file (đệ quy), trả đường dẫn tương đối kiểu posix, bỏ qua manifest cũ.
function walkFiles(root) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) stack.push(full);
      else if (st.isFile()) {
        const rel = relative(root, full).split(sep).join("/");
        if (rel === MANIFEST_NAME) continue; // manifest sinh lại, không tự-liệt-kê
        out.push({ full, rel, bytes: st.size });
      }
    }
  }
  out.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  return out;
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function buildManifest(root, opts = {}) {
  const files = walkFiles(root).map((f) => ({
    path: f.rel,
    sha256: sha256(f.full),
    bytes: f.bytes,
  }));
  const totalBytes = files.reduce((s, f) => s + f.bytes, 0);
  return {
    manifest: {
      version: opts.version ?? "0.0.0-draft",
      createdAt: new Date().toISOString(),
      minAppVersion: opts.minAppVersion ?? "0.0.0",
      files,
      notes: opts.notes ?? "",
    },
    totalBytes,
  };
}

function fmtMB(bytes) {
  return (bytes / 1048576).toFixed(2) + " MB";
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    process.stderr.write("Lỗi: " + e.message + "\n");
    printHelp();
    process.exit(1);
  }
  if (args.help || args._.length === 0) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }
  const root = args._[0];
  try {
    if (!statSync(root).isDirectory()) throw new Error(root + " không phải thư mục");
  } catch (e) {
    process.stderr.write("Lỗi: không mở được thư mục nội dung: " + e.message + "\n");
    process.exit(1);
  }

  const { manifest, totalBytes } = buildManifest(root, args);
  const budgetBytes = args.budgetMb * 1048576;

  process.stdout.write("== Đóng gói não Sen Biển ==\n");
  process.stdout.write("Thư mục   : " + root + "\n");
  process.stdout.write("Phiên bản : " + manifest.version + " (minApp " + manifest.minAppVersion + ")\n");
  process.stdout.write("Số file   : " + manifest.files.length + "\n");
  process.stdout.write("Tổng cỡ   : " + fmtMB(totalBytes) + " / ngân sách " + args.budgetMb + " MB\n");
  for (const f of manifest.files) {
    process.stdout.write("  " + f.path + "  " + f.sha256.slice(0, 12) + "…  " + fmtMB(f.bytes) + "\n");
  }

  if (totalBytes > budgetBytes) {
    process.stdout.write(
      "\n⚠️  VƯỢT NGÂN SÁCH " + fmtMB(totalBytes) + " > " + args.budgetMb + " MB.\n" +
        "    Soát phần nào phình (docs/.../04-toi-uu.md §4). Bà con tải qua sóng yếu, mỗi MB là thật.\n"
    );
  } else {
    process.stdout.write("\n✔  Trong ngân sách.\n");
  }

  if (args.dryRun) {
    process.stdout.write("(--dry-run: không ghi manifest)\n");
    return;
  }
  const outPath = args.out ?? join(root, MANIFEST_NAME);
  writeFileSync(outPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  process.stdout.write("Đã ghi manifest: " + outPath + "\n");
  process.stdout.write(
    "Kế: chạy validate-brain-pack.mjs " + root + " (cổng), rồi đăng ở /quan-tri (tay, có người).\n"
  );
}

// chạy như lệnh thì chạy main; import (phat-hanh-local.mjs) thì chỉ lấy hàm
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
