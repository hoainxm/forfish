"use client";

// SEN BIỂN — NGHE TRONG MÁY (offline). Đóng nợ "STT native offline" của nghe.ts.
//
// Web Speech (Chrome/Safari) gửi tiếng lên máy chủ Google/Apple ⇒ mất sóng là
// điếc, và Android WebView (bản Capacitor) KHÔNG có Web Speech. Ở đây: mô hình
// zipformer tiếng Việt (sherpa-onnx WASM) chạy trong Web Worker
// `public/sen-bien-nghe.worker.js`, tải MỘT lần lúc còn ở bờ (kho SW giữ).
//
// Đo 2026-10-16 (70 câu lệnh bản đồ × sạch/nhanh/máy tàu 10 dB/5 dB): đúng việc
// 68–69/70 khi có danh sách tên ưu tiên (cảng + điểm đã ghim) + khớp gần theo âm
// (hieu-y.ts); ~0,09 s/câu WASM một luồng trên Mac. Giọng thử là giọng máy —
// chưa đo giọng bà con thật.
//
// Mô hình: zipformer-vi-30M-int8-2026-02-09 (hynt, CC-BY-NC-ND 4.0) — chủ dự án
// chốt 2026-10-16 dùng bản này (xem ADR 0011 §giấy phép).

import { fetchDataBytes } from "@/lib/data-fetch";

import type { ListenErrorCode, ListenHandle } from "./nghe";

/** Thư mục bộ chạy `public/sherpa-asr/<bản>/` (scripts/sen-bien-nghe-wasm/build.sh; test khoá có đủ file). */
export const SHERPA_BAN = "1.13.8";
export const NGHE_PATH = "/data/sen-bien-nghe.v1.bin";
const WORKER_URL = "/sen-bien-nghe.worker.js";
/** 34 MB qua sóng bờ: cho dư; quá giờ thì SW vẫn tải tiếp và cất cho lần sau. */
const NAP_MS = 180_000;

/* ── VAD: biết lúc bà con nói xong — THUẦN, có test ─────────────────────── */

export type VadState = {
  /** mức ồn nền (RMS) ước từ khúc đầu */
  nen: number;
  /** đã nghe thấy tiếng nói chưa (ms lúc bắt đầu) */
  batDau: number | null;
  /** lần cuối còn tiếng nói (ms) */
  cuoi: number;
  /** số khung đã đo nền */
  khungNen: number;
};
export const VAD_NEN_KHUNG = 4; // ~4 × 85 ms đầu để ước nền
export const VAD_IM_MS = 1100; // im ngần này sau khi đã nói ⇒ xong
export const VAD_CHO_MS = 6000; // chưa nói gì sau ngần này ⇒ no-speech
export const VAD_TRAN_MS = 10000; // một câu dài nhất

export function vadMoi(): VadState {
  return { nen: 0, batDau: null, cuoi: 0, khungNen: 0 };
}

/**
 * Một khung âm thanh (rms, thời điểm ms tính từ lúc mở mic) → trạng thái mới + kết
 * luận. Ngưỡng theo nền: máy tàu ồn đều thì nền cao, chỉ tiếng nói vượt hẳn mới tính.
 */
export function vadBuoc(s: VadState, rms: number, t: number): { s: VadState; xong?: "noi-xong" | "khong-noi" | "tran" } {
  const n = { ...s };
  if (n.khungNen < VAD_NEN_KHUNG) {
    n.nen = (n.nen * n.khungNen + rms) / (n.khungNen + 1);
    n.khungNen++;
    return { s: n };
  }
  const nguong = Math.max(0.012, n.nen * 2.5);
  if (rms > nguong) {
    if (n.batDau == null) n.batDau = t;
    n.cuoi = t;
  } else if (n.batDau == null) {
    // nền trôi chậm theo máy tàu (chỉ khi chưa nói)
    n.nen = n.nen * 0.95 + rms * 0.05;
  }
  if (t >= VAD_TRAN_MS) return { s: n, xong: n.batDau == null ? "khong-noi" : "tran" };
  if (n.batDau == null) return t >= VAD_CHO_MS ? { s: n, xong: "khong-noi" } : { s: n };
  if (t - n.cuoi >= VAD_IM_MS) return { s: n, xong: "noi-xong" };
  return { s: n };
}

/** "DẪN VỀ CẢNG SA HUỲNH" → "dẫn về cảng sa huỳnh" (mô hình trả chữ hoa). */
export function chuThuong(text: string): string {
  return text.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Danh sách tên ưu tiên → nội dung file hotwords (mỗi dòng một cụm, chữ hoa như mô hình). */
export function hotwordsText(names: readonly string[]): string {
  const seen = new Set<string>();
  for (const raw of names) {
    const k = raw
      .normalize("NFC")
      .replace(/\([^)]*\)/g, " ")
      .replace(/[^\p{L}\p{N} ]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
    if (k.length >= 2) seen.add(k);
  }
  return [...seen].join("\n") + (seen.size ? "\n" : "");
}

/* ── worker ─────────────────────────────────────────────────────────────── */

let worker: Worker | null = null;
let san = false;
let napP: Promise<boolean> | null = null;
let hotDangDung = "";
let seq = 0;
const cho = new Map<number, (r: { text?: string; loi?: string }) => void>();

function layWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(WORKER_URL);
  w.onmessage = (e: MessageEvent) => {
    const d = e.data as { t: string; id?: number; text?: string; m?: string };
    if ((d.t === "chu" || d.t === "loi") && d.id != null) {
      cho.get(d.id)?.(d.t === "chu" ? { text: d.text } : { loi: d.m });
      cho.delete(d.id);
    }
  };
  worker = w;
  return w;
}

function guiCho(msg: Record<string, unknown>, transfer: Transferable[] = []): Promise<{ text?: string; loi?: string }> {
  return new Promise((ok) => {
    const w = layWorker();
    const done = (e: MessageEvent) => {
      const d = e.data as { t: string; id?: number; m?: string };
      if (d.id != null) return; // câu trả lời của lượt nghe — không phải của mình
      w.removeEventListener("message", done);
      ok(d.t === "san" ? {} : { loi: d.m ?? "lỗi" });
    };
    w.addEventListener("message", done);
    w.postMessage(msg, transfer);
  });
}

export function boNgheSan(): boolean {
  return san;
}

/**
 * Tải + nạp bộ nghe (một lần / phiên; hỏng ⇒ false, lần sau thử lại). Không ném.
 * Máy bật "tiết kiệm dữ liệu" ⇒ không tự tải (34 MB) — vẫn nghe bằng mạng như cũ.
 */
export function napBoNghe(tenUuTien: readonly string[] = []): Promise<boolean> {
  if (san) return Promise.resolve(true);
  if (napP) return napP;
  if (typeof window === "undefined" || typeof Worker === "undefined" || typeof WebAssembly === "undefined")
    return Promise.resolve(false);
  const conn = (navigator as unknown as { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return Promise.resolve(false);
  hotDangDung = hotwordsText(tenUuTien);
  napP = fetchDataBytes(NGHE_PATH, NAP_MS, "sen-bien nghe")
    .then((goi) => guiCho({ t: "nap", ban: SHERPA_BAN, goi, hot: hotDangDung }, [goi]))
    .then((r) => {
      if (r.loi) throw new Error(r.loi);
      san = true;
      return true;
    })
    .catch((e) => {
      console.warn("[sen-bien] chưa nạp được bộ nghe trong máy:", e);
      worker?.terminate();
      worker = null;
      return false;
    })
    .finally(() => {
      napP = null;
    });
  return napP;
}

/** Danh sách điểm ghim đổi ⇒ dựng lại bộ giải mã với tên mới (~0,7 s, chạy nền). */
export function datTenUuTien(tenUuTien: readonly string[]): void {
  const hot = hotwordsText(tenUuTien);
  if (!san || hot === hotDangDung) return;
  hotDangDung = hot;
  void guiCho({ t: "hot", hot });
}

/* ── một lượt nghe — cùng khuôn với listenOnce (nghe.ts) ─────────────────── */

export function ngheMay(opts: {
  onInterim(text: string): void;
  onFinal(text: string): void;
  onError(code: ListenErrorCode): void;
}): ListenHandle {
  let xong = false;
  let dung = false; // bà con bấm dừng ⇒ giải mã phần đã thu
  let stream: MediaStream | null = null;
  let ctx: AudioContext | null = null;
  const khuc: Float32Array[] = [];
  let tong = 0;

  const dong = () => {
    stream?.getTracks().forEach((t) => t.stop());
    void ctx?.close().catch(() => {});
    stream = null;
    ctx = null;
  };
  const ket = (fn: () => void) => {
    if (xong) return;
    xong = true;
    dong();
    fn();
  };

  const giaiMa = (rate: number) => {
    if (xong) return;
    const mau = new Float32Array(tong);
    let o = 0;
    for (const k of khuc) {
      mau.set(k, o);
      o += k.length;
    }
    dong();
    opts.onInterim("…");
    const id = ++seq;
    const w = layWorker();
    cho.set(id, (r) => {
      if (xong) return;
      xong = true;
      const text = r.text ? chuThuong(r.text) : "";
      if (text) opts.onFinal(text);
      else opts.onError(r.loi ? "other" : "no-speech");
    });
    w.postMessage({ t: "nghe", id, rate, mau }, [mau.buffer]);
  };

  void (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
    } catch (e) {
      const name = (e as { name?: string })?.name;
      ket(() => opts.onError(name === "NotAllowedError" || name === "SecurityError" ? "not-allowed" : "audio-capture"));
      return;
    }
    if (xong) return dong();
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      const src = ctx.createMediaStreamSource(stream);
      // ScriptProcessor cũ nhưng chạy mọi nơi (iOS 15, WebView) — câu lệnh ngắn, không cần AudioWorklet
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      const rate = ctx.sampleRate;
      let vad = vadMoi();
      proc.onaudioprocess = (ev) => {
        if (xong || !ctx) return;
        const x = new Float32Array(ev.inputBuffer.getChannelData(0));
        khuc.push(x);
        tong += x.length;
        let e2 = 0;
        for (let i = 0; i < x.length; i++) e2 += x[i] * x[i];
        const r = vadBuoc(vad, Math.sqrt(e2 / x.length), (tong / rate) * 1000);
        vad = r.s;
        if (dung || r.xong === "noi-xong" || r.xong === "tran") {
          proc.onaudioprocess = null;
          giaiMa(rate);
        } else if (r.xong === "khong-noi") {
          proc.onaudioprocess = null;
          ket(() => opts.onError("no-speech"));
        }
      };
      src.connect(proc);
      proc.connect(ctx.destination);
      opts.onInterim("");
    } catch {
      ket(() => opts.onError("audio-capture"));
    }
  })();

  return {
    stop() {
      dung = true;
    },
    abort() {
      ket(() => opts.onError("aborted"));
    },
  };
}
