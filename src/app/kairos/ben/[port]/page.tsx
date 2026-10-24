import { notFound } from "next/navigation";
import { KairosScreen } from "@/components/kairos/kairos-screen";
import { FISHING_PORTS } from "@/data/fishing-ports";

// BẾN theo cảng (14 §3.9, AC14): mỗi cảng trong danh mục src/data/fishing-ports.ts tự là một
// nhóm — dòng tin lọc `ports @> {port}`, ô mời đăng THẲNG vào Bến (cảng điền sẵn). Mã lạ ⇒ 404
// (not-found.tsx cùng thư mục nói "Không tìm thấy").
type Props = { params: Promise<{ port: string }> };

const find = (id: string) => FISHING_PORTS.find((p) => p.id === id);

export async function generateMetadata({ params }: Props) {
  const p = find((await params).port);
  return { title: p ? `Bến ${p.name} — Kairos` : "Kairos — SDFish" };
}

export default async function BenPage({ params }: Props) {
  const p = find((await params).port);
  if (!p) notFound();
  return <KairosScreen port={p.id} title={`Bến ${p.name}`} sub={p.province ? `Cảng ${p.name} · ${p.province}` : `Cảng ${p.name}`} />;
}
