// /api/admin/kho-o — thẻ "Kho ô bản đồ" ở /quan-tri › Hệ thống (CHỈ admin). Xem lib/kho-o-ban-do.
//  · GET  ⇒ { ok, thuMuc, ghiDuoc, tranMb, nhom: [{ ngan, src, so, byte, moiNhat }] }
//  · POST { xoa: "song" | "may-nha" } ⇒ xoá cả ngăn (bộ đệm — tự đầy lại).
import { requireAdmin } from "@/lib/admin-auth";
import { getConfigValue } from "@/lib/app-config";
import { NGAN_KHO, TRAN_KHO_MB_MAC_DINH, thongKeKho, tranKhoBytes, xoaNganKho, type NganKho } from "@/lib/kho-o-ban-do";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const loi = (status: number, code: string) => Response.json({ ok: false, code }, { status });

export async function GET() {
  const who = await requireAdmin();
  if (!who.ok) return loi(who.status, who.code);
  const [tk, o] = await Promise.all([thongKeKho(), getConfigValue("kho_o_tran_mb").catch(() => null)]);
  return Response.json({
    ok: true,
    ...tk,
    tranMb: o ? Math.round(tranKhoBytes(o) / 1024 / 1024) : TRAN_KHO_MB_MAC_DINH,
  });
}

export async function POST(req: Request) {
  const who = await requireAdmin();
  if (!who.ok) return loi(who.status, who.code);
  const body = (await req.json().catch(() => null)) as { xoa?: unknown } | null;
  if (!body || !NGAN_KHO.includes(body.xoa as NganKho)) return loi(400, "bad_body");
  try {
    await xoaNganKho(body.xoa as NganKho);
  } catch {
    return loi(500, "disk");
  }
  return Response.json({ ok: true });
}
