"use client";

/*
  Tuỳ chọn bản đồ Ra khơi (đơn vị + hệ toạ độ) — store dùng chung để khi đổi ở
  panel "Cài đặt" thì MỌI chỗ hiển thị khoảng cách/toạ độ đổi theo (peek, sheet,
  dẫn đường, công cụ đo). Lưu localStorage `forfish.mapPrefs.v1` (giữ tiền tố
  forfish.* theo hạ tầng cũ). Pattern: module store + useSyncExternalStore.
*/
import { useSyncExternalStore } from "react";
import { formatNumberVN } from "@/lib/marine-weather";

export type DistUnit = "nm" | "km";
/** dd = độ thập phân (8,50°); dms = độ-phút (8°30′) */
export type CoordFormat = "dd" | "dms";
export interface MapPrefs {
  distUnit: DistUnit;
  coordFormat: CoordFormat;
  /** Kẻ lưới ô toạ độ trên bản đồ (graticule) — KHÔNG liên quan dự báo cá */
  mapGrid: boolean;
  /** Ranh giới vùng lộng (NĐ 26/2019, tàu 12–<15m) — nét đứt teal */
  vungLong: boolean;
  /** Vùng VMS: được phép đánh bắt (viền + nền xanh lá nhạt) */
  vmsAllowed: boolean;
  /** Vùng VMS: cần chú ý khi đánh bắt (quanh Hoàng Sa/Trường Sa, vàng cam) */
  vmsCaution: boolean;
  /** Vùng VMS: chỉ được đánh cá đáy (giáp VN–Indonesia, tím) */
  vmsBottomOnly: boolean;
}

const KEY = "forfish.mapPrefs.v1";
const DEFAULT: MapPrefs = {
  distUnit: "nm",
  coordFormat: "dd",
  mapGrid: true,
  vungLong: true,
  vmsAllowed: true,
  vmsCaution: true,
  vmsBottomOnly: true,
};
const KM_PER_NM = 1.852;

let state: MapPrefs = DEFAULT;
let loaded = false;
const listeners = new Set<() => void>();

function load(): MapPrefs {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const p = JSON.parse(raw) as Partial<MapPrefs>;
    return {
      distUnit: p.distUnit === "km" ? "km" : "nm",
      coordFormat: p.coordFormat === "dms" ? "dms" : "dd",
      // các lớp ranh giới mặc định bật; chỉ tắt khi đã lưu false
      mapGrid: p.mapGrid !== false,
      vungLong: p.vungLong !== false,
      vmsAllowed: p.vmsAllowed !== false,
      vmsCaution: p.vmsCaution !== false,
      vmsBottomOnly: p.vmsBottomOnly !== false,
    };
  } catch {
    return DEFAULT;
  }
}

function ensure() {
  if (!loaded) {
    state = load();
    loaded = true;
  }
}

export function setMapPrefs(patch: Partial<MapPrefs>) {
  ensure();
  state = { ...state, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* localStorage chặn (private mode) — vẫn chạy in-memory */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
function getSnapshot(): MapPrefs {
  ensure();
  return state;
}

export function useMapPrefs(): MapPrefs {
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT);
}

// ── ĐƠN VỊ KHOẢNG CÁCH ─────────────────────────────────────────────────────

export function kmToUnit(km: number, unit: DistUnit): number {
  return unit === "km" ? km : km / KM_PER_NM;
}
export function distUnitLabel(unit: DistUnit): string {
  return unit === "km" ? "km" : "hải lý";
}
/** "349 hải lý" / "646 km" — làm tròn theo digits (mặc định số nguyên). */
export function fmtDist(km: number, unit: DistUnit, digits = 0): string {
  return `${formatNumberVN(kmToUnit(km, unit), digits)} ${distUnitLabel(unit)}`;
}

// ── HỆ TOẠ ĐỘ ──────────────────────────────────────────────────────────────

function oneCoord(v: number, fmt: CoordFormat, pos: string, neg: string): string {
  const hemi = v >= 0 ? pos : neg;
  const a = Math.abs(v);
  if (fmt === "dms") {
    const d = Math.floor(a);
    const m = Math.round((a - d) * 60);
    // 60′ tràn → cộng độ
    const dd = m === 60 ? d + 1 : d;
    const mm = m === 60 ? 0 : m;
    return `${dd}°${String(mm).padStart(2, "0")}′${hemi}`;
  }
  return `${formatNumberVN(a, 2)}°${hemi}`;
}
export function fmtLat(lat: number, fmt: CoordFormat): string {
  return oneCoord(lat, fmt, "B", "N"); // Bắc / Nam
}
export function fmtLon(lon: number, fmt: CoordFormat): string {
  return oneCoord(lon, fmt, "Đ", "T"); // Đông / Tây
}
export function fmtCoordPair(lat: number, lon: number, fmt: CoordFormat): string {
  return `${fmtLat(lat, fmt)} · ${fmtLon(lon, fmt)}`;
}
