import "server-only";

// CỔNG CHUNG CỦA MỌI ROUTE APP NGƯ DÂN — "ai đang gọi".
//
// Một chỗ duy nhất, để luật an toàn không phải nhắc lại ở 9 nơi và không nơi nào
// quên. Luật đó gồm đúng ba câu:
//
//   1. Chỉ **câu trả lời DỨT KHOÁT từ DB** mới được trả 401. Chuỗi không có trong
//      sổ, hoặc đã bị thu hồi vì máy khác đăng nhập. Hết.
//   2. **Không tra được** (env thiếu, DB nghẹt, bảng chưa apply) → **503**, không
//      bao giờ 401. Một sự cố 10 phút ở Supabase mà trả 401 là đá TOÀN BỘ bà con
//      ra khỏi tài khoản cùng lúc, giữa biển, và mỗi người phải nhớ mật khẩu để
//      vào lại. Đó là ca hỏng tệ nhất mà tính năng này có thể gây ra.
//   3. Máy chưa gửi chuỗi thì THỬ PHIÊN SUPABASE CŨ trước khi kết luận — xem
//      "đường lùi" bên dưới.
//
// ── ĐƯỜNG LÙI MỘT NHỊP PHÁT HÀNH ──────────────────────────────────────────
// Lúc bản này lên, có 15 máy đang mang phiên Supabase và CHƯA có chuỗi cứng. Cắt
// thẳng là cả 15 máy văng ra ngay giây deploy — đúng thứ cả việc này sinh ra để
// chấm dứt. Nên cổng nhận CẢ HAI trong một nhịp: máy nào còn phiên cũ thì vẫn
// qua, và màn hình sẽ lặng lẽ đổi phiên đó lấy chuỗi cứng (POST /api/auth/token).
// GỠ ĐƯỜNG LÙI KHI: `select count(*) from auth.sessions` về 0, hoặc sau 60 ngày —
// ghi trong docs/app-map/ops/state-registry.md để không ai quên nó ở đây mãi.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeVnPhone } from "@/lib/phone";
import { isAdminPhone, parseAdminPhones } from "@/lib/admin";
import { resolveTier } from "@/lib/tier";
import { tokenIdentity, touchToken } from "@/lib/device-token-server";

export type Gate =
  | { ok: true; phone: string; legacy: boolean }
  | { ok: false; res: NextResponse };

function deny(status: number, code: string): { ok: false; res: NextResponse } {
  return { ok: false, res: NextResponse.json({ ok: false, code }, { status }) };
}

/**
 * Ai đang gọi. `null` phone KHÔNG BAO GIỜ được suy ra từ một sự cố hạ tầng.
 *
 * @param anonymous cho phép đi tiếp khi CHƯA đăng nhập (route vừa phục vụ khách
 *        lạ vừa phục vụ người có tài khoản, vd hộp thư tin chung). Lúc đó trả
 *        `phone: ""`.
 */
export async function identityFromRequest(
  req: Request,
  anonymous = false,
): Promise<Gate> {
  const who = await tokenIdentity(req);

  if (who.ok) {
    touchToken(who.tokenHash); // sổ phụ, không chờ, không làm hỏng gì
    return { ok: true, phone: who.phone, legacy: false };
  }

  // KHÔNG TRA ĐƯỢC — câu 2 của luật. Tuyệt đối không 401.
  if (who.unavailable) return deny(503, "unavailable");

  // Chuỗi CÓ mà chết → câu trả lời dứt khoát, máy phải gỡ tài khoản.
  if (who.denial === "unknown_token" || who.denial === "token_revoked") {
    return deny(401, who.denial);
  }

  // Chưa gửi chuỗi → thử phiên Supabase cũ (đường lùi một nhịp phát hành).
  const supabase = await createClient();
  if (supabase) {
    const { data } = await supabase.auth.getUser();
    const email = data?.user?.email;
    const phone = email ? normalizeVnPhone(email.split("@")[0]) : null;
    if (phone) return { ok: true, phone, legacy: true };
  }

  if (anonymous) return { ok: true, phone: "", legacy: false };
  return deny(401, "no_token");
}

/**
 * CHỐT PREMIUM dùng chung cho các route "thời tiết >3 ngày" (`/api/currents-depth`,
 * `/api/weather-snapshot`). Trả `null` = cho qua.
 *
 * Gộp về một chỗ 2026-08-02: trước đây mỗi route giữ một bản `premiumDenied()`
 * riêng, chép tay giống nhau — mà đây là chỗ vừa dính danh tính vừa dính hạng,
 * tức đúng loại luật KHÔNG được có hai bản. Sửa một bản quên bản kia là hoặc lọt
 * quyền, hoặc chặn oan người đã trả tiền.
 *
 * ⚠️ KHÔNG TRA ĐƯỢC ≠ CHƯA PREMIUM. Hạ tầng hỏng → 503, để máy giữ dấu đã lưu và
 * thử lại. Trả 403 lúc Supabase nghẹt là khoá dự báo của người đang còn hạn.
 */
export async function premiumDenied(
  req: Request,
): Promise<{ status: number; code: string } | null> {
  // Demo mode (chưa cấu hình Supabase) → mở, như cũ.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;

  const who = await identityFromRequest(req);
  if (!who.ok) {
    const status = who.res.status;
    // 503 đi thẳng ra ngoài: đây là "chưa biết", không phải "không có quyền".
    return { status, code: status === 503 ? "unavailable" : "login_required" };
  }
  if (isAdminPhone(who.phone, parseAdminPhones(process.env.ADMIN_PHONES))) {
    return null;
  }
  const admin = createAdminClient();
  if (!admin) return { status: 503, code: "unavailable" };
  const { data, error } = await admin
    .from("customers")
    .select("tier, premium_until")
    .eq("phone", who.phone)
    .maybeSingle();
  if (error) {
    console.error("[premium] tra hạng HỎNG:", error.code, error.message);
    return { status: 503, code: "unavailable" };
  }
  const tier = resolveTier(data?.tier, data?.premium_until, Date.now());
  return tier === "premium" ? null : { status: 403, code: "premium_required" };
}
