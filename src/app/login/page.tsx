"use client";

import { useState } from "react";
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

/*
  Đăng nhập SDFish — app khách hàng. Hướng TÀI KHOẢN: SĐT + MẬT KHẨU (KHÔNG
  email, KHÔNG OTP). Tài khoản do webhook SDWork provision khi mua hàng — sale
  báo KH "SĐT + mật khẩu". Lần đầu app nhắc đổi mật khẩu (must_change_password).
*/
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
      setError("Số điện thoại không hợp lệ. Bà con kiểm tra lại nhé.");
      return;
    }
    setLoading(true);
    const { data, error: signInError } = await supabase!.auth.signInWithPassword(
      { email: phoneToEmail(phone), password },
    );
    if (signInError || !data.user) {
      setError("Sai số điện thoại hoặc mật khẩu.");
      setLoading(false);
      return;
    }
    // lần đầu (webhook đặt must_change_password) → bắt đổi mật khẩu
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
          khi mua. Vào xong app nhắc đổi mật khẩu.
        </p>
        <p className="mt-2 text-[1rem] leading-snug">
          Quên mật khẩu?{" "}
          <a href="tel:1900232349" className="font-bold text-sea">
            Gọi SDVICO 1900 23 23 49
          </a>
        </p>
      </AuthCard>
    </div>
  );
}
