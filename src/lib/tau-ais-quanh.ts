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
import { MAU_TAU, nhomTau, peekTauAis, type TauAis, type TauAisBan } from "@/lib/tau-ais";

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
  /** mốc GẦN điểm nhất trong khung giờ — t epoch giây */
  gan: { t: number; lat: number; lon: number; nm: number };
  /** mốc cuối cùng còn trong vòng (epoch giây) */
  cuoi: number;
  /** còn trong bản mới nhất (đang phát) */
  conPhat: boolean;
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
  const ghi = (id: string, t: number, lat: number, lon: number) => {
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
        gan: { t, lat, lon, nm: d },
        cuoi: t,
        conPhat: !!meta,
      });
      return;
    }
    if (d < cu.gan.nm) cu.gan = { t, lat, lon, nm: d };
    if (t > cu.cuoi) cu.cuoi = t;
  };
  for (const r of vet) {
    if (typeof r?.tau_id !== "string" || !r.tau_id || !Array.isArray(r.diem)) continue;
    for (const p of r.diem) {
      if (!Array.isArray(p)) continue;
      const [t, lat, lon] = p.map((x) => (x == null ? NaN : Number(x)));
      if (Number.isFinite(t) && Number.isFinite(lat) && Number.isFinite(lon)) ghi(r.tau_id, t, lat, lon);
    }
  }
  const banGiay = ban ? Date.parse(ban.luc) / 1000 : NaN;
  if (ban && Number.isFinite(banGiay)) for (const t of ban.tau) ghi(t.id, Math.round(banGiay - t.phut * 60), t.lat, t.lon);
  return [...out.values()].sort((a, b) => a.gan.nm - b.gan.nm || b.cuoi - a.cuoi);
}

/** Một dòng phụ: "Gần nhất 1,2 hải lý lúc 14:00 · còn phát" — giờ VN. Thuần. */
export function dongPhuQuanh(t: TauQuanh): string {
  const vn = new Date(t.gan.t * 1000 + 7 * 3_600_000);
  const gio = `${String(vn.getUTCHours()).padStart(2, "0")}:${String(vn.getUTCMinutes()).padStart(2, "0")}`;
  const nm = t.gan.nm.toLocaleString("vi-VN", { maximumFractionDigits: 1, minimumFractionDigits: t.gan.nm < 10 ? 1 : 0 });
  return `Gần nhất ${nm} hải lý lúc ${gio}${t.conPhat ? "" : " · đã tắt hoặc đi xa"}`;
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
): GeoJSON.FeatureCollection<GeoJSON.LineString | GeoJSON.Point, { kind: "vong" | "nhan" | "tau"; nhan?: string; id?: string; mau?: string; chon?: number }> {
  const ring = vongTron(tam.lat, tam.lon, nm * KM_PER_NM);
  const dinh = congNm(tam, 0, nm);
  return {
    type: "FeatureCollection",
    features: [
      { type: "Feature", geometry: { type: "LineString", coordinates: [...ring, ring[0]] }, properties: { kind: "vong" } },
      { type: "Feature", geometry: { type: "Point", coordinates: [dinh.lon, dinh.lat] }, properties: { kind: "nhan", nhan: `${nm} hl · ${QUANH_GIO} giờ qua` } },
      ...ds.map((t) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [t.gan.lon, t.gan.lat] },
        properties: { kind: "tau" as const, id: t.id, mau: MAU_TAU[nhomTau(t.loai)], chon: t.id === chonId ? 1 : 0 },
      })),
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
