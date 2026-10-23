# 14 — BA-SPEC KAIROS (đọc báo + mạng xã hội của bà con)

> **Load khi**: đụng tab Kairos — dòng tin, bài báo tóm tắt, đăng bài, Hay, bình luận, chia sẻ, tên gọi, theo dõi, Bến, báo xấu, quản trị Kairos, thu tin trên máy GPU, khoá `forfish.kairos.*`. **Nguồn đúng duy nhất** cho agent build; lệch với [research 4 khu §3.3](../research/kien-truc-moi-4-khu-2026-10-20.md) (route `/tin`, không bình luận bài báo, duyệt tay) thì file này thắng.

Chốt 2026-10-23. Kairos (καιρός) = đúng thời điểm.

## 1. Mục tiêu

1. Bà con **khỏi mở app báo khác**: tin 5 báo, AI tóm tắt 2–3 câu, nghề cá ưu tiên, có link gốc.
2. **Mạng xã hội nhỏ kiểu Facebook**: đăng chữ + ảnh, Hay, bình luận dưới mọi bài (cả bài báo), chia sẻ, tên gọi, theo dõi, nhóm theo cảng ("Bến").
3. **Đọc được khi mất sóng**, không gửi ngầm.

**Không làm**: bản tin thời tiết/bão (đã có `/api/storms`; chỉ lấy *bài báo* như cấm biển, cứu nạn) · DataLake nhà nước · nhắn riêng · nhiều kiểu cảm xúc · điểm "hot" · realtime.

**Từ Forlife** chỉ học khung đăng, nén ảnh, bảng chia sẻ, ảnh đại diện chữ cái.

## 2. Người dùng

| Ai | Định danh | Được làm |
|---|---|---|
| Khách | không chuỗi thiết bị | đọc dòng tin, bài, bình luận, trang người dùng, Bến, `/k/[id]`; bấm ghi ⇒ mời đăng nhập (401) |
| Bà con có SĐT | `identityFromRequest` | + đăng/sửa/xoá bài mình, Hay, bình luận, chia sẻ, tên gọi, theo dõi, chặn, báo xấu |
| SDVICO | tài khoản quản trị | đăng bài **Chính thức**, ghim; tên cố định "SDVICO" + dấu Chính thức |
| Người trực | `staff_accounts`, quyền tab `kairos` | báo xấu, ẩn/hiện, cấm SĐT, cờ chủ quyền, nhật ký |

## 3. Màn hình và luồng

### 3.1 Dock (AC01)
6 ô **chỉ icon** (nhãn trong `aria-label`, từ `labels.ts`): Trang chủ · Kairos · Bản đồ · Tàu tôi · Chợ cá · Vật tư. `DockId` thêm `"kairos"` (`/kairos`, khu `/kairos` + `/k`).

### 3.2 `/kairos` — dòng tin (AC02–AC06)
`ManHeader` "Kairos" · **ô mời** "Bà con có chuyện gì?" · **hàng chip** cuộn ngang · dải **ghim** (Chính thức còn `pinned_until`) · dòng tin một cột cuộn vô tận (cursor 20 bài, skeleton 3 thẻ).

**Chip** (nhãn vào `labels.ts`): Mới · Nghề cá · Cảng tôi · Gần tôi · Theo dõi · Thời sự · Pháp luật · Đời sống · Thể thao · Giải trí · Kinh tế. "Mới" luôn đầu; còn lại xếp theo số lần bấm (`forfish.kairos.thoiquen.v1`). Cảng tôi = bài gắn cảng nhà; Gần tôi = tỉnh hoặc vùng biển nhà; Theo dõi = bài người mình theo dõi. Chưa có cảng nhà ⇒ chip mở hộp chọn cảng.

**Thẻ bài 3 loại** — chung khung, khác đầu thẻ:

| `kind` | Đầu thẻ | Thân | Chân |
|---|---|---|---|
| `bao` | tên báo + giờ + chủ đề | tiêu đề + tóm tắt + ảnh bìa (link ảnh RSS) | **Đọc bài gốc** · Hay · Bình luận · Chia sẻ |
| `chinh-thuc` | "SDVICO" + **Chính thức** + dấu ghim | chữ + ≤5 ảnh | Hay · Bình luận · Chia sẻ |
| `ba-con` | ảnh đại diện + tên gọi + dòng phụ + giờ | chữ (cắt 6 dòng, Xem thêm) + lưới ≤5 ảnh + thẻ bài gốc nếu đăng lại | Hay · Bình luận · Chia sẻ · ba chấm (Sửa/Xoá hoặc Báo xấu/Chặn) |

Dưới chân: số Hay, "Xem N bình luận", **2 bình luận nhiều Hay nhất**.

**Xếp bài** (AC04, thuần, trong máy): máy chủ trả theo `published_at desc`; app xếp lại **trong từng trang** bằng độ mới + chủ đề hay đọc + trùng cảng/tỉnh/vùng nhà; ghim luôn trên. Hồ sơ đọc **không gửi đi** (Cảng tôi/Gần tôi chỉ gửi mã cảng/tỉnh làm bộ lọc).

**Có N bài mới** (AC06): khi quay lại màn (`visibilitychange`) hoặc `online`, gọi `new-count?since=` (đồng hồ 8 s, `.catch`); N>0 ⇒ thanh đầu dòng tin, chạm ⇒ tải lại trang đầu. Không tự chèn bài.

### 3.3 Khung soạn (AC07, AC08)
Bottom sheet: chữ ≤2.000 ký tự (đếm lùi khi còn ≤200) · `ImagePicker` ≤5 ảnh, nén `market/image-resize.ts`, tải từng ảnh qua `POST /api/kairos/upload` ngay khi chọn (lỗi ⇒ Thử lại từng ảnh) · chủ đề (mặc định Nghề cá) · cảng điền sẵn cảng nhà · **Đăng**. Lần đầu: **nội quy** 5 dòng + Đồng ý (lưu `rules_accepted_at`). Mất sóng: Đăng xám "Cần sóng", chữ vào nháp, có sóng lại **không** tự gửi. Sửa: mở lại khung, thẻ hiện "đã sửa". Xoá: `ConfirmDialog` ⇒ xoá bài, bình luận, Hay **và ảnh trong kho**.

### 3.4 Bình luận (AC10)
`/kairos/p/[id]`: bài + bình luận (cursor 30), trả lời **1 cấp** (trả lời một trả lời ⇒ gắn vào bình luận gốc kèm "@tên"), ≤1.000 ký tự, nháp chữ, xoá của mình (xác nhận inline). Thông báo chủ bài (bình luận mới) và chủ bình luận (trả lời) qua `notifyAccount`, **gộp 1 tin/bài/người nhận/giờ** ("Có 3 bình luận mới ở bài của bạn"); không tự báo mình.

### 3.5 Chia sẻ (AC11)
`BottomSheet` 4 việc: **Đăng lại** (khung soạn kèm thẻ bài gốc + lời mình) · **Gửi đi** (`navigator.share` link `/k/[id]`, không có ⇒ chép) · **Chép link** · **Tải ảnh** (khi bài có ảnh).

### 3.6 `/k/[id]` công khai (AC11)
Server render, không cần đăng nhập: tên báo/tên gọi, chữ, ảnh, số Hay, 2 bình luận đầu, nút **Cài app**, thẻ `og:*` cho Zalo. Không SĐT, không nút ghi. Bài ẩn/xoá ⇒ "Bài này không còn".

### 3.7 Tên gọi (AC12)
"Tên trên Kairos" (từ trang người dùng của mình): tên gọi, ảnh đại diện tuỳ chọn, bật/tắt "Hiện số hiệu tàu". Luật `lib/kairos/ten-goi.ts` (thuần, test): 2–20 ký tự; chữ, số, khoảng trắng, `.-_`; **không trùng** theo khoá chuẩn hoá (thường + bỏ dấu + gộp khoảng trắng); cấm tên báo, cơ quan nhà nước (Bộ, Sở, UBND, Cục, Biên phòng, Kiểm ngư, Cảnh sát biển, Công an, Hải quân…), SDVICO, SDFish, ForFish, Kairos, Quản trị; cấm chữ bậy; đổi **1 lần/30 ngày** (lần đặt đầu không tính). Mặc định: `customers.name` nếu hợp lệ và chưa ai dùng, không thì "Bà con " + 4 số cuối (trùng ⇒ thêm số). **Dòng phụ**: "Cảng X" hoặc tên cơ sở bên mua. Ảnh mặc định = chữ cái đầu trên nền token `--kairos-av-1..6` theo băm id.

### 3.8 Trang người dùng `/kairos/u/[id]` (AC13)
`[id]` = `kairos_profiles.id` (uuid, **không SĐT**): ảnh, tên, dòng phụ, số bài, **Theo dõi / Đang theo dõi** (một chiều), danh sách bài. Của mình: nút Sửa. Người đã chặn: "Bạn đã chặn người này" + Bỏ chặn.

### 3.9 Bến `/kairos/ben/[port]` (AC14)
`[port]` = `id` trong `src/data/fishing-ports.ts`; mỗi cảng tự là một nhóm. Tên cảng + tỉnh, dòng tin lọc `ports @> {port}`, ô mời đăng **thẳng vào Bến**. Mã lạ ⇒ "Không tìm thấy".

### 3.10 Báo xấu, chặn (AC15)
**Báo xấu**: lý do sẵn (Lừa đảo · Bậy bạ · Sai sự thật · Xúc phạm · Quảng cáo · Khác + ≤200 ký tự), một người một đích một lần. **Chặn**: ẩn mọi bài + bình luận người đó với mình (lọc ở máy chủ). Lọc chữ bậy `lib/kairos/loc-chu.ts` (thuần, test) chạy **ở route** khi ghi bài/bình luận/tên ⇒ 400 `bad_words`.

### 3.11 Quản trị — tab "Kairos" (AC16)
`AdminTab "kairos"`, nhóm **Nội dung**. Bốn mục: **Báo xấu** (xếp theo số lượt; Ẩn / Bỏ qua / Cấm người đăng) · **Bài** (tìm, Ẩn/Hiện bài và bình luận) · **Chính thức** (soạn bài SDVICO, Ghim tới ngày / Bỏ ghim) · **Cờ chủ quyền** (bài bị loại + cụm trúng, chỉ xem). Cấm: 7 ngày / 30 ngày / vĩnh viễn + lý do; bị cấm vẫn đọc, ghi ⇒ 403 `banned`. Quyền: admin đủ; quản lý qua `staff-permissions` (`ManagerTab "kairos"`, `can()`: view = xem, edit = ẩn/hiện/ghim, delete = cấm, create = đăng chính thức). Mọi thao tác ghi `kairos_audit`.

## 4. Gắn khu vực (AC05)

`lib/kairos/khu-vuc.ts` (thuần, test): chữ ⇒ `{regions[], provinces[], ports[]}`, so khớp không dấu, không hoa, theo ranh giới từ.
- **Tỉnh**: 34 tỉnh/thành sau sáp nhập 2025; tên cũ quy về tên mới (Bình Thuận ⇒ Lâm Đồng, Quảng Bình ⇒ Quảng Trị, Kiên Giang ⇒ An Giang, Bà Rịa – Vũng Tàu ⇒ TP Hồ Chí Minh, Bình Định ⇒ Gia Lai, Phú Yên ⇒ Đắk Lắk, Ninh Thuận ⇒ Khánh Hòa, Quảng Nam ⇒ Đà Nẵng, Bạc Liêu ⇒ Cà Mau, Bến Tre/Trà Vinh ⇒ Vĩnh Long, Tiền Giang ⇒ Đồng Tháp, Sóc Trăng ⇒ Cần Thơ, Thái Bình ⇒ Hưng Yên, Nam Định ⇒ Ninh Bình…).
- **Cảng**: tên trong `fishing-ports.ts` (≥2 tiếng, hoặc có "cảng"/"cửa" đứng trước).
- **Vùng biển**: Vịnh Bắc Bộ · Miền Trung · Đông Nam Bộ · Tây Nam Bộ · Hoàng Sa–Trường Sa — suy từ tỉnh/cảng ven biển + từ khoá ("vịnh Bắc Bộ", "Hoàng Sa", "Trường Sa", "Song Tử", "Sinh Tồn", "Nam Yết", "DK1"…).
- Không trúng ⇒ `["ca-nuoc"]` (hiện "Cả nước"). Bài bà con: cảng chọn + luật trên thân bài.

## 5. Chủ quyền (AC18)

`lib/kairos/chu-quyen.ts` (thuần, test chuỗi) trả `null` hoặc cụm trúng: "South China Sea"; "Nam Hải" chỉ Biển Đông (có ngoại lệ tên riêng trong nước); "Tây Sa", "Nam Sa", "Tam Sa", "Xisha", "Nansha", "Sansha"; "Paracel"/"Spratly" cùng câu có China/Chinese/Trung Quốc theo nghĩa sở hữu. Kiểm **bài vào** (tiêu đề + mô tả) và **tóm tắt ra**; trúng ⇒ không lên dòng tin, ghi `kairos_seen` (`loai-chu-quyen` + cụm). Prompt bắt buộc "Biển Đông" và "quần đảo Hoàng Sa, Trường Sa của Việt Nam". Bài/bình luận bà con cũng kiểm ở route ⇒ 400 `sovereignty`.

## 6. Mô hình dữ liệu — `0065_kairos.sql` (AC20)

Khuôn 0063: mỗi bảng `enable row level security` + `revoke all … from anon, authenticated`, không policy, mọi đọc/ghi qua route service-role. SĐT `text` đã `normalizeVnPhone`, **không ra client**. Không áp remote khi anh Long chưa duyệt.

| Bảng | Cột chính | Ràng buộc / chỉ mục |
|---|---|---|
| `kairos_profiles` | `id uuid pk` (công khai) · `phone unique` · `handle` · `handle_norm unique` · `handle_changed_at` · `avatar_path` · `show_boat` · `official` · `rules_accepted_at` · `banned_until` · `ban_reason` · `created_at` | handle 2–20 ký tự |
| `kairos_sources` | `id text pk` · `outlet` · `feed_url` · `section` · `topic` · `enabled` · `last_ok_at` · `last_error` | |
| `kairos_posts` | `id uuid` · `kind` (`bao`/`chinh-thuc`/`ba-con`) · `author_phone` · `source_id` · `outlet` · `url` · `url_hash unique` · `title` · `title_norm` · `body` ≤2000 · `summary` · `summary_by` (`ai`/`rss`) · `cover_url` · `images jsonb` ≤5 · `topic` · `regions[]` · `provinces[]` · `ports[]` · `reshare_of` · `pinned_until` · `hidden` · `hidden_reason` · `hay_count` · `comment_count` · `published_at` · `created_at` · `edited_at` | idx `(published_at desc, id)`; GIN `ports/provinces/regions`; idx `(author_phone, created_at)` |
| `kairos_comments` | `id` · `post_id` fk cascade · `parent_id` (1 cấp, trigger kiểm) · `author_phone` · `body` ≤1000 · `hay_count` · `hidden` · `created_at` | idx `(post_id, hay_count desc)` |
| `kairos_post_hay` | `post_id` fk cascade · `phone` · `created_at` | **pk `(post_id, phone)`** |
| `kairos_comment_hay` | `comment_id` fk cascade · `phone` · `created_at` | **pk `(comment_id, phone)`** |
| `kairos_follows` | `follower_phone` · `followee_phone` · `created_at` | pk cặp, check khác nhau |
| `kairos_blocks` | `blocker_phone` · `blocked_phone` · `created_at` | pk cặp |
| `kairos_reports` | `id` · `target_type` (`post`/`comment`) · `target_id` · `reporter_phone` · `reason` · `note` ≤200 · `status` (`moi`/`da-an`/`bo-qua`) · `handled_by` · `handled_at` · `created_at` | unique `(target_type, target_id, reporter_phone)` |
| `kairos_seen` | `url_hash pk` · `title_norm` · `source_id` · `outcome` (`nhan`/`trung-tieu-de`/`loai-chu-quyen`/`loi`) · `flag_term` · `first_seen_at` | idx `(title_norm, first_seen_at)` |
| `kairos_notify_marks` | `post_id` · `phone` · `last_at` | pk cặp (gộp 1 giờ) |
| `kairos_audit` | `id bigserial` · `actor` · `actor_kind` (`ba-con`/`staff`/`he-thong`) · `action` · `target_type` · `target_id` · `detail jsonb` · `ip` · `at` | giữ ≥2 năm |

`hay_count`/`comment_count` đếm bằng trigger (0064). Bucket **`kairos-media`**: public đọc, 512 KB, jpeg/png/webp, đường `<profileId>/<uuid>.jpg`. Demo mode: kho file dev theo khuôn `MarketStore` file-store.

## 7. Route API

Ghi: `identityFromRequest(req)` (401 chưa đăng nhập, 503 không tra được), validate body, lọc chữ bậy + chủ quyền, kiểm `banned_until` (403), giới hạn tần suất (A1). Đọc: `identityFromRequest(req, true)`. Không trả `phone`; tác giả = `{profileId, handle, subline, avatarUrl, official, boatReg?}`. Không vào `API_CACHE_ALLOW` của sw.js (gắn danh tính).

| Method | Đường | Quyền | Giới hạn / ghi chú |
|---|---|---|---|
| GET | `/api/kairos/feed?cursor=&chip=&port=&province=&author=` | khách | 20 bài/trang, kèm top 2 bình luận; `chip=theo-doi` cần SĐT |
| GET | `/api/kairos/new-count?since=` | khách | `{n}` ≤99 |
| GET | `/api/kairos/posts/[id]` | khách | bài + cursor bình luận |
| POST | `/api/kairos/posts` | SĐT | 10/ngày; chưa đồng ý nội quy ⇒ 409 `rules` |
| PATCH · DELETE | `/api/kairos/posts/[id]` | chủ bài | DELETE xoá ảnh kho trước; lỗi kho ⇒ 500, không xoá nửa vời |
| POST | `/api/kairos/upload` | SĐT | 1 ảnh ≤512 KB/lượt, 30/ngày |
| GET · POST | `/api/kairos/posts/[id]/comments` | khách · SĐT | 60/ngày |
| DELETE | `/api/kairos/comments/[id]` | chủ bình luận | xoá cả trả lời con |
| PUT | `/api/kairos/posts/[id]/hay` · `/api/kairos/comments/[id]/hay` | SĐT | `{on}` idempotent; 300/giờ |
| POST | `/api/kairos/reports` | SĐT | 20/ngày; trùng ⇒ 200 |
| PUT · DELETE | `/api/kairos/follows/[profileId]` · `/api/kairos/blocks/[profileId]` | SĐT | 100/ngày |
| GET · PATCH | `/api/kairos/me` | SĐT | tên gọi, ảnh, `showBoat`, `acceptRules` |
| GET | `/api/kairos/users/[profileId]` | khách | hồ sơ công khai + bài |
| POST | `/api/kairos/nhap` | `x-kairos-key` = env `KAIROS_INGEST_KEY` (`timingSafeEqual`) | sai khoá 401, thiếu env 503; ≤50 bài/lượt; máy chủ chạy lại chặn trùng + chủ quyền + khu vực |
| GET | `/api/admin/kairos/reports` · `posts?q=` · `flags` | staff view | |
| POST | `/api/admin/kairos/action` | staff theo việc | `{action: hide/unhide/ban/unban/pin/unpin/resolve, targetType, targetId, until?, reason?}` |
| POST | `/api/admin/kairos/official` | staff create | bài Chính thức |

## 8. Khoá `forfish.*` mới (vào `ops/state-registry.md`)

| Khoá | Nội dung | Trần |
|---|---|---|
| `forfish.kairos.v1` | `{bucket, savedAt, posts[]}` ≤200 bài **chỉ chữ**, cách ly ngăn SĐT như `inbox.ts`; writer `lib/kairos/cache.ts` | ~300 KB; vượt ⇒ cắt bài cũ; đầy bộ nhớ ⇒ cắt nửa thử lại; không đụng `forfish.fc.*` |
| `forfish.kairos.thoiquen.v1` | đếm bấm chip, đọc theo chủ đề, cảng/tỉnh/vùng nhà | ≤4 KB, không gửi đi |
| `forfish.kairos.nhap.v1` | nháp bài + nháp bình luận theo `postId`, chỉ chữ | ≤20 nháp |

Đăng xuất ⇒ xoá ngăn SĐT đó + nháp.

## 9. Thu tin trên máy GPU (AC17)

`scripts/kairos-thu.mjs` chạy trên **gpu-desktop** mỗi 15 phút (systemd timer — chỉ viết hướng dẫn ở `ops/runbook.md`):
1. RSS 5 báo, mỗi báo các mục thời sự · thế giới · pháp luật · thể thao · giải trí · sức khoẻ · kinh doanh · đời sống (`scripts/kairos-nguon.json`, cờ tắt từng nguồn): **Nông nghiệp & Môi trường** (thuy-san, bien-dao) · **Thủy sản Việt Nam** · **VnExpress** · **Tuổi Trẻ** · **Thanh Niên**. Đồng hồ 15 s/nguồn.
2. Chuẩn hoá link (bỏ `utm_*`, `#`, `/amp`, http⇒https, host chữ thường) ⇒ `url_hash`; trùng link bỏ **vĩnh viễn**, trùng tiêu đề chuẩn hoá trong **7 ngày** bỏ.
3. Chủ đề theo mục (thuy-san/bien-dao ⇒ Nghề cá, kinh doanh ⇒ Kinh tế, sức khoẻ ⇒ Đời sống, thế giới ⇒ Thời sự) + từ khoá nghề cá (tàu cá, ngư dân, cấm biển, cứu nạn, IUU…) nâng lên Nghề cá; khu vực §4; chủ quyền §5.
4. Gom **20 bài/lượt** gọi `claude -p --model claude-haiku-5-5 --output-format json --max-turns 1`, **cấm công cụ**, **thư mục rỗng**, prompt qua **stdin** (khuôn `AI-Assistant/train/thay/opus.mjs`), đồng hồ 120 s ⇒ JSON `[{i, summary}]` 2–3 câu, không thêm thông tin ngoài bài. Gói Claude của anh Long, không API key.
5. Hết hạn mức / lỗi / JSON hỏng / tóm tắt trúng cờ ⇒ **mô tả RSS gốc** (`summary_by='rss'`, cắt 300 ký tự).
6. `POST /api/kairos/nhap` (khoá ở env máy GPU); lỗi mạng ⇒ hàng đợi file cục bộ, lượt sau gửi.
Phần thuần: `src/lib/kairos/thu-core.mjs` + test.

## 10. Ma trận trạng thái

| Màn | Đang tải | Trống | Lỗi | Mất sóng | Cực đoan |
|---|---|---|---|---|---|
| Dòng tin | skeleton 3 thẻ | "Chưa có bài nào" + ô mời | thẻ lỗi + Thử lại, giữ bài đã hiện | bản lưu + "Lưu lúc HH:mm dd/MM"; không bản lưu ⇒ "Có sóng sẽ tải" | 2.000 ký tự cắt 6 dòng; 99+; tên 20 ký tự cắt "…"; 5 ảnh |
| Theo dõi | skeleton | "Bạn chưa theo dõi ai" | Thử lại | lọc bản lưu | |
| Chi tiết | skeleton | "Chưa có bình luận" | Thử lại | top bình luận đã lưu, ô bình luận "Cần sóng" + nháp | cursor 30 |
| Khung soạn | — | Đăng xám khi rỗng | câu theo mã: `bad_words`, `sovereignty`, `too_long`, `rate_limited`, `banned`, `rules` | Đăng xám + nháp | ảnh lớn ⇒ nén; ảnh thứ 6 ⇒ "Tối đa 5 ảnh" |
| Người dùng / Bến | skeleton | "Chưa có bài" | Thử lại | bản lưu khớp người/cảng | mã lạ ⇒ "Không tìm thấy" |
| Quản trị | skeleton | "Không có báo xấu nào" | Thử lại | — | |

## 11. Pháp lý

Giấy phép trang tổng hợp và mạng xã hội (NĐ 147/2024) là **việc của SDVICO**. App làm đủ **điều kiện kỹ thuật**: chỉ SĐT đã xác thực được ghi; `kairos_audit` ≥2 năm; hàng đợi báo xấu + ẩn 1 chạm để gỡ trong **24 giờ** (yêu cầu cơ quan) / **48 giờ** (báo xấu); bài báo chỉ tóm tắt + link gốc + tên báo; không lộ SĐT. Cờ `app_config.kairos_enabled` để SDVICO bật/tắt tab.

## 12. AC → cách kiểm

| AC | Nội dung (nguyên văn) | Cách kiểm |
|---|---|---|
| AC01 | Dock 6 ô chỉ icon: Trang chủ · Kairos · Bản đồ · Tàu tôi · Chợ cá · Vật tư (src/lib/dock-nav.ts + bottom-nav.tsx + test); nhãn từ labels.ts ≤2 chữ; 07 §4 cập nhật | `dock-nav.test.ts` (6 mục, `dockActive("/kairos/u/x")="kairos"`), `labels.test.ts`; xem dock ở 375 px; grep 07 §4 |
| AC02 | Trang /kairos: dòng tin cuộn vô tận (phân trang cursor), trộn 3 loại bài (báo tóm tắt có tên báo + 'Đọc bài gốc' · SDVICO 'Chính thức' có ghim · bà con), có skeleton, trạng thái trống/lỗi/mất sóng/cực đoan | test cursor (`lib/kairos/cursor.ts`); chạy local kho file với 3 loại bài; giả lập offline/lỗi theo §10 |
| AC03 | Hàng chip ≤2 chữ: Mới · Nghề cá · Cảng tôi · Gần tôi · Theo dõi · Thời sự · Pháp luật · Đời sống · Thể thao · Giải trí · Kinh tế; chip hay bấm tự lên đầu (thói quen lưu trong máy) | `labels.test.ts`; `thoi-quen.test.ts` (xếp chip, "Mới" luôn đầu) |
| AC04 | Xếp bài theo thói quen TRONG MÁY (forfish.kairos.thoiquen.v1): mới + chủ đề hay đọc + cảng/tỉnh/vùng nhà; luật thuần có test; không gửi hồ sơ đọc lên máy chủ | `xep-bai.test.ts`; soi request mạng không có trường thói quen |
| AC05 | Mỗi bài gắn khu vực bằng luật: vùng biển (Vịnh Bắc Bộ · Miền Trung · Đông Nam Bộ · Tây Nam Bộ · Hoàng Sa–Trường Sa) · tỉnh (34 tỉnh sau sáp nhập, nhận cả tên cũ) · cảng (danh mục src/data/fishing-ports.ts); 'Cả nước' khi không rõ; có test | `khu-vuc.test.ts` (đủ 34 tỉnh, tên cũ ⇒ mới, cảng, Hoàng Sa, cả nước) |
| AC06 | 'Có N bài mới' khi quay lại màn/app (không realtime), tự tải lại khi có sóng lại (sự kiện online), mọi fetch có đồng hồ + .catch | đọc code: `timeoutSignal` + `.catch` mọi fetch; thử ẩn/hiện tab, tắt/bật mạng |
| AC07 | Bà con đăng bài: ô mời 'Bà con có chuyện gì?' → khung soạn chữ ≤2.000 ký tự, ≤5 ảnh (nén bằng src/lib/market/image-resize.ts, ImagePicker), chọn chủ đề, cảng tự gắn theo cảng nhà; ảnh tải lên qua route server vào bucket kairos-media; giới hạn số bài/ngày/SĐT | `post-validate.test.ts` (2.001 ký tự, 6 ảnh ⇒ lỗi); thử đăng local; bài thứ 11/ngày ⇒ 429 |
| AC08 | Sửa và xoá bài của mình; xoá bài XOÁ luôn ảnh trong kho; đồng ý nội quy ở lần đăng đầu (đọc không cần) | thử xoá bài có ảnh ⇒ kho không còn file; người khác PATCH/DELETE ⇒ 403; chưa đồng ý ⇒ 409 `rules` |
| AC09 | Nút Hay (một kiểu) trên bài và trên bình luận: bật/tắt, đếm, cập nhật lạc quan, chống bấm trùng ở DB (unique) | pk `(post_id, phone)` trong 0065; gọi PUT `on:true` hai lần ⇒ đếm 1; lỗi mạng ⇒ đếm trả lại |
| AC10 | Bình luận dưới MỌI bài kể cả bài báo: trả lời 1 cấp, hiện sẵn 2 bình luận nhiều Hay nhất, 'Xem N bình luận', xoá bình luận của mình; thông báo cho chủ bài/chủ bình luận khi có người trả lời (dùng hạ tầng thông báo sẵn có, gộp theo bài) | test cấp trả lời + top 2; `notify-gop.test.ts` (1 tin/bài/giờ, không tự báo mình); hộp thư có tin |
| AC11 | Chia sẻ: bảng 4 việc — Đăng lại lên Kairos kèm lời mình (bài đăng lại hiện thẻ bài gốc) · Gửi Zalo/app khác (navigator.share, lùi về chép) · Chép link · Tải ảnh; trang công khai /k/[id] cho người chưa có app (xem bài + nút tải app, không lộ SĐT) | thử 4 việc; mở `/k/[id]` cửa sổ ẩn danh, soi HTML không có SĐT |
| AC12 | Tên gọi kiểu FB: tên tự chọn 2–20 ký tự, không trùng (không phân biệt hoa/dấu), cấm giống tên báo/cơ quan nhà nước/SDVICO, cấm chữ bậy, đổi tối đa 1 lần/30 ngày; mặc định từ customers.name hoặc 'Bà con' + 4 số cuối; dòng phụ tự động (cảng nhà / tên cơ sở bên mua); dấu 'Chính thức' cho SDVICO; ảnh đại diện = chữ cái đầu trên nền màu (ảnh tự chọn tuỳ chọn); số hiệu tàu chỉ hiện khi chủ bật | `ten-goi.test.ts`; unique `handle_norm`; đổi lần 2 trong 30 ngày ⇒ 429 |
| AC13 | Trang người dùng /kairos/u/[id]: tên, dòng phụ, số bài, danh sách bài; nút Theo dõi một chiều (không cần duyệt), chip 'Theo dõi' lọc bài người mình theo dõi | thử theo dõi ⇒ chip Theo dõi có bài; URL là uuid, không SĐT |
| AC14 | Bến theo cảng /kairos/ben/[port]: mỗi cảng trong danh mục là một nhóm tự có, hiện bài nhắc/gắn cảng đó + nút đăng thẳng vào Bến | mở `/kairos/ben/sa-huynh`; đăng từ Bến ⇒ bài có `ports=['sa-huynh']`; mã lạ ⇒ 404 |
| AC15 | Báo xấu bài/bình luận (lý do chọn sẵn) + Chặn người (ẩn mọi bài/bình luận của họ với mình); lọc chữ bậy chạy TRÊN MÁY CHỦ khi ghi | `loc-chu.test.ts`; gọi thẳng route với chữ bậy (bỏ qua app) ⇒ 400; chặn ⇒ feed không còn bài người đó |
| AC16 | Quản trị: tab 'Kairos' trong nhóm Nội dung (admin-nav.ts) — hàng đợi báo xấu, ẩn/hiện bài và bình luận, cấm SĐT đăng, SDVICO đăng bài chính thức + ghim/bỏ ghim, xem bài báo bị cờ chủ quyền; quyền theo permsFor; nhật ký thao tác (audit) giữ 2 năm | `admin-nav.test.ts`; `staff-permissions` test tab `kairos`; mỗi thao tác có dòng `kairos_audit` |
| AC17 | Thu tin báo: scripts/kairos-thu.mjs đọc RSS 5 báo (NN&MT thuy-san + bien-dao, Thủy sản VN, VnExpress, Tuổi Trẻ, Thanh Niên — mỗi báo các mục thời sự/thế giới/pháp luật/thể thao/giải trí/sức khoẻ/kinh doanh/đời sống), chuẩn hoá link + chặn trùng (link vĩnh viễn, tiêu đề 7 ngày), gắn chủ đề theo mục + khu vực theo AC05, gom 20 bài/lượt gọi `claude -p --model claude-haiku-5-5 --output-format json --max-turns 1` cấm công cụ, thư mục rỗng, prompt qua stdin (khuôn AI-Assistant train/thay/opus.mjs), hết hạn mức/lỗi ⇒ dùng mô tả RSS gốc; POST lên /api/kairos/nhap có khoá bí mật (env, không hardcode); phần thuần có test; runbook cài systemd timer 15 phút trên gpu-desktop (CHỈ viết hướng dẫn, không cài) | `thu-core.test.ts`; chạy `node scripts/kairos-thu.mjs --dry` trên Mac (giả `claude` hỏng ⇒ dùng mô tả RSS); grep không có khoá cứng; runbook có mục timer |
| AC18 | Chủ quyền: loại bài/tóm tắt có 'South China Sea', 'Nam Hải' chỉ Biển Đông, tên Trung Quốc cho Hoàng Sa/Trường Sa (Tây Sa, Nam Sa, Xisha, Nansha, Paracel/Spratly kèm China…); kiểm cả bài vào và bản tóm tắt ra; prompt bắt buộc 'Biển Đông', 'Hoàng Sa/Trường Sa của Việt Nam'; có test chuỗi | `chu-quyen.test.ts` (dương + âm tính); test prompt chứa hai cụm bắt buộc |
| AC19 | Offline: forfish.kairos.v1 lưu tối đa 200 bài chỉ chữ (trần ~300 KB, cắt bài cũ khi vượt, KHÔNG đụng forfish.fc.*), mất sóng hiện bản lưu kèm 'Lưu lúc…'; nháp bài/bình luận chỉ chữ (forfish.kairos.nhap.v1), nút ghi báo 'cần sóng', không gửi ngầm; /kairos vào SHELL của public/sw.js (bump vỏ) + qa-offline-acceptance cập nhật; khoá mới ghi vào ops/state-registry.md | `kairos-cache.test.ts` (200 bài, trần KB, cách ly SĐT); `sw-cache-policy` test; chạy ca mới trong qa-offline-acceptance |
| AC20 | Dữ liệu: migration 0065 (bảng bài, bình luận, hay, theo dõi, chặn, báo xấu, hồ sơ tên gọi, nguồn báo/chặn trùng, audit; bucket kairos-media) theo khuôn 0063: RLS bật + revoke all, không policy, mọi ghi qua route server + identityFromRequest; KHÔNG áp lên remote; 04-data-model cập nhật cùng lúc (pre-commit hook kiểm migration↔04) | đọc 0065 đủ bảng §6; `sh .githooks/pre-commit --self-test` |
| AC21 | Bảo mật: SĐT không bao giờ ra client trong dữ liệu Kairos; validate mọi input ở route; giới hạn tần suất ghi theo SĐT; khách chưa đăng nhập đọc được, ghi thì 401; route /api/kairos/nhap từ chối khi sai khoá | test mapper hàng ⇒ DTO không có `phone`; curl ghi không chuỗi ⇒ 401; `nhap` sai khoá ⇒ 401 |
| AC22 | Tài liệu cùng nhánh: docs/app-map/14-ba-spec-kairos.md (AC + Assumptions), 02-architecture (route/component), 03 (component mới), 04, 07 (màn + ma trận trạng thái + §4 dock), ops/external-services (RSS + claude -p), ops/runbook (timer GPU), state-registry; README app-map có mục 14 | grep từng file có mục Kairos |
| AC23 | Chất lượng: `npm test` xanh toàn bộ, `npx tsc --noEmit` sạch, `npm run lint` không lỗi mới; `sh .githooks/pre-commit --self-test` qua; không hex/rgba rời, không px (REM), token màu qua globals.css; tiếng Việt đời thường, không emoji | chạy 4 lệnh; grep `#[0-9a-f]{3,6}\|rgba(\|[0-9]px` trong file mới |

## Assumptions

Spec tự quyết, chưa có câu chốt của anh Long — đổi thì sửa ở đây trước.

- **A1** Giới hạn: 10 bài/ngày · 60 bình luận/ngày · 30 ảnh/ngày · 20 báo xấu/ngày · 100 theo dõi+chặn/ngày · 300 Hay/giờ. Theo ngày đếm **trong DB** (Vercel nhiều instance); Hay đếm bằng `rate-limit.ts` (nợ đã ghi ở file đó).
- **A2** Bình luận ≤1.000 ký tự; ảnh ≤512 KB sau nén, cạnh dài 1.600.
- **A3** Thông báo trả lời gộp 1 tin/bài/người nhận/giờ, có đẩy lên máy.
- **A4** Xếp theo thói quen chỉ trong từng trang 20 bài — cuộn vô tận không nhảy bài.
- **A5** Quảng Trị ⇒ Miền Trung; Cà Mau ⇒ cả Đông Nam Bộ lẫn Tây Nam Bộ; An Giang ⇒ Tây Nam Bộ; DK1 ⇒ Hoàng Sa–Trường Sa; tỉnh không giáp biển chỉ gắn tỉnh.
- **A6** Bài báo ở dòng tin 30 ngày; bài bà con không hết hạn.
- **A7** ≥5 người khác nhau báo xấu ⇒ tự ẩn chờ người trực (audit `he-thong`).
- **A8** Bài báo/Chính thức không có chủ bà con ⇒ không thông báo bình luận.
- **A10** `kairos-media` public đọc như `market-media` (cần cho `/k/[id]`).
- **A11** Đăng lại 1 tầng; bài gốc xoá ⇒ "Bài gốc không còn".
- **A12** Ảnh bìa bài báo = link ảnh RSS, không tải về kho.
- **A13** `app_config.kairos_enabled` mặc định bật ở dev; tắt ⇒ dock ẩn ô Kairos.
- **A14** "permsFor" ở AC16 = bộ `staff-permissions` hiện có (`can()`/`visibleTabs`).
- **A15** 6 token màu `--kairos-av-1..6` mới trong `globals.css` (03 cập nhật).
- **A16** Một khoá ingest; đổi khoá = đổi env cả Vercel lẫn máy GPU.

---

Last updated: 2026-10-23
