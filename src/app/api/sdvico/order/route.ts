// Tạo ĐƠN MUA từ SDFish → SDWork (function sdfish-order). Route mỏng: validate
// + điền tên/SĐT từ danh tính (nếu đăng nhập) rồi gọi createSdfishOrder.
//
// Dùng được CẢ KHI CHƯA ĐĂNG NHẬP (khách vãng lai = mối bán hàng) — chỉ cần tên
// + SĐT hợp lệ; CRM tự tạo/khớp khách theo SĐT. Phase 1: 1 sản phẩm, qty=1, giá
// để trống (kinh doanh báo giá lúc duyệt). Response trả displayRef (SDF-xxxxxx)
// + status "pending" — xem docs/contracts/sdwork-assets.contract.md.

import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidVnPhone, normalizeVnPhone } from "@/lib/phone";
import { createSdfishOrder, isOrderConfigured } from "@/lib/sdwork-order";

export async function POST(req: Request) {
  if (!isOrderConfigured()) {
    return NextResponse.json({ ok: false, code: "not_configured" }, { status: 503 });
  }

  let body: {
    externalRef?: string;
    name?: string;
    phone?: string;
    productName?: string;
    qty?: number;
    note?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, code: "bad_request" }, { status: 400 });
  }

  const externalRef = (body.externalRef ?? "").trim().slice(0, 80);
  if (!externalRef) {
    return NextResponse.json({ ok: false, code: "missing_ref" }, { status: 400 });
  }
  const productName = (body.productName ?? "").trim().slice(0, 120);
  if (!productName) {
    return NextResponse.json({ ok: false, code: "missing_product" }, { status: 400 });
  }

  // Đăng nhập rồi → điền tên/SĐT hộ từ customers (giống /api/sdvico/request).
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
  const fullName = (body.name?.trim() || profileName || "Khách SDFish").slice(0, 120);
  if (!isValidVnPhone(phoneRaw)) {
    return NextResponse.json({ ok: false, code: "invalid_phone" }, { status: 400 });
  }

  const r = await createSdfishOrder({
    externalRef,
    fullName,
    phone: normalizeVnPhone(phoneRaw),
    items: [{ productName, qty: 1 }],
    note: (body.note ?? "").trim().slice(0, 500) || null,
  });
  if (!r.ok) {
    const status = r.code === "not_configured" ? 503 : 502;
    return NextResponse.json({ ok: false, code: r.code ?? "crm_error" }, { status });
  }
  return NextResponse.json({
    ok: true,
    displayRef: r.displayRef ?? null,
    status: r.status ?? "pending",
  });
}
