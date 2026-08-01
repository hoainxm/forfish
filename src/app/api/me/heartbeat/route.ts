// /api/me/heartbeat — máy tự báo "tôi vừa mở app, ở chế độ nào, đã đủ đồ đi
// biển chưa". Ghi 3 cột mốc trên `customers` (migration 0021).
//
// Vì sao có: /quan-tri cần biết ai ĐÃ CÀI mà CHƯA BAO GIỜ MỞ BẢN CÀI — nhóm sẽ
// ra khơi với máy trắng tay (kho bản cài trên iOS tách riêng với Safari). Chip
// "đã sử dụng" hiện tại là nhân viên tự tick, không phải số đo.
//
// THANG MỘT CHIỀU: web → bản cài → tải đủ. Chưa qua bản cài thì KHÔNG với tới
// bậc "đủ đồ", mọi nền (2026-08-01j) — xem countsAsOfflineReady.
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
import { countsAsOfflineReady, normalizePlatform } from "@/lib/app-usage";
import { isValidDeviceId } from "@/lib/device-id";

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
    offlineReady?: boolean;
    platform?: unknown;
    deviceId?: unknown;
  } | null;

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false }, { status: 503 });

  const now = new Date().toISOString();
  const patch: Record<string, string> = body?.standalone
    ? { pwa_last_open_at: now }
    : { web_last_open_at: now };
  // "ĐỦ ĐỒ ĐI BIỂN" phải đo trên ĐÚNG CÁI KHO sẽ dùng ngoài biển ⇒ chỉ tính
  // khi nhịp gửi TỪ BẢN CÀI, mọi nền. Chưa cài thì đứng lại ở bậc web.
  if (
    countsAsOfflineReady({
      offlineReady: !!body?.offlineReady,
      standalone: !!body?.standalone,
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
  // LOẠI MÁY (0022) — thêm vào mẻ ghi NHƯNG PHẢI CÓ ĐƯỜNG LÙI: migration 0022
  // do chủ dự án tự apply, nên cột có thể CHƯA tồn tại trên prod. Nhét thẳng
  // vào patch mà cột chưa có là cả lệnh update HỎNG ⇒ mất luôn 3 mốc thời gian
  // vốn đang chạy tốt. Nên: thử kèm loại máy, hỏng thì ghi lại KHÔNG kèm.
  const platform = normalizePlatform(body?.platform);
  const dev = isValidDeviceId(body?.deviceId) ? body.deviceId : null;
  const write = (p: Record<string, string | null>) =>
    admin.from("customers").update(p).eq("phone", phone).select("phone");

  // ĐỔI MÁY THÌ DỌN MỐC (0022). Ba cột mốc của 0021 nằm trên `customers` nên
  // chúng tích luỹ theo TÀI KHOẢN, không theo MÁY: đổi từ iPhone (đã mở bản
  // cài) sang Android (chỉ mở web) thì `pwa_last_open_at` cũ vẫn nằm đó ⇒
  // /quan-tri báo "Đã mở bản cài" cho cái máy CHƯA BAO GIỜ mở bản cài. Nhịp
  // đến từ mã máy KHÁC ⇒ xoá sạch rồi ghi lại theo máy mới.
  // `dev == null` (storage bị chặn) → KHÔNG reset: thà số liệu cũ còn hơn xoá
  // mốc mỗi lần mở app.
  const extra: Record<string, string | null> = {};
  if (platform) extra.device_platform = platform;
  if (dev) {
    extra.device_id = dev;
    const { data: cur } = await admin
      .from("customers")
      .select("device_id")
      .eq("phone", phone)
      .maybeSingle();
    const prev = (cur as { device_id?: string | null } | null)?.device_id;
    if (prev && prev !== dev) {
      // máy mới: bắt đầu lại từ số không, rồi `patch` bên dưới ghi đè mốc của
      // chính nhịp này
      extra.pwa_last_open_at = null;
      extra.web_last_open_at = null;
      extra.offline_ready_at = null;
    }
  }

  let { data: hit, error } = await write({ ...extra, ...patch });
  // Cột 0022 có thể CHƯA tồn tại (chủ dự án tự apply) — nhét cột lạ vào là cả
  // lệnh hỏng ⇒ mất luôn 3 mốc vốn đang chạy tốt. Hỏng thì ghi lại bộ cũ.
  if (error && Object.keys(extra).length > 0) {
    ({ data: hit, error } = await write(patch));
  }
  // cột chưa có (0021 chưa apply) → nói thật cho client biết, nhưng KHÔNG lỗi
  if (error) return NextResponse.json({ ok: true, recorded: false, reason: "write_failed" });
  // KHÔNG có hàng khách nào mang SĐT này — client sẽ thử lại (30 phút/lần)
  // thay vì im 12 tiếng. `reason` để gỡ lỗi, KHÔNG kèm SĐT (đừng vọng lại
  // định danh trong phản hồi).
  if (!hit || hit.length === 0) {
    return NextResponse.json({ ok: true, recorded: false, reason: "no_customer_row" });
  }

  // LỊCH SỬ MÁY (bảng customer_devices, 0022) — mỗi (khách × máy) một hàng, để
  // biết một tài khoản đã đi qua những máy nào. Ghi SAU khi mốc chính đã xong
  // và nuốt mọi lỗi: bảng có thể chưa tồn tại, và đây là sổ phụ — hỏng nó
  // KHÔNG được làm hỏng nhịp (client sẽ tưởng chưa ghi được rồi thử lại mãi).
  if (dev) {
    try {
      await admin.from("customer_devices").upsert(
        {
          customer_phone: phone,
          device_id: dev,
          ...(platform ? { platform } : {}),
          last_seen_at: now,
          ...patch,
        },
        { onConflict: "customer_phone,device_id" },
      );
    } catch {
      /* sổ phụ — hỏng thì thôi */
    }
  }
  return NextResponse.json({ ok: true, recorded: true });
}
