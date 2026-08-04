// VÙNG BIỂN VMS do ADMIN quản lý (2026-07-28) — thay cho dữ liệu tĩnh
// data/vms-zones.json. Admin thêm/bớt/ẩn vùng + đặt "hiển thị mặc định trên app
// ngư dân" ngay trong /quan-tri (tab Vùng biển), áp dụng NGAY cho app (đọc bảng
// Supabase `vms_zones`, không cần build lại). Nhập hình vùng bằng cách TẢI FILE
// GeoJSON (như 3 file SDVico gửi) — server tự giản lược trước khi lưu.
//
// Đọc CÔNG KHAI (RLS visible=true) qua browser client — chưa cấu hình Supabase
// hoặc lỗi mạng → trả null, caller rơi về STATIC_VMS_ZONES (3 vùng mặc định lấy
// từ data/vms-zones.json, giữ nguyên hành vi demo mode).
//
// Helper THUẦN (validate/simplify/parse) tách để test ở
// src/lib/__tests__/vms-zones.test.ts.

import { createClient } from "@/lib/supabase/client";
import vmsZonesJson from "@/data/vms-zones.json";
import { timeoutSignal } from "@/lib/abort";

/** Cách vẽ vùng lên bản đồ: nền mờ, viền liền, hay viền nét đứt */
export type VmsZoneStyle = "fill" | "line" | "line-dashed";
export const VMS_ZONE_STYLES: VmsZoneStyle[] = ["fill", "line", "line-dashed"];

export interface VmsZone {
  id: string;
  name: string;
  /** màu hex (#rrggbb) — viền/nền */
  color: string;
  style: VmsZoneStyle;
  /** toggle của vùng này MẶC ĐỊNH bật trên app ngư dân (bà con vẫn tắt được) */
  defaultOn: boolean;
  /** admin bật/tắt vùng — false = ẩn hẳn, app không thấy */
  visible: boolean;
  geojson: GeoJSON.FeatureCollection;
  sortOrder: number;
  createdAt?: string;
}

/** Phần admin nhập khi thêm/sửa một vùng. */
export interface VmsZoneDraft {
  name: string;
  color: string;
  style: VmsZoneStyle;
  defaultOn: boolean;
  visible: boolean;
  geojson: GeoJSON.FeatureCollection;
}

export const VMS_ZONES_UPDATED: string = vmsZonesJson.updated;
const TABLE = "vms_zones";

// ── 3 VÙNG MẶC ĐỊNH (fallback demo mode) — từ data/vms-zones.json ────────────
// Vùng "được phép" hiển thị dạng CUNG NGOÀI KHƠI (allowedOffshore, đỏ nét đứt),
// không phải cả polygon — theo chốt 2026-07-28 (biên giới mới = viền ngoài khơi).
export const STATIC_VMS_ZONES: VmsZone[] = [
  {
    id: "default-allowed-offshore",
    name: "Ranh giới ngoài khơi (được phép)",
    color: "#dc2626",
    style: "line-dashed",
    defaultOn: true,
    visible: true,
    geojson: vmsZonesJson.allowedOffshore as unknown as GeoJSON.FeatureCollection,
    sortOrder: 0,
  },
  {
    id: "default-caution",
    name: "Cần chú ý khi đánh bắt",
    color: "#eab308",
    style: "line",
    defaultOn: true,
    visible: true,
    geojson: vmsZonesJson.caution as unknown as GeoJSON.FeatureCollection,
    sortOrder: 1,
  },
  {
    id: "default-bottom",
    name: "Chỉ đánh được cá đáy",
    color: "#f97316",
    style: "line",
    defaultOn: true,
    visible: true,
    geojson: vmsZonesJson.bottomOnly as unknown as GeoJSON.FeatureCollection,
    sortOrder: 2,
  },
];

// ── Helper THUẦN (test được) ────────────────────────────────────────────────

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Trả câu lỗi tiếng Việt nếu draft chưa hợp lệ, null nếu OK. */
export function validateZoneDraft(d: VmsZoneDraft): string | null {
  if (!d.name.trim()) return "Nhập tên vùng.";
  if (!HEX.test(d.color)) return "Màu phải dạng #rrggbb.";
  if (!VMS_ZONE_STYLES.includes(d.style)) return "Kiểu vẽ không hợp lệ.";
  const feats = d.geojson?.features;
  if (!Array.isArray(feats) || feats.length === 0)
    return "Tệp GeoJSON trống hoặc sai định dạng.";
  return null;
}

type AnyGeom = {
  type: string;
  coordinates?: unknown;
  geometries?: unknown;
};

/**
 * Đọc chuỗi GeoJSON tải lên → FeatureCollection chuẩn (gói Geometry/Feature lẻ
 * thành FC). Ném lỗi tiếng Việt nếu không parse được / không có toạ độ.
 */
export function parseUploadedGeoJSON(text: string): GeoJSON.FeatureCollection {
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error("Không đọc được tệp — không phải JSON hợp lệ.");
  }
  const o = obj as { type?: string; features?: unknown; geometry?: unknown };
  let features: GeoJSON.Feature[];
  if (o?.type === "FeatureCollection" && Array.isArray(o.features)) {
    features = o.features as GeoJSON.Feature[];
  } else if (o?.type === "Feature") {
    features = [obj as GeoJSON.Feature];
  } else if (
    typeof o?.type === "string" &&
    ["Polygon", "MultiPolygon", "LineString", "MultiLineString"].includes(o.type)
  ) {
    features = [
      { type: "Feature", properties: {}, geometry: obj as GeoJSON.Geometry },
    ];
  } else {
    throw new Error("Tệp không phải GeoJSON (thiếu FeatureCollection/Feature).");
  }
  const clean = features.filter(
    (f) => f?.geometry && (f.geometry as AnyGeom).coordinates,
  );
  if (clean.length === 0) throw new Error("GeoJSON không có vùng nào.");
  return { type: "FeatureCollection", features: clean };
}

// ── Giản lược (Douglas–Peucker) — bản TS của scripts/convert-vms-zones.py ────

function perpDist(
  p: number[],
  a: number[],
  b: number[],
): number {
  const [ax, ay] = a;
  const [bx, by] = b;
  const [px, py] = p;
  const dx = bx - ax;
  const dy = by - ay;
  const den = Math.hypot(dx, dy);
  if (den === 0) return Math.hypot(px - ax, py - ay);
  return Math.abs(dx * (ay - py) - dy * (ax - px)) / den;
}

function dpLine(points: number[][], tol: number): number[][] {
  if (points.length < 3) return points;
  const keep = new Array(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let maxD = -1;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = perpDist(points[i], points[a], points[b]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tol && idx !== -1) {
      keep[idx] = true;
      stack.push([a, idx], [idx, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function round(n: number, d = 4): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

function simplifyRing(ring: number[][], tol: number, closed: boolean): number[][] {
  const r = ring.map((p) => [round(p[0]), round(p[1])]);
  const s = dpLine(r, tol);
  if (closed && (s[0][0] !== s[s.length - 1][0] || s[0][1] !== s[s.length - 1][1])) {
    s.push(s[0]);
  }
  return s;
}

function simplifyGeometry(g: AnyGeom, tol: number): GeoJSON.Geometry | null {
  switch (g.type) {
    case "Polygon": {
      const rings = (g.coordinates as number[][][])
        .map((r) => simplifyRing(r, tol, true))
        .filter((r) => r.length >= 4);
      return rings.length
        ? { type: "Polygon", coordinates: rings }
        : null;
    }
    case "MultiPolygon": {
      const polys = (g.coordinates as number[][][][])
        .map((poly) =>
          poly.map((r) => simplifyRing(r, tol, true)).filter((r) => r.length >= 4),
        )
        .filter((poly) => poly.length > 0);
      return polys.length
        ? { type: "MultiPolygon", coordinates: polys }
        : null;
    }
    case "LineString": {
      const line = simplifyRing(g.coordinates as number[][], tol, false);
      return line.length >= 2 ? { type: "LineString", coordinates: line } : null;
    }
    case "MultiLineString": {
      const lines = (g.coordinates as number[][][])
        .map((l) => simplifyRing(l, tol, false))
        .filter((l) => l.length >= 2);
      return lines.length
        ? { type: "MultiLineString", coordinates: lines }
        : null;
    }
    default:
      return null;
  }
}

/** Giản lược FeatureCollection (Douglas–Peucker ~1km mặc định); giữ lại tên. */
export function simplifyFeatureCollection(
  fc: GeoJSON.FeatureCollection,
  tolDeg = 0.01,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const f of fc.features) {
    const g = simplifyGeometry(f.geometry as AnyGeom, tolDeg);
    if (g) features.push({ type: "Feature", properties: f.properties ?? {}, geometry: g });
  }
  return { type: "FeatureCollection", features };
}

/** Đếm tổng số điểm toạ độ trong FeatureCollection (để cảnh báo tệp quá nặng). */
export function countPoints(fc: GeoJSON.FeatureCollection): number {
  let n = 0;
  const walk = (c: unknown): void => {
    if (Array.isArray(c)) {
      if (typeof c[0] === "number") n++;
      else c.forEach(walk);
    }
  };
  for (const f of fc.features) walk((f.geometry as AnyGeom).coordinates);
  return n;
}

// ── Đọc công khai (client, app ngư dân) ─────────────────────────────────────

type Row = {
  id: string;
  name: string;
  color: string;
  style: string;
  default_on: boolean;
  visible: boolean;
  geojson: unknown;
  sort_order: number;
  created_at: string;
};

function toStyle(s: string): VmsZoneStyle {
  return VMS_ZONE_STYLES.includes(s as VmsZoneStyle)
    ? (s as VmsZoneStyle)
    : "line";
}

export function rowToZone(r: Row): VmsZone {
  const gj = r.geojson as GeoJSON.FeatureCollection | null;
  return {
    id: r.id,
    name: r.name,
    color: HEX.test(r.color) ? r.color : "#0d9488",
    style: toStyle(r.style),
    defaultOn: r.default_on,
    visible: r.visible,
    geojson:
      gj && Array.isArray(gj.features)
        ? gj
        : { type: "FeatureCollection", features: [] },
    sortOrder: r.sort_order,
    createdAt: r.created_at,
  };
}

/**
 * Vùng đang HIỆN (visible=true) cho app ngư dân, sắp theo sort_order. null =
 * Supabase chưa cấu hình / lỗi → caller dùng STATIC_VMS_ZONES. Mảng rỗng = admin
 * đã xóa/ẩn hết — tôn trọng (KHÔNG fallback).
 */
export async function fetchPublicVmsZones(): Promise<VmsZone[] | null> {
  const supabase = createClient();
  if (!supabase) return null;
  // ĐỒNG HỒ 12 GIÂY (D-PH9, soát 2026-08-02): hỏng thì rơi về vùng tĩnh nên
  // vô hại với màn hình, NHƯNG không có trần thì ở sóng "sống mà chết" nó để
  // lại một promise + một kết nối treo suốt phiên, mỗi lần mở màn thêm một
  // cái nữa. `.abortSignal()` không nhận `undefined` sạch ⇒ gắn có điều kiện.
  const sig = timeoutSignal(12000);
  let q = supabase
    .from(TABLE)
    .select("id,name,color,style,default_on,visible,geojson,sort_order,created_at")
    .eq("visible", true)
    .order("sort_order", { ascending: true })
    .limit(200);
  if (sig) q = q.abortSignal(sig);
  const { data, error } = await q;
  if (error || !data) return null;
  return (data as Row[]).map(rowToZone);
}
