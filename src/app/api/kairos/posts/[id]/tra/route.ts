// GET /api/kairos/posts/[id]/tra?q=<chữ>&tau=<reg,reg> — TRA DANH SÁCH TRONG FILE ĐÍNH KÈM của một thông báo
// (14 §21b, 0075; anh Long: "click tra cứu tên tàu hoặc chủ tàu để show luôn đoạn đó cho nhanh").
//
// Khách gọi được (trần đọc `readerOf`). `q` = số đăng ký (có ≥4 số ⇒ so cột reg_norm, chứa) hoặc tên chủ tàu (bỏ dấu,
// chứa); `tau` = ≤5 số đăng ký tàu trong sổ của bà con để app tự so (không gửi gì khác về tàu). Trả ≤20 dòng
// { stt, ten, reg, noiDung, page } + `co` = bài có dòng nào chưa (file chưa đọc được ⇒ false: thẻ nói "mở file xem").
// q quá ngắn/dài và không có tau ⇒ rows rỗng, không quét.
import { NextResponse } from "next/server";
import { chuanReg, dieuKienTra } from "@/lib/kairos/chinh-sach.mjs";
import { kErr, kairosErrorResponse, readerOf, storeOr503 } from "@/lib/kairos/server";
import { isUuid } from "@/lib/kairos/validate";

type Ctx = { params: Promise<{ id: string }> };
const TOI_DA = 20;
const TAU_TOI_DA = 5;

export async function GET(req: Request, ctx: Ctx) {
  const who = await readerOf(req);
  if (!who.ok) return who.res;
  const { id } = await ctx.params;
  if (!isUuid(id)) return kErr(400, "bad_id");
  const sp = new URL(req.url).searchParams;
  const dk = dieuKienTra(sp.get("q") ?? "");
  const tau = (sp.get("tau") ?? "")
    .split(",")
    .map((x) => chuanReg(x))
    .filter((x) => x.length >= 6 && x.length <= 16)
    .slice(0, TAU_TOI_DA);
  const s = await storeOr503();
  if (!s.ok) return s.res;
  const { store } = s;
  try {
    const post = await store.getPost(id);
    if (!post || post.hidden) return kErr(404, "not_found");
    const tong = await store.demDinhKemDong(id);
    if (!tong || (!dk && !tau.length)) return NextResponse.json({ ok: true, co: tong > 0, rows: [] });
    const q = { ...(dk ?? {}), ...(tau.length ? { regNorms: tau } : {}) };
    const rows = await store.traDinhKemDong(id, q, TOI_DA);
    return NextResponse.json({ ok: true, co: true, rows: rows.map((r) => ({ stt: r.stt, ten: r.ten, reg: r.reg, noiDung: r.noiDung, page: r.page })) });
  } catch (e) {
    return kairosErrorResponse(e);
  }
}
