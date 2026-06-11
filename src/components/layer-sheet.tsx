"use client";

/*
  Sheet "Lớp bản đồ" — pattern Google Maps: lớp chính chọn-MỘT (grid 2×2)
  + phần "Hiện thêm" bật/tắt. Ranh giới biển VN, vị trí bão và nhãn chủ quyền
  KHÔNG có công tắc — hiện dòng tĩnh để bà con biết app cố tình luôn vẽ.
*/
import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  OCEAN_LAYERS,
  OCEAN_LAYER_ORDER,
  type OceanLayerId,
} from "@/lib/ocean-map";
import type { ForecastKind } from "@/lib/forecast-grid";
import {
  SEA_SCALARS,
  SEA_SCALAR_ORDER,
  type SeaScalarKind,
} from "@/lib/sea-scalars";
import {
  AnchorIcon,
  CheckIcon,
  CloudSunIcon,
  DepthIcon,
  DropIcon,
  EddyIcon,
  FishIcon,
  PlanktonIcon,
  ThermoIcon,
  WavesIcon,
  WindIcon,
} from "@/components/icons";

const SCALAR_ICONS: Record<
  SeaScalarKind,
  (p: { className?: string }) => React.ReactNode
> = { ssha: EddyIcon, sss: DropIcon };

const LAYER_ICONS: Record<
  OceanLayerId,
  (p: { className?: string }) => React.ReactNode
> = {
  sst: ThermoIcon,
  chlorophyll: PlanktonIcon,
  bathymetry: DepthIcon,
  truecolor: CloudSunIcon,
};

export function LayerSheet({
  layerId,
  onLayer,
  scalarKind,
  onScalar,
  forecastKind,
  onForecast,
  fishOn,
  onFish,
  seamarksOn,
  onSeamarks,
  onClose,
}: {
  layerId: OceanLayerId;
  onLayer: (id: OceanLayerId) => void;
  /** lớp số liệu biển (nước dâng/xoáy, độ mặn) — chọn-một cùng nhóm nền */
  scalarKind: SeaScalarKind | null;
  onScalar: (k: SeaScalarKind | null) => void;
  /** lớp dự báo vẽ động trên bản đồ (kiểu Windy) — null = tắt */
  forecastKind: ForecastKind | null;
  onForecast: (k: ForecastKind | null) => void;
  fishOn: boolean;
  onFish: (on: boolean) => void;
  seamarksOn: boolean;
  onSeamarks: (on: boolean) => void;
  onClose: () => void;
}) {
  // thẻ giải thích + chú giải theo lựa chọn đang bật (nền raster hoặc lớp số)
  const active = scalarKind ? SEA_SCALARS[scalarKind] : OCEAN_LAYERS[layerId];

  return (
    <BottomSheet title="Xem bản đồ kiểu gì?" onClose={onClose}>
      <h4 className="display mb-2 text-[1rem] font-bold text-navy">
        Nền bản đồ
      </h4>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Lớp bản đồ chính">
        {OCEAN_LAYER_ORDER.map((id) => {
          const def = OCEAN_LAYERS[id];
          const Icon = LAYER_ICONS[id];
          const isActive = !scalarKind && id === layerId;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={isActive}
              // chọn lớp xong ĐÓNG LUÔN — để thấy ngay bản đồ đổi, không bắt
              // bấm thêm "Xong" (audit flow: map đổi sau lưng scrim đen)
              onClick={() => {
                onScalar(null);
                onLayer(id);
                onClose();
              }}
              className={`relative flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[0.9375rem] font-bold leading-tight transition active:scale-[0.98] ${
                isActive
                  ? "bg-t1 text-white shadow-sm"
                  : "bg-field text-navy"
              }`}
            >
              {isActive && (
                <span className="absolute right-1.5 top-1.5" aria-hidden>
                  <CheckIcon className="h-4 w-4" />
                </span>
              )}
              <Icon className="h-6 w-6" />
              {def.label}
            </button>
          );
        })}
        {SEA_SCALAR_ORDER.map((k) => {
          const def = SEA_SCALARS[k];
          const Icon = SCALAR_ICONS[k];
          const isActive = scalarKind === k;
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => {
                onScalar(k);
                onClose();
              }}
              className={`relative flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[0.9375rem] font-bold leading-tight transition active:scale-[0.98] ${
                isActive ? "bg-t1 text-white shadow-sm" : "bg-field text-navy"
              }`}
            >
              {isActive && (
                <span className="absolute right-1.5 top-1.5" aria-hidden>
                  <CheckIcon className="h-4 w-4" />
                </span>
              )}
              <Icon className="h-6 w-6" />
              {def.label}
            </button>
          );
        })}
      </div>

      {/* chú giải + giải thích của lớp đang bật — sống ở đây, không chiếm map */}
      <div className="mt-3 surface p-3">
        <p className="text-[0.9375rem] leading-snug text-foreground/75">
          {active.help}
        </p>
        {active.legend && (
          <div className="mt-2">
            <div
              className="h-3 w-full rounded-full"
              style={{ background: active.legend.gradient }}
              aria-hidden
            />
            <div className="mt-1 flex justify-between text-[0.875rem] font-semibold text-foreground/60">
              <span>{active.legend.from}</span>
              <span>{active.legend.to}</span>
            </div>
          </div>
        )}
      </div>

      {/* dự báo vẽ động kiểu Windy — kéo thanh giờ trên bản đồ để xem trước */}
      <h4 className="display mb-2 mt-4 text-[1rem] font-bold text-navy">
        Dự báo trên bản đồ — 3 ngày tới
      </h4>
      <div
        className="grid grid-cols-3 gap-2"
        role="radiogroup"
        aria-label="Lớp dự báo"
      >
        {(
          [
            { k: null, label: "Tắt", icon: null },
            { k: "wind", label: "Gió", icon: WindIcon },
            { k: "wave", label: "Sóng", icon: WavesIcon },
          ] as const
        ).map(({ k, label, icon: Icon }) => {
          const isActive = forecastKind === k;
          return (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => {
                onForecast(k);
                if (k != null) onClose(); // bật dự báo → đóng để thấy ngay
              }}
              className={`flex min-h-[3.75rem] flex-col items-center justify-center gap-0.5 rounded-xl px-2 text-[0.9375rem] font-bold transition active:scale-[0.98] ${
                isActive
                  ? "bg-navy text-white shadow-sm"
                  : "bg-field text-navy"
              }`}
            >
              {Icon && <Icon className="h-5 w-5" />}
              {label}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 px-1 text-[0.8125rem] leading-snug text-foreground/60">
        Bật Gió hoặc Sóng rồi kéo thanh giờ trên bản đồ — mũi tên chỉ hướng,
        màu càng đỏ càng dữ.
      </p>

      <h4 className="display mb-2 mt-4 text-[1rem] font-bold text-navy">
        Hiện thêm trên bản đồ
      </h4>
      <button
        type="button"
        role="switch"
        aria-checked={fishOn}
        onClick={() => onFish(!fishOn)}
        className="mb-2 flex min-h-[3.5rem] w-full items-center gap-3 surface px-4 transition active:scale-[0.99]"
      >
        <FishIcon className="h-6 w-6 shrink-0 text-t1" />
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-[1rem] font-bold">Dự báo cá</span>
          <span className="block text-[0.8125rem] text-foreground/60">
            Vùng tô màu xanh lá (hoặc màu loài đang chọn) = có khả năng có cá
            hôm nay, càng đậm càng cao — tính từ ảnh vệ tinh, tham khảo
          </span>
        </span>
        <span
          className={`flex h-8 w-14 shrink-0 items-center rounded-full px-1 transition ${
            fishOn ? "justify-end bg-ok" : "justify-start bg-line"
          }`}
          aria-hidden
        >
          <span className="h-6 w-6 rounded-full bg-white shadow" />
        </span>
      </button>
      <button
        type="button"
        role="switch"
        aria-checked={seamarksOn}
        onClick={() => onSeamarks(!seamarksOn)}
        className="flex min-h-[3.5rem] w-full items-center gap-3 surface px-4 transition active:scale-[0.99]"
      >
        <AnchorIcon className="h-6 w-6 shrink-0 text-t1" />
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-[1rem] font-bold">
            Phao đèn, báo hiệu gần bờ
          </span>
          <span className="block text-[0.8125rem] text-foreground/60">
            Chỉ hiện khi phóng to gần bờ
          </span>
        </span>
        <span
          className={`flex h-8 w-14 shrink-0 items-center rounded-full px-1 transition ${
            seamarksOn ? "justify-end bg-ok" : "justify-start bg-line"
          }`}
          aria-hidden
        >
          <span className="h-6 w-6 rounded-full bg-white shadow" />
        </span>
      </button>

      {/* các lớp an toàn — luôn bật, nói 1 dòng là đủ (đọc 1 lần trong đời) */}
      <p className="mt-2 px-1 text-[0.875rem] leading-snug text-foreground/60">
        Ranh giới biển Việt Nam, vị trí bão và tên vùng biển luôn được vẽ sẵn.
        Ảnh vệ tinh là ảnh đã chụp — không dự báo trước được.
      </p>

      <button
        type="button"
        onClick={onClose}
        className="mt-4 min-h-[3.5rem] w-full rounded-xl bg-navy text-[1.125rem] font-bold text-white transition active:scale-[0.99]"
      >
        Xong
      </button>
    </BottomSheet>
  );
}
