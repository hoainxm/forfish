// POST /api/dev/login {phone} — CHỈ file mode (12 §6.4). Cấp chuỗi đúng khuôn
// `sdf_…` cho persona dev; client cất bằng saveToken. Không file mode ⇒ 404.
import { NextResponse } from "next/server";
import { isDevFileMode } from "@/lib/market/dev-mode";
import { marketErrorResponse } from "@/lib/market/route-utils";
import { getMarketStore } from "@/lib/market/store";

export async function POST(req: Request) {
  if (!isDevFileMode()) return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as { phone?: unknown } | null;
  if (!body || typeof body.phone !== "string" || !body.phone.trim()) {
    return NextResponse.json({ ok: false, code: "bad_body" }, { status: 400 });
  }
  try {
    const store = await getMarketStore();
    const { token, persona } = await store.devLogin(body.phone.trim());
    return NextResponse.json({ ok: true, token, persona });
  } catch (e) {
    return marketErrorResponse(e);
  }
}
