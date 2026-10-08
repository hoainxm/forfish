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
  setConfigValues,
} from "@/lib/app-config";
import { dataKeyShift, validateConfigValue } from "@/lib/app-config-keys";
import { checkVapidPair } from "@/lib/vapid-pair";

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
    /** khoá CÒN LẠI của cặp VAPID — gửi kèm khi đổi cả cặp một lượt */
    pairValue?: string;
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

  /*  CẶP VAPID (2026-10-07): khoá công khai phải đúng là của khoá bí mật — lệch
      là Apple/Google trả 403 cho MỌI máy, tin bão không tới mà không ai thấy.
      So với khoá CÒN LẠI đang hiệu lực (DB rồi env). Đổi cả cặp: gửi kèm
      `pairValue`, hai ô ghi trong MỘT lệnh. Ô kia chưa có (lần đầu cài) thì cho
      lưu — chưa có gì để lệch. */
  if (body.key === "vapid_public_key" || body.key === "vapid_private_key") {
    const otherKey = body.key === "vapid_public_key" ? "vapid_private_key" : "vapid_public_key";
    const pairGiven = typeof body.pairValue === "string" && body.pairValue.trim() !== "";
    if (pairGiven && !validateConfigValue(otherKey, body.pairValue!)) return err(400, "bad_pair_value");
    const other = pairGiven ? body.pairValue!.trim() : await getConfigValue(otherKey);
    if (other) {
      const [pub, priv] =
        body.key === "vapid_public_key" ? [body.value, other] : [other, body.value];
      const check = checkVapidPair(pub, priv);
      if (check === "bad_format") return err(400, "bad_value");
      if (check === "mismatch") return err(409, "vapid_pair_mismatch");
    }
    if (pairGiven) {
      const ok = await setConfigValues(
        [
          { key: body.key, value: body.value.trim() },
          { key: otherKey, value: body.pairValue!.trim() },
        ],
        who.phone,
      );
      if (!ok) return err(503, "not_configured");
      return NextResponse.json({ ok: true, pairSaved: true });
    }
  }

  const ok = await setConfigValue(body.key, body.value.trim(), who.phone);
  if (!ok) return err(503, "not_configured");
  return NextResponse.json({ ok: true });
}
