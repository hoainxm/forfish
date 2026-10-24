import { UserProfile } from "@/components/kairos/user-profile";
import { MarketHeader } from "@/components/market/shared/market-header";

export const metadata = { title: "Trang trên Kairos — SDFish" };

// TRANG NGƯỜI DÙNG (14 §3.8, AC13). `[id]` = uuid công khai của hồ sơ Kairos (không SĐT);
// `toi` = trang của chính mình.
export default async function KairosUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <MarketHeader title="Trang cá nhân" fallback="/kairos" />
      <UserProfile id={id} />
    </div>
  );
}
