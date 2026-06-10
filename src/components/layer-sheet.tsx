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
import {
  AlertIcon,
  AnchorIcon,
  CheckIcon,
  CloudSunIcon,
  DepthIcon,
  PlanktonIcon,
  ThermoIcon,
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
  seamarksOn,
  onSeamarks,
  onClose,
}: {
  layerId: OceanLayerId;
  onLayer: (id: OceanLayerId) => void;
  seamarksOn: boolean;
  onSeamarks: (on: boolean) => void;
  onClose: () => void;
}) {
  const active = OCEAN_LAYERS[layerId];

  return (
    <BottomSheet title="Xem bản đồ kiểu gì?" onClose={onClose}>
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
              onClick={() => onLayer(id)}
              className={`relative flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[15px] font-bold leading-tight transition active:scale-[0.98] ${
                isActive
                  ? "bg-t1 text-white shadow-sm"
                  : "bg-card text-navy ring-1 ring-line"
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
      <div className="mt-3 rounded-xl bg-card p-3 ring-1 ring-line">
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

      <h4 className="display mb-2 mt-4 text-[16px] font-bold text-navy">
        Hiện thêm trên bản đồ
      </h4>
      <button
        type="button"
        role="switch"
        aria-checked={seamarksOn}
        onClick={() => onSeamarks(!seamarksOn)}
        className="flex min-h-[56px] w-full items-center gap-3 rounded-xl bg-card px-4 ring-1 ring-line transition active:scale-[0.99]"
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

      {/* các lớp an toàn — luôn bật, nói rõ là chủ đích */}
      <div className="mt-2 space-y-2">
        <div className="flex min-h-[52px] items-center gap-3 rounded-xl bg-background px-4 ring-1 ring-line">
          <span className="text-trim" aria-hidden>
            <AlertIcon className="h-5 w-5" />
          </span>
          <span className="flex-1 text-[15px] font-semibold text-foreground/75">
            Ranh giới biển Việt Nam — luôn hiện để bà con không vượt vùng
          </span>
          <CheckIcon className="h-5 w-5 shrink-0 text-ok" aria-hidden />
        </div>
        <div className="flex min-h-[52px] items-center gap-3 rounded-xl bg-background px-4 ring-1 ring-line">
          <span className="text-danger" aria-hidden>
            <AlertIcon className="h-5 w-5" />
          </span>
          <span className="flex-1 text-[15px] font-semibold text-foreground/75">
            Vị trí bão, áp thấp — luôn hiện khi có bão
          </span>
          <CheckIcon className="h-5 w-5 shrink-0 text-ok" aria-hidden />
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="mt-4 min-h-[56px] w-full rounded-xl bg-navy text-[17px] font-bold text-white transition active:scale-[0.99]"
      >
        Xong
      </button>
    </BottomSheet>
  );
}
