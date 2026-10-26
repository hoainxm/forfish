"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { CloseButton } from "@/components/ui/close-button";
import { type BoatDocument, kindLabel } from "@/lib/documents";
import { docAnhGiayUrl } from "@/lib/doc-photos";
import { lockBodyScroll, unlockBodyScroll, useLichSuDong } from "@/lib/dialog-focus";
import { formatVnDate } from "@/lib/format";
import { chuHanXuatTrinh, dongTauXuatTrinh, thuTuXuatTrinh } from "@/lib/xuat-trinh";

/*
  XUẤT TRÌNH GIẤY TỜ CHO CÁN BỘ (ADR 0017, 2026-10-26 — anh Long: "lúc cần có thể show các bản này cho cán bộ,
  cơ quan… show nhanh cho cán bộ kiểm tra").

  Kiểm tra của biên phòng / kiểm ngư hay ở cửa lạch, trên biển — đúng chỗ không có sóng ⇒ màn này đọc ảnh từ KHO
  TRONG MÁY (lib/giay-anh-kho qua docAnhGiayUrl), không chờ mạng. Tủ giấy tờ cất sẵn ảnh vào kho mỗi lần mở lúc có
  sóng (`luuSanAnhGiay`) ⇒ ra biển là có.

  Rà UI 2026-10-26 (03 §0/§0b/§6 mục 5+8): nền SÁNG như mọi màn (không nền tối tự chế), × = `CloseButton` chung góc
  trên-phải hàng tiêu đề, chip hạn dùng cặp token trạng thái (`*-bg` + chữ cùng màu, AA), nút ‹ › cao `--h-cta` bo
  0.75rem, chấm vị trí là phần tử vẽ (không ký tự). Portal ra body + z-[90]: tủ giấy tờ nằm trong lớp `relative z-10`
  (BoatSwitcher) — không portal thì dock z-20 đè lên. MỘT giấy một lúc theo thứ tự bộ giấy (DOCUMENT_KINDS) — cán bộ
  xem đúng thứ tự họ hỏi. Chạm ảnh ⇒ phóng 2× (cuộn được), lúc đang phóng KHÔNG nhận vuốt đổi giấy (vuốt là để kéo
  ảnh). Giữ màn sáng (wakeLock) khi đang trình. Đóng: × · Escape · back.

  Ma trận: giấy không ảnh ⇒ "Chưa có ảnh giấy này."; ảnh chưa vào kho + mất sóng ⇒ "Ảnh chưa lưu trong máy — cần
  sóng một lần."; đang mở ⇒ "Đang mở ảnh…".
*/

const MAU_CHIP = {
  expired: "bg-danger-bg text-danger",
  soon: "bg-warn-bg text-warn",
  ok: "bg-ok-bg text-ok",
  none: "bg-field text-foreground/75",
} as const;

function AnhGiay({ path, onPhong }: { path: string; onPhong: (to: boolean) => void }) {
  const [a, setA] = useState<{ url: string | null } | null>(null);
  const [to, setTo] = useState(false);
  useEffect(() => {
    let alive = true;
    let blobUrl: string | null = null;
    docAnhGiayUrl(path).then((r) => {
      if (!alive) {
        if (r?.url.startsWith("blob:")) URL.revokeObjectURL(r.url);
        return;
      }
      if (r?.url.startsWith("blob:")) blobUrl = r.url;
      setA({ url: r?.url ?? null });
    });
    return () => {
      alive = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [path]);

  if (!a || !a.url) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-line px-6 text-center text-[0.875rem] text-foreground/65">
        {!a ? "Đang mở ảnh…" : "Ảnh chưa lưu trong máy — cần sóng một lần."}
      </div>
    );
  }
  return (
    <div data-phong={to ? "" : undefined} className={`overflow-auto rounded-2xl border border-line bg-field ${to ? "max-h-[70dvh]" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- ảnh kho trong máy (blob:) / signed URL */}
      <img
        src={a.url}
        alt="Ảnh giấy tờ — chạm để phóng to"
        onClick={() => {
          setTo((v) => !v);
          onPhong(!to);
        }}
        className={to ? "w-[200%] max-w-none" : "max-h-[70dvh] w-full object-contain"}
      />
    </div>
  );
}

export function XuatTrinhGiay({
  docs,
  tenTau,
  maTau,
  today,
  onClose,
}: {
  docs: BoatDocument[];
  tenTau?: string;
  maTau?: string;
  today: Date;
  onClose: () => void;
}) {
  const ds = thuTuXuatTrinh(docs);
  const [i, setI] = useState(0);
  const [phong, setPhong] = useState(false);
  const { dongTay } = useLichSuDong(onClose);
  const touchX = useRef<number | null>(null);
  const hopRef = useRef<HTMLDivElement>(null);
  const tieuDeRef = useRef<HTMLHeadingElement>(null);

  // đổi giấy ⇒ về đầu thân + thôi phóng + đưa focus vào tên giấy (người đọc màn hình nghe giấy mới)
  const toi = (k: number) => {
    setI(Math.max(0, Math.min(ds.length - 1, k)));
    setPhong(false);
  };
  useEffect(() => {
    hopRef.current?.scrollTo({ top: 0 });
    tieuDeRef.current?.focus({ preventScroll: true });
  }, [i]);

  // khoá cuộn nền + phím + giữ màn sáng khi đang trình (máy không có wakeLock thì thôi)
  useEffect(() => {
    lockBodyScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dongTay();
      if (e.key === "ArrowRight") setI((v) => Math.min(ds.length - 1, v + 1));
      if (e.key === "ArrowLeft") setI((v) => Math.max(0, v - 1));
    };
    window.addEventListener("keydown", onKey);
    let khoa: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then((k) => (khoa = k)).catch(() => {});
    return () => {
      unlockBodyScroll();
      window.removeEventListener("keydown", onKey);
      void khoa?.release().catch(() => {});
    };
  }, [dongTay, ds.length]);

  const doc = ds[i];
  if (!doc || typeof document === "undefined") return null;
  const han = chuHanXuatTrinh(doc, today);
  const tau = dongTauXuatTrinh(tenTau, maTau);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Xuất trình giấy tờ"
      className="fixed inset-0 z-[90] mx-auto flex max-w-(--w-app) flex-col bg-background text-foreground"
      onTouchStart={(e) => {
        // đang phóng ảnh ⇒ vuốt là kéo ảnh, không đổi giấy
        touchX.current = phong ? null : (e.touches[0]?.clientX ?? null);
      }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
        touchX.current = null;
        if (dx < -60) toi(i + 1);
        if (dx > 60) toi(i - 1);
      }}
    >
      <div className="flex items-center gap-2 border-b border-line px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0 flex-1">
          <p className="break-words text-[0.8125rem] text-foreground/65">{tau}</p>
          <p className="text-[1rem] font-semibold text-navy">
            Giấy {i + 1}/{ds.length}
          </p>
        </div>
        <CloseButton onClose={dongTay} />
      </div>

      <div ref={hopRef} className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3">
        {doc.label !== kindLabel(doc.kind) && <p className="text-[0.875rem] text-foreground/65">{kindLabel(doc.kind)}</p>}
        <h2 ref={tieuDeRef} tabIndex={-1} className="rounded-md text-[1.5rem] font-semibold leading-tight text-navy outline-none focus-visible:ring-2 focus-visible:ring-sea/40">
          {doc.label}
        </h2>
        <p className={`mt-2 inline-block rounded-full px-3 py-1 text-[1rem] font-semibold ${MAU_CHIP[han.muc]}`}>{han.text}</p>
        {(doc.number || doc.issuedOn) && (
          <p className="mt-2 text-[1rem] text-foreground/85">
            {doc.number && (
              <>
                Số: <span className="font-semibold text-navy">{doc.number}</span>
              </>
            )}
            {doc.number && doc.issuedOn && " · "}
            {doc.issuedOn && <>Cấp: {formatVnDate(doc.issuedOn)}</>}
          </p>
        )}
        <div className="mt-3 space-y-3">
          {doc.photos?.length ? (
            doc.photos.map((p) => <AnhGiay key={`${doc.id}:${p}`} path={p} onPhong={setPhong} />)
          ) : (
            <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-line px-6 text-center text-[0.875rem] text-foreground/65">
              Chưa có ảnh giấy này.
            </div>
          )}
        </div>
      </div>

      {ds.length > 1 && (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-t border-line px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <button
            type="button"
            onClick={() => toi(i - 1)}
            disabled={i === 0}
            aria-label="Giấy trước"
            className="flex h-(--h-cta) items-center justify-center rounded-xl bg-field text-navy transition active:scale-[0.98] disabled:opacity-40"
          >
            <ChevronLeftIcon className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-1.5" aria-hidden>
            {ds.map((d, k) => (
              <span key={d.id} className={`h-2 w-2 rounded-full ${k === i ? "bg-navy" : "bg-line"}`} />
            ))}
          </div>
          <button
            type="button"
            onClick={() => toi(i + 1)}
            disabled={i === ds.length - 1}
            aria-label="Giấy sau"
            className="flex h-(--h-cta) items-center justify-center rounded-xl bg-field text-navy transition active:scale-[0.98] disabled:opacity-40"
          >
            <ChevronRightIcon className="h-6 w-6" />
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}
