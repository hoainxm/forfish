"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Field, inputClass, PrimaryButton } from "@/components/ui/primitives";
import { PageHeader } from "@/components/page-header";
import { AuthCard, AuthError, AuthNote } from "@/components/auth-form";

export default function DoiMatKhauPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Chưa cấu hình Supabase → không có gì để đổi, app vẫn dùng được.
  if (!supabase) {
    return (
      <div>
        <PageHeader
          kicker="Tài khoản"
          title="Đổi mật khẩu"
          toColor="var(--sea)"
        />
        <AuthCard>
          <AuthNote>
            Chưa cấu hình đăng nhập — app vẫn dùng được không cần tài khoản.
          </AuthNote>
        </AuthCard>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Mật khẩu mới cần ít nhất 6 ký tự.");
      return;
    }
    if (password !== confirm) {
      setError("Hai ô mật khẩu chưa giống nhau. Bạn nhập lại giúp nhé.");
      return;
    }

    setLoading(true);

    // 1) Đổi mật khẩu của tài khoản đang đăng nhập.
    const { data: userData, error: updateError } =
      await supabase!.auth.updateUser({ password });

    if (updateError || !userData.user) {
      setError("Chưa đổi được mật khẩu. Bạn thử lại giúp nhé.");
      setLoading(false);
      return;
    }

    // 2) Tắt cờ buộc đổi mật khẩu cho hồ sơ của người này.
    await supabase!
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", userData.user.id);

    // 3) Vào trang chính.
    router.replace("/");
  }

  return (
    <div>
      <PageHeader
        kicker="Tài khoản"
        title="Đổi mật khẩu"
        sub="Đặt mật khẩu riêng để giữ sổ tàu của bạn an toàn."
        toColor="var(--sea)"
      />
      <AuthCard>
        <AuthNote>
          Lần đầu đăng nhập, hãy đổi mật khẩu mặc định{" "}
          <strong>123456</strong> thành mật khẩu của riêng bạn.
        </AuthNote>
        {error && <AuthError>{error}</AuthError>}
        <form onSubmit={handleSubmit}>
          <Field label="Mật khẩu mới">
            <input
              type="password"
              autoComplete="new-password"
              className={inputClass}
              placeholder="Ít nhất 6 ký tự"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          <Field label="Nhập lại mật khẩu mới">
            <input
              type="password"
              autoComplete="new-password"
              className={inputClass}
              placeholder="Gõ lại cho chắc"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </Field>
          <PrimaryButton type="submit" disabled={loading}>
            {loading ? "Đang lưu…" : "Lưu mật khẩu mới"}
          </PrimaryButton>
        </form>
      </AuthCard>
    </div>
  );
}
