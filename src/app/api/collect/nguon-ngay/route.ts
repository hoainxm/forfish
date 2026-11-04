// /api/collect/nguon-ngay — MÁY GPU (`scripts/nguon-ngay/quet.py`, timer `nguon-ngay-quet`) gửi đầu vào vệ tinh THEO
// NGÀY CỦA DỮ LIỆU vào kho `forecast-archive/nguon-ngay/` (lib/nguon-ngay.ts nói vì sao). Cửa: `Authorization: Bearer
// <cron_secret>` (cùng khoá cron, như /api/thoi-tiet/nhap). Không trả dữ liệu cho app.
//  · GET  ?tu=YYYY-MM-DD&den=YYYY-MM-DD ⇒ { ok, co: [{ ngay, nguon, bytes }] } — GPU chỉ tải ngày còn thiếu
//  · POST thân gzip { goi: GoiNguonNgay[] } ⇒ { ok, luu, hong: [{ nguon, ngay, loi }] }
import { gunzipSync } from "node:zlib";
import { getCronSecret } from "@/lib/app-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { archivePath, putArchive } from "@/lib/forecast-archive";
import { lietKeKho } from "@/lib/kho-liet-ke";
import { dayNgay, laNguonNgay, loiGoi, type GoiNguonNgay } from "@/lib/nguon-ngay";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

/** Một lượt gửi tối đa ~25 gói × ~200 KB — trần giải nén chặn bom gzip. */
const TRAN_GIAI_NEN = 40 * 1024 * 1024;
const TRAN_GOI_MOT_LUOT = 40;

async function biChan(req: Request): Promise<Response | null> {
  const secret = await getCronSecret();
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return Response.json({ ok: false, code: "unauthorized" }, { status: 401 });
  return null;
}

export async function GET(req: Request) {
  const chan = await biChan(req);
  if (chan) return chan;
  const admin = createAdminClient();
  if (!admin) return Response.json({ ok: false, code: "not_configured" }, { status: 503 });
  const u = new URL(req.url);
  const ngay = dayNgay(u.searchParams.get("tu") ?? "", u.searchParams.get("den") ?? "");
  if (!ngay) return Response.json({ ok: false, code: "bad_range" }, { status: 400 });
  try {
    const muc = await lietKeKho(admin, ["nguon-ngay"], ngay);
    const co = muc.flatMap((m) => {
      const [, , d, ten] = m.path.split("/");
      const nguon = ten.replace(/\.json\.gz$/, "");
      return laNguonNgay(nguon) ? [{ ngay: d, nguon, bytes: m.bytes }] : [];
    });
    return Response.json({ ok: true, co });
  } catch (e) {
    // liệt kê hỏng ⇒ 503: GPU KHÔNG được coi là "chưa có gì" rồi tải lại cả cửa sổ
    return Response.json({ ok: false, code: "list_failed", note: (e as Error).message }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const chan = await biChan(req);
  if (chan) return chan;
  const admin = createAdminClient();
  if (!admin) return Response.json({ ok: false, code: "not_configured" }, { status: 503 });
  let body: { goi?: unknown } | null = null;
  try {
    const buf = Buffer.from(await req.arrayBuffer());
    const nen = /gzip/i.test(req.headers.get("content-encoding") ?? "");
    body = JSON.parse((nen ? gunzipSync(buf, { maxOutputLength: TRAN_GIAI_NEN }) : buf).toString("utf8"));
  } catch {
    body = null;
  }
  const ds = body?.goi;
  if (!Array.isArray(ds) || ds.length === 0 || ds.length > TRAN_GOI_MOT_LUOT)
    return Response.json({ ok: false, code: "bad_body" }, { status: 400 });
  const homNay = new Date().toISOString().slice(0, 10);
  const hong: { nguon: unknown; ngay: unknown; loi: string }[] = [];
  let luu = 0;
  for (const g of ds) {
    const loi = loiGoi(g, homNay);
    const o = g as Partial<GoiNguonNgay>;
    if (loi) {
      hong.push({ nguon: o?.nguon, ngay: o?.ngay, loi });
      continue;
    }
    const goi = g as GoiNguonNgay;
    const put = await putArchive(admin, archivePath("nguon-ngay", goi.ngay, goi.nguon), goi);
    if (put.ok) luu++;
    else hong.push({ nguon: goi.nguon, ngay: goi.ngay, loi: put.error ?? "ghi hỏng" });
  }
  // gói sai/ghi hỏng ⇒ vẫn 200 kèm danh sách (lượt mai GPU tự gửi lại ngày còn thiếu); KHÔNG có gói nào lưu được ⇒ 502
  return Response.json({ ok: luu > 0, luu, hong }, { status: luu > 0 || hong.length === 0 ? 200 : 502 });
}
