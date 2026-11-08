// SO VỊ TRÍ VỚI LỘ TRÌNH + cách NÓI kết quả (09-ba-spec §4 output, §5c). Thuần, chạy không cần mạng.
//  · `soViTri` — khoảng cách GPS tới tuyến (`distToSegmentKm` trên chuỗi mốc) + theo lịch, giờ này
//    đáng lẽ đang ở chặng nào. Lệch > 20 hải lý thì màn thêm MỘT câu trung tính — app là người phụ
//    việc, không báo động kiểu sai-đúng.
//  · `mucVung` — điểm vùng 0–100 → thang chữ Được/Khá/Tốt (KHÔNG in số, không hứa cá). Ngưỡng
//    dùng lại mốc "Trung bình"/"Cao" của `FISH_LEVEL_BANDS` để một thang cho cả app.
//  · `chuoiChangTuMoc` — các mốc (bỏ cảng xuất phát) → chuỗi chỗ ghé của dẫn đường nhiều chặng
//    (`route-stops`, trần MAX_STOPS): giữ cảng về ở CUỐI, quá trần thì bớt mốc giữa từ phía sau.

import { distToSegmentKm } from "@/lib/route-storm";
import { haversineKm, type LatLon } from "@/lib/geo";
import { daysBetweenISO } from "@/lib/day-labels";
import { todayIsoVN } from "@/lib/days";
import { FISH_LEVEL_BANDS } from "@/lib/fish-forecast-client";
import { addStop, MAX_STOPS, type RouteStop } from "@/lib/route-stops";
import type { LoTrinhKetQua } from "./types";

const KM_PER_NM = 1.852;
/** Lệch quá ngần này (hải lý) thì nói "đang đi khác kế hoạch" (§5c). */
export const LECH_HAI_LY = 20;

const NGUONG_KHA = FISH_LEVEL_BANDS.find((b) => b.key === "mid")!.min;
const NGUONG_TOT = FISH_LEVEL_BANDS.find((b) => b.key === "high")!.min;

export type MucVung = "Được" | "Khá" | "Tốt";

export function mucVung(dinh: number): MucVung {
  if (dinh >= NGUONG_TOT) return "Tốt";
  if (dinh >= NGUONG_KHA) return "Khá";
  return "Được";
}

export interface KetQuaSoViTri {
  /** khoảng cách tới tuyến, hải lý (làm tròn) */
  cachTuyenHaiLy: number;
  /** câu "Theo kế hoạch: …" */
  theoKeHoach: string;
  lech: boolean;
}

function cachTuyenKm(p: LatLon, moc: readonly LatLon[]): number {
  if (moc.length === 0) return Infinity;
  if (moc.length === 1) return haversineKm(p, moc[0]);
  let min = Infinity;
  for (let i = 1; i < moc.length; i++) min = Math.min(min, distToSegmentKm(p, moc[i - 1], moc[i]));
  return min;
}

const thuong = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

export function soViTri(
  kq: { moc: readonly LatLon[]; lich: LoTrinhKetQua["lich"]; soNgayTinh: number },
  ngayDi: string,
  pos: LatLon,
  nowMs: number,
): KetQuaSoViTri {
  const km = cachTuyenKm(pos, kq.moc);
  const cachTuyenHaiLy = Number.isFinite(km) ? Math.round(km / KM_PER_NM) : 0;
  const ngayThu = daysBetweenISO(ngayDi, todayIsoVN(nowMs)) + 1;
  let theoKeHoach: string;
  if (ngayThu < 1) {
    theoKeHoach = `Theo kế hoạch: chưa tới ngày xuất bến (còn ${1 - ngayThu} ngày).`;
  } else if (ngayThu > kq.soNgayTinh) {
    theoKeHoach = "Theo kế hoạch: giờ này đã về cảng.";
  } else {
    const dong = kq.lich.find((l) => l.tuNgay <= ngayThu && ngayThu <= l.denNgay);
    theoKeHoach = dong
      ? `Theo kế hoạch: ngày ${ngayThu} — ${thuong(dong.cau)}.`
      : `Theo kế hoạch: ngày ${ngayThu} của chuyến.`;
  }
  return { cachTuyenHaiLy, theoKeHoach, lech: cachTuyenHaiLy > LECH_HAI_LY };
}

/** Mốc lộ trình → chuỗi chỗ ghé cho dẫn đường. Mốc đầu (cảng xuất phát) là NƠI ĐI, không phải chỗ ghé. */
export function chuoiChangTuMoc(moc: LoTrinhKetQua["moc"]): RouteStop[] {
  const sau = moc.slice(1);
  if (!sau.length) return [];
  const cuoi = sau[sau.length - 1];
  const giua = sau.slice(0, -1).slice(0, MAX_STOPS - 1);
  let list: RouteStop[] = [];
  for (const m of [...giua, cuoi]) list = addStop(list, m.lat, m.lon, m.ten);
  return list;
}
