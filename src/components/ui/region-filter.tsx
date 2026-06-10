"use client";

import { useEffect, useState } from "react";
import {
  COASTAL_PROVINCES,
  HomePref,
  REGION_LABEL,
  loadHome,
  relevanceRank,
  saveHome,
} from "@/lib/region";

/*
  Lọc theo "tàu của tôi ở đâu" — để chỉ hiện thông tin GẦN bà con.
  useHome(): nhớ tỉnh nhà trong localStorage; HomeBar: thanh chọn tỉnh +
  nút "Chỉ gần tôi / Cả nước"; applyHome(): lọc + sắp theo độ liên quan.
*/

export function useHome() {
  const [home, setHomeState] = useState<HomePref>({});
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setHomeState(loadHome());
    setReady(true);
  }, []);
  function setHome(h: HomePref) {
    setHomeState(h);
    saveHome(h);
  }
  return { home, setHome, ready };
}

/** Lọc danh sách theo tỉnh nhà: near=true chỉ giữ cùng miền; luôn sắp gần→xa. */
export function applyHome<T>(
  items: T[],
  getProvince: (x: T) => string | undefined,
  homeProvince: string | undefined,
  near: boolean,
): T[] {
  const ranked = items.map((x) => ({
    x,
    r: relevanceRank(getProvince(x), homeProvince),
  }));
  const filtered =
    near && homeProvince ? ranked.filter((o) => o.r <= 1) : ranked;
  return filtered.sort((a, b) => a.r - b.r).map((o) => o.x);
}

/**
 * Thanh chọn vùng: chọn tỉnh nhà + bật/tắt "chỉ gần tôi".
 * Caller giữ state `near` để lọc list của mình.
 */
export function HomeBar({
  home,
  setHome,
  near,
  setNear,
}: {
  home: HomePref;
  setHome: (h: HomePref) => void;
  near: boolean;
  setNear: (v: boolean) => void;
}) {
  return (
    <div className="mb-3 surface p-3">
      <label className="block">
        <span className="mb-1 block text-[14px] font-bold text-navy">
          Tàu của tôi hay cập cảng ở tỉnh:
        </span>
        <select
          value={home.province ?? ""}
          onChange={(e) =>
            setHome({ ...home, province: e.target.value || undefined })
          }
          className="min-h-[48px] w-full rounded-2xl border-0 bg-field px-3 text-[16px] font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea"
        >
          <option value="">— Chọn tỉnh để xem nơi gần —</option>
          {(["bac", "trung", "nam"] as const).map((rg) => (
            <optgroup key={rg} label={REGION_LABEL[rg]}>
              {COASTAL_PROVINCES.filter((p) => p.region === rg).map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      {home.province && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setNear(true)}
            aria-pressed={near}
            className={`min-h-[44px] rounded-xl text-[15px] font-bold ${
              near ? "bg-navy text-white" : "bg-field text-foreground/60"
            }`}
          >
            Chỉ gần tôi
          </button>
          <button
            type="button"
            onClick={() => setNear(false)}
            aria-pressed={!near}
            className={`min-h-[44px] rounded-xl text-[15px] font-bold ${
              !near ? "bg-navy text-white" : "bg-field text-foreground/60"
            }`}
          >
            Cả nước
          </button>
        </div>
      )}
    </div>
  );
}
