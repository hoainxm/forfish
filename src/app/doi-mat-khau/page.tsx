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
  PasswordField,
} from "@/components/auth-form";
import { useAuthUser } from "@/lib/use-auth";

/*
  Đổi mật khẩu — HAI ngả vào (2026-07-29):
  · ÉP lần đầu: /login thấy user_metadata.must_change_password → đẩy vào đây,
    KHÔNG hỏi mật khẩu hiện tại (khách vừa gõ nó ở màn đăng nhập xong).
  · TỰ NGUYỆN: sheet Tài khoản → "Đổi mật khẩu" — hỏi mật khẩu hiện tại
    (xác thực lại bằng signInWithPassword) rồi mới cho đổi.
  Đổi xong: xoá cờ must_change_password NGAY TRÊN user_metadata (bug cũ ghi
  vào bảng `profiles` KHÔNG TỒN TẠI → cờ không bao giờ tắt) + thu hồi phiên
  các máy khác (signOut scope 'others' — luật 1 tài khoản 1 máy).
*/

/** Hotline SDVICO — lối thoát cuối khi KH kẹt ở màn ép đổi mật khẩu. */
const HOTLINE = "1900232349";
const HOTLINE_HIEN = "1900 23 23 49";

export default function DoiMatKhauPage() {
  const router = useRouter();
  const supabase = createClient();
  const { user, ready } = useAuthUser();

  // Lối thoát khi bị ÉP đổi (must_change) mà chưa đổi được: đăng xuất về trang
  // chủ để KH không kẹt cứng phải gỡ app (mất khách thật 02/07).
  async function handleSignOut() {
    await supabase?.auth.signOut();
    router.replace("/");
  }

  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const header = (
    <PageHeader
      kicker="Tài khoản"
      title="Đổi mật khẩu"
      sub="Đặt mật khẩu riêng để giữ sổ tàu của bạn an toàn."
      toColor="var(--sea)"
    />
  );

  // Chưa cấu hình Supabase → không có gì để đổi, app vẫn dùng được.
  if (!supabase) {
    return (
      <div>
        {header}
        <AuthCard>
          <AuthNote>
            Chưa cấu hình đăng nhập — app vẫn dùng được không cần tài khoản.
          </AuthNote>
        </AuthCard>
      </div>
    );
  }

  if (!ready) {
    return (
      <div>
        {header}
        <AuthCard>
          <p className="text-[1.125rem] text-foreground/70">Đang kiểm tra…</p>
        </AuthCard>
      </div>
    );
  }

  if (!user) {
    return (
      <div>
        {header}
        <AuthCard>
          <AuthNote>Bạn cần đăng nhập trước rồi mới đổi được mật khẩu.</AuthNote>
          <Link
            href="/login"
            className="display flex min-h-[3.5rem] w-full items-center justify-center rounded-full bg-trim text-[1.125rem] font-bold text-white transition active:scale-[0.98]"
          >
            Đăng nhập
          </Link>
        </AuthCard>
      </div>
    );
  }

  const mustChange = user.user_metadata?.must_change_password === true;

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

    // 1) Tự nguyện đổi → xác thực lại mật khẩu hiện tại (ép lần đầu thì thôi —
    //    khách vừa gõ đúng nó ở màn đăng nhập).
    if (!mustChange && user!.email) {
      const { error: verifyError } = await supabase!.auth.signInWithPassword({
        email: user!.email,
        password: current,
      });
      if (verifyError) {
        setError("Mật khẩu hiện tại chưa đúng. Bạn kiểm tra lại giúp nhé.");
        setLoading(false);
        return;
      }
    }

    // 2) Đổi mật khẩu + tắt cờ buộc đổi NGAY TRÊN user_metadata.
    const { data: userData, error: updateError } = await supabase!.auth.updateUser(
      { password, data: { must_change_password: false } },
    );
    if (updateError || !userData.user) {
      setError("Chưa đổi được mật khẩu. Bạn thử lại giúp nhé.");
      setLoading(false);
      return;
    }

    // 3) 1 TÀI KHOẢN = 1 MÁY: thu hồi phiên các máy khác. Lỗi ở bước này
    //    KHÔNG chặn — mật khẩu đã đổi xong.
    try {
      await supabase!.auth.signOut({ scope: "others" });
    } catch {
      /* bỏ qua — máy khác sẽ rớt ở lần đăng nhập/refresh kế */
    }

    // 4) Vào trang chính.
    router.replace("/");
  }

  return (
    <div>
      {header}
      <AuthCard>
        <AuthNote>
          {mustChange ? (
            <>
              Lần đầu đăng nhập, hãy đổi mật khẩu nhân viên báo thành mật khẩu
              của riêng bạn.
            </>
          ) : (
            <>
              Đổi xong, bạn dùng mật khẩu mới từ lần đăng nhập sau. Tài khoản
              premium hỗ trợ đăng nhập trên một máy.
            </>
          )}
        </AuthNote>
        {error && <AuthError>{error}</AuthError>}
        <form onSubmit={handleSubmit}>
          {!mustChange && (
            <PasswordField
              label="Mật khẩu hiện tại"
              value={current}
              onChange={setCurrent}
              autoComplete="current-password"
              placeholder="Mật khẩu đang dùng"
            />
          )}
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

        {/* Lối thoát khi bị ÉP đổi — KH kẹt ở đây thì bỏ app luôn (mất khách
            thật 02/07). Chỉ hiện ở ngả ép (must_change); ngả tự nguyện quay lại
            bằng nút back của sheet Tài khoản. */}
        {mustChange && (
          <>
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
          </>
        )}
      </AuthCard>
    </div>
  );
}
