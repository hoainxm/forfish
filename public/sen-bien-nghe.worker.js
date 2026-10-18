/*  SEN BIỂN — NGHE TRONG MÁY (Web Worker, không mạng).

    Chạy sherpa-onnx (WASM, Apache-2.0) + mô hình zipformer tiếng Việt gói trong
    /data/sen-bien-nghe.v1.bin. Luồng chính (lib/sen-bien/nghe-may.ts) đọc file
    mô hình qua `fetchDataBytes` (một cửa: giải mã SDF2, kho SW) rồi CHUYỂN bytes
    sang đây — worker không tự fetch /data (cổng data-codec.test cấm fetch trần).

    Tin vào:  {t:"nap", ban, goi:ArrayBuffer, hot:string}  → {t:"san"} | {t:"loi", m}
              {t:"hot", hot:string}                          → {t:"san"}
              {t:"nghe", id, rate, mau:Float32Array}         → {t:"chu", id, text, ms}
    Bộ chạy WASM ở /sherpa-asr/<ban>/ — dựng riêng CHỈ-NGHE bằng scripts/sen-bien-nghe-wasm/build.sh.
*/
let M = null; // Module emscripten
let rec = null;
let hotHienTai = null;

function taoRec(hot) {
  if (rec) {
    rec.free();
    rec = null;
  }
  const coHot = !!(hot && hot.trim());
  if (coHot) M.FS.writeFile("/m/hot.txt", hot);
  rec = new OfflineRecognizer(
    {
      featConfig: { sampleRate: 16000, featureDim: 80 },
      modelConfig: {
        transducer: { encoder: "/m/encoder.onnx", decoder: "/m/decoder.onnx", joiner: "/m/joiner.onnx" },
        tokens: "/m/tokens.txt",
        numThreads: 1,
        provider: "cpu",
        debug: 0,
        modelingUnit: "bpe",
        bpeVocab: "/m/bpe.vocab",
      },
      // ưu tiên tên cảng / điểm đã ghim: đo 2026-10-16 đúng việc 62→68/70 câu
      decodingMethod: coHot ? "modified_beam_search" : "greedy_search",
      maxActivePaths: 4,
      hotwordsFile: coHot ? "/m/hot.txt" : "",
      hotwordsScore: 2.5,
    },
    M,
  );
  hotHienTai = hot;
}

async function nap(ban, goi, hot) {
  if (!M) {
    const dir = `/sherpa-asr/${ban}/`;
    const san = new Promise((ok, loi) => {
      // bản dựng không MODULARIZE: đọc cấu hình từ `Module` toàn cục rồi gắn hàm vào nó
      self.Module = { locateFile: (p) => dir + p, onRuntimeInitialized: ok, onAbort: loi };
    });
    importScripts(dir + "sherpa-onnx-wasm-main-asr.js", dir + "sherpa-onnx-asr.js");
    await san;
    M = self.Module;
    M.FS.mkdir("/m");
  }
  const u8 = new Uint8Array(goi);
  if (String.fromCharCode(...u8.subarray(0, 4)) !== "SBN1") throw new Error("gói nghe hỏng (sai đầu)");
  const nh = new DataView(goi).getUint32(4, true);
  const head = JSON.parse(new TextDecoder().decode(u8.subarray(8, 8 + nh)));
  let off = 8 + nh;
  for (const f of head.files) {
    if (off + f.len > u8.length) throw new Error("gói nghe hỏng (bị cắt)");
    M.FS.writeFile(`/m/${f.name}`, u8.subarray(off, off + f.len));
    off += f.len;
  }
  taoRec(hot);
}

self.onmessage = async (e) => {
  const d = e.data;
  try {
    if (d.t === "nap") {
      await nap(d.ban, d.goi, d.hot);
      self.postMessage({ t: "san" });
    } else if (d.t === "hot") {
      if (rec && d.hot !== hotHienTai) taoRec(d.hot);
      self.postMessage({ t: "san" });
    } else if (d.t === "nghe") {
      if (!rec) throw new Error("chưa nạp");
      const a = performance.now();
      const s = rec.createStream();
      s.acceptWaveform(d.rate, d.mau);
      rec.decode(s);
      const text = rec.getResult(s).text || "";
      s.free();
      self.postMessage({ t: "chu", id: d.id, text, ms: Math.round(performance.now() - a) });
    }
  } catch (err) {
    self.postMessage({ t: "loi", id: d.id, m: String((err && err.message) || err) });
  }
};
