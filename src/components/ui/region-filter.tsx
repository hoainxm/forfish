"use client";

import Link from "next/link";
import { useBoats } from "@/components/boat-switcher";
import { HomePref, relevanceRank } from "@/lib/region";

/*
  Lọc theo "tàu của tôi ở đâu" — để chỉ hiện thông tin GẦN bà con.

  NGUỒN SỰ THẬT DUY NHẤT = `current boat.homeProvince` (khai báo ở BoatSwitcher).
  Trước đây có 1 nguồn localStorage riêng (`forfish.home.v1`) trùng với phần
  khai báo trong tàu → user thấy 3 chỗ hỏi cùng câu, không sync. Đã xóa.

  useHome(): đọc tỉnh nhà từ tàu đang chọn.
  HomeBar:   chỉ còn toggle "Chỉ gần tôi / Cả nước" — KHÔNG còn select tỉnh
             (tỉnh nằm ở khai báo tàu); nếu tàu chưa có cảng nhà → nhắc khai báo.
*/

export function useHome(): { home: HomePref; ready: boolean } {
  const { current, ready } = useBoats();
  return {
    home: { province: current?.homeProvince, portId: current?.homePortId },
    ready,
  };
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
 * Thanh lọc — chỉ hiện khi tàu đã khai báo tỉnh cảng nhà.
 * Không khai báo → hiện link gọn nhắc bà con chỉnh thông tin tàu.
 */
export function HomeBar({
  home,
  near,
  setNear,
}: {
  home: HomePref;
  /** Giữ chữ ký cũ để caller không phải đổi — không dùng tới. */
  setHome?: (h: HomePref) => void;
  near: boolean;
  setNear: (v: boolean) => void;
}) {
  if (!home.province) {
    return (
      <div className="mb-3 surface p-3">
        <p className="text-[0.875rem] text-foreground/65 leading-snug">
          Khai báo <strong>tỉnh cảng nhà</strong> trong thẻ &quot;Tàu của
          tôi&quot; ở trên để app chỉ hiện nơi gần.
        </p>
        <Link
          href="/tau"
          className="mt-1.5 inline-block text-[0.875rem] font-bold text-sea"
        >
          Đi tới tàu của tôi →
        </Link>
      </div>
    );
  }
  return (
    <div className="mb-3 grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => setNear(true)}
        aria-pressed={near}
        className={`min-h-[2.75rem] rounded-xl text-[0.9375rem] font-bold ${
          near ? "bg-navy text-white" : "bg-field text-foreground/70"
        }`}
      >
        Gần {home.province}
      </button>
      <button
        type="button"
        onClick={() => setNear(false)}
        aria-pressed={!near}
        className={`min-h-[2.75rem] rounded-xl text-[0.9375rem] font-bold ${
          !near ? "bg-navy text-white" : "bg-field text-foreground/70"
        }`}
      >
        Cả nước
      </button>
    </div>
  );
}
