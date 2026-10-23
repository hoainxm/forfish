// SEN BIỂN HỎI MÁY NHÀ — phía máy bà con (ADR 0016, 2026-10-19; đảo luật 17/10 "chỉ chạy trong máy" theo lệnh chủ dự
// án: "nối vô, rồi tạo pipeline để gemma ở local pc biết luồng xử lý riêng cho thuê bao forfish").
//
// THỨ TỰ KHÔNG ĐỔI: luật + n-gram (+ Gemma Android) trong máy trả lời TRƯỚC. Chỉ khi máy KHÔNG ra câu trả lời thật
// (`luong-tra-loi.chonBuoc`) và có sóng mới hỏi `/api/sen-bien/hoi`. Mất sóng / chưa đăng nhập / máy nhà tắt / quá 22 s ⇒ trả
// null, chỗ gọi nói câu cũ của máy — Sen Biển ngoài biển vẫn y như trước, không treo, không báo lỗi kỹ thuật.

import { apiUrl } from "@/lib/api-base";
import { timeoutSignal } from "@/lib/abort";
import { noteResponse, readToken, tokenHeader } from "@/lib/device-token-store";
import type { LyDoTruot } from "@/lib/sen-bien/luong-tra-loi";
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

/** Trần chờ phía máy: route chờ máy nhà 9 s + đường truyền. Đo 2026-10-23 trọn đường (tài khoản test, máy nhà nóng):
 *  máy nhà 0,6–0,7 s nhưng cả lượt 3,0–6,5 s (Vercel khởi động lạnh + kiểm danh tính + máy nhà đọc mp3) — trần cũ 6 s
 *  cắt đúng lượt đầu sau lúc nghỉ. Trong lúc chờ có câu giờ ba nhịp (cau-vui.henCauGio), bà con không ngồi im. */
export const HOI_HAN_MS = 12_000;

/** Hỏi máy nhà. Trả câu đọc được, hoặc `{ loi }` (mọi lỗi kèm lý do). Không bao giờ ném. */
export type DapMayNha = { text: string; speak: string[]; amThanh: string | null };

/** Kết quả một lượt hỏi: câu đọc được, hoặc LÝ DO trượt để chỗ gọi nói đúng (luong-tra-loi.cauTruot). */
export type KqMayNha = DapMayNha | { loi: LyDoTruot };

export async function hoiMayChu(text: string, man: string | null, cang: string | null): Promise<KqMayNha> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { loi: "mat_song" };
  if (!readToken()) return { loi: "chua_dang_nhap" };
  const hang = hangTrongMay();
  try {
    const r = await fetch(apiUrl("/api/sen-bien/hoi"), {
      method: "POST",
      headers: { "content-type": "application/json", ...tokenHeader() },
      body: JSON.stringify({ text: text.slice(0, 300), ...(man ? { man } : {}), ...(cang ? { cang } : {}), ...(hang ? { hang } : {}) }),
      signal: timeoutSignal(HOI_HAN_MS),
    });
    void noteResponse(r);
    if (r.status === 401) return { loi: "chua_dang_nhap" };
    if (r.status === 504) return { loi: "het_gio" };
    if (!r.ok) return { loi: "may_nha" };
    const j = (await r.json().catch(() => null)) as { ok?: boolean; text?: unknown; speak?: unknown; am_thanh?: unknown } | null;
    if (!j?.ok || typeof j.text !== "string" || !j.text.trim()) return { loi: "may_nha" };
    const speak = Array.isArray(j.speak) ? j.speak.filter((s): s is string => typeof s === "string" && !!s.trim()) : [];
    const amThanh = typeof j.am_thanh === "string" && /^[A-Za-z0-9+/]+=*$/.test(j.am_thanh) ? j.am_thanh : null;
    return { text: j.text.trim(), speak: speak.length ? speak : [j.text.trim()], amThanh };
  } catch (e) {
    const het = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    if (het) return { loi: "het_gio" };
    // fetch ném khi rớt mạng giữa chừng (navigator.onLine vẫn báo có) ⇒ coi như mất sóng
    return { loi: "mat_song" };
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
