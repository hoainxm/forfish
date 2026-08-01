// /api/me/messages — HỘP THƯ của tài khoản đang đăng nhập (0023).
//
// Vì sao có: thông báo đẩy vuốt tắt là MẤT, app không có chỗ xem lại. Ngư dân
// để điện thoại trong túi, tay ướt — tin bão biến mất không dấu vết. Trang chủ
// nay có mục "Thông báo" đọc từ đây.
//
// Trả tin GỬI CHUNG (target='all') + tin NHẮM ĐÚNG TÀI KHOẢN NÀY. Lọc phía
// SERVER theo phiên — client không được khai mình là ai.
//
// ⚠️ KHÔNG cho service worker cache route này: nó gắn DANH TÍNH (không nằm
// trong API_CACHE_ALLOW của sw.js). Máy dùng chung trên tàu thì đổi tài khoản
// không được đọc thư của người trước. Bản offline nằm ở localStorage phía
// client, có kèm SĐT chủ nhân và bị xoá khi đăng xuất (xem lib/inbox.ts).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeVnPhone } from "@/lib/phone";

/** Bao nhiêu tin gần nhất — đủ cho một chuyến biển dài, không phình vô hạn */
const MAX_MESSAGES = 50;

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ ok: false }, { status: 503 });
  const { data } = await supabase.auth.getUser();
  const email = data?.user?.email;
  // chưa đăng nhập → hộp thư rỗng, KHÔNG phải lỗi (trang chủ tự ẩn mục này)
  if (!email) return NextResponse.json({ ok: true, phone: null, messages: [] });
  const phone = normalizeVnPhone(email.split("@")[0]);

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false }, { status: 503 });

  const { data: rows, error } = await admin
    .from("push_messages")
    .select("id, title, body, url, target, target_phone, created_at")
    .or(`target.eq.all,target_phone.eq.${phone}`)
    .order("created_at", { ascending: false })
    .limit(MAX_MESSAGES);
  if (error) return NextResponse.json({ ok: false }, { status: 500 });

  return NextResponse.json({
    ok: true,
    phone,
    messages: (rows ?? []).map((r) => ({
      id: r.id as string,
      title: r.title as string,
      body: r.body as string,
      url: (r.url as string) ?? null,
      sentAt: r.created_at as string,
      /** tin nhắm riêng cho mình (khác tin gửi chung) */
      mine: (r.target as string) === "account",
    })),
  });
}
