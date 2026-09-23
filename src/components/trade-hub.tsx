"use client";

import { useState } from "react";
import { PriceBoard } from "@/components/price-board";
import { SellGuide } from "@/components/sell-guide";
import { MarketBoard } from "@/components/market-board";
import { RequireLogin } from "@/components/require-login";
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

      {/*  BẢNG GIÁ MỞ CHO MỌI NGƯỜI, HAI MỤC CÒN LẠI CẦN TÀI KHOẢN (chủ dự án
           2026-09-01). Giá cá là số công khai của VASEP — mở ra để người chưa
           có tài khoản thấy app đáng dùng, rồi mới gọi SDVICO xin cấp. Chợ tin
           mua/bán và danh bạ mối quen thì gắn với người dùng cụ thể (đăng tin
           dưới tên ai, gọi cho mối của ai) nên phải có tài khoản. */}
      {section === "gia" && <PriceBoard />}
      {section === "tin" && (
        <RequireLogin what="chợ tin mua bán">
          <div className="px-4">
            <MarketBoard />
          </div>
        </RequireLogin>
      )}
      {section === "ban-o-dau" && (
        <RequireLogin what="danh bạ chỗ bán">
          <SellGuide />
        </RequireLogin>
      )}
    </div>
  );
}
