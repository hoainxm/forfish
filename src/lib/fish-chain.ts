// LỚP CHUỖI THỨC ĂN của dự báo cá (2026-10-23, nghiên cứu "Dòng Dẫn": docs/research/du-bao-ca-dong-dan-2026-10).
// Gắn lên điểm NỀN "bãi cá theo mùa" (fish-base.ts) các thành phần khoa học: lịch trăng theo nhóm loài, phù du (mồi)
// theo vùng nước trồi, gió dọc bờ, ENSO, Kuroshio qua eo Luzon. MỖI thành phần có thông số học từ dữ liệu thật
// (src/data/fish-chain-params.json, sinh bởi scripts/dong-dan/dung-chain-params.mjs) và CỔNG `ap`: chỉ áp khi dữ liệu
// chứng minh được là tốt hơn; chưa chứng minh ⇒ không cộng điểm, nhưng đầu vào vẫn được tính và LƯU mỗi ngày
// (kho forecast-archive, loại "drivers") để fit lại khi có thêm năm nhãn.
//
// Hai đường vào điểm (vì điểm hiển thị là HẠNG phân vị của từng loài trên toàn lưới trong ngày):
//   • theo NGÀY, giống mọi ô (trăng): cộng SAU khi xếp hạng — `dScore` điểm, kẹp ±dichToiDa;
//   • theo VÙNG (phù du, gió, ENSO, Luzon): cộng vào điểm thô TRƯỚC khi xếp hạng — `dRaw`, đổi thứ hạng giữa vùng.
// THUẦN: không gọi mạng, không đọc file (thông số + đầu vào truyền vào). Đầu vào lấy ở fish-chain-drivers.ts (server).
import { moonPhase } from "@/lib/moon";

export type ChainBox = "SCU" | "NCU" | "OFU" | "MKU";
export const CHAIN_BOXES: readonly ChainBox[] = ["SCU", "NCU", "OFU", "MKU"];
/** Nhóm loài của app (SpeciesCategory trong fish-predict.ts) — lặp lại ở đây để lớp này không phụ thuộc vòng. */
export type ChainCategory = "pelagic-large" | "pelagic-small" | "cephalopod" | "demersal" | "reef" | "crustacean";

interface Gate {
  /** áp vào điểm hay chưa — do bộ dựng thông số quyết theo bằng chứng VÀ đầu vào production đã có, KHÔNG sửa tay */
  ap: boolean;
  /** đã qua cổng THỐNG KÊ (có thể chưa áp vì production chưa có đầu vào) */
  quaCong?: boolean;
  /** vì sao áp / chưa áp (chữ cho người đọc file) */
  lyDo: string;
}
export interface MoonParams extends Gate {
  /** có kết quả học riêng đủ chuyến (dù qua cổng hay không) — loài có dữ liệu riêng không lùi về thông số nhóm */
  coDuLieu?: boolean;
  /** Δlog kg = c·cos(2πφ) + s·sin(2πφ); φ 0 = trăng non, 0,5 = rằm */
  c: number;
  s: number;
}
export interface LinearParams extends Gate {
  /** Δlog kg khi đầu vào (đã chuẩn hoá) tăng 1 đơn vị */
  beta: number;
  /** tháng áp dụng (1..12); vắng = cả năm */
  thang?: number[];
}
export interface ChainParams {
  v: number;
  phienBan: string;
  builtAt: string;
  /** [vĩ độ nam, vĩ độ bắc, kinh độ tây, kinh độ đông] — MỘT nguồn cho app và scripts/dong-dan/hop.mjs */
  hop: Record<ChainBox | "REF", [number, number, number, number]>;
  doiDiem: {
    /** điểm (0–100) cho 1 đơn vị log kg ở đường theo NGÀY */
    diemMoiLogKg: number;
    /** kẹp |dScore| */
    dichToiDa: number;
    /** đơn vị điểm thô của nền cho 1 đơn vị log kg ở đường theo VÙNG */
    rawMoiLogKg: number;
  };
  trang: Partial<Record<ChainCategory, MoonParams>>;
  /** trăng theo TỪNG LOÀI (tên `species` trong SPECIES_PROFILES) — thắng thông số nhóm khi có và đã áp */
  trangLoai?: Record<string, MoonParams>;
  /** khoá "<HỘP>|<nhóm>": phù du (dị thường log10 chl, đơn vị độ lệch chuẩn) */
  moi: Record<string, LinearParams>;
  /** khoá "<HỘP>|<nhóm>": gió dọc bờ (dị thường ứng suất đông, đơn vị độ lệch chuẩn) */
  gio: Record<string, LinearParams>;
  /** khoá "<HỘP>|<nhóm>": ENSO (ONI tháng 12–2 gần nhất, °C) */
  enso: Record<string, LinearParams>;
  /** khoá "<HỘP>|<nhóm>": Kuroshio xâm nhập qua eo Luzon (dị thường ΔADT, đơn vị độ lệch chuẩn) */
  luzon: Record<string, LinearParams>;
  /** khí hậu để đổi đầu vào thô → dị thường chuẩn hoá; vắng ⇒ thành phần đó không tính được (an toàn: 0) */
  khiHau?: {
    /** theo hộp, theo tháng 1..12: [trung bình, độ lệch chuẩn] */
    chlLog?: Partial<Record<ChainBox, Record<string, [number, number]>>>;
    gioTE?: Partial<Record<ChainBox, Record<string, [number, number]>>>;
    luzonAdt?: Record<string, [number, number]>;
  };
  /** giá trị dự phòng khi không tải được chỉ số khí hậu */
  duPhong: { oni: { mua: string; nam: number; giaTri: number }; pdo: { thang: string; giaTri: number } };
}

/** Đầu vào của MỘT ngày dự báo (server tính, lưu kho, gửi kèm payload). Thiếu ⇒ null, không bao giờ đoán. */
export interface ChainDrivers {
  /** ngày mục tiêu YYYY-MM-DD (giờ VN) */
  date: string;
  /** pha trăng 0..1 lúc 20:00 giờ VN ngày mục tiêu (giờ đánh đèn) */
  moonFrac: number;
  /** ONI (°C): mùa 3 tháng gần nhất + mùa 12–2 của năm mục tiêu */
  oni: { gannhat: number | null; muaGanNhat: string | null; djf: number | null; nguon: "cpc" | "du-phong" | "thieu" };
  /** PDO tháng gần nhất */
  pdo: { giaTri: number | null; thang: string | null; nguon: "ncei" | "du-phong" | "thieu" };
  /** Kuroshio qua eo Luzon: ADT bờ Thái Bình Dương − bờ Biển Đông (m), ngày gần nhất có số */
  luzon: { dAdt: number | null; ngay: string | null };
  /** trung bình theo hộp từ chính lưới đầu vào của mô hình cá hôm nay */
  hop: Partial<Record<ChainBox, { chlLog: number | null; sst: number | null }>>;
}

/** Mức điều chỉnh đã áp của một ngày — gửi kèm payload (`chain`) và lưu kho để đối chiếu/tối ưu. */
export interface ChainDay {
  phienBan: string;
  date: string;
  moonFrac: number;
  /** dScore theo nhóm loài (đường theo NGÀY) */
  dScore: Partial<Record<ChainCategory, number>>;
  /** dScore theo TỪNG LOÀI (tên species) — thắng `dScore` của nhóm */
  dScoreLoai: Record<string, number>;
  /** thành phần ĐANG áp (đã qua cổng) */
  dangAp: string[];
  /** thành phần chưa áp — vẫn thu đầu vào */
  chuaAp: string[];
  drivers: ChainDrivers;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const TAU = 2 * Math.PI;

/** Hộp nước trồi chứa điểm (lat, lon); null nếu ngoài mọi hộp. */
export function boxOf(lat: number, lon: number, p: Pick<ChainParams, "hop">): ChainBox | null {
  for (const b of CHAIN_BOXES) {
    const [la0, la1, lo0, lo1] = p.hop[b];
    if (lat >= la0 - 1e-6 && lat <= la1 + 1e-6 && lon >= lo0 - 1e-6 && lon <= lo1 + 1e-6) return b;
  }
  return null;
}

const moonOf = (m: MoonParams | undefined, frac: number) =>
  !m || !m.ap || !Number.isFinite(frac) ? 0 : m.c * Math.cos(TAU * frac) + m.s * Math.sin(TAU * frac);
/** Δlog kg do pha trăng cho một nhóm loài (0 nếu nhóm chưa có thông số hoặc chưa qua cổng). */
export function moonDelta(cat: ChainCategory, frac: number, p: Pick<ChainParams, "trang">): number {
  return moonOf(p.trang[cat], frac);
}

/** Pha trăng lúc 20:00 giờ VN (13:00 UTC) của ngày YYYY-MM-DD — giờ đánh đèn. */
export function moonFracAt(dateVn: string): number {
  return moonPhase(new Date(`${dateVn}T13:00:00Z`)).frac;
}

const standardize = (x: number | null | undefined, ms: [number, number] | undefined): number | null =>
  x == null || !Number.isFinite(x) || !ms || !(ms[1] > 0) ? null : (x - ms[0]) / ms[1];
const monthOf = (date: string) => Number(date.slice(5, 7));
const inSeason = (lp: LinearParams, month: number) => !lp.thang || lp.thang.includes(month);

/**
 * Điều chỉnh theo VÙNG cho một ô (đơn vị log kg; nhân `rawMoiLogKg` trước khi cộng vào điểm thô).
 * Chỉ thành phần đã qua cổng VÀ có đầu vào chuẩn hoá được mới góp; thiếu bất cứ gì ⇒ 0.
 */
export function cellDeltaLogKg(cat: ChainCategory, lat: number, lon: number, d: ChainDrivers, p: ChainParams): number {
  const box = boxOf(lat, lon, p);
  if (!box) return 0;
  const key = `${box}|${cat}`, m = monthOf(d.date), k = String(m);
  let sum = 0;
  const add = (lp: LinearParams | undefined, x: number | null) => {
    if (lp?.ap && inSeason(lp, m) && x != null && Number.isFinite(x)) sum += lp.beta * x;
  };
  add(p.moi[key], standardize(d.hop[box]?.chlLog, p.khiHau?.chlLog?.[box]?.[k]));
  add(p.enso[key], d.oni.djf);
  add(p.luzon[key], standardize(d.luzon.dAdt, p.khiHau?.luzonAdt?.[k]));
  // gió: đầu vào gió theo hộp chưa có trong đường production (fish cron không kéo gió) — thông số để sẵn, góp 0
  return sum;
}

/** Tên các thành phần đang áp / chưa áp (để nói thật trong payload và kho). */
function componentStatus(p: ChainParams): { dangAp: string[]; chuaAp: string[] } {
  const dangAp: string[] = [], chuaAp: string[] = [];
  const scan = (name: string, rec: Record<string, Gate | undefined>) => {
    for (const [k, g] of Object.entries(rec)) if (g) (g.ap ? dangAp : chuaAp).push(`${name}:${k}`);
  };
  scan("trang", p.trang as Record<string, Gate | undefined>);
  scan("trangLoai", p.trangLoai ?? {});
  scan("moi", p.moi);
  scan("gio", p.gio);
  scan("enso", p.enso);
  scan("luzon", p.luzon);
  return { dangAp, chuaAp };
}

/** Mức điều chỉnh theo NGÀY (trăng) cho mọi nhóm loài và loài có thông số riêng + trạng thái các thành phần. */
export function chainDay(d: ChainDrivers, p: ChainParams): ChainDay {
  const toScore = (dl: number) => Math.round(clamp(dl * p.doiDiem.diemMoiLogKg, -p.doiDiem.dichToiDa, p.doiDiem.dichToiDa));
  const dScore: Partial<Record<ChainCategory, number>> = {};
  for (const cat of Object.keys(p.trang) as ChainCategory[]) {
    const v = toScore(moonDelta(cat, d.moonFrac, p));
    if (v !== 0) dScore[cat] = v;
  }
  const dScoreLoai: Record<string, number> = {};
  // loài CÓ dữ liệu riêng: qua cổng ⇒ dùng thông số riêng; KHÔNG qua ⇒ 0 (không lùi về nhóm — số liệu của chính loài đã
  // nói khác nhóm, vd cá cơm đỉnh sau rằm trong khi cá nổi nhỏ đỉnh trước trăng non). Chưa đủ dữ liệu ⇒ dùng nhóm.
  for (const [sp, m] of Object.entries(p.trangLoai ?? {})) {
    if (m.ap) dScoreLoai[sp] = toScore(moonOf(m, d.moonFrac));
    else if (m.coDuLieu) dScoreLoai[sp] = 0;
  }
  return { phienBan: p.phienBan, date: d.date, moonFrac: Math.round(d.moonFrac * 1000) / 1000, dScore, dScoreLoai, ...componentStatus(p), drivers: d };
}

/** Mức dịch theo ngày cho một loài: thông số riêng của loài nếu có, không thì của nhóm. */
export const dayShiftFor = (day: ChainDay | null, species: string, cat: ChainCategory): number | undefined =>
  !day ? undefined : species in day.dScoreLoai ? day.dScoreLoai[species] : day.dScore[cat];

/** Điểm sau điều chỉnh theo ngày, kẹp 0..100. */
export const applyDayShift = (score: number, dScore: number | undefined): number =>
  dScore ? clamp(Math.round(score + dScore), 0, 100) : score;

/** Câu "vì sao" (chữ đời thường, ≤ 1 câu) cho điều chỉnh trăng của nhóm loài; null nếu không đáng nói. */
export function moonWhy(dScore: number | undefined): string | null {
  if (!dScore || Math.abs(dScore) < 2) return null;
  return dScore > 0 ? "tuần trăng thuận" : "tuần trăng không thuận";
}

/* ---------------------------------------------------------------------------
   Đọc chỉ số khí hậu (text công khai của NOAA) — thuần, để test được
--------------------------------------------------------------------------- */

/** CPC oni.ascii.txt ("SEAS YR TOTAL ANOM") → mùa gần nhất + DJF của năm `year`. */
export function parseOni(text: string, year: number): { gannhat: number | null; muaGanNhat: string | null; djf: number | null } {
  let gannhat: number | null = null, mua: string | null = null, djf: number | null = null;
  for (const line of text.split("\n")) {
    const p = line.trim().split(/\s+/);
    if (p.length < 4 || !/^[A-Z]{3}$/.test(p[0]) || !/^\d{4}$/.test(p[1])) continue;
    const v = Number(p[3]);
    if (!Number.isFinite(v)) continue;
    gannhat = v; mua = `${p[0]} ${p[1]}`;
    if (p[0] === "DJF" && Number(p[1]) === year) djf = v;
  }
  return { gannhat, muaGanNhat: mua, djf };
}

/** NCEI ersst.v5.pdo.dat (năm + 12 tháng, 99.99 = chưa có) → tháng gần nhất có số. */
export function parsePdo(text: string): { giaTri: number | null; thang: string | null } {
  let giaTri: number | null = null, thang: string | null = null;
  for (const line of text.split("\n")) {
    const p = line.trim().split(/\s+/);
    if (p.length !== 13 || !/^\d{4}$/.test(p[0])) continue;
    p.slice(1).forEach((s, i) => {
      const v = Number(s);
      if (Number.isFinite(v) && Math.abs(v) < 90) { giaTri = v; thang = `${p[0]}-${String(i + 1).padStart(2, "0")}`; }
    });
  }
  return { giaTri, thang };
}
