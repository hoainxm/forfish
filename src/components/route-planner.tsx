"use client";

/**
 * Trục 1 — dẫn đường tiết kiệm dầu: chọn nơi xuất phát (cảng hoặc vị trí
 * tàu) → tính tuyến tới điểm đã chạm trên bản đồ, né vùng sóng to gió ngược
 * theo dự báo từng giờ (thuật toán src/lib/route-plan.ts, dữ liệu qua adapter
 * src/lib/route-weather.ts). Tuyến vẽ lên bản đồ do component cha đảm nhận
 * qua onRoute.
 *
 * Trung thực dữ liệu: chỉ là GỢI Ý từ dự báo — máy không biết đảo, đá ngầm,
 * luồng lạch; copy luôn dặn dò hải đồ + nghe đài duyên hải.
 */
import { useState } from "react";
import { Layer, Marker, Source } from "react-map-gl/maplibre";

import { PORTS } from "@/data/ports";
import { ROUTE_CASING_COLOR, ROUTE_LINE_COLOR } from "@/lib/ocean-map";
import {
  DEFAULT_BOAT,
  bboxFor,
  formatHoursVN,
  haversineKm,
  kmToNm,
  planRoute,
  vnHourIndex,
  type BBox,
  type BoatProfile,
  type LatLon,
  type RoutePlan,
} from "@/lib/route-plan";
import { fetchWeatherField } from "@/lib/route-weather";
import { fetchDepthGrid } from "@/lib/depth-grid";
import { beaufort, formatNumberVN } from "@/lib/marine-weather";
import {
  AlertIcon,
  AnchorIcon,
  ClockIcon,
  FuelIcon,
  RouteIcon,
} from "@/components/icons";

export type PlannedRoute = {
  plan: RoutePlan;
  start: LatLon;
  startLabel: string;
  dest: LatLon;
};

const BOAT_KEY = "forfish.boat.v1";

function readBoat(): BoatProfile {
  try {
    const raw = window.localStorage.getItem(BOAT_KEY);
    if (!raw) return DEFAULT_BOAT;
    const b = JSON.parse(raw) as Partial<BoatProfile>;
    return {
      speedKn: typeof b.speedKn === "number" ? b.speedKn : DEFAULT_BOAT.speedKn,
      litersPerHour:
        typeof b.litersPerHour === "number"
          ? b.litersPerHour
          : DEFAULT_BOAT.litersPerHour,
    };
  } catch {
    return DEFAULT_BOAT;
  }
}

function writeBoat(b: BoatProfile) {
  try {
    window.localStorage.setItem(BOAT_KEY, JSON.stringify(b));
  } catch {
    // storage đầy — bỏ qua, chỉ mất phần nhớ thông số tàu
  }
}

function clampNum(raw: string, min: number, max: number, fallback: number) {
  const n = Number(raw.replace(",", "."));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// giới hạn vùng tính toán quanh biển VN (khớp khung bản đồ + lưới độ sâu)
const VN_SEA: BBox = { latMin: 4, latMax: 24.5, lonMin: 99, lonMax: 119 };

function clampBBox(b: BBox): BBox {
  return {
    latMin: Math.max(b.latMin, VN_SEA.latMin),
    latMax: Math.min(b.latMax, VN_SEA.latMax),
    lonMin: Math.max(b.lonMin, VN_SEA.lonMin),
    lonMax: Math.min(b.lonMax, VN_SEA.lonMax),
  };
}

function myPosition(): Promise<LatLon> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("no-geolocation"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => reject(new Error("geolocation-failed")),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  });
}

/** Tuyến + điểm xuất phát vẽ lên bản đồ — đặt BÊN TRONG <MapGL> */
export function RouteMapLayers({ route }: { route: PlannedRoute | null }) {
  if (!route) return null;
  const line = {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "LineString" as const,
      coordinates: route.plan.waypoints.map((w) => [w.lon, w.lat]),
    },
  };
  return (
    <>
      <Source id="fuel-route" type="geojson" data={line}>
        <Layer
          id="fuel-route-casing"
          type="line"
          layout={{ "line-cap": "round", "line-join": "round" }}
          paint={{
            "line-color": ROUTE_CASING_COLOR,
            "line-width": 7,
            "line-opacity": 0.85,
          }}
        />
        <Layer
          id="fuel-route-line"
          type="line"
          layout={{ "line-cap": "round", "line-join": "round" }}
          paint={{ "line-color": ROUTE_LINE_COLOR, "line-width": 3.5 }}
        />
      </Source>
      <Marker
        longitude={route.start.lon}
        latitude={route.start.lat}
        anchor="center"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-navy shadow-md ring-2 ring-navy">
          <AnchorIcon className="h-5 w-5" />
        </span>
      </Marker>
    </>
  );
}

export function RoutePlanner({
  dest,
  onRoute,
}: {
  dest: LatLon;
  onRoute: (r: PlannedRoute | null) => void;
}) {
  const [open, setOpen] = useState(false);
  // "gps" hoặc id cảng; mặc định cảng gần điểm đến nhất
  const [startId, setStartId] = useState<string>("");
  // đọc thẳng localStorage lúc render đầu được vì cả cây bản đồ đã
  // next/dynamic ssr:false (không có HTML server để lệch); readBoat tự
  // fallback DEFAULT_BOAT khi không có window/storage
  const [speedKn, setSpeedKn] = useState(() => String(readBoat().speedKn));
  const [lph, setLph] = useState(() => String(readBoat().litersPerHour));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlannedRoute | null>(null);

  const nearestPort = PORTS.reduce((a, b) =>
    haversineKm(b, dest) < haversineKm(a, dest) ? b : a,
  );
  const effectiveStartId = startId || nearestPort.id;

  async function compute() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      let start: LatLon;
      let startLabel: string;
      if (effectiveStartId === "gps") {
        try {
          start = await myPosition();
        } catch {
          setError(
            "Chưa lấy được vị trí tàu — bật định vị giúp, hoặc chọn đi từ cảng.",
          );
          return;
        }
        startLabel = "Chỗ tàu tôi";
      } else {
        const port =
          PORTS.find((p) => p.id === effectiveStartId) ?? nearestPort;
        start = { lat: port.lat, lon: port.lon };
        startLabel = `Cảng ${port.name}`;
      }

      if (haversineKm(start, dest) < 5) {
        setError("Điểm đến đang quá gần nơi xuất phát — chạm chỗ xa hơn trên biển.");
        return;
      }

      const boat: BoatProfile = {
        speedKn: clampNum(speedKn, 2, 30, DEFAULT_BOAT.speedKn),
        litersPerHour: clampNum(lph, 1, 300, DEFAULT_BOAT.litersPerHour),
      };
      writeBoat(boat);
      setSpeedKn(String(boat.speedKn));
      setLph(String(boat.litersPerHour));

      // độ sâu fail vẫn tính tiếp — kết quả sẽ tự cảnh báo "chưa né vùng cạn"
      const depth = await fetchDepthGrid().catch(() => null);
      const departHourIdx = vnHourIndex(new Date());
      const dist = haversineKm(start, dest);
      // khung nhỏ trước cho nhanh; chưa có lối (vd phải vòng qua mũi đất)
      // thì nở khung rộng gấp mấy lần quãng đường rồi tìm lại
      const margins = [
        Math.min(150, Math.max(45, dist * 0.3)),
        Math.min(420, Math.max(200, dist * 1.1)),
      ];
      let plan: RoutePlan | null = null;
      for (const m of margins) {
        const bbox = clampBBox(bboxFor(start, dest, m));
        const field = await fetchWeatherField(bbox);
        plan = planRoute({ start, dest, boat, departHourIdx, field, depth, bbox });
        if (plan) break;
      }
      if (!plan) {
        setError(
          "Chưa tìm được đường an toàn — giữa đường vướng đất liền, bãi cạn hoặc sóng quá dữ (trên 4 m).",
        );
        setResult(null);
        onRoute(null);
        return;
      }
      const r: PlannedRoute = { plan, start, startLabel, dest };
      setResult(r);
      onRoute(r);
    } catch {
      setError("Chưa lấy được dự báo cho tuyến — mạng có thể đang yếu, thử lại giúp.");
    } finally {
      setBusy(false);
    }
  }

  function clearRoute() {
    setResult(null);
    setError(null);
    onRoute(null);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-xl bg-t1 text-[18px] font-bold text-white transition active:scale-[0.99]"
      >
        <RouteIcon className="h-6 w-6" />
        Dẫn đường tới chỗ này
      </button>
    );
  }

  const plan = result?.plan ?? null;

  return (
    <div className="space-y-3 surface p-4">
      <div className="flex items-center gap-2 text-t1">
        <RouteIcon className="h-6 w-6" />
        <h3 className="text-[18px] font-bold text-navy">
          Dẫn đường tới chỗ này
        </h3>
      </div>

      {!plan && (
        <>
          <label className="block">
            <span className="text-[15px] font-bold text-foreground/75">
              Đi từ đâu?
            </span>
            <select
              value={effectiveStartId}
              onChange={(e) => setStartId(e.target.value)}
              className="mt-1 block min-h-[56px] w-full rounded-xl bg-background px-3 text-[18px] font-semibold"
            >
              <option value="gps">Chỗ tàu tôi đang đứng (định vị)</option>
              {PORTS.map((p) => (
                <option key={p.id} value={p.id}>
                  Cảng {p.name}
                  {p.id === nearestPort.id ? " — gần điểm đến nhất" : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[15px] font-bold text-foreground/75">
                Tàu chạy (hải lý/giờ)
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={2}
                max={30}
                value={speedKn}
                onChange={(e) => setSpeedKn(e.target.value)}
                className="mt-1 block min-h-[56px] w-full rounded-xl bg-background px-3 text-[18px] font-semibold"
              />
            </label>
            <label className="block">
              <span className="text-[15px] font-bold text-foreground/75">
                Máy ăn dầu (lít/giờ)
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={1}
                max={300}
                value={lph}
                onChange={(e) => setLph(e.target.value)}
                className="mt-1 block min-h-[56px] w-full rounded-xl bg-background px-3 text-[18px] font-semibold"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={compute}
            disabled={busy}
            className="flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-xl bg-t1 text-[18px] font-bold text-white transition active:scale-[0.99] disabled:opacity-60"
          >
            {busy ? "Đang tính đường…" : "Tính đường đỡ tốn dầu"}
          </button>
        </>
      )}

      {error && (
        <p className="text-[15px] font-semibold leading-snug text-danger">
          {error}
        </p>
      )}

      {plan && result && (
        <>
          <p className="text-[15px] font-semibold text-foreground/70">
            {result.startLabel} → {formatNumberVN(dest.lat, 2)}°B ·{" "}
            {formatNumberVN(dest.lon, 2)}°Đ — tuyến đã vẽ trên bản đồ.
          </p>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-background p-3">
              <RouteIcon className="mx-auto h-5 w-5 text-t1" />
              <p className="display mt-1 text-[20px] font-bold leading-none text-navy">
                {Math.round(plan.distKm)} km
              </p>
              <p className="mt-1 text-[13px] font-semibold text-foreground/60">
                ≈ {Math.round(kmToNm(plan.distKm))} hải lý
              </p>
            </div>
            <div className="rounded-xl bg-background p-3">
              <ClockIcon className="mx-auto h-5 w-5 text-t1" />
              <p className="display mt-1 text-[20px] font-bold leading-none text-navy">
                {formatHoursVN(plan.hours)}
              </p>
              <p className="mt-1 text-[13px] font-semibold text-foreground/60">
                giờ chạy máy
              </p>
            </div>
            <div className="rounded-xl bg-background p-3">
              <FuelIcon className="mx-auto h-5 w-5 text-t1" />
              <p className="display mt-1 text-[20px] font-bold leading-none text-navy">
                ~{Math.round(plan.fuelL)} lít
              </p>
              <p className="mt-1 text-[13px] font-semibold text-foreground/60">
                dầu ước tính
              </p>
            </div>
          </div>

          {/* Nói thật tuyến này so với chạy thẳng ra sao — không có nhánh
              nào được phép nói "chạy thẳng" khi tuyến vẽ là đường vòng */}
          {plan.cappedToDirect ? (
            <p className="rounded-xl bg-[var(--warn-bg)] p-3 text-[15px] font-semibold leading-snug text-[var(--warn)]">
              Không có đường vòng nào đáng tiền để né sóng — tuyến vẽ là ĐƯỜNG
              THẲNG, trên đường có đoạn sóng tới{" "}
              {formatNumberVN(plan.maxWaveM)} m. Cân nhắc hoãn hoặc đợi biển
              êm hơn.
            </p>
          ) : plan.direct === null ? (
            <p className="rounded-xl bg-[var(--warn-bg)] p-3 text-[15px] font-semibold leading-snug text-[var(--warn)]">
              Đường chim bay đang vướng đất liền, bãi cạn hoặc sóng quá dữ —
              tuyến này đi vòng qua chỗ đó.
            </p>
          ) : plan.fuelDeltaL != null &&
            -plan.fuelDeltaL > Math.max(3, plan.direct.fuelL * 0.03) &&
            plan.distKm > plan.direct.distKm * 1.02 ? (
            <p className="rounded-xl bg-[var(--ok-bg)] p-3 text-[15px] font-semibold leading-snug text-[var(--ok)]">
              Đi hơi vòng nhưng êm hơn — đỡ chừng{" "}
              {Math.round(-plan.fuelDeltaL)} lít dầu so với chạy thẳng.
            </p>
          ) : plan.distKm <= plan.direct.distKm * 1.05 ? (
            <p className="rounded-xl bg-[var(--ok-bg)] p-3 text-[15px] font-semibold leading-snug text-[var(--ok)]">
              Hôm nay chạy thẳng là hợp lý nhất — tuyến vẽ theo đường đó.
            </p>
          ) : (
            <p className="rounded-xl bg-[var(--warn-bg)] p-3 text-[15px] font-semibold leading-snug text-[var(--warn)]">
              Tuyến vòng nhẹ để né đoạn sóng ~
              {formatNumberVN(plan.direct.maxWaveM)} m trên đường thẳng — tốn
              thêm chừng {Math.max(1, Math.round(plan.fuelDeltaL ?? 0))} lít.
              Êm hơn nhưng không rẻ hơn, bà con tự cân nhắc.
            </p>
          )}

          {plan.hasRoughLeg && (
            <p className="flex items-start gap-2 rounded-xl bg-[var(--danger-bg)] p-3 text-[15px] font-bold leading-snug text-danger">
              <AlertIcon className="mt-0.5 h-5 w-5 shrink-0" />
              Trên đường có đoạn sóng tới {formatNumberVN(plan.maxWaveM)} m,
              gió cấp {beaufort(plan.maxWindKmh)} — mức KHÔNG NÊN ĐI với tàu
              nhỏ. Cân nhắc hoãn chuyến, nghe đài trước khi quyết.
            </p>
          )}

          {plan.hasFollowingSeaRisk && !plan.hasRoughLeg && (
            <p className="rounded-xl bg-[var(--warn-bg)] p-3 text-[15px] font-semibold leading-snug text-[var(--warn)]">
              Có đoạn sóng dồn từ phía đuôi (≥2 m, sóng ngắn) — dễ trượt sóng:
              tới đoạn đó giảm ga, đừng để sóng vỗ thẳng đuôi tàu.
            </p>
          )}

          {plan.hasShallowLeg && (
            <p className="rounded-xl bg-[var(--warn-bg)] p-3 text-[15px] font-semibold leading-snug text-[var(--warn)]">
              Tuyến có đoạn nước nông (cỡ 4–12 m) — để ý con nước, hải đồ
              đoạn đó.
            </p>
          )}

          {!plan.depthChecked && (
            <p className="rounded-xl bg-[var(--warn-bg)] p-3 text-[15px] font-semibold leading-snug text-[var(--warn)]">
              Chuyến này chưa kiểm tra được độ sâu — tuyến chưa né bãi cạn, bà
              con tự dò hải đồ.
            </p>
          )}

          <p className="text-[14px] leading-snug text-foreground/65">
            Đoạn xấu nhất trên tuyến: sóng ~{formatNumberVN(plan.maxWaveM)} m,
            gió cấp {beaufort(plan.maxWindKmh)}. Tuyến tính từ dự báo gió,
            sóng, dòng nước chảy từng giờ và bản đồ độ sâu (đã né bờ, rạn, bãi
            cạn sát mặt) — vẫn chỉ để tham khảo: máy chưa biết đá ngầm nhỏ,
            luồng lạch, đăng đáy; con nước sát bờ có thể lệch. Bà con dò hải
            đồ và nghe đài duyên hải trước khi chạy.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={clearRoute}
              className="min-h-[56px] rounded-xl bg-background text-[16px] font-bold text-navy transition active:scale-[0.99]"
            >
              Xoá đường
            </button>
            <button
              type="button"
              onClick={compute}
              disabled={busy}
              className="min-h-[56px] rounded-xl bg-t1 text-[16px] font-bold text-white transition active:scale-[0.99] disabled:opacity-60"
            >
              {busy ? "Đang tính lại…" : "Tính lại"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
