"use client";

import { useState, type ReactNode } from "react";
import { Field, inputClass } from "@/components/ui/primitives";
import { passwordRuleHint } from "@/lib/password";

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
 *  (roadmap hội đồng UX 2026-06-11).
 *
 *  ⚠️ Bấm "Hiện" đổi input sang type="text" → iOS/iPadOS TỰ viết hoa chữ đầu +
 *  tự sửa chính tả (password field không bị, text field thì bị). Mật khẩu gõ
 *  đúng "nam nguyen" thành "Nam nguyen" → đăng nhập sai mà không hiểu vì sao
 *  (Apple App Review từ chối 2026-07-17, Guideline 2.1, máy iPad Air M3).
 *  Khoá autoCapitalize/autoCorrect/spellCheck cho CẢ hai trạng thái. */
export function PasswordField({
  label,
  value,
  onChange,
  autoComplete = "current-password",
  placeholder,
  minLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: "current-password" | "new-password";
  placeholder?: string;
  /*  Bật NHÃN KIỂM TRA TẠI CHỖ khi ĐẶT mật khẩu mới (user 2026-09-25: "chưa có
      label verify chính xác… chỉ báo lỗi"). Chỉ truyền cho ô mật khẩu MỚI —
      ô "mật khẩu hiện tại" không cần vì không phải đang đặt luật. */
  minLength?: number;
}) {
  const [shown, setShown] = useState(false);
  const hint =
    typeof minLength === "number" ? passwordRuleHint(value, minLength) : null;
  return (
    <Field label={label}>
      <span className="relative block">
        <input
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={`${inputClass} pr-16`}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={hint ? "pw-rule" : undefined}
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
      {/*  NHÃN KIỂM TRA TẠI CHỖ (aria-live): nói ĐÚNG luật + trạng thái hiện tại
          ngay khi gõ, không đợi bấm Lưu. Chưa đủ = giọng NHẮC (neutral, không
          đỏ hoảng — đỏ để dành cho lỗi submit); đủ = xanh ok kèm dấu ✓. Nội dung
          từ passwordRuleHint (thuần, có test). */}
      {hint && (
        <p
          id="pw-rule"
          aria-live="polite"
          className="mt-1.5 text-[0.9375rem] font-semibold leading-snug"
          style={{ color: hint.ok ? "var(--ok)" : "var(--foreground)" }}
        >
          {hint.text}
        </p>
      )}
    </Field>
  );
}

/*  Khung trắng giữa màn — nơi đặt form đăng nhập/đăng ký.
    ĐỒNG ĐỀU VỚI HERO + MÀN HÌNH (user 2026-09-25): trước có `max-w-[420px]`
    khiến thẻ HẸP hơn header 52px trên khung 480 (thụt vào 26px mỗi bên), nhìn
    thẻ lọt thỏm/lệch so với hero tràn viền phía trên. Nay thẻ rộng đúng cột
    app-shell (đã cap 480) và dùng `px-5` để MÉP thẻ thẳng hàng với mép chữ hero
    (PageHeader cũng px-5) — trên/dưới một trục, không so le. */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 w-full px-5">
      <div className="surface p-5">{children}</div>
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
