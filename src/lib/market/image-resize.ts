"use client";

// NÉN ẢNH SẢN PHẨM trước khi tải lên (12 §8.1 ImagePicker): canvas cạnh dài
// ≤ 1024, JPEG 0.8, lặp hạ chất lượng tới ≤ 400 KB. KHÔNG dùng `compressImage`
// của doc-photos.ts vì ngưỡng khác (1600 / 1,8 MB). Không nén được (WebView
// cũ, ảnh hỏng) ⇒ ném — ImagePicker hiện thẻ đỏ + Thử lại cho đúng ảnh đó.
import { IMAGE_MAX_BYTES } from "./validate";

export const MARKET_IMAGE_MAX_EDGE = 1024;

function loadBitmap(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Không đọc được ảnh"));
    };
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Không nén được ảnh"))), "image/jpeg", quality);
  });
}

/**
 * Trả JPEG ≤ 400 KB (IMAGE_MAX_BYTES). Ảnh đã nhỏ hơn trần và là jpeg/png/webp
 * thì trả nguyên (không nén lại cho mất nét).
 */
export async function resizeForMarket(file: Blob, maxBytes = IMAGE_MAX_BYTES): Promise<Blob> {
  if (file.size <= maxBytes && ["image/jpeg", "image/png", "image/webp"].includes(file.type)) return file;
  const img = await loadBitmap(file);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error("Ảnh rỗng");
  const scale = Math.min(1, MARKET_IMAGE_MAX_EDGE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Máy không vẽ được ảnh");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  let quality = 0.8;
  let out = await toBlob(canvas, quality);
  while (out.size > maxBytes && quality > 0.3) {
    quality -= 0.1;
    out = await toBlob(canvas, quality);
  }
  if (out.size > maxBytes) throw new Error("Ảnh quá lớn, chụp lại gần hơn");
  return out;
}
