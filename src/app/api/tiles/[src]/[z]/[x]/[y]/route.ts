// Cầu tile same-origin cho hải đồ độ sâu + phao đèn — xem src/lib/tile-proxy.ts
// (vì sao: service worker chỉ giữ được thứ cùng origin, mất sóng mới còn bản đồ).
//
// Danh sách nguồn nằm trong tile-proxy.ts (danh sách TRẮNG — không nhận URL
// tuỳ ý, tránh biến route thành proxy mở).

import {
  TILE_PROXY,
  isPlaceholderTile,
  isTileProxySource,
  upstreamTileUrls,
} from "@/lib/tile-proxy";
import { timeoutSignal } from "@/lib/abort";

type Ctx = {
  params: Promise<{ src: string; z: string; x: string; y: string }>;
};

/** "Không có ô này" — 204 để MapLibre coi là ô trống, không phải lỗi.
 *  Hàm chứ không phải hằng: mỗi request phải là một Response riêng. */
const empty = () => new Response(null, { status: 204 });

/*  "NGUỒN KHÔNG TRẢ LỜI" — KHÁC HẲN ô trống (sửa 2026-08-02, audit B2/K2).
    LỖI ĐÃ SỬA: nguồn hỏng cũng trả 204, mà `Response.ok` của 204 là TRUE ⇒
    service worker cất đè lên đúng ô PNG tốt bà con đã tải ở cảng, và MapLibre
    coi 204 là ô trống HỢP LỆ (thân rỗng → ảnh 1×1 trong suốt, không bắn sự kiện
    lỗi). Ra khơi: vùng đó mất nền hải đồ độ sâu + phao đèn biển mà bản đồ KHÔNG
    báo gì — bà con tưởng chỗ đó vốn không có dữ liệu.
    503 thì `res.ok` false ⇒ SW không cất, và `isRescuableStatus` cho phép cứu
    bằng ô đã có trong kho. */
const upstreamDown = () => new Response(null, { status: 503 });

/** Trần TỔNG cho một ô (mọi ngày dự phòng cộng lại) — SW phía máy chờ cỡ đó trước khi lấy ô đã cất. */
const TOTAL_MS = 12_000;
/** Trần MỖI lượt hỏi nguồn — đủ chỗ cho 2–3 ngày dự phòng khi nguồn chậm. */
const ATTEMPT_MS = 6_000;

export async function GET(_req: Request, { params }: Ctx) {
  const { src, z: zs, x: xs, y: ys } = await params;
  if (!isTileProxySource(src)) return new Response("Bản đồ không xác định", { status: 404 });
  const urls = upstreamTileUrls(
    src,
    Number.parseInt(zs, 10),
    Number.parseInt(xs, 10),
    Number.parseInt(ys, 10),
  );
  // đúng nguồn nhưng ngoài dải zoom / ô vô lý → ô trống, không phải lỗi
  if (!urls) return empty();
  const deadline = Date.now() + TOTAL_MS;
  /*  `failed` = có lượt nguồn KHÔNG trả lời (5xx, hết giờ, ô giả, trang HTML). Hết danh sách mà mọi lượt
      đều 404 thì ô đó thật sự không có ảnh (mây che cả tuần, biển sâu ngoài vùng phủ) ⇒ 204. Có lượt hỏng
      ⇒ 503, để SW lấy ô đã cất và MapLibre còn xin lại sau — 204 thì MapLibre giữ ô trống MÃI. */
  let failed = false;
  for (const url of urls) {
    const left = deadline - Date.now();
    if (left <= 300) {
      failed = true;
      break;
    }
    try {
      const res = await fetch(url, { signal: timeoutSignal(Math.min(ATTEMPT_MS, left)) });
      // 404 của nguồn = ô/ngày đó không có ảnh → thử ngày trước (nguồn tĩnh: hết danh sách → ô trống)
      if (res.status === 404) continue;
      // quá tải: dừng luôn, đừng dồn thêm lượt hỏi lên nguồn đang chặn mình
      if (res.status === 429) {
        failed = true;
        break;
      }
      if (!res.ok) {
        failed = true;
        continue;
      }
      /*  CHỈ NHẬN ẢNH (2026-08-02b). Nguồn miễn phí lúc quá tải hay trả TRANG HTML
          lỗi kèm status 200 — service worker chỉ nhìn `res.ok` nên sẽ cất nguyên
          trang đó vào kho ô bản đồ, và ra khơi vùng biển ấy trống vĩnh viễn mà
          không ai biết vì sao. Cùng khuôn K2 với chuyện 200-kèm-lỗi.
          Ô GIẢ GIBS (2026-11-04): ảnh thật, 200, nhưng là ô xám lốm đốm của ngày chưa xử lý — cùng loại. */
      const ctype = res.headers.get("Content-Type") ?? "";
      if (!ctype.startsWith("image/") || isPlaceholderTile(res.headers.get("ETag"))) {
        failed = true;
        continue;
      }
      const buf = await res.arrayBuffer();
      return new Response(buf, {
        status: 200,
        headers: {
          "Content-Type": ctype,
          // ảnh đổi theo ngày (GIBS) ⇒ máy giữ 1 giờ, không `immutable`; ảnh tĩnh giữ 1 ngày
          "Cache-Control": TILE_PROXY[src].daily
            ? `public, max-age=3600, s-maxage=${TILE_PROXY[src].sMaxAge}`
            : `public, max-age=86400, s-maxage=${TILE_PROXY[src].sMaxAge}, immutable`,
        },
      });
    } catch {
      // hết giờ / DNS chết / nguồn treo — cũng là "không hỏi được"
      failed = true;
    }
  }
  return failed ? upstreamDown() : empty();
}
