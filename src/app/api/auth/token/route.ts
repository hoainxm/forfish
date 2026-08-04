// ĐỔI PHIÊN ĐĂNG NHẬP LẤY CHUỖI CỨNG — chỗ DUY NHẤT trong app sinh ra chuỗi.
//
// Vì sao không nhận thẳng SĐT+mật khẩu ở đây: làm thế thì mọi lượt đăng nhập của
// 700 khách đi ra Supabase từ **một IP** (server Vercel), nên bộ đếm chống dò mật
// khẩu của Supabase tính chung cho tất cả — một kẻ dò mật khẩu là khoá đăng nhập
// của cả làng. Nên giữ nguyên đường cũ: máy tự `signInWithPassword` (Supabase đếm
// theo IP thật của từng người), rồi ĐỔI cái phiên vừa có lấy chuỗi cứng.
//
// Trình tự ở máy (xem app/login/page.tsx):
//   1. signInWithPassword          → có phiên Supabase (tạm)
//   2. POST /api/auth/token        → nhận chuỗi cứng, lưu localStorage
//   3. signOut()                   → BỎ HẲN phiên Supabase
// Từ bước 3 trở đi máy không còn cookie, không còn JWT, không còn gì tự hết hạn.
//
// DELETE = bà con tự bấm Đăng xuất → thu hồi chuỗi của chính mình.
//
// ⚠️ OFFLINE: cả hai đường đều CHỈ chạy lúc bà con chủ động đăng nhập/đăng xuất
// ở nơi có sóng. Không có nhịp nền nào gọi vào đây, không có gì chạy giữa biển.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeVnPhone } from "@/lib/phone";
import { normalizePlatform } from "@/lib/app-usage";
import { isValidDeviceId } from "@/lib/device-id";
import { newDeviceToken, hashDeviceToken } from "@/lib/device-token";
import { revokeTokensOfPhone, tokenIdentity } from "@/lib/device-token-server";

export async function POST(req: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ ok: false, code: "not_configured" }, { status: 503 });

  // Phiên tạm của bước 1. Không có = chưa đăng nhập, không cấp gì cả.
  const { data } = await supabase.auth.getUser();
  const email = data?.user?.email;
  if (!email) {
    return NextResponse.json({ ok: false, code: "login_required" }, { status: 401 });
  }
  const phone = normalizeVnPhone(email.split("@")[0]);
  if (!phone) {
    return NextResponse.json({ ok: false, code: "bad_account" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as {
    deviceId?: unknown;
    platform?: unknown;
  } | null;
  const deviceId = isValidDeviceId(body?.deviceId) ? body.deviceId : null;
  const platform = normalizePlatform(body?.platform);

  /*  THU HỒI TRƯỚC, CẤP SAU — thứ tự này là toàn bộ luật "1 tài khoản 1 máy".
      Đảo lại thì có một khoảnh khắc HAI chuỗi cùng hiệu lực, và nếu bước thu hồi
      hỏng ngay sau đó thì máy cũ sống tiếp vĩnh viễn — đúng thứ tính năng này
      sinh ra để chặn. Thu hồi không xong ⇒ KHÔNG cấp chuỗi, báo bà con thử lại. */
  const revoked = await revokeTokensOfPhone(phone, "new_login");
  if (!revoked.ok) {
    return NextResponse.json({ ok: false, code: "revoke_failed" }, { status: 503 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false, code: "not_configured" }, { status: 503 });

  /*  THỬ LẠI MỘT LẦN KHI ĐỤNG RÀNG BUỘC "MỘT CHUỖI SỐNG" (0028).
      Hai lượt đăng nhập chạy sát nhau có thể xen kẽ revoke/insert; index unique
      partial làm lượt thua NÉM (mã Postgres 23505) thay vì để hai máy cùng sống.
      Lượt thua chỉ cần thu hồi lại rồi cấp lại — lần này chuỗi của bên kia đã
      nằm đó nên thu hồi ăn, và người đăng nhập SAU thắng, đúng ý tính năng.
      Đúng MỘT lần thử lại: quá đó thì có gì đó sai hẳn, báo thật còn hơn quay
      vòng trong khi bà con đang đứng chờ. */
  let token = "";
  let error: { code?: string; message: string } | null = null;
  for (let lan = 0; lan < 2; lan++) {
    if (lan > 0) {
      const lai = await revokeTokensOfPhone(phone, "new_login");
      if (!lai.ok) break;
    }
    token = newDeviceToken();
    const res = await admin.from("device_tokens").insert({
      token_hash: await hashDeviceToken(token),
      customer_phone: phone,
      ...(deviceId ? { device_id: deviceId } : {}),
      ...(platform ? { platform } : {}),
    });
    error = res.error;
    if (!error || error.code !== "23505") break;
  }
  if (error) {
    /*  Đã thu hồi chuỗi cũ mà cấp chuỗi mới hỏng ⇒ tài khoản này tạm thời KHÔNG
        máy nào vào được. Nói thật để máy thử lại; bà con vẫn đang giữ phiên
        Supabase tạm của bước 1 nên bấm lại là chạy, không phải nhập lại mật khẩu. */
    console.error("[auth/token] cấp chuỗi HỎNG:", error.code, error.message);
    return NextResponse.json({ ok: false, code: "issue_failed" }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    token,
    phone,
    /** máy cũ vừa bị đá — để màn hình nói "đã đăng xuất máy trước" cho minh bạch */
    kicked: revoked.revoked > 0,
    mustChangePassword:
      data?.user?.user_metadata?.must_change_password === true,
  });
}

export async function DELETE(req: Request) {
  // Bà con tự bấm Đăng xuất. Nhận diện bằng CHÍNH chuỗi đang cầm — không cần
  // phiên Supabase (đã bỏ từ bước 3 lúc đăng nhập).
  const who = await tokenIdentity(req);
  if (!who.ok) {
    /*  ⚠️ KHÔNG TRA ĐƯỢC ≠ ĐÃ ĐĂNG XUẤT (sửa 2026-08-02h).
        LỖI ĐÃ SỬA: nhánh này trả HTTP 200 cho MỌI ca, kể cả khi env thiếu /
        Supabase nghẹt. Client chỉ đọc `res.ok` ⇒ tính là đăng xuất xong ⇒ xoá
        hộp thư + xoá chuỗi trong máy, trong khi hàng `device_tokens` vẫn
        `revoked_at = null` **mãi mãi**: máy đó coi như không đăng xuất được nữa
        và vẫn chiếm suất "một máy" của tài khoản. Lá chắn "Chưa đăng xuất được
        — chưa có sóng" bị vô hiệu đúng ca nó sinh ra để đỡ (cổng wifi ở cảng trả
        200 HTML cũng lọt y hệt).
        Nay: hạ tầng không tra được → 503, máy giữ nguyên mọi thứ và mời bấm lại.
        Chuỗi đã chết sẵn (thu hồi/không có trong sổ) → 200, vì phía server thật
        sự không còn gì để làm. */
    if (who.unavailable) {
      return NextResponse.json({ ok: false, code: "unavailable" }, { status: 503 });
    }
    return NextResponse.json({ ok: true, revoked: 0 });
  }
  const r = await revokeTokensOfPhone(who.phone, "user_signout");
  return NextResponse.json({ ok: r.ok, revoked: r.revoked });
}
