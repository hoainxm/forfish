// KAIROS — KHO ẢNH CỦA BÀI ĐÃ LƯU (Cache Storage `kairos-luu-anh-v1`, 14 §18). Phía trình duyệt.
//
// · Ảnh kho kairos-media (Supabase, mở CORS) ⇒ tải `cors`, đo cỡ thật.
// · Ảnh bìa bài báo (máy chủ báo, thường KHÔNG mở CORS) ⇒ lùi về `no-cors` = phản hồi "mờ": cất được, thẻ
//   <img> hiện được (sw.js phục vụ từ kho này), nhưng không đọc được cỡ ⇒ tính khoán `ANH_MO_BYTES`.
// · Mỗi ảnh có đồng hồ; hỏng ảnh nào chỉ thiếu ảnh đó — KHÔNG BAO GIỜ ném.
// · Trang KHÔNG tự hiện ảnh từ kho: thẻ bài giữ URL gốc, sw.js (nhánh ảnh khác origin) tra kho này trước,
//   trượt mới ra mạng. Kho này được sw.js GIỮ qua `activate` (bump vỏ không xoá).

import { timeoutSignal } from "@/lib/abort";
import { ANH_MO_BYTES, LUU_ANH_CACHE, type AnhLuu } from "./luu-bai";

/** Đồng hồ một ảnh (ảnh nén sẵn ≤512 KB; ảnh bìa báo có thể lớn hơn). */
export const ANH_TIMEOUT_MS = 15_000;

const hasCaches = () => typeof caches !== "undefined";

async function cachedSize(r: Response): Promise<number> {
  if (r.type === "opaque") return ANH_MO_BYTES;
  try {
    return (await r.clone().blob()).size;
  } catch {
    return ANH_MO_BYTES;
  }
}

async function fetchAnh(url: string): Promise<{ res: Response; bytes: number } | null> {
  try {
    const r = await fetch(url, { mode: "cors", credentials: "omit", signal: timeoutSignal(ANH_TIMEOUT_MS) });
    if (r.ok) {
      const blob = await r.blob();
      const res = new Response(blob, { status: 200, headers: { "content-type": r.headers.get("content-type") || blob.type || "image/jpeg" } });
      return { res, bytes: blob.size };
    }
    // 4xx/5xx thật từ máy chủ ⇒ ảnh không còn, khỏi thử kiểu mờ
    return null;
  } catch {
    /* CORS chặn hoặc mạng hỏng ⇒ thử kiểu mờ */
  }
  try {
    const r = await fetch(url, { mode: "no-cors", credentials: "omit", referrerPolicy: "no-referrer", signal: timeoutSignal(ANH_TIMEOUT_MS) });
    // phản hồi mờ không có mã trạng thái — chỉ biết là "về tới"
    return r.type === "opaque" || r.ok ? { res: r, bytes: r.type === "opaque" ? ANH_MO_BYTES : await cachedSize(r) } : null;
  } catch {
    return null;
  }
}

export interface AnhDaLay {
  url: string;
  bytes: number;
  /** null = đã nằm sẵn trong kho (bài khác cùng ảnh) — khỏi ghi lại */
  res: Response | null;
}

/** Lấy ảnh vào bộ nhớ (chưa ghi kho) để đo trước khi quyết. Ảnh đã có trong kho ⇒ dùng lại, không tải. */
export async function layAnh(urls: readonly string[]): Promise<{ lay: AnhDaLay[]; thieu: number }> {
  if (!hasCaches() || !urls.length) return { lay: [], thieu: urls.length };
  let kho: Cache | null = null;
  try {
    kho = await caches.open(LUU_ANH_CACHE);
  } catch {
    return { lay: [], thieu: urls.length };
  }
  const out = await Promise.all(
    urls.map(async (url): Promise<AnhDaLay | null> => {
      try {
        const hit = await kho!.match(url, { ignoreVary: true });
        if (hit) return { url, bytes: await cachedSize(hit), res: null };
      } catch {
        /* tra kho hỏng ⇒ tải */
      }
      const f = await fetchAnh(url);
      return f ? { url, bytes: f.bytes, res: f.res } : null;
    }),
  );
  const lay = out.filter((x): x is AnhDaLay => !!x);
  return { lay, thieu: urls.length - lay.length };
}

/** Ghi ảnh vừa lấy vào kho. Trả ảnh đã nằm trong kho (ghi hỏng ảnh nào thì bỏ ảnh đó). */
export async function catAnh(items: readonly AnhDaLay[]): Promise<AnhLuu[]> {
  if (!hasCaches() || !items.length) return [];
  try {
    const kho = await caches.open(LUU_ANH_CACHE);
    const ok = await Promise.all(
      items.map(async (it) => {
        if (!it.res) return { url: it.url, bytes: it.bytes };
        try {
          await kho.put(it.url, it.res);
          return { url: it.url, bytes: it.bytes };
        } catch {
          return null; // đầy bộ nhớ ⇒ thiếu ảnh này, chữ vẫn lưu
        }
      }),
    );
    return ok.filter((x): x is AnhLuu => !!x);
  } catch {
    return [];
  }
}

/** Xoá ảnh khỏi kho (bỏ lưu / đăng xuất). KHÔNG ném. */
export async function xoaAnh(urls: readonly string[]): Promise<void> {
  if (!hasCaches() || !urls.length) return;
  try {
    const kho = await caches.open(LUU_ANH_CACHE);
    await Promise.all(urls.map((u) => kho.delete(u).catch(() => false)));
  } catch {
    /* kho không mở được — ảnh mồ côi chỉ tốn chỗ, không lộ gì (URL công khai) */
  }
}
