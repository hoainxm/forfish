// /api/thoi-tiet/nhap — MÁY NHÀ (gpu-desktop, scripts/thoi-tiet-thu.mjs) tải nguồn Open-Meteo rồi gửi lên,
// máy chủ ghép bằng ĐÚNG logic cron (lib/thoi-tiet-lam-moi) ⇒ bảng weather_snapshot có số mới kể cả khi
// Open-Meteo từ chối IP Vercel. Cửa: `Authorization: Bearer <cron_secret>` (cùng khoá cron).
//  · GET  ⇒ { ok, urls, duPhong } — URL luôn tải + nhóm dự phòng cảng (chỉ tải khi URL `chinh` của nhóm hỏng).
//  · POST ⇒ thân { goi: { [url]: chuỗi JSON } } NÉN gzip (Vercel chặn thân > 4,5 MB) ⇒ kết quả lượt làm mới
//    + mayNha { nhan, trung, truot } (truot = URL không có trong gói, máy chủ tự gọi mạng).
import { gunzipSync } from "node:zlib";
import { getCronSecret } from "@/lib/app-config";
import { chayVoiGoiOM, docGoiOM } from "@/lib/goi-nguon-om";
import { keHoachTaiOM, lamMoiThoiTiet } from "@/lib/thoi-tiet-lam-moi";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const TRAN_GIAI_NEN = 80 * 1024 * 1024;

async function biChan(req: Request): Promise<Response | null> {
  const secret = await getCronSecret();
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return Response.json({ ok: false, code: "unauthorized" }, { status: 401 });
  return null;
}

export async function GET(req: Request) {
  const chan = await biChan(req);
  if (chan) return chan;
  const { urls, duPhong } = await keHoachTaiOM();
  return Response.json({ ok: true, urls, duPhong });
}

export async function POST(req: Request) {
  const chan = await biChan(req);
  if (chan) return chan;
  let body: unknown = null;
  try {
    const buf = Buffer.from(await req.arrayBuffer());
    const nen = /gzip/i.test(req.headers.get("content-encoding") ?? "");
    body = JSON.parse((nen ? gunzipSync(buf, { maxOutputLength: TRAN_GIAI_NEN }) : buf).toString("utf8"));
  } catch {
    body = null;
  }
  const goi = docGoiOM(body);
  if (!goi) return Response.json({ ok: false, code: "bad_body" }, { status: 400 });
  const { kq, trung, truot } = await chayVoiGoiOM(goi, lamMoiThoiTiet);
  return Response.json({ ...kq, mayNha: { nhan: goi.size, trung, truot } });
}
