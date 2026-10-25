// POST /api/kairos/reports — BÁO XẤU BÀI / BÌNH LUẬN (14 §3.10, §7, AC15, A7).
// Lý do chọn sẵn (6 mã) + ghi chú ≤200 (KHÔNG lọc chữ bậy — người báo cần trích, A21). Một người
// một đích một lần: báo trùng ⇒ 200 `dup`. 20/ngày. ≥5 người khác nhau ⇒ TỰ ẨN chờ người trực
// (nhật ký `he-thong`); agent kiểm duyệt cũng quét mọi đích có báo xấu mới (AC24b).
import { NextResponse } from "next/server";
import { auditQuiet, clientIp, jsonBody, kErr, kairosErrorResponse, rateDenied, requireWriter } from "@/lib/kairos/server";
import { validateReport } from "@/lib/kairos/validate";

/** A7 */
const AUTO_HIDE_REPORTERS = 5;

export async function POST(req: Request) {
  const w = await requireWriter(req);
  if (!w.ok) return w.res;
  const { store, phone } = w;
  const v = validateReport(await jsonBody(req));
  if (!v.ok) return kErr(400, v.code);
  const { targetType, targetId, reason, note } = v.value;
  const id = targetId.toLowerCase();
  try {
    const target = targetType === "post" ? await store.getPost(id) : await store.getComment(id);
    if (!target) return kErr(404, "not_found");
    if ("author_phone" in target && target.author_phone === phone) return kErr(400, "self");
    const limited = await rateDenied(store, "reports", phone);
    if (limited) return limited;
    const r = await store.insertReport({ target_type: targetType, target_id: id, reporter_phone: phone, reason, note });
    if (r === "dup") return NextResponse.json({ ok: true, dup: true });
    await auditQuiet(store, { actor: phone, actor_kind: "ba-con", action: "report", target_type: targetType, target_id: id, detail: { reason }, ip: clientIp(req) });

    if (!target.hidden && (await store.distinctReporters(targetType, id)) >= AUTO_HIDE_REPORTERS) {
      if (targetType === "post") await store.updatePost(id, { hidden: true, hidden_reason: "Nhiều người báo xấu — chờ người trực xem", mod_state: "nghi" });
      else await store.updateComment(id, { hidden: true, mod_state: "nghi" });
      await auditQuiet(store, { actor: "he-thong", actor_kind: "he-thong", action: "auto_hide_reports", target_type: targetType, target_id: id, detail: { reporters: AUTO_HIDE_REPORTERS } });
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return kairosErrorResponse(e);
  }
}
