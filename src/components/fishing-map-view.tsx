"use client";

/**
 * Trục 1 — màn hình "Ra khơi" kiểu Google Maps: BẢN ĐỒ LÀ CẢ TRANG.
 *
 * Sau audit 2026-06-10 (3 reviewer): MỘT chế độ duy nhất — luôn là "gió sóng
 * tại điểm đang xem"; mở app thì điểm đó là VÙNG BIỂN CẢNG NHÀ (đã lưu),
 * chạm biển thì là chỗ chạm, nút "Về cảng" quay lại. Không còn 2 màn hình
 * trùng 80% (mode cảng riêng + list 9 ngày lặp chip 10 ngày).
 *
 * UI cho người 40–60 tuổi: nút to, chữ to, từ đời thường, không gesture khó.
 * Bất biến: nhãn chủ quyền + ranh giới biển VN + tin bão LUÔN hiện.
 */
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import MapGL, {
  Marker,
  Source,
  Layer,
  type MapRef,
} from "react-map-gl/maplibre";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import {
  buildMapStyle,
  formatDateVN,
  latestAvailableDate,
  DEFAULT_VIEW,
  OCEAN_LAYERS,
  SOVEREIGNTY_LABELS,
  type OceanLayerId,
} from "@/lib/ocean-map";
import { type SeaLevel } from "@/lib/sea";
import { PORTS, type FishingPort } from "@/data/ports";
import {
  arrowFeatures,
  fetchForecastGrid,
  timeLabelVN,
  WIND_COLOR_EXPR,
  WAVE_COLOR_EXPR,
  type ForecastGrid,
  type ForecastKind,
} from "@/lib/forecast-grid";
import { FISH_REGIONS, fishInRegion, regionAt } from "@/data/fish-seasons";
import {
  RouteMapLayers,
  RoutePlanner,
  type PlannedRoute,
} from "@/components/route-planner";
import { borderGeoJSON } from "@/data/vn-maritime-border";
import { borderProximity, haversineKm, type BorderLevel } from "@/lib/geofence";
import { fetchDepthGrid, depthClassAt, type DepthClass } from "@/lib/depth-grid";
import { weatherFromCode } from "@/lib/weather-codes";
import { fetchStormCheck, type StormAlert } from "@/lib/storms";
import {
  beaufort,
  fetchSeaPoint,
  forecastConfidence,
  formatNumberVN,
  windDirectionVN,
  type SeaPoint,
  type SeaPointConditions,
} from "@/lib/marine-weather";
import { SnapSheet, type SheetSize } from "@/components/ui/snap-sheet";
import { LayerSheet } from "@/components/layer-sheet";
import { StormBanner } from "@/components/storm-banner";
import {
  AlertIcon,
  AnchorIcon,
  ChevronRightIcon,
  CrosshairIcon,
  FishIcon,
  LayersIcon,
  PauseIcon,
  PinIcon,
  PlayIcon,
  WavesIcon,
  WindIcon,
} from "@/components/icons";
import Link from "next/link";

const WEEKDAYS = [
  "Chủ nhật",
  "Thứ hai",
  "Thứ ba",
  "Thứ tư",
  "Thứ năm",
  "Thứ sáu",
  "Thứ bảy",
];

function dayLabel(isoDate: string, index: number): string {
  if (index === 0) return "Hôm nay";
  if (index === 1) return "Ngày mai";
  // T12:00Z giữ nguyên ngày lịch khi đọc bằng getUTCDay
  const d = new Date(`${isoDate}T12:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${formatDateVN(isoDate)}`;
}

const WEEKDAYS_SHORT = ["CN", "Th 2", "Th 3", "Th 4", "Th 5", "Th 6", "Th 7"];

/** Nhãn ngắn cho chip chọn ngày */
function chipLabel(isoDate: string, index: number): string {
  if (index === 0) return "Hôm nay";
  if (index === 1) return "Ngày mai";
  const d = new Date(`${isoDate}T12:00:00Z`);
  return `${WEEKDAYS_SHORT[d.getUTCDay()]} ${formatDateVN(isoDate)}`;
}

/** Hướng đi từ điểm 1 tới điểm 2 (độ) — để nói "hướng Đông Nam" */
function bearingDeg(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const LEVEL_STYLE: Record<SeaLevel, { bg: string; fg: string }> = {
  good: { bg: "var(--ok-bg)", fg: "var(--ok)" },
  caution: { bg: "var(--warn-bg)", fg: "var(--warn)" },
  bad: { bg: "var(--danger-bg)", fg: "var(--danger)" },
};

/*
  TÌNH TRẠNG BIỂN — mô tả, KHÔNG phán "đi hay không đi" (bà con có lịch
  chuyến của mình; app đưa điều kiện, quyết là việc của thuyền trưởng).
*/
const SEA_STATE: Record<SeaLevel, string> = {
  good: "Biển êm",
  caution: "Biển động nhẹ",
  bad: "Biển động mạnh",
};

// GeoJSON các vùng cá theo mùa — tĩnh, dựng một lần
const FISH_GEOJSON: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: FISH_REGIONS.map((r) => ({
    type: "Feature",
    properties: { id: r.id },
    geometry: { type: "Polygon", coordinates: [[...r.polygon, r.polygon[0]]] },
  })),
};

const THIS_MONTH = new Date().getMonth() + 1;

// Ranh giới biển VN không đổi → tạo GeoJSON một lần ở cấp module.
const BORDER_DATA = borderGeoJSON();

// màu cảnh báo theo mức gần ranh giới
const BORDER_LEVEL_STYLE: Record<BorderLevel, { bg: string; fg: string }> = {
  ok: { bg: "var(--ok-bg)", fg: "var(--ok)" },
  near: { bg: "var(--warn-bg)", fg: "var(--warn)" },
  very_near: { bg: "var(--danger-bg)", fg: "var(--danger)" },
};

// Cảnh báo nước cạn tại điểm chạm — từ lưới độ sâu tĩnh (depth-grid.ts).
// Chỉ nói khi có chuyện (rất cạn / nông); nước đủ sâu thì im.
const DEPTH_NOTE: Partial<Record<DepthClass, { text: string; danger: boolean }>> = {
  1: { text: "Chỗ này rất cạn, bãi nổi — coi chừng mắc cạn.", danger: true },
  2: { text: "Nước nông (cỡ 4–12 m) — để ý con nước.", danger: false },
};

const PORT_KEY = "forfish.port.v1";
const MAP_LAYER_KEY = "forfish.maplayer.v1";

// Lớp mở app: HẢI ĐỒ — chuẩn mọi app hàng hải (Navionics/C-MAP/OpenCPN đều
// mặc định nautical chart, vệ tinh chỉ là tuỳ chọn — docs/research/09).
// Người dùng đổi lớp thì nhớ cho lần sau. Đọc thẳng localStorage được vì
// cả cây bản đồ đã next/dynamic ssr:false.
function initialLayerId(): OceanLayerId {
  try {
    const v = window.localStorage.getItem(MAP_LAYER_KEY);
    if (v && v in OCEAN_LAYERS) return v as OceanLayerId;
  } catch {
    // không có window/storage → dùng mặc định
  }
  return "bathymetry";
}

function initialPort(): FishingPort {
  let saved: string | null = null;
  try {
    saved = window.localStorage.getItem(PORT_KEY);
  } catch {
    // bỏ qua
  }
  return (
    PORTS.find((p) => p.id === saved) ??
    PORTS.find((p) => p.id === "vung-tau") ??
    PORTS[0]
  );
}

export default function FishingMapView() {
  const mapRef = useRef<MapRef>(null);
  const [layerId, setLayerIdState] = useState<OceanLayerId>(initialLayerId);
  const setLayerId = useCallback((id: OceanLayerId) => {
    setLayerIdState(id);
    try {
      window.localStorage.setItem(MAP_LAYER_KEY, id);
    } catch {
      // storage đầy — chỉ mất phần nhớ lớp
    }
  }, []);
  const [seamarksOn, setSeamarksOn] = useState(true);
  const [fishOn, setFishOn] = useState(true);
  const [layerSheetOpen, setLayerSheetOpen] = useState(false);
  const [size, setSize] = useState<SheetSize>("peek");

  // ── dự báo vẽ động kiểu Windy: lớp gió/sóng + thanh thời gian ───────────
  const [forecastKind, setForecastKind] = useState<ForecastKind | null>(null);
  const [fGrid, setFGrid] = useState<ForecastGrid | null>(null);
  const [gridFailed, setGridFailed] = useState(false);
  const [timeIdx, setTimeIdx] = useState(0);
  const [playing, setPlaying] = useState(false);

  // tải lưới dự báo MỘT lần, khi người dùng bật lớp dự báo lần đầu
  useEffect(() => {
    if (!forecastKind || fGrid || gridFailed) return;
    let alive = true;
    fetchForecastGrid()
      .then((g) => alive && setFGrid(g))
      .catch(() => alive && setGridFailed(true));
    return () => {
      alive = false;
    };
  }, [forecastKind, fGrid, gridFailed]);

  // nút chạy ▶ — tự trượt thời gian như Windy
  useEffect(() => {
    if (!playing || !fGrid) return;
    const t = setInterval(
      () => setTimeIdx((i) => (i + 1) % fGrid.times.length),
      800,
    );
    return () => clearInterval(t);
  }, [playing, fGrid]);

  const arrows = useMemo(
    () =>
      forecastKind && fGrid
        ? arrowFeatures(fGrid, timeIdx, forecastKind)
        : null,
    [forecastKind, fGrid, timeIdx],
  );

  // cảng nhà + điểm đang xem — mở app thì điểm = vùng biển cảng nhà
  const [port, setPortState] = useState<FishingPort>(initialPort);
  const [point, setPoint] = useState<SeaPoint>(() => {
    const p = initialPort();
    return { lat: p.lat, lon: p.lon };
  });
  const atPort = point.lat === port.lat && point.lon === port.lon;

  // kết quả gắn với key của yêu cầu — "đang tải" suy ra từ key lệch nhau,
  // không setState đồng bộ trong effect
  const [result, setResult] = useState<{
    key: string;
    cond: SeaPointConditions | null;
  } | null>(null);
  const [retry, setRetry] = useState(0);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState(false);
  const [storms, setStorms] = useState<StormAlert[]>([]);
  // ngày đang xem dự báo: 0 = hôm nay … tới FORECAST_MAX_DAYS-1
  const [dayIdx, setDayIdx] = useState(0);
  // tuyến dẫn đường tiết kiệm dầu (route-planner.tsx) — vẽ đè lên bản đồ
  const [route, setRoute] = useState<PlannedRoute | null>(null);
  // hạng độ sâu tại điểm đang xem (null = chưa biết/không cảnh báo)
  const [depth, setDepth] = useState<DepthClass | null>(null);

  /** Bay tới điểm, dồn tâm lên nửa trên màn hình để sheet không che */
  const flyToPoint = useCallback((lon: number, lat: number, zoom?: number) => {
    const h = mapRef.current?.getContainer().clientHeight ?? 600;
    mapRef.current?.flyTo({
      center: [lon, lat],
      ...(zoom != null ? { zoom } : {}),
      offset: [0, -Math.round(h * 0.18)],
      duration: 650,
    });
  }, []);

  const choosePort = (id: string) => {
    const p = PORTS.find((x) => x.id === id);
    if (!p) return;
    try {
      window.localStorage.setItem(PORT_KEY, p.id);
    } catch {
      // bỏ qua
    }
    setPortState(p);
    setPoint({ lat: p.lat, lon: p.lon });
    setDayIdx(0);
    setRoute(null);
    flyToPoint(p.lon, p.lat, 6.5);
  };

  /** "Về cảng" — quay lại vùng biển cảng nhà */
  const goHome = () => {
    setPoint({ lat: port.lat, lon: port.lon });
    setDayIdx(0);
    setRoute(null);
    flyToPoint(port.lon, port.lat, 6.5);
  };

  const handleRoute = useCallback((r: PlannedRoute | null) => {
    setRoute(r);
    if (!r) return;
    const lons = r.plan.waypoints.map((w) => w.lon);
    const lats = r.plan.waypoints.map((w) => w.lat);
    // GIỮ sheet như đang mở (kết quả + cảnh báo đoạn dữ phải còn đọc được —
    // audit flow #1); tuyến vẫn thấy vì fitBounds chừa đáy bằng chiều sheet
    const h = mapRef.current?.getContainer().clientHeight ?? 600;
    mapRef.current?.fitBounds(
      [
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)],
      ],
      {
        padding: { top: 56, left: 40, right: 40, bottom: Math.round(h * 0.58) },
        maxZoom: 8,
        duration: 900,
      },
    );
  }, []);

  // tâm bão (nếu có) vẽ thẳng lên bản đồ
  useEffect(() => {
    let alive = true;
    fetchStormCheck().then((c) => alive && c.ok && setStorms(c.storms));
    return () => {
      alive = false;
    };
  }, []);

  // độ sâu tại điểm đang xem — lưới tĩnh, đọc cục bộ
  useEffect(() => {
    let alive = true;
    fetchDepthGrid()
      .then((g) => alive && setDepth(depthClassAt(g, point.lat, point.lon)))
      .catch(() => alive && setDepth(null));
    return () => {
      alive = false;
    };
  }, [point]);

  const layer = OCEAN_LAYERS[layerId];
  const dataDate = latestAvailableDate(new Date(), layer.lagDays);
  const mapStyle = useMemo(
    () =>
      buildMapStyle(layerId, new Date(), {
        seamarks: seamarksOn,
      }) as unknown as StyleSpecification,
    [layerId, seamarksOn],
  );

  const reqKey = `${point.lat},${point.lon}:${retry}`;
  useEffect(() => {
    let alive = true;
    fetchSeaPoint(point)
      .then((c) => alive && setResult({ key: reqKey, cond: c }))
      .catch(() => alive && setResult({ key: reqKey, cond: null }));
    return () => {
      alive = false;
    };
  }, [point, reqKey]);

  const loading = result?.key !== reqKey;
  const cond = loading ? null : (result?.cond ?? null);
  const errored = !loading && result?.cond === null;

  const goToMyBoat = useCallback(() => {
    if (!navigator.geolocation || locating) return;
    setLocating(true);
    setGeoError(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        // KHÔNG xoá tuyến — xem mình đang ở đâu không làm tuyến sai
        setDayIdx(0);
        setPoint(p);
        setSize("peek"); // để còn nhìn thấy vị trí trên map
        flyToPoint(p.lon, p.lat, 7);
        setLocating(false);
      },
      () => {
        setLocating(false);
        setGeoError(true); // audit flow: từ chối định vị không được câm
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }, [locating, flyToPoint]);

  const today = cond?.days[0] ?? null;
  // ngày đang chọn để xem dự báo (kẹp lại nếu nguồn trả ít ngày hơn)
  const sel =
    cond?.days[Math.min(dayIdx, (cond?.days.length ?? 1) - 1)] ?? null;
  const confidence = forecastConfidence(dayIdx);
  const prox = borderProximity(point.lat, point.lon);
  const depthNote = depth != null ? DEPTH_NOTE[depth] : undefined;
  // vùng cá tại điểm đang xem (tham khảo theo mùa)
  const fishRegion = regionAt(point.lat, point.lon);
  const fishHere = fishRegion
    ? fishInRegion(fishRegion.id, THIS_MONTH).map((s) => s.species)
    : [];

  // tóm tắt điều kiện — con số nói chuyện, không phán đi/ở
  const condSummary = sel
    ? dayIdx === 0 && cond
      ? `Sóng ${cond.waveM != null ? `${formatNumberVN(cond.waveM)} m` : "—"} · Gió cấp ${beaufort(cond.windKmh)}${
          cond.windDirDeg != null ? ` ${windDirectionVN(cond.windDirDeg)}` : ""
        }`
      : `Sóng tới ${sel.waveMaxM > 0 ? `${formatNumberVN(sel.waveMaxM)} m` : "—"} · Gió tới cấp ${beaufort(sel.windMaxKmh)}`
    : "";

  // dòng "ở đâu" nói tiếng người: gần cảng nhà / cách cảng X hải lý hướng Y
  const whereLine = atPort
    ? `Vùng biển gần cảng ${port.name}`
    : (() => {
        const nm = haversineKm(port.lat, port.lon, point.lat, point.lon) / 1.852;
        const dir = windDirectionVN(
          bearingDeg(port.lat, port.lon, point.lat, point.lon),
        );
        return `Cách cảng ${port.name} ~${Math.round(nm)} hải lý hướng ${dir}`;
      })();

  return (
    <div className="relative h-full w-full overflow-hidden bg-t1-bg">
      {/* ── BẢN ĐỒ — cả màn hình ─────────────────────────────────────────── */}
      <MapGL
        ref={mapRef}
        initialViewState={DEFAULT_VIEW}
        mapStyle={mapStyle}
        // giữ khung nhìn quanh vùng biển VN — zoom xa quá nhãn chồng nhau,
        // ảnh vệ tinh vỡ và bà con lạc khỏi vùng cần xem
        minZoom={4}
        maxBounds={[
          [96, 1],
          [124, 26],
        ]}
        style={{ width: "100%", height: "100%" }}
        onClick={(e) => {
          // đổi điểm xem → tuyến cũ không còn đúng đích, ngày xem về hôm nay
          const lat = Math.round(e.lngLat.lat * 1000) / 1000;
          const lon = Math.round(e.lngLat.lng * 1000) / 1000;
          setRoute(null);
          setDayIdx(0);
          setGeoError(false);
          setPoint({ lat, lon });
          setSize("half");
          // dồn điểm chạm lên nửa trên — sheet half không che mất pin
          flyToPoint(lon, lat);
        }}
      >
        {/* đường ranh giới biển VN — cảnh báo vượt vùng (chống IUU).
            Cam đỏ là MÀU ĐỘC QUYỀN của ranh giới trên bản đồ này. */}
        <Source id="vn-border" type="geojson" data={BORDER_DATA}>
          <Layer
            id="vn-border-casing"
            type="line"
            paint={{
              "line-color": "#ffffff",
              "line-width": 4,
              "line-opacity": 0.5,
            }}
          />
          <Layer
            id="vn-border-line"
            type="line"
            paint={{
              "line-color": "#e4572e",
              "line-width": 2,
              "line-dasharray": [2, 1.5],
            }}
          />
        </Source>

        {/* vùng cá theo mùa — viền mảnh, không lấn nội dung */}
        {fishOn && (
          <Source id="fish-regions" type="geojson" data={FISH_GEOJSON}>
            <Layer
              id="fish-regions-fill"
              type="fill"
              paint={{ "fill-color": "#f2a01f", "fill-opacity": 0.05 }}
            />
            <Layer
              id="fish-regions-line"
              type="line"
              paint={{
                "line-color": "#b07816",
                "line-width": 1,
                "line-opacity": 0.45,
                "line-dasharray": [3, 2.5],
              }}
            />
          </Source>
        )}

        {/* mũi tên dự báo gió/sóng theo giờ (kiểu Windy) */}
        {arrows && (
          <Source id="forecast-arrows" type="geojson" data={arrows}>
            <Layer
              id="forecast-arrows-line"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{
                "line-color": (forecastKind === "wind"
                  ? WIND_COLOR_EXPR
                  : WAVE_COLOR_EXPR) as unknown as string,
                "line-width": 2.5,
              }}
            />
          </Source>
        )}

        {/* nhãn vùng cá: loài đang vụ tháng này */}
        {fishOn &&
          FISH_REGIONS.map((r) => {
            const species = fishInRegion(r.id, THIS_MONTH)
              .slice(0, 2)
              .map((s) =>
                s.species
                  .replace(/\s*\(.*?\)/, "") // nhãn bản đồ rút gọn — tên đầy đủ ở sheet
                  .replace(/^Cá /, "cá ")
                  .replace(/^Mực /, "mực "),
              );
            if (species.length === 0) return null;
            return (
              <Marker
                key={r.id}
                longitude={r.labelAt[0]}
                latitude={r.labelAt[1]}
                anchor="center"
              >
                <span className="pointer-events-none flex max-w-[150px] items-center gap-1 rounded-full bg-white/85 px-2 py-0.5 text-[11px] font-bold leading-tight text-t3 shadow-sm">
                  <FishIcon className="h-3.5 w-3.5 shrink-0" />
                  {species.join(", ")}
                </span>
              </Marker>
            );
          })}

        {/* nhãn chủ quyền — luôn nằm trên mọi lớp ảnh; chữ to cho mắt 40-60,
            halo trắng đọc được trên mọi nền (audit lớp #9) */}
        {SOVEREIGNTY_LABELS.map((s) => (
          <Marker key={s.name} longitude={s.lng} latitude={s.lat} anchor="center">
            <div
              className="pointer-events-none select-none text-center leading-tight"
              style={{
                color: "var(--navy)",
                textShadow:
                  "0 0 3px rgba(255,255,255,.95), 0 0 6px rgba(255,255,255,.9), 0 1px 10px rgba(255,255,255,.85)",
              }}
            >
              <div
                className={
                  s.kind === "sea"
                    ? "text-[14px] font-bold tracking-[0.18em]"
                    : "text-[13px] font-bold tracking-[0.06em]"
                }
              >
                {s.name}
              </div>
              {s.sub && (
                <div className="text-[11px] font-semibold italic">{s.sub}</div>
              )}
            </div>
          </Marker>
        ))}

        {/* tâm bão / áp thấp đang hoạt động */}
        {storms.map((s) => (
          <Marker key={s.id} longitude={s.lon} latitude={s.lat} anchor="center">
            <div className="pointer-events-none flex flex-col items-center text-danger">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-md ring-2 ring-danger">
                <AlertIcon className="h-6 w-6" />
              </span>
              <span className="mt-0.5 rounded bg-white/90 px-1.5 text-[11px] font-bold leading-tight">
                {s.kindLabel} {s.name}
              </span>
            </div>
          </Marker>
        ))}

        {/* tuyến dẫn đường tiết kiệm dầu + điểm xuất phát */}
        <RouteMapLayers route={route} />

        {/* điểm đang xem dự báo */}
        <Marker longitude={point.lon} latitude={point.lat} anchor="bottom">
          <PinIcon className="h-9 w-9 text-trim drop-shadow-[0_2px_3px_rgba(0,0,0,0.45)]" />
        </Marker>
      </MapGL>

      {/* ── VÙNG NỔI TRÊN CÙNG: tin bão (không gì che) + badge + FAB ──────── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 p-2">
        <StormBanner variant="overlay" />
        <div className="flex items-start justify-between gap-2">
          {/* badge lớp + ngày ảnh — bấm là mở chọn lớp (trung thực dữ liệu) */}
          <button
            type="button"
            onClick={() => setLayerSheetOpen(true)}
            className="pointer-events-auto max-w-[55%] rounded-xl bg-white/95 px-3 py-2 text-left shadow-sm ring-1 ring-line transition active:scale-[0.98]"
          >
            <span className="block text-[14px] font-bold leading-tight text-navy">
              {layer.label}
            </span>
            <span className="block text-[12px] leading-tight text-foreground/65">
              {layer.dated
                ? `Ảnh ngày ${formatDateVN(dataDate)} — chậm vài ngày`
                : "Hải đồ — không đổi theo ngày"}
            </span>
          </button>

          {/* cột FAB bên phải — kiểu Google Maps nhưng luôn kèm chữ */}
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={() => setLayerSheetOpen(true)}
              className="pointer-events-auto flex w-16 flex-col items-center justify-center gap-0.5 rounded-xl bg-card py-2 text-navy shadow-md ring-1 ring-line transition active:scale-95"
            >
              <LayersIcon className="h-6 w-6" />
              <span className="text-[12px] font-bold">Lớp</span>
            </button>
            <button
              type="button"
              onClick={goToMyBoat}
              disabled={locating}
              className="pointer-events-auto flex w-16 flex-col items-center justify-center gap-0.5 rounded-xl bg-card py-2 text-navy shadow-md ring-1 ring-line transition active:scale-95 disabled:opacity-60"
            >
              <CrosshairIcon className="h-6 w-6" />
              <span className="text-[12px] font-bold leading-tight">
                {locating ? "Đang tìm…" : "Tàu tôi"}
              </span>
            </button>
            {geoError && (
              <p className="pointer-events-auto max-w-[220px] rounded-lg bg-card px-2.5 py-1.5 text-right text-[13px] font-semibold leading-snug text-danger shadow-sm ring-1 ring-line">
                Chưa lấy được vị trí — kiểm tra đã bật Định vị cho điện thoại
                chưa.
              </p>
            )}
          </div>
        </div>

        {/* thanh thời gian dự báo (kiểu Windy) — chỉ hiện khi bật lớp gió/sóng */}
        {forecastKind && (
          <div className="pointer-events-auto rounded-xl bg-card/95 px-3 py-2 shadow-md ring-1 ring-line">
            {fGrid ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-bold text-navy">
                    {forecastKind === "wind" ? "Gió" : "Sóng"} ·{" "}
                    {timeLabelVN(
                      fGrid.times[timeIdx] ?? "",
                      fGrid.times[0]?.split("T")[0],
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPlaying((p) => !p)}
                    aria-label={playing ? "Dừng chạy" : "Chạy thử 3 ngày"}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-white active:scale-95"
                  >
                    {playing ? (
                      <PauseIcon className="h-4.5 w-4.5" />
                    ) : (
                      <PlayIcon className="h-4.5 w-4.5" />
                    )}
                  </button>
                </div>
                <input
                  type="range"
                  min={0}
                  max={fGrid.times.length - 1}
                  step={1}
                  value={Math.min(timeIdx, fGrid.times.length - 1)}
                  onChange={(e) => {
                    setPlaying(false);
                    setTimeIdx(Number(e.target.value));
                  }}
                  aria-label="Chọn giờ xem dự báo"
                  className="mt-1 h-2 w-full accent-[#14324f]"
                />
                <div className="flex justify-between text-[11px] font-semibold text-foreground/50">
                  <span>Bây giờ</span>
                  <span>Ngày mai</span>
                  <span>2 ngày</span>
                  <span>3 ngày</span>
                </div>
              </>
            ) : gridFailed ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-[14px] font-semibold text-danger">
                  Chưa tải được dự báo — kiểm tra mạng.
                </p>
                <button
                  type="button"
                  onClick={() => setGridFailed(false)}
                  className="shrink-0 rounded-lg bg-navy px-4 py-2.5 text-[15px] font-bold text-white"
                >
                  Thử lại
                </button>
              </div>
            ) : (
              <p className="text-[13px] font-semibold text-foreground/60">
                Đang tải dự báo cho cả vùng biển…
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── SHEET ĐÁY 3 NẤC — một chế độ duy nhất ────────────────────────── */}
      <SnapSheet
        size={size}
        onSizeChange={setSize}
        onClose={atPort ? undefined : goHome}
        closeLabel="Về cảng"
        label="Gió sóng chỗ đang xem"
        peek={
          loading ? (
            <p className="py-3 text-[16px] font-semibold text-foreground/60">
              Đang lấy dự báo sóng gió…
            </p>
          ) : errored ? (
            <p className="py-3 text-[15px] font-semibold text-danger">
              Chưa lấy được dự báo — bấm Xem thêm để thử lại.
            </p>
          ) : cond && !cond.onSea ? (
            <p className="py-3 text-[15px] font-semibold leading-snug text-foreground/75">
              Chỗ này trên đất liền — chạm ra biển, hoặc bấm Về cảng để xem
              vùng biển cảng nhà.
            </p>
          ) : sel ? (
            <div className="py-1">
              <div className="flex items-center gap-2">
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-full"
                  style={{ backgroundColor: LEVEL_STYLE[sel.level].fg }}
                  aria-hidden
                />
                <span
                  className="display text-[19px] font-bold leading-snug"
                  style={{ color: LEVEL_STYLE[sel.level].fg }}
                >
                  {SEA_STATE[sel.level]}
                </span>
                <span className="text-[15px] font-semibold text-foreground/60">
                  — {dayLabel(sel.date, dayIdx).toLowerCase()}
                </span>
              </div>
              <p className="text-[15px] font-semibold leading-snug text-foreground/80">
                {condSummary}
              </p>
              <p className="text-[13px] leading-snug text-foreground/55">
                {whereLine}
              </p>
              {atPort && (
                <p className="mt-1 text-[14px] font-semibold text-t1">
                  Chạm vào chỗ nào trên biển để xem gió sóng chỗ đó.
                </p>
              )}
              {prox.level !== "ok" && (
                <p className="mt-1 text-[14px] font-bold text-danger">
                  {prox.label} — coi chừng vượt ranh giới.
                </p>
              )}
            </div>
          ) : null
        }
      >
        <div className="space-y-3">
          {/* cảnh báo ranh giới đầy đủ — chỉ khi đáng nói */}
          {prox.level !== "ok" && (
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[15px] font-semibold ring-1 ring-line"
              style={{
                backgroundColor: BORDER_LEVEL_STYLE[prox.level].bg,
                color: BORDER_LEVEL_STYLE[prox.level].fg,
              }}
            >
              <AlertIcon className="h-5 w-5 shrink-0" />
              <span>
                {prox.label}. Giữ khoảng cách, nghe Biên phòng — vượt ranh
                giới bị phạt rất nặng.
              </span>
            </div>
          )}

          {errored && (
            <button
              type="button"
              onClick={() => setRetry((n) => n + 1)}
              className="min-h-[56px] w-full rounded-xl bg-t1 text-[18px] font-bold text-white transition active:scale-[0.99]"
            >
              Thử lại
            </button>
          )}

          {cond && cond.onSea && today && sel && (
            <>
              {/* chọn xem trước ngày nào — gió/sóng dự báo được tới 10 ngày */}
              <div
                className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
                role="group"
                aria-label="Chọn ngày xem dự báo"
              >
                {cond.days.map((d, i) => {
                  const active = i === Math.min(dayIdx, cond.days.length - 1);
                  return (
                    <button
                      key={d.date}
                      type="button"
                      onClick={() => setDayIdx(i)}
                      aria-pressed={active}
                      className={`flex min-h-[60px] min-w-[78px] shrink-0 flex-col items-center justify-center rounded-xl px-2 transition active:scale-[0.97] ${
                        active
                          ? "bg-navy text-white shadow-sm"
                          : "bg-card ring-1 ring-line"
                      }`}
                    >
                      <span
                        className={`text-[13px] font-bold leading-tight ${
                          active ? "text-white/85" : "text-foreground/60"
                        }`}
                      >
                        {chipLabel(d.date, i)}
                      </span>
                      <span
                        className="display text-[16px] font-bold leading-tight"
                        style={{
                          color: active ? "#fff" : LEVEL_STYLE[d.level].fg,
                        }}
                      >
                        {d.waveMaxM > 0
                          ? `${formatNumberVN(d.waveMaxM)} m`
                          : `gió c${beaufort(d.windMaxKmh)}`}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* tình trạng biển ngày đã chọn — mô tả điều kiện, không phán */}
              <div
                className="rounded-xl p-4 ring-1 ring-line"
                style={{ backgroundColor: LEVEL_STYLE[sel.level].bg }}
              >
                <p className="mb-1 text-[14px] font-bold uppercase tracking-wide text-foreground/50">
                  {dayLabel(sel.date, dayIdx)}
                </p>
                <p
                  className="display text-[24px] font-bold leading-tight"
                  style={{ color: LEVEL_STYLE[sel.level].fg }}
                >
                  {SEA_STATE[sel.level]}
                </p>
                <p className="mt-1 text-[16px] font-semibold leading-snug text-foreground/80">
                  Sóng tới{" "}
                  {sel.waveMaxM > 0
                    ? `${formatNumberVN(sel.waveMaxM)} m`
                    : "— (chưa có số)"}{" "}
                  · Gió tới cấp {beaufort(sel.windMaxKmh)}
                  {sel.gustMaxKmh > 0 &&
                    `, giật cấp ${beaufort(sel.gustMaxKmh)}`}
                </p>
              </div>

              {/* cá mùa này tại vùng biển đang xem — tham khảo */}
              {fishHere.length > 0 && (
                <div className="flex items-start gap-2.5 rounded-xl bg-card p-3.5 ring-1 ring-line">
                  <FishIcon className="mt-0.5 h-5 w-5 shrink-0 text-t3" />
                  <p className="text-[15px] leading-snug text-foreground/80">
                    Mùa này vùng <b>{fishRegion?.name}</b> thường có:{" "}
                    <b>{fishHere.join(", ")}</b>{" "}
                    <span className="text-foreground/55">
                      (mùa vụ nhiều năm — tham khảo)
                    </span>
                  </p>
                </div>
              )}

              {/* nước cạn tại chỗ này — chỉ nói khi có chuyện */}
              {depthNote && (
                <p
                  className={`rounded-xl px-4 py-3 text-[16px] font-bold ${
                    depthNote.danger
                      ? "bg-danger-bg text-danger"
                      : "bg-warn-bg text-warn"
                  }`}
                >
                  {depthNote.text}
                </p>
              )}

              {/* dẫn đường tiết kiệm dầu — hành động chính, để cao cho khỏi
                  cuộn mới thấy (audit flow #10); key remount khi đổi đích */}
              <RoutePlanner
                key={`${cond.point.lat},${cond.point.lon}`}
                dest={cond.point}
                onRoute={handleRoute}
              />

              {/* hôm nay có thêm số đo LÚC NÀY (ngày sau đã gọn trong thẻ trên) */}
              {dayIdx === 0 && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-card p-4 ring-1 ring-line">
                    <div className="flex items-center gap-2 text-t1">
                      <WindIcon className="h-5 w-5" />
                      <span className="text-[15px] font-bold">Gió lúc này</span>
                    </div>
                    <p className="display mt-1.5 text-[24px] font-bold leading-none text-navy">
                      Cấp {beaufort(cond.windKmh)}
                    </p>
                    <p className="mt-1 text-[14px] leading-snug text-foreground/65">
                      {Math.round(cond.windKmh)} km/giờ
                      {cond.windDirDeg != null &&
                        ` · hướng ${windDirectionVN(cond.windDirDeg)}`}
                    </p>
                  </div>
                  <div className="rounded-xl bg-card p-4 ring-1 ring-line">
                    <div className="flex items-center gap-2 text-t1">
                      <WavesIcon className="h-5 w-5" />
                      <span className="text-[15px] font-bold">
                        Sóng lúc này
                      </span>
                    </div>
                    {cond.waveM != null ? (
                      <p className="display mt-1.5 text-[24px] font-bold leading-none text-navy">
                        {formatNumberVN(cond.waveM)} m
                      </p>
                    ) : (
                      <p className="mt-1.5 text-[15px] leading-snug text-foreground/65">
                        Chỗ này sát bờ, chưa có số sóng — xem gió là chính.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* mưa/dông của ngày đã chọn */}
              {(() => {
                const w = weatherFromCode(sel.wmoCode);
                return (
                  w && (
                    <p
                      className={`rounded-xl px-4 py-3 text-[16px] font-bold ${
                        w.danger
                          ? "bg-danger-bg text-danger"
                          : "bg-card text-foreground/75 ring-1 ring-line"
                      }`}
                    >
                      {w.label}
                    </p>
                  )
                );
              })()}

              {/* độ tin theo tầm xa + lời dặn nghe đài — gọn 1 khối */}
              <p
                className={`px-1 text-[14px] font-semibold leading-snug ${
                  confidence.tone === "ok" ? "text-foreground/55" : "text-warn"
                }`}
              >
                {confidence.label}. Chỉ để tham khảo — trước khi đi, nghe thêm
                đài duyên hải, Biên phòng.
              </p>

              {/* cảng nhà — đổi 1 lần rồi quên, nên nằm cuối */}
              <label className="block border-t border-line pt-3">
                <span className="mb-1.5 flex items-center gap-2 text-[15px] font-bold text-navy">
                  <AnchorIcon className="h-5 w-5" />
                  Cảng nhà của tôi
                </span>
                <select
                  value={port.id}
                  onChange={(e) => choosePort(e.target.value)}
                  className="min-h-[52px] w-full rounded-lg border-2 border-line bg-card px-4 text-[16px] font-semibold focus:border-sea focus:outline-none"
                >
                  {PORTS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.province})
                    </option>
                  ))}
                </select>
              </label>

              {/* danh bạ cảng — cùng nhóm "cảng" với select trên */}
              <Link
                href="/cang"
                className="flex min-h-[52px] items-center gap-2.5 rounded-xl bg-card px-4 ring-1 ring-line transition active:scale-[0.99]"
              >
                <AnchorIcon className="h-5 w-5 shrink-0 text-t1" />
                <span className="flex-1 text-[16px] font-bold text-navy">
                  Danh bạ cảng cá
                </span>
                <ChevronRightIcon className="h-5 w-5 text-foreground/30" />
              </Link>

              {/* toạ độ — cho ai cần đọc vào máy định vị */}
              <p className="px-1 text-[13px] text-foreground/45">
                Toạ độ điểm đang xem: {formatNumberVN(point.lat, 2)}°B ·{" "}
                {formatNumberVN(point.lon, 2)}°Đ
              </p>
            </>
          )}
        </div>
      </SnapSheet>

      {/* ── SHEET CHỌN LỚP (modal, kiểu Google Maps) ─────────────────────── */}
      {layerSheetOpen && (
        <LayerSheet
          layerId={layerId}
          onLayer={setLayerId}
          forecastKind={forecastKind}
          onForecast={(k) => {
            setForecastKind(k);
            if (k == null) setPlaying(false);
            else setGridFailed(false); // bật lại lớp = thử tải lại nếu lần trước lỗi
          }}
          fishOn={fishOn}
          onFish={setFishOn}
          seamarksOn={seamarksOn}
          onSeamarks={setSeamarksOn}
          onClose={() => setLayerSheetOpen(false)}
        />
      )}
    </div>
  );
}
