import type { ReactNode } from "react";

/*
  Mảnh dùng chung cho các form đăng nhập / đổi mật khẩu.
  Giữ tông bình tĩnh, chữ to (≥18px), dễ đọc ngoài nắng.
*/

/** Đuôi email ảo gắn sau SĐT — Supabase Auth dùng email (không cần SMS
 *  provider). User chỉ gõ SĐT; app tự ghép, không yêu cầu confirm. */
export const PHONE_EMAIL_DOMAIN = "phone.forfish.app";

/** Chuẩn hóa SĐT VN: lấy 9-10 chữ số gốc, bỏ mọi ký tự thừa.
 *  0901234567 / 84901234567 / +84 901 234 567 → "84901234567". */
export function normalizeVnPhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("84")) d = d.slice(2);
  else if (d.startsWith("0")) d = d.slice(1);
  return "84" + d;
}

/** SĐT đã chuẩn hóa → email ảo cho Supabase Auth.
 *  84901234567 → 84901234567@phone.forfish.app */
export function phoneToEmail(rawPhone: string): string {
  return `${normalizeVnPhone(rawPhone)}@${PHONE_EMAIL_DOMAIN}`;
}

/** Hợp lệ tối thiểu: 10–11 chữ số (sau khi chuẩn hóa có "84" + 9 hoặc 10). */
export function isValidVnPhone(raw: string): boolean {
  const d = raw.replace(/\D/g, "");
  const local = d.startsWith("84") ? d.slice(2) : d.startsWith("0") ? d.slice(1) : d;
  return /^[1-9]\d{8,9}$/.test(local);
}

/** Khung trắng giữa màn — nơi đặt form đăng nhập. */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto mt-6 w-full max-w-[420px] px-4">
      <div className="rounded-xl bg-card p-5 shadow-sm ring-1 ring-line">
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
      className="mb-4 rounded-lg px-3.5 py-3 text-[16px] font-semibold leading-snug"
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
      className="mb-4 rounded-lg px-3.5 py-3 text-[16px] font-semibold leading-snug"
      style={{ color: "var(--t1)", backgroundColor: "var(--t1-bg)" }}
    >
      {children}
    </p>
  );
}
