"use client";

import { useState } from "react";
import { PriceBoard } from "@/components/price-board";
import { SellGuide } from "@/components/sell-guide";
import { MarketBoard } from "@/components/market-board";
import { ChipRow } from "@/components/ui/chip-row";

/*
  Khu GIAO DỊCH (user chốt 2026-07-27, gộp về đúng 1 việc mua–bán) — thông tin
  được cấp để bán có LỢI THẾ: giá hôm nay, tin mua/bán (chủ tàu tự đăng tin bán
  / tin mua, đầu nậu–nhà máy đăng tin cần mua), và danh bạ đầu mối bán. Chuyển
  bằng chip cùng khổ với sell-guide.
*/

type Section = "gia" | "tin" | "ban-o-dau";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "gia", label: "Giá cá" },
  { id: "tin", label: "Tin mua/bán" },
  { id: "ban-o-dau", label: "Bán ở đâu" },
];

export function TradeHub() {
  const [section, setSection] = useState<Section>("gia");

  return (
    <div>
      <ChipRow
        options={SECTIONS}
        value={section}
        onChange={setSection}
        accent="t2"
        level={1}
        ariaLabel="Mục giao dịch"
      />

      {section === "gia" && <PriceBoard />}
      {section === "tin" && (
        <div className="px-4">
          <MarketBoard />
        </div>
      )}
      {section === "ban-o-dau" && <SellGuide />}
    </div>
  );
}
