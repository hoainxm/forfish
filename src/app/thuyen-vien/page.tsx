import { CrewList } from "@/components/crew-list";
import { TripSplit } from "@/components/trip-split";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Thuyền viên — ForFish" };

export default function ThuyenVienPage() {
  return (
    <div>
      <PageHeader
        kicker="Thuyền viên · Tàu của tôi"
        title="Sổ thuyền viên"
        sub="Hồ sơ bạn thuyền, tiền ứng, chia tiền chuyến — rõ ràng, khỏi cãi nhau."
        toColor="var(--sea)"
      />
      <CrewList />
      <section className="mt-4 pb-2">
        <h2 className="display mb-2 px-5 text-[20px] font-bold text-navy">
          Chia tiền chuyến
        </h2>
        <p className="mb-3 px-5 text-[15px] leading-snug text-foreground/70">
          Nhập tiền bán cá và tổn chung — app tự chia theo phần từng người,
          trừ luôn tiền đã ứng.
        </p>
        <TripSplit />
      </section>
    </div>
  );
}
