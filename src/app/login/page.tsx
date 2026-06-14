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
    setLoading(true);

    if (!isValidVnPhone(phone)) {
      setError("Số điện thoại không hợp lệ. Bà con kiểm tra lại nhé.");
      setLoading(false);
      return;
    }

    // ĐẢO THỨ TỰ (roadmap "thất bại lên tiếng"): thử mật khẩu ForFish TRƯỚC
    // — người đã có tài khoản vào ngay, không chờ gateway 25s khi 3G yếu.
    // Sai mới gọi SSO SDWork (verify với CRM + đồng bộ mật khẩu về ForFish,
    // timeout 8s) rồi thử lại một lần.
    const email = phoneToEmail(phone);
    let { data, error: signInError } = await supabase!.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !data.user) {
      await fetch("/api/auth/sso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
        signal: AbortSignal.timeout(8000),
      }).catch(() => null);
      ({ data, error: signInError } = await supabase!.auth.signInWithPassword({
        email,
        password,
      }));
    }

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
          <PasswordField
            label="Mật khẩu"
            value={password}
            onChange={setPassword}
            placeholder="Mật khẩu"
          />
          <PrimaryButton type="submit" disabled={loading}>
            {loading ? "Đang vào…" : "Đăng nhập"}
          </PrimaryButton>
        </form>
        <p className="mt-4 text-[0.9375rem] leading-snug text-foreground/70">
          Khách đã mua hàng SDVICO: dùng mật khẩu nhân viên báo khi mua — vào
          xong app sẽ nhắc đổi.
        </p>
        {/* hết ngõ cụt: luôn có đường đăng ký + đường cứu khi quên mật khẩu */}
        <p className="mt-3 text-[1rem] leading-snug">
          Chưa có tài khoản?{" "}
          <Link href="/dang-ky" className="font-bold text-sea">
            Tạo tài khoản mới
          </Link>
        </p>
        <p className="mt-1.5 text-[1rem] leading-snug">
          Quên mật khẩu?{" "}
          <a href="tel:1900232349" className="font-bold text-sea">
            Gọi SDVICO 1900 23 23 49
          </a>
        </p>
      </AuthCard>
    </div>
  );
}
