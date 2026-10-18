// SEN BIỂN — THAO TÁC BẢN ĐỒ BẰNG GIỌNG (thuần, có test, không mạng).
//
// Chủ dự án 2026-10-17: "ngư dân nói xem bản đồ sóng, xem bản đồ gió, xem dòng
// chảy trong mấy ngày tới rồi bản đồ tự thao tác theo, xem bản đồ cá thì qua bản
// đồ cá, chọn loài cá cần xem, đọc giá trị và vị trí … thao tác toàn bộ ở bản đồ
// chỉ cần nói với sen biển".
//
// HAI NỬA như hoi-ban-do.ts: bộ n-gram v3 CHỌN việc (mo_lop, tat_lop, doi_thoi_diem,
// doc_gia_tri, phong_to, thu_nho, ve_tau, chay_thoi_gian); LUẬT ở đây trích tham số
// (lớp nào, ngày giờ nào, tầng nào, loài nào) — và làm lưới khi mô hình chưa tải.
// Màn bản đồ (fishing-map-view) gọi đúng các hàm nút sẵn có; file này không đụng UI.
//
// `gia` (đọc số) dùng chung lưới mà màn bản đồ đã tải — không thêm request nào.

import { windDirectionVN } from "@/lib/marine-weather";
import { soBangChu } from "@/lib/parse-coord";

import { foldVn, type SenIntent } from "./ngram";

export type LopBanDo =
  | "gio"
  | "song"
  | "dong_chay"
  | "may"
  | "mua"
  | "nhiet_kk"
  | "dong_set"
  | "ap_suat"
  | "nhiet_nuoc"
  | "phu_du"
  | "do_sau"
  | "ca";

/** Lớp có thanh thời gian (lớp vẽ động gió/sóng/dòng chảy + dải màu). */
export const LOP_CO_GIO: readonly LopBanDo[] = ["gio", "song", "dong_chay", "may", "mua", "nhiet_kk", "dong_set", "ap_suat"];

export const TEN_LOP: Record<LopBanDo, string> = {
  gio: "gió",
  song: "sóng",
  dong_chay: "dòng chảy",
  may: "mây",
  mua: "mưa",
  nhiet_kk: "nhiệt độ không khí",
  dong_set: "dông sét",
  ap_suat: "khí áp",
  nhiet_nuoc: "nhiệt độ nước",
  phu_du: "vùng nhiều mồi",
  do_sau: "hải đồ độ sâu",
  ca: "bản đồ cá",
};

/** ngày tính từ hôm nay (0 = nay) + giờ trong ngày (0–23, không có = giữ giờ hiện tại / bây giờ) */
export type ThoiDiem = { ngay: number; gio?: number };
export type LoaiCaHoi = { ds: string[]; ten: string };

export type LenhBanDo =
  | { viec: "mo_lop"; lop: LopBanDo; luc?: ThoiDiem; tang?: 50 | 150 | 300; loaiCa?: LoaiCaHoi }
  | { viec: "tat_lop" }
  | { viec: "doi_thoi_diem"; luc: ThoiDiem }
  | { viec: "doc_gia_tri"; lop?: LopBanDo; luc?: ThoiDiem; loaiCa?: LoaiCaHoi }
  | { viec: "phong_to" }
  | { viec: "thu_nho" }
  | { viec: "ve_tau" }
  | { viec: "chay_thoi_gian" };

/* ── trích tham số ─────────────────────────────────────────────────────────
   So GIỮ DẤU khi câu có dấu (bộ nghe luôn trả có dấu): bỏ dấu thì "gió" = "giờ",
   "mưa" = "mua", "mây" = "máy/mấy", "dông" = "đông". Câu gõ không dấu mới đoán
   theo ngữ cảnh. */
const coDau = (t: string) => /[^\x00-\x7f]/.test(t);
const chuan = (t: string) => ` ${soBangChu(t).toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;

const LOP_DAU: [RegExp, LopBanDo][] = [
  [/ (dòng chảy|hải lưu|dòng nước|nước chảy|dòng tầng|tầng (50|150|300)) /, "dong_chay"],
  [/ (nhiệt độ nước|nước nóng lạnh|nhiệt độ mặt biển|nước mấy độ) /, "nhiet_nuoc"],
  [/ (nhiệt độ không khí|nhiệt độ trời|nóng lạnh trên bờ) /, "nhiet_kk"],
  [/ (phù du|nhiều mồi|vùng mồi) /, "phu_du"],
  [/ (bản đồ cá|lớp cá|dự báo cá|điểm cá) /, "ca"],
  [/ (dông|sấm sét|giông) /, "dong_set"],
  [/ (áp suất|khí áp) /, "ap_suat"],
  [/ (sóng) /, "song"],
  [/ (gió) /, "gio"],
  [/ (mây) /, "may"],
  [/ (mưa) /, "mua"],
  // hải đồ SAU CÙNG: "hiện mưa lên hải đồ" là lớp mưa
  [/ (độ sâu|hải đồ) /, "do_sau"],
];
const LOP_KHONG_DAU: [RegExp, LopBanDo][] = [
  [/ (dong chay|hai luu|dong nuoc|nuoc chay|dong tang|tang (50|150|300)) /, "dong_chay"],
  [/ (nhiet do nuoc|nuoc nong lanh|nhiet do mat bien) /, "nhiet_nuoc"],
  [/ (nhiet do khong khi|nhiet do troi) /, "nhiet_kk"],
  [/ (phu du|nhieu moi) /, "phu_du"],
  [/ (ban do ca|lop ca|du bao ca|diem ca) /, "ca"],
  [/ (sam set|ban do dong|lop dong) /, "dong_set"],
  [/ (ap suat|khi ap) /, "ap_suat"],
  [/ song /, "song"],
  // "gio" không dấu: chỉ là GIÓ khi không đứng sau số — "3 gio" đã đổi thành "3 h" trong tachLop (cấm lookbehind: Safari cũ)
  [/ gio /, "gio"],
  [/ (ban do may|anh may|lop may) /, "may"],
  [/ (ban do mua|luong mua|lop mua|co mua|bat mua) /, "mua"],
  [/ (do sau|hai do) /, "do_sau"],
];

/** Lớp nói tới trong câu; có loài cá thì là lớp cá. */
export function tachLop(text: string, coLoaiCa = false): LopBanDo | undefined {
  if (coDau(text)) {
    const t = chuan(text);
    for (const [re, lop] of LOP_DAU) if (re.test(t)) return lop;
  }
  // không dấu — hoặc câu nửa có dấu nửa không ("mo lop gio … giùm tui"): so bỏ dấu, nhưng "giờ" đã có dấu thì khỏi lẫn "gió"
  const t = ` ${foldVn(soBangChu(text.replace(/giờ/gi, " h ")))} `.replace(/(\d) gio /g, "$1 h ");
  for (const [re, lop] of LOP_KHONG_DAU) if (re.test(t)) return lop;
  return coLoaiCa ? "ca" : undefined;
}

const BUOI: [string, number][] = [["sang", 6], ["trua", 12], ["chieu", 15], ["toi", 19], ["dem", 22], ["khuya", 1]];

/** Ngày + giờ trong câu ("chiều mai", "3 giờ chiều mốt", "năm ngày nữa"); không nói gì ⇒ undefined. */
export function tachThoiDiem(text: string): ThoiDiem | undefined {
  const d = coDau(text);
  const raw = ` ${text.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;
  // TỪ CHỈ NGÀY bắt TRƯỚC khi đổi số bằng chữ: soBangChu đọc "mốt" thành 1, "năm" thành 5.
  // Có dấu thì chắc; không dấu thì "mot" chỉ là MỐT khi đứng sau "ngày"/buổi hoặc đứng trước buổi.
  const dauNgay: [RegExp, number][] = d
    ? [[/ (ngày mốt|mốt|ngày kia|bữa kia) /, 2], [/ (ngày mai|mai) /, 1], [/ (hôm nay|bữa nay|bây giờ|(sáng|trưa|chiều|tối|đêm|khuya) nay) /, 0]]
    : [[/ (ngay mot|ngay kia|bua kia|(sang|trua|chieu|toi|dem) mot|mot (sang|trua|chieu|toi)) /, 2], [/ (ngay mai|mai) /, 1], [/ (hom nay|bua nay|bay gio|(sang|trua|chieu|toi|dem|khuya) nay) /, 0]];
  const fRaw = d ? raw : ` ${foldVn(raw)} `;
  let ngay = dauNgay.find(([re]) => re.test(fRaw))?.[1];
  // bỏ từ chỉ ngày rồi mới đổi số ("mốt" khỏi thành 1)
  const f = ` ${foldVn(soBangChu(dauNgay.reduce((t, [re]) => t.replace(re, " "), fRaw)))} `;
  const nN = / (\d{1,2}) (ngay|bua|hom) (nua|toi|sau) /.exec(f);
  if (nN) ngay = Math.min(15, Number(nN[1]));
  else if (/ (tuan sau|tuan toi|1 tuan nua) /.test(f)) ngay = 7;

  let gio: number | undefined;
  const g = / (\d{1,2}) (gio|h)( (sang|trua|chieu|toi|dem|khuya))? /.exec(f);
  if (g) {
    let h = Number(g[1]) % 24;
    // buổi tìm trên câu CÒN từ chỉ ngày ("10 giờ tối nay": "tối nay" đã bị bỏ khỏi f)
    const b = g[4] ?? buoiTrong(fRaw, d);
    if ((b === "chieu" || b === "toi") && h < 12) h += 12;
    if (b === "dem" && h >= 6 && h < 12) h += 12;
    if (b === "trua" && h < 6) h += 12;
    gio = h;
  } else {
    const b = buoiTrong(fRaw, d);
    if (b) gio = BUOI.find(([w]) => w === b)?.[1];
  }
  if (ngay == null && gio == null) return undefined;
  return gio == null ? { ngay: ngay ?? 0 } : { ngay: ngay ?? 0, gio };
}

/** Buổi trong câu. Có dấu thì "tối" ≠ "tới"; không dấu thì "toi" chỉ là TỐI khi đứng trước nay/mai/mốt/số. */
function buoiTrong(fRaw: string, d: boolean): string | undefined {
  if (d) {
    const m = / (sáng|trưa|chiều|tối|đêm|khuya) /.exec(fRaw);
    return m ? foldVn(m[1]) : undefined;
  }
  const f = ` ${foldVn(fRaw)} `;
  return / (sang|trua|chieu|dem|khuya) /.exec(f)?.[1] ?? (/ toi (nay|mai|mot|\d)/.test(f) || /\d gio toi /.test(f) ? "toi" : undefined);
}

function tachTang(text: string): 50 | 150 | 300 | undefined {
  const m = / (?:tang|do sau|sau|dong chay|dong) (50|150|300) (?:m|met)? /.exec(` ${foldVn(soBangChu(text))} `);
  return m ? (Number(m[1]) as 50 | 150 | 300) : undefined;
}

const LENH_Y: Partial<Record<SenIntent, LenhBanDo["viec"]>> = {
  mo_lop: "mo_lop",
  tat_lop: "tat_lop",
  doi_thoi_diem: "doi_thoi_diem",
  doc_gia_tri: "doc_gia_tri",
  phong_to: "phong_to",
  thu_nho: "thu_nho",
  ve_tau: "ve_tau",
  chay_thoi_gian: "chay_thoi_gian",
};

/**
 * Ý định (n-gram) + câu → lệnh bản đồ; null nếu không phải ý thao tác bản đồ hoặc thiếu
 * tham số bắt buộc (mở lớp mà không rõ lớp nào ⇒ để chỗ gọi hỏi lại).
 * `timLoai` = hàm dò loài cá (hoi-ban-do timLoaiCa) — truyền vào để khỏi vòng import.
 */
export function lenhTuY(y: SenIntent, text: string, timLoai: (t: string) => LoaiCaHoi | undefined): LenhBanDo | null {
  const viec = LENH_Y[y];
  if (!viec) return null;
  const loaiCa = timLoai(text);
  const luc = tachThoiDiem(text);
  switch (viec) {
    case "mo_lop": {
      const lop = tachLop(text, !!loaiCa);
      if (!lop) return null;
      const tang = lop === "dong_chay" ? tachTang(text) : undefined;
      return {
        viec,
        lop,
        ...(luc && LOP_CO_GIO.includes(lop) ? { luc } : {}),
        ...(tang ? { tang } : {}),
        ...(lop === "ca" && loaiCa ? { loaiCa } : {}),
      };
    }
    case "doi_thoi_diem":
      return luc ? { viec, luc } : null;
    case "doc_gia_tri": {
      const lop = tachLop(text, !!loaiCa);
      return { viec, ...(lop ? { lop } : {}), ...(luc ? { luc } : {}), ...(loaiCa ? { loaiCa } : {}) };
    }
    default:
      return { viec };
  }
}

/** Luật làm lưới khi CHƯA có mô hình (lần đầu mất sóng): chỉ bắt câu rất rõ, không đoán. */
export function lenhLuat(text: string, timLoai: (t: string) => LoaiCaHoi | undefined): LenhBanDo | null {
  const f = ` ${foldVn(text)} `;
  if (/ (phong to|zoom vo|phong lon) /.test(f)) return { viec: "phong_to" };
  if (/ (thu nho|zoom ra|xem rong ra) /.test(f)) return { viec: "thu_nho" };
  if (/ (ve cho tau|ve tau|ban do ve tau) /.test(f) && !/ (dan|chay|cang) /.test(f)) return { viec: "ve_tau" };
  if (/ (tat|an|bo) (het )?(lop|ban do (song|gio|ca|dong chay|may|mua)|song|gio|dong chay) /.test(f)) return { viec: "tat_lop" };
  if (/^ (xem|mo|bat|coi|hien|chuyen qua|qua|cho xem) /.test(f)) {
    const lop = tachLop(text, !!timLoai(text));
    if (lop && lop !== "do_sau") return lenhTuY("mo_lop", text, timLoai);
  }
  return null;
}

/* ── chọn mốc giờ trên thanh thời gian ───────────────────────────────────── */

/** "2026-10-17T15:00" (giờ VN) → [ngày từ hôm nay, giờ] — hôm nay = `todayIso` (YYYY-MM-DD). */
function ngayGio(iso: string, todayIso: string): [number, number] {
  const d = Math.round((Date.parse(`${iso.slice(0, 10)}T00:00Z`) - Date.parse(`${todayIso}T00:00Z`)) / 86_400_000);
  return [d, Number(iso.slice(11, 13)) || 0];
}

/**
 * Mốc gần nhất trong `times` cho thời điểm bà con nói. Không nói giờ: ngày 0 = mốc gần
 * giờ hiện tại, ngày khác = 12 giờ trưa. "ngoai" = ngày nói vượt quá lưới (khung miễn phí
 * 3 ngày, hoặc lưới chưa tải tới) — chỗ gọi nói rõ, KHÔNG nhảy bừa tới mốc cuối.
 */
export function chiSoMoc(times: readonly string[], luc: ThoiDiem, todayIso: string, gioHienTai: number): number | "ngoai" | null {
  if (!times.length) return null;
  const gio = luc.gio ?? (luc.ngay === 0 ? gioHienTai : 12);
  const muon = luc.ngay * 24 + gio;
  const [d0] = ngayGio(times[0], todayIso);
  const [dn] = ngayGio(times[times.length - 1], todayIso);
  if (luc.ngay > dn || luc.ngay < Math.min(0, d0)) return "ngoai";
  let best = 0;
  let bestD = Infinity;
  times.forEach((t, i) => {
    const [d, h] = ngayGio(t, todayIso);
    const k = Math.abs(d * 24 + h - muon);
    if (k < bestD) {
      bestD = k;
      best = i;
    }
  });
  return best;
}

/** "chiều mai" / "3 giờ chiều mốt" / "bây giờ" — đọc lại cho bà con nghe máy hiểu đúng chưa. */
export function noiThoiDiem(luc: ThoiDiem | undefined): string {
  if (!luc) return "bây giờ";
  const ngay = luc.ngay === 0 ? "nay" : luc.ngay === 1 ? "mai" : luc.ngay === 2 ? "mốt" : `${luc.ngay} ngày nữa`;
  if (luc.gio == null) return luc.ngay === 0 ? "bây giờ" : luc.ngay <= 2 ? `ngày ${ngay}` : ngay;
  const h = luc.gio;
  const buoi = h < 4 ? "khuya" : h < 11 ? "sáng" : h < 13 ? "trưa" : h < 18 ? "chiều" : h < 22 ? "tối" : "đêm";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12} giờ ${buoi} ${ngay}`;
}

/* ── đọc số tại một chỗ ──────────────────────────────────────────────────── */

export type SoTaiCho = {
  windKmh?: number | null;
  windDirDeg?: number | null;
  waveM?: number | null;
  curKmh?: number | null;
  curDirDeg?: number | null;
  /** giá trị dải màu đang bật (mây %, mưa mm, nhiệt °C, khí áp hPa) */
  scalar?: number | null;
  nhietNuoc?: number | null;
};

const cap = (kmh: number) => {
  const b = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];
  const i = b.findIndex((x) => kmh < x);
  return i < 0 ? 12 : i;
};
const so1 = (v: number) => v.toFixed(1).replace(".", ",").replace(/,0$/, "");

/**
 * Câu đọc số của một lớp tại chỗ hỏi. null = lưới chưa có số đó (chưa tải / ngoài vùng)
 * ⇒ chỗ gọi nói "máy chưa có", KHÔNG bao giờ nói 0.
 */
export function cauDocSo(lop: LopBanDo, so: SoTaiCho): string | null {
  switch (lop) {
    case "gio":
      if (so.windKmh == null) return null;
      return `gió cấp ${cap(so.windKmh)}, ${Math.round(so.windKmh)} km/giờ${so.windDirDeg != null ? `, hướng ${windDirectionVN(so.windDirDeg)}` : ""}`;
    case "song":
      return so.waveM == null ? null : `sóng cao ${so1(so.waveM)} mét`;
    case "dong_chay":
      if (so.curKmh == null) return null;
      // dòng chảy: hướng CHẢY VỀ (khác gió "thổi từ")
      return `dòng chảy ${so1(so.curKmh / 1.852)} hải lý/giờ${so.curDirDeg != null ? `, chảy về hướng ${windDirectionVN(so.curDirDeg)}` : ""}`;
    case "nhiet_nuoc":
      return so.nhietNuoc == null ? null : `nước ${so1(so.nhietNuoc)} độ`;
    case "may":
      return so.scalar == null ? null : `mây che ${Math.round(so.scalar)} phần trăm`;
    case "mua":
      return so.scalar == null ? null : so.scalar < 0.1 ? "không mưa" : `mưa ${so1(so.scalar)} mi li mét một giờ`;
    case "nhiet_kk":
      return so.scalar == null ? null : `trời ${Math.round(so.scalar)} độ`;
    case "ap_suat":
      return so.scalar == null ? null : `khí áp ${Math.round(so.scalar)} héc tô pát xcan`;
    case "dong_set":
      // CAPE J/kg — NGUY CƠ dông (scalar-field "storm"), không phải sét thật
      return so.scalar == null ? null : `nguy cơ dông ${so.scalar < 300 ? "thấp" : so.scalar < 1000 ? "vừa" : so.scalar < 2500 ? "cao" : "rất cao"}`;
    default:
      return null;
  }
}
