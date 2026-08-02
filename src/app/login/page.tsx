"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { withDeadline } from "@/lib/auth-error";
import { apiUrl } from "@/lib/api-base";
import { deviceId } from "@/lib/device-id";
import { devicePlatform } from "@/lib/storage-persist";
import { isValidTokenShape } from "@/lib/device-token";
import { saveToken } from "@/lib/device-token-store";
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

/*
  Đăng nhập SDFish — app khách hàng. Hướng TÀI KHOẢN: SĐT + MẬT KHẨU (KHÔNG
  email, KHÔNG OTP). Tài khoản do webhook SDWork provision khi mua hàng — sale
  báo KH "SĐT + mật khẩu". Lần đầu app nhắc đổi mật khẩu (must_change_password).
*/
export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [phone, setPhone] = useState("");
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidVnPhone(phone)) {
      setError("Số điện thoại không hợp lệ. Bà con kiểm tra lại nhé.");
      return;
    }
    setLoading(true);
    /* ĐỒNG HỒ CHẶN (soát 2026-08-02): signInWithPassword không nhận
       AbortSignal. Sóng "sống mà chết" ở cảng/ngoài khơi làm nó treo — không
       resolve, không reject — nên nút kẹt "Đang vào…" VĨNH VIỄN, bà con không
       biết nên chờ hay bấm lại. 25 giây: rộng cho 3G cảng, vẫn có điểm dừng. */
    const res = await withDeadline(
      supabase!.auth.signInWithPassword({
        email: phoneToEmail(phone),
        password,
      }),
      25000,
    );
    if (!res) {
      setError("Mạng yếu quá, chưa vào được. Bà con thử lại giúp nhé.");
      setLoading(false);
      return;
    }
    const { data, error: signInError } = res;
    if (signInError || !data.user) {
      setError("Sai số điện thoại hoặc mật khẩu.");
      setLoading(false);
      return;
    }
    /*  ĐỔI PHIÊN VỪA CÓ LẤY CHUỖI CỨNG (2026-08-02, chủ dự án chốt).
        Phiên Supabase là JWT ngắn hạn + refresh token tự xoay — ngoài biển, một
        lượt xoay mà phản hồi không về là bà con bị đá khỏi tài khoản dù KHÔNG ai
        đăng nhập ở đâu cả. Nay: nhận một chuỗi không hạn, không xoay, rồi BỎ HẲN
        phiên Supabase. Từ đây không còn thứ gì trên máy tự hết hạn.

        Đây cũng là chỗ cưỡng chế 1-tài-khoản-1-máy: route thu hồi chuỗi của mọi
        máy cũ TRƯỚC khi cấp chuỗi mới (thay cho `signOut({scope:'others'})`). */
    const issued = await withDeadline(
      fetch(apiUrl("/api/auth/token"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deviceId: deviceId(),
          platform: devicePlatform(),
        }),
      }).then((r) => r.json().catch(() => null)),
      20000,
    );
    /*  KHÔNG cấp được chuỗi ⇒ DỪNG LẠI, đừng cho vào app. Phiên Supabase tạm vẫn
        còn nên bấm lại là chạy, khỏi nhập lại mật khẩu. Cho vào mà không có chuỗi
        thì bà con thấy mình "đã đăng nhập" trong khi mọi cửa server đều đóng —
        tệ hơn hẳn một câu báo lỗi thật thà. */
    if (!issued?.ok || !isValidTokenShape(issued.token)) {
      setError("Mạng yếu quá, chưa vào được. Bà con thử lại giúp nhé.");
      setLoading(false);
      return;
    }
    saveToken(issued.token);
    /*  BỎ PHIÊN SUPABASE. Không `scope:'others'` nữa — việc đá máy cũ đã do route
        làm rồi. Hỏng thì thôi, không chặn: chuỗi đã nằm trong máy, mà cái phiên
        bỏ lại cũng chỉ tự chết chứ không mở được cửa nào. */
    await withDeadline(supabase!.auth.signOut(), 8000);
    // lần đầu (webhook đặt must_change_password) → bắt đổi mật khẩu
    const mustChange = issued.mustChangePassword === true;
    router.replace(mustChange ? "/doi-mat-khau" : "/");
  }

  return (
    <div>
      <PageHeader
        kicker="Tài khoản"
        title="Đăng nhập"
        sub="Nhập số điện thoại và mật khẩu để xem thiết bị, bảo hành, hỗ trợ của bạn."
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
          <PasswordField
            label="Mật khẩu"
            value={password}
            onChange={setPassword}
            placeholder="Mật khẩu nhân viên báo khi mua"
          />
          <PrimaryButton type="submit" disabled={loading}>
            {loading ? "Đang vào…" : "Đăng nhập"}
          </PrimaryButton>
        </form>
        <p className="mt-4 text-[1rem] leading-snug text-foreground/70">
          Khách đã mua hàng SDVICO: dùng số điện thoại + mật khẩu nhân viên báo
          khi mua. Vào xong app nhắc đổi mật khẩu.
        </p>
        <p className="mt-2 text-[1rem] leading-snug text-foreground/70">
          Tài khoản premium hỗ trợ đăng nhập trên một máy. Vào rồi thì máy nhớ
          luôn, không phải đăng nhập lại — trừ khi bà con đăng nhập ở máy khác.
        </p>
        {/*  iOS Safari xoá sạch dữ liệu trang web sau 7 ngày không mở, kể cả chỗ
             lưu đăng nhập — bản cài về màn hình thì không dính. Đây là luật của
             máy, không phải lựa chọn của app, nên phải nói trước. Giọng "hỗ trợ",
             không doạ (xem 03-design-system). */}
        <p className="mt-2 text-[1rem] leading-snug text-foreground/70">
          Cài app về màn hình chính giúp máy nhớ đăng nhập lâu dài, kể cả khi đi
          biển nhiều ngày.
        </p>
        <p className="mt-2 text-[1rem] leading-snug">
          Quên mật khẩu?{" "}
          <a href="tel:1900232349" className="font-bold text-sea">
            Gọi SDVICO 1900 23 23 49
          </a>
        </p>
      </AuthCard>
    </div>
  );
}
