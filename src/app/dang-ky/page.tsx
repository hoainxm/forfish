"use client";

import { useEffect, useState } from "react";
import { readNextParam, withNext } from "@/lib/auth-next";
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
import { NHAN } from "@/lib/labels";
import { ghiDongYMay } from "@/lib/dieu-khoan";
import { guiDongYConTreo } from "@/components/dong-y-dieu-khoan";

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

  /** Vào xong quay về đâu (`?next=` từ cổng mời — lib/auth-next). Đọc trong effect như /login,
      khỏi `useSearchParams` (Next đòi Suspense bọc trang). */
  const [next, setNext] = useState("/");
  useEffect(() => {
    setNext(readNextParam(window.location.search));
  }, []);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  /** lỗi HỆ THỐNG (mạng, máy chủ, cấp chuỗi hỏng) — băng trên form */
  const [error, setError] = useState<string | null>(null);
  /** lỗi NHẬP từng ô — hiện dưới ô (VO-APP-04) */
  const [phoneErr, setPhoneErr] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  /*  Ô ĐỒNG Ý — LUÔN TRỐNG lúc mở (NĐ 356/2025: cấm đặt sẵn đồng ý). `dongYLuc` = mốc bà con tick, gửi máy chủ
      làm bằng chứng sau khi có tài khoản (lib/dieu-khoan, migration 0083). */
  const [dongYLuc, setDongYLuc] = useState<string | null>(null);
  const [dongYErr, setDongYErr] = useState<string | null>(null);

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
    setPhoneErr(null);
    setPwErr(null);

    // Kiểm CẢ hai ô rồi mới dừng — hiện đủ lỗi, con trỏ vào ô sai ĐẦU TIÊN.
    const loiSdt = isValidVnPhone(phone)
      ? null
      : "Bà con nhập đủ 10 số nhé (ví dụ: 0901234567).";
    const pw = normalizePassword(password);
    const loiPw = passwordProblem(password);
    const loiDongY = dongYLuc ? null : "Bà con đánh dấu ô đồng ý trước nhé.";
    if (loiSdt || loiPw || loiDongY) {
      setPhoneErr(loiSdt);
      setPwErr(loiPw);
      setDongYErr(loiDongY);
      document.getElementById(loiSdt ? "dk-sdt" : loiPw ? "dk-mk" : "dk-dong-y")?.focus();
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
      // "exists" là chuyện của RIÊNG ô SĐT → nói dưới ô; còn lại là lỗi hệ thống.
      if (j?.code === "exists") {
        setPhoneErr(
          "Số điện thoại này đã có tài khoản — bà con bấm Đăng nhập bên dưới nhé.",
        );
        document.getElementById("dk-sdt")?.focus();
      } else {
        setError("Hiện tại chưa đăng ký được. Bà con thử lại sau ít phút nhé.");
      }
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
      router.replace(`${withNext("/login", next)}${next === "/" ? "?" : "&"}tao=xong`);
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
      router.replace(`${withNext("/login", next)}${next === "/" ? "?" : "&"}tao=xong`);
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
    // bằng chứng đồng ý: ghi máy trước (mất sóng vẫn còn), gửi máy chủ — hụt thì tờ đồng ý gửi bù lúc mở app
    if (dongYLuc) {
      ghiDongYMay(phone, false, dongYLuc);
      await guiDongYConTreo("dang-ky", phone);
    }
    /*  BỎ PHIÊN SUPABASE — chuỗi cứng đã nằm trong máy, phiên bỏ lại chỉ tự chết
        chứ không mở được cửa nào. */
    await withDeadline(supabase!.auth.signOut(), 8000);
    // tài khoản mới ⇒ hỏi "Bà con làm nghề gì?" trước khi về chỗ cũ (spec 17 §3.1)
    router.replace(withNext("/chon-vai", next));
  }

  return (
    <div>
      {/* VO-APP-12: bỏ câu phụ dưới tiêu đề — ô + placeholder đã nói đủ việc */}
      <PageHeader kicker="Tài khoản" title="Đăng ký" toColor="var(--sea)" />
      <AuthCard>
        {error && <AuthError>{error}</AuthError>}
        <form onSubmit={handleSubmit}>
          <Field label="Số điện thoại" error={phoneErr ?? undefined}>
            <input
              id="dk-sdt"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              className={inputClass}
              placeholder="0901 234 567"
              value={phone}
              onChange={(e) => {
                setPhone(sanitizePhoneInput(e.target.value));
                setPhoneErr(null);
              }}
              required
            />
          </Field>
          {/* có nút Hiện/Ẩn nên bỏ được ô "Nhập lại" — bớt một việc gõ.
              Luật (ít nhất 6 ký tự) nay hiện ở NHÃN KIỂM TRA tại chỗ dưới ô
              (minLength) nên bỏ khỏi label cho gọn — không nhắc hai lần. */}
          <PasswordField
            id="dk-mk"
            label="Mật khẩu"
            value={password}
            onChange={(v) => {
              setPassword(v);
              setPwErr(null);
            }}
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
            error={pwErr ?? undefined}
          />
          {/* Ô ĐỒNG Ý (2026-11-05) — khuôn MoMo/Shopee: một ô, chữ bấm được để xem bản đầy đủ */}
          <div className="mb-3">
            <label className="flex min-h-(--h-ctl) items-start gap-3 text-[0.9375rem] leading-snug text-foreground">
              <input
                id="dk-dong-y"
                type="checkbox"
                className="mt-0.5 size-5 shrink-0 accent-sea"
                checked={dongYLuc !== null}
                aria-invalid={dongYErr ? true : undefined}
                aria-describedby={dongYErr ? "dk-dong-y-loi" : undefined}
                onChange={(e) => {
                  setDongYLuc(e.target.checked ? new Date().toISOString() : null);
                  setDongYErr(null);
                }}
              />
              <span>
                Tôi đồng ý với{" "}
                <Link href="/dieu-khoan" className="py-3 font-semibold text-sea underline">
                  Điều khoản sử dụng
                </Link>{" "}
                và{" "}
                <Link href="/quyen-rieng-tu" className="py-3 font-semibold text-sea underline">
                  Chính sách quyền riêng tư
                </Link>
                , gồm việc lưu dữ liệu nhạy cảm (ảnh, số CCCD trong sổ).
              </span>
            </label>
            {dongYErr && (
              <p id="dk-dong-y-loi" className="mt-1 text-[0.875rem] text-danger">
                {dongYErr}
              </p>
            )}
          </div>
          <PrimaryButton type="submit" disabled={loading}>
            {loading ? "Đang tạo…" : NHAN.dangKy}
          </PrimaryButton>
        </form>
        {/*  Vùng chạm lên sàn mà KHÔNG phình thành dải ngang: đây là đường DUY
            NHẤT từ màn đăng ký sang màn đăng nhập, cũng là đường bà con cần ngay
            khi vừa nhận lỗi "Số điện thoại này đã có tài khoản". */}
        <p className="mt-4 text-[0.9375rem] leading-snug text-foreground/70">
          Đã có tài khoản?{" "}
          <Link
            href={withNext("/login", next)}
            className="inline-flex min-h-[3.5rem] items-center px-2 font-semibold text-sea"
          >
            Đăng nhập
          </Link>
        </p>
      </AuthCard>
    </div>
  );
}
