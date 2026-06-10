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
  AnchorIcon,
  CheckIcon,
  CloudSunIcon,
  DepthIcon,
  FishIcon,
  PlanktonIcon,
  ThermoIcon,
  WavesIcon,
  WindIcon,
} from "@/components/icons";

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
  /** lớp dự báo vẽ động trên bản đồ (kiểu Windy) — null = tắt */
  forecastKind: ForecastKind | null;
  onForecast: (k: ForecastKind | null) => void;
  fishOn: boolean;
  onFish: (on: boolean) => void;
  seamarksOn: boolean;
  onSeamarks: (on: boolean) => void;
  onClose: () => void;
}) {
  const active = OCEAN_LAYERS[layerId];

  return (
    <BottomSheet title="Xem bản đồ kiểu gì?" onClose={onClose}>
      <h4 className="display mb-2 text-[16px] font-bold text-navy">
        Nền bản đồ
      </h4>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Lớp bản đồ chính">
        {OCEAN_LAYER_ORDER.map((id) => {
          const def = OCEAN_LAYERS[id];
          const Icon = LAYER_ICONS[id];
          const isActive = id === layerId;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={isActive}
              // chọn lớp xong ĐÓNG LUÔN — để thấy ngay bản đồ đổi, không bắt
              // bấm thêm "Xong" (audit flow: map đổi sau lưng scrim đen)
              onClick={() => {
                onLayer(id);
                onClose();
              }}
              className={`relative flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[15px] font-bold leading-tight transition active:scale-[0.98] ${
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
      </div>

      {/* chú giải + giải thích của lớp đang bật — sống ở đây, không chiếm map */}
      <div className="mt-3 surface p-3">
        <p className="text-[15px] leading-snug text-foreground/75">
          {active.help}
        </p>
        {active.legend && (
          <div className="mt-2">
            <div
              className="h-3 w-full rounded-full"
              style={{ background: active.legend.gradient }}
              aria-hidden
            />
            <div className="mt-1 flex justify-between text-[14px] font-semibold text-foreground/60">
              <span>{active.legend.from}</span>
              <span>{active.legend.to}</span>
            </div>
          </div>
        )}
      </div>

      {/* dự báo vẽ động kiểu Windy — kéo thanh giờ trên bản đồ để xem trước */}
      <h4 className="display mb-2 mt-4 text-[16px] font-bold text-navy">
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
              className={`flex min-h-[60px] flex-col items-center justify-center gap-0.5 rounded-xl px-2 text-[15px] font-bold transition active:scale-[0.98] ${
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
      <p className="mt-1.5 px-1 text-[13px] leading-snug text-foreground/60">
        Bật Gió hoặc Sóng rồi kéo thanh giờ trên bản đồ — mũi tên chỉ hướng,
        màu càng đỏ càng dữ.
      </p>

      <h4 className="display mb-2 mt-4 text-[16px] font-bold text-navy">
        Hiện thêm trên bản đồ
      </h4>
      <button
        type="button"
        role="switch"
        aria-checked={fishOn}
        onClick={() => onFish(!fishOn)}
        className="mb-2 flex min-h-[56px] w-full items-center gap-3 surface px-4 transition active:scale-[0.99]"
      >
        <FishIcon className="h-6 w-6 shrink-0 text-t1" />
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-[16px] font-bold">Cá mùa này</span>
          <span className="block text-[13px] text-foreground/60">
            Vùng nào đang vụ cá gì — theo mùa vụ nhiều năm, tham khảo
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
        className="flex min-h-[56px] w-full items-center gap-3 surface px-4 transition active:scale-[0.99]"
      >
        <AnchorIcon className="h-6 w-6 shrink-0 text-t1" />
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-[16px] font-bold">
            Phao đèn, báo hiệu gần bờ
          </span>
          <span className="block text-[13px] text-foreground/60">
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
      <p className="mt-2 px-1 text-[14px] leading-snug text-foreground/60">
        Ranh giới biển Việt Nam, vị trí bão và tên vùng biển luôn được vẽ sẵn.
        Ảnh vệ tinh là ảnh đã chụp — không dự báo trước được.
      </p>

      <button
        type="button"
        onClick={onClose}
        className="mt-4 min-h-[56px] w-full rounded-xl bg-navy text-[18px] font-bold text-white transition active:scale-[0.99]"
      >
        Xong
      </button>
    </BottomSheet>
  );
}
