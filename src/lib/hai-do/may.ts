/*
  CHẾ ĐỘ HẢI ĐỒ — ĐỢT 2 (2026-11-04): phần "máy hải đồ" thuần, có test.
    · hướng bản đồ (Bắc lên / Hướng đi lên / Tuyến lên) + làm mượt hướng
    · độ sâu dưới tàu theo lưới (chỉ có DẢI, không có số mét)
    · canh neo · người rơi xuống biển (MOB) · đo phương vị/cự ly · vòng cự ly
    · kho báo động chung
  Đối chiếu iSailor (ChartOrientation, AnchorWatch, MOB, ERBL, AlarmMonitor) và
  OpenCPN (Course Up, Measure, Range rings, CPA alert) — chỉ chức năng, không chép.
*/

import { bearingDeg, type LatLon } from "@/lib/route-plan";
import { haversineKm } from "@/lib/geo";
import type { DepthClass } from "@/lib/depth-grid";
import { diemTheoPhuongVi } from "@/lib/hai-do/an-toan";

/* ── HƯỚNG BẢN ĐỒ ─────────────────────────────────────────────────────────── */

export type HuongBanDo = "bac" | "huong-di" | "tuyen";
export const HUONG_BAN_DO: readonly HuongBanDo[] = ["bac", "huong-di", "tuyen"];
export const NHAN_HUONG: Record<HuongBanDo, string> = { bac: "Bắc lên", "huong-di": "Hướng đi lên", tuyen: "Tuyến lên" };

/** Nấc kế tiếp khi chạm nút hướng; không có tuyến thì bỏ qua "Tuyến lên". */
export function huongKeTiep(h: HuongBanDo, coTuyen: boolean): HuongBanDo {
  const ds = coTuyen ? HUONG_BAN_DO : HUONG_BAN_DO.filter((x) => x !== "tuyen");
  const i = ds.indexOf(h);
  return ds[(i + 1) % ds.length] ?? "bac";
}

/** Làm mượt hướng trên vòng tròn (359° → 1° không quay ngược cả vòng). k ∈ (0,1]: phần của số mới. */
export function lamMuotHuong(cu: number | null, moi: number, k = 0.3): number {
  if (cu == null || !Number.isFinite(cu)) return ((moi % 360) + 360) % 360;
  const d = ((moi - cu + 540) % 360) - 180;
  return (((cu + d * k) % 360) + 360) % 360;
}

/**
 * Góc quay camera (bearing MapLibre) theo chế độ. Không có hướng (tàu đứng) ⇒ giữ
 * góc cũ — KHÔNG quay theo nhiễu GPS. Tuyến lên = phương vị chặng đang đi.
 */
export function gocCamera(
  h: HuongBanDo,
  huongTau: number | null,
  pvChang: number | null,
  gocCu: number,
): number {
  if (h === "bac") return 0;
  if (h === "tuyen") return pvChang ?? gocCu;
  return huongTau ?? gocCu;
}

/* ── ĐỘ SÂU THEO LƯỚI ─────────────────────────────────────────────────────── */

/** Chữ ngắn cho dải số (lưới chỉ có dải, không có số mét đo). */
export const DO_SAU_NGAN: Record<DepthClass, string> = {
  0: "Trên bờ",
  1: "Rạn, đá ngầm",
  2: "Dưới 2 m",
  3: "2–4 m",
  4: "4–12 m",
  5: "Trên 12 m",
};

/** Trần trên của dải (m) — lớp 1 (rạn) coi như 0. */
const TRAN_DAI: Record<DepthClass, number> = { 0: 0, 1: 0, 2: 2, 3: 4, 4: 12, 5: Infinity };

/** Chỗ này có NÔNG hơn đường an toàn không (chắc chắn nông, không đoán). */
export function nongHonAnToan(cls: DepthClass | null, anToanM: number): boolean {
  if (cls == null) return false;
  return TRAN_DAI[cls] < anToanM;
}

/* ── CANH NEO ─────────────────────────────────────────────────────────────── */

export interface Neo {
  lat: number;
  lon: number;
  banKinhM: number;
  /** epoch ms lúc thả */
  luc: number;
}

export const BAN_KINH_NEO_M = [30, 50, 100, 150] as const;
export const BAN_KINH_NEO_MAC_DINH = 50;
/** Vượt bán kính bao nhiêu lần LIÊN TIẾP mới kêu — một fix nhảy không báo nhầm. */
export const NEO_LAN_VUOT = 3;

export function khoangCachM(a: LatLon, b: LatLon): number {
  return haversineKm(a, b) * 1000;
}

/**
 * Xét một fix mới với neo. Fix kém (sai số > nửa bán kính) KHÔNG tính — không
 * cộng, không xoá đếm. Trả số lần vượt liên tiếp mới + có đang trôi không.
 */
export function xetNeo(
  neo: Neo,
  pos: LatLon,
  saiSoM: number | null,
  demCu: number,
): { cachM: number; dem: number; troi: boolean } {
  const cachM = khoangCachM(neo, pos);
  if (saiSoM != null && saiSoM > neo.banKinhM / 2) return { cachM, dem: demCu, troi: demCu >= NEO_LAN_VUOT };
  const dem = cachM > neo.banKinhM ? demCu + 1 : 0;
  return { cachM, dem, troi: dem >= NEO_LAN_VUOT };
}

/* ── NGƯỜI RƠI XUỐNG BIỂN (MOB) ────────────────────────────────────────────── */

export interface Mob {
  lat: number;
  lon: number;
  luc: number;
}

/** Giữ nút MOB bao lâu thì kích (ms) — tay ướt, tàu lắc: không chạm nhầm, không hộp hỏi. */
export const MOB_GIU_MS = 1000;

export interface ThongSoMob {
  pvDeg: number;
  cuLyKm: number;
  /** phút từ lúc rơi */
  phut: number;
  /** phút tới nơi với tốc độ hiện tại (null khi đứng) */
  toiPhut: number | null;
}

export function thongSoMob(mob: Mob, pos: LatLon, now: number, speedKmh: number | null): ThongSoMob {
  const cuLyKm = haversineKm(pos, mob);
  return {
    pvDeg: bearingDeg(pos, mob),
    cuLyKm,
    phut: Math.max(0, Math.floor((now - mob.luc) / 60000)),
    toiPhut: speedKmh != null && speedKmh > 0.5 ? Math.round((cuLyKm / speedKmh) * 60) : null,
  };
}

/* ── ĐO PHƯƠNG VỊ / CỰ LY ─────────────────────────────────────────────────── */

export function doPvCuLy(a: LatLon, b: LatLon): { pvDeg: number; cuLyKm: number } {
  return { pvDeg: bearingDeg(a, b), cuLyKm: haversineKm(a, b) };
}

/** Vòng tròn (polygon nhiều cạnh) bán kính `km` quanh tâm — cho vòng neo + vòng cự ly. */
export function vongTron(tam: LatLon, km: number, canh = 72): GeoJSON.Feature<GeoJSON.Polygon> {
  const ring: [number, number][] = [];
  for (let i = 0; i <= canh; i++) {
    const p = diemTheoPhuongVi(tam, (i * 360) / canh, km);
    ring.push([p.lon, p.lat]);
  }
  return { type: "Feature", properties: { km }, geometry: { type: "Polygon", coordinates: [ring] } };
}

/** Vòng cự ly quanh tàu (hải lý). */
export const VONG_CU_LY_NM = [1, 2, 5] as const;

/** "235°" — phương vị 3 số như máy hải đồ. */
export function fmtPv(deg: number | null): string {
  if (deg == null || !Number.isFinite(deg)) return "—";
  return `${String(Math.round(((deg % 360) + 360) % 360) % 360).padStart(3, "0")}°`;
}

/* ── BÁO ĐỘNG CHUNG ───────────────────────────────────────────────────────── */

export type MaBaoDong = "mob" | "neo" | "bao" | "nong" | "ran" | "gps" | "cpa" | "lech" | "het-tuyen";

export interface BaoDong {
  ma: MaBaoDong;
  /** do = phải nhìn ngay (kêu); vang = để ý */
  muc: "do" | "vang";
  chu: string;
}

export interface TinhHinh {
  mob: Mob | null;
  neoTroi: boolean;
  neoCachM: number | null;
  baoGan: string | null;
  doSau: DepthClass | null;
  anToanM: number;
  gpsMat: boolean;
  /** tàu AIS nguy cơ gần nhất (đợt 3) */
  cpa: string | null;
  /** lệch tuyến / hết tuyến (đợt 4) */
  lechTuyen: string | null;
  hetTuyen: boolean;
}

/** Danh sách báo động đang có, MOB trên cùng, rồi đỏ trước vàng. Thuần. */
export function dsBaoDong(t: TinhHinh): BaoDong[] {
  const ds: BaoDong[] = [];
  if (t.mob) ds.push({ ma: "mob", muc: "do", chu: "Người rơi xuống biển" });
  if (t.neoTroi) ds.push({ ma: "neo", muc: "do", chu: `Neo trôi — cách neo ${Math.round(t.neoCachM ?? 0)} m` });
  if (t.baoGan) ds.push({ ma: "bao", muc: "do", chu: t.baoGan });
  if (t.doSau === 1) ds.push({ ma: "ran", muc: "do", chu: "Đang ở vùng rạn, đá ngầm" });
  else if (nongHonAnToan(t.doSau, t.anToanM) && t.doSau !== 0)
    ds.push({ ma: "nong", muc: "do", chu: `Nước nông hơn đường an toàn ${t.anToanM} m` });
  if (t.cpa) ds.push({ ma: "cpa", muc: "do", chu: t.cpa });
  if (t.lechTuyen) ds.push({ ma: "lech", muc: "vang", chu: t.lechTuyen });
  if (t.hetTuyen) ds.push({ ma: "het-tuyen", muc: "vang", chu: "Đã tới điểm cuối tuyến" });
  if (t.gpsMat) ds.push({ ma: "gps", muc: "vang", chu: "Mất GPS — số liệu đứng" });
  return ds;
}

/** Có báo động ĐỎ nào CHƯA xác nhận không — quyết định có kêu chuông. */
export function canKeu(ds: readonly BaoDong[], daXacNhan: ReadonlySet<MaBaoDong>): boolean {
  return ds.some((b) => b.muc === "do" && !daXacNhan.has(b.ma));
}

/** Bỏ xác nhận của báo động đã hết — lần sau tái phát thì kêu lại. */
export function donXacNhan(ds: readonly BaoDong[], daXacNhan: ReadonlySet<MaBaoDong>): Set<MaBaoDong> {
  const con = new Set(ds.map((b) => b.ma));
  return new Set([...daXacNhan].filter((m) => con.has(m)));
}

/* ── TẤM CHẠM GOM — thứ tự ưu tiên vật dưới ngón tay ─────────────────────────
   iSailor gom MỌI thứ dưới ngón tay thành một danh sách; ở đây cũng vậy nhưng xếp:
   an toàn (xác tàu, đá) → báo hiệu → đèn → đảo. Cùng hạng thì GẦN NHẤT thắng
   (sửa lỗi "vật xa giành chạm" đã ghi ở rà hải đồ 09/2026). */
export const HANG_CHAM: Record<string, number> = {
  "hd-xac-tau": 0,
  "hd-vn-aid": 1,
  "hd-seamark-near": 1,
  "hd-seamark-mid": 1,
  "hd-seamark-far": 1,
  "hd-den-bien": 2,
  "hd-island-label": 3,
  "hd-island-dot": 3,
};

export interface VatCham {
  lop: string;
  i: number;
  /** khoảng cách tới điểm chạm, px màn hình */
  px: number;
}

/** Xếp vật dưới ngón tay, bỏ trùng (cùng lớp + cùng i), tối đa `toiDa`. */
export function xepCham(ds: readonly VatCham[], toiDa = 4): VatCham[] {
  const seen = new Set<string>();
  return [...ds]
    .filter((v) => v.lop in HANG_CHAM)
    .sort((a, b) => HANG_CHAM[a.lop] - HANG_CHAM[b.lop] || a.px - b.px)
    .filter((v) => {
      const k = `${v.lop.replace(/-(near|mid|far)$/, "")}:${v.i}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, toiDa);
}
