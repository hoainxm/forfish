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
import type {
  ExpressionSpecification,
  StyleSpecification,
} from "maplibre-gl";
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
import {
  loadPlaces,
  persistPlaces,
  homeOf,
  placeAt,
  upsertPlace,
  type SavedPlace,
} from "@/lib/places";
import {
  arrowFeatures,
  fetchForecastGrid,
  timeLabelVN,
  WIND_COLOR_EXPR,
  WAVE_COLOR_EXPR,
  type ForecastGrid,
  type ForecastKind,
} from "@/lib/forecast-grid";
import { fishInRegion, regionAt } from "@/data/fish-seasons";
import {
  fetchFishForecast,
  SPECIES_META,
  type FishForecast,
  type FishCell,
} from "@/lib/fish-predict";
import { moonPhase } from "@/lib/moon";
import {
  fetchSeaScalar,
  SEA_SCALARS,
  type SeaScalarKind,
  type SeaScalarResult,
} from "@/lib/sea-scalars";
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
import { MyPlacesSheet } from "@/components/my-places-sheet";
import { FishSpeciesSheet } from "@/components/fish-species-sheet";
import { StormBanner } from "@/components/storm-banner";
import {
  AlertIcon,
  ChevronDownIcon,
  CrosshairIcon,
  FishIcon,
  HomeIcon,
  LayersIcon,
  MoonIcon,
  PauseIcon,
  PinIcon,
  PlayIcon,
  StarIcon,
  TargetIcon,
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

const MAP_LAYER_KEY = "forfish.maplayer.v1";

// Màu lớp cá → ramp heatmap. NỘI DUNG dữ liệu bản đồ (khớp màu loài), không
// phải token UI — ngoại lệ cho phép theo design-system §5.
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}
// Mọi loài = xanh lá nhiều tông (trung tính, đẹp); chọn loài = 1 màu của loài
const FISH_HEAT_GREEN = [
  "interpolate", ["linear"], ["heatmap-density"],
  0, "rgba(64,145,108,0)",
  0.18, "rgba(149,213,178,0.4)",
  0.45, "rgba(82,183,136,0.62)",
  0.75, "rgba(45,134,89,0.78)",
  1, "rgba(27,75,44,0.88)",
];
function fishHeatColor(hex: string | null): unknown[] {
  if (!hex) return FISH_HEAT_GREEN;
  const [r, g, b] = hexToRgb(hex);
  const a = (alpha: number) => `rgba(${r},${g},${b},${alpha})`;
  return [
    "interpolate", ["linear"], ["heatmap-density"],
    0, a(0),
    0.18, a(0.4),
    0.45, a(0.64),
    0.75, a(0.8),
    1, a(0.92),
  ];
}

// Điểm mặc định khi CHƯA ghim cảng nhà: ngoài khơi Nam Trung Bộ (trung tâm
// vùng đánh bắt) — đủ để thấy cả Hoàng Sa/Trường Sa, có sóng để xem ngay.
const DEFAULT_SEA_POINT: SeaPoint = { lat: 13.0, lon: 110.5 };

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
  const [fishOn, setFishOn] = useState(true);

  // ── lớp số liệu biển (nước dâng/xoáy, độ mặn) — tải khi chọn, nhớ cache ──
  const [scalarKind, setScalarKind] = useState<SeaScalarKind | null>(null);
  const [scalarData, setScalarData] = useState<
    Partial<Record<SeaScalarKind, SeaScalarResult>>
  >({});
  useEffect(() => {
    if (!scalarKind || scalarData[scalarKind]) return;
    let alive = true;
    fetchSeaScalar(scalarKind).then((r) => {
      if (alive) setScalarData((m) => ({ ...m, [scalarKind]: r }));
    });
    return () => {
      alive = false;
    };
  }, [scalarKind, scalarData]);

  const activeScalar =
    scalarKind && scalarData[scalarKind]?.ok
      ? (scalarData[scalarKind] as Extract<SeaScalarResult, { ok: true }>)
      : null;

  const scalarGeo = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!activeScalar) return null;
    const h = 0.25; // ô 0.5°
    return {
      type: "FeatureCollection",
      features: activeScalar.cells.map((c) => ({
        type: "Feature",
        properties: { v: c.v },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [c.lon - h, c.lat - h],
              [c.lon + h, c.lat - h],
              [c.lon + h, c.lat + h],
              [c.lon - h, c.lat + h],
              [c.lon - h, c.lat - h],
            ],
          ],
        },
      })),
    };
  }, [activeScalar]);

  // ── DỰ BÁO CÁ (PFZ) — tính từ ảnh vệ tinh mới nhất, tải 1 lần ───────────
  const [fishCast, setFishCast] = useState<FishForecast | null>(null);
  // loài đang lọc trên bản đồ (null = loài tốt nhất mỗi ô)
  const [fishSpecies, setFishSpecies] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetchFishForecast().then((r) => {
      if (alive && r.ok) setFishCast(r);
    });
    return () => {
      alive = false;
    };
  }, []);
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

  // ô dự báo cá → ĐIỂM cho lớp heatmap (vùng mềm xanh lá kiểu PFZ chuẩn,
  // như OceanFishMap — không còn ô vuông); lọc theo loài đã chọn
  const fishCellsGeo = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!fishOn || !fishCast) return null;
    const features: GeoJSON.Feature[] = [];
    for (const c of fishCast.cells) {
      const v = fishSpecies ? (c.sp?.[fishSpecies] ?? 0) : c.s;
      if (v < 35) continue;
      features.push({
        type: "Feature",
        properties: { s: v },
        geometry: { type: "Point", coordinates: [c.lon, c.lat] },
      });
    }
    return { type: "FeatureCollection", features };
  }, [fishOn, fishCast, fishSpecies]);

  // màu lớp cá đang xem: theo loài đã chọn, hoặc xanh lá khi "Mọi loài"
  const activeFishColor = fishSpecies
    ? (SPECIES_META[fishSpecies]?.color ?? null)
    : null;

  // "Điểm của tôi": ghim đặc thù của chủ tàu + cảng nhà (localStorage).
  // ssr:false nên đọc localStorage trong initializer là an toàn.
  const [places, setPlacesState] = useState<SavedPlace[]>(() => loadPlaces());
  const setPlaces = useCallback((next: SavedPlace[]) => {
    setPlacesState(next);
    persistPlaces(next);
  }, []);
  const home = homeOf(places);
  const [placesSheetOpen, setPlacesSheetOpen] = useState(false);
  // bảng chọn loài cá (modal) — thay hàng chip ngang chắn bản đồ
  const [speciesSheetOpen, setSpeciesSheetOpen] = useState(false);

  // mở app: vào cảng nhà nếu đã đặt, không thì ngoài khơi Nam Trung Bộ
  const [point, setPoint] = useState<SeaPoint>(() => {
    const list = loadPlaces();
    const h = homeOf(list);
    return h ? { lat: h.lat, lon: h.lon } : DEFAULT_SEA_POINT;
  });
  // điểm đang xem có trùng một điểm đã ghim không
  const currentPlace = placeAt(places, point.lat, point.lon);
  const atHome = home != null && currentPlace?.id === home.id;

  // điểm NÓNG (hồng tâm chạm-là-tới): ô điểm cao, cách nhau ≥0.7° cho khỏi
  // chùm, tối đa 8. ƯU TIÊN KHU VỰC GẦN MÌNH: cộng điểm thưởng cho ô gần chỗ
  // đang xem / cảng nhà / điểm ghim (chỗ bà con hay đánh) — không bịa điểm cá,
  // chỉ xếp chỗ gần lên trước khi điểm xấp xỉ nhau.
  const fishHotspots = useMemo<
    { lat: number; lon: number; v: number; top: string[]; near: boolean }[]
  >(() => {
    if (!fishOn || !fishCast) return [];
    // các "mỏ neo gần mình": điểm đang xem + cảng nhà + điểm ghim
    const anchors: { lat: number; lon: number }[] = [
      { lat: point.lat, lon: point.lon },
      ...places.map((p) => ({ lat: p.lat, lon: p.lon })),
    ];
    const nearestKm = (lat: number, lon: number) =>
      Math.min(...anchors.map((a) => haversineKm(a.lat, a.lon, lat, lon)));
    const scored = fishCast.cells
      .map((c) => {
        const v = fishSpecies ? (c.sp?.[fishSpecies] ?? 0) : c.s;
        const km = nearestKm(c.lat, c.lon);
        // thưởng tối đa +12 điểm cho ô ngay cạnh, mờ dần tới 0 ở ~220 km
        const bonus = Math.max(0, 1 - km / 220) * 12;
        return {
          lat: c.lat,
          lon: c.lon,
          v,
          top: fishSpecies ? [fishSpecies] : c.top,
          near: km <= 74, // ~40 hải lý
          priority: v + bonus,
        };
      })
      .filter((c) => c.v >= 75)
      .sort((a, b) => b.priority - a.priority);
    const picked: typeof scored = [];
    for (const c of scored) {
      if (picked.length >= 8) break;
      const clash = picked.some(
        (p) =>
          Math.max(Math.abs(p.lat - c.lat), Math.abs(p.lon - c.lon)) < 0.7,
      );
      if (!clash) picked.push(c);
    }
    return picked.map(({ lat, lon, v, top, near }) => ({
      lat,
      lon,
      v,
      top,
      near,
    }));
  }, [fishOn, fishCast, fishSpecies, point, places]);

  // điểm cá gần chỗ đang xem nhất — câu gợi ý "đi hướng nào" trong thẻ cá
  const nearestHotspot = useMemo(() => {
    if (!fishHotspots.length) return null;
    let best: (typeof fishHotspots)[number] | null = null;
    let bd = Infinity;
    for (const h of fishHotspots) {
      const km = haversineKm(point.lat, point.lon, h.lat, h.lon);
      if (km < bd) {
        bd = km;
        best = h;
      }
    }
    if (!best) return null;
    return {
      nm: Math.round(bd / 1.852),
      dir: windDirectionVN(bearingDeg(point.lat, point.lon, best.lat, best.lon)),
      v: best.v,
    };
  }, [fishHotspots, point]);

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

  /** Mở một điểm đã lưu / GPS / cảng tìm được — bay tới + xem dự báo */
  const goToCoord = useCallback(
    (lat: number, lon: number, zoom = 7) => {
      setPoint({ lat, lon });
      setDayIdx(0);
      setRoute(null);
      flyToPoint(lon, lat, zoom);
    },
    [flyToPoint, setPoint, setDayIdx, setRoute],
  );

  /** "Về cảng nhà" — chỉ có nghĩa khi đã đặt cảng nhà */
  const goHome = () => {
    if (home) goToCoord(home.lat, home.lon, 6.5);
  };

  /** Ghim chỗ đang xem thành điểm của tôi (đặt tên) */
  const [pinName, setPinName] = useState("");
  const [pinning, setPinning] = useState(false);
  const savePin = () => {
    setPlaces(
      upsertPlace(places, {
        name: pinName,
        lat: point.lat,
        lon: point.lon,
      }),
    );
    setPinName("");
    setPinning(false);
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
        setPinning(false);
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
  }, [
    locating,
    flyToPoint,
    setPinning,
    setLocating,
    setGeoError,
    setDayIdx,
    setPoint,
    setSize,
  ]);

  const today = cond?.days[0] ?? null;
  // ngày đang chọn để xem dự báo (kẹp lại nếu nguồn trả ít ngày hơn)
  const sel =
    cond?.days[Math.min(dayIdx, (cond?.days.length ?? 1) - 1)] ?? null;
  const confidence = forecastConfidence(dayIdx);
  const prox = borderProximity(point.lat, point.lon);
  const depthNote = depth != null ? DEPTH_NOTE[depth] : undefined;
  // tuần trăng đêm nay — quyết với nghề đèn (mực, cá cơm); tính offline
  const moon = moonPhase(new Date());
  // vùng cá tại điểm đang xem (tham khảo theo mùa)
  const fishRegion = regionAt(point.lat, point.lon);
  const fishHere = fishRegion
    ? fishInRegion(fishRegion.id, THIS_MONTH).map((s) => s.species)
    : [];

  // tên ngắn các loài đang vụ Ở VÙNG ĐANG XEM — để đẩy "loài bà con hay đánh ở
  // vùng mình" lên đầu bộ chọn (ưu tiên khu vực gần mình). Tính thuần, để
  // React Compiler tự memo (manual useMemo với deps suy ra không khớp).
  const regionShorts = new Set<string>();
  if (fishRegion) {
    for (const s of fishInRegion(fishRegion.id, THIS_MONTH)) {
      const m = Object.values(SPECIES_META).find((x) => x.full === s.species);
      if (m) regionShorts.add(m.short);
    }
  }


  // dự báo cá TÍNH TỪ ẢNH tại điểm đang xem — ô gần nhất trong ~0.3°
  const fishAtPoint = useMemo<FishCell | null>(() => {
    if (!fishCast) return null;
    let best: FishCell | null = null;
    let bd = Infinity;
    for (const c of fishCast.cells) {
      const d = Math.max(
        Math.abs(c.lat - point.lat),
        Math.abs(c.lon - point.lon),
      );
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return bd <= 0.3 ? best : null;
  }, [fishCast, point]);

  // tóm tắt điều kiện — con số nói chuyện, không phán đi/ở
  const condSummary = sel
    ? dayIdx === 0 && cond
      ? `Sóng ${cond.waveM != null ? `${formatNumberVN(cond.waveM)} m` : "—"} · Gió cấp ${beaufort(cond.windKmh)}${
          cond.windDirDeg != null ? ` ${windDirectionVN(cond.windDirDeg)}` : ""
        }`
      : `Sóng tới ${sel.waveMaxM > 0 ? `${formatNumberVN(sel.waveMaxM)} m` : "—"} · Gió tới cấp ${beaufort(sel.windMaxKmh)}`
    : "";

  // dòng "ở đâu" nói tiếng người: tên điểm đã ghim, hoặc cách cảng nhà bao xa
  const whereLine = currentPlace
    ? currentPlace.kind === "home"
      ? `Cảng nhà — ${currentPlace.name}`
      : `Chỗ ghim — ${currentPlace.name}`
    : home
      ? (() => {
          const nm =
            haversineKm(home.lat, home.lon, point.lat, point.lon) / 1.852;
          const dir = windDirectionVN(
            bearingDeg(home.lat, home.lon, point.lat, point.lon),
          );
          return `Cách ${home.name} ~${Math.round(nm)} hải lý hướng ${dir}`;
        })()
      : "Chỗ đang xem trên biển";

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
          setPinning(false);
          setPoint({ lat, lon });
          // kiểu Windy: chạm là sheet nằm GỌN ở đáy (peek) — bản đồ vẫn
          // thấy nguyên, số liệu tóm tắt hiện ngay, chi tiết bấm "Xem thêm"
          setSize("peek");
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

        {/* (đã bỏ viền 7 vùng khoanh sẵn — dự báo cá nay tính TOÀN BỘ vùng
            biển VN, không còn giới hạn trong các đa giác; viền cũ gây hiểu lầm
            "chỉ có cá ở mấy vùng này") */}

        {/* lớp số liệu biển (nước dâng/xoáy, độ mặn) — ô màu 0.5° */}
        {scalarGeo && scalarKind && (
          <Source id="sea-scalar" type="geojson" data={scalarGeo}>
            <Layer
              id="sea-scalar-fill"
              type="fill"
              paint={{
                "fill-color": [
                  "interpolate",
                  ["linear"],
                  ["get", "v"],
                  ...SEA_SCALARS[scalarKind].colorStops,
                ] as unknown as string,
                "fill-opacity": 0.55,
              }}
            />
          </Source>
        )}

        {/* DỰ BÁO CÁ — vùng mềm XANH LÁ (heatmap) đậm dần theo khả năng,
            kiểu bản đồ PFZ chuẩn (OceanFishMap/INCOIS) — không ô vuông */}
        {fishCellsGeo && (
          <Source id="fish-cells" type="geojson" data={fishCellsGeo}>
            <Layer
              id="fish-cells-heat"
              type="heatmap"
              paint={{
                "heatmap-weight": [
                  "interpolate",
                  ["linear"],
                  ["get", "s"],
                  35, 0.15,
                  100, 1,
                ] as unknown as number,
                // bán kính phủ kín bước lưới 0,25° ở mọi mức zoom
                "heatmap-radius": [
                  "interpolate",
                  ["exponential", 2],
                  ["zoom"],
                  4, 9,
                  6, 30,
                  8, 110,
                ] as unknown as number,
                "heatmap-intensity": 0.9,
                // màu theo loài đã chọn (mỗi loài 1 màu), Mọi loài = xanh lá
                "heatmap-color": fishHeatColor(
                  activeFishColor,
                ) as unknown as ExpressionSpecification,
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

        {/* (nhãn loài theo vùng đã bỏ — chọn loài bằng hàng chip phía trên,
            đỡ rối bản đồ; chi tiết loài nằm trong sheet) */}

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

        {/* HỒNG TÂM điểm nóng dự báo cá — chạm là tới + xem dự báo chỗ đó */}
        {fishHotspots.map((h) => (
          <Marker
            key={`hot-${h.lat},${h.lon}`}
            longitude={h.lon}
            latitude={h.lat}
            anchor="center"
            onClick={() => {
              setPinning(false);
              setSize("peek");
              goToCoord(h.lat, h.lon);
            }}
          >
            <span
              className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/85 shadow-md ring-2 ${
                h.near ? "ring-trim" : "ring-white/90"
              }`}
              style={{ color: activeFishColor ?? "#1b4b2c" }}
              role="button"
              aria-label={`Điểm nóng có cá${h.near ? " gần bạn" : ""}: ${h.top.join(", ")}`}
            >
              <TargetIcon className="h-6 w-6" />
            </span>
          </Marker>
        ))}

        {/* điểm của tôi đã ghim — sao vàng có tên; chạm là xem dự báo chỗ đó */}
        {places.map((pl) => (
          <Marker
            key={pl.id}
            longitude={pl.lon}
            latitude={pl.lat}
            anchor="center"
            onClick={() => {
              setPinning(false);
              setSize("peek");
              goToCoord(pl.lat, pl.lon);
            }}
          >
            <span className="flex cursor-pointer flex-col items-center">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-white shadow-md ${
                  pl.kind === "home" ? "bg-t1" : "bg-sun"
                }`}
              >
                {pl.kind === "home" ? (
                  <HomeIcon className="h-4.5 w-4.5" />
                ) : (
                  <StarIcon className="h-4.5 w-4.5" />
                )}
              </span>
              <span className="mt-0.5 max-w-[110px] truncate rounded bg-white/85 px-1.5 text-[10px] font-bold leading-tight text-navy shadow-sm">
                {pl.name}
              </span>
            </span>
          </Marker>
        ))}

        {/* tuyến dẫn đường tiết kiệm dầu + điểm xuất phát */}
        <RouteMapLayers route={route} />

        {/* điểm đang xem dự báo (ẩn nếu trùng một điểm đã ghim — đã có sao) */}
        {!currentPlace && (
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
            className="pointer-events-auto max-w-[55%] rounded-xl bg-white/95 px-3 py-2 text-left transition active:scale-[0.98]"
          >
            <span className="block text-[14px] font-bold leading-tight text-navy">
              {scalarKind ? SEA_SCALARS[scalarKind].label : layer.label}
            </span>
            <span className="block text-[12px] leading-tight text-foreground/65">
              {scalarKind
                ? activeScalar
                  ? `Số liệu ngày ${formatDateVN(activeScalar.date)} — chậm vài ngày`
                  : scalarData[scalarKind]
                    ? "Chưa tải được — kiểm tra mạng"
                    : "Đang tải số liệu…"
                : layer.dated
                  ? `Ảnh ngày ${formatDateVN(dataDate)} — chậm vài ngày`
                  : "Hải đồ — không đổi theo ngày"}
            </span>
            {/* legend mini của nền đang xem — đọc màu tại chỗ */}
            {(() => {
              const lg = scalarKind
                ? SEA_SCALARS[scalarKind].legend
                : layer.legend;
              return (
                lg && (
                  <span className="mt-1 block">
                    <span
                      className="block h-1.5 w-full rounded-full"
                      style={{ background: lg.gradient }}
                      aria-hidden
                    />
                    <span className="flex justify-between gap-2 text-[10px] font-semibold leading-tight text-foreground/55">
                      <span>{lg.from}</span>
                      <span>{lg.to}</span>
                    </span>
                  </span>
                )
              );
            })()}
          </button>

          {/* cột FAB bên phải — kiểu Google Maps nhưng luôn kèm chữ */}
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={() => setLayerSheetOpen(true)}
              className="pointer-events-auto flex w-16 flex-col items-center justify-center gap-0.5 surface py-2 text-navy shadow-md transition active:scale-95"
            >
              <LayersIcon className="h-6 w-6" />
              <span className="text-[12px] font-bold">Lớp</span>
            </button>
            <button
              type="button"
              onClick={goToMyBoat}
              disabled={locating}
              className="pointer-events-auto flex w-16 flex-col items-center justify-center gap-0.5 surface py-2 text-navy shadow-md transition active:scale-95 disabled:opacity-60"
            >
              <CrosshairIcon className="h-6 w-6" />
              <span className="text-[12px] font-bold leading-tight">
                {locating ? "Đang tìm…" : "Tàu tôi"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setPlacesSheetOpen(true)}
              className="pointer-events-auto flex w-16 flex-col items-center justify-center gap-0.5 surface py-2 text-navy shadow-md transition active:scale-95"
            >
              <StarIcon className="h-6 w-6" />
              <span className="text-[12px] font-bold leading-tight">
                Điểm tôi
              </span>
            </button>
            {geoError && (
              <p className="pointer-events-auto max-w-[220px] rounded-xl bg-card px-2.5 py-1.5 text-right text-[13px] font-semibold leading-snug text-danger">
                Chưa lấy được vị trí — kiểm tra đã bật Định vị cho điện thoại
                chưa.
              </p>
            )}
          </div>
        </div>

        {/* thanh thời gian dự báo (kiểu Windy) — chỉ hiện khi bật lớp gió/sóng */}
        {forecastKind && (
          <div className="pointer-events-auto surface px-3 py-2 shadow-md">
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
                  className="shrink-0 rounded-xl bg-navy px-4 py-2.5 text-[15px] font-bold text-white"
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

        {/* nút "Cá" GỌN — thay hàng chip ngang (chắn bản đồ). Chỉ rộng bằng nội
            dung, chạm là mở bảng chọn loài. Hiện loài đang chọn + chấm màu. */}
        {fishOn && fishCast && fishCast.species.length > 0 && (
          <button
            type="button"
            onClick={() => setSpeciesSheetOpen(true)}
            aria-label="Chọn loài cá xem trên bản đồ"
            className="pointer-events-auto inline-flex max-w-[80%] items-center gap-2 self-start rounded-full bg-card/95 px-3 py-2 shadow-md transition active:scale-95"
          >
            <FishIcon className="h-5 w-5 shrink-0 text-t3" aria-hidden />
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{
                background: activeFishColor ?? "#2d8659",
              }}
              aria-hidden
            />
            <span className="truncate text-[14px] font-bold text-navy">
              {fishSpecies
                ? (SPECIES_META[fishSpecies]?.full ?? fishSpecies)
                : "Mọi loài cá"}
            </span>
            <ChevronDownIcon className="h-4 w-4 shrink-0 text-navy/55" />
          </button>
        )}
      </div>

      {/* ── SHEET ĐÁY 3 NẤC — một chế độ duy nhất ────────────────────────── */}
      <SnapSheet
        size={size}
        onSizeChange={setSize}
        onClose={home && !atHome ? goHome : undefined}
        closeLabel="Về cảng nhà"
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
              Chỗ này trên đất liền — chạm ra biển để xem gió sóng.
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
              {atHome && (
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
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[15px] font-semibold"
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
                          : "bg-field"
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
                className="rounded-xl p-4"
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

              {/* DỰ BÁO CÁ tại chỗ này — tính từ ảnh mới nhất; không có dữ liệu
                  thì lùi về mùa vụ. Luôn ghi rõ tham khảo. */}
              {fishCast && fishAtPoint ? (
                (() => {
                  // theo loài đã chọn trên bản đồ, hoặc loài tốt nhất tại ô
                  const v = fishSpecies
                    ? (fishAtPoint.sp?.[fishSpecies] ?? 0)
                    : fishAtPoint.s;
                  const selMeta = fishSpecies
                    ? SPECIES_META[fishSpecies]
                    : null;
                  // tên đầy đủ cho dễ đọc
                  const names = fishSpecies
                    ? [selMeta?.full ?? fishSpecies]
                    : fishAtPoint.top.map((s) => SPECIES_META[s]?.full ?? s);
                  // loài đáy/rạn/giáp xác: ảnh vệ tinh ít chính xác → nói thẳng
                  const lowSig = selMeta?.surfaceSignal === "low";
                  if (v < 25 && fishSpecies)
                    return (
                      <div className="flex items-start gap-2.5 surface p-3.5">
                        <FishIcon className="mt-0.5 h-5 w-5 shrink-0 text-t3" />
                        <p className="text-[15px] leading-snug text-foreground/80">
                          Hôm nay chỗ này <b>không nổi bật</b> cho{" "}
                          <b>{selMeta?.full ?? fishSpecies}</b> — dò vùng tô màu
                          khi chọn loài này trên bản đồ.
                        </p>
                      </div>
                    );
                  if (v < 25) return null;
                  // số môi trường tại ô — kiểu bảng đọc của OceanFishMap
                  const bait =
                    fishAtPoint.c == null
                      ? null
                      : fishAtPoint.c >= 0.5
                        ? "mồi dày"
                        : fishAtPoint.c >= 0.15
                          ? "mồi vừa"
                          : "mồi loãng";
                  return (
                    <div className="flex items-start gap-2.5 surface p-3.5">
                      <FishIcon className="mt-0.5 h-5 w-5 shrink-0 text-trim" />
                      <div className="min-w-0">
                        <p className="text-[15px] leading-snug text-foreground/80">
                          <b>
                            Chỗ này có khả năng{" "}
                            {v >= 70 ? "TỐT" : v >= 50 ? "khá" : "vừa"}
                          </b>{" "}
                          cho: <b>{names.join(", ")}</b>
                        </p>
                        <p className="mt-1 text-[14px] font-semibold leading-snug text-foreground/65">
                          Nước {formatNumberVN(fishAtPoint.t)}°C
                          {bait ? ` · ${bait}` : ""} — ảnh ngày{" "}
                          {formatDateVN(fishCast.date)}
                        </p>
                        {/* TRUNG THỰC: loài đáy/rạn dự báo theo mùa + độ sâu */}
                        {lowSig ? (
                          <p className="mt-1 text-[13px] leading-snug text-warn">
                            {selMeta?.category === "reef"
                              ? "Cá rạn"
                              : selMeta?.category === "crustacean"
                                ? "Tôm/ghẹ/cua sống đáy"
                                : "Cá đáy"}{" "}
                            — đoán theo <b>mùa vụ + độ sâu</b> ({selMeta?.depthBand}),
                            ảnh vệ tinh mặt biển ít chính xác cho loài này.
                          </p>
                        ) : (
                          <p className="mt-0.5 text-[13px] leading-snug text-foreground/55">
                            Vùng tô màu trên bản đồ là chỗ tương tự, hồng tâm là
                            chỗ nổi nhất. Tham khảo, không phải cam kết.
                          </p>
                        )}
                        {/* ưu tiên gần mình: điểm cá gần chỗ đang xem nhất */}
                        {nearestHotspot && (
                          <p className="mt-1 text-[13px] font-semibold leading-snug text-t1">
                            {nearestHotspot.nm <= 3
                              ? "Điểm cá nổi bật ngay chỗ bạn đang xem."
                              : `Điểm cá gần bạn nhất: ~${nearestHotspot.nm} hải lý hướng ${nearestHotspot.dir} (khả năng ${
                                  nearestHotspot.v >= 70
                                    ? "TỐT"
                                    : nearestHotspot.v >= 50
                                      ? "khá"
                                      : "vừa"
                                }).`}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()
              ) : fishCast && fishHere.length > 0 ? (
                <div className="flex items-start gap-2.5 surface p-3.5">
                  <FishIcon className="mt-0.5 h-5 w-5 shrink-0 text-t3" />
                  <p className="text-[15px] leading-snug text-foreground/80">
                    Hôm nay chỗ này <b>không nổi bật</b> trên ảnh vệ tinh — dò
                    các vùng xanh lá trên bản đồ. Mùa này vùng{" "}
                    <b>{fishRegion?.name}</b> thường có:{" "}
                    {fishHere.join(", ")}{" "}
                    <span className="text-foreground/55">(tham khảo)</span>
                  </p>
                </div>
              ) : fishHere.length > 0 ? (
                <div className="flex items-start gap-2.5 surface p-3.5">
                  <FishIcon className="mt-0.5 h-5 w-5 shrink-0 text-t3" />
                  <p className="text-[15px] leading-snug text-foreground/80">
                    Mùa này vùng <b>{fishRegion?.name}</b> thường có:{" "}
                    <b>{fishHere.join(", ")}</b>{" "}
                    <span className="text-foreground/55">
                      (mùa vụ nhiều năm — tham khảo)
                    </span>
                  </p>
                </div>
              ) : null}

              {/* tuần trăng đêm nay — cho nghề đèn (mực, cá cơm) */}
              <div className="flex items-start gap-2.5 surface p-3.5">
                <MoonIcon className="mt-0.5 h-5 w-5 shrink-0 text-navy/70" />
                <p className="text-[15px] leading-snug text-foreground/80">
                  <b>{moon.label}.</b> {moon.note}
                </p>
              </div>

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
                  <div className="surface p-4">
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
                  <div className="surface p-4">
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
                          : "bg-field text-foreground/75"
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

              {/* ghim chỗ này thành "Điểm của tôi" */}
              {currentPlace ? (
                <div className="flex items-center gap-2.5 surface p-3.5">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white ${
                      currentPlace.kind === "home" ? "bg-t1" : "bg-sun"
                    }`}
                  >
                    {currentPlace.kind === "home" ? (
                      <HomeIcon className="h-4.5 w-4.5" />
                    ) : (
                      <StarIcon className="h-4.5 w-4.5" />
                    )}
                  </span>
                  <span className="flex-1 text-[15px] font-bold text-navy">
                    Đã ghim: {currentPlace.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPlacesSheetOpen(true)}
                    className="rounded-full bg-field px-3 py-2 text-[14px] font-bold text-navy"
                  >
                    Sửa
                  </button>
                </div>
              ) : pinning ? (
                <div className="surface p-3.5">
                  <p className="mb-2 text-[15px] font-bold text-navy">
                    Đặt tên cho chỗ này
                  </p>
                  <input
                    value={pinName}
                    onChange={(e) => setPinName(e.target.value)}
                    autoFocus
                    placeholder="Vd: Rạn ông Tư, chỗ câu mực…"
                    className="min-h-[52px] w-full rounded-lg bg-field px-4 text-[16px] font-semibold focus:outline-none"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPinning(false);
                        setPinName("");
                      }}
                      className="min-h-[52px] flex-1 rounded-xl bg-field text-[16px] font-bold text-navy"
                    >
                      Thôi
                    </button>
                    <button
                      type="button"
                      onClick={savePin}
                      className="min-h-[52px] flex-1 rounded-xl bg-t1 text-[16px] font-bold text-white"
                    >
                      Lưu chỗ này
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setPinName("");
                    setPinning(true);
                  }}
                  className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-field text-[16px] font-bold text-navy transition active:scale-[0.99]"
                >
                  <StarIcon className="h-5 w-5" />
                  Ghim chỗ này để mở nhanh lần sau
                </button>
              )}

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
          scalarKind={scalarKind}
          onScalar={(k) => {
            setScalarKind(k);
            // lớp số liệu xem rõ nhất trên nền hải đồ sạch
            if (k != null) setLayerId("bathymetry");
          }}
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

      {/* ── BẢNG CHỌN LOÀI CÁ (modal) — thay hàng chip ngang ─────────────── */}
      {speciesSheetOpen && fishCast && (
        <FishSpeciesSheet
          species={fishCast.species}
          current={fishSpecies}
          regionShorts={regionShorts}
          onPick={setFishSpecies}
          onClose={() => setSpeciesSheetOpen(false)}
        />
      )}

      {/* ── SHEET "ĐIỂM CỦA TÔI" — ghim, cảng nhà, GPS ───────────────────── */}
      {placesSheetOpen && (
        <MyPlacesSheet
          places={places}
          onPlaces={setPlaces}
          onGo={(lat, lon) => {
            setPinning(false);
            setSize("peek");
            goToCoord(lat, lon);
          }}
          onUseGps={goToMyBoat}
          onClose={() => setPlacesSheetOpen(false)}
        />
      )}
    </div>
  );
}
