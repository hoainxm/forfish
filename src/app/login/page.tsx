"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api-base";
import { createClient } from "@/lib/supabase/client";
import { Field, inputClass, PrimaryButton } from "@/components/ui/primitives";
import { PageHeader } from "@/components/page-header";
import {
  AuthCard,
  AuthError,
  AuthNote,
  isValidVnPhone,
  OtpField,
  PasswordField,
  phoneToEmail,
  sanitizePhoneInput,
} from "@/components/auth-form";

/*
  Đăng nhập SDFish — app khách hàng. SĐT + OTP là CHÍNH (KH không cần nhớ mật
  khẩu); mật khẩu là đường PHỤ cho KH đã có. Provider OTP cắm sau — chưa cấu
  hình thì /api/auth/otp/* trả 503, UI tự lùi sang mật khẩu.
*/
export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"otp" | "password">("otp");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!supabase) {
    return (
      <div>
        <PageHeader kicker="Tài khoản" title="Đăng nhập" toColor="var(--sea)" />
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

  // ── OTP: gửi mã ──────────────────────────────────────────────────────────
  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidVnPhone(phone)) {
      setError("Số điện thoại không hợp lệ. Bà con kiểm tra lại nhé.");
      return;
    }
    setLoading(true);
    const r = await fetch(apiUrl("/api/auth/otp/request"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
      signal: AbortSignal.timeout(15000),
    }).catch(() => null);
    setLoading(false);

    if (r?.ok) {
      setStep("code");
      return;
    }
    if (r?.status === 503) {
      // chưa cắm provider OTP → lùi sang mật khẩu
      setMode("password");
      setError("Đăng nhập bằng mã chưa sẵn sàng — bà con dùng mật khẩu nhé.");
      return;
    }
    if (r?.status === 429) {
      setError("Vừa gửi mã rồi — đợi một phút rồi thử lại.");
      return;
    }
    setError("Chưa gửi được mã. Kiểm tra mạng rồi thử lại.");
  }

  // ── OTP: xác nhận mã → set session ─────────────────────────────────────────
  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const r = await fetch(apiUrl("/api/auth/otp/verify"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code }),
      signal: AbortSignal.timeout(15000),
    }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as
      | { ok: boolean; tokenHash?: string }
      | null;

    if (!j?.ok || !j.tokenHash) {
      setLoading(false);
      setError("Mã không đúng hoặc đã hết hạn. Bà con thử lại.");
      return;
    }
    const { error: vErr } = await supabase!.auth.verifyOtp({
      token_hash: j.tokenHash,
      type: "magiclink",
    });
    setLoading(false);
    if (vErr) {
      setError("Không vào được. Bà con thử gửi lại mã.");
      return;
    }
    router.replace("/");
  }

  // ── Mật khẩu (đường phụ, giữ logic cũ) ─────────────────────────────────────
  async function loginPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidVnPhone(phone)) {
      setError("Số điện thoại không hợp lệ. Bà con kiểm tra lại nhé.");
      return;
    }
    setLoading(true);
    const email = phoneToEmail(phone);
    let { data, error: signInError } = await supabase!.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError || !data.user) {
      await fetch(apiUrl("/api/auth/sso"), {
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
    const { data: profile } = await supabase!
      .from("profiles")
      .select("must_change_password")
      .eq("id", data.user.id)
      .single();
    router.replace(profile?.must_change_password ? "/doi-mat-khau" : "/");
  }

  const phoneInput = (
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
  );

  return (
    <div>
      <PageHeader
        kicker="Tài khoản"
        title="Đăng nhập"
        sub="Nhập số điện thoại để vào xem thiết bị, bảo hành, hỗ trợ của bạn."
        toColor="var(--sea)"
      />
      <AuthCard>
        {error && <AuthError>{error}</AuthError>}

        {mode === "otp" && step === "phone" && (
          <form onSubmit={sendOtp}>
            {phoneInput}
            <PrimaryButton type="submit" disabled={loading}>
              {loading ? "Đang gửi…" : "Gửi mã đăng nhập"}
            </PrimaryButton>
            <p className="mt-3 text-[1rem] leading-snug">
              <button
                type="button"
                onClick={() => {
                  setMode("password");
                  setError(null);
                }}
                className="font-bold text-sea"
              >
                Đăng nhập bằng mật khẩu
              </button>
            </p>
          </form>
        )}

        {mode === "otp" && step === "code" && (
          <form onSubmit={verifyOtp}>
            <AuthNote>Đã gửi mã tới {phone}. Nhập mã để vào.</AuthNote>
            <OtpField value={code} onChange={setCode} />
            <PrimaryButton type="submit" disabled={loading || code.length < 6}>
              {loading ? "Đang vào…" : "Xác nhận"}
            </PrimaryButton>
            <p className="mt-3 text-[1rem] leading-snug">
              <button
                type="button"
                onClick={() => {
                  setStep("phone");
                  setCode("");
                  setError(null);
                }}
                className="font-bold text-sea"
              >
                Đổi số / gửi lại mã
              </button>
            </p>
          </form>
        )}

        {mode === "password" && (
          <form onSubmit={loginPassword}>
            {phoneInput}
            <PasswordField
              label="Mật khẩu"
              value={password}
              onChange={setPassword}
              placeholder="Mật khẩu"
            />
            <PrimaryButton type="submit" disabled={loading}>
              {loading ? "Đang vào…" : "Đăng nhập"}
            </PrimaryButton>
            <p className="mt-3 text-[1rem] leading-snug">
              <button
                type="button"
                onClick={() => {
                  setMode("otp");
                  setStep("phone");
                  setError(null);
                }}
                className="font-bold text-sea"
              >
                Đăng nhập bằng mã OTP
              </button>
            </p>
          </form>
        )}

        <p className="mt-4 text-[1rem] leading-snug">
          Cần giúp?{" "}
          <a href="tel:1900232349" className="font-bold text-sea">
            Gọi SDVICO 1900 23 23 49
          </a>
        </p>
      </AuthCard>
    </div>
  );
}
