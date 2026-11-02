/**
 * TÀU QUANH MỘT ĐIỂM — 6 HẢI LÝ, 6 GIỜ QUA (2026-10-31, anh Long: "khi click 1 điểm trên bản đồ, đè 3 s thì cho ra
 * option chọn đi đến điểm này, xem tàu có phát AIS trong bán kính 6 hải lý trong 6h, tính năng này chỉ với acc của
 * 0938635689" — quyền AIS `aisAllowed`, mặc định đúng số đó).
 *
 * Hai nguồn gộp lại: lộ trình theo giờ (bảng `tau_ais_vet`, hàm SQL `tau_ais_quanh` lọc thô theo hộp) + bản ~10 phút
 * mới nhất (`tau-ais:latest`, có tên/loại). Một tàu lọt vòng ở BẤT KỲ mốc nào trong 6 giờ là có trong danh sách.
 * Nói thật: lộ trình một mốc mỗi giờ ⇒ tàu chạy nhanh lướt qua mép vòng giữa hai mốc có thể sót.
 * Máy chủ hỏng hàm/mất sóng ⇒ chỉ bản (máy chủ: bản mới nhất; máy: bản đã lưu) — cờ `chiBan` để UI nói rõ.
 */
import { timeoutSignal } from "@/lib/abort";
import { KM_PER_NM, congNm } from "@/lib/ais-cpa";
import { apiUrl } from "@/lib/api-base";
import { tokenHeader } from "@/lib/device-token-store";
import { haversineKm, type LatLon } from "@/lib/geo";
import { vongTron } from "@/lib/storm-track";
import { MAU_TAU, nhomTau, peekTauAis, tauDangChay, type TauAis, type TauAisBan } from "@/lib/tau-ais";

export const QUANH_NM = 6;
export const QUANH_GIO = 6;
const HET_GIO_MS = 12_000;

export interface TauQuanh {
  id: string;
  ten: string | null;
  /** mã loại 0–9 như TauAis; tàu chỉ có trong lộ trình (đã rời bản mới nhất) ⇒ 0 */
  loai: number;
  co: string | null;
  mmsi: number | null;
  /** mốc GẦN điểm nhất trong khung giờ — t epoch giây. `huong` = độ mũi/hướng đi lúc đó khi tàu đang chạy (≥ 0,5 hl/h),
   *  null khi đứng/không rõ — để bản đồ vẽ CÙNG icon tam giác/thoi với lớp AIS toàn biển */
  gan: { t: number; lat: number; lon: number; nm: number; huong?: number | null };
  /** mốc cuối cùng còn trong vòng (epoch giây) */
  cuoi: number;
  /** mốc ĐẦU TIÊN trong vòng (epoch giây) — cuoi − dau = ở quanh điểm bao lâu. Bản máy chủ cũ thiếu ⇒ không nói "ở quanh ~N giờ" */
  dau?: number;
  /** còn trong bản mới nhất (đang phát) */
  conPhat: boolean;
  /** vị trí MỚI NHẤT (bản ~10 phút) còn trong vòng ⇒ tàu ĐANG ở đây; `hienTai` là chỗ đó */
  oDay?: boolean;
  hienTai?: { lat: number; lon: number; nm: number; huong?: number | null };
}

export interface KetQuaQuanh {
  tam: LatLon;
  /** bản dùng để ghép tên — ISO */
  luc: string | null;
  tau: TauQuanh[];
  /** chỉ có bản (không có lộ trình 6 giờ) — danh sách thiếu tàu đã đi khỏi */
  chiBan: boolean;
  /** dùng bản lưu trong máy (mất sóng) */
  tuMay: boolean;
}

/** Một dòng hàm `tau_ais_quanh`: { tau_id, diem: [[epoch_s, lat, lon, kn, hướng], …] } (đã lọc thô theo hộp + giờ). */
export interface DongVetQuanh {
  tau_id: string;
  diem: unknown;
}

/** Tham số hàm SQL: hộp lọc thô rộng hơn vòng một chút (vòng tròn thật lọc lại ở `gopTauQuanh`). */
export function thamSoQuanh(tam: LatLon, nowMs: number, nm = QUANH_NM, gio = QUANH_GIO) {
  return { p_lat: tam.lat, p_lon: tam.lon, p_km: nm * KM_PER_NM * 1.05, p_tu: Math.floor(nowMs / 1000) - gio * 3600 };
}

/** Toạ độ hợp lệ quanh vùng quét — route chặn ở đây trước khi hỏi kho. */
export function tamHopLe(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -1 && lat <= 26 && lon >= 98 && lon <= 123;
}

/**
 * Gộp lộ trình + bản ⇒ tàu đã phát AIS trong `nm` hải lý quanh `tam` từ `tuGiay` tới nay, gần nhất xếp trước. Thuần —
 * route GET /api/tau-ais/quanh và đường lùi trong máy cùng dùng.
 */
export function gopTauQuanh(opts: { vet: readonly DongVetQuanh[]; ban: TauAisBan | null; tam: LatLon; tuGiay: number; nm?: number }): TauQuanh[] {
  const { vet, ban, tam, tuGiay } = opts;
  const nm = opts.nm ?? QUANH_NM;
  const out = new Map<string, TauQuanh>();
  const tenTheoId = new Map<string, TauAis>((ban?.tau ?? []).map((t) => [t.id, t]));
  const ghi = (id: string, t: number, lat: number, lon: number, huong: number | null, moiNhat = false) => {
    if (!(t >= tuGiay)) return;
    const d = haversineKm(tam, { lat, lon }) / KM_PER_NM;
    if (!(d <= nm)) return;
    const cu = out.get(id);
    if (!cu) {
      const meta = tenTheoId.get(id);
      out.set(id, {
        id,
        ten: meta?.ten ?? null,
        loai: meta?.loai ?? 0,
        co: meta?.co ?? null,
        mmsi: meta?.mmsi ?? null,
        gan: { t, lat, lon, nm: d, huong },
        cuoi: t,
        dau: t,
        conPhat: !!meta,
        oDay: moiNhat,
        ...(moiNhat ? { hienTai: { lat, lon, nm: d, huong } } : {}),
      });
      return;
    }
    if (d < cu.gan.nm) cu.gan = { t, lat, lon, nm: d, huong };
    if (t > cu.cuoi) cu.cuoi = t;
    if (t < (cu.dau ?? t)) cu.dau = t;
    if (moiNhat) {
      cu.oDay = true;
      cu.hienTai = { lat, lon, nm: d, huong };
    }
  };
  for (const r of vet) {
    if (typeof r?.tau_id !== "string" || !r.tau_id || !Array.isArray(r.diem)) continue;
    for (const p of r.diem) {
      if (!Array.isArray(p)) continue;
      const [t, lat, lon, kn, h] = p.map((x) => (x == null ? NaN : Number(x)));
      if (Number.isFinite(t) && Number.isFinite(lat) && Number.isFinite(lon)) ghi(r.tau_id, t, lat, lon, kn >= 0.5 && Number.isFinite(h) ? h : null);
    }
  }
  const banGiay = ban ? Date.parse(ban.luc) / 1000 : NaN;
  if (ban && Number.isFinite(banGiay)) for (const t of ban.tau) ghi(t.id, Math.round(banGiay - t.phut * 60), t.lat, t.lon, tauDangChay(t) ? (t.mui ?? t.huong) : null, true);
  // ĐANG ở đây lên đầu (gần trước), rồi tàu đã qua — mới qua trước
  return [...out.values()].sort((a, b) => Number(!!b.oDay) - Number(!!a.oDay) || (a.oDay ? a.gan.nm - b.gan.nm : b.cuoi - a.cuoi || a.gan.nm - b.gan.nm));
}

const NHOM_TEN: Record<ReturnType<typeof nhomTau>, string> = { ca: "tàu cá", hang: "tàu hàng", dau: "tàu dầu", khach: "tàu khách", khac: "tàu khác" };
/** "Tàu cá" — tên nhóm viết hoa chữ đầu (chip trên bản đồ, đầu dòng phụ). */
/** tên nhóm thường — loại 0 (tàu đã rời bản mới nhất, lộ trình không giữ loại) nói thật "chưa rõ loại" */
const nhomTen = (loai: number) => (loai === 0 ? "tàu chưa rõ loại" : NHOM_TEN[nhomTau(loai)]);
const hoaDau = (s: string) => s[0].toUpperCase() + s.slice(1);
export const tenNhomTau = (loai: number) => hoaDau(nhomTen(loai));

/** "3 giờ trước" / "40 phút trước" / "vừa xong" — tính theo epoch giây. Thuần. */
export function cachDay(tGiay: number, nowGiay: number): string {
  const phut = Math.max(0, Math.round((nowGiay - tGiay) / 60));
  if (phut < 15) return "vừa xong";
  if (phut < 60) return `${phut} phút trước`;
  return `${Math.round(phut / 60)} giờ trước`;
}

/**
 * TRẠNG THÁI MỘT TÀU so với điểm (2026-11-02, anh Long: "đang ở đó, đã đi qua đó, tàu gì… tàu cá đã ở đó 3 h trước,
 * tàu hàng đã chạy qua 5 h trước, hiện thời chỉ có tàu hàng ở đó"). ĐANG Ở = vị trí mới nhất còn trong vòng. Đã qua:
 * ở trong vòng ≥ 1 giờ (≥ 2 mốc lộ trình) ⇒ "ở quanh đây ~N giờ", còn lại ⇒ "chạy qua". Mốc giờ là lần CUỐI còn
 * trong vòng. Lộ trình một mốc mỗi giờ ⇒ "~" thật lòng. Thuần.
 */
export function trangThaiQuanh(t: TauQuanh, nowGiay: number): { oDay: boolean; chip: string; cau: string } {
  const nhom = tenNhomTau(t.loai);
  const o = Math.round((t.cuoi - (t.dau ?? t.cuoi)) / 3600); // máy chủ cũ thiếu dau ⇒ không đoán đã ở bao lâu
  if (t.oDay) {
    const nm = (t.hienTai ?? t.gan).nm;
    return { oDay: true, chip: "Đang ở", cau: `${nhom} · đang ở đây, cách ${soNm(nm)} hải lý${o >= 1 ? ` · đã ~${o} giờ` : ""}` };
  }
  const khi = cachDay(t.cuoi, nowGiay);
  return {
    oDay: false,
    chip: khi === "vừa xong" ? "Vừa qua" : khi.replace(" trước", ""),
    cau: o >= 1 ? `${nhom} · ở quanh đây ~${o} giờ, rời ${khi}` : `${nhom} · chạy qua ${khi}, gần nhất ${soNm(t.gan.nm)} hải lý`,
  };
}

const soNm = (nm: number) => nm.toLocaleString("vi-VN", { maximumFractionDigits: 1, minimumFractionDigits: nm < 10 ? 1 : 0 });

/**
 * LỌC BẰNG ICON (2026-11-02, anh Long: "gọn lại… lọc được luôn, lọc thông minh theo click icon thôi"). Hai chiều:
 * nhóm tàu (cùng nhóm màu/icon với bản đồ — loại 0 "chưa rõ" chung icon xám với "khác") × trạng thái (đang ở / đã qua).
 * null = không lọc chiều đó. Thuần.
 */
export type NhomQuanh = ReturnType<typeof nhomTau>;
export interface LocQuanh {
  nhom: NhomQuanh | null;
  o: boolean | null;
}
export const LOC_TRONG: LocQuanh = { nhom: null, o: null };

export const hopLoc = (t: TauQuanh, loc: LocQuanh): boolean =>
  (loc.nhom == null || nhomTau(t.loai) === loc.nhom) && (loc.o == null || !!t.oDay === loc.o);

export const locTauQuanh = (ds: readonly TauQuanh[], loc: LocQuanh): TauQuanh[] => ds.filter((t) => hopLoc(t, loc));

/**
 * Số trên từng icon lọc — "thông minh": số trạng thái tính trong nhóm đang chọn, số nhóm tính trong trạng thái đang
 * chọn (chạm icon nào cũng thấy ngay còn bao nhiêu). Nhóm 0 tàu ẩn, trừ nhóm đang chọn. Nhóm đông trước.
 */
export function demLocQuanh(ds: readonly TauQuanh[], loc: LocQuanh): { o: number; qua: number; nhom: { nhom: NhomQuanh; n: number }[] } {
  let o = 0;
  let qua = 0;
  const m = new Map<NhomQuanh, number>();
  for (const t of ds) {
    const nh = nhomTau(t.loai);
    if (loc.nhom == null || nh === loc.nhom) {
      if (t.oDay) o++;
      else qua++;
    }
    if (loc.o == null || !!t.oDay === loc.o) m.set(nh, (m.get(nh) ?? 0) + 1);
  }
  if (loc.nhom && !m.has(loc.nhom)) m.set(loc.nhom, 0);
  const nhom = [...m.entries()].map(([nhom, n]) => ({ nhom, n })).sort((a, b) => b.n - a.n);
  return { o, qua, nhom };
}

/** TauAis tối thiểu để mở đường đi (xemVetTau chỉ cần id + tên) cho tàu đã rời bản. */
export function tauAisTuQuanh(t: TauQuanh): TauAis {
  return { id: t.id, ten: t.ten, loai: t.loai, co: t.co, lat: t.gan.lat, lon: t.gan.lon, kn: null, huong: null, mui: null, phut: 0, dai: null, dich: null, mmsi: t.mmsi };
}

/** Lớp bản đồ: vòng `nm` hải lý (nhãn ở đỉnh Bắc) + chấm mỗi tàu ở mốc gần nhất (màu theo loại). Thuần. */
export function quanhGeoJson(
  tam: LatLon,
  ds: readonly TauQuanh[],
  chonId: string | null,
  nm = QUANH_NM,
  nowGiay = Math.floor(Date.now() / 1000),
): GeoJSON.FeatureCollection<
  GeoJSON.LineString | GeoJSON.Point,
  { kind: "vong" | "nhan" | "tau"; nhan?: string; id?: string; mau?: string; mk?: string; huong?: number; chay?: number; chon?: number; o?: number }
> {
  const ring = vongTron(tam.lat, tam.lon, nm * KM_PER_NM);
  const dinh = congNm(tam, 0, nm);
  return {
    type: "FeatureCollection",
    features: [
      { type: "Feature", geometry: { type: "LineString", coordinates: [...ring, ring[0]] }, properties: { kind: "vong" } },
      { type: "Feature", geometry: { type: "Point", coordinates: [dinh.lon, dinh.lat] }, properties: { kind: "nhan", nhan: `${nm} hl · ${QUANH_GIO} giờ qua` } },
      // ĐANG ở ⇒ icon ở vị trí mới nhất; đã qua ⇒ ở chỗ đi gần điểm nhất (mờ). Icon CÙNG bộ với lớp AIS toàn biển
      // (`ais-<mk>-chay|dung`: tam giác xoay theo mũi khi chạy, thoi khi đứng). Nhãn ngắn "Cá · đang ở" / "Hàng · 5 giờ"
      ...ds.map((t) => {
        const p = t.oDay && t.hienTai ? t.hienTai : t.gan;
        const tt = trangThaiQuanh(t, nowGiay);
        return {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] },
          properties: {
            kind: "tau" as const,
            id: t.id,
            mau: MAU_TAU[nhomTau(t.loai)],
            mk: nhomTau(t.loai),
            huong: p.huong ?? 0,
            chay: p.huong != null ? 1 : 0,
            chon: t.id === chonId ? 1 : 0,
            o: tt.oDay ? 1 : 0,
            nhan: `${hoaDau(nhomTen(t.loai).replace("tàu ", "").replace(" loại", ""))} · ${tt.oDay ? "đang ở" : tt.chip}`,
          },
        };
      }),
    ],
  };
}

/**
 * Hỏi máy chủ; mất sóng/hỏng ⇒ tự tính từ bản lưu trong máy (chỉ tàu còn trong bản, `tuMay`). Không có bản nào ⇒ null
 * (UI nói cần sóng).
 */
export async function fetchTauQuanh(tam: LatLon, nowMs = Date.now()): Promise<KetQuaQuanh | null> {
  const lat = Math.round(tam.lat * 1000) / 1000;
  const lon = Math.round(tam.lon * 1000) / 1000;
  try {
    const r = await fetch(apiUrl(`/api/tau-ais/quanh?lat=${lat}&lon=${lon}`), { headers: tokenHeader(), signal: timeoutSignal(HET_GIO_MS) });
    const j = (await r.json().catch(() => null)) as { ok?: unknown; luc?: unknown; tau?: unknown; chiBan?: unknown } | null;
    if (r.ok && j?.ok === true && Array.isArray(j.tau)) {
      return { tam: { lat, lon }, luc: typeof j.luc === "string" ? j.luc : null, tau: j.tau as TauQuanh[], chiBan: j.chiBan === true, tuMay: false };
    }
  } catch {
    /* mất sóng / hết giờ ⇒ bản máy */
  }
  const ban = peekTauAis();
  if (!ban) return null;
  const tuGiay = Math.floor(nowMs / 1000) - QUANH_GIO * 3600;
  return { tam: { lat, lon }, luc: ban.luc, tau: gopTauQuanh({ vet: [], ban, tam: { lat, lon }, tuGiay }), chiBan: true, tuMay: true };
}
