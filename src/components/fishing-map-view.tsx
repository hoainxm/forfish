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
import Link from "next/link";
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
  DEFAULT_VIEW,
  OCEAN_LAYERS,
  SOVEREIGNTY_LABELS,
  type OceanLayerId,
} from "@/lib/ocean-map";
import {
  COAST_DATA_URL,
  OFFLINE_COAST_COLOR,
  OFFLINE_LAND_COLOR,
  nextFailCount,
  offlineBasemapNote,
  shouldUseOfflineBasemap,
} from "@/lib/offline-basemap";
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
  GRID_DAY_OPTIONS,
  savedGridDays,
  type GridDays,
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
import { lowQualityNote } from "@/lib/source-registry";
import { moonPhase } from "@/lib/moon";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/use-auth";
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
import { vungLongGeoJSON } from "@/data/vn-fishing-zones";
import { borderProximity, haversineKm, type BorderLevel } from "@/lib/geofence";
import { fetchDepthGrid, depthClassAt, type DepthClass } from "@/lib/depth-grid";
import { weatherFromCode } from "@/lib/weather-codes";
import { useMapPrefs, fmtDist, fmtCoordPair } from "@/lib/map-prefs";
import { fetchStormCheck, stormStatus, type StormCheck } from "@/lib/storms";
import {
  chipLabel,
  clockVN,
  dayLabel,
  daysBetweenISO,
  isoDateVN,
  isPastDay,
} from "@/lib/day-labels";
import {
  beaufort,
  fetchSeaPoint,
  forecastConfidence,
  formatNumberVN,
  windDirectionVN,
  type SeaPoint,
  type SeaPointConditions,
} from "@/lib/marine-weather";
import type { PretripPoint } from "@/lib/pretrip";
import { skillForLead } from "@/lib/forecast-quality";
import { FORECAST_SKILL } from "@/lib/forecast-skill";
import { savedAgoLabel } from "@/lib/forecast-cache";
import { SnapSheet, type SheetSize } from "@/components/ui/snap-sheet";
import { RaKhoiControls } from "@/components/ra-khoi-controls";
import { StormBanner } from "@/components/storm-banner";
import {
  NOTIFY_HIDE_MS,
  PretripAutoNotify,
} from "@/components/pretrip-auto-notify";
import {
  AlertIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FishIcon,
  HomeIcon,
  MoonIcon,
  PauseIcon,
  PinIcon,
  PlayIcon,
  StarIcon,
  TargetIcon,
  WavesIcon,
  WindIcon,
} from "@/components/icons";

/* Nhãn ngày ("Hôm nay" / "Ngày mai" / ngày thật) nằm ở lib/day-labels.ts —
   so NGÀY THẬT chứ không so vị trí mảng, để bản lưu trong máy không nói dối. */

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
// Ranh giới vùng lộng (NĐ 26/2019) — tĩnh, tạo một lần.
const VUNG_LONG_DATA = vungLongGeoJSON();

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

/**
 * Số ngày mà "chỗ cá ít đổi" là câu ĐÃ ĐO ĐƯỢC, không phải câu nói cho vui.
 * scripts/fish-3day-probe.mjs dựng bản đồ cá cho D+1..D+3 bằng neo vệ tinh +
 * xu hướng nhiệt Copernicus (α cross-validated, src/data/copernicus-tendency-skill.json)
 * rồi so với bản hôm nay: chỉ 0,5–1,6 % số ô đổi trạng thái điểm nóng, Jaccard
 * 0,93–0,98 trên cả 3 mùa đã thử ⇒ lớp cá GIỮ MỘT BẢN, không tách theo ngày.
 * Xa hơn mốc này thì chưa đo ⇒ UI phải đổi giọng (xem chỗ dùng hằng số này).
 */
const FISH_STABLE_DAYS = 3;

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
// Mọi loài = XANH LÁ nhiều tông (user chốt: xanh lá xấu, về xanh lá như cũ);
// chọn loài = 1 màu của loài
const FISH_HEAT_DEFAULT = [
  "interpolate", ["linear"], ["heatmap-density"],
  0, "rgba(64,145,108,0)",
  0.18, "rgba(149,213,178,0.4)",
  0.45, "rgba(82,183,136,0.62)",
  0.75, "rgba(45,134,89,0.78)",
  1, "rgba(27,75,44,0.88)",
];
function fishHeatColor(hex: string | null): unknown[] {
  if (!hex) return FISH_HEAT_DEFAULT;
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

/** 4 nhãn mốc cho thanh thời gian theo khung ngày đang chọn (Bây giờ → N ngày) */
function gridTickLabels(days: number): string[] {
  const q1 = Math.max(1, Math.round(days / 3));
  const q2 = Math.max(q1 + 1, Math.round((2 * days) / 3));
  return ["Bây giờ", `${q1} ngày`, `${q2} ngày`, `${days} ngày`];
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
  // ranh giới vùng lộng (NĐ 26/2019) — bật mặc định, tắt được ở panel lớp
  const [vungLongOn, setVungLongOn] = useState(true);

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
  // Phân quyền kiểu TEASER (user chốt 2026-06-11): lớp cá (heatmap + điểm nóng)
  // HIỆN cho mọi người để thu hút; xem CHI TIẾT một điểm mới cần đăng nhập.
  // fishLocked = đã cấu hình Supabase + CHƯA đăng nhập (đang kiểm tra coi như
  // chưa khóa để khỏi nháy). Demo mode (chưa cấu hình) = mở hết.
  const { user, ready: authReady } = useAuthUser();
  const fishLocked = isSupabaseConfigured() && authReady && !user;

  const [fishCast, setFishCast] = useState<FishForecast | null>(null);
  // loài đang lọc trên bản đồ (null = loài tốt nhất mỗi ô)
  const [fishSpecies, setFishSpecies] = useState<string | null>(null);
  // lỗi tải dự báo cá phải LÊN TIẾNG — không để nút Cá lặng lẽ biến mất
  // còn người dùng tưởng "hôm nay không có cá"
  const [fishFailed, setFishFailed] = useState(false);
  /* Bản đồ cá dựng từ ảnh CŨ / thiếu nguồn thì phải nói MỘT DÒNG rồi tự tắt —
     không badge thường trực (màn hình phải gọn), nhưng cũng không im lặng hứa
     độ chính xác mà nguồn không đảm bảo. Luật + chữ ở lib/source-registry.ts. */
  const [fishQualityNote, setFishQualityNote] = useState<string | null>(null);
  const loadFish = useCallback(() => {
    setFishFailed(false);
    fetchFishForecast()
      .then((r) => {
        if (r.ok) {
          setFishCast(r);
          setFishQualityNote(lowQualityNote(r));
        } else setFishFailed(true);
      })
      .catch(() => setFishFailed(true));
  }, []);
  // nói xong thì tắt, cùng nhịp với các dòng nổi khác trên bản đồ
  useEffect(() => {
    if (!fishQualityNote) return;
    const t = setTimeout(() => setFishQualityNote(null), NOTIFY_HIDE_MS);
    return () => clearTimeout(t);
  }, [fishQualityNote]);
  // lớp cá tải cho MỌI người (teaser); chi tiết mới gate
  useEffect(() => {
    loadFish();
  }, [loadFish]);
  const [size, setSize] = useState<SheetSize>("peek");

  // ── dự báo vẽ động kiểu Windy: lớp gió/sóng + thanh thời gian ───────────
  const [forecastKind, setForecastKind] = useState<ForecastKind | null>(null);
  const [fGrid, setFGrid] = useState<ForecastGrid | null>(null);
  const [gridFailed, setGridFailed] = useState(false);
  const [timeIdx, setTimeIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  // khung ngày lớp vẽ động (3/5/7/10/16) — bà con tự chọn tầm xa/gần
  const [gridDays, setGridDays] = useState<GridDays>(3);
  // Khung ngày THẬT SỰ đang có bản lưu trong máy — chỉ đọc khi tải hỏng, để nói
  // thật ("máy chưa lưu khung 16 ngày, đang có 3 và 7") thay vì đưa lưới khung khác.
  const [savedDays, setSavedDays] = useState<number[]>([]);
  useEffect(() => {
    if (!gridFailed) return;
    setSavedDays(savedGridDays().filter((d) => d !== gridDays));
  }, [gridFailed, gridDays]);

  // tải lưới dự báo khi bật lớp lần đầu, hoặc khi ĐỔI khung ngày (tải lại cho tầm mới)
  useEffect(() => {
    if (!forecastKind || gridFailed) return;
    let alive = true;
    setFGrid(null); // hiện "đang tải" khi đổi khung; timeIdx kẹp lại ở render
    fetchForecastGrid(gridDays)
      .then((g) => alive && setFGrid(g))
      .catch(() => alive && setGridFailed(true));
    return () => {
      alive = false;
    };
  }, [forecastKind, gridFailed, gridDays]);

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

  // Lọc theo KHOẢNG khả năng có cá (kéo-thả 2 đầu ở legend): chỉ hiện ô trong
  // [lo,hi]%. Sàn 50 (user 2026-07-25: dưới 50 làm nhiễu — trước là 35).
  const [fishRange, setFishRange] = useState<[number, number]>([50, 100]);

  // ô dự báo cá → ĐIỂM cho lớp heatmap (vùng mềm xanh lá kiểu PFZ chuẩn,
  // như OceanFishMap — không còn ô vuông); lọc theo loài + khoảng đã chọn
  const fishCellsGeo = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!fishOn || !fishCast) return null;
    const lo = Math.max(50, fishRange[0]);
    const hi = fishRange[1];
    const features: GeoJSON.Feature[] = [];
    for (const c of fishCast.cells) {
      const v = fishSpecies ? (c.sp?.[fishSpecies] ?? 0) : c.s;
      if (v < lo || v > hi) continue;
      features.push({
        type: "Feature",
        properties: { s: v },
        geometry: { type: "Point", coordinates: [c.lon, c.lat] },
      });
    }
    return { type: "FeatureCollection", features };
  }, [fishOn, fishCast, fishSpecies, fishRange]);

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
  // đơn vị khoảng cách + hệ toạ độ (panel Cài đặt) — đổi thì mọi chỗ đổi theo
  const prefs = useMapPrefs();
  // Hiện điểm đã lưu trên bản đồ (panel Điểm đã lưu — Phương án A)
  const [showPlaces, setShowPlaces] = useState(true);
  // thanh giờ Windy (gió/sóng) cho thu/mở — đỡ chiếm mép sheet (user 2026-06-23)
  const [gridStripOpen, setGridStripOpen] = useState(true);
  // công cụ đo khoảng cách 2 điểm (panel Công cụ)
  const [measureMode, setMeasureMode] = useState(false);
  const [measurePts, setMeasurePts] = useState<SeaPoint[]>([]);
  const toggleMeasure = (on: boolean) => {
    setMeasureMode(on);
    if (!on) setMeasurePts([]);
  };

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
      .filter((c) => c.v >= Math.max(75, fishRange[0]) && c.v <= fishRange[1])
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
  }, [fishOn, fishCast, fishSpecies, point, places, fishRange]);

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
      km: bd,
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
  // ĐỒNG HỒ của màn hình — nhích 5 phút một lần. Chuyến biển dài, app mở suốt:
  // không có nhịp này thì "Hôm nay" và tuổi tin bão đứng yên ở lúc mở app.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);
  /** Ngày HÔM NAY thật (giờ VN) — mọi nhãn ngày so với cái này, không so vị trí */
  const todayIso = useMemo(() => isoDateVN(nowMs), [nowMs]);

  // Giữ NGUYÊN VẸN câu trả lời của nguồn (kể cả ok:false) — mảng rỗng không
  // được dùng chung cho "không có bão" và "chưa hỏi được" (an toàn tính mạng).
  const [stormCheck, setStormCheck] = useState<StormCheck | null>(null);
  const stormInfo = useMemo(
    () => stormStatus(stormCheck, nowMs),
    [stormCheck, nowMs],
  );
  const storms = useMemo(
    () => (stormInfo.kind === "co-bao" ? stormInfo.storms : []),
    [stormInfo],
  );
  const stormTimeLabel =
    stormInfo.kind === "co-bao" && stormInfo.checkedAt != null
      ? `Tin lúc ${clockVN(stormInfo.checkedAt)}`
      : "Chưa rõ tin lúc nào";
  // Geometry bão → GeoJSON: vùng ảnh hưởng (polygon) + đường đi (track) để vẽ
  // đè bản đồ kiểu app thời tiết chuyên nghiệp (nguồn GDACS đã có sẵn).
  const stormGeo = useMemo<GeoJSON.FeatureCollection | null>(() => {
    const features: GeoJSON.Feature[] = [];
    for (const s of storms) {
      for (const poly of s.areas) {
        features.push({
          type: "Feature",
          properties: { kind: "area" },
          geometry: { type: "Polygon", coordinates: poly },
        });
      }
      if (s.track.length > 1) {
        features.push({
          type: "Feature",
          properties: { kind: "track" },
          geometry: { type: "LineString", coordinates: s.track },
        });
      }
    }
    return features.length ? { type: "FeatureCollection", features } : null;
  }, [storms]);
  // ngày đang xem dự báo: 0 = hôm nay … tới FORECAST_MAX_DAYS-1
  const [dayIdx, setDayIdx] = useState(0);
  // tuyến dẫn đường tiết kiệm dầu (route-planner.tsx) — vẽ đè lên bản đồ
  const [route, setRoute] = useState<PlannedRoute | null>(null);
  // hạng độ sâu tại điểm đang xem (null = chưa biết/không cảnh báo)
  const [depth, setDepth] = useState<DepthClass | null>(null);

  /* ── MẤT SÓNG: nền tối giản trong máy ───────────────────────────────────
     Ô bản đồ nền lấy từ host ngoài nên mất sóng là nền trắng — bà con có số
     gió sóng mà không thấy bờ, không thấy đảo. Đếm ô nền tải trượt + nghe
     máy báo mất mạng để bật hình bờ biển lưu trong máy (lib/offline-basemap). */
  const [netOnline, setNetOnline] = useState(true);
  const [basemapFails, setBasemapFails] = useState(0);
  useEffect(() => {
    const sync = () => setNetOnline(navigator.onLine);
    sync();
    // có sóng lại thì cho nền thật một cơ hội mới (xoá số ô trượt cũ)
    const back = () => {
      setNetOnline(true);
      setBasemapFails(0);
    };
    window.addEventListener("online", back);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", back);
      window.removeEventListener("offline", sync);
    };
  }, []);
  const basemapHealth = { online: netOnline, fails: basemapFails };
  const offlineBase = shouldUseOfflineBasemap(basemapHealth);
  const offlineNote = offlineBasemapNote(basemapHealth);
  /* Nhắc "mất sóng" HIỆN RỒI TỰ TẮT như dòng "Đã lưu dự báo tới ngày…" — thẻ
     vàng 2 dòng nằm lì trước đây làm rối bản đồ. Effect chỉ chạy lại khi CÂU
     ĐỔI, nên vẫn đang mất sóng thì không báo đi báo lại; có sóng lại rồi mất
     tiếp thì câu quay về từ null → báo một lần nữa. */
  const [offlineNoteOn, setOfflineNoteOn] = useState(false);
  useEffect(() => {
    if (!offlineNote) {
      setOfflineNoteOn(false);
      return;
    }
    setOfflineNoteOn(true);
    const t = setTimeout(() => setOfflineNoteOn(false), NOTIFY_HIDE_MS);
    return () => clearTimeout(t);
  }, [offlineNote]);
  /** Hình bờ + đảo: chỉ nạp khi CẦN (mất sóng), không tốn dữ liệu lúc bình thường */
  const [coastData, setCoastData] = useState<GeoJSON.FeatureCollection | null>(
    null,
  );
  useEffect(() => {
    if (!offlineBase || coastData) return;
    let alive = true;
    fetch(COAST_DATA_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && j && setCoastData(j as GeoJSON.FeatureCollection))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [offlineBase, coastData]);

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

  /** Mở một điểm đã lưu / GPS / cảng tìm được — bay tới + xem dự báo.
      Tuyến đang vẽ giữ nguyên (như chạm bản đồ) — RoutePlanner tự nhắc. */
  const goToCoord = useCallback(
    (lat: number, lon: number, zoom = 7) => {
      setPoint({ lat, lon });
      setDayIdx(0);
      flyToPoint(lon, lat, zoom);
    },
    [flyToPoint, setPoint, setDayIdx],
  );

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
    // Giữ CẢ câu trả lời hỏng (ok:false): UI phải phân biệt được "hỏi rồi,
    // không có bão" với "chưa hỏi được" — không được im lặng rồi để mảng rỗng
    // nói hộ thành "không có bão".
    fetchStormCheck().then((c) => alive && setStormCheck(c));
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
  // Bản lưu trong máy giữ nguyên dãy ngày CŨ → có ngày đã trôi qua. Bỏ qua các
  // ngày đã qua khi chọn, và nếu qua hết thì coi như không còn số nào dùng được.
  const days = cond?.days ?? [];
  const firstUsableIdx = days.findIndex((d) => !isPastDay(d.date, todayIso));
  const allPast = days.length > 0 && firstUsableIdx === -1;
  const selIdx = allPast
    ? -1
    : Math.min(Math.max(dayIdx, Math.max(firstUsableIdx, 0)), days.length - 1);
  const sel = selIdx >= 0 ? (days[selIdx] ?? null) : null;
  // TẦM NGÀY THẬT: đếm từ hôm nay tới ngày đang xem, KHÔNG lấy vị trí trong
  // mảng — bản lưu 5 ngày trước mà tính theo vị trí thì ngày xa vẫn được gắn
  // nhãn "khá sát" (sai theo hướng lạc quan, đúng chỗ nguy hiểm nhất).
  const daysAhead = sel ? Math.max(0, daysBetweenISO(todayIso, sel.date)) : 0;
  // độ tin nói thật: nhãn theo tầm ngày, hạ thêm nếu backtest đo được sai số
  // lớn ở tầm ngày này (skill từ src/data/forecast-skill.json, không gọi mạng)
  const skillConf =
    skillForLead(FORECAST_SKILL, daysAhead + 1)?.confidence ?? null;
  const confidence = forecastConfidence(daysAhead, skillConf);
  /** Số đo "lúc này" trong bản lưu là số ĐÔNG CỨNG lúc lưu — chỉ nói thật giờ đo */
  const isToday = sel?.date === todayIso;
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
  // Số "lúc này" chỉ được nói khi đúng là hôm nay VÀ là số vừa lấy về; bản lưu
  // trong máy thì phải nói theo cả ngày (số "lúc này" đã đông cứng từ lúc lưu).
  const condSummary = sel
    ? isToday && cond && !cond.stale && cond.windKmh != null
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
          const km = haversineKm(home.lat, home.lon, point.lat, point.lon);
          const dir = windDirectionVN(
            bearingDeg(home.lat, home.lon, point.lat, point.lon),
          );
          return `Cách ${home.name} ~${fmtDist(km, prefs.distUnit)} hướng ${dir}`;
        })()
      : "Chỗ đang xem trên biển";

  // TẢI SẴN TRƯỚC KHI RỜI BỜ: các chỗ tải sẵn = chỗ đang xem + mọi điểm đã ghim
  // (cảng nhà nằm trong đó). Không tự bịa thêm chỗ — chỉ nơi bà con đã đánh dấu.
  const pretripPoints = useMemo<PretripPoint[]>(
    () => [
      { lat: point.lat, lon: point.lon, name: currentPlace?.name ?? "Chỗ đang xem" },
      ...places.map((p) => ({
        lat: p.lat,
        lon: p.lon,
        name: p.kind === "home" ? `Cảng nhà — ${p.name}` : p.name,
      })),
    ],
    [point, places, currentPlace],
  );

  // kết quả đo 2 điểm (đường chim bay) — định dạng theo đơn vị đang chọn
  const measureResult =
    measurePts.length === 2
      ? {
          dist: fmtDist(
            haversineKm(
              measurePts[0].lat,
              measurePts[0].lon,
              measurePts[1].lat,
              measurePts[1].lon,
            ),
            prefs.distUnit,
          ),
          dir: windDirectionVN(
            bearingDeg(
              measurePts[0].lat,
              measurePts[0].lon,
              measurePts[1].lat,
              measurePts[1].lon,
            ),
          ),
        }
      : null;

  return (
    <div className="relative h-full w-full overflow-hidden bg-t1-bg">
      {/* ── BẢN ĐỒ — cả màn hình ─────────────────────────────────────────── */}
      <MapGL
        ref={mapRef}
        initialViewState={DEFAULT_VIEW}
        mapStyle={mapStyle}
        // user chốt: KHÔNG khoá vùng — cho kéo xem toàn cầu (mặc định mở quanh
        // biển VN nhưng tự do di chuyển/zoom đi nơi khác)
        minZoom={2}
        style={{ width: "100%", height: "100%" }}
        // Ô nền không về (mất sóng / wifi cảng "có mà không ra") → đếm để bật
        // hình bờ biển lưu trong máy. Chỉ tính ô của lớp NỀN, không tính lớp
        // ảnh vệ tinh (ảnh thiếu ô là chuyện thường, mây che cũng trống).
        onError={(e) => {
          const src = (e as unknown as { sourceId?: string }).sourceId;
          if (src === "basemap") setBasemapFails((n) => nextFailCount(n, false));
        }}
        // Có Ô NỀN VỀ THẬT (`tile` có mặt = một ô vừa tải xong) → đường đã
        // thông, xoá số ô trượt. KHÔNG dùng cờ "source đã tải xong": ô lỗi
        // cũng làm cờ đó bật, sẽ xoá nhầm ngay sau khi vừa đếm lỗi.
        onSourceData={(e) => {
          const d = e as unknown as { sourceId?: string; tile?: unknown };
          if (d.sourceId === "basemap" && d.tile) {
            setBasemapFails((n) => nextFailCount(n, true));
          }
        }}
        onClick={(e) => {
          // đổi điểm xem — tuyến cũ GIỮ NGUYÊN trên bản đồ (hội đồng UX
          // 2026-06-11: tuyến tính mất 10s, không tự ý vứt vì một cú chạm
          // nhầm; RoutePlanner sẽ nhắc "tuyến đang tới chỗ cũ" + cho xóa)
          const lat = Math.round(e.lngLat.lat * 1000) / 1000;
          const lon = Math.round(e.lngLat.lng * 1000) / 1000;
          // chế độ ĐO: chạm là đặt điểm 1, điểm 2; chạm tiếp thì đo lại từ đầu
          if (measureMode) {
            setMeasurePts((pts) =>
              pts.length >= 2 ? [{ lat, lon }] : [...pts, { lat, lon }],
            );
            return; // không đổi điểm xem khi đang đo
          }
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
        {/* NỀN TỐI GIẢN KHI MẤT SÓNG — hình bờ + đảo lưu trong máy. Đặt Ở ĐẦU
            danh sách để nằm DƯỚI mọi lớp khác (ranh giới, cá, mũi tên gió).
            Có mạng thì KHÔNG vẽ (nền thật đủ tốt, vẽ chồng chỉ gây rối). */}
        {offlineBase && coastData && (
          <Source id="offline-coast" type="geojson" data={coastData}>
            <Layer
              id="offline-coast-fill"
              type="fill"
              paint={{ "fill-color": OFFLINE_LAND_COLOR }}
            />
            <Layer
              id="offline-coast-line"
              type="line"
              paint={{
                "line-color": OFFLINE_COAST_COLOR,
                "line-width": 1,
              }}
            />
          </Source>
        )}

        {/* ranh giới VÙNG LỘNG (NĐ 26/2019, cho tàu 12–<15m) — THAM KHẢO, dữ
            liệu SDVico. Vẽ TRƯỚC ranh giới ngoài để cam-đỏ IUU luôn nổi trên.
            Màu teal + nét đứt, tách hẳn cam-đỏ độc quyền của ranh giới ngoài. */}
        {vungLongOn && (
          <Source id="vung-long" type="geojson" data={VUNG_LONG_DATA}>
            <Layer
              id="vung-long-fill"
              type="fill"
              paint={{ "fill-color": "#0d9488", "fill-opacity": 0.06 }}
            />
            <Layer
              id="vung-long-line"
              type="line"
              paint={{
                "line-color": "#0d9488",
                "line-width": 1.75,
                "line-dasharray": [3, 2],
                "line-opacity": 0.9,
              }}
            />
          </Source>
        )}

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

        {/* BÃO — vùng ảnh hưởng (polygon đỏ mờ) + đường đi (track gạch đứt) từ
            GDACS; tâm bão là Marker bên dưới. Cảnh báo trực quan kiểu app
            thời tiết chuyên nghiệp — "đừng ra khơi vùng đỏ". */}
        {stormGeo && (
          <Source id="storm-geo" type="geojson" data={stormGeo}>
            <Layer
              id="storm-area-fill"
              type="fill"
              filter={["==", ["get", "kind"], "area"]}
              paint={{ "fill-color": "#e4572e", "fill-opacity": 0.16 }}
            />
            <Layer
              id="storm-area-line"
              type="line"
              filter={["==", ["get", "kind"], "area"]}
              paint={{
                "line-color": "#e4572e",
                "line-width": 1.5,
                "line-opacity": 0.55,
              }}
            />
            <Layer
              id="storm-track-line"
              type="line"
              filter={["==", ["get", "kind"], "track"]}
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{
                "line-color": "#b42318",
                "line-width": 2.5,
                "line-dasharray": [2, 1.5],
              }}
            />
          </Source>
        )}

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
                    ? "text-[0.875rem] font-bold tracking-[0.18em]"
                    : "text-[0.8125rem] font-bold tracking-[0.06em]"
                }
              >
                {s.name}
              </div>
              {s.sub && (
                <div className="text-[0.6875rem] font-semibold italic">{s.sub}</div>
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
              <span className="mt-0.5 rounded bg-white/90 px-1.5 text-center text-[0.6875rem] font-bold leading-tight">
                {s.kindLabel} {s.name}
                {/* giờ của bản tin — vẽ từ bản lưu thì tâm bão có thể đã đi xa */}
                <span
                  className={`block font-bold ${
                    stormInfo.kind === "co-bao" && stormInfo.cu
                      ? "text-warn"
                      : "text-navy/70"
                  }`}
                >
                  {stormTimeLabel}
                </span>
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
        {showPlaces && places.map((pl) => (
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
              <span className="mt-0.5 max-w-[110px] truncate rounded bg-white/85 px-1.5 text-[0.625rem] font-bold leading-tight text-navy shadow-sm">
                {pl.name}
              </span>
            </span>
          </Marker>
        ))}

        {/* tuyến dẫn đường tiết kiệm dầu + điểm xuất phát */}
        <RouteMapLayers route={route} />

        {/* công cụ ĐO: đường nối 2 điểm + mốc số thứ tự */}
        {measurePts.length === 2 && (
          <Source
            id="measure-line"
            type="geojson"
            data={{
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: measurePts.map((p) => [p.lon, p.lat]),
              },
            }}
          >
            <Layer
              id="measure-line-l"
              type="line"
              paint={{
                "line-color": "#14324f",
                "line-width": 3,
                "line-dasharray": [2, 1.5],
              }}
            />
          </Source>
        )}
        {measurePts.map((p, i) => (
          <Marker
            key={`measure-${i}`}
            longitude={p.lon}
            latitude={p.lat}
            anchor="center"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-t1 text-[0.75rem] font-bold text-white shadow-md">
              {i + 1}
            </span>
          </Marker>
        ))}
        {/* nhãn khoảng cách NGAY GIỮA đường nối 1→2 */}
        {measurePts.length === 2 && measureResult && (
          <Marker
            longitude={(measurePts[0].lon + measurePts[1].lon) / 2}
            latitude={(measurePts[0].lat + measurePts[1].lat) / 2}
            anchor="center"
          >
            <span className="whitespace-nowrap rounded-full border border-white/80 bg-navy px-2.5 py-1 text-[0.8125rem] font-bold text-white shadow-md">
              {measureResult.dist}
            </span>
          </Marker>
        )}

        {/* điểm đang xem dự báo (ẩn nếu trùng một điểm đã ghim — đã có sao) */}
        {!currentPlace && (
          <Marker longitude={point.lon} latitude={point.lat} anchor="bottom">
            <PinIcon className="h-9 w-9 text-trim drop-shadow-[0_2px_3px_rgba(0,0,0,0.45)]" />
          </Marker>
        )}
      </MapGL>

      {/* ── VÙNG NỔI TRÊN CÙNG: tin bão (không gì che) + badge + FAB ──────── */}
      {/* Kéo sheet info lên (half/full) → TỰ ẨN tin bão + rail bên phải cho
          khỏi chồng chéo (user 2026-06-23: logic tự ẩn, không bắt click).
          Về peek thì hiện lại. */}
      <div
        className={`safe-pt pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 p-2 transition-opacity duration-200 ${
          size === "peek" ? "opacity-100" : "opacity-0 [&_*]:pointer-events-none"
        }`}
        aria-hidden={size !== "peek"}
      >
        <StormBanner variant="overlay" />
        {/* TẢI SẴN DỰ BÁO: tự chạy khi vào trang (không còn nút bấm), báo một
            dòng nhỏ rồi tự tắt — xem components/pretrip-auto-notify.tsx */}
        <PretripAutoNotify points={pretripPoints} />
        {/* ĐIỀU KHIỂN LỚP — rail phải + 4 panel (Phương án A); trong luồng dưới
            banner bão nên không đè/lệch */}
        <RaKhoiControls
          layerId={layerId}
          onLayer={setLayerId}
          scalarKind={scalarKind}
          onScalar={(k) => {
            setScalarKind(k);
            if (k != null) setLayerId("bathymetry");
          }}
          forecastKind={forecastKind}
          onForecast={(k) => {
            setForecastKind(k);
            if (k == null) setPlaying(false);
            else setGridFailed(false);
          }}
          vungLongOn={vungLongOn}
          onVungLong={setVungLongOn}
          fishOn={fishOn}
          onFish={setFishOn}
          fishSpecies={fishSpecies}
          fishLocked={fishLocked}
          species={fishCast?.species ?? []}
          regionShorts={regionShorts}
          onPickSpecies={setFishSpecies}
          fishRange={fishRange}
          onRange={setFishRange}
          stormInfo={stormInfo}
          showPlaces={showPlaces}
          onShowPlaces={setShowPlaces}
          places={places}
          onPlaces={setPlaces}
          onGoPlace={(lat, lon) => {
            setPinning(false);
            setSize("peek");
            goToCoord(lat, lon);
          }}
          measureMode={measureMode}
          onMeasureMode={toggleMeasure}
          measureCount={measurePts.length}
          measureResult={measureResult}
          onClearMeasure={() => setMeasurePts([])}
        />

        {/* KHÔNG có badge tuổi lớp cá (bỏ 2026-07-25 theo quyết định sản phẩm:
            màn hình bị rối vì quá nhiều chữ thường trực). Bản đồ cá vẫn tự lấy
            bản mới khi có sóng. */}

        {/* dự báo cá lỗi → nói thẳng + Thử lại (không phải "hôm nay không có cá") */}
        {!forecastKind && fishOn && !fishCast && fishFailed && (
          <button
            type="button"
            onClick={loadFish}
            className="pointer-events-auto inline-flex min-h-[3rem] items-center gap-2 self-start rounded-full bg-card/95 px-4 shadow-md transition active:scale-95"
          >
            <FishIcon className="h-5 w-5 shrink-0 text-danger" aria-hidden />
            <span className="text-[0.875rem] font-bold text-danger">
              Dự báo cá chưa tải được — chạm để thử lại
            </span>
          </button>
        )}

        {/* SỐ BIỂN CŨ / THIẾU NGUỒN → một dòng rồi tự tắt (5s). Chỉ hiện trong
            ca xấu: ảnh SST/phù du quá tuổi, hoặc chất lượng dữ liệu < 0,5 —
            xem lib/source-registry.ts (lowQualityNote). */}
        {fishOn && fishQualityNote && (
          <p
            role="status"
            className="pointer-events-none mx-auto flex w-fit max-w-[92%] items-center gap-1.5 rounded-full bg-warn-bg px-3 py-1.5 text-[0.875rem] font-bold leading-snug text-warn shadow-md"
          >
            <AlertIcon className="h-4 w-4 shrink-0" />
            {fishQualityNote}
          </p>
        )}

        {/* MẤT SÓNG → nói MỘT DÒNG rồi tự tắt (cùng kiểu chip với dòng "Đã lưu
            dự báo…" và banner bão): đủ để bà con biết nền là hình lưu trong
            máy, không phải app hỏng — rồi trả lại bản đồ, không nằm lì. */}
        {offlineNote && offlineNoteOn && (
          <p
            role="status"
            className="pointer-events-none mx-auto flex w-fit max-w-[92%] items-center gap-1.5 rounded-full bg-warn-bg px-3 py-1.5 text-[0.875rem] font-bold leading-snug text-warn shadow-md"
          >
            <AlertIcon className="h-4 w-4 shrink-0" />
            {offlineNote}
          </p>
        )}

      </div>

      {/* ── SHEET ĐÁY 3 NẤC — một chế độ duy nhất ────────────────────────── */}
      <SnapSheet
        size={size}
        onSizeChange={setSize}
        above={
          // thanh giờ gió/sóng XUỐNG ĐÁY kiểu Windy — tay với tới, không
          // chồng 4 tầng trên đầu bản đồ (roadmap hội đồng UX 2026-06-11)
          forecastKind ? (
            <div className="pointer-events-auto surface px-3 py-2 shadow-md">
              {fGrid ? (
                gridStripOpen ? (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[0.875rem] font-bold text-navy">
                        {forecastKind === "wind" ? "Gió" : "Sóng"} ·{" "}
                        {/* mốc "Hôm nay" so NGÀY THẬT, không so ngày đầu của
                            bản lưu — bản lưu mấy hôm trước từng nói dối ở đây */}
                        {timeLabelVN(fGrid.times[timeIdx] ?? "", todayIso)}
                        {fGrid.stale && (
                          <span className="ml-1 block font-bold text-warn">
                            Số cũ lưu trong máy
                            {fGrid.savedAt != null &&
                              ` — lưu lúc ${clockVN(fGrid.savedAt)}`}
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPlaying((p) => !p)}
                          aria-label={playing ? "Dừng chạy" : `Chạy thử ${gridDays} ngày`}
                          className="flex h-11 w-11 items-center justify-center rounded-full bg-navy text-white active:scale-95"
                        >
                          {playing ? (
                            <PauseIcon className="h-5 w-5" />
                          ) : (
                            <PlayIcon className="h-5 w-5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPlaying(false);
                            setGridStripOpen(false);
                          }}
                          aria-label="Ẩn thanh giờ"
                          className="flex h-11 w-9 items-center justify-center rounded-full text-navy active:scale-95"
                        >
                          <ChevronDownIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                    {/* chọn khung ngày cho lớp vẽ động (3/5/7/10/16) */}
                    <div
                      className="mt-1.5 flex gap-1.5"
                      role="group"
                      aria-label="Chọn khung ngày dự báo trên bản đồ"
                    >
                      {GRID_DAY_OPTIONS.map((d) => {
                        const on = d === gridDays;
                        return (
                          <button
                            key={d}
                            type="button"
                            onClick={() => {
                              if (d === gridDays) return;
                              setPlaying(false);
                              setTimeIdx(0);
                              setGridDays(d);
                            }}
                            aria-pressed={on}
                            className={`min-h-[2.25rem] flex-1 rounded-lg text-[0.8125rem] font-bold transition active:scale-[0.97] ${
                              on
                                ? "bg-navy text-white shadow-sm"
                                : "bg-field text-foreground/70"
                            }`}
                          >
                            {d} ngày
                          </button>
                        );
                      })}
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
                      className="range-big mt-1 w-full"
                    />
                    <div className="flex justify-between text-[0.6875rem] font-semibold text-foreground/65">
                      {gridTickLabels(gridDays).map((t, i) => (
                        <span key={i}>{t}</span>
                      ))}
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setGridStripOpen(true)}
                    className="flex w-full items-center justify-between gap-2"
                    aria-label="Hiện thanh giờ dự báo"
                  >
                    <span className="text-[0.875rem] font-bold text-navy">
                      {forecastKind === "wind" ? "Gió" : "Sóng"} ·{" "}
                      {timeLabelVN(
                        fGrid.times[timeIdx] ?? "",
                        fGrid.times[0]?.split("T")[0],
                      )}{" "}
                      · chạm để chọn giờ
                    </span>
                    <ChevronUpIcon className="h-5 w-5 shrink-0 text-navy" />
                  </button>
                )
              ) : gridFailed ? (
                /* KHÔNG mượn lưới của khung ngày khác nữa (xin 16 ngày mà đưa
                   lưới 3 ngày đã lưu, chip vẫn sáng "16 ngày"). Nói thật khung
                   nào đang có trong máy, chạm là đổi đúng khung đó. */
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[0.9375rem] font-bold leading-snug text-danger">
                      Chưa tải được khung {gridDays} ngày — máy chưa lưu khung
                      này.
                    </p>
                    <button
                      type="button"
                      onClick={() => setGridFailed(false)}
                      className="shrink-0 rounded-xl bg-navy px-4 py-2.5 text-[0.9375rem] font-bold text-white"
                    >
                      Thử lại
                    </button>
                  </div>
                  {savedDays.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[0.8125rem] font-semibold text-foreground/70">
                        Trong máy đang có:
                      </p>
                      <div className="mt-1 flex gap-1.5">
                        {savedDays.map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => {
                              setPlaying(false);
                              setTimeIdx(0);
                              setGridFailed(false);
                              setGridDays(d as GridDays);
                            }}
                            className="min-h-[2.75rem] flex-1 rounded-lg bg-field text-[0.9375rem] font-bold text-navy active:scale-[0.97]"
                          >
                            {d} ngày
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[0.8125rem] font-semibold text-foreground/70">
                  Đang tải dự báo cho cả vùng biển…
                </p>
              )}
            </div>
          ) : undefined
        }
        label="Gió sóng chỗ đang xem"
        peek={
          loading ? (
            <p className="py-3 text-[1rem] font-semibold text-foreground/70">
              Đang lấy dự báo sóng gió…
            </p>
          ) : errored ? (
            /* Máy CHỈ giữ số ở đúng chỗ đã xem — không mượn số chỗ khác nữa,
               nên chỗ lạ mà mất sóng thì nói thẳng là chưa có gì. */
            <p className="py-3 text-[1rem] font-bold leading-snug text-danger">
              Chỗ này chưa có số nào lưu trong máy — vuốt lên để thử lại.
            </p>
          ) : cond && !cond.onSea ? (
            <p className="py-3 text-[0.9375rem] font-semibold leading-snug text-foreground/75">
              Chỗ này trên đất liền — chạm ra biển để xem gió sóng.
            </p>
          ) : allPast ? (
            <p className="py-3 text-[1rem] font-bold leading-snug text-warn">
              Số lưu trong máy ở chỗ này đã qua ngày hết
              {cond?.savedAt != null && ` (lưu ${clockVN(cond.savedAt)})`}. Có
              sóng lại máy sẽ tự lấy số mới.
            </p>
          ) : sel ? (
            <div className="py-1">
              {cond?.stale &&
                (cond.source === "saved-grid" ? (
                  /* Số dựng từ LƯỚI gió/sóng đã lưu — đúng chỗ này, nhưng lưới
                     chỉ có gió với sóng. Nói thẳng phần còn thiếu. */
                  <p className="mb-2 rounded-xl bg-warn-bg px-3 py-2 text-[1.0625rem] font-bold leading-snug text-warn">
                    Số gió, sóng lấy từ bản đã lưu trong máy
                    {cond.savedAt != null && ` (lưu lúc ${clockVN(cond.savedAt)})`}
                    . Chưa có mưa, dông cho chỗ này.
                  </p>
                ) : (
                  <p className="mb-2 rounded-xl bg-warn-bg px-3 py-2 text-[1.0625rem] font-bold leading-snug text-warn">
                    Số cũ lưu trong máy
                    {cond.savedAt != null &&
                      ` — lưu lúc ${clockVN(cond.savedAt)} (${savedAgoLabel(cond.savedAt, nowMs)})`}
                    . Chưa phải số mới.
                  </p>
                ))}
              <div className="flex items-center gap-2">
                {/* Không đủ dữ liệu (bản từ lưới) thì KHÔNG chấm tình trạng
                    biển — chỉ nói ngày, số gió/sóng để ngay dưới. */}
                {sel.level && (
                  <>
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-full"
                      style={{ backgroundColor: LEVEL_STYLE[sel.level].fg }}
                      aria-hidden
                    />
                    <span
                      className="display text-[1.1875rem] font-bold leading-snug"
                      style={{ color: LEVEL_STYLE[sel.level].fg }}
                    >
                      {SEA_STATE[sel.level]}
                    </span>
                  </>
                )}
                <span
                  className={
                    sel.level
                      ? "text-[0.9375rem] font-semibold text-foreground/70"
                      : "display text-[1.1875rem] font-bold leading-snug text-navy"
                  }
                >
                  {sel.level
                    ? `— ${dayLabel(sel.date, todayIso).toLowerCase()}`
                    : dayLabel(sel.date, todayIso)}
                </span>
              </div>
              <p className="text-[0.9375rem] font-semibold leading-snug text-foreground/80">
                {condSummary}
              </p>
              <p className="text-[0.8125rem] leading-snug text-foreground/70">
                {whereLine}
              </p>
              {/* toạ độ điểm đang xem — luôn thấy ở peek, đọc vào máy định vị */}
              <p className="mt-0.5 text-[0.75rem] font-semibold tabular-nums leading-snug text-foreground/55">
                Toạ độ: {fmtCoordPair(point.lat, point.lon, prefs.coordFormat)}
              </p>
              {atHome && (
                <p className="mt-1 text-[0.875rem] font-semibold text-t1">
                  Chạm vào chỗ nào trên biển để xem gió sóng chỗ đó.
                </p>
              )}
              {prox.level !== "ok" && (
                <p className="mt-1 text-[0.875rem] font-bold text-danger">
                  {prox.label} — coi chừng vượt ranh giới.
                </p>
              )}
              {/* MỒI ngay ở peek (roadmap hội đồng UX): khách chạm trúng chỗ
                  có dấu hiệu cá thì nói thẳng vào sẽ được gì — không bắt mở
                  "Xem thêm" mới thấy lời mời */}
              {fishLocked && fishOn && fishAtPoint && fishAtPoint.s >= 60 && (
                <Link
                  href="/login"
                  className="mt-1 inline-flex min-h-[2.5rem] items-center gap-1 text-[0.9375rem] font-bold text-trim"
                >
                  Chỗ này có dấu hiệu cá — Đăng nhập để xem loài gì →
                </Link>
              )}
            </div>
          ) : null
        }
      >
        <div className="space-y-3">
          {/* cảnh báo ranh giới đầy đủ — chỉ khi đáng nói */}
          {prox.level !== "ok" && (
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[0.9375rem] font-semibold"
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
            <>
              <p className="rounded-xl bg-warn-bg px-3 py-2.5 text-[1rem] font-bold leading-snug text-warn">
                Lúc mất sóng, máy chỉ có số ở những chỗ bà con đã mở xem lúc còn
                sóng. Chạm lại đúng chỗ đó để coi.
              </p>
              <button
                type="button"
                onClick={() => setRetry((n) => n + 1)}
                className="min-h-[3.5rem] w-full rounded-xl bg-t1 text-[1.125rem] font-bold text-white transition active:scale-[0.99]"
              >
                Thử lại
              </button>
            </>
          )}

          {cond && cond.onSea && today && sel && (
            <>
              {/* chọn xem trước ngày nào — gió/sóng dự báo được tới 16 ngày
                  (dải cuộn ngang; độ tin theo tầm ngày + skill đo hiện ở dưới) */}
              <div
                className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
                role="group"
                aria-label="Chọn ngày xem dự báo"
              >
                {cond.days.map((d, i) => {
                  const active = i === selIdx;
                  // ngày đã qua (bản lưu trong máy) — mờ đi, không cho chọn
                  const past = isPastDay(d.date, todayIso);
                  return (
                    <button
                      key={d.date}
                      type="button"
                      onClick={() => setDayIdx(i)}
                      disabled={past}
                      aria-pressed={active}
                      className={`flex min-h-[3.75rem] min-w-[4.875rem] shrink-0 flex-col items-center justify-center rounded-xl px-2 transition active:scale-[0.97] ${
                        active
                          ? "bg-navy text-white shadow-sm"
                          : "bg-field"
                      } ${past ? "opacity-40" : ""}`}
                    >
                      <span
                        className={`text-[0.8125rem] font-bold leading-tight ${
                          active ? "text-white/85" : "text-foreground/70"
                        }`}
                      >
                        {chipLabel(d.date, todayIso)}
                      </span>
                      <span
                        className="display text-[1rem] font-bold leading-tight"
                        style={{
                          color: active
                            ? "#fff"
                            : d.level
                              ? LEVEL_STYLE[d.level].fg
                              : "var(--navy)",
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

              {/* MAX cả ngày đã chọn (giật) — peek phía trên đã có tình trạng
                  + tóm tắt, đây chỉ thêm số đỉnh để khỏi trùng (user: trùng dữ liệu) */}
              <p
                className="rounded-xl px-3 py-2.5 text-[0.9375rem] font-semibold leading-snug"
                style={{
                  // level null (bản dựng từ lưới) → nền trung tính, không tô
                  // xanh/đỏ như thể đã chấm được điểm đi biển
                  backgroundColor: sel.level
                    ? LEVEL_STYLE[sel.level].bg
                    : "var(--field)",
                  color: sel.level ? LEVEL_STYLE[sel.level].fg : "var(--navy)",
                }}
              >
                Cả ngày: sóng tới{" "}
                {sel.waveMaxM > 0
                  ? `${formatNumberVN(sel.waveMaxM)} m`
                  : "— (chưa có số)"}{" "}
                · gió tới cấp {beaufort(sel.windMaxKmh)}
                {sel.gustMaxKmh > 0 && `, giật cấp ${beaufort(sel.gustMaxKmh)}`}
              </p>

              {/* số đo LÚC NÀY — để LIỀN với dải ngày + "cả ngày" cho khỏi
                  nói sóng/gió trên một khúc, dưới một khúc (user 2026-06-23).
                  Ngày sau đã gọn trong thẻ ngày + "cả ngày" nên chỉ hiện hôm nay.
                  BẢN LƯU: hai số này đông cứng từ lúc lưu → đổi tiêu đề thành
                  "đo lúc …", tuyệt đối không để chữ "lúc này". */}
              {/* Bản dựng từ lưới KHÔNG có số đo "lúc này" (windKmh null) →
                  ẩn hẳn hai thẻ này, thà trống còn hơn hiện số bịa. */}
              {isToday && cond.windKmh != null && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="surface p-4">
                    <div className="flex items-center gap-2 text-t1">
                      <WindIcon className="h-5 w-5 shrink-0" />
                      <span className="text-[0.9375rem] font-bold leading-snug">
                        {cond.stale && cond.savedAt != null
                          ? `Gió đo lúc ${clockVN(cond.savedAt)}`
                          : "Gió lúc này"}
                      </span>
                    </div>
                    <p className="display mt-1.5 text-[1.5rem] font-bold leading-none text-navy">
                      Cấp {beaufort(cond.windKmh)}
                    </p>
                    <p className="mt-1 text-[0.875rem] leading-snug text-foreground/65">
                      {Math.round(cond.windKmh)} km/giờ
                      {cond.windDirDeg != null &&
                        ` · hướng ${windDirectionVN(cond.windDirDeg)}`}
                    </p>
                  </div>
                  <div className="surface p-4">
                    <div className="flex items-center gap-2 text-t1">
                      <WavesIcon className="h-5 w-5 shrink-0" />
                      <span className="text-[0.9375rem] font-bold leading-snug">
                        {cond.stale && cond.savedAt != null
                          ? `Sóng đo lúc ${clockVN(cond.savedAt)}`
                          : "Sóng lúc này"}
                      </span>
                    </div>
                    {cond.waveM != null ? (
                      <p className="display mt-1.5 text-[1.5rem] font-bold leading-none text-navy">
                        {formatNumberVN(cond.waveM)} m
                      </p>
                    ) : (
                      <p className="mt-1.5 text-[0.9375rem] leading-snug text-foreground/65">
                        Chỗ này sát bờ, chưa có số sóng — xem gió là chính.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* mưa/dông + độ tin — để LIỀN với sóng/gió (user 2026-06-23) */}
              {(() => {
                const w = weatherFromCode(sel.wmoCode);
                return (
                  w && (
                    <p
                      className={`rounded-xl px-4 py-3 text-[1rem] font-bold ${
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
              <p
                className={`px-1 text-[0.875rem] font-semibold leading-snug ${
                  confidence.tone === "ok" ? "text-foreground/70" : "text-warn"
                }`}
              >
                {confidence.label}. Chỉ để tham khảo — trước khi đi, nghe thêm
                đài duyên hải, Biên phòng.
              </p>

              {/* DỰ BÁO CÁ tại chỗ này — tính từ ảnh mới nhất; không có dữ liệu
                  thì lùi về mùa vụ. Luôn ghi rõ tham khảo.
                  TEASER: lớp cá hiện cho mọi người; CHI TIẾT điểm thì khoá,
                  chưa đăng nhập → mời đăng nhập (thu hút đăng ký). */}
              {fishLocked ? (
                <div className="surface overflow-hidden p-0">
                  <div className="flex items-start gap-2.5 p-3.5">
                    <FishIcon className="mt-0.5 h-5 w-5 shrink-0 text-trim" />
                    <p className="text-[0.9375rem] leading-snug text-foreground/80">
                      Vùng xanh trên bản đồ là <b>chỗ có khả năng nhiều cá</b>.{" "}
                      <b>Đăng nhập</b> để xem chỗ này{" "}
                      <b>loài gì, khả năng bao nhiêu, đi hướng nào</b> — và chọn
                      đúng loài bà con hay đánh.
                    </p>
                  </div>
                  <a
                    href="/login"
                    className="flex min-h-[3.25rem] w-full items-center justify-center gap-2 bg-t1 text-[1rem] font-bold text-white transition active:scale-[0.99]"
                  >
                    <FishIcon className="h-5 w-5" />
                    Đăng nhập để xem chi tiết dự báo cá
                  </a>
                </div>
              ) : fishCast && fishAtPoint ? (
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
                        <p className="text-[0.9375rem] leading-snug text-foreground/80">
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
                        <p className="text-[0.9375rem] leading-snug text-foreground/80">
                          <b>
                            Chỗ này có khả năng{" "}
                            {v >= 70 ? "TỐT" : v >= 50 ? "khá" : "vừa"}
                          </b>{" "}
                          cho: <b>{names.join(", ")}</b>
                        </p>
                        {/* CHỈ số môi trường tại ô — bỏ phần ngày ảnh/lấy về
                            (quyết định sản phẩm 2026-07-25: gọn màn hình) */}
                        <p className="mt-1 text-[0.875rem] font-semibold leading-snug text-foreground/65">
                          Nước {formatNumberVN(fishAtPoint.t)}°C
                          {bait ? ` · ${bait}` : ""}
                        </p>
                        {/* TRUNG THỰC: loài đáy/rạn dự báo theo mùa + độ sâu */}
                        {lowSig ? (
                          <p className="mt-1 text-[0.8125rem] leading-snug text-warn">
                            {selMeta?.category === "reef"
                              ? "Cá rạn"
                              : selMeta?.category === "crustacean"
                                ? "Tôm/ghẹ/cua sống đáy"
                                : "Cá đáy"}{" "}
                            — đoán theo <b>mùa vụ + độ sâu</b> ({selMeta?.depthBand}),
                            ảnh vệ tinh mặt biển ít chính xác cho loài này.
                          </p>
                        ) : (
                          <p className="mt-0.5 text-[0.8125rem] leading-snug text-foreground/70">
                            Vùng tô màu trên bản đồ là chỗ tương tự, hồng tâm là
                            chỗ nổi nhất. Tham khảo, không phải cam kết.
                          </p>
                        )}
                        {/* KÉO SANG NGÀY KHÁC: nói thật vì sao lớp cá KHÔNG đổi
                            theo thanh ngày. ĐÃ ĐO (scripts/fish-3day-probe.mjs,
                            3 mùa: 7/2026, 1/2026, 4/2026): kéo nhiệt tới +3 ngày
                            bằng xu hướng Copernicus chỉ làm 0,5–1,6 % số ô đổi
                            trạng thái điểm nóng (Jaccard 0,93–0,98, |Δđiểm| trung
                            bình 0,1–0,5/100) ⇒ KHÔNG dựng bản đồ cá theo từng
                            ngày (thanh trượt giả). Chỉ hiện khi bà con ĐÃ kéo
                            sang ngày khác — màn hình mặc định giữ gọn. */}
                        {daysAhead > 0 && (
                          <p className="mt-1 text-[0.8125rem] leading-snug text-foreground/70">
                            {daysAhead <= FISH_STABLE_DAYS
                              ? "Chỗ cá ít đổi trong vài ngày tới — cái đổi là gió, sóng."
                              : "Lớp cá vẫn là ảnh mới nhất, không phải dự báo riêng cho ngày này — xa ngày thì xem gió, sóng."}
                          </p>
                        )}
                        {/* ưu tiên gần mình: điểm cá gần chỗ đang xem nhất */}
                        {nearestHotspot && (
                          <p className="mt-1 text-[0.8125rem] font-semibold leading-snug text-t1">
                            {nearestHotspot.km <= 5.5
                              ? "Điểm cá nổi bật ngay chỗ bạn đang xem."
                              : `Điểm cá gần bạn nhất: ~${fmtDist(nearestHotspot.km, prefs.distUnit)} hướng ${nearestHotspot.dir} (khả năng ${
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
                  <p className="text-[0.9375rem] leading-snug text-foreground/80">
                    Hôm nay chỗ này <b>không nổi bật</b> trên ảnh vệ tinh — dò
                    các vùng xanh lá trên bản đồ. Mùa này vùng{" "}
                    <b>{fishRegion?.name}</b> thường có:{" "}
                    {fishHere.join(", ")}{" "}
                    <span className="text-foreground/70">(tham khảo)</span>
                  </p>
                </div>
              ) : fishHere.length > 0 ? (
                <div className="flex items-start gap-2.5 surface p-3.5">
                  <FishIcon className="mt-0.5 h-5 w-5 shrink-0 text-t3" />
                  <p className="text-[0.9375rem] leading-snug text-foreground/80">
                    Mùa này vùng <b>{fishRegion?.name}</b> thường có:{" "}
                    <b>{fishHere.join(", ")}</b>{" "}
                    <span className="text-foreground/70">
                      (mùa vụ nhiều năm — tham khảo)
                    </span>
                  </p>
                </div>
              ) : null}

              {/* tuần trăng đêm nay — cho nghề đèn (mực, cá cơm) */}
              <div className="flex items-start gap-2.5 surface p-3.5">
                <MoonIcon className="mt-0.5 h-5 w-5 shrink-0 text-navy/70" />
                <p className="text-[0.9375rem] leading-snug text-foreground/80">
                  <b>{moon.label}.</b> {moon.note}
                </p>
              </div>

              {/* nước cạn tại chỗ này — chỉ nói khi có chuyện */}
              {depthNote && (
                <p
                  className={`rounded-xl px-4 py-3 text-[1rem] font-bold ${
                    depthNote.danger
                      ? "bg-danger-bg text-danger"
                      : "bg-warn-bg text-warn"
                  }`}
                >
                  {depthNote.text}
                </p>
              )}

              {/* dẫn đường tiết kiệm dầu — hành động chính, để cao cho khỏi
                  cuộn mới thấy (audit flow #10); đổi đích KHÔNG remount —
                  panel tự dọn kết quả cũ, giữ thông số tàu */}
              <RoutePlanner
                dest={cond.point}
                activeRoute={route}
                places={places}
                onRoute={handleRoute}
              />


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
                  <span className="flex-1 text-[0.9375rem] font-bold text-navy">
                    Đã ghim: {currentPlace.name}
                  </span>
                  <span className="text-[0.8125rem] font-semibold text-foreground/60">
                    Sửa ở “Điểm đã lưu”
                  </span>
                </div>
              ) : pinning ? (
                <div className="surface p-3.5">
                  <p className="mb-2 text-[0.9375rem] font-bold text-navy">
                    Đặt tên cho chỗ này
                  </p>
                  <input
                    value={pinName}
                    onChange={(e) => setPinName(e.target.value)}
                    autoFocus
                    placeholder="Vd: Rạn ông Tư, chỗ câu mực…"
                    className="min-h-[3.25rem] w-full rounded-lg bg-field px-4 text-[1rem] font-semibold focus:outline-none"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPinning(false);
                        setPinName("");
                      }}
                      className="min-h-[3.25rem] flex-1 rounded-xl bg-field text-[1rem] font-bold text-navy"
                    >
                      Thôi
                    </button>
                    <button
                      type="button"
                      onClick={savePin}
                      className="min-h-[3.25rem] flex-1 rounded-xl bg-t1 text-[1rem] font-bold text-white"
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
                  className="flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-xl bg-field text-[1rem] font-bold text-navy transition active:scale-[0.99]"
                >
                  <StarIcon className="h-5 w-5" />
                  Ghim chỗ này để mở nhanh lần sau
                </button>
              )}
              {/* toạ độ đã chuyển lên peek (luôn thấy) — bỏ bản trùng ở đây */}
            </>
          )}
        </div>
      </SnapSheet>

      {/* Chọn loài + Điểm đã lưu nay là PANEL RAIL (RaKhoiControls), không còn
          bottom-sheet modal — đồng bộ kiểu popup với các lớp khác. */}
    </div>
  );
}
