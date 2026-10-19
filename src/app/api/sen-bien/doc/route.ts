// POST /api/sen-bien/doc — đọc MỘT câu của câu trả lời máy nhà bằng GIỌNG MỸ DUYÊN (ADR 0016, 2026-10-19; chủ dự án:
// "đọc mỹ duyên hết chưa"). Câu máy nhà là chữ tự do — mảnh mp3 ghép sẵn trong app không phủ, nên máy nhà (VieNeu,
// GPU) đọc rồi trả mp3 32 kbps (~12 KB/câu). Câu đầu đã đi kèm /api/sen-bien/hoi; route này cho câu thứ hai trở đi,
// app xin ngay lúc nhận chữ (tải trong lúc câu đầu đang phát).
// Cùng cổng thuê bao như /api/sen-bien/hoi: đã đăng nhập, nhịp theo SĐT, ký + mã thuê bao giả danh, trần 8 s.
// Lỗi ⇒ mã rõ (không 200-kèm-lỗi); app đọc câu đó bằng giọng máy — không treo.
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { timeoutSignal } from "@/lib/abort";
import { cccdPepper } from "@/lib/crew-report-hash";
import { allowRequest, type RateStore } from "@/lib/rate-limit";
import { cachKy, dauKy, DUONG_DOC, GW_URL_MAC_DINH, kiemCauDoc, maThueBao } from "@/lib/sen-bien/cong-ai-ky";

export const dynamic = "force-dynamic";
const HAN_MS = 8_000;
const MP3_TOI_DA = 300_000;

const err = (status: number, code: string) => NextResponse.json({ ok: false, code }, { status });

// một câu trả lời ≤ 3 câu nói ⇒ 90/10 phút dư cho 30 câu hỏi; máy nhà có trần riêng 40/phút mỗi thuê bao
// nợ: đếm trong bộ nhớ một instance (như rate-limit.ts)
const DEM: RateStore = new Map();
const TRAN = { limit: 90, windowMs: 10 * 60_000 };

export async function POST(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  if (!allowRequest(DEM, who.phone, Date.now(), TRAN)) return err(429, "rate_limited");

  const text = kiemCauDoc(await req.json().catch(() => null));
  if (!text) return err(400, "bad_body");

  const ky = cachKy(process.env, req.headers.get("x-vercel-oidc-token"));
  const tb = maThueBao(who.phone, cccdPepper() ?? "");
  if (!ky || !tb) return err(503, "chua_noi");

  const body = JSON.stringify({ text });
  const goc = (process.env.FORLIFE_GW_URL || GW_URL_MAC_DINH).replace(/\/+$/, "");
  let r: Response;
  try {
    r = await fetch(goc + DUONG_DOC, { method: "POST", headers: dauKy(ky, tb, body, Date.now(), undefined, DUONG_DOC), body, signal: timeoutSignal(HAN_MS), cache: "no-store" });
  } catch (e) {
    const het = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    return err(het ? 504 : 502, het ? "timeout" : "may_nha_tat");
  }
  if (!r.ok || !/^audio\/mpeg\b/.test(r.headers.get("content-type") || "")) {
    const j = (await r.json().catch(() => null)) as { code?: unknown } | null;
    return err(r.status === 429 ? 429 : r.status === 504 ? 504 : 502, typeof j?.code === "string" ? j.code.slice(0, 40) : "upstream");
  }
  const mp3 = await r.arrayBuffer();
  if (!mp3.byteLength || mp3.byteLength > MP3_TOI_DA) return err(502, "upstream");
  return new NextResponse(mp3, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
}
