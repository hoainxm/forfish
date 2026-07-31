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
import type { FeatureAccess } from "@/lib/tier";
import { PremiumLock } from "@/components/premium-gate";
import type { StormStatus } from "@/lib/storms";
import { clockVN } from "@/lib/day-labels";
import type { SavedPlace } from "@/lib/places";
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
  CrosshairIcon,
  GridIcon,
  LayersIcon,
  EddyIcon,
  FishIcon,
  RulerIcon,
  SettingsIcon,
  StarIcon,
  WindIcon,
} from "@/components/icons";

const FISH_COLOR = "#2d8659"; // xanh lá — cá/ngư trường (design Phương án A)

// rail xổ ra mà bà con không chạm gì 5s → tự thu (user 2026-07-28)
const AUTO_HIDE_MS = 5000;

type PanelId =
  | "hai-do"
  | "ngu-truong"
  | "thoi-tiet"
  | "diem"
  | "cai-dat"
  | "cong-cu";

// nhịp cập nhật → chấm màu (design §3): 🟥 liên tục 🟧 giờ 🟨 ngày ⬛ cố định
const DOT: Record<string, string> = {
  lienTuc: "#e4572e",
  gio: "#f59e0b",
  ngay: "#eab308",
  coDinh: "#64748b",
};

export function RaKhoiControls({
  layerId,
  onLayer,
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
  onLocateMe,
  locating,
  geoError,
}: {
  /** Bấm "Vị trí" → lấy GPS rồi bay tới chỗ mình (fishing-map-view lo phần đó) */
  onLocateMe: () => void;
  /** đang xin GPS — nút phải nói đang chạy, đừng để bà con bấm hoài */
  locating: boolean;
  /** máy từ chối / không có GPS — PHẢI nói, không được câm (nguyên tắc trung thực) */
  geoError: boolean;
  layerId: OceanLayerId;
  onLayer: (id: OceanLayerId) => void;
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
      dot: fishOn,
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
    { id: "diem", label: "Điểm đã lưu", icon: StarIcon, color: "var(--navy)" },
    {
      id: "cong-cu",
      label: "Công cụ",
      icon: RulerIcon,
      color: "var(--t1)",
      dot: measureMode,
    },
    { id: "cai-dat", label: "Cài đặt", icon: SettingsIcon, color: "var(--navy)" },
  ];

  return (
    <div
      className="pointer-events-none relative flex justify-end gap-2"
      // mọi chạm/gõ phím trong rail + panel = "thao tác" → hoãn tự thu 5s
      onPointerDownCapture={() => !collapsed && armAutoHide()}
      onKeyDownCapture={() => !collapsed && armAutoHide()}
    >
      {/* KHÔNG còn thẻ "Chuẩn bị đi biển" ở đây (bỏ 2026-07-25): máy TỰ tải sẵn
          khi vào trang và chỉ báo một dòng nhỏ tự tắt — xem
          components/pretrip-auto-notify.tsx. Bản đồ nhờ vậy sạch chữ. */}

      {/* PANEL neo TRÁI rail, bounded trong màn (không tràn/đè banner).
          Panel nhiều nội dung (Điểm đã lưu, Chọn loài) rộng hơn cho dễ nhìn,
          khỏi chồng chéo (user 2026-06-23); panel đơn giản giữ cân đối. */}
      {open && !collapsed && (
        <div
          className={`pointer-events-auto absolute right-[4.5rem] top-0 max-h-[62vh] overflow-y-auto rounded-2xl bg-card/97 p-3 shadow-xl [overscroll-behavior:contain] ${
            open === "diem"
              ? "w-[22rem] max-w-[calc(100vw-4.25rem)]"
              : "w-[16.5rem] max-w-[calc(100vw-5rem)]"
          }`}
        >
          {
            <>
              <PanelHeader
                title={PANEL_TITLE[open]}
                onClose={() => setOpen(null)}
              />
              {open === "hai-do" && (
                <HaiDoPanel
                  layerId={layerId}
                  scalarKind={scalarKind}
                  onLayer={(id) => {
                    onScalar(null);
                    onLayer(id);
                  }}
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
        </div>
      )}

      {/* RAIL dọc mép phải — ẩn/hiện được như menu lớp các app bản đồ */}
      <div className="pointer-events-auto flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={() => {
            if (!collapsed) setOpen(null);
            setCollapsed((c) => !c);
          }}
          aria-label={collapsed ? "Hiện lớp bản đồ" : "Ẩn bảng lớp"}
          aria-expanded={!collapsed}
          className="flex min-h-[3.25rem] w-16 flex-col items-center justify-center gap-0.5 rounded-2xl bg-navy py-2 text-white shadow-md transition active:scale-95"
        >
          {collapsed ? (
            <LayersIcon className="h-6 w-6" />
          ) : (
            <ChevronRightIcon className="h-5 w-5" />
          )}
          <span className="text-[0.6875rem] font-bold leading-tight">
            {collapsed ? "Lớp" : "Ẩn"}
          </span>
        </button>

        {/* VỊ TRÍ — nút GPS chuẩn như mọi app bản đồ. Đặt ngay dưới nút Lớp
            (chỗ tay phải với tới được), luôn hiện kể cả khi thu bảng lớp. */}
        <button
          type="button"
          onClick={onLocateMe}
          disabled={locating}
          aria-label="Vị trí của tôi (GPS)"
          aria-busy={locating}
          className={`flex min-h-[3.25rem] w-16 flex-col items-center justify-center gap-0.5 rounded-2xl py-2 shadow-md transition active:scale-95 disabled:opacity-70 ${
            geoError ? "bg-warn-bg text-warn-fg" : "bg-navy text-white"
          }`}
        >
          <CrosshairIcon className={`h-6 w-6 ${locating ? "animate-pulse" : ""}`} />
          <span className="text-[0.6875rem] font-bold leading-tight">
            {locating ? "Đang tìm" : geoError ? "Bật GPS" : "Vị trí"}
          </span>
        </button>
        {!collapsed &&
          RAIL.map((r) => {
          const active = open === r.id;
          const Icon = r.icon;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setOpen(active ? null : r.id)}
              aria-pressed={active}
              className="relative flex min-h-[3.75rem] w-16 flex-col items-center justify-center gap-0.5 rounded-2xl py-2 shadow-md transition active:scale-95"
              style={
                active
                  ? { background: r.color, color: "#fff" }
                  : { background: "var(--card)", color: "var(--navy)" }
              }
            >
              {r.dot && !active && (
                <span
                  className="absolute right-2 top-2 h-2 w-2 rounded-full"
                  style={{ background: r.color }}
                  aria-hidden
                />
              )}
              <Icon className="h-6 w-6" />
              <span className="text-[0.6875rem] font-bold leading-tight">
                {r.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const PANEL_TITLE: Record<PanelId, string> = {
  "hai-do": "Hải đồ — Lớp nền",
  "ngu-truong": "Ngư trường — Lớp cá",
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
              className="-ml-1 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-field text-navy"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
          )}
          <div className="min-w-0">
            <span className="inline-block rounded-md bg-navy px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-white">
              Điều khiển
            </span>
            <h3 className="display mt-1 text-[1rem] font-bold leading-tight text-navy">
              {title}
            </h3>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-field text-navy"
        >
          ✕
        </button>
      </div>
      <p className="mt-1 text-[0.75rem] leading-snug text-foreground/65">
        Chọn dữ liệu nào hiện trên bản đồ · số liệu điểm nằm ở sheet dưới
      </p>
    </div>
  );
}

function cadLine(id: OceanLayerId): { text: string; dot: string } {
  const def = OCEAN_LAYERS[id];
  if (!def.dated) return { text: "Cố định · Không đổi theo ngày", dot: DOT.coDinh };
  // Ảnh vệ tinh theo ngày (KHÔNG phải dự báo). Bỏ số "trễ ~2 ngày" khỏi UI
  // (user 2026-07-29: ngư dân không cần biết), nhưng vẫn ghi "ảnh vệ tinh" để
  // khỏi nhầm với lớp dự báo mây/gió/sóng. `lagDays` vẫn dùng để lấy ảnh mới nhất.
  return { text: "Ảnh vệ tinh · theo ngày", dot: DOT.ngay };
}

function HaiDoPanel({
  layerId,
  scalarKind,
  onLayer,
}: {
  layerId: OceanLayerId;
  scalarKind: SeaScalarKind | null;
  onLayer: (id: OceanLayerId) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-[0.75rem] font-bold uppercase tracking-wide text-foreground/55">
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
                  <span className="block text-[0.9375rem] font-bold leading-tight text-navy">
                    {def.label}
                  </span>
                  <span className="flex items-center gap-1 text-[0.6875rem] leading-tight text-foreground/65">
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
        Ảnh vệ tinh, không phải thời gian thực. Phao báo hiệu chỉ hiện khi phóng
        to gần bờ.
      </p>
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
}: {
  fishOn: boolean;
  onFish: (on: boolean) => void;
  fishSpecies: string | null;
  /** nấc premium — "login"/"upgrade" = lớp cá khoá hẳn (thẻ khoá thay picker) */
  fishAccess: FeatureAccess;
  species: string[];
  regionShorts: Set<string>;
  onPickSpecies: (sp: string | null) => void;
}) {
  const fishLocked = fishAccess === "login" || fishAccess === "upgrade";
  // Chọn loài XỔ RA ngay trong panel (dropdown), KHÔNG swap view/đổi bề rộng
  // panel nữa (user 2026-07-27: đừng nhảy panel giật ra giật vô).
  const [expanded, setExpanded] = useState(false);
  const name = fishSpecies
    ? SPECIES_META[fishSpecies]?.full ?? fishSpecies
    : "Mọi loài cá";
  return (
    <div>
      {/* KHÔNG nói tuổi bản đồ cá ở đây nữa (bỏ 2026-07-25 — màn hình rối) */}
      <Toggle
        label="Dự báo cá (PFZ)"
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
            className="mt-2 flex w-full items-center gap-2 rounded-xl bg-field px-3 py-2.5 text-left active:scale-[0.99]"
          >
            {/* khi MỞ dropdown → nhãn "Chọn loài cá" + ẩn chấm, để KHÔNG trùng
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
            <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-bold text-navy">
              {expanded ? "Chọn loài cá" : name}
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
  return (
    <div>
      <p className="mb-1 flex items-center justify-between text-[0.75rem] font-bold uppercase tracking-wide text-foreground/55">
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
              <span className="block text-[0.9375rem] font-bold leading-tight text-danger">
                {s.kindLabel} {s.name}
              </span>
              <span
                className={`block text-[0.8125rem] leading-snug ${
                  stormInfo.cu ? "font-bold text-warn" : "text-foreground/65"
                }`}
              >
                {stormInfo.checkedAt != null
                  ? `Tin lúc ${clockVN(stormInfo.checkedAt)}`
                  : "Chưa rõ tin lúc nào"}
                {stormInfo.cu && " · tin cũ trong máy"}
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
        <p className="mb-2 flex items-start gap-2 rounded-xl bg-warn-bg px-2.5 py-2 text-[0.875rem] font-bold leading-snug text-warn">
          <AlertIcon className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            Chưa hỏi được tin bão — máy không có sóng. Nghe thêm đài duyên hải /
            Icom.
          </span>
        </p>
      )}
      {stormInfo.kind === "dang-hoi" && (
        <p className="mb-2 rounded-xl bg-field/70 px-2.5 py-2 text-[0.8125rem] font-semibold text-foreground/70">
          Đang hỏi tin bão…
        </p>
      )}

      <p className="mb-1 mt-3 text-[0.75rem] font-bold uppercase tracking-wide text-foreground/55">
        Lớp thời tiết khác
      </p>
      <Toggle
        label="Gió"
        sub="Theo giờ · cập nhật vài giờ"
        on={forecastKind === "wind"}
        onToggle={() => onForecast(forecastKind === "wind" ? null : "wind")}
        icon={<WindIcon className="h-5 w-5 text-t1" />}
      />
      <Toggle
        label="Sóng"
        sub="Theo giờ · cập nhật vài giờ"
        on={forecastKind === "wave"}
        onToggle={() => onForecast(forecastKind === "wave" ? null : "wave")}
        icon={<WindIcon className="h-5 w-5 text-t2" />}
      />
      {/* DÒNG CHẢY mặt biển — nguồn dự báo tới ~10 ngày (SMOC), ngày xa hơn lớp
          tự trống. Mũi tên chỉ hướng nước CHẢY VỀ. */}
      <Toggle
        label="Dòng chảy"
        sub="Theo giờ · dự báo tới ~10 ngày"
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
        sub="SSHA · theo ngày, chậm ~2 ngày"
        on={scalarKind === "ssha"}
        onToggle={() => onScalar(scalarKind === "ssha" ? null : "ssha")}
        icon={<EddyIcon className="h-5 w-5 text-t4" />}
      />
      <p className="mt-2 text-[0.6875rem] leading-snug text-foreground/60">
        Mọi lớp đều là số liệu tham khảo; nguồn có thể tạm gián đoạn và sẽ báo
        “thử lại”. Gió/sóng tại ĐIỂM xem ở sheet khi chạm.
      </p>
    </div>
  );
}

function DiemPanel({
  showPlaces,
  onShowPlaces,
  places,
  onPlaces,
  onGoPlace,
  onClose,
}: {
  showPlaces: boolean;
  onShowPlaces: (on: boolean) => void;
  places: SavedPlace[];
  onPlaces: (next: SavedPlace[]) => void;
  onGoPlace: (lat: number, lon: number) => void;
  onClose: () => void;
}) {
  return (
    <div>
      <Toggle
        label="Hiện trên bản đồ"
        sub="Đánh dấu các điểm đã lưu"
        on={showPlaces}
        onToggle={() => onShowPlaces(!showPlaces)}
        icon={<StarIcon className="h-5 w-5 text-navy" />}
      />
      <div className="mt-3">
        {/* quản lý điểm NGAY trong panel — compact cho rail hẹp */}
        <MyPlacesContent
          places={places}
          onPlaces={onPlaces}
          onGo={onGoPlace}
          onClose={onClose}
          compact
        />
      </div>
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
        <span className="block text-[0.9375rem] font-bold leading-tight text-navy">
          {title}
        </span>
        <span className="block text-[0.6875rem] text-foreground/65">{sub}</span>
      </span>
    </button>
  );
}

function SettingsPanel({ vmsZones }: { vmsZones: VmsZone[] }) {
  const prefs = useMapPrefs();
  return (
    <div>
      <p className="mb-2 text-[0.75rem] font-bold uppercase tracking-wide text-foreground/55">
        Đơn vị khoảng cách
      </p>
      <div className="grid grid-cols-2 gap-2">
        <RadioCard
          active={prefs.distUnit === "nm"}
          onClick={() => setMapPrefs({ distUnit: "nm" })}
          title="Hải lý"
          sub="nm · chuẩn đi biển"
        />
        <RadioCard
          active={prefs.distUnit === "km"}
          onClick={() => setMapPrefs({ distUnit: "km" })}
          title="Ki-lô-mét"
          sub="km"
        />
      </div>

      <p className="mb-2 mt-3 text-[0.75rem] font-bold uppercase tracking-wide text-foreground/55">
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

      <p className="mt-3 rounded-xl bg-field/70 px-2.5 py-2 text-[0.75rem] leading-snug text-foreground/70">
        Đổi ở đây thì toạ độ, khoảng cách, dẫn đường và công cụ đo đều đổi theo.
      </p>

      <p className="mb-1 mt-4 text-[0.75rem] font-bold uppercase tracking-wide text-foreground/55">
        Lớp bản đồ
      </p>
      <Toggle
        label="Lưới kẻ ô (toạ độ)"
        sub="Kẻ kinh/vĩ tuyến 1° trên bản đồ · không liên quan dự báo cá"
        on={prefs.mapGrid}
        onToggle={() => setMapPrefs({ mapGrid: !prefs.mapGrid })}
        icon={<GridIcon className="h-5 w-5 text-navy" />}
      />
      <div className="mb-2" />
      <Toggle
        label="Ranh giới vùng lộng"
        sub="NĐ 26/2019 · tàu 12–<15m · tham khảo"
        on={prefs.vungLong}
        onToggle={() => setMapPrefs({ vungLong: !prefs.vungLong })}
        icon={<DepthIcon className="h-5 w-5 text-[#0d9488]" />}
      />

      {vmsZones.length > 0 && (
        <>
          <p className="mb-1 mt-4 text-[0.75rem] font-bold uppercase tracking-wide text-foreground/55">
            Vùng biển (dữ liệu VMS)
          </p>
          {vmsZones.map((zone, i) => (
            <div key={zone.id}>
              {i > 0 && <div className="mb-2" />}
              <Toggle
                label={zone.name}
                sub={
                  zone.style === "line-dashed"
                    ? "Viền nét đứt · tham khảo"
                    : zone.style === "fill"
                      ? "Vùng tô nền · tham khảo"
                      : "Viền · tham khảo"
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
          <p className="mt-2 text-[0.6875rem] leading-snug text-foreground/60">
            Các ranh giới trên chỉ để hình dung (dữ liệu VMS{" "}
            {VMS_ZONES_UPDATED.split("-").reverse().join("/")}) — ranh chính
            thức tra Chi cục Thủy sản.
          </p>
        </>
      )}
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
              <p className="text-[0.75rem] font-bold uppercase tracking-wide text-foreground/55">
                Khoảng cách 2 điểm
              </p>
              <p className="display mt-0.5 text-[1.25rem] font-bold leading-none text-navy">
                {measureResult.dist}
              </p>
              <p className="mt-1 text-[0.8125rem] text-foreground/70">
                Hướng điểm 1 → điểm 2: {measureResult.dir}
              </p>
            </div>
          ) : (
            <p className="mt-2 rounded-xl bg-field/70 px-2.5 py-2 text-[0.8125rem] font-semibold leading-snug text-t1">
              {measureCount === 0
                ? "Chạm điểm thứ nhất trên bản đồ."
                : "Chạm điểm thứ hai để ra khoảng cách."}
            </p>
          )}
          {measureCount > 0 && (
            <button
              type="button"
              onClick={onClearMeasure}
              className="mt-2 min-h-[3rem] w-full rounded-xl bg-field text-[0.9375rem] font-bold text-navy transition active:scale-[0.99]"
            >
              Xoá, đo lại
            </button>
          )}
          <p className="mt-2 text-[0.6875rem] leading-snug text-foreground/55">
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
  sub: string;
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
        <span className="block text-[0.9375rem] font-bold leading-tight text-navy">
          {label}
        </span>
        <span className="block text-[0.6875rem] text-foreground/65">{sub}</span>
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

