// LIỆT KÊ KHO `forecast-archive` THEO NGÀY — dùng chung cho /api/collect/nguon-ngay (GPU biết ngày nào đã có để chỉ tải
// phần thiếu) và /api/collect/kho (GPU sao toàn bộ kho về làm bản dự phòng). Chỉ server (service role).
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ARCHIVE_BUCKET, mapPool, type ArchiveKind } from "@/lib/forecast-archive";

export const MOI_LOAI: readonly ArchiveKind[] = ["weather", "fish", "fish-inputs", "actual", "drivers", "storms", "nguon-ngay"];

export interface MucKho {
  path: string;
  bytes: number;
  capNhat: string | null;
}

/** Mọi file của các `loai` trong các `ngay`. Một thư mục hỏng ⇒ ném (đừng trả danh sách thiếu mà GPU tưởng là đủ). */
export async function lietKeKho(admin: SupabaseClient, loai: readonly ArchiveKind[], ngay: readonly string[]): Promise<MucKho[]> {
  const viec = loai.flatMap((k) => ngay.map((d) => `${k}/${d.slice(0, 4)}/${d}`));
  const moi = await mapPool(viec, 6, async (thuMuc) => {
    const { data, error } = await admin.storage.from(ARCHIVE_BUCKET).list(thuMuc, { limit: 1000 });
    if (error) throw new Error(`${thuMuc}: ${error.message}`);
    return (data ?? [])
      .filter((f) => f.id) // bỏ "thư mục" con (id null)
      .map((f) => ({
        path: `${thuMuc}/${f.name}`,
        bytes: Number((f.metadata as { size?: number } | null)?.size ?? 0),
        capNhat: f.updated_at ?? null,
      }));
  });
  return moi.flat();
}
