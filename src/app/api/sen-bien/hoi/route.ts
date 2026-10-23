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
import { amThanhHopLe, cachKy, dauKy, DUONG_HOI, GW_URL_MAC_DINH, kiemCauHoi, maThueBao } from "@/lib/sen-bien/cong-ai-ky";

export const dynamic = "force-dynamic";
// Máy nhà trả lời trong 0,5 s lúc khoẻ và tự cắt ở 3 s (+0,8 s đọc câu đầu) khi bận (train chiếm GPU, nạp lạnh) ⇒ route chờ 5 s rồi để máy tự nói (19/10: "hỏi chỉ được <1s")
export const maxDuration = 15;
const HAN_MS = 9_000; // máy nhà 0,6–0,7 s + đọc mp3; trần dư cho lúc máy nhà vừa nạp lại mô hình (đo 2026-10-23)

/*  GHI LÝ DO TỪ CHỐI (2026-10-22, anh Long: câu hỏi không tới máy nhà mà log Vercel trống — route lỗi im lặng
    nên không biết chặn ở đâu). Chỉ ghi MÃ + trạng thái, KHÔNG ghi câu hỏi hay số điện thoại. */
const err = (status: number, code: string) => {
  console.warn(`[sen-bien/hoi] ${status} ${code}`);
  return NextResponse.json({ ok: false, code }, { status });
};

// nợ: đếm trong bộ nhớ một instance (như rate-limit.ts); cổng nhà có trần riêng 10/phút + 200/ngày mỗi thuê bao
const DEM: RateStore = new Map();
const TRAN = { limit: 30, windowMs: 10 * 60_000 };

export async function POST(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) {
    console.warn(`[sen-bien/hoi] ${who.res.status} danh_tinh`);
    return who.res;
  }
  if (!allowRequest(DEM, who.phone, Date.now(), TRAN)) return err(429, "rate_limited");

  const cau = kiemCauHoi(await req.json().catch(() => null));
  if (!cau) return err(400, "bad_body");

  const ky = cachKy(process.env, req.headers.get("x-vercel-oidc-token"));
  const tb = maThueBao(who.phone, cccdPepper() ?? "");
  if (!ky || !tb) return err(503, !ky ? "chua_noi:khoa_ky" : "chua_noi:pepper");

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
  const j = (await r.json().catch(() => null)) as { ok?: boolean; text?: unknown; speak?: unknown; code?: unknown; am_thanh?: unknown } | null;
  if (!r.ok || !j?.ok || typeof j.text !== "string" || !j.text.trim()) {
    const code = typeof j?.code === "string" ? j.code.slice(0, 40) : "upstream";
    return err(r.status === 429 ? 429 : r.status === 504 ? 504 : 502, code);
  }
  const speak = Array.isArray(j.speak) ? j.speak.filter((s): s is string => typeof s === "string").slice(0, 6) : [j.text];
  // mp3 câu đầu giọng Mỹ Duyên (máy nhà đọc sẵn) — không có thì app tự xin /api/sen-bien/doc
  const amThanh = amThanhHopLe(j.am_thanh);
  return NextResponse.json({ ok: true, text: j.text.slice(0, 1200), speak, ...(amThanh ? { am_thanh: amThanh } : {}) }, { headers: { "Cache-Control": "no-store" } });
}
