"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api-base";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { withDeadline } from "@/lib/auth-error";
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
import { timeoutSignal } from "@/lib/abort";
import { deviceId } from "@/lib/device-id";
import { devicePlatform } from "@/lib/storage-persist";
import { isValidTokenShape } from "@/lib/device-token";
import { saveToken } from "@/lib/device-token-store";

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

    setLoading(true);
    // Tạo tài khoản qua auth-gateway (email ảo ĐÃ confirm sẵn — email ảo
    // không có hòm thư thật để bấm link xác nhận).
    const res = await fetch(apiUrl("/api/auth/signup"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password }),
      signal: timeoutSignal(25000),
    }).catch(() => null);

    if (!res || !res.ok) {
      const j = res ? await res.json().catch(() => null) : null;
      setError(
        j?.code === "exists"
          ? "Số điện thoại này đã có tài khoản — bà con bấm Đăng nhập bên dưới."
          : "Không đăng ký được lúc này. Bà con thử lại sau ít phút.",
      );
      setLoading(false);
      return;
    }

    // Tài khoản đã sẵn sàng → vào luôn.
    // ĐỒNG HỒ CHẶN (soát 2026-08-02): cú này chạy SAU khi tài khoản đã tạo
    // THẬT trên máy chủ. Không có đồng hồ thì nút kẹt "Đang tạo…" vĩnh viễn ⇒
    // bà con bấm tạo lần hai và nhận "Số điện thoại này đã có tài khoản" mà
    // không hiểu vì sao. Treo/hỏng đều đẩy sang màn Đăng nhập — việc đã xong,
    // chỉ còn thiếu bước vào.
    const signIn = await withDeadline(
      supabase!.auth.signInWithPassword({
        email: phoneToEmail(phone),
        password,
      }),
      25000,
    );
    if (!signIn || signIn.error) {
      // hiếm — tạo xong mà chưa vào được thì để bà con đăng nhập tay. `?tao=xong`
      // để /login NÓI RA việc đã xong (audit 2026-08-18 G4: trước đây chuyển
      // màn im lặng, bà con tưởng đăng ký hỏng, bấm tạo lại → "đã có tài khoản").
      router.replace("/login?tao=xong");
      return;
    }

    /*  ĐỔI PHIÊN LẤY CHUỖI CỨNG — Y HỆT `/login` (sửa 2026-08-02h, lỗi CHẶN).
        LỖI ĐÃ SỬA: đường này trước đây `signInWithPassword` xong là vào thẳng
        app, KHÔNG cấp chuỗi. Nghĩa là **mọi tài khoản đăng ký mới chạy hoàn
        toàn bằng phiên Supabase** — JWT ngắn hạn + refresh tự xoay, tức đúng
        thứ migration 0026 sinh ra để diệt. Ra khơi mất sóng quá một giờ là
        auth-js tự xoá phiên và bà con bị đá **mà không ai đăng nhập ở đâu cả**.
        Và khi gỡ "đường lùi một nhịp phát hành" trong `lib/api-identity.ts`
        theo kế hoạch, cả nhóm đăng ký mới văng ra cùng lúc.

        Cất không được thì KHÔNG bỏ phiên: giữ đường lùi để bà con vẫn vào được
        app, hơn là đá họ ra ngay sau khi vừa tạo tài khoản. Câu nhắc để dành cho
        `/login` — ở đây bà con vừa tạo xong, đừng chặn bằng một hộp lỗi. */
    const issued = await withDeadline(
      fetch(apiUrl("/api/auth/token"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deviceId: deviceId(),
          platform: devicePlatform(),
        }),
        signal: timeoutSignal(20000),
      }).then((r) => r.json().catch(() => null)),
      20000,
    );
    /*  ⚠️ CẤP CHUỖI HỎNG THÌ CHẶN, ĐỪNG CHO ĐI TIẾP (sửa 2026-08-02h — phản biện
        bắt: bản vá trước thiếu vế `else`).
        Không có vế này thì tài khoản vừa tạo chạy THUẦN phiên Supabase — JWT
        ngắn hạn + refresh tự xoay — tức đúng thứ 0026 sinh ra để diệt: ra khơi
        mất sóng quá một giờ là bị đá mà KHÔNG ai đăng nhập ở đâu cả. `/login` đã
        chặn thật; `/dang-ky` mà thả thì cả nhóm đăng ký mới rơi vào đó. */
    if (!issued?.ok || !isValidTokenShape(issued.token)) {
      setError("Tạo tài khoản xong rồi, nhưng mạng yếu nên chưa vào được. Bà con bấm Đăng nhập giúp nhé.");
      setLoading(false);
      return;
    }
    if (!saveToken(issued.token)) {
      setError(
        "Máy đang không cho app lưu dữ liệu nên chưa giữ được đăng nhập. Bà con tắt chế độ duyệt web riêng tư (ẩn danh) rồi thử lại giúp.",
      );
      setLoading(false);
      return;
    }
    await withDeadline(supabase!.auth.signOut(), 8000);
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
              onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
              required
            />
          </Field>
          {/* có nút Hiện/Ẩn nên bỏ được ô "Nhập lại" — bớt một việc gõ */}
          <PasswordField
            label="Mật khẩu (ít nhất 6 ký tự)"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
          />
          <PrimaryButton type="submit" disabled={loading}>
            {loading ? "Đang tạo…" : "Tạo tài khoản"}
          </PrimaryButton>
        </form>
        <p className="mt-4 text-[0.9375rem] leading-snug text-foreground/70">
          Đã có tài khoản?{" "}
          <Link href="/login" className="font-bold text-sea">
            Đăng nhập
          </Link>
        </p>
      </AuthCard>
    </div>
  );
}
