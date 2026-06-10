import { FishingMap } from "@/components/fishing-map";

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
    </div>
  );
}
