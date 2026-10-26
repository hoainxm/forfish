/**
 * TÀU XUNG QUANH (AIS) — phía máy ngư dân (2026-10-26).
 *
 * Bản vị trí tàu quanh biển VN do máy thu ở nhà gửi lên mỗi ~10 phút (POST /api/tau-ais/nhap), app đọc
 * GET /api/tau-ais (cần tài khoản, miễn phí — lớp bản đồ không bán). Mất sóng ⇒ bản máy đã lưu
 * (`forfish.tau-ais.v1`) + nói rõ "bản lúc …". Phần thuần dùng chung máy thu ở lib/tau-ais/chuan-hoa.mjs.
 */
import { timeoutSignal } from "@/lib/abort";
import { apiUrl } from "@/lib/api-base";
import { tokenHeader } from "@/lib/device-token-store";
import { haversineKm } from "@/lib/geo";
import { LOAI_TAU } from "@/lib/tau-ais/chuan-hoa.mjs";

export const TAU_AIS_SNAPSHOT_ID = "tau-ais:latest";
export const TAU_AIS_STORE_KEY = "forfish.tau-ais.v1";
/** Lớp đang bật thì xin lại bản mới mỗi 5 phút (máy thu đẩy ~10 phút, CDN giữ 2 phút). */
export const TAU_AIS_LAM_MOI_MS = 5 * 60_000;
const HET_GIO_MS = 12_000;

export interface TauAis {
  id: string;
  ten: string | null;
  /** mã loại 0–9 (2 = tàu cá) — nhãn `loaiTauLabel` */
  loai: number;
  co: string | null;
  lat: number;
  lon: number;
  /** hải lý/giờ */
  kn: number | null;
  huong: number | null;
  mui: number | null;
  /** tin cách lúc `ban.luc` bao nhiêu phút */
  phut: number;
  dai: number | null;
  dich: string | null;
}
export interface TauAisBan {
  v: 1;
  luc: string;
  soTau: number;
  tau: TauAis[];
}

function hopLe(b: unknown): b is TauAisBan {
  const x = b as TauAisBan | null;
  return !!x && x.v === 1 && typeof x.luc === "string" && Array.isArray(x.tau);
}

/** Bản máy đã lưu (đồng bộ) — null khi chưa có/hỏng. */
export function peekTauAis(): TauAisBan | null {
  try {
    const raw = localStorage.getItem(TAU_AIS_STORE_KEY);
    if (!raw) return null;
    const b = JSON.parse(raw) as unknown;
    return hopLe(b) ? b : null;
  } catch {
    return null;
  }
}

function luuTauAis(b: TauAisBan): void {
  try {
    localStorage.setItem(TAU_AIS_STORE_KEY, JSON.stringify(b));
  } catch {
    /* kho đầy/riêng tư — bản mới vẫn hiện, chỉ không giữ qua lần mở sau */
  }
}

/**
 * Mạng trước, bản máy sau. `tuKho` = true khi phải dùng bản đã lưu. Không có gì ⇒ ném — UI nói thật.
 */
export async function fetchTauAis(): Promise<{ ban: TauAisBan; tuKho: boolean }> {
  try {
    const r = await fetch(apiUrl("/api/tau-ais"), { headers: tokenHeader(), signal: timeoutSignal(HET_GIO_MS) });
    if (r.ok) {
      const j = (await r.json()) as unknown;
      if (hopLe(j)) {
        luuTauAis(j);
        return { ban: j, tuKho: false };
      }
    }
  } catch {
    /* mất sóng / hết giờ ⇒ lùi bản máy */
  }
  const cu = peekTauAis();
  if (cu) return { ban: cu, tuKho: true };
  throw new Error("chua_co_ban_tau");
}

export function loaiTauLabel(loai: number): string {
  return (LOAI_TAU as Record<number, string>)[loai] ?? LOAI_TAU[0];
}

/** Tin cách hiện tại bao lâu, gộp tuổi tin trong nguồn + tuổi bản. */
export function tuoiTinPhut(t: Pick<TauAis, "phut">, ban: Pick<TauAisBan, "luc">, now = Date.now()): number {
  const banCu = Math.max(0, Math.round((now - Date.parse(ban.luc)) / 60_000));
  return t.phut + (Number.isFinite(banCu) ? banCu : 0);
}

export function tuoiTinLabel(phut: number): string {
  if (phut < 2) return "vừa xong";
  if (phut < 60) return `${phut} phút trước`;
  const h = Math.round(phut / 60);
  if (h < 48) return `${h} giờ trước`;
  return `${Math.round(h / 24)} ngày trước`;
}

/** Tàu gần điểm chạm nhất trong `kmMax` — null nếu không có. */
export function tauGanDiem(tau: TauAis[], lat: number, lon: number, kmMax = 3): { tau: TauAis; km: number } | null {
  let best: { tau: TauAis; km: number } | null = null;
  for (const t of tau) {
    // lọc thô theo độ trước cho rẻ (1° ≈ 111 km)
    if (Math.abs(t.lat - lat) > kmMax / 100 || Math.abs(t.lon - lon) > kmMax / 100) continue;
    const km = haversineKm({ lat, lon }, { lat: t.lat, lon: t.lon });
    if (km <= kmMax && (!best || km < best.km)) best = { tau: t, km };
  }
  return best;
}

/** Màu chấm theo loại — tàu cá nổi bật (cam), tàu lớn xám để không lẫn. */
export const MAU_TAU: Record<"ca" | "hang" | "dau" | "khach" | "khac", string> = {
  ca: "#f97316",
  hang: "#64748b",
  dau: "#b91c1c",
  khach: "#2563eb",
  khac: "#94a3b8",
};
export function nhomTau(loai: number): keyof typeof MAU_TAU {
  if (loai === 2) return "ca";
  if (loai === 7) return "hang";
  if (loai === 8) return "dau";
  if (loai === 6 || loai === 4) return "khach";
  return "khac";
}

export function tauGeoJson(ban: TauAisBan): GeoJSON.FeatureCollection<GeoJSON.Point, { id: string; nhom: string; huong: number }> {
  return {
    type: "FeatureCollection",
    features: ban.tau.map((t) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [t.lon, t.lat] },
      properties: { id: t.id, nhom: nhomTau(t.loai), huong: t.mui ?? t.huong ?? 0 },
    })),
  };
}

/** Dòng tóm tắt một tàu cho thẻ chạm: "Tàu cá · VN · 4,1 hải lý/h hướng 120° · 17 m". */
export function moTaTau(t: TauAis): string {
  const p: string[] = [loaiTauLabel(t.loai)];
  if (t.co) p.push(t.co);
  if (t.kn != null) p.push(t.kn < 0.5 ? "đang đứng" : `${t.kn.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} hải lý/h${t.huong != null ? ` hướng ${t.huong}°` : ""}`);
  if (t.dai) p.push(`${t.dai} m`);
  return p.join(" · ");
}
