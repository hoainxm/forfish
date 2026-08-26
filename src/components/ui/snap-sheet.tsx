"use client";

/*
  SnapSheet — sheet đáy THƯỜNG TRỰC 3 nấc (hidden / peek / half) cho màn hình
  bản đồ, kiểu Google Maps nhưng đơn giản hoá cho người 40–60 tuổi:
  · CHỈ HAI NẤC MỞ (user 2026-08-24: "cho 2 nấc thôi, ko cần lên 3 nấc, nó che
    hết màn hình") — nấc `full` (cao calc(100% − 96px)) ĐÃ BỎ: nó phủ gần kín
    màn, bà con mất luôn bản đồ. Thân sheet cuộn trong nấc `half` là đủ đọc.
  · KHÔNG scrim, KHÔNG khoá map — bản đồ phía trên vẫn chạm/kéo được
  · VUỐT lên/xuống ở mép sheet để nở/thu (chạm vào mép cũng nở 1 nấc) —
    không còn nút "Xem thêm"/"Thu gọn" riêng (user 2026-06-23)
  · nấc `hidden` (user 2026-08-24: "kéo sát xuống dưới luôn, vô hiện 3s rồi ẩn
    xuống"): sheet trượt SÁT ĐÁY, chỉ còn THANH KÉO mảnh nổi trên bản đồ —
    nền trong suốt, bản đồ lộ tối đa. Vuốt lên / chạm thanh là hiện lại đầy đủ.
    Màn map tự đưa về nấc này sau 3s KHÔNG CHẠM ở BẤT KỲ nấc nào (peek/half/
    full) — `onInteract` (pointerdown/gõ phím pha capture + cuộn thân sheet)
    nạp lại đồng hồ, nên còn chạm là còn ở lại.
    Vùng chạm của thanh cao 3.5rem (≥56px, tay ướt trên tàu lắc) dù vệt nhìn
    thấy chỉ mảnh — KHÔNG hạ vùng chạm xuống bằng vệt vẽ.
  · không phải dialog (khác ui/bottom-sheet.tsx vốn là modal có focus-trap)
  Đặt trong container relative của màn hình map; chiều cao tính theo container.
*/
import { CloseIcon } from "@/components/icons";
import { useRef, type ReactNode } from "react";

export type SheetSize = "hidden" | "peek" | "half";

export function SnapSheet({
  size,
  onSizeChange,
  onClose,
  closeLabel = "Đóng",
  closeIcon,
  onInteract,
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
  /** Bà con vừa chạm/gõ gì đó TRONG sheet — màn map dùng để nạp lại đồng hồ
      tự-ẩn 3s (bắt ở pha CAPTURE nên chip ngày có stopPropagation vẫn tính) */
  onInteract?: () => void;
  /** Nội dung nổi NGAY TRÊN mép sheet (vd thanh giờ gió/sóng) — vị trí tay
      với tới, đi theo sheet khi nở/thu (roadmap hội đồng UX 2026-06-11) */
  above?: ReactNode;
  label: string;
  /** Phần luôn thấy ở mọi nấc */
  peek: React.ReactNode;
  /** Phần chi tiết — chỉ thấy ở half/full, cuộn bên trong sheet */
  children: React.ReactNode;
}) {
  const hidden = size === "hidden";
  const grow = () =>
    onSizeChange(size === "hidden" ? "peek" : "half"); // half là kịch trần
  const shrink = () =>
    onSizeChange(size === "half" ? "peek" : "hidden");

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
      // tap nhẹ: hidden→peek→half; ở half tap lần nữa thì thu về peek (đảo
      // qua lại 2 nấc, không có nấc thứ ba phủ kín màn)
      if (size === "half") onSizeChange("peek");
      else grow();
    }
  };

  return (
    <section
      role="region"
      aria-label={label}
      // neo cho hướng dẫn trên màn (lib/tour.ts, bước "Bảng dưới đáy")
      data-tour="sheet-day"
      onPointerDownCapture={onInteract}
      onKeyDownCapture={onInteract}
      className={`absolute inset-x-0 bottom-0 z-10 flex flex-col rounded-t-[1.75rem] ${
        hidden
          ? "pointer-events-none bg-transparent"
          : "bg-background shadow-sheet-up"
      }`}
      style={{
        // chỉ còn `half` là nấc mở — 55% khung map, thân sheet cuộn trong.
        height: size === "half" ? "55%" : "auto",
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
          touch-none để vuốt dọc không cuộn trang phía sau.
          Nấc `hidden`: vùng này là TẤT CẢ những gì còn lại — cao 3.5rem cho
          đủ tap target, nhưng chỉ VẼ một vệt kính mảnh (bản đồ vẫn thấy). */}
      <div
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        style={{ touchAction: "none" }}
        className={`shrink-0 cursor-grab active:cursor-grabbing ${
          hidden ? "pointer-events-auto flex min-h-[3.5rem] items-end justify-center pb-1.5" : ""
        }`}
        aria-label={
          hidden
            ? "Vuốt lên xem gió sóng chỗ đang xem"
            : "Vuốt lên xem thêm, vuốt xuống thu gọn"
        }
      >
        {hidden ? (
          <span className="glass flex h-8 w-28 items-center justify-center rounded-full">
            <span className="h-1.5 w-12 rounded-full bg-navy/40" aria-hidden />
          </span>
        ) : (
          <>
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
          </>
        )}
      </div>

      {size !== "peek" && !hidden && (
        /* onScroll cũng tính là "đang đọc" → nạp lại đồng hồ tự-ẩn: cuộn quán
           tính (buông tay rồi trang vẫn trôi) KHÔNG bắn pointerdown, thiếu vế
           này thì đang trôi giữa chừng sheet sập xuống. */
        <div
          onScroll={onInteract}
          className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-2 [overscroll-behavior:contain]"
        >
          {children}
        </div>
      )}
    </section>
  );
}
