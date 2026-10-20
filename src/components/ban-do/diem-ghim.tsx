"use client";

/*
  GHIM TRÊN BẢN ĐỒ: hồng tâm điểm nhiều cá + chỗ bà con đã ghim (cảng nhà / sao).
  Tách khỏi fishing-map-view.tsx (rà Codex lần 10 — file >8.400 dòng); hành vi
  giữ nguyên. Cả hai là NÚT GỐC (không `span role="button"`): vào được bằng Tab,
  Enter/Space bấm được; click của nút nổi lên phần tử Marker ⇒ `onPick` chạy
  như chạm ngón tay.
*/
import { Marker } from "react-map-gl/maplibre";
import { HomeIcon, StarIcon, TargetIcon } from "@/components/icons";
import type { SavedPlace } from "@/lib/places";

export type FishHotspot = { lat: number; lon: number; v: number; top: string[]; near: boolean };

/** HỒNG TÂM điểm nóng dự báo cá — chạm là tới + xem dự báo chỗ đó */
export function FishHotspotMarker({
  h,
  color,
  onPick,
}: {
  h: FishHotspot;
  /** màu loài đang chọn (token var(--sp-…)); null = "Mọi loài" */
  color: string | null;
  onPick: (lat: number, lon: number) => void;
}) {
  return (
    <Marker longitude={h.lon} latitude={h.lat} anchor="center" onClick={() => onPick(h.lat, h.lon)}>
      <button
        type="button"
        className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/85 shadow-md ring-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sea ${
          h.near ? "ring-trim" : "ring-white/90"
        }`}
        style={{ color: color ?? "var(--fish-all-to)" }}
        aria-label={`Điểm có khả năng nhiều cá${h.near ? " gần bạn" : ""}: ${h.top.join(", ")}`}
      >
        <TargetIcon className="h-6 w-6" />
      </button>
    </Marker>
  );
}

/** ĐIỂM CỦA TÔI đã ghim — sao vàng có tên (cảng nhà = nhà xanh); chạm là xem dự báo chỗ đó */
export function SavedPlaceMarker({
  pl,
  onPick,
}: {
  pl: SavedPlace;
  onPick: (lat: number, lon: number) => void;
}) {
  return (
    <Marker longitude={pl.lon} latitude={pl.lat} anchor="center" onClick={() => onPick(pl.lat, pl.lon)}>
      <button
        type="button"
        aria-label={`${pl.kind === "home" ? "Cảng nhà" : "Chỗ đã ghim"}: ${pl.name} — xem gió sóng chỗ này`}
        className="flex cursor-pointer flex-col items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sea"
      >
        <span
          aria-hidden
          className={`flex h-8 w-8 items-center justify-center rounded-full text-white shadow-md ${
            pl.kind === "home" ? "bg-t1" : "bg-sun"
          }`}
        >
          {pl.kind === "home" ? <HomeIcon className="h-4.5 w-4.5" /> : <StarIcon className="h-4.5 w-4.5" />}
        </span>
        <span
          aria-hidden
          className="mt-0.5 max-w-[6.875rem] truncate rounded bg-white/85 px-1.5 text-[0.625rem] font-bold leading-tight text-navy shadow-sm"
        >
          {pl.name}
        </span>
      </button>
    </Marker>
  );
}
