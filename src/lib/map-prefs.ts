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
/**
 * dd = độ thập phân (8,50°N); dms = độ-phút-giây (8°30′00″N) — MẶC ĐỊNH là dms.
 * Chữ bán cầu dùng N/S/E/W QUỐC TẾ (không phải B/N/Đ/T tiếng Việt): trùng chữ
 * trên máy định vị, hải đồ, VMS; chữ Việt "N" (Nam) đọc ngược với N (North).
 */
export type CoordFormat = "dd" | "dms";
export interface MapPrefs {
  distUnit: DistUnit;
  coordFormat: CoordFormat;
  /** Kẻ lưới ô toạ độ trên bản đồ (graticule) — KHÔNG liên quan dự báo cá */
  mapGrid: boolean;
  /** Ranh giới vùng lộng (NĐ 26/2019, tàu 12–<15m) — nét đứt teal */
  vungLong: boolean;
  /**
   * Ghi đè bật/tắt vùng biển VMS theo id (vùng do admin quản lý, danh sách
   * động). KHÔNG có id trong map = dùng `defaultOn` của vùng. Bà con bật/tắt
   * thì lưu override ở đây; đổi vùng mặc định bên admin vẫn tôn trọng lựa chọn
   * cũ của từng người.
   */
  vmsOverrides: Record<string, boolean>;
}

const KEY = "forfish.mapPrefs.v1";
const DEFAULT: MapPrefs = {
  distUnit: "nm",
  // độ-phút MẶC ĐỊNH (user 2026-07-31): khớp máy định vị/hải đồ bà con đang dùng
  coordFormat: "dms",
  mapGrid: false, // lưới kẻ ô toạ độ MẶC ĐỊNH ẨN (user 2026-07-28)
  vungLong: true,
  vmsOverrides: {},
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
      // độ-phút mặc định — chỉ dùng độ thập phân khi đã lưu "dd" (user tự chọn)
      coordFormat: p.coordFormat === "dd" ? "dd" : "dms",
      // lưới kẻ ô toạ độ MẶC ĐỊNH ẨN — chỉ hiện khi đã lưu true (user chốt bật)
      mapGrid: p.mapGrid === true,
      // ranh giới vùng lộng mặc định bật; chỉ tắt khi đã lưu false
      vungLong: p.vungLong !== false,
      vmsOverrides:
        p.vmsOverrides && typeof p.vmsOverrides === "object"
          ? (p.vmsOverrides as Record<string, boolean>)
          : {},
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

// ── VÙNG BIỂN VMS (bật/tắt theo id) ─────────────────────────────────────────

/** Vùng có đang hiện không: override của bà con (nếu có), không thì defaultOn. */
export function isVmsZoneOn(
  overrides: Record<string, boolean>,
  id: string,
  defaultOn: boolean,
): boolean {
  return id in overrides ? overrides[id] : defaultOn;
}

/** Lưu bật/tắt một vùng VMS (ghi override). */
export function setVmsZoneOn(id: string, on: boolean) {
  ensure();
  setMapPrefs({ vmsOverrides: { ...state.vmsOverrides, [id]: on } });
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
    // Làm tròn về GIÂY trước rồi mới tách — tránh 60″/60′ tràn lẻ tẻ
    const total = Math.round(a * 3600);
    const d = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const p2 = (n: number) => String(n).padStart(2, "0");
    return `${d}°${p2(m)}′${p2(s)}″${hemi}`;
  }
  return `${formatNumberVN(a, 2)}°${hemi}`;
}
export function fmtLat(lat: number, fmt: CoordFormat): string {
  return oneCoord(lat, fmt, "N", "S"); // North / South — chữ cái QUỐC TẾ
}
export function fmtLon(lon: number, fmt: CoordFormat): string {
  return oneCoord(lon, fmt, "E", "W"); // East / West — khớp máy định vị, hải đồ
}
export function fmtCoordPair(lat: number, lon: number, fmt: CoordFormat): string {
  return `${fmtLat(lat, fmt)} · ${fmtLon(lon, fmt)}`;
}
