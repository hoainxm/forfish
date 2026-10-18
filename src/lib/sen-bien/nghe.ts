"use client";

// SEN BIỂN — NGHE (STT) qua Web Speech API. Chép phần nghe từ nhánh
// feat/san-thuong-mai `lib/assistant/speech.ts` (bỏ phần đọc: app đã có
// `lib/voice/tts.ts` một cửa cho giọng đọc, ADR 0010).
//
// HAI TAI (2026-10-16): bộ nghe TRONG MÁY (`nghe-may.ts`, zipformer WASM) đã nạp
// thì dùng nó trước — không cần sóng, chạy cả Android WebView (không có Web
// Speech). Chưa nạp (lần đầu, đang tải, máy tiết kiệm dữ liệu) ⇒ Web Speech như
// cũ: Chrome/Safari gửi tiếng lên máy chủ Google/Apple, mất sóng mic thử MỘT
// lần rồi báo `network` → khung Sen Biển đưa ô GÕ lên.


import { boNgheSan, ngheMay } from "./nghe-may";

type SR = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type SRCtor = new () => SR;

function srCtor(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function sttSupported(): boolean {
  return boNgheSan() || srCtor() !== null;
}

export type ListenErrorCode = "not-allowed" | "no-speech" | "network" | "aborted" | "audio-capture" | "unsupported" | "other";

export interface ListenHandle {
  stop(): void;
  abort(): void;
}

export const SILENCE_MS = 8000;
export const MAX_LISTEN_MS = 20000;
/** Mất sóng + không kết quả sau 3 s = coi như lỗi mạng (13 §5.4), không đợi đủ 8 s. */
const OFFLINE_GRACE_MS = 3000;

let live: { rec: SR; done: boolean } | null = null;

function mapError(code: string | undefined): ListenErrorCode {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "not-allowed";
    case "no-speech":
      return "no-speech";
    case "network":
      return "network";
    case "aborted":
      return "aborted";
    case "audio-capture":
      return "audio-capture";
    default:
      return "other";
  }
}

/** Một lượt nghe. Không ném: máy không hỗ trợ → `onError("unsupported")` ngay. */
export function listenOnce(opts: {
  onInterim(text: string): void;
  onFinal(text: string): void;
  onError(code: ListenErrorCode): void;
  silenceMs?: number;
  maxMs?: number;
  /** mức âm 0..1 — chỉ bộ nghe trong máy có; Web Speech không cho số này (sóng vẽ giả) */
  onLevel?(v: number): void;
}): ListenHandle {
  if (boNgheSan()) return ngheMay(opts);
  const Ctor = srCtor();
  const noop: ListenHandle = { stop() {}, abort() {} };
  if (!Ctor) {
    opts.onError("unsupported");
    return noop;
  }
  // lượt cũ còn sống → huỷ, không để hai mic chồng nhau
  if (live && !live.done) {
    try {
      live.rec.abort();
    } catch {
      /* mic cũ đã chết sẵn */
    }
  }
  let rec: SR;
  try {
    rec = new Ctor();
  } catch {
    opts.onError("unsupported");
    return noop;
  }
  const me = { rec, done: false };
  live = me;
  rec.lang = "vi-VN";
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;

  let gotAny = false;
  let finalText = "";
  const timers: ReturnType<typeof setTimeout>[] = [];
  const finish = (fn: () => void) => {
    if (me.done) return;
    me.done = true;
    for (const t of timers) clearTimeout(t);
    fn();
  };
  const abortRec = () => {
    try {
      rec.abort();
    } catch {
      /* đã dừng */
    }
  };

  rec.onresult = (e) => {
    let interim = "";
    for (let i = 0; i < e.results.length; i++) {
      const r = e.results[i];
      const t = r[0]?.transcript ?? "";
      if (r.isFinal) finalText += t;
      else interim += t;
    }
    gotAny = true;
    if (finalText.trim()) {
      const text = finalText.trim();
      finish(() => opts.onFinal(text));
      try {
        rec.stop();
      } catch {
        /* đã dừng */
      }
    } else if (interim) {
      opts.onInterim(interim);
    }
  };
  rec.onerror = (e) => finish(() => opts.onError(mapError(e?.error)));
  rec.onend = () => {
    // kết thúc mà chưa có final: im lặng (no-speech) hoặc bị dừng
    finish(() => opts.onError(gotAny ? "no-speech" : "no-speech"));
  };

  timers.push(
    setTimeout(() => {
      if (!gotAny) {
        abortRec();
        finish(() => opts.onError("no-speech"));
      }
    }, opts.silenceMs ?? SILENCE_MS),
  );
  timers.push(
    setTimeout(() => {
      abortRec();
      finish(() => opts.onError(gotAny ? "no-speech" : "no-speech"));
    }, opts.maxMs ?? MAX_LISTEN_MS),
  );
  // mất sóng + 3 s không có gì = lỗi mạng, chuyển sang chip/gõ ngay
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    timers.push(
      setTimeout(() => {
        if (!gotAny) {
          abortRec();
          finish(() => opts.onError("network"));
        }
      }, OFFLINE_GRACE_MS),
    );
  }

  try {
    rec.start();
  } catch {
    finish(() => opts.onError("other"));
    return noop;
  }
  return {
    stop() {
      try {
        rec.stop();
      } catch {
        /* đã dừng */
      }
    },
    abort() {
      abortRec();
      finish(() => opts.onError("aborted"));
    },
  };
}
