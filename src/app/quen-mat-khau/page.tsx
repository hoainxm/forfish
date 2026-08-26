"use client";

import { useState } from "react";
import Link from "next/link";
import { Field, inputClass, PrimaryButton } from "@/components/ui/primitives";
import { PageHeader } from "@/components/page-header";
import {
  AuthCard,
  AuthError,
  AuthNote,
  isValidVnPhone,
  sanitizePhoneInput,
} from "@/components/auth-form";
import {
  buildResetRequest,
  resetEndpoint,
  resetHeaders,
  resetRequestMessage,
  validateResetInput,
} from "@/lib/password-reset";

/*
  Quên mật khẩu — KH nhập SĐT + họ tên, yêu cầu chuyển sang SDVICO (CRM), nhân
  viên duyệt rồi gọi lại báo mật khẩu mới.

  KHÔNG email, KHÔNG OTP, KHÔNG SMS: SDFish đăng nhập bằng SĐT (quyết định
  2026-06-16) nên không gửi được link đặt lại; CRM thì đã có sẵn trọn quy trình
  duyệt (`request-password-reset` + `password_reset_requests`), chỉ cần nối vào.

  ⚠️ Gọi THẲNG từ trình duyệt KH sang CRM, KHÔNG qua máy chủ SDFish — CRM chặn
  5 yêu cầu/giờ theo IP, đi qua máy chủ thì mọi KH chung 1 IP và khoá lẫn nhau.
*/

const HOTLINE = "0939243222";
const HOTLINE_HIEN = "0939 243 222";

export default function QuenMatKhauPage() {
  const endpoint = resetEndpoint(
    process.env.NEXT_PUBLIC_SDWORK_FUNCTIONS_URL,
    process.env.NEXT_PUBLIC_SDWORK_ANON_KEY,
  );

  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const loi = validateResetInput(phone, fullName, isValidVnPhone);
    if (loi) {
      setError(loi);
      return;
    }
    if (!endpoint) return;

    setLoading(true);
    let status = 0;
    let body: { error?: string; message?: string; success?: boolean } | null = null;
    try {
      const res = await fetch(endpoint.url, {
        method: "POST",
        headers: resetHeaders(endpoint.anonKey),
        body: JSON.stringify(buildResetRequest(phone, fullName)),
      });
      status = res.status;
      body = await res.json().catch(() => null);
    } catch {
      status = 0; // mất mạng
    }

    const ket_qua = resetRequestMessage(status, body);
    setLoading(false);
    if (ket_qua.ok) setDone(ket_qua.message);
    else setError(ket_qua.message);
  }

  // Đã gửi xong — thay hẳn form bằng lời xác nhận, khỏi bấm gửi lại nhiều lần.
  if (done) {
    return (
      <div>
        <PageHeader kicker="Tài khoản" title="Quên mật khẩu" toColor="var(--sea)" />
        <AuthCard>
          <AuthNote>{done}</AuthNote>
          <p className="mb-4 text-[1.0625rem] leading-relaxed text-foreground/70">
            Nhận được mật khẩu mới, bà con đăng nhập rồi đổi lại thành mật khẩu
            của riêng mình cho an toàn.
          </p>
          <Link
            href="/login"
            className="display flex min-h-[3.75rem] w-full items-center justify-center rounded-full bg-trim text-[1.125rem] font-bold text-white shadow-[0_10px_24px_-8px_rgba(228,87,46,0.55)] transition active:scale-[0.98]"
          >
            Về trang đăng nhập
          </Link>
        </AuthCard>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        kicker="Tài khoản"
        title="Quên mật khẩu"
        sub="Bà con điền số điện thoại và họ tên, SDVICO sẽ gọi lại báo mật khẩu mới."
        toColor="var(--sea)"
      />
      <AuthCard>
        {!endpoint ? (
          <AuthNote>
            Bà con gọi SDVICO {HOTLINE_HIEN} để được cấp lại mật khẩu giúp nhé.
          </AuthNote>
        ) : (
          <>
            <AuthNote>
              Điền đúng số điện thoại và họ tên đã đăng ký khi mua hàng. Nhân viên
              SDVICO kiểm tra rồi gọi lại báo mật khẩu mới trong vòng 24 giờ.
            </AuthNote>
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
              <Field label="Họ và tên">
                <input
                  type="text"
                  autoComplete="name"
                  className={inputClass}
                  placeholder="Ví dụ: Nguyễn Văn Ba"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </Field>
              <PrimaryButton type="submit" disabled={loading}>
                {loading ? "Đang gửi…" : "Gửi yêu cầu"}
              </PrimaryButton>
            </form>
          </>
        )}

        <p className="mt-5 text-[1rem] leading-snug text-foreground/70">
          Cần gấp? Gọi{" "}
          <a href={`tel:${HOTLINE}`} className="font-bold text-sea">
            SDVICO {HOTLINE_HIEN}
          </a>
        </p>
        <Link
          href="/login"
          className="mt-3 flex min-h-[3.75rem] w-full items-center justify-center rounded-full border-2 border-line text-[1.0625rem] font-bold text-foreground/80 transition active:scale-[0.98]"
        >
          Quay lại đăng nhập
        </Link>
      </AuthCard>
    </div>
  );
}
