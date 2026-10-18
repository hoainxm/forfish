"use client";

import { useState } from "react";
import { CartIcon } from "@/components/icons";

/**
 * Ảnh nhỏ của MỘT dòng hàng (đơn, tóm tắt đặt hàng, thẻ đơn — F-06). Không ảnh
 * / ảnh lỗi ⇒ ô xám icon giỏ. `size` = cạnh (rem) — 3 ở dòng, 3.5 ở thẻ đơn.
 */
export function LineThumb({ image, size = 3, className = "" }: { image?: string; size?: number; className?: string }) {
  const [broken, setBroken] = useState(false);
  const box = { width: `${size}rem`, height: `${size}rem` };
  if (image && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- ảnh sàn: bucket public / data-URI seed, không qua optimizer
      <img src={image} alt="" loading="lazy" style={box} className={`shrink-0 rounded-xl object-cover ${className}`} onError={() => setBroken(true)} />
    );
  }
  return (
    <span style={box} className={`flex shrink-0 items-center justify-center rounded-xl bg-field text-foreground/40 ${className}`} aria-hidden>
      <CartIcon className="h-5 w-5" />
    </span>
  );
}
