"use client";

/*
  SnapSheet — sheet đáy THƯỜNG TRỰC 3 nấc (peek / half / full) cho màn hình
  bản đồ, kiểu Google Maps nhưng đơn giản hoá cho người 40–60 tuổi:
  · KHÔNG scrim, KHÔNG khoá map — bản đồ phía trên vẫn chạm/kéo được
  · VUỐT lên/xuống ở mép sheet để nở/thu (chạm vào mép cũng nở 1 nấc) —
    không còn nút "Xem thêm"/"Thu gọn" riêng (user 2026-06-23)
  · không phải dialog (khác ui/bottom-sheet.tsx vốn là modal có focus-trap)
  Đặt trong container relative của màn hình map; chiều cao tính theo container.
*/
import { CloseIcon } from "@/components/icons";
import { useRef, type ReactNode } from "react";

export type SheetSize = "peek" | "half" | "full";

export function SnapSheet({
  size,
  onSizeChange,
  onClose,
  closeLabel = "Đóng",
  closeIcon,
  above,
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
  /** Icon nút thoát — mặc định X; "Về cảng nhà" thì truyền icon nhà */
  closeIcon?: ReactNode;
  /** Nội dung nổi NGAY TRÊN mép sheet (vd thanh giờ gió/sóng) — vị trí tay
      với tới, đi theo sheet khi nở/thu (roadmap hội đồng UX 2026-06-11) */
  above?: ReactNode;
  label: string;
  /** Phần luôn thấy ở mọi nấc */
  peek: React.ReactNode;
  /** Phần chi tiết — chỉ thấy ở half/full, cuộn bên trong sheet */
  children: React.ReactNode;
}) {
  const grow = () => onSizeChange(size === "peek" ? "half" : "full");
  const shrink = () => onSizeChange(size === "full" ? "half" : "peek");

  // Vuốt lên = nở, vuốt xuống = thu. Chạm nhẹ (ít di chuyển) thì coi như tap → nở.
  const dragY = useRef<number | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    dragY.current = e.clientY;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const start = dragY.current;
    dragY.current = null;
    if (start == null) return;
    const dy = e.clientY - start;
    const TH = 36; // ngưỡng vuốt (px)
    if (dy < -TH) grow();
    else if (dy > TH) shrink();
    else if (Math.abs(dy) < 8) {
      // tap nhẹ: nở dần peek→half→full; tới full rồi thì thu hẳn về peek
      if (size === "full") onSizeChange("peek");
      else grow();
    }
  };

  return (
    <section
      role="region"
      aria-label={label}
      // neo cho hướng dẫn trên màn (lib/tour.ts, bước "Bảng dưới đáy")
      data-tour="sheet-day"
      className="absolute inset-x-0 bottom-0 z-10 flex flex-col rounded-t-[1.75rem] bg-background shadow-sheet-up"
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
      {/* nội dung nổi sát mép trên sheet — bottom-full nên tự theo sheet */}
      {above && (
        <div className="pointer-events-none absolute inset-x-0 bottom-full px-2 pb-2">
          {above}
        </div>
      )}

      {/* Vùng VUỐT: thanh kéo + peek. Vuốt lên nở, vuốt xuống thu, chạm = nở.
          touch-none để vuốt dọc không cuộn trang phía sau. */}
      <div
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        style={{ touchAction: "none" }}
        className="shrink-0 cursor-grab active:cursor-grabbing"
        aria-label="Vuốt lên xem thêm, vuốt xuống thu gọn"
      >
        <div className="flex w-full justify-center pb-2 pt-2.5">
          <span className="h-1.5 w-12 rounded-full bg-line" aria-hidden />
        </div>
        <div className="flex items-center gap-2 px-3 pb-1">
          <div className="min-w-0 flex-1">{peek}</div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              onPointerDown={(e) => e.stopPropagation()}
              className="flex min-h-[3.5rem] shrink-0 items-center justify-center gap-1 surface px-3 text-[0.9375rem] font-bold text-navy transition active:scale-[0.97]"
            >
              {closeIcon ?? <CloseIcon className="h-5 w-5" />}
              {closeLabel}
            </button>
          )}
        </div>
      </div>

      {size !== "peek" && (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-2 [overscroll-behavior:contain]">
          {children}
        </div>
      )}
    </section>
  );
}
