// THÔNG BÁO CẢNH BÁO TÀU S-TRACKING — "CẢNH BÁO THÔNG MINH" (2026-11-05, anh Long: "các thông báo liên quan tàu thì show
// trên sdfish luôn ở phần thông báo, push đi" rồi "cái nào trong ngày thôi, cảnh báo thông minh vào"). THUẦN — route
// /api/stracking/nhap gọi sau khi chèn cảnh báo.
//
// Luật:
//  · CHỈ cảnh báo MỚI chèn (trùng khoá imei+loại+giờ ⇒ không báo lại), xảy ra ≤ CUA_SO_MS (máy chủ còn lọc "trong ngày"
//    ở kiemGoiNhap) — kho tồn / gửi bù không dội tin chuyện đã qua.
//  · Mức: "Báo động" ⇒ hộp thư + ĐẨY lên máy; "Cảnh cáo" ⇒ CHỈ hộp thư (không đánh thức máy); mức khác ⇒ bỏ.
//  · CHỐNG LẶP: cùng máy + cùng loại đã có cảnh báo trong CHONG_LAP_MS trước đó ⇒ không báo lại (S-Tracking bắn lặp
//    SOS / mất GPS liên tục); trong một lượt, cùng máy + cùng loại chỉ giữ một (giờ mới nhất).
//  · GỘP một tin/SĐT/lượt (4 lượt/ngày), chủ tàu + thuyền trưởng cùng nhận; mỗi tàu một dòng
//    "BV-123-TS: SOS 15:47 · Mất GPS 16:02", tàu nguy hiểm hơn đứng trước; ≤ DONG_TOI_DA tàu + "và N tàu khác".
//  · Trần TRAN_TIN_MOI_LUOT tin/lượt — người có báo động nặng nhất, mới nhất được giữ trước.
//  · `tag` theo SĐT: máy chỉ giữ tin mới nhất, không chồng chất.

import { laMayDaBo } from "./may-da-bo.mjs";

export const STRACKING_PUSH_SENT_BY = "system:stracking";
/** Cảnh báo cũ hơn ngần này (so với lúc nhận) thì chỉ lưu, không báo — khe dài nhất giữa hai lượt là 21:00 → 07:30. */
export const CUA_SO_MS = 12 * 3600_000;
export const CHONG_LAP_MS = 6 * 3600_000;
export const DONG_TOI_DA = 3;
/** Trần tổng số tin MỖI LƯỢT — một lượt dồn (kho làm lại, gửi bù) không bắn cả nghìn tin. */
export const TRAN_TIN_MOI_LUOT = 400;

export const BAO_DONG = "Báo động";
const CANH_CAO = "Cảnh cáo";
/** Thứ tự nguy hiểm (nhỏ = nặng). Loại không có trong danh sách đứng sau. */
const UU_TIEN = ["SOS", "Vượt biên", "Sắp vượt biên", "Tắt thiết bị", "Mất GPS", "Pin dự phòng sắp hết"];
const hang = (loai: string) => {
  const i = UU_TIEN.indexOf(loai);
  return i < 0 ? UU_TIEN.length : i;
};

export interface CanhBaoMoi {
  imei: string;
  loai: string;
  luc: string;
  muc: string | null;
}
export interface TauCuaImei {
  imei: string;
  ten_tau: string | null;
  serial: string;
  sdt_chu_tau: string | null;
  sdt_thuyen_truong: string | null;
}
export interface TinTau {
  phone: string;
  title: string;
  body: string;
  url: string;
  tag: string;
  /** true = có báo động ⇒ đẩy lên máy; false = chỉ hộp thư */
  day: boolean;
}

// ── NHẮC NHỞ (máy GPU tính — lib/stracking/nhac-nho; máy chủ kiểm ở dong-bo kiemNhac) ───────────────────────
// Anh Long 05/11: "đồng bộ Tổng cục / mất kết nối >6 giờ là bị phạt — cho Sen Biển nhắc", "nó ở màn thông báo đấy,
// đẩy lên điện thoại". Chống lặp làm ở máy GPU (sổ da_nhac). Ở đây chỉ GỘP vào tin của SĐT (1 tin/SĐT/lượt, cùng tag).

export type LoaiNhac = "mkn-sap-6h" | "mkn-qua-6h" | "tcts-that-bai" | "han-sap-het" | "han-qua-han";
export interface Nhac {
  sdt: string;
  tau: string;
  loai: LoaiNhac;
  day: boolean;
  /** câu hoàn chỉnh, có tên tàu */
  dong: string;
}
/** Trần số SĐT nhận nhắc mỗi lượt — lượt đầu ~1.100 dòng nhắc trên cả kho; phần lớn chỉ vào hộp thư (máy chưa bật push). */
export const TRAN_NHAC_MOI_LUOT = 1500;
export const DONG_NHAC_TOI_DA = 4;
/** Thứ tự nặng (nhỏ = nặng): mất kết nối là chuyện bị phạt ⇒ đứng trước cả cảnh báo. */
const HANG_NHAC: Record<LoaiNhac, number> = { "mkn-qua-6h": 0, "mkn-sap-6h": 1, "han-qua-han": 2, "tcts-that-bai": 3, "han-sap-het": 4 };
const TIEU_DE_NHAC: Record<LoaiNhac, (tau: string) => string> = {
  "mkn-qua-6h": (t) => `Tàu ${t} mất kết nối quá 6 giờ`,
  "mkn-sap-6h": (t) => `Tàu ${t} sắp quá 6 giờ mất kết nối`,
  "han-qua-han": (t) => `Tàu ${t} quá hạn cước giám sát`,
  "tcts-that-bai": (t) => `Tàu ${t} chưa đồng bộ Tổng cục`,
  "han-sap-het": (t) => `Tàu ${t} sắp hết hạn cước giám sát`,
};

/**
 * Ghép nhắc vào tin cảnh báo: SĐT đã có tin cảnh báo ⇒ thêm dòng (mất kết nối đứng TRƯỚC dòng cảnh báo, việc khác sau),
 * giữ tiêu đề cảnh báo; SĐT chỉ có nhắc ⇒ tin mới, tiêu đề theo việc nặng nhất. `day` = cảnh báo đẩy HOẶC có nhắc đẩy.
 * Quá TRAN_NHAC_MOI_LUOT SĐT ⇒ người có nhắc nặng/đẩy trước; phần bị bỏ trả `nhacSdtBo` (máy GPU giữ lại, gửi lượt sau).
 */
export function ghepNhac(
  tinCanhBao: readonly TinTau[],
  nhac: readonly Nhac[],
): { tin: TinTau[]; nhacSdt: string[]; nhacSdtBo: string[]; soDongNhac: number } {
  const theoSdt = new Map<string, Nhac[]>();
  for (const n of nhac) theoSdt.set(n.sdt, [...(theoSdt.get(n.sdt) ?? []), n]);
  const ds = [...theoSdt.entries()].map(([sdt, ns]) => ({
    sdt,
    ns: [...ns].sort((a, b) => HANG_NHAC[a.loai] - HANG_NHAC[b.loai]),
  }));
  ds.sort((a, b) => Number(b.ns.some((n) => n.day)) - Number(a.ns.some((n) => n.day)) || HANG_NHAC[a.ns[0].loai] - HANG_NHAC[b.ns[0].loai]);
  const giu = ds.slice(0, TRAN_NHAC_MOI_LUOT);
  const nhacSdtBo = ds.slice(TRAN_NHAC_MOI_LUOT).map((d) => d.sdt);

  const tin = new Map(tinCanhBao.map((t) => [t.phone, { ...t }]));
  let soDongNhac = 0;
  for (const { sdt, ns } of giu) {
    soDongNhac += ns.length;
    const truoc = ns.filter((n) => n.loai.startsWith("mkn-")).map((n) => n.dong);
    const sau = ns.filter((n) => !n.loai.startsWith("mkn-")).map((n) => n.dong);
    const coDay = ns.some((n) => n.day);
    const cu = tin.get(sdt);
    if (cu) {
      tin.set(sdt, { ...cu, body: [...truoc, cu.body, ...sau].join("\n"), day: cu.day || coDay });
      continue;
    }
    const cacTau = [...new Set(ns.map((n) => n.tau).filter(Boolean))];
    const title =
      ns.length === 1 || (cacTau.length === 1 && ns.every((n) => n.loai === ns[0].loai))
        ? TIEU_DE_NHAC[ns[0].loai](ns[0].tau || "của bạn")
        : `Nhắc ${ns.length} việc giám sát hành trình`;
    const dong = [...truoc, ...sau];
    const body = [...dong.slice(0, DONG_NHAC_TOI_DA), ...(dong.length > DONG_NHAC_TOI_DA ? [`và ${dong.length - DONG_NHAC_TOI_DA} việc khác`] : [])];
    tin.set(sdt, { phone: sdt, title, body: body.join("\n"), url: "/tau", tag: `stracking-${sdt}`, day: coDay });
  }
  return { tin: [...tin.values()], nhacSdt: giu.map((d) => d.sdt), nhacSdtBo, soDongNhac };
}

/**
 * TIN "ĐÃ HẾT CẢNH BÁO" (anh Long 05/11: "nếu cảnh báo đã được clear thì đóng cảnh báo cho họ"). Gửi cho SĐT đã được
 * báo cảnh báo (trong ngày) mà nay MỌI máy của họ hết cảnh báo mở. Cùng `tag` `stracking-<sdt>` ⇒ ĐÈ thông báo cảnh báo
 * cũ trên màn khoá; `day` = true để đè được (Web Push không xoá được tin từ xa, chỉ thay bằng tin cùng tag).
 *
 * @param vuaDong   máy (imei) vừa có cảnh báo bị đóng lượt này, kèm giờ về bình thường
 * @param conMo     imei còn cảnh báo MỞ sau lượt này
 * @param daBao     SĐT đã nhận tin cảnh báo hôm nay (chỉ những người này mới cần "đóng")
 */
export function tinHetCanhBao(
  vuaDong: readonly { imei: string; luc: string }[],
  tau: readonly TauCuaImei[],
  conMo: ReadonlySet<string>,
  daBao: ReadonlySet<string>,
): TinTau[] {
  // máy đã huỷ / thu hồi (lib/stracking/may-da-bo) không báo
  const theoImei = new Map(tau.filter((t) => !laMayDaBo(t)).map((t) => [t.imei, t]));
  // mọi máy của mỗi SĐT (để biết SĐT còn máy nào đang cảnh báo không)
  const mayCuaSdt = new Map<string, Set<string>>();
  for (const t of tau)
    for (const sdt of [t.sdt_chu_tau, t.sdt_thuyen_truong]) if (sdt) mayCuaSdt.set(sdt, (mayCuaSdt.get(sdt) ?? new Set()).add(t.imei));
  const dongTheoSdt = new Map<string, { ten: string; luc: string }[]>();
  for (const d of vuaDong) {
    const may = theoImei.get(d.imei);
    if (!may) continue;
    for (const sdt of new Set([may.sdt_chu_tau, may.sdt_thuyen_truong])) {
      if (!sdt || !daBao.has(sdt)) continue;
      dongTheoSdt.set(sdt, [...(dongTheoSdt.get(sdt) ?? []), { ten: may.ten_tau ?? may.serial, luc: d.luc }]);
    }
  }
  const out: TinTau[] = [];
  for (const [phone, ds] of dongTheoSdt) {
    if ([...(mayCuaSdt.get(phone) ?? [])].some((imei) => conMo.has(imei))) continue; // còn tàu đang cảnh báo ⇒ chưa đóng
    const cacTen = [...new Set(ds.map((d) => d.ten))];
    const moiNhat = ds.reduce((a, b) => (Date.parse(b.luc) > Date.parse(a.luc) ? b : a)).luc;
    out.push({
      phone,
      title: cacTen.length === 1 ? `Tàu ${cacTen[0]} đã hết cảnh báo` : `${cacTen.length} tàu của bạn đã hết cảnh báo`,
      body: `Giám sát hành trình báo bình thường lúc ${gioVn(moiNhat)}.`,
      url: "/tau",
      tag: `stracking-${phone}`,
      day: true,
    });
  }
  return out.slice(0, TRAN_TIN_MOI_LUOT);
}

function gioVn(iso: string): string {
  const d = new Date(Date.parse(iso) + 7 * 3600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/** So sánh "nặng hơn đứng trước": báo động > cảnh cáo, rồi theo loại, rồi mới hơn. */
function nangHon(a: CanhBaoMoi, b: CanhBaoMoi): number {
  return (
    Number(b.muc === BAO_DONG) - Number(a.muc === BAO_DONG) ||
    hang(a.loai) - hang(b.loai) ||
    Date.parse(b.luc) - Date.parse(a.luc)
  );
}

/**
 * @param moi    cảnh báo VỪA CHÈN lượt này
 * @param truoc  cảnh báo ĐÃ CÓ trước lượt này của cùng các máy (để chống lặp) — route tra ≤ CHONG_LAP_MS + CUA_SO_MS
 */
export function gomTinTau(
  moi: readonly CanhBaoMoi[],
  tau: readonly TauCuaImei[],
  nowMs: number,
  truoc: readonly CanhBaoMoi[] = [],
): TinTau[] {
  // máy đã huỷ / thu hồi (lib/stracking/may-da-bo) không báo
  const theoImei = new Map(tau.filter((t) => !laMayDaBo(t)).map((t) => [t.imei, t]));
  const daCo = new Map<string, number[]>();
  for (const p of truoc) {
    const t = Date.parse(p.luc);
    if (!Number.isFinite(t)) continue;
    const k = `${p.imei}|${p.loai}`;
    daCo.set(k, [...(daCo.get(k) ?? []), t]);
  }
  // 1) lọc + chống lặp, cùng máy+loại trong lượt giữ bản mới nhất
  const chon = new Map<string, CanhBaoMoi>();
  for (const c of moi) {
    if (c.muc !== BAO_DONG && c.muc !== CANH_CAO) continue;
    const t = Date.parse(c.luc);
    if (!Number.isFinite(t) || nowMs - t > CUA_SO_MS || t - nowMs > CUA_SO_MS) continue;
    if (!theoImei.has(c.imei)) continue;
    const k = `${c.imei}|${c.loai}`;
    if ((daCo.get(k) ?? []).some((p) => p < t && t - p <= CHONG_LAP_MS)) continue;
    const cu = chon.get(k);
    if (!cu || Date.parse(cu.luc) < t || (cu.muc !== BAO_DONG && c.muc === BAO_DONG)) chon.set(k, c);
  }
  // 2) theo SĐT → theo tàu
  const theoSdt = new Map<string, Map<string, CanhBaoMoi[]>>();
  for (const c of chon.values()) {
    const may = theoImei.get(c.imei)!;
    const ten = may.ten_tau ?? may.serial;
    for (const sdt of new Set([may.sdt_chu_tau, may.sdt_thuyen_truong])) {
      if (!sdt) continue;
      const cacTau = theoSdt.get(sdt) ?? new Map<string, CanhBaoMoi[]>();
      cacTau.set(ten, [...(cacTau.get(ten) ?? []), c]);
      theoSdt.set(sdt, cacTau);
    }
  }
  // 3) câu chữ
  const out: (TinTau & { nang: CanhBaoMoi })[] = [];
  for (const [phone, cacTau] of theoSdt) {
    const dsTau = [...cacTau.entries()].map(([ten, ds]) => ({ ten, ds: ds.sort(nangHon) })).sort((a, b) => nangHon(a.ds[0], b.ds[0]));
    const title = dsTau.length === 1 ? `Cảnh báo tàu ${dsTau[0].ten}` : `Cảnh báo ${dsTau.length} tàu của bạn`;
    const dong = dsTau.slice(0, DONG_TOI_DA).map(({ ten, ds }) => `${ten}: ${ds.map((c) => `${c.loai} ${gioVn(c.luc)}`).join(" · ")}`);
    if (dsTau.length > DONG_TOI_DA) dong.push(`và ${dsTau.length - DONG_TOI_DA} tàu khác`);
    const nang = dsTau[0].ds[0];
    out.push({ phone, title, body: dong.join("\n"), url: "/tau", tag: `stracking-${phone}`, day: nang.muc === BAO_DONG, nang });
  }
  out.sort((a, b) => nangHon(a.nang, b.nang));
  return out.slice(0, TRAN_TIN_MOI_LUOT).map((t) => ({ phone: t.phone, title: t.title, body: t.body, url: t.url, tag: t.tag, day: t.day }));
}
