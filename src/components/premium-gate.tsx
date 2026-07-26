"use client";

import Link from "next/link";
import { LockIcon, PhoneIcon } from "@/components/icons";
import {
  SDVICO_HOTLINE,
  SDVICO_HOTLINE_DISPLAY,
} from "@/data/sdvico-showcase";
import type { FeatureAccess } from "@/lib/tier";

/*
  PremiumLock — thẻ khoá tính năng PREMIUM (dự báo cá, thời tiết quá 3 ngày),
  chốt 2026-07-26. Hai lời mời theo nấc (lib/tier.ts):
  · access "login":   chưa đăng nhập → nút Đăng nhập (như LoginGate)
  · access "upgrade": đã đăng nhập, hạng thường → GỌI SDVICO nâng cấp
    (không có luồng thanh toán trong app — sales gán premium bên SDWork)
  access "open"/"checking" thì component KHÔNG render gì — caller cứ đặt cạnh
  nội dung, không cần if bên ngoài.
  Khoá UI chỉ là lớp vỏ — /api/fish-forecast bị chặn thật ở middleware.
*/

export function PremiumLock({
  access,
  feature,
  blurb,
  accent = "t1",
  compact = false,
}: {
  access: FeatureAccess;
  /** Tên tính năng bị khoá, lời thường — vd "dự báo cá", "dự báo 16 ngày" */
  feature: string;
  /** Một câu nói rõ vào sẽ được gì (tuỳ chọn) */
  blurb?: string;
  /** Màu trục của khu đặt khoá (t1…t4) */
  accent?: "t1" | "t2" | "t3" | "t4";
  /** Bản gọn cho panel hẹp (không icon tròn to) */
  compact?: boolean;
}) {
  if (access !== "login" && access !== "upgrade") return null;

  const title =
    access === "login"
      ? `Đăng nhập để xem ${feature}`
      : `${cap(feature)} là tính năng của tài khoản nâng cao`;
  const sub =
    access === "login"
      ? (blurb ??
        "Tài khoản dùng chung với lúc mua hàng SDVICO — số điện thoại là vào được.")
      : (blurb ??
        "Tài khoản của bà con đang là hạng thường. Gọi SDVICO để nâng cấp là xem được ngay.");
  const cta =
    access === "login" ? (
      <Link
        href="/login"
        className="display mx-auto mt-3 flex min-h-[3.25rem] w-full max-w-[300px] items-center justify-center rounded-full bg-trim text-[1.0625rem] font-bold text-white transition active:scale-[0.98]"
      >
        Đăng nhập / Đăng ký
      </Link>
    ) : (
      <a
        href={`tel:${SDVICO_HOTLINE}`}
        className="display mx-auto mt-3 flex min-h-[3.25rem] w-full max-w-[300px] items-center justify-center gap-2 rounded-full bg-trim text-[1.0625rem] font-bold text-white transition active:scale-[0.98]"
      >
        <PhoneIcon className="h-5 w-5" />
        Gọi SDVICO {SDVICO_HOTLINE_DISPLAY}
      </a>
    );

  if (compact) {
    return (
      <div className="mt-2 rounded-xl bg-field/70 px-3 py-3 text-center">
        <p className="flex items-center justify-center gap-1.5 text-[0.9375rem] font-bold text-navy">
          <span
            className="shrink-0"
            style={{ color: `var(--${accent})` }}
            aria-hidden
          >
            <LockIcon className="h-4 w-4" />
          </span>
          {title}
        </p>
        <p className="mt-1 text-[0.8125rem] leading-snug text-foreground/70">
          {sub}
        </p>
        {cta}
      </div>
    );
  }

  return (
    <div className="surface px-5 py-7 text-center">
      <span
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
        style={{
          backgroundColor: `var(--${accent}-bg)`,
          color: `var(--${accent})`,
        }}
        aria-hidden
      >
        <LockIcon className="h-7 w-7" />
      </span>
      <p className="display mt-3 text-[1.25rem] font-bold text-navy">{title}</p>
      <p className="mx-auto mt-1 max-w-[34ch] text-[1rem] leading-snug text-foreground/65">
        {sub}
      </p>
      {cta}
    </div>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
