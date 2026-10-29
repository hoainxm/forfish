// GET /api/tau-ais/quyen — máy hỏi "tài khoản này có được xem AIS không" để hiện nút AIS (2026-10-29).
// Cùng luật với cổng middleware của /api/tau-ais (lib/tau-ais/quyen, ô app_config.tau_ais_xem). Trả theo
// từng tài khoản ⇒ private, không cache CDN. Không tra được danh tính ⇒ trả nguyên lỗi (401/503) để máy giữ
// kết quả đã lưu, không tự tắt nút giữa biển.
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { getConfigValue } from "@/lib/app-config";
import { duocXemAis } from "@/lib/tau-ais/quyen";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function GET(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  const ais = duocXemAis(who.phone, await getConfigValue("tau_ais_xem"));
  return NextResponse.json({ ok: true, ais }, { headers: { "cache-control": "private, no-store" } });
}
