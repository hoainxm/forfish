"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { SeaTodayCard, cangBienHomNay } from "@/components/sea-today-card";
import { CauChuaTai } from "@/components/ui/offline-line";
import { NHAN } from "@/lib/labels";
import { useOnline } from "@/lib/use-online";

/*
  GIỮ CHỖ ĐẦU TRANG CHỦ (review B-P2-1, 2026-10-29 — CLS đo 0,06–0,23): SeaToday ("Biển hôm nay") và
  khối việc cần làm + tầng 5 ("Chọn cảng nhà…") đều tự ẩn tới khi có dữ liệu, nên lúc chúng bật ra thì
  thẻ Ưu đãi bên dưới nhảy xuống ≈240px. Hai khối này dùng chung MỘT ô giữ chỗ: lần vẽ đầu (cả SSR) là
  một khung chờ cao đúng một hàng (--h-row); khối nào có nội dung trước thì khung chờ nhường chỗ.

  Tải lỗi lần đầu: đã khai cảng mà "Biển hôm nay" vẫn trống quá nhịp hỏi (8 s timeout của fetchSeaForecast
  + dư; mất sóng thì 1,5 s) ⇒ MỘT câu ngắn + Thử lại (gắn lại thẻ) thay vì im. Chưa khai cảng mà cả ô vẫn
  trống (mất sóng ⇒ tầng 5 không vẽ) ⇒ bỏ khung chờ, không nói gì thêm.
  Thẻ SeaTodayCard không sửa ở đây — chỉ quan sát chiều cao vùng bọc nó.
*/
const CHO_CO_SONG_MS = 9000;
const CHO_MAT_SONG_MS = 1500;

/** Vùng bọc có nội dung chưa — đo chiều cao thật (các khối con `return null` hoặc `empty:hidden`). */
function useCoNoiDung(ref: React.RefObject<HTMLDivElement | null>): boolean {
  const [co, setCo] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const xem = () => setCo(el.offsetHeight > 0);
    xem();
    const ro = new ResizeObserver(xem);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return co;
}

export function HomeDauTrang({ children }: { children: ReactNode }) {
  const online = useOnline();
  const seaRef = useRef<HTMLDivElement | null>(null);
  const viecRef = useRef<HTMLDivElement | null>(null);
  const [lan, setLan] = useState(0); // tăng khi bấm Thử lại ⇒ gắn lại SeaTodayCard
  const coBien = useCoNoiDung(seaRef);
  const coViec = useCoNoiDung(viecRef);
  /** null = chưa đọc kho (SSR / trước effect) */
  const [coCang, setCoCang] = useState<boolean | null>(null);
  const [hetCho, setHetCho] = useState(false);

  useEffect(() => {
    setCoCang(cangBienHomNay() !== null);
  }, [lan]);

  useEffect(() => {
    if (coBien) return;
    setHetCho(false);
    const t = setTimeout(() => setHetCho(true), online ? CHO_CO_SONG_MS : CHO_MAT_SONG_MS);
    return () => clearTimeout(t);
  }, [coBien, online, lan]);

  const loiBien = hetCho && coCang === true && !coBien;
  /*  Đã khai cảng ⇒ khung chờ giữ ĐÚNG chỗ "Biển hôm nay" tới khi thẻ hiện hoặc thành câu lỗi — khối việc cần
      làm hiện sớm thì nằm DƯỚI khung, câu lỗi tới sau không đẩy nó (đo: 70px khi để chung). Chưa biết/chưa khai
      cảng ⇒ khung chờ là chỗ của bất kỳ khối nào hiện trước. */
  const giuBien = coCang === true && !coBien && !loiBien;
  const giu = giuBien || (coCang !== true && !coBien && !coViec && !(hetCho && coCang === false));

  return (
    // flex gap + khối trống `display:none` bằng CSS (cùng khung hình, không chờ state) ⇒ khoảng cách chỉ giữa khối thật
    <div className="group/dau flex flex-col gap-3">
      <div ref={seaRef} data-o data-bien className="empty:hidden">
        <SeaTodayCard key={lan} />
      </div>
      {loiBien && (
        <div className="surface flex min-h-[4.25rem] items-center gap-3 py-1.5 pl-4 pr-2">
          <p className="min-w-0 flex-1 text-[0.875rem] leading-snug text-foreground/70">
            <CauChuaTai matSong="Mất sóng — chưa có biển hôm nay trong máy." />
          </p>
          <button
            type="button"
            onClick={() => setLan((n) => n + 1)}
            className="flex h-(--h-ctl) shrink-0 items-center rounded-xl px-3 text-[0.875rem] font-semibold text-sea transition active:bg-field"
          >
            {NHAN.thuLai}
          </button>
        </div>
      )}
      {/* khung chờ cao bằng hàng "Chọn cảng nhà…" 2 dòng ở 360px. Ẩn bằng CSS `:has` NGAY KHUNG HÌNH khối thật
          hiện (đợi ResizeObserver ⇒ một khung hình có cả hai, màn nhảy 70px rồi lùi — đo được) */}
      {giu && (
        <div
          aria-hidden
          className={`surface min-h-[4.25rem] animate-pulse ${
            giuBien ? "group-has-[[data-bien]>*]/dau:hidden" : "group-has-[[data-o]>:not(:empty)]/dau:hidden"
          }`}
        />
      )}
      <div ref={viecRef} data-o className="[&:not(:has(>:not(:empty)))]:hidden">
        {children}
      </div>
    </div>
  );
}
