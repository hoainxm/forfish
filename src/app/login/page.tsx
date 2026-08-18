"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { withDeadline } from "@/lib/auth-error";
import { apiUrl } from "@/lib/api-base";
import { timeoutSignal } from "@/lib/abort";
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
  /** Vừa đăng nhập xong và máy TRƯỚC đã bị đăng xuất — nói một dòng rồi mới vào
   *  (audit 2026-08-18 G1: route đã trả `kicked:true` từ lâu mà màn này không
   *  đọc). Hiện inline ~1.5 giây rồi `router.replace` — không có gì chờ mạng. */
  const [kickedNote, setKickedNote] = useState(false);
  /** Từ /dang-ky sang: tài khoản đã tạo nhưng bước vào bị hụt (audit G4). Đọc
   *  `window.location.search` trong effect thay vì `useSearchParams` (Next đòi
   *  Suspense bọc trang) — rẻ, không treo. */
  const [createdNote, setCreatedNote] = useState(false);
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.get("tao") === "xong") setCreatedNote(true);
    } catch {
      /* bỏ qua */
    }
  }, []);

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
        /*  `signal` LÀ BẮT BUỘC, KHÔNG chỉ dựa `withDeadline` (sửa 2026-08-02h).
            `withDeadline` chỉ bỏ KẾT QUẢ sau 20 giây; request vẫn chạy tiếp trên
            máy chủ. Bà con thấy lỗi, bấm Đăng nhập lần hai ⇒ hai lượt cấp chuỗi
            đua nhau: lượt B cấp chuỗi và máy lưu, rồi lượt A về sau THU HỒI chuỗi
            của B để cấp chuỗi A mà không máy nào cầm ⇒ lượt gọi kế của máy nhận
            `401 token_revoked` ⇒ màn hình nói dối "máy khác vừa đăng nhập".
            Cắt thật thì lượt A chết hẳn, không còn ai đi thu hồi. */
        signal: timeoutSignal(20000),
      }).then((r) => r.json().catch(() => null)),
      20000,
    );
    /*  KHÔNG cấp được chuỗi ⇒ DỪNG LẠI, đừng cho vào app. Phiên Supabase tạm vẫn
        còn nên bấm lại là chạy, khỏi nhập lại mật khẩu. Cho vào mà không có chuỗi
        thì bà con thấy mình "đã đăng nhập" trong khi mọi cửa server đều đóng —
        tệ hơn hẳn một câu báo lỗi thật thà. */
    if (!issued?.ok || !isValidTokenShape(issued.token)) {
      /*  KHÁC câu "Mạng yếu" ở bước 1 (audit G9/A5): tới đây mật khẩu ĐÃ đúng,
          phiên tạm còn — bà con chỉ cần bấm lại, không phải gõ lại gì. Cùng một
          câu cho hai bước là bà con tưởng sai mật khẩu, gõ lại từ đầu. */
      setError(
        "Mật khẩu đúng rồi nhưng mạng yếu, chưa giữ được phiên — bà con bấm Đăng nhập lần nữa giúp.",
      );
      setLoading(false);
      return;
    }
    /*  CẤT ĐƯỢC CHUỖI RỒI MỚI ĐƯỢC ĐI TIẾP (sửa 2026-08-02h, Codex bắt).
        Máy chủ đã thu hồi chuỗi máy cũ ở bước trên. Nếu kho máy này bị chặn
        (chế độ riêng tư iOS) hay đầy mà mình vẫn đi tiếp rồi bỏ phiên tạm, thì
        tài khoản KHÔNG CÒN credential nào: máy mới không giữ được chuỗi, máy cũ
        thì vừa bị đá. Mất cả hai đầu.
        Cất không được ⇒ GIỮ NGUYÊN phiên tạm, báo thật, để bà con bấm lại. */
    if (!saveToken(issued.token)) {
      setError(
        "Máy đang không cho app lưu dữ liệu nên chưa giữ được đăng nhập. Bà con tắt chế độ duyệt web riêng tư (ẩn danh) rồi thử lại giúp.",
      );
      setLoading(false);
      return;
    }
    // lần đầu (webhook đặt must_change_password) → bắt đổi mật khẩu
    const mustChange = issued.mustChangePassword === true;
    /*  ĐỔI MẬT KHẨU LẦN ĐẦU THÌ GIỮ PHIÊN TẠM (sửa 2026-08-02h, Codex bắt).
        `/doi-mat-khau` đổi mật khẩu bằng `supabase.auth.updateUser`, tức nó CẦN
        phiên. Bỏ phiên ngay ở đây rồi mới chuyển sang là màn đó chỉ báo "phải
        đăng nhập" ⇒ bà con đăng nhập lại ⇒ lại cấp chuỗi, lại bỏ phiên, lại
        chuyển sang ⇒ VÒNG LẶP KHÔNG LỐI RA, và đây là màn BẮT BUỘC của mọi tài
        khoản mới. Phiên tạm sẽ bị bỏ ở cuối `/doi-mat-khau`, sau khi đổi xong.
        Chuỗi cứng đã nằm trong máy từ trên, nên giữ thêm phiên không nới quyền
        gì — nó chỉ sống thêm vài phút cho đúng một việc. */
    if (mustChange) {
      router.replace("/doi-mat-khau");
      return;
    }
    /*  BỎ PHIÊN SUPABASE. Không `scope:'others'` nữa — việc đá máy cũ đã do route
        làm rồi. Hỏng thì thôi, không chặn: chuỗi đã nằm trong máy, mà cái phiên
        bỏ lại cũng chỉ tự chết chứ không mở được cửa nào. */
    await withDeadline(supabase!.auth.signOut(), 8000);
    /*  MÁY TRƯỚC VỪA BỊ ĐĂNG XUẤT → nói một dòng cho minh bạch rồi mới vào.
        Không chờ mạng: chỉ là 1,5 giây để mắt kịp đọc. */
    if (issued.kicked === true) {
      setKickedNote(true);
      setLoading(false);
      window.setTimeout(() => router.replace("/"), 1500);
      return;
    }
    router.replace("/");
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
        {createdNote && !error && (
          <AuthNote>
            Tài khoản đã tạo — mạng yếu nên chưa vào được, bà con đăng nhập lại
            giúp.
          </AuthNote>
        )}
        {kickedNote && (
          <AuthNote>
            Đã vào. Máy trước đã được đăng xuất — số này chỉ dùng trên một máy.
          </AuthNote>
        )}
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
        {/*  4 đoạn chú thích gộp còn 2 dòng (audit 2026-08-18 G10). Ý iOS "cài
             app về màn hình để máy nhớ đăng nhập" giữ trong dòng 1 — luật của
             máy, phải nói trước; giọng hỗ trợ, không doạ (03-design-system). */}
        <p className="mt-4 text-[1rem] leading-snug text-foreground/70">
          Khách SDVICO dùng số điện thoại + mật khẩu nhân viên báo khi mua. Vào
          rồi máy nhớ luôn (một số một máy) — cài app về màn hình chính để nhớ
          cả khi đi biển dài ngày.
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
