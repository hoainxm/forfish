// Lớp hải đồ bổ sung — nguồn MIỄN PHÍ, không key, phủ VN (đã verify ngày
// 2026-06-10, xem docs/research/09-nautical-map-sources.md).
//
// 1. Contour độ sâu — OpenSeaMap depth WMS (1000/2000/5000m, có nhãn).
//    NGUỒN MỞ DUY NHẤT có contour line cho VN waters. Wrap qua API tile
//    proxy /api/tiles/contour/{z}/{x}/{y} vì MapLibre raster cần URL XYZ.
// 2. Đèn biển + xác tàu + phao luồng — OSM Overpass vector
//    (607 lighthouses, 1167 buoys, 13 wrecks VN). Lấy qua /api/nautical?kind=...
//
// Style fragments để Lead ghép vào buildMapStyle() trong ocean-map.ts.
// Lý do tách file: tránh đụng ocean-map.ts đang được session khác sửa.

import type { StyleSpecification } from "maplibre-gl";

export const OPENSEAMAP_DEPTH_ATTRIB =
  "Contour: OpenSeaMap depth WMS (ODbL, dựa GEBCO)";
export const OSM_OVERPASS_ATTRIB = "© OpenStreetMap (ODbL) qua Overpass";

/** XYZ tile của ForFish API → ảnh contour OpenSeaMap, phù hợp MapLibre raster source. */
export function openseamapContourTileUrl(): string {
  return "/api/tiles/contour/{z}/{x}/{y}";
}

/** Source raster cho contour độ sâu, dùng dán vào style.sources. */
export const openseamapContourSource = {
  type: "raster" as const,
  tiles: [openseamapContourTileUrl()],
  tileSize: 256,
  minzoom: 4,
  maxzoom: 8,
  attribution: OPENSEAMAP_DEPTH_ATTRIB,
};

/** Layer raster, opacity nhẹ để chồng lên basemap mà không che. */
export const openseamapContourLayer = {
  id: "openseamap-contour",
  type: "raster" as const,
  source: "openseamap-contour",
  paint: {
    "raster-opacity": 0.65,
  },
  minzoom: 4,
  maxzoom: 9,
};

// ── Overpass vector ──────────────────────────────────────────────────────
export type NauticalKind = "wreck" | "lighthouse" | "buoy" | "harbour";

export interface NauticalPoint {
  id: string;
  kind: NauticalKind;
  lat: number;
  lon: number;
  name?: string;
  /** Đặc tả đèn (vd "Fl(2)W.10s14M"), nếu có */
  light?: string;
}

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

const OVERPASS_QUERIES: Record<NauticalKind, (bbox: string) => string> = {
  wreck: (bbox) => `[out:json][timeout:25];
    node["seamark:type"="wreck"](${bbox});
    out body;`,
  lighthouse: (bbox) => `[out:json][timeout:25];
    (
      node["seamark:type"="light_major"](${bbox});
      node["seamark:type"="light_minor"](${bbox});
      node["man_made"="lighthouse"](${bbox});
    );
    out body;`,
  buoy: (bbox) => `[out:json][timeout:25];
    (
      node["seamark:type"~"buoy"](${bbox});
      node["seamark:type"="beacon_lateral"](${bbox});
    );
    out body;`,
  harbour: (bbox) => `[out:json][timeout:25];
    (
      node["seamark:type"="harbour"](${bbox});
      way["seamark:type"="harbour"](${bbox});
    );
    out center;`,
};

/** bbox dạng "minLat,minLng,maxLat,maxLng" cho Overpass. */
export interface BBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export function bboxString(b: BBox): string {
  return `${b.minLat},${b.minLng},${b.maxLat},${b.maxLng}`;
}

/** Server-side fetch Overpass + parse → mảng NauticalPoint thuần. */
export async function fetchNautical(
  kind: NauticalKind,
  bbox: BBox,
): Promise<NauticalPoint[]> {
  const query = OVERPASS_QUERIES[kind](bboxString(bbox));
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "data=" + encodeURIComponent(query),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const json = (await res.json()) as {
    elements?: Array<{
      type: string;
      id: number;
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
      tags?: Record<string, string>;
    }>;
  };
  return (json.elements ?? [])
    .map((el) => {
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (lat == null || lon == null) return null;
      return {
        id: `${el.type}/${el.id}`,
        kind,
        lat,
        lon,
        name: el.tags?.name ?? el.tags?.["seamark:name"],
        light: el.tags?.["seamark:light:character"],
      } as NauticalPoint;
    })
    .filter((x): x is NauticalPoint => x !== null);
}

// ── Math XYZ → bbox (Web Mercator EPSG:3857) — dùng cho proxy WMS tile ──
const ORIGIN = 20037508.342789244;

export function tileToBbox3857(z: number, x: number, y: number) {
  const n = 2 ** z;
  const minX = (x / n) * 2 * ORIGIN - ORIGIN;
  const maxX = ((x + 1) / n) * 2 * ORIGIN - ORIGIN;
  // Y đếm từ trên xuống → top tile y=0 ứng với +ORIGIN
  const maxY = ORIGIN - (y / n) * 2 * ORIGIN;
  const minY = ORIGIN - ((y + 1) / n) * 2 * ORIGIN;
  return { minX, minY, maxX, maxY };
}

/** Tạo URL GetMap WMS từ XYZ tile cho proxy ảnh contour OpenSeaMap. */
export function openseamapContourGetMapUrl(
  z: number,
  x: number,
  y: number,
): string {
  const { minX, minY, maxX, maxY } = tileToBbox3857(z, x, y);
  const params = new URLSearchParams({
    SERVICE: "WMS",
    VERSION: "1.3.0",
    REQUEST: "GetMap",
    FORMAT: "image/png",
    TRANSPARENT: "true",
    LAYERS: "openseamap:contour",
    CRS: "EPSG:3857",
    WIDTH: "256",
    HEIGHT: "256",
    STYLES: "",
    BBOX: `${minX},${minY},${maxX},${maxY}`,
  });
  return `https://depth.openseamap.org/geoserver/openseamap/wms?${params.toString()}`;
}

/** Gắn 2 thứ vào StyleSpecification mà không sửa file ocean-map.ts.
 *  Lead có thể gọi từ buildMapStyle() bằng `withContourLayer(style)`. */
export function withContourLayer(
  style: StyleSpecification,
): StyleSpecification {
  const next: StyleSpecification = JSON.parse(JSON.stringify(style));
  next.sources = {
    ...next.sources,
    "openseamap-contour": openseamapContourSource,
  };
  // chèn trước layer seamark nếu có (để contour nằm dưới phao đèn)
  const seamarkIdx = next.layers.findIndex((l) => l.id.includes("seamark"));
  const layer = { ...openseamapContourLayer };
  if (seamarkIdx >= 0) next.layers.splice(seamarkIdx, 0, layer);
  else next.layers.push(layer);
  return next;
}
