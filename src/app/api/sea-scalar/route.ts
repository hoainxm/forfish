import { loadSeaScalar, SEA_SCALARS } from "@/lib/sea-scalars";
import type { SeaScalarKind } from "@/lib/sea-scalars";

/**
 * Lớp số liệu biển (nước dâng/xoáy, độ mặn) — proxy nguồn công khai, cache 6h.
 * Nguồn fail → { ok:false }, client im lặng (không bịa dữ liệu).
 *
 * NGUỒN HỎNG PHẢI TRẢ 503, KHÔNG PHẢI 200 (sửa 2026-08-02, audit B5/K2): service
 * worker chỉ cất phản hồi `res.ok`, mà `Response.json({ok:false})` mặc định là
 * 200 ⇒ một lúc ERDDAP bảo trì là ĐÈ MẤT bản nước dâng/độ mặn trong kho. Client
 * còn bản localStorage nên hậu quả có giới hạn, nhưng cùng một khuôn lỗi thì vá
 * cả khuôn — đây là route cuối cùng còn sót của nhóm này.
 *
 * `kind` lạ thì 400, KHÔNG 503: 400 không nằm trong `isRescuableStatus` nên
 * service worker sẽ không "cứu" nhầm bằng bản của một kind khác.
 */
export async function GET(req: Request) {
  const kind = new URL(req.url).searchParams.get("kind") ?? "";
  if (!(kind in SEA_SCALARS))
    return Response.json({ ok: false }, { status: 400 });
  const data = await loadSeaScalar(kind as SeaScalarKind);
  return Response.json(data, data.ok ? undefined : { status: 503 });
}
