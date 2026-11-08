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
import { seaPointFromGrid } from "@/lib/marine-weather";
import type { ForecastGrid } from "@/lib/forecast-grid";
import type { DensityGear, NenFleet } from "@/lib/fleet-density";
import { saveUserJson } from "@/lib/user-store";
import type { BaoRutGon, Nghe, OCa, TauTinh } from "./types";
import { getModelParams, type ModelParams } from "@/lib/model-params";
import { loTrinhParams } from "./he-so";

/**
 * NHÓM LOÀI THEO NGHỀ (2026-11-08, anh Long: "câu ngừ chạy tút lên phía bắc?"). Trước đây lộ trình chấm ô bằng `s` =
 * điểm LOÀI TỐT NHẤT tại ô, bất kể nghề ⇒ tháng 11 cá nục/bạc má ven bờ Bắc Bộ vào vụ, kéo tàu câu ngừ Tam Quang ra
 * Vịnh Bắc Bộ. Nay ô = điểm cao nhất trong các loài CỦA NGHỀ (`sp`). Danh sách loài theo nghề nằm ở model-params
 * (`src/data/lo-trinh-params.json` → SDF2, cất offline) — không viết cứng ở đây (khong-lo-nguon nợ #9).
 * Chưa nạp tham số ⇒ `null` ⇒ ô chấm bằng loài tốt nhất như bản cũ (vẫn ra lộ trình, chỉ chưa theo nghề).
 */
export function loaiTheoNghe(nghe: Nghe, p: ModelParams | null = getModelParams()): readonly string[] | null {
  const ds = loTrinhParams(p).loaiTheoNghe?.[nghe];
  return Array.isArray(ds) && ds.length && ds.every((x) => typeof x === "string") ? ds : null;
}

/** Điểm ô theo nghề: loài cao nhất trong nhóm loài của nghề. Ô không có loài nào của nghề ⇒ null.
 *  Chưa có nhóm loài (tham số chưa nạp) ⇒ loài cao nhất tại ô. */
export function diemOTheoNghe(
  sp: Record<string, number> | undefined,
  nghe: Nghe,
  p: ModelParams | null = getModelParams(),
): { s: number; loai: string } | null {
  if (!sp) return null;
  const ds = loaiTheoNghe(nghe, p) ?? Object.keys(sp);
  let tot: { s: number; loai: string } | null = null;
  for (const loai of ds) {
    const v = sp[loai];
    if (typeof v === "number" && Number.isFinite(v) && v > 0 && (!tot || v > tot.s)) tot = { s: v, loai };
  }
  return tot;
}

/** Bản đồ cá tối thiểu cần cho lộ trình — cùng hình `FishForecast` (fish-predict). */
export interface BanDoCaVao {
  date: string;
  cells: readonly BlendableCell[];
  baseMode?: boolean;
}

/**
 * Hàm `caTheoNgay(d)` cho `LoTrinhInput` — d = ngày thứ d của chuyến (0 = ngày xuất bến).
 * Không có bản đồ cá ⇒ mọi ngày trả mảng rỗng (thuật toán tự ghi chú, không bịa).
 * Nhớ kết quả theo (tầm, tháng) — thuật toán gọi lặp nhiều lần cùng một ngày.
 * Có `nghe` ⇒ điểm ô = loài của nghề (`diemOTheoNghe`), bỏ ô không có loài nào của nghề, và KHÔNG pha
 * mùa vụ: lưới mùa vụ (`clim`) là điểm gộp mọi loài, pha vào là kéo lại đúng lỗi vừa sửa. Bản production
 * dựng bằng nền (`baseMode`) vốn đã không pha.
 */
export function dungCaTheoNgay(
  fc: BanDoCaVao | null,
  clim: Climatology | null,
  ngayDi: string,
  homNayIso: string,
  nghe?: Nghe,
): (d: number) => readonly OCa[] {
  const nho = new Map<string, readonly OCa[]>();
  return (d: number) => {
    if (!fc || !fc.cells.length) return [];
    if (nghe) {
      const co = nho.get("nghe");
      if (co) return co;
      const ra: OCa[] = [];
      for (const c of locOTrongVung(fc.cells)) {
        const x = diemOTheoNghe(c.sp, nghe);
        if (x) ra.push({ lat: c.lat, lon: c.lon, s: x.s, loai: x.loai });
      }
      nho.set("nghe", ra);
      return ra;
    }
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

/**
 * Hàm `bienTheoNgay(lat, lon, d)` từ lưới gió sóng ĐỦ VÙNG (`forecast-grid`, ~2°, có bản lưu offline): sóng cao
 * nhất + gió mạnh nhất của NGÀY THỨ d chuyến tại ô lưới gần chỗ đó (`seaPointFromGrid` — cùng luật Bản đồ).
 * Lưới null / ngày ngoài tầm lưới ⇒ null (thuật toán coi như chưa có dự báo và nói ra).
 */
export function dungBienTheoNgay(
  grid: ForecastGrid | null,
  ngayDi: string,
): ((lat: number, lon: number, d: number) => { songM: number | null; gioKmh: number | null } | null) | null {
  if (!grid?.cells?.length) return null;
  const nho = new Map<string, Map<string, { songM: number | null; gioKmh: number | null }> | null>();
  return (lat, lon, d) => {
    const khoa = `${Math.round(lat * 2) / 2},${Math.round(lon * 2) / 2}`;
    let ngay = nho.get(khoa);
    if (ngay === undefined) {
      const c = seaPointFromGrid(grid, { lat, lon }, null);
      ngay = c
        ? new Map(
            c.days.map((x) => [
              x.date,
              // lưới ghi 0 khi "chưa có số" (không phải biển lặng) — đổi về null
              { songM: x.waveMaxM > 0 ? x.waveMaxM : null, gioKmh: x.windMaxKmh > 0 ? x.windMaxKmh : null },
            ]),
          )
        : null;
      nho.set(khoa, ngay);
    }
    const v = ngay?.get(addDaysIso(ngayDi, Math.max(0, Math.round(d))));
    return v && (v.songM != null || v.gioKmh != null) ? v : null;
  };
}

/** Nghề lộ trình → nghề của lớp mật độ tàu (bãi). Cào đơn/đôi dùng bãi tách riêng (scripts/add-density-keo-tach.mjs). */
export const BAI_NGHE: Record<Nghe, DensityGear> = {
  "cau-ngu": "cau",
  "luoi-vay": "vay",
  "luoi-re": "re",
  "chup-muc": "chup",
  "luoi-keo": "keo-don",
  "keo-doi": "keo-doi",
};

/**
 * Hàm `baiTheoNgay(lat, lon, d)` từ nền mật độ tàu CÙNG NGHỀ (`/api/fleet-density`, cất offline): điểm nền ô chứa chỗ đó
 * ngày thứ d ÷ 100 (1 = đông nhất quanh đó). Ô không có trong nền (dưới ngưỡng / không tàu nghề đó) ⇒ 0. Ngày nằm
 * ngoài bộ 16 ngày đã tải ⇒ null (thuật toán coi như chưa có bãi ngày đó). Nền null ⇒ hàm null.
 */
export function dungBaiTheoNgay(nen: NenFleet | null, ngayDi: string): ((lat: number, lon: number, d: number) => number | null) | null {
  if (!nen?.ngay?.length || !(nen.step > 0)) return null;
  const buoc = nen.step;
  const theoNgay = new Map<string, Map<string, number>>();
  for (const n of nen.ngay) {
    const m = new Map<string, number>();
    for (const o of n.o ?? []) {
      const [la, lo, , , diem] = o;
      if (Number.isFinite(la) && Number.isFinite(lo) && Number.isFinite(diem)) m.set(`${Math.round(la / buoc)},${Math.round(lo / buoc)}`, Math.min(1, Math.max(0, diem / 100)));
    }
    theoNgay.set(n.dateIso, m);
  }
  return (lat, lon, d) => {
    const m = theoNgay.get(addDaysIso(ngayDi, Math.max(0, Math.round(d))));
    if (!m) return null;
    return m.get(`${Math.round(lat / buoc)},${Math.round(lon / buoc)}`) ?? 0;
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
