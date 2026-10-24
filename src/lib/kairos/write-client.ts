// KAIROS — PHÍA APP CỦA CÁC NÚT GHI (14 §3.3–§3.10, AC07–AC15). Luật thuần ở social.ts
// (re-export ở đây cho màn import một chỗ; test ở kairos-social.test.ts).
// Phần mạng (`kairosSend`, `kairosUpload`) KHÔNG BAO GIỜ ném: đồng hồ qua authedFetch, mất
// sóng ⇒ `offline:true` (màn nói "cần sóng", giữ chữ trong nháp). KHÔNG gửi ngầm, KHÔNG tự
// gửi lại khi có sóng — bà con bấm lại.

import { authedFetch } from "@/lib/device-token-store";
import { draftSlot, KAIROS_DRAFT_KEY, parseDrafts, putDraft } from "./cache";
import type { SendResult } from "./social";

export * from "./social";

/** Đồng hồ ghi (11 §9: ghi 20 s · ảnh 60 s). */
export const WRITE_TIMEOUT_MS = 20_000;
export const UPLOAD_TIMEOUT_MS = 60_000;
export const READ_TIMEOUT_MS = 12_000;

const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;
const OFFLINE = { ok: false as const, code: "offline", status: 0, offline: true, extra: {} };

async function parse<T>(res: Response | null): Promise<SendResult<T>> {
  if (!res) return OFFLINE;
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (res.ok && body && body.ok !== false) return { ok: true, data: body as T };
  const { ok: _ok, code, ...extra } = body ?? {};
  void _ok;
  return {
    ok: false,
    code: typeof code === "string" ? code : res.status >= 500 ? "internal" : "bad_response",
    status: res.status,
    offline: false,
    extra,
  };
}

/** Gọi một route Kairos (đọc hoặc ghi). KHÔNG ném. */
export async function kairosSend<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  timeoutMs = method === "GET" ? READ_TIMEOUT_MS : WRITE_TIMEOUT_MS,
): Promise<SendResult<T>> {
  if (isOffline()) return OFFLINE;
  const init: RequestInit =
    body === undefined
      ? { method, cache: "no-store" }
      : { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store" };
  try {
    const { res } = await authedFetch(path, init, timeoutMs);
    return await parse<T>(res);
  } catch {
    return OFFLINE;
  }
}

/** Tải MỘT ảnh đã nén lên kho kairos-media (multipart `file`). KHÔNG ném. */
export async function kairosUpload(blob: Blob): Promise<SendResult<{ path: string; url: string }>> {
  if (isOffline()) return OFFLINE;
  const fd = new FormData();
  fd.append("file", blob, blob.type === "image/png" ? "anh.png" : blob.type === "image/webp" ? "anh.webp" : "anh.jpg");
  try {
    const { res } = await authedFetch("/api/kairos/upload", { method: "POST", body: fd }, UPLOAD_TIMEOUT_MS);
    return await parse<{ path: string; url: string }>(res);
  } catch {
    return OFFLINE;
  }
}

// ── Nháp chữ (forfish.kairos.nhap.v1) ───────────────────────────────────

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Nháp của người đang dùng máy (`phone` = SĐT đăng nhập, null = khách). */
export function loadDraft(phone: string | null, key: string): string {
  try {
    return parseDrafts(storage()?.getItem(KAIROS_DRAFT_KEY))[draftSlot(phone, key)]?.text ?? "";
  } catch {
    return "";
  }
}

/**
 * Ghi/xoá một nháp (chữ rỗng ⇒ xoá). Trả false khi máy không ghi được — màn báo "Máy đầy,
 * nháp chưa lưu" thay vì im lặng (CLAUDE.md nguyên tắc 4: nuốt lỗi là mất chữ của bà con).
 */
export function saveDraft(phone: string | null, key: string, text: string, now = Date.now()): boolean {
  const s = storage();
  if (!s) return false;
  try {
    s.setItem(KAIROS_DRAFT_KEY, JSON.stringify(putDraft(parseDrafts(s.getItem(KAIROS_DRAFT_KEY)), draftSlot(phone, key), text, now)));
    return true;
  } catch {
    return false;
  }
}
