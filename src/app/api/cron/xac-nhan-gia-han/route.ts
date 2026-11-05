// /api/cron/xac-nhan-gia-han — TỰ ĐÓNG yêu cầu gia hạn S-Tracking khi hạn trên S-Tracking ĐÃ ĐỔI (2026-11-05).
//
// Anh Long: "nếu gia hạn thì phải vô kiểm tra xem cái info trên hệ thống s tracking đã đổi chưa" · "đích cuối là
// gia hạn, đóng tiền, đổi hạn". Đơn SDFish: nhân viên chỉ đối soát tiền (→ pending_extension) + gia hạn trên
// stracking.viettel.io. Việc này đọc đơn đã nhận tiền (edge fn `pending`), so với `stracking_thiet_bi` theo SERIAL
// (máy GPU đồng bộ 07:30 · 12:20 · 17:20 · 21:00) — hạn đã đổi (`lib/renewal.daDoiHan`) ⇒ edge fn `confirm`
// (CRM kiểm lại trạng thái + serial + hạn mới > hạn cũ) ⇒ báo bà con một tin "đã gia hạn tới …".
//
// AUTH: Bearer CRON_SECRET. Gọi bởi .github/workflows/cron-prod.yml 4 lần/ngày, mỗi lượt ~30 phút sau GPU.
// Chạy lại không sao: đơn đã đóng không còn trong `pending`; tin dùng tag theo mã đơn.
// Gia hạn chưa cấu hình ⇒ 200 `skipped` (CỐ Ý không trả chữ not_configured — cron-prod coi chữ đó là thiếu CRON_SECRET).
//
// OFFLINE: chạy ở máy chủ, không thêm request nào lúc mở app; tin đẩy tới khi máy có sóng.
import { getCronSecret } from "@/lib/app-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAccount } from "@/lib/account-notify";
import {
  chonYeuCauDong,
  confirmFromStracking,
  isRenewalConfigured,
  listPendingExtensions,
} from "@/lib/renewal";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const GIA_HAN_SENT_BY = "system:gia-han";

async function authorized(req: Request): Promise<boolean> {
  const secret = await getCronSecret();
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function ngayVn(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export async function GET(req: Request) {
  if (!(await authorized(req))) {
    return Response.json({ ok: false, code: "unauthorized" }, { status: 401 });
  }
  if (!isRenewalConfigured()) {
    return Response.json({ ok: true, skipped: "renewal_chua_cau_hinh" });
  }
  const admin = createAdminClient();
  if (!admin) return Response.json({ ok: false, code: "unavailable" }, { status: 503 });

  const pending = await listPendingExtensions();
  if (pending == null) return Response.json({ ok: false, code: "crm_error" }, { status: 502 });

  const serials = [...new Set(pending.map((p) => p.serialNumber).filter((s): s is string => !!s))];
  const may = new Map<string, { het_han: string | null; ten_tau: string | null }>();
  if (serials.length) {
    const { data, error } = await admin
      .from("stracking_thiet_bi")
      .select("serial, het_han, ten_tau")
      .in("serial", serials);
    if (error) {
      console.error("[xac-nhan-gia-han] đọc máy S-Tracking hỏng:", error.message);
      return Response.json({ ok: false, code: "unavailable" }, { status: 503 });
    }
    for (const r of data ?? []) {
      may.set(r.serial as string, { het_han: (r.het_han as string | null) ?? null, ten_tau: (r.ten_tau as string | null) ?? null });
    }
  }

  const dong = chonYeuCauDong(pending, may);
  let daDong = 0;
  let loi = 0;
  for (const d of dong) {
    const ok = await confirmFromStracking({
      requestCode: d.requestCode,
      serialNumber: d.serialNumber,
      newExpiryDate: d.newExpiryDate,
    });
    if (!ok) {
      loi += 1;
      continue;
    }
    daDong += 1;
    // Tin hỏng không làm hỏng việc đóng — đơn đã đóng, thẻ "máy của tôi" vẫn hiện bước 3.
    await notifyAccount(admin, d.phone, {
      title: "Đã gia hạn giám sát hành trình",
      body: `Máy ${d.tenTau ?? d.serialNumber} đã đổi hạn trên hệ thống tới ${ngayVn(d.newExpiryDate)}.`,
      url: "/tau?tab=dich-vu",
      sentBy: GIA_HAN_SENT_BY,
      tag: `gia-han-${d.requestCode}`,
    }).catch(() => null);
  }

  return Response.json({
    ok: true,
    choDoiHan: pending.length,
    thieuSerial: pending.filter((p) => !p.serialNumber).length,
    daDong,
    loi,
  });
}
