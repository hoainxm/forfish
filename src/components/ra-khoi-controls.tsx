"use client";

/*
  Ra khơi — ĐIỀU KHIỂN LỚP (Phương án A, design-review/07).
  Rail dọc MÉP PHẢI 4 nhóm; chạm mở panel trượt ra trái. Đây là nơi DUY NHẤT
  bật/tắt-chọn dữ liệu HIỆN trên bản đồ — số liệu theo ĐIỂM nằm ở sheet đáy
  (tách bạch, map sạch). Bão tự nổi ở banner trên (không trong rail).
  Quyết định build 2026-06-16: chọn-1-loài (radio qua species sheet) · KHÔNG
  thang kéo lớp nền raster (để sau) · dải % cá lọc thật.
*/

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  OCEAN_LAYERS,
  OCEAN_LAYER_ORDER,
  formatDateVN,
  type OceanLayerId,
} from "@/lib/ocean-map";
import type { ForecastKind } from "@/lib/forecast-grid";
import { type SeaScalarKind } from "@/lib/sea-scalars";
import { SPECIES_META } from "@/lib/fish-predict";
import type { StormAlert } from "@/lib/storms";
import type { SavedPlace } from "@/lib/places";
import { FishSpeciesContent } from "@/components/fish-species-sheet";
import { MyPlacesContent } from "@/components/my-places-sheet";
import {
  AlertIcon,
  ChevronLeftIcon,
  CheckIcon,
  ChevronRightIcon,
  DepthIcon,
  LayersIcon,
  EddyIcon,
  FishIcon,
  StarIcon,
  WindIcon,
} from "@/components/icons";

const FISH_COLOR = "#2d8659"; // xanh lá — cá/ngư trường (design Phương án A)

type PanelId = "hai-do" | "ngu-truong" | "thoi-tiet" | "diem";

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
  fishOn,
  onFish,
  fishSpecies,
  fishLocked,
  species,
  regionShorts,
  onPickSpecies,
  fishRange,
  onRange,
  storms,
  dataDate,
  showPlaces,
  onShowPlaces,
  places,
  onPlaces,
  onGoPlace,
}: {
  layerId: OceanLayerId;
  onLayer: (id: OceanLayerId) => void;
  scalarKind: SeaScalarKind | null;
  onScalar: (k: SeaScalarKind | null) => void;
  forecastKind: ForecastKind | null;
  onForecast: (k: ForecastKind | null) => void;
  fishOn: boolean;
  onFish: (on: boolean) => void;
  fishSpecies: string | null;
  /** chưa đăng nhập → khoá chọn loài + dải khả năng (đồng bộ với sheet) */
  fishLocked: boolean;
  /** danh sách loài đang vụ (tên ngắn) — để chọn loài ngay trong panel */
  species: string[];
  regionShorts: Set<string>;
  onPickSpecies: (sp: string | null) => void;
  fishRange: [number, number];
  onRange: (r: [number, number]) => void;
  storms: StormAlert[];
  dataDate: string;
  showPlaces: boolean;
  onShowPlaces: (on: boolean) => void;
  /** điểm đã lưu — quản lý ngay trong panel rail (không bottom-sheet) */
  places: SavedPlace[];
  onPlaces: (next: SavedPlace[]) => void;
  onGoPlace: (lat: number, lon: number) => void;
}) {
  const [open, setOpen] = useState<PanelId | null>(null);
  const [collapsed, setCollapsed] = useState(false); // ẩn/hiện rail như menu bản đồ
  // drill-down trong panel Ngư trường: danh sách chọn loài (không mở modal)
  const [speciesView, setSpeciesView] = useState(false);
  // đổi panel hay đóng → thoát view chọn loài
  useEffect(() => {
    if (open !== "ngu-truong") setSpeciesView(false);
  }, [open]);

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
      dot: storms.length > 0 || !!forecastKind || !!scalarKind,
    },
    { id: "diem", label: "Điểm đã lưu", icon: StarIcon, color: "var(--navy)" },
  ];

  return (
    <div className="pointer-events-none relative flex justify-end gap-2">
      {/* PANEL neo TRÁI rail, bounded trong màn (không tràn/đè banner).
          Panel nhiều nội dung (Điểm đã lưu, Chọn loài) rộng hơn cho dễ nhìn,
          khỏi chồng chéo (user 2026-06-23); panel đơn giản giữ cân đối. */}
      {open && !collapsed && (
        <div
          className={`pointer-events-auto absolute right-[4.5rem] top-0 max-h-[62vh] overflow-y-auto rounded-2xl bg-card/97 p-3 shadow-xl [overscroll-behavior:contain] ${
            open === "diem" || (open === "ngu-truong" && speciesView)
              ? "w-[22rem] max-w-[calc(100vw-4.25rem)]"
              : "w-[16.5rem] max-w-[calc(100vw-5rem)]"
          }`}
        >
          {open === "ngu-truong" && speciesView ? (
            <>
              <PanelHeader
                title="Chọn loài cá"
                onClose={() => setOpen(null)}
                onBack={() => setSpeciesView(false)}
              />
              <FishSpeciesContent
                species={species}
                current={fishSpecies}
                regionShorts={regionShorts}
                cols={1}
                onPick={(sp) => {
                  onPickSpecies(sp);
                  setSpeciesView(false);
                }}
              />
            </>
          ) : (
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
                  dataDate={dataDate}
                />
              )}
              {open === "ngu-truong" && (
                <NguTruongPanel
                  fishOn={fishOn}
                  onFish={onFish}
                  fishSpecies={fishSpecies}
                  fishLocked={fishLocked}
                  onOpenSpecies={() => setSpeciesView(true)}
                  fishRange={fishRange}
                  onRange={onRange}
                />
              )}
              {open === "thoi-tiet" && (
                <ThoiTietPanel
                  storms={storms}
                  forecastKind={forecastKind}
                  onForecast={onForecast}
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
            </>
          )}
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

function cadLine(id: OceanLayerId, dataDate: string): { text: string; dot: string } {
  const def = OCEAN_LAYERS[id];
  if (!def.dated) return { text: "Cố định · Không đổi theo ngày", dot: DOT.coDinh };
  return { text: `Theo ngày · Ảnh ${formatDateVN(dataDate)} · chậm ~2 ngày`, dot: DOT.ngay };
}

function HaiDoPanel({
  layerId,
  scalarKind,
  onLayer,
  dataDate,
}: {
  layerId: OceanLayerId;
  scalarKind: SeaScalarKind | null;
  onLayer: (id: OceanLayerId) => void;
  dataDate: string;
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
          const cad = cadLine(id, dataDate);
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
        Ảnh vệ tinh trễ ~2 ngày — không phải thời gian thực. Phao báo hiệu chỉ
        hiện khi phóng to gần bờ.
      </p>
    </div>
  );
}

function NguTruongPanel({
  fishOn,
  onFish,
  fishSpecies,
  onOpenSpecies,
  fishRange,
  onRange,
  fishLocked,
}: {
  fishOn: boolean;
  onFish: (on: boolean) => void;
  fishSpecies: string | null;
  onOpenSpecies: () => void;
  fishRange: [number, number];
  onRange: (r: [number, number]) => void;
  /** chưa đăng nhập → loài + dải khả năng bị khoá (đồng bộ với sheet) */
  fishLocked: boolean;
}) {
  const name = fishSpecies
    ? SPECIES_META[fishSpecies]?.full ?? fishSpecies
    : "Mọi loài cá";
  return (
    <div>
      <Toggle
        label="Dự báo cá (PFZ)"
        sub="Theo ngày · cache 6h"
        on={fishOn}
        onToggle={() => onFish(!fishOn)}
        icon={
          <span style={{ color: FISH_COLOR }}>
            <FishIcon className="h-5 w-5" />
          </span>
        }
      />
      {fishOn && fishLocked && (
        // KHOÁ giống sheet: heatmap public, nhưng chọn loài + xem khả năng cần
        // đăng nhập → 1 CTA duy nhất, KHÔNG hiện picker/dải để khỏi "chỗ có chỗ thả"
        <>
          <Link
            href="/login"
            className="mt-2 flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-xl bg-t1 px-3 text-[0.9375rem] font-bold text-white transition active:scale-[0.99]"
          >
            <FishIcon className="h-5 w-5" />
            Đăng nhập để chọn loài &amp; xem khả năng
          </Link>
          <p className="mt-2 rounded-xl bg-field/70 px-2.5 py-2 text-[0.75rem] leading-snug text-foreground/70">
            Vùng xanh (heatmap) xem được không cần đăng nhập. Chọn loài, dải
            khả năng &amp; hướng đi thì cần đăng nhập.
          </p>
        </>
      )}
      {fishOn && !fishLocked && (
        <>
          <button
            type="button"
            onClick={onOpenSpecies}
            className="mt-2 flex w-full items-center gap-2 rounded-xl bg-field px-3 py-2.5 text-left active:scale-[0.99]"
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{
                background: fishSpecies
                  ? SPECIES_META[fishSpecies]?.color ?? FISH_COLOR
                  : FISH_COLOR,
              }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-bold text-navy">
              {name}
            </span>
            <ChevronRightIcon className="h-4 w-4 shrink-0 text-navy/55" />
          </button>

          <p className="mb-1 mt-3 flex items-center justify-between text-[0.75rem] font-bold uppercase tracking-wide text-foreground/55">
            <span>Dải khả năng có cá</span>
            <span className="tabular-nums" style={{ color: FISH_COLOR }}>
              {fishRange[0]}–{fishRange[1]}%
            </span>
          </p>
          <RangeBand value={fishRange} onChange={onRange} color={FISH_COLOR} />
        </>
      )}
    </div>
  );
}

function ThoiTietPanel({
  storms,
  forecastKind,
  onForecast,
  scalarKind,
  onScalar,
}: {
  storms: StormAlert[];
  forecastKind: ForecastKind | null;
  onForecast: (k: ForecastKind | null) => void;
  scalarKind: SeaScalarKind | null;
  onScalar: (k: SeaScalarKind | null) => void;
}) {
  return (
    <div>
      <p className="mb-1 flex items-center justify-between text-[0.75rem] font-bold uppercase tracking-wide text-foreground/55">
        <span>Cảnh báo bão</span>
        <span className="text-danger">Ưu tiên cao nhất</span>
      </p>
      {storms.length > 0 ? (
        storms.map((s) => (
          <div
            key={s.id}
            className="mb-2 flex items-center gap-2 rounded-xl bg-danger-bg px-2.5 py-2"
          >
            <AlertIcon className="h-5 w-5 shrink-0 text-danger" />
            <span className="min-w-0 flex-1">
              <span className="block text-[0.9375rem] font-bold leading-tight text-danger">
                {s.kindLabel} {s.name}
              </span>
              <span className="block text-[0.6875rem] text-foreground/65">
                Liên tục · cập nhật vừa xong
              </span>
            </span>
          </div>
        ))
      ) : (
        <p className="mb-2 rounded-xl bg-field/70 px-2.5 py-2 text-[0.75rem] text-foreground/70">
          Không có tin bão trên Biển Đông (đã kiểm tra).
        </p>
      )}

      <p className="mb-1 mt-3 text-[0.75rem] font-bold uppercase tracking-wide text-foreground/55">
        Lớp thời tiết khác
      </p>
      <Toggle
        label="Gió (Windy)"
        sub="Theo giờ · cập nhật vài giờ"
        on={forecastKind === "wind"}
        onToggle={() => onForecast(forecastKind === "wind" ? null : "wind")}
        icon={<WindIcon className="h-5 w-5 text-t1" />}
      />
      <Toggle
        label="Sóng (Windy)"
        sub="Theo giờ · cập nhật vài giờ"
        on={forecastKind === "wave"}
        onToggle={() => onForecast(forecastKind === "wave" ? null : "wave")}
        icon={<WindIcon className="h-5 w-5 text-t2" />}
      />
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

// dải kéo 2 đầu (dual-range) — tái dùng .range-dual (globals.css)
function RangeBand({
  value,
  onChange,
  color,
}: {
  value: [number, number];
  onChange: (r: [number, number]) => void;
  color: string;
}) {
  return (
    <span className="relative block h-6">
      <span
        className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-line"
        aria-hidden
      />
      <span
        className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
        style={{
          left: `${((value[0] - 35) / 65) * 100}%`,
          right: `${((100 - value[1]) / 65) * 100}%`,
          background: color,
        }}
        aria-hidden
      />
      <input
        type="range"
        min={35}
        max={100}
        value={value[0]}
        aria-label="Khả năng có cá tối thiểu"
        className="range-dual"
        onChange={(e) => onChange([Math.min(Number(e.target.value), value[1]), value[1]])}
      />
      <input
        type="range"
        min={35}
        max={100}
        value={value[1]}
        aria-label="Khả năng có cá tối đa"
        className="range-dual"
        onChange={(e) => onChange([value[0], Math.max(Number(e.target.value), value[0])])}
      />
      <span className="mt-5 flex justify-between text-[0.625rem] font-semibold text-foreground/60">
        <span>Ít cá</span>
        <span>Nhiều cá</span>
      </span>
    </span>
  );
}
