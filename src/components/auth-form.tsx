"use client";

import { useId, useState, type ReactNode } from "react";
import { Field, inputClass } from "@/components/ui/primitives";
import { passwordRuleHint } from "@/lib/password";

/*
  Mảnh dùng chung cho các form đăng nhập / đổi mật khẩu.
  Giữ tông bình tĩnh, cỡ theo thang 03 §0.
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
  id,
  label,
  value,
  onChange,
  autoComplete = "current-password",
  placeholder,
  minLength,
  error,
}: {
  /** id ô nhập — để màn cha đưa con trỏ vào ô khi submit lỗi (VO-APP-04) */
  id?: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: "current-password" | "new-password";
  placeholder?: string;
  /*  Bật NHÃN KIỂM TRA TẠI CHỖ khi ĐẶT mật khẩu mới (user 2026-09-25: "chưa có
      label verify chính xác… chỉ báo lỗi"). Chỉ truyền cho ô mật khẩu MỚI —
      ô "mật khẩu hiện tại" không cần vì không phải đang đặt luật. */
  minLength?: number;
  /** lỗi submit của riêng ô này — hiện dưới ô qua `Field error`, thay nhãn luật */
  error?: string;
}) {
  const [shown, setShown] = useState(false);
  /*  VO-APP-17 (2026-10-25): nhãn luật chỉ nói khi ô CÓ FOCUS hoặc ĐÃ GÕ — ô trống
      lúc mở màn thì luật nằm trong placeholder, không thành câu hướng dẫn thường trực. */
  const [focused, setFocused] = useState(false);
  const uid = useId();
  const idLoi = `${uid}-loi`;
  const idLuat = `${uid}-luat`;
  const hint =
    typeof minLength === "number" && !error && (focused || value.length > 0)
      ? passwordRuleHint(value, minLength)
      : null;
  const goiY =
    placeholder ??
    (typeof minLength === "number" ? `Ít nhất ${minLength} ký tự` : undefined);
  return (
    <Field label={label} error={error} errorId={idLoi}>
      <span className="relative block">
        <input
          id={id}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={`${inputClass} pr-16`}
          placeholder={goiY}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? idLoi : hint ? idLuat : undefined}
          required
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-pressed={shown}
          className="absolute inset-y-0 right-0 flex min-w-[3.5rem] items-center justify-center rounded-r-2xl text-[0.9375rem] font-semibold text-sea"
        >
          {shown ? "Ẩn" : "Hiện"}
        </button>
      </span>
      {/*  NHÃN KIỂM TRA TẠI CHỖ (aria-live): nói ĐÚNG luật + trạng thái hiện tại
          ngay khi gõ, không đợi bấm Lưu. Chưa đủ = giọng NHẮC (neutral, không
          đỏ hoảng — đỏ để dành cho lỗi submit, lúc đó nhãn này nhường chỗ cho
          câu lỗi dưới ô, không nói hai câu cho một lỗi); đủ = xanh ok kèm dấu ✓.
          Nội dung từ passwordRuleHint (thuần, có test). */}
      {hint && (
        <span
          id={idLuat}
          aria-live="polite"
          className="mt-1.5 block text-[0.875rem] leading-snug"
          style={{ color: hint.ok ? "var(--ok)" : "var(--foreground)" }}
        >
          {hint.text}
        </span>
      )}
    </Field>
  );
}

/*  Khung trắng giữa màn — nơi đặt form đăng nhập/đăng ký.
    ĐỒNG ĐỀU VỚI HERO + MÀN HÌNH (user 2026-09-25): trước có `max-w-[26.25rem]`
    khiến thẻ HẸP hơn header 52px trên khung 480 (thụt vào 26px mỗi bên), nhìn
    thẻ lọt thỏm/lệch so với hero tràn viền phía trên. Nay thẻ rộng đúng cột
    app-shell (đã cap 480) và dùng `px-4` để MÉP thẻ thẳng hàng với mép chữ hero
    (PageHeader cũng px-4 từ 2026-10-22 — một lề 16px cho cả app) — một trục, không so le. */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 w-full px-4">
      <div className="surface p-5">{children}</div>
    </div>
  );
}

/** Băng lỗi HỆ THỐNG (mạng yếu, sai mật khẩu, bị khoá, bị đá, cấp chuỗi hỏng) —
 *  đỏ nhẹ, chữ đậm. Lỗi NHẬP (SĐT sai dạng, mật khẩu ngắn…) KHÔNG đi đường này
 *  mà hiện dưới ô qua `Field error` (VO-APP-04, 2026-10-25). */
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
