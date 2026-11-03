// GET /api/viec/cua-toi — TIN CỦA TÔI (spec 17 §12.3, AC7): mọi tin của chính SĐT (đang mở · hết hạn · đủ người ·
// bị ẩn), mới trước. Tin hết hạn KHÔNG còn ở danh sách chung nhưng còn ở đây với nút Gia hạn.
// Không gác vai: người đã đổi khỏi Chủ tàu vẫn phải đóng được tin cũ của mình.
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { normalizeVnPhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { POST_COLS, tinChuDto, unavailable, type PostRow } from "@/lib/viec-server";

export async function GET(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  const admin = createAdminClient();
  if (!admin) return unavailable();
  const { data, error } = await admin
    .from("job_posts")
    .select(POST_COLS)
    .eq("owner_phone", normalizeVnPhone(who.phone))
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return unavailable();
  return NextResponse.json({ ok: true, items: (data as PostRow[]).map(tinChuDto), luc: Date.now() });
}
