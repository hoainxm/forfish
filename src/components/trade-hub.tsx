"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { datThamSo, docThamSo } from "@/lib/cho-ca";
import { PriceBoard } from "@/components/price-board";
import { SellGuide } from "@/components/sell-guide";
import { MarketBoard } from "@/components/market-board";
import { RequireLogin } from "@/components/require-login";
import { ChipRow } from "@/components/ui/chip-row";
import { ToastHost } from "@/components/ui/toast";
import { ChevronRightIcon, StoreIcon } from "@/components/icons";
import { NHAN } from "@/lib/labels";
import { useVai } from "@/lib/use-vai";

/*
  Khu CHỢ CÁ (dock "Chợ cá" từ 2026-10-19; trước là "Giao dịch", user chốt 2026-07-27
  gộp về đúng 1 việc mua–bán) — thông tin
  được cấp để bán có LỢI THẾ: giá hôm nay, tin mua/bán (chủ tàu tự đăng tin bán
  / tin mua, đầu nậu–nhà máy đăng tin cần mua), và danh bạ đầu mối bán. Chuyển
  bằng chip cùng khổ với sell-guide.
*/

/*  id = giá trị của `?muc=` trên URL (CC-06, 2026-10-25): chip được NHỚ khi lùi về
    từ màn khác và Thông báo / Sen Biển mở thẳng được một mục (`/tien?muc=tin`). Đổi
    chip ghi bằng `replaceState` — không đẻ mục lịch sử, back vẫn lùi đúng một trang. */
type Section = "gia" | "tin" | "dau-moi";
const SECTION_IDS: readonly Section[] = ["gia", "tin", "dau-moi"];

const SECTIONS: { id: Section; label: string }[] = [
  { id: "gia", label: "Giá cá" },
  { id: "tin", label: "Mua bán" },
  { id: "dau-moi", label: "Đầu mối" },
];

export function TradeHub() {
  const [section, setSection] = useState<Section>("gia");
  const { vai } = useVai();
  // đọc `?muc=` sau khi gắn (trang vẽ sẵn từ máy chủ không biết URL) — một lần
  useEffect(() => {
    setSection(docThamSo(window.location.search, "muc", SECTION_IDS, "gia"));
  }, []);
  const chonMuc = (m: Section) => {
    setSection(m);
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${datThamSo(window.location.search, "muc", m === "gia" ? null : m)}`,
    );
  };

  return (
    <div>
      {/* dự phòng tới khi app-shell gắn <ToastHost/> (toast "Cần sóng" của nút Nhắn): host thứ hai tự im */}
      <ToastHost />
      {/*  BỎ thẻ "Cửa hàng vật tư" ở đây (2026-10-19, chủ dự án: "chợ cá vẫn còn cái
           cửa hàng vật tư thế?"): Vật tư nay là mục dock riêng — một việc một chỗ.
           Chợ cá chỉ còn việc của cá: giá, tin mua/bán, chỗ thu mua. */}
      <ChipRow
        options={SECTIONS}
        value={section}
        onChange={chonMuc}
        accent="t2"
        level={1}
        ariaLabel="Mục giao dịch"
      />

      {/*  BẢNG GIÁ MỞ CHO MỌI NGƯỜI, HAI MỤC CÒN LẠI CẦN TÀI KHOẢN (chủ dự án
           2026-09-01). Giá cá là số công khai của VASEP — mở ra để người chưa
           có tài khoản thấy app đáng dùng, rồi mới gọi SDVICO xin cấp. Chợ tin
           mua/bán và danh bạ mối quen thì gắn với người dùng cụ thể (đăng tin
           dưới tên ai, gọi cho mối của ai) nên phải có tài khoản. */}
      {/*  LỀ 16px như hai mục kia và mọi màn dock (kiểm ảnh 390/360 2026-10-19:
           bảng giá, ô tìm, dải nguồn đều tràn sát mép màn trong khi tiêu đề và
           chip thụt 16px — lỗi design cũ sót lại). */}
      {section === "gia" && (
        <div className="px-4">
          <PriceBoard />
        </div>
      )}
      {section === "tin" && (
        <RequireLogin what="chợ tin mua bán">
          <div className="px-4">
            <MarketBoard />
          </div>
        </RequireLogin>
      )}
      {section === "dau-moi" && (
        <RequireLogin what="danh bạ chỗ bán">
          {/*  Lối vào HỒ SƠ VỰA (spec 17 §12.4) — chỉ vai Thu mua: vựa tự đưa mình lên danh bạ này. Vai khác vẫn mở
              được /tien/vua bằng link (vai chỉ đổi thứ nằm ngay tay, §2). */}
          {vai === "thu-mua" && (
            <div className="px-4 pb-2">
              <Link
                href="/tien/vua"
                className="surface flex min-h-(--h-row) items-center gap-3 px-4 py-2.5 transition active:bg-field"
              >
                <StoreIcon className="h-5 w-5 shrink-0 text-t2" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[1rem] font-semibold leading-snug text-navy">{NHAN.hoSo}</span>
                  <span className="block text-[0.8125rem] leading-snug text-muted">Đưa vựa của bà con lên danh bạ</span>
                </span>
                <ChevronRightIcon className="h-4 w-4 shrink-0 text-foreground/40" />
              </Link>
            </div>
          )}
          <SellGuide />
        </RequireLogin>
      )}
    </div>
  );
}
