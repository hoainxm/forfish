import { PageHeader } from "@/components/page-header";
import { SeaForecast } from "@/components/sea-forecast";
import { FishingMap } from "@/components/fishing-map";
import { StormBanner } from "@/components/storm-banner";

export const metadata = { title: "Đánh bắt — ForFish" };

export default function NguTruongPage() {
  return (
    <div>
      <PageHeader
        kicker="Đánh bắt · Trục 1"
        title="Hôm nay đi biển được không?"
        sub="Điểm đi biển tính từ dự báo sóng, gió vùng biển gần cảng của bà con."
        toColor="var(--t1)"
      />
      {/* Tin bão lên TRƯỚC mọi thứ — an toàn trước, điểm số sau */}
      <StormBanner />
      <SeaForecast />

      {/* Bản đồ ngư trường — ảnh vệ tinh + chạm xem gió sóng từng vùng */}
      <section aria-label="Bản đồ ngư trường" className="mt-7 pb-2">
        <h2 className="display mb-2 px-5 text-[20px] font-bold text-navy">
          Bản đồ ngư trường
        </h2>
        <p className="mb-3 px-5 text-[15px] leading-snug text-foreground/70">
          Nhìn nước nóng lạnh, vùng nhiều mồi qua ảnh vệ tinh — chạm vào biển
          để xem gió sóng chỗ đó.
        </p>
        <FishingMap />
      </section>
    </div>
  );
}
