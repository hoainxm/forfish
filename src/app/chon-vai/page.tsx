"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChonVaiThe } from "@/components/chon-vai";
import { ManHeader } from "@/components/man-header";
import { readNextParam } from "@/lib/auth-next";
import { loadShopFlag } from "@/lib/market/seller-flag";
import { NHAN } from "@/lib/labels";
import { useVai } from "@/lib/use-vai";
import type { Vai } from "@/lib/vai";
import { chonVai } from "@/lib/vai-store";

/*
  MÀN "BÀ CON LÀM NGHỀ GÌ?" (spec 17 §3.1) — ngay sau đăng ký (dang-ky đẩy sang đây kèm `?next=`).
  Chạm thẻ ⇒ ghi vai ở máy NGAY (dock đổi tức thì, mất sóng vẫn được) rồi đi tiếp. Đại lý chưa có gian hàng ⇒ sang
  đăng ký shop. "Để sau" ⇒ giữ dock mặc định; trang chủ còn thẻ mời một hàng tới khi chọn.
  Chưa đăng nhập ⇒ về /login (màn này chỉ có nghĩa với tài khoản).
*/
export default function ChonVaiPage() {
  const router = useRouter();
  const { phone, vai } = useVai();
  const [next, setNext] = useState("/");
  const [dangGhi, setDangGhi] = useState<Vai | null>(null);

  useEffect(() => {
    setNext(readNextParam(window.location.search));
  }, []);

  async function chon(v: Vai) {
    if (!phone) {
      router.replace("/login");
      return;
    }
    setDangGhi(v);
    // chonVai tự nuốt lỗi mạng: vai đã nằm ở máy, gửi lên sau
    await chonVai(phone, v);
    const coShop = loadShopFlag(phone)?.hasShop === true;
    router.replace(v === "dai-ly" && !coShop ? "/ban-hang/dang-ky" : next);
  }

  return (
    <div>
      <ManHeader title="Bà con làm nghề gì?" />
      <div className="space-y-4 px-4 pt-1">
        <p className="text-[0.9375rem] leading-snug text-foreground/70">App sắp xếp màn hình theo việc của bà con. Đổi lại được ở Tài khoản.</p>
        <ChonVaiThe hienTai={vai} dangGhi={dangGhi} onChon={(v) => void chon(v)} />
        <button
          type="button"
          onClick={() => router.replace(next)}
          className="mx-auto block min-h-(--h-ctl) px-4 text-[0.9375rem] text-muted"
        >
          {NHAN.deSau}
        </button>
      </div>
    </div>
  );
}
