"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Field, inputClass, PrimaryButton } from "@/components/ui/primitives";
import { PageHeader } from "@/components/page-header";
import {
  AuthCard,
  AuthError,
  AuthNote,
  isValidVnPhone,
  phoneToEmail,
} from "@/components/auth-form";

/*
  Đăng ký tài khoản bằng SĐT (thật chất là email ảo — bà con không thấy).
  KHÔNG yêu cầu confirm email. Bà con chưa phải khách SDWork vẫn tự tạo
  được tài khoản. Mặc định đặt cờ buộc đổi mật khẩu lần đầu nếu dùng 123456.
*/
export default function DangKyPage() {
  const router = useRouter();
  const supabase = createClient();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!supabase) {
    return (
      <div>
        <PageHeader kicker="Tài khoản" title="Đăng ký" toColor="var(--sea)" />
        <AuthCard>
          <AuthNote>
            Chưa cấu hình đăng ký — app vẫn dùng được không cần tài khoản.
          </AuthNote>
        </AuthCard>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isValidVnPhone(phone)) {
      setError("Số điện thoại không hợp lệ.");
      return;
    }
    if (password.length < 6) {
      setError("Mật khẩu cần ít nhất 6 ký tự.");
      return;
    }
    if (password !== confirm) {
      setError("Hai lần nhập mật khẩu chưa khớp.");
      return;
    }

    setLoading(true);
    const { data, error: signUpError } = await supabase!.auth.signUp({
      email: phoneToEmail(phone),
      password,
    });

    if (signUpError || !data.user) {
      // Trùng SĐT cũng trả lỗi qua đây — không lộ thông tin tài khoản đã tồn tại.
      setError(
        "Không đăng ký được. Có thể số điện thoại này đã có tài khoản — bà con thử đăng nhập.",
      );
      setLoading(false);
      return;
    }

    // Một số dự án Supabase bật "Email confirmations" — khi đó session null
    // sau signUp. Thử đăng nhập ngay để đi tiếp.
    await supabase!.auth.signInWithPassword({
      email: phoneToEmail(phone),
      password,
    });
    router.replace("/");
  }

  return (
    <div>
      <PageHeader
        kicker="Tài khoản"
        title="Đăng ký"
        sub="Tạo tài khoản bằng số điện thoại để giữ sổ tàu trên mây."
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
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </Field>
          <Field label="Mật khẩu (ít nhất 6 ký tự)">
            <input
              type="password"
              autoComplete="new-password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          <Field label="Nhập lại mật khẩu">
            <input
              type="password"
              autoComplete="new-password"
              className={inputClass}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </Field>
          <PrimaryButton type="submit" disabled={loading}>
            {loading ? "Đang tạo…" : "Tạo tài khoản"}
          </PrimaryButton>
        </form>
        <p className="mt-4 text-[15px] leading-snug text-foreground/60">
          Đã có tài khoản?{" "}
          <Link href="/login" className="font-bold text-sea">
            Đăng nhập
          </Link>
        </p>
      </AuthCard>
    </div>
  );
}
