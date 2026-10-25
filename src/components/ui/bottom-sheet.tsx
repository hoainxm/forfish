"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useExitTransition } from "@/lib/use-exit-transition";
import { focusablesIn, khoaVuotNen, lockBodyScroll, unlockBodyScroll, useLichSuDong, vongFocus, vuotDeDong } from "@/lib/dialog-focus";
import { NHAN } from "@/lib/labels";
import { CloseButton } from "@/components/ui/close-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PrimaryButton } from "@/components/ui/primitives";
import { useVungNhin } from "@/components/kairos/use-vung-nhin";

/*
  ĐÓNG NGĂN TỪ TRONG THÂN (rà FB 2026-10-25, TAU-07/TAU-10): nút Huỷ tự chế trong ngăn `kieu="form"` gọi
  `useDongSheet()()` thay cho `onClose` thẳng ⇒ đi đúng đường của ngăn: đã gõ thì hỏi "Bỏ phần đang ghi?", lùi
  mục lịch sử để back sau không bấm hai lần. Ngoài ngăn ⇒ hàm rỗng (không văng lỗi).
*/
const DongSheetCtx = createContext<(() => void) | null>(null);
const khongLam = () => {};
export function useDongSheet(): () => void {
  return useContext(DongSheetCtx) ?? khongLam;
}

/** Chân Huỷ|Lưu sheet tự vẽ (03 §6 mục 3). `xoa` = hàng chữ đỏ riêng DƯỚI cặp nút, không ngang hàng Lưu. */
export type ChanSheet = {
  luu: string;
  onLuu: () => void;
  dangLuu?: boolean;
  huy?: string;
  xoa?: { nhan: string; onXoa: () => void };
};

/*
  Khoá cuộn nền ĐẾM THAM CHIẾU + giữ focus: dời sang lib/dialog-focus.ts (2026-10-22) để
  ConfirmDialog dùng CHUNG — mở hộp xác nhận từ trong sheet không còn mở khoá nền sớm.
*/
/*
  BottomSheet dùng chung — thay 5 bản copy-paste, kèm a11y đầy đủ (audit 04):
  · role="dialog" aria-modal, có tiêu đề liên kết
  · bẫy focus trong sheet, Escape để đóng, trả focus về nút mở
  · khóa cuộn nền + overscroll-behavior:contain (không kéo trôi trang dưới)
  · chạm nền tối (scrim) để đóng
*/
export function BottomSheet({
  title,
  onClose,
  children,
  kieu = "xem",
  chan,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /**
   * Chân Huỷ|Lưu do sheet vẽ, dính đáy trên bàn phím; thân cuộn riêng. Chỉ có nghĩa với `kieu="form"`.
   * Không truyền ⇒ y như cũ (21 ngăn đang tự vẽ chân, chuyển dần).
   */
  chan?: ChanSheet;
  /**
   * 03 §Nút X mục 2 (rà bố cục 2026-10-22 — trước đây KHÔNG sheet nào có ×):
   *  · `xem` (mặc định) — ngăn đọc/chọn: có × góc trên-phải + vuốt + chạm nền.
   *  · `form` — ngăn nhập liệu: KHÔNG ×, đóng bằng cặp Huỷ/Lưu của bên gọi; vuốt/chạm
   *    nền/Escape khi đã gõ chữ thì HỎI "Bỏ phần đang ghi?" (03 mục 4, CLAUDE.md nguyên
   *    tắc 4 — chống mất sổ của bà con).
   */
  kieu?: "xem" | "form";
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  /*  BÀN PHÍM: ngăn có chân thì cả ngăn đứng lên trên bàn phím (visualViewport) để Huỷ|Lưu luôn bấm được —
      cùng cách khung soạn Kairos. Không chân ⇒ không đụng (bố cục cũ). */
  const vung = useVungNhin();
  const ban = chan ? (vung?.ban ?? 0) : 0;
  const titleId = useId();
  // đóng có animation trượt xuống (API ngoài giữ nguyên: vẫn nhận onClose)
  const { closing, requestClose } = useExitTransition(onClose);
  /*  ĐÃ GÕ CHỮ CHƯA — bắt sự kiện `input` (pha capture) trong ngăn: bất kỳ ô nhập nào gõ/đổi
      là coi như có phần đang ghi. Không cần bên gọi tự báo "dirty". */
  const daGoRef = useRef(false);
  const [hoiBo, setHoiBo] = useState(false);
  const hoiBoRef = useRef(false);
  useEffect(() => {
    hoiBoRef.current = hoiBo;
  }, [hoiBo]);
  /** Đóng "nhẹ" (chạm nền / Escape / vuốt): ngăn form đã gõ thì hỏi trước. */
  const dongNhe = useCallback(() => {
    if (kieu === "form" && daGoRef.current) setHoiBo(true);
    else requestClose();
  }, [kieu, requestClose]);
  /*  BACK CỦA MÁY ĐÓNG NGĂN TRƯỚC KHI RỜI TRANG (rà FB 2026-10-25, TAU-01/VT-06): ngăn mở chiếm một mục lịch sử;
      back ⇒ `dongNhe` (form đã gõ vẫn hỏi "Bỏ phần đang ghi?" — chọn "Ghi tiếp" thì `giuLai` đẩy mục lại). Mọi
      đường đóng do bà con (×, Escape, chạm nền) đi qua `dongTay` để lần back sau không phải bấm hai lần. */
  const { dongTay, giuLai } = useLichSuDong(dongNhe);

  /*  VUỐT XUỐNG ĐỂ ĐÓNG (03 mục 4 — thanh kéo trước đây chỉ để trang trí). Bắt trên thanh
      kéo + hàng tiêu đề (không bắt trong thân: thân còn phải cuộn). Ngón theo tay; thả
      ra quá 80px hoặc hất nhanh thì đóng (lib/dialog-focus vuotDeDong), không thì bật về. */
  const keoRef = useRef<{ y0: number; t0: number; dy: number } | null>(null);
  const [vuotDong, setVuotDong] = useState(false);
  const datViTri = (dy: number, muot: boolean) => {
    const el = panelRef.current;
    if (!el) return;
    el.style.transition = muot ? "transform 200ms var(--ease-drawer)" : "none";
    el.style.transform = dy > 0 ? `translateY(${dy}px)` : "";
  };
  const onKeoXuong = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    // Chạm vào NÚT trong hàng tiêu đề (× đóng…) thì không bắt kéo: setPointerCapture
    // chuyển cả click về lớp bọc, nút × không bao giờ nhận click (thấy 2026-10-25 lô 2).
    if (e.target instanceof Element && e.target.closest("button, a")) return;
    keoRef.current = { y0: e.clientY, t0: performance.now(), dy: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onKeo = (e: React.PointerEvent) => {
    const k = keoRef.current;
    if (!k) return;
    k.dy = Math.max(0, e.clientY - k.y0);
    datViTri(k.dy, false);
  };
  const onTha = () => {
    const k = keoRef.current;
    keoRef.current = null;
    if (!k) return;
    if (vuotDeDong(k.dy, performance.now() - k.t0)) {
      if (kieu === "form" && daGoRef.current) {
        datViTri(0, true);
        setHoiBo(true);
        return;
      }
      setVuotDong(true); // trượt nốt từ chỗ ngón thả, không nhảy về đầu rồi mới trượt
      datViTri(panelRef.current?.offsetHeight ?? 600, true);
      requestClose();
      return;
    }
    datViTri(0, true);
  };
  // mounted gate: portal chỉ chạy sau hydrate (SSR không có document.body)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /*  Hiệu ứng MỞ chỉ chạy MỘT LẦN mỗi lần mở (khoá cuộn, đặt con trỏ vào ô đầu, trả con trỏ khi đóng). Đọc
      `dongTay` mới nhất qua ref — KHÔNG để nó vào deps: bên gọi đổi onClose mỗi lần vẽ thì hiệu ứng chạy lại MỖI PHÍM,
      con trỏ nhảy khỏi ô đang gõ ("gõ từng chữ một", khung soạn Kairos 2026-10-24).
      CHẠY SAU `mounted` (TAU-13, 2026-10-25): lần vẽ đầu chưa có portal ⇒ panelRef null ⇒ trước đây không bao giờ
      đặt được con trỏ vào ô đầu (bàn phím Android không tự lên). */
  const dongTayRef = useRef(dongTay);
  useEffect(() => {
    dongTayRef.current = dongTay;
  });
  useEffect(() => {
    if (!mounted) return;
    const opener = document.activeElement as HTMLElement | null;
    lockBodyScroll();
    // VO-APP-09: touchmove non-passive trên scrim — iOS không trôi trang sau (lib/dialog-focus khoaVuotNen)
    const goVuot = scrimRef.current ? khoaVuotNen(scrimRef.current, () => panelRef.current) : undefined;
    // focus phần tử đầu tiên trong sheet (bỏ qua nút × để không bung bàn phím/đọc "Đóng" trước)
    const dau = focusablesIn(panelRef.current).find((el) => !el.closest("[data-dong-sheet]"));
    (dau ?? focusablesIn(panelRef.current)[0])?.focus();

    function onKey(e: KeyboardEvent) {
      if (hoiBoRef.current) return; // hộp "Bỏ phần đang ghi?" đang lo phím
      if (e.key === "Escape") {
        e.preventDefault();
        dongTayRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const next = vongFocus(focusablesIn(panelRef.current), document.activeElement, e.shiftKey);
      if (next) {
        e.preventDefault();
        next.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      goVuot?.();
      unlockBodyScroll();
      opener?.focus?.();
    };
  }, [mounted]);

  if (!mounted) return null;

  // PORTAL ra document.body — thoát MỌI stacking/containing-block của tổ tiên
  // (vd wrapper `relative z-10` của BoatSwitcher tạo stacking context, nhốt
  // sheet z-30 xuống lớp z-10 → bottom-nav z-20 đè lên che nút Lưu/Hủy). Portal
  // làm sheet luôn là overlay toàn màn ở gốc body, trên mọi thứ.
  return createPortal(
    <>
    <div
      ref={scrimRef}
      /*  touch-none + touchmove preventDefault (VO-APP-09, 2026-10-25): iOS Safari bỏ qua overflow:hidden trên body —
          vuốt trên nền mờ vẫn trôi trang phía sau; chặn cử chỉ ngay trên nền. Thân ngăn là vùng cuộn riêng nên không
          bị ảnh hưởng (khoaVuotNen chỉ chặn trong panel khi không có gì cuộn được). */
      className={`fixed inset-0 z-30 flex touch-none items-end justify-center bg-black/50 ${
        closing ? "anim-scrim-out" : "anim-scrim-in"
      }`}
      style={ban > 0 ? { bottom: ban } : undefined}
      onClick={dongTay}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        onInputCapture={() => {
          daGoRef.current = true;
        }}
        className={`w-full max-w-(--w-app) overflow-y-auto rounded-t-[1.75rem] bg-background p-5 [overscroll-behavior:contain] ${
          chan ? "pb-0" : "pb-[max(2rem,env(safe-area-inset-bottom))]"
        } ${vuotDong ? "" : closing ? "anim-sheet-out" : "anim-sheet-in"}`}
        style={{ maxHeight: ban > 0 ? `calc(85dvh - ${ban}px)` : "85dvh" }}
      >
        {/* thanh kéo + hàng tiêu đề = vùng VUỐT xuống để đóng (touch-action none: trình
            duyệt không giành cử chỉ để cuộn trang) */}
        <div
          className="-mx-5 -mt-5 touch-none select-none px-5 pt-3"
          onPointerDown={onKeoXuong}
          onPointerMove={onKeo}
          onPointerUp={onTha}
          onPointerCancel={onTha}
        >
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line" aria-hidden />
          <div className="mb-4 flex items-start justify-between gap-2">
            <h3 id={titleId} className="display min-w-0 pt-1 text-[1.375rem] font-semibold leading-tight text-navy">
              {title}
            </h3>
            {kieu === "xem" && (
              <span data-dong-sheet="1" className="contents">
                <CloseButton onClose={dongTay} label={`Đóng ${title}`} />
              </span>
            )}
          </div>
        </div>
        <DongSheetCtx.Provider value={dongTay}>
          {children}
          {chan && (
            /* chân DÍNH đáy vùng cuộn của ngăn — thân dài thì cuộn, cặp nút vẫn thấy */
            <div className="sticky bottom-0 -mx-5 bg-background px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={dongTay}
                  className="display flex h-(--h-cta) items-center justify-center rounded-xl bg-field text-[1rem] font-semibold text-foreground/70"
                >
                  {chan.huy ?? NHAN.huy}
                </button>
                <PrimaryButton onClick={chan.onLuu} disabled={chan.dangLuu}>
                  {chan.luu}
                </PrimaryButton>
              </div>
              {chan.xoa && (
                <button
                  type="button"
                  onClick={chan.xoa.onXoa}
                  className="mt-1 flex h-(--h-ctl) w-full items-center justify-center text-[1rem] font-semibold text-danger"
                >
                  {chan.xoa.nhan}
                </button>
              )}
            </div>
          )}
        </DongSheetCtx.Provider>
      </div>
    </div>
      {/* NGOÀI lớp nền mờ của ngăn — cú bấm trong hộp hỏi không dội lên nền (React cho sự
          kiện đi xuyên portal theo cây component) */}
      {hoiBo && (
        <ConfirmDialog
          title="Bỏ phần đang ghi?"
          message="Những gì bà con vừa gõ chưa được lưu."
          cancelLabel="Ghi tiếp"
          confirmLabel="Bỏ"
          onCancel={() => {
            setHoiBo(false);
            giuLai(); // back đã ăn mất mục của ngăn ⇒ đẩy lại, lần back sau vẫn hỏi trước khi rời trang
          }}
          onConfirm={() => {
            setHoiBo(false);
            requestClose();
          }}
        />
      )}
    </>,
    document.body,
  );
}
