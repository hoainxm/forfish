// P0 bench — sherpa-onnx WASM (sherpa_onnx_web 1.13.7) + zipformer-vi-30M-int8 + silero VAD + piper vi_VN.
// Mục tiêu: có SỐ (ms, RTF, RAM) trước khi hứa. Không phải code app.
/* global SherpaOnnx, OfflineRecognizer, createVad, OfflineTts */

const $ = (id) => document.getElementById(id);
const log = (s) => { $("log").textContent += s + "\n"; console.log(s); };
const row = (viec, kq, ms, rtf) => {
  const tr = document.createElement("tr");
  tr.innerHTML = `<td>${viec}</td><td>${kq}</td><td>${ms == null ? "" : Math.round(ms)}</td><td>${rtf == null ? "" : rtf.toFixed(3)}</td>`;
  $("tbl").tBodies[0].appendChild(tr);
};
const status = (s) => { $("status").textContent = s; };
window.__bench = { loaded: false, stt: [], tts: [], vad: [], mem: {}, ua: navigator.userAgent, simd: null };

const QS = new URLSearchParams(location.search);
const TTS_VARIANT = QS.get("tts") === "xlow" ? "xlow" : "medium";
const TTS_DIR = TTS_VARIANT === "xlow" ? "tts-xlow" : "tts";
window.__bench.ttsVariant = TTS_VARIANT;
// BỘ CHỮ ESPEAK: CHỈ TIẾNG VIỆT (9 file, 0,72 MB). fetch-assets.sh đã xoá 112 ngôn ngữ
// khác (346 file, 17,3 MB) — đo 2026-09-07: đọc→nghe 25 câu nghề cá KHÔNG kém bản đầy
// đủ (90,8% so với 90,1%, ba lần mỗi bên), vì piper vi_VN chỉ tra vi_dict + phần lõi.
// Muốn đối chứng lại bản đầy đủ: ESPEAK_KEEP_ALL=1 ./fetch-assets.sh
let Module = null, recognizer = null, vad = null, tts = null, lastTts = null;

function simdSupported() {
  // đoạn wasm nhỏ có lệnh v128 — trình duyệt không SIMD sẽ ném lỗi compile
  try {
    return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11]));
  } catch { return false; }
}

async function fetchBytes(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

function mkdirp(FS, path) {
  const parts = path.split("/").filter(Boolean);
  let cur = "";
  for (const p of parts) {
    cur += "/" + p;
    try { FS.mkdir(cur); } catch { /* đã có */ }
  }
}

async function putFile(FS, url, dest) {
  const bytes = await fetchBytes(url);
  mkdirp(FS, dest.substring(0, dest.lastIndexOf("/")));
  FS.writeFile(dest, bytes);
  return bytes.length;
}

// Cấu hình nhận dạng dùng chung. `extra.modelConfig` / `extra.top` để dựng thêm
// nhánh beam search + hotwords mà không chép lại đường dẫn model (xem benchHotwords).
function sttConfig(extra) {
  const e = extra || {};
  return {
    featConfig: { sampleRate: 16000, featureDim: 80 },
    modelConfig: {
      transducer: { encoder: "./stt/encoder.int8.onnx", decoder: "./stt/decoder.onnx", joiner: "./stt/joiner.int8.onnx" },
      tokens: "./stt/tokens.txt", numThreads: 1, provider: "cpu", debug: 0, modelType: "transducer",
      ...e.modelConfig,
    },
    decodingMethod: "greedy_search", maxActivePaths: 4,
    ...e.top,
  };
}

async function load() {
  $("btnLoad").disabled = true;
  window.__bench.simd = simdSupported();
  log(`SIMD: ${window.__bench.simd} · UA: ${navigator.userAgent}`);
  const t0 = performance.now();
  status("Đang nạp WASM…");
  const wasmBinary = await fetchBytes("assets/sherpa-onnx-wasm-web.wasm");
  Module = await SherpaOnnx({ wasmBinary, print: (s) => log("[wasm] " + s), printErr: (s) => log("[wasm!] " + s) });
  const t1 = performance.now();
  log(`WASM sẵn sàng sau ${Math.round(t1 - t0)} ms (wasm ${(wasmBinary.length / 1e6).toFixed(1)} MB)`);
  const FS = Module.FS;

  status("Đang nạp model nghe…");
  let bytes = 0;
  bytes += await putFile(FS, "assets/silero_vad.onnx", "/work/silero_vad.onnx");
  for (const f of ["encoder.int8.onnx", "decoder.onnx", "joiner.int8.onnx", "tokens.txt", "bpe.vocab"]) bytes += await putFile(FS, `assets/stt/${f}`, `/work/stt/${f}`);
  const t2 = performance.now();
  log(`Model nghe vào bộ nhớ: ${(bytes / 1e6).toFixed(1)} MB, ${Math.round(t2 - t1)} ms`);

  status("Đang nạp model đọc…");
  let tbytes = 0;
  tbytes += await putFile(FS, `assets/${TTS_DIR}/model.onnx`, `/work/${TTS_DIR}/model.onnx`);
  tbytes += await putFile(FS, `assets/${TTS_DIR}/tokens.txt`, `/work/${TTS_DIR}/tokens.txt`);
  const espeak = await (await fetch("assets/tts/espeak-files.json", { cache: "no-store" })).json();
  // nhiều file nhỏ — tải song song theo lô 24
  for (let i = 0; i < espeak.length; i += 24) {
    const chunk = espeak.slice(i, i + 24);
    const sizes = await Promise.all(chunk.map((p) => putFile(FS, `assets/tts/${p}`, `/work/tts/${p}`)));
    tbytes += sizes.reduce((a, b) => a + b, 0);
  }
  const t3 = performance.now();
  log(`Model đọc vào bộ nhớ: ${(tbytes / 1e6).toFixed(1)} MB (${espeak.length + 2} file), ${Math.round(t3 - t2)} ms`);

  FS.chdir("/work");
  status("Đang khởi tạo VAD + nhận dạng…");
  const t4 = performance.now();
  vad = createVad(Module, {
    sileroVad: { model: "./silero_vad.onnx", threshold: 0.5, minSilenceDuration: 0.5, minSpeechDuration: 0.25, maxSpeechDuration: 20, windowSize: 512 },
    tenVad: { model: "", threshold: 0.5, minSilenceDuration: 0.5, minSpeechDuration: 0.25, maxSpeechDuration: 20, windowSize: 256 },
    sampleRate: 16000, numThreads: 1, provider: "cpu", debug: 0, bufferSizeInSeconds: 30,
  });
  recognizer = new OfflineRecognizer(sttConfig(), Module);
  const t5 = performance.now();
  log(`VAD + recognizer khởi tạo: ${Math.round(t5 - t4)} ms (handle=${recognizer.handle})`);

  status("Đang khởi tạo đọc…");
  const empty = { model: "", lexicon: "", tokens: "", dataDir: "", noiseScale: 0.667, noiseScaleW: 0.8, lengthScale: 1.0 };
  tts = new OfflineTts({
    offlineTtsModelConfig: {
      offlineTtsVitsModelConfig: { model: `./${TTS_DIR}/model.onnx`, lexicon: "", tokens: `./${TTS_DIR}/tokens.txt`, dataDir: "./tts/espeak-ng-data", noiseScale: 0.667, noiseScaleW: 0.8, lengthScale: 1.0 },
      offlineTtsMatchaModelConfig: { acousticModel: "", vocoder: "", lexicon: "", tokens: "", dataDir: "", noiseScale: 0.667, lengthScale: 1.0 },
      offlineTtsKokoroModelConfig: { model: "", voices: "", tokens: "", dataDir: "", lengthScale: 1.0, lexicon: "", lang: "" },
      offlineTtsKittenModelConfig: { model: "", voices: "", tokens: "", dataDir: "", lengthScale: 1.0 },
      offlineTtsZipVoiceModelConfig: { tokens: "", encoder: "", decoder: "", vocoder: "", dataDir: "", lexicon: "", featScale: 0.1, tShift: 0.5, targetRMS: 0.1, guidanceScale: 1.0 },
      offlineTtsPocketModelConfig: { lmFlow: "", lmMain: "", encoder: "", decoder: "", textConditioner: "", vocabJson: "", tokenScoresJson: "", voiceEmbeddingCacheCapacity: 50 },
      numThreads: 1, debug: 0, provider: "cpu",
    },
    ruleFsts: "", ruleFars: "", maxNumSentences: 1, silenceScale: 0.2,
  }, Module);
  void empty;
  const t6 = performance.now();
  log(`TTS (${TTS_VARIANT}) khởi tạo: ${Math.round(t6 - t5)} ms (sampleRate=${tts.sampleRate}, speakers=${tts.numSpeakers})`);

  const heap = Module.HEAPU8.length / 1e6;
  window.__bench.mem = { heapMB: +heap.toFixed(0), jsHeapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1e6).toFixed(0) : null };
  log(`Bộ nhớ WASM heap: ${heap.toFixed(0)} MB${performance.memory ? `, JS heap ${(performance.memory.usedJSHeapSize / 1e6).toFixed(0)} MB` : ""}`);
  row("Nạp toàn bộ (WASM + model nghe + đọc)", "OK", t6 - t0, null);
  window.__bench.loaded = true;
  window.__bench.loadMs = Math.round(t6 - t0);
  status("Sẵn sàng.");
  for (const id of ["btnWav", "btnTts", "btnMic"]) $(id).disabled = false;
}

function parseWav(buf) {
  const dv = new DataView(buf);
  let off = 12, sr = 16000, ch = 1, bits = 16, data = null;
  while (off + 8 <= dv.byteLength) {
    const id = String.fromCharCode(dv.getUint8(off), dv.getUint8(off + 1), dv.getUint8(off + 2), dv.getUint8(off + 3));
    const len = dv.getUint32(off + 4, true);
    if (id === "fmt ") { ch = dv.getUint16(off + 10, true); sr = dv.getUint32(off + 12, true); bits = dv.getUint16(off + 22, true); }
    if (id === "data") { data = new Int16Array(buf, off + 8, len / 2); break; }
    off += 8 + len + (len & 1);
  }
  if (!data || bits !== 16) throw new Error("wav không phải PCM16");
  const mono = new Float32Array(data.length / ch);
  for (let i = 0; i < mono.length; i++) mono[i] = data[i * ch] / 32768;
  return { samples: mono, sampleRate: sr };
}

function recognize(samples, sampleRate, rec) {
  const recognizerUsed = rec || recognizer;
  const t0 = performance.now();
  const stream = recognizerUsed.createStream();
  stream.acceptWaveform(sampleRate, samples);
  recognizerUsed.decode(stream);
  const r = recognizerUsed.getResult(stream);
  stream.free();
  const ms = performance.now() - t0;
  return { text: (r.text || "").trim(), ms, rtf: ms / 1000 / (samples.length / sampleRate) };
}

async function benchWav() {
  $("btnWav").disabled = true;
  for (const f of ["0.wav", "1.wav", "2.wav"]) {
    const { samples, sampleRate } = parseWav(await (await fetch(`assets/wav/${f}`)).arrayBuffer());
    // lần 1 = warm-up (khởi tạo lười của onnxruntime), lần 2 = số thật
    recognize(samples, sampleRate);
    const r = recognize(samples, sampleRate);
    const dur = samples.length / sampleRate;
    log(`STT ${f} (${dur.toFixed(2)} s): "${r.text}" — ${Math.round(r.ms)} ms, RTF ${r.rtf.toFixed(3)}`);
    row(`STT ${f} (${dur.toFixed(1)} s)`, r.text, r.ms, r.rtf);
    window.__bench.stt.push({ file: f, dur, ...r });

    // VAD: đẩy theo cửa sổ 512, đếm đoạn
    const tv = performance.now();
    let segs = 0;
    for (let i = 0; i + 512 <= samples.length; i += 512) {
      vad.acceptWaveform(samples.subarray(i, i + 512));
      while (!vad.isEmpty()) { vad.pop(); segs++; }
    }
    vad.flush();
    while (!vad.isEmpty()) { vad.pop(); segs++; }
    vad.reset();
    const vms = performance.now() - tv;
    log(`VAD ${f}: ${segs} đoạn, ${Math.round(vms)} ms, RTF ${(vms / 1000 / dur).toFixed(3)}`);
    window.__bench.vad.push({ file: f, segs, ms: vms, rtf: vms / 1000 / dur });
  }
  $("btnWav").disabled = false;
}

const TTS_SENTENCES = [
  "Hôm nay ở Quy Nhơn điểm 82 trên 100, biển êm, đi được. Nghe thêm đài duyên hải.",
  "Giấy đăng kiểm tàu còn 12 ngày nữa hết hạn.",
  "Mất sóng nên tôi không nghe được, bác chạm câu bên dưới.",
];

async function benchTts() {
  $("btnTts").disabled = true;
  // warm-up
  tts.generate({ text: "Dạ.", sid: 0, speed: 1.0 });
  for (const s of TTS_SENTENCES) {
    const t0 = performance.now();
    const a = tts.generate({ text: s, sid: 0, speed: 1.0 });
    const ms = performance.now() - t0;
    const dur = a.samples.length / a.sampleRate;
    const rtf = ms / 1000 / dur;
    log(`TTS "${s.slice(0, 40)}…": ${dur.toFixed(2)} s âm, ${Math.round(ms)} ms, RTF ${rtf.toFixed(3)}`);
    row(`TTS ${s.slice(0, 28)}…`, `${dur.toFixed(1)} s âm`, ms, rtf);
    window.__bench.tts.push({ text: s, dur, ms, rtf, sampleRate: a.sampleRate });
    lastTts = a;
  }
  $("btnPlay").disabled = false;
  $("btnTts").disabled = false;
}

function playLast() {
  if (!lastTts) return;
  const ctx = new AudioContext({ sampleRate: lastTts.sampleRate });
  const buf = ctx.createBuffer(1, lastTts.samples.length, lastTts.sampleRate);
  buf.getChannelData(0).set(lastTts.samples);
  const src = ctx.createBufferSource();
  src.buffer = buf; src.connect(ctx.destination); src.start();
}

/* ───── mic: VAD cắt câu → STT, in chữ + thời gian từ hết nói tới có chữ ───── */
let micCtx = null, micNode = null, micStream = null, pending = new Float32Array(0);

function downsample(input, inRate, outRate) {
  if (inRate === outRate) return input;
  const ratio = inRate / outRate;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const a = Math.floor(i * ratio), b = Math.min(Math.floor((i + 1) * ratio), input.length);
    let s = 0; for (let j = a; j < b; j++) s += input[j];
    out[i] = s / Math.max(1, b - a);
  }
  return out;
}

async function micStart() {
  $("btnMic").disabled = true; $("btnStop").disabled = false;
  micStream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  micCtx = new AudioContext();
  const src = micCtx.createMediaStreamSource(micStream);
  // ScriptProcessor đủ cho bench (deprecated nhưng chạy mọi nơi); app thật dùng AudioWorklet
  micNode = micCtx.createScriptProcessor(4096, 1, 1);
  let speaking = false, tEnd = 0;
  micNode.onaudioprocess = (e) => {
    const x = downsample(e.inputBuffer.getChannelData(0), micCtx.sampleRate, 16000);
    const merged = new Float32Array(pending.length + x.length); merged.set(pending); merged.set(x, pending.length); pending = merged;
    while (pending.length >= 512) {
      vad.acceptWaveform(pending.subarray(0, 512)); pending = pending.subarray(512);
      const det = vad.isDetected();
      if (det && !speaking) { speaking = true; status("Đang nghe…"); }
      if (!det && speaking) { speaking = false; tEnd = performance.now(); }
      while (!vad.isEmpty()) {
        const seg = vad.front(); vad.pop();
        const r = recognize(seg.samples, 16000);
        const lat = performance.now() - tEnd;
        $("heard").textContent = r.text || "(không nghe rõ)";
        log(`MIC đoạn ${(seg.samples.length / 16000).toFixed(2)} s: "${r.text}" — decode ${Math.round(r.ms)} ms, RTF ${r.rtf.toFixed(3)}, từ hết nói→chữ ${Math.round(lat)} ms`);
        row("MIC", r.text, r.ms, r.rtf);
        window.__bench.stt.push({ file: "mic", dur: seg.samples.length / 16000, ...r, latencyMs: lat });
        status("Sẵn sàng — nói tiếp.");
      }
    }
  };
  src.connect(micNode); micNode.connect(micCtx.destination);
  status("Mic mở — bác nói.");
}

function micStop() {
  micNode?.disconnect(); micCtx?.close(); micStream?.getTracks().forEach((t) => t.stop());
  micNode = micCtx = micStream = null; $("btnMic").disabled = false; $("btnStop").disabled = true; status("Mic tắt.");
}


/* ───── vòng lặp ĐỌC → NGHE 25 câu nghề cá: giọng máy đọc, máy nghe lại — thước đo thô cho từ vựng ngành ───── */
const FISHER = [
  "hôm nay ra khơi được không", "biển động cấp mấy", "biển đông có bão không", "bão số mấy tới đâu rồi",
  "coi thời tiết Vũng Tàu giùm", "nay có gió mùa không", "nước lớn mấy giờ", "đặt cảng nhà là Sa Kỳ",
  "cảng nhà là Hòn Rớ", "cảng nhà là Tắc Cậu", "giấy nào sắp hết hạn", "bảo hiểm tàu còn không",
  "máy tới kỳ bảo dưỡng chưa", "ai chưa có bảo hiểm", "tàu có mấy người", "đổi sang tàu chín bảy bảy bảy bảy",
  "dẫn đường tới bãi mực", "tôi muốn mua nhớt", "bỏ hai thùng nhớt vô giỏ", "bỏ năm cây đá vô giỏ",
  "đơn tui tới đâu rồi", "cá ngừ bao nhiêu một ký", "giá dầu bao nhiêu", "nhớt nào tốt cho Yanmar", "tui muốn gọi shop",
];
const norm = (t) => t.toLowerCase().normalize("NFC").replace(/[.,!?;:"']/g, " ").replace(/\s+/g, " ").trim();
function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j), cur = new Array(n + 1);
  for (let i = 1; i <= m; i++) { cur[0] = i; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); [prev, cur] = [cur, prev]; }
  return prev[n];
}
async function benchRoundTrip() {
  window.__bench.rt = [];
  let sum = 0, exact = 0;
  for (const s of FISHER) {
    const a = tts.generate({ text: s, sid: 0, speed: 1.0 });
    const x = downsample(a.samples, a.sampleRate, 16000);
    const r = recognize(x, 16000);
    const A = norm(s), Bt = norm(r.text);
    const sim = 1 - lev(A, Bt) / Math.max(A.length, Bt.length, 1);
    sum += sim; if (A === Bt) exact++;
    log(`RT "${s}" → "${r.text}" (${(sim * 100).toFixed(0)}%)`);
    window.__bench.rt.push({ in: s, out: r.text, sim: +sim.toFixed(3), sttMs: Math.round(r.ms) });
  }
  const avg = sum / FISHER.length;
  window.__bench.rtAvg = +avg.toFixed(3); window.__bench.rtExact = exact;
  log(`RT trung bình giống ${(avg * 100).toFixed(1)}%, đúng nguyên câu ${exact}/${FISHER.length} (TTS ${TTS_VARIANT} → STT)`);
  row("Đọc→nghe 25 câu nghề cá", `giống ${(avg * 100).toFixed(0)}%, đúng ${exact}/25`, null, null);
}

// ── Hotwords: có kéo được từ nghề cá về đúng không?
// Ba nhánh giải mã nghe CÙNG một bộ tiếng (sinh một lần) → chênh lệch chỉ do bộ giải mã,
// không lẫn dao động của TTS. Cần bpe.vocab (sinh từ bpe.model, xem fetch-assets.sh).
// KHÔNG thêm "BIỂN ĐÔNG": đo 2026-09-07 cho thấy nó đè "biển động" từ điểm 3 trở lên —
// hỏi sóng to cỡ nào thành hỏi tên vùng biển. Hotword chỉ nhận từ không trùng âm với từ thường dùng.
const HOTWORDS = ["NHỚT", "YANMAR", "HÒN RỚ", "TẮC CẬU", "SA KỲ", "SHOP", "ĐĂNG KIỂM",
  "BẢO HIỂM", "CÁ NGỪ", "BÃI MỰC", "VŨNG TÀU", "QUY NHƠN", "GIÓ MÙA"];
const HOTWORDS_SCORE = 1.5; // 5 bắt thêm 1 từ ngành nhưng bắt đầu đè nghĩa; xem KET-QUA-P0

async function benchHotwords() {
  status("Đang sinh tiếng cho phép so hotwords…");
  const clips = FISHER.map((s) => {
    const a = tts.generate({ text: s, sid: 0, speed: 1.0 });
    return { s, x: downsample(a.samples, a.sampleRate, 16000) };
  });
  Module.FS.writeFile("/work/hotwords.txt", HOTWORDS.join("\n") + "\n");
  const beam = { decodingMethod: "modified_beam_search", maxActivePaths: 4 };
  const arms = [
    { name: "greedy", rec: recognizer },
    { name: "beam", rec: new OfflineRecognizer(sttConfig({ top: beam }), Module) },
    { name: "beam+hotwords", rec: new OfflineRecognizer(sttConfig({
        modelConfig: { modelingUnit: "bpe", bpeVocab: "./stt/bpe.vocab" },
        top: { ...beam, hotwordsFile: "./hotwords.txt", hotwordsScore: HOTWORDS_SCORE },
      }), Module) },
  ];
  window.__bench.hw = {};
  for (const arm of arms) {
    status(`Đang chấm nhánh ${arm.name}…`);
    let sum = 0, exact = 0, msSum = 0, hit = 0, hitTotal = 0;
    const rows = [];
    for (const c of clips) {
      const r = recognize(c.x, 16000, arm.rec);
      const A = norm(c.s), Bt = norm(r.text);
      const sim = 1 - lev(A, Bt) / Math.max(A.length, Bt.length, 1);
      sum += sim; msSum += r.ms; if (A === Bt) exact++;
      for (const w of HOTWORDS) {
        const lw = norm(w);
        if (A.includes(lw)) { hitTotal++; if (Bt.includes(lw)) hit++; }
      }
      rows.push({ in: c.s, out: r.text, sim: +sim.toFixed(3) });
    }
    const avg = sum / clips.length;
    window.__bench.hw[arm.name] = {
      avg: +avg.toFixed(3), exact, total: clips.length,
      msAvg: Math.round(msSum / clips.length), hot: hit, hotTotal: hitTotal, rows,
    };
    log(`HW ${arm.name}: giống ${(avg * 100).toFixed(1)}%, đúng nguyên câu ${exact}/${clips.length}, từ ngành ${hit}/${hitTotal}, ${Math.round(msSum / clips.length)} ms/câu`);
    row(`Hotwords · ${arm.name}`, `giống ${(avg * 100).toFixed(0)}%, đúng ${exact}/${clips.length}, từ ngành ${hit}/${hitTotal}`, msSum / clips.length, null);
  }
  status("Xong hotwords.");
}

$("btnLoad").onclick = () => load().catch((e) => { log("LỖI nạp: " + e.message); status("Lỗi: " + e.message); });
$("btnWav").onclick = () => benchWav().catch((e) => log("LỖI STT: " + e.message));
$("btnTts").onclick = () => benchTts().catch((e) => log("LỖI TTS: " + e.message));
$("btnMic").onclick = () => micStart().catch((e) => { log("LỖI mic: " + e.message); micStop(); });
$("btnStop").onclick = micStop;
$("btnPlay").onclick = playLast;

if (new URLSearchParams(location.search).get("auto") === "1") {
  const hw = QS.get("hw") === "1";
  load().then(benchWav).then(benchTts).then(benchRoundTrip).then(() => hw && benchHotwords()).then(() => { window.__bench.done = true; status("Xong tự động."); })
    .catch((e) => { log("LỖI auto: " + (e.stack || e.message)); window.__bench.error = String(e.message); });
}
