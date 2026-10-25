// /api/kairos/truc — BỘ TRỰC SDVICO trên máy GPU (scripts/kairos-truc.mjs, mỗi phút; 14 §3.14, 0073). Header `x-kairos-key`
// như /api/kairos/agent.
//
// GET   ≤ TRUC_MOI_LUOT hội thoại `cho_tra_loi` (cập nhật trong 6 giờ, cũ trước) dạng `ViecTruc` (tu-van.mjs): tên khách +
//       số đuôi SĐT, TÀI LIỆU SẢN PHẨM (sdvico-showcase), số tàu / cảng đã biết + cảng nhà gợi ý, bài + lời trong luồng.
// POST  {id, body, soTau?, cang?} — câu tư vấn Claude viết. Máy chủ kiểm lời (`loiTuVan`: không giá, không link, không
//       SĐT, không xin SĐT; chữ bậy; chủ quyền), đăng bình luận SDVICO "@Tên …" trong đúng luồng (duyệt sẵn, báo "nhắc
//       đến bạn"), gộp số tàu + cảng (khách nói ra mới nhận). ĐỦ cả hai lần đầu ⇒ TỰ LẬP phiếu sdvico_khach_hoi (SĐT tài
//       khoản, tên theo CRM khách hàng / tên gọi) cho AI Assistant chuyển Zalo KD. Quá TRUC_TOI_DA_LAN ⇒ đóng hội thoại.
import { NextResponse } from "next/server";
import { FISHING_PORTS } from "@/data/fishing-ports";
import { SDVICO_HOTLINE_DISPLAY, SDVICO_SHOWCASE } from "@/data/sdvico-showcase";
import { chuQuyenFlag } from "@/lib/kairos/chu-quyen.mjs";
import { badWordHit } from "@/lib/kairos/loc-chu";
import { auditQuiet, ingestKeyDenied, kErr, kairosErrorResponse, notifyNhacTen, storeOr503 } from "@/lib/kairos/server";
import { locNhacTen } from "@/lib/kairos/nhac-ten";
import { SDVICO_PHONE } from "@/lib/kairos/types";
import { isUuid } from "@/lib/kairos/validate";
import { kiemPhieu } from "@/lib/sdvico/khach-hoi";
import { docSoTau, loiTuVan, soDuoi, timCang, TRUC_MOI_LUOT, TRUC_TOI_DA_LAN } from "@/lib/sdvico/tu-van.mjs";
import { createAdminClient } from "@/lib/supabase/admin";

const TEN_CANG = FISHING_PORTS.map((p) => p.name);
const COLS = "id,post_id,goc_comment_id,asker_phone,asker_profile_id,san_pham,so_tau,cang,trang_thai,lan_tra_loi,phieu_id";
type HoiThoai = {
  id: string; post_id: string; goc_comment_id: string | null; asker_phone: string; asker_profile_id: string; san_pham: string | null;
  so_tau: string | null; cang: string | null; trang_thai: string; lan_tra_loi: number; phieu_id: string | null;
};

export async function GET(req: Request) {
  const denied = await ingestKeyDenied(req);
  if (denied) return denied;
  const db = createAdminClient();
  const s = await storeOr503();
  if (!s.ok || !db) return s.ok ? kErr(503, "not_configured") : s.res;
  const { store } = s;
  try {
    const since = new Date(Date.now() - 6 * 3_600_000).toISOString();
    const { data, error } = await db.from("sdvico_hoi_thoai").select(COLS).eq("trang_thai", "cho_tra_loi").gte("updated_at", since).order("updated_at", { ascending: true }).limit(TRUC_MOI_LUOT);
    if (error) throw new Error(error.message);
    const viec = [];
    for (const h of (data ?? []) as HoiThoai[]) {
      const [post, prof, all] = await Promise.all([store.getPost(h.post_id), store.profileById(h.asker_profile_id), store.allComments(h.post_id, 500)]);
      if (!post || post.hidden || !prof) continue;
      const sp = SDVICO_SHOWCASE.find((p) => p.id === h.san_pham);
      const trongLuong = all
        .filter((c) => !c.hidden && (h.goc_comment_id ? c.id === h.goc_comment_id || c.parent_id === h.goc_comment_id : c.author_phone === h.asker_phone || c.author_phone === SDVICO_PHONE))
        .slice(-12);
      const tenCua = new Map((await store.profilesByPhones([...new Set(trongLuong.map((c) => c.author_phone))])).map((p) => [p.phone, p.handle]));
      const cangNha = (prof as { home_port?: string | null }).home_port;
      viec.push({
        id: h.id,
        khach: { ten: prof.handle, soDuoi: soDuoi(h.asker_phone) },
        lanTraLoi: h.lan_tra_loi,
        sanPham: sp
          ? { ten: sp.title, moTa: sp.desc, choAi: sp.detail.forWho, loiIch: sp.detail.benefits, thongSo: sp.detail.specs, bienThe: sp.detail.variant ?? "" }
          : null,
        daBiet: { soTau: h.so_tau, cang: h.cang, cangNhaGoiY: (cangNha && FISHING_PORTS.find((p) => p.id === cangNha)?.name) || null },
        bai: { tieuDe: post.title ?? "", noiDung: (post.summary ?? post.body ?? "").slice(0, 500) },
        hoiThoai: [
          ...(post.author_phone === h.asker_phone && !h.goc_comment_id ? [{ ai: "khach", ten: prof.handle, chu: post.body.slice(0, 500) }] : []),
          ...trongLuong.map((c) => ({
            ai: c.author_phone === h.asker_phone ? "khach" : c.author_phone === SDVICO_PHONE ? "sdvico" : "khac",
            ten: tenCua.get(c.author_phone) ?? "",
            chu: c.body.slice(0, 500),
          })),
        ],
      });
    }
    return NextResponse.json({ ok: true, viec, hotline: SDVICO_HOTLINE_DISPLAY });
  } catch (e) {
    return kairosErrorResponse(e);
  }
}

export async function POST(req: Request) {
  const denied = await ingestKeyDenied(req);
  if (denied) return denied;
  const b = (await req.json().catch(() => null)) as { id?: unknown; body?: unknown; soTau?: unknown; cang?: unknown } | null;
  if (!b || !isUuid(b.id) || typeof b.body !== "string") return kErr(400, "bad_body");
  const db = createAdminClient();
  const s = await storeOr503();
  if (!s.ok || !db) return s.ok ? kErr(503, "not_configured") : s.res;
  const { store } = s;
  try {
    const { data: h0, error } = await db.from("sdvico_hoi_thoai").select(COLS).eq("id", String(b.id)).maybeSingle();
    if (error) throw new Error(error.message);
    const h = h0 as HoiThoai | null;
    if (!h) return kErr(404, "not_found");
    if (h.trang_thai !== "cho_tra_loi") return kErr(409, "da_tra_loi");
    const [post, prof, sdvico] = await Promise.all([store.getPost(h.post_id), store.profileById(h.asker_profile_id), store.profileByPhone(SDVICO_PHONE)]);
    if (!post || post.hidden || !prof || !sdvico) return kErr(404, "gone");
    // Claude có lỡ mở bằng "@Tên" thì bỏ — máy gắn đúng một lần
    const chu = b.body.trim().replace(new RegExp(`^@${prof.handle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i"), "");
    const loi = loiTuVan(chu) ?? (badWordHit(chu) ? "bad_words" : chuQuyenFlag(chu) ? "chu_quyen" : null);
    if (loi) return kErr(422, loi);
    // số tàu / cảng: giữ cái đã có; mới thì phải đúng dạng (số tàu) / có trong danh mục hoặc chữ gọn (cảng)
    const soTau = h.so_tau ?? (typeof b.soTau === "string" ? docSoTau(b.soTau) : null);
    const cangMoi = typeof b.cang === "string" ? timCang(b.cang, TEN_CANG) ?? (b.cang.trim().length >= 2 && b.cang.trim().length <= 80 ? b.cang.trim() : null) : null;
    const cang = h.cang ?? cangMoi;
    const body = `@${prof.handle} ${chu}`;
    const row = await store.insertComment({
      post_id: post.id,
      parent_id: h.goc_comment_id,
      author_phone: SDVICO_PHONE,
      body,
      mentions: locNhacTen(body, [{ id: prof.id, ten: prof.handle }]),
    });
    await store.updateComment(row.id, { mod_state: "dat", mod_checked_at: new Date().toISOString() }).catch(() => undefined);
    await notifyNhacTen(store, { postId: post.id, phones: [h.asker_phone], byHandle: sdvico.handle, commentId: row.id });
    // đủ số tàu + cảng lần đầu ⇒ tự lập phiếu cho KD (SĐT = tài khoản)
    let phieuId = h.phieu_id;
    if (!phieuId && soTau && cang) {
      const { data: kh } = await db.from("customers").select("name").eq("phone", h.asker_phone).maybeSingle();
      const sp = SDVICO_SHOWCASE.find((p) => p.id === h.san_pham);
      const cuoiKhach = (await store.allComments(post.id, 500)).filter((c) => c.author_phone === h.asker_phone).slice(-1)[0]?.body ?? post.body;
      const v = kiemPhieu({
        nguon: "kairos", sanPham: sp?.id ?? null, ten: ((kh?.name as string | null) ?? prof.handle).slice(0, 80), phone: h.asker_phone,
        soTau, cang, loiNhan: cuoiKhach.slice(0, 500), kairosPostId: post.id, kairosCommentId: h.goc_comment_id ?? row.id,
      });
      if (v.ok) {
        const p = v.value;
        const { data: ph } = await db
          .from("sdvico_khach_hoi")
          .insert({
            nguon: p.nguon, san_pham: p.sanPham, ten: p.ten, phone: p.phone, so_tau: p.soTau, cang: p.cang, loi_nhan: p.loiNhan,
            kairos_post_id: p.kairosPostId, kairos_comment_id: p.kairosCommentId, nguoi_gui: h.asker_phone,
          })
          .select("id")
          .single();
        phieuId = (ph?.id as string | undefined) ?? null;
      }
    }
    const lan = h.lan_tra_loi + 1;
    await db
      .from("sdvico_hoi_thoai")
      .update({
        trang_thai: lan >= TRUC_TOI_DA_LAN ? "dong" : "da_tra_loi", lan_tra_loi: lan, updated_at: new Date().toISOString(),
        goc_comment_id: h.goc_comment_id ?? row.id, so_tau: soTau, cang, phieu_id: phieuId,
      })
      .eq("id", h.id);
    await auditQuiet(store, { actor: "may-thu", actor_kind: "he-thong", action: "sdvico_tu_van", target_type: "comment", target_id: row.id, detail: { hoiThoai: h.id, phieu: phieuId } });
    return NextResponse.json({ ok: true, commentId: row.id, phieuMoi: !h.phieu_id && !!phieuId });
  } catch (e) {
    return kairosErrorResponse(e);
  }
}
