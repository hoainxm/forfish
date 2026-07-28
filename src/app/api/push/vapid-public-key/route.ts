// GET /api/push/vapid-public-key — trả KHOÁ CÔNG KHAI VAPID cho client đăng ký
// Web Push. Đọc DB-trước (app_config) rồi env — nhờ vậy client KHÔNG cần build
// lại khi đổi khoá (trước phải nhúng NEXT_PUBLIC_VAPID_PUBLIC_KEY lúc build).
// CÔNG KHAI: chỉ trả khoá PUBLIC (an toàn lộ), không đụng private key.
import { NextResponse } from "next/server";
import { getConfigValue } from "@/lib/app-config";

export async function GET() {
  const key = await getConfigValue("vapid_public_key");
  return NextResponse.json(
    { key: key ?? null },
    { headers: { "cache-control": "public, max-age=60" } },
  );
}
