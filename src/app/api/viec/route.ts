// /api/viec — TIN TUYỂN (spec 17 §6.1, §6.3, §5).
//   GET  danh sách tin đang mở (mo + chưa hết hạn), lọc port | tinh · nghe · viTri. Khách xem được (§6.3 "chưa đăng
//        nhập thì danh sách vẫn thấy"). KHÔNG SĐT trong danh sách — SĐT chỉ ở /api/viec/tin/[id]/lien-he.
//   POST đăng tin — đăng nhập + chưa bị cấm (Kairos banned_until) + customers.vai = 'chu-tau' (sai ⇒ 403 `vai`, AC4) +
//        ≤5 tin mở (409 `tran`) + kiểm chữ (Kairos + cấm thu phí 400 `phi`, AC6). SĐT chủ tin = SĐT chuỗi, không từ body.
import { NextResponse } from "next/server";
import { FISHING_PORTS } from "@/data/fishing-ports";
import { readerOf, requireWriter } from "@/lib/kairos/server";
import { allowRequest, type RateStore } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { CACHE_MAX_TIN, cangCuaTinh, cauLoi, conChoDangTin, hanTinMoi, parseLoc, validateTin, DAY_MS } from "@/lib/viec";
import { demTinMo, PORT_IDS, POST_COLS, tinChuDto, tinDto, unavailable, vaiCua, vErr, type PostRow } from "@/lib/viec-server";

// nợ: đếm trong bộ nhớ một instance (lib/rate-limit) — trần thật cao hơn khai khi Vercel chạy nhiều instance;
// chuyển sang đếm bảng job_posts theo created_at khi thấy đăng dồn trong log.
const POST_RATE: RateStore = new Map();
const POST_PER_DAY = { limit: 20, windowMs: DAY_MS };

export async function GET(req: Request) {
  const r = await readerOf(req);
  if (!r.ok) return r.res;
  const admin = createAdminClient();
  if (!admin) return unavailable();
  const loc = parseLoc(new URL(req.url).searchParams, PORT_IDS);
  const nowIso = new Date().toISOString();
  let q = admin
    .from("job_posts")
    .select(POST_COLS)
    .eq("status", "mo")
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(CACHE_MAX_TIN);
  if (loc.port) q = q.eq("port_id", loc.port);
  else if (loc.tinh) {
    const ids = cangCuaTinh(loc.tinh, FISHING_PORTS);
    // tỉnh không có cảng nào trong danh mục ⇒ không có tin, không phải lỗi
    if (ids.length === 0) return NextResponse.json({ ok: true, items: [], luc: Date.now() });
    q = q.in("port_id", ids);
  }
  if (loc.nghe) q = q.eq("nghe", loc.nghe);
  if (loc.viTri) q = q.contains("vi_tri", [loc.viTri]);
  const { data, error } = await q;
  if (error) return unavailable();
  return NextResponse.json({ ok: true, items: (data as PostRow[]).map((p) => tinDto(p, r.phone)), luc: Date.now() });
}

export async function POST(req: Request) {
  const w = await requireWriter(req);
  if (!w.ok) return w.res;
  const admin = createAdminClient();
  if (!admin) return unavailable();
  const vai = await vaiCua(admin, w.phone);
  if (!vai.ok) return unavailable();
  if (vai.vai !== "chu-tau") return vErr(403, "vai", { message: cauLoi("vai") });

  const v = validateTin(await req.json().catch(() => null), { portIds: PORT_IDS });
  if (!v.ok) return vErr(400, v.code, { message: cauLoi(v.code), ...(v.term ? { term: v.term } : {}) });

  const now = Date.now();
  const dangMo = await demTinMo(admin, w.phone, new Date(now).toISOString());
  if (dangMo === null) return unavailable();
  if (!conChoDangTin(dangMo)) return vErr(409, "tran", { message: cauLoi("tran") });
  if (!allowRequest(POST_RATE, w.phone, now, POST_PER_DAY)) return vErr(429, "rate_limited", { message: cauLoi("rate_limited") });

  const { data, error } = await admin
    .from("job_posts")
    .insert({ ...v.value, owner_phone: w.phone, status: "mo", expires_at: hanTinMoi(now) })
    .select(POST_COLS)
    .single();
  if (error || !data) return unavailable();
  return NextResponse.json({ ok: true, tin: tinChuDto(data as PostRow) }, { status: 201 });
}
