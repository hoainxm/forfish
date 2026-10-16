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
// Không file nào ném ra ngoài: mọi lỗi nuốt, `onEnd` luôn được gọi đúng một lần
// để hàng đợi phát ngôn không bao giờ kẹt.

import { Capacitor } from "@capacitor/core";
import { QueueStrategy, TextToSpeech } from "@capacitor-community/text-to-speech";

export type TtsAvail = {
  /** đọc được tiếng Việt trên máy này */
  ok: boolean;
  native: boolean;
  /** Android: mở được màn tải giọng của máy */
  canInstall: boolean;
};

const LANG = "vi-VN";
/** người nghe 40–60 tuổi, tiếng máy tàu — đọc chậm hơn mặc định một chút */
export const TTS_RATE = 0.95;
/** không `onstart` sau ngần này (web) ⇒ coi như không đọc được, sang câu kế */
const START_GUARD_MS = 1500;
/** trần một câu — engine treo không được giữ hàng đợi mãi */
const MAX_UTTER_MS = 30_000;

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

/** Giọng Việt, ưu tiên giọng cài trong máy (đọc được lúc mất sóng). */
export function vietnameseVoice(): SpeechSynthesisVoice | null {
  refreshVoices();
  const vi = voices.filter((v) => (v.lang ?? "").toLowerCase().replace("_", "-").startsWith("vi"));
  if (vi.length === 0) return null;
  return vi.find((v) => v.localService) ?? vi[0];
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

/** Mở khoá loa (iOS Safari web) — PHẢI gọi trong handler chạm. Native không cần. */
export function ttsUnlock(): void {
  if (isNative() || !webSupported()) return;
  try {
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
  } catch {
    /* máy không phát được — chữ vẫn hiện */
  }
}

/**
 * Đọc một câu. Trả hàm huỷ. `onEnd` gọi ĐÚNG MỘT LẦN (xong / lỗi / huỷ / không
 * có giọng Việt / quá giờ).
 */
export function ttsSpeak(text: string, opts: { onEnd?(): void; rate?: number } = {}): () => void {
  let ended = false;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const end = () => {
    if (ended) return;
    ended = true;
    for (const t of timers) clearTimeout(t);
    opts.onEnd?.();
  };
  const clean = text.trim();
  if (!clean) {
    end();
    return () => {};
  }
  timers.push(setTimeout(() => {
    ttsCancel();
    end();
  }, MAX_UTTER_MS));

  if (isNative()) {
    TextToSpeech.speak({
      text: clean,
      lang: LANG,
      rate: opts.rate ?? TTS_RATE,
      pitch: 1,
      volume: 1,
      // iOS: "playback" = vẫn đọc khi gạt nút im lặng (cảnh báo hải đồ không
      // được câm vì một nút gạt). KHÔNG khai UIBackgroundModes ⇒ không đọc nền.
      category: "playback",
      queueStrategy: QueueStrategy.Flush,
    })
      .catch(() => {})
      // speak() xong (hoặc bị stop()) thì promise mới settle — `end` chống gọi đôi
      .finally(end);
    return () => {
      ttsCancel();
      end();
    };
  }

  if (!webSupported()) {
    end();
    return () => {};
  }
  const voice = vietnameseVoice();
  if (!voice) {
    end(); // KHÔNG đọc bằng giọng khác
    return () => {};
  }
  const synth = window.speechSynthesis;
  try {
    synth.cancel();
  } catch {
    /* không có gì để huỷ */
  }
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = LANG;
  try {
    u.voice = voice;
  } catch {
    /* để trình duyệt tự chọn theo lang */
  }
  u.rate = opts.rate ?? TTS_RATE;
  let startedOk = false;
  u.onstart = () => {
    startedOk = true;
  };
  u.onend = end;
  u.onerror = end;
  timers.push(setTimeout(() => {
    if (!startedOk) {
      ttsCancel();
      end();
    }
  }, START_GUARD_MS));
  try {
    synth.speak(u);
  } catch {
    end();
  }
  return () => {
    ttsCancel();
    end();
  };
}

export function ttsCancel(): void {
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
