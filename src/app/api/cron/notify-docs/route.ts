// /api/cron/notify-docs — NHẮC HẠN GIẤY TỜ qua thông báo điện thoại, mỗi sáng
// (2026-10-06, user: "báo nhắc nhở/đổ chuông trên điện thoại khi sắp tới thời
// hạn hết giấy an toàn thực phẩm, phép khai thác, an toàn kỹ thuật, bảo hiểm").
//
// Đọc bản đồng bộ `user_docs` (kind documents · crew · boats — máy bà con tự đẩy
// lên qua /api/me/sync) → luật thuần `lib/doc-reminders.ts` (mốc 30/15/7/3/1/0
// ngày, quá hạn nhắc lại mỗi 30 ngày ×3) → MỘT tin/chủ tàu/lượt qua
// `notifyAccount` (ghi hộp thư TRƯỚC = sổ khử trùng, rồi mới đẩy).
//
// AUTH: Bearer CRON_SECRET như các cron khác. Gọi bởi .github/workflows/
// cron-prod.yml (prod IIS). KHÔNG vào vercel.json: bản Vercel cũ bám repo base,
// không có route này (xem ops/external-services + memory push topology).
//
// OFFLINE: toàn bộ ở máy chủ, KHÔNG thêm request nào lúc mở app. Máy mất sóng
// thì Apple/Google giữ tin, có sóng mới reo; sw.js tự in "TIN CŨ" từ sentAt.
// Giấy CHỈ nằm trong máy (chưa đồng bộ được) thì không nhắc qua đây — dải khẩn
// Trang chủ vẫn nhắc như cũ.
import { getCronSecret } from "@/lib/app-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAccount } from "@/lib/account-notify";
import { todayIsoVN } from "@/lib/days";
import { isValidVnPhone, normalizeVnPhone } from "@/lib/phone";
import {
  DOC_PUSH_SENT_BY,
  DOC_PUSH_TAG,
  DOC_SENT_WINDOW_DAYS,
  docPushMessage,
  docPushUrl,
  dueReminders,
  expiringItemsOf,
  parseDocPushUrl,
} from "@/lib/doc-reminders";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const PAGE = 1000; // trần mặc định một lần đọc của PostgREST

async function authorized(req: Request): Promise<boolean> {
  const secret = await getCronSecret();
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

type Row = { owner_phone: string; kind: string; data: unknown };

export async function GET(req: Request) {
  if (!(await authorized(req))) {
    return Response.json({ ok: false, code: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return Response.json({ ok: false, code: "not_configured" }, { status: 503 });

  const now = Date.now();

  // 1) Bản đồng bộ — đọc theo trang (vài nghìn chủ tàu vẫn ổn). Lỗi ⇒ DỪNG cả
  //    lượt: thiếu một trang là có chủ tàu bị bỏ sót mà không ai biết.
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("user_docs")
      .select("owner_phone,kind,data")
      .in("kind", ["documents", "crew", "boats"])
      .order("owner_phone")
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("[notify-docs] đọc user_docs HỎNG:", error.message);
      return Response.json({ ok: false, code: "query_failed" }, { status: 500 });
    }
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < PAGE) break;
  }

  // 2) Sổ đã gửi 45 ngày gần nhất — đọc lỗi thì DỪNG, không gửi bừa (gửi trùng
  //    mỗi sáng là cách nhanh nhất để bà con tắt thông báo, mất luôn kênh bão).
  const sent = new Map<string, Set<string>>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("push_messages")
      .select("target_phone,url")
      .eq("sent_by", DOC_PUSH_SENT_BY)
      .gte("created_at", new Date(now - DOC_SENT_WINDOW_DAYS * 86_400_000).toISOString())
      .order("created_at")
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("[notify-docs] đọc sổ đã gửi HỎNG:", error.message);
      return Response.json({ ok: false, code: "query_failed" }, { status: 500 });
    }
    for (const r of (data ?? []) as { target_phone: string | null; url: string | null }[]) {
      const p = normalizeVnPhone(r.target_phone ?? "");
      if (!isValidVnPhone(p)) continue;
      const set = sent.get(p) ?? new Set<string>();
      for (const k of parseDocPushUrl(r.url)) set.add(k);
      sent.set(p, set);
    }
    if (!data || data.length < PAGE) break;
  }

  // 3) Gom theo chủ tàu — khoá SĐT CHUẨN HOÁ, cùng khuôn `target_phone` mà
  //    notifyAccount ghi; lệch khuôn là sổ đã gửi không khớp ⇒ reo lại mỗi sáng.
  const byOwner = new Map<string, { documents?: unknown; crew?: unknown; boats?: unknown }>();
  for (const r of rows) {
    const phone = normalizeVnPhone(r.owner_phone ?? "");
    if (!isValidVnPhone(phone)) continue;
    const o = byOwner.get(phone) ?? {};
    if (r.kind === "documents" || r.kind === "crew" || r.kind === "boats") o[r.kind] = r.data;
    byOwner.set(phone, o);
  }

  const todayIso = todayIsoVN(now);
  let owners = 0;
  let items = 0;
  let devices = 0;
  let delivered = 0;
  let unrecorded = 0;
  for (const [phone, o] of byOwner) {
    const due = dueReminders(
      expiringItemsOf({ documents: o.documents, crew: o.crew, boats: o.boats }),
      sent.get(phone) ?? new Set(),
      todayIso,
    );
    if (due.length === 0) continue;
    const { title, body } = docPushMessage(due);
    const r = await notifyAccount(admin, phone, {
      title,
      body,
      url: docPushUrl(due.map((d) => d.key)),
      sentBy: DOC_PUSH_SENT_BY,
      tag: DOC_PUSH_TAG,
      onlyIfRecorded: true,
    });
    if (!r.recorded) {
      unrecorded++;
      continue;
    }
    owners++;
    items += due.length;
    devices += r.devices;
    delivered += r.sent;
  }

  // Chỉ SỐ ĐẾM — log cron in ra GitHub Actions, không lộ SĐT/tên giấy.
  return Response.json({
    ok: true,
    today: todayIso,
    scannedOwners: byOwner.size,
    remindedOwners: owners,
    items,
    devices,
    delivered,
    unrecorded,
  });
}
