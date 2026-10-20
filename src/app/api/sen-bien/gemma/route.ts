// POST /api/sen-bien/gemma — Sen Biển bản WEB hỏi MÁY CHỦ Gemma (chủ dự án 2026-10-20: "nối gemma ở máy t").
// Gemma 270M chạy trên gpu-desktop (AI Assistant train/tro-ly/gemma-may-chu.py, systemd sen-bien-gemma), ra internet qua
// đường hầm; route này chuyển tiếp và GIỮ KHOÁ ở máy chủ (env), app không bao giờ thấy khoá hay địa chỉ máy nhà.
//
// · Chỉ máy ĐÃ ĐĂNG NHẬP (chuỗi thiết bị) + giới hạn lượt theo SĐT — chặn người ngoài dùng ké máy GPU.
// · Kiểm câu ở ranh giới (`kiemCauGemma`, cùng khuôn lúc train); lời nhắc hệ thống do route tự gắn, app không gửi.
// · Trần 2 s tới máy chủ: quá ⇒ 504, app lùi về luật (app tự có trần 2,5 s). Thiếu env ⇒ 503 not_configured.
// · Không lưu câu nói ở đây (mẫu học đã có đường riêng /api/sen-bien/mau).
import { NextResponse } from "next/server";
import { timeoutSignal } from "@/lib/abort";
import { identityFromRequest } from "@/lib/api-identity";
import { allowRequest, type RateStore } from "@/lib/rate-limit";
import { kiemCauGemma, SYSTEM } from "@/lib/sen-bien/gemma-khuon";

const err = (status: number, code: string) => NextResponse.json({ ok: false, code }, { status });

// một câu nói = một lượt; 120 lượt / 10 phút là rộng cho người nói liên tục, chặn máy bơm
// nợ: đếm trong bộ nhớ một instance (như rate-limit.ts), nâng khi có bảng đếm chung
const DEM: RateStore = new Map();
const TRAN = { limit: 120, windowMs: 10 * 60_000 };
const CHO_MAY_CHU_MS = 2000;

export async function POST(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  if (!allowRequest(DEM, who.phone, Date.now(), TRAN)) return err(429, "rate_limited");

  const url = process.env.SEN_BIEN_GEMMA_URL, khoa = process.env.SEN_BIEN_GEMMA_KEY;
  if (!url || !khoa) return err(503, "not_configured");

  const body = (await req.json().catch(() => null)) as { nguoi?: unknown } | null;
  const nguoi = kiemCauGemma(body?.nguoi);
  if (!nguoi) return err(400, "bad_body");

  try {
    const res = await fetch(`${url.replace(/\/+$/, "")}/hoi`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${khoa}` },
      body: JSON.stringify({ he: SYSTEM, nguoi }),
      signal: timeoutSignal(CHO_MAY_CHU_MS),
    });
    if (!res.ok) return err(502, "upstream");
    const j = (await res.json().catch(() => null)) as { txt?: unknown; ms?: unknown } | null;
    if (typeof j?.txt !== "string") return err(502, "upstream");
    return NextResponse.json({ ok: true, txt: j.txt.slice(0, 1000), ms: typeof j.ms === "number" ? j.ms : null });
  } catch (e) {
    const ten = (e as Error)?.name;
    return err(ten === "TimeoutError" || ten === "AbortError" ? 504 : 502, "upstream");
  }
}
