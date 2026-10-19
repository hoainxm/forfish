// POST /api/sen-bien/hoi — Sen Biển HỎI MÁY NHÀ (AI Assistant, Gemma trong máy gpu-desktop) — ADR 0016, 2026-10-19.
//
// Máy bà con chỉ gọi route này khi Sen Biển trong máy KHÔNG tự trả lời được và đang có sóng (lib/sen-bien/hoi-may-chu.ts).
// Route: (1) chỉ thuê bao đã đăng nhập (chuỗi thiết bị — identityFromRequest: 401 dứt khoát / 503 không tra được),
// (2) nhịp theo SĐT, (3) hạng = dấu trong máy gửi kèm (chỉ đổi câu chữ, KHÔNG tra DB — mục tiêu < 1 s), (4) ký + chuyển sang cổng nhà
// `/gw/v1/forfish/hoi` với MÃ THUÊ BAO GIẢ DANH (cong-ai-ky.ts — không gửi SĐT), (5) trần 20 s.
// Lỗi gì cũng trả mã rõ, KHÔNG 200-kèm-lỗi: máy nghe mã là nói câu của chính nó, không treo.
//
// Chưa nối (thiếu khoá cổng / token OIDC / muối) ⇒ 503 `chua_noi` — tính năng tắt êm, app như trước.
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { timeoutSignal } from "@/lib/abort";
import { cccdPepper } from "@/lib/crew-report-hash";
import { allowRequest, type RateStore } from "@/lib/rate-limit";
import { cachKy, dauKy, DUONG_HOI, GW_URL_MAC_DINH, kiemCauHoi, maThueBao } from "@/lib/sen-bien/cong-ai-ky";

export const dynamic = "force-dynamic";
// Gemma lạnh có thể mất ~10 s nạp; cổng nhà trần 25 s ⇒ route chờ tối đa 20 s rồi để máy tự nói
export const maxDuration = 30;
const HAN_MS = 20_000;

const err = (status: number, code: string) => NextResponse.json({ ok: false, code }, { status });

// nợ: đếm trong bộ nhớ một instance (như rate-limit.ts); cổng nhà có trần riêng 10/phút + 200/ngày mỗi thuê bao
const DEM: RateStore = new Map();
const TRAN = { limit: 30, windowMs: 10 * 60_000 };

export async function POST(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  if (!allowRequest(DEM, who.phone, Date.now(), TRAN)) return err(429, "rate_limited");

  const cau = kiemCauHoi(await req.json().catch(() => null));
  if (!cau) return err(400, "bad_body");

  const ky = cachKy(process.env, req.headers.get("x-vercel-oidc-token"));
  const tb = maThueBao(who.phone, cccdPepper() ?? "");
  if (!ky || !tb) return err(503, "chua_noi");

  const body = JSON.stringify({
    text: cau.text,
    ...(cau.hang ? { hang: cau.hang } : {}),
    ...(cau.man ? { man: cau.man } : {}),
    ...(cau.cang ? { cang: cau.cang } : {}),
  });

  const goc = (process.env.FORLIFE_GW_URL || GW_URL_MAC_DINH).replace(/\/+$/, "");
  let r: Response;
  try {
    r = await fetch(goc + DUONG_HOI, { method: "POST", headers: dauKy(ky, tb, body), body, signal: timeoutSignal(HAN_MS), cache: "no-store" });
  } catch (e) {
    const het = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    return err(het ? 504 : 502, het ? "timeout" : "may_nha_tat");
  }
  const j = (await r.json().catch(() => null)) as { ok?: boolean; text?: unknown; speak?: unknown; code?: unknown } | null;
  if (!r.ok || !j?.ok || typeof j.text !== "string" || !j.text.trim()) {
    const code = typeof j?.code === "string" ? j.code.slice(0, 40) : "upstream";
    return err(r.status === 429 ? 429 : r.status === 504 ? 504 : 502, code);
  }
  const speak = Array.isArray(j.speak) ? j.speak.filter((s): s is string => typeof s === "string").slice(0, 6) : [j.text];
  return NextResponse.json({ ok: true, text: j.text.slice(0, 1200), speak }, { headers: { "Cache-Control": "no-store" } });
}
