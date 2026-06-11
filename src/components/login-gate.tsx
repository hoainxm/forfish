"use client";

import Link from "next/link";
import { LockIcon } from "@/components/icons";
import { useAuthUser } from "@/lib/use-auth";

/*
  LoginGate — phân loại tính năng (user chốt 2026-06-10): app yêu cầu đăng
  nhập (tài khoản đồng bộ SDWork) cho tính năng GIÁ TRỊ CAO — dự báo cá,
  nhu cầu mua cá; phần còn lại public. Component này bọc phần cần khóa:
  · chưa đăng nhập → thẻ khóa + lời mời + nút Đăng nhập (to, rõ)
  · đã đăng nhập → hiện nguyên nội dung
  Khóa UI chỉ là lớp vỏ — API đứng sau PHẢI tự kiểm session (không lách được).
*/

export function LoginGate({
  feature,
  blurb,
  children,
}: {
  /** Tên tính năng bị khóa, lời thường — vd "ai đang cần mua cá" */
  feature: string;
  /** Một câu nói rõ vào sẽ được gì */
  blurb?: string;
  children: React.ReactNode;
}) {
  const { user, ready } = useAuthUser();

  if (!ready) return null; // đang kiểm tra — đừng nhá khóa rồi mở
  if (user) return <>{children}</>;

  return (
    <div className="surface px-5 py-8 text-center">
      <span
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
        style={{ backgroundColor: "var(--t1-bg)", color: "var(--t1)" }}
        aria-hidden
      >
        <LockIcon className="h-7 w-7" />
      </span>
      <p className="display mt-3 text-[20px] font-bold text-navy">
        Đăng nhập để xem {feature}
      </p>
      <p className="mx-auto mt-1 max-w-[34ch] text-[16px] leading-snug text-foreground/65">
        {blurb ??
          "Tài khoản dùng chung với lúc mua hàng SDVICO — số điện thoại là vào được."}
      </p>
      <Link
        href="/login"
        className="display mx-auto mt-4 flex min-h-[56px] w-full max-w-[280px] items-center justify-center rounded-full bg-trim text-[18px] font-bold text-white shadow-[0_10px_24px_-8px_rgba(228,87,46,0.55)] transition active:scale-[0.98]"
      >
        Đăng nhập / Đăng ký
      </Link>
    </div>
  );
}
