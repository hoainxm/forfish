"use client";

// Đăng nhập web quản trị — CHUNG tài khoản Supabase với app ngư dân
// (SĐT + mật khẩu, email ảo {SĐT}@sdvico.local). Đăng nhập xong quyền admin
// vẫn do /api/admin/* kiểm (ADMIN_PHONES) — trang này chỉ mở phiên.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { phoneToEmail } from "@/lib/phone";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    if (!supabase) {
      setError("Web chưa cấu hình Supabase — kiểm tra env.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: phoneToEmail(phone),
      password,
    });
    setBusy(false);
    if (err) {
      setError("Sai số điện thoại hoặc mật khẩu.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  const field =
    "min-h-[3rem] w-full rounded-xl border-0 bg-field px-4 text-[1rem] font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea";

  return (
    <main className="mx-auto flex min-h-screen max-w-[420px] flex-col justify-center px-5 pb-24">
      <h1 className="display text-center text-[1.5rem] font-bold text-navy">
        Quản trị SDFish
      </h1>
      <p className="mt-1 text-center text-[0.9375rem] text-foreground/65">
        Dành cho đội SDVICO — đăng nhập bằng tài khoản quản trị viên.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <input
          required
          inputMode="numeric"
          autoComplete="username"
          placeholder="Số điện thoại"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={field}
        />
        <input
          required
          type="password"
          autoComplete="current-password"
          placeholder="Mật khẩu"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={field}
        />
        {error && (
          <p className="text-[0.9375rem] font-semibold text-danger">{error}</p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="display min-h-[3.25rem] w-full rounded-full bg-trim text-[1.0625rem] font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? "Đang vào…" : "Đăng nhập"}
        </button>
      </form>
    </main>
  );
}
