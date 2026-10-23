"use client";

import { useEffect } from "react";

/**
 * Phím Escape đóng lớp nổi (rà bố cục 2026-10-22): bong bóng Sen Biển, bảng ký hiệu hải đồ,
 * hai hộp quản trị trước đây có role=dialog mà bàn phím không đóng được. Một hook cho mọi
 * lớp nổi tự dựng; BottomSheet/ConfirmDialog có bàn phím riêng (bẫy focus).
 */
export function useEscape(active: boolean, onEscape: () => void): void {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEscape();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, onEscape]);
}
