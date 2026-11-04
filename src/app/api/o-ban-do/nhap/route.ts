// /api/o-ban-do/nhap — MÁY NHÀ (gpu-desktop, scripts/o-ban-do-thu.mjs) đẩy ô bản đồ đã tải trước vùng biển VN
// vào ngăn `may-nha` của kho ô máy chủ (lib/kho-o-ban-do). Ảnh GỐC của nguồn, không ghép/sửa.
// Cửa: `Authorization: Bearer <cron_secret>` (cùng khoá cron, khuôn /api/thoi-tiet/nhap).
//  · POST thân `{ o: [{ src, z, x, y, png: base64 }] }` NÉN gzip ⇒ { ok, nhan, ghi, loai }.
// Route nằm NGOÀI matcher middleware (không phải route dữ liệu cho bà con) — cửa duy nhất là khoá cron.
import { gunzipSync } from "node:zlib";
import { getCronSecret } from "@/lib/app-config";
import { docGoiO, ghiKhoO } from "@/lib/kho-o-ban-do";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const TRAN_GIAI_NEN = 64 * 1024 * 1024;

export async function POST(req: Request) {
  const secret = await getCronSecret();
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return Response.json({ ok: false, code: "unauthorized" }, { status: 401 });
  let body: unknown = null;
  try {
    const buf = Buffer.from(await req.arrayBuffer());
    const nen = /gzip/i.test(req.headers.get("content-encoding") ?? "");
    body = JSON.parse((nen ? gunzipSync(buf, { maxOutputLength: TRAN_GIAI_NEN }) : buf).toString("utf8"));
  } catch {
    body = null;
  }
  const goi = docGoiO(body);
  if (!goi) return Response.json({ ok: false, code: "bad_body" }, { status: 400 });
  let ghi = 0;
  for (const o of goi.o) if (await ghiKhoO("may-nha", o.src, o.z, o.x, o.y, o.buf, "image/png")) ghi++;
  // ghi được 0 ô trong khi gói có ô ⇒ đĩa máy chủ hỏng/đầy — báo 500 để máy nhà thấy trong journal
  const hong = goi.o.length > 0 && ghi === 0;
  return Response.json(
    { ok: !hong, nhan: goi.o.length, ghi, loai: goi.loai, ...(hong ? { code: "disk" } : {}) },
    { status: hong ? 500 : 200 },
  );
}
