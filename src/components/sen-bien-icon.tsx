"use client";
/*
  ICON SEN BIỂN — một hình, một bộ hiệu ứng theo trạng thái, dùng ở MỌI chỗ
  (icon nổi toàn app, icon nổi bản đồ, icon trong thẻ). Trạng thái đọc từ
  lib/sen-bien-state (một nguồn), hiệu ứng vẽ bằng CSS `.sen-icon[data-sen]`
  trong globals.css — không làm icon to ra, không che thêm nội dung.
*/
import { useSenBienState } from "@/lib/use-sen-bien";
import { senAria } from "@/lib/sen-bien-state";

export function SenBienIcon({ className = "" }: { className?: string }) {
  const st = useSenBienState();
  return (
    <span
      className={`sen-icon ${className}`}
      data-sen={st.mode}
      data-canh={st.canh ? "1" : undefined}
      style={st.level != null ? ({ "--sen-level": st.level } as React.CSSProperties) : undefined}
      role="img"
      aria-label={senAria(st)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- ảnh tĩnh trong máy */}
      <img src="/icons/sen-bien.png" alt="" draggable={false} />
    </span>
  );
}

/** Nhãn trợ năng hiện hành — cho nút bọc icon (aria-label đổi theo trạng thái). */
export function useSenAria(): string {
  return senAria(useSenBienState());
}
