// Chọn bản giọng Sen Biển tốt nhất: cho bộ nhận giọng trong máy (sherpa-onnx,
// cùng model của voice-gateway Forlife) nghe lại từng bản gen_clips.py vừa sinh,
// đo tỉ lệ sai chữ (WER) so với câu gốc, chép bản sai ít nhất vào public/.
// Chạy Ở BỜ, sau gen_clips.py:   node scripts/sen-bien-giong/chon_clips.mjs [--manh]
// --manh: danh mục mảnh ghép (giong-sen-bien-manh.json, doc 15 §21).
// --nen-lai: nén lại MỌI mp3 đang có trong thư mục đích theo mức NEN (đổi mức nén có chủ ý).
//
// NÉN ở bước này (ứng viên gen_clips giữ 24 kHz/48 kbps): đo 2026-10-17 trên
// 120 mảnh, bộ nhận giọng chấm sai chữ — 48 kbps 8,7 KB 11,5 % · 16 kHz/24 kbps
// 4,5 KB 12,3 % · 16 kHz/16 kbps 3,1 KB 13,1 % · Opus 12 kbps 2,2 KB 11,2 %.
// Opus nhỏ nhất nhưng Safari/iOS cũ (app còn chạy iOS 15) không giải mã chắc
// ⇒ mp3 16 kHz/24 kbps: nhỏ gần nửa, không mất độ rõ. Bỏ thẻ ID3 (vô ích), GIỮ
// khung Xing/LAME — trình duyệt dựa vào nó để cắt độ trễ bộ mã, ghép mới liền.//
// Cần: ffmpeg trên PATH; sherpa-onnx-node ở SHERPA_PKG (mặc định
// ~/forlife/voice-gateway); model ở SHERPA_MODEL. Không phải dependency của app.
import { createRequire } from "node:module";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CAND = process.env.SEN_BIEN_CAND || join(tmpdir(), "sen-bien-giong-cand");
const PKG = process.env.SHERPA_PKG || join(homedir(), "forlife/voice-gateway");
const MODEL =
  process.env.SHERPA_MODEL || join(homedir(), ".local/forlife/models/sherpa-onnx-zipformer-vi-int8-2025-04-20");

const sherpa = createRequire(join(PKG, "package.json"))("sherpa-onnx-node");
const pick = (re) => join(MODEL, readdirSync(MODEL).find((f) => re.test(f)));
const rec = new sherpa.OfflineRecognizer({
  featConfig: { sampleRate: 16000, featureDim: 80 },
  modelConfig: {
    transducer: { encoder: pick(/^encoder.*\.onnx$/), decoder: pick(/^decoder.*\.onnx$/), joiner: pick(/^joiner.*\.onnx$/) },
    tokens: join(MODEL, "tokens.txt"),
    numThreads: 4,
    provider: "cpu",
  },
  decodingMethod: "greedy_search",
});

// "kĩ"/"kỹ", "xoá"/"xóa" là cùng chữ — đừng phạt bản đọc đúng vì cách viết
const words = (s) =>
  s
    .toLowerCase()
    .normalize("NFC")
    .replace(/kĩ/g, "kỹ")
    .replace(/oá/g, "óa")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

function wer(ref, got) {
  const d = Array.from({ length: ref.length + 1 }, (_, i) => [i, ...Array(got.length).fill(0)]);
  for (let j = 1; j <= got.length; j++) d[0][j] = j;
  for (let i = 1; i <= ref.length; i++)
    for (let j = 1; j <= got.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (ref[i - 1] === got[j - 1] ? 0 : 1));
  return d[ref.length][got.length] / ref.length;
}

function hear(file) {
  const pcm = execFileSync("ffmpeg", ["-loglevel", "error", "-i", file, "-f", "f32le", "-ac", "1", "-ar", "16000", "-"]);
  const s = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.byteLength / 4);
  // đệm 0,3 s lặng hai đầu: bộ nhận cụt chữ đầu khi tiếng bắt đầu ngay giây 0
  const all = new Float32Array(s.length + 9600);
  all.set(s, 4800);
  const st = rec.createStream();
  st.acceptWaveform({ samples: all, sampleRate: 16000 });
  rec.decode(st);
  return rec.getResult(st).text;
}

const MANH = process.argv.includes("--manh");
// mp3 MPEG-2 chỉ có nấc 16 / 24 kbps ở 16 kHz (20k tự rơi về 16k; VBR không nhỏ hơn — đo 2026-10-17).
// Mảnh nghe NHIỀU giữ 24k; tên rạn (1 500 tên, ít khi đọc) 16k — nhỏ hơn 32 %.
const NEN = (kbps) => ["-ac", "1", "-ar", "16000", "-b:a", kbps, "-map_metadata", "-1", "-id3v2_version", "0"];
/*  CẮT GỌN (đo 2026-10-17 trên trình duyệt thật): VieNeu để lại đuôi nhiễu
    ~−55 dB sau tiếng (ngưỡng −50 dB của gen_clips không ăn) — mảnh một âm tiết
    dài 1,2 s, ghép vào câu nghe ngắc ngứ; vài mảnh còn dính TIẾNG BẬT ngắn ở rìa
    ("rồi" bật thêm một tiếng sau 0,5 s lặng). Đo năng lượng từng 10 ms (tiếng =
    trên −40 dBFS), chia cụm theo quãng lặng > 300 ms; bỏ cụm NGẮN (< 150 ms
    tiếng) ở HAI RÌA, giữ trọn từ cụm thật đầu tới cụm thật cuối (câu có dấu
    phẩy không bị cắt); chừa 25 ms hai đầu, mờ 5 ms cho khỏi lách tách.
    Lần đầu viết "bỏ mọi thứ sau quãng lặng" đã cắt cụt mảnh có tiếng bật ở
    ĐẦU ("Rạn ngầm Chà Đỏ" còn 0,16 s) — bắt được nhờ đo s/âm tiết. */
function catGon(src) {
  const pcm = execFileSync("ffmpeg", ["-loglevel", "error", "-i", src, "-f", "f32le", "-ac", "1", "-ar", "16000", "-"]);
  const x = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.byteLength / 4);
  const F = 160; // 10 ms
  const cum = []; // [đầu, cuối, số khung có tiếng]
  let lang = 99;
  for (let i = 0, k = 0; i + F <= x.length; i += F, k++) {
    let e = 0;
    for (let j = i; j < i + F; j++) e += x[j] * x[j];
    if (10 * Math.log10(e / F + 1e-12) <= -40) {
      lang++;
      continue;
    }
    if (lang > 30 || cum.length === 0) cum.push([k, k, 0]);
    const c = cum[cum.length - 1];
    c[1] = k;
    c[2]++;
    lang = 0;
  }
  if (cum.length === 0) return null;
  const that = (c) => c[2] >= 15;
  let a = 0;
  let b = cum.length - 1;
  while (a < b && !that(cum[a])) a++;
  while (b > a && !that(cum[b])) b--;
  return {
    dau: Math.max(0, cum[a][0] * 0.01 - 0.025),
    cuoi: Math.min(x.length / 16000, (cum[b][1] + 1) * 0.01 + 0.025),
    bo: a > 0 || b < cum.length - 1,
  };
}
const nen = (src, dst, kbps = "24k") => {
  const c = catGon(src);
  const cut = c
    ? ["-af", `atrim=${c.dau.toFixed(3)}:${c.cuoi.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=0.005,areverse,afade=t=in:d=0.005,areverse`]
    : [];
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", src, ...cut, ...NEN(kbps), dst]);
  return c;
};
const cat = JSON.parse(readFileSync(join(ROOT, MANH ? "src/data/giong-sen-bien-manh.json" : "src/data/giong-sen-bien.json"), "utf8"));
if (MANH) cat.items = Object.entries(cat.nhom).flatMap(([nhom, ds]) => ds.map(([id, text]) => ({ id, text, nhom })));
const out = join(ROOT, "public", cat.dir.replace(/^\//, ""));
mkdirSync(out, { recursive: true });
// --cat-gon: cắt gọn lại MỌI mp3 đã có trong thư mục đích (giữ mức nén theo nhóm)
if (process.argv.includes("--cat-gon")) {
  const ran = new Set(MANH ? cat.nhom.ran.map(([id]) => id) : []);
  const tmp = join(tmpdir(), "sen-bien-gon.mp3");
  let truoc = 0;
  let sau = 0;
  let rac = 0;
  for (const f of readdirSync(out).filter((x) => x.endsWith(".mp3") && !x.startsWith("."))) {
    truoc += statSync(join(out, f)).size;
    const c = nen(join(out, f), tmp, ran.has(f.replace(/\.mp3$/, "")) ? "16k" : "24k");
    if (c?.bo) rac++;
    copyFileSync(tmp, join(out, f));
    sau += statSync(join(out, f)).size;
  }
  console.log(`cắt gọn: ${(truoc / 1024).toFixed(0)} KB → ${(sau / 1024).toFixed(0)} KB · ${rac} mảnh bỏ tiếng bật ở rìa`);
  process.exit(0);
}
if (process.argv.includes("--nen-lai")) {
  const tmp = join(tmpdir(), "sen-bien-nen.mp3");
  let truoc = 0;
  let sau = 0;
  for (const f of readdirSync(out).filter((x) => x.endsWith(".mp3") && !x.startsWith("."))) {
    truoc += statSync(join(out, f)).size;
    nen(join(out, f), tmp);
    copyFileSync(tmp, join(out, f));
    sau += statSync(join(out, f)).size;
  }
  console.log(`nén lại: ${(truoc / 1024).toFixed(0)} KB → ${(sau / 1024).toFixed(0)} KB`);
  process.exit(0);
}
// điểm TỰ NHIÊN (cham_hay.py, UTMOS) — có thì dùng: đúng chữ trước, ngang nhau lấy bản hay hơn
const HAY = existsSync(join(CAND, "hay.json")) ? JSON.parse(readFileSync(join(CAND, "hay.json"), "utf8")) : {};
const cands = existsSync(CAND) ? readdirSync(CAND) : [];
let n = 0;
let sum = 0;
for (const it of cat.items) {
  const mine = cands.filter((f) => f.startsWith(`${it.id}~`));
  if (mine.length === 0) continue;
  // mảnh: lượt trước đã chọn (lượt bị ngắt giữa chừng) thì thôi — muốn chọn lại thì xoá file đích
  if (MANH && existsSync(join(out, `${it.id}.mp3`))) continue;
  const ref = words(it.doc || it.text);
  let best = null;
  for (const f of mine) {
    let got;
    try {
      got = hear(join(CAND, f));
    } catch {
      console.log(`!! bỏ bản hỏng ${f}`); // mp3 cụt (ffmpeg bị ngắt) — còn các bản kia
      continue;
    }
    const w = wer(ref, words(got));
    const h = HAY[f] ?? 0;
    if (!best || w < best.w || (w === best.w && h > best.h)) best = { f, w, got, h };
  }
  if (!best) {
    console.log(`!! 100% ${it.id} | mọi bản đều hỏng — sinh lại`);
    continue;
  }
  nen(join(CAND, best.f), join(out, `${it.id}.mp3`), it.nhom === "ran" ? "16k" : "24k");
  n++;
  sum += best.w;
  console.log(`${best.w > 0.2 ? "!!" : "ok"} ${String(Math.round(best.w * 100)).padStart(3)}% ${it.id} | ${best.got}`);
}
console.log(n ? `chọn ${n} câu · sai chữ trung bình ${((sum / n) * 100).toFixed(1)}%` : "không có bản nào để chọn");
