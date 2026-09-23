// Đăng ký protocol `sdfdata://` cho MapLibre (2026-09-16) — để `<Source
// type="geojson" data="sdfdata:///data/x.json">` đi qua bộ giải mã file dữ liệu
// (data-fetch.ts) thay vì MapLibre tự fetch rồi parse bản mã thành lỗi.
//
// Chạy MỘT LẦN phía client (guard), import ở vỏ lazy `fishing-map.tsx` cạnh
// `registerPmtilesProtocol` — TRƯỚC khi FishingMapView dựng map.
//
// OFFLINE: fetch bên trong vẫn là cùng URL `/data/…` ⇒ service worker bắt y như
// cũ (CRITICAL_SHELL/SHELL không đổi). MapLibre huỷ request khi gỡ nguồn qua
// `abortController`; ta ghép thêm trần 60 s để "sóng sống mà chết" không treo lớp.

import maplibregl from "maplibre-gl";
import { DATA_PROTOCOL, fetchDataJson } from "@/lib/data-fetch";

let registered = false;

/** Đăng ký một lần. Gọi lại nhiều lần vô hại. */
export function registerDataProtocol(): void {
  if (registered || typeof window === "undefined") return;
  try {
    maplibregl.addProtocol(DATA_PROTOCOL, async (params, abortController) => {
      const path = params.url.slice(DATA_PROTOCOL.length + 3); // "sdfdata://" → "/data/…"
      const data = await fetchDataJson<GeoJSON.GeoJSON>(
        path,
        60000,
        "geojson",
        abortController.signal,
      );
      return { data };
    });
    registered = true;
  } catch {
    /* trùng đăng ký / môi trường thiếu — lớp GeoJSON tĩnh sẽ báo lỗi tải, map vẫn dựng */
  }
}
