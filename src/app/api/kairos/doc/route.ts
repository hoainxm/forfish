// POST /api/kairos/doc — TÍN HIỆU ĐỌC cho cỗ máy phân phối (14-ba-spec-kairos §13; migration 0066).
//
// Thân: {items: [{post_id, views, opened, dwell_ms}]} ≤ 100 (lib/kairos/tin-hieu-doc.docLo). Chỉ người ĐÃ đăng
// nhập (tín hiệu gắn SĐT, chỉ để xếp dòng tin cho chính người đó) — khách ⇒ 204, app bỏ hàng đợi, không lỗi.
// DB hỏng / bảng chưa có ⇒ 503 ⇒ app GIỮ hàng đợi gửi lần sau. Trần đọc chung của readerOf.
import { NextResponse } from "next/server";
import { ghiTinHieu } from "@/lib/kairos/phan-phoi-store";
import { jsonBody, kErr, readerOf } from "@/lib/kairos/server";
import { docLo } from "@/lib/kairos/tin-hieu-doc";

export async function POST(req: Request) {
  const who = await readerOf(req);
  if (!who.ok) return who.res;
  if (!who.phone) return new NextResponse(null, { status: 204 });
  const body = await jsonBody(req);
  const lo = docLo(body);
  if (!lo.ok) return kErr(400, lo.code);
  try {
    const n = await ghiTinHieu(who.phone, lo.items);
    return NextResponse.json({ ok: true, n });
  } catch {
    return kErr(503, "unavailable");
  }
}
