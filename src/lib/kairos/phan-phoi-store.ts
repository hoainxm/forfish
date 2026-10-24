import "server-only";
// KAIROS — KHO TÍN HIỆU ĐỌC (bảng kairos_reads, migration 0066) cho cỗ máy phân phối. Service-role.
// Tách khỏi store.ts: chỉ hai việc (đọc tín hiệu của một người, ghi gộp một lô). Kho file dev (không Supabase)
// ⇒ không có tín hiệu: dòng tin vẫn xếp theo độ mới + gần nhà + tương tác.
// Bảng chưa có (0066 chưa áp) ⇒ đọc trả rỗng + log, ghi báo `unavailable` — dòng tin KHÔNG chết vì phần này.

import { createAdminClient } from "@/lib/supabase/admin";
import { tacGiaCua, type ReadSignal } from "./phan-phoi";
import type { TinHieu } from "./tin-hieu-doc";

/** Đọc tối đa chừng này tín hiệu gần nhất của một người (≈ 30 ngày lướt bình thường). */
const DOC_TOI_DA = 600;

type Row = {
  post_id: string;
  last_at: string;
  opened: boolean;
  dwell_ms: number;
  kairos_posts: { topic: string; kind: string; author_phone: string | null; outlet: string | null } | null;
};

export async function tinHieuCua(phone: string | null): Promise<ReadSignal[]> {
  if (!phone) return [];
  const db = createAdminClient();
  if (!db) return [];
  const { data, error } = await db
    .from("kairos_reads")
    .select("post_id,last_at,opened,dwell_ms,kairos_posts(topic,kind,author_phone,outlet)")
    .eq("phone", phone)
    .order("last_at", { ascending: false })
    .limit(DOC_TOI_DA);
  if (error) {
    // 42P01 = bảng chưa có (0066 chưa áp) — xếp không cá nhân hoá, không làm hỏng dòng tin
    console.warn("[kairos] đọc tín hiệu hỏng:", error.code, error.message);
    return [];
  }
  const out: ReadSignal[] = [];
  for (const r of (data ?? []) as unknown as Row[]) {
    if (!r.kairos_posts) continue;
    out.push({
      post_id: r.post_id,
      topic: r.kairos_posts.topic,
      tacGia: tacGiaCua(r.kairos_posts),
      seen_at: r.last_at,
      opened: r.opened,
      dwell_ms: r.dwell_ms,
    });
  }
  return out;
}

/** Ghi gộp một lô (nguyên tử ở DB). Trả số dòng đã ghi; DB hỏng ⇒ ném để route trả 503 (app giữ hàng đợi). */
export async function ghiTinHieu(phone: string, items: readonly TinHieu[]): Promise<number> {
  if (!items.length) return 0;
  const db = createAdminClient();
  if (!db) return 0;
  const { data, error } = await db.rpc("kairos_record_reads", { p_phone: phone, p_items: items });
  if (error) {
    console.error("[kairos] ghi tín hiệu hỏng:", error.code, error.message);
    throw new Error("unavailable");
  }
  return typeof data === "number" ? data : 0;
}
