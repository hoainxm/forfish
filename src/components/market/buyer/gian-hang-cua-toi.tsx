"use client";

/*
  LỐI VÀO GIAN HÀNG Ở ĐẦU /cho (2026-10-29, rà hành trình A-04). Badge "N đơn chờ" của người bán
  nằm trên ô dock Vật tư (dockBadge, lib/dock-nav) mà /cho trước đây không có đường sang /ban-hang —
  phải đi avatar → Kênh người bán (5 chạm). Nay MỘT hàng gọn, chỉ hiện với máy có cờ gian hàng.

  CÙNG NGUỒN SỐ VỚI BADGE DOCK: cờ `forfish.mshop.v1` của đúng SĐT (seller-flag `loadShopFlag`), đọc lại
  khi dock được báo (`DOCK_BADGE_EVENT`), khi kho đổi ở tab khác và khi quay lại app. KHÔNG request —
  mất sóng vẫn hiện số lần cuối khu bán hàng ghi. Chưa có cờ / khác SĐT / khách ⇒ không vẽ gì.
  Chữ nhỏ gọn theo thang §0 (anh Long 2026-10-29: "chữ cho nhỏ đẹp") — vùng chạm bằng padding.
*/

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRightIcon } from "@/components/icons";
import { DOCK_BADGE_EVENT } from "@/lib/dock-nav";
import { loadShopFlag, MARKET_SHOP_FLAG_KEY, type ShopFlag } from "@/lib/market/seller-flag";
import { useAuthUser } from "@/lib/use-auth";

export function GianHangCuaToi() {
  const { phone } = useAuthUser();
  const [co, setCo] = useState<ShopFlag | null>(null);
  useEffect(() => {
    if (!phone) {
      setCo(null);
      return;
    }
    const doc = () => setCo(loadShopFlag(phone));
    doc();
    const khiKho = (e: StorageEvent) => {
      if (e.key === null || e.key === MARKET_SHOP_FLAG_KEY) doc();
    };
    const khiThay = () => {
      if (document.visibilityState === "visible") doc();
    };
    window.addEventListener(DOCK_BADGE_EVENT, doc);
    window.addEventListener("storage", khiKho);
    document.addEventListener("visibilitychange", khiThay);
    return () => {
      window.removeEventListener(DOCK_BADGE_EVENT, doc);
      window.removeEventListener("storage", khiKho);
      document.removeEventListener("visibilitychange", khiThay);
    };
  }, [phone]);

  if (!co?.hasShop) return null;
  const don = co.pending && co.pending > 0 ? Math.floor(co.pending) : 0;
  return (
    <Link
      href="/ban-hang"
      className="mx-4 mb-2 flex min-h-(--h-ctl) items-center gap-2 border-b border-line py-2 text-[0.875rem] text-navy transition active:bg-field"
    >
      <span className="min-w-0 flex-1 truncate">
        Gian hàng của tôi
        {co.status === "cho_duyet" && <span className="text-muted"> · đang chờ duyệt</span>}
        {don > 0 && <span className="font-semibold text-danger"> · {don} đơn chờ</span>}
      </span>
      <ChevronRightIcon className="h-4 w-4 shrink-0 text-foreground/50" aria-hidden />
    </Link>
  );
}
