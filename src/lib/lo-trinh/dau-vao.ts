// ĐẦU VÀO CHO THUẬT TOÁN LỘ TRÌNH — dựng từ dữ liệu sẵn có trong app (09-ba-spec §4, §5b).
// Thuần (không React, không fetch) để test được; màn `/lo-trinh` tải dữ liệu rồi gọi các hàm này.
//  · `dungCaTheoNgay` — lớp cá theo NGÀY của chuyến = bản đồ cá (đã lọc trong vùng) pha mùa vụ
//    đúng khuôn màn bản đồ (`fishing-map-view` fishView): `baseMode` ⇒ trả nguyên; không thì
//    `blendFishCells` với tầm đếm từ NGÀY ẢNH (`fishLeadDays`), rồi lọc lại vùng biển VN.
//  · `baoTuTinBao` — tin bão → `BaoRutGon[]`; CHƯA kiểm được (mất sóng / tin quá cũ) ⇒ `null`
//    để thuật toán NÓI ra (luật `stormGateForRoute`), không coi như trời quang.
//  · `docTauTinh` / `ghiTauTinh` — hồ sơ tàu `forfish.boat.v1` đúng khuôn route-planner: đọc hỏng
//    thì không ghi đè (K4); ghi chỉ ĐÈ ba trường của form, giữ nguyên mớn nước/chiều dài.

import { blendFishCells, fishLeadDays, type BlendableCell, type Climatology } from "@/lib/fish-blend";
import { locOTrongVung } from "@/lib/vung-bien-vn";
import { addDaysIso } from "@/lib/days";
import { daysBetweenISO } from "@/lib/day-labels";
import { stormStatus, type StormCheck } from "@/lib/storms";
import { forecastTrack } from "@/lib/route-storm";
import { DEFAULT_BOAT, positiveOrNull } from "@/lib/route-plan";
import { readUserRecord } from "@/lib/user-list-store";
import { saveUserJson } from "@/lib/user-store";
import type { BaoRutGon, OCa, TauTinh } from "./types";

/** Bản đồ cá tối thiểu cần cho lộ trình — cùng hình `FishForecast` (fish-predict). */
export interface BanDoCaVao {
  date: string;
  cells: readonly BlendableCell[];
  baseMode?: string;
}

/**
 * Hàm `caTheoNgay(d)` cho `LoTrinhInput` — d = ngày thứ d của chuyến (0 = ngày xuất bến).
 * Không có bản đồ cá ⇒ mọi ngày trả mảng rỗng (thuật toán tự ghi chú, không bịa).
 * Nhớ kết quả theo (tầm, tháng) — thuật toán gọi lặp nhiều lần cùng một ngày.
 */
export function dungCaTheoNgay(
  fc: BanDoCaVao | null,
  clim: Climatology | null,
  ngayDi: string,
  homNayIso: string,
): (d: number) => readonly OCa[] {
  const nho = new Map<string, readonly OCa[]>();
  return (d: number) => {
    if (!fc || !fc.cells.length) return [];
    const ngay = addDaysIso(ngayDi, Math.max(0, Math.round(d)));
    const tamTuHomNay = Math.max(0, daysBetweenISO(homNayIso, ngay));
    const tam = fc.baseMode ? 0 : fishLeadDays(fc.date, ngay, tamTuHomNay);
    const thang = Number(ngay.slice(5, 7));
    const khoa = `${tam}|${thang}`;
    const co = nho.get(khoa);
    if (co) return co;
    const pha =
      fc.baseMode || tam <= 0 || !Number.isFinite(thang) || thang < 1 || thang > 12
        ? fc.cells
        : blendFishCells([...fc.cells], clim, thang, tam);
    const ra = locOTrongVung(pha).map((c) => ({ lat: c.lat, lon: c.lon, s: c.s }));
    nho.set(khoa, ra);
    return ra;
  };
}

/** Tin bão → đầu vào cổng bão. `null` = chưa kiểm được (đang hỏi / không hỏi được / tin quá cũ mà không bão). */
export function baoTuTinBao(check: StormCheck | null | undefined, nowMs: number): BaoRutGon[] | null {
  const st = stormStatus(check, nowMs);
  if (st.kind === "khong-co") return [];
  // có bão thì luôn đưa vào — kể cả tin đã cũ (thà chặn thừa còn hơn bỏ sót, luật co-bao của storms.ts)
  if (st.kind === "co-bao")
    return st.storms.map((s) => ({
      ten: s.name || s.kindLabel,
      diem: [{ lat: s.lat, lon: s.lon }, ...forecastTrack(s)],
    }));
  return null;
}

/** Mốc giờ bản tin bão dùng để tính (ISO) — ghi vào `tuoiDuLieu.bao`; null khi chưa có bản nào. */
export function gioTinBao(check: StormCheck | null | undefined): string | null {
  if (!check || !check.ok) return null;
  return Number.isFinite(Date.parse(check.checkedAt ?? "")) ? check.checkedAt : null;
}

/* ── hồ sơ tàu ──────────────────────────────────────────────────────────── */

const BOAT_KEY = "forfish.boat.v1";

/** Trần hợp lý của ba ô — ngoài trần là gõ nhầm, không phải tàu thật. */
export const TAU_TRAN = {
  speedKn: [1, 30],
  litersPerHour: [1, 500],
  fuelTankL: [1, 100000],
} as const;

let tauDocHong = false;

/** `macDinh` = máy chưa có hồ sơ (đang dùng số mặc định) — màn phải nói để bà con sửa. */
export function docTauTinh(): { tau: TauTinh; docHong: boolean; macDinh: boolean } {
  const r = readUserRecord<Record<string, unknown>>(BOAT_KEY);
  tauDocHong = !r.ok;
  const b = r.value;
  const so = (v: unknown, [lo, hi]: readonly [number, number], md: number) =>
    typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : md;
  return {
    tau: {
      speedKn: so(b?.speedKn, TAU_TRAN.speedKn, DEFAULT_BOAT.speedKn),
      litersPerHour: so(b?.litersPerHour, TAU_TRAN.litersPerHour, DEFAULT_BOAT.litersPerHour),
      fuelTankL: positiveOrNull(b?.fuelTankL, TAU_TRAN.fuelTankL[1]),
    },
    docHong: !r.ok,
    macDinh: !b || typeof b.speedKn !== "number" || typeof b.litersPerHour !== "number",
  };
}

/** Ghi ba trường của form vào hồ sơ tàu, GIỮ các trường khác. `false` = không giữ được (đọc hỏng / hết chỗ). */
export function ghiTauTinh(tau: TauTinh): boolean {
  if (tauDocHong) return false;
  const r = readUserRecord<Record<string, unknown>>(BOAT_KEY);
  if (!r.ok) {
    tauDocHong = true;
    return false;
  }
  return saveUserJson(BOAT_KEY, {
    ...(r.value ?? {}),
    speedKn: tau.speedKn,
    litersPerHour: tau.litersPerHour,
    fuelTankL: tau.fuelTankL,
  });
}

/** Ô số người gõ → số hợp lệ trong trần, hoặc null (bỏ trống / gõ bậy). */
export function docSo(raw: string, [lo, hi]: readonly [number, number]): number | null {
  const n = Number(raw.trim().replace(",", "."));
  if (!raw.trim() || !Number.isFinite(n)) return null;
  return n >= lo && n <= hi ? n : null;
}
