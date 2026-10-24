-- 0069 — KAIROS CẢM XÚC KIỂU FACEBOOK (2026-10-24, anh Long: "cho các icon cảm xúc tương tự fb ấy").
-- Chỉ CỘNG THÊM: cột `kind` cho hai bảng Hay; lượt cũ = 'hay' (👍). Một người một cảm xúc / bài|bình luận (PK cũ
-- giữ nguyên) — đổi cảm xúc là UPDATE kind, tổng hay_count (trigger insert/delete) không đổi. Không đụng RLS
-- (bảng vẫn revoke all, chỉ route server ghi). Chạy lại an toàn.

alter table public.kairos_post_hay
  add column if not exists kind text not null default 'hay';
alter table public.kairos_comment_hay
  add column if not exists kind text not null default 'hay';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'kairos_post_hay_kind_chk') then
    alter table public.kairos_post_hay
      add constraint kairos_post_hay_kind_chk check (kind in ('hay','thuong','haha','wow','buon','gian'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'kairos_comment_hay_kind_chk') then
    alter table public.kairos_comment_hay
      add constraint kairos_comment_hay_kind_chk check (kind in ('hay','thuong','haha','wow','buon','gian'));
  end if;
end $$;
