"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Field, inputClass, PrimaryButton } from "@/components/ui/primitives";
import { PageHeader } from "@/components/page-header";
import {
  AuthCard,
  AuthError,
  AuthNote,
  isValidVnPhone,
  PasswordField,
  phoneToEmail,
  sanitizePhoneInput,
} from "@/components/auth-form";
import { normalizePassword } from "@/lib/password";
import { loginErrorMessage, type AccountExists } from "@/lib/login-error";
import { apiUrl } from "@/lib/api-base";

/*
  Đăng nhập SDFish — app khách hàng. Hướng TÀI KHOẢN: SĐT + MẬT KHẨU (KHÔNG
  email, KHÔNG OTP). Tài khoản do webhook SDWork provision khi mua hàng — sale
  báo KH "SĐT + mật khẩu". KHÔNG ép đổi mật khẩu lần đầu (chính sách 2026-07-21).
*/

/** SĐT này có tài khoản chưa? null = không kiểm được (mất mạng / demo mode) →
 *  loginErrorMessage quay về câu gộp cũ. */
async function checkAccountExists(phone: string): Promise<AccountExists> {
  try {
    const res = await fetch(apiUrl("/api/auth/exists"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json();
    return json?.ok === true ? Boolean(json.exists) : null;
  } catch {
    return null;
  }
}
export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!supabase) {
    return (
      <div>
        <PageHeader kicker="Tài khoản" title="Đăng nhập" toColor="var(--sea)" />
        <AuthCard>
          <AuthNote>
            Chưa cấu hình đăng nhập — app vẫn dùng được không cần tài khoản.
          </AuthNote>
          <p className="text-[1.125rem] leading-relaxed text-foreground/70">
            Bạn cứ dùng các tính năng như thường. Khi nào sẵn sàng, người quản
            trị sẽ bật đăng nhập giúp bạn.
          </p>
        </AuthCard>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidVnPhone(phone)) {
      setError("Số điện thoại phải đủ 10 số (ví dụ 0901234567). Bà con kiểm tra lại nhé.");
      return;
    }
    setLoading(true);
    const { data, error: signInError } = await supabase!.auth.signInWithPassword(
      { email: phoneToEmail(phone), password: normalizePassword(password) },
    );
    if (signInError || !data.user) {
      // Tách câu lỗi: SĐT chưa có tài khoản ≠ có rồi nhưng sai mật khẩu.
      const exists = await checkAccountExists(phone);
      setError(loginErrorMessage(signInError, exists));
      setLoading(false);
      return;
    }
    // Cờ must_change_password chỉ còn khi bật thủ công (webhook không bật nữa)
    const mustChange = data.user.user_metadata?.must_change_password === true;
    router.replace(mustChange ? "/doi-mat-khau" : "/");
  }

  return (
    <div>
      <PageHeader
        kicker="Tài khoản"
        title="Đăng nhập"
        sub="Nhập số điện thoại và mật khẩu để xem thiết bị, bảo hành, hỗ trợ của bạn."
        toColor="var(--sea)"
      />
      <AuthCard>
        {error && <AuthError>{error}</AuthError>}
        <form onSubmit={handleSubmit}>
          <Field label="Số điện thoại">
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              className={inputClass}
              placeholder="0901 234 567"
              value={phone}
              onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
              required
            />
          </Field>
          <PasswordField
            label="Mật khẩu"
            value={password}
            onChange={setPassword}
            placeholder="Mật khẩu nhân viên báo khi mua"
          />
          <PrimaryButton type="submit" disabled={loading}>
            {loading ? "Đang vào…" : "Đăng nhập"}
          </PrimaryButton>
        </form>
        <p className="mt-4 text-[1rem] leading-snug text-foreground/70">
          Khách đã mua hàng SDVICO: dùng số điện thoại + mật khẩu nhân viên báo
          khi mua.
        </p>
        {/* Quên mật khẩu: gửi yêu cầu sang CRM để nhân viên duyệt (thêm
            2026-07-21) — trước đây chỉ có số hotline, KH ngoài giờ làm việc
            không biết bấu víu vào đâu. Vẫn giữ nút gọi cho ai cần gấp. */}
        <Link
          href="/quen-mat-khau"
          className="mt-4 flex min-h-[3.75rem] w-full items-center justify-center rounded-full border-2 border-line text-[1.0625rem] font-bold text-foreground/80 transition active:scale-[0.98]"
        >
          Quên mật khẩu?
        </Link>
      </AuthCard>
    </div>
  );
}
