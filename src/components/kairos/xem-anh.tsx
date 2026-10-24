"use client";

/*
  TRÌNH XEM ẢNH TOÀN MÀN (07 Kairos — thẻ bài, như Facebook): chạm một ô ảnh trong thẻ ⇒ phủ màn nền
  navy, vuốt ngang qua từng ảnh (cuộn snap của trình duyệt — không thư viện), chụm hai ngón để phóng
  (touch-action pinch-zoom), bộ đếm "i/N", × chấm nhỏ góc trên phải (CloseButton `goc`), Esc / nút
  back của máy đều đóng. Nút Tải ảnh tải ẢNH ĐANG XEM (tai-anh.downloadOne — chung với bảng Chia sẻ).

  MẤT SÓNG: không thêm request nào — ảnh là đúng URL thẻ đã nạp (trình duyệt có sẵn thì hiện). Ảnh
  không tải được ⇒ "Cần sóng để xem ảnh" thay khung vỡ; nút Tải mờ khi mất sóng.
  Bên gọi CHỈ dựng component này khi mở (lazy-render) — không tốn gì cho thẻ chưa chạm.
*/

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CloseButton } from "@/components/ui/close-button";
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

export function XemAnh({ urls, start, onClose }: { urls: string[]; start: number; onClose: () => void }) {
  const khung = useRef<HTMLDivElement>(null);
  const hop = useRef<HTMLDivElement>(null);
  const dong = useRef(onClose);
  useLayoutEffect(() => {
    dong.current = onClose;
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
  const xinRef = useRef(xin);
  useLayoutEffect(() => {
    xinRef.current = xin;
  });

  // hộp vẽ qua portal SAU lần chạy đầu (mounted) ⇒ đưa con trỏ vào hộp khi đã có trên trang
  useEffect(() => {
    if (mounted) focusablesIn(hop.current)[0]?.focus();
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
      if (e.key === "Escape") xinRef.current();
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
    <div ref={hop} role="dialog" aria-modal="true" aria-label="Xem ảnh" className="fixed inset-0 z-40 flex flex-col bg-navy text-white">
      <div className="flex h-14 shrink-0 items-center gap-2 px-4 pt-[env(safe-area-inset-top)]">
        <span className="text-[0.9375rem] font-semibold tabular-nums" aria-live="polite">
          {n > 1 ? `${i + 1}/${n}` : ""}
        </span>
        <button
          type="button"
          aria-label={NHAN.taiAnh}
          disabled={busy || !online || !!hong[i]}
          onClick={() => void tai()}
          className="ml-auto mr-12 flex h-11 w-11 items-center justify-center rounded-full transition active:scale-[0.95] disabled:opacity-40"
        >
          <TaiIcon className="h-6 w-6" />
        </button>
        <span className="absolute right-4 top-[calc(env(safe-area-inset-top)+1rem)] h-0 w-0">
          <CloseButton variant="goc" onClose={xin} />
        </span>
      </div>
      <div
        ref={khung}
        onScroll={onScroll}
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
      <p role="status" className={`min-h-12 shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 text-center text-[0.875rem] font-semibold ${msg?.bad ? "text-sun" : "text-white/80"}`}>
        {msg?.text ?? (!online && !hong[i] ? NHAN.canSong + " để tải ảnh" : "")}
      </p>
    </div>,
    document.body,
  );
}
