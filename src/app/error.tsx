"use client";

import Link from "next/link";

/*
  LƯỚI AN TOÀN CUỐI CÙNG cho lỗi vẽ màn phía máy (soát offline 2026-08-02).

  Trước file này repo KHÔNG có error.tsx / global-error.tsx ở bất kỳ đâu, nên
  MỌI lỗi render client rơi vào trang lỗi mặc định của Next: chữ tiếng Anh,
  không nút thử lại, không đường về. Giữa biển thì đó là ngõ cụt — bà con chỉ
  còn cách tắt app, mà tắt xong mở lại vẫn vào đúng màn đang lỗi.

  Ở đây: nói bằng lời của bà con, một nút MỞ LẠI (reset() dựng lại cây React,
  KHÔNG tải lại trang nên không cần sóng) và một đường về Trang chủ.
  Tap target ≥56px, chữ ≥18px (03-design-system).
*/
export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-md px-5 py-12 text-center">
      <h1 className="text-[1.5rem] font-bold leading-tight text-navy">
        Màn hình này đang trục trặc
      </h1>
      <p className="mt-3 text-[1.125rem] leading-relaxed text-foreground/75">
        Dữ liệu bà con đã lưu trong máy vẫn còn nguyên. Bấm Mở lại giúp nhé —
        không cần sóng.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-7 min-h-[56px] w-full rounded-2xl bg-sea px-6 text-[1.125rem] font-bold text-white"
      >
        Mở lại
      </button>
      <Link
        href="/"
        className="mt-3 flex min-h-[56px] w-full items-center justify-center rounded-2xl border border-line text-[1.125rem] font-bold text-navy"
      >
        Về Trang chủ
      </Link>
    </div>
  );
}
