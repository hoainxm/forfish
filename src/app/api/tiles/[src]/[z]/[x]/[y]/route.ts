// Cầu tile same-origin cho hải đồ độ sâu + phao đèn — xem src/lib/tile-proxy.ts
// (vì sao: service worker chỉ giữ được thứ cùng origin, mất sóng mới còn bản đồ).
//
// Danh sách nguồn nằm trong tile-proxy.ts (danh sách TRẮNG — không nhận URL
// tuỳ ý, tránh biến route thành proxy mở).

import { TILE_PROXY, isTileProxySource, upstreamTileUrl } from "@/lib/tile-proxy";

type Ctx = { params: Promise<{ src: string; z: string; x: string; y: string }> };

/** "Không có ô này" — 204 để MapLibre coi là ô trống, không phải lỗi.
 *  Hàm chứ không phải hằng: mỗi request phải là một Response riêng. */
const empty = () => new Response(null, { status: 204 });

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
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return empty();
    const buf = await res.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "image/png",
        "Cache-Control": `public, max-age=86400, s-maxage=${TILE_PROXY[src].sMaxAge}, immutable`,
      },
    });
  } catch {
    return empty();
  }
}
