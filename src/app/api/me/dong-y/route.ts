// /api/me/dong-y — GHI BẰNG CHỨNG bà con bấm "Đồng ý" Điều khoản + Chính sách (NĐ 356/2025 Điều 6).
//
// POST {ban, luc, nguon, platform?} — SĐT CHỈ lấy từ chuỗi cứng (identityFromRequest), không nhận từ body.
// Chỉ nhận đúng bản hiện hành: máy đời cũ gửi bản cũ ⇒ 409 `ban_cu` (máy sẽ hỏi lại theo bản mới).
// Bảng 0083 chưa áp / DB nghẹt ⇒ 503 — máy giữ `daGui:false` và gửi bù, KHÔNG chặn bà con.
// ⚠️ Không cache ở service worker (`/api/me/*` đã nằm ngoài cache — sw.js).
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePlatform } from "@/lib/app-usage";
import { DIEU_KHOAN_BAN, lucHopLe } from "@/lib/dieu-khoan";

const NGUON = new Set(["dang-ky", "dang-nhap", "mo-app"]);

export async function POST(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  const body = (await req.json().catch(() => null)) as {
    ban?: unknown;
    luc?: unknown;
    nguon?: unknown;
    platform?: unknown;
  } | null;
  if (body?.ban !== DIEU_KHOAN_BAN) {
    return NextResponse.json({ ok: false, code: "ban_cu", ban: DIEU_KHOAN_BAN }, { status: 409 });
  }
  const luc = lucHopLe(body.luc);
  const nguon = typeof body.nguon === "string" && NGUON.has(body.nguon) ? body.nguon : null;
  if (!luc || !nguon) return NextResponse.json({ ok: false, code: "bad_request" }, { status: 400 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false, code: "unavailable" }, { status: 503 });
  const { error } = await admin.from("dong_y_dieu_khoan").insert({
    phone: who.phone,
    ban: DIEU_KHOAN_BAN,
    luc_may: luc,
    nguon,
    platform: normalizePlatform(body.platform),
    user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300) || null,
  });
  if (error) return NextResponse.json({ ok: false, code: "unavailable" }, { status: 503 });
  return NextResponse.json({ ok: true, ban: DIEU_KHOAN_BAN });
}
