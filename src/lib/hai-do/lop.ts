/*
  CHẾ ĐỘ HẢI ĐỒ — ĐỢT 3 (2026-11-04): khay Lớp + tô nông + tự đổi màu theo mặt trời
  + báo va chạm AIS. Thuần, có test.

  Đối chiếu: OpenCPN Display Category (Base · Standard · All), Shallow/Safety/Deep +
  "two shades"; iSailor ChartOptions All/Custom/Simplified, Daylight/Dusk/Night,
  CPA/TCPA alarm. Chỉ chức năng — màu, ngưỡng tự đặt.
*/

import { DEPTH_BANDS } from "@/lib/ocean-map";
import type { BangMau } from "@/lib/hai-do/bang-mau";
import type { MucTieu } from "@/lib/ais-cpa";
import { distToSegmentKm } from "@/lib/route-storm";
import { haversineKm, type LatLon } from "@/lib/geo";

/* ── MỨC HIỂN THỊ ─────────────────────────────────────────────────────────── */

export type MucHienThi = "co-ban" | "chuan" | "du";
export const MUC_HIEN_THI: readonly MucHienThi[] = ["co-ban", "chuan", "du"];
export const NHAN_MUC: Record<MucHienThi, string> = { "co-ban": "Cơ bản", chuan: "Chuẩn", du: "Đủ" };

export interface NhomLop {
  /** phao, tiêu, báo hiệu Cục Hàng hải */
  baoHieu: boolean;
  /** tuyến, luồng, phân luồng */
  luong: boolean;
  /** cáp ngầm, ống dẫn, giàn khoan, vùng cấm */
  camCap: boolean;
}

/**
 * Cơ bản = bờ, đảo, đẳng sâu, đường an toàn, đèn biển, xác tàu (thứ PHẢI thấy để
 * không mắc cạn, đâm vật). Chuẩn = + báo hiệu + cáp, ống, giàn, vùng cấm (tàu cá thả neo,
 * kéo lưới đáy — khác S-52 xếp cáp/ống vào "Other"; xem phần CÔNG TRÌNH dưới). Đủ = + luồng.
 * Xác tàu + đèn biển + đường an toàn KHÔNG tắt được ở mức nào (an toàn).
 */
export function nhomTheoMuc(m: MucHienThi): NhomLop {
  return { baoHieu: m !== "co-ban", luong: m === "du", camCap: m !== "co-ban" };
}

/* ── TÔ NÔNG THEO ĐƯỜNG AN TOÀN (hai sắc kiểu OpenCPN) ─────────────────────── */

/** Màu nước NÔNG hơn đường an toàn — lam rõ hơn nền, nét đẳng sâu vẫn ≥ 3:1 (test). */
export const MAU_NONG = "#c4dceb";

/**
 * Màu từng dải độ sâu khi tô nông: dải nào có ĐÁY (toM) ≤ đường an toàn ⇒ MAU_NONG,
 * còn lại giữ màu gốc. Trả map id lớp style → màu (sea-bg là dải 0–10).
 */
export function mauDaiToNong(anToanM: number): Record<string, string> {
  // lớp style của buildMapStyle: sea-bg (0–10), isobath-du-nuoc (≥10 → tới 20), isobath-dai-2 (≥20), isobath-dai-3 (≥50)
  const ids = ["sea-bg", "isobath-du-nuoc", "isobath-dai-2", "isobath-dai-3"];
  const out: Record<string, string> = {};
  DEPTH_BANDS.forEach((b, k) => {
    const day = k === 0 ? 0 : DEPTH_BANDS[k - 1].toM; // mức nông nhất của dải
    out[ids[k]] = day < anToanM ? MAU_NONG : b.color;
  });
  return out;
}

/* ── TỰ ĐỔI MÀU THEO MẶT TRỜI ─────────────────────────────────────────────── */

/** Độ cao mặt trời (độ) tại vị trí + thời điểm — công thức NOAA rút gọn, sai số < 1°. */
export function doCaoMatTroi(lat: number, lon: number, ms: number): number {
  const d = ms / 86400000 + 2440587.5 - 2451545.0; // ngày từ J2000
  const g = ((357.529 + 0.98560028 * d) % 360) * (Math.PI / 180);
  const q = (280.459 + 0.98564736 * d) % 360;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * (Math.PI / 180);
  const e = (23.439 - 0.00000036 * d) * (Math.PI / 180);
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const ha = ((gmst * 15 + lon) * Math.PI) / 180 - ra;
  const phi = (lat * Math.PI) / 180;
  return (Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(ha)) * 180) / Math.PI;
}

/** Ngày khi mặt trời > 6°, chiều (hoàng hôn dân sự) −6…6°, đêm < −6°. */
export function bangTheoTroi(doCao: number): BangMau {
  return doCao > 6 ? "ngay" : doCao >= -6 ? "chieu" : "dem";
}

/* ── BÁO VA CHẠM AIS ──────────────────────────────────────────────────────── */

/** Ngưỡng báo: gần nhất < 0,5 hải lý trong vòng 12 phút tới (iSailor/OpenCPN chỉnh được; đây mặc định). */
export const CPA_NM = 0.5;
export const TCPA_PHUT = 12;

/** Câu báo cho tàu NGUY nhất (null = không có). `hl` = hàm in hải lý theo đơn vị bà con chọn. */
export function cauCpa(ds: readonly MucTieu[], hl: (nm: number) => string): string | null {
  const nguy = ds
    .filter((m) => !m.tinCu && m.cpaNm != null && m.tcpaPhut != null && m.tcpaPhut >= 0 && m.cpaNm < CPA_NM && m.tcpaPhut <= TCPA_PHUT)
    .sort((a, b) => (a.tcpaPhut ?? 0) - (b.tcpaPhut ?? 0))[0];
  if (!nguy) return null;
  const ten = nguy.tau.ten ? `Tàu ${nguy.tau.ten}` : "Một tàu";
  return `${ten} sẽ cách ${hl(nguy.cpaNm!)} sau ${Math.max(1, Math.round(nguy.tcpaPhut!))} phút`;
}

/* ── CÔNG TRÌNH NGẦM / TRÊN BIỂN — cáp, ống, giàn (2026-11-04, anh Long: "hoàn thiện đi") ─
   Chuẩn S-52 xếp cáp/ống vào nhóm "Other" (chỉ hiện ở mức All) — chuẩn viết cho TÀU HÀNG.
   Tàu cá thả neo + kéo lưới đáy: móc cáp là mất lưới, đứt cáp, có khi lật tàu ⇒ ở đây
   cáp/ống/giàn/vùng cấm thuộc mức CHUẨN (mặc định) và có báo động khi neo gần / vào vòng giàn. */


/** Vòng cấm quanh công trình biển (cấm neo, cấm đánh bắt — thông lệ 500 m). */
export const VONG_GIAN_M = 500;
/** Neo cách cáp/ống gần hơn mức này ⇒ báo (neo trôi + xích neo quét đáy vài trăm mét). */
export const NEO_GAN_CAP_M = 500;

export type LoaiCongTrinh = "cap-quang" | "cap-dien" | "cap" | "ong-dau-khi" | "ong-xa" | "ong" | "gian";

/** Xếp loại từ `kind` + `loai` của vn-sea-lanes (thuần). */
export function loaiCongTrinh(kind: string, loai?: string | null): LoaiCongTrinh | null {
  if (kind === "giankhoan") return "gian";
  if (kind === "cap") return loai === "quang" ? "cap-quang" : loai === "dien" ? "cap-dien" : "cap";
  if (kind === "ong") return loai === "khi" || loai === "dau" || loai === "nhien-lieu" ? "ong-dau-khi" : loai === "xa-thai" || loai === "nuoc" ? "ong-xa" : "ong";
  return null;
}

export const TEN_CONG_TRINH: Record<LoaiCongTrinh, string> = {
  "cap-quang": "Cáp quang ngầm",
  "cap-dien": "Cáp điện ngầm",
  cap: "Cáp ngầm",
  "ong-dau-khi": "Ống dầu khí ngầm",
  "ong-xa": "Ống xả / lấy nước ngầm",
  ong: "Ống ngầm",
  gian: "Giàn khoan / công trình biển",
};

/** Câu dặn khi chạm — một câu, đời thường. */
export function canDanCongTrinh(l: LoaiCongTrinh): string {
  return l === "gian"
    ? `Không vào trong ${VONG_GIAN_M} m — cấm neo, cấm đánh bắt`
    : "Không thả neo, không kéo lưới đáy ở đây";
}

type Feat = { type: "Feature"; properties: Record<string, unknown> | null; geometry: GeoJSON.Geometry };

function khoangCachToiHinhKm(p: LatLon, g: GeoJSON.Geometry): number {
  const ds = (line: number[][]) => {
    let m = Infinity;
    for (let k = 1; k < line.length; k++) {
      m = Math.min(m, distToSegmentKm(p, { lat: line[k - 1][1], lon: line[k - 1][0] }, { lat: line[k][1], lon: line[k][0] }));
    }
    return m;
  };
  if (g.type === "Point") return haversineKm(p, { lat: g.coordinates[1], lon: g.coordinates[0] });
  if (g.type === "LineString") return ds(g.coordinates);
  if (g.type === "MultiLineString") return Math.min(...g.coordinates.map(ds));
  return Infinity;
}

/**
 * Cảnh báo công trình cho tàu/neo (thuần):
 *  · tàu trong vòng VONG_GIAN_M của giàn ⇒ "Đang trong vòng 500 m quanh giàn khoan";
 *  · đang neo và neo cách cáp/ống < NEO_GAN_CAP_M ⇒ "Neo cách cáp quang ngầm 230 m — dễ móc".
 * Trả câu GẦN/nguy nhất, null nếu yên.
 */
export function canhBaoCongTrinh(ds: readonly Feat[], tau: LatLon | null, neo: LatLon | null): string | null {
  let gian: number | null = null;
  let cap: { m: number; l: LoaiCongTrinh } | null = null;
  for (const f of ds) {
    const l = loaiCongTrinh(String(f.properties?.kind ?? ""), (f.properties?.loai as string | undefined) ?? null);
    if (!l) continue;
    if (l === "gian" && tau) {
      const m = khoangCachToiHinhKm(tau, f.geometry) * 1000;
      if (m <= VONG_GIAN_M && (gian == null || m < gian)) gian = m;
    } else if (l !== "gian" && neo) {
      const m = khoangCachToiHinhKm(neo, f.geometry) * 1000;
      if (m <= NEO_GAN_CAP_M && (!cap || m < cap.m)) cap = { m, l };
    }
  }
  if (cap) return `Neo cách ${TEN_CONG_TRINH[cap.l].toLowerCase()} ${Math.round(cap.m)} m — dễ móc`;
  if (gian != null) return `Đang trong vòng ${VONG_GIAN_M} m quanh giàn khoan`;
  return null;
}

/* ── DANH SÁCH TÀU AIS (bảng §8 hàng 11, sau đợt 4) ─────────────────────────
   iSailor AIS list sắp theo tên/cự ly/TCPA; OpenCPN AIS Target List sắp mọi cột.
   Ở đây hai cách bà con cần: "Sắp gặp" (TCPA tăng dần — tàu nào tới sát trước thì
   đứng đầu) và "Gần nhất". Tin cũ / đã qua / không tính được CPA xếp sau, theo cự ly. */

export type SapAis = "tcpa" | "cach" | "ten";
export const SAP_AIS: readonly SapAis[] = ["tcpa", "cach", "ten"];

/** Còn đang tới gần (TCPA ≥ 0, tin còn mới) — mới đáng xếp theo TCPA. */
const dangToi = (m: MucTieu) => !m.tinCu && m.tcpaPhut != null && m.tcpaPhut >= 0;

/** Xếp mục tiêu cho danh sách (thuần, không đổi mảng gốc). */
export function sapMucTieu(ds: readonly MucTieu[], theo: SapAis): MucTieu[] {
  const out = [...ds];
  if (theo === "cach") return out.sort((a, b) => a.cachNm - b.cachNm);
  // theo tên (iSailor AIS list: Name) — tìm tàu bạn theo số hiệu; tàu chưa rõ tên xuống cuối, cùng tên thì gần trước
  if (theo === "ten")
    return out.sort((a, b) => {
      const ta = a.tau.ten?.trim();
      const tb = b.tau.ten?.trim();
      if (!ta !== !tb) return ta ? -1 : 1;
      return (ta && tb ? ta.localeCompare(tb, "vi", { numeric: true }) : 0) || a.cachNm - b.cachNm;
    });
  return out.sort((a, b) => {
    const ta = dangToi(a);
    const tb = dangToi(b);
    if (ta !== tb) return ta ? -1 : 1;
    if (ta && tb) return a.tcpaPhut! - b.tcpaPhut! || a.cachNm - b.cachNm;
    return a.cachNm - b.cachNm;
  });
}

/* ── LỚP GIÓ / SÓNG TOÀN VÙNG + TUA GIỜ (bảng §8 hàng 17) ───────────────────
   Dùng lại lưới `lib/forecast-grid` của màn cũ (cùng kho, cùng bản lưu offline,
   cùng luật gói `soNgayThoiTiet`: thường/khách chỉ hôm nay). */

/** Khung giờ gần "bây giờ" nhất trong `times` (ISO giờ VN). Rỗng ⇒ 0. */
export function khungHienTai(times: readonly string[], nowMs: number): number {
  const muon = nowMs + 7 * 3_600_000; // giờ VN đọc như UTC
  let best = 0;
  let bestD = Infinity;
  times.forEach((t, i) => {
    const ms = Date.parse(`${t.length === 13 ? `${t}:00` : t.slice(0, 16)}Z`);
    if (!Number.isFinite(ms)) return;
    const d = Math.abs(ms - muon);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/** Lưới đã QUA hết (mốc cuối cũ hơn bây giờ quá một bước 3 giờ) — bản lưu từ chuyến trước. Nói thẳng,
 *  không để bà con tưởng mũi tên là gió hôm nay. */
export function luoiDaQua(times: readonly string[], nowMs: number): boolean {
  const cuoi = times[times.length - 1];
  if (!cuoi) return false;
  const ms = Date.parse(`${cuoi.slice(0, 16)}Z`) - 7 * 3_600_000;
  return Number.isFinite(ms) && ms < nowMs - 3 * 3_600_000;
}
