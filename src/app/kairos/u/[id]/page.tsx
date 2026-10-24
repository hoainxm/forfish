import { UserProfile } from "@/components/kairos/user-profile";
import { ManHeader } from "@/components/man-header";

export const metadata = { title: "Trang trên Kairos — SDFish" };

// TRANG NGƯỜI DÙNG (14 §3.8, AC13). `[id]` = uuid công khai của hồ sơ Kairos (không SĐT);
// `toi` = trang của chính mình.
export default async function KairosUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <ManHeader title="Kairos" compact />
      <UserProfile id={id} />
    </div>
  );
}
