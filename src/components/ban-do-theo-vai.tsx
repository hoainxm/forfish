"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { PremiumLock } from "@/components/premium-gate";
import { useVai } from "@/lib/use-vai";

/*
  CỔNG BẢN ĐỒ THEO VAI (spec 17 §11, §11.1 — anh Long 03/11: "chủ tàu thì giữ nguyên như hiện tại, còn ngư dân, thu mua,
  đại lý mới chia premium và free"). Chủ tàu / chưa chọn vai / khách: đi thẳng vào bản đồ như trước. Đi bạn / thu mua /
  đại lý KHÔNG có gói:
    · đến từ TIN BÃO (`?bao=` — storm-push, hộp thư) ⇒ về Trang chủ, nơi băng tin bão đứng đầu (không có màn bão riêng —
      anh Long chốt 03/11 "không cần");
    · lối khác (Sen Biển, link chia sẻ điểm, gõ thẳng) ⇒ thẻ giới thiệu gói, không màn trắng.
  Khoá ở đây chỉ là vỏ — lớp bản đồ free bị chặn thật ở middleware (dataGate, 403 `goi`). Kho bản đồ đã tải KHÔNG xoá.
*/
export function BanDoTheoVai({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { banDo, san } = useVai();
  const chan = san && !banDo;
  const tuTinBao = chan && typeof window !== "undefined" && new URLSearchParams(window.location.search).has("bao");

  useEffect(() => {
    if (tuTinBao) router.replace("/");
  }, [tuTinBao, router]);

  // chưa đọc xong vai ⇒ chưa dựng bản đồ (màn nặng nhất app) — một nhịp vẽ, không có khung nào nháy
  if (!san) return null;
  if (!chan) return <>{children}</>;
  if (tuTinBao) return null;
  return (
    <div className="flex min-h-full items-center px-4 pb-(--dock-total) pt-6">
      <div className="w-full">
        <PremiumLock
          access="upgrade"
          feature="bản đồ"
          blurb="Bản đồ ngư trường, dự báo cá và dẫn đường nằm trong gói. Gọi SDVICO để mở."
        />
      </div>
    </div>
  );
}
