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

/** Trần chờ phía máy: route chờ máy nhà 5 s + đường truyền — quá là Sen Biển nói câu của máy, bà con không phải chờ. */
export const HOI_HAN_MS = 6_000;
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
export type DapMayNha = { text: string; speak: string[]; amThanh: string | null };

export async function hoiMayChu(text: string, man: string | null, cang: string | null): Promise<DapMayNha | null> {
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
    const j = (await r.json().catch(() => null)) as { ok?: boolean; text?: unknown; speak?: unknown; am_thanh?: unknown } | null;
    if (!j?.ok || typeof j.text !== "string" || !j.text.trim()) return null;
    const speak = Array.isArray(j.speak) ? j.speak.filter((s): s is string => typeof s === "string" && !!s.trim()) : [];
    const amThanh = typeof j.am_thanh === "string" && /^[A-Za-z0-9+/]+=*$/.test(j.am_thanh) ? j.am_thanh : null;
    return { text: j.text.trim(), speak: speak.length ? speak : [j.text.trim()], amThanh };
  } catch {
    return null;
  }
}

/** Trần chờ mp3 một câu từ máy nhà (route chờ 8 s) — quá thì tts đọc câu đó giọng máy. */
export const DOC_HAN_MS = 9_000;

/** base64 mp3 ⇒ blob: url (thu hồi sau 3 phút — đủ phát xong). Hỏng ⇒ null. */
function urlMp3(b64: string | null): string | null {
  if (!b64 || typeof URL === "undefined" || !URL.createObjectURL) return null;
  try {
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([u8], { type: "audio/mpeg" }));
    setTimeout(() => URL.revokeObjectURL(url), 180_000);
    return url;
  } catch {
    return null;
  }
}

/** Xin mp3 Mỹ Duyên của MỘT câu (/api/sen-bien/doc). Lỗi gì cũng null — câu đó đọc giọng máy. */
async function xinMp3(cau: string): Promise<string | null> {
  try {
    const r = await fetch(apiUrl("/api/sen-bien/doc"), {
      method: "POST",
      headers: { "content-type": "application/json", ...tokenHeader() },
      body: JSON.stringify({ text: cau.slice(0, 200) }),
      signal: timeoutSignal(DOC_HAN_MS),
    });
    void noteResponse(r);
    if (!r.ok || !/^audio\/mpeg\b/.test(r.headers.get("content-type") || "")) return null;
    const url = URL.createObjectURL(await r.blob());
    setTimeout(() => URL.revokeObjectURL(url), 180_000);
    return url;
  } catch {
    return null;
  }
}

/**
 * Các đoạn để đọc câu máy nhà bằng giọng Mỹ Duyên (`ttsSpeakMp3`): câu đầu = mp3 gửi kèm (không có thì xin);
 * câu sau xin NGAY, SONG SONG — tải trong lúc câu đầu đang phát, nối không chờ.
 */
export function doanMayNha(dap: DapMayNha): { text: string; mp3: Promise<string | null> }[] {
  return dap.speak.map((cau, i) => {
    const san = i === 0 ? urlMp3(dap.amThanh) : null;
    return { text: cau, mp3: san ? Promise.resolve(san) : xinMp3(cau) };
  });
}
