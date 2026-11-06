// POST /api/stracking/nhap — MÁY GPU (scripts/stracking-dong-bo.mjs, 07:30·12:20·17:20·21:00) gửi hạn cước + cảnh báo
// S-Tracking. Cửa: `x-stracking-key` (lib/stracking/khoa). Thân gzip (máy thu gửi `content-encoding: gzip`; thân thường
// vẫn nhận). Máy chủ KIỂM LẠI từng hàng bằng cùng hàm (lib/stracking/dong-bo kiemGoiNhap) rồi:
//   - upsert `stracking_thiet_bi` theo serial (máy thu chỉ gửi hồ sơ ĐỔI so với lần trước),
//   - thêm `stracking_canh_bao` (trùng khoá imei+loại+giờ ⇒ bỏ qua), xoá cảnh báo > 2 ngày,
//   - cảnh báo VỪA CHÈN ⇒ "cảnh báo thông minh" (lib/stracking/thong-bao): chống lặp 6 giờ, gộp 1 tin/SĐT, Báo động ⇒
//     hộp thư + Web Push, Cảnh cáo ⇒ chỉ hộp thư, trần 400 tin/lượt,
//   - ghi một dòng `stracking_lan_dong_bo` (kể cả gói báo "het-phien"/"loi" không kèm dữ liệu), xoá sổ > 90 ngày.
// Gói: { luc, trangThai: "ok"|"het-phien"|"loi", loi?, tong?, thietBi[], canhBao[] }. Bảng độc lập luồng SDWork.
import { gunzipSync } from "node:zlib";
import { createAdminClient } from "@/lib/supabase/admin";
import { strackingKeyDenied } from "@/lib/stracking/khoa";
import { kiemGoiNhap } from "@/lib/stracking/dong-bo.mjs";
import {
  TRA_LUI_MS,
  chiaTinChoSdtPhu,
  ghepNhac,
  khoaXoa,
  khoaXoaTen,
  locNhacDaXoa,
  gomTinTau,
  STRACKING_PUSH_SENT_BY,
  tinHetCanhBao,
  urlTinTau,
  type CanhBaoMoi,
  type Nhac,
  type TauCuaImei,
  type TinTau,
} from "@/lib/stracking/thong-bao";
import { chinhCuaSdtPhu, ganSdtThem, phuCuaCacSdt } from "@/lib/sdt-khac";
import { isPushConfigured, sendPushMany, type PushFanoutRow } from "@/lib/push-send";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TRAN_GIAI_NEN = 30 * 1024 * 1024;
const LO_GHI = 1000;
// Anh Long 05/11: "cái nào trong ngày thôi" — cảnh báo chỉ cần hôm nay + hôm qua (đủ cho chống lặp 6 giờ qua nửa đêm).
const GIU_CANH_BAO_NGAY = 2;
const GIU_SO_NGAY = 90;

async function docThan(req: Request): Promise<unknown> {
  try {
    const buf = Buffer.from(await req.arrayBuffer());
    const nen = /gzip/i.test(req.headers.get("content-encoding") ?? "");
    const raw = nen ? gunzipSync(buf, { maxOutputLength: TRAN_GIAI_NEN }) : buf;
    return JSON.parse(raw.toString("utf8"));
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const denied = await strackingKeyDenied(req);
  if (denied) return denied;
  const r = kiemGoiNhap(await docThan(req));
  if (!r.ok || !r.goi) return Response.json({ ok: false, code: r.code ?? "bad_body" }, { status: 400 });
  const admin = createAdminClient();
  if (!admin) return Response.json({ ok: false, code: "store_down" }, { status: 503 });
  const { goi } = r;
  const now = new Date().toISOString();

  // Hồ sơ trước, cảnh báo sau; lô nào hỏng ⇒ 503 để máy thu GIỮ dấu "chưa gửi" và gửi lại lượt sau.
  for (let i = 0; i < goi.thietBi.length; i += LO_GHI) {
    const lo = goi.thietBi.slice(i, i + LO_GHI).map((t: Record<string, unknown>) => ({ ...t, dong_bo_luc: now }));
    const { error } = await admin.from("stracking_thiet_bi").upsert(lo, { onConflict: "serial" });
    if (error) {
      console.error("[stracking] ghi thiết bị hỏng:", error.message);
      return Response.json({ ok: false, code: "store_down" }, { status: 503 });
    }
  }
  // Trạng thái KẾT NỐI thật (báo cáo mất kết nối S-Tracking) — chỉ máy đã có trong kho, máy vắng không đụng. Hỏng chỉ log.
  if (Array.isArray(goi.ketNoi) && goi.ketNoi.length) await ghiKetNoi(admin, goi.ketNoi as KetNoi[], goi.luc);
  // `select` sau upsert bỏ-qua-trùng trả về ĐÚNG các hàng vừa chèn ⇒ cảnh báo mới (đã có thì không báo lại).
  const moiChen: CanhBaoMoi[] = [];
  for (let i = 0; i < goi.canhBao.length; i += LO_GHI) {
    const lo = goi.canhBao.slice(i, i + LO_GHI);
    const { data, error } = await admin
      .from("stracking_canh_bao")
      .upsert(lo, { onConflict: "imei,loai,luc", ignoreDuplicates: true })
      .select("imei,loai,luc,muc");
    if (error) {
      console.error("[stracking] ghi cảnh báo hỏng:", error.message);
      return Response.json({ ok: false, code: "store_down" }, { status: 503 });
    }
    moiChen.push(...((data ?? []) as CanhBaoMoi[]));
  }
  // Máy bà con đã "xoá" (0085) ⇒ không cảnh báo / nhắc / "đã hết" cho SĐT đó.
  const daXoa = await docDaXoa(admin);
  const { nhac: soNhac, nhacSdt, nhacSdtBo, ...thongBao } = await baoCanhBaoMoi(admin, moiChen, (goi.nhac ?? []) as Nhac[], daXoa);
  // Cảnh báo đã CLEAR (biến khỏi danh sách đang mở của S-Tracking) ⇒ đóng + tin "đã hết cảnh báo". Chỉ khi máy thu đọc
  // ĐỦ danh sách (gửi `dangMo`); vắng ⇒ không đóng gì.
  const dong = Array.isArray(goi.dangMo) ? await dongCanhBaoDaClear(admin, goi.dangMo as { imei: string; loai: string; luc: string }[], daXoa) : null;

  // Sổ + dọn: hỏng chỉ log — dữ liệu đã ghi ở trên.
  const { error: eSo } = await admin.from("stracking_lan_dong_bo").insert({
    luc: goi.luc,
    trang_thai: goi.trangThai,
    loi: goi.loi,
    tong: goi.tong,
    so_thiet_bi: goi.thietBi.length,
    so_canh_bao: goi.canhBao.length,
  });
  if (eSo) console.error("[stracking] ghi sổ hỏng:", eSo.message);
  const cuCb = new Date(Date.now() - GIU_CANH_BAO_NGAY * 86_400_000).toISOString();
  const cuSo = new Date(Date.now() - GIU_SO_NGAY * 86_400_000).toISOString();
  const [{ error: eDonCb }, { error: eDonSo }] = await Promise.all([
    admin.from("stracking_canh_bao").delete().lt("luc", cuCb),
    admin.from("stracking_lan_dong_bo").delete().lt("nhan_luc", cuSo),
  ]);
  if (eDonCb || eDonSo) console.error("[stracking] dọn cũ hỏng:", eDonCb?.message ?? eDonSo?.message);

  // `ghi.nhac` là SỐ chỉ khi nhắc đã vào hộp thư — máy GPU dựa vào đó đánh dấu đã nhắc (null ⇒ giữ lại, gửi lượt sau).
  // `nhacSdt` = SĐT đã nhận; `nhacSdtBo` = vượt trần lượt này (máy GPU KHÔNG được đánh dấu nhóm này).
  return Response.json({
    ok: true,
    ghi: { thietBi: goi.thietBi.length, canhBao: goi.canhBao.length, boQua: r.boQua, nhac: soNhac, nhacSdt, nhacSdtBo },
    thongBao,
    dong,
  });
}

const khoaCb = (c: { imei: string; loai: string; luc: string }) => `${c.imei}|${c.loai}|${Date.parse(c.luc)}`;

/**
 * Đóng mọi cảnh báo MỞ trong DB mà khoá (imei+loại+giờ) không còn trong bộ `dangMo` máy thu vừa đọc đủ; `[]` ⇒ đóng hết.
 * Rồi báo "đã hết cảnh báo" theo MÁY (máy hết sạch khoá mở) cho SĐT mà tin S-Tracking gần nhất hôm nay vẫn là tin
 * CẢNH BÁO (chưa đóng) — giờ "Thời gian cập nhật" của S-Tracking có thể nhích (khoá cũ đóng, khoá mới chèn) nên không
 * xét theo từng khoá. Best-effort: hỏng chỉ log.
 */
async function dongCanhBaoDaClear(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  dangMo: { imei: string; loai: string; luc: string }[],
  daXoa: ReadonlySet<string>,
): Promise<{ dong: number; tin: number; day: number }> {
  const kq = { dong: 0, tin: 0, day: 0 };
  try {
    const conMoKhoa = new Set(dangMo.map(khoaCb));
    const conMoImei = new Set(dangMo.map((c) => c.imei));
    const moDb: ({ imei: string; loai: string; luc: string } & Record<string, unknown>)[] = [];
    for (let tu = 0; ; tu += 1000) {
      const { data, error } = await admin.from("stracking_canh_bao").select("*").is("da_dong_luc", null).range(tu, tu + 999);
      if (error) throw error;
      moDb.push(...((data ?? []) as typeof moDb));
      if (!data || data.length < 1000) break;
    }
    const nowIso = new Date().toISOString();
    const canDong = moDb
      .filter((c) => !conMoKhoa.has(khoaCb(c)))
      .map((c) => ({ ...c, da_dong_luc: nowIso }));
    for (let i = 0; i < canDong.length; i += LO_GHI) {
      const { error } = await admin.from("stracking_canh_bao").upsert(canDong.slice(i, i + LO_GHI), { onConflict: "imei,loai,luc" });
      if (error) throw error;
    }
    kq.dong = canDong.length;
    // máy HẾT SẠCH cảnh báo mở
    const imeiHet = [...new Set(canDong.map((c) => c.imei))].filter((imei) => !conMoImei.has(imei));
    if (!imeiHet.length) return kq;

    const tau: TauCuaImei[] = [];
    for (let i = 0; i < imeiHet.length; i += LO_TRA) {
      const { data, error } = await admin
        .from("stracking_thiet_bi")
        .select("imei,serial,ten_tau,sdt_chu_tau,sdt_thuyen_truong")
        .in("imei", imeiHet.slice(i, i + LO_TRA));
      if (error) throw error;
      tau.push(...((data ?? []) as TauCuaImei[]));
    }
    // NGƯỜI NHẬN = SĐT trên máy + tài khoản gán SĐT đó làm SĐT phụ (0084). Mỗi người nhận ⇒ MỌI máy của họ (cả máy của
    // SĐT phụ của họ) để chỉ báo "đã hết" khi KHÔNG còn tàu nào của họ đang cảnh báo (anh Long 05/11: "cảnh báo phải chuẩn").
    // Chỉ CHỦ TÀU nhận tin (anh Long 06/11) — thuyền trưởng không.
    const sdtMay = [...new Set(tau.map((t) => t.sdt_chu_tau).filter((p): p is string => !!p))];
    const chinhCuaPhu = await chinhCuaSdtPhu(admin, sdtMay);
    const nguoiNhan = [...new Set([...sdtMay, ...[...chinhCuaPhu.values()].flat()])];
    const phuCua = await phuCuaCacSdt(admin, nguoiNhan);
    const sdtTraMay = [...new Set([...nguoiNhan, ...[...phuCua.values()].flat()])];
    const homNay = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
    const dauNgay = new Date(Date.parse(`${homNay}T00:00:00+07:00`)).toISOString();
    for (let i = 0; i < sdtTraMay.length; i += LO_TRA) {
      const lo = sdtTraMay.slice(i, i + LO_TRA);
      const { data: may, error } = await admin
        .from("stracking_thiet_bi")
        .select("imei,serial,ten_tau,sdt_chu_tau,sdt_thuyen_truong")
        .in("sdt_chu_tau", lo);
      // Thiếu danh sách máy ⇒ có thể báo "đã hết" sai ⇒ dừng, không gửi (lượt sau tính lại).
      if (error) throw error;
      for (const m of (may ?? []) as TauCuaImei[]) if (!tau.some((t) => t.imei === m.imei)) tau.push(m);
    }
    const daBao = new Set<string>();
    for (let i = 0; i < nguoiNhan.length; i += LO_TRA) {
      const { data: tin } = await admin
        .from("push_messages")
        .select("target_phone,title,created_at")
        .eq("sent_by", STRACKING_PUSH_SENT_BY)
        .in("target_phone", nguoiNhan.slice(i, i + LO_TRA))
        .gte("created_at", dauNgay)
        .order("created_at", { ascending: false });
      const gapRoi = new Set<string>();
      for (const m of tin ?? []) {
        const p = m.target_phone as string;
        if (gapRoi.has(p)) continue; // chỉ xét tin MỚI NHẤT
        gapRoi.add(p);
        if (!/đã hết cảnh báo$/.test(m.title as string)) daBao.add(p);
      }
    }
    const tinDong = tinHetCanhBao(imeiHet.map((imei) => ({ imei, luc: nowIso })), ganSdtThem(tau, phuCua), conMoImei, daBao, daXoa);
    // Đã tính đủ người nhận ở trên ⇒ KHÔNG nhân tin cho SĐT phụ lần nữa.
    const r = await guiTin(admin, tinDong, false);
    kq.tin = r.tin;
    kq.day = r.day;
  } catch (e) {
    console.error("[stracking] đóng cảnh báo hỏng:", e instanceof Error ? e.message : e);
  }
  console.log(`[stracking] đóng ${kq.dong} cảnh báo ⇒ ${kq.tin} tin đã hết, đẩy ${kq.day}`);
  return kq;
}

const LO_TRA = 300;

interface KetNoi {
  serial: string;
  /** đang mất tín hiệu từ (null = không đang mất) */
  matTu: string | null;
  /** đợt mất gần nhất có lại lúc */
  coLai: string | null;
}

/**
 * Ghi trạng thái kết nối (anh Long 06/11 "fix hết đi" — vụ GL-99280: thẻ ghi "cập nhật 06:45" là giờ sửa BẢN GHI S-Tracking,
 * bị hiểu thành "6 giờ không tín hiệu"). Chỉ máy ĐÃ CÓ trong kho (upsert gộp cột, không tạo hàng mới); `ket_noi_kiem_luc` =
 * giờ máy GPU kiểm. Hỏng ⇒ log, không 503 (dữ liệu chính đã ghi).
 */
async function ghiKetNoi(admin: NonNullable<ReturnType<typeof createAdminClient>>, ketNoi: KetNoi[], luc: string): Promise<void> {
  try {
    const theoSerial = new Map(ketNoi.filter((k) => k && typeof k.serial === "string").map((k) => [k.serial, k]));
    const serials = [...theoSerial.keys()];
    const coThat: string[] = [];
    for (let i = 0; i < serials.length; i += LO_TRA) {
      const { data, error } = await admin.from("stracking_thiet_bi").select("serial").in("serial", serials.slice(i, i + LO_TRA));
      if (error) throw error;
      coThat.push(...(data ?? []).map((d) => d.serial as string));
    }
    const hang = coThat.map((serial) => {
      const k = theoSerial.get(serial)!;
      return { serial, mat_ket_noi_tu: k.matTu ?? null, co_lai_luc: k.coLai ?? null, ket_noi_kiem_luc: luc };
    });
    for (let i = 0; i < hang.length; i += LO_GHI) {
      const { error } = await admin.from("stracking_thiet_bi").upsert(hang.slice(i, i + LO_GHI), { onConflict: "serial" });
      if (error) throw error;
    }
  } catch (e) {
    console.error("[stracking] ghi kết nối hỏng:", e instanceof Error ? e.message : e);
  }
}

/**
 * Chỉ giữ nhắc gửi CHỦ TÀU của máy (anh Long 06/11: "chủ tàu mới xem giám sát, thuyền trưởng nếu có chỉ là trong hồ sơ
 * lao động thôi"). Nhắc có serial ⇒ so SĐT chủ tàu trên máy; chưa có serial ⇒ so theo tên tàu. Tra hỏng ⇒ giữ nguyên
 * (thà nhắc thừa một lượt còn hơn mất nhắc mất kết nối của chủ tàu).
 */
async function chiNhacChuTau(admin: NonNullable<ReturnType<typeof createAdminClient>>, nhac: Nhac[]): Promise<Nhac[]> {
  if (!nhac.length) return nhac;
  try {
    const sdts = [...new Set(nhac.map((n) => n.sdt))];
    const cua = new Set<string>();
    for (let i = 0; i < sdts.length; i += LO_TRA) {
      const { data, error } = await admin.from("stracking_thiet_bi").select("serial,ten_tau,sdt_chu_tau").in("sdt_chu_tau", sdts.slice(i, i + LO_TRA));
      if (error) throw error;
      for (const t of data ?? []) {
        cua.add(khoaXoa(t.sdt_chu_tau as string, t.serial as string));
        if (t.ten_tau) cua.add(khoaXoaTen(t.sdt_chu_tau as string, t.ten_tau as string));
      }
    }
    return nhac.filter((n) => (n.serial ? cua.has(khoaXoa(n.sdt, n.serial)) : cua.has(khoaXoaTen(n.sdt, n.tau))));
  } catch (e) {
    console.error("[stracking] lọc nhắc chủ tàu hỏng:", e instanceof Error ? e.message : e);
    return nhac;
  }
}

/**
 * Máy bà con đã "xoá" (stracking_an, 0085) ⇒ tập khoá `sdt|serial` + `sdt|t:tên tàu` (nhắc chưa có serial).
 * Hỏng ⇒ tập rỗng + log: thà báo thừa một lượt còn hơn chặn cả cảnh báo SOS.
 */
async function docDaXoa(admin: NonNullable<ReturnType<typeof createAdminClient>>): Promise<Set<string>> {
  const out = new Set<string>();
  try {
    const hang: { sdt: string; serial: string }[] = [];
    for (let tu = 0; ; tu += 1000) {
      const { data, error } = await admin.from("stracking_an").select("sdt,serial").range(tu, tu + 999);
      if (error) throw error;
      hang.push(...((data ?? []) as { sdt: string; serial: string }[]));
      if (!data || data.length < 1000) break;
    }
    const tenCua = new Map<string, string>();
    const serials = [...new Set(hang.map((h) => h.serial))];
    for (let i = 0; i < serials.length; i += LO_TRA) {
      const { data } = await admin.from("stracking_thiet_bi").select("serial,ten_tau").in("serial", serials.slice(i, i + LO_TRA));
      for (const t of data ?? []) if (t.ten_tau) tenCua.set(t.serial as string, t.ten_tau as string);
    }
    for (const h of hang) {
      out.add(khoaXoa(h.sdt, h.serial));
      const ten = tenCua.get(h.serial);
      if (ten) out.add(khoaXoaTen(h.sdt, ten));
    }
  } catch (e) {
    console.error("[stracking] đọc máy đã xoá hỏng:", e instanceof Error ? e.message : e);
  }
  return out;
}

/**
 * Cảnh báo MỚI ⇒ hộp thư (push_messages, target account) + Web Push, gộp 1 tin/SĐT (luật ở lib/stracking/thong-bao).
 * Best-effort: hỏng chỉ log, KHÔNG làm 503 — dữ liệu đã ghi xong, 503 sẽ khiến máy thu gửi lại cả lô.
 * nợ: không cập nhật cột `sent` từng tin (đếm tổng ở log) — đủ khi cần soi thống kê đẩy ở /quan-tri thì ghi theo id.
 */
async function baoCanhBaoMoi(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  moiChen: CanhBaoMoi[],
  nhacGoc: Nhac[],
  daXoa: ReadonlySet<string>,
): Promise<{
  tin: number;
  may: number;
  day: number;
  /** số DÒNG nhắc đã vào hộp thư — null = chưa ghi được (máy GPU giữ lại, gửi lượt sau) */
  nhac: number | null;
  nhacSdt: string[];
  nhacSdtBo: string[];
}> {
  // Nhắc của máy đã xoá + nhắc gửi THUYỀN TRƯỞNG (không phải chủ tàu): bỏ, nhưng VẪN tính là đã xử lý (máy GPU đánh
  // dấu, khỏi gửi lại mãi).
  const nhac = locNhacDaXoa(await chiNhacChuTau(admin, nhacGoc), daXoa);
  const kq = { tin: 0, may: 0, day: 0, nhac: nhacGoc.length ? null : 0, nhacSdt: [] as string[], nhacSdtBo: [] as string[] };
  // Tin cảnh báo (hỏng ⇒ vẫn gửi nhắc)
  let tinCanhBao: TinTau[] = [];
  if (moiChen.length) tinCanhBao = await tinTuCanhBao(admin, moiChen, daXoa);
  if (!tinCanhBao.length && !nhac.length) return { ...kq, nhac: nhacGoc.length };
  try {
    const g = ghepNhac(tinCanhBao, nhac);
    Object.assign(kq, await guiTin(admin, g.tin));
    // guiTin ném khi ghi hộp thư hỏng ⇒ tới đây là nhắc đã vào hộp thư
    kq.nhac = g.soDongNhac + (nhacGoc.length - nhac.length);
    kq.nhacSdt = g.nhacSdt;
    kq.nhacSdtBo = g.nhacSdtBo;
  } catch (e) {
    console.error("[stracking] gửi thông báo hỏng:", e instanceof Error ? e.message : e);
  }
  console.log(
    `[stracking] cảnh báo mới ${moiChen.length}, nhắc ${nhac.length} dòng ⇒ ${kq.tin} tin, đẩy ${kq.day}/${kq.may} máy` +
      (kq.nhacSdtBo.length ? `, ${kq.nhacSdtBo.length} SĐT nhắc vượt trần (lượt sau)` : ""),
  );
  return kq;
}

/** Cảnh báo vừa chèn ⇒ tin gộp (chống lặp 6 giờ). Hỏng ⇒ [] + log (nhắc vẫn đi). */
async function tinTuCanhBao(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  moiChen: CanhBaoMoi[],
  daXoa: ReadonlySet<string>,
): Promise<TinTau[]> {
  try {
    const imeis = [...new Set(moiChen.map((c) => c.imei))];
    const tau: TauCuaImei[] = [];
    for (let i = 0; i < imeis.length; i += LO_TRA) {
      const { data, error } = await admin
        .from("stracking_thiet_bi")
        .select("imei,serial,ten_tau,sdt_chu_tau,sdt_thuyen_truong,trong_bo") // trong bờ ⇒ mức cảnh báo (muc-canh-bao)
        .in("imei", imeis.slice(i, i + LO_TRA));
      if (error) throw error;
      tau.push(...((data ?? []) as TauCuaImei[]));
    }
    // Cảnh báo ĐÃ CÓ trước lượt này của cùng máy (chống lặp 6 giờ) — loại đúng các hàng vừa chèn.
    const nowMs = Date.now();
    // Lịch sử 2 ngày để tính lại chuỗi ĐÃ BÁO (chống lặp theo mức, dài nhất 24 giờ).
    const tu = new Date(nowMs - TRA_LUI_MS).toISOString();
    const khoaMoi = new Set(moiChen.map((c) => `${c.imei}|${c.loai}|${Date.parse(c.luc)}`));
    const truoc: CanhBaoMoi[] = [];
    for (let i = 0; i < imeis.length; i += LO_TRA) {
      const { data, error } = await admin
        .from("stracking_canh_bao")
        .select("imei,loai,luc,muc")
        .in("imei", imeis.slice(i, i + LO_TRA))
        .gte("luc", tu);
      if (error) throw error;
      for (const p of (data ?? []) as CanhBaoMoi[]) if (!khoaMoi.has(`${p.imei}|${p.loai}|${Date.parse(p.luc)}`)) truoc.push(p);
    }
    return gomTinTau(moiChen, tau, nowMs, truoc, daXoa);
  } catch (e) {
    console.error("[stracking] tính tin cảnh báo hỏng:", e instanceof Error ? e.message : e);
    return [];
  }
}

/** Ghi hộp thư (push_messages, target account) TRƯỚC — lưới an toàn khi đẩy hụt / mất sóng — rồi Web Push cho tin `day`.
 *  Ném lỗi khi ghi hộp thư hỏng (caller nuốt + log). Tin được nhân thêm cho tài khoản có SĐT phụ trùng SĐT trên máy. */
async function guiTin(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  tinMay: TinTau[],
  chiaSdtPhu = true,
): Promise<{ tin: number; may: number; day: number }> {
  const kq = { tin: 0, may: 0, day: 0 };
  if (!tinMay.length) return kq;
  // SĐT phụ (0084): tài khoản gán SĐT trên máy làm SĐT phụ cũng nhận tin cảnh báo + nhắc. Tra hỏng ⇒ như cũ.
  // Tin "đã hết cảnh báo" tự tính người nhận (dongCanhBaoDaClear) ⇒ chiaSdtPhu=false.
  const tin = chiaSdtPhu ? chiaTinChoSdtPhu(tinMay, await chinhCuaSdtPhu(admin, tinMay.map((t) => t.phone))) : tinMay;

  const subs = new Map<string, PushFanoutRow[]>();
  const phones = tin.map((t) => t.phone);
  for (let i = 0; i < phones.length; i += LO_TRA) {
    const { data } = await admin
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth_key,customer_phone")
      .in("customer_phone", phones.slice(i, i + LO_TRA));
    for (const s of data ?? []) {
      const ds = subs.get(s.customer_phone as string) ?? [];
      ds.push({ id: s.id as string, endpoint: s.endpoint, p256dh: s.p256dh, authKey: s.auth_key });
      subs.set(s.customer_phone as string, ds);
    }
  }

  // Hộp thư TRƯỚC (lưới an toàn khi đẩy hụt / mất sóng), rồi mới đẩy.
  const { data: ghi, error: eGhi } = await admin
    .from("push_messages")
    .insert(
      tin.map((t) => ({
        title: t.title, body: t.body, url: urlTinTau(t), target: "account", target_phone: t.phone,
        sent_by: STRACKING_PUSH_SENT_BY, devices: t.day ? subs.get(t.phone)?.length ?? 0 : 0, sent: 0,
      })),
    )
    .select("id,target_phone");
  if (eGhi) throw eGhi;
  kq.tin = tin.length;
  const idTheoSdt = new Map((ghi ?? []).map((g) => [g.target_phone as string, g.id as string]));

  if (!(await isPushConfigured())) return kq;
  const sentAt = new Date().toISOString();
  const chet: string[] = [];
  await Promise.all(
    tin
      .filter((t) => t.day && subs.has(t.phone)) // Cảnh cáo chỉ nằm hộp thư, không đánh thức máy
      .map(async (t) => {
        const rows = subs.get(t.phone)!;
        kq.may += rows.length;
        const r = await sendPushMany(rows, { title: t.title, body: t.body, url: urlTinTau(t), sentAt, messageId: idTheoSdt.get(t.phone) ?? null, tag: t.tag });
        kq.day += r.sent;
        chet.push(...r.goneIds);
      }),
  );
  if (chet.length) await admin.from("push_subscriptions").delete().in("id", chet);
  return kq;
}
