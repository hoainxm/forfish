"use client";

/**
 * Trục 1 — màn hình "Ra khơi" kiểu Google Maps: BẢN ĐỒ LÀ CẢ TRANG.
 *   · map full-screen; mọi điều khiển nổi: tin bão (trên cùng, không gì che),
 *     badge lớp+ngày ảnh (trái), FAB "Lớp"/"Tàu tôi" (cột phải)
 *   · sheet đáy 3 nấc (ui/snap-sheet): mặc định = dự báo theo cảng;
 *     chạm vào biển = gió sóng + dẫn đường tại điểm đó
 *   · lớp dữ liệu chọn trong layer-sheet (kiểu Google Maps); nhãn chủ quyền,
 *     ranh giới biển VN, tâm bão LUÔN hiện — không có công tắc
 * UI cho người 40–60 tuổi: nút to ≥52px, chữ to, từ đời thường, không gesture khó.
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
  DEFAULT_POINT,
  DEFAULT_VIEW,
  OCEAN_LAYERS,
  SEA_MASK_COLOR,
  SOVEREIGNTY_LABELS,
  type OceanLayerId,
} from "@/lib/ocean-map";
import { fetchSeaForecast, LEVEL_LABEL, type ScoredSeaDay, type SeaLevel } from "@/lib/sea";
import { PORTS, type FishingPort } from "@/data/ports";
import {
  RouteMapLayers,
  RoutePlanner,
  type PlannedRoute,
} from "@/components/route-planner";
import { borderGeoJSON } from "@/data/vn-maritime-border";
import { borderProximity, type BorderLevel } from "@/lib/geofence";
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
  CrosshairIcon,
  LayersIcon,
  PinIcon,
  WavesIcon,
  WindIcon,
} from "@/components/icons";

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

const LEVEL_STYLE: Record<SeaLevel, { bg: string; fg: string }> = {
  good: { bg: "var(--ok-bg)", fg: "var(--ok)" },
  caution: { bg: "var(--warn-bg)", fg: "var(--warn)" },
  bad: { bg: "var(--danger-bg)", fg: "var(--danger)" },
};

const LEVEL_ADVICE: Record<SeaLevel, string> = {
  good: "Vẫn nên xem lại dự báo trước giờ xuất bến.",
  caution: "Tàu nhỏ nên đi gần bờ, để ý gió đổi chiều.",
  bad: "Ở bờ chờ biển êm, nghe bản tin thời tiết biển trước khi quyết.",
};

// Ranh giới biển VN không đổi → tạo GeoJSON một lần ở cấp module.
const BORDER_DATA = borderGeoJSON();

// màu cảnh báo theo mức gần ranh giới
const BORDER_LEVEL_STYLE: Record<BorderLevel, { bg: string; fg: string }> = {
  ok: { bg: "var(--ok-bg)", fg: "var(--ok)" },
  near: { bg: "var(--warn-bg)", fg: "var(--warn)" },
  very_near: { bg: "var(--danger-bg)", fg: "var(--danger)" },
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
  const [layerSheetOpen, setLayerSheetOpen] = useState(false);

  // sheet đáy: chế độ cảng (mặc định) hoặc điểm chạm; 3 nấc
  const [mode, setMode] = useState<"port" | "point">("port");
  const [size, setSize] = useState<SheetSize>("peek");

  const [point, setPoint] = useState<SeaPoint>(DEFAULT_POINT);
  // kết quả gắn với key của yêu cầu — "đang tải" suy ra từ key lệch nhau,
  // không setState đồng bộ trong effect
  const [result, setResult] = useState<{
    key: string;
    cond: SeaPointConditions | null;
  } | null>(null);
  const [retry, setRetry] = useState(0);
  const [locating, setLocating] = useState(false);
  const [storms, setStorms] = useState<StormAlert[]>([]);
  // ngày đang xem dự báo: 0 = hôm nay … tới FORECAST_MAX_DAYS-1
  const [dayIdx, setDayIdx] = useState(0);
  // tuyến dẫn đường tiết kiệm dầu (route-planner.tsx) — vẽ đè lên bản đồ
  const [route, setRoute] = useState<PlannedRoute | null>(null);

  // ── dự báo theo cảng (nội dung mặc định của sheet) ──────────────────────
  // component này ssr:false → đọc localStorage trong initializer là an toàn
  const [port, setPortState] = useState<FishingPort>(() => {
    const saved =
      typeof window !== "undefined"
        ? window.localStorage.getItem(PORT_KEY)
        : null;
    return (
      PORTS.find((p) => p.id === saved) ??
      PORTS.find((p) => p.id === "vung-tau") ??
      PORTS[0]
    );
  });
  const [portRes, setPortRes] = useState<{
    key: string;
    days: ScoredSeaDay[] | null;
  } | null>(null);
  const [portRetry, setPortRetry] = useState(0);
  const portKey = `${port.id}:${portRetry}`;
  useEffect(() => {
    let alive = true;
    fetchSeaForecast(port)
      .then((d) => alive && setPortRes({ key: portKey, days: d }))
      .catch(() => alive && setPortRes({ key: portKey, days: null }));
    return () => {
      alive = false;
    };
  }, [port, portKey]);
  const portLoading = portRes?.key !== portKey;
  const portDays = portLoading ? null : (portRes?.days ?? null);
  const portError = !portLoading && portRes?.days === null;
  const portToday = portDays?.[0] ?? null;

  const choosePort = (id: string) => {
    const p = PORTS.find((x) => x.id === id);
    if (!p) return;
    window.localStorage.setItem(PORT_KEY, p.id);
    setPortState(p);
    mapRef.current?.flyTo({ center: [p.lon, p.lat], zoom: 6.5 });
  };

  const handleRoute = useCallback((r: PlannedRoute | null) => {
    setRoute(r);
    if (!r) return;
    const lons = r.plan.waypoints.map((w) => w.lon);
    const lats = r.plan.waypoints.map((w) => w.lat);
    mapRef.current?.fitBounds(
      [
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)],
      ],
      { padding: 48, maxZoom: 8, duration: 900 },
    );
    // có tuyến rồi → thu sheet về peek cho bà con nhìn tuyến trên bản đồ
    setSize("peek");
  }, []);

  // tâm bão (nếu có) vẽ thẳng lên bản đồ — bà con thấy bão nằm đâu so với
  // vùng mình định đi
  useEffect(() => {
    let alive = true;
    fetchStormCheck().then((c) => alive && c.ok && setStorms(c.storms));
    return () => {
      alive = false;
    };
  }, []);

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
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setRoute(null);
        setDayIdx(0);
        setPoint(p);
        setMode("point");
        setSize("peek"); // để còn nhìn thấy vị trí trên map
        mapRef.current?.flyTo({ center: [p.lon, p.lat], zoom: 7 });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }, [locating]);

  const closePoint = () => {
    setMode("port");
    setRoute(null);
    setSize("peek");
  };

  const today = cond?.days[0] ?? null;
  // ngày đang chọn để xem dự báo (kẹp lại nếu nguồn trả ít ngày hơn)
  const sel =
    cond?.days[Math.min(dayIdx, (cond?.days.length ?? 1) - 1)] ?? null;
  const confidence = forecastConfidence(dayIdx);
  const prox = mode === "point" ? borderProximity(point.lat, point.lon) : null;

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
          setRoute(null);
          setDayIdx(0);
          setPoint({
            lat: Math.round(e.lngLat.lat * 1000) / 1000,
            lon: Math.round(e.lngLat.lng * 1000) / 1000,
          });
          setMode("point");
          setSize("half");
        }}
      >
        {/* đường ranh giới biển VN — cảnh báo vượt vùng (chống IUU) */}
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

        {/* nhãn chủ quyền — luôn nằm trên mọi lớp ảnh */}
        {SOVEREIGNTY_LABELS.map((s) => (
          <Marker key={s.name} longitude={s.lng} latitude={s.lat} anchor="center">
            <div
              className="pointer-events-none select-none text-center leading-tight"
              style={{
                color: "var(--navy)",
                textShadow: `0 0 3px ${SEA_MASK_COLOR}, 0 0 6px ${SEA_MASK_COLOR}, 0 1px 8px rgba(255,255,255,.9)`,
              }}
            >
              <div
                className={
                  s.kind === "sea"
                    ? "text-[12px] font-bold tracking-[0.2em]"
                    : "text-[11px] font-bold tracking-[0.08em]"
                }
              >
                {s.name}
              </div>
              {s.sub && (
                <div className="text-[10px] font-semibold italic">{s.sub}</div>
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
        {mode === "point" && (
          <Marker longitude={point.lon} latitude={point.lat} anchor="bottom">
            <PinIcon className="h-9 w-9 text-trim drop-shadow-[0_2px_3px_rgba(0,0,0,0.45)]" />
          </Marker>
        )}
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
                : "Bản đồ độ sâu — không đổi theo ngày"}
            </span>
          </button>

          {/* cột FAB bên phải — kiểu Google Maps nhưng luôn kèm chữ */}
          <div className="flex flex-col gap-2">
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
          </div>
        </div>
      </div>

      {/* ── SHEET ĐÁY 3 NẤC ──────────────────────────────────────────────── */}
      <SnapSheet
        size={size}
        onSizeChange={setSize}
        onClose={mode === "point" ? closePoint : undefined}
        label={
          mode === "port" ? "Dự báo theo cảng" : "Gió sóng chỗ đang xem"
        }
        peek={
          mode === "port" ? (
            // ── peek CẢNG: mở app là biết hôm nay đi hay ở ──
            portLoading ? (
              <p className="py-3 text-[16px] font-semibold text-foreground/60">
                Đang lấy dự báo sóng gió…
              </p>
            ) : portToday ? (
              <div className="flex items-center gap-3 py-1">
                <span
                  className="display shrink-0 text-[40px] font-bold leading-none"
                  style={{ color: LEVEL_STYLE[portToday.level].fg }}
                >
                  {portToday.score}
                </span>
                <span className="min-w-0">
                  <span
                    className="block text-[16px] font-bold leading-snug"
                    style={{ color: LEVEL_STYLE[portToday.level].fg }}
                  >
                    {LEVEL_LABEL[portToday.level]} — hôm nay
                  </span>
                  <span className="block truncate text-[13px] text-foreground/60">
                    Gần cảng {port.name} · Chạm vào biển để xem chỗ khác
                  </span>
                </span>
              </div>
            ) : (
              <p className="py-3 text-[15px] font-semibold text-foreground/70">
                Chưa lấy được dự báo — bấm Xem thêm để thử lại.
              </p>
            )
          ) : // ── peek ĐIỂM CHẠM ──
          loading ? (
            <p className="py-3 text-[16px] font-semibold text-foreground/60">
              Đang lấy dự báo gió sóng…
            </p>
          ) : errored ? (
            <p className="py-3 text-[15px] font-semibold text-danger">
              Chưa lấy được dự báo — bấm Xem thêm để thử lại.
            </p>
          ) : cond && !cond.onSea ? (
            <p className="py-3 text-[15px] font-semibold leading-snug text-foreground/75">
              Chỗ này là đất liền — chạm ra ngoài biển để xem gió sóng.
            </p>
          ) : sel ? (
            <div className="flex items-center gap-3 py-1">
              <span
                className="display shrink-0 text-[40px] font-bold leading-none"
                style={{ color: LEVEL_STYLE[sel.level].fg }}
              >
                {sel.score}
              </span>
              <span className="min-w-0">
                <span
                  className="block text-[16px] font-bold leading-snug"
                  style={{ color: LEVEL_STYLE[sel.level].fg }}
                >
                  {LEVEL_LABEL[sel.level]} — {dayLabel(sel.date, dayIdx).toLowerCase()}
                </span>
                <span className="block truncate text-[13px] text-foreground/60">
                  {formatNumberVN(point.lat, 2)}°B · {formatNumberVN(point.lon, 2)}
                  °Đ{prox ? ` · ${prox.label.toLowerCase()}` : ""}
                </span>
              </span>
            </div>
          ) : null
        }
      >
        {mode === "port" ? (
          // ── body CẢNG ──
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1.5 flex items-center gap-2 text-[16px] font-bold text-navy">
                <AnchorIcon className="h-5 w-5" />
                Vùng biển gần cảng
              </span>
              <select
                value={port.id}
                onChange={(e) => choosePort(e.target.value)}
                className="min-h-[52px] w-full rounded-lg border-2 border-line bg-card px-4 text-[17px] font-semibold focus:border-sea focus:outline-none"
              >
                {PORTS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.province})
                  </option>
                ))}
              </select>
            </label>

            {portError && (
              <div className="rounded-xl bg-card p-4 text-center ring-1 ring-line">
                <p className="text-[16px] text-foreground/70">
                  Chưa lấy được dự báo. Kiểm tra mạng rồi thử lại.
                </p>
                <button
                  type="button"
                  onClick={() => setPortRetry((n) => n + 1)}
                  className="mt-3 min-h-[52px] w-full rounded-xl bg-t1 text-[17px] font-bold text-white transition active:scale-[0.99]"
                >
                  Thử lại
                </button>
              </div>
            )}

            {portToday && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-card p-4 ring-1 ring-line">
                  <div className="flex items-center gap-2 text-t1">
                    <WavesIcon className="h-5 w-5" />
                    <span className="text-[15px] font-bold">Sóng hôm nay</span>
                  </div>
                  <p className="display mt-1.5 text-[24px] font-bold leading-none text-navy">
                    {formatNumberVN(portToday.waveMaxM)} m
                  </p>
                </div>
                <div className="rounded-xl bg-card p-4 ring-1 ring-line">
                  <div className="flex items-center gap-2 text-t1">
                    <WindIcon className="h-5 w-5" />
                    <span className="text-[15px] font-bold">Gió hôm nay</span>
                  </div>
                  <p className="display mt-1.5 text-[24px] font-bold leading-none text-navy">
                    Cấp {beaufort(portToday.windMaxKmh)}
                  </p>
                  <p className="mt-1 text-[14px] text-foreground/65">
                    {Math.round(portToday.windMaxKmh)} km/giờ
                  </p>
                </div>
              </div>
            )}

            {portDays && portDays.length > 1 && (
              <div>
                <h3 className="display mb-2 text-[16px] font-bold text-navy">
                  Những ngày tới
                </h3>
                <ul className="overflow-hidden rounded-xl bg-card ring-1 ring-line">
                  {portDays.slice(1).map((d, i) => {
                    const w = weatherFromCode(d.wmoCode);
                    return (
                      <li
                        key={d.date}
                        className={`flex items-center gap-3 px-4 py-3 ${
                          i > 0 ? "border-t border-line" : ""
                        }`}
                      >
                        <span className="w-[92px] shrink-0 text-[15px] font-semibold">
                          {chipLabel(d.date, i + 1)}
                        </span>
                        <span
                          className="display w-[52px] shrink-0 rounded-lg py-1 text-center text-[18px] font-bold"
                          style={{
                            color: LEVEL_STYLE[d.level].fg,
                            backgroundColor: LEVEL_STYLE[d.level].bg,
                          }}
                        >
                          {d.score}
                        </span>
                        <span className="min-w-0 flex-1 text-right text-[14px] leading-snug text-foreground/60">
                          sóng {formatNumberVN(d.waveMaxM)} m · gió{" "}
                          {Math.round(d.windMaxKmh)} km/h
                          {w && (
                            <span
                              className={
                                w.danger ? "font-bold text-danger" : undefined
                              }
                            >
                              {" "}
                              · {w.label}
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <p className="rounded-lg bg-t1-bg px-3 py-2.5 text-[14px] font-semibold leading-snug text-t1">
              Dự báo từ mô hình thời tiết quốc tế, chỉ để tham khảo. Trước khi
              ra khơi, bà con nghe thêm thông báo của đài duyên hải và Bộ đội
              Biên phòng.
            </p>
          </div>
        ) : (
          // ── body ĐIỂM CHẠM ──
          <div className="space-y-3">
            {prox && prox.level !== "ok" && (
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
                className="min-h-[56px] w-full rounded-xl bg-t1 text-[17px] font-bold text-white transition active:scale-[0.99]"
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
                          className="display text-[20px] font-bold leading-tight"
                          style={{
                            color: active ? "#fff" : LEVEL_STYLE[d.level].fg,
                          }}
                        >
                          {d.score}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* điểm đi biển của ngày đã chọn — cùng thang với dự báo theo cảng */}
                <div
                  className="rounded-xl p-4 ring-1 ring-line"
                  style={{ backgroundColor: LEVEL_STYLE[sel.level].bg }}
                >
                  <p className="mb-2 text-[14px] font-bold uppercase tracking-wide text-foreground/50">
                    {dayLabel(sel.date, dayIdx)}
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="shrink-0 text-center">
                      <div
                        className="display text-[44px] font-bold leading-none"
                        style={{ color: LEVEL_STYLE[sel.level].fg }}
                      >
                        {sel.score}
                      </div>
                      <div className="mt-1 text-[13px] font-bold text-foreground/55">
                        /100 điểm
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p
                        className="text-[18px] font-bold leading-snug"
                        style={{ color: LEVEL_STYLE[sel.level].fg }}
                      >
                        {LEVEL_LABEL[sel.level]}
                      </p>
                      <p className="mt-1 text-[15px] leading-snug text-foreground/75">
                        {LEVEL_ADVICE[sel.level]}
                      </p>
                    </div>
                  </div>
                </div>

                {/* số liệu: hôm nay = đo lúc này; ngày sau = mức cao nhất trong ngày */}
                {dayIdx === 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-card p-4 ring-1 ring-line">
                      <div className="flex items-center gap-2 text-t1">
                        <WindIcon className="h-5 w-5" />
                        <span className="text-[15px] font-bold">
                          Gió lúc này
                        </span>
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
                        <>
                          <p className="display mt-1.5 text-[24px] font-bold leading-none text-navy">
                            {formatNumberVN(cond.waveM)} m
                          </p>
                          <p className="mt-1 text-[14px] leading-snug text-foreground/65">
                            {cond.wavePeriodS != null &&
                              `nhịp sóng ${formatNumberVN(cond.wavePeriodS, 0)} giây`}
                          </p>
                        </>
                      ) : (
                        <p className="mt-1.5 text-[15px] leading-snug text-foreground/65">
                          Chỗ này sát bờ, chưa có số sóng — xem gió là chính.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-card p-4 ring-1 ring-line">
                      <div className="flex items-center gap-2 text-t1">
                        <WindIcon className="h-5 w-5" />
                        <span className="text-[15px] font-bold">
                          Gió mạnh nhất
                        </span>
                      </div>
                      <p className="display mt-1.5 text-[24px] font-bold leading-none text-navy">
                        Cấp {beaufort(sel.windMaxKmh)}
                      </p>
                      <p className="mt-1 text-[14px] leading-snug text-foreground/65">
                        {Math.round(sel.windMaxKmh)} km/giờ
                        {sel.gustMaxKmh > 0 &&
                          ` · giật ${Math.round(sel.gustMaxKmh)}`}
                      </p>
                    </div>
                    <div className="rounded-xl bg-card p-4 ring-1 ring-line">
                      <div className="flex items-center gap-2 text-t1">
                        <WavesIcon className="h-5 w-5" />
                        <span className="text-[15px] font-bold">
                          Sóng cao nhất
                        </span>
                      </div>
                      {sel.waveMaxM > 0 ? (
                        <p className="display mt-1.5 text-[24px] font-bold leading-none text-navy">
                          {formatNumberVN(sel.waveMaxM)} m
                        </p>
                      ) : (
                        <p className="mt-1.5 text-[15px] leading-snug text-foreground/65">
                          Chưa có số sóng cho ngày này.
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

                {/* độ tin của dự báo theo tầm xa — nguồn nào nói được tới đâu */}
                <p
                  className={`px-1 text-[14px] font-semibold ${
                    confidence.tone === "ok" ? "text-foreground/55" : "text-warn"
                  }`}
                >
                  {confidence.label}. Gió sóng dự báo được tới{" "}
                  {cond.days.length} ngày; ảnh vệ tinh trên bản đồ là ảnh đã
                  chụp, không dự báo trước được.
                </p>

                {/* dẫn đường tiết kiệm dầu tới điểm này — key remount khi đổi
                    điểm đến để form/kết quả cũ không dính sang điểm mới */}
                <RoutePlanner
                  key={`${cond.point.lat},${cond.point.lon}`}
                  dest={cond.point}
                  onRoute={handleRoute}
                />
              </>
            )}
          </div>
        )}
      </SnapSheet>

      {/* ── SHEET CHỌN LỚP (modal, kiểu Google Maps) ─────────────────────── */}
      {layerSheetOpen && (
        <LayerSheet
          layerId={layerId}
          onLayer={setLayerId}
          seamarksOn={seamarksOn}
          onSeamarks={setSeamarksOn}
          onClose={() => setLayerSheetOpen(false)}
        />
      )}
    </div>
  );
}
