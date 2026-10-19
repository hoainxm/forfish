// /api/data-key — GIAO KHOÁ GIẢI FILE DỮ LIỆU SDF2 cho tài khoản đã đăng nhập.
//
// Danh tính qua `identityFromRequest` (chuỗi thiết bị, đường lùi phiên Supabase)
// — cùng luật mọi route: hạ tầng hỏng ⇒ 503, KHÔNG 401. 30 lượt/24 h mỗi SĐT
// (máy thật xin một lần rồi cất trong máy). Khoá đọc từ app_config (admin đặt
// ở /quan-tri; build đầu tự sinh) — thiếu ⇒ 503 `no_key`. Trả CẢ khoá trước
// đó (nếu có) để máy đang giữ file mã bằng khoá cũ vẫn đọc được.
//
// ⚠️ KHÔNG cache ở service worker (không nằm trong API_CACHE_ALLOW) và
// `Cache-Control: no-store` — khoá là thứ ai cũng đòi được nếu nằm trong kho chung.
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { allowRequest, type RateStore } from "@/lib/rate-limit";
import { DATA_KEY_RATE } from "@/lib/data-key-server";
import { supabaseMode } from "@/lib/demo-mode";
import { loadDataKeys } from "@/lib/data-key-source";

export const dynamic = "force-dynamic";

const store: RateStore = new Map();

export async function GET(req: Request) {
  // Demo mode (máy dev / cờ rõ — lib/demo-mode.ts): không có tài khoản để kiểm,
  // mở như dataGate mở. Production thiếu env ⇒ 503, KHÔNG phát khoá cho ai hỏi.
  const mode = supabaseMode();
  if (mode === "misconfigured") return NextResponse.json({ ok: false, code: "misconfigured" }, { status: 503 });
  const demo = mode === "demo";
  let phone = "demo";
  if (!demo) {
    const who = await identityFromRequest(req);
    if (!who.ok) return who.res;
    phone = who.phone;
  }
  const keys = await loadDataKeys();
  if (keys.length === 0) {
    console.error("[data-key] chưa có khoá: app_config.data_key_current trống và không có env SDFISH_DATA_KEY");
    return NextResponse.json({ ok: false, code: "no_key" }, { status: 503 });
  }
  if (!allowRequest(store, phone, Date.now(), DATA_KEY_RATE)) {
    return NextResponse.json({ ok: false, code: "rate_limited" }, { status: 429 });
  }
  return NextResponse.json(
    { ok: true, id: keys[0].id, key: keys[0].hex, keys: keys.map((k) => ({ id: k.id, key: k.hex })) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
