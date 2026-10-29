"use client";

/**
 * Trục 1 — vỏ lazy-load cho bản đồ đi biển. Thư viện bản đồ nặng nên chỉ
 * tải khi người dùng vào trang này; các trục khác không gánh thêm bundle.
 */
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { prefetchDataKey } from "@/lib/data-key";

/*  Đăng ký protocol pmtiles:// và sdfdata:// đã DỜI vào fishing-map-view.tsx (rà tốc độ
    2026-10-29). Hai file đăng ký import `maplibre-gl`, nên gọi chúng ở vỏ này là kéo
    266 KB gzip của thư viện bản đồ vào lần tải đầu của route — và dock tải trước route
    này ở MỌI màn, kể cả khách chỉ thấy cổng đăng nhập. Ở fishing-map-view (nạp động)
    thì chúng chạy lúc module nạp, vẫn TRƯỚC khi map dựng. ĐỪNG import lại ở đây. */

const FishingMapView = dynamic(() => import("@/components/fishing-map-view"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-t1-bg">
      <p className="text-[1.125rem] font-semibold text-t1">Đang tải bản đồ biển…</p>
    </div>
  ),
});

export function FishingMap() {
  // Xin sẵn khoá giải nhóm file biên tập (SDF2) lúc còn sóng — vỏ này chỉ dựng
  // khi đã đăng nhập (RequireLogin). Kho có rồi thì hàm tự thôi, không tốn lượt.
  useEffect(() => {
    prefetchDataKey();
  }, []);
  return <FishingMapView />;
}
