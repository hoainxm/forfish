-- SDFish — MẪU CÂU NÓI SEN BIỂN để huấn luyện bản sau (2026-10-18, chủ dự án: "làm đi cái
-- phần thu thập để nâng cấp mô hình sau khi sử dụng, đảm bảo mô hình luôn thông minh").
--
-- Máy ghi từng câu bà con nói với Sen Biển (chữ bộ nghe ra + máy hiểu thành việc gì + Gemma
-- đoán gì), cất trong máy, có sóng thì gửi lô qua POST /api/sen-bien/mau (service-role ghi).
-- Script scripts/sen-bien-keo-mau.mjs kéo về kho huấn luyện.
--
-- RIÊNG TƯ: KHÔNG tiếng thu, KHÔNG vị trí, KHÔNG SĐT. `nguoi` = SHA-256(pepper + "senbien:" +
-- SĐT) — chỉ để gỡ mẫu của một người hoặc bỏ lô rác của một máy. RLS bật, KHÔNG policy cho
-- anon/authenticated ⇒ chỉ service-role đọc/ghi.
--
-- ⚠️ KHÔNG tự apply lên prod — bước duyệt riêng (ref znzgugvfhgmiszqgjulk).

create table if not exists public.sen_bien_mau (
  id        text primary key,               -- máy sinh (uuid) ⇒ gửi lại không nhân đôi
  noi_luc   timestamptz not null,           -- lúc bà con nói (giờ máy)
  nhan_luc  timestamptz not null default now(),
  phien     text not null,                  -- một lần mở Sen Biển — ghép cặp câu nói lại
  cau       text not null check (char_length(cau) between 1 and 200),
  tra       text not null,                  -- go/pick/start/stop/cancel/mute/unmute/repeat/howfar/hoi/map/say
  ct        text,                           -- chi tiết: ý n-gram / loại câu hỏi / việc bản đồ / số chỗ
  gemma     text,                           -- ý Gemma đoán (Android), null = không có
  xn        boolean not null default false, -- đang chờ "đi"
  chay      boolean not null default false, -- đang dẫn đường
  nen       text not null default '?',      -- android / web / ios
  ban       text not null default '',       -- mã bản app
  nguoi     text                            -- dấu người nói (băm có pepper), không phải SĐT
);

create index if not exists sen_bien_mau_nhan_luc_idx on public.sen_bien_mau (nhan_luc);
create index if not exists sen_bien_mau_nguoi_idx on public.sen_bien_mau (nguoi);

alter table public.sen_bien_mau enable row level security;
