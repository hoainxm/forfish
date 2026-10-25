// POST /api/sdvico/khach-hoi/da-bao — AI Assistant báo đã nhắn nhóm Zalo KD cho các phiếu `{ids}` (≤50) ⇒ `da_bao`
// (14 §3.14, 0072). Header `x-sdvico-key`. Phiếu đã báo rồi báo lại ⇒ chỉ tăng `bao_lan` (an toàn khi AI Assistant gửi lại).
import { NextResponse } from "next/server";
import { khoaPhieuSai } from "@/lib/sdvico/khach-hoi-server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const sai = await khoaPhieuSai(req);
  if (sai) return sai;
  const b = (await req.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(b?.ids) ? [...new Set(b!.ids.filter((x): x is string => typeof x === "string" && UUID.test(x)))].slice(0, 50) : [];
  if (!ids.length) return NextResponse.json({ ok: false, error: "bad_ids" }, { status: 400 });
  const db = createAdminClient();
  if (!db) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  const { data: cu, error: e1 } = await db.from("sdvico_khach_hoi").select("id,bao_lan").in("id", ids);
  if (e1) return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  const now = new Date().toISOString();
  let xong = 0;
  for (const r of (cu ?? []) as { id: string; bao_lan: number }[]) {
    const { error } = await db.from("sdvico_khach_hoi").update({ trang_thai: "da_bao", bao_luc: now, bao_lan: (r.bao_lan ?? 0) + 1 }).eq("id", r.id);
    if (!error) xong++;
  }
  return NextResponse.json({ ok: true, xong });
}
