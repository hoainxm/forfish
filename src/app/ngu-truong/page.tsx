import { FishingMap } from "@/components/fishing-map";

export const metadata = { title: "Đánh bắt — SDFish" };

/*
  Tab "Ra khơi" — bản đồ LÀ cả màn hình (kiểu Google Maps/Windy), không cuộn.
  Mọi thứ (tin bão, dự báo, thanh thời gian, cá mùa này, dẫn đường, danh bạ
  cảng) là lớp nổi/sheet trên bản đồ — xem fishing-map-view.tsx.
  (Nút "Danh bạ cảng cá" sống TRONG sheet, nhóm với "Cảng nhà của tôi" —
  nút nổi rời từng đè lên sheet đáy.)
  `fixed` để thoát padding của <main>; chừa chiều cao dock BottomNav nổi (82px
  = item 60px + ul py-1.5 12px + paddingBottom 10px) + 2px hở + safe-area, để
  dock không đè nút thao tác của SnapSheet (Xem thêm / Về cảng) ở đáy.
*/
export default function NguTruongPage() {
  return (
    <div
      className="fixed inset-x-0 top-0 mx-auto max-w-[480px]"
      // --vvgap: bug iOS 26 layout-viewport NGẮN hơn màn (dock treo lưng chừng,
      // lòi khối trắng dưới sheet — ảnh user 2026-07-29 13:20 bản cài): đáy
      // trang NỞ xuống đúng phần hụt, cùng biến với dock (viewport-gap-fix.tsx,
      // CHỈ standalone đặt khác 0; bình thường var = 0 → y hệt cũ).
      style={{
        bottom: "calc(84px + env(safe-area-inset-bottom) - var(--vvgap, 0px))",
      }}
    >
      <FishingMap />
    </div>
  );
}
