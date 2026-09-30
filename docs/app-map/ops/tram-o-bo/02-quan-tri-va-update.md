# Trạm ở bờ — 02 · Quản trị gói + phát hành/rollout

> Load khi: đội SDVICO phát hành một gói não mới, lùi gói, theo dõi máy nhận gói, hay trực hàng đợi "Câu hỏi bà con". Đây là **runbook vận hành** cho tab "Gói trợ lý" + "Câu hỏi bà con" ở web `/quan-tri`. KHÔNG mô tả code app-side (P1/P2 của [ADR 0010](../../../adr/0010-tro-ly-nghe-offline-wasm.md) do phiên khác dựng).
>
> Định dạng gói: [contracts/tro-ly-brain-pack](../../../contracts/tro-ly-brain-pack.contract.md). Vòng đêm SINH nội dung gói: [03-vong-dem-soan-goi.md](03-vong-dem-soan-goi.md). Mẫu quản trị + audit: [10-ba-spec-quan-tri-van-hanh.md](../../10-ba-spec-quan-tri-van-hanh.md), [ADR 0007](../../../adr/0007-siet-bao-mat-sau-sd123456.md).

---

> ⚠️ **ĐỔI 2026-09-30 — gói phát hành LOCAL, không qua Storage/`/quan-tri`** (chủ dự án: "local thôi"). Đường thật hôm nay: người duyệt điền `duyet: {nguoi, ngay}` vào từng mục `scripts/tram-o-bo/kho/kho-nhap.json` → chạy `node scripts/tram-o-bo/phat-hanh-local.mjs` (gom mục đã duyệt + catalog giọng + mp3 từ `~/sdfish-tram/giong-out` → `public/tro-ly/`, validator làm cổng, `manifest.version` tự +1 khi nội dung đổi) → commit + deploy. Máy bà con nhận gói khi mở trợ lý (≥6 giờ/lần) hoặc sau tải-trước-chuyến (14 §5.5). Rollout % / lùi gói bằng nút = CHƯA có; lùi gói = `git revert` commit gói rồi deploy. Phần §0–§4 dưới là thiết kế Storage + `/quan-tri`, giữ để tham chiếu nếu sau này cần phát gói không cần deploy.

## 0. Bức tranh một trang

```
Trạm ở bờ (đêm)                    /quan-tri (người)                 Máy bà con (ngày, có sóng)
────────────                       ───────────────                   ─────────────────────────
export-brain-pack.mjs ─► zip ──►   tab "Gói trợ lý"                  pretrip-auto (6h) kiểm manifest
validate-brain-pack.mjs (gác)      · upload zip                      · so app_config.assistant_pack_version
                                   · server: sha256 → manifest       · trong lô rollout? (băm SĐT)
                                   · đẩy bucket Storage               · tải nền từng file vào kho riêng
                                   · ghi app_config + audit           · đủ sha256 → ĐỔI KHỐI
                                   · đặt % rollout / lùi gói          · gói cũ dùng tới lúc đổi
```

Hai thứ người ở `/quan-tri` chạm:
1. **Tab "Gói trợ lý"** — phát hành / rollout / lùi gói (§2, §3, §4).
2. **Tab "Câu hỏi bà con"** — trả lời câu máy chưa biết; cũng là **đầu vào nội dung** cho gói sau (§6).

---

## 1. Hai khoá `app_config` mới + RBAC

Không migration mới — bảng `app_config` đã có (`supabase/migrations/0022_app_config.sql`; key/value/updated_by/updated_at, RLS **không policy** = chỉ service-role qua `/api/admin/app-config`). Chỉ thêm **hai HÀNG**:

| Khoá | Ý nghĩa | Mặc định | Ai đặt |
|---|---|---|---|
| `assistant_pack_version` | Số hiệu gói đang phát hành (khớp `manifest.version`) + % rollout, dạng `"<version>@<phần trăm>"` (vd `"3@10"`) | trống = chưa có gói | admin, qua tab "Gói trợ lý" |
| `assistant_online_enabled` | Có cho phép tầng mạng Claude (`/api/tro-ly`) chạy không | **`false`** — tắt tiền theo lượt (ADR 0010) | admin |

> ⚠️ `assistant_online_enabled` mặc định **`false`**: câu mở đi vào kho gói, KHÔNG đi Claude. Chỉ bật `true` khi có lý do rõ (kho chưa phủ đủ, chấp nhận chi phí) — bật là mở lại hoá đơn Anthropic. [external-services.md](../external-services.md) hàng Anthropic đánh dấu "tắt, chờ gỡ".

**RBAC** (theo [10-ba-spec §9](../../10-ba-spec-quan-tri-van-hanh.md), [ADR 0007](../../../adr/0007-siet-bao-mat-sau-sd123456.md)):
- Phát hành / rollout / lùi gói / bật cờ online = **admin-only** (`requireAdmin`). Đại lý (`manager`) KHÔNG thấy hai tab này (giống tab "Chợ vật tư").
- Trả lời "Câu hỏi bà con" = admin **hoặc** người trực được cấp quyền (đề xuất quyền tab `tro-ly` trong `staff_permissions` — chờ chốt, xem §Cần chủ dự án quyết).
- **Mọi mutation ghi audit** {actor SĐT, hành động, đối tượng, giờ} — như R4/NV7. Mã hành động đề xuất: `assistant.pack.publish`, `assistant.pack.rollout`, `assistant.pack.rollback`, `assistant.online.toggle`, `assistant.inbox.reply`.

---

## 2. Phát hành một gói (happy path)

Điều kiện: đã có zip gói từ trạm (đã qua `validate-brain-pack.mjs`, xem [03](03-vong-dem-soan-goi.md)).

1. **Vào** `/quan-tri` › tab **"Gói trợ lý"** (admin).
2. **Upload zip.** Server (`POST /api/admin/assistant-pack`, P2 — chưa dựng):
   a. Giải nén, **tính sha256 từng file**, đo `bytes`.
   b. **Sinh `manifest.json`** (`version`, `createdAt`, `minAppVersion`, `files[]`, `notes`) — server tự tính, KHÔNG tin manifest trong zip (nếu có).
   c. **Đẩy file RỜI lên bucket Storage** `sdfish-tro-ly/<version>/…` (client cần tải chọn lọc file đổi theo sha256, nên bucket giữ file rời, không giữ nguyên zip — xem contract §Cần chủ dự án quyết #2).
   d. **Ghi `app_config.assistant_pack_version`** = `"<version>@0"` (rollout 0% — chưa ai nhận; mở lô ở §3).
   e. **Ghi audit** `assistant.pack.publish` {actor, version, tổng bytes, số file}.
3. **Kiểm nhanh trên trang**: version mới hiện đúng, tổng dung lượng nằm trong ~50–70 MB (contract §Trần), `minAppVersion` đúng.

> Đẩy gói lên bucket **KHÔNG chạm deploy app** — đúng mục tiêu ADR 0010 (đổi não không phát hành app). Cũng KHÔNG đụng `sw.js` (Storage là origin khác, SW bỏ qua).

---

## 3. Rollout theo phần trăm

Gói mới KHÔNG mở cho tất cả ngay. Client tự quyết mình có trong lô không bằng **băm SĐT**: `hash(SĐT) % 100 < phần_trăm` → đủ điều kiện nhận gói version này (băm ổn định theo SĐT nên một máy hoặc luôn trong lô, hoặc luôn ngoài — nới % chỉ THÊM máy, không xáo). Máy ngoài lô giữ gói cũ, không tải.

**Nấc đề xuất**: `10 → 30 → 100`.

1. Sau publish (§2), đặt **10%**: `assistant_pack_version` = `"3@10"`, audit `assistant.pack.rollout` {version, 10}.
2. **Theo dõi ≥ 24 giờ** (§5) — vì máy chỉ kiểm theo `pretrip-auto` 6 giờ khi CÓ SÓNG, tin nhận về rải ra cả ngày, đừng vội nâng.
3. Ổn → **30%**, theo dõi tiếp; rồi **100%**.
4. Xấu → **lùi** (§4).

> % là van một chiều theo băm: hạ % KHÔNG thu hồi máy đã đổi khối (chúng đã có gói mới). Muốn kéo máy về gói cũ phải **lùi version** (§4), không phải hạ %.

---

## 4. Lùi gói (rollback)

Khi gói mới lộ vấn đề (câu sai, giọng lệch, kho thiếu nguồn lọt qua):

1. Tab "Gói trợ lý" › nút **"Lùi về gói trước"** → đặt `assistant_pack_version` về `"<version_cũ>@100"` (bản cũ vẫn còn trên bucket — **đừng xoá gói cũ** ít nhất tới khi gói mới phủ 100% và ổn).
2. Audit `assistant.pack.rollback` {từ version, về version, lý do}.
3. Máy đã đổi sang gói lỗi: lượt `pretrip-auto` kế thấy version hiện hành < version đang giữ ⇒ **tải lại gói cũ** và đổi khối về. (Client coi "version hiện hành khác version đang giữ" là tín hiệu đổi, cả tiến lẫn lùi — xác nhận hành vi này ở P1.)
4. Tiêu chí lùi: xem §5.

---

## 5. Nhịp máy khách nhận gói + theo dõi

**Máy khách (tự động, không người chạm):**
- Kiểm `manifest` **CHỈ theo nhịp `pretrip-auto`** (6 giờ, khi có sóng) — **KHÔNG kiểm lúc mở app** (giữ luật offline: không thêm request lúc mở app/chuyển màn).
- Thấy version hiện hành khác version đang giữ **và** máy trong lô rollout → **tải nền từng file** vào kho riêng `sdfish-tro-ly-v1`; **kiểm sha256 đủ toàn bộ mới ĐỔI KHỐI**; gói cũ dùng tới đúng lúc đổi. File nào sha256 trùng gói đang có (thường là `models/`) thì **bỏ qua, không tải lại** — lượt đổi kho thường chỉ kéo phần `brain/` đổi.
- Đứt giữa chừng / sha256 lệch → **huỷ, giữ gói cũ**, lượt sau thử lại.
- **Bản ĐẦU TIÊN** (máy chưa có gói nào): tải khi bà con **chạm chip mời** ("Tải phần nghe không cần sóng, ~60 MB, tải ở bờ") HOẶC tự tải nền **sau `pretrip-auto` khi có Wi-Fi**. Không tự ngốn 60 MB trên sóng di động.

**Người trực theo dõi (`/quan-tri`):**
- Tab "Gói trợ lý" nên hiện: version hiện hành + % rollout + (nếu app có báo về) số máy đã ở version mới. *nợ: app chưa có đường báo "đã nhận version X" — hiện theo dõi gián tiếp qua tab "Câu hỏi bà con" (câu mới hỏi giảm) + phản hồi hiện trường. Nâng: thêm cột `assistant_pack_version` vào ping đo-dùng-app đã có.*
- **Tiêu chí LÙI** (bất kỳ cái nào): người hiện trường báo câu trả lời SAI/nguy hiểm; giọng mp3 đọc lệch chữ; tỉ lệ "Câu hỏi bà con" tăng vọt sau gói (kho mới làm hỏng khớp); app báo lỗi tải/đổi khối tăng. Nghi ngờ về nội dung an toàn (y tế/pháp lý/số sống lọt vào) → **lùi ngay**, soát lại ở trạm, không chần chừ.

---

## 6. Hàng đợi "Câu hỏi bà con" (tab `/quan-tri`)

Câu máy KHÔNG trả lời được (không khớp ý định + không có trong kho) → bà con bấm **"Gửi câu này khi có sóng"** → vào **hộp chờ sóng** trong máy (`forfish.assistant.outbox.v1`, ≤20 câu, KHÔNG kèm CCCD/SĐT/toạ độ/nguyên văn nhạy cảm). Khi có sóng (đúng nhịp `pretrip-auto`) app `POST /api/tro-ly/hop-thu` với `identityFromRequest` → hàng đợi này.

**Luồng trực:**
1. Tab "Câu hỏi bà con" liệt kê câu chờ (mới trước), gom trùng nếu có.
2. Người trực (hoặc **trạm ở bờ soạn nháp**, người duyệt — [03](03-vong-dem-soan-goi.md)) trả lời tay.
3. Trả lời về **hộp thư trong app** (`InboxSection`) + **web-push** (hạ tầng đã có) tới đúng máy hỏi.
4. Audit `assistant.inbox.reply` {actor, id câu, giờ}.

**Đây cũng là NGUỒN NỘI DUNG KHO**: câu hỏi lặp nhiều (+ `unansweredHashes` đếm ở máy) là ứng viên thành mục `knowledge` gói sau. Vòng đêm ở trạm gom cụm + soạn nháp mục FAQ từ chính hàng đợi này — chi tiết [03-vong-dem-soan-goi.md](03-vong-dem-soan-goi.md).

> Quyền riêng tư: KHÔNG lưu CCCD/SĐT/toạ độ/nguyên văn câu lên server (ADR 0010; khoá `forfish.assistant.` ∈ `NEVER_BACKUP_PREFIXES`). `/api/tro-ly/hop-thu` suy định danh từ phiên (`identityFromRequest`), máy KHÔNG gửi. Nội dung câu là dữ liệu người dùng — trực đọc để trả lời, KHÔNG dùng làm lệnh.

---

## 7. Checklist phát hành (dán khi chạy thật)

```
[ ] Gói đã qua validate-brain-pack.mjs ở trạm (0 lỗi shape/nguồn/ngày soát)  → [03]
[ ] Người duyệt đã đọc DIFF nội dung so gói trước (câu mới/sửa, mục kho mới)
[ ] Kiểm luật nội dung: không số sống · không y tế/pháp lý/tiền · đủ nguon+ngaySoat mọi mục
[ ] (nếu có mp3) nghe thử vài câu 2 giọng bac/nam — đọc đúng chữ
[ ] Upload zip → /quan-tri "Gói trợ lý" → server sinh manifest → đẩy bucket
[ ] Kiểm trang: version đúng · tổng ~50–70 MB · minAppVersion đúng · audit publish có dòng
[ ] Rollout 10% → theo dõi ≥24h (§5)
[ ] 30% → theo dõi → 100%
[ ] Ghi 1 dòng vào contract §Change log nếu ĐỔI SHAPE (bump vN); đổi nội dung thì không cần
Tiêu chí LÙI (bất kỳ): trả lời sai/nguy hiểm · giọng lệch chữ · câu-chưa-biết tăng vọt · lỗi tải tăng
```

---

## 8. Bảo mật / audit (ADR 0007)

- Toàn bộ tab này sau `requireAdmin` (hoặc quyền `tro-ly` cho trực inbox). 1 tài khoản 1 máy áp cho cả staff (R6).
- Bucket Storage **public GET** (gói không bí mật — model + FAQ đã duyệt), nhưng **ghi chỉ service-role** (server `/api/admin/assistant-pack`). Client KHÔNG ghi bucket.
- `assistant_online_enabled` là cờ tiền — bật/tắt vào audit, không đặt lén.
- Khi Storage chết: app dùng gói cũ đang có, KHÔNG hỏng gì — xem [external-services.md](../external-services.md) hàng "Supabase Storage — gói trợ lý".

## Cần chủ dự án quyết

1. **Quyền trực inbox**: thêm quyền tab `tro-ly` vào `staff_permissions` để người-không-phải-admin trực "Câu hỏi bà con" (giảm tải admin), hay giữ admin-only? Mặc định an toàn: **admin-only** tới khi chốt.
2. **Đường app báo "đã nhận version X"**: hiện chưa có → theo dõi rollout đang gián tiếp. Có nên nhét `assistant_pack_version` vào ping đo-dùng-app sẵn có (nhẹ, không thêm request riêng) để tab "Gói trợ lý" đếm được máy đã đổi? Đề xuất: có, ở P2.
