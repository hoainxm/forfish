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
import { gridCellCoSong, nearestGridCell, type ForecastGrid } from "@/lib/forecast-grid";
import type { StormTrack } from "@/lib/storm-track";
import { haversineKm } from "@/lib/geo";
import type { DensityGear, NenFleet } from "@/lib/fleet-density";
import { saveUserJson } from "@/lib/user-store";
import type { BaoRutGon, KhungGio, Nghe, OCa, TauTinh } from "./types";

/**
 * LOÀI CHỦ TÀU CHỌN (2026-11-09, anh Long: "loài theo nghề thì cứ cho chủ tàu chủ động chọn thôi"). Bản trước đoán nhóm loài
 * theo nghề (`loaiTheoNghe` trong model-params) — đã BỎ. Nay ô = điểm cao nhất trong các loài chủ tàu chọn ở form (cùng bộ
 * `forfish.fishPicks.v1` của lớp Dự báo cá, tối đa 3). Lý do gốc vẫn giữ: chấm theo loài mình đánh thì tàu câu ngừ không bị
 * cá nục/bạc má ven bờ Bắc Bộ kéo ra Vịnh (2026-11-08).
 */
export function diemOTheoLoai(
  sp: Record<string, number> | undefined,
  loai: readonly string[],
): { s: number; loai: string } | null {
  if (!sp || !loai.length) return null;
  let tot: { s: number; loai: string } | null = null;
  for (const l of loai) {
    const v = sp[l];
    if (typeof v === "number" && Number.isFinite(v) && v > 0 && (!tot || v > tot.s)) tot = { s: v, loai: l };
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
 * Có `loai` (chủ tàu chọn) ⇒ điểm ô = loài đã chọn (`diemOTheoLoai`), bỏ ô không có loài nào đã chọn, và KHÔNG
 * pha mùa vụ: lưới mùa vụ (`clim`) là điểm gộp mọi loài, pha vào là kéo lại đúng lỗi chấm sai loài. Bản production
 * dựng bằng nền (`baseMode`) vốn đã không pha. `loai` rỗng/vắng (lộ trình lưu trước 09/11) ⇒ điểm chung `s`.
 */
export function dungCaTheoNgay(
  fc: BanDoCaVao | null,
  clim: Climatology | null,
  ngayDi: string,
  homNayIso: string,
  loai?: readonly string[],
): (d: number) => readonly OCa[] {
  const nho = new Map<string, readonly OCa[]>();
  return (d: number) => {
    if (!fc || !fc.cells.length) return [];
    if (loai?.length) {
      const co = nho.get("loai");
      if (co) return co;
      const ra: OCa[] = [];
      for (const c of locOTrongVung(fc.cells)) {
        const x = diemOTheoLoai(c.sp, loai);
        if (x) ra.push({ lat: c.lat, lon: c.lon, s: x.s, loai: x.loai });
      }
      nho.set("loai", ra);
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

/** Mốc giờ lưới ("YYYY-MM-DDTHH:MM", đã là giờ VN) → epoch ms; hỏng ⇒ NaN. */
const msGioVN = (t: unknown): number => (typeof t === "string" && t.length >= 13 ? Date.parse(`${t.slice(0, 13)}:00:00+07:00`) : NaN);

/**
 * Hàm `bienTheoNgay(lat, lon, d, khung?)` từ lưới gió sóng ĐỦ VÙNG (`forecast-grid`, ~2°, có bản lưu offline): sóng cao
 * nhất + gió mạnh nhất của NGÀY THỨ d chuyến tại ô lưới gần chỗ đó (`seaPointFromGrid` — cùng luật Bản đồ).
 * Có `khung` (ô nửa ngày, Phase 2): chỉ lấy các mốc giờ TRONG khung đánh của nghề (vd 18 giờ hôm đó → 5 giờ sáng hôm sau);
 * khung không có mốc nào (đuôi lưới thưa) ⇒ lùi về số cả ngày. Lưới null / ngày ngoài tầm lưới ⇒ null (thuật toán coi như
 * chưa có dự báo và nói ra).
 */
export function dungBienTheoNgay(
  grid: ForecastGrid | null,
  ngayDi: string,
): ((lat: number, lon: number, d: number, khung?: KhungGio) => { songM: number | null; gioKmh: number | null } | null) | null {
  if (!grid?.cells?.length) return null;
  const nho = new Map<string, Map<string, { songM: number | null; gioKmh: number | null }> | null>();
  const nhoGio = new Map<string, { ms: number; songM: number | null; gioKmh: number | null }[] | null>();
  const msGrid = (grid.times ?? []).map(msGioVN);
  const theoGio = (khoa: string, lat: number, lon: number) => {
    let g = nhoGio.get(khoa);
    if (g === undefined) {
      const near = nearestGridCell(grid, lat, lon, gridCellCoSong) ?? nearestGridCell(grid, lat, lon);
      g = near
        ? near.cell.hours.map((h, i) => ({
            ms: msGrid[i] ?? NaN,
            // lưới ghi 0 khi "chưa có số" — đổi về null (cùng luật số cả ngày)
            songM: typeof h?.waveM === "number" && h.waveM > 0 ? h.waveM : null,
            gioKmh: typeof h?.windKmh === "number" && h.windKmh > 0 ? h.windKmh : null,
          }))
        : null;
      nhoGio.set(khoa, g);
    }
    return g;
  };
  return (lat, lon, d, khung) => {
    const khoa = `${Math.round(lat * 2) / 2},${Math.round(lon * 2) / 2}`;
    const dd = Math.max(0, Math.round(d));
    if (khung && Number.isFinite(khung.tuGio) && Number.isFinite(khung.soGio) && khung.soGio > 0) {
      const tu = Date.parse(`${addDaysIso(ngayDi, dd)}T00:00:00+07:00`) + khung.tuGio * 3_600_000;
      const den = tu + khung.soGio * 3_600_000;
      let songM: number | null = null, gioKmh: number | null = null, co = false;
      for (const h of theoGio(khoa, lat, lon) ?? []) {
        if (!(h.ms >= tu && h.ms < den)) continue;
        co = true;
        if (h.songM != null) songM = songM == null ? h.songM : Math.max(songM, h.songM);
        if (h.gioKmh != null) gioKmh = gioKmh == null ? h.gioKmh : Math.max(gioKmh, h.gioKmh);
      }
      if (co && (songM != null || gioKmh != null)) return { songM, gioKmh };
    }
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
    const v = ngay?.get(addDaysIso(ngayDi, dd));
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

/** Đường dự báo NCHMF (kho bản tin, `/api/storms` trường `tracks`) coi là CÙNG cơn với tin bão khi tâm gần nhất cách ≤ ngần này. */
export const KM_KHOP_DUONG_BAO = 300;

/**
 * Tin bão → đầu vào cổng bão. `null` = chưa kiểm được (đang hỏi / không hỏi được / tin quá cũ mà không bão).
 * MỐC GIỜ (Phase 2, 2026-11-08): `/api/storms` mang sẵn `tracks` — đường dự báo của bản tin NCHMF CÓ GIỜ từng mốc. Cơn nào
 * khớp được (cùng `key`, hoặc tâm gần nhất ≤ 300 km) thì thêm các mốc đó kèm `at` ⇒ cổng bão bỏ được mốc rơi sau cửa sổ
 * và câu chặn nói được "dự báo lúc …". Điểm GDACS (không giờ) + tâm hiện tại VẪN GIỮ, coi như có mặt suốt cửa sổ — thêm
 * giờ chỉ để nói rõ hơn, KHÔNG bao giờ bớt chặn. Không nguồn mới (JTWC/KTTV vẫn là việc chờ).
 */
export function baoTuTinBao(check: StormCheck | null | undefined, nowMs: number): BaoRutGon[] | null {
  const st = stormStatus(check, nowMs);
  if (st.kind === "khong-co") return [];
  // có bão thì luôn đưa vào — kể cả tin đã cũ (thà chặn thừa còn hơn bỏ sót, luật co-bao của storms.ts)
  if (st.kind === "co-bao") {
    const tracks: StormTrack[] = check && check.ok && Array.isArray(check.tracks) ? check.tracks : [];
    return st.storms.map((s) => ({
      ten: s.name || s.kindLabel,
      diem: [{ lat: s.lat, lon: s.lon }, ...forecastTrack(s), ...diemCoGio(s, tracks)],
    }));
  }
  return null;
}

/** Các mốc dự báo CÓ GIỜ của cơn `s` trong kho bản tin NCHMF (rỗng nếu không khớp được cơn nào). */
function diemCoGio(s: { key?: string; lat: number; lon: number }, tracks: readonly StormTrack[]): BaoRutGon["diem"] {
  let tot: StormTrack | null = null, totKm = Infinity;
  for (const t of tracks) {
    if (!t || !Array.isArray(t.forecast)) continue;
    if (s.key && t.key === s.key) { tot = t; break; }
    const tam = t.past?.[t.past.length - 1] ?? t.forecast[0];
    if (!tam || !Number.isFinite(tam.lat) || !Number.isFinite(tam.lon)) continue;
    const km = haversineKm({ lat: s.lat, lon: s.lon }, tam);
    if (km <= KM_KHOP_DUONG_BAO && km < totKm) { tot = t; totKm = km; }
  }
  if (!tot) return [];
  const out: BaoRutGon["diem"] = [];
  for (const f of tot.forecast) {
    if (!f || !Number.isFinite(f.lat) || !Number.isFinite(f.lon)) continue;
    out.push(typeof f.at === "number" && Number.isFinite(f.at) ? { lat: f.lat, lon: f.lon, at: f.at } : { lat: f.lat, lon: f.lon });
  }
  return out;
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
  litDem: [1, 2000],
} as const;

let tauDocHong = false;

/** Mớn tàu (m) trong hồ sơ tàu — CHỈ ĐỌC (ô mớn nằm ở hồ sơ tàu / dẫn đường). null = chưa khai / đọc hỏng. */
export function docMonTau(): number | null {
  const r = readUserRecord<Record<string, unknown>>(BOAT_KEY);
  const v = r.ok ? r.value?.draftM : null;
  return typeof v === "number" && Number.isFinite(v) && v > 0 && v <= 10 ? v : null;
}

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
      litDem: positiveOrNull(b?.lampLitersPerNight, TAU_TRAN.litDem[1]),
    },
    docHong: !r.ok,
    macDinh: !b || typeof b.speedKn !== "number" || typeof b.litersPerHour !== "number",
  };
}

/** Ghi các trường tàu của form (tốc độ, dầu/giờ, két, lít đèn/đêm) vào hồ sơ tàu, GIỮ các trường khác. `false` = không giữ được (đọc hỏng / hết chỗ). */
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
    // chỉ ghi khi form có ô đèn (nghề đèn) — nghề khác không đụng số đã khai
    ...(tau.litDem !== undefined ? { lampLitersPerNight: tau.litDem } : {}),
  });
}

/** Ô số người gõ → số hợp lệ trong trần, hoặc null (bỏ trống / gõ bậy). */
export function docSo(raw: string, [lo, hi]: readonly [number, number]): number | null {
  const n = Number(raw.trim().replace(",", "."));
  if (!raw.trim() || !Number.isFinite(n)) return null;
  return n >= lo && n <= hi ? n : null;
}
