// /api/admin/app-config — CẤU HÌNH ỨNG DỤNG lưu DB (2026-07-28), thay lệ thuộc
// env máy chủ. GET trạng thái mọi khoá (CHE giá trị secret); PATCH đặt 1 khoá.
// requireADMIN (không phải chỉ staff) vì đụng secret (VD vapid_private_key).
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  configStatus,
  isConfigKey,
  setConfigValue,
} from "@/lib/app-config";

const err = (status: number, code: string) =>
  NextResponse.json({ ok: false, code }, { status });

export async function GET() {
  const who = await requireAdmin();
  if (!who.ok) return err(who.status, who.code);
  return NextResponse.json({ ok: true, keys: await configStatus() });
}

export async function PATCH(req: Request) {
  const who = await requireAdmin();
  if (!who.ok) return err(who.status, who.code);

  const body = (await req.json().catch(() => null)) as {
    key?: string;
    value?: string;
  } | null;
  if (!body?.key || !isConfigKey(body.key)) return err(400, "bad_key");
  if (typeof body.value !== "string") return err(400, "bad_value");

  const ok = await setConfigValue(body.key, body.value.trim(), who.phone);
  if (!ok) return err(503, "not_configured");
  return NextResponse.json({ ok: true });
}
