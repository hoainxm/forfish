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
  phoneToEmail,
  sanitizePhoneInput,
} from "@/components/auth-form";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Chưa cấu hình Supabase → app vẫn dùng được, chỉ là chưa có tài khoản.
  if (!supabase) {
    return (
      <div>
        <PageHeader
          kicker="Tài khoản"
          title="Đăng nhập"
          toColor="var(--sea)"
        />
        <AuthCard>
          <AuthNote>
            Chưa cấu hình đăng nhập — app vẫn dùng được không cần tài khoản.
          </AuthNote>
          <p className="text-[18px] leading-relaxed text-foreground/70">
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
    setLoading(true);

    if (!isValidVnPhone(phone)) {
      setError("Số điện thoại không hợp lệ. Bà con kiểm tra lại nhé.");
      setLoading(false);
      return;
    }

    // 1) THỬ SSO SDWork trước: khách dùng đúng SĐT+mk SDWork. Gateway verify
    //    với CRM rồi ĐỒNG BỘ mật khẩu vào tài khoản ForFish — nên dù SSO ăn
    //    hay không, bước 2 dưới đây đều là một đường duy nhất.
    await fetch("/api/auth/sso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password }),
      signal: AbortSignal.timeout(25000),
    }).catch(() => null);

    // 2) Đăng nhập bằng đường password chuẩn (khách SDWork lẫn tài khoản tự đăng ký)
    const { data, error: signInError } = await supabase!.auth.signInWithPassword(
      { email: phoneToEmail(phone), password },
    );

    if (signInError || !data.user) {
      setError("Sai số điện thoại hoặc mật khẩu.");
      setLoading(false);
      return;
    }

    // Đăng nhập xong → xem hồ sơ có buộc đổi mật khẩu lần đầu không.
    const { data: profile } = await supabase!
      .from("profiles")
      .select("must_change_password")
      .eq("id", data.user.id)
      .single();

    if (profile?.must_change_password) {
      router.replace("/doi-mat-khau");
    } else {
      router.replace("/");
    }
  }

  return (
    <div>
      <PageHeader
        kicker="Tài khoản"
        title="Đăng nhập"
        sub="Nhập số điện thoại và mật khẩu để vào sổ tàu của bạn."
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
          <Field label="Mật khẩu">
            <input
              type="password"
              autoComplete="current-password"
              className={inputClass}
              placeholder="Mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          <PrimaryButton type="submit" disabled={loading}>
            {loading ? "Đang vào…" : "Đăng nhập"}
          </PrimaryButton>
        </form>
        <p className="mt-4 text-[15px] leading-snug text-foreground/60">
          Lần đầu đăng nhập, mật khẩu mặc định là <strong>123456</strong>. Vào
          xong app sẽ nhắc bạn đổi mật khẩu mới.
        </p>
      </AuthCard>
    </div>
  );
}
