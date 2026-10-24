-- 0070 — KAIROS BÌNH LUẬN CÓ ẢNH + XEM TRƯỚC LINK kiểu Facebook (2026-10-24, anh Long gửi ảnh FB:
-- ô bình luận có nút máy ảnh, bình luận dán link hiện thẻ xem trước).
-- Chỉ CỘNG THÊM hai cột cho kairos_comments; không đụng RLS (bảng vẫn revoke all, chỉ route server ghi).
--   · image_path   — MỘT ảnh/bình luận, đường kho kairos-media '<profileId>/<uuid>.<ext>' (route kiểm ảnh
--                    nằm trong thư mục của chính người viết, như ảnh bài).
--   · link_preview — thẻ xem trước link đầu tiên trong chữ {url, site, title, image} — máy chủ đọc trang
--                    LÚC GHI (đồng hồ 3 s, lỗi ⇒ null), người đọc không gọi mạng ra ngoài.
-- Bình luận chỉ có ảnh (không chữ) được phép: ràng buộc chữ 1–1.000 cũ thay bằng "≤1.000 VÀ (có chữ HOẶC có ảnh)".
-- Chạy lại an toàn.

alter table public.kairos_comments
  add column if not exists image_path text,
  add column if not exists link_preview jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'kairos_comments_image_path_chk') then
    alter table public.kairos_comments
      add constraint kairos_comments_image_path_chk
      check (image_path is null or image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$');
  end if;
  if exists (select 1 from pg_constraint where conname = 'kairos_comments_body_check') then
    alter table public.kairos_comments drop constraint kairos_comments_body_check;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'kairos_comments_body_chk') then
    alter table public.kairos_comments
      add constraint kairos_comments_body_chk
      check (char_length(body) <= 1000 and (char_length(btrim(body)) >= 1 or image_path is not null));
  end if;
end $$;

-- ảnh đang dùng (mediaInUse: dọn ảnh mồ côi không được xoá ảnh của bình luận)
create index if not exists kairos_comments_image_idx on public.kairos_comments (image_path) where image_path is not null;
