"use client";

// ẢNH GIẤY TỜ (P3) — nén phía client rồi tải lên Storage qua route service-role.
// Xem docs/specs/dong-bo-so-per-may.md §3b + §5. document.photos[] giữ ĐƯỜNG DẪN,
// đồng bộ nhẹ qua user_docs (P2). Bytes ở bucket private, đọc bằng signed URL.
//
// v1: cần CÓ SÓNG để thêm ảnh. Chụp offline chặn kèm thông báo (nợ: hàng đợi
// IndexedDB đẩy sau — ảnh giấy tờ thường chụp ở cảng có sóng).
// 2026-10-26 (ADR 0017): XEM thì không cần sóng nữa — bytes ảnh vừa tải lên / vừa
// xem được cất vào kho IndexedDB (lib/giay-anh-kho) để màn Xuất trình mở cho cán bộ
// ngoài biển. `docAnhGiayUrl` = một cửa đọc: kho trước, mạng sau.

import { authedFetch } from "@/lib/device-token-store";
import { timeoutSignal } from "@/lib/abort";
import { catAnhGiay, coAnhGiay, layAnhGiay, xoaAnhGiay } from "@/lib/giay-anh-kho";

const MAX_DIM_LUU = 1600; // cạnh dài tối đa (px) — ảnh LƯU để xuất trình
const TARGET_BYTES_LUU = 1.8 * 1024 * 1024; // dưới trần 2MB của server

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("no_blob"))),
      "image/jpeg",
      quality,
    );
  });
}

/** Nén ảnh: resize cạnh dài ≤`maxDim` (mặc định 1600px) → JPEG, hạ chất lượng tới khi ≤`targetBytes` (~1.8MB).
 *  Ảnh gửi đi ĐỌC dùng cỡ nhỏ hơn (doc-giay ANH_DOC_GIAY) — 2026-10-26: gửi 1,8 MB hai lần trên sóng lên yếu là lý do
 *  điện thoại quá giờ dù máy nhà đã đọc xong. */
export async function compressImage(
  file: Blob,
  opts: { maxDim?: number; targetBytes?: number } = {},
): Promise<Blob> {
  const MAX_DIM = opts.maxDim ?? MAX_DIM_LUU;
  const TARGET_BYTES = opts.targetBytes ?? TARGET_BYTES_LUU;
  const bitmap = await createImageBitmap(file);
  let width = bitmap.width;
  let height = bitmap.height;
  const longest = Math.max(width, height);
  if (longest > MAX_DIM) {
    const scale = MAX_DIM / longest;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    throw new Error("no_canvas");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  let quality = 0.82;
  let blob = await canvasToBlob(canvas, quality);
  while (blob.size > TARGET_BYTES && quality > 0.4) {
    quality -= 0.12;
    blob = await canvasToBlob(canvas, quality);
  }
  return blob;
}

/** Tải 1 ảnh (đã nén) lên. Trả PATH server, hoặc null nếu mất sóng/lỗi. */
export async function uploadDocPhoto(
  docId: string,
  blob: Blob,
): Promise<string | null> {
  const form = new FormData();
  form.append("docId", docId);
  form.append("file", blob, "photo.jpg");
  // KHÔNG set Content-Type — trình duyệt tự gắn boundary multipart.
  // 90 s (trước 30 s): chiều ĐẨY LÊN trên sóng di động yếu chậm hơn tải về nhiều — 1,8 MB có thể mất cả phút
  const { res } = await authedFetch(
    "/api/me/docs/photo",
    { method: "POST", body: form },
    90000,
  );
  if (!res || !res.ok) return null;
  const j = (await res.json().catch(() => null)) as { path?: string } | null;
  if (!j?.path) return null;
  await catAnhGiay(j.path, blob); // kho trong máy — hỏng thì thôi, ảnh vẫn ở Storage
  return j.path;
}

/** Ảnh lấy về Storage ≤ ngần này ms (1,8 MB, sóng 3G yếu) — lâu hơn thì rơi về signed URL cho <img> tự tải. */
const TAI_ANH_MS = 20_000;

/**
 * URL để <img> hiện một ảnh giấy tờ — ĐỌC KHO TRONG MÁY TRƯỚC (mất sóng vẫn xem), không có mới xin signed URL;
 * có signed URL thì tải bytes về cất kho cho lần sau. `trongMay` = đang hiện từ kho. Null = không có kho lẫn mạng.
 * URL `blob:` do chỗ gọi `URL.revokeObjectURL` khi gỡ.
 */
export async function docAnhGiayUrl(path: string): Promise<{ url: string; trongMay: boolean } | null> {
  const kho = await layAnhGiay(path);
  if (kho) return { url: URL.createObjectURL(kho), trongMay: true };
  const signed = await docPhotoUrl(path);
  if (!signed) return null;
  try {
    const r = await fetch(signed, { signal: timeoutSignal(TAI_ANH_MS) });
    if (r.ok) {
      const blob = await r.blob();
      if (blob.size) {
        await catAnhGiay(path, blob);
        return { url: URL.createObjectURL(blob), trongMay: false };
      }
    }
  } catch {
    /* CORS/mạng — <img> tự tải bằng signed URL như trước */
  }
  return { url: signed, trongMay: false };
}

/** Lấy signed URL hiển thị 1 ảnh. Null nếu mất sóng / không có. */
export async function docPhotoUrl(path: string): Promise<string | null> {
  const { res } = await authedFetch(
    `/api/me/docs/photo?path=${encodeURIComponent(path)}`,
    { method: "GET" },
  );
  if (!res || !res.ok) return null;
  const j = (await res.json().catch(() => null)) as { url?: string } | null;
  return j?.url ?? null;
}

/**
 * CẤT SẴN ảnh giấy tờ vào kho trong máy (rà UI 2026-10-26): trước đây ảnh chỉ vào kho khi tải lên TRÊN MÁY NÀY hoặc
 * khi từng mở xem ⇒ giấy đồng bộ từ máy khác, hay giấy chưa từng bấm vào, ra biển mở Xuất trình là trống — đúng lúc
 * cán bộ hỏi. Tủ giấy tờ gọi hàm này mỗi lần mở lúc CÓ SÓNG: ảnh nào chưa có trong kho thì tải về cất, LẦN LƯỢT (không
 * dồn băng thông), dừng ngay khi mất sóng / bị huỷ. Không ném; trả số ảnh vừa cất.
 */
export async function luuSanAnhGiay(paths: readonly string[], huy?: AbortSignal): Promise<number> {
  let n = 0;
  for (const p of paths) {
    if (huy?.aborted) break;
    if (typeof navigator !== "undefined" && navigator.onLine === false) break;
    if (await coAnhGiay(p)) continue;
    const r = await docAnhGiayUrl(p);
    if (r?.url.startsWith("blob:")) {
      URL.revokeObjectURL(r.url);
      n++;
    }
  }
  return n;
}

/** Xoá 1 ảnh khỏi Storage. Trả true nếu xoá được. */
export async function deleteDocPhoto(path: string): Promise<boolean> {
  void xoaAnhGiay(path); // kho trong máy — gỡ là gỡ, không chờ Storage
  const { res } = await authedFetch(
    `/api/me/docs/photo?path=${encodeURIComponent(path)}`,
    { method: "DELETE" },
  );
  return !!res && res.ok;
}
