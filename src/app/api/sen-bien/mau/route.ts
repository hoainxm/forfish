// POST /api/sen-bien/mau — nhận lô MẪU CÂU NÓI của Sen Biển để huấn luyện bản sau
// (lib/sen-bien/mau-hoc.ts, migration 0059). Chủ dự án 2026-10-18.
//
// · Chỉ máy ĐÃ ĐĂNG NHẬP (chuỗi thiết bị) — chặn người ngoài bơm câu rác đầu độc mô hình.
// · Mỗi mẫu kiểm ở ranh giới bằng đúng hàm máy dùng (`lamSachMau`); mẫu sai khuôn bỏ, mẫu
//   tốt vẫn nhận. Trả `nhan` = id đã vào kho (kể cả id đã có từ lần gửi trước) để máy xoá.
// · KHÔNG lưu SĐT: chỉ dấu `nguoi` = SHA-256(pepper + "senbien:" + SĐT) — đủ để gỡ mẫu của
//   một người khi họ đòi, hoặc bỏ cả lô của một máy bơm rác; thiếu pepper thì để trống.
// · Mất sóng không liên quan: route chỉ được gọi khi máy có sóng, và máy giữ mẫu tới khi
//   nhận được `ok:true`.
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { cccdPepper } from "@/lib/crew-report-hash";
import { allowRequest, type RateStore } from "@/lib/rate-limit";
import { LO_GUI, lamSachMau } from "@/lib/sen-bien/mau-hoc";
import { createAdminClient } from "@/lib/supabase/admin";

const err = (status: number, code: string) => NextResponse.json({ ok: false, code }, { status });

// máy gửi tối đa một lô mỗi 10 phút khi khoẻ; 20 lô/giờ là trần rộng cho máy gửi bù sau chuyến dài
// nợ: đếm trong bộ nhớ một instance (như rate-limit.ts), nâng khi có bảng đếm chung
const DEM: RateStore = new Map();
const TRAN = { limit: 20, windowMs: 60 * 60_000 };

export async function POST(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  if (!allowRequest(DEM, who.phone, Date.now(), TRAN)) return err(429, "rate_limited");

  const body = (await req.json().catch(() => null)) as { mau?: unknown } | null;
  if (!body || !Array.isArray(body.mau) || body.mau.length === 0) return err(400, "bad_body");
  if (body.mau.length > LO_GUI) return err(413, "too_many");

  const mau = body.mau.map(lamSachMau).filter((m): m is NonNullable<typeof m> => m !== null);
  if (!mau.length) return NextResponse.json({ ok: true, nhan: [] });

  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const pepper = cccdPepper();
  const nguoi = pepper ? createHash("sha256").update(`${pepper}:senbien:${who.phone}`).digest("hex") : null;
  const { error } = await admin.from("sen_bien_mau").upsert(
    mau.map((m) => ({
      id: m.id,
      noi_luc: new Date(m.t).toISOString(),
      phien: m.phien,
      cau: m.cau,
      tra: m.tra,
      ct: m.ct ?? null,
      gemma: m.gemma ?? null,
      xn: m.xn,
      chay: m.chay,
      nen: m.nen,
      ban: m.ban,
      nguoi,
    })),
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (error) return err(500, "insert_failed");
  return NextResponse.json({ ok: true, nhan: mau.map((m) => m.id) });
}
