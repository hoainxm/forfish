// GET /api/stracking/cua-toi — máy giám sát hành trình S-Tracking CỦA người đang đăng nhập: các máy có SĐT CHỦ TÀU
// = SĐT của phiên (anh Long 06/11: thuyền trưởng không xem giám sát — chỉ ở hồ sơ lao động) (lib/api-identity — KHÔNG nhận SĐT từ máy khách, không tra tàu người khác),
// kèm hạn cước + cảnh báo TRONG NGÀY (giờ VN) + giờ đồng bộ thành công gần nhất + YÊU CẦU GIA HẠN đang chạy
// của từng tàu (DB chung qua sdfish-renewal `list`, đồng hồ 6 s — hỏng/chậm thì `giaHan: null`, không chặn).
// Trả { ok, capNhatLuc, giaHanMo, tau: [...], canhBao: [...], daXoa: [{serial, tenTau}] (máy bà con tự xoá — 0085) }. Chưa đăng nhập 401 · hạ tầng hỏng 503 (máy giữ bản đã lưu).
import { identityFromRequest } from "@/lib/api-identity";
import { createAdminClient } from "@/lib/supabase/admin";
import { dauNgayVnIso } from "@/lib/stracking/dong-bo.mjs";
import { laMayDaBo } from "@/lib/stracking/may-da-bo.mjs";
import { danhDauTenTrung, giaHanCuaTau } from "@/lib/renewal";
import { locMayTheoSdt, sdtTraCuaTaiKhoan, vaiVoiMay } from "@/lib/stracking/sdt-phu";
import { isRenewalConfigured, listRenewalRequests } from "@/lib/renewal-server";

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
  const giaHanMo = await isRenewalConfigured();
  // SĐT chính + SĐT phụ nhân viên gán (0084) — tàu đứng tên SĐT phụ cũng là tàu của tài khoản này.
  const sdts = await sdtTraCuaTaiKhoan(admin, sdt);
  const loc = locMayTheoSdt(sdts);
  if (!loc) return Response.json({ ok: true, capNhatLuc: null, giaHanMo, tau: [], canhBao: [] });

  const [tauR, soR, yeuCau, xoaR] = await Promise.all([
    admin
      .from("stracking_thiet_bi")
      .select("serial, imei, ten_tau, chu_tau, sdt_chu_tau, thuyen_truong, sdt_thuyen_truong, dang_ky_luc, het_han, tam_ngung_tu, tam_ngung_den, trong_bo, dong_bo_tcts, nhom, tao_luc, cap_nhat_nguon, dong_bo_luc")
      .or(loc)
      .order("het_han", { ascending: true, nullsFirst: false })
      .limit(TRAN_TAU),
    admin.from("stracking_lan_dong_bo").select("luc").eq("trang_thai", "ok").order("luc", { ascending: false }).limit(1),
    giaHanMo ? listRenewalRequests(sdt, GIA_HAN_MS) : Promise.resolve(null),
    // Máy bà con tự "xoá" (0085) — theo mọi SĐT của tài khoản. Hỏng ⇒ coi như chưa xoá máy nào (log), không chặn thẻ.
    admin.from("stracking_an").select("serial").in("sdt", sdts),
  ]);
  if (xoaR.error) console.error("[stracking] đọc máy đã xoá hỏng:", xoaR.error.message);
  const daXoa = new Set((xoaR.data ?? []).map((x) => x.serial as string));
  const nowMs = Date.now();
  // Máy đã huỷ / thu hồi (tên DE…/Thu…, nhóm DELETE) hoặc bỏ đọng (>1 năm không cập nhật + hết hạn) — lib/stracking/may-da-bo
  // — KHÔNG hiện: bà con không còn máy đó.
  const conMay = (tauR.data ?? []).filter(
    (t) =>
      !laMayDaBo(
        {
          ten_tau: t.ten_tau as string | null,
          nhom: t.nhom as string | null,
          cap_nhat_nguon: t.cap_nhat_nguon as string | null,
          het_han: t.het_han as string | null,
        },
        nowMs,
      ),
  );
  // Bà con tự xoá ⇒ không hiện; trả riêng tên để thẻ có "Hiện lại".
  const conDung = conMay.filter((t) => !daXoa.has(t.serial as string));
  const mayDaXoa = conMay
    .filter((t) => daXoa.has(t.serial as string))
    .map((t) => ({ serial: t.serial as string, tenTau: (t.ten_tau as string | null) ?? null }));
  // Ghép yêu cầu ↔ máy theo SERIAL; yêu cầu cũ chưa có serial thì theo tên, nhưng KHÔNG khi tên trùng trong máy của SĐT này.
  const tenTrung = new Map(
    danhDauTenTrung(conDung.map((t) => ({ serial: t.serial as string, tenTau: (t.ten_tau as string | null) ?? null }))).map(
      (m) => [m.serial, m.tenTrung],
    ),
  );
  if (tauR.error) {
    console.error("[stracking] đọc máy hỏng:", tauR.error.message);
    return Response.json({ ok: false, code: "unavailable" }, { status: 503 });
  }
  const tau = conDung.map((t) => ({
    serial: t.serial as string,
    imei: (t.imei as string | null) ?? null,
    tenTau: (t.ten_tau as string | null) ?? null,
    chuTau: (t.chu_tau as string | null) ?? null,
    // Vai của người xem với máy này — chỉ để chữ; SĐT người kia KHÔNG trả về.
    vai: vaiVoiMay(t.sdt_chu_tau as string | null, sdts),
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
    giaHan: yeuCau
      ? giaHanCuaTau(
          yeuCau,
          { serial: t.serial as string, tenTau: (t.ten_tau as string | null) ?? null, tenTrung: tenTrung.get(t.serial as string) ?? false },
          (t.het_han as string | null) ?? null,
          nowMs,
        )
      : null,
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
      // Cảnh báo S-Tracking đã hết (biến khỏi danh sách đang mở) ⇒ route nhap đóng (da_dong_luc, migration 0082) ⇒ không hiện.
      .is("da_dong_luc", null)
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
    { ok: true, capNhatLuc: (soR.data?.[0]?.luc as string | undefined) ?? null, giaHanMo, tau, canhBao, daXoa: mayDaXoa },
    { headers: { "cache-control": "private, no-store" } },
  );
}
