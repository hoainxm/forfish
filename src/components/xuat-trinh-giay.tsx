"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from "@/components/icons";
import { type BoatDocument, DOCUMENT_KINDS, getExpiryStatus, kindLabel } from "@/lib/documents";
import { docAnhGiayUrl } from "@/lib/doc-photos";
import { lockBodyScroll, unlockBodyScroll, useLichSuDong } from "@/lib/dialog-focus";
import { formatVnDate } from "@/lib/format";

/*
  XUẤT TRÌNH GIẤY TỜ CHO CÁN BỘ (ADR 0017, 2026-10-26 — anh Long: "lúc cần có thể show các bản này cho cán bộ,
  cơ quan… show nhanh cho cán bộ kiểm tra").

  Kiểm tra của biên phòng / kiểm ngư hay ở cửa lạch, trên biển — đúng chỗ không có sóng ⇒ màn này đọc ảnh từ KHO
  TRONG MÁY (lib/giay-anh-kho qua docAnhGiayUrl), không chờ mạng. Toàn màn hình nền tối, chữ to, MỘT giấy một lúc
  (vuốt / nút ‹ › đổi giấy) theo thứ tự bộ giấy bà con mang theo (DOCUMENT_KINDS) — cán bộ xem đúng thứ tự họ hỏi.
  Chạm ảnh ⇒ phóng 2× (cuộn được) để đọc số, dấu; chạm lại ⇒ thu. Giữ màn hình sáng (wakeLock) khi đang trình —
  đưa máy cho cán bộ mà màn tắt là phải mở khoá lại. Chỉ ×  góc trên phải đóng (luật thẻ nổi 03 §6), Escape, back.

  Ma trận: giấy không ảnh ⇒ "Chưa có ảnh"; ảnh chưa vào kho + mất sóng ⇒ "Cần sóng lần đầu"; đang mở ⇒ "Đang mở…".
*/

/** Thứ tự trình: theo bộ giấy (đăng ký → đăng kiểm → phép → ATTP → bảo hiểm → chứng chỉ → khác), rồi tên. */
export function thuTuXuatTrinh<T extends BoatDocument>(docs: T[]): T[] {
  const bac = new Map(DOCUMENT_KINDS.map((k, i) => [k.value, i]));
  return [...docs].sort((a, b) => (bac.get(a.kind) ?? 99) - (bac.get(b.kind) ?? 99) || a.label.localeCompare(b.label, "vi"));
}

type AnhTrangThai = { url: string | null; trongMay: boolean; loi: boolean };

function AnhGiay({ path }: { path: string }) {
  const [a, setA] = useState<AnhTrangThai | null>(null);
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
      setA(r ? { url: r.url, trongMay: r.trongMay, loi: false } : { url: null, trongMay: false, loi: true });
    });
    return () => {
      alive = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [path]);

  if (!a) return <div className="flex h-56 items-center justify-center rounded-2xl bg-white/10 text-[1rem] text-white/80">Đang mở ảnh…</div>;
  if (!a.url) {
    return (
      <div className="flex h-56 items-center justify-center rounded-2xl bg-white/10 px-6 text-center text-[1rem] leading-snug text-white/80">
        Ảnh chưa có trong máy — cần sóng một lần để tải về, lần sau mất sóng vẫn xem được.
      </div>
    );
  }
  return (
    <div className={`overflow-auto rounded-2xl bg-black ${to ? "max-h-[70dvh]" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- ảnh kho trong máy / signed URL */}
      <img
        src={a.url}
        alt="Ảnh giấy tờ"
        onClick={() => setTo((v) => !v)}
        className={to ? "max-w-none w-[200%]" : "w-full object-contain max-h-[70dvh]"}
      />
    </div>
  );
}

export function XuatTrinhGiay({ docs, tenTau, today, onClose }: { docs: BoatDocument[]; tenTau?: string; today: Date; onClose: () => void }) {
  const ds = thuTuXuatTrinh(docs);
  const [i, setI] = useState(0);
  const { dongTay } = useLichSuDong(onClose);
  const touchX = useRef<number | null>(null);

  // khoá cuộn nền + Escape + giữ màn sáng khi đang trình (best-effort, máy không có thì thôi)
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
  if (!doc) return null;
  const st = getExpiryStatus(doc, today);
  const mau =
    st.level === "expired" ? "bg-danger text-white" : st.level === "soon" ? "bg-warn text-navy" : st.level === "ok" ? "bg-ok text-white" : "bg-white/20 text-white";
  const dong = (dx: number) => {
    if (dx < -60) setI((v) => Math.min(ds.length - 1, v + 1));
    if (dx > 60) setI((v) => Math.max(0, v - 1));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Xuất trình giấy tờ"
      className="fixed inset-0 z-[90] flex flex-col bg-navy text-white"
      onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        if (touchX.current != null) dong((e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current);
        touchX.current = null;
      }}
    >
      <div className="flex items-center gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.8125rem] text-white/70">{tenTau ? `Tàu ${tenTau}` : "Giấy tờ tàu"}</p>
          <p className="text-[1rem] font-semibold">
            Giấy {i + 1}/{ds.length}
          </p>
        </div>
        <button
          type="button"
          onClick={dongTay}
          aria-label="Đóng"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 transition active:scale-95"
        >
          <CloseIcon className="h-6 w-6" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {doc.label !== kindLabel(doc.kind) && <p className="text-[0.875rem] text-white/70">{kindLabel(doc.kind)}</p>}
        <h2 className="text-[1.5rem] font-bold leading-tight">{doc.label}</h2>
        <p className={`mt-2 inline-block rounded-full px-3 py-1 text-[1rem] font-semibold ${mau}`}>
          {doc.expiresOn ? `${st.label} · hết hạn ${formatVnDate(doc.expiresOn)}` : "Không thời hạn"}
        </p>
        {(doc.number || doc.issuedOn) && (
          <p className="mt-2 text-[1rem] text-white/90">
            {doc.number && (
              <>
                Số: <strong>{doc.number}</strong>
              </>
            )}
            {doc.number && doc.issuedOn && " · "}
            {doc.issuedOn && <>Cấp: {formatVnDate(doc.issuedOn)}</>}
          </p>
        )}
        <div className="mt-3 space-y-3">
          {doc.photos?.length ? (
            doc.photos.map((p) => <AnhGiay key={p} path={p} />)
          ) : (
            <div className="flex h-40 items-center justify-center rounded-2xl bg-white/10 px-6 text-center text-[1rem] text-white/80">
              Chưa có ảnh giấy này — về Tủ giấy tờ, Sửa › Chụp giấy.
            </div>
          )}
        </div>
      </div>

      {ds.length > 1 && (
        <div className="flex items-center gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
          <button
            type="button"
            onClick={() => setI((v) => Math.max(0, v - 1))}
            disabled={i === 0}
            aria-label="Giấy trước"
            className="flex h-14 flex-1 items-center justify-center rounded-2xl bg-white/15 text-[1.125rem] font-semibold disabled:opacity-40"
          >
            <ChevronLeftIcon className="h-7 w-7" />
          </button>
          <span className="text-[0.875rem] text-white/70" aria-hidden>
            {ds.map((d, k) => (k === i ? "●" : "○")).join(" ")}
          </span>
          <button
            type="button"
            onClick={() => setI((v) => Math.min(ds.length - 1, v + 1))}
            disabled={i === ds.length - 1}
            aria-label="Giấy sau"
            className="flex h-14 flex-1 items-center justify-center rounded-2xl bg-white/15 text-[1.125rem] font-semibold disabled:opacity-40"
          >
            <ChevronRightIcon className="h-7 w-7" />
          </button>
        </div>
      )}
    </div>
  );
}
