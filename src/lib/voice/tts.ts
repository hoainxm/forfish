"use client";

// GIỌNG ĐỌC TIẾNG VIỆT — MỘT CỬA cho cả app (chế độ Đang chạy, sau này cả Trợ lý).
//
// Ba sự thật chi phối file này (doc 15 §11, agent khả thi 2026-10-12):
//  · ANDROID WEBVIEW KHÔNG CÓ `speechSynthesis` (MDN BCD webview_android:false).
//    Bản app bọc Capacitor trên Android chỉ đọc được qua plugin native
//    `@capacitor-community/text-to-speech` (engine TTS của máy, gói tiếng Việt
//    tải về là chạy offline). Nên: native ⇒ plugin; trình duyệt ⇒ Web Speech.
//  · KHÔNG CÓ GIỌNG VIỆT THÌ IM — tuyệt đối không đọc bằng giọng khác: iOS cũ
//    đánh vần từng chữ, giọng Anh đọc tiếng Việt là vô nghĩa. Chuông + chữ trên
//    HUD vẫn chạy như trước (cảnh báo HÌNH là đường chính).
//  · iOS Safari (web) chỉ phát tiếng sau một cử chỉ chạm thật ⇒ `ttsUnlock()`
//    phải gọi TRONG handler chạm (nút Đang chạy / Bắt đầu dẫn đường / Nghe thử).
//
//  · GIỌNG NỮ SEN BIỂN (chủ dự án 2026-10-16: "giọng đọc ko hay, nhịp máy
//    móc"). Câu CỐ ĐỊNH phát mp3 sinh sẵn ở bờ bằng VieNeu-TTS (giọng Trúc Ly,
//    danh mục src/data/giong-sen-bien.json, file ở public/giong/sen-bien/ — SW
//    giữ theo luật cache-first asset tĩnh, `warmVoiceClips` tải trước khi còn
//    sóng). Câu ĐỘNG (khoảng cách, tên đảo) đọc giọng máy, ưu tiên giọng nữ,
//    tách theo dấu phẩy / hai chấm / gạch thành đoạn có NGHỈ 180–250 ms — một
//    hơi dài không ngắt là chỗ nghe máy móc nhất. Ghép trong MỘT câu nói: câu
//    nào có mp3 thì mp3, câu nào không thì giọng máy.
//
// Không file nào ném ra ngoài: mọi lỗi nuốt, `onEnd` luôn được gọi đúng một lần
// để hàng đợi phát ngôn không bao giờ kẹt.

import { Capacitor } from "@capacitor/core";
import { QueueStrategy, TextToSpeech } from "@capacitor-community/text-to-speech";
import clipCatalog from "@/data/giong-sen-bien.json";
import { timeoutSignal } from "@/lib/abort";

export type TtsAvail = {
  /** đọc được tiếng Việt trên máy này */
  ok: boolean;
  native: boolean;
  /** Android: mở được màn tải giọng của máy */
  canInstall: boolean;
};

const LANG = "vi-VN";
/*  NHỊP: trước 0,95 ("chậm cho người 40–60 tuổi") — nhưng chậm đều cả câu lại
    là thứ nghe máy móc nhất. Nay giữ tốc độ tự nhiên và lấy chỗ thở bằng NGHỈ
    giữa các đoạn (PAUSE_*), đúng cách người đọc bản tin. */
export const TTS_RATE = 1;
/** nghỉ sau dấu phẩy / hai chấm / gạch */
export const PAUSE_COMMA_MS = 180;
/** nghỉ giữa hai câu */
export const PAUSE_SENTENCE_MS = 250;
/** tải một clip mp3 (từ kho SW là mili giây) — quá thì đọc giọng máy */
const CLIP_FETCH_MS = 4000;
/** không `onstart` sau ngần này (web) ⇒ coi như không đọc được, sang câu kế */
const START_GUARD_MS = 1500;
/** trần một lượt nói (bản tin mở đầu nhiều câu + nghỉ giữa đoạn) — engine treo không được giữ hàng đợi mãi */
const MAX_UTTER_MS = 45_000;

function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function webSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined"
  );
}

/* ── WEB: chọn giọng vi* (tách từ assistant/speech.ts — một luật) ───────── */

let voices: SpeechSynthesisVoice[] = [];
let voicesHooked = false;
function refreshVoices(): void {
  if (!webSupported()) return;
  try {
    voices = window.speechSynthesis.getVoices() ?? [];
    if (!voicesHooked) {
      voicesHooked = true;
      window.speechSynthesis.addEventListener?.("voiceschanged", () => {
        voices = window.speechSynthesis.getVoices() ?? [];
      });
    }
  } catch {
    voices = [];
  }
}

/*  GIỌNG NỮ TRƯỚC (Sen Biển là giọng nữ — chốt 2026-09-08). API không có cờ
    giới tính ⇒ đoán theo tên: HoaiMy (Microsoft), Linh (Apple), Google tiếng
    Việt đều là giọng nữ; NamMinh / An (Microsoft) là giọng nam. */
const FEMALE_RE = /hoai ?my|hoài ?my|\blinh\b|female|\bnữ\b|google/i;
const MALE_RE = /nam ?minh|microsoft an\b|\bmale\b|\bnam\b/i;

type VoiceLike = { name?: string; lang?: string; localService?: boolean };

/** Điểm xếp giọng — NHỎ hơn là tốt hơn. Mất sóng: giọng mạng xuống đáy. */
export function voiceRank(v: VoiceLike, online: boolean): number {
  const name = v.name ?? "";
  let r = 0;
  if (!v.localService && !online) r += 100;
  if (FEMALE_RE.test(name)) r -= 10;
  else if (MALE_RE.test(name)) r += 10;
  if (v.localService) r -= 1;
  return r;
}

function isVi(v: VoiceLike): boolean {
  return (v.lang ?? "").toLowerCase().replace("_", "-").startsWith("vi");
}

function isOnline(): boolean {
  try {
    return typeof navigator === "undefined" || navigator.onLine !== false;
  } catch {
    return true;
  }
}

/*  Giọng đã HỎNG trong phiên này (giọng mạng lúc sóng chập chờn: không chịu
    phát) — loại khỏi danh sách để đoạn sau rơi xuống giọng cài trong máy thay
    vì im cả câu. */
const badVoices = new Set<string>();

/** Giọng Việt tốt nhất lúc này: đọc được (mất sóng → giọng cài trong máy), rồi ưu tiên giọng nữ. */
export function vietnameseVoice(): SpeechSynthesisVoice | null {
  refreshVoices();
  const vi = voices.filter((v) => isVi(v) && !badVoices.has(v.voiceURI || v.name));
  if (vi.length === 0) return null;
  const online = isOnline();
  return [...vi].sort((a, b) => voiceRank(a, online) - voiceRank(b, online))[0];
}

/* ── CÂU → ĐOẠN ĐỌC ─────────────────────────────────────────────────────── */

/** Khoá tra clip: chữ thường, NFC, gộp khoảng trắng, bỏ dấu câu cuối. */
export function clipKey(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?…]+$/, "")
    .trim();
}

const CLIPS = new Map<string, string>(
  clipCatalog.items.map((it) => [clipKey(it.text), `${clipCatalog.dir}/${it.id}.mp3`]),
);

/** Đường dẫn mp3 giọng Sen Biển cho đúng câu này, hoặc null. */
export function clipFor(sentence: string): string | null {
  return CLIPS.get(clipKey(sentence)) ?? null;
}

/** Mọi đường dẫn clip — để tải trước khi còn sóng. */
export function allClipUrls(): string[] {
  return [...new Set(CLIPS.values())];
}

/** Tách câu ở dấu . ! ? … có khoảng trắng theo sau. KHÔNG dùng regex
    lookbehind — Safari < 16.4 ném lỗi cú pháp, trắng cả chunk (safari-cu.test). */
export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/([.!?…])\s+/g, "$1\u0000")
    .split("\u0000")
    .filter((x) => x.trim());
}

export type SpeechPart = {
  text: string;
  /** mp3 giọng Sen Biển — null ⇒ đọc giọng máy */
  clip: string | null;
  /** nghỉ SAU đoạn này */
  pauseMs: number;
};

/**
 * Một câu nói → các đoạn đọc. Câu có mp3 thì nguyên câu là một đoạn; câu không
 * có thì tách ở ", " / ": " / "; " / " – " (KHÔNG tách "2,5" — dấu phẩy thập
 * phân không có khoảng trắng theo sau).
 */
export function speechParts(text: string): SpeechPart[] {
  const sentences = splitSentences(text);
  const out: SpeechPart[] = [];
  for (const sen of sentences) {
    const clip = clipFor(sen);
    if (clip) {
      out.push({ text: sen, clip, pauseMs: PAUSE_SENTENCE_MS });
      continue;
    }
    const chunks = sen.split(/(?:[,;:]\s+|\s+[—–-]\s+)/).map((c) => c.trim()).filter(Boolean);
    chunks.forEach((c, i) =>
      out.push({
        text: c,
        clip: null,
        pauseMs: i === chunks.length - 1 ? PAUSE_SENTENCE_MS : PAUSE_COMMA_MS,
      }),
    );
  }
  if (out.length) out[out.length - 1].pauseMs = 0;
  return out;
}

/* ── MP3 SEN BIỂN ───────────────────────────────────────────────────────── */

/*  MỘT thẻ <audio> dùng chung: iOS chỉ cho phát sau cử chỉ chạm, và "mở khoá"
    gắn với CHÍNH thẻ đó (ttsUnlock phát một mẩu lặng trên nó). */
let clipEl: HTMLAudioElement | null = null;
function clipAudio(): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  try {
    clipEl ??= new Audio();
    return clipEl;
  } catch {
    return null;
  }
}
/** blob URL đã tải (hoặc đang tải) — clip nhỏ (≤25 KB), giữ trong bộ nhớ cả
    phiên. Giữ PROMISE: phát và tải trước (`warmVoiceClips`) xin cùng clip một
    lúc thì dùng chung một lượt tải (rà soát prod 2026-10-16: clip bị xin 2 lần). */
const clipBlobs = new Map<string, Promise<string>>();

function clipSrc(url: string): Promise<string> {
  const hit = clipBlobs.get(url);
  if (hit) return hit;
  // đi qua SW (cache-first) — tải về blob để phát không phụ thuộc Range/206
  const p = fetch(url, { signal: timeoutSignal(CLIP_FETCH_MS) }).then(async (res) => {
    if (!res.ok) throw new Error(`clip ${res.status}`);
    return URL.createObjectURL(await res.blob());
  });
  clipBlobs.set(url, p);
  // hỏng (mất sóng, chưa có trong kho) ⇒ bỏ khỏi bộ nhớ, lần sau tải lại
  p.catch(() => {
    if (clipBlobs.get(url) === p) clipBlobs.delete(url);
  });
  return p;
}

/** Phát một clip; `done(false)` = không phát được ⇒ chỗ gọi đọc giọng máy. */
function playClip(url: string, done: (ok: boolean) => void): () => void {
  let over = false;
  // trần một clip (clip dài nhất ~6 s): thẻ audio kẹt không được giữ cả câu nói
  const cap = setTimeout(() => finish(true), 15_000);
  function finish(ok: boolean) {
    if (over) return;
    over = true;
    clearTimeout(cap);
    done(ok);
  }
  const el = clipAudio();
  if (!el) {
    finish(false);
    return () => {};
  }
  clipSrc(url)
    .then((src) => {
      if (over) return;
      el.onended = () => finish(true);
      el.onerror = () => finish(false);
      el.src = src;
      el.currentTime = 0;
      const p = el.play();
      if (p && typeof p.catch === "function") p.catch(() => finish(false));
    })
    .catch(() => finish(false));
  return () => {
    over = true;
    clearTimeout(cap);
    try {
      el.pause();
    } catch {
      /* đã dừng */
    }
  };
}

/**
 * Tải trước mọi clip vào kho SW khi còn sóng (gọi lúc mở bản đồ, sau vài giây).
 * Không ném; dừng ở lỗi đầu tiên (mất sóng thì thôi, lần mở sau tải tiếp).
 */
let warmedAll = false;
export async function warmVoiceClips(): Promise<void> {
  /*  MỘT LƯỢT ĐỦ / PHIÊN (rà soát prod 2026-10-16): mỗi lần mở bản đồ trước đây
      xin lại cả 63 clip — trúng kho SW nên rẻ, nhưng vẫn 63 lượt gọi chen với
      lúc bản đồ đang dựng. Đủ một lượt là thôi; clip đã phát / đang tải dùng chung. */
  if (warmedAll || typeof fetch === "undefined" || !isOnline()) return;
  for (const url of allClipUrls()) {
    try {
      await clipSrc(url); // vào kho SW + giữ blob — lúc phát khỏi tải lại
    } catch {
      return;
    }
  }
  warmedAll = true;
}

function waitVoices(ms: number): Promise<void> {
  return new Promise((resolve) => {
    if (!webSupported()) return resolve();
    refreshVoices();
    if (voices.length > 0) return resolve();
    const t = setTimeout(resolve, ms);
    try {
      window.speechSynthesis.addEventListener?.(
        "voiceschanged",
        () => {
          clearTimeout(t);
          refreshVoices();
          resolve();
        },
        { once: true } as AddEventListenerOptions,
      );
    } catch {
      /* chờ hết giờ */
    }
  });
}

/* ── API ────────────────────────────────────────────────────────────────── */

/** Máy này đọc được tiếng Việt không. Không ném; tối đa ~1,5 s. */
export async function ttsCheck(): Promise<TtsAvail> {
  if (isNative()) {
    try {
      const r = await Promise.race([
        TextToSpeech.isLanguageSupported({ lang: LANG }),
        new Promise<{ supported: boolean }>((res) => setTimeout(() => res({ supported: false }), 2500)),
      ]);
      return {
        ok: !!r.supported,
        native: true,
        canInstall: Capacitor.getPlatform() === "android",
      };
    } catch {
      return { ok: false, native: true, canInstall: Capacitor.getPlatform() === "android" };
    }
  }
  if (!webSupported()) return { ok: false, native: false, canInstall: false };
  await waitVoices(1500);
  return { ok: vietnameseVoice() !== null, native: false, canInstall: false };
}

/** WAV lặng 1 mẫu — "mở khoá" thẻ <audio> trong cử chỉ chạm (iOS). */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQIAAAAAAA==";

/** Mở khoá loa (iOS Safari web) — PHẢI gọi trong handler chạm. Native không cần. */
export function ttsUnlock(): void {
  const el = clipAudio();
  if (el && !el.src) {
    try {
      el.src = SILENT_WAV;
      const p = el.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch {
      /* máy không phát được — chữ vẫn hiện */
    }
  }
  if (isNative() || !webSupported()) return;
  try {
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
  } catch {
    /* máy không phát được — chữ vẫn hiện */
  }
}

/*  NATIVE: chọn giọng nữ vi-VN của máy (chỉ số trong getSupportedVoices). Hỏi
    một lần; hỏng thì để engine tự chọn theo `lang`. */
let nativeVoiceP: Promise<number | undefined> | null = null;
function nativeVoice(): Promise<number | undefined> {
  nativeVoiceP ??= TextToSpeech.getSupportedVoices()
    .then(({ voices: list }) => {
      let best: number | undefined;
      let bestR = Infinity;
      list.forEach((v, i) => {
        if (!isVi(v)) return;
        const r = voiceRank(v, true);
        if (r < bestR) {
          bestR = r;
          best = i;
        }
      });
      return best;
    })
    .catch(() => undefined);
  return nativeVoiceP;
}

/** Đọc MỘT đoạn bằng giọng máy. `done(false)` = engine không chịu phát. */
function synthPart(text: string, rate: number, done: (ok: boolean) => void): () => void {
  let over = false;
  const guards: ReturnType<typeof setTimeout>[] = [];
  const finish = (ok: boolean) => {
    if (over) return;
    over = true;
    for (const g of guards) clearTimeout(g);
    done(ok);
  };

  if (isNative()) {
    void nativeVoice().then((voice) => {
      if (over) return;
      TextToSpeech.speak({
        text,
        lang: LANG,
        rate,
        pitch: 1,
        volume: 1,
        ...(voice != null ? { voice } : {}),
        // iOS: "playback" = vẫn đọc khi gạt nút im lặng (cảnh báo hải đồ không
        // được câm vì một nút gạt). KHÔNG khai UIBackgroundModes ⇒ không đọc nền.
        category: "playback",
        queueStrategy: QueueStrategy.Flush,
      })
        .then(() => finish(true))
        // speak() xong (hoặc bị stop()) thì promise mới settle — `finish` chống gọi đôi
        .catch(() => finish(false));
    });
    return () => {
      over = true;
      TextToSpeech.stop().catch(() => {});
    };
  }

  const voice = webSupported() ? vietnameseVoice() : null;
  if (!voice) {
    finish(false); // KHÔNG đọc bằng giọng khác
    return () => {};
  }
  const synth = window.speechSynthesis;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = LANG;
  try {
    u.voice = voice;
  } catch {
    /* để trình duyệt tự chọn theo lang */
  }
  u.rate = rate;
  let startedOk = false;
  u.onstart = () => {
    startedOk = true;
  };
  u.onend = () => finish(true);
  u.onerror = () => finish(startedOk);
  guards.push(setTimeout(() => {
    if (startedOk) return;
    // giọng này không chịu phát (giọng mạng lúc sóng yếu) — loại nó cho đoạn sau
    badVoices.add(voice.voiceURI || voice.name);
    try {
      synth.cancel();
    } catch {
      /* không có gì để huỷ */
    }
    finish(false);
  }, START_GUARD_MS));
  try {
    synth.speak(u);
  } catch {
    finish(false);
  }
  return () => {
    over = true;
    for (const g of guards) clearTimeout(g);
    try {
      synth.cancel();
    } catch {
      /* không có gì để huỷ */
    }
  };
}

/**
 * Đọc một câu nói (có thể nhiều câu). Trả hàm huỷ. `onEnd` gọi ĐÚNG MỘT LẦN
 * (xong / lỗi / huỷ / không có giọng Việt / quá giờ).
 *
 * Từng đoạn (xem `speechParts`): có mp3 Sen Biển → phát mp3 (hỏng thì đọc giọng
 * máy); không có → giọng máy. Giọng máy không chịu phát ở một đoạn thì thử lại
 * đúng đoạn đó một lần với giọng kế (giọng mạng hỏng → giọng trong máy); vẫn
 * không được thì bỏ đoạn đó — đoạn mp3 phía sau vẫn đọc.
 */
export function ttsSpeak(text: string, opts: { onEnd?(): void; rate?: number } = {}): () => void {
  // MỘT LƯỢT NÓI MỘT LÚC: câu mới thay câu cũ (như `synth.cancel()` trước đây)
  activeCancel?.();
  let ended = false;
  const timers: ReturnType<typeof setTimeout>[] = [];
  let stopCur: (() => void) | null = null;
  const end = () => {
    if (ended) return;
    ended = true;
    for (const t of timers) clearTimeout(t);
    if (activeCancel === cancel) activeCancel = null;
    opts.onEnd?.();
  };
  const cancel = () => {
    if (ended) return;
    stopCur?.();
    stopCur = null;
    end();
  };
  activeCancel = cancel;
  const parts = speechParts(text);
  if (parts.length === 0) {
    end();
    return () => {};
  }
  const rate = opts.rate ?? TTS_RATE;
  timers.push(setTimeout(cancel, MAX_UTTER_MS));
  if (!isNative() && webSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* không có gì để huỷ */
    }
  }

  let i = 0;
  const next = () => {
    if (ended) return;
    if (i >= parts.length) {
      stopCur = null;
      end();
      return;
    }
    const p = parts[i++];
    const after = () => {
      if (ended) return;
      if (p.pauseMs > 0) timers.push(setTimeout(next, p.pauseMs));
      else next();
    };
    const synth = (retry: boolean) => {
      stopCur = synthPart(p.text, rate, (ok) => {
        if (!ok && retry && !isNative() && vietnameseVoice()) synth(false);
        else after();
      });
    };
    if (p.clip) {
      stopCur = playClip(p.clip, (ok) => (ok ? after() : synth(true)));
    } else {
      synth(true);
    }
  };
  next();
  return cancel;
}

/*  Lượt nói đang chạy. Dừng một ĐOẠN không đủ: bộ chạy coi đoạn bị dừng là
    "đoạn hỏng" rồi đọc tiếp đoạn sau ⇒ hai câu chồng nhau (bắt được khi chạy
    thử "dừng" giữa lúc đang đọc "Nhắc lại: …", 2026-10-16). */
let activeCancel: (() => void) | null = null;

export function ttsCancel(): void {
  activeCancel?.();
  try {
    clipEl?.pause();
  } catch {
    /* đã dừng */
  }
  if (isNative()) {
    TextToSpeech.stop().catch(() => {});
    return;
  }
  if (!webSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* không có gì để huỷ */
  }
}

/** Android: mở màn tải dữ liệu giọng nói của máy. Nơi khác: không làm gì. */
export async function ttsOpenInstall(): Promise<void> {
  if (!isNative()) return;
  try {
    await TextToSpeech.openInstall();
  } catch {
    /* máy không có màn này */
  }
}
