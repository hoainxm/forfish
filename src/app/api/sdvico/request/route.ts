// Khách gửi yêu cầu tới SDVICO (hỏi mua / sửa chữa / bảo dưỡng / cước…)
// → ghi vào hộp yêu cầu tư vấn của CRM, nhân viên SDWork gọi lại.
//
// Dùng được CẢ KHI CHƯA ĐĂNG NHẬP (khách mới = mối bán hàng): chỉ cần tên +
// SĐT hợp lệ. Đăng nhập rồi thì route tự điền tên/SĐT từ hồ sơ nếu thiếu.

import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { createAdminClient } from "@/lib/supabase/admin";
import { createConsultationRequest, isAssetSyncConfigured } from "@/lib/sdwork-assets";
import { normalizeVnPhone, isValidVnPhone } from "@/lib/phone";
import { buildRequestMessage } from "@/lib/sdwork-request";

export async function POST(req: Request) {
  if (!isAssetSyncConfigured()) {
    return NextResponse.json({ ok: false, code: "not_configured" }, { status: 503 });
  }

  let body: {
    name?: string;
    phone?: string;
    topic?: string;
    detail?: string;
    productName?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, code: "bad_request" }, { status: 400 });
  }

  /*  Đăng nhập rồi → lấy tên/SĐT làm mặc định. `anonymous = true`: đây là đường
      GỬI YÊU CẦU HỖ TRỢ, khách vãng lai phải gửi được (họ tự điền tên/SĐT). Danh
      tính chỉ để điền hộ, không mở thêm quyền gì.
      Đổi 2026-08-02: tra `customers` theo SĐT của chuỗi thay vì `profiles` theo
      `user.id` — máy ngư dân không còn phiên Supabase nên không còn `user.id`. */
  let profileName: string | null = null;
  let profilePhone: string | null = null;
  const who = await identityFromRequest(req, true);
  if (who.ok && who.phone) {
    profilePhone = who.phone;
    const admin = createAdminClient();
    if (admin) {
      const { data: cust } = await admin
        .from("customers")
        .select("name")
        .eq("phone", who.phone)
        .maybeSingle();
      profileName = (cust?.name as string | null) ?? null;
    }
  }

  const phoneRaw = body.phone?.trim() || profilePhone || "";
  const name = body.name?.trim() || profileName || "Khách SDFish";
  if (!isValidVnPhone(phoneRaw)) {
    return NextResponse.json({ ok: false, code: "invalid_phone" }, { status: 400 });
  }
  const message = buildRequestMessage({
    topic: body.topic,
    productName: body.productName,
    detail: body.detail,
  });

  const ok = await createConsultationRequest({
    fullName: name.slice(0, 120),
    phone: normalizeVnPhone(phoneRaw),
    message,
  });
  if (!ok) {
    return NextResponse.json({ ok: false, code: "crm_error" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
