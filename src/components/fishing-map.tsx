"use client";

/**
 * Trục 1 — vỏ lazy-load cho bản đồ đi biển. Thư viện bản đồ nặng nên chỉ
 * tải khi người dùng vào trang này; các trục khác không gánh thêm bundle.
 */
import dynamic from "next/dynamic";

const FishingMapView = dynamic(() => import("@/components/fishing-map-view"), {
  ssr: false,
  loading: () => (
    <div className="mx-4 flex h-[420px] items-center justify-center rounded-xl bg-t1-bg ring-1 ring-line">
      <p className="text-[17px] font-semibold text-t1">Đang mở bản đồ biển…</p>
    </div>
  ),
});

export function FishingMap() {
  return <FishingMapView />;
}
