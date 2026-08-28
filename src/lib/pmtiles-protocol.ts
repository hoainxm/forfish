// Đăng ký protocol `pmtiles://` cho MapLibre — để nền bản đồ VECTOR đọc thẳng
// file tĩnh cùng-origin `public/data/vn-basemap.pmtiles` (không key, không host
// ngoài như CARTO). Chạy MỘT LẦN phía client (guard). Import ở vỏ lazy
// `fishing-map.tsx` TRƯỚC khi FishingMapView dựng map.
//
// VÌ SAO PMTiles: CARTO raster nay đòi API key (watermark ~2026-08); PMTiles là
// file tĩnh same-origin → không key, thương mại OK, và SW giữ được (offline).
// VÌ SAO "sạch, không chữ Trung": nền CHỈ lấy hình học (đất/nước/bờ/đường), BỎ
// HẾT nhãn OSM (nơi lọt tên Hải Nam/đảo tranh chấp) — xem buildMapStyle.

import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";

let registered = false;

/** Đăng ký một lần. Gọi lại nhiều lần vô hại. */
export function registerPmtilesProtocol(): void {
  if (registered || typeof window === "undefined") return;
  try {
    const protocol = new Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);
    registered = true;
  } catch {
    /* trùng đăng ký / môi trường thiếu — bỏ qua, nền rơi về fallback vn-coast */
  }
}
