"use client";

/**
 * Vỏ lazy-load cho CHẾ ĐỘ HẢI ĐỒ (`/hai-do`) — cùng cách vỏ `fishing-map.tsx`:
 * thư viện bản đồ chỉ tải khi vào màn này; protocol pmtiles:// + sdfdata:// đăng ký
 * trong hai-do-view (nạp động), KHÔNG ở đây.
 */
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { prefetchDataKey } from "@/lib/data-key";

const HaiDoView = dynamic(() => import("@/components/hai-do/hai-do-view"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-t1-bg">
      <p className="text-[1.125rem] font-semibold text-t1">Đang tải hải đồ…</p>
    </div>
  ),
});

export function HaiDo() {
  // xin sẵn khoá giải file biên tập (SDF2) lúc còn sóng — như vỏ bản đồ cũ
  useEffect(() => {
    prefetchDataKey();
  }, []);
  return <HaiDoView />;
}
