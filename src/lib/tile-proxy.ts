// Cầu tile SAME-ORIGIN cho bản đồ Ra khơi.
//
// Vì sao cần: service worker (public/sw.js) CHỈ giữ được thứ cùng origin
// (`url.origin !== self.location.origin` → bỏ qua). Tile lấy thẳng từ host
// ngoài nên mất sóng là mất sạch. Cho tile đi qua /api/tiles/... thì SW cache
// lại được → vùng biển bà con đã xem lúc còn sóng vẫn hiện lúc mất sóng.
//
// CHỈ nguồn MỞ, cho phép cache/proxy (không key, không phí):
//  · chart   — EMODnet Bathymetry (CC-BY 4.0, nền GEBCO) = lớp "Hải đồ độ sâu"
//  · seamark — OpenSeaMap seamark (ODbL) = phao, đèn biển, báo hiệu
// KHÔNG đưa nền Carto vào đây: điều khoản của họ không cho proxy/cache lại.
//
// Danh sách trắng là bắt buộc — nếu nhận URL tuỳ ý thì route thành proxy mở,
// ai cũng mượn được server của app để tải hộ thứ khác.

import { apiUrl } from "@/lib/api-base";

/** Tên nguồn hợp lệ trên đường /api/tiles/{src}/{z}/{x}/{y} */
export type TileProxySource = "chart" | "seamark";

export type TileProxyDef = {
  /** URL thật ở nhà cung cấp */
  upstream: (z: number, x: number, y: number) => string;
  /** Zoom nguồn có tile thật — ngoài khoảng này trả 204, đỡ gọi vô ích */
  minzoom: number;
  maxzoom: number;
  /** Giây CDN được giữ (dữ liệu tĩnh thì giữ lâu) */
  sMaxAge: number;
};

export const TILE_PROXY: Record<TileProxySource, TileProxyDef> = {
  chart: {
    upstream: (z, x, y) =>
      `https://tiles.emodnet-bathymetry.eu/2020/baselayer/web_mercator/${z}/${x}/${y}.png`,
    minzoom: 0,
    maxzoom: 12,
    // độ sâu đáy biển gần như không đổi → giữ 30 ngày
    sMaxAge: 2592000,
  },
  seamark: {
    upstream: (z, x, y) => `https://tiles.openseamap.org/seamark/${z}/${x}/${y}.png`,
    minzoom: 8,
    maxzoom: 18,
    // phao đèn do người đóng góp sửa dần → giữ 7 ngày
    sMaxAge: 604800,
  },
};

export function isTileProxySource(src: string): src is TileProxySource {
  return Object.prototype.hasOwnProperty.call(TILE_PROXY, src);
}

/**
 * URL thật ở nhà cung cấp, hoặc null nếu tên nguồn lạ / z-x-y vô lý.
 * Chặn cả x,y âm hoặc vượt số ô của mức zoom (2^z) — tránh đẩy rác lên upstream.
 */
export function upstreamTileUrl(
  src: string,
  z: number,
  x: number,
  y: number,
): string | null {
  if (!isTileProxySource(src)) return null;
  if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y)) {
    return null;
  }
  const def = TILE_PROXY[src];
  if (z < def.minzoom || z > def.maxzoom) return null;
  const n = 2 ** z;
  if (x < 0 || x >= n || y < 0 || y >= n) return null;
  return def.upstream(z, x, y);
}

/**
 * Mẫu URL XYZ để dán vào style MapLibre. Trên web là đường same-origin (SW giữ
 * được); bản native Capacitor đi qua NEXT_PUBLIC_API_BASE như mọi API khác.
 */
export function proxyTileTemplate(src: TileProxySource): string {
  return apiUrl(`/api/tiles/${src}/{z}/{x}/{y}`);
}
