// POST /api/kairos/doc — TÍN HIỆU ĐỌC cho cỗ máy phân phối (14-ba-spec-kairos §13; migration 0066).
//
// Thân: {items: [{post_id, views, opened, dwell_ms}]} ≤ 100 (lib/kairos/tin-hieu-doc.docLo) + `tt: [{id, xem, bam}]`
// ≤ 20 lượt xem/bấm thẻ Tài trợ (lib/kairos/do-khach.docDemTaiTro, 14 §22). Chỉ người ĐÃ đăng nhập (tín hiệu gắn
// SĐT: xếp dòng tin cho chính người đó + đo nội bộ SDVICO) — khách ⇒ 204, app bỏ hàng đợi, không lỗi.
// Tín hiệu đọc hỏng / bảng chưa có ⇒ 503 ⇒ app GIỮ hàng đợi. Đếm tài trợ hỏng (vd 0077 chưa áp) ⇒ vẫn 200 kèm
// `tt:false` ⇒ app chỉ giữ phần đếm (không gửi lại tín hiệu đọc đã ghi). Trần đọc chung của readerOf.
import { NextResponse } from "next/server";
import { docDemTaiTro } from "@/lib/kairos/do-khach";
import { ghiDemTaiTro, ghiTinHieu } from "@/lib/kairos/phan-phoi-store";
import { jsonBody, kErr, readerOf } from "@/lib/kairos/server";
import { docLo } from "@/lib/kairos/tin-hieu-doc";

export async function POST(req: Request) {
  const who = await readerOf(req);
  if (!who.ok) return who.res;
  if (!who.phone) return new NextResponse(null, { status: 204 });
  const body = await jsonBody(req);
  const lo = docLo(body);
  if (!lo.ok) return kErr(400, lo.code);
  let n: number;
  try {
    n = await ghiTinHieu(who.phone, lo.items);
  } catch {
    return kErr(503, "unavailable");
  }
  const tt = await ghiDemTaiTro(who.phone, docDemTaiTro((body as { tt?: unknown } | null)?.tt));
  return NextResponse.json({ ok: true, n, tt });
}
