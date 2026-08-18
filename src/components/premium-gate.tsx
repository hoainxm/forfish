"use client";

import Link from "next/link";
import { LockIcon, PhoneIcon } from "@/components/icons";
import {
  SDVICO_HOTLINE,
  SDVICO_HOTLINE_DISPLAY,
} from "@/data/sdvico-showcase";
import type { FeatureAccess } from "@/lib/tier";
import { useOnline } from "@/lib/use-online";

/*
  PremiumLock — thẻ khoá tính năng PREMIUM (dự báo cá, thời tiết quá 3 ngày),
  chốt 2026-07-26. Hai lời mời theo nấc (lib/tier.ts):
  · access "login":   chưa đăng nhập → nút Đăng nhập (như LoginGate)
  · access "upgrade": đã đăng nhập, hạng thường → GỌI SDVICO nâng cấp
    (không có luồng thanh toán trong app — sales gán premium bên SDWork)
  access "open"/"checking" thì component KHÔNG render gì — caller cứ đặt cạnh
  nội dung, không cần if bên ngoài.
  Khoá UI chỉ là lớp vỏ — /api/fish-forecast bị chặn thật ở middleware.

  2026-08-18 (audit G7/M8, chính sách thông báo tầng 5): MỘT tên "Premium"
  (bỏ "tài khoản nâng cao"), câu chuẩn "… là tính năng Premium — gọi SDVICO để
  mở"; ẨN HOÀN TOÀN khi máy báo mất sóng — `tel:` / `/login` giữa biển là ngõ
  cụt, mời chỉ thêm bực.
*/

/** Câu chuẩn cho mọi lời mời Premium — dùng cả ngoài PremiumLock (chip ngày,
    peek) để cả app chỉ có một cách gọi tên. */
export function premiumLine(feature: string): string {
  return `${cap(feature)} là tính năng Premium — gọi SDVICO để mở.`;
}

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
  const online = useOnline();
  if (access !== "login" && access !== "upgrade") return null;
  if (!online) return null; // mất sóng: không mời việc không làm được

  const title =
    access === "login"
      ? `Đăng nhập để xem ${feature}`
      : `${cap(feature)} là tính năng Premium`;
  const sub =
    access === "login"
      ? (blurb ??
        "Tài khoản dùng chung với lúc mua hàng SDVICO — số điện thoại là vào được.")
      : (blurb ?? "Gọi SDVICO để mở là xem được ngay.");
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
