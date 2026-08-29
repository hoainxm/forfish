"use client";

/**
 * Trục 1 — dẫn đường tiết kiệm dầu: chọn nơi xuất phát (cảng hoặc vị trí
 * tàu) → tính tuyến tới điểm đã chạm trên bản đồ, né vùng sóng to gió ngược
 * theo dự báo từng giờ (thuật toán src/lib/route-plan.ts chạy trong WEB
 * WORKER qua route-plan-async.ts — main thread không đơ lúc Dijkstra; dữ
 * liệu qua adapter src/lib/route-weather.ts, có cache 45 phút). Tuyến vẽ lên
 * bản đồ do component cha đảm nhận qua onRoute.
 *
 * Trung thực dữ liệu: chỉ là GỢI Ý từ dự báo — máy không biết đảo, đá ngầm,
 * luồng lạch; copy luôn dặn dò hải đồ + nghe đài duyên hải.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Layer, Marker, Source } from "react-map-gl/maplibre";

import { PORTS } from "@/data/ports";
import { sortedPlaces, type SavedPlace } from "@/lib/places";
import {
  ROUTE_CASING_COLOR,
  ROUTE_LEG_AMBER,
  ROUTE_LEG_PASSED,
  ROUTE_LEG_RED,
  ROUTE_LINE_COLOR,
} from "@/lib/ocean-map";
import {
  DEFAULT_BOAT,
  bboxOfPoints,
  formatHoursVN,
  haversineKm,
  vnHourIndex,
  type BBox,
  type BoatProfile,
  type LatLon,
  type RoutePlan,
  type WeatherField,
} from "@/lib/route-plan";
import { planRouteAsync } from "@/lib/route-plan-async";
import {
  addSavedRoute,
  removeSavedRoute,
  suggestName,
  type SavedRoute,
} from "@/lib/saved-routes";
import { mergeLegPlans } from "@/lib/route-multi";
import {
  cumulativeKmAt,
  legProgressAt,
  type LegSummary,
} from "@/lib/route-legs";
import {
  MAX_STOPS,
  addStop,
  removeStop,
  routeMatchesStops,
  routeStartMatches,
  stopAt,
  clearStops,
  type RouteStop,
} from "@/lib/route-stops";
import { fetchWeatherField } from "@/lib/route-weather";
import { savedAgoLabel } from "@/lib/forecast-cache";
import { readUserRecord } from "@/lib/user-list-store";
import { saveUserJson } from "@/lib/user-store";
import { routeStormConflict, STORM_SAFE_RADIUS_KM } from "@/lib/route-storm";
import { stormGateForRoute, type StormAlert, type StormStatus } from "@/lib/storms";
import { fetchDepthGrid, type DepthClass } from "@/lib/depth-grid";
import { beaufort, formatNumberVN } from "@/lib/marine-weather";
import {
  useMapPrefs,
  fmtDist,
  fmtCoordPair,
  type DistUnit,
} from "@/lib/map-prefs";
import { parseCoordPair } from "@/lib/parse-coord";
import {
  AlertIcon,
  AnchorIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  FuelIcon,
  PinIcon,
  PlayIcon,
  PlusIcon,
  RouteIcon,
  StarIcon,
  TrashIcon,
} from "@/components/icons";
import { SQ_BTN } from "@/components/ui/sq-btn";

export type PlannedRoute = {
  plan: RoutePlan;
  start: LatLon;
  startLabel: string;
  /** điểm CUỐI của đường đi — giữ tên cũ để nav/fitBounds/staleRoute không phải sửa */
  dest: LatLon;
  /** các chỗ phải ghé, theo đúng thứ tự bà con chấm; phần tử cuối = `dest` */
  stops: LatLon[];
  /** chỉ số của từng chỗ ghé trong `plan.waypoints` — để vẽ số 1-2-3 */
  stopWpIdx: number[];
  /*  TÓM TẮT TỪNG CHẶNG — để bản đồ tô đúng khúc đáng lo thay vì đỏ cả tuyến
      (chủ dự án 2026-08-29g: *"điểm nào cần lưu ý thì màu đỏ, cần chú ý vừa
      thì màu cam, ko có gì thì màu xanh"*). Dài đúng bằng số chặng =
      `stops.length`. */
  legs: LegSummary[];
  /*  Quãng dọc-tuyến (km) tại mốc CUỐI mỗi chặng. Đo trên chính `waypoints`
      để cùng một thước với `alongKm` của `projectOntoRoute` — có thước chung
      thì mới biết tàu đã qua chặng nào mà tô xám. */
  legBoundsKm: number[];
};

const BOAT_KEY = "forfish.boat.v1";

/* HỒ SƠ TÀU CŨNG LÀ DỮ LIỆU GÕ TAY (K4, 2026-08-02): tốc độ chạy + lít dầu/giờ
   là con số chủ tàu tự đo, không tải lại được từ đâu. Cùng khuôn với sổ mối
   quen / danh sách tàu: đọc KHÔNG ĐƯỢC thì KHÔNG mở cửa ghi (giữ nguyên bản
   gốc), ghi thì đi qua `saveUserJson` để dự báo nhường chỗ khi máy chật.
   Dùng `readUserRecord` vì khoá này giữ ĐỐI TƯỢNG, không phải mảng. */
let boatReadFailed = false;

function readBoat(): BoatProfile {
  const r = readUserRecord<Partial<BoatProfile>>(BOAT_KEY);
  boatReadFailed = !r.ok;
  const b = r.value;
  if (!b) return DEFAULT_BOAT;
  return {
    speedKn: typeof b.speedKn === "number" ? b.speedKn : DEFAULT_BOAT.speedKn,
    litersPerHour:
      typeof b.litersPerHour === "number"
        ? b.litersPerHour
        : DEFAULT_BOAT.litersPerHour,
  };
}

function writeBoat(b: BoatProfile): boolean {
  if (boatReadFailed) return false; // đừng đè lên hồ sơ chưa đọc được
  return saveUserJson(BOAT_KEY, b);
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
/** id lớp bắt chạm của tuyến — khai vào `interactiveLayerIds` của <MapGL> */
export const ROUTE_HIT_LAYER = "fuel-route-hit";

export function RouteMapLayers({
  route,
  alongKm = null,
}: {
  route: PlannedRoute | null;
  /*  Quãng tàu đã chạy dọc tuyến (km) — từ `projectOntoRoute` khi đang dẫn
      đường. null = chưa chạy ⇒ không chặng nào xám. */
  alongKm?: number | null;
}) {
  // useMemo giữ nguyên reference GeoJSON giữa các re-render của cha (bản đồ
  // re-render liên tục khi play animation) — không thì mỗi render là một lần
  // setData lên MapLibre dù tuyến không đổi
  /*  MỖI CHẶNG MỘT FEATURE, màu do `state` quyết định (2026-08-29g). Trước
      đây cả tuyến là MỘT LineString một màu: tuyến 4 chặng chỉ chặng 3 đè bãi
      cạn vẫn hiện một dải đỏ suốt từ bến, bà con đọc thành "cả đường này dữ".
      Cắt theo `stopWpIdx` rồi tô riêng thì cảnh báo trỏ đúng khúc.
      Tuyến MỘT chặng vẫn chạy đúng nhánh này (một feature) — không có nhánh
      thứ hai để lệch nhau. */
  const line = useMemo(() => {
    if (!route) return null;
    const wps = route.plan.waypoints;
    if (wps.length < 2) return null;
    const bounds = route.legBoundsKm ?? [];
    const legs = route.legs ?? [];
    /*  Chưa tính được chặng (tuyến cũ đọc từ nơi khác, hoặc dữ liệu thiếu) ⇒
        vẽ NGUYÊN MỘT ĐƯỜNG xanh như cũ. Thà mất màu còn hơn mất tuyến. */
    const cuts =
      route.stopWpIdx.length === legs.length && legs.length > 0
        ? route.stopWpIdx
        : [wps.length - 1];
    const feats = [];
    let from = 0;
    for (let i = 0; i < cuts.length; i++) {
      const to = Math.min(Math.max(cuts[i], from + 1), wps.length - 1);
      /*  ĐÃ ĐI QUA = mốc CUỐI chặng đã ở sau lưng. Cố ý KHÔNG cắt giữa chặng:
          chặng đang chạy phải giữ nguyên màu cảnh báo của nó, xám nửa vời làm
          khúc đang đi trông như đã xong. */
      const passed =
        alongKm != null && bounds[i] != null && alongKm >= bounds[i];
      feats.push({
        type: "Feature" as const,
        properties: {
          state: passed ? "passed" : (legs[i]?.risk ?? "blue"),
          legIdx: i,
        },
        geometry: {
          type: "LineString" as const,
          coordinates: wps.slice(from, to + 1).map((w) => [w.lon, w.lat]),
        },
      });
      from = to;
    }
    return { type: "FeatureCollection" as const, features: feats };
  }, [route, alongKm]);
  if (!route || !line) return null;
  return (
    <>
      <Source id="fuel-route" type="geojson" data={line}>
        {/*  LỚP BẮT CHẠM — trong suốt, DÀY 22px (chủ dự án 2026-08-29g:
             *"từng khoảng màu ở trên tuyến thì trên bản đồ có thể click nhìn
             thấy info của từng đoạn"*). Nét vẽ chỉ 3,5-5px: bắt chạm đúng bề
             dày đó là bắt bà con chấm trúng một sợi chỉ trên tàu đang lắc.
             Đặt DƯỚI hai lớp nhìn được để không phủ màu lên chúng. */}
        <Layer
          id="fuel-route-hit"
          type="line"
          layout={{ "line-cap": "round", "line-join": "round" }}
          paint={{ "line-color": ROUTE_LINE_COLOR, "line-width": 22, "line-opacity": 0 }}
        />
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
          paint={{
            "line-color": [
              "match",
              ["get", "state"],
              "passed",
              ROUTE_LEG_PASSED,
              "red",
              ROUTE_LEG_RED,
              "amber",
              ROUTE_LEG_AMBER,
              ROUTE_LINE_COLOR,
            ],
            /*  Chặng đáng lo VẼ DÀY HƠN, chặng đã qua MỎNG hơn: nắng chói trên
                biển làm màu bạc đi rất nhanh, chỉ dựa vào màu là thua. Bề dày
                đọc được cả khi màn loá. */
            "line-width": [
              "match",
              ["get", "state"],
              "passed",
              2.5,
              "red",
              5,
              "amber",
              4.5,
              3.5,
            ],
            "line-opacity": [
              "match",
              ["get", "state"],
              "passed",
              0.55,
              1,
            ],
          }}
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
      {/* SỐ CHỖ GHÉ — chỉ vẽ khi đường đi có từ 2 chỗ trở lên; đi một chỗ thì
          con số "1" là thừa (ghim con trỏ đã nói rồi). */}
      {route.stops.length > 1 &&
        route.stops.map((s, i) => (
          <Marker
            key={`${s.lat},${s.lon}`}
            longitude={s.lon}
            latitude={s.lat}
            anchor="center"
          >
            <span className="flex h-14 w-14 items-center justify-center">
              <span
                className="display flex h-10 w-10 items-center justify-center rounded-full bg-white text-[1rem] font-bold shadow-md"
                style={{
                  color: ROUTE_LINE_COLOR,
                  boxShadow: `0 0 0 0.1875rem ${ROUTE_LINE_COLOR}`,
                }}
              >
                {i + 1}
              </span>
            </span>
          </Marker>
        ))}
    </>
  );
}

/**
 * ĐƯỜNG NHÁP — các chỗ đã chấm nhưng CHƯA tính tuyến: nét đứt nối thẳng + số
 * mờ. Bà con thấy ngay mình đang chấm cái gì trước khi bấm tính. Xanh nét đứt
 * = "chưa phải tuyến đã tính" (tuyến thật là nét liền, cùng màu). Đặt BÊN
 * TRONG <MapGL>.
 *
 * `hidden` CHỈ nên bật khi tuyến đã tính còn khớp CẢ CHUỖI điểm
 * (`routeMatchesStops`) — lúc đó hai đường trùng nhau, vẽ chồng chỉ gây rối.
 * Tuyến lệch thì phải vẽ CẢ HAI để bà con thấy tận mắt chỗ lệch.
 */
export function RouteStopsLayers({
  stops,
  hidden,
  from = null,
  distUnit = "nm",
}: {
  stops: RouteStop[];
  hidden?: boolean;
  /*  Nơi XUẤT PHÁT đang chọn (vị trí tàu / cảng / chỗ đang xem) — để nhãn đầu
      tiên nói được "từ đây tới chỗ 1 bao xa" (chủ dự án 2026-08-29g). null =
      chưa biết ⇒ bỏ nhãn đầu, các nhãn giữa vẫn vẽ. */
  from?: LatLon | null;
  distUnit?: DistUnit;
}) {
  const line = useMemo(
    () =>
      stops.length >= 2
        ? {
            type: "Feature" as const,
            properties: {},
            geometry: {
              type: "LineString" as const,
              coordinates: stops.map((s) => [s.lon, s.lat]),
            },
          }
        : null,
    [stops],
  );
  /*  NHÃN KHOẢNG CÁCH GIỮA HAI CHỖ LIỀN NHAU, VẼ NGAY TRÊN ĐƯỜNG NHÁP
      (chủ dự án 2026-08-29g: *"lúc chọn điểm số 2 thì trên bản đồ show luôn
      khoảng cách từ vị trí hiện thời tới điểm 1, điểm 1 tới điểm dự kiến thứ
      2, điểm 3 thì show khoảng cách tới điểm 2"*).

      NÓI THẲNG LÀ "THẲNG": đây là đường chim bay giữa hai ghim, KHÔNG phải
      quãng tuyến đã tính (tuyến né cạn/sóng luôn dài hơn). Bỏ chữ "thẳng" đi
      là hứa một con số máy chưa tính — bà con tính dầu theo đó là thiếu dầu.
      Nhãn đặt ở TRUNG ĐIỂM đoạn, `pointer-events-none` để không cướp chạm của
      bản đồ bên dưới. */
  const labels = useMemo(() => {
    const pts: LatLon[] = from ? [from, ...stops] : stops;
    const out: { key: string; lat: number; lon: number; text: string }[] = [];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      out.push({
        key: `${a.lat},${a.lon}->${b.lat},${b.lon}`,
        lat: (a.lat + b.lat) / 2,
        lon: (a.lon + b.lon) / 2,
        text: `${fmtDist(haversineKm(a, b), distUnit)} thẳng`,
      });
    }
    return out;
  }, [from, stops, distUnit]);

  /*  Đoạn từ nơi xuất phát tới chỗ 1 cũng phải có NÉT, không chỉ có nhãn:
      nhãn treo giữa khoảng trống không nói được nó đo từ đâu tới đâu. */
  const leadLine = useMemo(
    () =>
      from && stops.length > 0
        ? {
            type: "Feature" as const,
            properties: {},
            geometry: {
              type: "LineString" as const,
              coordinates: [
                [from.lon, from.lat],
                [stops[0].lon, stops[0].lat],
              ],
            },
          }
        : null,
    [from, stops],
  );

  if (hidden || stops.length === 0) return null;
  return (
    <>
      {leadLine && (
        <Source id="route-draft-lead" type="geojson" data={leadLine}>
          <Layer
            id="route-draft-lead-line"
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{
              "line-color": ROUTE_LINE_COLOR,
              "line-width": 2.5,
              "line-opacity": 0.45,
              "line-dasharray": [1.5, 2],
            }}
          />
        </Source>
      )}
      {labels.map((l) => (
        <Marker
          key={l.key}
          longitude={l.lon}
          latitude={l.lat}
          anchor="center"
          style={{ pointerEvents: "none" }}
        >
          <span
            className="whitespace-nowrap rounded-full bg-white/90 px-2 py-0.5 text-[0.8125rem] font-bold shadow-sm"
            style={{ color: ROUTE_LINE_COLOR }}
          >
            {l.text}
          </span>
        </Marker>
      ))}
      {line && (
        <Source id="route-draft" type="geojson" data={line}>
          <Layer
            id="route-draft-line"
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{
              "line-color": ROUTE_LINE_COLOR,
              "line-width": 2.5,
              "line-opacity": 0.7,
              "line-dasharray": [2, 1.6],
            }}
          />
        </Source>
      )}
      {stops.map((s, i) => (
        <Marker key={s.id} longitude={s.lon} latitude={s.lat} anchor="center">
          {/*  GHIM SỐ CHỈ ĐỂ NHÌN, KHÔNG BẤM ĐƯỢC — bỏ một chỗ là bấm nút trong
               danh sách của thẻ dưới. Lớp bọc "vùng chạm" của bản trước đã gỡ:
               nó là tap target giả cho một hành vi không tồn tại (Marker này
               chưa từng có onClick), mà comment cũ còn dạy sai rằng đây là cách
               DUY NHẤT bỏ một chỗ. */}
          <span
            className="display flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-[1rem] font-bold shadow-md"
            style={{
              color: ROUTE_LINE_COLOR,
              boxShadow: `0 0 0 0.1875rem ${ROUTE_LINE_COLOR}`,
            }}
          >
            {i + 1}
          </span>
        </Marker>
      ))}
    </>
  );
}

/**
 * CHẾ ĐỘ DẪN ĐƯỜNG — MÀN RIÊNG, KHÔNG còn nằm trong sheet gió sóng
 * (chủ dự án 2026-08-28: "bóc cái dẫn đường ra khỏi sheet, làm như gmap ấy,
 * độc lập, thao tác tối ưu bao gồm cả xoá route").
 *
 * Vì sao bóc ra: trước đây nó là MỘT KHỐI trong sheet "gió sóng chỗ đang xem" —
 * sai vai. Sheet đó để LIẾC số liệu rồi trả bản đồ lại (tự thu sau 3 giây);
 * dẫn đường là BIỂU MẪU nhiều bước + kết quả phải đọc kỹ. Nhét chung nên phải
 * chống chế bằng ngoại lệ tự-ẩn, mà bà con vẫn phải vuốt → cuộn → tìm.
 *
 * Hình hài kiểu Google Maps: THANH TRÊN gọn (đi từ đâu · mấy chỗ · Xoá tuyến ·
 * Đóng) — bản đồ ở giữa vẫn thấy — THẺ DƯỚI là chỗ nhập và đọc kết quả.
 *
 * CHẠM BẢN ĐỒ CHỈ DỜI CON TRỎ (đảo lại từ 2026-08-28d: chạm-là-thêm dính chỗ
 * oan khi trượt tay). Muốn thêm một chỗ thì bấm hàng "Thêm điểm" trong thẻ;
 * hàng đó hiện luôn toạ độ con trỏ nên chấm bản đồ vẫn thấy phản hồi ngay.
 */
/*  CHỖ CON TRỎ ĐANG ĐỨNG CÓ ĐI ĐƯỢC KHÔNG — chỉ NÓI hai lớp thật sự đáng nói.
    Trước đây chấm nhầm lên bờ thì thẻ không có một chữ nào phản hồi; máy chỉ
    báo SAU khi bấm Tính, tức sau 2-3 cú chạm thừa và một lượt chờ ~9 giây.
    CỐ Ý KHÔNG dùng chung `DEPTH_NOTE` của màn bản đồ: bảng đó đang phục vụ
    sheet gió sóng ở chế độ THƯỜNG và không có khoá 0 (trên bờ); thêm khoá vào
    đó là đổi hành vi một màn khác trong cùng một commit.
    Giọng "theo bản đồ độ sâu của máy" là mức chắc chắn ĐÚNG với lưới bước
    0,05° ≈ 5,5 km — điểm sát bờ có thể bị phân loại lệch, không được nói chắc
    hơn thế. Lớp 2 (nước nông) và ngoài lưới (null) thì IM: chỗ này bà con chạy
    hằng ngày, nói ra thành nhiễu. KHÔNG khoá, KHÔNG disable nút — bà con có
    thể cố ý chấm sát bờ theo luồng lạch quen. */
const DEST_DEPTH_WARN: Partial<Record<DepthClass, string>> = {
  0: "Chỗ này trên bờ — theo bản đồ độ sâu của máy",
  1: "Chỗ này rất cạn, bãi nổi — theo bản đồ độ sâu của máy",
};

export function RouteMode({
  dest,
  destDepth = null,
  activeRoute,
  places = [],
  stops = [],
  onStops,
  stopsSaveFailed = false,
  savedRoutes = [],
  onSavedRoutes,
  savedRoutesSaveFailed = false,
  onStartCoord,
  storms = [],
  stormInfo,
  onRoute,
  onStart,
  onClose,
}: {
  dest: LatLon;
  /** Hạng độ sâu tại `dest` (lưới tĩnh depth-grid, màn bản đồ đã tải sẵn cho
      việc khác — KHÔNG thêm request nào). null = ngoài lưới / chưa biết ⇒ im. */
  destDepth?: DepthClass | null;
  /** tuyến đang vẽ trên bản đồ (có thể tới điểm CŨ — xem ghi chú dưới) */
  activeRoute?: PlannedRoute | null;
  /** Điểm của tôi (cảng nhà + chỗ ghim) — nơi xuất phát THẬT của bà con,
      lít dầu tính từ đây mới đúng (roadmap hội đồng UX 2026-06-11) */
  places?: SavedPlace[];
  /*  ĐƯỜNG ĐI NHIỀU ĐIỂM (2026-08-28). Danh sách rỗng = hành vi CŨ y nguyên
      (đích = điểm đang xem). Có điểm thì tuyến chạy start → ghé 1 → ghé 2 →…
      THEO ĐÚNG THỨ TỰ bà con chấm — app KHÔNG tự sắp xếp lại (chủ dự án chốt:
      thứ tự là kinh nghiệm thuyền trưởng). Kho ở lib/route-stops.ts. */
  stops?: RouteStop[];
  onStops?: (list: RouteStop[]) => void;
  /** máy KHÔNG giữ được danh sách — phải nói ra, đừng để bà con tưởng đã lưu */
  stopsSaveFailed?: boolean;
  /*  ĐƯỜNG ĐÃ LƯU — cha giữ kho và cửa ghi (án lệ K4), thẻ này chỉ đọc và gọi
      `onSavedRoutes` với danh sách MỚI. */
  savedRoutes?: SavedRoute[];
  onSavedRoutes?: (l: SavedRoute[]) => void;
  savedRoutesSaveFailed?: boolean;
  /** báo nơi xuất phát đang chọn ra màn cha để vẽ nhãn đoạn đầu trên bản đồ */
  onStartCoord?: (c: LatLon | null) => void;
  /** Tin bão đang hoạt động (từ useStormCheck của màn bản đồ, gồm cả tin cũ
      — thà báo thừa). Tuyến cắt vùng bão → CHẶN HẲN, không vẽ. */
  storms?: StormAlert[];
  /*  TRẠNG THÁI tin bão — BẮT BUỘC, và cố ý KHÔNG có giá trị mặc định
      (2026-08-16, thẩm định P0). Mảng `storms` rỗng KHÔNG phân biệt được "hỏi
      được, trời quang" với "chưa hỏi được": trước đây cả hai đều đi qua
      `routeStormConflict` im lặng, tuyến vẽ ra y hệt nhau. Bắt buộc để chỗ gọi
      mới không thể quên — thiếu nó là ĐỎ lúc biên dịch, không phải im lặng
      lúc chạy giữa biển. Luật đọc trạng thái nằm ở `stormGateForRoute`. */
  stormInfo: StormStatus;
  onRoute: (r: PlannedRoute | null) => void;
  /** Thoát chế độ dẫn đường (nút X) — tuyến đã vẽ GIỮ NGUYÊN trên bản đồ */
  onClose: () => void;
  /** Bắt đầu DẪN ĐƯỜNG LIVE theo tuyến vừa tính (bám tuyến, theo dõi GPS) */
  onStart?: (r: PlannedRoute) => void;
}) {
  const prefs = useMapPrefs();
  // KHÔNG còn state `open`: chế độ dẫn đường TỰ NÓ là trạng thái mở.
  /*  MỘT LÚC CHỈ XỔ MỘT THỨ (user 2026-08-28d: "đừng hiện 1 lúc 2 cái tốn
      chỗ"). `idle` = dòng tóm tắt + nút Tính; `start` = CHỈ danh sách nơi xuất
      phát; `boat` = CHỈ hai ô thông số tàu. Trước đó bấm một cái xổ ra cả hai,
      thẻ cao gấp đôi mà bà con chỉ cần đổi một thứ. */
  const [panel, setPanel] = useState<"idle" | "start" | "boat" | "dest" | "saved">(
    "idle",
  );
  /*  GÕ TOẠ ĐỘ NGAY TRONG DẪN ĐƯỜNG (2026-08-29). Áp luật "chỉ hỗ trợ cách
      dùng >=50%" của chủ dự án: đọc toạ độ từ máy định vị / bộ đàm rồi gõ vào
      là việc THƯỜNG XUYÊN của bà con, nên nó phải làm được TRONG chế độ dẫn
      đường. Cách cũ là mở ô "Đến điểm" trên rail — nhưng hai lớp nổi không
      được hiện cùng lúc (§10.7 I), thành ra phải thoát dẫn đường → gõ → mở
      lại = 3 thao tác thừa. Đưa vào đây thì hết cần mở chồng. */
  const [coordLat, setCoordLat] = useState("");
  const [coordLon, setCoordLon] = useState("");
  const [coordErr, setCoordErr] = useState(false);
  /*  Không có bộ chọn nào đang xổ ⇒ hiện ĐỦ các hàng của biểu mẫu. Đang xổ một
      bộ chọn thì chỉ giữ hàng vừa bấm — đây là cách DUY NHẤT trong lượt này
      thật sự giảm chiều cao thẻ, và cũng là thi hành đúng luật "một lúc chỉ xổ
      một thứ" mà chú thích trên đã tuyên bố. */
  /*  MỘT LÚC CHỈ BÀY MỘT THỨ — nay gồm CẢ panel "Tuỳ chọn" (2026-08-29g).
      Trước đây `boat` được xếp chung với "idle" nên mở Tuỳ chọn xong danh sách
      điểm vẫn nằm nguyên bên dưới: hai việc chồng trong một thẻ cao 252px,
      đúng cái chủ dự án gọi là "xổ ra 3 phần khác nhau". */
  const compactRows = panel === "idle";
  const boxRef = useRef<HTMLDivElement>(null);
  /*  BA MỎ NEO CHO BA CÚ CUỘN TỰ ĐỘNG (xem ba useEffect dưới). Nội dung thẻ
      luôn tràn trần 38dvh, mà trình duyệt neo vị trí cuộn cũ khi nội dung nở
      ra ⇒ bấm xong màn hình "không đổi gì" dưới mắt bà con — người ít rành
      công nghệ sẽ bấm loạn. */
  const formRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  /*  MỎ NEO THỨ TƯ: hàng "Thêm điểm dừng" — xem cú cuộn thứ tư dưới. */
  const addStopRef = useRef<HTMLDivElement>(null);
  // "gps" | "place:<id>" | "port:<id>"; mặc định Cảng nhà nếu có
  const [startId, setStartId] = useState<string>("");
  // đọc thẳng localStorage lúc render đầu được vì cả cây bản đồ đã
  // next/dynamic ssr:false (không có HTML server để lệch); readBoat tự
  // fallback DEFAULT_BOAT khi không có window/storage
  const [speedKn, setSpeedKn] = useState(() => String(readBoat().speedKn));
  const [lph, setLph] = useState(() => String(readBoat().litersPerHour));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlannedRoute | null>(null);
  // Mất sóng: tuyến tính từ lưới Windy ĐÃ LƯU (thô hơn, không dòng chảy) — giữ
  // mốc lưu để nói thật với bà con. null = tính từ dự báo mới (online).
  const [offlineSavedAt, setOfflineSavedAt] = useState<number | null | undefined>(
    undefined,
  );
  /*  Câu cảnh báo "tuyến này CHƯA đối chiếu bão" — chốt lại tại LÚC TÍNH, không
      đọc trạng thái live khi vẽ: tin bão về giữa chừng thì câu chữ dưới tuyến
      đổi trong khi tuyến trên bản đồ vẫn là tuyến tính lúc chưa có tin. Bà con
      phải đọc được đúng thứ đã dùng để tính. */
  const [stormWarn, setStormWarn] = useState<string | null>(null);
  /*  MỞ LẠI DANH SÁCH ĐIỂM KHI ĐÃ CÓ KẾT QUẢ. Trước đây cả biểu mẫu nằm trong
      `{!plan && …}` nên tính xong là danh sách biến mất, không nút nào quay
      lại: bà con hoặc chịu tuyến sai, hoặc bấm Xoá mất sạch công 9-11 chạm.
      Mở KHÔNG unmount và KHÔNG tính lại ⇒ tuyến vẫn vẽ, kết quả vẫn còn cho
      tới khi danh sách THẬT SỰ đổi (lúc đó useEffect [chainSig] tự dọn). */
  const [editing, setEditing] = useState(false);
  /*  XOÁ HAI NHỊP. `clearAll` dọn cả tuyến lẫn toàn bộ chỗ ghé, không hoàn tác
      được, mà nút lại nằm sát nút X trong đúng vùng ngón cái — một cú trượt
      tay ướt trên tàu lắc là bay công dựng tuyến giữa biển. */
  const [confirmClear, setConfirmClear] = useState(false);
  /** tên đang gõ cho đường sắp lưu — điền sẵn theo điểm đến, xem `suggestName` */
  const [saveName, setSaveName] = useState("");

  /*  CHUỖI ĐIỂM PHẢI ĐI. Rỗng ⇒ đúng hành vi cũ: đích = chỗ đang xem. */
  const chainStops: LatLon[] = stops.length
    ? stops.map((s) => ({ lat: s.lat, lon: s.lon }))
    : [dest];
  const finalDest = chainStops[chainStops.length - 1];
  // chữ ký để biết "đích đã đổi" — với nhiều điểm là cả danh sách, không chỉ điểm cuối
  const chainSig = stops.length
    ? stops.map((s) => s.id).join("|")
    : `${dest.lat},${dest.lon}`;

  /*
    Đổi ĐÍCH (chạm chỗ khác trên bản đồ, thêm/bớt chỗ ghé) — hội đồng UX
    2026-06-11: KHÔNG remount cả panel (mất luôn tuyến vừa tính 10s không lời
    giải thích). Chỉ dọn kết quả/lỗi của đích cũ; thông số tàu + nơi xuất phát
    giữ nguyên; tuyến cũ vẫn vẽ trên bản đồ cho tới khi bà con tự quyết.
  */
  useEffect(() => {
    setResult(null);
    setError(null);
    setOfflineSavedAt(undefined);
    setStormWarn(null);
    // danh sách đổi ⇒ ý định "xoá sạch" của nhịp trước không còn đáng tin
    setConfirmClear(false);
  }, [chainSig]);

  /*  ─── BA CÚ CUỘN, GẮN VỚI BA CHUYỂN TRẠNG THÁI (không cuộn mỗi render) ───
      Tất cả `behavior: "auto"` (TỨC THỜI) chứ không "smooth": tàu lắc, tay
      ướt — trang đang trôi là ngón tay bấm trượt; đây cũng là hành vi đúng
      với prefers-reduced-motion. */

  /*  Tính xong (result về từ null): ba con số + khối cảnh báo nằm ở ĐẦU phần
      kết quả, mà bà con vừa chờ 10 giây với vị trí cuộn ở tận đáy biểu mẫu. */
  useEffect(() => {
    if (!result) return;
    boxRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [result]);

  /*  Mở lại biểu mẫu bằng cách chạm TIÊU ĐỀ: nội dung nở ra nhưng khung nhìn
      neo chỗ cũ ⇒ bấm mà màn không đổi, nhìn như máy hỏng. */
  useEffect(() => {
    if (!editing) return;
    formRef.current?.scrollIntoView({ block: "nearest", behavior: "auto" });
  }, [editing]);

  /*  Xổ một bộ chọn (xuất phát / điểm đến / thông số tàu): khối vừa xổ có thể
      nằm dưới mép thẻ, trước đây phải vuốt dò mới thấy. Không cuộn khi thu về
      `idle` — lúc đó không có gì mới để nhìn. */
  useEffect(() => {
    if (panel === "idle") return;
    panelRef.current?.scrollIntoView({ block: "nearest", behavior: "auto" });
  }, [panel]);

  /*  CÚ CUỘN THỨ TƯ — VỪA THÊM MỘT ĐIỂM (2026-08-29). Cú thứ ba ở trên
      `return` sớm khi `panel === "idle"`, mà chọn xong một điểm là bộ chọn
      luôn thu về đúng `idle` ⇒ không cú nào chạy. Danh sách dài thêm một hàng
      đẩy hàng "Thêm điểm dừng" xuống dưới cả thanh ghim đáy: nó là hành động
      kế tiếp BẮT BUỘC của mọi tuyến nhiều điểm, nên mỗi điểm thêm vào là một
      cú vuốt câm — tuyến 3 điểm mất 3 cú.
      Nghe `stops.length` chứ không nghe `stops`: đổi tên/dời một điểm không
      phải lý do để giật khung nhìn.
      Bỏ qua lần render đầu bằng cách so với số đếm nhịp trước (mở lại thẻ với
      danh sách cũ mà tự cuộn là giật vô cớ). Ca đủ 6 điểm thì hàng unmount ⇒
      ref null, optional chaining tự im — lúc đó mỏ neo đúng là thanh ghim
      đáy, vốn luôn thấy. Khung đã có sẵn `scroll-pt`/`scroll-pb` nên hàng tự
      dừng giữa hai thanh ghim, không cần trị số mới. */
  const prevStopCount = useRef(stops.length);
  useEffect(() => {
    if (prevStopCount.current === stops.length) return;
    prevStopCount.current = stops.length;
    addStopRef.current?.scrollIntoView({ block: "nearest", behavior: "auto" });
  }, [stops.length]);

  const nearestPort = PORTS.reduce((a, b) =>
    haversineKm(b, finalDest) < haversineKm(a, finalDest) ? b : a,
  );


  /*
    Lựa chọn nơi xuất phát — app đã dạy tư duy "Điểm của tôi" thì dẫn đường
    phải nói cùng ngôn ngữ: Cảng nhà / chỗ ghim lên đầu, rồi GPS, rồi cảng
    gần đích nhất. Mặc định = Cảng nhà (nếu đặt rồi) — KHÔNG đoán theo đích.
  */
  const myPlaces = sortedPlaces(places).slice(0, 4); // cảng nhà đứng đầu
  /*  ĐI TỪ và ĐIỂM ĐẾN dùng CÙNG MỘT BỘ NGUỒN (user 2026-08-28i: "đi từ và
      điểm đến đều có thêm điểm tương tự nhau"): chỗ đang xem trên bản đồ ·
      điểm đã lưu · cảng · vị trí tàu. Trước đây "đi từ" thiếu hẳn "chỗ đang
      xem" — muốn xuất phát từ một chỗ ngoài biển là không có đường nào. */
  const startOptions: { id: string; label: string; coord: LatLon | null }[] = [
    {
      id: "cursor",
      label: `Chỗ đang xem — ${fmtCoordPair(dest.lat, dest.lon, prefs.coordFormat)}`,
      coord: dest,
    },
    ...myPlaces.map((p) => ({
      id: `place:${p.id}`,
      label: p.kind === "home" ? `Cảng nhà — ${p.name}` : `Chỗ ghim — ${p.name}`,
      coord: { lat: p.lat, lon: p.lon },
    })),
    { id: "gps", label: "Chỗ tàu tôi đang đứng (định vị)", coord: null },
    {
      id: `port:${nearestPort.id}`,
      label: `Cảng ${nearestPort.name} — gần điểm đến nhất`,
      coord: { lat: nearestPort.lat, lon: nearestPort.lon },
    },
  ];
  const defaultStartId =
    myPlaces.find((p) => p.kind === "home") != null
      ? `place:${myPlaces.find((p) => p.kind === "home")!.id}`
      : `port:${nearestPort.id}`;
  const effectiveStartId = startId || defaultStartId;
  /** toạ độ nơi xuất phát ĐANG CHỌN — null với lựa chọn "định vị" (chưa biết) */
  const startCoord =
    startOptions.find((o) => o.id === effectiveStartId)?.coord ?? null;
  /*  BÁO RA NGOÀI ĐỂ BẢN ĐỒ VẼ NHÃN ĐOẠN ĐẦU (2026-08-29g). Thẻ vốn đã in
      "↓ 229 hải lý thẳng" cho đoạn xuất phát → chỗ 1, nhưng bản đồ thì không:
      lớp vẽ nằm ở màn cha, mà nơi xuất phát chỉ RouteMode mới biết. Hai chỗ
      nói hai kiểu về cùng một đoạn là chỗ bà con mất tin. */
  useEffect(() => {
    onStartCoord?.(startCoord);
  }, [onStartCoord, startCoord?.lat, startCoord?.lon]);

  /*  TUYẾN TRÊN BẢN ĐỒ CÒN KHỚP KHÔNG — so CẢ CHUỖI điểm đến qua
      `routeMatchesStops` (bỏ một điểm GIỮA thì điểm cuối không đổi ⇒ phép so
      điểm cuối im, trong khi bản đồ vẫn vẽ vạch xuyên qua chỗ vừa loại) VÀ so
      cả NƠI XUẤT PHÁT qua `routeStartMatches` (đổi "Điểm xuất phát" sau khi
      tính thì trước đây không có gì reset: ba con số giữ nguyên, vạch xanh vẫn
      chạy từ cảng cũ, không băng nào bật). Băng bật thường hơn — thà báo thừa
      còn hơn im, đây là cảnh báo an toàn. */
  const chainStale =
    activeRoute != null && !routeMatchesStops(activeRoute.stops, stops, dest);
  const startStale =
    activeRoute != null && !routeStartMatches(activeRoute.start, startCoord);
  const staleRoute = chainStale || startStale ? activeRoute : null;
  /*  Điểm CUỐI có đổi không — CHỈ dùng để CHỌN CÂU cho băng cảnh báo, KHÔNG
      dùng để quyết định có cảnh báo hay không (đó là việc của staleRoute). */
  const staleDestMoved =
    staleRoute != null &&
    (Math.abs(staleRoute.dest.lat - finalDest.lat) > 1e-6 ||
      Math.abs(staleRoute.dest.lon - finalDest.lon) > 1e-6);

  async function compute() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      let start: LatLon;
      let startLabel: string;
      if (effectiveStartId === "cursor") {
        start = { lat: dest.lat, lon: dest.lon };
        startLabel = "Chỗ đang xem";
      } else if (effectiveStartId === "gps") {
        try {
          start = await myPosition();
        } catch {
          setError(
            "Chưa lấy được vị trí tàu — bật định vị giúp, hoặc chọn đi từ cảng.",
          );
          return;
        }
        startLabel = "Chỗ tàu tôi";
      } else if (effectiveStartId.startsWith("place:")) {
        const pl = places.find(
          (p) => `place:${p.id}` === effectiveStartId,
        );
        if (pl) {
          start = { lat: pl.lat, lon: pl.lon };
          startLabel = pl.kind === "home" ? `Cảng nhà ${pl.name}` : pl.name;
        } else {
          start = { lat: nearestPort.lat, lon: nearestPort.lon };
          startLabel = `Cảng ${nearestPort.name}`;
        }
      } else {
        const portId = effectiveStartId.replace(/^port:/, "");
        const port = PORTS.find((p) => p.id === portId) ?? nearestPort;
        start = { lat: port.lat, lon: port.lon };
        startLabel = `Cảng ${port.name}`;
      }

      /*  Mỗi CHẶNG phải đủ dài: lưới tìm đường bước tối thiểu 4 km, hai điểm
          sát nhau hơn thế thì Dijkstra không có chỗ mà đi. Nói rõ chặng nào
          để bà con biết sửa chỗ nào, đừng bắt đoán. */
      const legPts = [start, ...chainStops];
      for (let i = 1; i < legPts.length; i++) {
        if (haversineKm(legPts[i - 1], legPts[i]) < 5) {
          setError(
            stops.length
              ? i === 1
                ? "Chỗ ghé 1 đang quá gần nơi xuất phát — chấm chỗ xa hơn trên biển."
                : `Chỗ ghé ${i} và chỗ ghé ${i - 1} đang quá sát nhau — chấm cách nhau xa hơn.`
              : "Điểm đến đang quá gần nơi xuất phát — chạm chỗ xa hơn trên biển.",
          );
          return;
        }
      }

      const boat: BoatProfile = {
        speedKn: clampNum(speedKn, 2, 30, DEFAULT_BOAT.speedKn),
        litersPerHour: clampNum(lph, 1, 300, DEFAULT_BOAT.litersPerHour),
      };
      writeBoat(boat);
      setSpeedKn(String(boat.speedKn));
      setLph(String(boat.litersPerHour));

      // độ sâu fail vẫn tính tiếp — kết quả sẽ tự cảnh báo "chưa né vùng
      // cạn". Kéo SONG SONG với thời tiết (hai nguồn độc lập, đừng bắt nhau
      // chờ); promise await lại trong vòng nở khung vẫn chỉ fetch một lần
      const depthPromise = fetchDepthGrid().catch(() => null);
      const departHourIdx = vnHourIndex(new Date());
      // tổng chiều dài chuỗi điểm (không phải chỉ đầu–cuối): đường đi vòng qua
      // mấy chỗ ghé cần khung rộng theo QUÃNG THẬT, không theo đường chim bay
      let dist = 0;
      for (let i = 1; i < legPts.length; i++) {
        dist += haversineKm(legPts[i - 1], legPts[i]);
      }
      // khung nhỏ trước cho nhanh; chưa có lối (vd phải vòng qua mũi đất)
      // thì nở khung rộng gấp mấy lần quãng đường rồi tìm lại
      const margins = [
        Math.min(150, Math.max(45, dist * 0.3)),
        Math.min(420, Math.max(200, dist * 1.1)),
      ];
      let plan: RoutePlan | null = null;
      let stopWpIdx: number[] = [];
      // tên khác `legs` của vòng trong (mảng RoutePlan) — đừng để che nhau
      let legSums: LegSummary[] = [];
      // lưới đã dùng cho tuyến CHỌN: 'grid' = lùi về bản lưu offline → báo thật
      let chosenField: WeatherField | null = null;
      // chặng nào chặn đường — để câu lỗi chỉ đúng chỗ thay vì nói chung chung
      let failedLeg = 0;
      for (const m of margins) {
        /*  MỘT trường thời tiết cho CẢ chuỗi điểm, dùng lại cho mọi chặng.
            Hỏi mạng từng chặng thì đường đi 6 chỗ = 6 lượt gọi giữa biển —
            mỗi lượt là một lượt có thể treo. Đổi lại lưới thô hơn chút (adapter
            kẹp ≤120 điểm cho mọi khung), thuật toán vẫn nội suy như cũ. */
        const bbox = clampBBox(bboxOfPoints(legPts, m));
        const [field, depth] = await Promise.all([
          fetchWeatherField(bbox),
          depthPromise,
        ]);
        // Dijkstra chạy trong Web Worker — màn không đơ lúc "Đang tính…"
        const legs: RoutePlan[] = [];
        let hoursSoFar = 0;
        for (let i = 1; i < legPts.length; i++) {
          const leg = await planRouteAsync({
            start: legPts[i - 1],
            dest: legPts[i],
            boat,
            // giờ xuất phát CỦA CHẶNG NÀY = giờ rời bến + giờ đã chạy các chặng
            // trước ⇒ sóng/gió tra đúng thời điểm tàu thật sự tới đó
            departHourIdx: departHourIdx + Math.round(hoursSoFar),
            field,
            depth,
            bbox,
          });
          if (!leg) {
            failedLeg = i;
            break;
          }
          legs.push(leg);
          hoursSoFar += leg.hours;
        }
        if (legs.length === legPts.length - 1) {
          const merged = mergeLegPlans(legs);
          if (merged) {
            plan = merged.plan;
            stopWpIdx = merged.stopWpIdx;
            legSums = merged.legs;
            chosenField = field;
            break;
          }
        }
      }
      if (!plan) {
        const where =
          stops.length > 1 && failedLeg > 0
            ? failedLeg === 1
              ? " ở chặng từ nơi xuất phát tới chỗ ghé 1"
              : ` ở chặng từ chỗ ghé ${failedLeg - 1} tới chỗ ghé ${failedLeg}`
            : "";
        setError(
          `Chưa tìm được đường an toàn${where} — giữa đường vướng đất liền, bãi cạn hoặc sóng quá dữ (trên 4 m).`,
        );
        setResult(null);
        onRoute(null);
        return;
      }
      // ĐỐI CHIẾU TIN BÃO (team review 2026-07-26): GFS lưới thô ước non
      // cường độ bão — sóng/gió trên tuyến có thể dưới ngưỡng chặn số dù bão
      // đang vào. Tuyến đi vào vùng bão → CHẶN HẲN, không vẽ.
      /*  CÓ ĐỐI CHIẾU ĐƯỢC KHÔNG ĐÃ (2026-08-16, thẩm định P0). `storms` rỗng
          có hai nghĩa khác hẳn nhau — "hỏi được, không có bão" và "chưa hỏi
          được" — mà nhánh dưới đối xử y hệt. Không chặn (chủ dự án chốt: giữa
          biển mất sóng vẫn phải tính được tuyến), nhưng phải NÓI RA. */
      const gate = stormGateForRoute(stormInfo);
      setStormWarn(gate.warnText);
      const conflict = routeStormConflict(plan.waypoints, storms);
      if (conflict) {
        const s = conflict.storm;
        setError(
          `KHÔNG VẼ TUYẾN — đường đi cắt vào vùng nguy hiểm của ${s.kindLabel.toLowerCase()} ${s.name} ` +
            `(trong vòng ${STORM_SAFE_RADIUS_KM} km quanh tâm hoặc đường đi dự báo của bão). ` +
            `Hoãn chuyến, nghe đài duyên hải trước khi quyết.`,
        );
        setResult(null);
        onRoute(null);
        return;
      }
      // Lùi về lưới đã lưu (offline) → nhớ mốc lưu để banner nói thật; dự báo
      // mới (online) → xóa cờ. source undefined = 'live'.
      setOfflineSavedAt(
        chosenField?.source === "grid" ? chosenField.savedAt ?? null : undefined,
      );
      const r: PlannedRoute = {
        plan,
        start,
        startLabel,
        dest: finalDest,
        stops: chainStops,
        legs: legSums,
        legBoundsKm: cumulativeKmAt(plan.waypoints, stopWpIdx),
        stopWpIdx,
      };
      setResult(r);
      onRoute(r);
      // tính xong thì thẻ về dạng đọc kết quả gọn, không để biểu mẫu đè lên
      setEditing(false);
    } catch {
      setError(
        "Chưa lấy được dự báo cho tuyến và trong máy chưa có lưới đã lưu. " +
          "Mở màn Ra khơi lúc còn sóng để máy tự tải sẵn gió sóng, rồi thử lại.",
      );
    } finally {
      setBusy(false);
    }
  }

  function clearRoute() {
    setResult(null);
    setError(null);
    setOfflineSavedAt(undefined);
    onRoute(null);
  }

  /*  TUYẾN CŨ CÒN TRÊN BẢN ĐỒ — nay là MỘT CÂU THAY CHO DÒNG TIÊU ĐỀ trong
      thanh ghim trên, KHÔNG còn là một băng riêng (2026-08-29, đo rồi mới
      chốt).
      Bản băng riêng (3 câu dài + pill "Xoá vạch cũ") cao ~104px; rút xuống
      [câu ≤2 dòng] + [ô SQ_BTN] vẫn còn ~72px vì cột chữ chỉ rộng ~183px. Đo
      thật 375×812 với 2 chỗ ghé: thanh ghim trên phình 60 → 140px, thanh ghim
      đáy đứng ở 647 ⇒ CỬA ĐỌC CÒN 12px. Biểu mẫu (Điểm xuất phát · Bỏ · Thêm
      điểm dừng) coi như không với tới được — đúng bế tắc cần gỡ.
      Vì sao THAY tiêu đề chứ không thêm dòng: tiêu đề "Đường đi qua N chỗ"
      SUY RA ĐƯỢC từ chính danh sách ngay dưới, câu cảnh báo thì không. Thay
      thì slot tiêu đề (rộng ~119px) chứa 3 dòng chữ 0.875rem ≈ 53px < 56px
      của hàng ⇒ thanh ghim KHÔNG cao thêm một px, cửa đọc về đúng 92px.
      Vì sao BỎ nút "Xoá vạch cũ": sau khi lối chạm-giữ tự dọn vạch cũ
      (fishing-map-view), cảnh này chỉ còn xảy ra khi CHÍNH bà con sửa danh
      sách sau khi đã tính — mà lối thoát đúng của ca đó là "Tính đường/Tính
      lại", vốn đã ghim sẵn dưới ngón cái. Một nút chỉ-xoá-vạch là đường thứ
      ba cho cùng một việc, mà nó ngốn đúng khoảng trống đang thiếu. Muốn dọn
      sạch vẫn còn "Xoá hết" ở header (có nhịp xác nhận). Cảnh báo KHÔNG bị
      giấu: nó nằm trong thanh ghim, thấy ở mọi vị trí cuộn, tô màu cảnh báo. */
  const staleMsg = staleRoute
    ? !chainStale && startStale
      ? /*  Danh sách điểm y nguyên, chỉ nơi xuất phát đổi: nhìn điểm đến
            thấy đúng hết nên phải chỉ thẳng vào cái đã lệch. */
        "Vạch xanh còn đi từ nơi xuất phát CŨ"
      : staleDestMoved
        ? "Vạch xanh còn dẫn tới chỗ chạm trước"
        : /*  Điểm cuối vẫn thế mà chuỗi đã lệch (thêm/bỏ điểm GIỮA): phải nói
              thẳng vạch xanh là đường CŨ, vì nhìn điểm đến thì thấy y như cũ. */
          "Vạch xanh là đường CŨ, lệch danh sách dưới"
    : null;

  /*  ĐƯỜNG ĐI NHIỀU ĐIỂM — nút PHỤ (nền field), không phải primary: 07 §5 chốt
      màn Ra khơi chỉ có MỘT primary là "Dẫn đường tới chỗ này". */


  /*  MÁY KHÔNG GIỮ ĐƯỢC DANH SÁCH (K4) — nói ngay, đừng để bà con chấm 5 chỗ
      rồi tắt app mới biết mất. */
  const stopsSaveBar =
    stopsSaveFailed && stops.length ? (
      <p className="rounded-xl bg-[var(--warn-bg)] px-3 py-2.5 text-[0.9375rem] font-semibold leading-snug text-[var(--warn)]">
        Máy không giữ được danh sách chỗ ghé — tắt app là mất. Ghi ra giấy giúp,
        hoặc dọn bớt ảnh/dữ liệu trong máy rồi thử lại.
      </p>
    ) : null;

  const plan = result?.plan ?? null;

  /*  Ý CẢNH BÁO NGUY HIỂM — dựng MỘT LẦN, MỘT CHỖ, vì có HAI nơi đọc: khối đỏ
      đầy đủ trong thân thẻ và dải một dòng trong thanh ghim đáy. Hai chỗ tự
      dựng lấy chữ là hai luật cảnh báo an toàn sớm muộn cũng lệch nhau.
      Thứ tự các ý GIỮ NGUYÊN như bản cũ (07 §12(4)). */
  /*  `label` = NHÃN 2–3 CHỮ cho dải ghim đáy (2026-08-29). Dải ghim trước đây
      chỉ thêm mảnh "· sóng tới X m" — một CON SỐ, không nói mối nguy LÀ GÌ;
      chữ "nguy hiểm" và bản chất nằm duy nhất trong khối đỏ phải vuốt hai lần
      mới tới, trong khi nút "Dẫn đường" thì ghim sẵn dưới ngón cái. Đó là
      đường ít trở lực dẫn thẳng tới chỗ bấm chạy mà chưa đọc cảnh báo.
      Vì sao nhãn ngắn chứ KHÔNG bê nguyên `text`: các câu này dài 110–200 ký
      tự, nhét vào cột ~271px của dải ghim là 5–8 dòng ⇒ ghim phình 76→150px,
      cửa đọc 88px còn ~15px — lôi cảnh báo lên mà lại chôn nó sâu hơn. */
  const dangerItems = useMemo<
    { text: string; label: string; danger: boolean }[]
  >(() => {
    if (!plan) return [];
    const items: { text: string; label: string; danger: boolean }[] = [];
    if (plan.hasRoughLeg)
      items.push({
        danger: true,
        label: "Sóng quá lớn",
        text: `Có đoạn sóng tới ${formatNumberVN(plan.maxWaveM)} m, gió cấp ${beaufort(plan.maxWindKmh)} — mức KHÔNG NÊN ĐI với tàu nhỏ. Cân nhắc hoãn chuyến, nghe đài trước khi quyết.`,
      });
    if (plan.hasFollowingSeaRisk && !plan.hasRoughLeg)
      items.push({
        danger: false,
        label: "Sóng dồn đuôi",
        text: "Có đoạn sóng dồn từ phía đuôi (≥2 m, sóng ngắn) — dễ trượt sóng: tới đoạn đó giảm ga, đừng để sóng vỗ thẳng đuôi tàu.",
      });
    if (plan.hasVeryShallowLeg)
      items.push({
        danger: true,
        label: "Bãi rất cạn",
        text: "Có đoạn đè lên vùng RẤT CẠN / bãi nổi (dưới 4 m) gần nơi xuất phát hoặc điểm đến — chỉ vào theo con nước lên, đi chậm, hỏi người rành luồng lạch chỗ đó.",
      });
    if (plan.hasNearLandLeg)
      items.push({
        danger: true,
        label: "Đè lên bờ",
        text: "Đoạn đầu (hoặc cuối) tuyến đè lên phần BỜ theo bản đồ độ sâu của máy — chỗ vào cảng máy không vẽ chính xác được; đoạn đó đi theo luồng quen và hải đồ, đừng bám vạch trên màn hình.",
      });
    if (plan.hasShallowLeg)
      items.push({
        danger: false,
        label: "Nước nông",
        text: "Tuyến có đoạn nước nông (cỡ 4–12 m) — để ý con nước, hải đồ đoạn đó.",
      });
    return items;
  }, [plan]);
  const anyDanger = dangerItems.some((i) => i.danger);
  /*  Ý ĐƯỢC LÊN DẢI GHIM: ưu tiên ý ĐỎ, mới tới ý vàng. Dùng `find`, TUYỆT
      ĐỐI KHÔNG `dangerItems[0]`: ca (không sóng dữ) + (sóng dồn đuôi) + (bãi
      rất cạn) cho items[0].danger === false trong khi `anyDanger` === true ⇒
      lấy [0] là tô ĐỎ một câu vốn chỉ ở mức nhắc. */
  const topDanger =
    dangerItems.find((i) => i.danger) ?? dangerItems[0] ?? null;

  /*  Có gì để dọn không: tuyến ĐÃ TÍNH **hoặc** chỗ ghé đã chấm. Bản đầu chỉ
      xét tuyến ⇒ chấm 3 chỗ rồi mà chưa bấm tính thì không có nút nào dọn, phải
      chạm lại từng chỗ để bỏ (đo thật 2026-08-28, bắt được). */
  /*  KHOẢNG CÁCH TỪNG CHẶNG ngay lúc chấm điểm (2026-08-29, chủ dự án: "lúc
      thêm các điểm thì tính luôn khoảng cách giữa các điểm liên tiếp").
      Đây là CHIM BAY, không phải quãng tuyến đã né sóng/cạn — hai số khác nhau
      nên chữ phải ghi rõ "thẳng", đừng để đọc nhầm thành quãng chạy thật.
      Tính ngay, KHÔNG chờ bấm Tính: bà con cần biết chặng có quá dài không
      TRƯỚC khi bỏ mươi giây chờ máy tính tuyến.
      Chặng đầu đo từ nơi xuất phát; chọn "định vị" thì chưa biết toạ độ ⇒ trả
      null và không hiện dòng nào — thà im còn hơn bịa số. */
  const legKm = (i: number): number | null => {
    const prev = i === 0 ? startCoord : stops[i - 1];
    if (!prev) return null;
    return haversineKm(prev, stops[i]);
  };
  const currentStop = stopAt(stops, dest.lat, dest.lon);
  // ví dụ gõ khớp hệ toạ độ đang đặt — cùng câu với ô "Đến điểm" của rail
  const egCoord =
    prefs.coordFormat === "dms"
      ? { lat: "8 30", lon: "109 18" }
      : { lat: "8,5", lon: "109,3" };
  const stopsFull = stops.length >= MAX_STOPS;
  /*  DÒNG CHỮ CỦA THANH GHIM ĐÁY — CHỈ CẤP DỮ LIỆU, không dạy cách đọc.
      Tổng đường CHẠY THẲNG cộng từ chính `legKm` (không đẻ phép đo thứ hai) —
      nó là con số bà con cần để biết chuyến có đáng đi không, TRƯỚC khi bỏ mươi
      giây chờ máy tính tuyến né sóng gió.
      Một chặng chưa biết (xuất phát bằng "định vị", chưa có toạ độ) là KHÔNG
      cộng ra tổng: thà nói số chỗ thôi còn hơn bịa một con số thiếu chặng đầu. */
  let thangKm: number | null = 0;
  for (let i = 0; i < stops.length; i++) {
    const d = legKm(i);
    if (d == null) {
      thangKm = null;
      break;
    }
    thangKm += d;
  }
  const ghimTomTat =
    stops.length === 0
      ? "Chưa chọn điểm đến"
      : `${stops.length} chỗ${
          thangKm != null ? ` · ~${fmtDist(thangKm, prefs.distUnit)} thẳng` : ""
        }`;
  /** câu cảnh báo cho chỗ con trỏ đang đứng — null là im (xem DEST_DEPTH_WARN) */
  const destDepthWarn =
    destDepth != null ? (DEST_DEPTH_WARN[destDepth] ?? null) : null;
  const coGiDeXoa = activeRoute != null || result != null || stops.length > 0;

  /*  XOÁ HẲN: tuyến trên bản đồ + chuỗi chỗ ghé + kết quả. Chủ dự án đòi
      "bao gồm cả xoá route" — trước đây chỉ có nút "Xoá đường" nằm lọt trong
      thẻ kết quả, mà chỗ ghé thì vẫn nằm lại nên bấm xong tuyến cũ vẫn "còn
      sống" một nửa. Nay một nút dọn sạch cả hai, luôn nhìn thấy ở thanh trên. */
  const clearAll = () => {
    clearRoute();
    if (stops.length) onStops?.(clearStops());
  };

  return (
    <>
      {/*  THANH TRÊN kiểu Google Maps — luôn thấy, không cuộn mất: đang đi từ
           đâu · qua mấy chỗ · Xoá tuyến · Đóng. Bản đồ ở giữa vẫn lộ. */}
      {/*  MỘT THẺ DUY NHẤT (user 2026-08-28f: "gộp cái dẫn đường tới chỗ đang
           xem và cái tính đường đỡ tốn dầu vào cùng 1 chỗ, đừng tách cái ở trên
           cái ở dưới nó rối"). Trước đó tên chuyến + Xoá tuyến + X nằm ở thanh
           trên, nút Tính nằm thẻ dưới — mắt phải chạy hai đầu màn cho MỘT việc,
           lại tốn hai lớp khung. Nay tất cả trong một thẻ ở đáy, tầm ngón cái;
           bản đồ phía trên sạch hẳn, không còn thanh nào đè lên rail. */}
      {/*  NHỊP CHỜ XÁC NHẬN XOÁ HUỶ KHI BÀ CON ĐỤNG VÀO VIỆC KHÁC — thay cho
           timer 4 giây của bản trước. Timer là THAO TÁC CÂM: nút lặng lẽ đổi
           chữ dưới mắt bà con, cú bấm thứ hai rơi vào một nút đã reset (tưởng
           đã xoá mà chưa xoá, hoặc bấm lần ba thành xoá lúc không định).
           Luật nay nói ra được thành lời: "đang hỏi mà đi làm việc khác thì
           thôi không hỏi nữa". `Capture` để chạy trước onClick của nút con. */}
      {/*  `scroll-pt` / `scroll-pb` — CHỪA CHỖ CHO HAI THANH GHIM KHI MÁY TỰ
           CUỘN. Hai thanh đó nền đục và nằm ĐÈ lên vùng cuộn, nhưng
           `scrollIntoView({block:"nearest"})` chỉ tính theo mép khung cuộn ⇒
           khối vừa xổ ra dừng đúng chỗ bị che (đã dính: ô "Chọn một cảng…" nằm
           dưới nút "Tính đường đỡ tốn dầu", hàng "Bỏ điểm 2" bị header nuốt).
           Số đo THẬT trên máy (375×812, gốc chữ 14px của chế độ "gọn"):
             trên = thanh ghim đo được 49px, cộng khoảng cách 7 + băng
                    "vạch xanh là đường cũ" 63 (py-2 14 + nút 49) ≈ 119px ở
                    trạng thái CAO NHẤT → lấy dư 9rem (126px);
             dưới = thanh ghim của BIỂU MẪU, đo được 66,5px → lấy dư 5rem.
                    CỐ Ý không lấy theo thanh ghim dày hơn của màn ĐỌC KẾT
                    QUẢ: ở đó cú cuộn duy nhất là scrollTo({top:0}) — tuyệt
                    đối, không ăn scroll-padding. Lấy dư thêm nữa thì ô cửa
                    còn lại (296px trừ hai lề) hẹp tới mức phản tác dụng.
           TRẦN PHẢI NÓI RA: cái này CHỈ chữa các cú cuộn TỰ ĐỘNG. Khối xổ ra
           cao hơn cả khung nhìn (bộ chọn điểm đến liệt kê TOÀN BỘ điểm đã lưu)
           thì phần đuôi vẫn phải vuốt tay, và lúc vuốt tay vẫn có thể dừng ở
           chỗ bị thanh ghim đè. */}
      <div
        ref={boxRef}
        onPointerDownCapture={(e) => {
          if (
            confirmClear &&
            !(e.target as HTMLElement).closest("[data-clear-btn]")
          )
            setConfirmClear(false);
        }}
        /*  TRẦN 31dvh (~252px trên màn 812) chứ không phải 38dvh: sàn "bản đồ
            >=60%" của 07 §5 phải giữ ở MỌI trạng thái, không chỉ lúc thẻ trống.
            Đo thật 2026-08-28j: trần 38dvh cho bản đồ 62% khi trống nhưng tụt
            về 53% ngay khi có 2 chỗ ghé (thẻ chạm trần 309px). Đổi lại thẻ phải
            cuộn trong khung khi mở danh sách — nợ: cuộn trên tàu lắc là thao tác
            khó, nâng cấp khi cắt được thêm hàng nào đó khỏi thẻ. */
        /*  ĐỆM CUỘN PHẢI BẰNG ĐÚNG HAI THANH GHIM (đo lại 2026-08-29).
            Trị số cũ 9rem/5rem (144+80=224px) là của bố cục CŨ, khi thanh ghim
            trên còn gánh tiêu đề riêng. Nay đo thật trên 375×812: ghim trên
            60px (mép dưới cách mép khung 72px), ghim đáy 76px (mép trên cách
            mép khung 88px) ⇒ cửa cuộn "hợp lệ" theo trị số cũ chỉ còn 28px,
            THẤP HƠN một hàng 56px. Hệ quả: MỌI cú cuộn tự động đều rơi vào
            nhánh "phần tử cao hơn cửa" và neo mép trên vào 144px — tức đẩy
            hàng vừa cuộn tới xuống ngay dưới thanh ghim đáy, đúng cái nó định
            tránh (bắt được khi đo cú cuộn "Thêm điểm dừng").
            4.5rem/5.5rem = đúng hai mép ghim ⇒ cửa 92px, một hàng 56px lọt
            trọn.
            // nợ: hai trị số cứng, trong khi ghim trên CAO HƠN khi có băng
            // cảnh báo tuyến-cũ (~120px) — lúc đó hàng vẫn có thể nằm dưới
            // ghim. Nâng cấp khi chiều cao hai thanh ghim được đo/đưa vào
            // CSS var thay vì hằng số. */
        className="pointer-events-auto max-h-[31dvh] scroll-pb-[5.5rem] scroll-pt-[4.5rem] space-y-2 overflow-y-auto surface p-3"
      >
        {/*  HÀNG TRÊN GHIM LẠI (sticky): thẻ luôn tràn khung 38dvh nên cuộn là
             chuyện thường trực — không ghim thì nút X trôi mất khỏi tầm mắt.
             Nền `bg-card` (đúng nền .surface) + margin âm để phủ kín phần p-3
             phía trên; nền trong suốt là chữ chồng chữ, nắng chói đọc không ra. */}
        {/*  BĂNG "VẠCH XANH LÀ ĐƯỜNG CŨ" NẰM TRONG CHÍNH THANH GHIM TRÊN.
             Trước đây nó là con ĐẦU TIÊN của luồng cuộn thường: header ghim
             nền `bg-card` đục nên chỉ cần cuộn xuống một chút là băng chui
             xuống dưới header và biến mất — đúng lúc bản đồ đang vẽ vạch
             xuyên qua chỗ vừa bị loại. CLAUDE.md cấm giấu cảnh báo an toàn;
             theo đúng tiền lệ đã chốt cho dải cảnh báo trong khối ghim đáy.
             `stopsSaveBar` CỐ Ý ở lại luồng cuộn: nó là trạng thái dai dẳng
             (máy hỏng kho), ghim thêm là header phình thường trực. */}
        <div className="sticky top-0 z-10 -mx-3 -mt-3 space-y-2 bg-card px-3 pt-3">
          <div className="flex items-center gap-2">
          {/*  HEADER GÁNH LUÔN "TUỲ CHỌN" (2026-08-28j): thẻ phải cắt 42px nữa
               mới đạt sàn bản đồ ≥60% của 07 §5 — đo thật: thẻ 296px ⇒ bản đồ
               55%. Hàng "Tuỳ chọn — tàu N hl/giờ" chiếm trọn một hàng 56px cho
               thứ chủ tàu nhập MỘT LẦN dùng cả đời; kéo nó lên header thành
               nút biểu tượng là đủ chỗ, mà vẫn cách một chạm như cũ. Số liệu
               tốc độ/dầu vẫn đọc được ngay khi mở nó ra. */}
          {/*  MỘT Ô, MỘT CHỖ, HAI VIỆC THEO NGỮ CẢNH (chủ dự án 2026-08-29g:
               *"cái dấu X đóng quá thô, tuỳ chọn, đóng, back về, tính đường là
               nó nằm cùng 1 hàng ở trên luôn cho đỡ tốn vị trí"*).

               Đang xổ một bộ chọn ⇒ **Quay lại** (về danh sách). Ở gốc ⇒
               **Thoát** (ra khỏi dẫn đường). Hai việc KHÔNG BAO GIỜ cần cùng
               lúc nên chung một ô là đủ, không tốn thêm chỗ.

               MŨI TÊN TRÁI THAY DẤU X: X đọc là "huỷ / vứt đi" — đặt cạnh một
               tuyến vừa tính 10 giây thì thô đúng như chủ dự án nói. Mũi tên
               trái là "lùi một bước", đúng thứ nút này làm, và là hình bà con
               gặp hằng ngày ở Zalo/Maps. Nhãn đổi theo việc nên không thành nút
               bí ẩn. */}
          <button
            type="button"
            onClick={() => (panel === "idle" ? onClose() : setPanel("idle"))}
            aria-label={
              panel === "idle" ? "Thoát dẫn đường" : "Quay lại danh sách điểm"
            }
            className={`${SQ_BTN} -my-1 bg-navy/10 text-navy`}
          >
            <ChevronLeftIcon className="h-6 w-6" />
            {panel === "idle" ? "Thoát" : "Quay lại"}
          </button>
          <div className="min-w-0 flex-1">
            {/*  Có kết quả rồi thì TIÊU ĐỀ LÀ NÚT mở lại danh sách điểm — có
                 chevron để không thành nút bí ẩn. Chưa tính thì biểu mẫu đang
                 mở sẵn, tiêu đề chỉ là chữ.
                 ĐANG XỔ MỘT PANEL thì tiêu đề panel THẮNG (nhánh dưới) — kể cả
                 khi đã có tuyến. Bản trước nhánh `plan` đứng trước nên mở
                 "Đường đã lưu" mà tiêu đề vẫn ghi "Đường đi qua 2 chỗ": bà con
                 không biết mình đang ở đâu, mà nút "Quay lại" thì đã đổi chữ —
                 hai tín hiệu đá nhau. */}
            {plan && panel === "idle" ? (
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                aria-expanded={editing}
                /*  Khi có cảnh báo, chữ hiện ra LÀ câu cảnh báo — đặt
                    `aria-label` để tai nghe được cả cảnh báo lẫn việc nút này
                    làm, thay vì nghe mỗi câu cảnh báo rồi không biết bấm ra gì. */
                aria-label={
                  staleMsg
                    ? `${staleMsg}. Chạm để mở danh sách điểm.`
                    : undefined
                }
                className="flex min-h-[3.5rem] w-full items-center gap-1.5 text-left"
              >
                {staleMsg ? (
                  /*  KHÔNG `truncate`: câu cảnh báo bị cắt cụt là mất đúng vế
                      nói rõ cái gì đang lệch. Ba dòng 0.875rem vẫn thấp hơn
                      hàng 3.5rem nên không đội chiều cao thanh ghim. */
                  <span className="min-w-0 flex-1 text-[0.875rem] font-bold leading-tight text-[var(--warn)]">
                    {staleMsg}
                  </span>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-[1rem] font-bold leading-tight text-navy">
                    {stops.length > 1
                      ? `Đường đi qua ${stops.length} chỗ`
                      : stops.length === 1
                        ? "Đường đi tới chỗ đã đánh dấu"
                        : "Dẫn đường tới chỗ đang xem"}
                  </span>
                )}
                <ChevronRightIcon
                  className={`h-5 w-5 shrink-0 text-foreground/40 transition-transform ${
                    editing ? "rotate-90" : ""
                  }`}
                  aria-hidden
                />
              </button>
            ) : staleMsg ? (
              <p className="text-[0.875rem] font-bold leading-tight text-[var(--warn)]">
                {staleMsg}
              </p>
            ) : panel !== "idle" ? (
              /*  MỘT SHEET, TIÊU ĐỀ NÓI ĐANG LÀM GÌ (chủ dự án 2026-08-29g:
                  *"tại sao click vào lại xổ ra 3 phần khác nhau, sao ko gom 1
                  sheet thôi"*). Trước đây mỗi bộ chọn là một khối hình khác
                  nhau bung ra DƯỚI hàng vừa bấm, hàng mỏ neo vẫn nằm đó, nên
                  nhìn ra ba tấm thẻ khác nhau. Nay: một tấm thẻ duy nhất, tiêu
                  đề đổi theo việc, nút Quay lại luôn ở cùng một ô — bà con
                  luôn biết mình đang ở đâu và lùi bằng cách nào. */
              <p className="truncate text-[1rem] font-bold leading-tight text-navy">
                {panel === "start"
                  ? "Đi từ đâu"
                  : panel === "dest"
                    ? "Thêm một chỗ"
                    : panel === "saved"
                      ? "Đường đã lưu"
                      : "Tuỳ chọn tàu"}
              </p>
            ) : (
              <>
                <p className="truncate text-[1rem] font-bold leading-tight text-navy">
                  {stops.length > 1
                    ? `Đường đi qua ${stops.length} chỗ`
                    : stops.length === 1
                      ? "Đường đi tới chỗ đã đánh dấu"
                      : "Dẫn đường tới chỗ đang xem"}
                </p>
                {/*  KHÔNG in `ghimTomTat` ở đây nữa (2026-08-29h): hàng "Xoá
                     hết" ngay dưới đã mang đúng câu đó làm thân hàng, in cả
                     hai chỗ là đọc hai lần cùng một con số trên một màn 375px.
                     Chỗ đúng của nó là hàng dưới — ở đó nó vừa cấp dữ liệu vừa
                     nói rõ cái sắp bị xoá là gì. */}
              </>
            )}
            {/*  ĐỦ TRẦN PHẢI NÓI RA: hết chỗ thì `addStop` trả nguyên danh sách,
                 bấm chip sẽ IM LẶNG không làm gì — bà con tưởng máy đơ. */}
            {/*  CHỈ nói khi ĐỦ TRẦN — lúc đó hàng "Thêm điểm" biến mất, không
                 nói ra thì bà con tưởng máy nuốt mất nút. Còn lại thì im: hàng
                 "Thêm điểm đang xem" ngay dưới đã tự nói nó làm gì. */}
            {stopsFull && (
              <p className="truncate text-[0.875rem] font-semibold leading-tight text-[var(--warn)]">
                Đã đủ {MAX_STOPS} điểm — bỏ bớt rồi mới thêm được
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setPanel(panel === "boat" ? "idle" : "boat")}
            aria-expanded={panel === "boat"}
            aria-label={`Tuỳ chọn — tàu chạy ${speedKn} hải lý/giờ, ăn ${lph} lít dầu/giờ`}
            className={`${SQ_BTN} -my-1 ${
              panel === "boat" ? "bg-t1 text-white" : "bg-navy/10 text-t1"
            }`}
          >
            <FuelIcon className="h-6 w-6" />
            Tuỳ chọn
          </button>
          {/*  MỘT Ô HÀNH ĐỘNG, LUÔN LÀ VIỆC KẾ TIẾP (2026-08-29g, mở rộng
               2026-08-29h). Ban đầu nút "Tính đường" nằm trong một DẢI GHIM ĐÁY
               riêng cao ~66px chỉ để chở một nút + một dòng tóm tắt — trên cửa
               đọc 252px thì đó là một phần tư chỗ. Kéo lên đây xong vẫn còn
               thanh ghim đáy THỨ HAI của màn kết quả (ba con số + "Dẫn đường"),
               tức thẻ 252px kẹp giữa hai thanh đứng yên, cửa đọc còn ~104px —
               chính cái chủ dự án gọi là *"freeze 2 cái trên dưới, nội dung ở
               giữa kéo khó đọc"*.

               Nay MỘT ô này gánh cả hai việc theo trạng thái: chưa có tuyến (hay
               đang sửa danh sách) ⇒ **Tính đường**; đã có tuyến và đang đọc kết
               quả ⇒ **Dẫn đường**. Hai việc không bao giờ là việc kế tiếp cùng
               lúc, nên chung một ô là ĐỦ, và nhờ vậy thanh ghim đáy bỏ được
               hẳn. "Tính lại" vẫn còn, nằm inline cuối hàng dặn dò bên dưới —
               nó là việc SỬA, không phải việc kế tiếp.

               Ô ở HÀNG GHIM nên cuộn sâu tới đâu cũng bấm được — thứ mà thanh
               đáy vốn dùng để bảo đảm, nay đạt mà không tốn thêm một thanh. */}
          {plan && result && !editing && onStart ? (
            <button
              type="button"
              onClick={() => onStart(result)}
              className={`${SQ_BTN} -my-1 bg-t1 text-white`}
            >
              <PlayIcon className="h-6 w-6" />
              Dẫn đường
            </button>
          ) : (
            <button
              type="button"
              onClick={compute}
              disabled={busy}
              className={`${SQ_BTN} -my-1 bg-t1 text-white disabled:opacity-60`}
            >
              <RouteIcon className="h-6 w-6" />
              {busy ? "Đang tính" : plan ? "Tính lại" : "Tính đường"}
            </button>
          )}
          </div>
        </div>
      {stopsSaveBar}

        {/*  XOÁ HẾT NẰM NGAY TRONG THẺ DẪN ĐƯỜNG, KHÔNG CHÔN TRONG PANEL
             (chủ dự án 2026-08-29h: *"xoá hết phải thực hiện trong cái chỗ
             dẫn đường nếu ko muốn hiện cái tuyến đang tính"*).

             Lượt trước tôi dời nó vào panel "Tuỳ chọn" với lý do "việc hiếm
             thì chôn sâu một chạm". Sai — bằng chứng là chính chủ dự án phải
             hỏi *"nút nào thì clear cái đường dẫn thế?"* trong lúc màn đang
             hiện băng "Vạch xanh còn dẫn tới chỗ chạm trước". App tự báo có
             vạch thừa rồi bắt đi tìm nút xoá ở phòng khác.

             ĐẶT NGOÀI KHỐI BIỂU MẪU (sửa tiếp 2026-08-29h, bắt được lúc đo):
             bản đầu tôi để nó trong khối `{(!plan || editing) && …}` nên ở màn
             KẾT QUẢ — đúng cảnh chủ dự án mô tả, tuyến đang hiện trên bản đồ —
             nút lại biến mất. Nay là hàng ĐẦU của thân thẻ ở CẢ HAI trạng
             thái, chỉ ẩn khi đang xổ một bộ chọn (lúc đó thẻ là của việc khác).

             Nay là HÀNG ĐẦU của danh sách, hiện ngay ở `scrollTop=0`: thân
             hàng nói ĐANG CÓ GÌ (số chỗ + quãng chim bay — dữ liệu, không
             phải chữ trang trí), ô vuông cuối hàng là việc. Nhịp xác nhận
             hai lần giữ NGUYÊN: không có lịch sử đường đi thì xoá là mất
             hẳn, phải hỏi lại. */}
        {panel === "idle" && coGiDeXoa && (
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 rounded-xl bg-background px-3 py-2 text-[0.9375rem] font-semibold leading-snug text-foreground/70">
              {stops.length > 0 ? ghimTomTat : "Đang có một tuyến đã tính"}
            </p>
            <button
              type="button"
              data-clear-btn
              onClick={() => {
                if (confirmClear) {
                  clearAll();
                  setConfirmClear(false);
                } else setConfirmClear(true);
              }}
              /*  Chờ xác nhận thì NỞ SANG PHẢI bằng `min-w` + căn giữa: hộp
                  chạm không được dịch giữa hai nhịp của CÙNG một thao tác
                  (bản trước nở về trái, cú bấm thứ hai rơi ra ngoài). */
              className={`${SQ_BTN} shrink-0 text-danger ${
                confirmClear ? "w-auto min-w-[8rem] flex-row gap-1 px-2.5" : ""
              } ${confirmClear ? "bg-danger-bg" : "bg-background"}`}
            >
              <TrashIcon className="h-5 w-5 shrink-0" />
              {confirmClear
                ? stops.length > 0
                  ? `Xoá cả ${stops.length} chỗ + tuyến?`
                  : "Xoá tuyến?"
                : "Xoá hết"}
            </button>
          </div>
        )}


      {/*  MỌI PANEL ĐỀU NẰM TRONG KHỐI NÀY, nên cổng phải mở cho MỌI panel —
           không phải kể tên từng cái (chủ dự án 2026-08-29h: *"cái tuỳ chọn…
           ở đoạn tính rồi click vô nó có tác dụng đâu… click ko có tác dụng
           thì ẩn"*).

           LỖI ĐÃ XẢY RA: cổng từng viết là `(!plan || editing)`, rồi vá thành
           `|| panel === "saved"` cho riêng đường-đã-lưu. Ở màn KẾT QUẢ bấm
           "Tuỳ chọn" thì `panel = "boat"` — khối này KHÔNG đủ điều kiện hiện,
           mà khối kết quả bên dưới lại ẩn vì `panel !== "idle"` ⇒ **thẻ rỗng**,
           nút "Quay lại" hiện ra để lùi khỏi một thứ chưa từng mở.

           LUẬT: không được có nút bấm-không-ra-gì. Cổng nay là `panel !==
           "idle"` — thêm panel mới sau này tự chạy, không phải nhớ vá chỗ
           thứ hai. Các hàng danh sách vẫn tự ẩn nhờ `compactRows`. */}
      {(!plan || editing || panel !== "idle") && (
        <>
          {/*  DANH SÁCH ĐIỂM KIỂU GOOGLE MAPS (user 2026-08-28g, kèm ảnh mẫu):
               hàng "Đi từ" xổ ra chọn cảng/vị trí · các điểm đã chọn xếp dưới,
               mỗi hàng một nút bỏ · dưới cùng là "Thêm điểm" (đúng vai "Add
               destination") · tốc độ + dầu nằm trong "Tuỳ chọn" ẩn/hiện.
               Bỏ chip nổi 3 giây của bản trước: có hàng "Thêm điểm" đứng sẵn
               trong danh sách thì chip là đường thứ hai làm cùng một việc — mà
               hai đường cho một việc chính là chỗ bà con thấy rối. */}
          {/*  MỘT LÚC CHỈ XỔ MỘT THỨ — nay THI HÀNH thật: bộ chọn nào đang mở
               thì các hàng không liên quan ẩn đi, chỉ giữ lại chính hàng vừa
               bấm làm mỏ neo (bà con biết mình đang ở đâu). Trước đây mở bộ
               chọn điểm đến mà phía trên còn header + Điểm xuất phát + N hàng
               điểm đã chọn ⇒ hàng điểm đã lưu bị cắt ngay lần xổ đầu. */}
          {/*  MỌI HÀNG MỘT KHUÔN, CỘT NÚT THẲNG (chủ dự án 2026-08-29: *"hàng thì
               thụt vào thụt ra, rồi icon button thì bố trí tùm lum trên dưới"*).
               Khuôn: `<div flex gap-2>` = [thân hàng nền `bg-background`, flex-1]
               + [ô nút vuông w-16]. Hàng nào KHÔNG có nút vẫn chừa đúng ô đó
               bằng một khối rỗng cùng bề ngang ⇒ mép phải của mọi thân hàng
               thẳng nhau, và mọi nút vuông nằm đúng MỘT cột. Trước đây hàng có
               nút thì thân bị co lại, hàng không nút thì thân kéo hết bề ngang
               — nhìn ra đúng cái "thụt vào thụt ra". */}
          {/*  LỐI VÀO ĐƯỜNG ĐÃ LƯU — chỉ hiện khi ĐÃ CÓ đường lưu. Chưa lưu cái
               nào mà bày hàng rỗng là dạy tính năng giữa lúc bà con đang làm
               việc khác; lối lưu nằm ở màn kết quả, đúng lúc có cái để lưu. */}
          {compactRows && savedRoutes.length > 0 && (
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 rounded-xl bg-background px-3 py-2 text-[0.9375rem] font-semibold leading-snug text-navy">
                Đường đã lưu · {savedRoutes.length} đường
              </p>
              <button
                type="button"
                onClick={() => setPanel("saved")}
                className={`${SQ_BTN} bg-background text-t1`}
              >
                <StarIcon className="h-6 w-6" />
                Mở
              </button>
            </div>
          )}

          {/*  HÀNG MỎ NEO BỎ HẲN KHI PANEL CỦA NÓ ĐANG MỞ (2026-08-29g):
               tiêu đề thẻ đã nói "Đi từ đâu" rồi, giữ thêm hàng mỏ neo là nói
               hai lần và ăn 56px của cửa đọc 252px. */}
          {compactRows && (
          <div className="flex items-center gap-2">
          <button
            ref={formRef}
            type="button"
            onClick={() => setPanel("start")}
            aria-expanded={false}
            className="flex min-h-[3.5rem] min-w-0 flex-1 items-center gap-2.5 rounded-xl bg-background px-3 text-left transition active:scale-[0.99]"
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full border-[3px] border-navy/60"
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[0.8125rem] font-bold text-foreground/60">
                Điểm xuất phát
              </span>
              <span className="block truncate text-[1rem] font-bold text-navy">
                {startOptions.find((o) => o.id === effectiveStartId)?.label ??
                  "Chọn nơi xuất phát"}
              </span>
            </span>
            <ChevronRightIcon
              className="h-5 w-5 shrink-0 text-foreground/40"
              aria-hidden
            />
          </button>
          {/* giữ chỗ cột nút — hàng này không có nút, nhưng mép phải phải thẳng */}
          <span className="w-16 shrink-0" aria-hidden />
          </div>
          )}

          {panel === "start" && (
            <div ref={panelRef} className="space-y-1.5 rounded-xl bg-background/60 p-2">
              <div role="radiogroup" aria-label="Nơi xuất phát" className="space-y-1.5">
                {startOptions.map((o) => {
                  const on = o.id === effectiveStartId;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => {
                        setStartId(o.id);
                        setPanel("idle");
                      }}
                      className={`flex min-h-[3.5rem] w-full items-center gap-2.5 rounded-xl px-3 text-left text-[1rem] font-bold transition ${
                        on
                          ? "bg-navy text-white"
                          : "bg-card text-foreground/75 active:bg-field"
                      }`}
                    >
                      <span
                        className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                          on ? "border-white bg-white" : "border-foreground/35"
                        }`}
                        aria-hidden
                      />
                      {o.label}
                    </button>
                  );
                })}
              </div>
              <select
                value={
                  effectiveStartId.startsWith("port:")
                    ? effectiveStartId.replace(/^port:/, "")
                    : ""
                }
                onChange={(e) => {
                  if (!e.target.value) return;
                  setStartId(`port:${e.target.value}`);
                  setPanel("idle");
                }}
                aria-label="Hoặc chọn cảng khác"
                className="block min-h-[3.5rem] w-full rounded-xl bg-card px-3 text-[1rem] font-semibold text-foreground/70"
              >
                <option value="">Cảng khác…</option>
                {PORTS.map((p) => (
                  <option key={p.id} value={p.id}>
                    Cảng {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* các điểm đã chọn */}
          {compactRows &&
            stops.map((s, i) => (
            <div key={s.id}>
            {legKm(i) != null && (
              <p className="flex items-center gap-1.5 px-3 py-0.5 text-[0.8125rem] font-semibold text-foreground/60">
                <span aria-hidden>↓</span>
                {fmtDist(legKm(i)!, prefs.distUnit)} thẳng
              </p>
            )}
            <div className="flex items-center gap-2">
            <div className="flex min-h-[3.5rem] min-w-0 flex-1 items-center gap-2.5 rounded-xl bg-background px-3 py-1.5">
              <span
                className="display flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.875rem] font-bold text-white"
                style={{ background: ROUTE_LINE_COLOR }}
                aria-hidden
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                {/*  NÓI RÕ VAI: chỗ CUỐI là ĐIỂM ĐẾN, các chỗ trước là điểm
                     dừng dọc đường. Chỉ đánh số 1-2-3 thì bà con không biết
                     đâu là nơi mình định tới. */}
                <span className="block text-[0.8125rem] font-bold text-foreground/60">
                  {i === stops.length - 1 ? "Điểm đến" : `Điểm dừng ${i + 1}`}
                </span>
                {/*  CÓ TÊN THÌ ĐỌC TÊN: bà con đặt tên "Rạn ông Tư" chính là
                     để khỏi phải dịch toạ độ trong đầu; toạ độ xuống dòng phụ.
                     Không tên thì giữ nguyên như cũ (toạ độ ở dòng chính). */}
                <span className="block leading-snug text-[1rem] font-semibold text-navy">
                  {s.name ?? fmtCoordPair(s.lat, s.lon, prefs.coordFormat)}
                </span>
                {s.name && (
                  <span className="block leading-snug text-[0.8125rem] text-foreground/60">
                    {fmtCoordPair(s.lat, s.lon, prefs.coordFormat)}
                  </span>
                )}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onStops?.(removeStop(stops, s.id))}
              aria-label={"Bỏ điểm " + (i + 1)}
              className={`${SQ_BTN} bg-background text-danger`}
            >
              <CloseIcon className="h-6 w-6" />
              Bỏ
            </button>
            </div>
            </div>
            ))}

          {/*  THÊM ĐIỂM — MỘT hàng mở CÙNG bộ chọn với "Đi từ" (chỗ đang xem ·
               điểm đã lưu · cảng). Trước đây là hai hàng rời ("Thêm điểm đang
               xem" + "Thêm từ điểm đã lưu") — cùng một việc mà hai chỗ bấm. */}
          {/*  NÚT KHÔNG BAO GIỜ ĂN RIÊNG MỘT HÀNG (chủ dự án 2026-08-29: *"nó là
               1 nút thì đừng để nó chiếm cả 1 hàng… 1 ô chiếm 1 hàng thì lại mất
               cân đối trong khi vẫn chiếm chỗ màn hình"*). "Tính đường" nằm
               INLINE ở cuối hàng "Chọn điểm đến" — đúng hàng nó thao tác lên,
               và hàng đó vốn đã tồn tại nên nút không tốn thêm chiều cao nào.
               Luật đầy đủ ở 03-design-system §Nút hành động trên bản đồ. */}
          {!stopsFull && compactRows && (
            <div ref={addStopRef} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPanel("dest")}
              aria-expanded={false}
              className="flex min-h-[3.5rem] min-w-0 flex-1 items-center gap-2.5 rounded-xl bg-background px-3 text-left text-[1rem] font-bold text-t1 transition active:scale-[0.99]"
            >
              <PlusIcon className="h-6 w-6 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate">
                  {stops.length === 0 ? "Chọn điểm đến" : "Thêm điểm dừng"}
                </span>
                {/*  DÒNG TOẠ ĐỘ SỐNG THEO CON TRỎ — chạm bản đồ trong chế độ
                     dẫn đường chỉ dời con trỏ, trước đây KHÔNG đổi một chữ nào
                     trong thẻ (phản hồi duy nhất là chip toạ độ 0,75rem tận
                     đỉnh màn — mắt 50 tuổi dưới nắng coi như không có). Đổi chữ
                     ngay chỗ ngón tay đang thao tác là cách rẻ nhất bỏ thao tác
                     câm mà KHÔNG đẻ ra lối thứ hai: chạm cả hàng vẫn mở bộ chọn
                     như cũ. */}
                <span className="block leading-snug text-[0.8125rem] font-bold text-foreground/60">
                  {fmtCoordPair(dest.lat, dest.lon, prefs.coordFormat)}
                </span>
                {/*  DÒNG RIÊNG, KHÔNG nối vào dòng toạ độ: dòng đó có
                     `truncate`, nối thêm là câu cảnh báo bị cắt mất đuôi trên
                     máy hẹp — mất đúng phần nói rõ nguy hiểm. */}
                {destDepthWarn && (
                  <span className="block text-[0.8125rem] font-bold leading-tight text-[var(--warn)]">
                    {destDepthWarn}
                  </span>
                )}
              </span>
              <ChevronRightIcon
                className="h-5 w-5 shrink-0 text-foreground/40"
                aria-hidden
              />
            </button>
            {/*  NÚT TÍNH ĐÃ DỜI XUỐNG THANH GHIM ĐÁY (2026-08-29). Bản trước
                 để nút ở đây: đo trên 375×812 ca MỘT ĐIỂM ĐẾN — ca phổ biến
                 nhất, cũng là chỗ lối tắt chạm-giữ đổ vào — nội dung 307px
                 trong cửa 252px, nút chính của cả màn chỉ lộ 29/56px, bị mép
                 thẻ cắt đôi. Hàng vẫn CHỪA Ô để mép phải thẳng một khuôn. */}
            <span className="w-16 shrink-0" aria-hidden />
            </div>
          )}

          {panel === "dest" && (
            <div ref={panelRef} className="space-y-1.5 rounded-xl bg-background/60 p-2">
              <button
                type="button"
                disabled={currentStop != null}
                onClick={() => {
                  onStops?.(addStop(stops, dest.lat, dest.lon));
                  setPanel("idle");
                }}
                className="flex min-h-[3.5rem] w-full items-center gap-2.5 rounded-xl bg-card px-3 text-left transition active:scale-[0.99] disabled:opacity-50"
              >
                <PinIcon className="h-6 w-6 shrink-0 text-t1" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.8125rem] font-bold text-foreground/60">
                    Chỗ đang xem trên bản đồ
                  </span>
                  <span className="block leading-snug text-[1rem] font-bold text-navy">
                    {fmtCoordPair(dest.lat, dest.lon, prefs.coordFormat)}
                  </span>
                  {/* dòng riêng — lý do y như hàng "Thêm điểm dừng" ở trên */}
                  {destDepthWarn && (
                    <span className="block text-[0.8125rem] font-bold leading-tight text-[var(--warn)]">
                      {destDepthWarn}
                    </span>
                  )}
                </span>
                {currentStop && (
                  <span className="shrink-0 text-[0.8125rem] font-bold text-foreground/60">
                    đã có
                  </span>
                )}
              </button>

              {sortedPlaces(places).map((pl) => {
                const da = stopAt(stops, pl.lat, pl.lon) != null;
                return (
                  <button
                    key={pl.id}
                    type="button"
                    disabled={da}
                    onClick={() => {
                      // giữ TÊN chỗ đã lưu — hàng trong danh sách đọc được
                      // "Rạn ông Tư" thay vì một dãy toạ độ
                      onStops?.(addStop(stops, pl.lat, pl.lon, pl.name));
                      setPanel("idle");
                    }}
                    className="flex min-h-[3.5rem] w-full items-center gap-2.5 rounded-xl bg-card px-3 text-left transition active:scale-[0.99] disabled:opacity-50"
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white ${
                        pl.kind === "home" ? "bg-t1" : "bg-sun"
                      }`}
                      aria-hidden
                    >
                      <StarIcon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[1rem] font-bold text-navy">
                      {pl.name}
                    </span>
                    {da && (
                      <span className="shrink-0 text-[0.8125rem] font-bold text-foreground/60">
                        đã có
                      </span>
                    )}
                  </button>
                );
              })}

              {/* GÕ TOẠ ĐỘ — nguồn thứ ba, cùng luật đọc với ô "Đến điểm" */}
              <div className="rounded-xl bg-card p-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={coordLat}
                    onChange={(e) => {
                      setCoordLat(e.target.value);
                      setCoordErr(false);
                    }}
                    placeholder={`Vĩ độ (vd ${egCoord.lat})`}
                    aria-label="Vĩ độ điểm muốn thêm"
                    className="min-h-[3.25rem] w-full rounded-xl bg-background px-3 text-[1rem] font-semibold text-navy"
                  />
                  <input
                    value={coordLon}
                    onChange={(e) => {
                      setCoordLon(e.target.value);
                      setCoordErr(false);
                    }}
                    placeholder={`Kinh độ (vd ${egCoord.lon})`}
                    aria-label="Kinh độ điểm muốn thêm"
                    className="min-h-[3.25rem] w-full rounded-xl bg-background px-3 text-[1rem] font-semibold text-navy"
                  />
                </div>
                {coordErr && (
                  <p className="mt-1 text-[0.8125rem] font-bold leading-snug text-danger">
                    Chưa đọc được toạ độ. Gõ như ví dụ: {egCoord.lat} /{" "}
                    {egCoord.lon}.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const pair = parseCoordPair(coordLat, coordLon);
                    if (!pair) {
                      setCoordErr(true);
                      return;
                    }
                    onStops?.(addStop(stops, pair.lat, pair.lon));
                    setCoordLat("");
                    setCoordLon("");
                    setPanel("idle");
                  }}
                  disabled={!coordLat && !coordLon}
                  className="mt-2 min-h-[3.25rem] w-full rounded-xl bg-background text-[1rem] font-bold text-t1 transition active:scale-[0.99] disabled:opacity-50"
                >
                  Thêm điểm này
                </button>
              </div>

              <select
                value=""
                onChange={(e) => {
                  const port = PORTS.find((x) => x.id === e.target.value);
                  if (!port) return;
                  onStops?.(addStop(stops, port.lat, port.lon, `Cảng ${port.name}`));
                  setPanel("idle");
                }}
                aria-label="Thêm một cảng làm điểm đến"
                className="block min-h-[3.5rem] w-full rounded-xl bg-card px-3 text-[1rem] font-semibold text-foreground/70"
              >
                <option value="">Chọn một cảng…</option>
                {PORTS.map((p) => (
                  <option key={p.id} value={p.id}>
                    Cảng {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/*  PANEL ĐƯỜNG ĐÃ LƯU — MỘT chỗ làm CẢ HAI việc: cất đường đang có
               và mở lại đường cũ. Tách hai panel là dựng lại đúng cái "xổ ra
               mấy phần khác nhau" vừa dẹp; mà hai việc này luôn đi cùng một
               dòng suy nghĩ ("đường này để dành" / "lấy lại đường tuần trước").

               CHỈ LƯU ĐIỂM, KHÔNG LƯU KẾT QUẢ (xem `lib/saved-routes.ts`): ba
               con số là dự báo CỦA HÔM ẤY, bày lại tuần sau là app tự nói dối
               và bà con tính dầu theo số cũ. Mở ra ⇒ khôi phục điểm, bấm Tính
               đường để máy tính lại bằng dự báo hôm nay. */}
          {panel === "saved" && (
            <div ref={panelRef} className="space-y-1.5">
              {savedRoutesSaveFailed && (
                <p className="rounded-xl bg-[var(--warn-bg)] px-3 py-2.5 text-[0.9375rem] font-semibold leading-snug text-[var(--warn)]">
                  Máy không giữ được đường đã lưu — tắt app là mất. Dọn bớt
                  ảnh/dữ liệu trong máy rồi thử lại.
                </p>
              )}

              {/*  HÀNG LƯU — CHỈ BÀY CÁI KEY (03-design-system): thứ duy nhất
                   máy chưa biết là CÁI TÊN, mà cái tên cũng đã điền sẵn theo
                   điểm đến. Nơi xuất phát và chuỗi điểm máy đang cầm sẵn, hỏi
                   lại là hỏi thứ mình vừa tự trả lời. */}
              {stops.length > 0 && (
                <div className="flex items-center gap-2">
                  <input
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder={suggestName(stops)}
                    aria-label="Tên đường đi muốn lưu"
                    className="min-h-[3.5rem] min-w-0 flex-1 rounded-xl bg-background px-3 text-[1rem] font-semibold text-navy"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      onSavedRoutes?.(
                        addSavedRoute(
                          savedRoutes,
                          {
                            name: saveName,
                            start: startCoord
                              ? {
                                  ...startCoord,
                                  label:
                                    startOptions.find(
                                      (o) => o.id === effectiveStartId,
                                    )?.label ?? "",
                                }
                              : null,
                            startId: effectiveStartId,
                            stops,
                          },
                          Date.now(),
                        ),
                      );
                      setSaveName("");
                    }}
                    className={`${SQ_BTN} bg-t1 text-white`}
                  >
                    <StarIcon className="h-6 w-6" />
                    Lưu
                  </button>
                </div>
              )}

              {savedRoutes.length === 0 ? (
                <p className="px-1 text-[0.9375rem] font-semibold text-foreground/65">
                  Chưa lưu đường nào.
                </p>
              ) : (
                savedRoutes.map((r) => (
                  <div key={r.id} className="flex items-center gap-2">
                    {/*  CẢ THÂN HÀNG LÀ NÚT MỞ — cùng khuôn hàng chọn của bộ
                         chọn điểm đến, không đẻ kiểu thao tác thứ hai. */}
                    <button
                      type="button"
                      onClick={() => {
                        onStops?.(r.stops);
                        if (r.startId) setStartId(r.startId);
                        setPanel("idle");
                        /*  KHÔNG tự bấm Tính: tuyến phải tính lại bằng dự báo
                            HÔM NAY, mà việc đó tốn ~10 giây và có thể cần sóng.
                            Bà con tự bấm khi sẵn sàng — app không được tự tiêu
                            pin/sóng của người ta. */
                      }}
                      className="flex min-h-[3.5rem] min-w-0 flex-1 items-center gap-2.5 rounded-xl bg-background px-3 text-left transition active:scale-[0.99]"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[1rem] font-bold text-navy">
                          {r.name}
                        </span>
                        <span className="block truncate text-[0.8125rem] font-semibold text-foreground/60">
                          {r.stops.length} chỗ
                          {r.start?.label ? ` · từ ${r.start.label}` : ""}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onSavedRoutes?.(removeSavedRoute(savedRoutes, r.id))
                      }
                      aria-label={`Bỏ đường đã lưu ${r.name}`}
                      className={`${SQ_BTN} bg-background text-danger`}
                    >
                      <CloseIcon className="h-6 w-6" />
                      Bỏ
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {panel === "boat" && (
            <div ref={panelRef} className="grid grid-cols-2 gap-3 rounded-xl bg-background/60 p-2">
              <label className="block">
                <span className="text-[0.875rem] font-bold text-foreground/75">
                  Tàu chạy (hải lý/giờ)
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={2}
                  max={30}
                  value={speedKn}
                  onChange={(e) => setSpeedKn(e.target.value)}
                  className="block min-h-[3.5rem] w-full rounded-xl bg-card px-3 text-[1.125rem] font-semibold"
                />
              </label>
              <label className="block">
                <span className="text-[0.875rem] font-bold text-foreground/75">
                  Máy ăn dầu (lít/giờ)
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={1}
                  max={300}
                  value={lph}
                  onChange={(e) => setLph(e.target.value)}
                  className="block min-h-[3.5rem] w-full rounded-xl bg-card px-3 text-[1.125rem] font-semibold"
                />
              </label>
            </div>
          )}

        </>
      )}

      {error && (
        <p className="text-[0.9375rem] font-semibold leading-snug text-danger">
          {error}
        </p>
      )}

      {plan && result && panel === "idle" && (
        <>
          {/*  BA CON SỐ LÀ THỨ ĐẦU TIÊN ĐỌC ĐƯỢC, KHÔNG CÒN GHIM ĐÁY
               (chủ dự án 2026-08-29h: *"tại sao lại cấu trúc freeze 2 cái trên
               dưới, nội dung ở giữa kéo khó đọc, cảm giác khó chịu"*).

               Trước: thẻ 252px kẹp GIỮA hai thanh đông cứng — ghim trên ~72px +
               ghim đáy ~76px ⇒ cửa đọc còn ~104px, tức chưa nổi ba dòng chữ.
               Chữ bị mép trên và mép dưới cắt ngang cùng lúc, cuộn kiểu gì cũng
               có một đầu đang cụt. Đó không phải chuyện căn lề, đó là sai cấu
               trúc: một hộp cao 252px không gánh nổi HAI thanh đứng yên.

               Nay còn ĐÚNG MỘT thanh đông cứng (hàng trên), cửa đọc ~180px.
               Ba con số thành phần tử ĐẦU của luồng cuộn nên ở `scrollTop=0`
               vẫn thấy ngay; đọc xong cuộn xuống xem cảnh báo, không phải giành
               chỗ với thanh nào nữa. Nút "Dẫn đường" KHÔNG cuộn theo — nó dời
               lên hàng trên (xem chú thích ô hành động ở header), nên cuộn sâu
               tới đâu vẫn bấm được. */}
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 rounded-xl bg-background px-3 py-2">
              <p className="display min-w-0 flex-1 text-[0.9375rem] font-bold leading-snug text-navy">
                {/*  Bản ĐỌC BẰNG TAI — đánh vần đủ vai của từng con số. Mắt
                     đọc bản ngắn bên dưới; không nhân đôi cho tai vì bản mắt
                     đã `aria-hidden`. KHÔNG cắt chữ ở bản này để cho gọn:
                     nó không chiếm một px nào trên màn. */}
                <span className="sr-only">
                  Cả đường đi {fmtDist(plan.distKm, prefs.distUnit)}, tức{" "}
                  {fmtDist(plan.distKm, prefs.distUnit === "km" ? "nm" : "km")}
                  . Chạy máy {formatHoursVN(plan.hours)}. Dầu ước tính khoảng{" "}
                  {Math.round(plan.fuelL)} lít.
                  {topDanger &&
                    ` ${topDanger.label}. Sóng tới ${formatNumberVN(plan.maxWaveM)} mét.`}
                </span>
                {/*  KHÔNG `truncate`/`line-clamp`: dòng này mang con số sóng —
                     thứ quyết định đi hay ở — nên thà xuống dòng còn hơn cắt
                     cụt. Hai dòng vẫn thấp hơn ô nút 3.25rem nên KHÔNG tốn
                     thêm một px chiều cao nào.
                     CÓ CẢNH BÁO thì BỎ quy đổi ≈ hải lý (2026-08-29): nhãn
                     mối nguy dài hơn mảnh "· sóng tới X m" cũ, mà dòng này
                     không được phép phình sang dòng thứ ba (ghim đáy cao lên
                     là cửa đọc của thân thẻ hụt đi bấy nhiêu). Quy đổi là
                     cùng một quãng đường nói bằng đơn vị khác — thứ đầu tiên
                     đáng nhường chỗ cho mối nguy; bản đọc-bằng-tai vẫn giữ
                     đủ cả hai. */}
                <span aria-hidden>
                  {fmtDist(plan.distKm, prefs.distUnit)}
                  {!topDanger && (
                    <>
                      {" ≈ "}
                      {fmtDist(
                        plan.distKm,
                        prefs.distUnit === "km" ? "nm" : "km",
                      )}
                    </>
                  )}{" "}
                  · {formatHoursVN(plan.hours)} · ~{Math.round(plan.fuelL)} lít
                  {topDanger && (
                    <span className={anyDanger ? "text-danger" : "text-warn"}>
                      {" "}
                      · {topDanger.label} · sóng {formatNumberVN(plan.maxWaveM)}{" "}
                      m
                    </span>
                  )}
                </span>
              </p>
            </div>
            {/*  LỐI LƯU ĐƯỜNG ĐẶT ĐÚNG LÚC CÓ CÁI ĐỂ LƯU (2026-08-29h) — inline
                 cuối hàng ba con số, không ăn riêng hàng nào. Chưa tính xong
                 thì không có nút này: lưu một đường chưa biết đi được hay không
                 là cất sẵn một cái bẫy. */}
            <button
              type="button"
              onClick={() => {
                setSaveName("");
                setPanel("saved");
              }}
              className={`${SQ_BTN} bg-background text-t1`}
            >
              <StarIcon className="h-6 w-6" />
              Lưu đường
            </button>
          </div>

          {/* ── GOM CẢNH BÁO THÀNH TỐI ĐA 3 KHỐI (2026-08-18, audit M7) ─────
              Trước đây tới ~10 thẻ nối đuôi trước nút dẫn đường; nay:
              (1) NGUY HIỂM trên tuyến — sóng dữ, sóng đuôi, cạn/bờ (chỉ khi có)
              (2) TUYẾN CHƯA ĐỐI CHIẾU — bão, lưới cũ, ngoài dự báo, độ sâu
              (3) so với chạy thẳng + một câu dặn dò.
              Không bỏ thông tin nào, chỉ gộp. Bão vẫn là gạch đầu dòng ĐẦU
              TIÊN của khối 2 và kéo cả khối lên màu đỏ. */}
          {/*  ĐÃ BỎ đoạn "{startLabel} → {toạ độ} — tuyến đã vẽ trên bản đồ. Ba
               con số dưới là cả đường đi…" (chủ dự án 2026-08-29: "các loại giải
               thích vớ vẩn ko phải là cái cấp data hay info thì bỏ hết đi").
               Nó KHÔNG cấp dữ liệu: nơi đi/nơi đến đã nằm ngay trong biểu mẫu
               phía trên, "tuyến đã vẽ trên bản đồ" thì nhìn bản đồ là thấy, còn
               "ba con số là cả đường đi" là giải thích cách đọc chứ không phải
               con số. Ba dòng chữ đổi lấy ba dòng chỗ trong một khung đã chật. */}

          {/*  (1) NGUY HIỂM TRÊN TUYẾN — chỉ khi có. ĐỨNG TRƯỚC lưới 3 con
               số (đổi chỗ 2026-08-28k): khối ghim đáy là con CUỐI của khung
               cuộn, nền đục, nên mọi thứ đứng trước nó chui xuống dưới nó khi
               chưa cuộn tới đáy. Bà con thấy 3 con số đẹp rồi bấm thẳng nút to
               nhất ngay dưới ngón tay ⇒ cảnh báo bãi cạn / đè bờ không bao giờ
               được đọc. Đưa lên đây tốn 0 px và, sau cú cuộn-về-đầu lúc tính
               xong, nó là thứ ĐẦU TIÊN trong khung nhìn. */}
          {dangerItems.length > 0 && (
            <div
              role="alert"
              className={`rounded-xl p-3 ${
                anyDanger ? "bg-danger-bg text-danger" : "bg-warn-bg text-warn"
              }`}
            >
              <p className="flex items-center gap-2 text-[1rem] font-bold leading-snug">
                <AlertIcon className="h-5 w-5 shrink-0" />
                Trên tuyến có chỗ nguy hiểm
              </p>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[0.9375rem] font-semibold leading-snug">
                {dangerItems.map((i) => (
                  <li key={i.text}>{i.text}</li>
                ))}
              </ul>
            </div>
          )}

          {/*  ĐÃ BỎ LƯỚI 3 Ô (2026-08-29). Nó in LẠI đúng ba con số mà
               dải ghim đáy đã in, mà tốn ~92px trong một thẻ chỉ có ~130px cửa
               đọc. Thứ DUY NHẤT nó mang thêm — quy đổi ≈km/hải lý — nay ghép
               vào chính con số đầu của dòng ghim, nên không mất dữ liệu nào.
               Lãi thật là CUỘN NGẮN ĐI (thẻ bị trần 31dvh nên cắt nội dung
               không làm cửa đọc to ra): hai khối cảnh báo cuối từ chỗ phải
               vuốt hai lần còn một lần. Nhãn vai của ba con số ("giờ chạy máy",
               "dầu ước tính") được bù bằng một dòng chỉ-đọc-màn-hình ở dải ghim
               — không bù thì còn lại một chuỗi số không rõ nghĩa là gì. */}

          {/* (2) TUYẾN CHƯA ĐỐI CHIẾU — bão đứng đầu, kéo cả khối lên đỏ */}
          {(() => {
            const items: string[] = [];
            if (stormWarn) items.push(stormWarn);
            if (offlineSavedAt !== undefined)
              items.push(
                `Đang mất sóng — tuyến tính từ lưới gió sóng ĐÃ LƯU trong máy${
                  offlineSavedAt != null ? ` (${savedAgoLabel(offlineSavedAt)})` : ""
                }; lưới này thô hơn và CHƯA tính dòng chảy.`,
              );
            if (plan.beyondForecastH > 0)
              items.push(
                `Chuyến chạy dài hơn dự báo đang có: chừng ${formatHoursVN(plan.beyondForecastH)} cuối máy phải tính bằng dự báo của giờ cuối cùng — đoạn đó CHƯA chắc đúng.`,
              );
            if (!plan.depthChecked)
              items.push(
                "Chưa kiểm tra được độ sâu — tuyến chưa né bãi cạn, bà con tự dò hải đồ.",
              );
            if (items.length === 0) return null;
            return (
              <div
                role={stormWarn ? "alert" : "status"}
                className={`rounded-xl p-3 ${
                  stormWarn ? "bg-danger-bg text-danger" : "bg-warn-bg text-warn"
                }`}
              >
                <p className="flex items-center gap-2 text-[1rem] font-bold leading-snug">
                  <AlertIcon className="h-5 w-5 shrink-0" />
                  Tuyến này chưa đối chiếu đủ
                </p>
                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[0.9375rem] font-semibold leading-snug">
                  {items.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            );
          })()}

          {/*  (3) SO VỚI CHẠY THẲNG — RÚT VỀ MỘT DÒNG CHỮ (2026-08-29, chủ dự
               án: "các loại giải thích vớ vẩn ko phải là cái cấp data hay info
               thì bỏ hết đi"). Trước là 5 nhánh, mỗi nhánh một KHỐI BO TRÒN CÓ
               NỀN 3 dòng — chiếm chỗ như một cảnh báo trong khi phần lớn chỉ là
               lời bình. Nay: nhánh nào KHÔNG cấp con số thì IM (bỏ hẳn nhánh
               "Hôm nay chạy thẳng là hợp lý nhất" — nó không nói thêm gì mà 3
               con số chưa nói); nhánh còn lại rút một câu, bỏ nền, để màu chữ
               gánh mức độ. */}
          <div className="space-y-1">
            {plan.cappedToDirect ? (
              <p className="text-[0.9375rem] font-semibold leading-snug text-warn">
                Không có đường vòng nào đáng tiền — tuyến vẽ là đường THẲNG, có
                đoạn sóng tới {formatNumberVN(plan.maxWaveM)} m.
              </p>
            ) : plan.direct === null ? (
              <p className="text-[0.9375rem] font-semibold leading-snug text-warn">
                Đường chim bay vướng đất liền / bãi cạn / sóng quá dữ — tuyến
                này đi vòng qua.
              </p>
            ) : plan.fuelDeltaL != null &&
              -plan.fuelDeltaL > Math.max(3, plan.direct.fuelL * 0.03) &&
              plan.distKm > plan.direct.distKm * 1.02 ? (
              <p className="text-[0.9375rem] font-semibold leading-snug text-ok">
                Đi vòng nhưng đỡ ~{Math.round(-plan.fuelDeltaL)} lít so với chạy
                thẳng.
              </p>
            ) : plan.distKm <= plan.direct.distKm * 1.05 ? null : (
              <p className="text-[0.9375rem] font-semibold leading-snug text-warn">
                Vòng né sóng ~{formatNumberVN(plan.direct.maxWaveM)} m — tốn
                thêm ~{Math.max(1, Math.round(plan.fuelDeltaL ?? 0))} lít.
              </p>
            )}
            {/*  Dòng cuối GIỮ LẠI hai thứ, không được cắt: con số đoạn xấu nhất
                 (data) và câu dặn hải đồ + đài duyên hải (01-product bắt buộc,
                 app không thay máy định vị của tàu). Phần diễn giải lưới độ sâu
                 rút còn một vế. */}
            {/*  MỘT KHUÔN NHƯ MỌI HÀNG (2026-08-29): [thân chữ cấp dữ liệu
                 flex-1] + [ô nút w-16]. Nút "Tính lại" trước đây là một dải
                 full-width ăn RIÊNG một hàng (đo thật 335×56 trong thẻ 359) —
                 trái đúng hai câu luật đã chốt ở 03 §Nút hành động trên bản đồ.
                 Dời vào cuối chính hàng nó thao tác lên thì cắt ~68px khỏi
                 chiều cao màn kết quả mà không mất chức năng nào.
                 Câu dặn hải đồ + đài duyên hải GIỮ NGUYÊN CHỮ, không rút cho
                 vừa hàng (01-product bắt buộc — app không thay máy định vị).
                 Đang SỬA danh sách thì dải ghim đáy đã là "Tính lại" rồi, hai nút
                 cùng việc là rối — hàng vẫn CHỪA Ô để mép phải thẳng một khuôn. */}
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 text-[0.875rem] leading-snug text-foreground/65">
                Đoạn xấu nhất: sóng ~{formatNumberVN(plan.maxWaveM)} m, gió cấp{" "}
                {beaufort(plan.maxWindKmh)}. Lưới độ sâu ô ~5,5 km — dò hải đồ,
                nghe đài duyên hải trước khi chạy.
              </p>
              {/*  HAI NÚT "TÍNH LẠI" CÙNG LÚC — LỖI ĐÃ TỪNG LỌT RA BẢN CHẠY
                   (chủ dự án 2026-08-29h: *"sao lại có 2 nút tính lại?"*).
                   Nguyên do: kéo nút tính lên hàng trên mà KHÔNG gỡ nút cũ ở
                   đây. Sau đó nó hết trùng nhờ hàng trên đổi sang "Dẫn đường"
                   khi có tuyến — tức hết trùng do MAY, không do thiết kế.
                   Nay điều kiện viết đúng là PHẦN BÙ của điều kiện hàng trên:
                   hàng trên hiện "Dẫn đường" khi `plan && result && !editing &&
                   onStart`, nên ô này chỉ hiện đúng lúc đó. Thiếu `onStart`
                   (thẻ dùng ở chỗ khác) thì hàng trên là "Tính lại" và ô này
                   biến mất — không thể trùng nữa dù ai đổi gì. */}
              {!editing && onStart ? (
                <button
                  type="button"
                  onClick={compute}
                  disabled={busy}
                  className={`${SQ_BTN} bg-background text-navy disabled:opacity-60`}
                >
                  <RouteIcon className="h-6 w-6" />
                  {busy ? "Đang tính" : "Tính lại"}
                </button>
              ) : (
                <span className="w-16 shrink-0" aria-hidden />
              )}
            </div>
          </div>

        </>
      )}
      </div>
    </>
  );
}
