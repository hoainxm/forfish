// /api/me/messages/read — BÀ CON ĐÃ ĐỌC TIN TRONG APP (0024).
//
// VÌ SAO CÓ: 0023 chỉ đếm "đọc" khi bấm vào banner thông báo. Nhưng đường đọc
// PHỔ BIẾN NHẤT lại là: liếc trên màn khoá rồi vuốt tắt, hoặc mở app xem mục
// Thông báo ở trang chủ — cả hai đều không ghi gì, nên trang quản trị hiện
// "đọc 0" vĩnh viễn dù bà con đã đọc. Người gửi tin bão nhìn số đó sẽ kết luận
// sai là tin không tới.
//
// ĐƠN VỊ: đếm theo NGƯỜI ĐỌC, không theo máy (xem migration 0024).
//   - đã đăng nhập  → reader = 'sdt:<SĐT>', máy chủ TỰ lấy từ phiên
//   - chưa đăng nhập → reader = 'may:<endpoint>' (hộp thư mở cho cả khách)
// Client KHÔNG được khai mình là ai — chỉ khai endpoint của chính nó, đúng
// cùng mô hình đe doạ đã chấp nhận ở /api/push/ack: biết endpoint máy khác thì
// cũng chỉ đánh dấu hộ nó "đã đọc", không moi được nội dung gì.
//
// ⚠️ OFFLINE: biên nhận là THỐNG KÊ, không phải dữ liệu bà con cần. Mất sóng
// thì client bỏ qua (không xếp hàng, không thử lại vòng vòng) và chỉ ghi vào
// bản lưu khi máy chủ ĐÃ xác nhận — nên lần mở app sau có sóng sẽ báo lại.
// Route này KHÔNG được nằm trong API_CACHE_ALLOW của sw.js (là POST, và gắn
// danh tính).
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { createAdminClient } from "@/lib/supabase/admin";

/** Trần một lượt — hộp thư chỉ trả ≤50 tin, xin nhiều hơn là bất thường */
const MAX_IDS = 50;

export async function POST(req: Request) {
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false }, { status: 503 });

  const body = (await req.json().catch(() => null)) as {
    ids?: string[];
    endpoint?: string;
  } | null;
  const ids = Array.isArray(body?.ids)
    ? [...new Set(body.ids.filter((v) => typeof v === "string" && v))].slice(
        0,
        MAX_IDS,
      )
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ ok: false, code: "bad_request" }, { status: 400 });
  }

  /*  AI ĐỌC — lấy từ CHUỖI CỨNG trước, endpoint chỉ là đường lùi cho khách vãng
      lai. `anonymous = true`: đây là đường ghi "đã đọc", không phải cửa quyền —
      khách chưa đăng nhập vẫn phải ghi được (họ nhận thông báo chung qua push).
      Chuỗi bị thu hồi thì vẫn 401 để máy biết mình vừa bị đá. */
  const who = await identityFromRequest(req, true);
  if (!who.ok) return who.res;
  const phone = who.phone || null;

  let reader: string | null = phone ? `sdt:${phone}` : null;
  let accountPhone: string | null = phone;
  if (!reader && body?.endpoint) {
    // Máy đã gắn tài khoản thì vẫn quy được về người, dù phiên hết hạn
    const { data: sub, error: subErr } = await admin
      .from("push_subscriptions")
      .select("customer_phone")
      .eq("endpoint", body.endpoint)
      .maybeSingle();
    if (subErr) return NextResponse.json({ ok: false }, { status: 503 });
    /*  CHỈ NHẬN ENDPOINT CÓ TRONG SỔ (audit P3, 2026-08-18): "đã đọc" là số
        /quan-tri dựa vào; endpoint bịa thì không được đếm. Không có hàng → như
        khách chưa bật thông báo: trả ok, counted 0, client thôi hỏi lại. */
    if (sub) {
      reader = `may:${body.endpoint}`;
      accountPhone =
        (sub as { customer_phone: string | null }).customer_phone ?? null;
    }
  }
  /* Khách chưa đăng nhập VÀ chưa bật thông báo → không có danh tính nào để ghi.
     Trả ok (không phải lỗi của bà con), client coi như xong và thôi hỏi lại. */
  if (!reader) return NextResponse.json({ ok: true, counted: 0 });

  /* ignoreDuplicates: LẦN ĐẦU đọc mới là mốc có nghĩa — mở app lần thứ mười
     không được đẩy read_at trôi theo. Id lạ thì khoá ngoại chặn, cả mẻ hỏng
     chứ không ghi bậy. */
  const { error } = await admin.from("push_reads").upsert(
    ids.map((id) => ({
      message_id: id,
      reader,
      account_phone: accountPhone,
    })),
    { onConflict: "message_id,reader", ignoreDuplicates: true },
  );
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true, counted: ids.length });
}
