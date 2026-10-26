// TẢI CÓ NHỊP — canh "dữ liệu còn chảy không", thay cho đồng hồ TỔNG (2026-10-26).
//
// VÌ SAO (anh Long 26/10, ảnh chụp 16:06 có 5G: "các màn khác cũng toàn bị ko có sóng ko down đc ko kết nối đc ???
// trong khi vẫn online"): mọi chỗ tải gắn `timeoutSignal(N)` vào `fetch` ⇒ đồng hồ đếm CẢ lúc đang đọc thân file.
// File 8 MB (depth-grid, chat-day…) trên mạng di động 3 Mbps cần ~21 s — trần 20 s cắt ngang khi dữ liệu VẪN ĐANG VỀ
// đều, rồi màn nói "mất sóng / chưa tải được". Đo cùng ngày: máy nhà trả kết quả đọc giấy lúc 16:05:18 mà điện thoại
// vẫn báo mất sóng — chậm, không phải mất.
//
// Luật mới: chỉ huỷ khi dữ liệu NGỪNG CHẢY quá `ngungMs` — chờ phản hồi đầu quá `ngungMs`, hoặc giữa hai gói quá
// `ngungMs`. Chậm mà đều ⇒ tải tới xong. Treo thật ("sóng sống mà chết") ⇒ vẫn cắt đúng hạn như cũ, không treo màn.
// Tín hiệu ngoài (`outer` — MapLibre gỡ nguồn, bà con rời màn) huỷ ngay. KHÔNG bao giờ để promise treo.

export type KetQuaTai = { res: Response; body: Uint8Array };

/** Lỗi do NGỪNG CHẢY (khác lỗi mạng thật) — chỗ gọi muốn phân biệt thì xét `name`. */
export class NgungChayError extends Error {
  constructor(ms: number) {
    super(`du lieu ngung chay qua ${ms} ms`);
    this.name = "NgungChayError";
  }
}

/**
 * Bộ canh nhịp: `nhip()` mỗi lần có dữ liệu, im quá `ms` ⇒ huỷ `signal`. `xong()` gỡ đồng hồ. Thuần (setTimeout),
 * test được bằng đồng hồ giả.
 */
export function boCanhNhip(ms: number, outer?: AbortSignal) {
  const c = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let ngung = false;
  const huy = () => {
    try {
      c.abort();
    } catch {
      /* bỏ qua */
    }
  };
  const nhip = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      ngung = true;
      huy();
    }, ms);
    (timer as unknown as { unref?: () => void }).unref?.();
  };
  const xong = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    outer?.removeEventListener("abort", huy);
  };
  if (outer) {
    if (outer.aborted) huy();
    else outer.addEventListener("abort", huy, { once: true });
  }
  nhip();
  return { signal: c.signal, nhip, xong, daNgung: () => ngung };
}

/** Đọc thân theo từng gói, mỗi gói là một nhịp. Không có stream (WebView cũ, phản hồi giả trong test) ⇒ đọc một lần
 *  bằng cách có sẵn (arrayBuffer → text → json), đồng hồ vẫn canh; không có cách nào ⇒ thân rỗng (chỗ gọi xét `ok`). */
async function docThan(res: Response, nhip: () => void): Promise<Uint8Array> {
  const reader = res.body?.getReader?.();
  if (!reader) {
    const r = res as Partial<Response>;
    if (typeof r.arrayBuffer === "function") return new Uint8Array(await r.arrayBuffer.call(res));
    if (typeof r.text === "function") return new TextEncoder().encode(await r.text.call(res));
    if (typeof r.json === "function") return new TextEncoder().encode(JSON.stringify(await r.json.call(res)));
    return new Uint8Array(0);
  }
  const parts: Uint8Array[] = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value && value.byteLength) {
      parts.push(value);
      n += value.byteLength;
      nhip();
    }
  }
  if (parts.length === 1) return parts[0];
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.byteLength;
  }
  return out;
}

/**
 * `fetch` + đọc trọn thân, huỷ CHỈ khi dữ liệu ngừng chảy quá `ngungMs` (hoặc `outer` huỷ). Ném như `fetch` khi lỗi
 * mạng/huỷ; ngừng chảy ⇒ ném `NgungChayError`. KHÔNG xét `res.ok` — việc của chỗ gọi (thân lỗi vẫn đọc trọn).
 */
export async function taiCoNhip(
  input: RequestInfo | URL,
  init: RequestInit = {},
  ngungMs: number,
  outer?: AbortSignal,
): Promise<KetQuaTai> {
  const canh = boCanhNhip(ngungMs, outer ?? init.signal ?? undefined);
  try {
    const res = await fetch(input, { ...init, signal: canh.signal });
    canh.nhip(); // phản hồi đầu đã về
    const body = await docThan(res, canh.nhip);
    return { res, body };
  } catch (e) {
    if (canh.daNgung()) throw new NgungChayError(ngungMs);
    throw e;
  } finally {
    canh.xong();
  }
}

/** Như `taiCoNhip` rồi parse JSON (thân rỗng/hỏng ⇒ null). */
export async function taiJsonCoNhip<T = unknown>(
  input: RequestInfo | URL,
  init: RequestInit,
  ngungMs: number,
  outer?: AbortSignal,
): Promise<{ res: Response; json: T | null }> {
  const { res, body } = await taiCoNhip(input, init, ngungMs, outer);
  try {
    return { res, json: JSON.parse(new TextDecoder("utf-8").decode(body)) as T };
  } catch {
    return { res, json: null };
  }
}
