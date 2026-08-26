"use client";

// ẢNH GIẤY TỜ (P3) — nén phía client rồi tải lên Storage qua route service-role.
// Xem docs/specs/dong-bo-so-per-may.md §3b + §5. document.photos[] giữ ĐƯỜNG DẪN,
// đồng bộ nhẹ qua user_docs (P2). Bytes ở bucket private, đọc bằng signed URL.
//
// v1: cần CÓ SÓNG để thêm/xem ảnh. Chụp offline chặn kèm thông báo (nợ: hàng đợi
// IndexedDB đẩy sau — ảnh giấy tờ thường chụp ở cảng có sóng).

import { authedFetch } from "@/lib/device-token-store";

const MAX_DIM = 1600; // cạnh dài tối đa (px)
const TARGET_BYTES = 1.8 * 1024 * 1024; // dưới trần 2MB của server

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("no_blob"))),
      "image/jpeg",
      quality,
    );
  });
}

/** Nén ảnh: resize cạnh dài ≤1600px → JPEG, hạ chất lượng tới khi ≤~1.8MB. */
export async function compressImage(file: File): Promise<Blob> {
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
  const { res } = await authedFetch(
    "/api/me/docs/photo",
    { method: "POST", body: form },
    30000,
  );
  if (!res || !res.ok) return null;
  const j = (await res.json().catch(() => null)) as { path?: string } | null;
  return j?.path ?? null;
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

/** Xoá 1 ảnh khỏi Storage. Trả true nếu xoá được. */
export async function deleteDocPhoto(path: string): Promise<boolean> {
  const { res } = await authedFetch(
    `/api/me/docs/photo?path=${encodeURIComponent(path)}`,
    { method: "DELETE" },
  );
  return !!res && res.ok;
}
