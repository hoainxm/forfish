"use client";

/*
  CHẾ ĐỘ HẢI ĐỒ — TRẠNG THÁI ĐANG CHẠY phải sống qua tắt/mở app (2026-11-04, đợt 2):
    `forfish.haiDoNeo.v1` — neo đang canh  ·  `forfish.haiDoMob.v1` — điểm người rơi.
  Mất pin / lỡ vuốt tắt app giữa đêm mà mất điểm MOB hay vòng neo là chuyện tính mạng
  ⇒ ghi ngay vào máy. KHÔNG sao lưu sang máy khác (toạ độ một lúc, của một máy) —
  `offline-backup` NEVER_BACKUP. Đọc hỏng ⇒ coi như không có (không bịa toạ độ).
*/
import { useSyncExternalStore } from "react";
import type { Mob, Neo } from "@/lib/hai-do/may";

export const NEO_KEY = "forfish.haiDoNeo.v1";
export const MOB_KEY = "forfish.haiDoMob.v1";

const so = (v: unknown) => typeof v === "number" && Number.isFinite(v);

/** Đọc neo đã lưu (thuần, có test). Toạ độ/bán kính hỏng ⇒ null. */
export function docNeo(raw: string | null): Neo | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<Neo>;
    if (!so(p.lat) || !so(p.lon) || !so(p.banKinhM) || !so(p.luc)) return null;
    if (Math.abs(p.lat!) > 90 || Math.abs(p.lon!) > 180 || p.banKinhM! <= 0) return null;
    return { lat: p.lat!, lon: p.lon!, banKinhM: p.banKinhM!, luc: p.luc! };
  } catch {
    return null;
  }
}

/** Đọc MOB đã lưu (thuần, có test). */
export function docMob(raw: string | null): Mob | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<Mob>;
    if (!so(p.lat) || !so(p.lon) || !so(p.luc)) return null;
    if (Math.abs(p.lat!) > 90 || Math.abs(p.lon!) > 180) return null;
    return { lat: p.lat!, lon: p.lon!, luc: p.luc! };
  } catch {
    return null;
  }
}

function taoKho<T>(key: string, doc: (raw: string | null) => T | null) {
  let v: T | null = null;
  let loaded = false;
  const ls = new Set<() => void>();
  const ensure = () => {
    if (loaded || typeof window === "undefined") return;
    try {
      v = doc(localStorage.getItem(key));
    } catch {
      v = null;
    }
    loaded = true;
  };
  return {
    set(x: T | null) {
      ensure();
      v = x;
      try {
        if (x == null) localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify(x));
      } catch {
        /* máy chặn lưu — vẫn chạy trong bộ nhớ, mất khi tắt app */
      }
      ls.forEach((l) => l());
    },
    use(): T | null {
      return useSyncExternalStore(
        (cb) => {
          ls.add(cb);
          return () => {
            ls.delete(cb);
          };
        },
        () => {
          ensure();
          return v;
        },
        () => null,
      );
    },
  };
}

const khoNeo = taoKho<Neo>(NEO_KEY, docNeo);
const khoMob = taoKho<Mob>(MOB_KEY, docMob);
export const setNeo = khoNeo.set;
export const useNeo = khoNeo.use;
export const setMob = khoMob.set;
export const useMob = khoMob.use;
