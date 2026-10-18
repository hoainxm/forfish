// CẮT MẢNH TRONG CÂU (doc 15 §21l) — mảnh mang ngữ điệu GIỮA câu, ghép liền hơn.
//
// Chạy Ở BỜ (gpu-desktop), sau:
//   1. gen_clips.py --mang kb.json   (VieNeu đọc NGUYÊN câu mang, 4 bản/câu → $SEN_BIEN_CAND)
//   2. cham_hay.py $SEN_BIEN_CAND    (UTMOS chấm độ tự nhiên từng bản → hay.json)
//   3. SEN_BIEN_CAND=~/sb-mang node scripts/sen-bien-giong/cat_trong_cau.mjs kb.json
//
// Mỗi bản câu: bộ nhận giọng (sherpa-onnx, cùng model chon_clips) cho MỐC THỜI GIAN
// từng chữ → căn với chữ mong đợi → mảnh nào mọi chữ đều khớp thì cắt ra, ranh
// cắt dời về chỗ NĂNG LƯỢNG THẤP NHẤT quanh mốc (cắt giữa hai chữ, không phạm phụ
// âm). TỰ KIỂM: cho bộ nhận giọng nghe riêng mảnh vừa cắt, phải ra ĐÚNG chữ mới
// nhận. Mỗi mảnh chọn bản cắt từ câu có UTMOS cao nhất; nén như chon_clips.
// Mảnh không cắt được ghi vào $SEN_BIEN_CAND/chua_cat.json ⇒ sinh đứng riêng.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CAND = process.env.SEN_BIEN_CAND || join(homedir(), "sb-mang");
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

const SR = 16000;
const PAD = 0.3; // đệm lặng đầu: bộ nhận cụt chữ đầu khi tiếng bắt đầu ngay giây 0
const chuan = (w) => w.toLowerCase().normalize("NFC").replace(/kĩ/g, "kỹ").replace(/oá/g, "óa").replace(/[^\p{L}\p{N}]/gu, "");

function pcmOf(file) {
  const b = execFileSync("ffmpeg", ["-loglevel", "error", "-i", file, "-f", "f32le", "-ac", "1", "-ar", String(SR), "-"]);
  return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
}
function nghe(x) {
  const all = new Float32Array(x.length + 2 * PAD * SR);
  all.set(x, PAD * SR);
  const st = rec.createStream();
  st.acceptWaveform({ samples: all, sampleRate: SR });
  rec.decode(st);
  const r = rec.getResult(st);
  return r.tokens.map((t, i) => ({ w: chuan(t), t: r.timestamps[i] - PAD })).filter((x) => x.w);
}

/** căn chữ mong đợi với chữ nghe được (Levenshtein) ⇒ exp[i] = chỉ số chữ nghe khớp ĐÚNG, hoặc -1 */
function can(exp, got) {
  const n = exp.length;
  const m = got.length;
  const d = Array.from({ length: n + 1 }, (_, i) => Int32Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (exp[i - 1] === got[j - 1].w ? 0 : 1));
  const map = new Array(n).fill(-1);
  for (let i = n, j = m; i > 0 && j > 0; ) {
    if (d[i][j] === d[i - 1][j - 1] + (exp[i - 1] === got[j - 1].w ? 0 : 1)) {
      if (exp[i - 1] === got[j - 1].w) map[i - 1] = j - 1;
      i--;
      j--;
    } else if (d[i][j] === d[i - 1][j] + 1) i--;
    else j--;
  }
  return map;
}

/** năng lượng (dBFS) khung 10 ms bắt đầu ở t giây */
function dB(x, t) {
  const F = SR / 100;
  const i = Math.max(0, Math.min(x.length - F, Math.floor(t * SR)));
  let e = 0;
  for (let j = i; j < i + F; j++) e += x[j] * x[j];
  return 10 * Math.log10(e / F + 1e-12);
}

/** khung 10 ms có năng lượng thấp nhất trong [a, b] giây */
function dayNangLuong(x, a, b) {
  const F = SR / 100;
  let best = a;
  let min = Infinity;
  for (let t = Math.max(0, a); t <= Math.min(x.length / SR - 0.01, b); t += 0.01) {
    const i = Math.floor(t * SR);
    let e = 0;
    for (let j = i; j < i + F; j++) e += x[j] * x[j];
    if (e < min) {
      min = e;
      best = t;
    }
  }
  return best;
}

const kb = JSON.parse(readFileSync(process.argv[2], "utf8"));
const hay = existsSync(join(CAND, "hay.json")) ? JSON.parse(readFileSync(join(CAND, "hay.json"), "utf8")) : {};
const cat = JSON.parse(readFileSync(join(ROOT, "src/data/giong-sen-bien-manh.json"), "utf8"));
const ran = new Set(cat.nhom.ran.map(([id]) => id));
const out = process.env.SEN_BIEN_RA || join(ROOT, "public", cat.dir.replace(/^\//, "")); // RA: chạy thử ra thư mục tạm
const files = readdirSync(CAND).filter((f) => /^\d+~\d+\.mp3$/.test(f));

/** id mảnh → bản cắt tốt nhất {file, a, b, diem} */
const tot = new Map();
let ban = 0;
let catDuoc = 0;
let truot = 0;
for (const f of files) {
  const n = Number(f.split("~")[0]);
  const m = kb.mang[n];
  if (!m) continue;
  const diem = hay[f] ?? 0;
  const x = pcmOf(join(CAND, f));
  const got = nghe(x);
  const map = can(m.words.map(chuan), got);
  ban++;
  for (const [id, a, b] of m.spans) {
    if ((tot.get(id)?.diem ?? -1) >= diem) continue; // đã có bản từ câu hay hơn
    let du = true;
    for (let i = a; i < b; i++) if (map[i] < 0) du = false;
    if (!du) continue;
    const t0 = got[map[a]].t;
    const sau = b < m.words.length && map[b] >= 0 ? got[map[b]].t : null;
    const t1 = sau ?? x.length / SR;
    const dau = dayNangLuong(x, t0 - 0.12, t0 + 0.03);
    const cuoi = sau == null ? t1 : dayNangLuong(x, t1 - 0.14, t1 + 0.02);
    if (cuoi - dau < 0.12 * (b - a)) continue;
    // TỰ KIỂM — nhận khi MỘT trong hai:
    //  · nghe riêng mảnh vừa cắt ra ĐÚNG chữ; hoặc
    //  · chữ đã khớp trong câu VÀ hai chỗ cắt đều gần lặng (< −38 dBFS) ⇒ không
    //    cắt phạm tiếng. (Nghe riêng mảnh ngắn thì bộ nhận giọng vốn hay sai —
    //    giọng Nam tr≈ch, hỏi≈ngã — chỉ dùng cách 1 thì bỏ oan 2/3 bản tốt.)
    const doan = x.subarray(Math.floor(dau * SR), Math.floor(cuoi * SR));
    const lai = nghe(doan).map((g) => g.w).join(" ");
    const dung = lai === m.words.slice(a, b).map(chuan).join(" ");
    const lang = dB(x, dau) < -38 && (sau == null || dB(x, cuoi) < -38);
    if (!dung && !lang) {
      truot++;
      continue;
    }
    catDuoc++;
    tot.set(id, { file: f, a: dau, b: cuoi, diem });
  }
}

const NEN = (kbps) => ["-ac", "1", "-ar", "16000", "-b:a", kbps, "-map_metadata", "-1", "-id3v2_version", "0"];
for (const [id, c] of tot) {
  const d = Math.max(0.005, Math.min(0.012, (c.b - c.a) / 8));
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-i", join(CAND, c.file),
    "-af", `atrim=${c.a.toFixed(3)}:${c.b.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=${d},areverse,afade=t=in:d=${d},areverse`,
    ...NEN(ran.has(id) ? "16k" : "24k"), join(out, `${id}.mp3`),
  ]);
}
const tatCa = Object.values(cat.nhom).flatMap((ds) => ds.map(([id]) => id));
const chua = tatCa.filter((id) => !tot.has(id));
writeFileSync(join(CAND, "chua_cat.json"), JSON.stringify(chua));
console.log(
  `nghe ${ban} bản câu · cắt đạt ${catDuoc} lần (tự kiểm trượt ${truot}) · ${tot.size}/${tatCa.length} mảnh lấy từ trong câu · ${chua.length} mảnh còn phải sinh đứng riêng → chua_cat.json`,
);
