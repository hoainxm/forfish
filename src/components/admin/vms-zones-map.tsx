"use client";

// Bản đồ xem VÙNG BIỂN VMS trong /quan-tri (tab Vùng biển). Chỉ để NHÌN: vẽ
// mọi vùng theo màu/style admin đặt, vùng đang chọn tô đậm, vùng đang ẩn mờ đi.
// Không sửa hình trên bản đồ (thêm vùng bằng tải GeoJSON). Lazy-load qua wrapper
// dynamic ssr:false vì thư viện MapLibre nặng + không SSR được.
import { useMemo } from "react";
import MapGL, { Source, Layer } from "react-map-gl/maplibre";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildMapStyle, DEFAULT_VIEW } from "@/lib/ocean-map";

export interface AdminMapZone {
  id: string;
  color: string;
  style: string;
  visible: boolean;
  geojson: GeoJSON.FeatureCollection;
}

export default function VmsZonesMap({
  zones,
  selectedId,
}: {
  zones: AdminMapZone[];
  selectedId?: string | null;
}) {
  // Nền hải đồ tối giản (không lớp vệ tinh/phao) — đủ để định vị vùng.
  const mapStyle = useMemo(
    () => buildMapStyle(null, new Date(), { seamarks: false }) as StyleSpecification,
    [],
  );
  return (
    <MapGL
      initialViewState={DEFAULT_VIEW}
      mapStyle={mapStyle}
      style={{ width: "100%", height: "100%" }}
      attributionControl={false}
    >
      {zones.map((z) => {
        const sel = z.id === selectedId;
        return (
          <Source key={z.id} id={`az-${z.id}`} type="geojson" data={z.geojson}>
            {z.style === "fill" && (
              <Layer
                id={`az-${z.id}-fill`}
                type="fill"
                paint={{
                  "fill-color": z.color,
                  "fill-opacity": z.visible ? 0.12 : 0.04,
                }}
              />
            )}
            <Layer
              id={`az-${z.id}-line`}
              type="line"
              layout={{ "line-join": "round" }}
              paint={{
                "line-color": z.color,
                "line-width": sel ? 4 : 2,
                "line-opacity": z.visible ? 0.95 : 0.35,
                ...(z.style === "line-dashed"
                  ? { "line-dasharray": [2, 1.5] }
                  : {}),
              }}
            />
          </Source>
        );
      })}
    </MapGL>
  );
}
