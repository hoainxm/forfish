import Link from "next/link";
import { FishingMap } from "@/components/fishing-map";
import { AnchorIcon } from "@/components/icons";

export const metadata = { title: "Đánh bắt — ForFish" };

/*
  Tab "Ra khơi" — bản đồ LÀ cả màn hình (kiểu Google Maps), không cuộn dọc.
  Mọi thứ (tin bão, dự báo theo cảng, gió sóng điểm chạm, dẫn đường) là lớp
  nổi/sheet trên bản đồ — xem fishing-map-view.tsx.
  `fixed` để thoát padding của <main>; chừa đúng chiều cao BottomNav (66px
  = 64px item + border 2px) + safe-area.
*/
export default function NguTruongPage() {
  return (
    <div className="fixed inset-x-0 top-0 bottom-[calc(66px+env(safe-area-inset-bottom))] mx-auto max-w-[480px]">
      <FishingMap />
      {/* Danh bạ cảng gần tàu — nút nổi, thuộc nhóm Ra khơi (không nằm trong
          Quản lý con tàu). Đặt dưới-trái để tránh control của bản đồ. */}
      <Link
        href="/cang"
        className="absolute bottom-3 left-3 z-30 flex items-center gap-1.5 rounded-full bg-navy/95 px-3.5 py-2 text-[14px] font-bold text-white shadow-md backdrop-blur active:scale-95"
      >
        <AnchorIcon className="h-4 w-4" />
        Danh bạ cảng
      </Link>
    </div>
  );
}
