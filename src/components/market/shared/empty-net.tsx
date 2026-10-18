"use client";

import type { ReactNode } from "react";
import { AlertIcon } from "@/components/icons";
import { PrimaryButton } from "@/components/ui/primitives";
import { savedAgoLabel } from "@/lib/forecast-cache";

/**
 * Màn "máy đang không có sóng" (11 §9): nói thật + nút Thử lại; có `savedAt`
 * ⇒ "Đang xem bản đã lưu …"; `extra` cho nút phụ (vd "Xem đơn của tôi").
 */
export function EmptyNet({
  what,
  onRetry,
  savedAt,
  extra,
  className = "",
}: {
  what: string;
  onRetry: () => void;
  savedAt?: number;
  extra?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-[1.25rem] bg-field/70 px-4 py-8 text-center ${className}`} role="status">
      <div className="mx-auto mb-3 w-fit text-foreground/65">
        <AlertIcon className="h-8 w-8" />
      </div>
      <p className="text-[1.125rem] font-bold text-navy">Máy đang không có sóng — {what} cần mạng.</p>
      {savedAt != null && (
        <p className="mt-1 text-[1rem] text-foreground/70">Đang xem bản đã lưu ({savedAgoLabel(savedAt)}).</p>
      )}
      <PrimaryButton className="mt-5" onClick={onRetry}>Thử lại</PrimaryButton>
      {extra && <div className="mt-3">{extra}</div>}
    </div>
  );
}
