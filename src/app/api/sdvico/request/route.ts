// Khách gửi yêu cầu tới SDVICO (hỏi mua / sửa chữa / bảo dưỡng / cước…)
// → ghi vào hộp yêu cầu tư vấn của CRM, nhân viên SDWork gọi lại.
//
// Dùng được CẢ KHI CHƯA ĐĂNG NHẬP (khách mới = mối bán hàng): chỉ cần tên +
// SĐT hợp lệ. Đăng nhập rồi thì route tự điền tên/SĐT từ hồ sơ nếu thiếu.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createConsultationRequest, isAssetSyncConfigured } from "@/lib/sdwork-assets";
import { topicLabel } from "@/lib/sdvico-catalog";

function normalizePhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("84")) d = "0" + d.slice(2);
  else if (!d.startsWith("0")) d = "0" + d;
  return d;
}

function isValidVnPhone(raw: string): boolean {
  const d = raw.replace(/\D/g, "");
  const local = d.startsWith("84") ? d.slice(2) : d.startsWith("0") ? d.slice(1) : d;
  return /^[1-9]\d{8,9}$/.test(local);
}

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

  // Đăng nhập rồi → lấy tên/SĐT từ hồ sơ làm mặc định
  let profileName: string | null = null;
  let profilePhone: string | null = null;
  const supabase = await createClient();
  if (supabase) {
    const { data } = await supabase.auth.getUser();
    if (data?.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", data.user.id)
        .maybeSingle();
      profileName = profile?.full_name ?? null;
      profilePhone = profile?.phone ?? data.user.email?.split("@")[0] ?? null;
    }
  }

  const phoneRaw = body.phone?.trim() || profilePhone || "";
  const name = body.name?.trim() || profileName || "Khách ForFish";
  if (!isValidVnPhone(phoneRaw)) {
    return NextResponse.json({ ok: false, code: "invalid_phone" }, { status: 400 });
  }
  const detail = (body.detail ?? "").trim().slice(0, 500);
  const product = (body.productName ?? "").trim().slice(0, 120);

  const message =
    `[ForFish] ${topicLabel(body.topic ?? "khac")}` +
    (product ? ` · ${product}` : "") +
    (detail ? ` — ${detail}` : "");

  const ok = await createConsultationRequest({
    fullName: name.slice(0, 120),
    phone: normalizePhone(phoneRaw),
    message,
  });
  if (!ok) {
    return NextResponse.json({ ok: false, code: "crm_error" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
