import { MarketHeader } from "@/components/market/shared/market-header";

/**
 * Đầu màn PHỤ ngoài chợ (đăng nhập, đăng ký, đổi/quên mật khẩu, quyền riêng tư, danh bạ cảng).
 *
 * 2026-10-22 (rà bố cục, theo app đông người dùng): KHÔNG còn dải gradient bo đáy + nhãn nhỏ
 * trên tiêu đề ("Tài khoản", "Thông tin pháp lý" — kiểu Impeccable/Taste cấm) + tiêu đề 28px.
 * Nay dựng trên thanh sáng chung `MarketHeader` ([‹] + tiêu đề 20px) + một dòng mô tả,
 * lề 16px như mọi màn. `kicker`/`toColor` giữ trong props cho nơi gọi cũ, không còn vẽ.
 */
export function PageHeader({
  title,
  sub,
  fallback = "/",
  children,
}: {
  /** nhãn nhỏ trên tiêu đề — KHÔNG còn vẽ (2026-10-22) */
  kicker?: string;
  title: React.ReactNode;
  sub?: string;
  /** màu gradient cũ — KHÔNG còn dùng (2026-10-22) */
  toColor?: string;
  /** về đâu khi không có trang trước */
  fallback?: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      <MarketHeader title={title} fallback={fallback} />
      {(sub || children) && (
        <div className="px-4">
          {sub && (
            <p className="max-w-[40ch] text-[0.9375rem] leading-snug text-foreground/70">{sub}</p>
          )}
          {children}
        </div>
      )}
    </>
  );
}
