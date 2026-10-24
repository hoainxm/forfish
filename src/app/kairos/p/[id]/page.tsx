import { PostDetail } from "@/components/kairos/post-detail";
import { ManHeader } from "@/components/man-header";

export const metadata = { title: "Bài trên Kairos — SDFish" };

// CHI TIẾT BÀI + BÌNH LUẬN (14 §3.4, AC10). Đọc không cần tài khoản; mất sóng đọc bản lưu.
export default async function KairosPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <ManHeader title="Kairos" compact />
      <PostDetail id={id} />
    </div>
  );
}
