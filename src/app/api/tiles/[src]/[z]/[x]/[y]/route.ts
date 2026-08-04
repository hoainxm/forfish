// Cầu tile same-origin cho hải đồ độ sâu + phao đèn — xem src/lib/tile-proxy.ts
// (vì sao: service worker chỉ giữ được thứ cùng origin, mất sóng mới còn bản đồ).
//
// Danh sách nguồn nằm trong tile-proxy.ts (danh sách TRẮNG — không nhận URL
// tuỳ ý, tránh biến route thành proxy mở).

import {
  TILE_PROXY,
  isTileProxySource,
  upstreamTileUrl,
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

export async function GET(_req: Request, { params }: Ctx) {
  const { src, z: zs, x: xs, y: ys } = await params;
  if (!isTileProxySource(src)) return new Response("Tile lạ", { status: 404 });
  const url = upstreamTileUrl(
    src,
    Number.parseInt(zs, 10),
    Number.parseInt(xs, 10),
    Number.parseInt(ys, 10),
  );
  // đúng nguồn nhưng ngoài dải zoom / ô vô lý → ô trống, không phải lỗi
  if (!url) return empty();
  try {
    const res = await fetch(url, { signal: timeoutSignal(12_000) });
    // 404 của nguồn = ô đó thật sự không có (biển sâu ngoài vùng phủ) → ô trống.
    // Mọi mã còn lại (429 quá tải, 5xx, bảo trì) = KHÔNG HỎI ĐƯỢC → nói thật.
    if (res.status === 404) return empty();
    if (!res.ok) return upstreamDown();
    /*  CHỈ NHẬN ẢNH (2026-08-02b). Nguồn miễn phí lúc quá tải hay trả TRANG HTML
        lỗi kèm status 200 — service worker chỉ nhìn `res.ok` nên sẽ cất nguyên
        trang đó vào kho ô bản đồ, và ra khơi vùng biển ấy trống vĩnh viễn mà
        không ai biết vì sao. Cùng khuôn K2 với chuyện 200-kèm-lỗi. */
    const ctype = res.headers.get("Content-Type") ?? "";
    if (!ctype.startsWith("image/")) return upstreamDown();
    const buf = await res.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": ctype,
        "Cache-Control": `public, max-age=86400, s-maxage=${TILE_PROXY[src].sMaxAge}, immutable`,
      },
    });
  } catch {
    // hết giờ 12 s / DNS chết / nguồn treo — cũng là "không hỏi được"
    return upstreamDown();
  }
}
