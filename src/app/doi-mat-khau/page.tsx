"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { apiUrl } from "@/lib/api-base";
import { Field, inputClass, PrimaryButton } from "@/components/ui/primitives";
import { PageHeader } from "@/components/page-header";
import { AuthCard, AuthError, AuthNote } from "@/components/auth-form";
import { normalizePassword } from "@/lib/password";
import { passwordChangeErrorMessage } from "@/lib/auth-error";
import { useAuthUser } from "@/lib/use-auth";

/** Hotline SDVICO — lối thoát cuối khi KH kẹt ở màn ép đổi mật khẩu. */
const HOTLINE = "1900232349";
const HOTLINE_HIEN = "1900 23 23 49";

export default function DoiMatKhauPage() {
  const router = useRouter();
  const supabase = createClient();
  const { user, ready } = useAuthUser();

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

  // Vào thẳng URL khi chưa đăng nhập (giờ có nút trong sheet Tài khoản nên
  // đường này hiếm) → mời đăng nhập, không bày form đổi mà lưu chắc chắn fail.
  if (ready && !user) {
    return (
      <div>
        <PageHeader
          kicker="Tài khoản"
          title="Đổi mật khẩu"
          toColor="var(--sea)"
        />
        <AuthCard>
          <AuthNote>Bạn cần đăng nhập trước rồi mới đổi được mật khẩu.</AuthNote>
          <Link
            href="/login"
            className="display flex min-h-[3.5rem] w-full items-center justify-center rounded-full bg-trim text-[1.125rem] font-bold text-white shadow-[0_10px_24px_-8px_rgba(228,87,46,0.55)] transition active:scale-[0.98]"
          >
            Đăng nhập
          </Link>
        </AuthCard>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const pw = normalizePassword(password);
    if (pw.length < 6) {
      setError("Mật khẩu mới cần ít nhất 6 ký tự.");
      return;
    }
    if (pw !== normalizePassword(confirm)) {
      setError("Hai ô mật khẩu chưa giống nhau. Bạn nhập lại giúp nhé.");
      return;
    }

    setLoading(true);

    // 1) Đổi mật khẩu + tắt cờ buộc đổi NGAY trong user_metadata (login đọc cờ
    //    ở đây, KHÔNG ở bảng profiles — trước đây ghi nhầm profiles nên KH bị ép
    //    đổi mỗi lần đăng nhập).
    const { data: userData, error: updateError } =
      await supabase!.auth.updateUser({
        password: pw,
        data: { must_change_password: false },
      });

    // Báo lỗi NÓI RÕ phải làm gì (lib/auth-error, có test). Trước đây gộp mọi
    // lỗi thành "thử lại giúp nhé" → KH gõ lại y hệt, hỏng y hệt, rồi bỏ app.
    if (updateError || !userData.user) {
      setError(passwordChangeErrorMessage(updateError));
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
        body: JSON.stringify({ password: pw }),
      });
    } catch {
      // im lặng — không làm phiền KH; đối soát sau
    }

    // 3) Vào trang chính.
    router.replace("/");
  }

  // LỐI THOÁT khi đổi mật khẩu mãi không được: đăng xuất để dùng app công khai
  // như thường. Nút đăng xuất bình thường nằm trong sheet Tài khoản ở TRANG CHỦ
  // — mà trang chủ bị middleware chặn khi còn cờ must_change_password → không
  // có nút này thì KH kẹt cứng, chỉ còn cách gỡ app.
  async function handleSignOut() {
    await supabase!.auth.signOut();
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
        {/* KHÔNG in mật khẩu mặc định ra màn hình: tên đăng nhập là SĐT, nói
            luôn mật khẩu mặc định = mở cửa mọi tài khoản chưa đổi. */}
        <AuthNote>
          Lần đầu đăng nhập, bà con đổi mật khẩu nhân viên đã báo thành mật khẩu
          của riêng mình cho an toàn.
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

        {/* Lối thoát — KH kẹt ở đây thì bỏ app luôn (mất khách thật 02/07). */}
        <p className="mt-5 text-[1rem] leading-snug text-foreground/70">
          Đổi mãi không được? Gọi{" "}
          <a href={`tel:${HOTLINE}`} className="font-bold text-sea">
            SDVICO {HOTLINE_HIEN}
          </a>
        </p>
        <button
          type="button"
          onClick={handleSignOut}
          className="mt-3 flex min-h-[3.75rem] w-full items-center justify-center rounded-full border-2 border-line text-[1.0625rem] font-bold text-foreground/80 transition active:scale-[0.98]"
        >
          Thoát ra, để đổi sau
        </button>
      </AuthCard>
    </div>
  );
}
