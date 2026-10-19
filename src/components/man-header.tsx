/*
  ĐẦU MÀN GỌN, NỀN SÁNG — một khuôn cho các màn của dock (2026-10-19, rà design
  Codex: "bỏ các khối tiêu đề lớn"). Thay hero `PageHeader` cũ ở Trang chủ, Tàu
  tôi, Chợ cá: gradient navy cao ~330px + nhãn IN HOA giãn chữ (mất dấu tiếng
  Việt, ăn 40% màn trước khi thấy việc). Tiêu đề navy 1.5rem, chữ phụ 1.125rem,
  chỗ bên phải cho MỘT nút (vd chip tài khoản ở Trang chủ).

  `compact` (Trang chủ, chủ dự án chốt 2026-10-19 sau kiểm ảnh): tiêu đề 1.25rem
  và KHÔNG xuống dòng — đo 390/360: "Chào bà con" 1.5rem = 143px + chip tài
  khoản có SĐT 214px không đủ một hàng (358/328px), dòng chào vỡ thành "Chào bà
  / con". Tiêu đề giữ nguyên bề ngang, chip (min-w-0, truncate) là thứ nhường.
*/
export function ManHeader({
  title,
  sub,
  right,
  compact = false,
}: {
  title: React.ReactNode;
  sub?: string;
  right?: React.ReactNode;
  /** Tiêu đề 1.25rem, không xuống dòng — cho màn có chip bên phải rộng (Trang chủ). */
  compact?: boolean;
}) {
  return (
    <header className="px-4 pb-2" style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}>
      <div className={`flex min-h-[3.5rem] items-center ${compact ? "gap-2" : "gap-3"}`}>
        <h1
          className={`display font-bold leading-tight text-navy ${
            compact ? "grow whitespace-nowrap text-[1.25rem]" : "min-w-0 flex-1 text-[1.5rem]"
          }`}
        >
          {title}
        </h1>
        {right}
      </div>
      {sub && <p className="text-[1.125rem] leading-snug text-foreground/75">{sub}</p>}
    </header>
  );
}
