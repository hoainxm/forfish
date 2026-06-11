"use client";

/*
  SnapSheet — sheet đáy THƯỜNG TRỰC 3 nấc (peek / half / full) cho màn hình
  bản đồ, kiểu Google Maps nhưng đơn giản hoá cho người 40–60 tuổi:
  · KHÔNG scrim, KHÔNG khoá map — bản đồ phía trên vẫn chạm/kéo được
  · điều khiển bằng NÚT TO ("Xem thêm" / "Thu gọn" / đóng), không bắt drag
  · không phải dialog (khác ui/bottom-sheet.tsx vốn là modal có focus-trap)
  Đặt trong container relative của màn hình map; chiều cao tính theo container.
*/
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CloseIcon,
} from "@/components/icons";
import type { ReactNode } from "react";

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

  return (
    <section
      role="region"
      aria-label={label}
      className="absolute inset-x-0 bottom-0 z-10 flex flex-col rounded-t-[1.75rem] bg-background shadow-[0_-6px_20px_rgba(20,50,79,0.25)]"
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

      {/* thanh kéo từng là đồ giả — giờ chạm là nở (roadmap hội đồng UX) */}
      <button
        type="button"
        onClick={() => size !== "full" && grow()}
        aria-label="Mở rộng bảng thông tin"
        className="flex w-full shrink-0 justify-center pb-1 pt-2"
      >
        <span className="h-1.5 w-12 rounded-full bg-line" aria-hidden />
      </button>

      <div className="flex shrink-0 items-center gap-2 px-3 pb-1">
        {/* vùng peek chạm là nở luôn — không bắt nhắm trúng nút nhỏ */}
        <div
          className="min-w-0 flex-1"
          onClick={() => {
            if (size === "peek") grow();
          }}
        >
          {peek}
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          {size !== "full" && (
            <button
              type="button"
              onClick={grow}
              className="flex min-h-[3.25rem] items-center gap-1 rounded-xl bg-t1 px-3 text-[0.9375rem] font-bold text-white transition active:scale-[0.97]"
            >
              <ChevronUpIcon className="h-5 w-5" />
              Xem thêm
            </button>
          )}
          {size !== "peek" && (
            <button
              type="button"
              onClick={shrink}
              className="flex min-h-[3.25rem] items-center gap-1 surface px-3 text-[0.9375rem] font-bold text-navy transition active:scale-[0.97]"
            >
              <ChevronDownIcon className="h-5 w-5" />
              Thu gọn
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-[3.25rem] items-center justify-center gap-1 surface px-3 text-[0.9375rem] font-bold text-navy transition active:scale-[0.97]"
            >
              {closeIcon ?? <CloseIcon className="h-5 w-5" />}
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
