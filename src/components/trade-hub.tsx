"use client";

import { useState } from "react";
import { PriceBoard } from "@/components/price-board";
import { SellGuide } from "@/components/sell-guide";
import { BuyBoard } from "@/components/buy-board";

/*
  GIAO DỊCH (nhánh 1 của khu Tiền, user chốt 2026-06-10) — thông tin được
  cấp để bán có LỢI THẾ: giá hôm nay, ai đang cần mua (đầu nậu/nhà máy đăng
  yêu cầu loài + khối lượng + giá), và danh bạ chỗ bán. Chuyển bằng chip
  cùng khổ với sell-guide.
*/

type Section = "gia" | "can-mua" | "ban-o-dau";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "gia", label: "Giá cá" },
  { id: "can-mua", label: "Ai cần mua" },
  { id: "ban-o-dau", label: "Bán ở đâu" },
];

export function TradeHub() {
  const [section, setSection] = useState<Section>("gia");

  return (
    <div>
      <div className="mb-3 flex gap-1.5 overflow-x-auto px-4">
        {SECTIONS.map((s) => {
          const on = s.id === section;
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              aria-pressed={on}
              className={`min-h-[48px] shrink-0 rounded-full px-4 text-[16px] font-bold transition ${
                on
                  ? "bg-t2 text-white"
                  : "bg-field text-navy/70 active:bg-card"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {section === "gia" && <PriceBoard />}
      {section === "can-mua" && (
        <div className="px-4">
          <BuyBoard />
        </div>
      )}
      {section === "ban-o-dau" && <SellGuide />}
    </div>
  );
}
