"use client";

// TRỢ LÝ — SỔ RIÊNG TRÊN MÁY (14 §5.3): khoá `forfish.assistant.v1`.
//
// Giữ: đã tắt tiếng, từng bị từ chối mic, đã hỏi mic chưa, 10 câu gần nhất
// (chỉ để nuôi chip "Hỏi lại câu trước"), đếm lượt mạng theo ngày VN (để KHÔNG
// gửi khi biết đã hết — máy chủ vẫn là nguồn chốt). CHỈ ở máy, KHÔNG gửi lên
// máy chủ, KHÔNG sao lưu (`forfish.assistant.` ∈ NEVER_BACKUP_PREFIXES —
// khoá mang câu bà con nói, có thể có tên người/số).
//
// Đọc hỏng/thiếu → mặc định, KHÔNG ném. Ghi trả boolean — máy hết chỗ thì sổ
// này là tiện ích, không được chen chỗ dự báo (lib/user-store.ts luật hết chỗ).

import type { Intent, ReplySource } from "./types";

export const ASSISTANT_PREFS_KEY = "forfish.assistant.v1";
export const ASSISTANT_TURNS_MAX = 10;

export interface AssistantPrefs {
  muted: boolean;            // đã tắt tiếng
  micDenied: boolean;        // từng bị từ chối quyền mic
  micAsked: boolean;         // đã hỏi mic lần nào chưa (để lần đầu giải thích)
  last: { q: string; a: string; at: number; intent: Intent; source: ReplySource }[]; // ≤10, mới nhất cuối
  quota?: { day: string; used: number };   // đếm lượt mạng theo ngày VN
}

const DEFAULTS: AssistantPrefs = { muted: false, micDenied: false, micAsked: false, last: [] };

export function loadAssistantPrefs(): AssistantPrefs {
  if (typeof window === "undefined") return { ...DEFAULTS, last: [] };
  try {
    const raw = window.localStorage.getItem(ASSISTANT_PREFS_KEY);
    if (!raw) return { ...DEFAULTS, last: [] };
    const p = JSON.parse(raw) as Partial<AssistantPrefs> | null;
    if (!p || typeof p !== "object") return { ...DEFAULTS, last: [] };
    return {
      muted: p.muted === true,
      micDenied: p.micDenied === true,
      micAsked: p.micAsked === true,
      last: Array.isArray(p.last)
        ? p.last.filter((t) => t && typeof t.q === "string" && typeof t.a === "string").slice(-ASSISTANT_TURNS_MAX)
        : [],
      ...(p.quota && typeof p.quota.day === "string" && typeof p.quota.used === "number" ? { quota: p.quota } : {}),
    };
  } catch {
    return { ...DEFAULTS, last: [] };
  }
}

export function saveAssistantPrefs(p: AssistantPrefs): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(ASSISTANT_PREFS_KEY, JSON.stringify({ ...p, last: p.last.slice(-ASSISTANT_TURNS_MAX) }));
    return true;
  } catch {
    return false; // hết chỗ — sổ phụ, chỗ gọi tự quyết có báo không
  }
}

/** Nối một lượt hỏi-đáp, cắt còn 10. */
export function pushAssistantTurn(t: AssistantPrefs["last"][number]): void {
  const p = loadAssistantPrefs();
  p.last = [...p.last, t].slice(-ASSISTANT_TURNS_MAX);
  saveAssistantPrefs(p);
}
