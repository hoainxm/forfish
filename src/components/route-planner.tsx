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
import { ROUTE_CASING_COLOR, ROUTE_LINE_COLOR } from "@/lib/ocean-map";
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
import { mergeLegPlans } from "@/lib/route-multi";
import {
  MAX_STOPS,
  addStop,
  removeStop,
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
import { fetchDepthGrid } from "@/lib/depth-grid";
import { beaufort, formatNumberVN } from "@/lib/marine-weather";
import { useMapPrefs, fmtDist, fmtCoordPair } from "@/lib/map-prefs";
import {
  AlertIcon,
  AnchorIcon,
  ChevronRightIcon,
  ClockIcon,
  CloseIcon,
  FuelIcon,
  PlayIcon,
  PlusIcon,
  RouteIcon,
  StarIcon,
  TrashIcon,
} from "@/components/icons";

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
export function RouteMapLayers({ route }: { route: PlannedRoute | null }) {
  // useMemo giữ nguyên reference GeoJSON giữa các re-render của cha (bản đồ
  // re-render liên tục khi play animation) — không thì mỗi render là một lần
  // setData lên MapLibre dù tuyến không đổi
  const line = useMemo(
    () =>
      route
        ? {
            type: "Feature" as const,
            properties: {},
            geometry: {
              type: "LineString" as const,
              coordinates: route.plan.waypoints.map((w) => [w.lon, w.lat]),
            },
          }
        : null,
    [route],
  );
  if (!route || !line) return null;
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
 * TRONG <MapGL>. Ẩn khi đã có tuyến để không có hai đường chồng nhau.
 */
export function RouteStopsLayers({
  stops,
  hidden,
}: {
  stops: RouteStop[];
  hidden?: boolean;
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
  if (hidden || stops.length === 0) return null;
  return (
    <>
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
          {/*  VUNG CHAM >=3.5rem (56px): danh sach cho ghe trong the da bo, nen
               cham lai dau so tren ban do la CACH DUY NHAT bo mot cho. Vong tron
               VE van 2.5rem cho do roi mat; lop boc trong suot chi de lay tam
               tay (san tap target, 03-design-system). */}
          <span className="flex h-14 w-14 items-center justify-center">
            <span
              className="display flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-[1rem] font-bold shadow-md"
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
 * Đóng) — bản đồ ở giữa vẫn thấy — THẺ DƯỚI là chỗ nhập và đọc kết quả. Trong
 * chế độ này CHẠM BẢN ĐỒ = THÊM CHỖ GHÉ luôn (một chạm một chỗ), không phải
 * bấm nút "Thêm chỗ này" nữa; cha (fishing-map-view) lo phần đó.
 */
export function RouteMode({
  dest,
  activeRoute,
  places = [],
  stops = [],
  onStops,
  stopsSaveFailed = false,
  storms = [],
  stormInfo,
  onRoute,
  onStart,
  onClose,
}: {
  dest: LatLon;
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
  const [panel, setPanel] = useState<"idle" | "start" | "boat" | "places">(
    "idle",
  );
  const boxRef = useRef<HTMLDivElement>(null);
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
  }, [chainSig]);

  // tuyến trên bản đồ đang trỏ tới điểm KHÁC chỗ đang xem?
  const staleRoute =
    activeRoute != null &&
    (Math.abs(activeRoute.dest.lat - finalDest.lat) > 1e-6 ||
      Math.abs(activeRoute.dest.lon - finalDest.lon) > 1e-6)
      ? activeRoute
      : null;

  const nearestPort = PORTS.reduce((a, b) =>
    haversineKm(b, finalDest) < haversineKm(a, finalDest) ? b : a,
  );


  /*
    Lựa chọn nơi xuất phát — app đã dạy tư duy "Điểm của tôi" thì dẫn đường
    phải nói cùng ngôn ngữ: Cảng nhà / chỗ ghim lên đầu, rồi GPS, rồi cảng
    gần đích nhất. Mặc định = Cảng nhà (nếu đặt rồi) — KHÔNG đoán theo đích.
  */
  const myPlaces = sortedPlaces(places).slice(0, 4); // cảng nhà đứng đầu
  const startOptions: { id: string; label: string; coord: LatLon | null }[] = [
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
        stopWpIdx,
      };
      setResult(r);
      onRoute(r);
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

  // tuyến cũ còn trên bản đồ — nói rõ + cho xóa một chạm, không tự ý vứt
  const staleBar = staleRoute ? (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-[var(--warn-bg)] px-3 py-2">
      <p className="min-w-0 text-[0.9375rem] font-semibold leading-snug text-[var(--warn)]">
        Tuyến trên bản đồ đang dẫn tới chỗ chạm trước — tính lại bên dưới để
        dẫn tới chỗ mới.
      </p>
      <button
        type="button"
        onClick={() => onRoute(null)}
        className="min-h-[3.25rem] shrink-0 rounded-full bg-white px-4 text-[0.9375rem] font-bold text-[var(--warn)]"
      >
        Xóa tuyến
      </button>
    </div>
  ) : null;

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
  /*  Có gì để dọn không: tuyến ĐÃ TÍNH **hoặc** chỗ ghé đã chấm. Bản đầu chỉ
      xét tuyến ⇒ chấm 3 chỗ rồi mà chưa bấm tính thì không có nút nào dọn, phải
      chạm lại từng chỗ để bỏ (đo thật 2026-08-28, bắt được). */
  const currentStop = stopAt(stops, dest.lat, dest.lon);
  const stopsFull = stops.length >= MAX_STOPS;
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
      <div
        ref={boxRef}
        className="pointer-events-auto max-h-[38dvh] space-y-2 overflow-y-auto surface p-3"
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng dẫn đường"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy/10 text-navy transition active:scale-95"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[1rem] font-bold leading-tight text-navy">
              {stops.length > 1
                ? `Đường đi qua ${stops.length} chỗ`
                : stops.length === 1
                  ? "Đường đi tới chỗ đã đánh dấu"
                  : "Dẫn đường tới chỗ đang xem"}
            </p>
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
          {coGiDeXoa && (
            <button
              type="button"
              onClick={clearAll}
              className="flex min-h-[2.75rem] shrink-0 items-center gap-1 rounded-xl bg-background px-2.5 text-[0.875rem] font-bold text-danger transition active:scale-95"
            >
              <TrashIcon className="h-5 w-5" />
              Xoá
            </button>
          )}
        </div>
      {staleBar}
      {stopsSaveBar}

      {!plan && (
        <>
          {/*  DANH SÁCH ĐIỂM KIỂU GOOGLE MAPS (user 2026-08-28g, kèm ảnh mẫu):
               hàng "Đi từ" xổ ra chọn cảng/vị trí · các điểm đã chọn xếp dưới,
               mỗi hàng một nút bỏ · dưới cùng là "Thêm điểm" (đúng vai "Add
               destination") · tốc độ + dầu nằm trong "Tuỳ chọn" ẩn/hiện.
               Bỏ chip nổi 3 giây của bản trước: có hàng "Thêm điểm" đứng sẵn
               trong danh sách thì chip là đường thứ hai làm cùng một việc — mà
               hai đường cho một việc chính là chỗ bà con thấy rối. */}
          <button
            type="button"
            onClick={() => setPanel(panel === "start" ? "idle" : "start")}
            aria-expanded={panel === "start"}
            className="flex min-h-[3.25rem] w-full items-center gap-2.5 rounded-xl bg-background px-3 text-left transition active:scale-[0.99]"
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full border-[3px] border-navy/60"
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[0.8125rem] font-bold text-foreground/60">
                Đi từ
              </span>
              <span className="block truncate text-[1rem] font-bold text-navy">
                {startOptions.find((o) => o.id === effectiveStartId)?.label ??
                  "Chọn nơi xuất phát"}
              </span>
            </span>
            <ChevronRightIcon
              className={`h-5 w-5 shrink-0 text-foreground/40 transition-transform ${
                panel === "start" ? "rotate-90" : ""
              }`}
              aria-hidden
            />
          </button>

          {panel === "start" && (
            <div className="space-y-1.5 rounded-xl bg-background/60 p-2">
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
                      className={`flex min-h-[3.25rem] w-full items-center gap-2.5 rounded-xl px-3 text-left text-[1rem] font-bold transition ${
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
                className="block min-h-[3.25rem] w-full rounded-xl bg-card px-3 text-[1rem] font-semibold text-foreground/70"
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
          {stops.map((s, i) => (
            <div
              key={s.id}
              className="flex items-center gap-2.5 rounded-xl bg-background px-3 py-1.5"
            >
              <span
                className="display flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.875rem] font-bold text-white"
                style={{ background: ROUTE_LINE_COLOR }}
                aria-hidden
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-[1rem] font-semibold text-navy">
                {fmtCoordPair(s.lat, s.lon, prefs.coordFormat)}
              </span>
              <button
                type="button"
                onClick={() => onStops?.(removeStop(stops, s.id))}
                aria-label={"Bỏ điểm " + (i + 1)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-danger transition active:scale-95"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
          ))}

          {/*  THÊM ĐIỂM — đúng vai "Add destination" của Google Maps. HAI ĐƯỜNG
               (user 2026-08-28h): điểm MỚI đang xem trên bản đồ, hoặc lấy từ
               ĐIỂM ĐÃ LƯU (rạn quen, chỗ trúng cá — thứ chủ tàu đo bằng cả
               chuyến biển, bắt gõ lại toạ độ là vô lý). */}
          {!currentStop && !stopsFull && (
            <button
              type="button"
              onClick={() => onStops?.(addStop(stops, dest.lat, dest.lon))}
              className="flex min-h-[3.25rem] w-full items-center gap-2.5 rounded-xl px-3 text-left text-[1rem] font-bold text-t1 transition active:scale-[0.99]"
            >
              <PlusIcon className="h-6 w-6 shrink-0" />
              <span className="min-w-0 flex-1 truncate">
                Thêm điểm đang xem ({fmtCoordPair(dest.lat, dest.lon, prefs.coordFormat)})
              </span>
            </button>
          )}

          {!stopsFull && places.length > 0 && (
            <button
              type="button"
              onClick={() => setPanel(panel === "places" ? "idle" : "places")}
              aria-expanded={panel === "places"}
              className="flex min-h-[3.25rem] w-full items-center gap-2.5 rounded-xl px-3 text-left text-[1rem] font-bold text-t1 transition active:scale-[0.99]"
            >
              <StarIcon className="h-6 w-6 shrink-0" />
              <span className="min-w-0 flex-1 truncate">
                Thêm từ điểm đã lưu ({places.length})
              </span>
              <ChevronRightIcon
                className={`h-5 w-5 shrink-0 text-foreground/40 transition-transform ${
                  panel === "places" ? "rotate-90" : ""
                }`}
                aria-hidden
              />
            </button>
          )}

          {panel === "places" && (
            <div className="space-y-1.5 rounded-xl bg-background/60 p-2">
              {sortedPlaces(places).map((pl) => {
                const da = stopAt(stops, pl.lat, pl.lon) != null;
                return (
                  <button
                    key={pl.id}
                    type="button"
                    disabled={da}
                    onClick={() => {
                      onStops?.(addStop(stops, pl.lat, pl.lon));
                      setPanel("idle");
                    }}
                    className="flex min-h-[3.25rem] w-full items-center gap-2.5 rounded-xl bg-card px-3 text-left transition active:scale-[0.99] disabled:opacity-50"
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
            </div>
          )}

          {/* TUỲ CHỌN ẩn/hiện — tốc độ + dầu, chủ tàu nhập một lần dùng cả đời */}
          <button
            type="button"
            onClick={() => setPanel(panel === "boat" ? "idle" : "boat")}
            aria-expanded={panel === "boat"}
            className="flex min-h-[3rem] w-full items-center gap-2 rounded-xl px-3 text-left text-[0.9375rem] font-bold text-foreground/70 transition active:scale-[0.99]"
          >
            <FuelIcon className="h-5 w-5 shrink-0 text-t1" aria-hidden />
            <span className="min-w-0 flex-1 truncate">
              Tuỳ chọn — tàu {speedKn} hl/giờ · {lph} lít/giờ
            </span>
            <ChevronRightIcon
              className={`h-5 w-5 shrink-0 text-foreground/40 transition-transform ${
                panel === "boat" ? "rotate-90" : ""
              }`}
              aria-hidden
            />
          </button>

          {panel === "boat" && (
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-background/60 p-2">
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
                  className="mt-1 block min-h-[3.25rem] w-full rounded-xl bg-card px-3 text-[1.125rem] font-semibold"
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
                  className="mt-1 block min-h-[3.25rem] w-full rounded-xl bg-card px-3 text-[1.125rem] font-semibold"
                />
              </label>
            </div>
          )}

          {(
          <button
            type="button"
            onClick={compute}
            disabled={busy}
            className="flex min-h-[3.5rem] w-full items-center justify-center gap-2.5 rounded-xl bg-t1 text-[1.125rem] font-bold text-white transition active:scale-[0.99] disabled:opacity-60"
          >
            {busy ? "Đang tính đường…" : "Tính đường đỡ tốn dầu"}
            </button>
          )}
        </>
      )}

      {error && (
        <p className="text-[0.9375rem] font-semibold leading-snug text-danger">
          {error}
        </p>
      )}

      {plan && result && (
        <>
          {/* ── GOM CẢNH BÁO THÀNH TỐI ĐA 3 KHỐI (2026-08-18, audit M7) ─────
              Trước đây tới ~10 thẻ nối đuôi trước nút dẫn đường; nay:
              (1) NGUY HIỂM trên tuyến — sóng dữ, sóng đuôi, cạn/bờ (chỉ khi có)
              (2) TUYẾN CHƯA ĐỐI CHIẾU — bão, lưới cũ, ngoài dự báo, độ sâu
              (3) so với chạy thẳng + một câu dặn dò.
              Không bỏ thông tin nào, chỉ gộp. Bão vẫn là gạch đầu dòng ĐẦU
              TIÊN của khối 2 và kéo cả khối lên màu đỏ. */}
          <p className="text-[0.9375rem] font-semibold text-foreground/70">
            {result.startLabel}
            {result.stops.length > 1
              ? ` → qua ${result.stops.length} chỗ → `
              : " → "}
            {fmtCoordPair(
              result.dest.lat,
              result.dest.lon,
              prefs.coordFormat,
            )}{" "}
            — tuyến đã vẽ trên bản đồ.
            {result.stops.length > 1 && (
              <>
                {" "}
                Ba con số dưới là <b>cả đường đi</b>, đã cộng hết các chặng.
              </>
            )}
          </p>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-background p-3">
              <RouteIcon className="mx-auto h-5 w-5 text-t1" />
              <p className="display mt-1 text-[1.25rem] font-bold leading-none text-navy">
                {fmtDist(plan.distKm, prefs.distUnit)}
              </p>
              <p className="mt-1 text-[0.8125rem] font-semibold text-foreground/70">
                ≈ {fmtDist(plan.distKm, prefs.distUnit === "km" ? "nm" : "km")}
              </p>
            </div>
            <div className="rounded-xl bg-background p-3">
              <ClockIcon className="mx-auto h-5 w-5 text-t1" />
              <p className="display mt-1 text-[1.25rem] font-bold leading-none text-navy">
                {formatHoursVN(plan.hours)}
              </p>
              <p className="mt-1 text-[0.8125rem] font-semibold text-foreground/70">
                giờ chạy máy
              </p>
            </div>
            <div className="rounded-xl bg-background p-3">
              <FuelIcon className="mx-auto h-5 w-5 text-t1" />
              <p className="display mt-1 text-[1.25rem] font-bold leading-none text-navy">
                ~{Math.round(plan.fuelL)} lít
              </p>
              <p className="mt-1 text-[0.8125rem] font-semibold text-foreground/70">
                dầu ước tính
              </p>
            </div>
          </div>

          {/* (1) NGUY HIỂM TRÊN TUYẾN — chỉ khi có */}
          {(() => {
            const items: { text: string; danger: boolean }[] = [];
            if (plan.hasRoughLeg)
              items.push({
                danger: true,
                text: `Có đoạn sóng tới ${formatNumberVN(plan.maxWaveM)} m, gió cấp ${beaufort(plan.maxWindKmh)} — mức KHÔNG NÊN ĐI với tàu nhỏ. Cân nhắc hoãn chuyến, nghe đài trước khi quyết.`,
              });
            if (plan.hasFollowingSeaRisk && !plan.hasRoughLeg)
              items.push({
                danger: false,
                text: "Có đoạn sóng dồn từ phía đuôi (≥2 m, sóng ngắn) — dễ trượt sóng: tới đoạn đó giảm ga, đừng để sóng vỗ thẳng đuôi tàu.",
              });
            if (plan.hasVeryShallowLeg)
              items.push({
                danger: true,
                text: "Có đoạn đè lên vùng RẤT CẠN / bãi nổi (dưới 4 m) gần nơi xuất phát hoặc điểm đến — chỉ vào theo con nước lên, đi chậm, hỏi người rành luồng lạch chỗ đó.",
              });
            if (plan.hasNearLandLeg)
              items.push({
                danger: true,
                text: "Đoạn đầu (hoặc cuối) tuyến đè lên phần BỜ theo bản đồ độ sâu của máy — chỗ vào cảng máy không vẽ chính xác được; đoạn đó đi theo luồng quen và hải đồ, đừng bám vạch trên màn hình.",
              });
            if (plan.hasShallowLeg)
              items.push({
                danger: false,
                text: "Tuyến có đoạn nước nông (cỡ 4–12 m) — để ý con nước, hải đồ đoạn đó.",
              });
            if (items.length === 0) return null;
            const anyDanger = items.some((i) => i.danger);
            return (
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
                  {items.map((i) => (
                    <li key={i.text}>{i.text}</li>
                  ))}
                </ul>
              </div>
            );
          })()}

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

          {/* (3) So với chạy thẳng — không có nhánh nào được phép nói "chạy
              thẳng" khi tuyến vẽ là đường vòng — + MỘT câu dặn dò */}
          <div className="space-y-1.5">
            {plan.cappedToDirect ? (
              <p className="rounded-xl bg-warn-bg p-3 text-[0.9375rem] font-semibold leading-snug text-warn">
                Không có đường vòng nào đáng tiền để né sóng — tuyến vẽ là ĐƯỜNG
                THẲNG, trên đường có đoạn sóng tới{" "}
                {formatNumberVN(plan.maxWaveM)} m. Cân nhắc hoãn hoặc đợi biển
                êm hơn.
              </p>
            ) : plan.direct === null ? (
              <p className="rounded-xl bg-warn-bg p-3 text-[0.9375rem] font-semibold leading-snug text-warn">
                Đường chim bay đang vướng đất liền, bãi cạn hoặc sóng quá dữ —
                tuyến này đi vòng qua chỗ đó.
              </p>
            ) : plan.fuelDeltaL != null &&
              -plan.fuelDeltaL > Math.max(3, plan.direct.fuelL * 0.03) &&
              plan.distKm > plan.direct.distKm * 1.02 ? (
              <p className="rounded-xl bg-ok-bg p-3 text-[0.9375rem] font-semibold leading-snug text-ok">
                Đi hơi vòng nhưng êm hơn — đỡ chừng{" "}
                {Math.round(-plan.fuelDeltaL)} lít dầu so với chạy thẳng.
              </p>
            ) : plan.distKm <= plan.direct.distKm * 1.05 ? (
              <p className="rounded-xl bg-ok-bg p-3 text-[0.9375rem] font-semibold leading-snug text-ok">
                Hôm nay chạy thẳng là hợp lý nhất — tuyến vẽ theo đường đó.
              </p>
            ) : (
              <p className="rounded-xl bg-warn-bg p-3 text-[0.9375rem] font-semibold leading-snug text-warn">
                Tuyến vòng nhẹ để né đoạn sóng ~
                {formatNumberVN(plan.direct.maxWaveM)} m trên đường thẳng — tốn
                thêm chừng {Math.max(1, Math.round(plan.fuelDeltaL ?? 0))} lít.
                Êm hơn nhưng không rẻ hơn, bà con tự cân nhắc.
              </p>
            )}
            <p className="text-[0.875rem] leading-snug text-foreground/65">
              Đoạn xấu nhất: sóng ~{formatNumberVN(plan.maxWaveM)} m, gió cấp{" "}
              {beaufort(plan.maxWindKmh)}. Tuyến tính từ dự báo từng giờ và bản đồ
              độ sâu ô ~5,5 km (rạn nhỏ, đá ngầm lẻ, luồng lạch máy KHÔNG thấy) —
              chỉ tham khảo; dò hải đồ, nghe đài duyên hải trước khi chạy.
            </p>
          </div>

          {/* DẪN ĐƯỜNG LIVE: bám tuyến, theo dõi GPS. Chỉ hiện khi cha nối
              onStart (màn bản đồ) và tuyến đã tính xong (result). */}
          {onStart && result && (
            <button
              type="button"
              onClick={() => onStart(result)}
              className="flex min-h-[3.5rem] w-full items-center justify-center gap-2.5 rounded-xl bg-t1 text-[1.125rem] font-bold text-white transition active:scale-[0.99]"
            >
              <PlayIcon className="h-6 w-6" />
              Bắt đầu dẫn đường
            </button>
          )}

          {/*  "Xoá tuyến" đã nằm THƯỜNG TRỰC ở thanh trên — ở đây chỉ còn
               "Tính lại" (đổi thông số tàu / thêm bớt chỗ rồi tính lại). */}
          <button
            type="button"
            onClick={compute}
            disabled={busy}
            className="min-h-[3.5rem] w-full rounded-xl bg-background text-[1rem] font-bold text-navy transition active:scale-[0.99] disabled:opacity-60"
          >
            {busy ? "Đang tính lại…" : "Tính lại đường"}
          </button>
        </>
      )}
      </div>
    </>
  );
}
