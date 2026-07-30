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
import type { StyleSpecification } from "maplibre-gl";
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
  CURRENT_COLOR_EXPR,
  type GridDays,
  type ForecastGrid,
  type ForecastKind,
} from "@/lib/forecast-grid";
import { fishInRegion, regionAt } from "@/data/fish-seasons";
import {
  fetchFishForecast,
  SPECIES_META,
  FISH_LEVEL_BANDS,
  type FishForecast,
  type FishCell,
} from "@/lib/fish-predict";
import {
  fetchClimatology,
  blendFishCells,
  hotspotSpacingDeg,
  hotspotMaxCount,
  BLEND_USABLE,
  type Climatology,
} from "@/lib/fish-blend";
import { lowQualityNote } from "@/lib/source-registry";
import { moonPhase } from "@/lib/moon";
import { FREE_FORECAST_DAYS } from "@/lib/tier";
import { useFeatureAccess } from "@/lib/use-tier";
import { PremiumLock } from "@/components/premium-gate";
import { SDVICO_HOTLINE } from "@/data/sdvico-showcase";
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
import {
  fetchScalarField,
  scalarFieldFeatures,
  scalarGradientCss,
  SCALAR_META,
  SCALAR_RAMP,
  type FetchScalarKind,
  type ScalarGrid,
} from "@/lib/scalar-field";
import {
  fetchCurDepthGridClient,
  peekCurDepthGrid,
  type CurDepthClientGrid,
} from "@/lib/cur-depth";
import { CUR_DEPTH_TIERS, CUR_DEPTH_MAX_DAYS } from "@/lib/weather-snapshot-id";
import {
  legendStops,
  legendGradientCss,
  legendUnit,
} from "@/lib/forecast-grid";
import { TimeScrubber, type ScrubberLegend } from "@/components/time-scrubber";
import {
  createScalarFieldLayer,
  type ScalarFieldLayer,
} from "@/components/scalar-gl-field";
import { buildUVField } from "@/lib/particle-field";
import { WindParticles } from "@/components/wind-particles";
import { NavHud, NavBoatMarker } from "@/components/nav-mode";
import { useNavTracking } from "@/lib/use-nav-tracking";
import { computeNavProgress } from "@/lib/nav-progress";
import { borderGeoJSON } from "@/data/vn-maritime-border";
import { vungLongGeoJSON } from "@/data/vn-fishing-zones";
import {
  fetchPublicVmsZones,
  STATIC_VMS_ZONES,
  type VmsZone,
} from "@/lib/vms-zones";
import { borderProximity, haversineKm, type BorderLevel } from "@/lib/geofence";
import { fetchDepthGrid, depthClassAt, type DepthClass } from "@/lib/depth-grid";
import { weatherFromCode } from "@/lib/weather-codes";
import {
  useMapPrefs,
  fmtDist,
  fmtCoordPair,
  isVmsZoneOn,
} from "@/lib/map-prefs";
import { stormStatus } from "@/lib/storms";
import { useStormCheck } from "@/lib/use-storm-check";
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
  PretripSavedStatus,
} from "@/components/pretrip-auto-notify";
import {
  AlertIcon,
  FishIcon,
  HomeIcon,
  LockIcon,
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

// thanh giờ gió/sóng xổ ra mà 5s không thao tác → tự thu (user 2026-07-28)
const STRIP_AUTO_HIDE_MS = 5000;

/**
 * Số ngày mà "chỗ cá ít đổi" là câu ĐÃ ĐO ĐƯỢC, không phải câu nói cho vui.
 * scripts/fish-3day-probe.mjs dựng bản đồ cá cho D+1..D+3 bằng neo vệ tinh +
 * xu hướng nhiệt Copernicus (α cross-validated, src/data/copernicus-tendency-skill.json)
 * rồi so với bản hôm nay: chỉ 0,5–1,6 % số ô đổi trạng thái điểm nóng, Jaccard
 * 0,93–0,98 trên cả 3 mùa đã thử ⇒ lớp cá GIỮ MỘT BẢN, không tách theo ngày.
 * Xa hơn mốc này thì chưa đo ⇒ UI phải đổi giọng (xem chỗ dùng hằng số này).
 */
const FISH_STABLE_DAYS = 3;

// Điểm mặc định khi CHƯA ghim cảng nhà: ngoài khơi Nam Trung Bộ (trung tâm
// vùng đánh bắt) — đủ để thấy cả Hoàng Sa/Trường Sa, có sóng để xem ngay.
const DEFAULT_SEA_POINT: SeaPoint = { lat: 13.0, lon: 110.5 };

// LƯỚI KẺ Ô TOẠ ĐỘ (graticule) — phủ vùng biển VN gồm Hoàng Sa/Trường Sa.
// [lonMin, lonMax, latMin, latMax] + bước 1° (chuẩn hải đồ). KHÔNG liên quan cá.
const MAP_GRID_BOUNDS: [number, number, number, number] = [102, 119, 4, 24];
const MAP_GRID_STEP_DEG = 1;

// Lưới dự báo phủ ~102,5–117,25°Đ, 6–21,3°B (gridPoints). Khi có lớp động bật:
// khoá view NẰM GỌN TRONG vùng data (maxBounds đặt HƠI VÀO TRONG mép lưới) →
// màn hình LUÔN được field phủ kín, KHÔNG lộ mép hình chữ nhật / nền trống
// (user 2026-07-28). [[Tây, Nam], [Đông, Bắc]].
// Khung khi bật lớp dự báo — vừa là khung fitBounds lúc bật, vừa là maxBounds
// (chặn pan/zoom-out vượt data). Sát mép lưới data (98–123 / 1–24) để field phủ
// kín; chừa chút để không lộ mép. Vẫn cho zoom IN + move trong khung.
const LOCKED_BOUNDS: [[number, number], [number, number]] = [
  [97.3, 0.4],
  [123.7, 24.6],
];

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

/** Lớp bản đồ cho MỘT vùng biển VMS (admin quản lý) — vẽ theo style + màu.
    fill = nền mờ + viền; line = viền liền; line-dashed = viền nét đứt. */
function VmsZoneLayers({ zone }: { zone: VmsZone }) {
  const sid = `vms-${zone.id}`;
  return (
    <Source id={sid} type="geojson" data={zone.geojson}>
      {zone.style === "fill" && (
        <Layer
          id={`${sid}-fill`}
          type="fill"
          paint={{ "fill-color": zone.color, "fill-opacity": 0.1 }}
        />
      )}
      <Layer
        id={`${sid}-line`}
        type="line"
        layout={{ "line-join": "round" }}
        paint={{
          "line-color": zone.color,
          "line-width": zone.style === "line-dashed" ? 2.5 : 2,
          "line-opacity": 0.95,
          ...(zone.style === "line-dashed"
            ? { "line-dasharray": [2, 1.5] }
            : {}),
        }}
      />
    </Source>
  );
}

/** Cách nhau tối thiểu giữa hai lần làm mới do "có sóng lại" (mạng chập chờn) */
const ONLINE_REFRESH_GAP_MS = 2 * 60 * 1000;

export default function FishingMapView() {
  const mapRef = useRef<MapRef>(null);

  /** Có sóng lại → tăng, các effect tải dữ liệu nghe theo để LÀM MỚI (2026-07-29) */
  const [netEpoch, setNetEpoch] = useState(0);
  const lastNetRefreshRef = useRef(0);

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
  // Ranh giới vùng lộng bật/tắt qua map-prefs. VÙNG BIỂN VMS nay do admin quản
  // lý (bảng vms_zones): đọc từ DB, chưa cấu hình/lỗi → 3 vùng mặc định tĩnh.
  const [vmsZones, setVmsZones] = useState<VmsZone[]>(STATIC_VMS_ZONES);
  useEffect(() => {
    let alive = true;
    fetchPublicVmsZones().then((z) => {
      if (alive && z) setVmsZones(z); // null = fallback tĩnh, giữ nguyên
    });
    return () => {
      alive = false;
    };
  }, []);

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
  // Phân hạng PREMIUM (chủ dự án chốt 2026-07-26, THAY mô hình teaser 06-11):
  // dự báo cá + thời tiết quá 3 ngày KHOÁ HẲN với người chưa đăng nhập
  // ("login") và tài khoản thường ("upgrade" — gọi SDVICO nâng cấp). Demo mode
  // (chưa cấu hình Supabase) = mở hết; "checking" coi như chưa khoá để khỏi
  // nháy nhưng lớp cá chỉ TẢI khi chắc chắn "open". Chốt thật ở middleware.
  const { access: premiumAccess } = useFeatureAccess();
  const premiumLocked =
    premiumAccess === "login" || premiumAccess === "upgrade";
  const fishLocked = premiumLocked;

  const [fishCast, setFishCast] = useState<FishForecast | null>(null);
  // loài đang lọc trên bản đồ (null = loài tốt nhất mỗi ô)
  const [fishSpecies, setFishSpecies] = useState<string | null>(null);
  // lỗi tải dự báo cá phải LÊN TIẾNG — không để nút Cá lặng lẽ biến mất
  // còn người dùng tưởng "hôm nay không có cá"
  const [fishFailed, setFishFailed] = useState(false);
  /* Bản đồ cá dựng từ ảnh CŨ thì phải nói MỘT DÒNG rồi tự tắt — không badge
     thường trực (màn hình phải gọn), nhưng cũng không im lặng hứa "hôm nay" khi
     ảnh đã cũ. CHỈ chuyện ảnh cũ: cảnh báo "thiếu vài nguồn" đã bỏ (chủ dự án
     2026-07-27, bà con không cần biết). Luật + chữ ở lib/source-registry.ts. */
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
  // lớp cá CHỈ tải khi chắc chắn được xem ("open" = premium/demo) — người bị
  // khoá không gọi API (middleware cũng sẽ chặn 401/403); đăng xuất / tụt hạng
  // giữa chừng thì dọn dữ liệu đã tải cho khỏi lộ qua heatmap cũ.
  useEffect(() => {
    if (premiumAccess === "open") loadFish();
    // netEpoch: có sóng lại → kéo bản đồ cá mới (không phải chờ mở lại app)
  }, [premiumAccess, loadFish, netEpoch]);
  /* BẢN ĐỒ MÙA VỤ — asset tĩnh cùng origin (~71 KB), service worker giữ sẵn nên
     giữa biển vẫn có. Dùng để pha trộn lớp cá cho NGÀY XA (xem lib/fish-blend.ts).
     Không bao giờ ném: hỏng → null → lớp cá giữ nguyên bản ảnh mới nhất. */
  const [clim, setClim] = useState<Climatology | null>(null);
  useEffect(() => {
    if (premiumAccess !== "open") return;
    let alive = true;
    fetchClimatology().then((c) => {
      if (alive) setClim(c);
    });
    return () => {
      alive = false;
    };
  }, [premiumAccess]);
  useEffect(() => {
    if (premiumLocked) {
      setFishCast(null);
      setFishFailed(false);
    }
  }, [premiumLocked]);
  const [size, setSize] = useState<SheetSize>("peek");

  // ── dự báo vẽ động kiểu Windy: lớp gió/sóng + thanh thời gian ───────────
  const [forecastKind, setForecastKind] = useState<ForecastKind | null>(null);
  const [fGrid, setFGrid] = useState<ForecastGrid | null>(null);
  const [gridFailed, setGridFailed] = useState(false);
  // DÒNG CHẢY THEO TẦNG (user 2026-07-29): 0 = mặt (lưới SMOC theo giờ),
  // 50/150/300 = lưới NGÀY Copernicus. Chip chọn tầng nằm dưới thanh ngày.
  const [curDepthTier, setCurDepthTier] = useState(0);
  const [depthGrid, setDepthGrid] = useState<CurDepthClientGrid | null>(null);
  // Lớp DẢI MÀU vô hướng (mây/mưa/nhiệt) — loại trừ lẫn nhau với gió/sóng (một
  // lớp overlay mỗi lần, như Windy). Dùng chung thanh giờ + khung ngày + timeIdx.
  const [overlayField, setOverlayField] = useState<FetchScalarKind | null>(null);
  const [sfGrid, setSfGrid] = useState<ScalarGrid | null>(null);
  const [timeIdx, setTimeIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  // khung ngày lớp vẽ động (3/5/7/10/16) — bà con tự chọn tầm xa/gần
  const [gridDays, setGridDays] = useState<GridDays>(3);
  // chạm khung ngày bị khoá (premium) → nói lý do một dòng ngay dưới hàng nút
  const [dayLockNote, setDayLockNote] = useState(false);
  // (BỎ 2026-07-29) state "khung nào đang có trong máy" + khối mời đổi khung:
  // lib nay TỰ mượn khung ngắn hơn (localStorage rồi snapshot) nên còn bản nào
  // là đã dùng — tới nhánh lỗi nghĩa là KHÔNG CÒN GÌ, chẳng có gì để mời.

  // TẦM NGÀY TỰ ĐẶT THEO HẠNG (bỏ chip chọn khung, user 2026-07-28): premium =
  // 16 ngày, thường = 3 ngày (FREE_FORECAST_DAYS). Bà con cuộn dải ngày để xem
  // xa/gần; hạng tụt (đăng xuất) thì tự kéo về 3.
  useEffect(() => {
    const target = (premiumLocked ? FREE_FORECAST_DAYS : 16) as GridDays;
    if (gridDays !== target) {
      setPlaying(false);
      setTimeIdx(0);
      setGridDays(target);
    }
  }, [premiumLocked, gridDays]);

  // Bấm khung ngày (3/5/7/10/16) → khi lưới MỚI về, nhảy thanh giờ tới NGÀY
  // CUỐI của khung (bấm "10 ngày" = xem luôn gió ~ngày 10, kéo lùi để về gần).
  // Lưới tải bất đồng bộ nên đặt cờ lúc bấm, áp lúc grid sẵn sàng. Lần mở lớp
  // đầu tiên KHÔNG bật cờ → giữ "Bây giờ".
  const jumpEndRef = useRef(false);

  // MỌI lớp dải màu đều có HẠT BAY theo gió (user 2026-07-29: hạt mặc định chạy
  // trong tất cả layer) → lớp màu nào bật cũng cần lưới gió fGrid.
  const scalarWantsStreaks = !!overlayField;

  // tải lưới GIÓ/SÓNG — LUÔN tải (2026-07-29): hạt bay theo gió chạy mặc định
  // ở MỌI chế độ, kể cả hải đồ + ngư trường. Gió lỗi khi không ở lớp gió/sóng
  // → chỉ mất hạt, KHÔNG làm hỏng gì (không set gridFailed).
  useEffect(() => {
    if (forecastKind && gridFailed) return;
    let alive = true;
    if (forecastKind) setFGrid(null); // "đang tải" cho strip gió/sóng
    // lớp Dòng chảy cần lưới CÓ số dòng chảy — bản lưu/snapshot đời cũ thiếu
    // trường này thì lib tự bỏ qua nấc đó và kéo bản mới
    fetchForecastGrid(gridDays, { needCurrent: forecastKind === "current" })
      .then((g) => {
        if (!alive) return;
        setFGrid(g);
        if (jumpEndRef.current) {
          setTimeIdx(Math.max(0, g.times.length - 1)); // (B) xem luôn ngày cuối
          jumpEndRef.current = false;
        }
      })
      .catch(() => {
        if (alive && forecastKind) setGridFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [forecastKind, gridFailed, gridDays, netEpoch]);

  // TẦNG SÂU: rời lớp Dòng chảy là về Mặt; chọn tầng >0 thì tải lưới NGÀY của
  // tầng đó (free 3 ngày / premium 10 — lib + route tự chặn). Lỗi → gridFailed
  // (dòng báo lỗi chung của thanh giờ).
  useEffect(() => {
    if (forecastKind !== "current" && curDepthTier !== 0) setCurDepthTier(0);
  }, [forecastKind, curDepthTier]);
  useEffect(() => {
    if (forecastKind !== "current" || curDepthTier === 0 || gridFailed) {
      setDepthGrid(null);
      return;
    }
    let alive = true;
    const days = premiumLocked ? 3 : CUR_DEPTH_MAX_DAYS;
    // KHÔNG nháy trống nếu tầng này đã có sẵn (RAM/máy) — hiện ngay bản cũ rồi
    // làm mới nền (hết giật khi đổi qua lại Mặt/50/150/300).
    const warm = peekCurDepthGrid(curDepthTier, days);
    setDepthGrid(warm);
    fetchCurDepthGridClient(curDepthTier, days)
      .then((g) => {
        if (alive) setDepthGrid(g);
      })
      .catch(() => {
        // đã có bản cũ hiện thì GIỮ (đừng nhảy sang lỗi); chưa có mới báo lỗi
        if (alive && !warm) setGridFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [forecastKind, curDepthTier, gridFailed, premiumLocked, netEpoch]);

  // Lưới đang cấp số cho LỚP forecastKind: tầng sâu thì thay fGrid bằng lưới
  // ngày của tầng (fGrid vẫn tải để hạt gió nền + tra điểm dùng)
  const kindGrid: ForecastGrid | null =
    forecastKind === "current" && curDepthTier !== 0 ? depthGrid : fGrid;

  // tải lưới DẢI MÀU khi bật lớp mây/mưa/nhiệt, hoặc khi đổi khung ngày. Cùng
  // luật offline/fallback với forecast-grid (lib tự lo). Lỗi → dùng chung
  // gridFailed để thanh giờ báo thật.
  useEffect(() => {
    if (!overlayField || gridFailed) return;
    let alive = true;
    setSfGrid(null);
    fetchScalarField(overlayField, gridDays)
      .then((g) => {
        if (!alive) return;
        setSfGrid(g);
        if (jumpEndRef.current) {
          setTimeIdx(Math.max(0, g.times.length - 1));
          jumpEndRef.current = false;
        }
      })
      .catch(() => alive && setGridFailed(true));
    return () => {
      alive = false;
    };
  }, [overlayField, gridFailed, gridDays, netEpoch]);

  // Lưới đang điều khiển thanh giờ: gió/sóng/dòng chảy (kể cả tầng sâu) HOẶC
  // dải màu (loại trừ nhau)
  const stripGrid: { times: string[]; stale?: boolean; savedAt?: number | null } | null =
    forecastKind ? kindGrid : overlayField ? sfGrid : null;
  // overlayOn = có thanh giờ (gió/sóng/mây/mưa/nhiệt). SSHA (nước dâng/xoáy) là
  // raster tĩnh, KHÔNG có thanh giờ nên không tính ở đây.
  const overlayOn = !!forecastKind || !!overlayField;
  // LUẬT HIỂN THỊ (user 2026-07-28): chỉ HẢI ĐỒ + CÁ được hiện cùng lúc. Bật
  // BẤT KỲ lớp động nào (gió/sóng/mây/mưa/nhiệt + nước dâng/xoáy) → ẩn hải đồ
  // nền + ẩn cá, chỉ còn 1 lớp đó. Các lớp động loại trừ lẫn nhau (handler dưới).
  const anyExclusiveOverlay = !!forecastKind || !!overlayField || !!scalarKind;

  // NHỐT KHUNG khi bật lớp dự báo — setMaxBounds imperative + RE-APPLY sau MỖI
  // 'styledata' (đổi lớp gọi setStyle → maplibre reset maxBounds; prop của
  // react-map-gl cũng không giữ nổi qua setStyle → phải tự găm lại, user
  // 2026-07-29 đã bắt được maxBounds "không chạy" 2 lần vì vụ này).
  const fitOnceRef = useRef(false);
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const apply = () => {
      if (anyExclusiveOverlay) {
        map.setMaxBounds(LOCKED_BOUNDS);
        if (!fitOnceRef.current) {
          fitOnceRef.current = true;
          map.fitBounds(LOCKED_BOUNDS, { padding: 0, duration: 350 });
        }
      } else {
        fitOnceRef.current = false;
        map.setMaxBounds(null);
      }
    };
    apply();
    map.on("styledata", apply);
    return () => {
      map.off("styledata", apply);
    };
  }, [anyExclusiveOverlay]);

  // nút chạy ▶ — tự trượt thời gian như Windy (theo lưới đang bật)
  useEffect(() => {
    if (!playing || !stripGrid?.times.length) return;
    const len = stripGrid.times.length;
    const t = setInterval(() => setTimeIdx((i) => (i + 1) % len), 800);
    return () => clearInterval(t);
  }, [playing, stripGrid]);

  // HẠT BAY animated (kiểu Windy) — MẶC ĐỊNH CHẠY trong MỌI layer (user
  // 2026-07-29, bỏ cổng reduced-motion): gió/lớp màu theo giờ bay theo HƯỚNG
  // GIÓ, lớp SÓNG bay theo HƯỚNG SÓNG (hạt khác nhau); độ mặn (theo ngày) lấy
  // gió hiện tại (mốc 0). Trường u/v bilinear từ cùng lưới fGrid.
  const particleField = useMemo(() => {
    if (forecastKind)
      return kindGrid ? buildUVField(kindGrid, timeIdx, forecastKind) : null;
    if (!fGrid) return null;
    if (overlayField && overlayField !== "salinity")
      return buildUVField(fGrid, timeIdx, "wind");
    // hải đồ / ngư trường / độ mặn: hạt gió HIỆN TẠI (mốc 0) chạy nền
    return buildUVField(fGrid, 0, "wind");
  }, [forecastKind, overlayField, fGrid, kindGrid, timeIdx]);

  // Mũi tên TĨNH: lớp GIÓ/SÓNG luôn hiện mũi tên MÀU kèm hạt (user 2026-07-29:
  // kéo trục ngày nhìn mũi tên là thấy đổi hướng ngay — hạt đổi chậm hơn).
  // Các lớp màu khác: chỉ là fallback khi không dựng được trường hạt.
  const arrows = useMemo(() => {
    if (forecastKind)
      return kindGrid ? arrowFeatures(kindGrid, timeIdx, forecastKind) : null;
    if (!fGrid) return null;
    if (scalarWantsStreaks && !particleField)
      return arrowFeatures(fGrid, timeIdx, "wind");
    return null;
  }, [forecastKind, scalarWantsStreaks, particleField, fGrid, kindGrid, timeIdx]);

  // NỀN MÀU lớp GIÓ/SÓNG (mô hình Windy, user 2026-07-29): speed/độ cao từ
  // CHÍNH fGrid → ScalarGrid render-only, đi chung pipeline dải màu. Kích thước
  // lưới tự suy (bản lưu cỡ cũ vẫn chạy).
  const windScalarGrid = useMemo<ScalarGrid | null>(() => {
    if (!forecastKind || !kindGrid?.cells?.length) return null;
    const cells = kindGrid.cells;
    let nLon = 1;
    while (nLon < cells.length && cells[nLon].lat === cells[0].lat) nLon++;
    const nLat = Math.floor(cells.length / nLon);
    if (nLat < 2 || nLon < 2 || nLat * nLon !== cells.length) return null;
    return {
      kind:
        forecastKind === "wind"
          ? "windspeed"
          : forecastKind === "wave"
            ? "waveheight"
            : "currentspeed",
      times: kindGrid.times,
      nLat,
      nLon,
      // TẦNG SÂU: ô null = đáy NÔNG hơn tầng (biển thật, không bị lớp bờ che)
      // → cấm lan màu vào đó (fillCoastalGaps) — vùng nông phải trống thật
      noFill: forecastKind === "current" && curDepthTier !== 0,
      cells: cells.map((c) => ({
        lat: c.lat,
        lon: c.lon,
        values: c.hours.map((h) =>
          forecastKind === "wind"
            ? (h?.windKmh ?? null)
            : forecastKind === "wave"
              ? (h?.waveM ?? null)
              : (h?.curKmh ?? null),
        ),
      })),
    };
  }, [forecastKind, kindGrid, curDepthTier]);

  // Lưới dải màu ĐANG HIỂN THỊ: lớp màu chọn tay HOẶC nền màu gió/sóng
  const activeScalarGrid = overlayField ? sfGrid : windScalarGrid;

  // ── LỚP WEBGL NỀN MÀU MỊN (thay polygon khối) ──────────────────────────
  // Custom layer WebGL: nạp lưới → texture, GPU nội suy bilinear → mượt. Xử lý
  // MapLibre setStyle XOÁ custom-layer: nghe 'styledata' để tự thêm lại.
  // glOk=true → TẮT polygon fill (GL mịn đứng một mình — đúng chất Windy);
  // GL hỏng (máy yếu/WebGL lỗi) → polygon fill là fallback.
  const glFieldRef = useRef<ScalarFieldLayer | null>(null);
  const [glOk, setGlOk] = useState(false);
  const GL_FIELD_ID = "scalar-gl-field";
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const ensure = () => {
      if (!map.isStyleLoaded()) return;
      const has = !!map.getLayer(GL_FIELD_ID);
      if (activeScalarGrid) {
        if (!has) {
          const layer = createScalarFieldLayer(GL_FIELD_ID);
          glFieldRef.current = layer;
          try {
            // chèn DƯỚI lớp bờ/đất (nếu đã có) — bờ + viền phải nổi trên màu
            map.addLayer(
              layer,
              map.getLayer("overlay-coast-fill") ? "overlay-coast-fill" : undefined,
            );
            setGlOk(true);
          } catch {
            setGlOk(false); // style chưa sẵn — 'styledata' sẽ thử lại
          }
        }
        glFieldRef.current?.setField(activeScalarGrid, timeIdx);
      } else if (has) {
        map.removeLayer(GL_FIELD_ID);
        glFieldRef.current = null;
      }
      // glOk TỰ LÀNH: suy từ SỰ HIỆN DIỆN THẬT của layer sau mỗi lần ensure —
      // một lần addLayer trượt (style đang nạp) không được găm polygon fallback
      // vĩnh viễn (2026-07-29: production từng dính ô vuông thô vì kẹt false).
      setGlOk(!!map.getLayer(GL_FIELD_ID));
    };
    ensure();
    map.on("styledata", ensure);
    map.on("load", ensure);
    return () => {
      map.off("styledata", ensure);
      map.off("load", ensure);
    };
  }, [activeScalarGrid, timeIdx]);

  // ô tô màu polygon — CHỈ là fallback khi lớp GL mịn không chạy (glOk=false).
  // Độ mặn lưới mịn sẵn (1/3°) → factor 1; còn lại nội suy ×5.
  const scalarFC = useMemo(
    () =>
      activeScalarGrid && !glOk
        ? scalarFieldFeatures(
            activeScalarGrid,
            timeIdx,
            activeScalarGrid.kind === "salinity" ? 1 : 5,
          )
        : null,
    [activeScalarGrid, glOk, timeIdx],
  );

  // Chú giải thanh cường độ cho lớp đang bật (gió/sóng km/h·m · mây/mưa/nhiệt)
  const stripLegend: ScrubberLegend | null = useMemo(() => {
    if (forecastKind) {
      return {
        title:
          forecastKind === "wind"
            ? "Sức gió"
            : forecastKind === "wave"
              ? "Độ cao"
              : "Dòng chảy",
        unit: legendUnit(forecastKind),
        gradient: legendGradientCss(forecastKind),
        ticks: legendStops(forecastKind).map((s) => s.value),
      };
    }
    if (overlayField) {
      return {
        title: SCALAR_META[overlayField].label,
        unit: SCALAR_META[overlayField].unit,
        gradient: scalarGradientCss(overlayField),
        ticks: SCALAR_RAMP[overlayField].map((s) => s.value),
      };
    }
    return null;
  }, [forecastKind, overlayField]);

  // tiêu đề thanh giờ: gió/sóng giữ tên ngắn, dải màu lấy nhãn của lớp
  const overlayTitle = forecastKind
    ? forecastKind === "wind"
      ? "Gió"
      : forecastKind === "wave"
        ? "Sóng"
        : curDepthTier === 0
          ? "Dòng chảy"
          : `Dòng chảy ~${curDepthTier} m`
    : overlayField
      ? SCALAR_META[overlayField].label
      : "";


  // BƯỚC LƯỚI (độ): suy từ khoảng cách nhỏ nhất giữa các vĩ độ ô — để vẽ ô
  // vuông phủ đúng một ô lưới SST (~0,25°), không phụ thuộc hằng số cứng.
  const fishGridStep = useMemo(() => {
    const cells = fishCast?.cells;
    if (!cells?.length) return 0.25;
    const lats = [...new Set(cells.map((c) => c.lat))].sort((a, b) => a - b);
    let step = Infinity;
    for (let i = 1; i < lats.length; i++) {
      const d = lats[i] - lats[i - 1];
      if (d > 1e-4 && d < step) step = d;
    }
    return Number.isFinite(step) ? step : 0.25;
  }, [fishCast]);

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


  // LƯỚI KẺ Ô TOẠ ĐỘ (graticule) — kinh/vĩ tuyến mỗi 1° phủ vùng biển VN, KHÔNG
  // liên quan dự báo cá. Bật/tắt ở panel Cài đặt (prefs.mapGrid). Tĩnh nên tính
  // một lần. Nhãn số độ để riêng lớp symbol.
  const mapGridGeo = useMemo<GeoJSON.FeatureCollection>(() => {
    const [lonMin, lonMax, latMin, latMax] = MAP_GRID_BOUNDS;
    const features: GeoJSON.Feature[] = [];
    for (let lon = lonMin; lon <= lonMax; lon += MAP_GRID_STEP_DEG) {
      features.push({
        type: "Feature",
        properties: { deg: `${lon}°Đ` },
        geometry: {
          type: "LineString",
          coordinates: [
            [lon, latMin],
            [lon, latMax],
          ],
        },
      });
    }
    for (let lat = latMin; lat <= latMax; lat += MAP_GRID_STEP_DEG) {
      features.push({
        type: "Feature",
        properties: { deg: `${lat}°B` },
        geometry: {
          type: "LineString",
          coordinates: [
            [lonMin, lat],
            [lonMax, lat],
          ],
        },
      });
    }
    return { type: "FeatureCollection", features };
  }, []);
  // Hiện điểm đã lưu trên bản đồ (panel Điểm đã lưu — Phương án A)
  const [showPlaces, setShowPlaces] = useState(true);
  // thanh giờ Windy (gió/sóng) cho thu/mở — đỡ chiếm mép sheet (user 2026-06-23).
  // MẶC ĐỊNH THU GỌN (user 2026-07-28): chạm dòng "chạm để chọn giờ" mới xổ;
  // xổ rồi mà 5s không thao tác (và không đang chạy ▶) thì TỰ thu lại.
  const [gridStripOpen, setGridStripOpen] = useState(false);
  const stripHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armStripHide = useCallback(() => {
    if (stripHideTimer.current) clearTimeout(stripHideTimer.current);
    stripHideTimer.current = setTimeout(
      () => setGridStripOpen(false),
      STRIP_AUTO_HIDE_MS,
    );
  }, []);
  useEffect(() => {
    if (!gridStripOpen || playing) {
      // đang chạy ▶ = đang coi, không giật thanh khỏi tay; dừng thì đếm lại
      if (stripHideTimer.current) clearTimeout(stripHideTimer.current);
      return;
    }
    armStripHide(); // nạp lại khi kéo giờ / đổi khung ngày (một "thao tác")
    return () => {
      if (stripHideTimer.current) clearTimeout(stripHideTimer.current);
    };
  }, [gridStripOpen, playing, timeIdx, gridDays, armStripHide]);
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
  // Hỏi tin bão + TỰ THỬ LẠI (có sóng lại / mở lại app / định kỳ / hỏng thì
  // thử nhanh). KHÔNG được gọi một lần rồi thôi — xem lib/use-storm-check.ts.
  const { check: stormCheck } = useStormCheck();
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
  // DẪN ĐƯỜNG LIVE: tuyến đang chạy theo (bám tuyến + theo dõi GPS). null = tắt
  const [navMode, setNavMode] = useState<PlannedRoute | null>(null);
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
    // có sóng lại thì cho nền thật một cơ hội mới (xoá số ô trượt cũ) VÀ kéo lại
    // các lớp đang bật (2026-07-29: netEpoch nằm trong deps của effect tải lưới
    // gió/sóng, lớp dải màu, bản đồ cá — số cũ tự được làm mới, không phải chờ
    // bà con bấm). Cửa chặn ONLINE_REFRESH_GAP_MS chống mạng chập chờn.
    const back = () => {
      setNetOnline(true);
      setBasemapFails(0);
      const now = Date.now();
      if (now - lastNetRefreshRef.current >= ONLINE_REFRESH_GAP_MS) {
        lastNetRefreshRef.current = now;
        setNetEpoch((n) => n + 1);
      }
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

  // ── DẪN ĐƯỜNG LIVE ────────────────────────────────────────────────────
  // Theo dõi GPS khi đang dẫn đường; tính tiến trình bám tuyến; camera bám tàu.
  const tracking = useNavTracking(navMode != null);
  const navProgress = useMemo(
    () =>
      navMode && tracking.pos
        ? computeNavProgress({
            pos: tracking.pos,
            headingDeg: tracking.headingDeg,
            speedKmh: tracking.speedKmh,
            waypoints: navMode.plan.waypoints,
          })
        : null,
    [navMode, tracking.pos, tracking.headingDeg, tracking.speedKmh],
  );

  // camera bám vị trí tàu mỗi khi có fix mới (chỉ khi định vị còn tốt — mất
  // định vị thì GIỮ NGUYÊN khung, không giật camera theo vị trí cũ)
  useEffect(() => {
    if (navMode && tracking.pos && tracking.status === "tracking") {
      flyToPoint(tracking.pos.lon, tracking.pos.lat);
    }
  }, [navMode, tracking.pos, tracking.status, flyToPoint]);

  const startNav = useCallback(
    (r: PlannedRoute) => {
      setNavMode(r);
      setRoute(r); // đảm bảo tuyến đang vẽ đúng tuyến đang dẫn
      setSize("peek"); // để bản đồ + HUD lộ tối đa
    },
    [setSize],
  );
  const stopNav = useCallback(() => setNavMode(null), []);

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
      // lớp động đang bật → nền HẢI ĐỒ ĐỘ SÂU (trung tính) thay cho lớp nền màu
      // (SST/phù du) đang chọn: lớp dự báo chỉ phủ vùng VN, phần NGOÀI vùng phủ
      // để hải đồ che cho đẹp (không trống), mà không chồng 2 lớp màu rối mắt.
      buildMapStyle(anyExclusiveOverlay ? "bathymetry" : layerId, new Date(), {
        seamarks: seamarksOn,
      }) as unknown as StyleSpecification,
    [layerId, seamarksOn, anyExclusiveOverlay],
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

  // ĐANG DÙNG SỐ CŨ → TỰ THỬ LẠI, không bắt bà con ngồi nhìn cảnh báo
  // (user 2026-07-29: "sao nó không tự kéo lại?"). Kích khi: quay lại tab ·
  // có mạng lại · hoặc mỗi RETRY_STALE_MS. Cửa chặn cùng mốc cho cả ba để
  // KHÔNG dội nguồn đang 429 (Open-Meteo tính quota theo IP từng máy).
  const staleNow = (!!cond?.stale || errored) && !loading;
  const lastTryRef = useRef(0);
  useEffect(() => {
    if (!staleNow) return;
    const RETRY_STALE_MS = 5 * 60 * 1000;
    const tryAgain = () => {
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      if (Date.now() - lastTryRef.current < RETRY_STALE_MS) return;
      lastTryRef.current = Date.now();
      setRetry((n) => n + 1);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") tryAgain();
    };
    const t = setInterval(tryAgain, RETRY_STALE_MS);
    window.addEventListener("online", tryAgain);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      window.removeEventListener("online", tryAgain);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [staleNow]);

  // Thẻ "số cũ trong máy" (mất mạng → dùng bản đã lưu) TỰ ẨN sau NOTIFY_HIDE_MS
  // như mấy chip khác — trước là hộp vàng nằm lì che bản đồ. Effect chạy lại
  // khi CHỖ/tuổi bản lưu đổi, nên vẫn stale thì không nhấp nháy báo lại.
  const staleSig = cond?.stale ? `${cond.source ?? ""}:${cond.savedAt ?? ""}` : null;
  const [staleNoteOn, setStaleNoteOn] = useState(false);
  useEffect(() => {
    if (!staleSig) {
      setStaleNoteOn(false);
      return;
    }
    setStaleNoteOn(true);
    const t = setTimeout(() => setStaleNoteOn(false), NOTIFY_HIDE_MS);
    return () => clearTimeout(t);
  }, [staleSig]);

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
  // PREMIUM: ngày cách hôm nay ≥3 (ngày thứ 4 trở đi) khoá với người chưa
  // premium — đo theo NGÀY THẬT (daysBetweenISO), không theo vị trí mảng
  // (bản lưu offline có thể chứa ngày đã qua).
  const dayChipLocked = (dateIso: string) =>
    premiumLocked &&
    daysBetweenISO(todayIso, dateIso) >= FREE_FORECAST_DAYS;
  const rawSelIdx = allPast
    ? -1
    : Math.min(Math.max(dayIdx, Math.max(firstUsableIdx, 0)), days.length - 1);
  // đang đứng ở ngày bị khoá (vừa đăng xuất / bản lưu cũ) → lùi về ngày còn mở
  const selIdx =
    rawSelIdx >= 0 && days[rawSelIdx] && dayChipLocked(days[rawSelIdx].date)
      ? (() => {
          for (let i = rawSelIdx; i >= 0; i--) {
            if (!dayChipLocked(days[i].date) && !isPastDay(days[i].date, todayIso))
              return i;
          }
          return Math.max(firstUsableIdx, 0);
        })()
      : rawSelIdx;
  const sel = selIdx >= 0 ? (days[selIdx] ?? null) : null;
  // TẦM NGÀY THẬT: đếm từ hôm nay tới ngày đang xem, KHÔNG lấy vị trí trong
  // mảng — bản lưu 5 ngày trước mà tính theo vị trí thì ngày xa vẫn được gắn
  // nhãn "khá sát" (sai theo hướng lạc quan, đúng chỗ nguy hiểm nhất).
  const daysAhead = sel ? Math.max(0, daysBetweenISO(todayIso, sel.date)) : 0;

  /* ── LỚP CÁ THEO NGÀY ĐANG XEM ────────────────────────────────────────────
     Ảnh vệ tinh chỉ nói được vài ngày đầu; ngày xa thì trộn với BẢN ĐỒ MÙA VỤ
     (điều kiện điển hình của tháng, dựng từ 6 năm lịch sử) theo tỷ lệ w(d) ĐO
     ĐƯỢC bằng backtest — xem lib/fish-blend.ts + docs/app-map/09 §5d.
     · Hôm nay (d=0) → y hệt trước: đúng ảnh mới nhất, không pha.
     · Thiếu bản mùa vụ / bảng w suy biến → giữ nguyên fishCast (bất biến
       monotonic: mất nguồn thì bớt thông tin, KHÔNG bịa).
     Điểm từng LOÀI giữ TỈ LỆ với điểm "Mọi loài" (mùa vụ chỉ có một lớp chung:
     nó nói vùng này tháng này nhìn chung tốt cỡ nào, còn loài nào trội hơn loài
     nào thì theo ảnh mới nhất). */
  const fishView = useMemo<FishForecast | null>(() => {
    if (!fishCast) return null;
    if (daysAhead <= 0 || !clim || !BLEND_USABLE) return fishCast;
    const month = Number((sel?.date ?? todayIso).slice(5, 7));
    if (!Number.isFinite(month) || month < 1 || month > 12) return fishCast;
    // v2: quy điểm mùa vụ về ĐÚNG thang bản đồ ngày (phân vị) rồi pha trên HỢP
    // hai tập ô — bản v1 chỉ chạy trên danh sách ô của ảnh nên mùa vụ chỉ biết
    // kéo xuống, KHÔNG bao giờ đẻ được vị trí mới (đo: 0 ô mới ở mọi tầm).
    const cells = blendFishCells(fishCast.cells, clim, month, daysAhead);
    return { ...fishCast, cells };
  }, [fishCast, clim, daysAhead, sel?.date, todayIso]);

  // Ô MÀU DỰ BÁO CÁ (ngư trường) — mỗi ô SST tô theo mức Thấp/TB/Cao (kiểu bản
  // tin Viện Hải sản), CHỈ MÀU không in số. Thuộc LỚP "CÁ" ở rail (fishOn) —
  // KHÁC với lưới kẻ ô toạ độ (prefs.mapGrid) không liên quan cá. Vẫn khoá
  // premium: fishCast = null khi chưa mở khoá. Sàn = ngưỡng mức Thấp.
  const fishGridGeo = useMemo<GeoJSON.FeatureCollection | null>(() => {
    // LUẬT: cá KHÔNG hiện cùng lớp động (gió/sóng/mây/…) — chỉ hiện cùng hải đồ
    if (!fishOn || !fishView || anyExclusiveOverlay) return null;
    const lo = FISH_LEVEL_BANDS[0].min; // sàn = ngưỡng mức Thấp; hiện đủ 3 mức
    const h = fishGridStep / 2;
    const features: GeoJSON.Feature[] = [];
    for (const c of fishView.cells) {
      const v = fishSpecies ? (c.sp?.[fishSpecies] ?? 0) : c.s;
      if (v < lo) continue;
      const r = Math.round(v);
      const x0 = c.lon - h;
      const x1 = c.lon + h;
      const y0 = c.lat - h;
      const y1 = c.lat + h;
      features.push({
        type: "Feature",
        properties: { s: r },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [x0, y0],
              [x1, y0],
              [x1, y1],
              [x0, y1],
              [x0, y0],
            ],
          ],
        },
      });
    }
    return { type: "FeatureCollection", features };
  }, [fishOn, fishView, fishSpecies, fishGridStep, anyExclusiveOverlay]);

  // điểm NÓNG (hồng tâm chạm-là-tới): ô điểm cao, cách nhau ≥0.7° cho khỏi
  // chùm, tối đa 8. ƯU TIÊN KHU VỰC GẦN MÌNH: cộng điểm thưởng cho ô gần chỗ
  // đang xem / cảng nhà / điểm ghim (chỗ bà con hay đánh) — không bịa điểm cá,
  // chỉ xếp chỗ gần lên trước khi điểm xấp xỉ nhau.
  const fishHotspots = useMemo<
    { lat: number; lon: number; v: number; top: string[]; near: boolean }[]
  >(() => {
    // ẩn hồng tâm cá khi có lớp động (cùng luật với lưới cá)
    if (!fishOn || !fishView || anyExclusiveOverlay) return [];
    // các "mỏ neo gần mình": điểm đang xem + cảng nhà + điểm ghim
    const anchors: { lat: number; lon: number }[] = [
      { lat: point.lat, lon: point.lon },
      ...places.map((p) => ({ lat: p.lat, lon: p.lon })),
    ];
    const nearestKm = (lat: number, lon: number) =>
      Math.min(...anchors.map((a) => haversineKm(a.lat, a.lon, lat, lon)));
    const scored = fishView.cells
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
    // TẦM NGÀY CÀNG XA, MỘT HỒNG TÂM = MỘT VÙNG CÀNG RỘNG. Đo thật
    // (scripts/fish-spread-probe.mjs): ô đích danh số 1 lệch 88 km ở ngày 1
    // nhưng 507 km từ ngày 16, trong khi TRỌNG TÂM CỤM chỉ lệch 62 → 249 km.
    // Chỉ đích danh một ô ở ngày xa là nói dối; nới khoảng cách + bớt chấm thì
    // mỗi hồng tâm đại diện đúng độ không chắc thật. Ngày 0 giữ y như cũ.
    const spacing = hotspotSpacingDeg(daysAhead);
    const maxCount = hotspotMaxCount(daysAhead);
    const picked: typeof scored = [];
    for (const c of scored) {
      if (picked.length >= maxCount) break;
      const clash = picked.some(
        (p) =>
          Math.max(Math.abs(p.lat - c.lat), Math.abs(p.lon - c.lon)) < spacing,
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
  }, [fishOn, fishView, fishSpecies, point, places, daysAhead, anyExclusiveOverlay]);

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


  // dự báo cá tại điểm đang xem — ô gần nhất trong ~0.3°, THEO NGÀY ĐANG XEM
  // (fishView đã pha mùa vụ cho ngày xa; hôm nay = đúng ảnh mới nhất)
  const fishAtPoint = useMemo<FishCell | null>(() => {
    if (!fishView) return null;
    let best: FishCell | null = null;
    let bd = Infinity;
    for (const c of fishView.cells) {
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
  }, [fishView, point]);

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
        // KHUNG khi có lớp dự báo (user 2026-07-28): VẪN cho zoom IN + move
        // TRONG khung, chỉ CHẶN zoom-out/pan VƯỢT khung phủ data (minZoom +
        // maxBounds). fitBounds ở effect ghim khung lúc bật lớp.
        minZoom={anyExclusiveOverlay ? 4 : 2}
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

        {/* VÙNG BIỂN VMS (admin quản lý — bảng vms_zones, 2026-07-28) — THAM
            KHẢO. Danh sách + màu + style do admin đặt ở /quan-tri; mỗi vùng có
            toggle riêng trong panel Cài đặt (mặc định theo defaultOn). Vẽ TRƯỚC
            vùng lộng + để cam-đỏ IUU (nếu có) nổi trên. */}
        {vmsZones.map((zone) =>
          isVmsZoneOn(prefs.vmsOverrides, zone.id, zone.defaultOn) ? (
            <VmsZoneLayers key={zone.id} zone={zone} />
          ) : null,
        )}

        {/* ranh giới VÙNG LỘNG (NĐ 26/2019, cho tàu 12–<15m) — THAM KHẢO, dữ
            liệu SDVico. Màu teal + nét đứt, tách hẳn cam-đỏ ranh giới ngoài. */}
        {prefs.vungLong && (
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

        {/* Đường ranh giới 75 điểm cũ (cam-đỏ nét đứt) ĐÃ XÓA khỏi bản đồ
            (user chốt 2026-07-28: "biên giới mới = đường 1+2+3" = hợp 3 vùng
            VMS ở trên). LƯU Ý: dữ liệu VN_MARITIME_BORDER + geofence cảnh báo
            IUU (borderProximity) VẪN CÒN trong code — chỉ bỏ phần VẼ, cảnh báo
            khoảng cách tới ranh giới không bị ảnh hưởng. */}

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

        {/* LƯỚI KẺ Ô TOẠ ĐỘ (graticule) — kinh/vĩ tuyến mỗi 1°, KHÔNG liên quan
            dự báo cá. Bật/tắt ở panel Cài đặt (prefs.mapGrid). Vẽ dưới mọi lớp
            dữ liệu để không che số. */}
        {prefs.mapGrid && (
          <Source id="map-grid" type="geojson" data={mapGridGeo}>
            <Layer
              id="map-grid-line"
              type="line"
              paint={{
                "line-color": "#334155",
                "line-width": 0.5,
                "line-opacity": 0.35,
              }}
            />
            <Layer
              id="map-grid-label"
              type="symbol"
              minzoom={5}
              layout={{
                "text-field": ["get", "deg"] as unknown as string,
                "text-font": ["Noto Sans Bold"],
                "text-size": 11,
                "symbol-placement": "line",
                "text-allow-overlap": false,
              }}
              paint={{
                "text-color": "#334155",
                "text-halo-color": "#ffffff",
                "text-halo-width": 1.2,
                "text-opacity": 0.7,
              }}
            />
          </Source>
        )}

        {/* DỰ BÁO CÁ — LƯỚI Ô kiểu bản tin ngư trường: mỗi ô vuông tô theo 3
            MỨC CỐ ĐỊNH (Thấp vàng / Trung bình xanh lá / Cao đỏ —
            FISH_LEVEL_BANDS), quy ước màu KHÔNG đổi theo loài cho đỡ rối. Chọn
            loài chỉ đổi mức (điểm theo loài). CHỈ MÀU, không in số (user
            2026-07-27: zoom lên chỉ cần màu). Thuộc lớp Cá. */}
        {fishGridGeo && (
          <Source id="fish-grid" type="geojson" data={fishGridGeo}>
            <Layer
              id="fish-grid-fill"
              type="fill"
              paint={{
                // bậc màu theo ngưỡng dưới của từng mức (< mid = Thấp, …)
                "fill-color": [
                  "step",
                  ["get", "s"],
                  FISH_LEVEL_BANDS[0].color,
                  FISH_LEVEL_BANDS[1].min,
                  FISH_LEVEL_BANDS[1].color,
                  FISH_LEVEL_BANDS[2].min,
                  FISH_LEVEL_BANDS[2].color,
                ] as unknown as string,
                "fill-opacity": 0.6,
              }}
            />
            <Layer
              id="fish-grid-line"
              type="line"
              paint={{
                // viền ô trắng mảnh — tách ô rõ như lưới bản tin ngư trường
                "line-color": "#ffffff",
                "line-width": 0.6,
                "line-opacity": 0.5,
              }}
            />
          </Source>
        )}

        {/* lớp DẢI MÀU vô hướng (mây/mưa/nhiệt) — ô nội suy tô rgba sẵn (alpha
            trong màu), vẽ DƯỚI mũi tên/nhãn/bão để không che thông tin quan trọng */}
        {scalarFC && (
          <Source id="scalar-field" type="geojson" data={scalarFC}>
            <Layer
              id="scalar-field-fill"
              type="fill"
              paint={{
                "fill-color": ["get", "color"] as unknown as string,
                "fill-antialias": false,
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
                // gió/sóng tô theo độ lớn; streak trên lớp màu tô TRẮNG DỊU (chỉ
                // hướng gió, không tranh màu với dải màu bên dưới — kiểu Windy)
                "line-color": (forecastKind === "wind"
                  ? WIND_COLOR_EXPR
                  : forecastKind === "wave"
                    ? WAVE_COLOR_EXPR
                    : forecastKind === "current"
                      ? CURRENT_COLOR_EXPR
                      : "rgba(255,255,255,0.6)") as unknown as string,
                "line-width": forecastKind ? 2.5 : 1.6,
              }}
            />
          </Source>
        )}

        {/* BỜ + ĐẤT LÊN TRÊN lớp màu khi bật lớp động (user 2026-07-29: màu che
            hết bờ, không thấy đâu là đất/đảo). Đúng thứ tự Windy: nền màu →
            hạt → ĐƯỜNG BỜ → nhãn. Lớp GL chèn DƯỚI lớp này (beforeId). */}
        {anyExclusiveOverlay && (
          <Source id="overlay-coast" type="geojson" data={COAST_DATA_URL}>
            <Layer
              id="overlay-coast-fill"
              type="fill"
              paint={{
                "fill-color": OFFLINE_LAND_COLOR,
                "fill-opacity": 0.9,
              }}
            />
            <Layer
              id="overlay-coast-line"
              type="line"
              paint={{
                "line-color": OFFLINE_COAST_COLOR,
                "line-width": 1.2,
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

        {/* DẪN ĐƯỜNG LIVE: chấm tàu + mũi tên hướng (mờ khi mất định vị) */}
        {navMode && (
          <NavBoatMarker
            pos={tracking.pos}
            headingDeg={tracking.headingDeg}
            stale={tracking.status === "lost"}
          />
        )}

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

      {/* HẠT BAY animated kiểu Windy — canvas overlay TRÊN bản đồ + lớp màu
          (z-10, dưới UI z-20), hạt trắng không bị nền màu che (user 2026-07-29).
          Gió/lớp màu bay theo hướng gió, lớp sóng theo hướng sóng. */}
      <WindParticles
        mapRef={mapRef}
        field={particleField}
        variant={
          // dòng chảy dùng vệt dày kiểu sóng — đọc là "nước đang trôi"
          forecastKind === "wave" || forecastKind === "current"
            ? "wave"
            : forecastKind || (overlayField && overlayField !== "salinity")
              ? "wind"
              : "ambient"
        }
      />

      {/* ── VÙNG NỔI TRÊN CÙNG: tin bão (không gì che) + badge + FAB ──────── */}
      {/* Kéo sheet info lên (half/full) → TỰ ẨN tin bão + rail bên phải cho
          khỏi chồng chéo (user 2026-06-23: logic tự ẩn, không bắt click).
          Về peek thì hiện lại. */}
      <div
        className={`safe-pt pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 p-2 transition-opacity duration-200 ${
          size === "peek" || navMode
            ? "opacity-100"
            : "opacity-0 [&_*]:pointer-events-none"
        }`}
        aria-hidden={size !== "peek" && !navMode}
      >
        <StormBanner variant="overlay" />
        {/* DẪN ĐƯỜNG LIVE: thẻ HUD LUÔN hiện khi đang dẫn đường (kể cả kéo sheet
            lên) — dưới banner bão. Gợi ý lái + quãng/giờ còn lại + nút Dừng. */}
        {navMode && (
          <NavHud
            progress={navProgress}
            status={tracking.status}
            onStop={stopNav}
          />
        )}
        {/* TẢI SẴN DỰ BÁO: tự chạy khi vào trang (không còn nút bấm), báo một
            dòng nhỏ rồi tự tắt — xem components/pretrip-auto-notify.tsx */}
        <PretripAutoNotify points={pretripPoints} />
        {/* ĐIỀU KHIỂN LỚP — rail phải + 4 panel (Phương án A); trong luồng dưới
            banner bão nên không đè/lệch */}
        <RaKhoiControls
          onLocateMe={goToMyBoat}
          locating={locating}
          geoError={geoError}
          layerId={layerId}
          onLayer={(id) => {
            // chọn hải đồ nền = về nhóm "hải đồ + cá" → tắt mọi lớp động
            setForecastKind(null);
            setOverlayField(null);
            setScalarKind(null);
            setPlaying(false);
            setLayerId(id);
          }}
          scalarKind={scalarKind}
          onScalar={(k) => {
            setScalarKind(k);
            if (k != null) {
              // SSHA là lớp động → loại trừ gió/sóng/dải màu (cá ẩn theo luật render)
              setForecastKind(null);
              setOverlayField(null);
              setPlaying(false);
              setLayerId("bathymetry");
            }
          }}
          forecastKind={forecastKind}
          onForecast={(k) => {
            setForecastKind(k);
            if (k == null) setPlaying(false);
            else {
              // một lớp động mỗi lần: tắt dải màu + SSHA
              setOverlayField(null);
              setScalarKind(null);
              setGridFailed(false);
              setTimeIdx(0);
            }
          }}
          overlayField={overlayField}
          onOverlayField={(k) => {
            setOverlayField(k);
            if (k == null) setPlaying(false);
            else {
              setForecastKind(null); // tắt gió/sóng + SSHA
              setScalarKind(null);
              setGridFailed(false);
              setTimeIdx(0);
            }
          }}
          vmsZones={vmsZones}
          fishOn={fishOn}
          onFish={(on) => {
            // bật cá = về nhóm "hải đồ + cá" → tắt mọi lớp động cho cá hiện ra
            if (on) {
              setForecastKind(null);
              setOverlayField(null);
              setScalarKind(null);
              setPlaying(false);
            }
            setFishOn(on);
          }}
          fishSpecies={fishSpecies}
          fishAccess={premiumAccess}
          species={fishCast?.species ?? []}
          regionShorts={regionShorts}
          onPickSpecies={setFishSpecies}
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

        {/* dự báo cá lỗi ("chưa tải được — chạm thử lại") ĐÃ DỜI xuống slot
            `above` của sheet, xếp NGAY TRÊN nhãn "đã lưu dự báo…" cho khỏi trôi
            nổi góc trái bản đồ (user 2026-07-26) */}

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

      {/* CHÚ GIẢI NGƯ TRƯỜNG — nổi sát MÉP TRÁI bản đồ, chỉ khi lớp Cá đang
          hiện lưới màu (user 2026-07-27: cho ra ngoài bản đồ cho dễ nhìn, khỏi
          mở panel). Tự mờ khi kéo sheet lên như rail phải. */}
      {fishGridGeo && (
        <div
          className={`pointer-events-none absolute left-2 top-1/2 z-20 -translate-y-1/2 transition-opacity duration-200 ${
            size === "peek" ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden={size !== "peek"}
        >
          <div className="flex flex-col gap-1.5 rounded-xl bg-card/90 px-2.5 py-2 shadow-md">
            {FISH_LEVEL_BANDS.map((b) => (
              <span key={b.key} className="flex items-center gap-1.5">
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-sm"
                  style={{ background: b.color }}
                  aria-hidden
                />
                <span className="text-[0.8125rem] font-bold text-navy">
                  {b.label}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── SHEET ĐÁY 3 NẤC — một chế độ duy nhất ────────────────────────── */}
      <SnapSheet
        size={size}
        onSizeChange={setSize}
        above={
          overlayOn || size === "peek" ? (
            <div className="flex flex-col gap-2">
              {/* Nhãn nhỏ "trong máy đã có dự báo tới đâu" — liếc là biết đã sẵn
                  sàng ra khơi chưa. Chỉ ở nấc peek để khỏi rối lúc mở sheet đọc
                  chi tiết; căn phải, nằm ngay trên box biển động. Dòng lỗi dự báo
                  cá (nếu có) xếp NGAY TRÊN nhãn này. */}
              {size === "peek" && (
                <div className="flex flex-col items-end gap-2">
                  {!overlayOn && fishOn && !fishCast && fishFailed && (
                    <button
                      type="button"
                      onClick={loadFish}
                      className="pointer-events-auto inline-flex min-h-[3rem] items-center gap-2 rounded-full bg-card/95 px-4 shadow-md transition active:scale-95"
                    >
                      <FishIcon
                        className="h-5 w-5 shrink-0 text-danger"
                        aria-hidden
                      />
                      <span className="text-[0.875rem] font-bold text-danger">
                        Dự báo cá chưa tải được — chạm để thử lại
                      </span>
                    </button>
                  )}
                  <PretripSavedStatus
                    points={pretripPoints}
                    fishLocked={fishLocked}
                  />
                </div>
              )}
              {/* thanh giờ gió/sóng/mây/mưa/nhiệt XUỐNG ĐÁY kiểu Windy — tay với
                  tới, không chồng 4 tầng trên đầu bản đồ (roadmap UX 2026-06-11) */}
              {overlayOn && (
                <div className="pointer-events-auto glass px-3 py-1.5">
              {/* THANH ĐỘ SÂU (user 2026-07-29) — chỉ lớp Dòng chảy: Mặt (SMOC
                  theo giờ) · 50/150/300 m (Copernicus theo NGÀY). Nằm NGOÀI
                  nhánh stripGrid để lúc đang tải / lỗi vẫn đổi tầng được. Nhãn
                  cùng khuôn 1 dòng. Vùng nông hơn tầng thì bản đồ trống thật. */}
              {forecastKind === "current" && (
                <div
                  className="mb-1 flex items-center gap-1.5"
                  role="group"
                  aria-label="Chọn tầng sâu dòng chảy"
                >
                  {CUR_DEPTH_TIERS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        if (curDepthTier === t) return;
                        setPlaying(false);
                        setTimeIdx(0);
                        setGridFailed(false);
                        setCurDepthTier(t);
                      }}
                      className={`h-9 flex-1 rounded-lg text-[0.8125rem] font-bold active:scale-95 ${
                        curDepthTier === t
                          ? "bg-navy text-white"
                          : "bg-field text-navy"
                      }`}
                    >
                      {t === 0 ? "Mặt" : `${t} m`}
                    </button>
                  ))}
                </div>
              )}
              {/* LUÔN HIỆN khi mở lớp (kiểu Windy) — bỏ thu gọn/auto-hide; strip
                  gọn: 1 dòng tiêu đề + play, rồi dải ngày + thanh dải màu (user
                  2026-07-28). Thanh dải màu KHÔNG bao giờ ẩn khi lớp đang bật. */}
              {stripGrid ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[0.8125rem] font-bold leading-tight text-navy">
                      {overlayTitle} ·{" "}
                      {/* mốc "Hôm nay" so NGÀY THẬT, không so ngày đầu bản lưu */}
                      {timeLabelVN(stripGrid.times[timeIdx] ?? "", todayIso)}
                      {/* bỏ dòng "Số cũ lưu trong máy" trên strip cho gọn (user
                          2026-07-28) — trạng thái bản lưu vẫn hiện ở sheet điểm */}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPlaying((p) => !p)}
                      aria-label={playing ? "Dừng chạy" : "Chạy thử"}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-white active:scale-95"
                    >
                      {playing ? (
                        <PauseIcon className="h-4 w-4" />
                      ) : (
                        <PlayIcon className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {/* dải ngày + nấc giờ + THANH DẢI MÀU (luôn hiện) */}
                  {stripLegend && (
                    <TimeScrubber
                      times={stripGrid.times}
                      timeIdx={timeIdx}
                      onSeek={(i) => {
                        setPlaying(false);
                        setTimeIdx(i);
                      }}
                      legend={stripLegend}
                      todayIso={todayIso}
                    />
                  )}
                </>
              ) : gridFailed ? (
                /* 2026-07-29: từ khi có lưới an toàn 5 tầng (live → bản lưu đúng
                   khung → snapshot đúng khung → bản lưu khung NGẮN hơn → snapshot
                   khung ngắn hơn), tới được đây nghĩa là KHÔNG CÒN GÌ CẢ — nói
                   đúng nguyên nhân đó, đừng đổ cho "chưa lưu khung này" (câu cũ
                   của luật cấm-mượn-khung, nay sai). Khối "Trong máy đang có:
                   [3 ngày]" cũng BỎ: có bản nào thì code đã tự dùng rồi. */
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[0.9375rem] font-bold leading-snug text-danger">
                    Chưa lấy được dự báo cả vùng biển — máy chưa có bản nào và
                    nguồn đang không cho tải.
                  </p>
                  <button
                    type="button"
                    onClick={() => setGridFailed(false)}
                    className="shrink-0 rounded-xl bg-navy px-4 py-2.5 text-[0.9375rem] font-bold text-white"
                  >
                    Thử lại
                  </button>
                </div>
              ) : (
                <p className="text-[0.8125rem] font-semibold text-foreground/70">
                  Đang tải dự báo cho cả vùng biển…
                </p>
              )}
                </div>
              )}
            </div>
          ) : undefined
        }
        label="Gió sóng chỗ đang xem"
        peek={
          // Bật lớp dự báo + đang ở nấc PEEK (strip hiện ở trên) → ẨN panel biển
          // động cho gọn. Vuốt LÊN (half/full) thì panel + chip ngày HIỆN LẠI đầy
          // đủ (user 2026-07-28: đừng mất phần liên quan khi mở ra).
          overlayOn && size === "peek" ? null : loading ? (
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
              {/* Thẻ "số cũ trong máy" TỰ ẨN sau vài giây (staleNoteOn) + chip
                  nhỏ gọn — trước là hộp vàng to nằm lì che mất bản đồ. Vẫn nói
                  thật một lần rồi trả lại tầm nhìn (an toàn nhưng không cản). */}
              {cond?.stale &&
                staleNoteOn &&
                (cond.source === "saved-grid" ? (
                  <p className="mb-1.5 flex items-center gap-1.5 rounded-full bg-warn-bg px-2.5 py-1.5 text-[0.8125rem] font-bold leading-snug text-warn">
                    <AlertIcon className="h-4 w-4 shrink-0" />
                    <span>
                      Số gió, sóng lấy từ bản đã lưu
                      {cond.savedAt != null &&
                        ` (lưu lúc ${clockVN(cond.savedAt)})`}
                      . Chưa có mưa, dông chỗ này.
                    </span>
                  </p>
                ) : (
                  <p className="mb-1.5 flex items-center gap-1.5 rounded-full bg-warn-bg px-2.5 py-1.5 text-[0.8125rem] font-bold leading-snug text-warn">
                    <AlertIcon className="h-4 w-4 shrink-0" />
                    <span>
                      Số cũ trong máy
                      {cond.savedAt != null &&
                        ` (${savedAgoLabel(cond.savedAt, nowMs)})`}
                      . Chưa phải số mới.
                    </span>
                  </p>
                ))}
              {/* Tiêu đề + tóm tắt = CỘT TRÁI; nơi đang xem + toạ độ = CỘT PHẢI
                  → hai cột xếp cạnh nhau, "Sóng tới…" nằm SÁT dưới "Biển động…"
                  (không bị khối phải 2 dòng đẩy xuống). */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {/* Không đủ dữ liệu (bản từ lưới) thì KHÔNG chấm tình trạng
                      biển — chỉ nói ngày, số gió/sóng để ngay dưới. */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
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
                    {/* KHÔNG lặp nhãn ngày ở tiêu đề — đã có trong ô chọn ngày
                        (chip đang chọn). Chỉ khi bản dựng từ lưới (không chấm
                        được tình trạng biển) mới lấy tên ngày làm tiêu đề. */}
                    {!sel.level && (
                      <span className="display text-[1.1875rem] font-bold leading-snug text-navy">
                        {dayLabel(sel.date, todayIso)}
                      </span>
                    )}
                  </div>
                  <p className="text-[0.9375rem] font-semibold leading-snug text-foreground/80">
                    {condSummary}
                  </p>
                </div>
                {/* nơi đang xem + toạ độ XẾP CHỒNG ở góc phải — gộp hai dòng vào
                    một góc, bớt một hàng cho panel gọn (user 2026-07-28) */}
                <div className="flex shrink-0 flex-col items-end text-right">
                  <span className="text-[0.8125rem] leading-snug text-foreground/70">
                    {whereLine}
                  </span>
                  <span className="whitespace-nowrap text-[0.75rem] font-semibold tabular-nums leading-snug text-foreground/55">
                    {fmtCoordPair(point.lat, point.lon, prefs.coordFormat)}
                  </span>
                </div>
              </div>
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
              {/* LỜI MỜI ngay ở peek: lớp cá giờ khoá hẳn (không còn teaser
                  heatmap) nên không có "dấu hiệu cá" để chỉ — nói thẳng dự báo
                  cá mở bằng gì, theo đúng nấc của người đang xem */}
              {fishLocked && fishOn && (
                premiumAccess === "login" ? (
                  <Link
                    href="/login"
                    className="mt-1 inline-flex min-h-[2.5rem] items-center gap-1 text-[0.9375rem] font-bold text-trim"
                  >
                    Dự báo cá cần tài khoản nâng cao — Đăng nhập →
                  </Link>
                ) : (
                  <a
                    href={`tel:${SDVICO_HOTLINE}`}
                    className="mt-1 inline-flex min-h-[2.5rem] items-center gap-1 text-[0.9375rem] font-bold text-trim"
                  >
                    Dự báo cá là tính năng nâng cao — Gọi SDVICO →
                  </a>
                )
              )}
              {/* THANH NGÀY hiện luôn ở peek (mặc định), không đợi nở sheet —
                  chọn xem trước ngày nào, gió/sóng dự báo tới 16 ngày (dải cuộn
                  ngang; độ tin theo tầm ngày + skill đo hiện khi nở) */}
              {cond && today && (
                <>
                  <div
                    className="-mx-1 mt-1.5 flex gap-2 overflow-x-auto px-1 pb-1"
                    role="group"
                    aria-label="Chọn ngày xem dự báo"
                    // trong vùng vuốt của SnapSheet (touch-action:none) — mở lại
                    // cuộn ngang cho dải ngày và chặn cử chỉ nở/thu sheet
                    style={{ touchAction: "pan-x" }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    {cond.days.map((d, i) => {
                      const active = i === selIdx;
                      // ngày đã qua (bản lưu trong máy) — mờ đi, không cho chọn
                      const past = isPastDay(d.date, todayIso);
                      // ngày 4+ là premium: chip vẫn hiện (biết còn dự báo xa để
                      // muốn) nhưng KHÔNG hiện số — chạm ra một dòng mời
                      const locked = dayChipLocked(d.date);
                      return (
                        <button
                          key={d.date}
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => {
                            if (locked) {
                              setDayLockNote(true);
                              return;
                            }
                            setDayLockNote(false);
                            setDayIdx(i);
                          }}
                          disabled={past}
                          aria-pressed={active}
                          aria-disabled={locked || undefined}
                          className={`flex min-h-[2.75rem] min-w-[4.5rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl px-3 transition active:scale-[0.97] ${
                            active ? "bg-navy text-white shadow-sm" : "bg-field"
                          } ${past ? "opacity-40" : ""}`}
                        >
                          {/* CHỈ NGÀY — bỏ số sóng/gió cho gọn (user 2026-07-28);
                              số chi tiết xem ở thân sheet cho ngày đang chọn */}
                          <span
                            className={`text-[0.9375rem] font-bold leading-tight ${
                              active ? "text-white" : "text-navy"
                            }`}
                          >
                            {chipLabel(d.date, todayIso)}
                          </span>
                          {locked && (
                            <LockIcon
                              className="h-3.5 w-3.5 text-foreground/45"
                              aria-hidden
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {dayLockNote && premiumLocked && (
                    <p className="mt-1 rounded-xl bg-field/80 px-3 py-2.5 text-[0.875rem] font-semibold leading-snug text-foreground/75">
                      Xem quá {FREE_FORECAST_DAYS} ngày là tính năng của tài khoản
                      nâng cao —{" "}
                      {premiumAccess === "login" ? (
                        <Link href="/login" className="font-bold text-trim">
                          Đăng nhập →
                        </Link>
                      ) : (
                        <a
                          href={`tel:${SDVICO_HOTLINE}`}
                          className="font-bold text-trim"
                        >
                          gọi SDVICO nâng cấp →
                        </a>
                      )}
                    </p>
                  )}
                </>
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
              {/* THANH NGÀY đã dời LÊN peek (hiện luôn mặc định) — ở body không
                  lặp lại nữa; body bắt đầu thẳng bằng số đỉnh cả ngày. */}
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

              {/* DÒNG CHẢY tại điểm (user 2026-07-29): hôm nay ưu tiên số "lúc
                  này", ngày sau lấy số đại diện giữa trưa từ chuỗi giờ. Nguồn
                  SMOC chỉ tới ~10 ngày — ngày xa hơn không có số thì ẨN, không
                  bịa. Hướng nguồn ghi sẵn là hướng nước CHẢY VỀ. */}
              {(() => {
                const useNow = isToday && cond.curKmh != null && !cond.stale;
                const kmh = useNow ? cond.curKmh : (sel.curKmh ?? null);
                const dir = useNow ? (cond.curDirDeg ?? null) : (sel.curDirDeg ?? null);
                if (kmh == null) return null;
                return (
                  <p className="rounded-xl bg-field px-3 py-2.5 text-[0.9375rem] font-semibold leading-snug text-navy">
                    Dòng chảy{useNow ? " lúc này" : isToday ? " hôm nay" : ""}:{" "}
                    {formatNumberVN(kmh)} km/giờ
                    {dir != null && ` · nước chảy về hướng ${windDirectionVN(dir)}`}
                  </p>
                );
              })()}

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
                  PREMIUM (2026-07-26, thay teaser): khoá HẲN — chưa đăng nhập
                  mời đăng nhập, hạng thường mời gọi SDVICO nâng cấp. */}
              {fishLocked ? (
                <PremiumLock
                  access={premiumAccess}
                  feature="dự báo cá"
                  blurb={
                    premiumAccess === "login"
                      ? "Bản đồ chỗ có khả năng nhiều cá: loài gì, khả năng bao nhiêu, đi hướng nào — đăng nhập bằng tài khoản nâng cao là xem được."
                      : "Bản đồ chỗ có khả năng nhiều cá: loài gì, khả năng bao nhiêu, đi hướng nào. Tài khoản hiện thời không hỗ trợ — gọi SDVICO để nâng cấp."
                  }
                />
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
                        {/* KÉO SANG NGÀY KHÁC: từ 2026-07-28 lớp cá ĐỔI THẬT theo
                            ngày — pha ảnh mới nhất với bản đồ mùa vụ theo tỷ lệ
                            w(d) đo bằng backtest (lib/fish-blend.ts; thắng
                            persistence ở mọi tầm, xem 09 §5d). Câu chữ đổi theo:
                            ngày gần thì ảnh vẫn quyết phần lớn, ngày xa thì mùa
                            vụ gánh dần — nói đúng cái đang xảy ra, KHÔNG hứa
                            "dự báo cá riêng cho ngày này". Chỉ hiện khi bà con ĐÃ
                            kéo sang ngày khác — màn hình mặc định giữ gọn. */}
                        {daysAhead > 0 && (
                          <p className="mt-1 text-[0.8125rem] leading-snug text-foreground/70">
                            {daysAhead <= FISH_STABLE_DAYS
                              ? "Chỗ cá ít đổi trong vài ngày tới — cái đổi là gió, sóng."
                              : "Ngày xa thế này, chỗ cá dựa nhiều vào kinh nghiệm nhiều năm của tháng — càng xa càng nên xem thêm gió, sóng."}
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
                storms={storms}
                onRoute={handleRoute}
                onStart={startNav}
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
