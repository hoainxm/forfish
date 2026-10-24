"use client";

/*
  TRÌNH XEM ẢNH TOÀN MÀN (07 Kairos — thẻ bài, như Facebook): chạm một ô ảnh trong thẻ ⇒ phủ màn nền
  navy, vuốt ngang qua từng ảnh (cuộn snap của trình duyệt — không thư viện), chụm hai ngón để phóng
  (touch-action pinch-zoom). Bố cục theo FB (ảnh anh Long gửi 2026-10-24): × TRÁI · "i/N" GIỮA · ⋯ PHẢI
  (mở mục Tải ảnh — tải ẢNH ĐANG XEM, tai-anh.downloadOne chung với bảng Chia sẻ); đáy ảnh = `chan` (bên gọi
  vẽ tên người đăng + giờ + hàng 👍 💬 ↗). Esc / nút back của máy đều đóng (Esc đóng menu ⋯ trước).
  Con trỏ khi mở đặt vào CHÍNH HỘP (không vào nút — trước đây nút Tải ảnh nhận con trỏ là hiện khung xanh).
  `chan(dong)`: `dong(sau)` đóng trình xem rồi mới chạy `sau` (mở bình luận / bảng chia sẻ) — chạy sau khi
  lùi lịch sử xong, không đè mục lịch sử của màn kế.

  MẤT SÓNG: không thêm request nào — ảnh là đúng URL thẻ đã nạp (trình duyệt có sẵn thì hiện). Ảnh
  không tải được ⇒ "Cần sóng để xem ảnh" thay khung vỡ; nút Tải mờ khi mất sóng.
  Bên gọi CHỈ dựng component này khi mở (lazy-render) — không tốn gì cho thẻ chưa chạm.
*/

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "@/components/icons";
import { focusablesIn, lockBodyScroll, unlockBodyScroll, vongFocus } from "@/lib/dialog-focus";
import { downloadOne } from "@/lib/kairos/tai-anh";
import { NHAN } from "@/lib/labels";
import { useOnline } from "@/lib/use-online";

const DAU = "kairosXemAnh";

function TaiIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14" />
    </svg>
  );
}

export function XemAnh({
  urls,
  start,
  onClose,
  chan,
}: {
  urls: string[];
  start: number;
  onClose: () => void;
  /** đáy ảnh kiểu FB (tên + giờ + hàng cảm xúc/bình luận/chia sẻ); `dong(sau)` đóng rồi chạy `sau` */
  chan?: (dong: (sau?: () => void) => void) => ReactNode;
}) {
  const khung = useRef<HTMLDivElement>(null);
  const hop = useRef<HTMLDivElement>(null);
  const sauRef = useRef<(() => void) | null>(null);
  const dong = useRef(onClose);
  useLayoutEffect(() => {
    dong.current = () => {
      onClose();
      const sau = sauRef.current;
      sauRef.current = null;
      if (sau) setTimeout(sau, 0);
    };
  });
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(false);
  useLayoutEffect(() => {
    menuRef.current = menu;
  });
  const online = useOnline();
  const n = urls.length;
  const dau = Math.min(Math.max(0, Math.floor(start) || 0), Math.max(0, n - 1));
  const [i, setI] = useState(dau);
  const [hong, setHong] = useState<Record<number, true>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [mounted, setMounted] = useState(false);

  /** Đóng: có mục lịch sử của mình thì lùi (popstate đóng) — để nút back sau đó không phải bấm hai lần. */
  const xin = () => {
    if ((window.history.state as Record<string, unknown> | null)?.[DAU]) window.history.back();
    else dong.current();
  };
  // `chan` gọi trong lúc vẽ ⇒ hàm đưa cho nó KHÔNG đụng ref: chỉ đặt yêu cầu, hiệu ứng dưới mới đóng
  const [yeuCau, setYeuCau] = useState<{ sau?: () => void } | null>(null);
  const dongRoi = (sau?: () => void) => setYeuCau({ sau });
  const xinRef = useRef(xin);
  useLayoutEffect(() => {
    xinRef.current = xin;
  });

  useEffect(() => {
    if (!yeuCau) return;
    sauRef.current = yeuCau.sau ?? null;
    xinRef.current();
  }, [yeuCau]);

  // hộp vẽ qua portal SAU lần chạy đầu (mounted) ⇒ đưa con trỏ vào CHÍNH HỘP (không vào nút: nút nhận con
  // trỏ do mã là hiện khung tiêu điểm xanh trên điện thoại — lỗi thấy ở máy anh Long 2026-10-24)
  useEffect(() => {
    if (mounted) hop.current?.focus();
  }, [mounted]);

  useEffect(() => {
    setMounted(true);
    const opener = document.activeElement as HTMLElement | null;
    lockBodyScroll();
    // nút back của máy: đẩy một mục lịch sử cùng URL; StrictMode chạy hiệu ứng hai lần ⇒ chỉ đẩy khi chưa có
    if (!(window.history.state as Record<string, unknown> | null)?.[DAU]) {
      try {
        window.history.pushState({ ...(window.history.state ?? {}), [DAU]: true }, "");
      } catch {
        /* trình duyệt chặn lịch sử ⇒ vẫn còn × và Esc */
      }
    }
    const onPop = () => dong.current();
    // bẫy Tab trong hộp (aria-modal: không lọt ra thẻ bài phía sau); đưa con trỏ vào hộp ở hiệu ứng `mounted` dưới
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (menuRef.current) setMenu(false);
        else xinRef.current();
      }
      if (e.key !== "Tab") return;
      const k = vongFocus(focusablesIn(hop.current), document.activeElement, e.shiftKey);
      if (k) {
        e.preventDefault();
        k.focus();
      }
    };
    window.addEventListener("popstate", onPop);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("keydown", onKey);
      unlockBodyScroll();
      opener?.focus?.();
    };
  }, []);

  // mở là đứng ngay ở ảnh được chạm (không cuộn trượt từ ảnh 1)
  useLayoutEffect(() => {
    const el = khung.current;
    if (el) el.scrollLeft = el.clientWidth * dau;
  }, [mounted, dau]);

  const onScroll = () => {
    const el = khung.current;
    if (!el || !el.clientWidth) return;
    const k = Math.min(n - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth)));
    if (k !== i) {
      setI(k);
      setMsg(null);
    }
  };

  const tai = async () => {
    setMenu(false);
    const url = urls[i];
    if (!url) return;
    setBusy(true);
    setMsg(null);
    const ok = await downloadOne(url, `kairos-anh-${i + 1}.jpg`);
    setBusy(false);
    if (ok) setMsg({ text: "Đã tải ảnh về máy." });
    else {
      window.open(url, "_blank", "noopener");
      setMsg({ text: "Chưa tải về được — đã mở ảnh ở tab mới, giữ ngón lên ảnh để lưu.", bad: true });
    }
  };

  if (!mounted || !n) return null;
  return createPortal(
    <div ref={hop} role="dialog" aria-modal="true" aria-label="Xem ảnh" tabIndex={-1} className="fixed inset-0 z-40 flex flex-col bg-navy text-white outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/60">
      <div className="relative flex h-14 shrink-0 items-center px-2 pt-[env(safe-area-inset-top)]">
        <button
          type="button"
          aria-label={NHAN.dong}
          onClick={xin}
          className="flex h-11 w-11 items-center justify-center rounded-full transition active:scale-[0.95]"
        >
          <CloseIcon className="h-6 w-6" />
        </button>
        <span className="pointer-events-none absolute inset-x-0 text-center text-[1rem] font-semibold tabular-nums" aria-live="polite">
          {n > 1 ? `${i + 1}/${n}` : ""}
        </span>
        <span className="relative ml-auto">
          <button
            type="button"
            aria-label="Thêm"
            aria-haspopup="menu"
            aria-expanded={menu}
            onClick={() => setMenu((m) => !m)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[1.5rem] font-bold leading-none transition active:scale-[0.95]"
          >
            ⋯
          </button>
          {menu && (
            <span role="menu" className="absolute right-0 top-12 z-10 min-w-40 overflow-hidden rounded-xl bg-card py-1 text-foreground shadow-float">
              <button
                type="button"
                role="menuitem"
                disabled={busy || !online || !!hong[i]}
                onClick={() => void tai()}
                className="flex h-11 w-full items-center gap-2 px-4 text-left text-[0.9375rem] font-semibold disabled:opacity-40"
              >
                <TaiIcon className="h-5 w-5" />
                {NHAN.taiAnh}
              </button>
            </span>
          )}
        </span>
      </div>
      <div
        ref={khung}
        onScroll={onScroll}
        onClick={() => setMenu(false)}
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden [overscroll-behavior:contain] [scrollbar-width:none]"
      >
        {urls.map((u, k) => (
          <div key={`${u}-${k}`} className="flex h-full w-full shrink-0 snap-center items-center justify-center">
            {hong[k] ? (
              <p className="px-6 text-center text-[1rem] text-white/80">Cần sóng để xem ảnh</p>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element -- ảnh kho kairos-media / bìa RSS, đúng URL thẻ đã nạp */
              <img
                src={u}
                alt={`Ảnh ${k + 1}/${n}`}
                referrerPolicy="no-referrer"
                onError={() => setHong((h) => ({ ...h, [k]: true }))}
                className="h-full w-full object-contain"
                style={{ touchAction: "pan-x pinch-zoom" }}
              />
            )}
          </div>
        ))}
      </div>
      <div className="shrink-0 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <p role="status" className={`min-h-6 px-4 pt-1 text-center text-[0.875rem] font-semibold ${msg?.bad ? "text-sun" : "text-white/80"}`}>
          {msg?.text ?? ""}
        </p>
        {chan?.(dongRoi)}
      </div>
    </div>,
    document.body,
  );
}
