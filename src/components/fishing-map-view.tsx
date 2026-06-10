"use client";

/**
 * Trục 1 — bản đồ ngư trường:
 *   · lớp vệ tinh (nước nóng lạnh / vùng nhiều mồi / ảnh mây) — nguồn qua
 *     adapter src/lib/ocean-map.ts
 *   · nhãn chủ quyền tiếng Việt: BIỂN ĐÔNG, HOÀNG SA (Đà Nẵng), TRƯỜNG SA
 *     (Khánh Hòa) — đè lên nhãn quốc tế của tile nền
 *   · chạm vào biển → gió/sóng + điểm đi biển tại chỗ đó (thang điểm dùng
 *     chung với dự báo theo cảng — src/lib/sea.ts)
 * UI cho người 40–60 tuổi: nút ≥56px, chữ to, từ đời thường.
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
  OCEAN_LAYER_ORDER,
  SEA_MASK_COLOR,
  SOVEREIGNTY_LABELS,
  type OceanLayerId,
} from "@/lib/ocean-map";
import { LEVEL_LABEL, type SeaLevel } from "@/lib/sea";
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
import {
  AlertIcon,
  CloudSunIcon,
  CrosshairIcon,
  DepthIcon,
  PinIcon,
  PlanktonIcon,
  ThermoIcon,
  WavesIcon,
  WindIcon,
} from "@/components/icons";

const LAYER_ICONS: Record<
  OceanLayerId,
  (p: { className?: string }) => React.ReactNode
> = {
  sst: ThermoIcon,
  chlorophyll: PlanktonIcon,
  bathymetry: DepthIcon,
  truecolor: CloudSunIcon,
};

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
const BORDER_LEVEL_STYLE: Record<
  BorderLevel,
  { bg: string; fg: string }
> = {
  ok: { bg: "var(--ok-bg)", fg: "var(--ok)" },
  near: { bg: "var(--warn-bg)", fg: "var(--warn)" },
  very_near: { bg: "var(--danger-bg)", fg: "var(--danger)" },
};

export default function FishingMapView() {
  const mapRef = useRef<MapRef>(null);
  const [layerId, setLayerId] = useState<OceanLayerId>("sst");
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
  }, []);

  // tâm bão (nếu có) vẽ thẳng lên bản đồ — bà con thấy bão nằm đâu so với
  // vùng mình định đi
  useEffect(() => {
    let alive = true;
    fetchStormCheck().then(
      (c) => alive && c.ok && setStorms(c.storms),
    );
    return () => {
      alive = false;
    };
  }, []);

  const layer = OCEAN_LAYERS[layerId];
  const dataDate = latestAvailableDate(new Date(), layer.lagDays);
  const mapStyle = useMemo(
    () => buildMapStyle(layerId, new Date()) as unknown as StyleSpecification,
    [layerId],
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
        mapRef.current?.flyTo({ center: [p.lon, p.lat], zoom: 7 });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }, [locating]);

  const today = cond?.days[0] ?? null;
  // ngày đang chọn để xem dự báo (kẹp lại nếu nguồn trả ít ngày hơn)
  const sel = cond?.days[Math.min(dayIdx, (cond?.days.length ?? 1) - 1)] ?? null;
  const confidence = forecastConfidence(dayIdx);

  return (
    <div className="space-y-4 px-4">
      {/* chọn lớp ảnh vệ tinh */}
      <section aria-label="Chọn lớp bản đồ">
        <div className="grid grid-cols-2 gap-2">
          {OCEAN_LAYER_ORDER.map((id) => {
            const def = OCEAN_LAYERS[id];
            const Icon = LAYER_ICONS[id];
            const active = id === layerId;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setLayerId(id)}
                aria-pressed={active}
                className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[15px] font-bold leading-tight transition active:scale-[0.98] ${
                  active
                    ? "bg-t1 text-white shadow-sm"
                    : "bg-card text-navy ring-1 ring-line"
                }`}
              >
                <Icon className="h-6 w-6" />
                {def.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 px-1 text-[15px] leading-snug text-foreground/70">
          {layer.help}
        </p>
        {layer.legend && (
          <div className="mt-2 px-1">
            <div
              className="h-3 w-full rounded-full"
              style={{ background: layer.legend.gradient }}
              aria-hidden
            />
            <div className="mt-1 flex justify-between text-[14px] font-semibold text-foreground/60">
              <span>{layer.legend.from}</span>
              <span>{layer.legend.to}</span>
            </div>
          </div>
        )}
      </section>

      {/* bản đồ */}
      <section aria-label="Bản đồ biển">
        <div className="relative h-[420px] overflow-hidden rounded-xl ring-1 ring-line">
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
              // đổi điểm xem → tuyến dẫn đường cũ không còn đúng đích,
              // ngày xem quay về hôm nay
              setRoute(null);
              setDayIdx(0);
              setPoint({
                lat: Math.round(e.lngLat.lat * 1000) / 1000,
                lon: Math.round(e.lngLat.lng * 1000) / 1000,
              });
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
              <Marker
                key={s.name}
                longitude={s.lng}
                latitude={s.lat}
                anchor="center"
              >
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
                    <div className="text-[10px] font-semibold italic">
                      {s.sub}
                    </div>
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

          <p className="pointer-events-none absolute left-2 top-2 rounded-lg bg-white/90 px-2.5 py-1 text-[13px] font-semibold text-navy shadow-sm">
            {layer.dated
              ? `Ảnh ngày ${formatDateVN(dataDate)} — ảnh vệ tinh luôn chậm vài ngày`
              : "Bản đồ độ sâu — không đổi theo ngày"}
          </p>
        </div>
        <p className="mt-2 px-1 text-[15px] text-foreground/70">
          Chạm vào chỗ nào trên biển để xem gió, sóng chỗ đó — rồi bấm dẫn
          đường để máy tính tuyến đỡ tốn dầu tới đó.
        </p>
      </section>

      {/* dự báo tại điểm đã chọn */}
      <section aria-label="Gió sóng chỗ đang xem" className="space-y-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <h2 className="display text-[17px] font-bold text-navy">
            Gió sóng chỗ đang xem
          </h2>
          <span className="text-[14px] font-semibold text-foreground/55">
            {formatNumberVN(point.lat, 2)}°B · {formatNumberVN(point.lon, 2)}°Đ
          </span>
        </div>

        {/* khoảng cách tới ranh giới biển — cảnh báo vượt vùng (chống IUU) */}
        {(() => {
          const prox = borderProximity(point.lat, point.lon);
          const st = BORDER_LEVEL_STYLE[prox.level];
          return (
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[15px] font-semibold ring-1 ring-line"
              style={{ backgroundColor: st.bg, color: st.fg }}
            >
              <CrosshairIcon className="h-5 w-5 shrink-0" />
              <span>
                {prox.label}.
                {prox.level !== "ok" &&
                  " Giữ khoảng cách, nghe Biên phòng — vượt ranh giới bị phạt rất nặng."}
              </span>
            </div>
          );
        })()}

        {loading && (
          <div className="rounded-xl bg-card p-5 text-center text-[16px] font-semibold text-foreground/60 ring-1 ring-line">
            Đang lấy dự báo gió sóng…
          </div>
        )}

        {errored && (
          <div className="rounded-xl bg-card p-4 ring-1 ring-line">
            <p className="text-[16px] font-semibold text-danger">
              Chưa lấy được dự báo — có thể mạng đang yếu.
            </p>
            <button
              type="button"
              onClick={() => setRetry((n) => n + 1)}
              className="mt-3 min-h-[56px] w-full rounded-xl bg-t1 text-[17px] font-bold text-white transition active:scale-[0.99]"
            >
              Thử lại
            </button>
          </div>
        )}

        {cond && !cond.onSea && (
          <div className="rounded-xl bg-card p-4 ring-1 ring-line">
            <p className="text-[16px] font-semibold leading-snug text-foreground/80">
              Chỗ này là đất liền — chạm ra ngoài biển để xem gió sóng.
            </p>
          </div>
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
                    <span className="text-[15px] font-bold">Sóng lúc này</span>
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
                    <span className="text-[15px] font-bold">Gió mạnh nhất</span>
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
                    <span className="text-[15px] font-bold">Sóng cao nhất</span>
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
                confidence.tone === "ok"
                  ? "text-foreground/55"
                  : "text-warn"
              }`}
            >
              {confidence.label}. Gió sóng dự báo được tới {cond.days.length}{" "}
              ngày; ảnh vệ tinh trên bản đồ là ảnh đã chụp, không dự báo trước
              được.
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

        <button
          type="button"
          onClick={goToMyBoat}
          disabled={locating}
          className="flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-xl bg-navy text-[17px] font-bold text-white transition active:scale-[0.99] disabled:opacity-60"
        >
          <CrosshairIcon className="h-6 w-6" />
          {locating ? "Đang tìm vị trí…" : "Xem chỗ tàu tôi đang đứng"}
        </button>
      </section>
    </div>
  );
}
