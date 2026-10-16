// SEN BIỂN — HỎI ĐÁP BẢN ĐỒ (thuần, có test, chạy không mạng).
//
// Chủ dự án 2026-10-16: "phải đọc được toàn bộ thông tin mà bản đồ đang có, tất
// cả các lớp" — hỏi kiểu Google Maps: gần đảo nào, rạn gần nhất, chỗ này sâu
// không, đi hướng Đông Bắc có gì, đèn biển / phao / xác tàu / chỗ trú bão gần
// nhất, có cấm đánh bắt không, con nước, chỗ nào nhiều cá ngừ…
//
// HAI NỬA: `hoiGi` (câu → loại câu hỏi, LUẬT từ khoá — bộ n-gram 31 ý định chưa
// có các ý này; luật đóng, chính xác, không đoán) và `traLoi` (loại câu hỏi +
// kho lớp đã tải + vị trí → câu đọc). Không có lớp nào thì nói THẬT là máy chưa
// có, KHÔNG BAO GIỜ nói "không có gì" khi kho thiếu (luật 15 §4).
//
// Nhận vị trí của TÀU (GPS còn mới) hay CHỖ ĐANG XEM trên bản đồ — câu đáp nói
// rõ "từ tàu" / "từ chỗ đang xem" để bà con không nhầm.

import type { DenBien } from "@/lib/den-bien";
import { DEPTH_CLASS_LABEL, depthClassAt, type DepthGrid } from "@/lib/depth-grid";
import type { FishCell } from "@/lib/fish-predict";
import { haversineKm } from "@/lib/geo";
import type { KhuTruBao } from "@/lib/khu-tru-bao";
import { windDirectionVN } from "@/lib/marine-weather";
import { clockSpeech, distSpeech, type SpeechUnit } from "@/lib/nav-voice/phrases";
import { bearingDeg } from "@/lib/route-plan";
import { seamarkLabel, type Seamark } from "@/lib/seamarks";
import { pointInRing } from "@/lib/spatial-index";
import { tideCardAt, type TideStation } from "@/lib/tides";
import { dangCam, moTaVung, trongVung, type VungQuanLy } from "@/lib/vung-quan-ly";
import { xacTauLabel, type XacTau } from "@/lib/xac-tau";

import type { SenDest } from "./hieu-y";
import { foldVn } from "./ngram";

export type LoaiHoi =
  | "ca"
  | "con_nuoc"
  | "tru_bao"
  | "den_bien"
  | "xac_tau"
  | "phao"
  | "vung_cam"
  | "do_sau"
  | "ran_gan"
  | "phia_truoc"
  | "cang_gan"
  | "dao_gan"
  | "o_dau";

export type CauHoi = {
  loai: LoaiHoi;
  /** hướng bà con nói ("hướng Đông Bắc") — độ, 0 = Bắc */
  huong?: number;
  /** loài cá hỏi tới (khoá SPECIES_META; nhóm "cá ngừ" ⇒ nhiều loài) + tên đọc */
  loaiCa?: { ds: string[]; ten: string };
  /** câu có động từ đi ("dẫn tới chỗ trú bão gần nhất") ⇒ trả lời xong thì đi luôn */
  muonDi: boolean;
};

const HUONG: [RegExp, number][] = [
  [/ dong bac /, 45],
  [/ dong nam /, 135],
  [/ tay nam /, 225],
  [/ tay bac /, 315],
  [/ huong bac | phia bac | len bac /, 0],
  [/ huong nam | phia nam | xuong nam /, 180],
  [/ huong dong | phia dong | ra dong /, 90],
  [/ huong tay | phia tay /, 270],
];

// "đi" cuối câu là tiếng đệm ("cho hỏi nước lên hay xuống đi") — không phải muốn đi
const DI_RE = /^ (dan|chay|di|ve|toi|dua) | (dan|dua) (toi|ra|ve|vo|vao|duong) | (di|ve|toi|chay|ra) (toi|ra|ve|vo|vao) /;

/**
 * Loài cá trong câu → {các loài, tên đọc}. Khớp DÀI nhất thắng ("cá ngừ vằn" →
 * ngừ vằn). Nói chung chung "cá ngừ", "mực" ⇒ cả nhóm (mọi loài bắt đầu bằng
 * chữ đó). Tên ngắn có loài thiếu chữ "cá" ("ngừ vằn") — nhận cả hai cách nói.
 */
function timLoaiCa(text: string, loai: readonly string[]): { ds: string[]; ten: string } | undefined {
  // so GIỮ DẤU khi câu có dấu (bộ nghe luôn trả có dấu): bỏ dấu thì "cá ngừ ở đâu"
  // trùng loài "ngừ ồ". Câu gõ không dấu mới so kiểu bỏ dấu.
  const coDau = /[^\x00-\x7f]/.test(text);
  const chuan = (x: string) =>
    coDau ? x.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}]+/gu, " ").trim() : foldVn(x);
  const f = ` ${chuan(text)} `;
  let best: { ds: string[]; ten: string; n: number } | undefined;
  for (const sp of loai) {
    const k = chuan(sp);
    const ca = coDau ? "cá " : "ca ";
    for (const a of k.startsWith(ca) ? [k] : [k, `${ca}${k}`])
      if (f.includes(` ${a} `) && (!best || a.length > best.n)) best = { ds: [sp], ten: sp.startsWith("cá ") ? sp : `cá ${sp}`, n: a.length };
  }
  if (best) return { ds: best.ds, ten: best.ten };
  // nhóm: "cá ngừ" / "mực" / "tôm" — mọi loài bắt đầu bằng chữ đó
  for (const [goc, ten] of [["ngừ", "cá ngừ"], ["mực", "mực"], ["tôm", "tôm"]] as const) {
    const g = chuan(goc);
    if (!f.includes(` ${g} `)) continue;
    const ds = loai.filter((sp) => chuan(sp).startsWith(`${g} `));
    if (ds.length) return { ds, ten };
  }
  return undefined;
}

/** Câu hỏi chuyện MUA BÁN / giá — không phải bản đồ ("bán cá ở đâu được giá"). */
const CHO_RE = / (ban|mua|gia|thu mua|bao nhieu|nhieu tien|mot can|ky|shop|cua hang|dai ly|goi|so dien thoai|bo gio|gio hang) /;
/** Câu hỏi CÁCH làm ("câu mực dùng mồi gì") — hỏi mở, không phải "ở đâu". */
const CACH_RE = / (moi gi|dung moi|chuan bi|lam sao|vi sao|tai sao|cach) /;

/**
 * Câu → loại câu hỏi bản đồ, hoặc null (không phải câu hỏi bản đồ — để hieu-y lo).
 * `loaiCa` = danh sách tên ngắn loài app biết (SPECIES_META).
 */
export function hoiGi(text: string, loaiCa: readonly string[] = []): CauHoi | null {
  const f = ` ${foldVn(text)} `;
  if (f.trim() === "") return null;
  const muonDi = DI_RE.test(f) && !/ (co gi|nao|o dau|bao nhieu|bao xa|khong) $/.test(f);
  const huongMatch = HUONG.find(([re]) => re.test(f));
  const huong = huongMatch?.[1];
  const q = (loai: LoaiHoi, extra: Partial<CauHoi> = {}): CauHoi => ({ loai, muonDi, ...extra });

  if (/ (con nuoc|thuy trieu|trieu cuong|nuoc (lon|rong|ron|rac|len|xuong|dung|dang|kem|cuong)|trieu (len|xuong)) /.test(f)) return q("con_nuoc");
  // câu có động từ đi mà không hỏi gì ("dẫn tới Rạn Sừng") là chọn chỗ — để hieu-y lo
  if (muonDi && !/ (gan nhat|gan day|gan|nhieu|nao|o dau|co gi) /.test(f)) return null;
  const cho = CHO_RE.test(f) || CACH_RE.test(f);

  const sp = timLoaiCa(text, loaiCa);
  if (!cho && sp && / (o dau|cho nao|nhieu|vung nao|huong nao|ben nao|danh|bat|cau|kiem|co khong) /.test(f)) return q("ca", { loaiCa: sp });
  if (!cho && / (cho nao|o dau|vung nao|huong nao) (nhieu|co) ca | (nhieu|co) ca (khong|o dau|cho nao) | du bao ca | ca (o dau|cho nao|nhieu) /.test(f))
    return q("ca", sp ? { loaiCa: sp } : {});
  if (/ (tru bao|tranh bao|nup bao|tranh tru) /.test(f)) return q("tru_bao");
  if (!cho && / (den bien|ngon hai dang|hai dang (nao|gan|o dau)) /.test(f)) return q("den_bien");
  if (/ (xac tau|tau dam|tau chim|vat chim|chuong ngai) /.test(f)) return q("xac_tau");
  if (!cho && / (phao|tieu|bao hieu) /.test(f) && !/ (ao phao|phao cuu sinh|cuu sinh) /.test(f) && / (gan|nao|o dau|phia|ke tiep|co) /.test(f))
    return q("phao");
  if (!/ (phat|tien) /.test(f) && / (vung cam|khu cam|bao ton|cam (danh|bat|khai thac|vao|neo|tha)|duoc (danh|bat|tha luoi|tha cau|neo)|co cam) /.test(f))
    return q("vung_cam");
  if (/ (sau bao nhieu|do sau|nuoc sau|sau khong|can khong|nuoc can|bao nhieu met nuoc|may met nuoc) /.test(f)) return q("do_sau");
  if (/ (ran|bai can|da ngam|bai da|bai ngam|ghenh) /.test(f) && / (gan|nao|dau|co|khong|phia) /.test(f)) return q("ran_gan");
  if (/ (phia truoc|truoc mat|tren duong|doc duong) /.test(f) || (huong != null && / (co gi|nguy hiem|ra sao|the nao|sao) /.test(f)))
    return q("phia_truoc", huong != null ? { huong } : {});
  if (/ (cang|ben|cua bien)( ca)? (nao )?gan( nhat)? | (cang|ben) nao /.test(f)) return q("cang_gan");
  if (/ (dao|hon|cu lao|quan dao)( nao)? gan | gan (dao|hon|cu lao) | (dao|hon) nao | gan (cho|dau) nao /.test(f)) return q("dao_gan");
  if (/ (dang|minh|tau|toi|tui) (dang )?o (dau|cho nao) | day la (dau|cho nao) | toa do (cua )?(toi|minh|tau|cho nay) /.test(f))
    return q("o_dau");
  return null;
}

/* ── kho lớp — mọi thứ có thể thiếu (chưa tải, mất sóng lần đầu) ─────────── */

export type Diem = { lat: number; lon: number };
export type ChoTen = Diem & { ten: string };

export type KhoBanDo = {
  /** đảo/hòn có tên */
  dao?: readonly ChoTen[];
  /** rạn/bãi/đá có tên */
  ran?: readonly ChoTen[];
  /** phao, tiêu, báo hiệu (OSM + Cục Hàng hải) */
  phao?: readonly Seamark[];
  den?: readonly DenBien[];
  xacTau?: readonly XacTau[];
  truBao?: readonly KhuTruBao[];
  vung?: readonly VungQuanLy[];
  /** vùng cấm vẽ trên hải đồ (vn-sea-lanes `vungcam`) */
  vungCam?: readonly { ten: string; loai: string; ring: [number, number][] }[];
  /** giàn khoan / công trình biển */
  gian?: readonly ChoTen[];
  conNuoc?: readonly TideStation[];
  doSau?: DepthGrid;
  cang?: readonly SenDest[];
  /** bản đồ cá: ô điểm + ngày; "premium"/"dang-nhap" khi tài khoản chưa mở */
  ca?: { cells: readonly FishCell[]; ngay?: string } | "premium" | "dang-nhap";
};

export type ViTri = Diem & {
  /** "tau" = GPS tàu còn mới · "ban-do" = chỗ đang xem */
  nguon: "tau" | "ban-do";
  /** hướng chạy của tàu (độ) khi có */
  huongChay?: number | null;
};

export type TraLoi = {
  say: string;
  /** chỗ để bản đồ bay tới / ghim tạm */
  cho?: Diem & { ten: string };
  /** câu có "dẫn/đi" ⇒ đi luôn tới chỗ này */
  di?: SenDest;
};

/** Gần nhất trong `maxKm`. */
function ganNhat<T extends Diem>(ds: readonly T[] | undefined, p: Diem, maxKm = Infinity): { item: T; km: number } | null {
  if (!ds) return null;
  let best: { item: T; km: number } | null = null;
  for (const it of ds) {
    if (!Number.isFinite(it.lat) || !Number.isFinite(it.lon)) continue;
    const km = haversineKm(p, it);
    if (km <= maxKm && (!best || km < best.km)) best = { item: it, km };
  }
  return best;
}

const tu = (v: ViTri) => (v.nguon === "tau" ? "tàu" : "chỗ đang xem");

/** "hướng Đông Bắc, chừng 12 hải lý" */
function huongXa(v: ViTri, t: Diem, unit: SpeechUnit): string {
  const km = haversineKm(v, t);
  if (km < 0.3) return "ngay tại đây";
  return `hướng ${windDirectionVN(bearingDeg(v, t))}, ${distSpeech(km, unit)}`;
}

const hoaDau = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Loại câu hỏi + kho + vị trí → câu đọc. Không ném. */
export function traLoi(q: CauHoi, kho: KhoBanDo, v: ViTri, unit: SpeechUnit, nowMs: number): TraLoi {
  const chuaCo = (lop: string): TraLoi => ({ say: `Máy chưa có ${lop}. Bà con mở bản đồ lúc còn sóng để máy tải về.` });
  const xa = (t: Diem) => huongXa(v, t, unit);

  switch (q.loai) {
    case "dao_gan": {
      if (!kho.dao) return chuaCo("lớp đảo");
      const g = ganNhat(kho.dao, v, 400);
      if (!g) return { say: `Trong 200 hải lý quanh ${tu(v)} máy không có đảo nào có tên.` };
      const ten = g.item.ten;
      return { say: `Gần ${tu(v)} nhất là ${ten}, ${xa(g.item)}.`, cho: { ...g.item, ten }, di: q.muonDi ? { name: ten, lat: g.item.lat, lon: g.item.lon, kind: "diem" } : undefined };
    }
    case "ran_gan": {
      if (!kho.ran && !kho.doSau) return chuaCo("lớp rạn");
      const lop = kho.doSau ? depthClassAt(kho.doSau, v.lat, v.lon) : null;
      const tai = lop === 1 ? `${hoaDau(tu(v))} đang ở vùng rạn đá, dò kỹ đáy. ` : "";
      const g = ganNhat(kho.ran, v, 200);
      if (!g) return { say: `${tai}Trong 100 hải lý không có rạn nào có tên trên hải đồ của máy.` };
      return { say: `${tai}Rạn có tên gần nhất là ${g.item.ten}, ${xa(g.item)}.`, cho: g.item };
    }
    case "do_sau": {
      if (!kho.doSau) return chuaCo("lưới độ sâu");
      const lop = depthClassAt(kho.doSau, v.lat, v.lon);
      if (lop == null) return { say: "Chỗ này nằm ngoài lưới độ sâu của máy." };
      return { say: `${hoaDau(tu(v))}: ${DEPTH_CLASS_LABEL[lop].toLowerCase()}. Số theo hải đồ, chỉ để tham khảo, nhớ dò đáy.` };
    }
    case "phia_truoc":
      return phiaTruoc(q, kho, v, unit);
    case "den_bien": {
      if (!kho.den) return chuaCo("lớp đèn biển");
      const g = ganNhat(kho.den.filter((d) => d.ten), v, 400);
      if (!g) return { say: "Trong 200 hải lý máy không có đèn biển nào có tên." };
      return { say: `Đèn biển ${g.item.ten}, ${xa(g.item)}.`, cho: { ...g.item, ten: `Đèn biển ${g.item.ten}` } };
    }
    case "phao": {
      if (!kho.phao) return chuaCo("lớp phao tiêu");
      const g = ganNhat(kho.phao, v, 100);
      if (!g) return { say: "Trong 50 hải lý máy không có phao tiêu nào." };
      return { say: `${hoaDau(seamarkLabel(String(g.item.type)))} gần nhất, ${xa(g.item)}.`, cho: { ...g.item, ten: seamarkLabel(String(g.item.type)) } };
    }
    case "xac_tau": {
      if (!kho.xacTau) return chuaCo("lớp xác tàu");
      const g = ganNhat(kho.xacTau, v, 100);
      if (!g) return { say: "Trong 50 hải lý máy không có xác tàu hay chướng ngại nào được báo." };
      const ten = g.item.ten ? `${xacTauLabel(g.item.loai)} ${g.item.ten}` : xacTauLabel(g.item.loai);
      return { say: `${hoaDau(ten)}, ${xa(g.item)}. Tránh xa.`, cho: { ...g.item, ten } };
    }
    case "tru_bao": {
      if (!kho.truBao) return chuaCo("danh sách khu tránh trú bão");
      const g = ganNhat(kho.truBao, v);
      if (!g) return { say: "Máy chưa có khu tránh trú bão nào." };
      const ten = `khu tránh trú bão ${g.item.ten}`;
      return {
        say: `Gần nhất là ${ten}, ${xa(g.item)}.`,
        cho: { ...g.item, ten },
        di: q.muonDi ? { name: hoaDau(ten), lat: g.item.lat, lon: g.item.lon, kind: "diem" } : undefined,
      };
    }
    case "vung_cam":
      return vungCam(kho, v, nowMs, unit);
    case "con_nuoc": {
      if (!kho.conNuoc) return chuaCo("bảng con nước");
      const c = tideCardAt(kho.conNuoc, v.lat, v.lon, nowMs);
      if (!c) return { say: "Máy chưa tính được con nước chỗ này." };
      const xu = c.trend === "len" ? "nước đang lên" : c.trend === "xuong" ? "nước đang xuống" : "nước đang đứng";
      const ke = c.upcoming[0];
      const sau = ke ? ` ${ke.kind === "high" ? "Nước lớn" : "Nước ròng"} lúc ${clockSpeech(ke.atMs)}${ke.ngayMai ? " mai" : ""}.` : "";
      const xaTram = c.far ? " Trạm ở xa, chỉ biết lên hay xuống." : "";
      return { say: `Trạm ${c.station.name}: ${xu}.${sau}${xaTram}` };
    }
    case "cang_gan": {
      if (!kho.cang?.length) return chuaCo("danh sách cảng");
      const g = ganNhat(kho.cang, v);
      if (!g) return { say: "Máy chưa có cảng nào." };
      return {
        say: `Cảng gần nhất là ${g.item.name}, ${xa(g.item)}.`,
        cho: { lat: g.item.lat, lon: g.item.lon, ten: g.item.name },
        di: q.muonDi ? g.item : undefined,
      };
    }
    case "o_dau": {
      const g = ganNhat(kho.dao, v, 200);
      const gan = g ? ` Gần ${g.item.ten}, ${xa(g.item)}.` : "";
      return { say: `${hoaDau(tu(v))} ở ${toaDoNoi(v.lat, "lat")}, ${toaDoNoi(v.lon, "lon")}.${gan}` };
    }
    case "ca":
      return ca(q, kho, v, unit);
  }
}

function toaDoNoi(x: number, truc: "lat" | "lon"): string {
  const a = Math.abs(x);
  let d = Math.floor(a);
  let m = Math.round((a - d) * 60);
  if (m === 60) {
    d += 1;
    m = 0;
  }
  return `${d} độ ${m} phút ${truc === "lat" ? (x >= 0 ? "Bắc" : "Nam") : x >= 0 ? "Đông" : "Tây"}`;
}

/** Điểm cách `p` một đoạn `km` theo hướng `deg` (phẳng — đủ cho ≤ 40 km). */
function diToi(p: Diem, deg: number, km: number): Diem {
  const r = (deg * Math.PI) / 180;
  return { lat: p.lat + (km * Math.cos(r)) / 111.32, lon: p.lon + (km * Math.sin(r)) / (111.32 * Math.cos((p.lat * Math.PI) / 180)) };
}

const TAM_KM = 20; // ~11 hải lý — đủ xa để kịp lái
const NON_DEG = 20; // nón ±20° quanh hướng

function phiaTruoc(q: CauHoi, kho: KhoBanDo, v: ViTri, unit: SpeechUnit): TraLoi {
  const huong = q.huong ?? (v.huongChay != null && Number.isFinite(v.huongChay) ? v.huongChay : null);
  if (huong == null)
    return { say: "Tàu chưa chạy nên máy chưa biết phía trước. Bà con nói thêm hướng, ví dụ: hướng Đông Bắc có gì." };
  const nhan = q.huong != null ? `Hướng ${windDirectionVN(huong)}` : "Phía trước";
  const thay: { km: number; noi: string }[] = [];
  const trongNon = (t: Diem) => {
    const km = haversineKm(v, t);
    if (km > TAM_KM || km < 0.05) return null;
    const d = Math.abs(((bearingDeg(v, t) - huong + 540) % 360) - 180);
    return d <= NON_DEG ? km : null;
  };
  // độ sâu dọc tia: chỗ cạn/rạn ĐẦU TIÊN
  if (kho.doSau) {
    for (let km = 0.5; km <= TAM_KM; km += 0.5) {
      const p = diToi(v, huong, km);
      const lop = depthClassAt(kho.doSau, p.lat, p.lon);
      if (lop != null && lop <= 3) {
        thay.push({ km, noi: lop === 0 ? "bờ đảo" : lop === 1 ? "rạn đá" : DEPTH_CLASS_LABEL[lop].toLowerCase() });
        break;
      }
    }
  }
  const them = (ds: readonly Diem[] | undefined, ten: (x: never) => string) => {
    for (const it of ds ?? []) {
      const km = trongNon(it);
      if (km != null) thay.push({ km, noi: ten(it as never) });
    }
  };
  them(kho.xacTau, (x: XacTau) => {
    const nhan = xacTauLabel(x.loai).toLowerCase(); // giữa câu: "xác tàu chìm", không "Xác…"
    return x.ten ? `${nhan} ${x.ten}` : nhan;
  });
  them(kho.gian, () => "giàn khoan");
  them(kho.dao, (x: ChoTen) => x.ten);
  them(kho.ran, (x: ChoTen) => x.ten);
  them(kho.den, (x: DenBien) => (x.ten ? `đèn biển ${x.ten}` : "đèn biển"));
  thay.sort((a, b) => a.km - b.km);
  // cùng tên lặp (đảo có nhiều điểm) chỉ đọc một lần
  const da = new Set<string>();
  const chon = thay.filter((t) => (da.has(t.noi) ? false : (da.add(t.noi), true))).slice(0, 3);
  const thieu = !kho.doSau || !kho.xacTau || !kho.dao;
  if (!chon.length)
    return {
      say: thieu
        ? `${nhan}: máy chưa có đủ hải đồ chỗ này để nói.`
        : `${nhan} trong ${distSpeech(TAM_KM, unit)}: hải đồ của máy không ghi gì. Vẫn canh chừng.`,
    };
  const ds = chon.map((t) => `${t.noi}, ${distSpeech(t.km, unit)}`).join("; ");
  return { say: `${nhan} trong ${distSpeech(TAM_KM, unit)}: ${ds}.` };
}

function vungCam(kho: KhoBanDo, v: ViTri, nowMs: number, unit: SpeechUnit): TraLoi {
  if (!kho.vung && !kho.vungCam) return { say: "Máy chưa có lớp khu bảo tồn và vùng cấm." };
  const d = new Date(nowMs);
  const cau: string[] = [];
  for (const z of kho.vung ?? []) {
    if (!trongVung(z, v.lon, v.lat)) continue;
    const cam = z.mua.length ? dangCam(z.mua, d) : z.loai !== "bao-ve-nguon-loi";
    cau.push(`${hoaDau(tu(v))} đang trong ${moTaVung(z, d)}${cam ? ". Đang cấm khai thác" : ". Hôm nay ngoài mùa cấm"}`);
  }
  for (const z of kho.vungCam ?? [])
    if (pointInRing(v, z.ring)) cau.push(`${hoaDau(tu(v))} đang trong ${z.ten || "vùng cấm trên hải đồ"}`);
  if (cau.length) return { say: `${cau.join(". ")}.` };
  // không ở trong ⇒ nói khu gần nhất để bà con tránh
  const gan = ganNhat(kho.vung, v, 60);
  const them = gan ? ` Khu gần nhất là ${gan.item.ten}, ${huongXa(v, gan.item, unit)}.` : "";
  return { say: `${hoaDau(tu(v))} không nằm trong khu bảo tồn hay vùng cấm nào máy có.${them}` };
}

function ca(q: CauHoi, kho: KhoBanDo, v: ViTri, unit: SpeechUnit): TraLoi {
  if (kho.ca === "premium") return { say: "Dự báo cá dành cho tài khoản premium. Bà con liên hệ SDVICO để mở." };
  if (kho.ca === "dang-nhap") return { say: "Bà con đăng nhập để xem dự báo cá." };
  if (!kho.ca?.cells.length) return { say: "Máy chưa có bản đồ cá. Bà con bật lớp cá lúc còn sóng để máy tải về." };
  const sp = q.loaiCa;
  let best: { c: FishCell; v: number; km: number } | null = null;
  for (const c of kho.ca.cells) {
    const diem = sp ? Math.max(0, ...sp.ds.map((k) => c.sp?.[k] ?? 0)) : c.s;
    if (diem < 60) continue;
    const km = haversineKm(v, c);
    // điểm cao mà gần thì hơn: trừ 1 điểm mỗi 10 km
    const uu = diem - km / 10;
    if (!best || uu > best.v - best.km / 10) best = { c, v: diem, km };
  }
  const loai = sp ? sp.ten : "cá";
  if (!best) return { say: `Bản đồ cá ${kho.ca.ngay ? `ngày ${kho.ca.ngay} ` : ""}không có chỗ nào ${loai} đạt mức khá.` };
  const muc = best.v >= 75 ? "cao" : "khá";
  const top = !sp && best.c.top.length ? ` Nhiều nhất là ${best.c.top.slice(0, 2).join(", ")}.` : "";
  return {
    say: `Chỗ ${loai} ${muc} gần nhất: ${huongXa(v, best.c, unit)}.${top} Đây là dự báo, không chắc chắn.`,
    cho: { lat: best.c.lat, lon: best.c.lon, ten: `Chỗ ${loai}` },
    di: q.muonDi ? { name: `chỗ ${loai}`, lat: best.c.lat, lon: best.c.lon, kind: "diem" } : undefined,
  };
}
