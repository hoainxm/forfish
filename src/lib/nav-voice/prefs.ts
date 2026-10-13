// CHẾ ĐỘ ĐANG CHẠY — cài đặt giọng đọc của MÁY NÀY (`forfish.nav.voice.v1`).
//
// Thiếu khoá / hỏng = đọc đầy đủ (phía an toàn). KHÔNG sao lưu sang máy khác
// (`EXCLUDED` trong offline-backup.test.ts): máy khác có thể không có giọng
// Việt, chép cái "tắt" là bịt kênh đọc cảnh báo hải đồ.

import type { VoiceMode } from "@/lib/nav-voice/announcer";

export const NAV_VOICE_KEY = "forfish.nav.voice.v1";
/** Bắn khi cài đặt giọng đổi ở chỗ khác (panel Cài đặt) — hook đang chạy đọc lại. */
export const NAV_VOICE_EVENT = "forfish:nav-voice";

export type NavVoicePrefs = {
  muc: VoiceMode;
  /** đã xem tấm giới thiệu "Đang chạy" lần đầu */
  daXem: boolean;
};

export const DEFAULT_VOICE_PREFS: NavVoicePrefs = { muc: "day-du", daXem: false };

export function parseVoicePrefs(raw: string | null): NavVoicePrefs {
  if (!raw) return DEFAULT_VOICE_PREFS;
  try {
    const j = JSON.parse(raw) as Partial<NavVoicePrefs>;
    const muc: VoiceMode = j.muc === "it" || j.muc === "tat" ? j.muc : "day-du";
    return { muc, daXem: j.daXem === true };
  } catch {
    return DEFAULT_VOICE_PREFS;
  }
}

export function readVoicePrefs(): NavVoicePrefs {
  if (typeof window === "undefined") return DEFAULT_VOICE_PREFS;
  try {
    return parseVoicePrefs(localStorage.getItem(NAV_VOICE_KEY));
  } catch {
    return DEFAULT_VOICE_PREFS;
  }
}

export function writeVoicePrefs(p: NavVoicePrefs): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(NAV_VOICE_KEY, JSON.stringify(p));
  } catch {
    /* ghi không được thì lựa chọn chỉ sống tới khi đóng app — không phá gì */
  }
  try {
    window.dispatchEvent(new Event(NAV_VOICE_EVENT));
  } catch {
    /* môi trường không có Event — bỏ qua */
  }
}

export const VOICE_MODE_LABEL: Record<VoiceMode, string> = {
  "day-du": "đầy đủ",
  it: "ít",
  tat: "tắt",
};
