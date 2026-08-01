// /api/me/heartbeat — máy tự báo "tôi vừa mở app, ở chế độ nào, đã đủ đồ đi
// biển chưa". Ghi 3 cột mốc trên `customers` (migration 0021).
//
// Vì sao có: /quan-tri cần biết ai ĐÃ CÀI mà CHƯA BAO GIỜ MỞ BẢN CÀI — nhóm sẽ
// ra khơi với máy trắng tay (kho bản cài trên iOS tách riêng với Safari). Chip
// "đã sử dụng" hiện tại là nhân viên tự tick, không phải số đo.
//
// LUẬT: chỉ ghi MỐC + CHẾ ĐỘ. KHÔNG vị trí, KHÔNG thao tác. Không tạo hàng mới
// (chỉ update hàng đã có) — heartbeat không phải đường đăng ký.
//
// OFFLINE: đây là POST nên service worker BỎ QUA hẳn (không cache, không cứu).
// Client tự chặn khi mất sóng — xem src/lib/heartbeat.ts.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeVnPhone } from "@/lib/phone";
import { countsAsOfflineReady } from "@/lib/app-usage";

export async function POST(req: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ ok: false }, { status: 503 });
  const { data } = await supabase.auth.getUser();
  const email = data?.user?.email;
  // chưa đăng nhập → không quy về ai được, im lặng bỏ qua (KHÔNG phải lỗi)
  if (!email)
    return NextResponse.json({ ok: true, recorded: false, reason: "no_session" });
  const phone = normalizeVnPhone(email.split("@")[0]);

  const body = (await req.json().catch(() => null)) as {
    standalone?: boolean;
    ios?: boolean;
    offlineReady?: boolean;
  } | null;

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false }, { status: 503 });

  const now = new Date().toISOString();
  const patch: Record<string, string> = body?.standalone
    ? { pwa_last_open_at: now }
    : { web_last_open_at: now };
  // "ĐỦ ĐỒ ĐI BIỂN" phải đo trên ĐÚNG CÁI KHO sẽ dùng ngoài biển: trên iOS,
  // tải đủ trong Safari KHÔNG chứng minh gì cho bản cài (kho tách riêng).
  if (
    countsAsOfflineReady({
      offlineReady: !!body?.offlineReady,
      standalone: !!body?.standalone,
      ios: !!body?.ios,
    })
  ) {
    patch.offline_ready_at = now;
  }

  // KHÔNG đụng `updated_at`: cột đó là mốc dữ liệu KHÁCH đổi (hạng, tên…), để
  // heartbeat ghi vào là mọi tài khoản trông như vừa được sửa mỗi lần mở app.
  //
  // `.select("phone")` KHÔNG phải để lấy dữ liệu — để BIẾT CÓ GHI ĐƯỢC KHÔNG.
  // LỖI ĐÃ SỬA (2026-08-01g): `update().eq()` không khớp hàng nào thì Supabase
  // trả `error = null` y như khi ghi thành công ⇒ route cũ báo `recorded: true`
  // DÙ KHÔNG GHI GÌ. Ca có thật: SĐT suy từ email JWT không khớp
  // `customers.phone` (khách đăng nhập được nhưng chưa có hàng khách, hoặc SĐT
  // lưu khác dạng) — hỏng vĩnh viễn mà vẫn báo ổn, nên /quan-tri đứng mãi ở
  // "Chưa ghi nhận" và không ai biết vì sao.
  const { data: hit, error } = await admin
    .from("customers")
    .update(patch)
    .eq("phone", phone)
    .select("phone");
  // cột chưa có (0021 chưa apply) → nói thật cho client biết, nhưng KHÔNG lỗi
  if (error) return NextResponse.json({ ok: true, recorded: false, reason: "write_failed" });
  // KHÔNG có hàng khách nào mang SĐT này — client sẽ thử lại (30 phút/lần)
  // thay vì im 12 tiếng. `reason` để gỡ lỗi, KHÔNG kèm SĐT (đừng vọng lại
  // định danh trong phản hồi).
  if (!hit || hit.length === 0) {
    return NextResponse.json({ ok: true, recorded: false, reason: "no_customer_row" });
  }
  return NextResponse.json({ ok: true, recorded: true });
}
