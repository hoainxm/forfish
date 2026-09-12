// CHƯA CHẠY THẬT — khung sẵn-sàng-chạy, cần dữ liệu cặp-đã-duyệt từ vòng đêm.
// Doc: docs/app-map/ops/tram-o-bo/06-fine-tune-qwen-lora.md §3
//
// Đọc kho "cặp đã duyệt" (câu bà con hỏi thật -> mục knowledge người CHỐT) -> xuất
// train.jsonl / eval.jsonl theo khuôn chat qwen3.5 (instruction tuning).
// Vệ sinh: bỏ PII lọt lưới, khử trùng lặp, bỏ output không hợp lệ, tách train/eval THEO CỤM
// (chống rò rỉ), in phân bố chủ đề.
//
// Chạy mẫu:
//   node prepare_dataset.mjs --in ./data/approved.jsonl --out ./data --eval-ratio 0.18
//   node prepare_dataset.mjs --self-test          # chạy trên dữ liệu mẫu nhúng, KHÔNG cần file
//
// Khuôn INPUT (một dòng JSON / hoặc mảng JSON), mỗi mục:
//   {
//     "cluster": "bao-quan-ca-ngu",              // khoá cụm — dùng để tách train/eval
//     "chuDe": "bao-quan",                       // chủ đề (cân bằng)
//     "cauHoiThat": ["bảo quản cá ngừ", "ướp cá ngừ mấy độ"],
//     "muc": { "cauHoiMau": [...], "tuKhoa": [...], "traLoi": "...", "nguon": "...", "ngaySoat": "2026-08" }
//   }

import fs from "node:fs";
import path from "node:path";

const SYS =
  "Bạn soạn mục kiến thức cho trợ lý ngư dân SDFish. Trả lời NGẮN (≤4 câu), tiếng Việt " +
  "đời thường, KHÔNG bịa số liệu biến động (giá/thời tiết), luôn ghi nguồn. Xuất đúng JSON theo khuôn.";

// --- PII: bỏ dòng dính (an toàn hơn che) -------------------------------------
const RE_SODT = /(?:^|\D)(?:\+?84|0)(?:\d[ .-]?){8,10}\d(?:\D|$)/;      // SĐT VN
const RE_CCCD = /(?:^|\D)\d{9}(?:\d{3})?(?:\D|$)/;                        // CCCD 9/12 số
const RE_TOADO = /\b\d{1,3}[.,]\d{3,}\s*[,;]\s*\d{1,3}[.,]\d{3,}\b/;      // cặp toạ độ
function coPII(s) {
  return RE_SODT.test(s) || RE_CCCD.test(s) || RE_TOADO.test(s);
}

// --- chuẩn hoá tiếng Việt để khử trùng lặp (xấp xỉ foldVn) --------------------
function foldVn(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // dấu thanh tổ hợp
    .replace(/[đĐ]/g, "d") // đ / Đ
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function demSau(s) {
  // đếm số câu thô để kiểm luật "≤4 câu"
  return (s.match(/[.!?…]+/g) || []).length || (s.trim() ? 1 : 0);
}

const RE_SO_SONG = /\b\d+([.,]\d+)?\s?(đồng|đ|k|nghìn|ngàn|triệu|độ c|°c|m\/s|km\/h|cấp \d)\b/i;

function mucHopLe(muc, loi) {
  if (!muc || typeof muc !== "object") return "thiếu 'muc'";
  if (!Array.isArray(muc.cauHoiMau) || muc.cauHoiMau.length === 0) return "thiếu cauHoiMau";
  if (!Array.isArray(muc.tuKhoa) || muc.tuKhoa.length === 0) return "thiếu tuKhoa";
  if (typeof muc.traLoi !== "string" || !muc.traLoi.trim()) return "thiếu traLoi";
  if (demSau(muc.traLoi) > 4) return "traLoi > 4 câu";
  if (!muc.nguon) return "thiếu nguon";
  if (RE_SO_SONG.test(muc.traLoi)) return "traLoi chứa số sống (giá/thời tiết) — số sống chỉ từ snapshot";
  return null; // hợp lệ
}

function mauChat(cauHoiThat, muc) {
  const user =
    "Bà con hỏi: " + cauHoiThat.map((q) => `"${q}"`).join(" | ");
  const assistant = JSON.stringify({
    cauHoiMau: muc.cauHoiMau,
    tuKhoa: muc.tuKhoa,
    traLoi: muc.traLoi,
    nguon: muc.nguon,
    ngaySoat: muc.ngaySoat || "",
  });
  return {
    messages: [
      { role: "system", content: SYS },
      { role: "user", content: user },
      { role: "assistant", content: assistant },
    ],
  };
}

function docInput(file) {
  const raw = fs.readFileSync(file, "utf8").trim();
  if (raw.startsWith("[")) return JSON.parse(raw); // mảng JSON
  return raw
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l)); // JSONL
}

function xuLy(items, evalRatio) {
  const stats = { vao: items.length, bỏ_pii: 0, bỏ_khonghople: 0, bỏ_trung: 0, chuDe: {} };
  const seen = new Set();
  const clean = [];
  for (const it of items) {
    const cauHoiThat = (it.cauHoiThat || []).map(String);
    if (cauHoiThat.some(coPII) || (it.muc && coPII(JSON.stringify(it.muc)))) {
      stats.bỏ_pii++;
      continue;
    }
    const loi = mucHopLe(it.muc, it.muc?.traLoi);
    if (loi) {
      stats.bỏ_khonghople++;
      continue;
    }
    const khoa = foldVn(cauHoiThat.join(" | "));
    if (seen.has(khoa)) {
      stats.bỏ_trung++;
      continue;
    }
    seen.add(khoa);
    const chuDe = it.chuDe || it.cluster || "khac";
    stats.chuDe[chuDe] = (stats.chuDe[chuDe] || 0) + 1;
    clean.push({ cluster: it.cluster || chuDe, chuDe, cauHoiThat, muc: it.muc });
  }

  // Tách THEO CỤM (không theo dòng): mỗi cluster nằm trọn 1 phía -> chống rò rỉ.
  const byCluster = new Map();
  for (const r of clean) {
    if (!byCluster.has(r.cluster)) byCluster.set(r.cluster, []);
    byCluster.get(r.cluster).push(r);
  }
  const clusters = [...byCluster.keys()].sort(); // ổn định, không phụ thuộc thứ tự đọc
  const evalSet = [];
  const trainSet = [];
  const mucTieuEval = Math.round(clean.length * evalRatio);
  let daEval = 0;
  // đưa cả cụm vào eval cho tới khi đạt ~ratio, ưu tiên cụm nhỏ để phủ nhiều chủ đề
  const theoKichThuoc = clusters
    .map((c) => ({ c, n: byCluster.get(c).length }))
    .sort((a, b) => a.n - b.n);
  const clusterEval = new Set();
  for (const { c, n } of theoKichThuoc) {
    if (daEval < mucTieuEval && clusterEval.size < clusters.length - 1) {
      clusterEval.add(c);
      daEval += n;
    }
  }
  for (const c of clusters) {
    const rows = byCluster.get(c).map((r) => mauChat(r.cauHoiThat, r.muc));
    (clusterEval.has(c) ? evalSet : trainSet).push(...rows);
  }
  stats.train = trainSet.length;
  stats.eval = evalSet.length;
  stats.soCum = clusters.length;
  return { trainSet, evalSet, stats };
}

function ghiJsonl(file, rows) {
  fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
}

function inStats(s) {
  console.log("— thống kê —");
  console.log(`  vào: ${s.vao} · bỏ PII: ${s.bỏ_pii} · bỏ không hợp lệ: ${s.bỏ_khonghople} · bỏ trùng: ${s.bỏ_trung}`);
  console.log(`  train: ${s.train} · eval: ${s.eval} · số cụm: ${s.soCum}`);
  console.log(`  phân bố chủ đề: ${JSON.stringify(s.chuDe)}`);
  if (s.train + s.eval < 300)
    console.log("  ⚠️  < 300 cặp sạch — theo doc §1B CHƯA đủ để train, gom thêm.");
}

// --- self-test: dữ liệu mẫu nhúng, không cần file ----------------------------
const MAU = [
  {
    cluster: "bao-quan-ca-ngu", chuDe: "bao-quan",
    cauHoiThat: ["bảo quản cá ngừ", "ướp cá ngừ mấy độ"],
    muc: { cauHoiMau: ["bảo quản cá ngừ", "ướp cá ngừ bao nhiêu độ"], tuKhoa: ["cá ngừ", "bảo quản", "ướp đá"], traLoi: "Cá ngừ giữ lạnh 0–2 độ, muối đá ngay sau khi bắt. Xả tiết, moi mang ruột trước khi ướp. Tránh nắng, che khoang cá.", nguon: "Tài liệu SDVICO — bảo quản hải sản", ngaySoat: "2026-08" },
  },
  {
    cluster: "giay-to-dang-kiem", chuDe: "giay-to",
    cauHoiThat: ["giấy đăng kiểm tàu hết hạn làm sao"],
    muc: { cauHoiMau: ["đăng kiểm tàu hết hạn"], tuKhoa: ["đăng kiểm", "gia hạn"], traLoi: "Mang tàu tới đơn vị đăng kiểm để kiểm tra lại. Chuẩn bị giấy tờ tàu và biên lai cũ. Liên hệ SDVICO nếu cần hướng dẫn.", nguon: "Tài liệu SDVICO — thủ tục giấy tờ", ngaySoat: "2026-07" },
  },
  {
    cluster: "pii-lo-lot", chuDe: "khac",
    cauHoiThat: ["gọi tôi số 0912345678 khi có cá"],   // dính SĐT -> phải bị bỏ
    muc: { cauHoiMau: ["x"], tuKhoa: ["x"], traLoi: "x.", nguon: "n", ngaySoat: "2026-08" },
  },
  {
    cluster: "so-song-loi", chuDe: "gia-ca",
    cauHoiThat: ["cá ngừ giá bao nhiêu"],
    muc: { cauHoiMau: ["giá cá ngừ"], tuKhoa: ["giá"], traLoi: "Cá ngừ hôm nay 120 nghìn đồng một ký.", nguon: "n", ngaySoat: "2026-08" }, // số sống -> bỏ
  },
];

function args() {
  const a = process.argv.slice(2);
  const o = { eval: 0.18 };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--in") o.in = a[++i];
    else if (a[i] === "--out") o.out = a[++i];
    else if (a[i] === "--eval-ratio") o.eval = parseFloat(a[++i]);
    else if (a[i] === "--self-test") o.selfTest = true;
  }
  return o;
}

function main() {
  const o = args();
  if (o.selfTest) {
    console.log("== self-test (dữ liệu mẫu nhúng) ==");
    const { stats } = xuLy(MAU, o.eval);
    inStats(stats);
    const ok = stats.bỏ_pii === 1 && stats.bỏ_khonghople === 1 && stats.train + stats.eval === 2;
    console.log(ok ? "✓ self-test OK (bỏ đúng 1 PII + 1 số-sống, giữ 2 mục sạch)" : "✗ self-test SAI");
    process.exit(ok ? 0 : 1);
  }
  if (!o.in) {
    console.error("Thiếu --in <file>. Xem --self-test hoặc header file.");
    process.exit(2);
  }
  const outDir = o.out || path.dirname(o.in);
  fs.mkdirSync(outDir, { recursive: true });
  const items = docInput(o.in);
  const { trainSet, evalSet, stats } = xuLy(items, o.eval);
  ghiJsonl(path.join(outDir, "train.jsonl"), trainSet);
  ghiJsonl(path.join(outDir, "eval.jsonl"), evalSet);
  inStats(stats);
  console.log(`→ ${path.join(outDir, "train.jsonl")} · ${path.join(outDir, "eval.jsonl")}`);
}

main();
