"use client";

import Link from "next/link";
import { useState } from "react";
import { BasketIcon, ChevronRightIcon } from "@/components/icons";
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
      {/*  LỐI VÀO CHỢ VẬT TƯ (12 §9) — đặt TRÊN hàng chip, cùng khổ thẻ `surface`.
           KHÔNG thêm chip thứ tư vào SECTIONS: chợ là một KHU riêng (route
           /cho), không phải mục con của Giao dịch; ba chip giữ nguyên hàng
           ngang (03 "nhãn ngang hàng"). */}
      <Link
        href="/cho"
        className="mx-4 mb-4 flex min-h-[3.5rem] items-center gap-3 px-4 py-3 surface"
      >
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
          style={{ backgroundColor: "var(--t3-bg)", color: "var(--t3)" }}
          aria-hidden
        >
          <BasketIcon className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[1.125rem] font-bold text-navy">Cửa hàng vật tư tàu cá</span>
          <span className="block text-[1rem] leading-snug text-foreground/65">
            Máy, ngư cụ, dầu nhớt, đá… nhiều đại lý, giao ra cảng
          </span>
        </span>
        <ChevronRightIcon className="h-5 w-5 shrink-0 text-foreground/40" />
      </Link>

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
