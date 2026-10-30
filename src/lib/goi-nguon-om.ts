import { AsyncLocalStorage } from "node:async_hooks";

/**
 * GÓI NGUỒN OPEN-METEO TỪ MÁY NHÀ (2026-10-30). Lượt cron trên Vercel bắn song song các lưới lớn nên dính
 * 429 "Minutely API request limit exceeded" (khung 16 ngày hỏng liên tục) và hàm chỉ sống 60 s, không chờ
 * qua phút được. Nên máy nhà (gpu-desktop,
 * scripts/thoi-tiet-thu.mjs) tải sẵn đúng các URL mà lượt làm mới sẽ gọi rồi gửi lên /api/thoi-tiet/nhap.
 *
 * Ở đây chỉ có một lớp bọc fetch toàn cục, sống theo AsyncLocalStorage nên không lẫn giữa các request
 * chạy chung một máy chủ:
 *  · chế độ "ghi": URL Open-Meteo được ghi lại và trả 503 ngay (để lập danh sách URL cho máy nhà);
 *  · chế độ "goi": URL có trong gói ⇒ trả thân đã tải; không có ⇒ gọi mạng như thường (đếm `truot`).
 * Ngoài hai chế độ đó, và mọi URL không phải Open-Meteo (Supabase, Copernicus…), fetch chạy y như cũ.
 */

type Kho =
  | { kieu: "ghi"; urls: Set<string> }
  | { kieu: "goi"; goi: Map<string, string>; trung: number; truot: number };

const als = new AsyncLocalStorage<Kho>();
let daCai = false;

export function laUrlOM(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname === "open-meteo.com" || u.hostname.endsWith(".open-meteo.com"));
  } catch {
    return false;
  }
}

function urlCua(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function caiBocFetch() {
  if (daCai) return;
  daCai = true;
  const goc = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const kho = als.getStore();
    if (kho) {
      const url = urlCua(input);
      if (laUrlOM(url)) {
        if (kho.kieu === "ghi") {
          kho.urls.add(url);
          return new Response("", { status: 503 });
        }
        const than = kho.goi.get(url);
        if (than != null) {
          kho.trung++;
          return new Response(than, { status: 200, headers: { "content-type": "application/json" } });
        }
        kho.truot++;
      }
    }
    return goc(input, init);
  }) as typeof fetch;
}

/** Chạy `fn` và trả mọi URL Open-Meteo nó gọi (không ra mạng cho các URL đó). */
export async function ghiUrlOM(fn: () => Promise<unknown>): Promise<string[]> {
  caiBocFetch();
  const kho: Kho = { kieu: "ghi", urls: new Set() };
  await als.run(kho, async () => {
    try {
      await fn();
    } catch {
      /* lỗi do 503 giả là bình thường */
    }
  });
  return [...kho.urls];
}

/** Chạy `fn` với gói nguồn đã tải sẵn. `trung` = lượt lấy từ gói, `truot` = lượt phải gọi mạng. */
export async function chayVoiGoiOM<T>(
  goi: Map<string, string>,
  fn: () => Promise<T>,
): Promise<{ kq: T; trung: number; truot: number }> {
  caiBocFetch();
  const kho = { kieu: "goi" as const, goi, trung: 0, truot: 0 };
  const kq = await als.run(kho, fn);
  return { kq, trung: kho.trung, truot: kho.truot };
}

/** Kiểm thân gửi lên: { goi: { [url Open-Meteo]: chuỗi JSON } }. Hỏng ⇒ null. */
export function docGoiOM(body: unknown, tranSoUrl = 400): Map<string, string> | null {
  if (!body || typeof body !== "object") return null;
  const goi = (body as { goi?: unknown }).goi;
  if (!goi || typeof goi !== "object" || Array.isArray(goi)) return null;
  const out = new Map<string, string>();
  for (const [url, than] of Object.entries(goi as Record<string, unknown>)) {
    if (!laUrlOM(url) || typeof than !== "string" || than.length === 0) return null;
    out.set(url, than);
    if (out.size > tranSoUrl) return null;
  }
  return out.size > 0 ? out : null;
}
