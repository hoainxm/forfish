import { PostDetail } from "@/components/kairos/post-detail";
import { MarketHeader } from "@/components/market/shared/market-header";

export const metadata = { title: "Bài trên Kairos — SDFish" };

// CHI TIẾT BÀI + BÌNH LUẬN (14 §3.4, AC10). Đọc không cần tài khoản; mất sóng đọc bản lưu.
export default async function KairosPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <MarketHeader title="Bài viết" fallback="/kairos" />
      <PostDetail id={id} />
    </div>
  );
}
