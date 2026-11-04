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
//  · sst / chlorophyll — ảnh vệ tinh NASA GIBS (dữ liệu NASA không ràng buộc dùng lại) = "Nước nóng lạnh" /
//    "Vùng nhiều mồi". Từ 2026-10-27 đi qua đây (anh Long: "tất cả tải lưu server đi") để GÓI chặn thật ở
//    middleware (trước đó máy gọi thẳng GIBS, chỉ khoá giao diện) — kèm lợi: SW giữ ô đã xem, mất sóng vẫn còn.
// KHÔNG đưa nền Carto vào đây: điều khoản của họ không cho proxy/cache lại.
//
// Danh sách trắng là bắt buộc — nếu nhận URL tuỳ ý thì route thành proxy mở,
// ai cũng mượn được server của app để tải hộ thứ khác.

import { apiUrl } from "@/lib/api-base";

/** Tên nguồn hợp lệ trên đường /api/tiles/{src}/{z}/{x}/{y} */
export type TileProxySource = "chart" | "seamark" | "sst" | "chlorophyll";

export type TileProxyDef = {
  /** URL thật ở nhà cung cấp. `date` chỉ nguồn ảnh theo ngày dùng ("default" hoặc "YYYY-MM-DD"). */
  upstream: (z: number, x: number, y: number, date?: string) => string;
  /** Zoom nguồn có tile thật — ngoài khoảng này trả 204, đỡ gọi vô ích */
  minzoom: number;
  maxzoom: number;
  /** Giây CDN được giữ (dữ liệu tĩnh thì giữ lâu) */
  sMaxAge: number;
  /** Ảnh ĐỔI THEO NGÀY ở cùng URL (GIBS ngày `default`) ⇒ không gắn `immutable`, máy giữ ngắn */
  daily?: boolean;
  /** Ảnh theo ngày: thử những ngày nào, theo thứ tự (xem `upstreamTileUrls`). */
  dates?: { useDefault: boolean; backDays: number };
};

const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";

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
  /*  NGÀY `default` của GIBS = ảnh mới nhất nguồn còn (độ trễ đổi theo tuần — ĐỪNG tự trừ ngày, xem ocean-map).
      GIBS dùng thứ tự {z}/{y}/{x} (WMTS TileRow/TileCol), khác XYZ thường. Ảnh đổi mỗi ngày ⇒ CDN giữ 6 giờ. */
  /*  NGÀY DỰ PHÒNG (2026-11-04, bà con báo bản đồ "vuông loang lổ"). Đo thật trên GIBS:
        · Phù du VIIRS: `default` = HÔM NAY (UTC) mà ảnh hôm nay chưa xử lý ⇒ GIBS trả Ô GIẢ xám lốm đốm
          (etag `1000000000000`, HTTP 200!) hoặc 500. Ra bản đồ: ô xám sọc chỗ có chỗ không. Ảnh ngày thì
          từng ô 404 cách quãng (vệt quét vệ tinh + mây) ⇒ lùi từng ngày tới khi ô có ảnh.
        · Nước nóng lạnh MUR: `default` đúng ảnh mới nhất, nhưng có lúc 500 ⇒ ô trống. Lùi ngày làm dự phòng.  */
  sst: {
    upstream: (z, x, y, date = "default") =>
      `${GIBS}/GHRSST_L4_MUR_Sea_Surface_Temperature_Anomalies/default/${date}/GoogleMapsCompatible_Level7/${z}/${y}/${x}.png`,
    minzoom: 0,
    maxzoom: 7,
    sMaxAge: 21600,
    daily: true,
    dates: { useDefault: true, backDays: 10 },
  },
  chlorophyll: {
    upstream: (z, x, y, date = "default") =>
      `${GIBS}/VIIRS_NOAA20_Chlorophyll_a/default/${date}/GoogleMapsCompatible_Level7/${z}/${y}/${x}.png`,
    minzoom: 0,
    maxzoom: 7,
    sMaxAge: 21600,
    daily: true,
    dates: { useDefault: false, backDays: 7 },
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

/** Etag GIBS gắn cho Ô GIẢ (ngày chưa có ảnh): ảnh xám lốm đốm, HTTP 200 — PHẢI coi là trượt. */
export const GIBS_PLACEHOLDER_ETAG = "1000000000000";

export function isPlaceholderTile(etag: string | null): boolean {
  return (etag ?? "").replace(/^W\//, "").replace(/"/g, "") === GIBS_PLACEHOLDER_ETAG;
}

/**
 * Mọi URL nên thử cho một ô, theo thứ tự. Nguồn tĩnh: đúng một URL. Ảnh theo ngày: (`default`) rồi
 * hôm qua, hôm kia… tới `backDays` ngày trước (ngày UTC — GIBS đặt ngày theo UTC). Route thử lần lượt,
 * ô nào 404/500/ô giả thì sang ngày trước. null = nguồn lạ / ô vô lý (như `upstreamTileUrl`).
 */
export function upstreamTileUrls(
  src: string,
  z: number,
  x: number,
  y: number,
  now: Date = new Date(),
): string[] | null {
  const first = upstreamTileUrl(src, z, x, y);
  if (!first || !isTileProxySource(src)) return null;
  const def = TILE_PROXY[src];
  if (!def.dates) return [first];
  const urls = def.dates.useDefault ? [first] : [];
  for (let back = 1; back <= def.dates.backDays; back++) {
    const d = new Date(now.getTime() - back * 86_400_000).toISOString().slice(0, 10);
    urls.push(def.upstream(z, x, y, d));
  }
  return urls;
}

/**
 * Mẫu URL XYZ để dán vào style MapLibre. Trên web là đường same-origin (SW giữ
 * được); bản native Capacitor đi qua NEXT_PUBLIC_API_BASE như mọi API khác.
 */
export function proxyTileTemplate(src: TileProxySource): string {
  return apiUrl(`/api/tiles/${src}/{z}/{x}/{y}`);
}
