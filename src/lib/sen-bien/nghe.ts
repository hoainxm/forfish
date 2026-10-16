"use client";

// SEN BIỂN — NGHE (STT) qua Web Speech API. Chép phần nghe từ nhánh
// feat/san-thuong-mai `lib/assistant/speech.ts` (bỏ phần đọc: app đã có
// `lib/voice/tts.ts` một cửa cho giọng đọc, ADR 0010).
//
// STT của Chrome Android / Safari iOS chạy trên máy chủ Google/Apple ⇒ CẦN
// MẠNG. Mất sóng mic thử MỘT lần rồi báo `network` → khung Sen Biển đưa ô GÕ
// lên (gõ tên cảng vẫn chọn được điểm đến, hiểu ý chạy trong máy).
//
// nợ: STT native offline (Capacitor SpeechRecognition) chưa có, mất sóng chỉ gõ — nâng cấp khi có bản native hoặc ≥30% lượt mic lỗi 'network'


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
  return srCtor() !== null;
}

export type ListenErrorCode = "not-allowed" | "no-speech" | "network" | "aborted" | "audio-capture" | "unsupported" | "other";

export interface ListenHandle {
  stop(): void;
  abort(): void;
}

/** im lặng tối đa khi bà con nói TÊN CHỖ (nghĩ tên, đọc toạ độ — cần lâu) */
export const SILENCE_MS = 8000;
/** im lặng tối đa khi đang chờ LỆNH NGẮN ("đi" / "thôi" / chọn một chỗ) — nhanh
    hơn (chủ dự án 2026-10-16: "nghe qua lại tự nhiên"); cũng là độ dài lượt
    tự nghe sau câu hỏi của Sen Biển */
export const COMMAND_SILENCE_MS = 5000;
export const MAX_LISTEN_MS = 20000;

/** Đang chờ gì: `lenh` = đáp ngắn (đi/thôi/chọn), `ten` = tên chỗ / toạ độ. */
export type ListenExpect = "lenh" | "ten";

export function silenceMsFor(expect: ListenExpect | undefined): number {
  return expect === "lenh" ? COMMAND_SILENCE_MS : SILENCE_MS;
}

/*  MICRO ĐÃ ĐƯỢC CHO PHÉP trong phiên này (đã có một lượt nghe ra chữ). Sen Biển
    chỉ TỰ bật micro sau câu hỏi khi cờ này bật: tự bật lúc máy chưa cho phép thì
    hộp xin quyền nhảy ra giữa lúc bà con không chạm gì. */
let granted = false;
export function micGranted(): boolean {
  return granted;
}
/** Mất sóng + không kết quả sau 3 s = coi như lỗi mạng (13 §5.4), không đợi đủ 8 s. */
const OFFLINE_GRACE_MS = 3000;

/*  TỰ NGHE SAU CÂU HỎI (chủ dự án 2026-10-16: "nghe qua lại tự nhiên"): Sen
    Biển hỏi xong ("…Nói đi để bắt đầu.", "Có 2 chỗ tên giống nhau…", "chưa nghe
    rõ") thì micro tự bật một lượt ngắn — bà con khỏi chạm. Bật SAU KHI câu đọc
    XONG thật (màn bản đồ tăng `autoListen` của SenBienSheet trong onSpoken của useNavVoice.say),
    không bao giờ trong lúc loa còn kêu (micro thu tiếng máy thành lệnh).
    Không tự nghe khi: máy không có STT, đang chế độ gõ, micro chưa từng được
    cho phép trong phiên (khỏi bật hộp xin quyền giữa chừng), màn/tab ẩn, mất
    sóng (STT cần mạng — tự bật rồi báo lỗi là ồn), loa đang đọc câu khác. */
export function autoListenOk(s: {
  stt: boolean;
  typing: boolean;
  granted: boolean;
  hidden: boolean;
  online: boolean;
  busy: boolean;
  listening: boolean;
}): boolean {
  return s.stt && !s.typing && s.granted && !s.hidden && s.online && !s.busy && !s.listening;
}

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
  /** ngữ cảnh — quyết định im lặng tối đa (`silenceMsFor`); `silenceMs` đè nếu có */
  expect?: ListenExpect;
  silenceMs?: number;
  maxMs?: number;
}): ListenHandle {
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
    granted = true;
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
    }, opts.silenceMs ?? silenceMsFor(opts.expect)),
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
