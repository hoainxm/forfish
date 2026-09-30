"use client";

// TRỢ LÝ — NGHE (STT) + NÓI (TTS) qua Web Speech API (14 §5.2, 13 §5.4).
//
// Ba sự thật chi phối file này:
//  · STT của Safari iOS / Chrome Android chạy trên máy chủ Apple/Google ⇒ CẦN
//    MẠNG. Mất sóng mic vẫn thử MỘT lần; lỗi `network` → chỗ gọi đưa CHIP + ô
//    gõ lên hàng chính (lead §0 #4). Native STT offline = nợ bản Capacitor.
//  · TTS chỉ đọc bằng giọng `vi*`. Không có giọng Việt thì KHÔNG đọc bằng
//    giọng khác (giọng Anh đọc tiếng Việt là vô nghĩa, 13 AC-T35) — chỉ chữ.
//  · iOS Safari chỉ phát tiếng sau một cử chỉ chạm thật ⇒ `speak("")` trong
//    handler chạm nút nổi là lượt "mở khoá" loa (assistant-mount gọi).
//
// Chỉ MỘT lượt nghe sống một lúc (guard cấp module) — hai mic mở chồng là
// hai kết quả về cùng lúc, câu nọ đè câu kia.
//
// nợ: STT native offline (Capacitor SpeechRecognition) chưa có, mất sóng chỉ gõ/chip — nâng cấp khi có bản native hoặc ≥30% lượt mic lỗi 'network'

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

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
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

/* ───────────────── TTS ───────────────── */

let voices: SpeechSynthesisVoice[] = [];
let voicesHooked = false;

function refreshVoices(): void {
  if (!ttsSupported()) return;
  try {
    voices = window.speechSynthesis.getVoices() ?? [];
    if (!voicesHooked) {
      voicesHooked = true;
      // `voiceschanged` có thể tới muộn (Chrome Android) — cache lại khi nổ
      window.speechSynthesis.addEventListener?.("voiceschanged", () => {
        voices = window.speechSynthesis.getVoices() ?? [];
      });
    }
  } catch {
    voices = [];
  }
}

/*  GIỌNG NỮ (chốt 2026-09-08: Sen Biển là giọng nữ — Trúc Ly / Mỹ Duyên). API
    giọng máy không có trường giới tính, nên nhận theo TÊN giọng phổ biến:
    Windows "Microsoft An" và Edge "NamMinh" là giọng NAM (registry Windows ghi
    Gender=Male); "HoaiMy" (Edge/Windows), "Linh" (Apple), giọng Google vi là NỮ. */
const MALE_VOICE_RE = /\b(an|nam ?minh)\b/i;
const FEMALE_VOICE_RE = /hoai ?my|hoài ?my|\blinh\b|google|female|\bnữ\b/i;

/** Hạng một giọng Việt: nhỏ hơn = tốt hơn. Mất sóng thì giọng mạng không đọc được → xếp sau. */
export function voiceRank(v: Pick<SpeechSynthesisVoice, "name" | "localService">, online: boolean): number {
  const gender = FEMALE_VOICE_RE.test(v.name) ? 0 : MALE_VOICE_RE.test(v.name) ? 2 : 1;
  const reach = v.localService ? 0 : online ? 0 : 10;
  return reach + gender;
}

/** Giọng Việt tốt nhất: đọc được lúc này (mất sóng → giọng cài trong máy), rồi ưu tiên giọng nữ. null = máy không có giọng Việt. */
export function vietnameseVoice(): SpeechSynthesisVoice | null {
  refreshVoices();
  const vi = voices.filter((v) => (v.lang ?? "").toLowerCase().startsWith("vi"));
  if (vi.length === 0) return null;
  const online = typeof navigator === "undefined" || navigator.onLine !== false;
  return [...vi].sort((a, b) => voiceRank(a, online) - voiceRank(b, online))[0];
}

/* ───────────────── giọng Sen Biển sinh sẵn (mp3 trong gói não) ───────────────── */

let packVoice: ((text: string) => string | null) | null = null;
let audioEl: HTMLAudioElement | null = null;

/** Gói não đã nạp → cho `speak` biết câu nào có mp3 giọng Sen Biển (use-assistant đặt). */
export function setPackVoice(lookup: ((text: string) => string | null) | null): void {
  packVoice = lookup;
}

function stopAudio(): void {
  if (!audioEl) return;
  try {
    audioEl.pause();
  } catch {
    /* đã dừng */
  }
  audioEl.onended = null;
  audioEl.onerror = null;
  audioEl = null;
}

export function hasVietnameseVoice(): boolean {
  return vietnameseVoice() !== null;
}

/**
 * Đọc to. Trả hàm huỷ. `text` rỗng = lượt "mở khoá" loa iOS (đọc rỗng ngay
 * trong cử chỉ chạm) — không cần giọng Việt. Không có giọng Việt → không đọc
 * (trả hàm rỗng), chỗ gọi hiện chữ + nhãn "Máy không có giọng Việt".
 * Không `onstart` sau 1,5 s → bỏ, gọi `onEnd` để UI không treo.
 */
export function speak(text: string, opts: { rate?: number; onEnd?(): void } = {}): () => void {
  const url = text.trim() && typeof Audio !== "undefined" ? packVoice?.(text) ?? null : null;
  if (url) return speakMp3(url, text, opts);
  return speakSynth(text, opts);
}

/**
 * Câu cố định có mp3 giọng Sen Biển → phát mp3 (đọc được cả khi máy không có
 * giọng Việt, không cần sóng). Phát hỏng (iOS chặn tự phát, file lỗi) → lùi về
 * giọng máy ngay, bà con vẫn nghe.
 */
function speakMp3(url: string, text: string, opts: { rate?: number; onEnd?(): void }): () => void {
  cancelSpeak();
  const a = new Audio(url);
  audioEl = a;
  let ended = false;
  let fellBack: (() => void) | null = null;
  const end = () => {
    if (ended) return;
    ended = true;
    if (audioEl === a) audioEl = null;
    opts.onEnd?.();
  };
  const fallback = () => {
    if (ended || audioEl !== a) return;
    audioEl = null;
    fellBack = speakSynth(text, opts);
    ended = true; // speakSynth tự gọi onEnd
  };
  a.onended = end;
  a.onerror = fallback;
  try {
    const p = a.play();
    if (p && typeof p.catch === "function") p.catch(fallback);
  } catch {
    fallback();
  }
  return () => {
    if (fellBack) return fellBack();
    if (audioEl === a) stopAudio();
    end();
  };
}

function speakSynth(text: string, opts: { rate?: number; onEnd?(): void }): () => void {
  const noop = () => {};
  if (!ttsSupported()) {
    opts.onEnd?.();
    return noop;
  }
  const synth = window.speechSynthesis;
  if (!text.trim()) {
    try {
      synth.speak(new SpeechSynthesisUtterance(""));
    } catch {
      /* máy không phát được — chữ vẫn hiện */
    }
    return noop;
  }
  const voice = vietnameseVoice();
  if (!voice) {
    opts.onEnd?.();
    return noop;
  }
  cancelSpeak();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "vi-VN";
  try {
    u.voice = voice; // giọng lạ/đã gỡ có thể ném trên vài máy — không được làm gãy cả lượt nói
  } catch {
    /* để trình duyệt tự chọn giọng theo lang */
  }
  u.rate = opts.rate ?? 1.0;
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    clearTimeout(guard);
    opts.onEnd?.();
  };
  let started = false;
  u.onstart = () => {
    started = true;
  };
  u.onend = end;
  u.onerror = end;
  const guard = setTimeout(() => {
    if (!started) {
      cancelSpeak();
      end();
    }
  }, 1500);
  try {
    synth.speak(u);
  } catch {
    end();
  }
  return () => {
    cancelSpeak();
    end();
  };
}

export function cancelSpeak(): void {
  stopAudio();
  if (!ttsSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* không có gì để huỷ */
  }
}
