"use client";

/*
  LƯỚI AN TOÀN CHO LỖI Ở TẦNG GỐC — bù đúng chỗ `error.tsx` với KHÔNG tới.

  Next chia hai loại boundary:
   · `src/app/error.tsx` bắt lỗi render của các TRANG nằm DƯỚI root layout.
   · `src/app/global-error.tsx` (file này) bắt lỗi ném từ CHÍNH `layout.tsx` gốc
     và các component mount thẳng trong đó (AppShell, SwRegister, UsageHeartbeat,
     ViewportGapFix). error.tsx không với tới vùng này.

  VÌ SAO CẦN (soát 2026-09-06 — màn trắng iPhone 12 iOS cũ): khi một component ở
  tầng gốc CRASH lúc mở app (điển hình: một tính năng runtime Safari đời cũ chưa
  có), repo TRƯỚC file này KHÔNG có boundary nào đỡ ⇒ Next trả về màn TRẮNG CÂM,
  không một dòng chữ. Bà con thoát ra vào lại vẫn trắng, tưởng app hỏng hẳn.
  Nếu crash ở TRANG (vd /login) thì error.tsx đã hiện trang lỗi thân thiện; trắng
  câm nghĩa là crash ở tầng gốc — đúng vùng file này phủ.

  global-error.tsx THAY luôn root layout khi nổ nên phải tự dựng <html>/<body>.
  Nói bằng lời bà con, nút MỞ LẠI (reset() dựng lại cây React, KHÔNG tải lại
  trang nên không cần sóng) là hành động chính; nếu vẫn trắng thì mới gợi ý cập
  nhật iOS/trình duyệt (chính là cách đã giúp máy iPhone 12 vào lại được).
  Tap ≥56px, chữ ≥18px (03-design-system). Không request mạng, không đụng kho —
  an toàn offline tuyệt đối.
*/
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="vi">
      <body className="min-h-full">
        <div className="mx-auto max-w-md px-5 py-12 text-center">
          <h1 className="text-[1.5rem] font-bold leading-tight text-navy">
            App đang trục trặc
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
          <button
            type="button"
            onClick={() => {
              try {
                window.location.reload();
              } catch {
                /* không reload được thì thôi — nút Mở lại ở trên vẫn còn */
              }
            }}
            className="mt-3 flex min-h-[56px] w-full items-center justify-center rounded-2xl border border-line text-[1.125rem] font-bold text-navy"
          >
            Tải lại trang
          </button>
          <p className="mt-6 text-[1rem] leading-relaxed text-foreground/60">
            Nếu mở lại mà màn hình vẫn trắng, mời bà con cập nhật iOS (hoặc trình
            duyệt) lên bản mới nhất rồi mở lại app.
          </p>
        </div>
      </body>
    </html>
  );
}
