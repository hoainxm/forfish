import type { ReactNode } from "react";

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
      className="mb-4 rounded-xl px-3.5 py-3 text-[16px] font-semibold leading-snug"
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
      className="mb-4 rounded-xl px-3.5 py-3 text-[16px] font-semibold leading-snug"
      style={{ color: "var(--t1)", backgroundColor: "var(--t1-bg)" }}
    >
      {children}
    </p>
  );
}
