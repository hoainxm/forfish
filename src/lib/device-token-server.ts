import "server-only";

// CỔNG KIỂM CHUỖI CỨNG — SERVER ONLY. Mọi route của app ngư dân đi qua đây.
//
// Trả về một trong BA thứ, và ba thứ này KHÔNG ĐƯỢC LẪN VÀO NHAU:
//
//   { phone }            qua cửa
//   { denial }           chặn — chuỗi không gửi / không có trong sổ / đã thu hồi
//   { unavailable }      KHÔNG TRA ĐƯỢC (chưa cấu hình env, DB không với tới)
//
// ⚠️ NHÁNH THỨ BA LÀ CẢ THIẾT KẾ AN TOÀN NẰM Ở ĐÓ. Khuôn lỗi đã dính nhiều lần
// trong repo này (xem lib/auth-error.ts, lib/tier.ts): hạ tầng trục trặc bị ĐỘI
// LỐT "đã đăng xuất", máy khách tin theo rồi xoá quyền của người đã trả tiền.
// Nên: DB hỏng thì route trả **503**, KHÔNG BAO GIỜ 401. Chỉ có đúng hai lý do
// được phép làm bà con văng khỏi tài khoản — chuỗi không có trong sổ, hoặc đã bị
// máy khác đá. Cả hai đều là câu trả lời DỨT KHOÁT từ DB, không phải sự im lặng.

import { createAdminClient } from "@/lib/supabase/admin";
import {
  hashDeviceToken,
  readTokenHeader,
  type TokenDenial,
} from "@/lib/device-token";

export type TokenIdentity =
  | { ok: true; phone: string; tokenHash: string }
  | { ok: false; denial: TokenDenial; unavailable?: false }
  | { ok: false; denial: null; unavailable: true };

/**
 * Ai đang gọi — theo chuỗi cứng trong header.
 *
 * KHÔNG đụng cookie, KHÔNG đụng phiên Supabase: app ngư dân sau bản này không
 * còn giữ phiên nào. (Đường lùi cho 15 máy đang mang phiên cũ nằm ở
 * `identityFromRequest` — file api-identity.ts, chỉ sống một nhịp phát hành.)
 */
export async function tokenIdentity(req: Request): Promise<TokenIdentity> {
  const raw = readTokenHeader(req.headers);
  // Khuôn sai / không gửi → chặn ngay, KHỎI băm, KHỎI chạm DB.
  if (!raw) return { ok: false, denial: "no_token" };

  const admin = createAdminClient();
  // Chưa cấu hình env = KHÔNG BIẾT, không phải "chuỗi sai". Xem ghi chú đầu file.
  if (!admin) return { ok: false, denial: null, unavailable: true };

  const tokenHash = await hashDeviceToken(raw);
  const { data, error } = await admin
    .from("device_tokens")
    .select("customer_phone, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  /*  DB TRẢ LỖI ≠ CHUỖI SAI. Bảng chưa apply (0026 do chủ dự án tự apply), mạng
      nội bộ chớp, Supabase nghẹt — tất cả rơi vào đây. Coi nó là "chuỗi sai" thì
      một sự cố 10 phút ở Supabase đá TOÀN BỘ bà con ra khỏi tài khoản cùng lúc,
      và mỗi người phải nhớ mật khẩu để vào lại. Đó là ca hỏng tệ nhất có thể của
      tính năng này, nên nó phải là nhánh riêng. */
  if (error) {
    console.error("[device-token] tra sổ HỎNG:", error.code, error.message);
    return { ok: false, denial: null, unavailable: true };
  }
  // Tra ĐƯỢC, không có hàng nào → chuỗi này chưa bao giờ tồn tại (hoặc DB đã dọn).
  if (!data) return { ok: false, denial: "unknown_token" };
  // Tra ĐƯỢC, có hàng, đã thu hồi → máy khác đã đăng nhập cùng số. Đây là đường
  // ra HỢP LỆ DUY NHẤT của một máy đang dùng bình thường.
  if (data.revoked_at) return { ok: false, denial: "token_revoked" };

  return { ok: true, phone: data.customer_phone, tokenHash };
}

/**
 * Đóng dấu "vừa qua cửa". CỐ Ý KHÔNG await ở đường chính và nuốt mọi lỗi: đây là
 * SỔ PHỤ (để /quan-tri biết máy nào còn sống), hỏng nó không được làm hỏng một
 * request nào của bà con.
 *
 * ⚠️ Ghi thưa, KHÔNG ghi mỗi request: một lần mở app là mấy chục lượt gọi, ghi
 * hết là biến bảng chuỗi thành bảng ghi log. Chỉ ghi khi mốc cũ đã quá `gapMs`.
 */
const TOUCH_GAP_MS = 60 * 60 * 1000;
const lastTouch = new Map<string, number>();

export function touchToken(tokenHash: string): void {
  const now = Date.now();
  const prev = lastTouch.get(tokenHash) ?? 0;
  if (now - prev < TOUCH_GAP_MS) return;
  lastTouch.set(tokenHash, now);
  const admin = createAdminClient();
  if (!admin) return;
  void admin
    .from("device_tokens")
    .update({ last_used_at: new Date(now).toISOString() })
    .eq("token_hash", tokenHash)
    .then(({ error }) => {
      if (error) console.error("[device-token] đóng dấu HỎNG:", error.message);
    });
}

/**
 * THU HỒI MỌI CHUỖI CŨ của một SĐT — gọi ở ĐÚNG MỘT CHỖ: lượt đăng nhập thành
 * công của máy mới. Đây là toàn bộ luật "1 tài khoản 1 máy".
 *
 * Trả số hàng vừa thu hồi (0 = máy đầu tiên của tài khoản này).
 *
 * ⚠️ Thu hồi TRƯỚC khi cấp chuỗi mới, và cấp chuỗi mới CHỈ KHI thu hồi xong.
 * Ngược lại thì có cửa hai máy cùng hiệu lực — đúng thứ tính năng này sinh ra để
 * chặn.
 */
export async function revokeTokensOfPhone(
  phone: string,
  reason: "new_login" | "user_signout" | "admin",
): Promise<{ ok: boolean; revoked: number }> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, revoked: 0 };
  const { data, error } = await admin
    .from("device_tokens")
    .update({ revoked_at: new Date().toISOString(), revoked_reason: reason })
    .eq("customer_phone", phone)
    .is("revoked_at", null)
    .select("token_hash");
  if (error) {
    console.error("[device-token] thu hồi HỎNG:", error.code, error.message);
    return { ok: false, revoked: 0 };
  }
  for (const r of data ?? []) lastTouch.delete((r as { token_hash: string }).token_hash);
  return { ok: true, revoked: data?.length ?? 0 };
}
