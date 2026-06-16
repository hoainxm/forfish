"use client";

import { useState, type ReactNode } from "react";
import { Field, inputClass } from "@/components/ui/primitives";

/*
  Mảnh dùng chung cho các form đăng nhập / đổi mật khẩu.
  Giữ tông bình tĩnh, chữ to (≥18px), dễ đọc ngoài nắng.
*/

// Helper SĐT chuyển sang lib/phone.ts (thuần, dùng cả server) — re-export để
// các import cũ `from "@/components/auth-form"` vẫn chạy.
export {
  PHONE_EMAIL_DOMAIN,
  normalizeVnPhone,
  phoneToEmail,
  sanitizePhoneInput,
  isValidVnPhone,
} from "@/lib/phone";

/** Ô mật khẩu có nút HIỆN/ẨN — thấy mình gõ gì thì khỏi cần ô "nhập lại"
 *  (roadmap hội đồng UX 2026-06-11). */
export function PasswordField({
  label,
  value,
  onChange,
  autoComplete = "current-password",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: "current-password" | "new-password";
  placeholder?: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <Field label={label}>
      <span className="relative block">
        <input
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          className={`${inputClass} pr-16`}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-pressed={shown}
          className="absolute inset-y-0 right-0 flex min-w-[3.5rem] items-center justify-center rounded-r-2xl text-[0.9375rem] font-bold text-sea"
        >
          {shown ? "Ẩn" : "Hiện"}
        </button>
      </span>
    </Field>
  );
}

/** Khung trắng giữa màn — nơi đặt form đăng nhập. */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto mt-6 w-full max-w-[420px] px-4">
      <div className="surface p-5">
        {children}
      </div>
    </div>
  );
}

/** Lời nhắc lỗi — đỏ nhẹ, chữ đậm, không làm người dùng hoảng. */
export function AuthError({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="mb-4 rounded-xl px-3.5 py-3 text-[1rem] font-semibold leading-snug"
      style={{ color: "var(--danger)", backgroundColor: "var(--danger-bg)" }}
    >
      {children}
    </p>
  );
}

/** Ghi chú bình tĩnh (xanh biển) — hướng dẫn nhẹ nhàng. */
export function AuthNote({ children }: { children: ReactNode }) {
  return (
    <p
      className="mb-4 rounded-xl px-3.5 py-3 text-[1rem] font-semibold leading-snug"
      style={{ color: "var(--t1)", backgroundColor: "var(--t1-bg)" }}
    >
      {children}
    </p>
  );
}
