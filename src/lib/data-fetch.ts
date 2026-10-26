// MỘT CỬA ĐỌC cho mọi file `public/data/**` (2026-09-16).
//
// Trước đây mỗi lib tự `fetch("/data/x.json").then(r => r.json())`. Nay file
// phát ra ngoài là BẢN MÃ (xem data-codec.mjs + scripts/encode-data.mjs) nên
// `r.json()` không còn đọc được; mọi chỗ phải đi qua đây: tải → giải mã → parse.
// Bản RÕ (dev/test, chưa qua build Vercel) không có header ⇒ trả nguyên ⇒ cùng
// một đường code cho cả hai. Cổng `data-codec.test.ts` chặn `fetch("/data/`
// trần quay lại.
//
// Giữ nguyên hợp đồng lỗi cũ của các lib: HTTP hỏng ⇒ ném `Error("<nhãn> <mã>")`
// (test khớp /404/), mất sóng ⇒ fetch tự ném; chỗ gọi vẫn XOÁ đệm để lần sóng về
// sau thử lại (án lệ fetchSeamarks).

import { taiCoNhip } from "@/lib/tai-co-nhip";
import { decodeData, hasDataHeader2 } from "@/lib/data-codec.mjs";
import { decryptFile } from "@/lib/data-crypt";
import { getDataKey } from "@/lib/data-key";

/** Tên protocol MapLibre cho nguồn GeoJSON tĩnh — đăng ký ở data-protocol.ts. */
export const DATA_PROTOCOL = "sdfdata";

/** `/data/x.json` → `sdfdata:///data/x.json` cho `<Source data=…>` của MapLibre. */
export function dataSourceUrl(path: string): string {
  return `${DATA_PROTOCOL}://${path}`;
}

/**
 * Tải + giải mã một file dữ liệu, trả THÂN RÕ dạng ArrayBuffer (cho .bin).
 * @param path  đường dẫn cùng origin, vd "/data/depth-grid.v1.bin"
 * @param ms    trần NGỪNG CHẢY (2026-10-26): chờ phản hồi đầu / giữa hai gói tối đa bấy nhiêu — KHÔNG phải trần
 *              tổng. Trước đây là trần tổng ⇒ file 8 MB trên mạng di động chậm bị cắt khi dữ liệu vẫn đang về đều
 *              ("không down được" dù đang online). Treo thật vẫn cắt đúng hạn (lib/tai-co-nhip).
 * @param nhan  nhãn cho thông điệp lỗi ("depth grid 404")
 */
export async function fetchDataBytes(
  path: string,
  ms: number,
  nhan: string,
  outer?: AbortSignal,
): Promise<ArrayBuffer> {
  const { res: r, body: raw } = await taiCoNhip(path, {}, ms, outer);
  if (!r.ok) throw new Error(`${nhan} ${r.status}`);
  // SDF2 (nhóm biên tập): cần khoá theo tài khoản — thiếu khoá thì ném để chỗ
  // gọi xoá đệm, lần có sóng sau /api/data-key trả khoá rồi đọc lại được.
  const u8 = hasDataHeader2(raw) ? await decryptFile(raw, getDataKey) : decodeData(raw);
  // Bản rõ trả nguyên view ⇒ buffer gốc; bản mã là buffer mới đúng cỡ.
  if (u8.byteOffset === 0 && u8.byteLength === u8.buffer.byteLength) {
    return u8.buffer as ArrayBuffer;
  }
  return u8.slice().buffer as ArrayBuffer;
}

/** Tải + giải mã + parse JSON. Kiểu trả về do chỗ gọi khai, hàm không kiểm. */
export async function fetchDataJson<T = unknown>(
  path: string,
  ms: number,
  nhan: string,
  outer?: AbortSignal,
): Promise<T> {
  const buf = await fetchDataBytes(path, ms, nhan, outer);
  return JSON.parse(new TextDecoder("utf-8").decode(buf)) as T;
}
