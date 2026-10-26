// POST /api/me/docs/doc-giay — ĐỌC GIẤY TỜ TÀU TỪ ẢNH qua máy nhà (Gemma e2b cùng Sen Biển) — ADR 0017, 2026-10-26.
//
// Cùng khuôn /api/sen-bien/hoi: (1) chỉ thuê bao đã đăng nhập (identityFromRequest), (2) nhịp 10/10 phút theo SĐT,
// (3) body `{ anh }` base64 ≤ ~2,7 MB chữ (ảnh ≤2 MB byte — máy nhà kiểm lại byte đầu), (4) ký + chuyển sang cổng nhà
// `/gw/v1/forfish/giay` với MÃ THUÊ BAO GIẢ DANH (không gửi SĐT), trần 20 s, (5) kiểm lại JSON trả về (kiemKqDocGiay)
// trước khi đưa máy bà con. Ảnh KHÔNG lưu ở đâu trên đường này (Storage là việc của /api/me/docs/photo).
// Lỗi gì cũng trả mã rõ, KHÔNG 200-kèm-lỗi. Chưa nối (thiếu khoá/OIDC/muối) ⇒ 503 `chua_noi`: app nói "ghi tay".
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { timeoutSignal } from "@/lib/abort";
import { cccdPepper } from "@/lib/crew-report-hash";
import { kiemKqDocGiay } from "@/lib/doc-giay";
import { allowRequest, type RateStore } from "@/lib/rate-limit";
import { cachKy, dauKy, DUONG_GIAY, GW_URL_MAC_DINH, maThueBao } from "@/lib/sen-bien/cong-ai-ky";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
const HAN_MS = 20_000; // máy nhà tự cắt ở 12 s (GIAY_GON.hanMs) + đường truyền ảnh 2 MB qua Funnel
/** base64 của 2 MB = 2,8 M ký tự; trần máy nhà 3 MB body. */
const ANH_CHU_TOI_DA = 2_800_000;
const B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

const err = (status: number, code: string) => {
  console.warn(`[docs/doc-giay] ${status} ${code}`);
  return NextResponse.json({ ok: false, code }, { status });
};

// nợ: đếm trong bộ nhớ một instance (như rate-limit.ts, cổng nhà còn trần riêng 6/phút + 60/ngày mỗi thuê bao), nâng khi có bảng đếm chung (Supabase/KV)
const DEM: RateStore = new Map();
const TRAN = { limit: 10, windowMs: 10 * 60_000 };

export async function POST(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) {
    console.warn(`[docs/doc-giay] ${who.res.status} danh_tinh`);
    return who.res;
  }
  if (!allowRequest(DEM, who.phone, Date.now(), TRAN)) return err(429, "rate_limited");

  const b = (await req.json().catch(() => null)) as { anh?: unknown } | null;
  const anh = b && typeof b === "object" && typeof b.anh === "string" ? b.anh.replace(/\s+/g, "") : "";
  if (!anh || !B64_RE.test(anh)) return err(400, "bad_body");
  if (anh.length > ANH_CHU_TOI_DA) return err(413, "qua_lon");

  const ky = cachKy(process.env, req.headers.get("x-vercel-oidc-token"));
  const tb = maThueBao(who.phone, cccdPepper() ?? "");
  if (!ky || !tb) return err(503, !ky ? "chua_noi:khoa_ky" : "chua_noi:pepper");

  const body = JSON.stringify({ anh });
  const goc = (process.env.FORLIFE_GW_URL || GW_URL_MAC_DINH).replace(/\/+$/, "");
  let r: Response;
  try {
    r = await fetch(goc + DUONG_GIAY, {
      method: "POST",
      headers: dauKy(ky, tb, body, Date.now(), undefined, DUONG_GIAY),
      body,
      signal: timeoutSignal(HAN_MS),
      cache: "no-store",
    });
  } catch (e) {
    const het = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    return err(het ? 504 : 502, het ? "timeout" : "may_nha_tat");
  }
  const j = (await r.json().catch(() => null)) as { ok?: boolean; giay?: unknown; code?: unknown } | null;
  if (!r.ok || !j?.ok) {
    const code = typeof j?.code === "string" ? j.code.slice(0, 40) : "upstream";
    return err(r.status === 429 ? 429 : r.status === 504 ? 504 : r.status === 413 ? 413 : 502, code);
  }
  const giay = kiemKqDocGiay(j.giay);
  if (!giay) return err(502, "khong_doc_duoc");
  return NextResponse.json({ ok: true, giay }, { headers: { "Cache-Control": "no-store" } });
}
