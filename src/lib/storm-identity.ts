// ĐỊNH DANH MỘT CƠN BÃO — luật THUẦN, DÙNG CHUNG cho mọi chỗ phải trả lời
// "hai bản ghi này có phải cùng một cơn không" (2026-08-18b, chủ dự án: "logic
// lưu để đảm bảo không bị trùng tên bão rồi gây lệch giữa các nguồn thì tối ưu").
//
// Trước đó có BA luật rời nhau: /api/storms gộp NCHMF↔GDACS bằng 350 km phẳng;
// kho bản tin (storm-bulletin.ts) nối cơn bằng ≤12 giờ & ≤600 km; push bão khoá
// theo tên ("atnd" cho MỌI áp thấp không tên ⇒ hai áp thấp là một, còn NCHMF
// "số 3" và GDACS "WUTIP" cùng cơn lại thành hai). Nay một chỗ:
//
//  · KHOÁ: bão có số ⇒ `bao-so-N-YYYY` (CÙNG KHUÔN với kho `stormKeyFor`, để
//    push / kho / bản đồ nói cùng một tên); áp thấp không tên ⇒ `atnd-YYYYMMDD-
//    <lat>-<lon>` (mốc thấy đầu tiên — hai áp thấp cùng ngày khác chỗ là hai
//    khoá); GDACS ⇒ `gdacs-<tên>` (chỉ dùng khi không nối được với tin VN nào).
//  · CÙNG CƠN: tâm cách nhau ≤ TRUNG_KM (350 km) khi cùng thời điểm, nới thêm
//    theo thời gian trôi qua với trần vận tốc bão TOC_DO_BAO_KMH (30 km/h) —
//    tin đã gửi 20 giờ trước mà tâm cách 700 km vẫn là cơn đó đang chạy, không
//    phải cơn mới. Không phụ thuộc tên hay nguồn.
//  · ƯU TIÊN NGUỒN: tin VN (NCHMF) đứng trước, GDACS chỉ bổ sung cơn VN chưa
//    nói tới, và khi cùng cơn thì mượn của GDACS phần VN không có (đường đi,
//    vùng ảnh hưởng) chứ không vứt.
//
// Không Date.now() trong thân hàm — `nowMs` truyền vào để test được.

import type { StormAlert } from "@/lib/storms";
import { khoangCachKm } from "@/lib/storm-bulletin";

/** Hai bản ghi CÙNG LÚC mà tâm cách dưới ngần này = một cơn (hai nguồn đo lệch) */
export const TRUNG_KM = 350;
/** Trần vận tốc di chuyển của bão/áp thấp — để nới ngưỡng theo thời gian */
export const TOC_DO_BAO_KMH = 30;
/** Nới tối đa 48 giờ (khớp cửa sổ "đã gửi" của push) */
export const NOI_TOI_DA_GIO = 48;

/** Ngưỡng km để coi là cùng cơn khi hai bản ghi cách nhau `gioCach` giờ */
export function nguongTrungKm(gioCach: number): number {
  const gio = Number.isFinite(gioCach) ? Math.max(0, Math.min(gioCach, NOI_TOI_DA_GIO)) : 0;
  return TRUNG_KM + TOC_DO_BAO_KMH * gio;
}

export type StormPoint = { lat: number; lon: number; tMs?: number | null };

/** Cùng một cơn? Chỉ nhìn tâm + thời gian, KHÔNG nhìn tên/nguồn. */
export function cungCon(a: StormPoint, b: StormPoint): boolean {
  if (![a.lat, a.lon, b.lat, b.lon].every(Number.isFinite)) return false;
  const gio =
    a.tMs != null && b.tMs != null && Number.isFinite(a.tMs) && Number.isFinite(b.tMs)
      ? Math.abs(a.tMs - b.tMs) / 3_600_000
      : 0;
  return khoangCachKm(a.lat, a.lon, b.lat, b.lon) <= nguongTrungKm(gio);
}

function slug(v: string): string {
  return v
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ngayUTC(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}

/** Số bão trong tên VN ("số 3", "Bão số 12") — null nếu không có */
export function soBaoTuTen(name: string): number | null {
  const m = /số\s*(\d{1,2})/iu.exec(name ?? "");
  return m ? Number(m[1]) : null;
}

/**
 * KHOÁ ỔN ĐỊNH THEO CƠN (không theo bản tin). `nowMs` = mốc "thấy" để đặt tên
 * áp thấp không tên; nên truyền giờ phát tin (`updated`) khi có.
 */
export function stormKeyOf(s: Pick<StormAlert, "id" | "name" | "lat" | "lon" | "updated">, nowMs: number): string {
  const phat = Date.parse(s.updated ?? "");
  const moc = Number.isFinite(phat) ? phat : nowMs;
  const so = soBaoTuTen(s.name);
  if (s.id.startsWith("nchmf-")) {
    if (so != null) return `bao-so-${so}-${new Date(moc).getUTCFullYear()}`;
    return `atnd-${ngayUTC(moc)}-${s.lat.toFixed(1)}-${s.lon.toFixed(1)}`;
  }
  const ten = slug(s.name);
  return ten ? `gdacs-${ten}` : `gdacs-${slug(s.id) || "khong-ro"}`;
}

/**
 * GỘP NGUỒN: tin VN đứng trước; GDACS chỉ thêm cơn KHÔNG nối được với cơn VN
 * nào; cùng cơn ⇒ VN mượn `track`/`areas` của GDACS nếu VN chưa có (NCHMF chỉ
 * cho toạ độ tâm, không cho polygon).
 */
export function gopNguonBao(vn: StormAlert[], gdacs: StormAlert[]): StormAlert[] {
  const dungRoi = new Set<number>();
  const vnMuon = vn.map((v) => {
    const i = gdacs.findIndex(
      (g, idx) => !dungRoi.has(idx) && cungCon(diem(v), diem(g)),
    );
    if (i < 0) return v;
    dungRoi.add(i);
    const g = gdacs[i];
    return {
      ...v,
      track: v.track.length ? v.track : g.track,
      areas: v.areas.length ? v.areas : g.areas,
      windKmh: v.windKmh ?? g.windKmh,
    };
  });
  const ngoai = gdacs.filter((_, idx) => !dungRoi.has(idx));
  return [...vnMuon, ...ngoai];
}

function diem(s: StormAlert): StormPoint {
  const t = Date.parse(s.updated ?? "");
  return { lat: s.lat, lon: s.lon, tMs: Number.isFinite(t) ? t : null };
}
