"use client";

/*
  Ra khơi — ĐIỀU KHIỂN LỚP (Phương án A, design-review/07).
  Rail dọc MÉP PHẢI 4 nhóm; chạm mở panel trượt ra trái. Đây là nơi DUY NHẤT
  bật/tắt-chọn dữ liệu HIỆN trên bản đồ — số liệu theo ĐIỂM nằm ở sheet đáy
  (tách bạch, map sạch). Bão tự nổi ở banner trên (không trong rail).
  Quyết định build 2026-06-16: chọn-1-loài (radio qua species sheet) · KHÔNG
  thang kéo lớp nền raster (để sau) · dải % cá lọc thật.
*/

import { useCallback, useEffect, useRef, useState } from "react";
import {
  OCEAN_LAYERS,
  OCEAN_LAYER_ORDER,
  type OceanLayerId,
} from "@/lib/ocean-map";
import type { ForecastKind } from "@/lib/forecast-grid";
import {
  SCALAR_META,
  scalarGradientCss,
  type FetchScalarKind,
} from "@/lib/scalar-field";
import { type SeaScalarKind } from "@/lib/sea-scalars";
import { SPECIES_META } from "@/lib/fish-predict";
import { FLEET_FORECAST_DAYS, addDaysIso } from "@/lib/fleet-density";
import type { FeatureAccess } from "@/lib/tier";
import { PremiumLock } from "@/components/premium-gate";
import { stormNoticeText, type StormStatus } from "@/lib/storms";
import { useOnline } from "@/lib/use-online";
import { clockVN, chipLabel } from "@/lib/day-labels";
import type { SavedPlace } from "@/lib/places";
import { SQ_TILE } from "@/components/ui/sq-btn";
import {
  useMapPrefs,
  setMapPrefs,
  isVmsZoneOn,
  setVmsZoneOn,
} from "@/lib/map-prefs";
import { VMS_ZONES_UPDATED, type VmsZone } from "@/lib/vms-zones";
import { FishSpeciesContent } from "@/components/fish-species-sheet";
import { MyPlacesContent } from "@/components/my-places-sheet";
import {
  AlertIcon,
  AnchorIcon,
  ChevronLeftIcon,
  CheckIcon,
  ChevronRightIcon,
  DepthIcon,
  GridIcon,
  LayersIcon,
  EddyIcon,
  FishIcon,
  PinIcon,
  PlusIcon,
  RadarIcon,
  RouteIcon,
  RulerIcon,
  SettingsIcon,
  StarIcon,
  WavesIcon,
  WindIcon,
} from "@/components/icons";
import { parseCoordPair } from "@/lib/parse-coord";
import { CloseButton } from "@/components/ui/close-button";
import { AppVersionLine } from "@/components/app-version-line";
import { VoiceSettingsSection } from "@/components/nav-voice-ui";
import { Popover } from "@/components/ui/popover";

const FISH_COLOR = "var(--fish)"; // xanh lá — cá/ngư trường (token globals, Phương án A)

// rail xổ ra mà bà con không chạm gì 5s → tự thu. MỌI chạm/gõ trong rail+panel
// nạp lại 5s (còn thao tác là còn ở lại — onPointerDownCapture/onKeyDownCapture).
// Nhịp: 5s (2026-07-28) → 3s (2026-08-24 "đỡ rối mắt") → 5s (2026-09-14, bạn test
// báo 3s đọc/thao tác không kịp; reset-khi-tương-tác đã có nên 5s không "rối mắt").
const AUTO_HIDE_MS = 5000;

type PanelId =
  | "hai-do"
  | "ngu-truong"
  | "thoi-tiet"
  | "diem"
  | "cai-dat"
  | "cong-cu";

// nhịp cập nhật → chấm màu (design §3): 🟥 liên tục 🟧 giờ 🟨 ngày ⬛ cố định.
// Màu qua token globals.css (KHÔNG hex trong component — 03 §5/§8, hook 1d-r).
const DOT: Record<string, string> = {
  lienTuc: "var(--trim)",
  gio: "var(--cadence-hour)",
  ngay: "var(--cadence-day)",
  coDinh: "var(--cadence-fixed)",
};

export function RaKhoiControls({
  layerId,
  onLayer,
  groupDepthOn,
  onGroupDepth,
  groupNavOn,
  onGroupNav,
  groupNameOn,
  onGroupName,
  chartDetailOn,
  onChartDetail,
  scalarKind,
  onScalar,
  forecastKind,
  onForecast,
  overlayField,
  onOverlayField,
  vmsZones,
  fishOn,
  onFish,
  fishSpecies,
  fishAccess,
  species,
  regionShorts,
  onPickSpecies,
  fleetAllowed,
  fleetOn,
  onFleet,
  fleetDay,
  onFleetDay,
  fleetSpecies,
  onFleetSpecies,
  fleetSpeciesList,
  todayIso,
  fleetState,
  fleetEmpty,
  fleetWindMissing,
  fleetStorm,
  onFleetRetry,
  stormInfo,
  showPlaces,
  onShowPlaces,
  places,
  onPlaces,
  onGoPlace,
  measureMode,
  onMeasureMode,
  measureCount,
  measureResult,
  onClearMeasure,
  onGoCoord,
  cursor,
  addPlaceSignal,
  openCoordSignal,
  nutTimDiem = null,
  onLayerOpenChange,
  closeLayersSignal,
  onRoutePanel,
  routeOn = false,
  onLegend,
}: {
  /*  "Ký hiệu là gì?" — mở sheet CHÚ GIẢI HẢI ĐỒ (fishing-map-view lo phần
      sheet). Không truyền = không hiện nút. Reviewer A.7: C-MAP có chú giải
      trong app, SDFish chỉ có chú giải chất đáy ở góc — bà con thấy ký hiệu
      lạ mà không có chỗ hỏi. */
  onLegend?: () => void;
  /** Bấm "Vị trí" → lấy GPS rồi bay tới chỗ mình (fishing-map-view lo phần đó) */
  onLocateMe: () => void;
  /** Gõ tay toạ độ (nút "Đến điểm") → bay tới điểm đó, đặt điểm đang xem */
  onGoCoord: (lat: number, lon: number) => void;
  /*  Bấm "Dẫn đường" → LỐI TẮT: mở sheet ở nấc cao + mở sẵn panel dẫn đường +
      cuộn tới nơi (fishing-map-view lo). Không truyền = không hiện nút. */
  /** chỗ đang trỏ trên bản đồ — form lưu điểm dùng để "lấy chỗ đang trỏ" */
  cursor?: { lat: number; lon: number } | null;
  /*  Menu chạm-giữ trên bản đồ chọn "Lưu thành điểm" → cha tăng số này lên,
      rail mở ô "Điểm đã lưu" kèm form thêm điểm, toạ độ đã điền sẵn theo con
      trỏ. Đếm chứ không dùng boolean: lưu chỗ thứ hai vẫn phải kích được. */
  addPlaceSignal?: number;
  /** tăng số = mở ô "Toạ độ" (gõ tay toạ độ để đến điểm) — ô tìm "Đi đâu?" ở
   *  đầu màn bản đồ gọi qua đây (khung mới 2026-10-20, theo ảnh mẫu hải đồ) */
  openCoordSignal?: number;
  /** ô "Đi đâu?" — ô Toạ độ mở từ đó thì NEO dưới nó (03 §6 mục 9) */
  nutTimDiem?: HTMLElement | null;
  /*  BÁO LÊN CHA khi rail đang mở một LỚP NỔI (panel lớp · ô "Đến điểm" · ô
      "Điểm đã lưu"). Cha dùng để không bung sheet gió sóng đè lên — luật một
      lúc một lớp nổi ở 07 §10.7 I. */
  onLayerOpenChange?: (open: boolean) => void;
  /*  Cha yêu cầu ĐÓNG SẠCH lớp nổi (đếm để lần sau vẫn kích được). Chỉ dùng
      cho ngoại lệ ranh giới ≤6 hl: cảnh báo đó không ai được che. */
  closeLayersSignal?: number;
  onRoutePanel?: () => void;
  /*  CHẾ ĐỘ ĐANG CHẠY (doc 15 §3B) — chỉ cần GPS, máy đọc cảnh báo hải đồ, ranh
      giới, bão, sóng gió. MIỄN PHÍ mọi tài khoản (cảnh báo an toàn, không phải
      dự báo cá) nên KHÔNG gác `premiumTools`. Bấm lại khi đang bật = dừng. */
  onCruise?: () => void;
  cruiseOn?: boolean;
  /*  ĐANG Ở TRONG chế độ dẫn đường — nút phải TRÔNG KHÁC HẲN (user
      2026-08-28e: "hiện thời ko khác gì nhau"). Cùng khuôn nút "Đến điểm":
      bật thì nền `t1` + vòng trắng, tắt thì nền `navy`; kèm `aria-pressed`
      để trình đọc màn hình cũng biết. */
  routeOn?: boolean;
  /** đang xin GPS — nút phải nói đang chạy, đừng để bà con bấm hoài */
  locating: boolean;
  /** máy từ chối / không có GPS — PHẢI nói, không được câm (nguyên tắc trung thực) */
  geoError: boolean;
  layerId: OceanLayerId;
  onLayer: (id: OceanLayerId) => void;
  /** Nhóm Độ sâu & đáy (số đo sâu · đẳng sâu · chất đáy · rạn/đá) */
  groupDepthOn: boolean;
  onGroupDepth: (on: boolean) => void;
  /** Nhóm Báo hiệu & nguy hiểm (phao/đèn/xác tàu/luồng/cáp/vùng cấm/khu tránh trú bão) */
  groupNavOn: boolean;
  onGroupNav: (on: boolean) => void;
  /** Nhóm Tên địa danh ngầm (chỉ còn tên núi/đồi/hố ngầm — trú bão đã sang nhóm trên) */
  groupNameOn: boolean;
  onGroupName: (on: boolean) => void;
  chartDetailOn: boolean;
  onChartDetail: (on: boolean) => void;
  scalarKind: SeaScalarKind | null;
  onScalar: (k: SeaScalarKind | null) => void;
  forecastKind: ForecastKind | null;
  onForecast: (k: ForecastKind | null) => void;
  /** Lớp DẢI MÀU vô hướng (mây/mưa/nhiệt) — loại trừ lẫn nhau với gió/sóng */
  overlayField: FetchScalarKind | null;
  onOverlayField: (k: FetchScalarKind | null) => void;
  /** Vùng biển VMS (admin quản lý) — mỗi vùng 1 toggle trong panel Cài đặt */
  vmsZones: VmsZone[];
  fishOn: boolean;
  onFish: (on: boolean) => void;
  fishSpecies: string | null;
  /** nấc premium (lib/tier.ts): "login"/"upgrade" = dự báo cá KHOÁ HẲN
      (2026-07-26, thay teaser) — panel hiện thẻ khoá thay vì picker */
  fishAccess: FeatureAccess;
  /** danh sách loài đang vụ (tên ngắn) — để chọn loài ngay trong panel */
  species: string[];
  regionShorts: Set<string>;
  onPickSpecies: (sp: string | null) => void;
  /** LỚP MẬT ĐỘ TÀU DỰ KIẾN (2026-10-25): theo ngày/tháng/mùa/trăng — cùng khoá premium với lớp cá
      (fishAccess); loại trừ với lớp cá vì hai lớp cùng tô ô 0,25° */
  /** xem trước nội bộ — false thì panel KHÔNG hiện mục mật độ tàu (lib/fleet-density canSeeDensity) */
  fleetAllowed: boolean;
  fleetOn: boolean;
  onFleet: (on: boolean) => void;
  /** dự báo 16 ngày: ngày tới (0 = hôm nay) + lọc loài (tên ngắn, null = mọi loài) */
  fleetDay: number;
  onFleetDay: (k: number) => void;
  fleetSpecies: string | null;
  onFleetSpecies: (sp: string | null) => void;
  fleetSpeciesList: string[];
  todayIso: string;
  /** trạng thái để panel nói đúng: đang tải / lỗi / ngày trống; gió thiếu ⇒ nói "chưa tính gió" */
  fleetState: "idle" | "loading" | "error" | "ok";
  fleetEmpty: boolean;
  fleetWindMissing: boolean;
  fleetStorm: boolean;
  onFleetRetry: () => void;
  /** Trạng thái tin bão đã quy về 4 nhánh (lib/storms.ts) — KHÔNG dùng mảng
      rỗng để vừa nghĩa "không có bão" vừa nghĩa "chưa hỏi được" */
  stormInfo: StormStatus;
  showPlaces: boolean;
  onShowPlaces: (on: boolean) => void;
  /** điểm đã lưu — quản lý ngay trong panel rail (không bottom-sheet) */
  places: SavedPlace[];
  onPlaces: (next: SavedPlace[]) => void;
  onGoPlace: (lat: number, lon: number) => void;
  /** công cụ đo khoảng cách 2 điểm trên bản đồ */
  measureMode: boolean;
  onMeasureMode: (on: boolean) => void;
  /** số điểm đã chạm (0/1/2) — để hướng dẫn */
  measureCount: number;
  /** kết quả đã định dạng theo đơn vị đang chọn (null khi chưa đủ 2 điểm) */
  measureResult: { dist: string; dir: string } | null;
  onClearMeasure: () => void;
}) {
  const [open, setOpen] = useState<PanelId | null>(null);
  // MẶC ĐỊNH THU GỌN (user 2026-07-28): map sạch, chạm "Lớp" mới xổ rail ra;
  // xổ rồi mà 5s không chạm gì (trong rail/panel) thì TỰ thu lại.
  const [collapsed, setCollapsed] = useState(true);
  /** nút "Lớp" — panel/lưới lớp NEO vào nó (Popover, 03 §6 mục 9) */
  const [nutLop, setNutLop] = useState<HTMLDivElement | null>(null);
  /** nút "Thêm" (⋯) — khay + ô Toạ độ + Điểm lưu NEO vào nó; không có ⋯ (đang dẫn đường…) thì neo nút Lớp */
  const [nutThem, setNutThem] = useState<HTMLDivElement | null>(null);
  const dongLop = useCallback(() => {
    setOpen(null);
    setCollapsed(true);
  }, []);
  // Ô GÕ TAY TOẠ ĐỘ (nút "Đến điểm") — luôn bấm được kể cả khi thu bảng lớp.
  const [coordOpen, setCoordOpen] = useState(false);
  /*  ĐIỂM ĐÃ LƯU tách khỏi danh sách panel rail thành NÚT RIÊNG dưới "Đến
      điểm" (user 2026-08-28h). Nó là chỗ bà con MỞ NHANH chỗ quen — cùng
      loại việc với "Vị trí"/"Đến điểm" (đi tới một toạ độ), không phải
      loại việc "bật/tắt lớp bản đồ" như 5 panel còn lại. */
  const [placesOpen, setPlacesOpen] = useState(false);
  /** khay "Thêm" (⋯) đang bung — chạm ngoài rail là thu (mục 8, 2026-10-19) */
  const [more, setMore] = useState(false);
  const railRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!more) return;
    const ngoai = (e: PointerEvent) => {
      if (railRef.current && e.target instanceof Node && railRef.current.contains(e.target)) return;
      setMore(false);
    };
    document.addEventListener("pointerdown", ngoai, true);
    return () => document.removeEventListener("pointerdown", ngoai, true);
  }, [more]);
  const [addPlaceOpen, setAddPlaceOpen] = useState(false);
  /*  ĐIỀN SẴN TOẠ ĐỘ CON TRỎ — CHỈ khi form mở do menu chạm-giữ (07 §10.7 K).
      Mở panel bằng nút rail thì KHÔNG điền: app không được tự khai một toạ độ
      bà con chưa hề chỉ. Đặt bằng số của lượt tín hiệu, xoá khi panel đóng. */
  const [prefillTick, setPrefillTick] = useState(0);
  useEffect(() => {
    if (!addPlaceSignal) return;
    setOpen(null);
    setCoordOpen(false);
    setPlacesOpen(true);
    setAddPlaceOpen(true);
    setPrefillTick(addPlaceSignal);
  }, [addPlaceSignal]);
  /** ô Toạ độ mở từ ô "Đi đâu?" (đầu cột trái) ⇒ neo dưới ô đó, không neo nút ⋯ */
  const [coordTuTim, setCoordTuTim] = useState(false);
  useEffect(() => {
    if (!openCoordSignal) return;
    setOpen(null);
    setPlacesOpen(false);
    setMore(false);
    setCoordTuTim(true);
    setCoordOpen(true);
  }, [openCoordSignal]);
  /*  ĐÓNG PANEL LÀ DỌN LUÔN TRẠNG THÁI FORM (2026-08-29h — chủ dự án: *"điểm
      đã lưu ko thấy điểm cũ? t lưu điểm gà mà ko thấy"*).

      LỖI: `addPlaceOpen` bật lên khi mở form từ menu chạm-giữ, và chỉ tắt khi
      bà con bấm Lưu/Huỷ. Đóng panel bằng nút X lúc form đang mở thì cờ NẰM
      LẠI — lần sau bấm "Điểm đã lưu" ở rail, form bung ra ngay, mà form mở thì
      danh sách điểm cũ bị thu (xem `!addOpen` trong my-places-sheet). Kết quả:
      bà con vừa lưu một điểm xong, mở ra lại thấy form trống và KHÔNG thấy
      điểm nào — tưởng máy nuốt mất điểm của mình. Điểm vẫn còn (ghim vẫn hiện
      trên bản đồ), chỉ là danh sách bị giấu.

      Đây là lớp lỗi "trạng thái sống dai hơn lần dùng": mở panel bằng nút rail
      phải luôn về màn MẶC ĐỊNH — danh sách điểm — chứ không kế thừa việc dở
      của lượt trước. */
  useEffect(() => {
    if (!placesOpen) {
      setPrefillTick(0);
      setAddPlaceOpen(false);
    }
  }, [placesOpen]);
  /*  BÁO CHA: rail đang có lớp nổi nào mở không. Cha (fishing-map-view) dùng để
      chạm bản đồ chỉ dời con trỏ, khỏi bung sheet gió sóng đè lên panel. */
  const anyLayerOpen = !collapsed || open !== null || placesOpen || coordOpen;
  useEffect(() => {
    onLayerOpenChange?.(anyLayerOpen);
  }, [anyLayerOpen, onLayerOpenChange]);
  /*  Cha đòi nhường chỗ cho cảnh báo ranh giới ≤6 hl → đóng sạch lớp nổi. */
  useEffect(() => {
    if (!closeLayersSignal) return;
    setOpen(null);
    setCoordOpen(false);
    setPlacesOpen(false);
    setCollapsed(true); // chạm bản đồ = đóng hẳn ngăn Lớp (kiểu Google Maps, rà bố cục 2026-10-22)
    setMore(false);
  }, [closeLayersSignal]);
  /*  LUẬT HIỂN THỊ — MỘT LỚP NỔI MỘT LÚC (chủ dự án 2026-08-29: "2 chế độ lúc
      lưu và lúc dẫn đường đang hiển thị 1 lúc nó bị chồng chéo và rối nhau").
      Vào chế độ dẫn đường là ĐÓNG SẠCH panel lớp + ô toạ độ + ô điểm đã lưu.
      Vì sao đóng chứ không xếp chồng cho khéo: xem bảng "hiện đồng thời được /
      không được" ở 07 §10.7 I — cả ba thứ này đều là LỚP NỔI ĐÈ BẢN ĐỒ, mà
      màn chỉ có một chỗ cho lớp nổi. Ghép đôi nào cũng dưới 50% số lượt dùng
      nên không đáng đánh đổi sự rối. */
  useEffect(() => {
    if (!routeOn) return;
    setOpen(null);
    setCoordOpen(false);
    setPlacesOpen(false);
  }, [routeOn]);

  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armAutoHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setOpen(null);
      setCollapsed(true);
    }, AUTO_HIDE_MS);
  }, []);
  useEffect(() => {
    if (collapsed) return;
    armAutoHide(); // nạp lại mỗi khi mở/đổi panel (một "thao tác")
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [collapsed, open, armAutoHide]);

  const RAIL: {
    id: PanelId;
    label: string;
    icon: (p: { className?: string }) => React.ReactNode;
    color: string;
    dot?: boolean;
  }[] = [
    { id: "hai-do", label: "Hải đồ", icon: DepthIcon, color: "var(--t1)" },
    {
      id: "ngu-truong",
      label: "Ngư trường",
      icon: FishIcon,
      color: FISH_COLOR,
      dot: fishOn || fleetOn,
    },
    {
      id: "thoi-tiet",
      label: "Thời tiết",
      icon: WindIcon,
      color: "var(--t3)",
      dot:
        stormInfo.kind === "co-bao" ||
        stormInfo.kind === "khong-hoi-duoc" ||
        !!forecastKind ||
        !!overlayField ||
        !!scalarKind,
    },
    {
      id: "cong-cu",
      label: "Công cụ",
      icon: RulerIcon,
      color: "var(--t1)",
      dot: measureMode,
    },
    { id: "cai-dat", label: "Cài đặt", icon: SettingsIcon, color: "var(--navy)" },
  ];

  // ĐẾN ĐIỂM · ĐIỂM ĐÃ LƯU · DẪN ĐƯỜNG = TÍNH NĂNG PREMIUM (user chốt 2026-08-29):
  // ẨN HẲN khỏi acc thường (chưa đăng nhập "login" / hạng thường "upgrade"). Chỉ
  // hiện ở nấc "open" (fishAccess = access tài khoản, dùng chung nấc với lớp cá).
  // "checking" cũng ẩn — thà premium thấy nút hiện chậm một nhịp còn hơn nháy
  // tính năng premium cho người thường rồi rút đi. Lớp + Vị trí vẫn cho mọi người.
  const premiumTools = fishAccess === "open";

  return (
    <div
      className="pointer-events-none relative flex justify-end gap-2"
      // mọi chạm/gõ phím trong rail + panel = "thao tác" → hoãn tự thu 5s
      onPointerDownCapture={() => !collapsed && armAutoHide()}
      onKeyDownCapture={() => !collapsed && armAutoHide()}
      // CUỘN cũng là "đang đọc" → nạp lại đồng hồ tự-thu. `scroll` KHÔNG bubble
      // nên onScroll ở container cha không bắt được; nhưng nó CÓ pha CAPTURE,
      // nên onScrollCapture bắt được cuộn ở MỌI vùng con (panel lớp max-h-62vh,
      // panel điểm, rail nút) tại MỘT chỗ. Thiếu vế này: cuộn bánh xe/quán tính
      // (buông tay trang vẫn trôi) không bắn pointerdown ⇒ panel tự tắt giữa lúc
      // bà con đang kéo xem (bug "Ngư trường → Tất cả → kéo xuống là tắt").
      onScrollCapture={() => !collapsed && armAutoHide()}
    >
      {/* KHÔNG còn thẻ "Chuẩn bị đi biển" ở đây (bỏ 2026-07-25): máy TỰ tải sẵn
          khi vào trang và chỉ báo một dòng nhỏ tự tắt — xem
          components/pretrip-auto-notify.tsx. Bản đồ nhờ vậy sạch chữ. */}

      {/*  PANEL LỚP NEO NGAY DƯỚI NÚT "Lớp" (03 §6 mục 9, anh Long 2026-10-23: "click từ nút thì
          nó hiện ra bên cạnh nút vì lúc đó tay họ đang ở gần nút rồi, tự dưng kéo xuống dưới cả
          thì nó không thuận tiện"). Vòng trước đưa xuống ngăn đáy (Google Maps) — ngược luật này,
          đã đảo lại. Primitive `Popover`: canh mép phải nút, thiếu chỗ thì cuộn trong, kẹp khung
          480px; ‹ về lưới lớp, × đóng hẳn; chạm ra ngoài (bản đồ) / Escape đóng. Nổi đè một phần
          cột trái (tin bão) trong lúc mở — người dùng tự mở, tự thu 5 s; không ép hẹp cột. */}
      {open && !collapsed && (
        <Popover
          anchor={nutLop}
          label={PANEL_TITLE[open]}
          onClose={dongLop}
          className={`${open === "diem" ? "w-[22rem]" : "w-[18rem]"} max-w-[calc(100vw-1rem)] p-3`}
        >
          {
            <>
              {/* "‹" về danh sách lớp (danh sách tạm ẩn khi panel mở — xem RAIL PHẢI) */}
              <PanelHeader
                title={PANEL_TITLE[open]}
                onClose={() => {
                  setOpen(null);
                  setCollapsed(true); // × = đóng hẳn; ‹ = về danh sách lớp
                }}
                onBack={() => setOpen(null)}
              />
              {open === "hai-do" && (
                <HaiDoPanel
                  layerId={layerId}
                  scalarKind={scalarKind}
                  onLayer={(id) => {
                    onScalar(null);
                    onLayer(id);
                  }}
                  groupDepthOn={groupDepthOn}
                  onGroupDepth={onGroupDepth}
                  groupNavOn={groupNavOn}
                  onGroupNav={onGroupNav}
                  groupNameOn={groupNameOn}
                  onGroupName={onGroupName}
                  chartDetailOn={chartDetailOn}
                  onChartDetail={onChartDetail}
                  onLegend={onLegend}
                />
              )}
              {open === "ngu-truong" && (
                <NguTruongPanel
                  fishOn={fishOn}
                  onFish={onFish}
                  fishSpecies={fishSpecies}
                  fishAccess={fishAccess}
                  species={species}
                  regionShorts={regionShorts}
                  onPickSpecies={onPickSpecies}
                  fleetAllowed={fleetAllowed}
                  fleetOn={fleetOn}
                  onFleet={onFleet}
                  fleetDay={fleetDay}
                  onFleetDay={onFleetDay}
                  fleetSpecies={fleetSpecies}
                  onFleetSpecies={onFleetSpecies}
                  fleetSpeciesList={fleetSpeciesList}
                  todayIso={todayIso}
                  fleetState={fleetState}
                  fleetEmpty={fleetEmpty}
                  fleetWindMissing={fleetWindMissing}
                  fleetStorm={fleetStorm}
                  onFleetRetry={onFleetRetry}
                />
              )}
              {open === "thoi-tiet" && (
                <ThoiTietPanel
                  stormInfo={stormInfo}
                  forecastKind={forecastKind}
                  onForecast={onForecast}
                  overlayField={overlayField}
                  onOverlayField={onOverlayField}
                  scalarKind={scalarKind}
                  onScalar={onScalar}
                />
              )}
              {open === "diem" && (
                <DiemPanel
                  showPlaces={showPlaces}
                  onShowPlaces={onShowPlaces}
                  places={places}
                  onPlaces={onPlaces}
                  onGoPlace={onGoPlace}
                  onClose={() => setOpen(null)}
                />
              )}
              {open === "cong-cu" && (
                <ToolsPanel
                  measureMode={measureMode}
                  onMeasureMode={onMeasureMode}
                  measureCount={measureCount}
                  measureResult={measureResult}
                  onClearMeasure={onClearMeasure}
                />
              )}
              {open === "cai-dat" && <SettingsPanel vmsZones={vmsZones} />}
            </>
          }
        </Popover>
      )}

      {/* ĐIỂM ĐÃ LƯU — nổi cạnh nút, cùng khuôn ô toạ độ (premium) */}
      {premiumTools && placesOpen && (
        <Popover
          anchor={nutThem ?? nutLop}
          label="Điểm đã lưu"
          onClose={() => setPlacesOpen(false)}
          className="w-[20rem] max-w-[calc(100vw-1rem)] p-3"
        >
          <DiemPanel
            cursor={cursor}
            prefillTick={prefillTick}
            addOpen={addPlaceOpen}
            onAddOpenChange={setAddPlaceOpen}
            showPlaces={showPlaces}
            onShowPlaces={onShowPlaces}
            places={places}
            onPlaces={onPlaces}
            onGoPlace={onGoPlace}
            onClose={() => setPlacesOpen(false)}
          />
        </Popover>
      )}

      {/* Ô GÕ TAY TOẠ ĐỘ — nổi cạnh nút "Đến điểm", độc lập với panel rail (premium) */}
      {premiumTools && coordOpen && (
        <Popover
          anchor={(coordTuTim ? nutTimDiem : null) ?? nutThem ?? nutLop}
          label="Đến điểm — nhập toạ độ"
          onClose={() => setCoordOpen(false)}
          className="w-[19rem] max-w-[calc(100vw-1rem)] p-3"
        >
          <GoToPointPopup
            onGoCoord={onGoCoord}
            onClose={() => setCoordOpen(false)}
          />
        </Popover>
      )}

      {/* RAIL PHẢI — CHỈ HAI Ô (anh Long 2026-10-19 mục 8: "các icon đang bị nhiều
          quá, tối ưu các icon đi, chỉ để lại 2 icon chính, còn cần thì click ra"):
          LỚP (mở danh sách 5 panel như cũ) và THÊM (⋯ — khay nhỏ sát mép phải gom
          Vị trí · Chạy tàu · Lộ trình · Toạ độ · Điểm lưu; chọn xong tự thu, chạm
          ngoài cũng thu). Đang chạy / đang dẫn đường thì nút đó hiện THẲNG trên
          rail (không giấu trong Thêm) cùng HUD. Ô theo mẫu ảnh anh Long chọn: vuông
          bo, nền trắng, icon trên nhãn dưới, cùng cỡ (03 §0 bậc control). CHỈ MỘT
          bảng mở một lúc: mở Lớp đóng Thêm và ngược lại. */}
      {/*  DANH SÁCH LỚP + KHAY "THÊM" NỔI ĐÈ (absolute), KHÔNG nằm trong luồng cột (rà bố
           cục 2026-10-22): bung trong luồng làm cột nút rộng ra 11rem ⇒ cột trái (tin bão,
           ô tìm, thẻ Tàu/Trỏ) bị ép còn ~140px, thẻ bão một chữ một dòng. Cột nút giữ
           đúng bề ngang một nút. */}
      <div ref={railRef} className="pointer-events-auto relative flex flex-col items-end gap-1.5">
        <div ref={setNutLop}>
        <RailBtn
          active={!collapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Mở lớp bản đồ" : "Đóng lớp bản đồ"}
          onClick={() => {
            setMore(false);
            setCoordOpen(false);
            setPlacesOpen(false);
            if (!collapsed) setOpen(null);
            setCollapsed((c) => !c);
          }}
          icon={collapsed ? LayersIcon : ChevronRightIcon}
          label={collapsed ? "Lớp" : "Đóng"}
          variant="fab"
        />
        </div>
        {/*  ĐANG CHẠY (không tuyến): KHÔNG còn ô "Đang chạy" trên rail — HUD trên
             cùng đã có tiêu đề "Đang chạy" + nút Dừng (tối ưu bố cục bản đồ,
             anh Long 2026-10-19: một việc một chỗ, bớt icon che bản đồ). Rail
             giữ "Thêm" để vẫn mở được Vị trí / Toạ độ / Điểm lưu khi đang chạy. */}
        {routeOn && onRoutePanel ? (
          <RailBtn variant="fab" active dot aria-pressed onClick={onRoutePanel} aria-label="Đang dẫn đường — chạm để đóng" icon={RouteIcon} label="Dẫn đường" />
        ) : collapsed && premiumTools ? (
          /*  ⋯ CHỈ HIỆN KHI CÓ VIỆC (rà bố cục 2026-10-22): ba mục trong khay đều premium —
              tài khoản thường bấm ra một khay RỖNG. Không có mục thì không có nút. */
          <div ref={setNutThem}>
          <RailBtn
            active={more}
            aria-expanded={more}
            aria-label={more ? "Đóng khay thêm" : "Thêm việc: vị trí, chạy tàu, lộ trình, toạ độ, điểm lưu"}
            onClick={() => {
              setOpen(null);
              setCollapsed(true);
              setCoordOpen(false);
              setPlacesOpen(false);
              setMore((m) => !m);
            }}
            icon={DotsIcon}
            label="Thêm"
            variant="fab"
          />
          </div>
        ) : null}
        {more && !routeOn && premiumTools && (
          <Popover
            anchor={nutThem}
            role="menu"
            label="Thêm việc"
            onClose={() => setMore(false)}
            className="flex w-[11rem] flex-col gap-0.5 p-1"
          >
            {/*  "Vị trí" và "Chạy tàu" (loa) đã ra NGOÀI bản đồ — nút về tàu + nút loa
                 ở cột góc phải dưới (khung 2026-10-20) — không lặp trong khay. */}
            {premiumTools && onRoutePanel && (
              <RailBtn
                onClick={() => {
                  setMore(false);
                  onRoutePanel();
                }}
                aria-label="Lộ trình — mở bảng tính lộ trình"
                icon={RouteIcon}
                label="Lộ trình"
              />
            )}
            {premiumTools && (
              <RailBtn
                onClick={() => {
                  setMore(false);
                  setCoordTuTim(false); // mở từ khay ⋯ ⇒ neo nút ⋯
                  setCoordOpen(true);
                }}
                aria-label="Toạ độ — nhập toạ độ để đến điểm"
                icon={PinIcon}
                label="Toạ độ"
              />
            )}
            {premiumTools && (
              <RailBtn
                onClick={() => {
                  setMore(false);
                  setPlacesOpen(true);
                }}
                aria-label="Điểm đã lưu"
                icon={StarIcon}
                label="Điểm lưu"
              />
            )}
          </Popover>
        )}
        {/* danh sách lớp mở được cả khi loa đang bật — loa không còn là chế độ dẫn đường */}
        {/*  Danh sách TẠM ẨN khi một panel đang mở (rà bố cục 2026-10-22): trước đây chọn
             "Thời tiết" xong danh sách vẫn nằm đè lên panel, che tiêu đề + cảnh báo bão +
             công tắc. Panel có "‹" để về lại danh sách. */}
        {!collapsed && open === null && (
          <Popover anchor={nutLop} label="Lớp bản đồ" onClose={dongLop} className="w-[18rem] max-w-[calc(100vw-1rem)] p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="display text-[1.125rem] font-semibold text-navy">Lớp bản đồ</h3>
              <CloseButton
                onClose={() => setCollapsed(true)}
                label="Đóng lớp bản đồ"
              />
            </div>
            {/* LƯỚI Ô như "Map type / Map details" của Google Maps — icon trên, tên dưới */}
            <div className="grid grid-cols-3 gap-2">
              {RAIL.map((r) => {
                const Icon = r.icon;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setOpen(r.id)}
                    className="relative flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-2xl border border-line bg-card px-1 text-[0.875rem] font-semibold text-navy transition active:scale-[0.97] active:bg-field"
                  >
                    <Icon className="h-6 w-6" />
                    {r.label}
                    {r.dot && (
                      <span
                        aria-hidden
                        className="absolute right-2 top-2 h-2 w-2 rounded-full"
                        style={{ background: r.color }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </Popover>
        )}
      </div>
    </div>
  );
}

/**
 * NÚT CỦA RAIL BẢN ĐỒ — HAI KHUÔN CHUẨN (anh Long 2026-10-20: "nút gì to thế? rà
 * soát tất cả các nút, làm đẹp và tiêu chuẩn"; trước là ô vuông 4rem icon-trên-
 * chữ-dưới cho MỌI nút, khay "Thêm" thành cột ô to):
 *  · `fab`  — NÚT NỔI tròn --h-ctl, chỉ icon, nền card viền mảnh: CÙNG khuôn nút
 *    ⚠ / loa / về tàu ở góc dưới (một hệ nút nổi cho cả bản đồ). Tên ở aria-label.
 *  · `menu` — DÒNG trong khay/danh sách bung ra: icon + chữ nằm ngang, cao 2.5rem,
 *    chữ 0.875rem — kiểu menu chuẩn, gọn hơn cột ô vuông. Đang chọn = navy đặc.
 */
function RailBtn({
  icon: Icon,
  label,
  active = false,
  dot = false,
  dotColor,
  tone,
  variant = "menu",
  ...rest
}: {
  icon: (p: { className?: string }) => React.ReactNode;
  label: string;
  active?: boolean;
  /** chấm báo "đang bật" góc trên phải */
  dot?: boolean;
  dotColor?: string;
  tone?: "warn";
  variant?: "fab" | "menu";
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  const mau = active
    ? "border-navy bg-navy text-white"
    : tone === "warn"
      ? "border-warn-bg bg-warn-bg text-warn"
      : variant === "fab"
        ? "glass border-transparent text-navy"
        : "border-transparent bg-transparent text-navy active:bg-field";
  return (
    <button
      type="button"
      {...rest}
      className={
        variant === "fab"
          ? `relative flex h-(--h-ctl) w-(--h-ctl) shrink-0 items-center justify-center rounded-full border shadow-sm transition active:scale-95 disabled:opacity-60 ${mau}`
          : `relative flex h-10 w-full items-center gap-2.5 rounded-lg border px-3 text-left text-[0.875rem] font-semibold transition disabled:opacity-60 ${mau}`
      }
    >
      {dot && (
        <span
          className={`absolute h-2 w-2 rounded-full ${variant === "fab" ? "right-1 top-1" : "right-2 top-1/2 -translate-y-1/2"}`}
          style={{ background: active ? "var(--card)" : (dotColor ?? "var(--trim)") }}
          aria-hidden
        />
      )}
      <Icon className="h-[1.125rem] w-[1.125rem] shrink-0" />
      <span className={variant === "fab" ? "sr-only" : "min-w-0 flex-1 truncate"}>{label}</span>
    </button>
  );
}

/** ⋯ — nút "Thêm" của rail */
function DotsIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

const PANEL_TITLE: Record<PanelId, string> = {
  "hai-do": "Hải đồ — Lớp nền",
  "ngu-truong": "Ngư trường — Phân bố cá",
  "thoi-tiet": "Thời tiết — gió, sóng, bão",
  diem: "Điểm đã lưu của tôi",
  "cong-cu": "Công cụ — đo khoảng cách",
  "cai-dat": "Cài đặt — đơn vị & toạ độ",
};

function PanelHeader({
  title,
  onClose,
  onBack,
}: {
  title: string;
  onClose: () => void;
  /** nếu có → hiện nút quay lại (drill-down, vd chọn loài trong Ngư trường) */
  onBack?: () => void;
}) {
  return (
    <div className="mb-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-1.5">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Quay lại"
              className="-my-1.5 -ml-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-navy active:bg-field"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
          )}
          {/* BỎ nhãn "Điều khiển" trên tiêu đề (rà bố cục 2026-10-22: nhãn nhỏ trên tiêu đề
              là thứ Impeccable/Taste cấm — tiêu đề tự nói nó là gì) */}
          <h3 className="display min-w-0 pt-1.5 text-[1rem] font-semibold leading-tight text-navy">
            {title}
          </h3>
        </div>
        <CloseButton onClose={onClose} />
      </div>
      {/*  ĐÃ BỎ dòng "Chọn dữ liệu nào hiện trên bản đồ · số liệu điểm nằm ở
           sheet dưới" (2026-08-29). Nó là lời DẪN GIẢI, không cấp dữ liệu — và
           `PanelHeader` dùng chung nên nó lọt sang cả ô "Đến điểm — gõ toạ độ",
           nơi câu đó còn SAI (ô ấy không chọn lớp nào cả). */}
    </div>
  );
}

function cadLine(id: OceanLayerId): { text: string; dot: string } {
  const def = OCEAN_LAYERS[id];
  if (!def.dated) return { text: "Lớp cố định · Không đổi theo ngày", dot: DOT.coDinh };
  // Ảnh vệ tinh theo ngày (KHÔNG phải dự báo). Bỏ số "trễ ~2 ngày" khỏi UI
  // (user 2026-07-29: ngư dân không cần biết), nhưng vẫn ghi "ảnh vệ tinh" để
  // khỏi nhầm với lớp dự báo mây/gió/sóng. Ảnh mới nhất do GIBS tự chọn qua
  // ngày `default` (xem OCEAN_LAYERS) — app không tự tính ngày nữa.
  return { text: "Ảnh vệ tinh · thay đổi theo ngày", dot: DOT.ngay };
}

function HaiDoPanel({
  layerId,
  scalarKind,
  onLayer,
  groupDepthOn,
  onGroupDepth,
  groupNavOn,
  onGroupNav,
  groupNameOn,
  onGroupName,
  chartDetailOn,
  onChartDetail,
  onLegend,
}: {
  layerId: OceanLayerId;
  scalarKind: SeaScalarKind | null;
  onLayer: (id: OceanLayerId) => void;
  /** Nhóm Độ sâu & đáy (số đo sâu · đẳng sâu · chất đáy · rạn/đá) */
  groupDepthOn: boolean;
  onGroupDepth: (on: boolean) => void;
  /** Nhóm Báo hiệu & nguy hiểm (phao/đèn/xác tàu/luồng/cáp/vùng cấm/khu tránh trú bão) */
  groupNavOn: boolean;
  onGroupNav: (on: boolean) => void;
  /** Nhóm Tên địa danh ngầm (tên núi/đồi/hố ngầm) */
  groupNameOn: boolean;
  onGroupName: (on: boolean) => void;
  chartDetailOn: boolean;
  onChartDetail: (on: boolean) => void;
  /** mở sheet chú giải ký hiệu — không truyền = không hiện nút */
  onLegend?: () => void;
}) {
  return (
    <div>
      <p className="mb-2 text-[0.75rem] font-semibold text-foreground/55">
        Lớp nền bản đồ · Chọn 1
      </p>
      <ul className="space-y-1.5" role="radiogroup" aria-label="Lớp nền bản đồ">
        {OCEAN_LAYER_ORDER.map((id) => {
          const def = OCEAN_LAYERS[id];
          const active = !scalarKind && id === layerId;
          const cad = cadLine(id);
          return (
            <li key={id}>
              <button
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onLayer(id)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition active:scale-[0.99] ${active ? "bg-field" : ""}`}
              >
                <span
                  className="h-7 w-7 shrink-0 rounded-lg"
                  style={{ background: def.legend?.gradient ?? "var(--field)" }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.9375rem] font-semibold leading-tight text-navy">
                    {def.label}
                  </span>
                  <span className="flex items-center gap-1 text-[0.8125rem] leading-tight text-foreground/75">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: cad.dot }}
                      aria-hidden
                    />
                    {cad.text}
                  </span>
                </span>
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${active ? "border-t1 bg-t1 text-white" : "border-line"}`}
                  aria-hidden
                >
                  {active && <CheckIcon className="h-3 w-3" />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 rounded-xl bg-field/70 px-2.5 py-2 text-[0.75rem] leading-snug text-foreground/70">
        Ảnh vệ tinh chụp trước đó, không phải ngay lúc này. Phao báo hiệu chỉ
        hiện khi phóng to gần bờ.
      </p>
      {/* NHÃN ĐẢO tiếng Việt LUÔN hiện trên hải đồ (chi tiết chủ quyền, không
          tắt được). TUYẾN TÀU thì cho tắt vì có bà con thích bản đồ thoáng. */}
      <div className="mt-2 border-t border-line pt-2">
        {/* CÔNG TẮC TỔNG cụm hải đồ (2026-09-02) — phao đèn, báo hiệu chính
            thức, đèn biển, số đo sâu, đoạn luồng. Một chạm cho bà con muốn
            màn thoáng; công tắc con bên dưới tinh chỉnh từng lớp. CHỈ là
            chuyện nhìn — dữ liệu vẫn tải đủ về máy. */}
        <Toggle
          label="Hải đồ chi tiết"
          sub="Hiển thị đầy đủ hải đồ — độ sâu, báo hiệu, tên; tự lộ chi tiết khi phóng to"
          on={chartDetailOn}
          onToggle={() => onChartDetail(!chartDetailOn)}
          icon={
            <span style={{ color: "var(--t1)" }}>
              <AnchorIcon className="h-5 w-5" />
            </span>
          }
        />
        {/*  BA NHÓM (chủ dự án 2026-09-03) — gom 6 công tắc con về 3 nhóm theo
            cách bà con đọc hải đồ. Đều nằm dưới "Hải đồ chi tiết" ở trên. */}
        <Toggle
          label="Độ sâu & đáy"
          sub="Số đo sâu, đường đẳng sâu, chất đáy, đá ngầm/rạn — nơi có thể mắc cạn hoặc cá tập trung"
          on={groupDepthOn}
          onToggle={() => onGroupDepth(!groupDepthOn)}
          icon={
            <span style={{ color: "var(--t1)" }}>
              <DepthIcon className="h-5 w-5" />
            </span>
          }
        />
        {/*  KHU TRÁNH TRÚ BÃO chuyển từ nhóm "Tên & nơi trú" sang đây
             (reviewer 2026-09-03): nó là NƠI CHẠY TỚI lúc nguy, cùng loại việc
             "đi lại an toàn" với phao/đèn/xác tàu — không phải chuyện tên gọi.
             fishing-map-view đổi gate lớp `khu-tru-bao-dot` sang groupNavOn. */}
        <Toggle
          label="Báo hiệu & nguy hiểm"
          sub="Phao, đèn, xác tàu, luồng, cáp, vùng cấm, khu trú bão"
          on={groupNavOn}
          onToggle={() => onGroupNav(!groupNavOn)}
          icon={
            <span style={{ color: "var(--t1)" }}>
              <AnchorIcon className="h-5 w-5" />
            </span>
          }
        />
        <Toggle
          label="Tên địa danh ngầm"
          sub="Tên núi/đồi/hố ngầm dưới biển — giúp định vị ngư trường"
          on={groupNameOn}
          onToggle={() => onGroupName(!groupNameOn)}
          icon={
            <span style={{ color: "var(--t1)" }}>
              <LayersIcon className="h-5 w-5" />
            </span>
          }
        />
        {/*  "KÝ HIỆU LÀ GÌ?" — cùng khuôn hàng với Toggle (bg-field, bo xl,
             icon + chữ), nhưng là NÚT MỞ SHEET chứ không phải công tắc: có mũi
             tên phải, không có cần gạt. Tap ≥56px (03 §Tap tối thiểu). */}
        {onLegend && (
          <button
            type="button"
            onClick={onLegend}
            className="mt-2 flex min-h-[3.5rem] w-full items-center gap-2.5 rounded-xl bg-field px-3 text-left transition active:scale-[0.99]"
          >
            <span className="shrink-0" style={{ color: "var(--t1)" }}>
              <AlertIcon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.9375rem] font-semibold leading-tight text-navy">
                Ký hiệu là gì?
              </span>
              <span className="block text-[0.8125rem] text-foreground/75">
                Xem hình phao, đèn, xác tàu, cáp… và nghĩa của từng hình
              </span>
            </span>
            <ChevronRightIcon className="h-5 w-5 shrink-0 text-navy/75" />
          </button>
        )}
      </div>
    </div>
  );
}

function NguTruongPanel({
  fishOn,
  onFish,
  fishSpecies,
  fishAccess,
  species,
  regionShorts,
  onPickSpecies,
  fleetAllowed,
  fleetOn,
  onFleet,
  fleetDay,
  onFleetDay,
  fleetSpecies,
  onFleetSpecies,
  fleetSpeciesList,
  todayIso,
  fleetState,
  fleetEmpty,
  fleetWindMissing,
  fleetStorm,
  onFleetRetry,
}: {
  fishOn: boolean;
  onFish: (on: boolean) => void;
  fishSpecies: string | null;
  /** nấc premium — "login"/"upgrade" = lớp cá khoá hẳn (thẻ khoá thay picker) */
  fishAccess: FeatureAccess;
  species: string[];
  regionShorts: Set<string>;
  onPickSpecies: (sp: string | null) => void;
  fleetAllowed: boolean;
  fleetOn: boolean;
  onFleet: (on: boolean) => void;
  fleetDay: number;
  onFleetDay: (k: number) => void;
  fleetSpecies: string | null;
  onFleetSpecies: (sp: string | null) => void;
  fleetSpeciesList: string[];
  todayIso: string;
  fleetState: "idle" | "loading" | "error" | "ok";
  fleetEmpty: boolean;
  fleetWindMissing: boolean;
  fleetStorm: boolean;
  onFleetRetry: () => void;
}) {
  const fishLocked = fishAccess === "login" || fishAccess === "upgrade";
  // Chọn loài XỔ RA ngay trong panel (dropdown), KHÔNG swap view/đổi bề rộng
  // panel nữa (user 2026-07-27: đừng nhảy panel giật ra giật vô).
  const [expanded, setExpanded] = useState(false);
  const name = fishSpecies
    ? SPECIES_META[fishSpecies]?.full ?? fishSpecies
    : "Mọi loài"; // nhãn nút chọn loài ≤2 chữ (rà Codex lần 8)
  return (
    <div>
      {/* KHÔNG nói tuổi bản đồ cá ở đây nữa (bỏ 2026-07-25 — màn hình rối) */}
      <Toggle
        label="Dự báo cá (vùng có khả năng tập trung)"
        sub="Theo ngày · ảnh vệ tinh"
        on={fishOn}
        onToggle={() => onFish(!fishOn)}
        icon={
          <span style={{ color: FISH_COLOR }}>
            <FishIcon className="h-5 w-5" />
          </span>
        }
      />
      {fishOn && fishLocked && (
        // PREMIUM (2026-07-26, thay teaser): lớp cá khoá HẲN — heatmap cũng
        // không hiện. Thẻ khoá nói đúng nấc: đăng nhập / gọi SDVICO nâng cấp.
        <PremiumLock
          access={fishAccess}
          feature="dự báo cá"
          compact
        />
      )}
      {fishOn && !fishLocked && (
        <>
          {/* Chú giải Thấp/TB/Cao ĐÃ DỜI ra nổi mép trái bản đồ (user
              2026-07-27) — không lặp lại trong panel nữa. */}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="mt-2 flex w-full items-center gap-2 rounded-xl bg-field px-3 py-2.5 text-left transition active:scale-[0.99]"
          >
            {/* khi MỞ dropdown → nhãn "Chọn loài" (≤2 chữ, rà Codex lần 9) + ẩn chấm, để KHÔNG trùng
                với item "Mọi loài" trong danh sách (user 2026-07-27) */}
            {!expanded && (
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{
                  background: fishSpecies
                    ? SPECIES_META[fishSpecies]?.color ?? FISH_COLOR
                    : FISH_COLOR,
                }}
                aria-hidden
              />
            )}
            <span className="min-w-0 flex-1 break-words text-[0.9375rem] font-semibold leading-snug text-navy">
              {expanded ? "Chọn loài" : name}
            </span>
            <ChevronRightIcon
              className={`h-4 w-4 shrink-0 text-navy/55 transition-transform ${
                expanded ? "rotate-90" : ""
              }`}
            />
          </button>

          {/* Danh sách loài dùng CHUNG thanh cuộn của panel (max-h-[62vh]
              overflow-y-auto ở div panel) — KHÔNG bọc khung cuộn riêng, tránh
              2 thanh scroll lồng nhau (user 2026-07-27). */}
          {expanded && (
            <div className="mt-2">
              <FishSpeciesContent
                species={species}
                current={fishSpecies}
                regionShorts={regionShorts}
                cols={1}
                onPick={(sp) => {
                  onPickSpecies(sp);
                  setExpanded(false);
                }}
              />
            </div>
          )}
        </>
      )}

      {/* MẬT ĐỘ TÀU DỰ KIẾN (2026-10-25): ước tính để tham khảo, chữ chỉ nói "mật độ tàu", không nói
          "có cá". Cùng khoá premium với lớp cá. */}
      {fleetAllowed && (
      <div className="mt-2">
        <Toggle
          label="Mật độ tàu dự kiến"
          sub="16 ngày tới · trăng, gió, bão, mùa"
          on={fleetOn}
          onToggle={() => onFleet(!fleetOn)}
          icon={
            <span className="text-navy">
              <RadarIcon className="h-5 w-5" />
            </span>
          }
        />
        {fleetOn && fishLocked && <PremiumLock access={fishAccess} feature="mật độ tàu" compact />}
        {fleetOn && !fishLocked && (
          <BaiTauDuBao
            day={fleetDay}
            onDay={onFleetDay}
            species={fleetSpecies}
            onSpecies={onFleetSpecies}
            speciesList={fleetSpeciesList}
            regionShorts={regionShorts}
            todayIso={todayIso}
            state={fleetState}
            empty={fleetEmpty}
            windMissing={fleetWindMissing}
            storm={fleetStorm}
            onRetry={onFleetRetry}
          />
        )}
      </div>
      )}
    </div>
  );
}

/** Chip chọn lát — nhãn ≤2 chữ, nền navy khi đang chọn (cùng ngữ pháp với chip chọn loài). */
function Chip({ on, onClick, children, title }: { on: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      title={title}
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-[0.8125rem] font-semibold leading-none transition active:scale-[0.97] ${
        on ? "bg-navy text-white" : "bg-field text-navy"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Bộ chọn DỰ BÁO mật độ tàu (anh Long 25/10: không chọn lịch sử): chip 16 ngày tới + lọc theo loài
 * (cùng kiểu chọn loài của lớp cá). Ma trận: đang tải · lỗi (chạm thử lại) · ngày trống · chưa có gió · có bão.
 */
function BaiTauDuBao({
  day,
  onDay,
  species,
  onSpecies,
  speciesList,
  regionShorts,
  todayIso,
  state,
  empty,
  windMissing,
  storm,
  onRetry,
}: {
  day: number;
  onDay: (k: number) => void;
  species: string | null;
  onSpecies: (sp: string | null) => void;
  speciesList: string[];
  regionShorts: Set<string>;
  todayIso: string;
  state: "idle" | "loading" | "error" | "ok";
  empty: boolean;
  windMissing: boolean;
  storm: boolean;
  onRetry: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (state === "loading" || state === "idle") {
    return <p className="mt-2 px-1 text-[0.8125rem] text-foreground/75">Đang tải mật độ tàu…</p>;
  }
  if (state === "error") {
    return (
      <button type="button" onClick={onRetry} className="mt-2 w-full rounded-xl bg-field px-3 py-2.5 text-left text-[0.8125rem] text-navy">
        Chưa tải được mật độ tàu — cần có sóng lần đầu. Chạm để thử lại.
      </button>
    );
  }
  const name = species ? SPECIES_META[species]?.full ?? species : "Mọi loài";
  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1.5 overflow-x-auto" role="radiogroup" aria-label="Ngày">
        {Array.from({ length: FLEET_FORECAST_DAYS }, (_, k) => (
          <Chip key={k} on={day === k} onClick={() => onDay(k)}>
            {chipLabel(addDaysIso(todayIso, k), todayIso)}
          </Chip>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 rounded-xl bg-field px-3 py-2.5 text-left transition active:scale-[0.99]"
      >
        <span className="min-w-0 flex-1 break-words text-[0.9375rem] font-semibold leading-snug text-navy">
          {expanded ? "Chọn loài" : name}
        </span>
        <ChevronRightIcon className={`h-4 w-4 shrink-0 text-navy/55 transition-transform ${expanded ? "rotate-90" : ""}`} />
      </button>
      {expanded && (
        <FishSpeciesContent
          species={speciesList}
          current={species}
          regionShorts={regionShorts}
          cols={1}
          onPick={(sp) => {
            onSpecies(sp);
            setExpanded(false);
          }}
        />
      )}

      <p className="px-1 text-[0.75rem] text-foreground/75">
        {empty
          ? "Ngày này chưa ước được ô nào."
          : storm
            ? "Có bão — tàu nằm bờ, mật độ hạ thấp."
            : windMissing
              ? "Chưa có gió ngày này — ước theo trăng, mùa."
              : "Ước theo trăng, gió, bão, mùa — tham khảo."}
      </p>
    </div>
  );
}

function ThoiTietPanel({
  stormInfo,
  forecastKind,
  onForecast,
  overlayField,
  onOverlayField,
  scalarKind,
  onScalar,
}: {
  stormInfo: StormStatus;
  forecastKind: ForecastKind | null;
  onForecast: (k: ForecastKind | null) => void;
  overlayField: FetchScalarKind | null;
  onOverlayField: (k: FetchScalarKind | null) => void;
  scalarKind: SeaScalarKind | null;
  onScalar: (k: SeaScalarKind | null) => void;
}) {
  const online = useOnline();
  // mốc lúc mở panel — panel chỉ sống khi bà con tự mở và tự thu sau 5s, đủ
  // tươi để tính tuổi tin bão (không gọi Date.now() trong lúc vẽ)
  const [openedAt] = useState(() => Date.now());
  return (
    <div>
      <p className="mb-1 flex items-center justify-between text-[0.75rem] font-semibold text-foreground/55">
        <span>Cảnh báo bão</span>
        <span className="text-danger">Ưu tiên cao nhất</span>
      </p>
      {/* BỐN trạng thái tách bạch — "chưa hỏi được" KHÔNG bao giờ được hiện
          thành "không có bão" (lib/storms.ts stormStatus) */}
      {stormInfo.kind === "co-bao" &&
        stormInfo.storms.map((s) => (
          <div
            key={s.id}
            className="mb-2 flex items-center gap-2 rounded-xl bg-danger-bg px-2.5 py-2"
          >
            <AlertIcon className="h-5 w-5 shrink-0 text-danger" />
            <span className="min-w-0 flex-1">
              <span className="block text-[0.9375rem] font-semibold leading-tight text-danger">
                {s.kindLabel} {s.name}
              </span>
              <span
                className={`block text-[0.8125rem] leading-snug ${
                  stormInfo.cu ? "font-semibold text-warn" : "text-foreground/75"
                }`}
              >
                {stormInfo.checkedAt != null
                  ? `Cập nhật lúc ${clockVN(stormInfo.checkedAt)}`
                  : "Chưa rõ giờ báo tin"}
                {stormInfo.cu && " · bản tin cũ lưu trong máy"}
              </span>
            </span>
          </div>
        ))}
      {stormInfo.kind === "khong-co" && (
        <p className="mb-2 rounded-xl bg-ok-bg px-2.5 py-2 text-[0.8125rem] font-semibold leading-snug text-ok">
          Không có tin bão trên Biển Đông (hỏi lúc{" "}
          {clockVN(stormInfo.checkedAt)}).
        </p>
      )}
      {stormInfo.kind === "khong-hoi-duoc" && (
        <p className="mb-2 flex items-start gap-2 rounded-xl bg-warn-bg px-2.5 py-2 text-[0.875rem] font-semibold leading-snug text-warn">
          <AlertIcon className="mt-0.5 h-5 w-5 shrink-0" />
          {/* CÙNG MỘT CÂU với banner bão (lib/storms.ts stormNoticeText) — nói
              bằng tuổi tin, không đổ cho máy khi nguồn lỗi (audit S13/M5).
              Giờ lấy lúc mở panel (openedAt). */}
          <span>{stormNoticeText(stormInfo, openedAt, online)}</span>
        </p>
      )}
      {stormInfo.kind === "dang-hoi" && (
        <p className="mb-2 rounded-xl bg-field/70 px-2.5 py-2 text-[0.8125rem] font-semibold text-foreground/70">
          Đang hỏi tin bão…
        </p>
      )}

      <p className="mb-1 mt-3 text-[0.75rem] font-semibold text-foreground/55">
        Lớp thời tiết khác
      </p>
      <Toggle
        label="Gió"
        sub="Theo giờ · cập nhật vài giờ một lần"
        on={forecastKind === "wind"}
        onToggle={() => onForecast(forecastKind === "wind" ? null : "wind")}
        icon={<WindIcon className="h-5 w-5 text-t1" />}
      />
      <Toggle
        label="Sóng"
        sub="Theo giờ · cập nhật vài giờ một lần"
        on={forecastKind === "wave"}
        onToggle={() => onForecast(forecastKind === "wave" ? null : "wave")}
        icon={<WindIcon className="h-5 w-5 text-t2" />}
      />
      {/* DÒNG CHẢY mặt biển — nguồn dự báo tới ~10 ngày (SMOC), ngày xa hơn lớp
          tự trống. Mũi tên chỉ hướng nước CHẢY VỀ. */}
      <Toggle
        label="Dòng chảy"
        sub="Theo giờ · dự báo lên tới ~10 ngày"
        on={forecastKind === "current"}
        onToggle={() => onForecast(forecastKind === "current" ? null : "current")}
        icon={
          <span
            className="h-5 w-5 shrink-0 rounded"
            style={{ background: scalarGradientCss("currentspeed") }}
            aria-hidden
          />
        }
      />
      {/* LỚP DẢI MÀU (mây/mưa/nhiệt) — dự báo theo giờ, dùng chung thanh giờ với
          gió/sóng, LOẠI TRỪ nhau (một lớp overlay mỗi lần, như Windy). */}
      {(
        ["cloud", "rain", "airtemp", "storm", "pressure", "salinity"] as FetchScalarKind[]
      ).map((k) => (
        <Toggle
          key={k}
          label={SCALAR_META[k].label}
          sub={SCALAR_META[k].help}
          on={overlayField === k}
          onToggle={() => onOverlayField(overlayField === k ? null : k)}
          icon={
            <span
              className="h-5 w-5 shrink-0 rounded"
              style={{ background: scalarGradientCss(k) }}
              aria-hidden
            />
          }
        />
      ))}
      <Toggle
        label="Nước dâng/xoáy"
        sub="Theo ngày · độ trễ ~2 ngày"
        on={scalarKind === "ssha"}
        onToggle={() => onScalar(scalarKind === "ssha" ? null : "ssha")}
        icon={<EddyIcon className="h-5 w-5 text-t4" />}
      />
      <p className="mt-2 text-[0.8125rem] leading-snug text-foreground/75">
        Mấy lớp này chỉ để coi cho biết; lúc mạng chập chờn máy sẽ báo “thử
        lại”. Muốn biết gió, sóng ngay chỗ nào thì chạm vào chỗ đó trên bản đồ.
      </p>
    </div>
  );
}

function DiemPanel({
  cursor,
  prefillTick,
  addOpen: addOpenProp,
  onAddOpenChange,
  showPlaces,
  onShowPlaces,
  places,
  onPlaces,
  onGoPlace,
  onClose,
}: {
  cursor?: { lat: number; lon: number } | null;
  /** >0 = form vừa mở do menu chạm-giữ → điền sẵn toạ độ con trỏ */
  prefillTick?: number;
  addOpen?: boolean;
  onAddOpenChange?: (v: boolean) => void;
  showPlaces: boolean;
  onShowPlaces: (on: boolean) => void;
  places: SavedPlace[];
  onPlaces: (next: SavedPlace[]) => void;
  onGoPlace: (lat: number, lon: number) => void;
  onClose: () => void;
}) {
  const [addOpenLocal, setAddOpenLocal] = useState(false);
  const addOpen = addOpenProp ?? addOpenLocal;
  const setAddOpen = (v: boolean) => {
    setAddOpenLocal(v);
    onAddOpenChange?.(v);
  };
  return (
    <div>
      {/*  NÚT KHÔNG ĂN RIÊNG MỘT HÀNG (03-design-system §Nút hành động): trước
           đây "Thêm điểm" là một dải viền đứt chiếm trọn một hàng của panel —
           đúng thứ chủ dự án chê. Nay nó là ô vuông cùng khuôn rail, nằm INLINE
           cuối hàng toggle. */}
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <Toggle
            label="Hiển thị trên bản đồ"
            on={showPlaces}
            onToggle={() => onShowPlaces(!showPlaces)}
            icon={<StarIcon className="h-5 w-5 text-navy" />}
          />
        </div>
        {/*  HÀNG KHÔNG CÓ NÚT VẪN CHỪA Ô (03-design-system §Nút hành động):
             trước đây form mở là nút biến mất HẲN, toggle nở từ 199px ra 271px
             — cùng một hàng mà đổi khuôn giữa hai trạng thái, mép phải nhảy.
             Ô trống giữ mép phải thẳng, đúng khuôn đã có ở route-planner. */}
        {!addOpen ? (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            aria-label="Thêm điểm mới"
            /*  DÙNG KHUÔN CHUNG, KHÔNG CHÉP TAY (2026-08-29h): chuỗi cũ là
                bản chép của `SQ_TILE` nên nó KHÔNG ăn theo `--row-h` — chế độ
                "Gọn" hạ mọi nút xuống 37px thì riêng nút này vẫn 52px. Đúng
                bài học hai-bản-chép-tay đã ghi ngay trong file sq-btn.ts. */
            className={`${SQ_TILE} bg-t1 text-white`}
          >
            <PlusIcon className="h-6 w-6" />
            Thêm điểm
          </button>
        ) : null}
      </div>
      <div className="mt-3">
        {/* quản lý điểm NGAY trong panel — compact cho rail hẹp */}
        <MyPlacesContent
          cursor={cursor}
          prefillTick={prefillTick}
          addOpen={addOpen}
          onAddOpenChange={setAddOpen}
          hideAddButton
          places={places}
          onPlaces={onPlaces}
          onGo={onGoPlace}
          onClose={onClose}
        />
      </div>
    </div>
  );
}

// Ô GÕ TAY TOẠ ĐỘ — hai ô (vĩ · kinh), bỏ trống hướng thì mặc định Bắc/Đông.
// Nhận độ thập phân (8,5), độ-phút (8 30) hay độ-phút-giây (8 30 15). Không cần
// mạng — thuần đọc chuỗi rồi bay tới điểm.
function GoToPointPopup({
  onGoCoord,
  onClose,
}: {
  onGoCoord: (lat: number, lon: number) => void;
  onClose: () => void;
}) {
  const prefs = useMapPrefs();
  const [latText, setLatText] = useState("");
  const [lonText, setLonText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  // ví dụ gõ theo hệ toạ độ đang chọn (khớp cách máy định vị bà con hiển thị)
  const eg =
    prefs.coordFormat === "dms"
      ? { lat: "8 30", lon: "109 18" }
      : { lat: "8,5", lon: "109,3" };

  const submit = () => {
    const pair = parseCoordPair(latText, lonText);
    if (!pair) {
      setErr("Định dạng toạ độ chưa đúng. Bà con xem lại ví dụ bên dưới nhé.");
      return;
    }
    onGoCoord(pair.lat, pair.lon);
    onClose();
  };

  return (
    <div>
      <PanelHeader title="Đến điểm — nhập toạ độ" onClose={onClose} />
      <label className="mb-2 block">
        <input
          type="text"
          inputMode="text"
          value={latText}
          onChange={(e) => {
            setLatText(e.target.value);
            setErr(null);
          }}
          placeholder={`vd ${eg.lat}`}
          aria-label="Vĩ độ"
          className="min-h-[3rem] w-full rounded-xl bg-field px-3 text-[1rem] font-semibold tabular-nums text-navy outline-none focus:ring-2 focus:ring-t1"
        />
      </label>
      <label className="mb-2 block">
        <input
          type="text"
          inputMode="text"
          value={lonText}
          onChange={(e) => {
            setLonText(e.target.value);
            setErr(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder={`vd ${eg.lon}`}
          aria-label="Kinh độ"
          className="min-h-[3rem] w-full rounded-xl bg-field px-3 text-[1rem] font-semibold tabular-nums text-navy outline-none focus:ring-2 focus:ring-t1"
        />
      </label>
      {err && (
        <p className="mb-2 flex items-start gap-1.5 rounded-xl bg-warn-bg px-2.5 py-2 text-[0.8125rem] font-semibold leading-snug text-warn">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{err}</span>
        </p>
      )}
      <button
        type="button"
        onClick={submit}
        className="min-h-[3.25rem] w-full rounded-xl bg-navy text-[1rem] font-semibold text-white transition active:scale-[0.99]"
      >
        Đến điểm
      </button>
      {/*  ĐÃ BỎ đoạn "Gõ độ-phút (vd 8 30) hoặc độ thập phân… thêm chữ S/W
           hoặc dấu trừ" (2026-08-29). Ví dụ gõ đã nằm ngay trong placeholder
           của chính ô, theo đúng hệ đang cài — nhắc lại ở dưới là dạy lại thứ
           vừa chỉ. Phần S/W là ca hiếm (biển mình Bắc/Đông); ai gõ vào vẫn đọc
           được, và gõ sai thì câu lỗi nói đúng cách gõ. */}
    </div>
  );
}

// thẻ chọn 1 (radio) cho Cài đặt — icon ✓ + tiêu đề + ví dụ
function RadioCard({
  active,
  onClick,
  title,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`flex min-h-[3.25rem] w-full items-center gap-2.5 rounded-xl bg-field px-3 py-2 text-left transition active:scale-[0.99] ${active ? "ring-2 ring-t1" : ""}`}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${active ? "border-t1 bg-t1 text-white" : "border-line"}`}
        aria-hidden
      >
        {active && <CheckIcon className="h-3 w-3" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-semibold leading-tight text-navy">
          {title}
        </span>
        <span className="block text-[0.8125rem] text-foreground/75">{sub}</span>
      </span>
    </button>
  );
}

function SettingsPanel({ vmsZones }: { vmsZones: VmsZone[] }) {
  const prefs = useMapPrefs();
  return (
    <div>
      <p className="mb-2 text-[0.75rem] font-semibold text-foreground/55">
        Đơn vị khoảng cách
      </p>
      <div className="grid grid-cols-2 gap-2">
        <RadioCard
          active={prefs.distUnit === "nm"}
          onClick={() => setMapPrefs({ distUnit: "nm" })}
          title="Hải lý"
          sub="nm · đơn vị chuẩn đi biển"
        />
        <RadioCard
          active={prefs.distUnit === "km"}
          onClick={() => setMapPrefs({ distUnit: "km" })}
          title="Ki-lô-mét"
          sub="km"
        />
      </div>

      <p className="mb-2 mt-3 text-[0.75rem] font-semibold text-foreground/55">
        Hệ toạ độ
      </p>
      <div className="space-y-2">
        <RadioCard
          active={prefs.coordFormat === "dms"}
          onClick={() => setMapPrefs({ coordFormat: "dms" })}
          title="Độ – phút – giây"
          sub="vd 8°30′00″N · 109°18′00″E"
        />
        <RadioCard
          active={prefs.coordFormat === "dd"}
          onClick={() => setMapPrefs({ coordFormat: "dd" })}
          title="Độ thập phân"
          sub="vd 8,50°N · 109,30°E"
        />
      </div>

      {/* GIỌNG ĐỌC khi chạy (doc 15 §9) — mức đọc + Nghe thử + tải giọng */}
      <VoiceSettingsSection />

      <p className="mt-3 rounded-xl bg-field/70 px-2.5 py-2 text-[0.75rem] leading-snug text-foreground/70">
        Đổi ở đây thì toạ độ, khoảng cách, dẫn đường và công cụ đo đều đổi theo.
      </p>

      <p className="mb-1 mt-4 text-[0.75rem] font-semibold text-foreground/55">
        Lớp bản đồ
      </p>
      <Toggle
        label="Lưới toạ độ"
        sub="Kẻ kinh/vĩ tuyến 1° trên bản đồ · không liên quan đến dự báo cá"
        on={prefs.mapGrid}
        onToggle={() => setMapPrefs({ mapGrid: !prefs.mapGrid })}
        icon={<GridIcon className="h-5 w-5 text-navy" />}
      />
      <div className="mb-2" />
      <Toggle
        label="Ranh giới vùng lộng"
        sub="NĐ 26/2019 · tàu 12–<15m · mang tính tham khảo"
        on={prefs.vungLong}
        onToggle={() => setMapPrefs({ vungLong: !prefs.vungLong })}
        icon={<DepthIcon className="h-5 w-5 text-trim" />}
      />
      <div className="mb-2" />
      {/* KHU BẢO TỒN · VÙNG CẤM KHAI THÁC (2026-10-14) — lớp miễn phí, mặc định
          BẬT. Tắt chỉ là chuyện NHÌN: dẫn đường vẫn nhắc "đang trong khu…"
          (lib/vung-quan-ly.ts — kho dẫn đường nạp không phụ thuộc công tắc). */}
      <Toggle
        label="Khu bảo tồn, vùng cấm đánh bắt"
        sub="27 khu bảo tồn · vùng cấm theo mùa · khu bảo vệ nguồn lợi · tham khảo"
        on={prefs.vungQuanLy}
        onToggle={() => setMapPrefs({ vungQuanLy: !prefs.vungQuanLy })}
        icon={<AlertIcon className="h-5 w-5 text-trim" />}
      />
      <div className="mb-2" />
      {/* TRẠM CON NƯỚC (2026-09-04) — lớp miễn phí, mặc định BẬT, bà con tắt
          được. Không thuộc "Hải đồ chi tiết": chạm trạm là ra con nước, kể cả
          khi đang xem nền vệ tinh. */}
      <Toggle
        label="Trạm con nước"
        sub="11 trạm · chạm vào trạm để xem giờ nước lớn, nước ròng"
        on={prefs.tideStations}
        onToggle={() => setMapPrefs({ tideStations: !prefs.tideStations })}
        icon={<WavesIcon className="h-5 w-5 text-t1" />}
      />

      {vmsZones.length > 0 && (
        <>
          <p className="mb-1 mt-4 text-[0.75rem] font-semibold text-foreground/55">
            Vùng biển (dữ liệu VMS)
          </p>
          {vmsZones.map((zone, i) => (
            <div key={zone.id}>
              {i > 0 && <div className="mb-2" />}
              <Toggle
                label={zone.name}
                sub={
                  zone.style === "line-dashed"
                    ? "Viền nét đứt · mang tính tham khảo"
                    : zone.style === "fill"
                      ? "Vùng tô nền · mang tính tham khảo"
                      : "Viền · mang tính tham khảo"
                }
                on={isVmsZoneOn(prefs.vmsOverrides, zone.id, zone.defaultOn)}
                onToggle={() =>
                  setVmsZoneOn(
                    zone.id,
                    !isVmsZoneOn(prefs.vmsOverrides, zone.id, zone.defaultOn),
                  )
                }
                icon={
                  <span style={{ color: zone.color }}>
                    <AnchorIcon className="h-5 w-5" />
                  </span>
                }
              />
            </div>
          ))}
          <p className="mt-2 text-[0.8125rem] leading-snug text-foreground/75">
            Các ranh giới trên chỉ để hình dung (dữ liệu VMS{" "}
            {VMS_ZONES_UPDATED.split("-").reverse().join("/")}) — ranh chính
            thức tra Chi cục Thủy sản.
          </p>
        </>
      )}

      <AppVersionLine />
    </div>
  );
}

function ToolsPanel({
  measureMode,
  onMeasureMode,
  measureCount,
  measureResult,
  onClearMeasure,
}: {
  measureMode: boolean;
  onMeasureMode: (on: boolean) => void;
  measureCount: number;
  measureResult: { dist: string; dir: string } | null;
  onClearMeasure: () => void;
}) {
  return (
    <div>
      <Toggle
        label="Đo khoảng cách"
        sub="Chạm 2 điểm trên bản đồ"
        on={measureMode}
        onToggle={() => onMeasureMode(!measureMode)}
        icon={<RulerIcon className="h-5 w-5 text-t1" />}
      />
      {measureMode && (
        <>
          {measureResult ? (
            <div className="mt-2 rounded-xl bg-field px-3 py-2.5">
              <p className="text-[0.75rem] font-semibold text-foreground/55">
                Khoảng cách 2 điểm
              </p>
              <p className="display mt-0.5 text-[1.25rem] font-semibold leading-none text-navy">
                {measureResult.dist}
              </p>
              <p className="mt-1 text-[0.8125rem] text-foreground/70">
                Hướng điểm 1 → điểm 2: {measureResult.dir}
              </p>
            </div>
          ) : (
            <p className="mt-2 rounded-xl bg-field/70 px-2.5 py-2 text-[0.8125rem] font-semibold leading-snug text-t1">
              {measureCount === 0
                ? "Bà con chạm điểm thứ nhất trên bản đồ nhé."
                : "Chạm thêm điểm thứ hai để xem khoảng cách."}
            </p>
          )}
          {measureCount > 0 && (
            <button
              type="button"
              onClick={onClearMeasure}
              className="mt-2 min-h-[3rem] w-full rounded-xl bg-field text-[0.9375rem] font-semibold text-navy transition active:scale-[0.99]"
            >
              Xoá, đo lại
            </button>
          )}
          <p className="mt-2 text-[0.8125rem] leading-snug text-foreground/75">
            Khoảng cách đường chim bay (không theo tuyến né cạn). Đổi đơn vị
            hải lý/km ở Cài đặt.
          </p>
        </>
      )}
    </div>
  );
}

function Toggle({
  label,
  sub,
  on,
  onToggle,
  icon,
}: {
  label: string;
  /*  Dòng phụ TUỲ CHỌN (2026-08-29): chủ dự án yêu cầu bỏ các câu giải thích
      không cấp dữ liệu. Toggle nào mà nhãn đã tự nói hết thì không truyền
      `sub` — đỡ một dòng chữ trong panel vốn đã chật. */
  sub?: string;
  on: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="flex min-h-[3.25rem] w-full items-center gap-2.5 rounded-xl bg-field px-3 text-left transition active:scale-[0.99]"
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-semibold leading-tight text-navy">
          {label}
        </span>
        {sub && (
          <span className="block text-[0.8125rem] text-foreground/75">{sub}</span>
        )}
      </span>
      <span
        className={`flex h-7 w-12 shrink-0 items-center rounded-full px-0.5 transition ${on ? "justify-end bg-ok" : "justify-start bg-line"}`}
        aria-hidden
      >
        <span className="h-6 w-6 rounded-full bg-white shadow" />
      </span>
    </button>
  );
}

