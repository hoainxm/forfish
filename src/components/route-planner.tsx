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
import { useMapPrefs, fmtDist, fmtCoordPair } from "@/lib/map-prefs";
import {
  AlertIcon,
  AnchorIcon,
  ChevronRightIcon,
  ClockIcon,
  CloseIcon,
  FuelIcon,
  PinIcon,
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
 * TRONG <MapGL>.
 *
 * `hidden` CHỈ nên bật khi tuyến đã tính còn khớp CẢ CHUỖI điểm
 * (`routeMatchesStops`) — lúc đó hai đường trùng nhau, vẽ chồng chỉ gây rối.
 * Tuyến lệch thì phải vẽ CẢ HAI để bà con thấy tận mắt chỗ lệch.
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
  const [panel, setPanel] = useState<"idle" | "start" | "boat" | "dest">(
    "idle",
  );
  /*  Không có bộ chọn nào đang xổ ⇒ hiện ĐỦ các hàng của biểu mẫu. Đang xổ một
      bộ chọn thì chỉ giữ hàng vừa bấm — đây là cách DUY NHẤT trong lượt này
      thật sự giảm chiều cao thẻ, và cũng là thi hành đúng luật "một lúc chỉ xổ
      một thứ" mà chú thích trên đã tuyên bố. */
  const compactRows = panel === "idle" || panel === "boat";
  const boxRef = useRef<HTMLDivElement>(null);
  /*  BA MỎ NEO CHO BA CÚ CUỘN TỰ ĐỘNG (xem ba useEffect dưới). Nội dung thẻ
      luôn tràn trần 38dvh, mà trình duyệt neo vị trí cuộn cũ khi nội dung nở
      ra ⇒ bấm xong màn hình "không đổi gì" dưới mắt bà con — người ít rành
      công nghệ sẽ bấm loạn. */
  const formRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
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

  // tuyến cũ còn trên bản đồ — nói rõ + cho xóa một chạm, không tự ý vứt
  const staleBar = staleRoute ? (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-[var(--warn-bg)] px-3 py-2">
      <p className="min-w-0 text-[0.9375rem] font-semibold leading-snug text-[var(--warn)]">
        {!chainStale && startStale
          ? /*  Danh sách điểm y nguyên, chỉ nơi xuất phát đổi: nhìn điểm đến
                thấy đúng hết nên phải chỉ thẳng vào cái đã lệch. */
            "Vạch xanh trên bản đồ vẫn đi từ nơi xuất phát CŨ — tính lại trước khi chạy."
          : staleDestMoved
            ? "Tuyến trên bản đồ đang dẫn tới chỗ chạm trước — tính lại bên dưới để dẫn tới chỗ mới."
            : /*  Điểm cuối vẫn thế mà chuỗi đã lệch (thêm/bỏ điểm GIỮA): phải nói
                  thẳng vạch xanh là đường CŨ, vì nhìn điểm đến thì thấy y như cũ. */
              "Vạch xanh trên bản đồ là đường đi CŨ — không còn khớp danh sách điểm bên dưới. Tính lại trước khi chạy."}
      </p>
      {/*  NÓI RÕ NÓ XOÁ GÌ: nút này CHỈ bỏ vạch cũ trên bản đồ, danh sách điểm
           GIỮ NGUYÊN — khác hẳn "Xoá hết" ở header (dọn cả danh sách). Hai nhãn
           gần giống nhau thì bấm nhầm là mất trắng công dựng tuyến. */}
      <button
        type="button"
        onClick={() => onRoute(null)}
        className="min-h-[3.5rem] shrink-0 rounded-full bg-white px-4 text-[0.9375rem] font-bold text-[var(--warn)]"
      >
        Xoá vạch cũ
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

  /*  Ý CẢNH BÁO NGUY HIỂM — dựng MỘT LẦN, MỘT CHỖ, vì có HAI nơi đọc: khối đỏ
      đầy đủ trong thân thẻ và dải một dòng trong thanh ghim đáy. Hai chỗ tự
      dựng lấy chữ là hai luật cảnh báo an toàn sớm muộn cũng lệch nhau.
      Thứ tự các ý GIỮ NGUYÊN như bản cũ (07 §12(4)). */
  const dangerItems = useMemo<{ text: string; danger: boolean }[]>(() => {
    if (!plan) return [];
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
    return items;
  }, [plan]);
  const anyDanger = dangerItems.some((i) => i.danger);

  /*  Có gì để dọn không: tuyến ĐÃ TÍNH **hoặc** chỗ ghé đã chấm. Bản đầu chỉ
      xét tuyến ⇒ chấm 3 chỗ rồi mà chưa bấm tính thì không có nút nào dọn, phải
      chạm lại từng chỗ để bỏ (đo thật 2026-08-28, bắt được). */
  const currentStop = stopAt(stops, dest.lat, dest.lon);
  const stopsFull = stops.length >= MAX_STOPS;
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
        className="pointer-events-auto max-h-[31dvh] scroll-pb-[5rem] scroll-pt-[9rem] space-y-2 overflow-y-auto surface p-3"
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
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng dẫn đường"
            className="-my-1.5 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-navy/10 text-navy transition active:scale-95"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            {/*  Có kết quả rồi thì TIÊU ĐỀ LÀ NÚT mở lại danh sách điểm — có
                 chevron để không thành nút bí ẩn. Chưa tính thì biểu mẫu đang
                 mở sẵn, tiêu đề chỉ là chữ. */}
            {plan ? (
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                aria-expanded={editing}
                className="flex min-h-[3.5rem] w-full items-center gap-1.5 text-left"
              >
                <span className="min-w-0 flex-1 truncate text-[1rem] font-bold leading-tight text-navy">
                  {stops.length > 1
                    ? `Đường đi qua ${stops.length} chỗ`
                    : stops.length === 1
                      ? "Đường đi tới chỗ đã đánh dấu"
                      : "Dẫn đường tới chỗ đang xem"}
                </span>
                <ChevronRightIcon
                  className={`h-5 w-5 shrink-0 text-foreground/40 transition-transform ${
                    editing ? "rotate-90" : ""
                  }`}
                  aria-hidden
                />
              </button>
            ) : (
              <p className="truncate text-[1rem] font-bold leading-tight text-navy">
                {stops.length > 1
                  ? `Đường đi qua ${stops.length} chỗ`
                  : stops.length === 1
                    ? "Đường đi tới chỗ đã đánh dấu"
                    : "Dẫn đường tới chỗ đang xem"}
              </p>
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
            className={`-my-1.5 flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition active:scale-95 ${
              panel === "boat" ? "bg-t1 text-white" : "bg-navy/10 text-t1"
            }`}
          >
            <FuelIcon className="h-5 w-5" />
          </button>
          {coGiDeXoa && (
            /*  `min-w` + `justify-center`: hộp chạm KHÔNG ĐƯỢC dịch giữa hai
                nhịp của cùng một thao tác — bản trước nút phình và nở về bên
                trái, cú bấm thứ hai rơi ra ngoài. Nhãn xác nhận NÓI RÕ sắp mất
                gì: "Xoá thật?" không nói ra là mất công 10-11 chạm không hoàn
                tác. `data-clear-btn` để nhịp chờ không tự huỷ khi chạm vào
                chính nó (xem onPointerDownCapture của thẻ). */
            <button
              type="button"
              data-clear-btn
              onClick={() => {
                if (confirmClear) {
                  clearAll();
                  setConfirmClear(false);
                } else setConfirmClear(true);
              }}
              className={`-my-1.5 flex min-h-[3.5rem] min-w-[8rem] shrink-0 items-center justify-center gap-1 rounded-xl px-2.5 text-center text-[0.875rem] font-bold leading-tight text-danger transition active:scale-95 ${
                confirmClear ? "bg-danger-bg" : "bg-background"
              }`}
            >
              <TrashIcon className="h-5 w-5 shrink-0" />
              {confirmClear
                ? stops.length > 0
                  ? `Xoá cả ${stops.length} chỗ + tuyến?`
                  : "Xoá tuyến?"
                : "Xoá hết"}
            </button>
          )}
          </div>
          {staleBar}
        </div>
      {stopsSaveBar}

      {(!plan || editing) && (
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
          {(compactRows || panel === "start") && (
          <button
            ref={formRef}
            type="button"
            onClick={() => setPanel(panel === "start" ? "idle" : "start")}
            aria-expanded={panel === "start"}
            className="flex min-h-[3.5rem] w-full items-center gap-2.5 rounded-xl bg-background px-3 text-left transition active:scale-[0.99]"
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
              className={`h-5 w-5 shrink-0 text-foreground/40 transition-transform ${
                panel === "start" ? "rotate-90" : ""
              }`}
              aria-hidden
            />
          </button>
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
                <span className="block truncate text-[1rem] font-semibold text-navy">
                  {s.name ?? fmtCoordPair(s.lat, s.lon, prefs.coordFormat)}
                </span>
                {s.name && (
                  <span className="block truncate text-[0.8125rem] text-foreground/60">
                    {fmtCoordPair(s.lat, s.lon, prefs.coordFormat)}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => onStops?.(removeStop(stops, s.id))}
                aria-label={"Bỏ điểm " + (i + 1)}
                className="-my-1.5 flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-danger transition active:scale-95"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            ))}

          {/*  THÊM ĐIỂM — MỘT hàng mở CÙNG bộ chọn với "Đi từ" (chỗ đang xem ·
               điểm đã lưu · cảng). Trước đây là hai hàng rời ("Thêm điểm đang
               xem" + "Thêm từ điểm đã lưu") — cùng một việc mà hai chỗ bấm. */}
          {!stopsFull && (compactRows || panel === "dest") && (
            <button
              type="button"
              onClick={() => setPanel(panel === "dest" ? "idle" : "dest")}
              aria-expanded={panel === "dest"}
              className="flex min-h-[3.5rem] w-full items-center gap-2.5 rounded-xl px-3 text-left text-[1rem] font-bold text-t1 transition active:scale-[0.99]"
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
                <span className="block truncate text-[0.8125rem] font-bold text-foreground/60">
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
                className={`h-5 w-5 shrink-0 text-foreground/40 transition-transform ${
                  panel === "dest" ? "rotate-90" : ""
                }`}
                aria-hidden
              />
            </button>
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
                  <span className="block truncate text-[1rem] font-bold text-navy">
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

          {/*  NÚT GHIM ĐÁY THEO ĐÚNG VIỆC ĐANG LÀM. Khối này chỉ tồn tại khi
               biểu mẫu đang mở (`!plan || editing`) nên nút ghim của màn ĐANG
               SỬA luôn là Tính/Tính lại. Bản trước điều kiện là `{!plan && …}`:
               mở lại danh sách khi ĐÃ có tuyến thì nút ghim đáy lại là "Bắt đầu
               dẫn đường" — một chạm là chạy dẫn đường LIVE theo tuyến TRƯỚC khi
               sửa. Vừa là bẫy an toàn vừa sai kỳ vọng (nguyên tắc 4).
               Nền `bg-card` + margin âm phủ kín phần p-3 dưới. */}
          <div className="sticky bottom-0 z-10 -mx-3 -mb-3 bg-card px-3 pb-3 pt-2">
            <button
              type="button"
              onClick={compute}
              disabled={busy}
              className="flex min-h-[3.5rem] w-full items-center justify-center gap-2.5 rounded-xl bg-t1 text-[1.125rem] font-bold text-white transition active:scale-[0.99] disabled:opacity-60"
            >
              {busy
                ? "Đang tính…"
                : plan
                  ? "Tính lại đường"
                  : "Tính đường đỡ tốn dầu"}
            </button>
          </div>
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

          {/*  "Xoá hết" đã nằm THƯỜNG TRỰC ở header — ở đây chỉ còn "Tính lại"
               (đổi thông số tàu / thêm bớt chỗ rồi tính lại). ĐỨNG TRƯỚC khối
               ghim đáy: nó là việc phụ nên để nó cuộn cùng nội dung; đặt sau
               nút ghim thì bị nút đè, chỉ thấy khi cuộn tới đáy.
               CHỈ cho trạng thái ĐANG ĐỌC: đang sửa danh sách thì nút ghim đáy
               đã là "Tính lại đường" rồi, hai nút cùng việc là rối. */}
          {!editing && (
            <button
              type="button"
              onClick={compute}
              disabled={busy}
              className="min-h-[3.5rem] w-full rounded-xl bg-background text-[1rem] font-bold text-navy transition active:scale-[0.99] disabled:opacity-60"
            >
              {busy ? "Đang tính lại…" : "Tính lại đường"}
            </button>
          )}

          {/* DẪN ĐƯỜNG LIVE: bám tuyến, theo dõi GPS. Chỉ hiện khi cha nối
              onStart (màn bản đồ), tuyến đã tính xong (result) và bà con ĐANG
              ĐỌC kết quả — đang sửa danh sách mà bấm là chạy theo tuyến TRƯỚC
              khi sửa. GHIM ĐÁY — đo thật: nút này từng nằm dưới mép thẻ. */}
          {onStart && result && !editing && (
            <div className="sticky bottom-0 z-10 -mx-3 -mb-3 bg-card">
              {/*  BA CON SỐ GHIM THEO NÚT — thứ bà con chờ 9-10 giây để đọc.
                   Đo thật: khung ĐỌC ĐƯỢC của thẻ (38dvh trừ hai thanh ghim)
                   chỉ còn hơn trăm px, mà thân thẻ xếp đoạn "đi từ → tới" rồi
                   khối đỏ nguy hiểm rồi mới tới lưới 3 ô ⇒ lưới nằm NGOÀI khung
                   nhìn ngay sau cú cuộn-về-đầu. Không thể vừa hiện trọn khối đỏ
                   vừa hiện lưới trong một ô cửa đó, nên GHIM một dòng số thay
                   vì đảo thứ tự (đảo chỗ chỉ đổi nạn nhân — lần đó nạn nhân là
                   cảnh báo an toàn).
                   Đây là NHÃN CỦA NÚT, không phải khối cảnh báo thứ tư: không
                   role="status" (lưới 3 ô bên trên đã là bản đầy đủ, đọc màn
                   hình không cần nghe hai lần), không bo tròn, không bấm được.
                   Lưới 3 ô trong thân thẻ GIỮ NGUYÊN — nó mang quy đổi ≈km/hải
                   lý theo đơn vị bà con chọn và nhãn phụ, dòng một hàng này
                   không chứa hết.
                   Khi `editing` bật thì khối này không tồn tại (thanh ghim lúc
                   đó là của biểu mẫu, nút "Tính lại đường") — CỐ Ý: đang sửa
                   danh sách thì ba con số là của tuyến TRƯỚC khi sửa. */}
              <p className="display px-3 pt-2 text-[1rem] font-bold leading-snug text-navy">
                {fmtDist(plan.distKm, prefs.distUnit)} ·{" "}
                {formatHoursVN(plan.hours)} chạy máy · ~
                {Math.round(plan.fuelL)} lít dầu
              </p>
              {/*  DẢI CẢNH BÁO NẰM TRONG CHÍNH THANH GHIM. Khối đỏ đầy đủ ở
                   trên có thể chưa cuộn tới (thanh ghim là con cuối của khung
                   cuộn, nền đục ⇒ nội dung trước nó chui xuống dưới nó), mà
                   CLAUDE.md cấm giấu cảnh báo an toàn. Dải này không cuộn mất,
                   không bị nút đè, dính sát mép trên thanh ghim nên đọc như
                   NHÃN CỦA NÚT chứ không phải khối cảnh báo thứ tư — vuông góc,
                   không bo tròn, không `active:`, không bấm được.
                   CỐ Ý KHÔNG role="alert": khối đầy đủ đã là alert, hai alert
                   cùng nội dung là trình đọc màn hình đọc hai lần. */}
              {dangerItems.length > 0 && (
                <p
                  className={`flex items-center gap-2 px-3 py-2 text-[0.9375rem] font-bold leading-snug ${
                    anyDanger
                      ? "bg-danger-bg text-danger"
                      : "bg-warn-bg text-warn"
                  }`}
                >
                  <AlertIcon className="h-5 w-5 shrink-0" />
                  Trên tuyến có chỗ nguy hiểm — đọc kỹ bên trên trước khi chạy
                </p>
              )}
              <div className="px-3 pb-3 pt-2">
                <button
                  type="button"
                  onClick={() => onStart(result)}
                  className="flex min-h-[3.5rem] w-full items-center justify-center gap-2.5 rounded-xl bg-t1 text-[1.125rem] font-bold text-white transition active:scale-[0.99]"
                >
                  <PlayIcon className="h-6 w-6" />
                  {anyDanger ? "Vẫn bắt đầu dẫn đường" : "Bắt đầu dẫn đường"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
      </div>
    </>
  );
}
