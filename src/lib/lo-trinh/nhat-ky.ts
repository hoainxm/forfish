// ĐO HIỆU QUẢ LỘ TRÌNH — CHỈ TRONG MÁY (Phase 3, 09 §6 — 2026-11-08). Khoá `forfish.trip-log.v1`.
//
// Không có số này thì mãi không chứng minh được lời hứa "đánh bắt tốt hơn". Nguyên liệu có sẵn từ Phase 1: mỗi lần bà con
// bấm "Vị trí" trên lộ trình ĐÃ LƯU là một điểm GPS thật so với tuyến đề xuất. Phase 3 GHI LẠI các lần đó + hỏi sản lượng
// sau chuyến, rồi tự so: chuyến đi SÁT tuyến có được nhiều cá hơn chuyến đi khác tuyến không.
//
// KHÔNG lên máy chủ, KHÔNG bảng Supabase (cần thì là quyết định của chủ dự án — chưa có). Chỉ đi cùng sao lưu chế độ
// `transfer` (dữ liệu bà con tự gõ). Án lệ K4: đọc hỏng ⇒ khoá cửa ghi, ghi qua `saveUserJson`, trả false khi hỏng.
// TÁCH khỏi `forfish.routes.v1` vì kho lộ trình chỉ giữ 12 bản — nhật ký phải sống lâu hơn bản lộ trình nó đo.

import { readUserList } from "@/lib/user-list-store";
import { saveUserJson } from "@/lib/user-store";
import { daysBetweenISO } from "@/lib/day-labels";
import type { LatLon } from "@/lib/geo";
import type { LoTrinhDaLuu, Nghe } from "./types";
import { LECH_HAI_LY } from "./so-vi-tri";

export const NHAT_KY_KEY = "forfish.trip-log.v1";
/** Trần số chuyến giữ trong máy — đầy thì bỏ chuyến cũ nhất */
export const MAX_CHUYEN = 60;
/** Trần số lần so vị trí mỗi chuyến */
export const MAX_VI_TRI = 200;
/** Hai lần bấm cách nhau dưới ngần này phút = một lần (bấm lại vì chưa thấy) */
export const GOP_PHUT = 10;
/** Sản lượng bà con khai (kg) — ngoài trần là gõ nhầm */
export const KG_TRAN: readonly [number, number] = [1, 500_000];
/** Mỗi nhóm cần ít nhất ngần này chuyến có sản lượng mới đem ra so (ít hơn là may rủi) */
export const TOI_THIEU_SO = 3;

export interface LanSoViTri {
  /** epoch ms */
  at: number;
  lat: number;
  lon: number;
  /** cách tuyến, hải lý */
  cachHaiLy: number;
  /** ngày thứ mấy của chuyến (1 = ngày đi) */
  ngayThu: number;
}

export interface NhatKyChuyen {
  /** id lộ trình đã lưu (`LoTrinhDaLuu.id`) */
  routeId: string;
  ten: string;
  nghe: Nghe;
  ngayDi: string;
  ngayNenVe: string;
  viTri: LanSoViTri[];
  /** sản lượng sau chuyến bà con khai; null/vắng = chưa khai */
  sanLuong?: { kg: number; luc: string } | null;
}

let readFailed = false;

export function nhatKyReadFailed(): boolean {
  return readFailed;
}

function hopLe(x: unknown): x is NhatKyChuyen {
  const r = x as NhatKyChuyen;
  return !!r && typeof r.routeId === "string" && typeof r.ngayDi === "string" && Array.isArray(r.viTri);
}

export function docNhatKy(): NhatKyChuyen[] {
  const r = readUserList<NhatKyChuyen>(NHAT_KY_KEY);
  readFailed = !r.ok;
  return (r.list ?? []).filter(hopLe);
}

/** `false` = không giữ được (đọc hỏng ⇒ khoá ghi, hoặc máy hết chỗ) — màn phải nói. */
export function ghiNhatKy(list: NhatKyChuyen[]): boolean {
  if (readFailed) return false;
  return saveUserJson(NHAT_KY_KEY, list);
}

const moi = (r: LoTrinhDaLuu): NhatKyChuyen => ({
  routeId: r.id,
  ten: r.ten,
  nghe: r.input.nghe,
  ngayDi: r.input.ngayDi,
  ngayNenVe: r.ketQua.ngayNenVe,
  viTri: [],
  sanLuong: null,
});

/** Đặt `c` lên đầu danh sách (bỏ bản cũ cùng routeId), kẹp MAX_CHUYEN. */
const datLen = (list: readonly NhatKyChuyen[], c: NhatKyChuyen): NhatKyChuyen[] =>
  [c, ...list.filter((x) => x.routeId !== c.routeId)].slice(0, MAX_CHUYEN);

export function timChuyen(list: readonly NhatKyChuyen[], routeId: string): NhatKyChuyen | null {
  return list.find((x) => x.routeId === routeId) ?? null;
}

/**
 * Ghi một lần so vị trí CỦA LỘ TRÌNH ĐÃ LƯU. Chỉ ghi trong khoảng chuyến (từ ngày đi tới hết ngày nên về + 2 ngày) — so
 * vị trí lúc ngồi nhà trước ngày đi không phải dữ liệu đi biển. Hai lần cách < GOP_PHUT phút ⇒ thay lần trước.
 * Trả danh sách mới, hoặc null khi lần này không đáng ghi.
 */
export function themLanSo(
  list: readonly NhatKyChuyen[],
  r: LoTrinhDaLuu,
  pos: LatLon,
  cachHaiLy: number,
  nowMs: number,
  todayIso: string,
): NhatKyChuyen[] | null {
  if (!Number.isFinite(pos?.lat) || !Number.isFinite(pos?.lon) || !Number.isFinite(cachHaiLy) || !Number.isFinite(nowMs)) return null;
  const ngayThu = daysBetweenISO(r.input.ngayDi, todayIso) + 1;
  if (ngayThu < 1 || daysBetweenISO(r.ketQua.ngayNenVe, todayIso) > 2) return null;
  const c = timChuyen(list, r.id) ?? moi(r);
  const lan: LanSoViTri = { at: nowMs, lat: pos.lat, lon: pos.lon, cachHaiLy: Math.max(0, Math.round(cachHaiLy)), ngayThu };
  const cu = c.viTri[c.viTri.length - 1];
  const viTri = cu && nowMs - cu.at < GOP_PHUT * 60_000 ? [...c.viTri.slice(0, -1), lan] : [...c.viTri, lan];
  return datLen(list, { ...c, viTri: viTri.slice(-MAX_VI_TRI) });
}

/** Sản lượng bà con gõ → kg hợp lệ, hoặc null. */
export function docKg(raw: string): number | null {
  const n = Number(raw.trim().replace(/\./g, "").replace(",", "."));
  if (!raw.trim() || !Number.isFinite(n)) return null;
  return n >= KG_TRAN[0] && n <= KG_TRAN[1] ? Math.round(n) : null;
}

export function ghiSanLuong(list: readonly NhatKyChuyen[], r: LoTrinhDaLuu, kg: number, nowMs: number): NhatKyChuyen[] | null {
  if (!Number.isFinite(kg) || kg < KG_TRAN[0] || kg > KG_TRAN[1]) return null;
  const c = timChuyen(list, r.id) ?? moi(r);
  return datLen(list, { ...c, sanLuong: { kg: Math.round(kg), luc: new Date(nowMs).toISOString() } });
}

/** Hỏi sản lượng khi: đã tới ngày nên về, chưa khai, và chuyến không quá 30 ngày trước (lâu quá bà con không nhớ). */
export function nenHoiSanLuong(c: NhatKyChuyen | null, r: LoTrinhDaLuu, todayIso: string): boolean {
  if (r.ketQua.chanBao) return false;
  if (c?.sanLuong) return false;
  const qua = daysBetweenISO(r.ketQua.ngayNenVe, todayIso);
  return qua >= 0 && qua <= 30;
}

/** Trung bình cách tuyến của một chuyến (hải lý), null = chưa so lần nào. */
export function cachTuyenTB(c: NhatKyChuyen): number | null {
  if (!c.viTri.length) return null;
  return c.viTri.reduce((a, x) => a + x.cachHaiLy, 0) / c.viTri.length;
}

/**
 * TỰ BACKTEST (§6 Phase 3): chuyến có sản lượng + có so vị trí chia hai nhóm theo cách tuyến trung bình ≤ / > LECH_HAI_LY
 * (cùng ngưỡng câu "đang đi khác kế hoạch"). So kg trung bình CÙNG NGHỀ. Nhóm nào dưới TOI_THIEU_SO chuyến ⇒ `duSo` false
 * — màn chỉ nói "cần thêm chuyến", không kết luận từ 1–2 chuyến.
 */
export function soBamTuyen(
  list: readonly NhatKyChuyen[],
  nghe: Nghe,
): { bam: { n: number; kgTB: number | null }; lech: { n: number; kgTB: number | null }; duSo: boolean } {
  const bam: number[] = [], lech: number[] = [];
  for (const c of list) {
    if (c.nghe !== nghe || !c.sanLuong) continue;
    const tb = cachTuyenTB(c);
    if (tb == null) continue;
    (tb <= LECH_HAI_LY ? bam : lech).push(c.sanLuong.kg);
  }
  const tb = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);
  return {
    bam: { n: bam.length, kgTB: tb(bam) },
    lech: { n: lech.length, kgTB: tb(lech) },
    duSo: bam.length >= TOI_THIEU_SO && lech.length >= TOI_THIEU_SO,
  };
}
