// Proxy tile contour độ sâu — convert XYZ → WMS GetMap, fetch OpenSeaMap,
// cache 7 ngày (dữ liệu GEBCO tĩnh, đổi rất chậm).

import { openseamapContourGetMapUrl } from "@/lib/nautical-layers";

// Cache bằng header Cache-Control (Vercel CDN sẽ tôn trọng).
// `revalidate` không dùng cho route có dynamic segments.

type Ctx = { params: Promise<{ z: string; x: string; y: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { z: zs, x: xs, y: ys } = await params;
  const z = parseInt(zs, 10);
  const x = parseInt(xs, 10);
  const y = parseInt(ys, 10);
  if (!Number.isFinite(z) || !Number.isFinite(x) || !Number.isFinite(y)) {
    return new Response("Bad tile", { status: 400 });
  }
  // chỉ phục vụ zoom contour có nghĩa (4..9)
  if (z < 4 || z > 9) {
    return new Response(null, { status: 204 });
  }
  const url = openseamapContourGetMapUrl(z, x, y);
  try {
    const res = await fetch(url, {
      // upstream chậm → timeout 12s, sẽ trả 502 nếu nó treo
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      return new Response(null, { status: 204 });
    }
    const buf = await res.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
      },
    });
  } catch {
    return new Response(null, { status: 204 });
  }
}
