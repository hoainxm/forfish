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
  CHONG_LAP_MS,
  CUA_SO_MS,
  gomTinTau,
  STRACKING_PUSH_SENT_BY,
  tinHetCanhBao,
  type CanhBaoMoi,
  type TauCuaImei,
  type TinTau,
} from "@/lib/stracking/thong-bao";
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
  const thongBao = await baoCanhBaoMoi(admin, moiChen);
  // Cảnh báo đã CLEAR (biến khỏi danh sách đang mở của S-Tracking) ⇒ đóng + tin "đã hết cảnh báo". Chỉ khi máy thu đọc
  // ĐỦ danh sách (gửi `dangMo`); vắng ⇒ không đóng gì.
  const dong = Array.isArray(goi.dangMo) ? await dongCanhBaoDaClear(admin, goi.dangMo as { imei: string; loai: string; luc: string }[]) : null;

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

  return Response.json({ ok: true, ghi: { thietBi: goi.thietBi.length, canhBao: goi.canhBao.length, boQua: r.boQua }, thongBao, dong });
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
    // SĐT liên quan ⇒ mọi máy của họ (để biết còn tàu nào đang cảnh báo) + tin gần nhất hôm nay
    const phones = [...new Set(tau.flatMap((t) => [t.sdt_chu_tau, t.sdt_thuyen_truong]).filter((p): p is string => !!p))];
    const homNay = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
    const dauNgay = new Date(Date.parse(`${homNay}T00:00:00+07:00`)).toISOString();
    const daBao = new Set<string>();
    for (let i = 0; i < phones.length; i += LO_TRA) {
      const lo = phones.slice(i, i + LO_TRA);
      const [{ data: may }, { data: tin }] = await Promise.all([
        admin
          .from("stracking_thiet_bi")
          .select("imei,serial,ten_tau,sdt_chu_tau,sdt_thuyen_truong")
          .or(`sdt_chu_tau.in.(${lo.join(",")}),sdt_thuyen_truong.in.(${lo.join(",")})`),
        admin
          .from("push_messages")
          .select("target_phone,title,created_at")
          .eq("sent_by", STRACKING_PUSH_SENT_BY)
          .in("target_phone", lo)
          .gte("created_at", dauNgay)
          .order("created_at", { ascending: false }),
      ]);
      for (const m of (may ?? []) as TauCuaImei[]) if (!tau.some((t) => t.imei === m.imei)) tau.push(m);
      const gapRoi = new Set<string>();
      for (const m of tin ?? []) {
        const p = m.target_phone as string;
        if (gapRoi.has(p)) continue; // chỉ xét tin MỚI NHẤT
        gapRoi.add(p);
        if (!/đã hết cảnh báo$/.test(m.title as string)) daBao.add(p);
      }
    }
    const tinDong = tinHetCanhBao(imeiHet.map((imei) => ({ imei, luc: nowIso })), tau, conMoImei, daBao);
    const r = await guiTin(admin, tinDong);
    kq.tin = r.tin;
    kq.day = r.day;
  } catch (e) {
    console.error("[stracking] đóng cảnh báo hỏng:", e instanceof Error ? e.message : e);
  }
  console.log(`[stracking] đóng ${kq.dong} cảnh báo ⇒ ${kq.tin} tin đã hết, đẩy ${kq.day}`);
  return kq;
}

const LO_TRA = 300;

/**
 * Cảnh báo MỚI ⇒ hộp thư (push_messages, target account) + Web Push, gộp 1 tin/SĐT (luật ở lib/stracking/thong-bao).
 * Best-effort: hỏng chỉ log, KHÔNG làm 503 — dữ liệu đã ghi xong, 503 sẽ khiến máy thu gửi lại cả lô.
 * nợ: không cập nhật cột `sent` từng tin (đếm tổng ở log) — đủ khi cần soi thống kê đẩy ở /quan-tri thì ghi theo id.
 */
async function baoCanhBaoMoi(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  moiChen: CanhBaoMoi[],
): Promise<{ tin: number; may: number; day: number }> {
  const kq = { tin: 0, may: 0, day: 0 };
  if (!moiChen.length) return kq;
  try {
    const imeis = [...new Set(moiChen.map((c) => c.imei))];
    const tau: TauCuaImei[] = [];
    for (let i = 0; i < imeis.length; i += LO_TRA) {
      const { data, error } = await admin
        .from("stracking_thiet_bi")
        .select("imei,serial,ten_tau,sdt_chu_tau,sdt_thuyen_truong")
        .in("imei", imeis.slice(i, i + LO_TRA));
      if (error) throw error;
      tau.push(...((data ?? []) as TauCuaImei[]));
    }
    // Cảnh báo ĐÃ CÓ trước lượt này của cùng máy (chống lặp 6 giờ) — loại đúng các hàng vừa chèn.
    const nowMs = Date.now();
    const tu = new Date(nowMs - CUA_SO_MS - CHONG_LAP_MS).toISOString();
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
    const tin = gomTinTau(moiChen, tau, nowMs, truoc);
    Object.assign(kq, await guiTin(admin, tin));
  } catch (e) {
    console.error("[stracking] thông báo cảnh báo hỏng:", e instanceof Error ? e.message : e);
  }
  console.log(`[stracking] cảnh báo mới ${moiChen.length} ⇒ ${kq.tin} tin, đẩy ${kq.day}/${kq.may} máy`);
  return kq;
}

/** Ghi hộp thư (push_messages, target account) TRƯỚC — lưới an toàn khi đẩy hụt / mất sóng — rồi Web Push cho tin `day`.
 *  Ném lỗi khi ghi hộp thư hỏng (caller nuốt + log). */
async function guiTin(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  tin: TinTau[],
): Promise<{ tin: number; may: number; day: number }> {
  const kq = { tin: 0, may: 0, day: 0 };
  if (!tin.length) return kq;

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
        title: t.title, body: t.body, url: t.url, target: "account", target_phone: t.phone,
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
        const r = await sendPushMany(rows, { title: t.title, body: t.body, url: t.url, sentAt, messageId: idTheoSdt.get(t.phone) ?? null, tag: t.tag });
        kq.day += r.sent;
        chet.push(...r.goneIds);
      }),
  );
  if (chet.length) await admin.from("push_subscriptions").delete().in("id", chet);
  return kq;
}
