// DẪN ĐƯỜNG — "ĐANG TRONG VÙNG" TÁCH KHỎI "SẮP TỚI" (thuần, test: nav-vung.test.ts).
//
// Học từ VietMap Live (dịch ngược 3.4.4, 2026-11-02): biển báo chia hai loại.
// Loại ĐANG HIỆU LỰC (khu dân cư, cấm vượt, vùng tốc độ) có cặp vào/ra: vào
// thì biển nằm lì trên màn, ra thì đọc "ra khỏi" rồi gỡ. Loại SẮP TỚI (camera,
// trạm thu phí) là điểm phía trước, báo theo khoảng cách.
//
// Ở ForFish, vật điểm (xác tàu, giàn khoan, cạn) đã theo kiểu "sắp tới" trong
// `nav-hazards`. Còn VÙNG (cấm vào, khu bảo tồn, vùng cấm khai thác theo mùa,
// cấm neo) trước đây chỉ có một câu lúc chạm mép — vào rồi thì không còn gì
// trên màn nói tàu đang ở trong, ra cũng không ai báo. File này giữ danh sách
// vùng tàu ĐANG Ở TRONG (cho HUD vẽ biển nằm lì) và phát sự kiện vào/ra.
//
// Luật:
//  · Vào/ra phải giữ VUNG_XAC_NHAN lần đo liền mới tính — GPS nhảy qua lại mép
//    đa giác không được làm máy đọc "vào… ra… vào…".
//  · Vùng theo mùa chỉ tính khi ĐANG mùa cấm (cùng luật `restrictedAt`).
//  · Vùng cấm VÀO (đỏ): câu "Đang trong…" đã do `nav-hazards` đọc kèm chuông
//    ⇒ ở đây KHÔNG đọc câu vào (khỏi nói hai lần), chỉ đọc câu ra.
//  · Mất định vị thì nơi gọi KHÔNG gọi hàm này — giữ nguyên danh sách cũ, không
//    tự "ra khỏi" vì số GPS cũ.

import type { LatLon } from "@/lib/geo";
import type { NavContext } from "@/lib/nav-context";
import { pointInRing } from "@/lib/spatial-index";
import { dangCam } from "@/lib/vung-quan-ly";

/** Số lần đo liền phải thấy cùng một trạng thái mới đổi vào ↔ ra */
export const VUNG_XAC_NHAN = 2;

/** đỏ = cấm vào · vàng = cấm khai thác / bảo tồn / cấm neo / hạn chế */
export type VungMuc = "do" | "vang";

export type VungTrong = { id: string; ten: string; muc: VungMuc };

const trongHop = (
  p: LatLon,
  b: { latMin: number; latMax: number; lonMin: number; lonMax: number },
): boolean => p.lat >= b.latMin && p.lat <= b.latMax && p.lon >= b.lonMin && p.lon <= b.lonMax;

/** Mọi vùng tàu đang đứng trong (chưa khử nhiễu). Đỏ trước, rồi theo tên. */
export function vungDangTrong(
  ctx: Pick<NavContext, "noGo" | "restricted"> | null,
  pos: LatLon | null,
  nowMs: number,
): VungTrong[] {
  if (!ctx || !pos || !Number.isFinite(pos.lat) || !Number.isFinite(pos.lon)) return [];
  const out: VungTrong[] = [];
  for (const z of ctx.noGo ?? []) {
    if (z.ring.length < 3 || !trongHop(pos, z.bbox)) continue;
    if (pointInRing(pos, z.ring)) out.push({ id: z.id, ten: z.ten ?? "vùng cấm vào", muc: "do" });
  }
  const ngay = new Date(Number.isFinite(nowMs) ? nowMs : Date.now());
  for (const z of ctx.restricted ?? []) {
    if (z.mua && (!z.mua.length || !dangCam(z.mua, ngay))) continue;
    if (z.ring.length < 3 || !trongHop(pos, z.bbox)) continue;
    if (pointInRing(pos, z.ring)) out.push({ id: z.id, ten: z.ten, muc: "vang" });
  }
  return out;
}

export type VungSuKien = {
  loai: "vao" | "ra";
  id: string;
  ten: string;
  muc: VungMuc;
  /** số thứ tự sự kiện trong phiên — để key giọng đọc không trùng khi ra rồi vào lại */
  lan: number;
};

export type VungTheoDoi = {
  /** vùng đã XÁC NHẬN đang ở trong — HUD vẽ từ đây */
  trong: VungTrong[];
  /** đếm lần đo liền trái với trạng thái đã xác nhận, theo id */
  dem: Record<string, number>;
  /** vùng đang chờ xác nhận vào (để giữ tên/mức) */
  cho: Record<string, VungTrong>;
  lan: number;
};

export function initVungTheoDoi(): VungTheoDoi {
  return { trong: [], dem: {}, cho: {}, lan: 0 };
}

const xep = (a: VungTrong, b: VungTrong) =>
  (a.muc === b.muc ? 0 : a.muc === "do" ? -1 : 1) || a.ten.localeCompare(b.ten, "vi");

/**
 * Một lần đo: so danh sách vùng thô với trạng thái đã xác nhận, trả trạng thái
 * mới + sự kiện vào/ra vừa xác nhận. Không đổi gì thì trả lại ĐÚNG đối tượng cũ
 * (nơi gọi so tham chiếu để khỏi vẽ lại).
 */
export function theoDoiVung(
  prev: VungTheoDoi,
  tho: readonly VungTrong[],
): { st: VungTheoDoi; su: VungSuKien[] } {
  const thoIds = new Map(tho.map((v) => [v.id, v]));
  const trongIds = new Map(prev.trong.map((v) => [v.id, v]));
  const dem: Record<string, number> = {};
  const cho: Record<string, VungTrong> = {};
  const trong: VungTrong[] = [];
  const su: VungSuKien[] = [];
  let lan = prev.lan;
  let doi = false;

  // đang trong: còn thấy thì giữ; không thấy thì đếm tới khi đủ mới "ra"
  for (const v of prev.trong) {
    if (thoIds.has(v.id)) {
      trong.push(v);
      if (prev.dem[v.id]) doi = true;
      continue;
    }
    const n = (prev.dem[v.id] ?? 0) + 1;
    doi = true;
    if (n >= VUNG_XAC_NHAN) {
      lan += 1;
      su.push({ loai: "ra", id: v.id, ten: v.ten, muc: v.muc, lan });
    } else {
      dem[v.id] = n;
      trong.push(v);
    }
  }
  // mới thấy: đếm tới khi đủ mới "vào"
  for (const v of tho) {
    if (trongIds.has(v.id)) continue;
    const n = (prev.dem[v.id] ?? 0) + 1;
    doi = true;
    if (n >= VUNG_XAC_NHAN) {
      lan += 1;
      trong.push(v);
      su.push({ loai: "vao", id: v.id, ten: v.ten, muc: v.muc, lan });
    } else {
      dem[v.id] = n;
      cho[v.id] = v;
    }
  }
  // vùng đang chờ vào mà lần này không thấy nữa ⇒ bỏ đếm (đó là nhiễu)
  for (const id of Object.keys(prev.cho)) if (!thoIds.has(id)) doi = true;

  if (!doi) return { st: prev, su };
  trong.sort(xep);
  return { st: { trong, dem, cho, lan }, su };
}

/** Câu đọc cho sự kiện — chỉ ghép từ cụm đã có mảnh giọng (cổng ghep-giong.test.ts). */
export function cauVung(e: VungSuKien): string | null {
  if (e.loai === "ra") return `Tàu đã ở ngoài ${e.ten}.`;
  // vùng cấm vào: nav-hazards đã đọc "Đang trong…" kèm chuông lúc chạm mép
  return e.muc === "do" ? null : `Đang trong ${e.ten}.`;
}
