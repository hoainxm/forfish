// Chọn bản giọng Sen Biển tốt nhất: cho bộ nhận giọng trong máy (sherpa-onnx,
// cùng model của voice-gateway Forlife) nghe lại từng bản gen_clips.py vừa sinh,
// đo tỉ lệ sai chữ (WER) so với câu gốc, chép bản sai ít nhất vào public/.
// Chạy Ở BỜ, sau gen_clips.py:   node scripts/sen-bien-giong/chon_clips.mjs
//
// Cần: ffmpeg trên PATH; sherpa-onnx-node ở SHERPA_PKG (mặc định
// ~/forlife/voice-gateway); model ở SHERPA_MODEL. Không phải dependency của app.
import { createRequire } from "node:module";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
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

const cat = JSON.parse(readFileSync(join(ROOT, "src/data/giong-sen-bien.json"), "utf8"));
const out = join(ROOT, "public", cat.dir.replace(/^\//, ""));
mkdirSync(out, { recursive: true });
const cands = existsSync(CAND) ? readdirSync(CAND) : [];
let n = 0;
let sum = 0;
for (const it of cat.items) {
  const mine = cands.filter((f) => f.startsWith(`${it.id}~`));
  if (mine.length === 0) continue;
  const ref = words(it.doc || it.text);
  let best = null;
  for (const f of mine) {
    const got = hear(join(CAND, f));
    const w = wer(ref, words(got));
    if (!best || w < best.w) best = { f, w, got };
  }
  copyFileSync(join(CAND, best.f), join(out, `${it.id}.mp3`));
  n++;
  sum += best.w;
  console.log(`${best.w > 0.2 ? "!!" : "ok"} ${String(Math.round(best.w * 100)).padStart(3)}% ${it.id} | ${best.got}`);
}
console.log(n ? `chọn ${n} câu · sai chữ trung bình ${((sum / n) * 100).toFixed(1)}%` : "không có bản nào để chọn");
