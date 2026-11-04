/*
  CHẾ ĐỘ HẢI ĐỒ — STYLE NỀN (2026-11-04, đợt 1). Thuần, có test.

  Dùng LẠI style hải đồ của app (`buildMapStyle` — nền Protomaps bỏ nhãn, mask
  chủ quyền, dải độ sâu, đẳng sâu, mốc `base-top`) rồi:
    1. lấy nhánh "bathymetry" (chỉ nhánh này có dải độ sâu + đẳng sâu tự dựng —
       MIỄN PHÍ) nhưng BỎ ảnh EMODnet `ocean-data` (lớp gói, cần mạng) và tắt
       raster báo hiệu OpenSeaMap (màn này vẽ báo hiệu VECTOR trong máy);
    2. đường an toàn tô đậm theo mức bà con chọn / suy từ mớn, thay 10 m cố định;
    3. thêm hình bờ lưu trong máy (nấc xa luôn; mất sóng thì mọi nấc) và chấm +
       tên đảo tiếng Việt — đặt ngay trên mốc `base-top` để không xoá Hoàng Sa,
       Trường Sa dưới mask (luật OFFLINE_COAST_BEFORE_ID);
    4. áp bảng màu ngày/chiều/đêm.
  Không sửa `buildMapStyle` — màn bản đồ cũ giữ nguyên.
*/

import { buildMapStyle, ISLANDS_DATA_URL, ISLAND_DOT_COLOR, ISLAND_LABEL_COLOR, OFFLINE_COAST_BEFORE_ID } from "@/lib/ocean-map";
import { COAST_DATA_URL, OFFLINE_COAST_COLOR, OFFLINE_LAND_COLOR } from "@/lib/offline-basemap";
import { dataSourceUrl } from "@/lib/data-fetch";
import { apBangMauStyle, type BangMau } from "@/lib/hai-do/bang-mau";
import type { MucAnToan } from "@/lib/hai-do/an-toan";

export const SAFETY_LAYER_ID = "isobath-safety";
/** Có sóng: hình bờ trong máy chỉ vẽ dưới nấc này (từ đây nền Protomaps đủ chi tiết). */
export const BO_XA_MAXZOOM = 7;

type Layer = { id: string; type: string; source?: string; filter?: unknown; paint?: Record<string, unknown>; layout?: Record<string, unknown> };

export interface HaiDoStyleOpts {
  bang: BangMau;
  anToanM: MucAnToan;
  /** true = đang mất sóng ⇒ vẽ hình bờ lưu trong máy */
  matSong: boolean;
}

export function buildHaiDoStyle({ bang, anToanM, matSong }: HaiDoStyleOpts) {
  const base = buildMapStyle("bathymetry", { seamarks: false }) as unknown as {
    sources: Record<string, unknown>;
    layers: Layer[];
  } & Record<string, unknown>;

  const layers: Layer[] = base.layers.filter((l) => l.id !== "ocean-data").map((l) =>
    l.id === SAFETY_LAYER_ID
      ? { ...l, filter: ["all", ["==", ["get", "k"], "duong"], ["==", ["get", "d"], anToanM]] }
      : l,
  );

  const { ["ocean-data"]: _anh, ...nguon } = base.sources;
  void _anh;
  const sources: Record<string, unknown> = {
    ...nguon,
    "hd-islands": { type: "geojson", data: dataSourceUrl(ISLANDS_DATA_URL) },
  };
  /*  HÌNH BỜ LƯU TRONG MÁY (`vn-coast`, 99–121°Đ · 3–24°B, ~220 KB, có trong SHELL):
      nền Protomaps của app chỉ có ô từ nấc gần (màn cũ ở nấc xa thấy đất nhờ ẢNH
      độ sâu EMODnet — lớp gói, màn này bỏ) ⇒ nấc xa (< BO_XA_MAXZOOM) luôn vẽ đất
      từ hình bờ; MẤT SÓNG thì vẽ ở MỌI nấc (lưới an toàn cuối, như màn cũ). */
  sources["hd-coast"] = { type: "geojson", data: dataSourceUrl(COAST_DATA_URL) };
  const zoomBo = matSong ? {} : { maxzoom: BO_XA_MAXZOOM };
  const them: Layer[] = [
    { id: "hd-coast-fill", type: "fill", source: "hd-coast", ...zoomBo, paint: { "fill-color": OFFLINE_LAND_COLOR } },
    { id: "hd-coast-line", type: "line", source: "hd-coast", ...zoomBo, paint: { "line-color": OFFLINE_COAST_COLOR, "line-width": 1 } },
  ];
  const moc = layers.findIndex((l) => l.id === OFFLINE_COAST_BEFORE_ID);
  const chen = moc < 0 ? layers.length : moc + 1;
  layers.splice(chen, 0, ...them);

  // đảo: vẽ TRÊN CÙNG nhóm nền (nhãn chủ quyền là Marker DOM, luôn trên mọi lớp)
  layers.push(
    {
      id: "hd-island-dot",
      type: "circle",
      source: "hd-islands",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 1.4, 9, 3.4],
        "circle-color": ISLAND_DOT_COLOR,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1,
        "circle-opacity": 0.9,
      },
    },
    {
      id: "hd-island-label",
      type: "symbol",
      source: "hd-islands",
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Noto Sans Bold"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 4.5, 10, 7, 12.5, 10, 15],
        "text-anchor": "top",
        "text-offset": [0, 0.55],
        "text-padding": 2,
        "symbol-sort-key": ["get", "rank"],
        "text-allow-overlap": false,
        "text-optional": true,
      },
      paint: { "text-color": ISLAND_LABEL_COLOR, "text-halo-color": "#ffffff", "text-halo-width": 1.5 },
    },
  );

  return apBangMauStyle({ ...base, sources, layers }, bang);
}
