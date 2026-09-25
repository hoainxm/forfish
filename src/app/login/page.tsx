"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import { normalizePassword } from "@/lib/password";
import {
  loginErrorMessage,
  tokenIssueErrorMessage,
  type AccountExists,
} from "@/lib/login-error";

/*
  Đăng nhập SDFish — app khách hàng. Hướng TÀI KHOẢN: SĐT + MẬT KHẨU (KHÔNG
  email, KHÔNG OTP). Tài khoản do webhook SDWork provision khi mua hàng — sale
  báo KH "SĐT + mật khẩu". KHÔNG ép đổi mật khẩu lần đầu (chính sách 2026-07-21).
*/

/** SĐT này có tài khoản chưa? null = không kiểm được (mất mạng / demo mode) →
 *  loginErrorMessage quay về câu gộp cũ. */
async function checkAccountExists(phone: string): Promise<AccountExists> {
  try {
    const res = await fetch(apiUrl("/api/auth/exists"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
      signal: timeoutSignal(8000),
    });
    const json = await res.json();
    return json?.ok === true ? Boolean(json.exists) : null;
  } catch {
    return null;
  }
}
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
      setError("Bà con nhập đủ 10 số nhé (ví dụ: 0901234567).");
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
        password: normalizePassword(password),
      }),
      25000,
    );
    if (!res) {
      setError("Mạng hơi yếu, chưa đăng nhập được. Bà con thử lại giúp nhé.");
      setLoading(false);
      return;
    }
    const { data, error: signInError } = res;
    if (signInError || !data.user) {
      // Tách câu lỗi: SĐT chưa có tài khoản ≠ có rồi nhưng sai mật khẩu.
      const exists = await checkAccountExists(phone);
      setError(loginErrorMessage(signInError, exists));
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
    /*  GIỮ CẢ MÃ HTTP LẪN THÂN JSON (sửa 2026-08-27). Trước đây `.then(r =>
        r.json())` VỨT `r.status`/`r.ok`, nên client không phân biệt được "máy
        chủ trả lỗi dứt khoát" với "thật sự chưa với tới máy chủ" — cả hai đội
        chung câu "mạng yếu, bấm lại". Nếu gốc là thiếu cấu hình / lỗi DB thì bà
        con bấm lại VÔ TẬN, hỏng y hệt (khuôn lỗi repo cảnh báo nhiều lần:
        hạ tầng trục trặc đội lốt "mạng yếu"). Nay giữ lại để nói thật. */
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
      }).then(async (r) => ({
        status: r.status,
        body: (await r.json().catch(() => null)) as {
          ok?: boolean;
          token?: unknown;
          code?: string;
          kicked?: boolean;
          mustChangePassword?: boolean;
          tier?: string | null;
          premiumUntil?: string | null;
        } | null,
      })),
      20000,
    );
    /*  issued === null ⇒ THẬT SỰ chưa với tới máy chủ (mất sóng / hết giờ / fetch
        ném). CHỈ ở đây "mạng yếu, bấm lại" mới đúng: phiên Supabase tạm còn nên
        bấm lại là chạy, khỏi gõ lại mật khẩu. */
    if (!issued) {
      setError(
        "Mạng hơi yếu, bà con bấm Đăng nhập lại lần nữa nhé.",
      );
      setLoading(false);
      return;
    }
    const body = issued.body;
    /*  MÁY CHỦ ĐÃ TRẢ LỜI nhưng KHÔNG cấp được chuỗi ⇒ DỪNG LẠI, đừng cho vào
        app (cho vào mà không có chuỗi thì mọi cửa server đều đóng, tệ hơn một câu
        báo thật). KHÁC "mạng yếu": đây là lỗi phía máy chủ, bấm lại có thể vô ích
        → nói đúng nguyên nhân + ghi mã để lần sau thấy ngay gốc. */
    if (!body?.ok || !isValidTokenShape(body.token)) {
      const code =
        typeof body?.code === "string" ? body.code : `http_${issued.status}`;
      console.error(
        "[login] cấp chuỗi KHÔNG thành:",
        code,
        "· status",
        issued.status,
      );
      setError(tokenIssueErrorMessage(code));
      setLoading(false);
      return;
    }
    /*  CẤT ĐƯỢC CHUỖI RỒI MỚI ĐƯỢC ĐI TIẾP (sửa 2026-08-02h, Codex bắt).
        Máy chủ đã thu hồi chuỗi máy cũ ở bước trên. Nếu kho máy này bị chặn
        (chế độ riêng tư iOS) hay đầy mà mình vẫn đi tiếp rồi bỏ phiên tạm, thì
        tài khoản KHÔNG CÒN credential nào: máy mới không giữ được chuỗi, máy cũ
        thì vừa bị đá. Mất cả hai đầu.
        Cất không được ⇒ GIỮ NGUYÊN phiên tạm, báo thật, để bà con bấm lại. */
    /*  CHUỖI CHỈ GHI THÀNH CÔNG KHI CÓ HẠNG ĐI KÈM (chủ dự án 2026-09-02).
        Máy chủ vừa trả `tier` ngay trong phản hồi cấp chuỗi, nên không có lý do
        gì ghi rời hai lần rồi để lệch nhau. Thiếu `tier` (không tìm ra hàng
        khách) ⇒ coi như hạng THƯỜNG chứ KHÔNG để trống: "chưa biết hạng" chính
        là trạng thái đã ẩn sạch công cụ của bà con premium. Hạng thật sẽ được
        nhịp kế cập nhật lên. */
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
    // lần đầu (webhook đặt must_change_password) → bắt đổi mật khẩu
    const mustChange = body.mustChangePassword === true;
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
    if (body.kicked === true) {
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
        sub="Nhập số điện thoại và mật khẩu để xem đồ đã mua, bảo hành và được SDVICO chăm sóc."
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
        {/*  Quên mật khẩu: gửi yêu cầu sang CRM để nhân viên duyệt (thêm
            2026-07-21) — trước đây chỉ có số hotline, KH ngoài giờ làm việc
            không biết bấu víu vào đâu.

            ĐƯA LÊN NGAY DƯỚI NÚT ĐĂNG NHẬP (2026-08-29): đo thật 375×812 ở
            scrollY=0, ba đoạn văn 220px đẩy hàng này xuống y=747-807 trong khi
            dock bắt đầu y=739 ⇒ `document.elementFromPoint` đúng tâm nút trả về
            svg của dock. Đường LẤY LẠI MẬT KHẨU DUY NHẤT của app bị bịt kín ở
            trạng thái nghỉ — đó là lỗi chặn, không phải chuyện đẹp xấu.

            Ba đoạn văn đã BỎ (luật D1 — chữ không cấp dữ liệu thì bỏ):
            (a) "dùng SĐT + mật khẩu nhân viên báo khi mua" nhắc lại đúng
                placeholder của ô mật khẩu ngay trên;
            (b) luật một-máy dạy trước khi gặp — lúc bị đá đã có câu riêng
                (`kickedNote`) nói đúng lúc;
            (c) mẹo cài PWA không liên quan việc đang gõ mật khẩu — `InstallPrompt`
                ở trang chủ mới là chỗ của nó. */}
        <Link
          href="/quen-mat-khau"
          className="mt-4 flex min-h-[3.75rem] w-full items-center justify-center rounded-full border-2 border-line text-[1rem] font-bold text-foreground/80 transition active:scale-[0.98]"
        >
          Quên mật khẩu?
        </Link>
        {/*  Đường sang tự đăng ký (mở lại 2026-09-23): người ngoài chưa có tài
             khoản tạo nhanh bằng SĐT — câu lỗi "chưa có tài khoản" ở
             login-error.ts chỉ thẳng xuống nút này. */}
        <p className="mt-4 text-[0.9375rem] leading-snug text-foreground/70">
          Chưa có tài khoản?{" "}
          <Link
            href="/dang-ky"
            className="inline-flex min-h-[3.5rem] items-center px-2 font-bold text-sea"
          >
            Đăng ký
          </Link>
        </p>
        <p className="mt-1 text-center text-[0.9375rem] leading-snug text-foreground/60">
          Đăng nhập tức là bà con đồng ý với{" "}
          <Link href="/quyen-rieng-tu" className="font-bold text-sea underline">
            Chính sách quyền riêng tư
          </Link>
          .
        </p>
      </AuthCard>
    </div>
  );
}
