"use client";

// GỌI API CHỢ từ máy khách — bọc `authedFetch` (đã gắn chuỗi + đồng hồ + noteResponse)
// và parse `{ok,…}` về một hình dạng duy nhất. Mọi màn dùng đúng 3 hàm này —
// không `fetch` trần. Thời gian chờ theo 11 §9: đọc 12 s · ghi 20 s · ảnh 60 s.
import { authedFetch } from "@/lib/device-token-store";

export type MarketResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: string;
      /** câu tiếng Việt từ validate (chỉ khi code = invalid) */
      message?: string;
      status: number;
      /** fetch ném (mất sóng / hết giờ) — không có phản hồi nào */
      offline: boolean;
      productIds?: string[];
    };

async function parse<T>(res: Response | null): Promise<MarketResult<T>> {
  if (!res) return { ok: false, code: "offline", status: 0, offline: true };
  const body = (await res.json().catch(() => null)) as
    | ({ ok?: boolean; code?: string; message?: string; productIds?: string[] } & Record<string, unknown>)
    | null;
  if (res.ok && body && body.ok !== false) return { ok: true, data: body as unknown as T };
  return {
    ok: false,
    code: body?.code ?? (res.status >= 500 ? "internal" : "bad_response"),
    message: body?.message,
    status: res.status,
    offline: false,
    productIds: body?.productIds,
  };
}

export async function marketGet<T>(path: string, timeoutMs = 12000): Promise<MarketResult<T>> {
  const { res } = await authedFetch(path, { method: "GET", cache: "no-store" }, timeoutMs);
  return parse<T>(res);
}

export async function marketPost<T>(path: string, body: unknown, timeoutMs = 20000): Promise<MarketResult<T>> {
  const { res } = await authedFetch(
    path,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) },
    timeoutMs,
  );
  return parse<T>(res);
}

/** PATCH/DELETE dùng chung cho seller/admin — cùng khuôn parse. */
export async function marketSend<T>(
  method: "PATCH" | "DELETE" | "PUT",
  path: string,
  body?: unknown,
  timeoutMs = 20000,
): Promise<MarketResult<T>> {
  const { res } = await authedFetch(
    path,
    {
      method,
      ...(body !== undefined ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}),
    },
    timeoutMs,
  );
  return parse<T>(res);
}

/** Tải ảnh (multipart `file`) — 60 s. */
export async function marketUpload(path: string, blob: Blob, timeoutMs = 60000): Promise<MarketResult<{ url: string }>> {
  const fd = new FormData();
  fd.append("file", blob, blob.type === "image/png" ? "anh.png" : blob.type === "image/webp" ? "anh.webp" : "anh.jpg");
  const { res } = await authedFetch(path, { method: "POST", body: fd }, timeoutMs);
  return parse<{ url: string }>(res);
}
