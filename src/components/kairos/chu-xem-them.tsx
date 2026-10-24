"use client";

/*
  CHỮ DÀI "XEM THÊM" KIỂU FACEBOOK (anh Long 2026-10-24: "làm cái đọc tin dài các kiểu see more như fb ấy").

  Cắt ở `dong` dòng; ĐO THẬT chữ có tràn không (scrollHeight > clientHeight, đo lại khi đổi bề ngang) — không đoán
  theo số ký tự. Tràn ⇒ cuối dòng cuối hiện "… Xem thêm" (nền mờ dần cùng màu khung để chữ không lẫn), chạm là MỞ HẾT
  ngay tại chỗ (không sang trang). Như FB: mở rồi không có "Thu gọn" — đọc tiếp xuống dưới.
  `nen` = màu khung chứa chữ (thẻ trắng / bong bóng bình luận) để dải mờ khớp nền.
  `nhac` = người được nhắc tên (0071): đoạn "@Tên" thành link đậm sang trang người đó (chạm không lan ra thẻ).
*/

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { NHAN } from "@/lib/labels";
import { chiaDoan, type NhacTen } from "@/lib/kairos/nhac-ten";

const useIsoLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Chữ có bị cắt không (thuần — test được): cao thật hơn cao đang hiện quá nửa điểm ảnh. */
export const biCat = (scrollH: number, clientH: number): boolean => scrollH - clientH > 1;

const CLAMP: Record<number, string> = { 2: "line-clamp-2", 3: "line-clamp-3", 4: "line-clamp-4", 5: "line-clamp-5", 6: "line-clamp-6", 8: "line-clamp-[8]" };

export function ChuXemThem({
  text,
  dong = 5,
  nen = "card",
  className = "",
  nhac,
}: {
  nhac?: NhacTen[];
  text: string;
  dong?: 2 | 3 | 4 | 5 | 6 | 8;
  nen?: "card" | "field";
  className?: string;
}) {
  const [mo, setMo] = useState(false);
  const [cat, setCat] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useIsoLayout(() => {
    const el = ref.current;
    if (!el || mo) return;
    const do_ = () => setCat(biCat(el.scrollHeight, el.clientHeight));
    do_();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(do_);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, mo, dong]);

  if (!text) return null;
  // dải mờ NGẮN ở mép trái (0–30 %), phần "… Xem thêm" nằm trên nền ĐẶC cùng màu khung ⇒ chữ không nhoè
  const mau = nen === "field" ? "from-transparent to-field to-30%" : "from-transparent to-card to-30%";
  return (
    <div className="relative">
      <p ref={ref} className={`whitespace-pre-line break-words ${mo ? "" : CLAMP[dong]} ${className}`}>
        {nhac?.length
          ? chiaDoan(text, nhac).map((d, i) =>
              "nhac" in d ? (
                <Link
                  key={i}
                  href={`/kairos/u/${d.nhac.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-semibold text-sea"
                >
                  {d.chu}
                </Link>
              ) : (
                d.chu
              ),
            )
          : text}
      </p>
      {!mo && cat && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation(); // thẻ bài bấm được (mở chi tiết) — Xem thêm chỉ mở chữ
            setMo(true);
          }}
          aria-label={`${NHAN.xemThem} — đọc hết`}
          className={`absolute bottom-0 right-0 bg-linear-to-r ${mau} pl-10 font-semibold text-foreground/70 ${className}`}
        >
          … {NHAN.xemThem}
        </button>
      )}
    </div>
  );
}
