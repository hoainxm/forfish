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
  const theoImei = new Map(tau.map((t) => [t.imei, t]));
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
