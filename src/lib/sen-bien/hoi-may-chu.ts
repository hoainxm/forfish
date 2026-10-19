// SEN BIỂN HỎI MÁY NHÀ — phía máy bà con (ADR 0016, 2026-10-19; đảo luật 17/10 "chỉ chạy trong máy" theo lệnh chủ dự
// án: "nối vô, rồi tạo pipeline để gemma ở local pc biết luồng xử lý riêng cho thuê bao forfish").
//
// THỨ TỰ KHÔNG ĐỔI: luật + n-gram (+ Gemma Android) trong máy trả lời TRƯỚC. Chỉ khi máy KHÔNG ra câu trả lời thật
// (`nenHoiMayChu`) và có sóng mới hỏi `/api/sen-bien/hoi`. Mất sóng / chưa đăng nhập / máy nhà tắt / quá 22 s ⇒ trả
// null, chỗ gọi nói câu cũ của máy — Sen Biển ngoài biển vẫn y như trước, không treo, không báo lỗi kỹ thuật.

import { apiUrl } from "@/lib/api-base";
import { timeoutSignal } from "@/lib/abort";
import { noteResponse, readToken, tokenHeader } from "@/lib/device-token-store";
import type { SenReply } from "@/lib/sen-bien/hieu-y";
import { effectivePremiumMark, readPremiumMark, readTierMarkRaw, readTierUntilRaw } from "@/lib/tier";

/** Hạng theo dấu trong máy (premium còn hạn / thường / chưa biết ⇒ null) — chỉ để Gemma nói đúng gói. */
function hangTrongMay(): "premium" | "thuong" | null {
  try {
    const m = effectivePremiumMark(readPremiumMark(readTierMarkRaw()), readTierUntilRaw(), Date.now());
    return m === "premium" ? "premium" : m === "basic" ? "thuong" : null;
  } catch {
    return null;
  }
}

/** Trần chờ phía máy: route chờ cổng nhà 20 s + đường truyền. */
export const HOI_HAN_MS = 22_000;
/** Câu báo đang hỏi — đọc ngay để bà con biết Sen Biển không đứng hình. */
export const DANG_HOI = "Để Sen Biển hỏi thêm.";

/**
 * Có nên hỏi máy nhà không. CHỈ câu "say" mà máy CHƯA trả lời thật (không `daTraLoi`), câu đủ dài để là câu hỏi
 * (≥ 2 chữ), có chuỗi thiết bị, và trình duyệt không báo mất sóng. Mọi việc khác (đi, dừng, mở lớp, hỏi bản đồ…) do
 * máy làm — máy nhà không bao giờ ra lệnh cho app.
 */
export function nenHoiMayChu(r: SenReply, text: string, coChuoi: boolean, online: boolean): boolean {
  if (r.kind !== "say" || r.daTraLoi) return false;
  if (!coChuoi || !online) return false;
  return (text.trim().match(/\p{L}+/gu) || []).length >= 2;
}

/** Hỏi máy nhà. Trả câu đọc được, hoặc null (mọi lỗi — chỗ gọi tự nói câu của máy). Không bao giờ ném. */
export async function hoiMayChu(text: string, man: string | null, cang: string | null): Promise<{ text: string; speak: string[] } | null> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return null;
  if (!readToken()) return null;
  const hang = hangTrongMay();
  try {
    const r = await fetch(apiUrl("/api/sen-bien/hoi"), {
      method: "POST",
      headers: { "content-type": "application/json", ...tokenHeader() },
      body: JSON.stringify({ text: text.slice(0, 300), ...(man ? { man } : {}), ...(cang ? { cang } : {}), ...(hang ? { hang } : {}) }),
      signal: timeoutSignal(HOI_HAN_MS),
    });
    void noteResponse(r);
    if (!r.ok) return null;
    const j = (await r.json().catch(() => null)) as { ok?: boolean; text?: unknown; speak?: unknown } | null;
    if (!j?.ok || typeof j.text !== "string" || !j.text.trim()) return null;
    const speak = Array.isArray(j.speak) ? j.speak.filter((s): s is string => typeof s === "string" && !!s.trim()) : [];
    return { text: j.text.trim(), speak: speak.length ? speak : [j.text.trim()] };
  } catch {
    return null;
  }
}
