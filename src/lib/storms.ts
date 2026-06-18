// Trục 1 — cảnh báo bão / áp thấp nhiệt đới trên Biển Đông.
//
// Nguồn hiện tại: GDACS (hệ cảnh báo thiên tai toàn cầu EU/UN, JSON công khai,
// không key) — gọi qua API route /api/storms của app (tránh CORS + cache).
// Quy tắc adapter: đổi nguồn chỉ sửa file này + route, không đụng UI.
// An toàn là trên hết: nguồn fail → KHÔNG hiển thị "không có bão" — im lặng
// và để lời dặn nghe đài duyên hải làm việc của nó.

import { apiUrl } from "@/lib/api-base";

export type StormAlert = {
  id: string;
  /** Tên quốc tế của bão, vd "WUTIP" */
  name: string;
  /** "Áp thấp nhiệt đới" | "Bão" | "Bão mạnh" | "Siêu bão" theo gió mạnh nhất */
  kindLabel: string;
  windKmh: number | null;
  lat: number;
  lon: number;
  /** danger = nguồn đánh giá mức cam/đỏ; watch = mức xanh (vẫn phải nói) */
  alert: "watch" | "danger";
  updated: string;
};

export type StormCheck =
  | { ok: true; storms: StormAlert[]; checkedAt: string }
  | { ok: false };

/** Vùng quan tâm: Biển Đông + dải tiếp cận ngoài Philippines (cảnh báo sớm) */
export function inWatchRegion(lat: number, lon: number): boolean {
  return lon >= 99 && lon <= 132 && lat >= 3 && lat <= 27;
}

export function stormKindLabel(windKmh: number | null): string {
  if (windKmh == null) return "Bão / áp thấp";
  if (windKmh < 63) return "Áp thấp nhiệt đới";
  if (windKmh < 118) return "Bão";
  if (windKmh < 184) return "Bão mạnh";
  return "Siêu bão";
}

/** Giờ kết thúc + 48h vẫn coi là "đang hoạt động" (nguồn cập nhật trễ) */
const ACTIVE_GRACE_MS = 48 * 60 * 60 * 1000;

type GeoFeature = {
  geometry?: { type?: string; coordinates?: unknown };
  properties?: {
    eventid?: number | string;
    eventname?: string;
    alertlevel?: string;
    iscurrent?: string | boolean;
    todate?: string;
    datemodified?: string;
    severitydata?: { severity?: number };
  };
};

/**
 * Lọc GeoJSON của nguồn về danh sách bão trong vùng quan tâm.
 * `now` truyền vào để test được — không gọi Date.now() bên trong.
 */
export function parseStorms(json: unknown, now: Date): StormAlert[] {
  const features: GeoFeature[] =
    (json as { features?: GeoFeature[] })?.features ?? [];
  const seen = new Set<string>();
  const out: StormAlert[] = [];

  for (const f of features) {
    const p = f.properties ?? {};
    if (f.geometry?.type !== "Point") continue; // chỉ lấy tâm bão, bỏ polygon
    if (String(p.iscurrent) !== "true") continue;

    const coords = f.geometry.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const [lon, lat] = coords as [number, number];
    if (typeof lat !== "number" || typeof lon !== "number") continue;
    if (!inWatchRegion(lat, lon)) continue;

    // bão đã tan quá 48h thì thôi
    if (p.todate) {
      const end = new Date(`${p.todate}Z`).getTime();
      if (Number.isFinite(end) && now.getTime() - end > ACTIVE_GRACE_MS) {
        continue;
      }
    }

    const id = String(p.eventid ?? `${lat},${lon}`);
    if (seen.has(id)) continue;
    seen.add(id);

    const windKmh =
      typeof p.severitydata?.severity === "number"
        ? Math.round(p.severitydata.severity)
        : null;
    const level = (p.alertlevel ?? "").toLowerCase();

    out.push({
      id,
      name: p.eventname?.replace(/-\d+$/, "") ?? "chưa rõ tên",
      kindLabel: stormKindLabel(windKmh),
      windKmh,
      lat,
      lon,
      alert: level === "orange" || level === "red" ? "danger" : "watch",
      updated: p.datemodified ?? "",
    });
  }
  return out;
}

/** Client gọi route nội bộ — fail thì trả ok:false, UI tự im lặng */
export async function fetchStormCheck(): Promise<StormCheck> {
  try {
    const r = await fetch(apiUrl("/api/storms"), {
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return { ok: false };
    return (await r.json()) as StormCheck;
  } catch {
    return { ok: false };
  }
}
