// POST /api/sdvico/khuyen-mai — bà con ĐĂNG KÝ MUA ưu đãi SDVICO (2026-10-26, tin Zalo của Quân: sứ định vị 500k giảm 200k ⇒ 300k
// cho mọi khách). Ghi một phiếu `sdvico_khach_hoi` (0072) với `nguon = san-pham`, `san_pham = KhuyenMai.tenPhieu`,
// `loi_nhan` = số lượng · nơi nhận · ghi chú — KHÔNG migration mới: bảng + đường AI Assistant lấy phiếu ⇒ Zalo cho Quân
// (14 §3.14) dùng lại nguyên. `tinNhanKd` nhận ra phiếu KM qua `san_pham` và soạn đầu tin "ĐĂNG KÝ MUA KM".
//
// Dùng được CẢ KHI CHƯA ĐĂNG NHẬP (khách mới = đúng đối tượng khuyến mãi): khách lạ tự điền tên + SĐT; đã đăng nhập thì
// SĐT lấy từ chuỗi thiết bị (không tin SĐT gửi lên). Kiểm ở ranh giới bằng `kiemPhieu` (SĐT hợp lệ, số tàu ≥3, nơi nhận ≥2).
// Trần: ≤3 phiếu KM / SĐT / 24 giờ (đếm theo `phone`); cùng ưu đãi trong 24 giờ ⇒ trả `trung: true`, không ghi thêm
// (bà con bấm lại vì tưởng chưa ăn — Quân không nhận 2 tin).
import { NextResponse } from "next/server";
import { loiNhanDangKy, timKhuyenMai, conHieuLuc } from "@/data/khuyen-mai";
import { identityFromRequest } from "@/lib/api-identity";
import { kiemPhieu } from "@/lib/sdvico/khach-hoi";
import { createAdminClient } from "@/lib/supabase/admin";

const TRAN_NGAY = 3;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { id?: unknown; name?: unknown; phone?: unknown; soTau?: unknown; noiNhan?: unknown; qty?: unknown; ghiChu?: unknown }
    | null;
  if (!body || typeof body.id !== "string") return NextResponse.json({ ok: false, code: "bad_request" }, { status: 400 });
  const km = timKhuyenMai(body.id);
  if (!km) return NextResponse.json({ ok: false, code: "khong_co_km" }, { status: 404 });
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
  if (!conHieuLuc(km, today)) return NextResponse.json({ ok: false, code: "het_han" }, { status: 410 });

  const qtyRaw = typeof body.qty === "number" ? body.qty : Number(body.qty);
  const qty = Number.isInteger(qtyRaw) && qtyRaw >= 1 && qtyRaw <= km.qtyMax ? qtyRaw : null;
  if (!qty) return NextResponse.json({ ok: false, code: "sai_so_luong" }, { status: 400 });
  const noiNhan = typeof body.noiNhan === "string" ? body.noiNhan.trim() : "";
  if (noiNhan.length < 2) return NextResponse.json({ ok: false, code: "thieu_cang" }, { status: 400 });

  // Đăng nhập rồi ⇒ SĐT theo chuỗi thiết bị; tên theo CRM nếu khách không gõ.
  const db = createAdminClient();
  if (!db) return NextResponse.json({ ok: false, code: "not_configured" }, { status: 503 });
  let phone = typeof body.phone === "string" ? body.phone : "";
  let ten = typeof body.name === "string" ? body.name.trim() : "";
  let nguoiGui: string | null = null;
  const who = await identityFromRequest(req, true);
  if (who.ok && who.phone) {
    phone = who.phone;
    nguoiGui = who.phone;
    if (!ten) {
      const { data: cust } = await db.from("customers").select("name").eq("phone", who.phone).maybeSingle();
      ten = ((cust?.name as string | null) ?? "").trim();
    }
  }
  if (!ten) ten = "Khách SDFish";

  const v = kiemPhieu({
    nguon: "san-pham",
    sanPham: km.tenPhieu,
    ten,
    phone,
    soTau: body.soTau,
    cang: noiNhan,
    loiNhan: loiNhanDangKy({ qty, noiNhan, ghiChu: typeof body.ghiChu === "string" ? body.ghiChu : null }),
  });
  if (!v.ok) return NextResponse.json({ ok: false, code: v.code }, { status: 400 });
  const p = v.value;

  // Trần + chống trùng trong 24 giờ (đọc trước khi ghi — lỗi đọc thì KHÔNG ghi, báo rõ để bà con bấm lại).
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data: cu, error: e1 } = await db
    .from("sdvico_khach_hoi")
    .select("id,san_pham")
    .eq("phone", p.phone)
    .gte("created_at", since)
    .limit(TRAN_NGAY + 1);
  if (e1) {
    console.error("[sdvico] đọc phiếu KM hỏng:", e1.message);
    return NextResponse.json({ ok: false, code: "db_error" }, { status: 500 });
  }
  const trung = (cu ?? []).find((r) => r.san_pham === km.tenPhieu);
  if (trung) return NextResponse.json({ ok: true, trung: true, id: trung.id });
  if ((cu ?? []).length >= TRAN_NGAY) return NextResponse.json({ ok: false, code: "qua_tran" }, { status: 429 });

  const { data: ph, error } = await db
    .from("sdvico_khach_hoi")
    .insert({
      nguon: p.nguon, san_pham: p.sanPham, ten: p.ten, phone: p.phone, so_tau: p.soTau, cang: p.cang, loi_nhan: p.loiNhan,
      nguoi_gui: nguoiGui,
    })
    .select("id")
    .single();
  if (error || !ph) {
    console.error("[sdvico] ghi phiếu KM hỏng:", error?.message);
    return NextResponse.json({ ok: false, code: "db_error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, trung: false, id: ph.id as string });
}
