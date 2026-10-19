/*
  ĐẦU MÀN GỌN, NỀN SÁNG — một khuôn cho các màn của dock (2026-10-19, rà design
  Codex: "bỏ các khối tiêu đề lớn"). Thay hero `PageHeader` cũ ở Trang chủ, Tàu
  tôi, Chợ cá: gradient navy cao ~330px + nhãn IN HOA giãn chữ (mất dấu tiếng
  Việt, ăn 40% màn trước khi thấy việc). Tiêu đề navy 1.5rem, chữ phụ 0.875rem.

  HAI CHỖ, HAI VAI (rà design Codex lần 2, 2026-10-19):
  - `right` = MỘT nút hành động ngắn (vd "Tài khoản"). KHÔNG đặt thông báo/thẻ ở
    đây — hàng tiêu đề là flex một hàng, thẻ chữ dài bị ép vỡ 13 dòng (lỗi thật:
    thẻ "đăng nhập ở máy khác" từng nằm cạnh "Chào bà con").
  - Thông báo trạng thái đặt NGOÀI header, đầu thân màn, nguyên bề ngang.

  `compact` giữ cho tương thích: tiêu đề 1.25rem không xuống dòng. Trang chủ thôi
  dùng từ khi chip tài khoản chỉ còn nhãn cố định 2 chữ.
*/
export function ManHeader({
  title,
  sub,
  right,
  compact = false,
}: {
  title: React.ReactNode;
  sub?: string;
  /** MỘT nút ngắn bên phải. Không đặt thẻ/thông báo vào đây. */
  right?: React.ReactNode;
  /** Tiêu đề 1.25rem, không xuống dòng. */
  compact?: boolean;
}) {
  return (
    <header className="px-4 pb-1" style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))" }}>
      <div className={`flex min-h-[3.5rem] items-center ${compact ? "gap-2" : "gap-3"}`}>
        <h1
          className={`display font-bold leading-tight text-navy ${
            compact ? "grow whitespace-nowrap text-[1.25rem]" : "min-w-0 flex-1 text-[1.5rem]"
          }`}
        >
          {title}
        </h1>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      {sub && <p className="text-[0.875rem] leading-snug text-foreground/65">{sub}</p>}
    </header>
  );
}
