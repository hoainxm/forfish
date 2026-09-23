"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CallButton,
  Field,
  inputClass,
  PrimaryButton,
} from "@/components/ui/primitives";
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
          <p className="mb-4 text-[1rem] leading-relaxed text-foreground/70">
            Nhận được mật khẩu mới, bà con đăng nhập rồi đổi lại thành mật khẩu
            của riêng mình cho an toàn.
          </p>
          <Link
            href="/login"
            className="display flex min-h-[3.75rem] w-full items-center justify-center rounded-full bg-trim text-[1.125rem] font-bold text-white shadow-trim-cta transition active:scale-[0.98]"
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
        {/*  ĐẢO NGƯỢC ƯU TIÊN (2026-08-29, luật A5/D1): ở nhánh chưa cấu hình
            endpoint, việc DUY NHẤT bà con làm được là GỌI HOTLINE — mà link đó
            chỉ 171×21px, dưới sàn 56px gần ba lần, trong khi "Quay lại đăng
            nhập" (chỉ là đường lùi) được cả dải 303×60. Nay hotline là
            CallButton đúng khuôn, đường lùi hạ xuống link chữ. */}
        {!endpoint ? (
          <div className="mb-4 flex items-stretch gap-2">
            <p className="min-w-0 flex-1 text-[1rem] leading-snug text-foreground/70">
              Gọi SDVICO {HOTLINE_HIEN} để được cấp lại mật khẩu.
            </p>
            <CallButton phone={HOTLINE} label="Gọi SDVICO" />
          </div>
        ) : (
          <>
            {/* Rút còn vế CẤP DỮ LIỆU chưa nói ở đâu khác (D1) */}
            <AuthNote>
              Nhân viên SDVICO gọi lại báo mật khẩu mới trong vòng 24 giờ.
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

        {/*  Bỏ đoạn "Cần gấp? Gọi SDVICO …" (D1): số này đã nói ngay phía trên,
            cách đúng hai dòng. Đường lùi hạ xuống link chữ inline, vùng chạm
            vẫn ≥3.5rem (luật A2/A3/A5). */}
        <Link
          href="/login"
          className="mt-3 inline-flex min-h-[3.5rem] items-center px-4 text-[1rem] font-bold text-sea transition active:scale-[0.98]"
        >
          Quay lại đăng nhập
        </Link>
      </AuthCard>
    </div>
  );
}
