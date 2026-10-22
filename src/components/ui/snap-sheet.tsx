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
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon, LockIcon } from "@/components/icons";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

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
  hiddenLabel,
  side = false,
  sideTab,
  sideTabLabel,
  sideHeader,
  sideDense,
  sideTitle,
  sideHold = false,
  onSideHoldChange,
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
  /*  MỘT DÒNG SỐ CÒN LẠI Ở NẤC `hidden` — chi phí 0px (2026-08-29).
      Viên kính của nấc `hidden` vốn RỖNG, nằm trong ô chạm 3.5rem sẵn có, nên
      nhét chữ vào KHÔNG tốn thêm một px chiều cao nào.
      Vì sao cần: sheet tự ẩn sau 3 giây, mà muốn đọc lại thì phải chấm bản đồ
      lần nữa — chấm lại là DỜI CON TRỎ, số đọc được không còn là số vừa xem.
      Giữ đúng MỘT dòng ở đây thì số chạm để xem lại số vừa xem còn 0.
      CHA dựng sẵn chuỗi, con chỉ render — và cha chỉ truyền khi nấc `hidden`
      đến từ ĐỒNG HỒ TỰ-ẨN, không truyền khi bị lớp nổi khác ép ẩn. */
  hiddenLabel?: string;
  /** Ngăn kéo BÊN PHẢI thay sheet đáy (tab dính mép phải; xem nhánh `if (side)`). */
  side?: boolean;
  /** Nội dung VIÊN dính mép phải ở nấc thu (tóm tắt ngắn) — chỉ khi `side`. */
  sideTab?: ReactNode;
  /** Bản CHỮ của viên cho trình đọc màn hình (ngày · số · bản lưu) — `aria-label`
   *  đè nội dung nút nên phải nói lại đủ, không chỉ "Mở bảng…". */
  sideTabLabel?: string;
  /** Thêm vào đầu ngăn, cạnh "Thu" (vd chip dữ liệu) — chỉ khi `side`. */
  sideHeader?: ReactNode;
  /** Nội dung DÀY SỐ cho ngăn thấp 1/3 màn (mặc định khi mở). "Xem đủ" mở thêm
   *  `peek` + `children` (câu giải thích đầy đủ) ngay trong ngăn, cuộn dọc. */
  sideDense?: ReactNode;
  /** Thay chữ tiêu đề ở đầu ngăn thấp (vd "● Biển êm") — đỡ một hàng. */
  sideTitle?: ReactNode;
  /** Ngăn đang được người dùng GHIM mở (không tự thu) — chỉ khi `side`. */
  sideHold?: boolean;
  /** Có = hiện nút "Giữ mở" ở đầu ngăn; cha tự tắt đồng hồ tự-thu khi true. */
  onSideHoldChange?: (held: boolean) => void;
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
  const dragX = useRef<number | null>(null);
  const panelId = useId();
  /** ngăn bên phải đang mở phần "Xem đủ" — đóng ngăn là thu lại */
  const [wide, setWide] = useState(false);
  useEffect(() => {
    if (size !== "half") setWide(false);
  }, [size]);
  /*  FOCUS THEO NGĂN BÊN (rà Codex lần 4): mở ngăn → focus vào ngăn (bàn phím /
      trình đọc màn hình đọc tiếp từ đầu ngăn, không kẹt lại ở viên đã biến mất);
      thu ngăn mà focus đang ở trong ngăn → trả về viên. Focus ở chỗ khác (đang
      chạm bản đồ) thì KHÔNG giật về — chỉ dọn cho đúng đường người vừa đi. */
  const tabRef = useRef<HTMLButtonElement>(null);
  const nganRef = useRef<HTMLDivElement>(null);
  const focusInNgan = useRef(false);
  const sideOpen = !!side && size === "half";
  useEffect(() => {
    if (!side) return;
    if (sideOpen) {
      nganRef.current?.focus({ preventScroll: true });
    } else if (focusInNgan.current) {
      focusInNgan.current = false;
      tabRef.current?.focus({ preventScroll: true });
    }
  }, [side, sideOpen]);
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

  /*  BIẾN THỂ NGĂN KÉO BÊN PHẢI (anh Long 2026-10-20: "kéo side khác kéo dưới
      lên"; rồi "bố cục cái drag vẫn chưa đẹp, chưa thông minh, chưa tối ưu, vẫn
      đang chiếm diện tích").
      · `hidden`/`peek`: bản đồ chỉ còn MỘT VIÊN dính mép phải — viên vừa là
        TÓM TẮT (`sideTab`: ngày + sóng/gió) vừa là TAY CẦM (vạch dọc + ‹). Không
        hàng đáy, không thanh kéo, không bước ngày trên bản đồ (đổi ngày trong
        ngăn). `above` chỉ còn cho thứ bắt buộc nổi (thanh giờ lớp động, lỗi dự
        báo cá, chip dữ liệu KHI THIẾU) — xếp căn phải ngay trên viên.
      · `half`: ngăn thấp 1/3 khung map neo góc dưới phải (xem khối dưới).
        Đầu ngăn: tiêu đề · `sideHeader` (chip dữ liệu) · "Thu ›". Vuốt TRÁI/
        chạm viên = mở; vuốt PHẢI/"Thu" = đóng. Không scrim, không khoá bản
        đồ (cùng luật sheet đáy). */
  if (side) {
    const open = size === "half";
    const onSideUp = (e: React.PointerEvent, wasOpen: boolean) => {
      const start = dragX.current;
      dragX.current = null;
      if (start == null) return;
      const dx = e.clientX - start;
      if (!wasOpen && (dx < -24 || Math.abs(dx) < 8)) onSizeChange("half");
      else if (wasOpen && dx > 36) onSizeChange("hidden");
    };
    return (
      <section
        role="region"
        aria-label={label}
        data-snap-sheet=""
        onPointerDownCapture={onInteract}
        onKeyDownCapture={onInteract}
        onScrollCapture={onInteract}
        /*  MỞ NGĂN ⇒ NỔI TRÊN cụm điều khiển phía trên (z-30 > z-20): chữ phóng
            to thì ô toạ độ / rail kéo dài xuống tới ngăn — người dùng vừa CHỦ ĐỘNG
            mở ngăn để đọc, nên ngăn thắng; thu ngăn là cụm trên lộ lại. Lớp nổi
            khác (panel Lớp, Toạ độ…) mở là ép ẩn ngăn nên không bị che. */
        className={`pointer-events-none absolute inset-0 ${open ? "z-30" : "z-10"}`}
      >
        {!open && (
          /*  THẺ TRẠNG THÁI ĐÁY (khung mới 2026-10-20, theo ảnh mẫu hải đồ anh Long
              gửi): viên dính mép phải → THẺ RỘNG HẾT MÀN ở đáy, lề 0.5rem. Chữ có
              chỗ nằm ngang (ngày · tình trạng · số) thay vì xếp 3 dòng trong viên
              hẹp; vẫn là tay cầm: chạm/vuốt TRÁI mở ngăn bên phải như cũ. `above`
              (đồng hồ tốc độ · nút về tàu · chip dữ liệu · thanh giờ) ngay trên. */
          /*  px-3 = đúng lề 0.75rem của dock ⇒ mép thẻ thẳng mép dock (2026-10-22: "sao nó ko sát"). */
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-2 px-3 pb-2">
            {above && <div className="w-full">{above}</div>}
            <button
              ref={tabRef}
              type="button"
              onPointerDown={(e) => {
                dragX.current = e.clientX;
              }}
              onPointerUp={(e) => onSideUp(e, false)}
              /*  Bàn phím / trình đọc màn hình (Enter, Space) chỉ bắn `click` — thiếu
                  dòng này là viên chỉ mở được bằng ngón tay (rà Codex lần 3). Gọi
                  "half" là lệnh đặt, không lật, nên chạm (pointerup + click) không
                  mở-rồi-đóng. */
              onClick={() => onSizeChange("half")}
              aria-expanded={false}
              aria-controls={`${panelId}-ngan`}
              style={{ touchAction: "none" }}
              aria-label={`Mở bảng ${label.toLowerCase()}${sideTabLabel ? ` — ${sideTabLabel}` : ""}`}
              /*  CAO TỐI THIỂU, không cố định (rà Codex lần 8): viên có thể 3 dòng
                  (ngày · số · bản lưu) và phóng chữ to — `h-` cố định là tràn. */
              className="pointer-events-auto flex min-h-(--h-row) w-full items-center gap-3 rounded-2xl border border-line bg-card/97 px-4 py-2 text-left text-navy shadow-float active:bg-field"
            >
              <span className="min-w-0 flex-1">
                {sideTab ?? <span className="text-[0.9375rem] font-semibold">{label}</span>}
              </span>
              <ChevronLeftIcon className="h-5 w-5 shrink-0 text-navy/55" aria-hidden />
            </button>
          </div>
        )}
        {open && (
          /*  NGĂN THẤP 1/3 MÀN — MỌI TRẠNG THÁI (anh Long 2026-10-20: "kích thước
              như cũ, nhưng chiều dài chỉ còn 1/3, rồi cho scroll đọc"; rà Codex
              lần 3 ưu tiên 3): rộng min(22rem,84%), cao 34% khung bản đồ, neo góc
              dưới phải, thân cuộn dọc. Không còn nhánh ngăn cao trọn màn: chưa có
              số (đang tải / lỗi / chạm đất liền) thì `peek` (câu trạng thái) nằm
              ngay trong ngăn thấp này. "Xem đủ" nối `children` DƯỚI lưới số —
              chỉ phần lưới chưa có (giải thích, nguồn, thao tác), không lặp số.
              Chế độ gọn của bản đồ (`@container/map` <15rem, chữ phóng to): ngăn
              rộng gần trọn màn để ba nút đầu ngăn đứng MỘT hàng.
              Sàn cao `min(10rem,75%)` tính bằng REM: cỡ thường (≤160px) vẫn là 1/3
              màn; chữ phóng 200% thì sàn gấp đôi — đầu ngăn to ra không ăn hết
              chỗ đọc số (đo 320×700 @32px: đầu 108px trong ngăn 276px). */
          <div
            id={`${panelId}-ngan`}
            ref={nganRef}
            tabIndex={-1}
            aria-label={label}
            onFocusCapture={() => {
              focusInNgan.current = true;
            }}
            onBlurCapture={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) focusInNgan.current = false;
            }}
            onPointerDown={(e) => {
              dragX.current = e.clientX;
            }}
            onPointerUp={(e) => onSideUp(e, true)}
            style={{ touchAction: "pan-y" }}
            className="anim-pop-in pointer-events-auto absolute bottom-2 right-0 flex h-[34%] min-h-[min(10rem,75%)] w-[min(22rem,84%)] @max-[15rem]/map:w-[calc(100%-0.5rem)] flex-col rounded-l-2xl border border-r-0 border-line bg-background/97 shadow-float focus:outline-none focus-visible:ring-2 focus-visible:ring-sea"
          >
            <div className="@container flex flex-wrap items-center gap-1 border-b border-line py-1.5 pl-3 pr-2">
              {/*  ĐẦU NGĂN THÍCH ỨNG (rà Codex lần 9–10, đo 320×700 chữ 200%):
                   · rộng ≥15rem (cỡ thường): MỘT hàng — tiêu đề · chip · Giữ mở · Thu.
                   · hẹp hơn (chữ phóng to): tiêu đề đứng RIÊNG một dòng (trước bị ép
                     còn rộng 0), "Giữ mở" chỉ còn icon khoá (tên đọc giữ nguyên) và
                     ba nút thu về 2.25rem để vừa MỘT hàng dưới — thả cho nút tự rớt dòng thì đầu ngăn
                     cao 201px, chỉ còn 107px đọc số. Tiêu đề xuống dòng, không cắt. */}
              <div className="min-w-0 flex-1 break-words leading-tight @max-[15rem]:basis-full">
                {sideTitle ?? <span className="text-[0.875rem] font-semibold text-navy">{label}</span>}
              </div>
              {sideHeader && (
                <span className="contents @max-[15rem]:[&_button]:h-9 @max-[15rem]:[&_button]:min-h-0 @max-[15rem]:[&_button]:w-9">
                  {sideHeader}
                </span>
              )}
              {onSideHoldChange && (
                /*  GIỮ MỞ — chữ (2 chữ) chứ không chỉ icon ghim: ghim đọc thành
                    "ghim chỗ này lên bản đồ". Bật = nền sea đặc chữ trắng. */
                <button
                  type="button"
                  aria-pressed={sideHold}
                  aria-label="Giữ mở"
                  onClick={() => onSideHoldChange(!sideHold)}
                  className={`flex h-(--h-ctl) shrink-0 items-center justify-center rounded-full px-2.5 text-[0.8125rem] font-semibold active:scale-95 @max-[15rem]:h-9 @max-[15rem]:w-9 @max-[15rem]:px-0 ${
                    sideHold ? "bg-sea text-white" : "bg-field text-navy"
                  }`}
                >
                  <span className="@max-[15rem]:sr-only">Giữ mở</span>
                  <LockIcon className="hidden h-4 w-4 @max-[15rem]:block" aria-hidden />
                </button>
              )}
              <button
                type="button"
                onClick={() => onSizeChange("hidden")}
                aria-label="Thu bảng sang phải"
                className="flex h-(--h-ctl) w-(--h-ctl) shrink-0 @max-[15rem]:h-9 @max-[15rem]:w-9 items-center justify-center rounded-full bg-field text-navy active:scale-95"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2 [overscroll-behavior:contain]">
              {sideDense ?? peek}
              {sideDense &&
                (wide ? (
                  <div className="mt-3 border-t border-line pt-3">{children}</div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setWide(true)}
                    aria-expanded={false}
                    className="mt-2 flex h-(--h-ctl) w-full items-center justify-center gap-1 rounded-full bg-field text-[0.8125rem] font-semibold text-navy active:scale-[0.98]"
                  >
                    Xem đủ
                    <ChevronDownIcon className="h-4 w-4" />
                  </button>
                ))}
              {!sideDense && <div className="mt-2">{children}</div>}
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section
      role="region"
      aria-label={label}
      data-snap-sheet=""
      onPointerDownCapture={onInteract}
      onKeyDownCapture={onInteract}
      // CUỘN cũng là "đang đọc" → nạp lại đồng hồ tự-ẩn. Dùng onScrollCapture ở
      // SECTION (không phải onScroll ở riêng div thân): `scroll` không bubble
      // nhưng có pha CAPTURE, nên bắt được cả thân sheet LẪN vùng cuộn LỒNG bên
      // trong (vd danh sách tuyến trong route-planner) — chỉ onScroll ở thân thì
      // cuộn list con không bắn, sheet sập giữa lúc đọc.
      onScrollCapture={onInteract}
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
      {/* nội dung nổi sát mép trên sheet — bottom-full nên tự theo sheet.
          Nấc `hidden`: pill "Sóng…" dính ĐÁY hàng kéo 56px (items-end) nên chừa
          ~26px trống phía trên; kéo khối `above` (chip độ phủ + dải ngày) XUỐNG
          sát pill bằng margin âm để BA KHỐI đứng sát nhau, bản đồ đỡ bị che
          (user 2026-08-29). Nấc mở giữ nguyên pb-2. */}
      {above && (
        <div
          className={`pointer-events-none absolute inset-x-0 px-2 ${
            hidden ? "bottom-full -mb-4 pb-0" : "bottom-full pb-2"
          }`}
        >
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
            ? "Vuốt lên để xem thông tin gió sóng tại điểm đang xem"
            : "Vuốt lên để xem thêm, vuốt xuống để thu gọn"
        }
      >
        {hidden ? (
          hiddenLabel ? (
            /* Có chữ thì viên kính nở NGANG (vẫn h-8, không cao thêm): vạch kéo
               ngắn lại giữ nguyên tín hiệu "vuốt được", chữ `truncate` để máy
               hẹp không đẩy viên kính tràn mép. KHÔNG kèm toạ độ — toạ độ đã có
               ở ô góc trên, đó là chỗ LIẾC, sheet là chỗ ĐỌC KỸ. */
            <span className="glass flex h-8 max-w-full items-center gap-2 rounded-full px-3">
              <span className="h-1.5 w-6 shrink-0 rounded-full bg-navy/40" aria-hidden />
              <span className="truncate text-[0.875rem] font-bold text-navy">
                {hiddenLabel}
              </span>
            </span>
          ) : (
            <span className="glass flex h-8 w-28 items-center justify-center rounded-full">
              <span className="h-1.5 w-12 rounded-full bg-navy/40" aria-hidden />
            </span>
          )
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
        /* Cuộn thân (và mọi vùng cuộn lồng) nạp lại đồng hồ tự-ẩn qua
           onScrollCapture ở <section> trên — cuộn quán tính (buông tay trang vẫn
           trôi) KHÔNG bắn pointerdown, thiếu thì đang trôi giữa chừng sheet sập. */
        <div
          className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-2 [overscroll-behavior:contain]"
        >
          {children}
        </div>
      )}
    </section>
  );
}
