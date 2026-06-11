"use client";

import { useState, type ReactNode } from "react";
import { Field, inputClass } from "@/components/ui/primitives";

/*
  Mảnh dùng chung cho các form đăng nhập / đổi mật khẩu.
  Giữ tông bình tĩnh, chữ to (≥18px), dễ đọc ngoài nắng.
*/

/** Đuôi email ảo dùng cho Supabase Auth — CÙNG đuôi mà SDWork CRM đang
 *  dùng (`@sdvico.local`), để 1 SĐT = 1 email duy nhất ở cả 2 project.
 *  User chỉ thấy SĐT của mình. */
export const PHONE_EMAIL_DOMAIN = "sdvico.local";

/** Chuẩn hóa SĐT VN về dạng đầu 0 (kiểu CRM SDViCo hay dùng — 514/688 user).
 *  0901234567 / 84901234567 / +84 901 234 567 → "0901234567". */
export function normalizeVnPhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("84")) d = "0" + d.slice(2);
  else if (!d.startsWith("0")) d = "0" + d;
  return d;
}

/** SĐT đã chuẩn hóa → email ảo (CÙNG với CRM SDViCo).
 *  0901234567 → 0901234567@sdvico.local */
export function phoneToEmail(rawPhone: string): string {
  return `${normalizeVnPhone(rawPhone)}@${PHONE_EMAIL_DOMAIN}`;
}

/** Ô nhập SĐT chỉ nhận SỐ — gõ chữ/ký hiệu tự rơi, tối đa 11 số.
 *  (Đuôi email ảo app TỰ ghép — bà con không bao giờ phải gõ "@...") */
export function sanitizePhoneInput(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 11);
}

/** Hợp lệ tối thiểu: 10–11 chữ số (sau khi chuẩn hóa có "84" + 9 hoặc 10). */
export function isValidVnPhone(raw: string): boolean {
  const d = raw.replace(/\D/g, "");
  const local = d.startsWith("84") ? d.slice(2) : d.startsWith("0") ? d.slice(1) : d;
  return /^[1-9]\d{8,9}$/.test(local);
}

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
