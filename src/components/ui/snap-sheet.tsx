"use client";

/*
  SnapSheet — sheet đáy THƯỜNG TRỰC 3 nấc (peek / half / full) cho màn hình
  bản đồ, kiểu Google Maps nhưng đơn giản hoá cho người 40–60 tuổi:
  · KHÔNG scrim, KHÔNG khoá map — bản đồ phía trên vẫn chạm/kéo được
  · điều khiển bằng NÚT TO ("Xem thêm" / "Thu gọn" / đóng), không bắt drag
  · không phải dialog (khác ui/bottom-sheet.tsx vốn là modal có focus-trap)
  Đặt trong container relative của màn hình map; chiều cao tính theo container.
*/
import { ChevronDownIcon, ChevronUpIcon, CloseIcon } from "@/components/icons";

export type SheetSize = "peek" | "half" | "full";

export function SnapSheet({
  size,
  onSizeChange,
  onClose,
  closeLabel = "Đóng",
  label,
  peek,
  children,
}: {
  size: SheetSize;
  onSizeChange: (s: SheetSize) => void;
  /** Hiện nút thoát ở MỌI nấc — vd quay về vùng biển cảng nhà */
  onClose?: () => void;
  /** Chữ trên nút thoát — phải tự giải thích ("Về cảng"), không chỉ "Đóng" */
  closeLabel?: string;
  label: string;
  /** Phần luôn thấy ở mọi nấc */
  peek: React.ReactNode;
  /** Phần chi tiết — chỉ thấy ở half/full, cuộn bên trong sheet */
  children: React.ReactNode;
}) {
  const grow = () => onSizeChange(size === "peek" ? "half" : "full");
  const shrink = () => onSizeChange(size === "full" ? "half" : "peek");

  return (
    <section
      role="region"
      aria-label={label}
      className="absolute inset-x-0 bottom-0 z-10 flex flex-col rounded-t-2xl bg-background shadow-[0_-6px_20px_rgba(20,50,79,0.25)] ring-1 ring-line"
      style={{
        height:
          size === "peek"
            ? "auto"
            : size === "half"
              ? "55%"
              : "calc(100% - 96px)", // chừa vùng tin bão trên cùng
        transition: "height 200ms ease",
      }}
    >
      <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-line" aria-hidden />

      <div className="flex shrink-0 items-center gap-2 px-3 pb-1 pt-1">
        <div className="min-w-0 flex-1">{peek}</div>
        <div className="flex shrink-0 flex-col gap-1.5">
          {size !== "full" && (
            <button
              type="button"
              onClick={grow}
              className="flex min-h-[52px] items-center gap-1 rounded-xl bg-t1 px-3 text-[15px] font-bold text-white transition active:scale-[0.97]"
            >
              <ChevronUpIcon className="h-5 w-5" />
              Xem thêm
            </button>
          )}
          {size !== "peek" && (
            <button
              type="button"
              onClick={shrink}
              className="flex min-h-[52px] items-center gap-1 rounded-xl bg-card px-3 text-[15px] font-bold text-navy ring-1 ring-line transition active:scale-[0.97]"
            >
              <ChevronDownIcon className="h-5 w-5" />
              Thu gọn
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-[52px] items-center justify-center gap-1 rounded-xl bg-card px-3 text-[15px] font-bold text-navy ring-1 ring-line transition active:scale-[0.97]"
            >
              <CloseIcon className="h-5 w-5" />
              {closeLabel}
            </button>
          )}
        </div>
      </div>

      {size !== "peek" && (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-2 [overscroll-behavior:contain]">
          {children}
        </div>
      )}
    </section>
  );
}
