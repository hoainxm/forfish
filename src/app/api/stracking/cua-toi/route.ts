// GET /api/stracking/cua-toi — máy giám sát hành trình S-Tracking CỦA người đang đăng nhập: các máy có SĐT chủ tàu
// HOẶC SĐT thuyền trưởng = SĐT của phiên (lib/api-identity — KHÔNG nhận SĐT từ máy khách, không tra tàu người khác),
// kèm hạn cước + cảnh báo TRONG NGÀY (giờ VN) + giờ đồng bộ thành công gần nhất + YÊU CẦU GIA HẠN đang chạy
// của từng tàu (DB chung qua sdfish-renewal `list`, đồng hồ 6 s — hỏng/chậm thì `giaHan: null`, không chặn).
// Trả { ok, capNhatLuc, giaHanMo, tau: [...], canhBao: [...] }. Chưa đăng nhập 401 · hạ tầng hỏng 503 (máy giữ bản đã lưu).
import { identityFromRequest } from "@/lib/api-identity";
import { createAdminClient } from "@/lib/supabase/admin";
import { dauNgayVnIso } from "@/lib/stracking/dong-bo.mjs";
import { giaHanCuaTau, isRenewalConfigured, listRenewalRequests } from "@/lib/renewal";

export const dynamic = "force-dynamic";

const TRAN_TAU = 30;
const TRAN_CANH_BAO = 60;
const GIA_HAN_MS = 6000;

export async function GET(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  const admin = createAdminClient();
  if (!admin) return Response.json({ ok: false, code: "unavailable" }, { status: 503 });
  const sdt = who.phone;
  if (!/^0[1-9]\d{8}$/.test(sdt)) return Response.json({ ok: true, capNhatLuc: null, giaHanMo: isRenewalConfigured(), tau: [], canhBao: [] });

  const giaHanMo = isRenewalConfigured();
  const [tauR, soR, yeuCau] = await Promise.all([
    admin
      .from("stracking_thiet_bi")
      .select("serial, imei, ten_tau, chu_tau, sdt_chu_tau, thuyen_truong, sdt_thuyen_truong, dang_ky_luc, het_han, tam_ngung_tu, tam_ngung_den, trong_bo, dong_bo_tcts, nhom, tao_luc, cap_nhat_nguon, dong_bo_luc")
      .or(`sdt_chu_tau.eq.${sdt},sdt_thuyen_truong.eq.${sdt}`)
      .order("het_han", { ascending: true, nullsFirst: false })
      .limit(TRAN_TAU),
    admin.from("stracking_lan_dong_bo").select("luc").eq("trang_thai", "ok").order("luc", { ascending: false }).limit(1),
    giaHanMo ? listRenewalRequests(sdt, GIA_HAN_MS) : Promise.resolve(null),
  ]);
  const nowMs = Date.now();
  if (tauR.error) {
    console.error("[stracking] đọc máy hỏng:", tauR.error.message);
    return Response.json({ ok: false, code: "unavailable" }, { status: 503 });
  }
  const tau = (tauR.data ?? []).map((t) => ({
    serial: t.serial as string,
    imei: (t.imei as string | null) ?? null,
    tenTau: (t.ten_tau as string | null) ?? null,
    chuTau: (t.chu_tau as string | null) ?? null,
    // Vai của người xem với máy này — chỉ để chữ; SĐT người kia KHÔNG trả về.
    vai: t.sdt_chu_tau === sdt ? "chu-tau" : "thuyen-truong",
    dangKyLuc: (t.dang_ky_luc as string | null) ?? null,
    hetHan: (t.het_han as string | null) ?? null,
    tamNgungTu: (t.tam_ngung_tu as string | null) ?? null,
    tamNgungDen: (t.tam_ngung_den as string | null) ?? null,
    trongBo: (t.trong_bo as boolean | null) ?? null,
    // Anh Long 05/11 "quan trọng": đồng bộ Tổng cục ("Thành công"/"Thất bại"), nhóm, ngày tạo, ngày cập nhật (migration 0081).
    dongBoTcts: (t.dong_bo_tcts as string | null) ?? null,
    nhom: (t.nhom as string | null) ?? null,
    taoLuc: (t.tao_luc as string | null) ?? null,
    capNhatNguon: (t.cap_nhat_nguon as string | null) ?? null,
    // null = không có yêu cầu đang chạy HOẶC không tra được (máy khách không phân biệt — nút Gia hạn vẫn hiện,
    // máy chủ /api/renewal/request vẫn tự chặn trùng).
    giaHan: yeuCau ? giaHanCuaTau(yeuCau, t.ten_tau as string | null, (t.het_han as string | null) ?? null, nowMs) : null,
  }));

  let canhBao: { imei: string; tenTau: string | null; muc: string | null; loai: string; luc: string }[] = [];
  const imeis = tau.map((t) => t.imei).filter((x): x is string => !!x);
  if (imeis.length) {
    // CHỈ trong ngày giờ VN (anh Long 05/11: "cái nào trong ngày thôi").
    const tu = dauNgayVnIso();
    const cbR = await admin
      .from("stracking_canh_bao")
      .select("imei, ten_tau, muc, loai, luc")
      .in("imei", imeis)
      .gte("luc", tu)
      .order("luc", { ascending: false })
      .limit(TRAN_CANH_BAO);
    if (cbR.error) console.error("[stracking] đọc cảnh báo hỏng:", cbR.error.message);
    else
      canhBao = (cbR.data ?? []).map((c) => ({
        imei: c.imei as string,
        tenTau: (c.ten_tau as string | null) ?? null,
        muc: (c.muc as string | null) ?? null,
        loai: c.loai as string,
        luc: c.luc as string,
      }));
  }

  return Response.json(
    { ok: true, capNhatLuc: (soR.data?.[0]?.luc as string | undefined) ?? null, giaHanMo, tau, canhBao },
    { headers: { "cache-control": "private, no-store" } },
  );
}
