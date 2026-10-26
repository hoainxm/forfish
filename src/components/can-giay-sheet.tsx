"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RotateIcon } from "@/components/icons";
import { PrimaryButton } from "@/components/ui/primitives";
import { caKhung, coRa, laLoi, lamRoChu, nanThang, nhanGoc, timGoc, xam, xoay90, type BonGoc, type Diem } from "@/lib/can-giay";
import { lockBodyScroll, unlockBodyScroll, useLichSuDong } from "@/lib/dialog-focus";
import { NHAN } from "@/lib/labels";

/*
  CĂN GIẤY SAU KHI CHỤP (2026-10-26 — anh Long: "chụp ảnh còn phải căn chỉnh sao cho dễ đọc"). Toàn bộ chạy TRÊN MÁY
  (mất sóng vẫn căn được): ảnh ≤1600px → app TỰ tìm 4 góc tờ giấy (lib/can-giay timGoc trên bản nhỏ 320px) → bà con
  thấy khung xanh bám tờ giấy, kéo 4 chấm nếu lệch → "Dùng ảnh" ⇒ nắn thẳng phối cảnh + cắt nền thừa ⇒ hai bản:
  ảnh LƯU (màu thật, để xuất trình) + ảnh ĐỌC (làm rõ chữ, gửi máy nhà). Không tìm được giấy ⇒ khung = cả ảnh.

  Bố cục theo 03: nền sáng toàn màn (như Xuất trình), portal ra body z-[90]. Đầu: nút XOAY chỉ icon (aria-label,
  03 §6 mục 8), không ×: thoát = "Chụp lại" / back / Escape. Chân: hai nút ngang bằng nhau (grid-cols-2) — "Chụp lại"
  phụ `bg-field` trái, "Dùng ảnh" chính phải (03 §6 mục 3: primary bên phải). Không câu hướng dẫn — 4 chấm tự nói việc
  của nó. Chấm nhìn thấy 1.25rem, vùng chạm 2.75rem. Góc kéo chéo nhau (không lồi) ⇒ "Dùng ảnh" mờ.
*/

type AnhGoc = { data: Uint8ClampedArray; w: number; h: number };
const ANH_TOI_DA = 1600;
const DO_TIM = 320;

/** File ảnh → RGBA ≤1600px (đã xoay theo EXIF — createImageBitmap mặc định "from-image"). */
async function docAnh(file: Blob): Promise<AnhGoc> {
  const bm = await createImageBitmap(file);
  const k = Math.min(1, ANH_TOI_DA / Math.max(bm.width, bm.height));
  const w = Math.max(1, Math.round(bm.width * k));
  const h = Math.max(1, Math.round(bm.height * k));
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no_canvas");
  ctx.drawImage(bm, 0, 0, w, h);
  bm.close?.();
  return { data: ctx.getImageData(0, 0, w, h).data, w, h };
}

/** Tìm góc trên bản thu nhỏ rồi phóng về cỡ ảnh; không thấy ⇒ cả khung. */
function gocTuDong(a: AnhGoc): BonGoc {
  const k = Math.min(1, DO_TIM / Math.max(a.w, a.h));
  const w = Math.max(8, Math.round(a.w * k));
  const h = Math.max(8, Math.round(a.h * k));
  const cv = document.createElement("canvas");
  cv.width = a.w;
  cv.height = a.h;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  if (!ctx) return caKhung(a.w, a.h);
  ctx.putImageData(new ImageData(new Uint8ClampedArray(a.data), a.w, a.h), 0, 0);
  const nho = document.createElement("canvas");
  nho.width = w;
  nho.height = h;
  const c2 = nho.getContext("2d", { willReadFrequently: true });
  if (!c2) return caKhung(a.w, a.h);
  c2.drawImage(cv, 0, 0, w, h);
  const q = timGoc(xam(c2.getImageData(0, 0, w, h).data, w, h), w, h);
  return q ? nhanGoc(q, a.w / w) : caKhung(a.w, a.h);
}

function blobTu(data: Uint8ClampedArray, w: number, h: number, q = 0.9): Promise<Blob> {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d");
  if (!ctx) return Promise.reject(new Error("no_canvas"));
  ctx.putImageData(new ImageData(new Uint8ClampedArray(data), w, h), 0, 0);
  return new Promise((ok, loi) => cv.toBlob((b) => (b ? ok(b) : loi(new Error("no_blob"))), "image/jpeg", q));
}

const xoayDiem = (p: Diem, h: number): Diem => ({ x: h - p.y, y: p.x });

export function CanGiaySheet({
  file,
  onDung,
  onChupLai,
  onDong,
}: {
  file: Blob;
  /** ảnh đã nắn: `luu` màu thật (xuất trình), `doc` đã làm rõ chữ (gửi đọc) — cả hai JPEG chưa nén cỡ */
  onDung: (r: { luu: Blob; doc: Blob }) => void;
  /** nút "Chụp lại": gọi NGAY trong lúc bấm (trình duyệt chỉ cho mở máy ảnh khi còn cử chỉ người dùng) */
  onChupLai: () => void;
  /** back / Escape: bỏ ảnh, đóng màn (không mở máy ảnh — đi qua lịch sử là mất cử chỉ người dùng) */
  onDong: () => void;
}) {
  const [anh, setAnh] = useState<AnhGoc | null>(null);
  const [goc, setGoc] = useState<BonGoc | null>(null);
  const [loi, setLoi] = useState(false);
  const [dangXuLy, setDangXuLy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const khungRef = useRef<HTMLDivElement>(null);
  const keo = useRef<number | null>(null);
  const { dongTay } = useLichSuDong(onDong);
  /** cỡ khung vẽ (px) — hộp ảnh đặt đúng tỉ lệ, vừa khít khung theo cả chiều ngang lẫn dọc */
  const [khung, setKhung] = useState<{ w: number; h: number } | null>(null);
  const hopRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = khungRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setKhung({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [anh, url]);

  // đọc ảnh + tìm góc (một lần mỗi file)
  useEffect(() => {
    let song = true;
    docAnh(file)
      .then((a) => {
        if (!song) return;
        setAnh(a);
        setGoc(gocTuDong(a));
      })
      .catch(() => song && setLoi(true));
    return () => {
      song = false;
    };
  }, [file]);

  // ảnh hiển thị = chính bản RGBA đang căn (đúng hệ toạ độ sau mỗi lần xoay)
  useEffect(() => {
    if (!anh) return;
    let u: string | null = null;
    let song = true;
    blobTu(anh.data, anh.w, anh.h, 0.85)
      .then((b) => {
        if (!song) return;
        u = URL.createObjectURL(b);
        setUrl(u);
      })
      .catch(() => song && setLoi(true));
    return () => {
      song = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [anh]);

  useEffect(() => {
    lockBodyScroll();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dongTay();
    window.addEventListener("keydown", onKey);
    return () => {
      unlockBodyScroll();
      window.removeEventListener("keydown", onKey);
    };
  }, [dongTay]);

  const hopLe = useMemo(() => !!goc && laLoi(goc), [goc]);

  /** toạ độ con trỏ → toạ độ ảnh (hộp ảnh đúng tỉ lệ ⇒ chỉ cần chia theo cỡ hộp) */
  function diemTuSuKien(e: React.PointerEvent): Diem | null {
    const el = hopRef.current;
    if (!el || !anh) return null;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return {
      x: Math.min(anh.w, Math.max(0, ((e.clientX - r.left) / r.width) * anh.w)),
      y: Math.min(anh.h, Math.max(0, ((e.clientY - r.top) / r.height) * anh.h)),
    };
  }

  function xoay() {
    if (!anh || !goc) return;
    const r = xoay90(anh.data, anh.w, anh.h);
    // góc xoay theo ảnh rồi xếp lại thứ tự TL,TR,BR,BL (điểm TL cũ thành TR mới…)
    const q = goc.map((p) => xoayDiem(p, anh.h));
    setAnh({ data: r.data, w: r.w, h: r.h });
    setGoc([q[3], q[0], q[1], q[2]]);
  }

  async function dung() {
    if (!anh || !goc || !hopLe) return;
    setDangXuLy(true);
    // nhường một khung hình cho chữ "Đang xử lý…" hiện trước khi nắn (vài trăm ms trên máy yếu)
    await new Promise((ok) => setTimeout(ok, 30));
    try {
      const { w, h } = coRa(goc, ANH_TOI_DA);
      const ra = nanThang(anh.data, anh.w, anh.h, goc, w, h);
      if (!ra) throw new Error("goc");
      const luu = await blobTu(ra, w, h, 0.9);
      const doc = await blobTu(lamRoChu(new Uint8ClampedArray(ra)), w, h, 0.85);
      onDung({ luu, doc });
    } catch {
      setDangXuLy(false);
      setLoi(true);
    }
  }

  if (typeof document === "undefined") return null;
  const hop = anh && khung ? (() => {
    const k = Math.min(khung.w / anh.w, khung.h / anh.h);
    return { w: Math.floor(anh.w * k), h: Math.floor(anh.h * k) };
  })() : null;
  const pt = (p: Diem) => (anh ? { left: `${(p.x / anh.w) * 100}%`, top: `${(p.y / anh.h) * 100}%` } : {});

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Căn ảnh giấy tờ" className="fixed inset-0 z-[90] mx-auto flex max-w-(--w-app) flex-col bg-background">
      <div className="flex items-center justify-end px-4 pb-1 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={xoay}
          disabled={!anh || dangXuLy}
          aria-label="Xoay ảnh"
          className="flex h-11 w-11 items-center justify-center rounded-full text-navy transition active:bg-field disabled:opacity-40"
        >
          <RotateIcon className="h-6 w-6" />
        </button>
      </div>

      <div className="relative min-h-0 flex-1 px-4">
        {loi ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-[1rem] text-foreground/75">
            Ảnh này không mở được — bà con chụp lại giúp.
          </div>
        ) : !anh || !url || !goc ? (
          <div className="flex h-full items-center justify-center text-[0.875rem] text-foreground/65">Đang mở ảnh…</div>
        ) : (
          <div ref={khungRef} className="relative h-full w-full touch-none select-none">
            {/* ảnh + lớp chấm cùng một hộp đúng tỉ lệ ảnh, canh giữa khung */}
            <div
              ref={hopRef}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={hop ? { width: hop.w, height: hop.h } : { visibility: "hidden" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- blob: ảnh vừa chụp, chưa rời máy */}
              <img src={url} alt="Ảnh giấy vừa chụp" className="block h-full w-full rounded-xl object-contain" draggable={false} />
              <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${anh.w} ${anh.h}`} preserveAspectRatio="none" aria-hidden>
                <polygon
                  points={goc.map((p) => `${p.x},${p.y}`).join(" ")}
                  className={hopLe ? "fill-sea/10 stroke-sea" : "fill-danger/10 stroke-danger"}
                  strokeWidth={Math.max(anh.w, anh.h) / 220}
                />
              </svg>
              {goc.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={["Góc trên trái", "Góc trên phải", "Góc dưới phải", "Góc dưới trái"][i]}
                  onPointerDown={(e) => {
                    keo.current = i;
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    if (keo.current !== i) return;
                    const d = diemTuSuKien(e);
                    if (d) setGoc((g) => (g ? (g.map((x, j) => (j === i ? d : x)) as BonGoc) : g));
                  }}
                  onPointerUp={() => (keo.current = null)}
                  onPointerCancel={() => (keo.current = null)}
                  style={pt(p)}
                  className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                >
                  <span className={`h-5 w-5 rounded-full border-2 border-white shadow-md ${hopLe ? "bg-sea" : "bg-danger"}`} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <button
          type="button"
          onClick={() => {
            onChupLai(); // trước, khi còn cử chỉ người dùng (mở máy ảnh)
            dongTay(); // rồi dọn mục lịch sử của màn này
          }}
          disabled={dangXuLy}
          className="flex h-(--h-cta) items-center justify-center rounded-xl bg-field text-[1rem] font-semibold text-navy transition active:scale-[0.98] disabled:opacity-40"
        >
          {NHAN.chupLai}
        </button>
        <PrimaryButton onClick={() => void dung()} disabled={!anh || !goc || !hopLe || dangXuLy}>
          {dangXuLy ? "Đang xử lý…" : NHAN.dungAnh}
        </PrimaryButton>
      </div>
    </div>,
    document.body,
  );
}
