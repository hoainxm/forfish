"use client";

import Link from "next/link";

import { LockIcon } from "@/components/icons";
import { useAuthUser } from "@/lib/use-auth";

/*
  CỔNG ĐĂNG NHẬP CẤP MÀN — chủ dự án chốt 2026-09-01: *"user yêu cầu phải đăng
  nhập mới dùng được … user ko acc chỉ thấy được màn hình trang chủ"*. Vế "phải
  liên hệ SDVICO để cấp acc" ĐÃ ĐẢO 2026-09-23: mở lại tự đăng ký cho người
  ngoài — cổng này nay mời TẠO tài khoản thẳng, không còn bắt gọi SDVICO.

  KHÁC `LoginGate`: cái kia khoá MỘT KHỐI bên trong một màn đang mở (dự báo cá,
  chợ tin mua bán) và vẫn để phần còn lại của màn đọc được. Cái này khoá CẢ MÀN.
  Giữ cả hai vì hai vai khác nhau — gộp lại thì khối bên trong mất đường nói
  riêng "phần này cần tài khoản" giữa một màn vẫn dùng được.

  ── VÌ SAO CHẶN Ở MÁY CHỨ KHÔNG Ở `middleware.ts` ───────────────────────────
  Chuỗi cứng đăng nhập nằm trong **localStorage** (kho của
  `lib/device-token-store` — tên khoá cố ý KHÔNG chép lại ở đây: cổng
  `identity-gate.test.ts` quét cả comment để bảo đảm chỉ MỘT file được đụng tới
  khoá đó), KHÔNG phải cookie — máy chủ không đọc thấy. Đường
  đăng nhập của app cấp chuỗi rồi `signOut` ngay, nên cũng không có phiên
  Supabase để middleware soi. Chặn ở middleware sẽ đá văng CHÍNH người đã đăng
  nhập. Vỏ này là lớp NHÌN; chốt thật vẫn ở API + RLS như cũ — mỗi route
  `/api/*` tự kiểm chuỗi, khoá UI không thay được việc đó.

  ── NGOÀI BIỂN MẤT SÓNG ─────────────────────────────────────────────────────
  Dùng đúng `signedIn` của `useAuthUser` (chủ dự án: *"token có logic token
  rồi"* — không đẻ luật thứ hai): `!!user || hasToken`. Chuỗi nằm sẵn trong máy
  nên mất sóng nhiều ngày vẫn vào được — chặn giữa biển là chặn đúng lúc bà con
  cần bản đồ và cảnh báo ranh giới nhất.
*/
export function RequireLogin({
  /** Tên phần đang khoá, lời thường — vd "bản đồ ngư trường" */
  what,
  children,
}: {
  what: string;
  children: React.ReactNode;
}) {
  const { signedIn, ready } = useAuthUser();

  /*  ĐANG KIỂM THÌ CHƯA NÓI GÌ VỀ QUYỀN — nháy thẻ khoá rồi mở ra là nói với
      người đã có tài khoản rằng họ chưa có.

      Nhưng ĐỪNG vẽ `null` (bản cũ tới 2026-09-04). Cổng này bọc CẢ MÀN của
      bốn tab; một nhịp `ready` hụt là bà con nhìn thấy MÀN TRẮNG TRƠN cùng
      cái dock — không chữ, không nút, không biết máy đang làm gì hay đã hỏng
      (đúng ảnh báo về từ hiện trường: iPhone 12, trắng bóc). Một dòng chữ tốn
      không đáng bao nhiêu, mà nó là khác biệt giữa "máy đang mở" và "máy chết".
      `role="status"` để trình đọc màn hình cũng nghe được. */
  if (!ready)
    return (
      <p
        role="status"
        className="mt-10 text-center text-[1.125rem] font-semibold text-foreground/60"
      >
        Đang mở…
      </p>
    );
  if (signedIn) return <>{children}</>;

  return (
    <div className="mx-auto mt-6 max-w-[26rem] px-4">
      <div className="surface px-5 py-8 text-center">
        <span
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-t1-bg text-t1"
          aria-hidden
        >
          <LockIcon className="h-7 w-7" />
        </span>
        <p className="display mt-3 text-[1.125rem] font-bold leading-snug text-navy">
          Cần tài khoản để mở {what}
        </p>
        {/*  CÂU CẤP DỮ LIỆU: nói THẲNG bước kế. Người ngoài nay tự tạo tài khoản
             được bằng SĐT — không còn phải gọi SDVICO trước. */}
        <p className="mx-auto mt-1 max-w-[34ch] text-[1rem] leading-snug text-foreground/70">
          Tạo nhanh bằng số điện thoại, hoặc đăng nhập nếu đã có.
        </p>
        <div className="mt-4 flex flex-col items-center gap-2">
          {/*  NÚT CHÍNH DUY NHẤT CỦA MÀN ⇒ được phép full-width (ngoại lệ đã
               chốt ở 03-design-system §Nút hành động mục 0). */}
          <Link
            href="/dang-ky"
            className="display flex min-h-[3.5rem] w-full max-w-[17.5rem] items-center justify-center rounded-full bg-trim text-[1.125rem] font-bold text-white shadow-trim-cta transition active:scale-[0.98]"
          >
            Đăng ký
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-[3.5rem] items-center px-2 text-[1rem] font-bold text-sea"
          >
            Đã có tài khoản — Đăng nhập
          </Link>
        </div>
      </div>
    </div>
  );
}
