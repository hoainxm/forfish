// THÔNG BÁO CẢNH BÁO TÀU S-TRACKING — "CẢNH BÁO THÔNG MINH" (2026-11-05, anh Long: "các thông báo liên quan tàu thì show
// trên sdfish luôn ở phần thông báo, push đi" rồi "cái nào trong ngày thôi, cảnh báo thông minh vào"). THUẦN — route
// /api/stracking/nhap gọi sau khi chèn cảnh báo.
//
// Luật:
//  · CHỈ cảnh báo MỚI chèn (trùng khoá imei+loại+giờ ⇒ không báo lại), xảy ra ≤ CUA_SO_MS (máy chủ còn lọc "trong ngày"
//    ở kiemGoiNhap) — kho tồn / gửi bù không dội tin chuyện đã qua.
//  · MỨC theo loại + trong bờ/ngoài khơi (lib/stracking/muc-canh-bao, 06/11): khẩn/cao/thường ⇒ ĐẨY lên máy (thường tối đa
//    1 lần/ngày cùng máy + loại), "bỏ" ⇒ không báo (tàu nằm bờ mà tắt máy / không nguồn ngoài…).
//  · CHỐNG LẶP theo LẦN ĐÃ BÁO (tính lại từ lịch sử 2 ngày), khoảng theo mức: SOS/vượt biên ngoài khơi 1 giờ, sắp vượt
//    biên 3 giờ, tắt máy/mất GPS 6 giờ, pin 12 giờ, thường 24 giờ; trong một lượt cùng máy + loại chỉ giữ một.
//  · GỘP một tin/SĐT/lượt, CHỈ chủ tàu nhận (06/11); mỗi tàu một dòng
//    "BV-123-TS: SOS 15:47 · Mất GPS 16:02", tàu nguy hiểm hơn đứng trước; ≤ DONG_TOI_DA tàu + "và N tàu khác".
//  · Trần TRAN_TIN_MOI_LUOT tin/lượt — người có báo động nặng nhất, mới nhất được giữ trước.
//  · `tag` theo SĐT: máy chỉ giữ tin mới nhất, không chồng chất.

import { laMayDaBo } from "./may-da-bo.mjs";
import { mucCanhBao } from "./muc-canh-bao.mjs";

export const STRACKING_PUSH_SENT_BY = "system:stracking";
/** Cảnh báo cũ hơn ngần này (so với lúc nhận) thì chỉ lưu, không báo — khe dài nhất giữa hai lượt là 21:00 → 07:30. */
export const CUA_SO_MS = 12 * 3600_000;
/** Lịch sử cảnh báo route tra để TÍNH LẠI chuỗi đã báo (chống lặp dài nhất 24 giờ + cửa sổ 12 giờ, kho giữ 2 ngày). */
export const TRA_LUI_MS = 48 * 3600_000;
export const DONG_TOI_DA = 3;
/** Trần tổng số tin MỖI LƯỢT — một lượt dồn (kho làm lại, gửi bù) không bắn cả nghìn tin. */
export const TRAN_TIN_MOI_LUOT = 400;

export const BAO_DONG = "Báo động";

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
  /** trong bờ (true) / ngoài khơi (false) / chưa rõ (null ⇒ như ngoài khơi) — mức cảnh báo phụ thuộc (muc-canh-bao) */
  trong_bo?: boolean | null;
  /** Tài khoản gán SĐT chủ tàu/thuyền trưởng của máy này làm SĐT phụ (0084) — cũng là "người của máy". */
  sdt_them?: readonly string[];
}
/** Mọi SĐT nhận tin về máy: chủ tàu, thuyền trưởng, tài khoản có SĐT phụ trùng. */
/** Người nhận tin của một máy: CHỈ chủ tàu (+ tài khoản gán SĐT chủ tàu làm SĐT phụ). Thuyền trưởng không nhận — anh Long
 *  06/11: "chủ tàu mới xem giám sát, thuyền trưởng nếu có chỉ là trong hồ sơ lao động thôi". */
const nguoiCuaMay = (t: TauCuaImei) => [...new Set([t.sdt_chu_tau, ...(t.sdt_them ?? [])])];
export interface TinTau {
  phone: string;
  title: string;
  body: string;
  url: string;
  tag: string;
  /** true = có báo động ⇒ đẩy lên máy; false = chỉ hộp thư */
  day: boolean;
}

/**
 * DẤU "KHẨN" TRÊN ĐƯỜNG DẪN (2026-11-06, anh Long: Sen Biển phải biết tin nào tự đọc). Tin có báo động (`day` — đúng tin
 * được ĐẨY lên máy) mang `khan=1` trong url ⇒ chế độ Đang chạy tự đọc to (lib/inbox `laTinKhan`); tin chỉ-hộp-thư thì
 * không. Ghi vào url vì hộp thư (push_messages → /api/me/messages) chỉ chở title/body/url — không thêm cột, không migration.
 */
export function urlTinTau(t: Pick<TinTau, "url" | "day">): string {
  if (!t.day) return t.url;
  return `${t.url}${t.url.includes("?") ? "&" : "?"}khan=1`;
}

// ── NHẮC NHỞ (máy GPU tính — lib/stracking/nhac-nho; máy chủ kiểm ở dong-bo kiemNhac) ───────────────────────
// Anh Long 05/11: "đồng bộ Tổng cục / mất kết nối >6 giờ là bị phạt — cho Sen Biển nhắc", "nó ở màn thông báo đấy,
// đẩy lên điện thoại". Chống lặp làm ở máy GPU (sổ da_nhac). Ở đây chỉ GỘP vào tin của SĐT (1 tin/SĐT/lượt, cùng tag).

export type LoaiNhac =
  | "mkn-sap-6h"
  | "mkn-qua-6h"
  // nằm bờ mà mất kết nối / tắt máy — quá 1 ngày không báo vị trí là bị phạt (anh Long 06/11)
  | "mkn-bo-sap-1ngay"
  | "mkn-bo-qua-1ngay"
  // ngoài khơi từ ngày 8: hạn chót đưa tàu về bờ (NĐ 41/2026, mốc 10 ngày) — 07/11
  | "mkn-sap-10ngay"
  | "mkn-qua-10ngay"
  | "tcts-that-bai"
  | "han-sap-het"
  | "han-qua-han";
export interface Nhac {
  sdt: string;
  tau: string;
  loai: LoaiNhac;
  day: boolean;
  /** câu hoàn chỉnh, có tên tàu */
  dong: string;
  /** serial máy (máy GPU gửi kèm từ 06/11) — để bỏ nhắc máy bà con đã xoá; vắng ⇒ khớp theo tên tàu */
  serial?: string;
}

// ── MÁY BÀ CON ĐÃ "XOÁ" (0085 stracking_an; anh Long 06/11: "máy nào ẩn thì ko cần thông báo liên quan nữa") ──────────
// Khoá `${sdt}|${serial}` (và `${sdt}|t:${tên tàu}` cho nhắc chưa có serial). Route nhap đọc bảng, lọc ở đây.
export const khoaXoa = (sdt: string, serial: string) => `${sdt}|${serial}`;
export const khoaXoaTen = (sdt: string, ten: string) => `${sdt}|t:${ten}`;

/** Bỏ dòng nhắc của máy SĐT đó đã xoá (theo serial nếu có, không thì theo tên tàu). */
export function locNhacDaXoa(nhac: readonly Nhac[], daXoa: ReadonlySet<string>): Nhac[] {
  if (!daXoa.size) return [...nhac];
  return nhac.filter((n) => !(n.serial ? daXoa.has(khoaXoa(n.sdt, n.serial)) : daXoa.has(khoaXoaTen(n.sdt, n.tau))));
}
/** Trần số SĐT nhận nhắc mỗi lượt — lượt đầu ~1.100 dòng nhắc trên cả kho; phần lớn chỉ vào hộp thư (máy chưa bật push). */
export const TRAN_NHAC_MOI_LUOT = 1500;
export const DONG_NHAC_TOI_DA = 4;
/** Thứ tự nặng (nhỏ = nặng): mất kết nối là chuyện bị phạt ⇒ đứng trước cả cảnh báo. */
const HANG_NHAC: Record<LoaiNhac, number> = {
  "mkn-qua-10ngay": 0,
  "mkn-sap-10ngay": 0,
  "mkn-qua-6h": 0,
  "mkn-bo-qua-1ngay": 1,
  "mkn-sap-6h": 2,
  "mkn-bo-sap-1ngay": 3,
  "han-qua-han": 4,
  "tcts-that-bai": 5,
  "han-sap-het": 6,
};
const TIEU_DE_NHAC: Record<LoaiNhac, (tau: string) => string> = {
  "mkn-qua-10ngay": (t) => `Tàu ${t} mất kết nối quá 10 ngày`,
  "mkn-sap-10ngay": (t) => `Tàu ${t} sắp tới hạn 10 ngày phải về bờ`,
  "mkn-qua-6h": (t) => `Tàu ${t} mất kết nối quá 6 giờ`,
  "mkn-sap-6h": (t) => `Tàu ${t} sắp quá 6 giờ mất kết nối`,
  "mkn-bo-qua-1ngay": (t) => `Tàu ${t} quá 1 ngày chưa báo vị trí`,
  "mkn-bo-sap-1ngay": (t) => `Tàu ${t} sắp 1 ngày chưa báo vị trí`,
  "han-qua-han": (t) => `Tàu ${t} quá hạn cước giám sát`,
  "tcts-that-bai": (t) => `Tàu ${t} chưa đồng bộ dữ liệu`,
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
  daXoa: ReadonlySet<string> = new Set(),
): TinTau[] {
  // máy đã huỷ / thu hồi (lib/stracking/may-da-bo) không báo
  const theoImei = new Map(tau.filter((t) => !laMayDaBo(t)).map((t) => [t.imei, t]));
  // mọi máy của mỗi SĐT (để biết SĐT còn máy nào đang cảnh báo không)
  const mayCuaSdt = new Map<string, Set<string>>();
  for (const t of tau)
    for (const sdt of nguoiCuaMay(t))
      if (sdt && !daXoa.has(khoaXoa(sdt, t.serial))) mayCuaSdt.set(sdt, (mayCuaSdt.get(sdt) ?? new Set()).add(t.imei));
  const dongTheoSdt = new Map<string, { ten: string; luc: string }[]>();
  for (const d of vuaDong) {
    const may = theoImei.get(d.imei);
    if (!may) continue;
    for (const sdt of nguoiCuaMay(may)) {
      if (!sdt || !daBao.has(sdt) || daXoa.has(khoaXoa(sdt, may.serial))) continue;
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
/** Xếp theo MỨC thật (muc-canh-bao `hang`: khẩn › cao › thường, rồi loại) — dùng khi biết trong bờ / ngoài khơi. */
function nangHonTheoMuc(hangCua: (c: CanhBaoMoi) => number) {
  return (a: CanhBaoMoi, b: CanhBaoMoi) => hangCua(a) - hangCua(b) || Date.parse(b.luc) - Date.parse(a.luc);
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
  daXoa: ReadonlySet<string> = new Set(),
): TinTau[] {
  // máy đã huỷ / thu hồi (lib/stracking/may-da-bo) không báo
  const theoImei = new Map(tau.filter((t) => !laMayDaBo(t)).map((t) => [t.imei, t]));
  // MỨC theo loại + vị trí tàu (muc-canh-bao, anh Long 06/11: "đúng và kịp thời", "đẩy lên máy đi, tần suất ngày").
  const muc = (c: CanhBaoMoi) => mucCanhBao({ loai: c.loai, muc: c.muc, trongBo: theoImei.get(c.imei)?.trong_bo ?? null });
  // 1) CHỐNG LẶP THEO LẦN ĐÃ BÁO — tính lại chuỗi từ lịch sử (truoc + moi) cùng máy + cùng loại: báo cái đầu, cái sau chỉ
  //    báo khi cách lần ĐÃ BÁO gần nhất ≥ chongLapMs. (Luật cũ so với cảnh báo liền trước: S-Tracking bắn SOS ~30 phút/lần
  //    ⇒ luôn có cái liền trước ⇒ sau tin đầu KHÔNG BAO GIỜ báo lại — sai cho chuyện sống còn.) Không cần cột "đã báo":
  //    lịch sử giữ 2 ngày ≥ chống lặp dài nhất 24 giờ.
  const laMoi = new Set(moi.map((c) => `${c.imei}|${c.loai}|${Date.parse(c.luc)}`));
  const theoKhoa = new Map<string, CanhBaoMoi[]>();
  for (const c of [...truoc, ...moi]) {
    if (!theoImei.has(c.imei) || !Number.isFinite(Date.parse(c.luc))) continue;
    const k = `${c.imei}|${c.loai}`;
    const ds = theoKhoa.get(k) ?? [];
    if (!ds.some((x) => Date.parse(x.luc) === Date.parse(c.luc))) ds.push(c);
    theoKhoa.set(k, ds);
  }
  const chon = new Map<string, CanhBaoMoi>();
  for (const [k, ds] of theoKhoa) {
    ds.sort((a, b) => Date.parse(a.luc) - Date.parse(b.luc));
    let daBaoLuc: number | null = null;
    for (const c of ds) {
      const m = muc(c);
      if (m.bac === "bo") continue; // chuyện bình thường khi tàu nằm bờ — không báo
      const t = Date.parse(c.luc);
      if (daBaoLuc != null && t - daBaoLuc < (m.chongLapMs ?? Infinity)) continue;
      daBaoLuc = t;
      const moiLuot = laMoi.has(`${c.imei}|${c.loai}|${t}`) && nowMs - t <= CUA_SO_MS && t - nowMs <= CUA_SO_MS;
      if (moiLuot) chon.set(k, c); // trong lượt giữ lần báo MỚI NHẤT
    }
  }
  const nangHonM = nangHonTheoMuc((c) => muc(c).hang);
  // 2) theo SĐT → theo tàu
  const theoSdt = new Map<string, Map<string, CanhBaoMoi[]>>();
  for (const c of chon.values()) {
    const may = theoImei.get(c.imei)!;
    const ten = may.ten_tau ?? may.serial;
    for (const sdt of new Set([may.sdt_chu_tau])) {
      if (!sdt || daXoa.has(khoaXoa(sdt, may.serial))) continue; // máy SĐT này đã xoá ⇒ không báo
      const cacTau = theoSdt.get(sdt) ?? new Map<string, CanhBaoMoi[]>();
      cacTau.set(ten, [...(cacTau.get(ten) ?? []), c]);
      theoSdt.set(sdt, cacTau);
    }
  }
  // 3) câu chữ
  const out: (TinTau & { nang: CanhBaoMoi })[] = [];
  for (const [phone, cacTau] of theoSdt) {
    const dsTau = [...cacTau.entries()].map(([ten, ds]) => ({ ten, ds: ds.sort(nangHonM) })).sort((a, b) => nangHonM(a.ds[0], b.ds[0]));
    const title = dsTau.length === 1 ? `Cảnh báo tàu ${dsTau[0].ten}` : `Cảnh báo ${dsTau.length} tàu của bạn`;
    const dong = dsTau.slice(0, DONG_TOI_DA).map(({ ten, ds }) => `${ten}: ${ds.map((c) => `${c.loai} ${gioVn(c.luc)}`).join(" · ")}`);
    if (dsTau.length > DONG_TOI_DA) dong.push(`và ${dsTau.length - DONG_TOI_DA} tàu khác`);
    const nang = dsTau[0].ds[0];
    out.push({ phone, title, body: dong.join("\n"), url: "/tau", tag: `stracking-${phone}`, day: dsTau.some((x) => x.ds.some((c) => muc(c).day)), nang });
  }
  out.sort((a, b) => nangHonM(a.nang, b.nang));
  return out.slice(0, TRAN_TIN_MOI_LUOT).map((t) => ({ phone: t.phone, title: t.title, body: t.body, url: t.url, tag: t.tag, day: t.day }));
}

/**
 * SĐT PHỤ (0084, anh Long 05/11: "đã gán 2 sdt … thì gửi đủ về chứ"): tin gửi SĐT trên máy P ⇒ thêm bản cho mọi tài
 * khoản đã gán P làm SĐT phụ. Tài khoản đó đã có tin riêng lượt này ⇒ GỘP (thêm dòng chưa có, `day` OR) để vẫn 1 tin/SĐT;
 * chưa có ⇒ bản sao, `tag` theo SĐT nhận để đè đúng thông báo cũ của người đó.
 * KHÔNG dùng cho tin "đã hết cảnh báo": tin đó phải xét MỌI máy của tài khoản chính (máy riêng + máy của SĐT phụ) —
 * route nhap gắn `sdt_them` cho máy rồi để `tinHetCanhBao` tự tính.
 */
export function chiaTinChoSdtPhu(tin: readonly TinTau[], chinhCuaPhu: ReadonlyMap<string, readonly string[]>): TinTau[] {
  const out = new Map<string, TinTau>(tin.map((t) => [t.phone, { ...t }]));
  for (const t of tin) {
    for (const chinh of chinhCuaPhu.get(t.phone) ?? []) {
      if (chinh === t.phone) continue;
      const cu = out.get(chinh);
      if (!cu) {
        out.set(chinh, { ...t, phone: chinh, tag: `stracking-${chinh}` });
        continue;
      }
      const dong = cu.body.split("\n");
      const them = t.body.split("\n").filter((d) => !dong.includes(d));
      out.set(chinh, { ...cu, body: [...dong, ...them].join("\n"), day: cu.day || t.day });
    }
  }
  return [...out.values()];
}
