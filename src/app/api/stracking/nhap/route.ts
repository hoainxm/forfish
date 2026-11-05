// POST /api/stracking/nhap — MÁY GPU (scripts/stracking-dong-bo.mjs, 07:30·12:20·17:20·21:00) gửi hạn cước + cảnh báo
// S-Tracking. Cửa: `x-stracking-key` (lib/stracking/khoa). Thân gzip (máy thu gửi `content-encoding: gzip`; thân thường
// vẫn nhận). Máy chủ KIỂM LẠI từng hàng bằng cùng hàm (lib/stracking/dong-bo kiemGoiNhap) rồi:
//   - upsert `stracking_thiet_bi` theo serial (máy thu chỉ gửi hồ sơ ĐỔI so với lần trước),
//   - thêm `stracking_canh_bao` (trùng khoá imei+loại+giờ ⇒ bỏ qua), xoá cảnh báo > 30 ngày,
//   - ghi một dòng `stracking_lan_dong_bo` (kể cả gói báo "het-phien"/"loi" không kèm dữ liệu), xoá sổ > 90 ngày.
// Gói: { luc, trangThai: "ok"|"het-phien"|"loi", loi?, tong?, thietBi[], canhBao[] }. Bảng độc lập luồng SDWork.
import { gunzipSync } from "node:zlib";
import { createAdminClient } from "@/lib/supabase/admin";
import { strackingKeyDenied } from "@/lib/stracking/khoa";
import { kiemGoiNhap } from "@/lib/stracking/dong-bo.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TRAN_GIAI_NEN = 30 * 1024 * 1024;
const LO_GHI = 1000;
const GIU_CANH_BAO_NGAY = 30;
const GIU_SO_NGAY = 90;

async function docThan(req: Request): Promise<unknown> {
  try {
    const buf = Buffer.from(await req.arrayBuffer());
    const nen = /gzip/i.test(req.headers.get("content-encoding") ?? "");
    const raw = nen ? gunzipSync(buf, { maxOutputLength: TRAN_GIAI_NEN }) : buf;
    return JSON.parse(raw.toString("utf8"));
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const denied = await strackingKeyDenied(req);
  if (denied) return denied;
  const r = kiemGoiNhap(await docThan(req));
  if (!r.ok || !r.goi) return Response.json({ ok: false, code: r.code ?? "bad_body" }, { status: 400 });
  const admin = createAdminClient();
  if (!admin) return Response.json({ ok: false, code: "store_down" }, { status: 503 });
  const { goi } = r;
  const now = new Date().toISOString();

  // Hồ sơ trước, cảnh báo sau; lô nào hỏng ⇒ 503 để máy thu GIỮ dấu "chưa gửi" và gửi lại lượt sau.
  for (let i = 0; i < goi.thietBi.length; i += LO_GHI) {
    const lo = goi.thietBi.slice(i, i + LO_GHI).map((t: Record<string, unknown>) => ({ ...t, dong_bo_luc: now }));
    const { error } = await admin.from("stracking_thiet_bi").upsert(lo, { onConflict: "serial" });
    if (error) {
      console.error("[stracking] ghi thiết bị hỏng:", error.message);
      return Response.json({ ok: false, code: "store_down" }, { status: 503 });
    }
  }
  for (let i = 0; i < goi.canhBao.length; i += LO_GHI) {
    const lo = goi.canhBao.slice(i, i + LO_GHI);
    const { error } = await admin.from("stracking_canh_bao").upsert(lo, { onConflict: "imei,loai,luc", ignoreDuplicates: true });
    if (error) {
      console.error("[stracking] ghi cảnh báo hỏng:", error.message);
      return Response.json({ ok: false, code: "store_down" }, { status: 503 });
    }
  }

  // Sổ + dọn: hỏng chỉ log — dữ liệu đã ghi ở trên.
  const { error: eSo } = await admin.from("stracking_lan_dong_bo").insert({
    luc: goi.luc,
    trang_thai: goi.trangThai,
    loi: goi.loi,
    tong: goi.tong,
    so_thiet_bi: goi.thietBi.length,
    so_canh_bao: goi.canhBao.length,
  });
  if (eSo) console.error("[stracking] ghi sổ hỏng:", eSo.message);
  const cuCb = new Date(Date.now() - GIU_CANH_BAO_NGAY * 86_400_000).toISOString();
  const cuSo = new Date(Date.now() - GIU_SO_NGAY * 86_400_000).toISOString();
  const [{ error: eDonCb }, { error: eDonSo }] = await Promise.all([
    admin.from("stracking_canh_bao").delete().lt("luc", cuCb),
    admin.from("stracking_lan_dong_bo").delete().lt("nhan_luc", cuSo),
  ]);
  if (eDonCb || eDonSo) console.error("[stracking] dọn cũ hỏng:", eDonCb?.message ?? eDonSo?.message);

  return Response.json({ ok: true, ghi: { thietBi: goi.thietBi.length, canhBao: goi.canhBao.length, boQua: r.boQua } });
}
