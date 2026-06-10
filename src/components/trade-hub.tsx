"use client";

import { useState } from "react";
import { PriceBoard } from "@/components/price-board";
import { SellGuide } from "@/components/sell-guide";
import { BuyBoard } from "@/components/buy-board";
import { ChipRow } from "@/components/ui/chip-row";

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
      <ChipRow
        options={SECTIONS}
        value={section}
        onChange={setSection}
        accent="t2"
        level={1}
        ariaLabel="Mục giao dịch"
      />

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
