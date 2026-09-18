// /api/admin/app-config — CẤU HÌNH ỨNG DỤNG lưu DB (2026-07-28), thay lệ thuộc
// env máy chủ. GET trạng thái mọi khoá (CHE giá trị secret); PATCH đặt 1 khoá.
// requireADMIN (không phải chỉ staff) vì đụng secret (VD vapid_private_key).
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  configStatus,
  getConfigValue,
  isConfigKey,
  setConfigValue,
} from "@/lib/app-config";
import { dataKeyShift, validateConfigValue } from "@/lib/app-config-keys";

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

  /*  KHOÁ DỮ LIỆU BẢN ĐỒ (2026-09-17): phải đúng 64 hex; ghi khoá hiện hành mới
      thì khoá cũ TỰ trượt xuống "trước đó" — máy đã tải file mã bằng khoá cũ vẫn
      đọc được cho tới lần deploy kế (file mới mã bằng khoá mới). */
  // Mọi khoá kiểm dạng trước khi ghi (SĐT tự điền, dán thiếu ký tự… ⇒ 400).
  if (!validateConfigValue(body.key, body.value)) return err(400, "bad_value");
  if (body.key === "data_key_current" || body.key === "data_key_prev") {
    if (body.key === "data_key_current") {
      const old = await getConfigValue("data_key_current");
      for (const row of dataKeyShift(old, body.value)) {
        const ok = await setConfigValue(row.key, row.value, who.phone);
        if (!ok) return err(503, "not_configured");
      }
      return NextResponse.json({ ok: true });
    }
  }

  const ok = await setConfigValue(body.key, body.value.trim(), who.phone);
  if (!ok) return err(503, "not_configured");
  return NextResponse.json({ ok: true });
}
