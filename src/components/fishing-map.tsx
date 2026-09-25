"use client";

/**
 * Trục 1 — vỏ lazy-load cho bản đồ đi biển. Thư viện bản đồ nặng nên chỉ
 * tải khi người dùng vào trang này; các trục khác không gánh thêm bundle.
 */
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { prefetchDataKey } from "@/lib/data-key";
import { registerPmtilesProtocol } from "@/lib/pmtiles-protocol";
import { registerDataProtocol } from "@/lib/data-protocol";

// Đăng ký protocol pmtiles:// và sdfdata:// (GeoJSON tĩnh qua bộ giải mã file
// dữ liệu) NGAY khi vỏ client này nạp — trước khi map dựng.
registerPmtilesProtocol();
registerDataProtocol();

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
