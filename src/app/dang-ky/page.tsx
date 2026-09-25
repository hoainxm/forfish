"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiUrl } from "@/lib/api-base";
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
import {
  normalizePassword,
  PASSWORD_MIN_LENGTH,
  passwordProblem,
} from "@/lib/password";
import { timeoutSignal } from "@/lib/abort";
import { deviceId } from "@/lib/device-id";
import { devicePlatform } from "@/lib/storage-persist";
import { isValidTokenShape } from "@/lib/device-token";
import { saveToken } from "@/lib/device-token-store";
import { tokenIssueErrorMessage } from "@/lib/login-error";

/*
  MÀN TỰ ĐĂNG KÝ MỞ LẠI (chủ dự án 2026-09-23: mở public self-signup cho người
  dùng ngoài — đảo quyết định khoá 2026-09-01). Bà con chưa phải khách SDWork
  vẫn tự tạo được tài khoản bằng SĐT; tài khoản mới là hạng THƯỜNG (basic).

  Luồng CĂN theo /login (2026-08-02, chuỗi cứng): tạo tài khoản qua auth-gateway
  (email ảo ĐÃ confirm sẵn) → signInWithPassword → ĐỔI phiên lấy CHUỖI CỨNG qua
  /api/auth/token → BỎ phiên Supabase. KHÔNG để chạy thuần phiên Supabase: JWT
  ngắn hạn + refresh tự xoay là đúng thứ migration 0026 sinh ra để diệt — ra
  khơi mất sóng quá một giờ là bị đá mà không ai đăng nhập ở đâu cả.
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
      setError("Bà con nhập đủ 10 số nhé (ví dụ: 0901234567).");
      return;
    }
    const pw = normalizePassword(password);
    const pwProblem = passwordProblem(password);
    if (pwProblem) {
      setError(pwProblem);
      return;
    }

    setLoading(true);
    // Tạo tài khoản qua auth-gateway (email ảo ĐÃ confirm sẵn — email ảo không
    // có hòm thư thật để bấm link xác nhận).
    const res = await fetch(apiUrl("/api/auth/signup"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password: pw }),
      signal: timeoutSignal(25000),
    }).catch(() => null);

    if (!res || !res.ok) {
      const j = res ? await res.json().catch(() => null) : null;
      setError(
        j?.code === "exists"
          ? "Số điện thoại này đã có tài khoản — bà con bấm Đăng nhập bên dưới nhé."
          : "Hiện tại chưa đăng ký được. Bà con thử lại sau ít phút nhé.",
      );
      setLoading(false);
      return;
    }

    // Tài khoản đã sẵn sàng → đăng nhập để lấy phiên.
    // ĐỒNG HỒ CHẶN: cú này chạy SAU khi tài khoản đã tạo THẬT trên máy chủ.
    // Không có đồng hồ thì nút kẹt "Đang tạo…" vĩnh viễn ⇒ bà con bấm tạo lần
    // hai và nhận "đã có tài khoản" mà không hiểu vì sao. Treo/hỏng đều đẩy sang
    // màn Đăng nhập kèm `?tao=xong` để /login NÓI RA việc đã xong.
    const signIn = await withDeadline(
      supabase!.auth.signInWithPassword({
        email: phoneToEmail(phone),
        password: pw,
      }),
      25000,
    );
    if (!signIn || signIn.error) {
      router.replace("/login?tao=xong");
      return;
    }

    /*  ĐỔI PHIÊN LẤY CHUỖI CỨNG — Y HỆT /login. GIỮ CẢ MÃ HTTP LẪN THÂN JSON để
        phân biệt "máy chủ trả lỗi dứt khoát" với "chưa với tới máy chủ" (khuôn
        lỗi repo: hạ tầng trục trặc đội lốt "mạng yếu"). `signal` LÀ BẮT BUỘC —
        withDeadline chỉ bỏ KẾT QUẢ, request vẫn chạy trên máy chủ; hai lượt cấp
        chuỗi đua nhau thì lượt về sau thu hồi chuỗi của lượt trước. */
    const issued = await withDeadline(
      fetch(apiUrl("/api/auth/token"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deviceId: deviceId(),
          platform: devicePlatform(),
        }),
        signal: timeoutSignal(20000),
      }).then(async (r) => ({
        status: r.status,
        body: (await r.json().catch(() => null)) as {
          ok?: boolean;
          token?: unknown;
          code?: string;
          tier?: string | null;
          premiumUntil?: string | null;
        } | null,
      })),
      20000,
    );
    /*  issued === null ⇒ THẬT SỰ chưa với tới máy chủ. Việc đã xong (tài khoản
        đã tạo), chỉ thiếu bước vào — đẩy sang /login, đừng chặn bằng hộp lỗi. */
    if (!issued) {
      router.replace("/login?tao=xong");
      return;
    }
    const body = issued.body;
    /*  MÁY CHỦ ĐÃ TRẢ LỜI nhưng KHÔNG cấp được chuỗi ⇒ DỪNG LẠI. Cho vào app mà
        không có chuỗi thì mọi cửa server đều đóng, tệ hơn một câu báo thật. */
    if (!body?.ok || !isValidTokenShape(body.token)) {
      const code =
        typeof body?.code === "string" ? body.code : `http_${issued.status}`;
      console.error("[dang-ky] cấp chuỗi KHÔNG thành:", code, "· status", issued.status);
      setError(tokenIssueErrorMessage(code));
      setLoading(false);
      return;
    }
    /*  CẤT ĐƯỢC CHUỖI RỒI MỚI ĐƯỢC ĐI TIẾP. Tài khoản mới là hạng THƯỜNG
        (basic) — chưa mua premium; hạng thật (nếu sau này SDWork gán) sẽ được
        nhịp kế cập nhật. saveToken ghi CẶP hạng+chuỗi, hụt vế nào thì dừng. */
    const tierTho = typeof body.tier === "string" ? body.tier : "basic";
    const han =
      tierTho === "premium" ? ((body.premiumUntil as string) ?? null) : null;
    if (!saveToken(body.token, tierTho, han)) {
      setError(
        "Trình duyệt đang bật chế độ Ẩn danh nên app không nhớ được tài khoản. Bà con tắt chế độ Ẩn danh rồi đăng nhập lại nhé.",
      );
      setLoading(false);
      return;
    }
    /*  BỎ PHIÊN SUPABASE — chuỗi cứng đã nằm trong máy, phiên bỏ lại chỉ tự chết
        chứ không mở được cửa nào. */
    await withDeadline(supabase!.auth.signOut(), 8000);
    router.replace("/");
  }

  return (
    <div>
      <PageHeader
        kicker="Tài khoản"
        title="Đăng ký"
        sub="Tạo tài khoản bằng số điện thoại để cất sổ tàu trên mạng, đổi máy vẫn còn."
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
          {/* có nút Hiện/Ẩn nên bỏ được ô "Nhập lại" — bớt một việc gõ.
              Luật (ít nhất 6 ký tự) nay hiện ở NHÃN KIỂM TRA tại chỗ dưới ô
              (minLength) nên bỏ khỏi label cho gọn — không nhắc hai lần. */}
          <PasswordField
            label="Mật khẩu"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
          />
          <PrimaryButton type="submit" disabled={loading}>
            {loading ? "Đang tạo…" : "Tạo tài khoản"}
          </PrimaryButton>
        </form>
        <p className="mt-3 text-center text-[0.9375rem] leading-snug text-foreground/60">
          Tạo tài khoản tức là bà con đồng ý với{" "}
          <Link href="/quyen-rieng-tu" className="font-bold text-sea underline">
            Chính sách quyền riêng tư
          </Link>
          .
        </p>
        {/*  Vùng chạm lên sàn mà KHÔNG phình thành dải ngang: đây là đường DUY
            NHẤT từ màn đăng ký sang màn đăng nhập, cũng là đường bà con cần ngay
            khi vừa nhận lỗi "Số điện thoại này đã có tài khoản". */}
        <p className="mt-4 text-[0.9375rem] leading-snug text-foreground/70">
          Đã có tài khoản?{" "}
          <Link
            href="/login"
            className="inline-flex min-h-[3.5rem] items-center px-2 font-bold text-sea"
          >
            Đăng nhập
          </Link>
        </p>
      </AuthCard>
    </div>
  );
}
