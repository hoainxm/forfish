/*
  ĐẦU MÀN GỌN, NỀN SÁNG — một khuôn cho các màn của dock (2026-10-19, rà design
  Codex: "bỏ các khối tiêu đề lớn"). Thay hero `PageHeader` cũ ở Trang chủ, Tàu
  tôi, Chợ cá: gradient navy cao ~330px + nhãn IN HOA giãn chữ (mất dấu tiếng
  Việt, ăn 40% màn trước khi thấy việc). Tiêu đề navy 1.5rem, chữ phụ 1.125rem,
  chỗ bên phải cho MỘT nút (vd chip tài khoản ở Trang chủ).
*/
export function ManHeader({
  title,
  sub,
  right,
}: {
  title: React.ReactNode;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="px-4 pb-2" style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}>
      <div className="flex min-h-[3.5rem] items-center gap-3">
        <h1 className="display min-w-0 flex-1 text-[1.5rem] font-bold leading-tight text-navy">{title}</h1>
        {right}
      </div>
      {sub && <p className="text-[1.125rem] leading-snug text-foreground/75">{sub}</p>}
    </header>
  );
}
