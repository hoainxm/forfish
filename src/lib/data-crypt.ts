// GIẢI MÃ SDF2 PHÍA MÁY KHÁCH — AES-256-CTR bằng WebCrypto (có sẵn, Safari 11+),
// rồi gunzip (DecompressionStream, máy cũ rơi về lib/inflate.mjs). Thuần + async;
// test chạy ở Node 20 (globalThis.crypto.subtle). Định dạng: xem data-codec.mjs.

import {
  AES_BLOCK,
  DATA_HEADER2_LEN,
  counterAt,
  parseHeader2,
} from "@/lib/data-codec.mjs";
import { gunzip as gunzipFallback } from "@/lib/inflate.mjs";

/** Lấy hàm giải khoá theo id — bơm từ ngoài để test không cần mạng. */
export type KeyLookup = (keyId: string) => Promise<CryptoKey | null>;

const subtle = (): SubtleCrypto => {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error("no_webcrypto");
  return s;
};

/** Khoá thô 32 byte → CryptoKey AES-CTR chỉ để giải. */
export function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
  if (raw.length !== 32) return Promise.reject(new Error("key phải 32 byte"));
  return subtle().importKey("raw", raw.slice().buffer as ArrayBuffer, { name: "AES-CTR" }, false, ["decrypt"]);
}

/** key id = 8 byte đầu SHA-256(khoá), hex 16 ký tự — cùng công thức với script build. */
export async function keyIdOf(raw: Uint8Array): Promise<string> {
  const d = new Uint8Array(await subtle().digest("SHA-256", raw.slice().buffer as ArrayBuffer));
  let s = "";
  for (let i = 0; i < 8; i++) s += (d[i] < 16 ? "0" : "") + d[i].toString(16);
  return s;
}

/**
 * Giải một đoạn thân mã bắt đầu ở `payloadOffset` (tính từ byte 0 của THÂN, sau
 * header). CTR cho phép nhảy thẳng tới khối chứa offset; phần lẻ trước offset
 * được độn 0 rồi cắt bỏ.
 */
export async function aesCtrDecryptAt(
  key: CryptoKey,
  nonce: Uint8Array,
  cipher: Uint8Array,
  payloadOffset: number,
): Promise<Uint8Array> {
  const lead = payloadOffset % AES_BLOCK;
  const block = (payloadOffset - lead) / AES_BLOCK;
  const input = new Uint8Array(lead + cipher.length);
  input.set(cipher, lead);
  const out = await subtle().decrypt(
    { name: "AES-CTR", counter: counterAt(nonce, block).buffer as ArrayBuffer, length: 64 },
    key,
    input.buffer as ArrayBuffer,
  );
  return new Uint8Array(out).subarray(lead);
}

/** gunzip: đường chính DecompressionStream, máy cũ rơi về inflate thuần. */
export async function gunzipBytes(u8: Uint8Array, opts?: { native?: boolean }): Promise<Uint8Array> {
  const native = opts?.native ?? typeof globalThis.DecompressionStream === "function";
  if (native) {
    try {
      const ds = new globalThis.DecompressionStream("gzip");
      const stream = new Blob([u8.slice().buffer as ArrayBuffer]).stream().pipeThrough(ds);
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch {
      /* trình duyệt nói có mà chạy hỏng (đã gặp với API mới) → đường lùi */
    }
  }
  return gunzipFallback(u8);
}

/**
 * Trọn file SDF2 → bản rõ. Không có khoá ⇒ ném Error("no_key") để chỗ gọi xoá
 * đệm và thử lại khi có sóng (khoá về theo `/api/data-key`).
 */
export async function decryptFile(u8: Uint8Array, getKey: KeyLookup): Promise<Uint8Array> {
  const h = parseHeader2(u8);
  if (!h) throw new Error("not_sdf2");
  const key = await getKey(h.keyId);
  if (!key) throw new Error("no_key");
  const body = await aesCtrDecryptAt(key, h.nonce, u8.subarray(DATA_HEADER2_LEN), 0);
  return h.gzip ? gunzipBytes(body) : body;
}
