"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { apiUrl } from "@/lib/api-base";
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

    // 1) Đổi mật khẩu + tắt cờ buộc đổi NGAY trong user_metadata (login đọc cờ
    //    ở đây, KHÔNG ở bảng profiles — trước đây ghi nhầm profiles nên KH bị ép
    //    đổi mỗi lần đăng nhập).
    const { data: userData, error: updateError } =
      await supabase!.auth.updateUser({
        password,
        data: { must_change_password: false },
      });

    if (updateError || !userData.user) {
      setError("Chưa đổi được mật khẩu. Bạn thử lại giúp nhé.");
      setLoading(false);
      return;
    }

    // 2) Đẩy mật khẩu mới sang SDWork để 1 credential đăng nhập được CẢ 2 app
    //    (đồng bộ 2 chiều). Best-effort: đổi tại SDFish đã xong, lỗi đẩy ngược
    //    KHÔNG chặn KH vào app (cron đối soát/đẩy lại = Đợt 2).
    try {
      await fetch(apiUrl("/api/sdwork/password-sync"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
    } catch {
      // im lặng — không làm phiền KH; đối soát sau
    }

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
