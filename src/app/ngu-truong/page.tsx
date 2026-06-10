import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Đánh bắt tốt hơn — ForFish" };

export default function NguTruongPage() {
  return (
    <ComingSoon
      tone="t1"
      truc={1}
      emoji="🎯"
      title="Đánh bắt tốt hơn"
      promise="Ra khơi trúng hơn, đỡ phí dầu phí công."
      features={[
        "Điểm số đi biển hằng ngày từ 1 tới 100, kèm dự báo mười ngày để chọn ngày ra khơi.",
        "Bản đồ vùng ngư trường tiềm năng, dẫn tới điểm gần nhất theo vị trí tàu.",
        "Nhật ký chuyến biển và điểm cá tự khai, vừa nhớ chỗ trúng vừa làm dữ liệu tốt dần lên.",
      ]}
      dataNote="Giai đoạn đầu dùng nguồn ngư trường bên ngoài qua một lớp trung gian thay thế được; song song thu điểm cá bà con tự khai để dần tự chủ."
    />
  );
}
